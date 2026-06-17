import { test } from "node:test";
import assert from "node:assert/strict";

// Deterministic secret for signing tests (no .env needed).
process.env.JWT_SECRET = "test-secret-please-keep-this-over-32-chars-aaaa";
const { signMediaUrl, isValidMediaSignature } = await import(
  "../src/utils/mediaUrlSigner.js"
);

test("valid signature is accepted", () => {
  const signed = signMediaUrl("/api/library/123/thumbnail?width=300&height=200");
  assert.ok(isValidMediaSignature(signed));
});

test("tampered path is rejected (sig is bound to the path)", () => {
  const signed = signMediaUrl("/api/library/123/thumbnail?width=300");
  assert.ok(!isValidMediaSignature(signed.replace("/123/", "/999/")));
});

test("tampered signature is rejected", () => {
  const signed = signMediaUrl("/api/library/123/thumbnail");
  assert.ok(!isValidMediaSignature(signed.slice(0, -3) + "xxx"));
});

test("expired signature is rejected", () => {
  const expired = signMediaUrl("/api/library/123/thumbnail", -1000);
  assert.ok(!isValidMediaSignature(expired));
});

test("unsigned url is rejected", () => {
  assert.ok(!isValidMediaSignature("/api/library/123/thumbnail?width=300"));
});
