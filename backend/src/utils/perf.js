// Phase 0 performance instrumentation.
// Per-request context (via AsyncLocalStorage) that accumulates how many Xibo
// upstream calls a request made and how long they took. Threaded implicitly so
// no controller/helper signatures change. Read the baseline with
// `node scripts/perf-report.mjs`.
import { AsyncLocalStorage } from "node:async_hooks";

export const perfStore = new AsyncLocalStorage();

// Seed a fresh per-request accumulator.
export const newPerfContext = () => ({ xiboCalls: 0, xiboMs: 0 });

// Record one upstream Xibo call against the active request (no-op outside one).
export function recordXibo(ms) {
  const ctx = perfStore.getStore();
  if (ctx) {
    ctx.xiboCalls += 1;
    ctx.xiboMs += ms;
  }
}

// Time an upstream call and attribute it to the active request.
export async function timedXibo(fn) {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    recordXibo(performance.now() - start);
  }
}
