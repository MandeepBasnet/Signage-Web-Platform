import {
  handleControllerError,
  getUserContext,
  HttpError,
} from "../utils/xiboDataHelpers.js";
import { xiboRequest } from "../utils/xiboClient.js";

/**
 * Delete media from playlist
 * Note: Xibo API doesn't have a direct "remove media" endpoint
 * Media must be removed by deleting the widget that contains it
 *
 * XIBO API Reference:
 * DELETE /playlist/widget/{widgetId}
 */
export const deleteMediaPlaylist = async (req, res) => {
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
    await xiboRequest(`/playlist/widget/${widgetId}`, "DELETE", null, token);

    console.log(
      `Successfully removed widget ${widgetId} from playlist ${playlistId}`
    );

    res.status(204).send();
  } catch (err) {
    console.error("Error removing media from playlist:", err.message);
    handleControllerError(res, err, "Failed to remove media from playlist");
  }
};
