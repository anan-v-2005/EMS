import test from "node:test";
import assert from "node:assert/strict";
import { calculatePayroll } from "../services/payrollCalculator.js";
import { calculateAttendance } from "../services/attendanceMath.js";

test("payroll calculates expected 3.5 LOP days on a 30-day gross of 30000", () => {
 const result = calculatePayroll({ gross: 30000, basic: 15000, daysInMonth: 30, lopDays: 3.5 });
 assert.equal(result.perDaySalary, 1000); assert.equal(result.deductions.lop, 3500); assert.equal(result.deductions.pf, 0); assert.equal(result.netPay, 26500);
});
test("payroll never returns negative net pay", () => {
 const result = calculatePayroll({ gross: 100, basic: 100, daysInMonth: 30, lopDays: 40 }); assert.equal(result.netPay, 0);
});
test("attendance checkout calculates work hours and review flags", () => {
 const result = calculateAttendance("2026-10-24T04:00:00Z", "2026-10-24T12:30:00Z", { automatic: true });
 assert.equal(result.workingHours, 8.5); assert.equal(result.dayType, "Full Day"); assert.equal(result.needsReview, true);
});
test("attendance rejects invalid timestamps", () => { assert.throws(() => calculateAttendance("bad", new Date())); });

test("payroll applies provident-fund deduction only when explicitly configured", () => {
 const result = calculatePayroll({ gross: 30000, basic: 15000, daysInMonth: 30, pfRate: 0.12 });
 assert.equal(result.deductions.pf, 1800);
});
