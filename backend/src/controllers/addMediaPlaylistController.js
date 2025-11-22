import axios from "axios";
import FormData from "form-data";
import {
  handleControllerError,
  getUserContext,
  HttpError,
} from "../utils/xiboDataHelpers.js";
import { xiboRequest } from "../utils/xiboClient.js";

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
    const { token, userId } = getUserContext(req);

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
