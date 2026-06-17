import { isValidMediaSignature } from "../utils/mediaUrlSigner.js";
import { verifyToken } from "./authMiddleware.js";

// Auth for media GET routes (thumbnail / download / preview). Accepts a valid
// short-lived URL signature — so <img>/download/iframe URLs need carry no token
// — OR falls back to normal JWT verification (Authorization header) for callers
// that can send headers. Once the frontend uses signed URLs everywhere, the
// JWT query-param fallback can be removed from authMiddleware.
export function mediaAuth(req, res, next) {
  if (isValidMediaSignature(req.originalUrl)) {
    req.mediaSigAuth = true;
    return next();
  }
  return verifyToken(req, res, next);
}
