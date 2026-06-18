import axios from "axios";
import FormData from "form-data";
import path from "path";
import { Readable } from "stream";
import {
  getAccessToken,
  xiboRequest,
  xiboGetWithCount,
} from "../utils/xiboClient.js";
import {
  fetchLibraryCollection,
  getUserContext,
  handleControllerError,
  HttpError,
} from "../utils/xiboDataHelpers.js";
import { createTtlCache } from "../utils/ttlCache.js";
import { createDiskThumbCache } from "../utils/diskThumbCache.js";
import { withSignedMediaUrls } from "../utils/mediaUrlSigner.js";

// Extract the display name field that Xibo uses for duplicate checking
// Xibo checks the "name" field (display name), not fileName
export const extractMediaName = (item) => {
  // Only check the name field - this is what Xibo uses for duplicate detection
  // Also handle cases where name might be null or empty string
  const mediaName = item?.name || item?.mediaName || item?.media_name || null;
  // Return null for empty strings to avoid false positives
  return typeof mediaName === "string" && mediaName.trim()
    ? mediaName.trim()
    : null;
};

export const ensureExtension = (desiredName, fallbackName) => {
  const fallbackExt = path.extname(fallbackName || "");
  if (!fallbackExt) return desiredName;
  return path.extname(desiredName || "")
    ? desiredName
    : `${desiredName}${fallbackExt}`;
};

export const checkMediaNameAvailability = async (req, desiredName) => {
  const target = desiredName?.trim();

  // Validate name length before checking duplicates
  // Xibo API requires 1-100 characters
  if (!target || target.length === 0 || target.length > 100) {
    console.warn(
      `Invalid name length: "${desiredName}" (${
        target?.length || 0
      } chars). Must be 1-100 characters.`
    );
    return {
      hasConflict: true,
      originalName: desiredName,
      suggestedName: `Media_${Date.now()}`,
      error: `Name must be between 1 and 100 characters`,
    };
  }

  try {
    const userXiboToken = req.user?.xiboToken;
    const userXiboUserId = req.user?.id || req.user?.userId;

    if (!userXiboUserId) {
      console.warn(
        "User ID missing for duplicate checking. Skipping pre-check."
      );
      return {
        hasConflict: false,
        originalName: target,
        suggestedName: target,
      };
    }

    // Query the user's own media, narrowed by Xibo's server-side name filter
    // (`media=`), so we fetch only name-matching candidates instead of the whole
    // library. Xibo checks duplicates per user (ownerId), case-insensitively.
    // The `media=` filter is a substring (LIKE) match, so we still confirm with
    // an exact, case-insensitive comparison on the returned rows — preserving the
    // previous behavior while replacing the up-to-50k-row full-library sweep.
    const targetLower = target.toLowerCase();
    const candidates = [];
    const pageSize = 1000;

    // The name filter normally returns a handful of rows; cap the scan at a few
    // pages purely as a safety net (vs. the old 50-page / 50k-row sweep).
    for (let pageNum = 0; pageNum < 5; pageNum++) {
      const start = pageNum * pageSize;
      const queryStr = `/library?start=${start}&length=${pageSize}&draw=${
        pageNum + 1
      }&ownerId=${userXiboUserId}&media=${encodeURIComponent(target)}`;

      let pageResponse;
      try {
        pageResponse = await xiboRequest(queryStr, "GET", null, userXiboToken);
      } catch (pageErr) {
        console.error(
          `Error fetching filtered media page ${pageNum}:`,
          pageErr.message
        );
        // Don't fail the upload on a lookup error — proceed with what we have.
        break;
      }

      const pageItems = Array.isArray(pageResponse)
        ? pageResponse
        : Array.isArray(pageResponse?.data)
        ? pageResponse.data
        : [];

      if (!pageItems.length) break;
      candidates.push(...pageItems);
      if (pageItems.length < pageSize) break;
    }

    // Exact, case-insensitive match against the display name Xibo dedupes on.
    const hasConflict = candidates.some(
      (item) => extractMediaName(item)?.toLowerCase() === targetLower
    );

    console.log(
      `Duplicate check for "${target}" (user ${userXiboUserId}): ` +
        `${candidates.length} name-filtered candidate(s), conflict=${hasConflict}`
    );

    if (!hasConflict) {
      return {
        hasConflict: false,
        originalName: target,
        suggestedName: target,
      };
    }

    const ext = path.extname(target);
    const base =
      target.substring(0, target.length - ext.length).trim() || "Media";
    const timestamp = Date.now();
    const uniqueName = `${base}_${timestamp}${ext}`;

    console.log(`Suggested unique media name: "${uniqueName}"`);
    return {
      hasConflict: true,
      originalName: target,
      suggestedName: uniqueName,
    };
  } catch (err) {
    console.warn("Failed to check existing media names:", err.message);
    // Don't fail the upload if duplicate check fails
    return {
      hasConflict: false,
      originalName: target,
      suggestedName: target,
    };
  }
};

export const validateMediaName = async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || !name.trim()) {
      throw new HttpError(400, "Media name is required for validation");
    }

    const normalizedName = ensureExtension(name.trim(), name.trim());
    const availability = await checkMediaNameAvailability(req, normalizedName);

    if (availability.hasConflict) {
      return res.status(409).json({
        success: false,
        message: `A media named '${availability.originalName}' already exists in your library. Please choose another name.`,
        nameInfo: {
          originalName: availability.originalName,
          suggestedName: availability.suggestedName,
          wasChanged: true,
          changeReason: `The name "${availability.originalName}" is already in use. Suggested alternative: "${availability.suggestedName}".`,
        },
      });
    }

    return res.json({
      success: true,
      nameInfo: {
        originalName: availability.originalName,
        suggestedName: availability.originalName,
        wasChanged: false,
        changeReason: null,
      },
    });
  } catch (err) {
    handleControllerError(res, err, "Failed to validate media name");
  }
};

// Per-user library access in this deployment is FOLDER-based: each user has a
// home folder (user.homeFolderId) and their media lives in it (verified live:
// the media is often owned by an admin and carries no per-item group
// permissions, so owner/group filtering does NOT work). So we scope media and
// the folder picker to the user's home folder and its descendants. With the
// shared super-admin token /folders returns the whole CMS tree, so we slice the
// subtree rooted at the user's home folder.
const MEDIA_ID_KEYS = ["mediaId", "media_id", "id"];
const accessibleFoldersCache = createTtlCache({
  maxSize: 500,
  ttlMs: 5 * 60 * 1000,
});

const findFolderNode = (nodes, targetId) => {
  for (const n of nodes || []) {
    const id = n.folderId ?? n.id;
    if (String(id) === String(targetId)) return n;
    const child = findFolderNode(n.children, targetId);
    if (child) return child;
  }
  return null;
};

const collectFolderIds = (node, acc = []) => {
  if (!node) return acc;
  const id = node.folderId ?? node.id;
  if (id != null) acc.push(String(id));
  for (const c of node.children || []) collectFolderIds(c, acc);
  return acc;
};

// Resolve { homeFolderId, subtree (nodes for the folder picker), folderIds (Set
// of accessible folder ids) } for the requester. Cached per user (the home
// folder + tree change rarely). When no home folder resolves (e.g. an admin),
// falls back to the full tree.
const resolveAccessibleFolders = async (req) => {
  const rawId = req.user?.id ?? req.user?.userId;
  const username = req.user?.username ?? req.user?.userName;
  const idIsNumeric = rawId != null && !isNaN(Number(rawId));
  const cacheKey = idIsNumeric ? `id:${rawId}` : `name:${username || rawId}`;

  const hit = accessibleFoldersCache.get(cacheKey);
  if (hit) return hit;

  let homeFolderId = null;
  try {
    const q = idIsNumeric
      ? `/user?userId=${rawId}`
      : `/user?userName=${encodeURIComponent(username || "")}`;
    const u = await xiboRequest(q, "GET");
    const user = Array.isArray(u)
      ? u[0]
      : Array.isArray(u?.data)
      ? u.data[0]
      : u?.data || u;
    if (user?.homeFolderId != null) homeFolderId = user.homeFolderId;
  } catch (e) {
    console.warn("[resolveAccessibleFolders] user lookup failed:", e.message);
  }

  const tree = await xiboRequest("/folders", "GET");
  const roots = Array.isArray(tree) ? tree : tree?.data || [];

  let subtree;
  let folderIds;
  if (homeFolderId != null) {
    const node = findFolderNode(roots, homeFolderId);
    if (node) {
      subtree = [node];
      folderIds = new Set(collectFolderIds(node));
    } else {
      // Home folder not present in the returned tree — scope to just that id.
      subtree = [];
      folderIds = new Set([String(homeFolderId)]);
    }
  } else {
    // No home folder (e.g. admin) — fall back to the full tree.
    subtree = roots;
    folderIds = new Set(collectFolderIds({ children: roots }));
  }

  const result = { homeFolderId, subtree, folderIds };
  accessibleFoldersCache.set(cacheKey, result);
  return result;
};

// Fetch media across a set of folder ids (each folder is server-filtered by
// Xibo), merged and de-duped by mediaId. `search` narrows by name via Xibo's
// `media` LIKE param.
const fetchMediaInFolders = async (req, folderIds, search) => {
  const lists = await Promise.all(
    folderIds.map((fid) =>
      fetchLibraryCollection({
        req,
        endpoint: "/library",
        idKeys: MEDIA_ID_KEYS,
        queryParams: { folderId: fid, ...(search ? { media: search } : {}) },
      })
    )
  );
  const seen = new Set();
  const merged = [];
  for (const list of lists) {
    for (const m of list) {
      const id = String(m.mediaId ?? m.media_id ?? m.id);
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(m);
    }
  }
  return merged;
};

export const getLibraryMedia = async (req, res) => {
  try {
    const { folderId } = req.query;
    const isFolderScoped = folderId && folderId !== "all";
    const search = (req.query.search || "").trim();
    const { folderIds } = await resolveAccessibleFolders(req);

    // A requested folder must be one the user can access — prevents reading
    // another user's media by passing its folder id.
    if (isFolderScoped && !folderIds.has(String(folderId))) {
      return req.query.length !== undefined
        ? res.json({ data: [], total: 0, recordsTotal: 0, recordsFiltered: 0 })
        : res.json({ data: [], total: 0 });
    }

    // Which folders to read: the requested one, or every folder the user can
    // access (their home folder subtree).
    const targetFolderIds = isFolderScoped ? [String(folderId)] : [...folderIds];

    // Opt-in pagination: only when the client sends `length` (the Media list view).
    if (req.query.length !== undefined) {
      const start = Math.max(0, parseInt(req.query.start, 10) || 0);
      const length = Math.max(1, parseInt(req.query.length, 10) || 8);

      // Single accessible folder: let Xibo paginate server-side (efficient).
      if (isFolderScoped) {
        const { token } = getUserContext(req);
        const params = new URLSearchParams({
          start: String(start),
          length: String(length),
          "order[0][column]": "modifiedDt",
          "order[0][dir]": "desc",
          folderId,
        });
        if (search) params.append("media", search);

        const { data, total } = await xiboGetWithCount(
          `/library?${params.toString()}`,
          token
        );
        return res.json({
          data: withSignedMediaUrls(data),
          total,
          recordsTotal: total,
          recordsFiltered: total,
        });
      }

      // "All folders" across the user's accessible set: fetch + paginate in memory.
      const all = await fetchMediaInFolders(req, targetFolderIds, search);
      const page = all.slice(start, start + length);
      return res.json({
        data: withSignedMediaUrls(page),
        total: all.length,
        recordsTotal: all.length,
        recordsFiltered: all.length,
      });
    }

    // Non-paginated (e.g. the add-media picker): all media the user can access.
    const media = await fetchMediaInFolders(req, targetFolderIds, search);
    res.json({ data: withSignedMediaUrls(media), total: media.length });
  } catch (err) {
    handleControllerError(res, err, "Failed to fetch library media");
  }
};

export const getAllLibraryMedia = async (req, res) => {
  try {
    // Backs the "All Library" scope of the add-media picker. Access here is
    // folder-based, so "all" means all media in the folders the user can access
    // (their home folder subtree) — NOT the whole CMS library.
    const { folderIds } = await resolveAccessibleFolders(req);
    const media = await fetchMediaInFolders(req, [...folderIds]);

    res.json({ data: withSignedMediaUrls(media), total: media.length });
  } catch (err) {
    handleControllerError(res, err, "Failed to fetch library media");
  }
};

// Download/serve media file from Xibo
export const downloadMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const token = await getAccessToken();

    if (!mediaId) {
      return res.status(400).json({ message: "Media ID is required" });
    }

    // Get media download URL from Xibo API
    const xiboApiUrl = process.env.XIBO_API_URL;
    const { preview } = req.query;
    const queryParams = new URLSearchParams();
    if (preview) queryParams.append("preview", preview);

    const downloadUrl = `${xiboApiUrl}/library/download/${mediaId}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

    // Fetch the media file from Xibo
    const response = await axios.get(downloadUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      responseType: "stream",
    });

    // Set appropriate headers
    res.setHeader(
      "Content-Type",
      response.headers["content-type"] || "application/octet-stream"
    );
    res.setHeader(
      "Content-Disposition",
      response.headers["content-disposition"] ||
        `attachment; filename="media-${mediaId}"`
    );

    // Pipe the response to the client
    response.data.pipe(res);
  } catch (err) {
    console.error("Error downloading media:", err);
    handleControllerError(res, err, "Failed to download media file");
  }
};

// Persistent (disk-backed) cache for media thumbnails so repeated loads /
// re-renders never re-stream from Xibo, and the cache survives restarts/deploys.
// 24-hour TTL — media is effectively immutable once uploaded (a replace creates
// a new mediaId). See utils/diskThumbCache.
const thumbnailCache = createDiskThumbCache({
  dir: path.join(process.cwd(), ".cache", "thumbnails", "library"),
  ttlMs: 24 * 60 * 60 * 1000,
});

// Placeholder served when Xibo has no thumbnail for a media item (commonly a
// video with no generated cover) so the frontend <img> shows a clean icon
// instead of a broken image.
const THUMBNAIL_PLACEHOLDER = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="#1f2937"/><rect x="112" y="74" width="76" height="52" rx="6" fill="none" stroke="#6b7280" stroke-width="5"/><path d="M138 88l22 12-22 12z" fill="#6b7280"/><text x="150" y="158" fill="#9ca3af" font-family="sans-serif" font-size="13" text-anchor="middle">No preview</text></svg>`
);
const sendThumbnailPlaceholder = (res, marker = "PLACEHOLDER") => {
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("X-Thumbnail-Cache", marker);
  return res.status(200).end(THUMBNAIL_PLACEHOLDER);
};

// Get media thumbnail/preview from Xibo
export const getMediaThumbnail = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { width, height, preview } = req.query;

    if (!mediaId) {
      return res.status(400).json({ message: "Media ID is required" });
    }

    const previewVal = preview || "1";
    const cacheKey = `${mediaId}:${width || ""}:${height || ""}:${previewVal}`;

    // Serve from cache when available
    const cached = thumbnailCache.get(cacheKey);
    if (cached) {
      res.setHeader("Content-Type", cached.contentType);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("X-Thumbnail-Cache", "HIT");
      return res.end(cached.buffer);
    }

    const token = await getAccessToken();

    // Build query string for Xibo
    const queryParams = new URLSearchParams();
    if (width) queryParams.append("width", width);
    if (height) queryParams.append("height", height);
    // Default preview to 1 if not specified, as requested by user
    queryParams.append("preview", previewVal);

    const xiboApiUrl = process.env.XIBO_API_URL;
    const thumbnailUrl = `${xiboApiUrl}/library/thumbnail/${mediaId}?${queryParams.toString()}`;

    console.log(`Fetching thumbnail from Xibo: ${thumbnailUrl}`);

    // Buffer the response (arraybuffer) so we can cache the bytes.
    const response = await axios.get(thumbnailUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      responseType: "arraybuffer",
      validateStatus: (status) => status < 500, // Handle 404s gracefully
    });

    if (response.status === 404) {
      // Xibo has no thumbnail (e.g. a video with no generated cover). Cache a
      // placeholder so repeat loads don't re-hit Xibo, and serve it so the
      // frontend <img> shows an icon instead of a broken image.
      thumbnailCache.set(cacheKey, {
        buffer: THUMBNAIL_PLACEHOLDER,
        contentType: "image/svg+xml",
      });
      return sendThumbnailPlaceholder(res);
    }

    // Set appropriate headers
    let contentType = response.headers["content-type"];
    // Xibo sometimes returns text/html for images, force image/jpeg if so
    if (!contentType || contentType.includes("text/html")) {
        contentType = "image/jpeg";
    }

    const buffer = Buffer.from(response.data);
    thumbnailCache.set(cacheKey, { buffer, contentType });

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Cache-Control",
      "public, max-age=3600" // Cache thumbnails for 1 hour
    );
    res.setHeader("X-Thumbnail-Cache", "MISS");

    res.end(buffer);
  } catch (err) {
    console.error("Error fetching media thumbnail:", err.message);
    // Transient failure — serve the placeholder (not cached, so it can recover).
    sendThumbnailPlaceholder(res, "PLACEHOLDER-ERR");
  }
};

export const getLibraryFolders = async (req, res) => {
  try {
    // Scope the folder picker (Media view + upload modal) to the user's own
    // folders: their home folder and its descendants. With the super-admin token
    // /folders returns the whole CMS tree, so resolveAccessibleFolders slices the
    // subtree rooted at the user's home folder (falls back to the full tree when
    // no home folder resolves, e.g. an admin). The UI defaults the view to
    // homeFolderId.
    const { homeFolderId, subtree } = await resolveAccessibleFolders(req);
    res.json({ folders: subtree, homeFolderId });
  } catch (err) {
    handleControllerError(res, err, "Failed to fetch folders");
  }
};

/**
 * Update media name after upload using PUT /library/{mediaId}
 * This ensures the name is explicitly set as Xibo may ignore the name during upload
 * Returns the actual stored name from Xibo to detect any truncation
 */
export const updateMediaName = async (
  mediaId,
  desiredName,
  duration,
  userXiboToken
) => {
  try {
    console.log(`Updating media ${mediaId} name to: "${desiredName}"`);

    // Validate name before sending
    const trimmedName = desiredName?.trim();
    if (!trimmedName || trimmedName.length > 100) {
      throw new Error(
        `Invalid name: "${desiredName}" (${
          trimmedName?.length || 0
        } chars). Must be 1-100 characters.`
      );
    }

    // Use xiboRequest with proper form-data format
    // According to Xibo API, PUT /library/{id} requires: name, duration, retired
    const updateData = {
      name: trimmedName,
      duration: String(duration || 10),
      retired: "0",
    };

    console.log(`Sending PUT request for media ${mediaId}:`, {
      name: updateData.name,
      nameLength: updateData.name.length,
      duration: updateData.duration,
      hasUserToken: !!userXiboToken,
    });

    const response = await xiboRequest(
      `/library/${mediaId}`,
      "PUT",
      updateData,
      userXiboToken
    );

    // Properly extract the stored name from the response
    // Xibo may return the full object or just an empty success response
    const storedName =
      response?.name ||
      response?.mediaName ||
      response?.media_name ||
      response?.fileName ||
      null;

    console.log(`Media ${mediaId} name update response:`, {
      requestedName: desiredName,
      storedName: storedName || "not provided in response",
      fullResponse: response,
    });

    // Return object with both requested and stored names for comparison
    return {
      requestedName: desiredName,
      storedName: storedName,
      name: storedName, // Alias for backwards compatibility
      fileName: storedName, // Alias for backwards compatibility
      mediaName: storedName, // Alias for backwards compatibility
      ...response, // Include full response
    };
  } catch (err) {
    console.error(`Failed to update media ${mediaId} name:`, {
      error: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });
    throw err;
  }
};

export const uploadMedia = async (req, res) => {
  try {
    // Use user's Xibo token instead of app token to ensure correct ownership
    // Use user's Xibo token if available, otherwise fall back to app token
    // We'll ensure ownership is transferred to the user later
    let userXiboToken = req.user?.xiboToken;
    if (!userXiboToken) {
      userXiboToken = await getAccessToken();
    }

    const file = req.file;
    const {
      folderId = 1,
      name,
      duration = 10,
      tags,
      enableStat,
      retired,
      ownerId,
    } = req.body || {};

    if (!file) {
      throw new HttpError(400, "Media file is required");
    }

    // Get user's Xibo userId from token
    const userXiboUserId = req.user?.id || req.user?.userId;
    if (!userXiboUserId) {
      throw new HttpError(
        401,
        "User ID not found in token. Please login again."
      );
    }

    // Strip any path components from the client-supplied filename (this
    // sanitizes every downstream use of file.originalname).
    if (file?.originalname) file.originalname = path.basename(file.originalname);

    // Always set the name field to the actual filename unless the user specifies otherwise
    let requestedName = file.originalname;
    if (typeof name === "string" && name.trim().length) {
      requestedName = name.trim();
    }
    const desiredName = ensureExtension(requestedName, file.originalname);

    console.log("Upload request:", {
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      folderId,
      duration,
      name: desiredName,
      userId: userXiboUserId,
    });

    // Check for duplicates before attempting upload
    const availability = await checkMediaNameAvailability(req, desiredName);

    if (availability.hasConflict) {
      return res.status(409).json({
        success: false,
        message: `A media named '${availability.originalName}' already exists in your library. Please choose another name.`,
        nameInfo: {
          originalName: availability.originalName,
          suggestedName: availability.suggestedName,
          wasChanged: true,
          changeReason: `The name "${availability.originalName}" is already in use. Suggested alternative: "${availability.suggestedName}".`,
        },
      });
    }

    console.log(`Using user's requested name: "${availability.originalName}"`);

    // Helper function to attempt upload with a given name
    const attemptUpload = async (nameToUse) => {
      const uploadFormData = new FormData();
      // Create a new stream from the buffer for each attempt
      const fileStream = Readable.from(file.buffer);

      uploadFormData.append("files[]", fileStream, {
        filename: file.originalname,
        contentType: file.mimetype,
        knownLength: file.size,
      });

      uploadFormData.append("folderId", String(folderId));
      uploadFormData.append("duration", String(duration));
      uploadFormData.append("forceDuplicateCheck", "1");

      // CRITICAL: Always set a proper name
      // Xibo may use only the first character if name is not set properly
      // Name is optional for POST but must be valid if provided
      if (nameToUse && nameToUse.trim().length > 0) {
        const trimmedName = nameToUse.trim();
        console.log(
          `Adding name to FormData: "${trimmedName}" (${trimmedName.length} chars)`
        );
        uploadFormData.append("name", trimmedName);
      } else {
        console.warn("No name provided for upload, using file originalname");
        uploadFormData.append("name", file.originalname);
      }
      if (tags) uploadFormData.append("tags", String(tags));
      if (enableStat !== undefined)
        uploadFormData.append("enableStat", String(enableStat));
      if (retired !== undefined)
        uploadFormData.append("retired", String(retired));

      try {
        console.log(`Uploading file with name: "${nameToUse}"`);
        const response = await axios.post(
          `${process.env.XIBO_API_URL}/library`,
          uploadFormData,
          {
            headers: {
              Authorization: `Bearer ${userXiboToken}`,
              ...uploadFormData.getHeaders(),
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            validateStatus: (status) => {
              // Accept all statuses and handle them explicitly
              return true;
            },
          }
        );

        // Log the full response for debugging
        console.log(`Upload response status: ${response.status}`, {
          statusCode: response.status,
          dataKeys: Object.keys(response.data || {}),
          responsePreview: JSON.stringify(response.data).substring(0, 200),
        });

        // Check if response has error status
        if (response.status >= 400) {
          const errorData = response.data;
          const errorMessage =
            errorData?.message || errorData?.error || "Upload failed";
          console.error(`Upload returned error status ${response.status}:`, {
            message: errorMessage,
            fullResponse: errorData,
          });
          const error = new Error(errorMessage);
          error.response = response;
          error.status = response.status;
          throw error;
        }

        return response.data;
      } catch (err) {
        // Ensure error object has response attached
        if (!err.response && err.status) {
          err.response = { status: err.status };
        }
        // Re-throw to be handled by retry logic
        throw err;
      }
    };

    let uploadResult;

    try {
      console.log(
        `Uploading to Xibo CMS with name "${availability.originalName}"`
      );

      uploadResult = await attemptUpload(availability.originalName);

      // Check for errors in the files array
      if (uploadResult?.files && Array.isArray(uploadResult.files)) {
        const fileErrors = uploadResult.files
          .filter((file) => file?.error)
          .map((file) => file.error);

        if (fileErrors.length > 0) {
          const errorMessage = fileErrors[0];
          throw new HttpError(400, errorMessage);
        }

        // Success!
        const uploadedFile = uploadResult.files[0];
        if (uploadedFile && uploadedFile.mediaId) {
          console.log("Upload successful:", {
            mediaId: uploadedFile.mediaId,
            name: uploadedFile.name,
            size: uploadedFile.fileSize,
          });
        }
      } else {
        // No files array, assume success
        console.log("Upload completed successfully");
      }
    } catch (err) {
      // Check if it's a duplicate error in the response
      const errorData = err.response?.data;
      const errorMessage =
        errorData?.message ||
        errorData?.error ||
        (typeof errorData === "string" ? errorData : "") ||
        err.message ||
        "";

      console.error("Upload error:", {
        status: err.response?.status,
        errorMessage,
        errorData,
      });

      if (
        err.response?.status === 400 &&
        typeof errorMessage === "string" &&
        errorMessage.toLowerCase().includes("already own media")
      ) {
        console.log(
          `Duplicate detected during upload. Pre-check returned: ${availability.originalName}, Suggested: ${availability.suggestedName}`
        );

        // If our pre-check missed a duplicate, try with the suggested name
        if (availability.suggestedName !== availability.originalName) {
          console.log(
            `Retrying upload with suggested name: "${availability.suggestedName}"`
          );
          try {
            uploadResult = await attemptUpload(availability.suggestedName);
            console.log(
              `Retry successful with suggested name: "${availability.suggestedName}"`
            );

            // Check for errors in retry
            if (uploadResult?.files && Array.isArray(uploadResult.files)) {
              const fileErrors = uploadResult.files
                .filter((file) => file?.error)
                .map((file) => file.error);

              if (fileErrors.length === 0) {
                // Retry succeeded - continue with normal flow
                // Don't throw, let it proceed to ownership/name update
              } else {
                // Retry also failed
                throw new HttpError(400, fileErrors[0]);
              }
            }
          } catch (retryErr) {
            // Retry failed - return error to user
            const retryErrorMessage =
              retryErr.response?.data?.message ||
              retryErr.response?.data?.error ||
              retryErr.message ||
              "Upload failed with both original and suggested name";

            console.error("Retry failed:", retryErrorMessage);

            // Get a new suggestion
            const newSuggestion = await checkMediaNameAvailability(
              req,
              availability.suggestedName
            );

            return res.status(409).json({
              success: false,
              message: `Upload failed: ${retryErrorMessage}. Please try again with a different name.`,
              nameInfo: {
                originalName: availability.originalName,
                suggestedName: newSuggestion.suggestedName,
                wasChanged: true,
                changeReason: `The name "${availability.originalName}" and the suggested alternative "${availability.suggestedName}" are both unavailable. Please try: "${newSuggestion.suggestedName}".`,
              },
            });
          }
        } else {
          // Already using suggested name, can't retry further
          const newSuggestion = await checkMediaNameAvailability(
            req,
            availability.originalName
          );

          return res.status(409).json({
            success: false,
            message: errorMessage,
            nameInfo: {
              originalName: newSuggestion.originalName,
              suggestedName: newSuggestion.suggestedName,
              wasChanged: true,
              changeReason: `The name "${newSuggestion.originalName}" is already in use. Suggested alternative: "${newSuggestion.suggestedName}".`,
            },
          });
        }
      }

      throw err;
    }

    // CRITICAL: Transfer ownership to authenticated user (same as playlist creation)
    // When uploading with user token, Xibo may still assign ownership to app account
    // We need to explicitly transfer ownership to the authenticated user
    if (uploadResult?.files && Array.isArray(uploadResult.files)) {
      const uploadedFile = uploadResult.files[0];
      const mediaId = uploadedFile?.mediaId || uploadedFile?.media_id;

      if (mediaId && userXiboUserId) {
        try {
          console.log(
            `Transferring media ${mediaId} ownership to user ${userXiboUserId}`
          );

          // Try the permissions endpoint with different entity names
          // Xibo uses different entity names for permissions: Playlist, Layout, etc.
          // For media/library, try "Media" first (not "Library")
          let ownershipTransferred = false;
          const entityNames = ["Media", "LibraryMedia", "Library"];

          for (const entityName of entityNames) {
            try {
              console.log(
                `Attempting ownership transfer with entity: ${entityName}`
              );
              await xiboRequest(
                `/user/permissions/${entityName}/${mediaId}`,
                "POST",
                {
                  ownerId: String(userXiboUserId),
                },
                userXiboToken
              );
              console.log(
                `Media ${mediaId} ownership successfully transferred using ${entityName}`
              );
              ownershipTransferred = true;
              break;
            } catch (err) {
              console.warn(
                `Ownership transfer failed with entity ${entityName}:`,
                err.message
              );
              // Try next entity name
            }
          }

          if (!ownershipTransferred) {
            console.warn(
              `Could not transfer ownership for media ${mediaId} using any entity name`
            );
          }
        } catch (ownershipErr) {
          console.warn(
            `Error during ownership transfer for media ${mediaId}:`,
            ownershipErr.message
          );
          // Continue anyway - media is uploaded even if ownership transfer fails
        }
      }
    }

    // CRITICAL: Explicitly update the media name after upload
    // Xibo's upload endpoint may ignore or truncate the name field
    // We must use PUT /library/{mediaId} to ensure the name is correctly set
    let finalStoredName = availability.originalName;
    let finalNameChanged = false;

    if (uploadResult?.files && Array.isArray(uploadResult.files)) {
      const uploadedFile = uploadResult.files[0];
      const mediaId = uploadedFile?.mediaId || uploadedFile?.media_id;

      if (mediaId) {
        try {
          console.log(
            `Explicitly updating media ${mediaId} name to: "${availability.originalName}"`
          );

          // Call PUT /library/{mediaId} to explicitly set the name
          const updateResponse = await updateMediaName(
            mediaId,
            availability.originalName,
            duration,
            userXiboToken
          );

          // Extract the actual stored name from the update response
          // updateMediaName returns object with storedName
          const confirmedName =
            updateResponse?.storedName ||
            updateResponse?.name ||
            updateResponse?.fileName ||
            updateResponse?.mediaName ||
            null;

          if (confirmedName && confirmedName.trim()) {
            finalStoredName = confirmedName.trim();
            // Only mark as changed if different from requested
            if (
              finalStoredName.toLowerCase() !==
              availability.originalName.toLowerCase()
            ) {
              console.warn(
                `Media name mismatch: requested "${availability.originalName}", stored as "${finalStoredName}"`
              );
              finalNameChanged = true;
            } else {
              console.log(
                `Media ${mediaId} name confirmed as: "${finalStoredName}"`
              );
            }
          } else {
            // Response didn't include name - try to get from upload response
            const uploadedName =
              uploadedFile?.name ||
              uploadedFile?.fileName ||
              uploadedFile?.mediaName ||
              null;
            if (uploadedName && uploadedName.trim()) {
              finalStoredName = uploadedName.trim();
              if (
                finalStoredName.toLowerCase() !==
                availability.originalName.toLowerCase()
              ) {
                finalNameChanged = true;
              }
            }
          }
        } catch (nameUpdateErr) {
          console.error(
            `Failed to update media ${mediaId} name:`,
            nameUpdateErr.message
          );
          // Don't fail the upload - just log the error
          // Try to get the name from the upload response
          const storedName =
            uploadedFile?.name ||
            uploadedFile?.fileName ||
            uploadedFile?.mediaName ||
            null;
          if (storedName && storedName.trim()) {
            finalStoredName = storedName.trim();
            if (
              finalStoredName.toLowerCase() !==
              availability.originalName.toLowerCase()
            ) {
              finalNameChanged = true;
            }
          }
        }
      }
    }

    res.status(201).json({
      success: true,
      data: uploadResult,
      message: "Media uploaded successfully",
      nameInfo: {
        originalName: availability.originalName,
        finalName: finalStoredName,
        wasChanged: finalNameChanged,
        changeReason: finalNameChanged
          ? `Xibo saved this media as "${finalStoredName}" instead of "${availability.originalName}".`
          : null,
      },
    });
  } catch (err) {
    console.error("Error uploading media:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });
    handleControllerError(res, err, "Failed to upload media");
  }
};
