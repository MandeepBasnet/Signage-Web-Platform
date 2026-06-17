import { test } from "node:test";
import assert from "node:assert/strict";

const { BLOCKED_PROXY_PATH } = await import(
  "../src/controllers/layoutPreviewProxy.js"
);

test("sensitive admin/data proxy paths are blocked", () => {
  for (const p of [
    "user",
    "user/1",
    "admin/settings",
    "display",
    "displaygroup/2",
    "dataset/data/5",
    "schedule",
    "campaign/3",
    "application",
    "auditlog",
  ]) {
    assert.ok(BLOCKED_PROXY_PATH.test(p), `expected /${p} to be blocked`);
  }
});

test("preview asset paths are allowed", () => {
  for (const p of [
    "layout/preview/1",
    "layout/xlf/9",
    "library/download/5",
    "region/1",
    "dist/preview.bundle.min.js",
    "theme/app.css",
    "modules/widget.js",
    "fonts/x.woff2",
    "",
  ]) {
    assert.ok(!BLOCKED_PROXY_PATH.test(p), `expected /${p} to be allowed`);
  }
});
