import { xiboRequest } from "../utils/xiboClient.js";
import {
  getUserContext,
  HttpError,
  handleControllerError,
} from "../utils/xiboDataHelpers.js";

export const deletePlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { token } = getUserContext(req);

    if (!playlistId) {
      throw new HttpError(400, "Playlist ID is required");
    }

    console.log(`Checking playlist ${playlistId} before deletion`);

    // First, fetch the playlist details to check if it has media
    const playlistDetails = await xiboRequest(
      `/playlist?playlistId=${playlistId}&embed=widgets`,
      "GET",
      null,
      token
    );

    // Check if playlist has widgets (media items)
    const playlist = Array.isArray(playlistDetails)
      ? playlistDetails[0]
      : playlistDetails;
    const widgets = playlist?.widgets || [];

    if (widgets.length > 0) {
      return res.status(409).json({
        message: `This playlist contains ${widgets.length} media item${
          widgets.length > 1 ? "s" : ""
        } and cannot be deleted.`,
        details:
          "Please remove all media from the playlist before deleting it.",
        mediaCount: widgets.length,
      });
    }

    console.log(`Deleting empty playlist ${playlistId}`);

    // Call DELETE /playlist/{playlistId} to delete the playlist
    await xiboRequest(`/playlist/${playlistId}`, "DELETE", null, token);

    console.log(`Successfully deleted playlist ${playlistId}`);

    res.status(204).send();
  } catch (err) {
    console.error("Error deleting playlist:", err.message);
    handleControllerError(res, err, "Failed to delete playlist");
  }
};
