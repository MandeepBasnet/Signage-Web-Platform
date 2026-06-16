import express from "express";
import {
  getLayoutDetails,
  getLayoutThumbnail,
  getLayoutPreview,
  getLayouts,
  publishLayout,
  checkoutLayout,
  updateWidget,
} from "../controllers/layoutController.js";
import { getLayoutLivePreview } from "../controllers/layoutPreviewProxy.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { revalidateList } from "../middleware/cacheControl.js";
import { cacheList, invalidate } from "../middleware/responseCache.js";

const router = express.Router();

// All layout routes require authentication
router.get("/", verifyToken, revalidateList, cacheList("layouts"), getLayouts);
router.get("/thumbnail/:layoutId", verifyToken, getLayoutThumbnail);
router.get("/:layoutId/preview", verifyToken, getLayoutPreview);
router.get("/:layoutId/live-preview", verifyToken, getLayoutLivePreview);
router.get("/:layoutId", verifyToken, getLayoutDetails);
router.put("/publish/:layoutId", verifyToken, invalidate("layouts"), publishLayout);
router.put("/checkout/:layoutId", verifyToken, invalidate("layouts"), checkoutLayout);
router.put("/widgets/:widgetId", verifyToken, invalidate("layouts"), updateWidget);

export default router;
