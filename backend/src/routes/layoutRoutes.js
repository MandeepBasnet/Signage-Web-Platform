import express from "express";
import {
  getLayoutDetails,
  getLayoutThumbnail,
  getLayoutPreview,
  getLayouts,
  publishLayout,
} from "../controllers/layoutController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// All layout routes require authentication
router.get("/", verifyToken, getLayouts);
router.get("/:layoutId/thumbnail", verifyToken, getLayoutThumbnail);
router.get("/:layoutId/preview", verifyToken, getLayoutPreview);
router.get("/:layoutId", verifyToken, getLayoutDetails);
router.put("/publish/:layoutId", verifyToken, publishLayout);

export default router;
