import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../middleware/security.js";
import { createPasswordToken, hashToken, buildResetLink } from "../utils/passwordTokens.js";

const run = (limiter, req) => {
  const res = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json() { return this; } };
  let passed = false;
  limiter(req, res, () => { passed = true; });
  return { passed, res };
};

test("rate limiter allows up to max requests per key, then answers 429 with Retry-After", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 3, keyFn: (r) => r.ip });
  for (let i = 0; i < 3; i++) assert.equal(run(limiter, { ip: "1.1.1.1" }).passed, true);
  const blocked = run(limiter, { ip: "1.1.1.1" });
  assert.equal(blocked.passed, false);
  assert.equal(blocked.res.code, 429);
  assert.ok(blocked.res.headers["Retry-After"]);
  assert.equal(run(limiter, { ip: "2.2.2.2" }).passed, true, "other clients are unaffected");
});

test("reset tokens are random, only their hash is stored, and they expire", () => {
  const a = createPasswordToken(1000), b = createPasswordToken(1000);
  assert.notEqual(a.token, b.token);
  assert.equal(a.hash, hashToken(a.token));
  assert.notEqual(a.hash, a.token);
  assert.ok(a.expires.getTime() > Date.now());
});

test("reset link carries the token and url-encoded email", () => {
  process.env.CLIENT_URL = "https://ems.example.com/,http://localhost:5173";
  const link = buildResetLink("abc123", "a+b@x.com");
  assert.equal(link, "https://ems.example.com/reset-password?token=abc123&email=a%2Bb%40x.com");
});
