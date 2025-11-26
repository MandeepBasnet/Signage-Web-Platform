import express from "express";
import multer from "multer";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getLibraryMedia,
  getAllLibraryMedia,
  downloadMedia,
  getLibraryFolders,
  uploadMedia,
  validateMediaName,
  getMediaThumbnail,
} from "../controllers/libraryController.js";
import { deleteMedia } from "../controllers/deleteMedia.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
});

router.get("/", verifyToken, getLibraryMedia);
router.get("/folders", verifyToken, getLibraryFolders);
router.get("/all", verifyToken, getAllLibraryMedia);
router.post("/validate-name", verifyToken, validateMediaName);
router.post("/upload", verifyToken, upload.single("media"), uploadMedia);
router.get("/:mediaId/download", verifyToken, downloadMedia);
router.get("/:mediaId/thumbnail", verifyToken, getMediaThumbnail);
router.delete("/:mediaId", verifyToken, deleteMedia);

export default router;
