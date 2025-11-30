import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import layoutRoutes from "./routes/layoutRoutes.js";
import playlistRoutes from "./routes/playlistRoutes.js";
import libraryRoutes from "./routes/libraryRoutes.js";
import datasetRoutes from "./routes/datasetRoutes.js";
import displayRoutes from "./routes/displayRoutes.js";
import scheduleRoutes from "./routes/scheduleRoutes.js";

dotenv.config();

const app = express();

// Debug middleware BEFORE body parsing
app.use((req, res, next) => {
  if (req.method === "POST" || req.method === "PUT") {
    console.log("\n=== INCOMING REQUEST ===");
    console.log(`${req.method} ${req.path}`);
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("All headers:", JSON.stringify(req.headers, null, 2));
  }
  next();
});

// Middleware - order matters!
app.use(cors());

// Body parsing middleware with error handling
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Debug middleware AFTER body parsing
app.use((req, res, next) => {
  if (req.method === "POST" || req.method === "PUT") {
    console.log("Body after parsing:", req.body);
    console.log("Body type:", typeof req.body);
    console.log("Body is object:", typeof req.body === "object");
    console.log("===================\n");
  }
  next();
});

// Test endpoint to verify body parsing
app.post("/test-body", (req, res) => {
  res.json({
    body: req.body,
    bodyExists: !!req.body,
    contentType: req.headers["content-type"],
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/layouts", layoutRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/datasets", datasetRoutes);
app.use("/api/displays", displayRoutes);
app.use("/api/schedule", scheduleRoutes);

app.listen(5002, () =>
  console.log(`✅ Server running on port 5002`)
);
