import express from "express";
import { proxyWebResource } from "../controllers/layoutPreviewProxy.js";

// Catch-all reverse-proxy for Xibo web sub-resources used by the live layout
// preview. Auth is the short-lived :sid capability in the path (minted by the
// authenticated /api/layouts/:layoutId/live-preview entry), NOT a JWT — the
// browser can't attach our token to these iframe-driven sub-requests.
const router = express.Router();

router.get("/:sid/*splat", proxyWebResource);
router.post("/:sid/*splat", proxyWebResource);

export default router;
