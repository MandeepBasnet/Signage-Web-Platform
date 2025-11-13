import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { getLibraryMedia } from "../controllers/libraryController.js";

const router = express.Router();

router.get("/", verifyToken, getLibraryMedia);

export default router;
