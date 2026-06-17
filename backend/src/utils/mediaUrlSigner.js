// Short-lived, per-URL HMAC signatures for media (thumbnail/download/preview)
// URLs. Lets <img>/download/iframe URLs carry NO token — the signature is bound
// to the exact path+query+expiry, so it can't be replayed on another resource
// and expires quickly. Keyed by JWT_SECRET (already required by validateEnv).
import crypto from "node:crypto";

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const secret = () => process.env.JWT_SECRET || "";

const hmac = (base) =>
  crypto.createHmac("sha256", secret()).update(base).digest("base64url");

// Sign a media path (pathname + query exactly as the server will receive it,
// e.g. "/api/library/123/thumbnail?width=300"). Appends exp + sig and returns
// the signed path. The signature covers path+query+exp.
export function signMediaUrl(pathWithQuery, ttlMs = DEFAULT_TTL_MS) {
  const sep = pathWithQuery.includes("?") ? "&" : "?";
  const base = `${pathWithQuery}${sep}exp=${Date.now() + ttlMs}`;
  return `${base}&sig=${hmac(base)}`;
}

// Verify the signature on an incoming request URL (req.originalUrl). True only
// if the signature matches and the expiry has not passed. `sig` is always the
// last query param (the signer appends it last).
export function isValidMediaSignature(originalUrl) {
  if (!secret()) return false;

  const marker = "&sig=";
  const i = originalUrl.lastIndexOf(marker);
  if (i === -1) return false;

  const base = originalUrl.slice(0, i);
  const provided = originalUrl.slice(i + marker.length);

  const expMatch = base.match(/[?&]exp=(\d+)(?:&|$)/);
  if (!expMatch || Date.now() > Number(expMatch[1])) return false;

  const expected = hmac(base);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
