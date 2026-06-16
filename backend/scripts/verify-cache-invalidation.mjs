// Verify the response-cache invalidation end-to-end against the LIVE backend:
// list caches (MISS->HIT), a create invalidates it (MISS + new item present),
// and a delete invalidates it (MISS + item gone). Self-cleaning: deletes the
// test playlist it creates, even on failure.
import axios from "axios";
import jwt from "jsonwebtoken";
import { getAccessToken } from "../src/utils/xiboClient.js";

const BASE = "http://localhost:5000/api";

const arr = (d) => (Array.isArray(d) ? d : d?.data ?? []);

(async () => {
  // Mint a token whose id owns existing playlists, so created playlists are
  // visible in the owner-scoped list.
  const app = await getAccessToken();
  const all = arr(
    (await axios.get(`${process.env.XIBO_API_URL}/playlist?length=300`, {
      headers: { Authorization: `Bearer ${app}` },
    })).data
  );
  const counts = {};
  all.forEach((p) => (counts[p.ownerId] = (counts[p.ownerId] || 0) + 1));
  const ownerId = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
  const token = jwt.sign({ id: ownerId, username: "verify", email: "v@t" }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const H = { headers: { Authorization: `Bearer ${token}` } };
  console.log(`Using ownerId=${ownerId} (owns ${counts[ownerId]} playlists)\n`);

  const getList = async () => {
    const r = await axios.get(`${BASE}/playlists`, H);
    return { cache: r.headers["x-resp-cache"], items: arr(r.data), count: arr(r.data).length };
  };

  const results = [];
  const check = (name, cond, extra = "") => {
    results.push(cond);
    console.log(`${cond ? "✓" : "✗"} ${name}${extra ? "  (" + extra + ")" : ""}`);
  };

  let createdId = null;
  const testName = `__cache_test_${ownerId}`;
  try {
    const a = await getList();
    check("1st list GET is MISS", a.cache === "MISS", a.cache);
    const b = await getList();
    check("2nd list GET is HIT (cached)", b.cache === "HIT", b.cache);
    check("HIT count matches MISS count", a.count === b.count, `${a.count} vs ${b.count}`);

    // CREATE
    const created = await axios.post(`${BASE}/playlists`, { name: testName, description: "cache test" }, H);
    createdId = created.data?.playlist?.playlistId || created.data?.playlist?.id;
    console.log(`\n  created playlist id=${createdId} name="${testName}"\n`);

    const c = await getList();
    check("list GET after CREATE is MISS (invalidated)", c.cache === "MISS", c.cache);
    check("created playlist appears in list", c.items.some((p) => String(p.name) === testName));
    check("count increased by 1", c.count === a.count + 1, `${a.count} -> ${c.count}`);

    const d = await getList();
    check("list re-cached after create (HIT)", d.cache === "HIT", d.cache);

    // DELETE
    await axios.delete(`${BASE}/playlists/${createdId}`, H);
    createdId = null;
    console.log(`\n  deleted test playlist\n`);

    const e = await getList();
    check("list GET after DELETE is MISS (invalidated)", e.cache === "MISS", e.cache);
    check("deleted playlist gone from list", !e.items.some((p) => String(p.name) === testName));
    check("count back to original", e.count === a.count, `${e.count} vs ${a.count}`);
  } finally {
    if (createdId) {
      await axios.delete(`${BASE}/playlists/${createdId}`, H).catch(() => {});
      console.log(`\n  cleanup: deleted leftover test playlist ${createdId}`);
    }
  }

  const pass = results.every(Boolean);
  console.log(`\n${pass ? "✓ ALL CHECKS PASSED" : "✗ SOME CHECKS FAILED"}`);
  process.exit(pass ? 0 : 1);
})().catch((e) => {
  console.error("ERROR:", e.response?.status, e.response?.data || e.message);
  process.exit(1);
});
