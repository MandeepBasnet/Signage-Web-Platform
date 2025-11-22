import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getPlaylists,
  getPlaylistDetails,
  createPlaylist,
} from "../controllers/playlistController.js";
import {
  addMediaToPlaylist,
  getAvailableMediaForPlaylist,
  removeMediaFromPlaylist,
  updateMediaDurationInPlaylist,
} from "../controllers/addMediaPlaylistController.js";

const router = express.Router();

// Playlist CRUD operations
router.post("/", verifyToken, createPlaylist);
router.get("/", verifyToken, getPlaylists);
router.get("/:playlistId", verifyToken, getPlaylistDetails);

// Media management for playlists
router.post("/:playlistId/media", verifyToken, addMediaToPlaylist);
router.get(
  "/:playlistId/available-media",
  verifyToken,
  getAvailableMediaForPlaylist
);
router.delete(
  "/:playlistId/media/:widgetId",
  verifyToken,
  removeMediaFromPlaylist
);
router.put(
  "/:playlistId/media/:widgetId/duration",
  verifyToken,
  updateMediaDurationInPlaylist
);

export default router;
