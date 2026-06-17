import { test } from "node:test";
import assert from "node:assert/strict";

const { rejectInvalidUpload } = await import(
  "../src/middleware/uploadConfig.js"
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

test("disallowed MIME type -> 400, next not called", () => {
  const res = mockRes();
  let next = false;
  rejectInvalidUpload(
    { file: { mimetype: "application/x-msdownload" } },
    res,
    () => {
      next = true;
    }
  );
  assert.equal(res._status, 400);
  assert.equal(next, false);
  assert.match(res._body.message, /Unsupported file type/i);
});

test("allowed MIME type -> next()", () => {
  let next = false;
  rejectInvalidUpload({ file: { mimetype: "image/png" } }, mockRes(), () => {
    next = true;
  });
  assert.ok(next);
});

test("no file -> next() (handled downstream)", () => {
  let next = false;
  rejectInvalidUpload({}, mockRes(), () => {
    next = true;
  });
  assert.ok(next);
});
