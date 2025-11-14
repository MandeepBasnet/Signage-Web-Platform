import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getLibraryMedia,
  downloadMedia,
} from "../controllers/libraryController.js";

const router = express.Router();

router.get("/", verifyToken, getLibraryMedia);
router.get("/:mediaId/download", verifyToken, downloadMedia);

export default router;
