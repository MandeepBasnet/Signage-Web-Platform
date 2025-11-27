import axios from "axios";
import FormData from "form-data";
import {
  handleControllerError,
  getUserContext,
  HttpError,
} from "../utils/xiboDataHelpers.js";
import { xiboRequest, getAccessToken } from "../utils/xiboClient.js";

/**
 * Helper function to check if value is numeric
 */
const isNumeric = (value) =>
  value !== undefined &&
  value !== null &&
  String(value).trim() !== "" &&
  !Number.isNaN(Number(value));

/**
 * Assign library media to a playlist
 *
 * XIBO API Reference:
 * POST /playlist/library/assign/{playlistId}
 *
 * Required parameters:
 * - playlistId (path): The Playlist ID
 * - media (array[integer]): Array of Media IDs to add
 *
 * Optional parameters:
 * - duration (integer): Duration for all added media (seconds)
 * - useDuration (integer): Enable duration? (0 or 1)
 * - displayOrder (integer): Position in list (starting position if multiple items)
 *
 * Response: 200 OK - Media successfully assigned
 */
export const addMediaToPlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { mediaIds, duration, useDuration, displayOrder } = req.body || {};
    let { token, userId } = getUserContext(req);

    if (!token) {
        token = await getAccessToken();
    }

    // Validate required parameters
    if (!playlistId) {
      throw new HttpError(400, "Playlist ID is required");
    }

    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      throw new HttpError(
        400,
        "At least one mediaId is required. Expected: mediaIds array with media IDs"
      );
    }

    // Validate all mediaIds are numeric
    const invalidMediaIds = mediaIds.filter((id) => !isNumeric(id));
    if (invalidMediaIds.length > 0) {
      throw new HttpError(
        400,
        `Invalid media IDs found: ${invalidMediaIds.join(
          ", "
        )}. All media IDs must be numeric.`
      );
    }

    console.log(
      `Adding ${mediaIds.length} media items to playlist ${playlistId}`
    );

    // Build form data according to Xibo API spec
    // XIBO expects application/x-www-form-urlencoded format
    // For array parameters, use media[] with each item as separate field
    const formData = new FormData();

    // Add media IDs as separate form fields with array notation
    // XIBO requires "media[]" for array parameters in form data
    mediaIds.forEach((mediaId) => {
      formData.append("media[]", String(mediaId));
    });

    // Add optional duration parameter if provided
    if (isNumeric(duration)) {
      formData.append("duration", String(duration));
      // Note: useDuration is implied when duration is set, but we can be explicit
      if (useDuration !== undefined) {
        formData.append("useDuration", useDuration ? "1" : "0");
      }
    } else if (useDuration !== undefined) {
      // Allow setting useDuration independently
      formData.append("useDuration", useDuration ? "1" : "0");
    }

    // Add optional displayOrder parameter if provided
    if (isNumeric(displayOrder)) {
      formData.append("displayOrder", String(displayOrder));
    }

    console.log(`Assigning media to playlist ${playlistId} with:`, {
      mediaCount: mediaIds.length,
      duration: duration || "default",
      useDuration: useDuration || "default",
      displayOrder: displayOrder || "default",
    });

    // Call Xibo API: POST /playlist/library/assign/{playlistId}
    // Build proper form data for Xibo
    const xiboFormData = new FormData();

    // Add each media ID with array notation (media[]=ID)
    mediaIds.forEach((id) => {
      xiboFormData.append("media[]", String(id));
    });

    if (isNumeric(duration)) {
      xiboFormData.append("duration", String(duration));
    }
    if (useDuration !== undefined) {
      xiboFormData.append("useDuration", useDuration ? "1" : "0");
    }
    if (isNumeric(displayOrder)) {
      xiboFormData.append("displayOrder", String(displayOrder));
    }

    const response = await axios.post(
      `${process.env.XIBO_API_URL}/playlist/library/assign/${playlistId}`,
      xiboFormData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...xiboFormData.getHeaders(),
        },
        validateStatus: (status) => status < 500,
      }
    );

    // Check for API errors
    if (response.status >= 400) {
      const errorMsg =
        response.data?.message ||
        response.data?.error ||
        `API returned status ${response.status}`;

      console.error(`Failed to add media to playlist:`, {
        status: response.status,
        message: errorMsg,
        data: response.data,
      });

      throw new HttpError(
        response.status,
        `Failed to add media to playlist: ${errorMsg}`
      );
    }

    console.log(
      `Successfully added ${mediaIds.length} media items to playlist ${playlistId}`
    );

    res.status(200).json({
      success: true,
      message: `${mediaIds.length} media item(s) successfully added to playlist`,
      data: response.data,
      addedCount: mediaIds.length,
    });
  } catch (err) {
    console.error("Error in addMediaToPlaylist:", {
      message: err.message,
      status: err.status,
      response: err.response?.data,
    });
    handleControllerError(res, err, "Failed to add media to playlist");
  }
};

/**
 * Get available media for selection (owned by user)
 * Used to populate media selection UI
 */
export const getAvailableMediaForPlaylist = async (req, res) => {
  try {
    const { token } = getUserContext(req);

    console.log("Fetching available media for playlist assignment");

    // Get all library media accessible to user
    const response = await xiboRequest(
      "/library?length=10000",
      "GET",
      null,
      token
    );

    // Handle different response formats
    let mediaList = [];
    if (Array.isArray(response)) {
      mediaList = response;
    } else if (response?.data && Array.isArray(response.data)) {
      mediaList = response.data;
    }

    // Filter media to only active items (not retired)
    const activeMedia = mediaList.filter((media) => !media.retired);

    console.log(
      `Found ${activeMedia.length} active media items for playlist assignment`
    );

    res.json({
      success: true,
      data: activeMedia,
      total: activeMedia.length,
    });
  } catch (err) {
    console.error("Error fetching available media:", err.message);
    handleControllerError(res, err, "Failed to fetch available media");
  }
};

/**
 * Remove media from playlist
 * Note: Xibo API doesn't have a direct "remove media" endpoint
 * Media must be removed by deleting the widget that contains it
 */
export const removeMediaFromPlaylist = async (req, res) => {
  try {
    const { playlistId, widgetId } = req.params;
    const { token } = getUserContext(req);

    if (!playlistId) {
      throw new HttpError(400, "Playlist ID is required");
    }

    if (!widgetId) {
      throw new HttpError(400, "Widget ID is required to remove media");
    }

    console.log(`Removing widget ${widgetId} from playlist ${playlistId}`);

    // Call DELETE /playlist/widget/{widgetId} to remove the media
    const response = await xiboRequest(
      `/playlist/widget/${widgetId}`,
      "DELETE",
      null,
      token
    );

    console.log(
      `Successfully removed widget ${widgetId} from playlist ${playlistId}`
    );

    res.status(204).send();
  } catch (err) {
    console.error("Error removing media from playlist:", err.message);
    handleControllerError(res, err, "Failed to remove media from playlist");
  }
};

/**
 * Update media duration in playlist
 * Updates the widget properties for specific media
 */
export const updateMediaDurationInPlaylist = async (req, res) => {
  try {
    const { playlistId, widgetId } = req.params;
    const { duration } = req.body || {};
    const { token } = getUserContext(req);

    if (!playlistId) {
      throw new HttpError(400, "Playlist ID is required");
    }

    if (!widgetId) {
      throw new HttpError(400, "Widget ID is required");
    }

    if (!isNumeric(duration)) {
      throw new HttpError(
        400,
        `Invalid duration: ${duration}. Must be a positive number`
      );
    }

    console.log(
      `Updating widget ${widgetId} duration to ${duration}s in playlist ${playlistId}`
    );

    const updateData = {
      duration: String(duration),
    };

    // Call PUT /playlist/widget/{widgetId} to update duration
    const response = await xiboRequest(
      `/playlist/widget/${widgetId}`,
      "PUT",
      updateData,
      token
    );

    console.log(
      `Successfully updated widget ${widgetId} duration to ${duration}s`
    );

    res.json({
      success: true,
      message: `Media duration updated to ${duration} seconds`,
      data: response,
    });
  } catch (err) {
    console.error("Error updating media duration:", err.message);
    handleControllerError(res, err, "Failed to update media duration");
  }
};

/**
 * Get media preview (thumbnail/download)
 * Proxies the download from Xibo
 */
export const getMediaPreview = async (req, res) => {
  try {
    const { mediaId } = req.params;
    let { token } = getUserContext(req);

    if (!token) {
        token = await getAccessToken();
    }

    if (!mediaId) {
      return res.status(400).json({ message: "Media ID is required" });
    }

    // Get media download URL from Xibo API
    const xiboApiUrl = process.env.XIBO_API_URL;
    const downloadUrl = `${xiboApiUrl}/library/download/${mediaId}`;

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
    console.error("Error downloading media preview:", err.message);
    handleControllerError(res, err, "Failed to download media preview");
  }
};

/**
 * Upload media and assign to playlist
 * Handles upload to library and immediate assignment to playlist
 */
export const uploadMediaToPlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    let { token, userId } = getUserContext(req);
    
    if (!token) {
        token = await getAccessToken();
    }

    const file = req.file;
    const {
      name,
      duration = 10,
      folderId = 1,
      tags,
      enableStat,
      retired,
    } = req.body || {};

    if (!playlistId) {
      throw new HttpError(400, "Playlist ID is required");
    }

    if (!file) {
      throw new HttpError(400, "Media file is required");
    }

    // Import helpers dynamically to avoid circular dependency issues if any
    // (Though standard import at top is better if no circular deps)
    // We'll rely on the imports added at the top of the file
    const { checkMediaNameAvailability, ensureExtension, updateMediaName } =
      await import("./libraryController.js");

    // 1. Prepare Name
    let requestedName = file.originalname;
    if (typeof name === "string" && name.trim().length) {
      requestedName = name.trim();
    }
    const desiredName = ensureExtension(requestedName, file.originalname);

    console.log(`Processing upload for playlist ${playlistId}:`, {
      filename: file.originalname,
      desiredName,
      size: file.size,
    });

    // 2. Check for duplicates
    const availability = await checkMediaNameAvailability(req, desiredName);

    if (availability.hasConflict) {
      return res.status(409).json({
        success: false,
        message: `A media named '${availability.originalName}' already exists.`,
        nameInfo: {
          originalName: availability.originalName,
          suggestedName: availability.suggestedName,
          wasChanged: true,
          changeReason: `Name collision detected. Suggested: "${availability.suggestedName}"`,
        },
      });
    }

    // 3. Upload to Xibo Library
    const uploadFormData = new FormData();
    const { Readable } = await import("stream");
    const fileStream = Readable.from(file.buffer);

    uploadFormData.append("files[]", fileStream, {
      filename: file.originalname,
      contentType: file.mimetype,
      knownLength: file.size,
    });

    uploadFormData.append("folderId", String(folderId));
    uploadFormData.append("duration", String(duration));
    uploadFormData.append("name", availability.originalName); // Use checked name
    uploadFormData.append("forceDuplicateCheck", "1");
    if (tags) uploadFormData.append("tags", String(tags));

    console.log(
      `Uploading to library with name: "${availability.originalName}"`
    );

    const uploadResponse = await axios.post(
      `${process.env.XIBO_API_URL}/library`,
      uploadFormData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...uploadFormData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    // 4. Handle Upload Result
    let uploadedMediaId = null;
    if (
      uploadResponse.data?.files &&
      Array.isArray(uploadResponse.data.files) &&
      uploadResponse.data.files.length > 0
    ) {
      const uploadedFile = uploadResponse.data.files[0];
      if (uploadedFile.error) {
        throw new HttpError(400, uploadedFile.error);
      }
      uploadedMediaId = uploadedFile.mediaId || uploadedFile.media_id;
    }

    if (!uploadedMediaId) {
      throw new HttpError(500, "Upload failed: No media ID returned");
    }

    console.log(`Upload successful. Media ID: ${uploadedMediaId}`);

    // 5. Transfer Ownership (Optional but recommended)
    try {
      await xiboRequest(
        `/user/permissions/Media/${uploadedMediaId}`,
        "POST",
        { ownerId: String(userId) },
        token
      );
    } catch (ownErr) {
      console.warn(
        `Ownership transfer failed for ${uploadedMediaId}:`,
        ownErr.message
      );
    }

    // 5.5 Explicitly Update Name (Fix for Truncation Issue)
    try {
      console.log(
        `Explicitly updating media ${uploadedMediaId} name to: "${availability.originalName}"`
      );
      await updateMediaName(
        uploadedMediaId,
        availability.originalName,
        duration,
        token
      );
    } catch (nameErr) {
      console.warn(
        `Failed to update media name for ${uploadedMediaId}:`,
        nameErr.message
      );
      // Continue, as the media is uploaded and can be renamed later
    }

    // 6. Assign to Playlist
    console.log(`Assigning media ${uploadedMediaId} to playlist ${playlistId}`);

    const assignFormData = new FormData();
    assignFormData.append("media[]", String(uploadedMediaId));
    assignFormData.append("duration", String(duration));
    assignFormData.append("useDuration", "1");

    await axios.post(
      `${process.env.XIBO_API_URL}/playlist/library/assign/${playlistId}`,
      assignFormData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...assignFormData.getHeaders(),
        },
      }
    );

    console.log(`Successfully assigned media ${uploadedMediaId} to playlist`);

    res.status(201).json({
      success: true,
      message: "Media uploaded and added to playlist successfully",
      data: {
        mediaId: uploadedMediaId,
        name: availability.originalName,
        playlistId: playlistId,
      },
    });
  } catch (err) {
    console.error("Error in uploadMediaToPlaylist:", err);
    // Handle specific Xibo errors if needed
    handleControllerError(res, err, "Failed to upload and assign media");
  }
};
