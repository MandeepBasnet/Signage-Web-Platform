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
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// All layout routes require authentication
router.get("/", verifyToken, getLayouts);
router.get("/thumbnail/:layoutId", verifyToken, getLayoutThumbnail);
router.get("/:layoutId/preview", verifyToken, getLayoutPreview);
router.get("/:layoutId", verifyToken, getLayoutDetails);
router.put("/publish/:layoutId", verifyToken, publishLayout);
router.put("/checkout/:layoutId", verifyToken, checkoutLayout);
router.put("/widgets/:widgetId", verifyToken, updateWidget);

export default router;
