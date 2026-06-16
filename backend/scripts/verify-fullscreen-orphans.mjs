// READ-ONLY: learn how Xibo marks playlist full-screen wrappers, then look
// for orphan accumulation. Creates/changes nothing.
import axios from "axios";
import FormData from "form-data";

const API = process.env.XIBO_API_URL;

async function auth() {
  const f = new FormData();
  f.append("client_id", process.env.XIBO_CLIENT_ID);
  f.append("client_secret", process.env.XIBO_CLIENT_SECRET);
  f.append("grant_type", "client_credentials");
  const r = await axios.post(`${API}/authorize/access_token`, f, {
    headers: f.getHeaders(),
  });
  return r.data.access_token;
}
const get = async (p, t) =>
  (await axios.get(`${API}${p}`, { headers: { Authorization: `Bearer ${t}` } })).data;
const arr = (d) => (Array.isArray(d) ? d : d?.data || []);

(async () => {
  const token = await auth();
  console.log("✓ authenticated\n");

  const layouts = arr(await get("/layout?length=1000&embed=regions,playlists", token));
  const byCampaign = new Map(layouts.map((l) => [String(l.campaignId), l]));

  // Schedule events (wide window)
  const y = new Date().getFullYear();
  const events = arr(
    await get(
      `/schedule?fromDt=${encodeURIComponent(`${y - 1}-01-01 00:00:00`)}&toDt=${encodeURIComponent(`${y + 1}-12-31 23:59:59`)}&embed=campaign`,
      token
    )
  );

  console.log(`Total layouts: ${layouts.length} | schedule events: ${events.length}\n`);

  console.log("=== Layouts behind each scheduled event ===");
  for (const e of events) {
    const l = byCampaign.get(String(e.campaignId));
    if (!l) {
      console.log(`event ${e.eventId}: campaign ${e.campaignId} -> (layout not in list)`);
      continue;
    }
    const regions = l.regions?.length ?? "?";
    console.log(
      `event ${e.eventId}: campaign=${e.campaignId} layoutId=${l.layoutId} regions=${regions} retired=${l.retired} parentId=${l.parentId} code="${l.code || ""}" name="${l.layout}"`
    );
  }

  // Distinct code values + how many layouts share each (wrappers often share a code pattern)
  console.log("\n=== Distinct non-empty 'code' values ===");
  const codes = {};
  layouts.forEach((l) => {
    if (l.code) (codes[l.code] ||= []).push(l.layoutId);
  });
  Object.entries(codes).forEach(([c, ids]) =>
    console.log(`   code="${c}" -> ${ids.length} layout(s) ${ids.length > 1 ? "[" + ids.join(",") + "]" : ""}`)
  );
  if (!Object.keys(codes).length) console.log("   (none)");

  // Single-region layouts whose name duplicates -> candidate auto-wrappers
  console.log("\n=== Layout names that repeat (possible duplicate wrappers) ===");
  const byName = {};
  layouts.forEach((l) => (byName[l.layout] ||= []).push(l));
  Object.entries(byName)
    .filter(([, v]) => v.length > 1)
    .slice(0, 20)
    .forEach(([n, v]) =>
      console.log(`   "${n}" x${v.length} layoutIds=[${v.map((x) => x.layoutId).join(",")}] regions=[${v.map((x) => x.regions?.length ?? "?").join(",")}]`)
    );
})().catch((e) => {
  console.error("ERROR:", e.response?.status, e.response?.data || e.message);
  process.exit(1);
});
