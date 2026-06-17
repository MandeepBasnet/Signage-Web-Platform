import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "test-secret-please-keep-this-over-32-chars-aaaa";
const { mediaAuth } = await import("../src/middleware/mediaAuth.js");
const { signMediaUrl } = await import("../src/utils/mediaUrlSigner.js");

const mockRes = () => ({
  statusCode: 200,
  _status: null,
  status(c) {
    this._status = c;
    this.statusCode = c;
    return this;
  },
  json() {
    return this;
  },
});

test("valid signature -> next()", () => {
  const signed = signMediaUrl("/api/library/1/thumbnail");
  let called = false;
  mediaAuth({ originalUrl: signed, headers: {}, query: {} }, mockRes(), () => {
    called = true;
  });
  assert.ok(called);
});

test("valid JWT header -> next()", () => {
  const tok = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: "1h" });
  let called = false;
  mediaAuth(
    {
      originalUrl: "/api/library/1/thumbnail",
      headers: { authorization: `Bearer ${tok}` },
      query: {},
    },
    mockRes(),
    () => {
      called = true;
    }
  );
  assert.ok(called);
});

test("no signature and no token -> 401, next not called", () => {
  let called = false;
  const res = mockRes();
  mediaAuth(
    { originalUrl: "/api/library/1/thumbnail", headers: {}, query: {} },
    res,
    () => {
      called = true;
    }
  );
  assert.equal(called, false);
  assert.equal(res._status, 401);
});
