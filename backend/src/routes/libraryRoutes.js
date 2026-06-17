import express from "express";
import multer from "multer";
import { verifyToken } from "../middleware/authMiddleware.js";
import { mediaAuth } from "../middleware/mediaAuth.js";
import { revalidateList } from "../middleware/cacheControl.js";
import { cacheList, invalidate } from "../middleware/responseCache.js";
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

router.get("/", verifyToken, revalidateList, cacheList("library"), getLibraryMedia);
router.get("/folders", verifyToken, revalidateList, cacheList("folders", 5 * 60 * 1000), getLibraryFolders);
router.get("/all", verifyToken, revalidateList, cacheList("library"), getAllLibraryMedia);
router.post("/validate-name", verifyToken, validateMediaName);
router.post("/upload", verifyToken, invalidate("library"), upload.single("media"), uploadMedia);
router.get("/:mediaId/download", mediaAuth, downloadMedia);
router.get("/:mediaId/thumbnail", mediaAuth, getMediaThumbnail);
router.delete("/:mediaId", verifyToken, invalidate("library"), deleteMedia);

export default router;
