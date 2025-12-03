import express from "express";
import multer from "multer";
import { verifyToken } from "../middleware/authMiddleware.js";
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

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
});

// Playlist CRUD operations
router.post("/", verifyToken, createPlaylist);
router.get("/", verifyToken, getPlaylists);
router.get("/:playlistId", verifyToken, getPlaylistDetails);
router.delete("/:playlistId", verifyToken, deletePlaylist);

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
  upload.single("media"),
  uploadMediaToPlaylist
);
router.get("/media/:mediaId/preview", verifyToken, getMediaPreview);

// Widget element updates (for canvas/global widgets)
router.put("/widgets/:widgetId/elements", verifyToken, updateWidgetElements);

export default router;
