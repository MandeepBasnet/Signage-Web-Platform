// Aggregate backend/perf.log (written by perfMiddleware) into a baseline table.
// Groups requests by normalized route (numeric IDs -> :id) and reports request
// count, avg/p95 total ms, and avg Xibo calls + ms per route. Usage:
//   node scripts/perf-report.mjs            # all logged requests
//   node scripts/perf-report.mjs --since 10m   # last 10 minutes only
import fs from "node:fs";
import path from "node:path";

const LOG = path.join(process.cwd(), "perf.log");
if (!fs.existsSync(LOG)) {
  console.error(`No perf.log at ${LOG}. Start the backend and exercise the app first.`);
  process.exit(1);
}

// optional --since Nm/Ns/Nh window
const sinceIdx = process.argv.indexOf("--since");
const sinceArg = sinceIdx !== -1 ? process.argv[sinceIdx + 1] : null;
let sinceMs = 0;
if (sinceArg && /^(\d+)([smh])$/.test(sinceArg)) {
  const [, n, u] = sinceArg.match(/^(\d+)([smh])$/);
  sinceMs = Date.now() - Number(n) * { s: 1e3, m: 6e4, h: 36e5 }[u];
}

const norm = (p) =>
  p
    .split("/")
    .map((seg) =>
      /^\d+$/.test(seg) ? ":id" : /^[0-9a-f]{16,}$/i.test(seg) ? ":sid" : seg
    )
    .join("/");

const rows = fs
  .readFileSync(LOG, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  })
  .filter(Boolean)
  .filter((r) => !sinceMs || new Date(r.t).getTime() >= sinceMs);

if (!rows.length) {
  console.error("No matching perf records.");
  process.exit(1);
}

const groups = new Map();
for (const r of rows) {
  const key = `${r.method} ${norm(r.path)}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

const table = [...groups.entries()]
  .map(([route, rs]) => {
    const totals = rs.map((r) => r.totalMs);
    const calls = rs.map((r) => r.xiboCalls);
    return {
      route,
      n: rs.length,
      avgMs: Math.round(avg(totals)),
      p95Ms: Math.round(pct(totals, 95)),
      avgXiboCalls: +avg(calls).toFixed(1),
      avgXiboMs: Math.round(avg(rs.map((r) => r.xiboMs))),
      totalTimeMs: Math.round(totals.reduce((a, b) => a + b, 0)),
    };
  })
  .sort((a, b) => b.totalTimeMs - a.totalTimeMs);

console.log(`\nBASELINE  (${rows.length} requests${sinceArg ? `, last ${sinceArg}` : ""})\n`);
console.table(
  table.map((r) => ({
    Route: r.route,
    Reqs: r.n,
    "Avg ms": r.avgMs,
    "p95 ms": r.p95Ms,
    "Avg Xibo calls": r.avgXiboCalls,
    "Avg Xibo ms": r.avgXiboMs,
  }))
);

const totalReq = rows.length;
const totalXibo = rows.reduce((a, r) => a + r.xiboCalls, 0);
console.log(
  `\nTotals: ${totalReq} requests, ${totalXibo} Xibo calls ` +
    `(${(totalXibo / totalReq).toFixed(1)} per request avg), ` +
    `${Math.round(avg(rows.map((r) => r.totalMs)))}ms avg request.\n`
);
