import test from "node:test";
import assert from "node:assert/strict";
const { default: Attendance } = await import("../models/Attendance.js");
const { default: LeaveApplication } = await import("../models/LeaveApplication.js");
const { default: Holiday } = await import("../models/Holiday.js");
const { default: Salary } = await import("../models/Salary.js");
const { default: AttendanceAudit } = await import("../models/AttendanceAudit.js");
const data = await import("../services/payrollData.js");
const { mergeSettings } = await import("../services/payrollSettingsLogic.js");

const chain = (rows) => { const c = { select: () => c, sort: () => c, populate: () => c, lean: () => Promise.resolve(rows), then: (r, j) => Promise.resolve(rows).then(r, j) }; return c; };
const ist = (key) => new Date(`${key}T00:00:00+05:30`);
const emp = { _id: "a".repeat(24), joinDate: ist("2026-01-01"), basicSalary: 0, allowance: 0, deductions: 0 };

function setup({ rows = [], leaves = [], holidays = [], salaries = [] }) {
  Attendance.find = (q) => chain(q.checkIn ? [] : rows);       // closeOpenAttendance query has checkIn:{$ne:null}
  AttendanceAudit.create = async () => {};
  LeaveApplication.find = () => chain(leaves);
  Holiday.find = () => chain(holidays);
  Salary.find = () => chain(salaries);
}
// September 2026: Sep 1 = Tuesday. Working days (Mon-Fri) = 22.
const sepRows = (skip = []) => {
  const out = [];
  for (let d = 1; d <= 30; d++) {
    const key = `2026-09-${String(d).padStart(2, "0")}`;
    const wd = new Date(`${key}T00:00:00Z`).getUTCDay();
    if (wd === 0 || wd === 6 || skip.includes(key)) continue;
    out.push({ date: ist(key), dateKey: key, status: "PRESENT", workingHours: 8.5 });
  }
  return out;
};
const salary = (basic, from = "2026-01-01") => ({ effectiveFrom: ist(from), basic, hra: 0, allowances: 0 });
const settings = mergeSettings({ weeklyOffDays: [0, 6] });

test("integration: full month, salary structure → no deductions", async () => {
  setup({ rows: sepRows(), salaries: [salary(30000)] });
  const { result, monthOver } = await data.calculateForEmployee({ employee: emp, month: 9, year: 2026, settings, adjustments: {} });
  assert.equal(monthOver, true); assert.equal(result.attendance.monthWorkingDays, 22);
  assert.equal(result.netPay, 30000); assert.equal(result.salary.source, "STRUCTURE");
});

test("integration: one absence + an approved company holiday + optional holiday excluded upstream", async () => {
  setup({ rows: sepRows(["2026-09-14", "2026-09-07"]), holidays: [{ date: ist("2026-09-07") }], salaries: [salary(30000)] });
  const { result } = await data.calculateForEmployee({ employee: emp, month: 9, year: 2026, settings, adjustments: { bonus: 500 } });
  assert.equal(result.attendance.holidays, 1); assert.equal(result.attendance.lopDays, 1);   // Sep 7 holiday, Sep 14 absent
  assert.equal(result.deductions.lop, 1000); assert.equal(result.netPay, 29500);
});

test("integration: back-dated month still finds the superseded salary structure", async () => {
  setup({ rows: sepRows(), salaries: [salary(20000, "2026-01-01"), salary(50000, "2026-10-01")] });
  const { result } = await data.calculateForEmployee({ employee: emp, month: 9, year: 2026, settings, adjustments: {} });
  assert.equal(result.salary.gross, 20000);
});

test("integration: no structure falls back to employee record, with a warning", async () => {
  setup({ rows: sepRows() });
  const { result } = await data.calculateForEmployee({ employee: { ...emp, basicSalary: 18000, allowance: 2000, deductions: 300 }, month: 9, year: 2026, settings, adjustments: {} });
  assert.equal(result.salary.gross, 20000); assert.equal(result.netPay, 19700);
  assert.ok(result.warnings.some((w) => /employee record/.test(w)));
});

test("integration: leave record apportioned, Sat-working policy respected", async () => {
  const leaves = [{ startDate: ist("2026-09-02"), endDate: ist("2026-09-03"), type: "SICK", requestedDays: 2, paidDays: 2, lopDays: 0 }];
  setup({ rows: sepRows(["2026-09-02", "2026-09-03"]), leaves, salaries: [salary(30000)] });
  const { result } = await data.calculateForEmployee({ employee: emp, month: 9, year: 2026, settings, adjustments: {} });
  assert.equal(result.attendance.paidLeaves, 2); assert.equal(result.deductions.lop, 0);
  // six-day week: Saturdays become working days, so missing Saturday attendance is LOP
  setup({ rows: sepRows(), salaries: [salary(30000)] });
  const six = await data.calculateForEmployee({ employee: emp, month: 9, year: 2026, settings: mergeSettings({ weeklyOffDays: [0] }), adjustments: {} });
  assert.equal(six.result.attendance.monthWorkingDays, 26); assert.equal(six.result.attendance.lopDays, 4);
});

test("integration: guards - future month, early generation, manual mode, bad inputs", async () => {
  setup({ salaries: [salary(30000)] });
  await assert.rejects(data.calculateForEmployee({ employee: emp, month: 12, year: 2030, settings, adjustments: {} }), /future month/);
  const now = new Date(); const cm = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", month: "numeric" }).format(now)); const cy = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric" }).format(now));
  await assert.rejects(data.calculateForEmployee({ employee: emp, month: cm, year: cy, settings, adjustments: {}, allowEarly: false }), /not ended yet/);
  const early = await data.calculateForEmployee({ employee: emp, month: cm, year: cy, settings, adjustments: {}, allowEarly: true });
  assert.equal(early.monthOver, false);
  const manual = await data.calculateForEmployee({ employee: emp, month: 9, year: 2026, mode: "MANUAL", settings, adjustments: {}, manual: { basicSalary: 1000, allowances: 100, deductions: 50 } });
  assert.equal(manual.result.netPay, 1050);
  await assert.rejects(data.calculateForEmployee({ employee: emp, month: 9, year: 2026, mode: "MANUAL", settings, adjustments: {}, manual: { basicSalary: -5 } }), /non-negative/);
  await assert.rejects(data.calculateForEmployee({ employee: emp, month: 9, year: 2026, settings, adjustments: { tds: -1 } }), /non-negative/);
  assert.throws(() => data.validatePeriod(13, 2026), /valid month/);
});

test("integration: toPayslipFields keeps legacy fields consistent", async () => {
  setup({ rows: sepRows(["2026-09-14"]), salaries: [{ ...salary(24000), hra: 6000 }] });
  const calc = await data.calculateForEmployee({ employee: emp, month: 9, year: 2026, settings, adjustments: { tds: 100 } });
  const f = data.toPayslipFields({ result: calc.result, adjustments: calc.adjustments, mode: "AUTO", settings });
  assert.equal(Math.round((f.basicSalary + f.allowances - f.deductions) * 100), Math.round(f.netSalary * 100));
  assert.equal(f.breakdown.deductions.lop, 1000);
});
