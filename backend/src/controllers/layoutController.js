import axios from "axios";
import { xiboRequest, xiboGetWithCount } from "../utils/xiboClient.js";
import {
  getWebClient,
  getWebBaseUrl,
  invalidateWebSession,
  WebSessionNotConfiguredError,
} from "../utils/xiboWebSession.js";
import {
  fetchUserScopedCollection,
  getUserContext,
  getOrCreateToken,
  handleControllerError,
  HttpError,
} from "../utils/xiboDataHelpers.js";
import path from "node:path";
import { parseXlf } from "./layoutPreviewProxy.js";
import { createTtlCache } from "../utils/ttlCache.js";
import { createDiskThumbCache } from "../utils/diskThumbCache.js";

// Persistent (disk-backed) cache for layout thumbnails so we rarely re-hit the
// slow Xibo web UI — and never re-pay it after a restart/deploy. 1-hour TTL;
// bust on republish to refresh sooner (Step 2). See utils/diskThumbCache.
const layoutThumbCache = createDiskThumbCache({
  dir: path.join(process.cwd(), ".cache", "thumbnails", "layout"),
  ttlMs: 60 * 60 * 1000,
});

// Negative cache for the per-parent "has an open draft?" lookup that runs on
// every designer open. We only cache the NULL result (no draft found): a stale
// entry can only make us skip the lookup and fall through to the normal checkout
// flow — never redirect to a draft that no longer exists. Invalidated on
// checkout (which creates a draft). Short TTL bounds drafts created out-of-band
// (e.g. directly in the Xibo CMS UI).
const noDraftCache = createTtlCache({ maxSize: 500, ttlMs: 60 * 1000 });

// A web response that is actually the login page / a redirect to /login means the
// shared session has expired and we should re-login and retry.
const looksLikeLoginRedirect = (response) => {
  if (!response) return false;
  const status = response.status;
  const location = response.headers?.location || "";
  if (status === 401 || status === 403) return true;
  if (status >= 300 && status < 400 && location.includes("login")) return true;
  const contentType = response.headers?.["content-type"] || "";
  // A successful thumbnail is an image; HTML back means we got the login page.
  if (status === 200 && contentType.includes("text/html")) return true;
  return false;
};

const LAYOUT_EMBED_FIELDS =
  "regions,playlists,widgets,widget_validity,tags,permissions,actions";

export const getLayouts = async (req, res) => {
  try {
    // Opt-in server-side pagination: only when the client sends `length` (the
    // Layouts list view). Other consumers (the schedule layout dropdown, the
    // draft lookup) send no `length` and still get the full owner-scoped list,
    // so their behavior is unchanged.
    if (req.query.length !== undefined) {
      const { token, userId } = getUserContext(req);
      const start = Math.max(0, parseInt(req.query.start, 10) || 0);
      const length = Math.max(1, parseInt(req.query.length, 10) || 20);
      const search = (req.query.search || "").trim();

      const params = new URLSearchParams({
        start: String(start),
        length: String(length),
        "order[0][column]": "modifiedDt",
        "order[0][dir]": "desc",
        embed: LAYOUT_EMBED_FIELDS,
      });
      if (userId !== undefined && userId !== null) {
        params.append("ownerId", String(userId));
        params.append("userId", String(userId));
      }
      // Xibo filters layouts by name with the `layout` param (LIKE match).
      if (search) params.append("layout", search);

      const { data, total } = await xiboGetWithCount(
        `/layout?${params.toString()}`,
        token
      );
      return res.json({
        data,
        total,
        recordsTotal: total,
        recordsFiltered: total,
      });
    }

    const layouts = await fetchUserScopedCollection({
      req,
      endpoint: "/layout",
      idKeys: ["layoutId", "layout_id", "id"],
      queryParams: {
        embed: LAYOUT_EMBED_FIELDS,
      },
    });

    res.json({ data: layouts, total: layouts.length });
  } catch (err) {
    handleControllerError(res, err, "Failed to fetch layouts");
  }
};

export const publishLayout = async (req, res) => {
  const { layoutId } = req.params;

  try {
    const { token } = getUserContext(req);

    const result = await xiboRequest(
      `/layout/publish/${layoutId}`,
      "PUT",
      req.body,
      token
    );

    res.json(result);
  } catch (err) {
    handleControllerError(res, err, "Failed to publish layout");
  }
};

export const checkoutLayout = async (req, res) => {
  const { layoutId } = req.params;

  try {
    const { token } = getUserContext(req);

    console.log(`[checkoutLayout] Requesting checkout for layoutId: ${layoutId}`);

    // Use standard Xibo Checkout API
    // PUT /layout/checkout/{layoutId}
    // This creates a draft of the published layout
    const result = await xiboRequest(
      `/layout/checkout/${layoutId}`,
      "PUT",
      null,
      token
    );

    console.log(`[checkoutLayout] Checkout successful. Result:`, JSON.stringify(result));

    // A draft now exists for this parent — drop any cached "no draft" entry so
    // the next designer open detects it.
    noDraftCache.delete(String(layoutId));

    // Result should contain the new draft layout object or ID
    res.json(result);

  } catch (err) {
    if (err.response && err.response.status === 422) {
       // 422 usually means "Already checked out"
       console.warn(`[checkoutLayout] 422 Error: Already checked out?`, err.response.data);
       // We might want to try to find the existing draft here, or just let the frontend handle the error
       // For now, let's pass the error to frontend so it can decide (frontend has findDraft logic)
    }
    handleControllerError(res, err, "Failed to checkout layout");
  }
};

export const getLayoutDetails = async (req, res) => {
  try {
    const { layoutId } = req.params;
    const { token } = getUserContext(req);

    if (!layoutId) {
      return res.status(400).json({ message: "Layout ID is required" });
    }

    const params = new URLSearchParams({
      layoutId: String(layoutId),
      embed: LAYOUT_EMBED_FIELDS,
    });

    let response;
    try {
      response = await xiboRequest(
        `/layout?${params.toString()}`,
        "GET",
        null,
        token
      );
    } catch (filterError) {
      console.warn(
        "Layout filtered request failed, falling back to full list",
        filterError.message
      );
      response = await xiboRequest(
        `/layout?embed=${encodeURIComponent(LAYOUT_EMBED_FIELDS)}`,
        "GET",
        null,
        token
      );
    }

    let layouts = [];
    if (Array.isArray(response)) {
      layouts = response;
    } else if (Array.isArray(response?.data)) {
      layouts = response.data;
    } else if (response?.data) {
      layouts = [response.data];
    } else if (response) {
      layouts = [response];
    }

    const layout =
      layouts.find(
        (item) =>
          String(item.layoutId || item.layout_id || item.id) ===
          String(layoutId)
      ) || null;

    if (!layout) {
      return res.status(404).json({ message: "Layout not found" });
    }

    const normalizeWidgets = (widgets = []) =>
      (widgets || []).map((widget) => {
        const widgetId = widget.widgetId || widget.widget_id || widget.id;
        const mediaIds =
          widget.mediaIds ||
          widget.media_ids ||
          (widget.mediaId || widget.media_id
            ? [widget.mediaId || widget.media_id]
            : []);

        return {
          ...widget,
          widgetId,
          mediaIds,
        };
      });

    const normalizedRegions = (layout.regions || []).map((region) => {
      const playlist =
        region.regionPlaylist ||
        region.playlist ||
        (layout.playlists || []).find(
          (pl) =>
            String(pl.regionId || pl.region_id) ===
            String(region.regionId || region.region_id)
        );

      const widgetsFromRegion =
        region.widgets || playlist?.widgets || playlist?.regionWidgets || [];

      return {
        ...region,
        regionId: region.regionId || region.region_id,
        playlist,
        widgets: normalizeWidgets(widgetsFromRegion),
      };
    });

    const normalizedLayout = {
      ...layout,
      layoutId: layout.layoutId || layout.id,
      regions: normalizedRegions,
      playlists:
        layout.playlists ||
        normalizedRegions.map((region) => region.playlist).filter(Boolean),
      thumbnail:
        layout.thumbnail || `/layout/thumbnail/${layout.layoutId || layoutId}`,
    };

    // CHECK FOR EXISTING DRAFTS
    // Check if there is an open Draft (status 2) for this layout.
    // This allows us to redirect from Parent (Read Only) -> Child (Editable Draft)
    // We check if this layout IS a parent (parentId is 0 or null)
    let existingDraftId = null;
    const isParent = !normalizedLayout.parentId || normalizedLayout.parentId === 0;
    const draftKey = String(layoutId);

    // Skip the lookup when we've recently confirmed this parent has no draft.
    // We only ever cache that NULL result, so a stale hit just falls through to
    // the normal checkout flow (never a redirect to a missing draft).
    if (isParent && !noDraftCache.get(draftKey)) {
       try {
          // Look for children of this layout that are Drafts (status 2)
          const draftResponse = await xiboRequest(
            `/layout?parentId=${layoutId}&publishedStatusId=2&embed=`, // Minimal fetch
            "GET",
            null,
            token
          );

          let drafts = [];
          if (Array.isArray(draftResponse)) {
            drafts = draftResponse;
          } else if (draftResponse && Array.isArray(draftResponse.data)) {
            drafts = draftResponse.data;
          } else if (draftResponse) {
               drafts = [draftResponse];
          }

          // Filter just in case API returns loose matches
           const exactDraft = drafts.find(d => String(d.parentId) === String(layoutId));

           if (exactDraft) {
               existingDraftId = exactDraft.layoutId;
               console.log(`[getLayoutDetails] Found existing draft ${existingDraftId} for layout ${layoutId}`);
           } else {
               // Confirmed no draft — cache so repeated opens skip this lookup.
               noDraftCache.set(draftKey, true);
           }

       } catch (draftErr) {
           console.warn("[getLayoutDetails] Failed to check for existing drafts:", draftErr.message);
       }
    }

    res.json({
      layout: normalizedLayout,
      existingDraftId: existingDraftId, // Send valid draft ID if found
      preview: {
        thumbnailEndpoint: `/layouts/${layoutId}/thumbnail`,
        thumbnailPath: normalizedLayout.thumbnail,
        previewPath: `/layout/preview/${layoutId}`,
      },
    });
  } catch (err) {
    handleControllerError(res, err, "Failed to fetch layout details");
  }
};

// Fallback thumbnail: when Xibo has no layout snapshot, use the first region's
// first media's (small) library thumbnail via the shared web session.
const fetchFirstMediaThumb = async (layoutId) => {
  const base = getWebBaseUrl();
  const client = await getWebClient();
  const xlfRes = await client.get(`${base}/layout/xlf/${layoutId}`, {
    responseType: "text",
    validateStatus: (s) => s < 500,
  });
  if (xlfRes.status >= 400) return null;
  const { regions } = parseXlf(String(xlfRes.data || ""));
  const region = (regions || []).find((r) => r.fileId);
  if (!region) return null;
  const thumbRes = await client.get(
    `${base}/library/thumbnail/${region.fileId}`,
    { responseType: "arraybuffer", validateStatus: (s) => s < 500 }
  );
  if (thumbRes.status >= 400) return null;
  const ct = thumbRes.headers["content-type"] || "image/png";
  if (ct.includes("text/html")) return null; // login/error page, not an image
  return { buffer: Buffer.from(thumbRes.data, "binary"), contentType: ct };
};

export const getLayoutThumbnail = async (req, res) => {
  try {
    const { layoutId } = req.params;

    if (!layoutId) {
      throw new HttpError(400, "Layout ID is required");
    }

    // Serve from cache when available
    const cached = layoutThumbCache.get(layoutId);
    if (cached) {
      res.setHeader("Content-Type", cached.contentType);
      res.setHeader("Cache-Control", "public, max-age=300");
      res.setHeader("X-Layout-Thumb-Cache", "HIT");
      return res.end(cached.buffer);
    }

    // Layout thumbnails are a WEB-UI resource (no /api), served with a cookie
    // session — the OAuth API has no layout/thumbnail endpoint.
    const url = `${getWebBaseUrl()}/layout/thumbnail/${layoutId}`;

    // Fetch via the shared web session; on a dead session, re-login once and retry.
    const fetchOnce = async () => {
      const client = await getWebClient();
      return client.get(url, {
        responseType: "arraybuffer",
        // Follow redirects (Xibo may redirect to the image file); don't throw on
        // non-2xx so we can detect a dead session (we end up on the login HTML page).
        validateStatus: (status) => status < 500,
      });
    };

    console.log(`[getLayoutThumbnail] Fetching from: ${url}`);
    let response = await fetchOnce();

    if (looksLikeLoginRedirect(response)) {
      console.warn(
        `[getLayoutThumbnail] Web session looks expired; re-logging in and retrying ${layoutId}...`
      );
      invalidateWebSession();
      response = await fetchOnce();
    }

    if (response.status >= 400 || looksLikeLoginRedirect(response)) {
      // Xibo has no generated snapshot for this layout (common for drafts and
      // many layouts). Fall back to the layout's first media thumbnail so the
      // list still shows a representative image instead of a placeholder.
      const fb = await fetchFirstMediaThumb(layoutId).catch(() => null);
      if (fb) {
        layoutThumbCache.set(layoutId, { buffer: fb.buffer, contentType: fb.contentType });
        res.setHeader("Content-Type", fb.contentType);
        res.setHeader("Cache-Control", "public, max-age=300");
        res.setHeader("X-Layout-Thumb-Cache", "FALLBACK");
        return res.end(fb.buffer);
      }
      return res.status(404).send("Thumbnail not available");
    }

    let contentType = response.headers["content-type"] || "image/png";
    if (contentType.includes("text/html")) contentType = "image/png";

    const buffer = Buffer.from(response.data, "binary");
    layoutThumbCache.set(layoutId, { buffer, contentType });

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("X-Layout-Thumb-Cache", "MISS");
    res.end(buffer);
  } catch (err) {
    // Web session not configured, or an unexpected failure → graceful 404 so the
    // UI shows its placeholder instead of surfacing a 500.
    if (err instanceof WebSessionNotConfiguredError) {
      console.warn(`[getLayoutThumbnail] ${err.message}`);
      return res.status(404).send("Thumbnail unavailable (web session not configured)");
    }
    console.error("Error fetching layout thumbnail:", err.message);
    return res.status(404).send("Thumbnail not available");
  }
};



export const getLayoutPreview = async (req, res) => {
    try {
        const { layoutId } = req.params;
        const { token } = await getOrCreateToken(req);

        // Try to export/download the layout
        // Based on user hint: "preview of a layout should be made that is via download"
        // We will try /layout/export/{layoutId} which is the standard Xibo export endpoint
        const xiboApiUrl = process.env.XIBO_API_URL;
        const url = `${xiboApiUrl}/layout/export/${layoutId}`;

        console.log(`[getLayoutPreview] Fetching from: ${url}`);

        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            responseType: 'stream'
        });

        // Set appropriate headers for download
        res.setHeader(
            "Content-Type",
            response.headers["content-type"] || "application/octet-stream"
        );
        res.setHeader(
            "Content-Disposition",
            response.headers["content-disposition"] || `attachment; filename="layout-${layoutId}.zip"`
        );

        response.data.pipe(res);

    } catch (err) {
        console.error("Error fetching layout preview/download:", err.message);
        // Extract safe error information to avoid circular reference issues
        const safeError = {
            message: err.message,
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data
        };
        console.error("Error details:", safeError);
        
        // Send error response
        const statusCode = err.response?.status || 500;
        res.status(statusCode).json({
            success: false,
            message: "Failed to download layout preview",
            error: err.message
        });
    }
};
export const updateWidget = async (req, res) => {
  const { widgetId } = req.params;
  // Create a shallow copy so we can modify it
  let widgetData = { ...req.body };

  try {
    const { token } = getUserContext(req);

    console.log(`[updateWidget] Updating widget ${widgetId}`);

    // --- FIX START: CONFLICT RESOLUTION ---
    // If we are updating 'elements' (Canvas/Global), Xibo will ignore it if 'mediaIds' is also present.
    // We must strictly remove 'mediaIds' when 'elements' is defined.
    if (widgetData.elements) {
      console.log(`[updateWidget] Detected 'elements' update. Removing 'mediaIds' to ensure Xibo processes the canvas update.`);
      delete widgetData.mediaIds;
    }
    // --- FIX END ---

    console.log(`[updateWidget] Final Payload Keys:`, Object.keys(widgetData));

    // Xibo API expects PUT /playlist/widget/{widgetId}
    // xiboRequest (via utils/xiboClient.js) handles the form-urlencoded conversion automatically
    const result = await xiboRequest(
      `/playlist/widget/${widgetId}`,
      "PUT",
      widgetData,
      token
    );

    console.log(`[updateWidget] ✓ Successfully updated widget ${widgetId}`);
    res.json(result);
  } catch (err) {
    console.error(`[updateWidget] ✗ Error updating widget ${widgetId}:`, err.message);
    handleControllerError(res, err, "Failed to update widget");
  }
};
