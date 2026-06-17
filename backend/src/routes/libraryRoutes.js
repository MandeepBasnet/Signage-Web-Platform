import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { mediaAuth } from "../middleware/mediaAuth.js";
import { revalidateList } from "../middleware/cacheControl.js";
import { cacheList, invalidate } from "../middleware/responseCache.js";
import { mediaUpload, rejectInvalidUpload } from "../middleware/uploadConfig.js";
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

router.get("/", verifyToken, revalidateList, cacheList("library"), getLibraryMedia);
router.get("/folders", verifyToken, revalidateList, cacheList("folders", 5 * 60 * 1000), getLibraryFolders);
router.get("/all", verifyToken, revalidateList, cacheList("library"), getAllLibraryMedia);
router.post("/validate-name", verifyToken, validateMediaName);
router.post("/upload", verifyToken, invalidate("library"), mediaUpload.single("media"), rejectInvalidUpload, uploadMedia);
router.get("/:mediaId/download", mediaAuth, downloadMedia);
router.get("/:mediaId/thumbnail", mediaAuth, getMediaThumbnail);
router.delete("/:mediaId", verifyToken, invalidate("library"), deleteMedia);

export default router;
