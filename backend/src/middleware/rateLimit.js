import rateLimit from "express-rate-limit";

// Generous global backstop against request flooding. High enough not to affect a
// normal (media-heavy) dashboard session, low enough to cap automated abuse.
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please slow down." },
});

// Strict limiter for the login endpoint — brute-force defense. Only FAILED
// attempts count (skipSuccessfulRequests), so a normal user logging in/out
// repeatedly is never locked out, but password guessing is throttled.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    message: "Too many login attempts. Please try again in a few minutes.",
  },
});
