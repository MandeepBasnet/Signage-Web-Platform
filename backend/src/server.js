import express from "express";
import dotenv from "dotenv";
import cors from "cors";
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

dotenv.config();

const app = express();

const isDev = process.env.NODE_ENV !== "production";

// Phase 0 instrumentation — record total time + Xibo upstream calls per request.
// Placed first so totalMs covers the full request lifecycle.
app.use(perfMiddleware);

// Debug middleware BEFORE body parsing (dev only — avoids per-request logging in prod)
if (isDev) {
  app.use((req, res, next) => {
    if (req.method === "POST" || req.method === "PUT") {
      console.log("\n=== INCOMING REQUEST ===");
      console.log(`${req.method} ${req.path}`);
      console.log("Content-Type:", req.headers["content-type"]);
      console.log("All headers:", JSON.stringify(req.headers, null, 2));
    }
    next();
  });
}

// Middleware - order matters!
app.use(cors());

// Gzip-compress responses (large library/dataset JSON payloads)
app.use(compression());

// ✅ Multer middleware for multipart/form-data (FormData API)
// This handles form data without file uploads
const upload = multer();
app.use(upload.none()); // Parse form fields only (no files)

// Body parsing middleware with error handling
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Debug middleware AFTER body parsing (dev only)
if (isDev) {
  app.use((req, res, next) => {
    if (req.method === "POST" || req.method === "PUT") {
      console.log("Body after parsing:", req.body);
      console.log("Body type:", typeof req.body);
      console.log("Body is object:", typeof req.body === "object");
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



app.listen(process.env.PORT, () =>
  console.log(`✅ Server running on port ${process.env.PORT}`)
);
