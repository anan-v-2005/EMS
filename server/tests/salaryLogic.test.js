import test from "node:test";
import assert from "node:assert/strict";
import { pickCurrent, planSalaryChange } from "../services/salaryLogic.js";

const s = (from, basic, hra = 0, allowances = 0) => ({ effectiveFrom: new Date(`${from}T00:00:00+05:30`), basic, hra, allowances });
const asOf = new Date("2026-10-30T10:00:00+05:30");

test("pickCurrent ignores future-dated structures and picks the latest started one", () => {
  const list = [s("2026-01-01", 30000), s("2026-06-01", 40000), s("2027-01-01", 90000)];
  assert.equal(pickCurrent(list, asOf).basic, 40000);
  assert.equal(pickCurrent([s("2027-01-01", 1)], asOf), null);
});

test("creating an employee with a salary produces a first structure", () => {
  const plan = planSalaryChange({ structures: [], basic: 50000, allowance: 5000, effectiveKey: "2026-10-01", asOf });
  assert.equal(plan.action, "create");
  assert.deepEqual(plan.fields, { basic: 50000, hra: 0, allowances: 5000, fixedMonthlyGross: 55000, isActive: true });
});

test("a zero salary on creation stores nothing", () => {
  assert.equal(planSalaryChange({ structures: [], basic: 0, allowance: 0, effectiveKey: "2026-10-01", asOf }).action, "none");
});

test("saving the form without changing pay does not create a revision", () => {
  const plan = planSalaryChange({ structures: [s("2026-01-01", 40000, 10000, 5000)], basic: 40000, allowance: 15000, effectiveKey: "2026-10-30", asOf });
  assert.equal(plan.action, "none");
});

test("a raise creates a new structure and keeps the HRA split when it still fits", () => {
  const plan = planSalaryChange({ structures: [s("2026-01-01", 40000, 10000, 5000)], basic: 45000, allowance: 15000, effectiveKey: "2026-10-30", asOf });
  assert.equal(plan.action, "create");
  assert.deepEqual(plan.fields, { basic: 45000, hra: 10000, allowances: 5000, fixedMonthlyGross: 60000, isActive: true });
});

test("when allowances drop below the old HRA the split resets", () => {
  const plan = planSalaryChange({ structures: [s("2026-01-01", 40000, 10000, 5000)], basic: 40000, allowance: 4000, effectiveKey: "2026-10-30", asOf });
  assert.deepEqual(plan.fields, { basic: 40000, hra: 0, allowances: 4000, fixedMonthlyGross: 44000, isActive: true });
});

test("a correction on the same effective day updates in place instead of adding a duplicate", () => {
  const first = s("2026-10-01", 50000, 0, 5000);
  const plan = planSalaryChange({ structures: [first], basic: 52000, allowance: 5000, effectiveKey: "2026-10-01", asOf });
  assert.equal(plan.action, "update");
  assert.equal(plan.target, first);
  assert.equal(plan.fields.basic, 52000);
});

test("legacy employee (no structure) with pay gets a structure on first save", () => {
  assert.equal(planSalaryChange({ structures: [], basic: 30000, allowance: 2000, effectiveKey: "2026-10-30", asOf }).action, "create");
});
