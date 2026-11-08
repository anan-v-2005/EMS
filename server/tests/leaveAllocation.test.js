import test from "node:test";
import assert from "node:assert/strict";
import { buildBalances, computeCarryForward, eligibleFraction } from "../services/leaveAllocation.js";

test("employees who joined in a previous year get the full 20 days", () => {
  const b = buildBalances({ joinDate: "2020-03-01", year: 2026 });
  assert.equal(b.sick.total + b.casual.total + b.emergency.total + b.annual.total, 20);
});

test("mid-year joiners are prorated by months remaining (joining month counts)", () => {
  assert.equal(eligibleFraction("2026-07-15", 2026), 6 / 12);
  const b = buildBalances({ joinDate: "2026-07-15", year: 2026 });
  assert.equal(b.sick.total, 3.5);
  assert.equal(b.casual.total, 3.5);
  assert.equal(b.sick.remaining, b.sick.total);
});

test("employees joining in a future year get nothing for this year", () => {
  assert.equal(eligibleFraction("2027-01-10", 2026), 0);
});

test("carry-forward moves unused annual leave, capped at the policy maximum", () => {
  assert.deepEqual(computeCarryForward({ annual: { remaining: 3 }, casual: { remaining: 6 } }), { annual: 3 });
  assert.deepEqual(computeCarryForward({ annual: { remaining: 1.5 } }), { annual: 1.5 });
  assert.deepEqual(computeCarryForward({ annual: { remaining: 0 } }), {});
  assert.deepEqual(computeCarryForward(null), {});
});

test("carried days are added on top of the new year's allocation", () => {
  const b = buildBalances({ joinDate: "2020-03-01", year: 2027, carried: { annual: 2 } });
  assert.equal(b.annual.total, 5);
  assert.equal(b.annual.remaining, 5);
});

test("October joiners receive the prorated 6-day allocation under the existing 20-day policy", () => {
  const b = buildBalances({ joinDate: "2026-10-01", year: 2026 });
  assert.deepEqual(
    [b.sick.total, b.casual.total, b.emergency.total, b.annual.total],
    [2, 2, 1, 1],
  );
  assert.equal(b.sick.total + b.casual.total + b.emergency.total + b.annual.total, 6);
});

test("a November joiner receives two months of allocation, with half-day rounding", () => {
  const b = buildBalances({ joinDate: "2026-11-01", year: 2026 });
  assert.deepEqual(
    [b.sick.total, b.casual.total, b.emergency.total, b.annual.total],
    [1, 1, 0.5, 0.5],
  );
});
