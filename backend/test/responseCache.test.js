import { test } from "node:test";
import assert from "node:assert/strict";

const { cacheList, invalidate } = await import(
  "../src/middleware/responseCache.js"
);

const mockRes = () => ({
  statusCode: 200,
  headers: {},
  body: null,
  setHeader(k, v) {
    this.headers[k] = v;
  },
  status(c) {
    this.statusCode = c;
    return this;
  },
  json(b) {
    this.body = b;
    return this;
  },
  end() {
    return this;
  },
});
const GET = (url, user) => ({ method: "GET", originalUrl: url, user });

test("first GET misses, second GET hits and skips the controller", () => {
  const tag = "t-hit";
  const r1 = mockRes();
  let ranA = false;
  cacheList(tag)(GET("/api/x?p=1", { id: 1 }), r1, () => {
    ranA = true;
    r1.json({ data: ["A"] });
  });
  assert.equal(r1.headers["X-Resp-Cache"], "MISS");
  assert.ok(ranA);

  const r2 = mockRes();
  let ranB = false;
  cacheList(tag)(GET("/api/x?p=1", { id: 1 }), r2, () => {
    ranB = true;
  });
  assert.equal(r2.headers["X-Resp-Cache"], "HIT");
  assert.equal(ranB, false, "controller must be skipped on a cache hit");
  assert.deepEqual(r2.body, { data: ["A"] });
});

test("cache is user-scoped (no cross-user leak)", () => {
  const tag = "t-user";
  // seed user 1
  const seed = mockRes();
  cacheList(tag)(GET("/api/x", { id: 1 }), seed, () => seed.json({ d: 1 }));
  // user 99 must MISS (must not see user 1's cached entry)
  let ran = false;
  const r = mockRes();
  cacheList(tag)(GET("/api/x", { id: 99 }), r, () => {
    ran = true;
    r.json({ d: 99 });
  });
  assert.ok(ran);
  assert.equal(r.headers["X-Resp-Cache"], "MISS");
});

test("a successful mutation invalidates; a 4xx mutation does not", () => {
  const tag = "t-inv";
  const seed = () => {
    const r = mockRes();
    cacheList(tag)(GET("/api/x", { id: 1 }), r, () => r.json({ d: 1 }));
    return r;
  };
  seed(); // cached

  // 2xx mutation -> invalidates
  const okMut = mockRes();
  invalidate(tag)({ method: "POST" }, okMut, () => okMut.status(201).json({ ok: 1 }));
  let ranAfterOk = false;
  const afterOk = mockRes();
  cacheList(tag)(GET("/api/x", { id: 1 }), afterOk, () => {
    ranAfterOk = true;
    afterOk.json({ d: 2 });
  });
  assert.ok(ranAfterOk, "cache should be invalidated by a 2xx mutation");

  // 4xx mutation -> keeps cache
  const badMut = mockRes();
  invalidate(tag)({ method: "POST" }, badMut, () => badMut.status(409).json({ e: 1 }));
  let ranAfterBad = false;
  const afterBad = mockRes();
  cacheList(tag)(GET("/api/x", { id: 1 }), afterBad, () => {
    ranAfterBad = true;
  });
  assert.equal(ranAfterBad, false, "a 4xx mutation must not invalidate the cache");
  assert.equal(afterBad.headers["X-Resp-Cache"], "HIT");
});
