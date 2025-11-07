import express from "express";
import { getLayouts, publishLayout } from "../controllers/layoutController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
const router = express.Router();

// All layout routes require authentication
router.get("/", verifyToken, getLayouts);
router.put("/publish/:layoutId", verifyToken, publishLayout);

export default router;
