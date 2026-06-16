// Controlled test: does POST /layout/fullscreen create a NEW wrapper layout
// every call (=> orphan accumulation) or dedupe to one? Self-cleaning: only
// deletes layouts that did NOT exist in the pre-test snapshot.
import axios from "axios";
import FormData from "form-data";

const API = process.env.XIBO_API_URL;
const auth = async () => {
  const f = new FormData();
  f.append("client_id", process.env.XIBO_CLIENT_ID);
  f.append("client_secret", process.env.XIBO_CLIENT_SECRET);
  f.append("grant_type", "client_credentials");
  return (await axios.post(`${API}/authorize/access_token`, f, { headers: f.getHeaders() })).data.access_token;
};
const get = async (p, t) => (await axios.get(`${API}${p}`, { headers: { Authorization: `Bearer ${t}` } })).data;
const arr = (d) => (Array.isArray(d) ? d : d?.data || []);

const wrap = async (playlistId, t) => {
  const f = new FormData();
  f.append("id", String(playlistId));
  f.append("type", "playlist");
  const r = await axios.post(`${API}/layout/fullscreen`, f, {
    headers: { Authorization: `Bearer ${t}`, ...f.getHeaders() },
  });
  return Array.isArray(r.data) ? r.data[0] : r.data?.data || r.data;
};

(async () => {
  const t = await auth();
  console.log("✓ authenticated");

  // Baseline snapshot of existing layoutIds
  const before = new Set(arr(await get("/layout?length=2000", t)).map((l) => Number(l.layoutId)));
  console.log(`Baseline layouts: ${before.size}`);

  // Pick a playlist to test with
  const playlists = arr(await get("/playlist?length=5", t));
  if (!playlists.length) throw new Error("No playlists available to test.");
  const pl = playlists[0];
  console.log(`Using playlist: id=${pl.playlistId} name="${pl.name}"\n`);

  const created = new Set();
  const note = (layout) => {
    if (layout && !before.has(Number(layout.layoutId))) created.add(Number(layout.layoutId));
  };

  try {
    const a = await wrap(pl.playlistId, t);
    console.log(`Call #1 -> layoutId=${a.layoutId} campaignId=${a.campaignId}`);
    note(a);
    const b = await wrap(pl.playlistId, t);
    console.log(`Call #2 -> layoutId=${b.layoutId} campaignId=${b.campaignId}`);
    note(b);

    console.log("\n=== VERDICT ===");
    if (String(a.layoutId) === String(b.layoutId) && String(a.campaignId) === String(b.campaignId)) {
      console.log("DEDUPE: Xibo returns the SAME wrapper both times. No orphan accumulation.");
    } else {
      console.log("DUPLICATE: each call made a NEW wrapper layout => orphans accumulate. Cleanup (b) is warranted.");
    }
  } finally {
    // Cleanup: delete ONLY layouts this test created
    console.log(`\nCleanup: deleting ${created.size} test-created layout(s): [${[...created].join(", ")}]`);
    for (const id of created) {
      try {
        await axios.delete(`${API}/layout/${id}`, { headers: { Authorization: `Bearer ${t}` } });
        console.log(`   deleted layoutId=${id}`);
      } catch (e) {
        console.log(`   FAILED to delete ${id}: ${e.response?.status} ${JSON.stringify(e.response?.data || e.message)}`);
      }
    }
    const after = new Set(arr(await get("/layout?length=2000", t)).map((l) => Number(l.layoutId)));
    const leftover = [...created].filter((id) => after.has(id));
    console.log(leftover.length ? `⚠ leftover (manual cleanup): ${leftover}` : "✓ instance restored to baseline");
  }
})().catch((e) => {
  console.error("ERROR:", e.response?.status, JSON.stringify(e.response?.data) || e.message);
  process.exit(1);
});
