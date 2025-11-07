import express from "express";
import {
  register,
  login,
  getLoginHistory,
} from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/history", verifyToken, getLoginHistory); // Protected route to view login history

export default router;
