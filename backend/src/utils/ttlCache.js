// Small in-memory TTL + LRU cache backed by a Map.
//
// A Map preserves insertion order, so the oldest key is always at the front —
// we evict from there once `maxSize` is exceeded, and on every read we re-insert
// the hit key so it becomes most-recently-used. Entries also carry an absolute
// expiry and are dropped lazily on read once past their TTL.
//
// Used for thumbnail byte caches so repeated loads don't re-stream the same
// image from the remote Xibo CMS. Bounded by entry count (not bytes), which is
// fine for the small, uniformly-sized thumbnails stored here.
export function createTtlCache({ maxSize = 500, ttlMs }) {
  const store = new Map(); // key -> { value, expiresAt }

  const get = (key) => {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      store.delete(key);
      return null;
    }
    // Refresh recency: re-insert so this key moves to the most-recently-used end.
    store.delete(key);
    store.set(key, entry);
    return entry.value;
  };

  const set = (key, value) => {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
    // Evict the oldest entries (front of insertion order) beyond the cap.
    while (store.size > maxSize) {
      const oldestKey = store.keys().next().value;
      store.delete(oldestKey);
    }
  };

  // Drop a key (used to invalidate a cached entry when its source changes).
  const remove = (key) => store.delete(key);

  return { get, set, delete: remove };
}
