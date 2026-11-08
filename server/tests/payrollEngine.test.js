import test from "node:test";
import assert from "node:assert/strict";
import {
  computePayslip, computeManualPayslip, summarizeAttendance, resolveSalaryForPeriod,
  professionalTaxForSlab, daysInMonth, addDaysToKey, toPaise,
} from "../services/payrollEngine.js";
import { PAYROLL_DEFAULTS } from "../config/payrollDefaults.js";
import { mergeSettings, validateSettingsInput } from "../services/payrollSettingsLogic.js";

const settings = (over = {}) => mergeSettings({ weeklyOffDays: [0, 6], ...over });
// November 2026: 30 days. Sat/Sun off => working days: 21 (Nov 1 is a Sunday).
const NOV = { year: 2026, month: 11 };
const row = (hours, status = "PRESENT", extra = {}) => ({ status, workingHours: hours, ...extra });
const fullAttendance = (overrides = {}) => {
  const map = new Map();
  for (let d = 1; d <= 30; d++) {
    const key = `2026-11-${String(d).padStart(2, "0")}`;
    const wd = new Date(`${key}T00:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) map.set(key, row(8.5));
  }
  for (const [k, v] of Object.entries(overrides)) v === null ? map.delete(k) : map.set(k, v);
  return map;
};
const summary = (opts = {}) => summarizeAttendance({ ...NOV, attendanceByKey: fullAttendance(), thresholds: { fullDayHours: 8, halfDayHours: 4, overtimeAfterHours: 9 }, ...opts });

test("calendar helpers", () => {
  assert.equal(daysInMonth(2026, 2), 28); assert.equal(daysInMonth(2028, 2), 29); assert.equal(daysInMonth(2026, 12), 31);
  assert.equal(addDaysToKey("2026-12-31", 1), "2027-01-01");
  assert.equal(toPaise(1.005), 101); assert.equal(toPaise("abc"), 0);
});

test("perfect attendance: 21 working days, no LOP, nothing deducted", () => {
  const s = summary();
  assert.equal(s.monthWorkingDays, 21); assert.equal(s.workingDays, 21); assert.equal(s.present, 21);
  assert.equal(s.lopDays, 0); assert.equal(s.weeklyOffs, 9);
  const p = computePayslip({ ...NOV, salary: { basic: 15000, hra: 6000, allowances: 9000 }, attendance: s, settings: settings() });
  assert.equal(p.salary.gross, 30000); assert.equal(p.deductions.lop, 0); assert.equal(p.netPay, 30000);
  assert.equal(p.legacy.netSalary, 30000); assert.equal(p.legacy.basicSalary, 15000); assert.equal(p.legacy.allowances, 15000);
});

test("absent day costs gross/30 on a CALENDAR basis, half day costs half", () => {
  const s = summary({ attendanceByKey: fullAttendance({ "2026-11-03": null, "2026-11-04": row(5) }) });
  assert.equal(s.lopDays, 1.5); assert.equal(s.halfDays, 1); assert.equal(s.present, 19.5);
  const p = computePayslip({ ...NOV, salary: { basic: 15000, hra: 6000, allowances: 9000 }, attendance: s, settings: settings() });
  assert.equal(p.attendance.perDaySalary, 1000); assert.equal(p.deductions.lop, 1500); assert.equal(p.netPay, 28500);
});

test("WORKING-day basis divides by 21 working days", () => {
  const s = summary({ attendanceByKey: fullAttendance({ "2026-11-03": null }) });
  const p = computePayslip({ ...NOV, salary: { basic: 21000, hra: 0, allowances: 0 }, attendance: s, settings: settings({ payDaysBasis: "WORKING" }) });
  assert.equal(p.deductions.lop, 1000); assert.equal(p.attendance.payDaysDivisor, 21); assert.equal(p.netPay, 20000);
});

test("employee who joined mid-month is NOT paid for days before joining (bug fix)", () => {
  // joins Nov 16 => 15 calendar days unemployed
  const s = summary({ joinKey: "2026-11-16", attendanceByKey: new Map([...fullAttendance()].filter(([k]) => k >= "2026-11-16")) });
  assert.equal(s.preJoinDays, 15); assert.equal(s.lopDays, 0);
  const p = computePayslip({ ...NOV, salary: { basic: 30000, hra: 0, allowances: 0 }, attendance: s, settings: settings() });
  assert.equal(p.deductions.lop, 15000); assert.equal(p.netPay, 15000);
});

test("holidays and weekly offs are never LOP; optional holiday handling is by caller", () => {
  const s = summary({ offHolidayKeys: new Set(["2026-11-09"]), attendanceByKey: fullAttendance({ "2026-11-09": null }) });
  assert.equal(s.holidays, 1); assert.equal(s.monthWorkingDays, 20); assert.equal(s.lopDays, 0);
});

test("approved paid leave counts as paid; leave beyond balance is LOP", () => {
  const leaves = [{ startKey: "2026-11-02", endKey: "2026-11-04", type: "CASUAL", requestedDays: 3, paidDays: 2, lopDays: 1 }];
  const s = summary({ leaves, attendanceByKey: fullAttendance({ "2026-11-02": null, "2026-11-03": null, "2026-11-04": null }) });
  assert.equal(s.paidLeaves, 2); assert.equal(s.lopDays, 1); assert.equal(s.paidLeaveBreakdown.casual, 2);
});

test("half-day leave + half-day attendance gives no LOP; half-day leave without attendance gives 0.5 LOP", () => {
  const leaves = [{ startKey: "2026-11-02", endKey: "2026-11-02", type: "SICK", requestedDays: 0.5, paidDays: 0.5, lopDays: 0 }];
  let s = summary({ leaves });
  assert.equal(s.lopDays, 0); assert.equal(s.paidLeaves, 0.5);
  s = summary({ leaves, attendanceByKey: fullAttendance({ "2026-11-02": null }) });
  assert.equal(s.lopDays, 0.5);
});

test("leave spanning two months is apportioned by day (October part does not leak into November)", () => {
  // Fri Oct 30 + Mon Nov 2 are the only working days in the range (weekend between): 2 paid days.
  const leaves = [{ startKey: "2026-10-30", endKey: "2026-11-02", type: "ANNUAL", requestedDays: 2, paidDays: 1, lopDays: 1 }];
  const s = summary({ leaves, attendanceByKey: fullAttendance({ "2026-11-02": null }) });
  assert.equal(s.paidLeaves, 0); assert.equal(s.lopDays, 1); // 1st working day (Oct 30) consumed the paid day
});

test("late marks are counted and optionally converted to half-day deductions", () => {
  const late = {}; for (const d of ["02", "03", "04", "05", "06", "09"]) late[`2026-11-${d}`] = row(8.5, "LATE");
  const s = summary({ attendanceByKey: fullAttendance(late) });
  assert.equal(s.lateMarks, 6);
  const none = computePayslip({ ...NOV, salary: { basic: 30000, hra: 0, allowances: 0 }, attendance: s, settings: settings() });
  assert.equal(none.deductions.lop, 0);
  const rule = computePayslip({ ...NOV, salary: { basic: 30000, hra: 0, allowances: 0 }, attendance: s, settings: settings({ lateMarks: { perHalfDay: 3 } }) });
  assert.equal(rule.attendance.latePenaltyDays, 1); assert.equal(rule.deductions.lop, 1000);
});

test("overtime: derived rate uses multiplier; an explicit admin rate is NOT multiplied again (bug fix)", () => {
  const s = summary({ attendanceByKey: fullAttendance({ "2026-11-02": row(11) }) }); // 2h over 9
  assert.equal(s.overtimeHours, 2);
  const base = { ...NOV, salary: { basic: 24000, hra: 0, allowances: 0 }, attendance: s };
  const derived = computePayslip({ ...base, settings: settings() }); // 24000/30/8 = 100/h *1.5 = 150
  assert.equal(derived.earnings.overtime, 300);
  const explicit = computePayslip({ ...base, settings: settings(), adjustments: { overtimeRate: 200 } });
  assert.equal(explicit.earnings.overtime, 400);
  const disabled = computePayslip({ ...base, settings: settings({ overtime: { enabled: false } }) });
  assert.equal(disabled.earnings.overtime, 0);
});

test("open (no check-out) sessions are not treated as absent and are flagged", () => {
  const s = summary({ attendanceByKey: fullAttendance({ "2026-11-02": { status: "PRESENT", workingHours: null, needsReview: true } }) });
  assert.equal(s.openSessions, 1); assert.equal(s.lopDays, 0); assert.equal(s.reviewFlags, 1);
  const p = computePayslip({ ...NOV, salary: { basic: 30000, hra: 0, allowances: 0 }, attendance: s, settings: settings() });
  assert.ok(p.warnings.some((w) => /no check-out/.test(w))); assert.ok(p.warnings.some((w) => /await review/.test(w)));
});

test("month in progress: days after asOf are pending, not LOP (bug fix)", () => {
  const s = summarizeAttendance({ ...NOV, asOfKey: "2026-11-10", attendanceByKey: fullAttendance(), thresholds: {} });
  assert.equal(s.pendingDays, 21 - 7); assert.equal(s.lopDays, 0);
  const p = computePayslip({ ...NOV, salary: { basic: 30000, hra: 0, allowances: 0 }, attendance: s, settings: settings() });
  assert.equal(p.netPay, 30000); assert.ok(p.warnings.some((w) => /not happened yet/.test(w)));
});

test("PF respects the wage ceiling and is computed on EARNED basic; ESI eligibility uses standard gross", () => {
  const s = summary({ attendanceByKey: fullAttendance({ "2026-11-03": null }) });
  const cfg = settings({ pf: { enabled: true } });
  const p = computePayslip({ ...NOV, salary: { basic: 20000, hra: 0, allowances: 10000 }, attendance: s, settings: cfg });
  assert.equal(p.deductions.pf, 1800); assert.equal(p.employer.pf, 1800); // min(19333, 15000) * 12%
  const low = computePayslip({ ...NOV, salary: { basic: 10000, hra: 0, allowances: 0 }, attendance: s, settings: cfg });
  assert.equal(low.deductions.lop, 333.33); assert.equal(low.deductions.pf, 1160); // earned basic 9666.67 * 12% = 1160.00
  const esi = settings({ esi: { enabled: true } });
  assert.equal(computePayslip({ ...NOV, salary: { basic: 20000, hra: 0, allowances: 0 }, attendance: summary(), settings: esi }).deductions.esi, 150);
  assert.equal(computePayslip({ ...NOV, salary: { basic: 25000, hra: 0, allowances: 0 }, attendance: summary(), settings: esi }).deductions.esi, 0);
});

test("professional tax: slab lookup and explicit override", () => {
  const slabs = PAYROLL_DEFAULTS.professionalTax.slabs;
  assert.equal(professionalTaxForSlab(slabs, toPaise(5999)), 0);
  assert.equal(professionalTaxForSlab(slabs, toPaise(6000)), toPaise(80));
  assert.equal(professionalTaxForSlab(slabs, toPaise(12000)), toPaise(200));
  assert.equal(professionalTaxForSlab(slabs, toPaise(999999)), toPaise(200));
  const p = computePayslip({ ...NOV, salary: { basic: 30000, hra: 0, allowances: 0 }, attendance: summary(), settings: settings({ professionalTax: { enabled: true } }) });
  assert.equal(p.deductions.professionalTax, 200);
  const o = computePayslip({ ...NOV, salary: { basic: 30000, hra: 0, allowances: 0 }, attendance: summary(), settings: settings(), adjustments: { professionalTax: 175 } });
  assert.equal(o.deductions.professionalTax, 175);
});

test("bonus, other earnings, TDS, recurring + one-off deductions all flow into net pay", () => {
  const p = computePayslip({
    ...NOV, salary: { basic: 30000, hra: 0, allowances: 0 }, attendance: summary(), settings: settings(),
    adjustments: { bonus: 2000, tds: 1500, otherEarnings: [{ label: "Travel", amount: 500 }, { label: "", amount: 99 }], otherDeductions: [{ label: "Advance recovery", amount: 1000 }] },
    recurringDeductions: [{ label: "Recurring deduction", amount: 250 }],
  });
  assert.equal(p.earnings.total, 32500); assert.equal(p.deductions.total, 2750); assert.equal(p.netPay, 29750);
  assert.equal(p.deductions.otherDeductions.length, 2); assert.equal(p.earnings.otherEarnings.length, 1);
});

test("line items always sum to totals (no floating point drift)", () => {
  const s = summary({ attendanceByKey: fullAttendance({ "2026-11-03": null, "2026-11-04": row(5), "2026-11-05": row(10.7) }) });
  const p = computePayslip({ ...NOV, salary: { basic: 12345.67, hra: 4321.09, allowances: 777.77 }, attendance: s, settings: settings({ pf: { enabled: true }, professionalTax: { enabled: true } }), adjustments: { tds: 333.33, bonus: 99.99 } });
  const e = p.earnings, d = p.deductions;
  assert.equal(toPaise(e.basic) + toPaise(e.hra) + toPaise(e.allowances) + toPaise(e.overtime) + toPaise(e.bonus), toPaise(e.total));
  assert.equal(toPaise(d.lop) + toPaise(d.pf) + toPaise(d.esi) + toPaise(d.professionalTax) + toPaise(d.tds), toPaise(d.total));
  assert.equal(toPaise(e.total) - toPaise(d.total), toPaise(p.netPay));
});

test("net pay never goes negative; shortfall is reported", () => {
  const p = computePayslip({ ...NOV, salary: { basic: 1000, hra: 0, allowances: 0 }, attendance: summary(), settings: settings(), adjustments: { tds: 5000 } });
  assert.equal(p.netPay, 0); assert.equal(p.shortfall, 4000); assert.ok(p.warnings.some((w) => /exceed earnings/.test(w)));
});

test("manual payslip is exactly basic + allowances - deductions, with no automatic statutory deductions", () => {
  const p = computeManualPayslip({ ...NOV, basicSalary: 50000, allowances: 5000, deductions: 2000, settings: settings({ pf: { enabled: true }, professionalTax: { enabled: true } }) });
  assert.equal(p.netPay, 53000); assert.equal(p.deductions.pf, 0); assert.equal(p.deductions.professionalTax, 0);
  assert.equal(p.legacy.basicSalary, 50000); assert.equal(p.legacy.allowances, 5000); assert.equal(p.legacy.deductions, 2000); assert.equal(p.legacy.netSalary, 53000);
});

test("salary resolution: single structure, mid-month revision, legacy fallback, none", () => {
  const one = resolveSalaryForPeriod([{ effectiveFromKey: "2026-01-01", basic: 20000, hra: 5000, allowances: 5000 }], NOV);
  assert.equal(one.gross, 30000); assert.equal(one.source, "STRUCTURE"); assert.equal(one.segments.length, 0);
  // revision effective Nov 16: 15 days at 30000, 15 days at 60000 => 45000
  const mixed = resolveSalaryForPeriod([
    { effectiveFromKey: "2026-01-01", basic: 30000, hra: 0, allowances: 0 },
    { effectiveFromKey: "2026-11-16", basic: 60000, hra: 0, allowances: 0 },
  ], NOV);
  assert.equal(mixed.basic, 45000); assert.equal(mixed.segments.length, 2); assert.equal(mixed.segments[1].days, 15);
  // superseded (inactive) structures still count for back-dated payroll
  const back = resolveSalaryForPeriod([
    { effectiveFromKey: "2026-01-01", basic: 30000, hra: 0, allowances: 0 },
    { effectiveFromKey: "2026-11-16", basic: 60000, hra: 0, allowances: 0 },
  ], { year: 2026, month: 6 });
  assert.equal(back.basic, 30000);
  const legacy = resolveSalaryForPeriod([], NOV, { basic: 18000, hra: 0, allowances: 2000 });
  assert.equal(legacy.gross, 20000); assert.equal(legacy.source, "LEGACY");
  assert.equal(resolveSalaryForPeriod([], NOV, null).source, "NONE");
});

test("settings: defaults merge, validation catches bad input", () => {
  const merged = mergeSettings({ pf: { enabled: true } });
  assert.equal(merged.pf.enabled, true); assert.equal(merged.pf.wageCeiling, 15000); assert.deepEqual(merged.weeklyOffDays, [0]);
  assert.deepEqual(validateSettingsInput({ weeklyOffDays: [0] }).weeklyOffDays, [0]);
  assert.throws(() => validateSettingsInput({ weeklyOffDays: [0, 1, 2, 3, 4, 5, 6] }), /working day/);
  assert.throws(() => validateSettingsInput({ weeklyOffDays: [9] }), /between 0/);
  assert.throws(() => validateSettingsInput({ payDaysBasis: "WEEKLY" }), /CALENDAR or WORKING/);
  assert.throws(() => validateSettingsInput({ pf: { employeeRate: 120 } }), /PF employee rate/);
  assert.throws(() => validateSettingsInput({ professionalTax: { slabs: [{ from: 0, to: 100, amount: 1 }, { from: 50, to: 200, amount: 2 }] } }), /overlap/);
});

test("settings: an explicitly empty list is respected, not replaced by defaults", () => {
  assert.deepEqual(mergeSettings({ weeklyOffDays: [] }).weeklyOffDays, []);
  assert.deepEqual(validateSettingsInput({ weeklyOffDays: [] }).weeklyOffDays, []);
  assert.deepEqual(validateSettingsInput({ professionalTax: { enabled: true, slabs: [] } }).professionalTax.slabs, []);
  assert.deepEqual(mergeSettings({}).weeklyOffDays, [0]);
});
