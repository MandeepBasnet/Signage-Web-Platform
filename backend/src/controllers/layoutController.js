import axios from "axios";
import { xiboRequest, getAccessToken } from "../utils/xiboClient.js";
import {
  getWebClient,
  getWebBaseUrl,
  invalidateWebSession,
  WebSessionNotConfiguredError,
} from "../utils/xiboWebSession.js";
import {
  fetchUserScopedCollection,
  getUserContext,
  handleControllerError,
  HttpError,
} from "../utils/xiboDataHelpers.js";

// In-memory LRU cache for layout thumbnails so we rarely re-hit the Xibo web UI.
// Same approach as the media thumbnail cache in libraryController.
const LAYOUT_THUMB_CACHE = new Map(); // layoutId -> { buffer, contentType, expiresAt }
const LAYOUT_THUMB_CACHE_MAX = 500;
const LAYOUT_THUMB_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const getCachedLayoutThumb = (key) => {
  const entry = LAYOUT_THUMB_CACHE.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    LAYOUT_THUMB_CACHE.delete(key);
    return null;
  }
  // Mark most-recently-used
  LAYOUT_THUMB_CACHE.delete(key);
  LAYOUT_THUMB_CACHE.set(key, entry);
  return entry;
};

const setCachedLayoutThumb = (key, buffer, contentType) => {
  LAYOUT_THUMB_CACHE.set(key, {
    buffer,
    contentType,
    expiresAt: Date.now() + LAYOUT_THUMB_CACHE_TTL_MS,
  });
  while (LAYOUT_THUMB_CACHE.size > LAYOUT_THUMB_CACHE_MAX) {
    const oldest = LAYOUT_THUMB_CACHE.keys().next().value;
    LAYOUT_THUMB_CACHE.delete(oldest);
  }
};

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

    if (isParent) {
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

export const getLayoutThumbnail = async (req, res) => {
  try {
    const { layoutId } = req.params;

    if (!layoutId) {
      throw new HttpError(400, "Layout ID is required");
    }

    // Serve from cache when available
    const cached = getCachedLayoutThumb(layoutId);
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

    if (response.status === 404) {
      return res.status(404).send("Thumbnail not found");
    }
    if (response.status >= 400 || looksLikeLoginRedirect(response)) {
      // Couldn't get a real image — let the frontend show its placeholder.
      return res.status(404).send("Thumbnail not available");
    }

    let contentType = response.headers["content-type"] || "image/png";
    if (contentType.includes("text/html")) contentType = "image/png";

    const buffer = Buffer.from(response.data, "binary");
    setCachedLayoutThumb(layoutId, buffer, contentType);

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
        let { token } = getUserContext(req);

        if (!token) {
            token = await getAccessToken();
        }

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
