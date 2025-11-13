import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { getPlaylists } from "../controllers/playlistController.js";

const router = express.Router();

router.get("/", verifyToken, getPlaylists);

export default router;
