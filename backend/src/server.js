import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import multer from "multer";  // ✅ Added for FormData parsing
import authRoutes from "./routes/authRoutes.js";
import layoutRoutes from "./routes/layoutRoutes.js";
import playlistRoutes from "./routes/playlistRoutes.js";
import libraryRoutes from "./routes/libraryRoutes.js";
import datasetRoutes from "./routes/datasetRoutes.js";
import displayRoutes from "./routes/displayRoutes.js";
import scheduleRoutes from "./routes/scheduleRoutes.js";
import regionRoutes from "./routes/regionRoutes.js";
import widgetRoutes from "./routes/widgetRoutes.js";
import xiboProxyRoutes from "./routes/xiboProxyRoutes.js";
import { perfMiddleware } from "./middleware/perfMiddleware.js";
import { validateEnv } from "./utils/validateEnv.js";
import { globalLimiter } from "./middleware/rateLimit.js";

dotenv.config();

// Fail fast in production on insecure config (missing/weak JWT_SECRET, TLS
// verification disabled, missing Xibo creds); warns in development.
validateEnv();

const app = express();

// Trust the first proxy hop so req.ip (used by rate limiting) reflects the real
// client behind a reverse proxy/load balancer in production.
app.set("trust proxy", 1);

const isDev = process.env.NODE_ENV !== "production";
// Verbose per-request logging is OFF by default (even in dev) and never logs
// secrets. Opt in with DEBUG_HTTP=true; sensitive values are still redacted.
const debugHttp = process.env.DEBUG_HTTP === "true";

// Phase 0 instrumentation — record total time + Xibo upstream calls per request.
// Placed first so totalMs covers the full request lifecycle.
app.use(perfMiddleware);

// Debug middleware BEFORE body parsing (opt-in; Authorization/Cookie redacted)
if (debugHttp) {
  app.use((req, res, next) => {
    if (req.method === "POST" || req.method === "PUT") {
      const safeHeaders = { ...req.headers };
      if (safeHeaders.authorization) safeHeaders.authorization = "[REDACTED]";
      if (safeHeaders.cookie) safeHeaders.cookie = "[REDACTED]";
      console.log("\n=== INCOMING REQUEST ===");
      console.log(`${req.method} ${req.path}`);
      console.log("Content-Type:", req.headers["content-type"]);
      console.log("Headers:", JSON.stringify(safeHeaders, null, 2));
    }
    next();
  });
}

// Middleware - order matters!

// Security headers. CSP is intentionally left off here (it needs app-specific
// tuning and is a later task); CORP is relaxed so the separate frontend origin
// can load media/thumbnails cross-origin.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS restricted to an allowlist (ALLOWED_ORIGINS, comma-separated). Defaults
// to the local dev origins; production MUST set ALLOWED_ORIGINS. Requests with
// no Origin header (curl, same-origin, <img>) are allowed.
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:3000"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const isLocalhostOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      // In development, allow any localhost/127.0.0.1 origin (any dev port) so a
      // local frontend can't be accidentally blocked. Production stays strict.
      if (isDev && isLocalhostOrigin(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
  })
);

// Gzip-compress responses (large library/dataset JSON payloads)
app.use(compression());

// Parse multipart form FIELDS (no files) for FormData requests that don't
// upload a file (e.g. schedule create). The file-upload routes have their own
// multer, so skip them here — otherwise multer().none() rejects the file part
// as "Unexpected field" before the route ever sees it.
const formFields = multer().none();
app.use((req, res, next) => {
  if (req.path.endsWith("/upload")) return next();
  return formFields(req, res, next);
});

// Body parsing middleware with error handling
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Debug middleware AFTER body parsing (opt-in; secret fields redacted)
if (debugHttp) {
  const SECRET_FIELDS = ["password", "secret", "clientSecret", "token"];
  app.use((req, res, next) => {
    if (req.method === "POST" || req.method === "PUT") {
      const safeBody = { ...req.body };
      for (const k of SECRET_FIELDS) {
        if (safeBody[k] !== undefined) safeBody[k] = "[REDACTED]";
      }
      console.log("Body after parsing:", safeBody);
      console.log("===================\n");
    }
    next();
  });
}

// Test endpoint to verify body parsing
app.post("/test-body", (req, res) => {
  res.json({
    body: req.body,
    bodyExists: !!req.body,
    contentType: req.headers["content-type"],
  });
});

// ✅ Health Check Route (Fixes "Cannot GET /" error)
app.get("/", (req, res) => {
  res.send("✅ Signage Backend is running successfully!");
});

// Global rate-limit backstop for all API routes.
app.use("/api", globalLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/layouts", layoutRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/datasets", datasetRoutes);
app.use("/api/displays", displayRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/regions", regionRoutes);
app.use("/api/widgets", widgetRoutes);
app.use("/api/xibo-web", xiboProxyRoutes);

// Surface upload validation failures (multer size limit / disallowed MIME type)
// as clean 400s instead of a generic 500.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }
  if (err && /Unsupported file type/i.test(err.message || "")) {
    return res.status(400).json({ message: err.message });
  }
  next(err);
});



app.listen(process.env.PORT, () =>
  console.log(`✅ Server running on port ${process.env.PORT}`)
);
