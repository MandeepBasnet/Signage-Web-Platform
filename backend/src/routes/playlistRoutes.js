import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { mediaAuth } from "../middleware/mediaAuth.js";
import { revalidateList } from "../middleware/cacheControl.js";
import { cacheList, invalidate } from "../middleware/responseCache.js";
import { mediaUpload, rejectInvalidUpload } from "../middleware/uploadConfig.js";
import {
  getPlaylists,
  getPlaylistDetails,
  createPlaylist,
  updatePlaylistWidgetItemExpiry,
} from "../controllers/playlistController.js";
import {
  addMediaToPlaylist,
  getAvailableMediaForPlaylist,
  updateMediaDurationInPlaylist,
  uploadMediaToPlaylist,
  getMediaPreview,
} from "../controllers/addMediaPlaylistController.js";
import { deleteMediaPlaylist } from "../controllers/deleteMediaPlaylist.js";
import { deletePlaylist } from "../controllers/deletePlaylist.js";
import { updateWidgetElements } from "../controllers/widgetController.js";

const router = express.Router();

// Playlist CRUD operations
router.post("/", verifyToken, invalidate("playlists"), createPlaylist);
router.get("/", verifyToken, revalidateList, cacheList("playlists"), getPlaylists);
router.get("/:playlistId", verifyToken, getPlaylistDetails);
router.delete("/:playlistId", verifyToken, invalidate("playlists"), deletePlaylist);

// Media management for playlists
router.post("/:playlistId/media", verifyToken, addMediaToPlaylist);
router.get(
  "/:playlistId/available-media",
  verifyToken,
  getAvailableMediaForPlaylist
);
router.delete("/:playlistId/media/:widgetId", verifyToken, deleteMediaPlaylist);
router.put(
  "/:playlistId/media/:widgetId/duration",
  verifyToken,
  updateMediaDurationInPlaylist
);
router.put(
  "/:playlistId/media/:widgetId/expiry",
  verifyToken,
  updatePlaylistWidgetItemExpiry
);

// New endpoints for direct upload and preview
router.post(
  "/:playlistId/upload",
  verifyToken,
  invalidate("library"),
  mediaUpload.single("media"),
  rejectInvalidUpload,
  uploadMediaToPlaylist
);
router.get("/media/:mediaId/preview", mediaAuth, getMediaPreview);

// Widget element updates (for canvas/global widgets)
router.put("/widgets/:widgetId/elements", verifyToken, updateWidgetElements);

export default router;
