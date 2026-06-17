import { test } from "node:test";
import assert from "node:assert/strict";

// Point at an unreachable Xibo so the web-login password check errors. A
// fail-CLOSED implementation must REJECT the login on any such error — it must
// never accept it (the previous fail-open bug). Port 1 refuses immediately.
process.env.JWT_SECRET = "test-secret-please-keep-this-over-32-chars-aaaa";
process.env.XIBO_API_URL = "http://127.0.0.1:1/api";
process.env.XIBO_CLIENT_ID = "test";
process.env.XIBO_CLIENT_SECRET = "test";

const { authenticateUser } = await import("../src/utils/xiboClient.js");

test("fail-closed: unreachable Xibo rejects login (never fails open)", async () => {
  const result = await authenticateUser("someuser", "somepassword");
  assert.equal(result.success, false);
});
