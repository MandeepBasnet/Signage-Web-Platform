import express from "express";
import multer from "multer";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  getLibraryMedia,
  downloadMedia,
  getLibraryFolders,
  uploadMedia,
} from "../controllers/libraryController.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
});

router.get("/", verifyToken, getLibraryMedia);
router.get("/folders", verifyToken, getLibraryFolders);
router.post("/upload", verifyToken, upload.single("media"), uploadMedia);
router.get("/:mediaId/download", verifyToken, downloadMedia);

export default router;
