import express from "express";
import { getLayouts, publishLayout } from "../controllers/layoutController.js";
const router = express.Router();

router.get("/", getLayouts);
router.put("/publish/:layoutId", publishLayout);

export default router;
