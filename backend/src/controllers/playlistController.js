import {
  fetchUserScopedCollection,
  handleControllerError,
} from "../utils/xiboDataHelpers.js";

export const getPlaylists = async (req, res) => {
  try {
    const playlists = await fetchUserScopedCollection({
      req,
      endpoint: "/playlist",
      idKeys: ["playlistId", "playlist_id", "id"],
    });

    res.json({ data: playlists, total: playlists.length });
  } catch (err) {
    handleControllerError(res, err, "Failed to fetch playlists");
  }
};
