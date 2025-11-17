import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getPlaylists,
  getPlaylistDetails,
  createPlaylist,
} from "../controllers/playlistController.js";

const router = express.Router();

router.post("/", verifyToken, createPlaylist);
router.get("/", verifyToken, getPlaylists);
router.get("/:playlistId", verifyToken, getPlaylistDetails);

export default router;
