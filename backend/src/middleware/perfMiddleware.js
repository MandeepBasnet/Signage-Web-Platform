// Phase 0: wrap each request in a perf context and log total time + Xibo calls
// on finish. Writes one JSON line per request to backend/perf.log (gitignored
// via *.log) for later aggregation by scripts/perf-report.mjs.
import fs from "node:fs";
import path from "node:path";
import { perfStore, newPerfContext } from "../utils/perf.js";

const LOG_FILE = path.join(process.cwd(), "perf.log");

export function perfMiddleware(req, res, next) {
  const ctx = newPerfContext();
  const startNs = process.hrtime.bigint();

  perfStore.run(ctx, () => {
    res.on("finish", () => {
      const totalMs = Number(process.hrtime.bigint() - startNs) / 1e6;
      const urlPath = req.originalUrl.split("?")[0];
      const record = {
        t: new Date().toISOString(),
        method: req.method,
        path: urlPath,
        status: res.statusCode,
        totalMs: Math.round(totalMs),
        xiboCalls: ctx.xiboCalls,
        xiboMs: Math.round(ctx.xiboMs),
      };
      fs.appendFile(LOG_FILE, JSON.stringify(record) + "\n", () => {});
      console.log(
        `[perf] ${req.method} ${urlPath} ${res.statusCode} ${Math.round(
          totalMs
        )}ms  xibo=${ctx.xiboCalls} call(s)/${Math.round(ctx.xiboMs)}ms`
      );
    });
    next();
  });
}
