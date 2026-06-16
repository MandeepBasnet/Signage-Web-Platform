// Persistent two-tier thumbnail cache: a fast in-memory LRU in front of a
// durable on-disk store. A thumbnail fetched once survives process restarts and
// memory eviction, so the slow first-load from Xibo (2.6-5.5s) is paid at most
// once per TTL window instead of on every restart/deploy.
//
// Drop-in compatible with createTtlCache for thumbnail use: get(key) returns
// { buffer, contentType } or null; set(key, { buffer, contentType }); delete(key).
// Disk reads on get() are synchronous to keep the get() API non-async (callers
// invoke it inline); thumbnails are small so the read cost is sub-millisecond.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export function createDiskThumbCache({
  dir,
  ttlMs,
  memMaxSize = 500,
  maxBytes = 200 * 1024 * 1024, // 200 MB on-disk cap
}) {
  fs.mkdirSync(dir, { recursive: true });

  const mem = new Map(); // key -> { value, expiresAt }
  const hash = (key) =>
    crypto.createHash("sha1").update(String(key)).digest("hex");
  const binPath = (h) => path.join(dir, h);
  const ctPath = (h) => path.join(dir, `${h}.ct`);

  const memGet = (key) => {
    const e = mem.get(key);
    if (!e) return null;
    if (e.expiresAt < Date.now()) {
      mem.delete(key);
      return null;
    }
    mem.delete(key); // LRU: re-insert as most-recently-used
    mem.set(key, e);
    return e.value;
  };

  const memSet = (key, value) => {
    mem.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (mem.size > memMaxSize) mem.delete(mem.keys().next().value);
  };

  const get = (key) => {
    const hit = memGet(key);
    if (hit) return hit;

    const h = hash(key);
    try {
      const st = fs.statSync(binPath(h));
      if (Date.now() - st.mtimeMs > ttlMs) {
        // Stale on disk — drop it and miss.
        fs.rmSync(binPath(h), { force: true });
        fs.rmSync(ctPath(h), { force: true });
        return null;
      }
      const buffer = fs.readFileSync(binPath(h));
      let contentType = "image/png";
      try {
        contentType = fs.readFileSync(ctPath(h), "utf8") || contentType;
      } catch {
        /* missing sidecar — fall back to default content type */
      }
      const value = { buffer, contentType };
      memSet(key, value); // promote to memory for next time
      return value;
    } catch {
      return null; // not on disk
    }
  };

  let setsSinceEvict = 0;
  const set = (key, value) => {
    memSet(key, value);
    const h = hash(key);
    // Write-through to disk (best-effort; failures just mean a future miss).
    fs.writeFile(binPath(h), value.buffer, () => {});
    fs.writeFile(ctPath(h), value.contentType || "image/png", () => {});
    if (++setsSinceEvict >= 25) {
      setsSinceEvict = 0;
      setImmediate(evict);
    }
  };

  const remove = (key) => {
    mem.delete(key);
    const h = hash(key);
    fs.rm(binPath(h), { force: true }, () => {});
    fs.rm(ctPath(h), { force: true }, () => {});
  };

  // Bound total on-disk usage: delete oldest (by mtime) image files until under
  // the byte cap. Sidecar .ct files are removed alongside their image.
  const evict = () => {
    try {
      const imgs = fs.readdirSync(dir).filter((f) => !f.endsWith(".ct"));
      const entries = imgs.map((f) => {
        const p = path.join(dir, f);
        const st = fs.statSync(p);
        return { f, p, size: st.size, mtime: st.mtimeMs };
      });
      let total = entries.reduce((a, e) => a + e.size, 0);
      if (total <= maxBytes) return;
      entries.sort((a, b) => a.mtime - b.mtime); // oldest first
      for (const e of entries) {
        if (total <= maxBytes) break;
        fs.rmSync(e.p, { force: true });
        fs.rmSync(path.join(dir, `${e.f}.ct`), { force: true });
        total -= e.size;
      }
    } catch {
      /* eviction is best-effort */
    }
  };

  return { get, set, delete: remove };
}
