// Server-side response cache for read-only LIST endpoints.
//
// On a GET hit, the cached JSON body is returned WITHOUT running the controller
// — so no Xibo round-trip. This complements cacheControl.js (which only adds
// browser ETag revalidation; the controller still runs there). Entries are
// grouped by a resource `tag` and dropped when a mutation to that resource
// succeeds (see `invalidate`). Keys include the userId so per-user (owner-scoped)
// lists never leak across users. In-memory only; fine for a single backend
// process (swap for Redis if this is ever horizontally scaled).
const store = new Map(); // key -> { body, statusCode, expiresAt }
const tagKeys = new Map(); // tag -> Set<key>

const remember = (tag, key, entry) => {
  store.set(key, entry);
  if (!tagKeys.has(tag)) tagKeys.set(tag, new Set());
  tagKeys.get(tag).add(key);
};

export const invalidateTag = (tag) => {
  const keys = tagKeys.get(tag);
  if (!keys) return;
  for (const k of keys) store.delete(k);
  tagKeys.delete(tag);
};

// Cache a resource's list GET. Key = tag + userId + full URL (so each
// page/search/folder variant caches separately). Default TTL 60s.
export function cacheList(tag, ttlMs = 60 * 1000) {
  return (req, res, next) => {
    if (req.method !== "GET") return next();

    const userId = req.user?.id ?? "anon";
    const key = `${tag}|${userId}|${req.originalUrl}`;

    const hit = store.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      res.setHeader("X-Resp-Cache", "HIT");
      return res.status(hit.statusCode).json(hit.body);
    }

    res.setHeader("X-Resp-Cache", "MISS");
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful responses.
      if (res.statusCode >= 200 && res.statusCode < 300) {
        remember(tag, key, {
          body,
          statusCode: res.statusCode,
          expiresAt: Date.now() + ttlMs,
        });
      }
      return originalJson(body);
    };
    next();
  };
}

// Mutation middleware: after a successful (2xx) response, drop the cached lists
// for the given resource tags so the next GET re-fetches fresh data.
export function invalidate(...tags) {
  return (req, res, next) => {
    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      if (res.statusCode >= 200 && res.statusCode < 300) {
        tags.forEach(invalidateTag);
      }
    };
    const originalJson = res.json.bind(res);
    const originalEnd = res.end.bind(res);
    res.json = (body) => {
      fire();
      return originalJson(body);
    };
    res.end = (...args) => {
      fire();
      return originalEnd(...args);
    };
    next();
  };
}
