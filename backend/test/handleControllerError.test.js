import { test } from "node:test";
import assert from "node:assert/strict";

const { handleControllerError, HttpError } = await import(
  "../src/utils/xiboDataHelpers.js"
);

const mockRes = () => ({
  _status: null,
  _body: null,
  status(c) {
    this._status = c;
    return this;
  },
  json(b) {
    this._body = b;
    return this;
  },
});

const upstreamErr = () => ({
  message: "connect ECONNREFUSED 10.0.0.5:443",
  response: {
    status: 502,
    data: { message: "Upstream failed", internalSchema: "SECRET", trace: "/var/app" },
  },
});

test("production returns only a safe message (no internals)", () => {
  process.env.NODE_ENV = "production";
  const res = mockRes();
  handleControllerError(res, upstreamErr(), "Failed");
  assert.equal(res._status, 502);
  assert.deepEqual(res._body, { message: "Upstream failed" });
  const s = JSON.stringify(res._body);
  assert.ok(!s.includes("SECRET") && !s.includes("ECONNREFUSED"));
});

test("development includes error/details for debugging", () => {
  process.env.NODE_ENV = "development";
  const res = mockRes();
  handleControllerError(res, upstreamErr(), "Failed");
  assert.ok(res._body.error);
  assert.ok(res._body.details);
});

test("HttpError passes its status and message through", () => {
  const res = mockRes();
  handleControllerError(res, new HttpError(400, "Bad input"), "Fallback");
  assert.equal(res._status, 400);
  assert.deepEqual(res._body, { message: "Bad input" });
});
