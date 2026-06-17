import multer from "multer";

// Allowed media MIME types for library uploads (signage content only). Anything
// else — executables, archives, html/scripts, polyglots — is rejected before it
// reaches Xibo.
const ALLOWED_MIME = new Set([
  // images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
  // video
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-msvideo",
  "video/mpeg",
  // audio
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/aac",
  // documents
  "application/pdf",
]);

// Shared upload handler for media routes: in-memory storage with a size cap. MIME
// validation is done AFTER parsing (see rejectInvalidUpload) rather than via a
// multer fileFilter, because rejecting mid-stream can reset the connection.
export const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB (signage videos can be large)
});

// Use immediately after mediaUpload.single(...): rejects a disallowed file with
// a clean 400. By validating after multer has fully read the request, the
// connection drains normally. The rejected file only lived in memory and is
// discarded — it never reaches Xibo.
export function rejectInvalidUpload(req, res, next) {
  if (req.file && !ALLOWED_MIME.has(req.file.mimetype)) {
    return res
      .status(400)
      .json({ message: `Unsupported file type: ${req.file.mimetype}` });
  }
  next();
}
