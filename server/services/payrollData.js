// Database-facing payroll service: gathers an employee's attendance, leave, holidays and salary
// structures for a month, then hands them to the pure engine (payrollEngine.js).
import Attendance from "../models/Attendance.js";
import LeaveApplication from "../models/LeaveApplication.js";
import Salary from "../models/Salary.js";
import { attendancePolicy } from "../config/attendancePolicy.js";
import { closeOpenAttendance, istDateKey } from "./attendanceSummary.js";
import { getOffHolidayKeys } from "./workPolicy.js";
import {
  addDaysToKey, computeManualPayslip, computePayslip, daysInMonth, dateKey,
  resolveSalaryForPeriod, summarizeAttendance,
} from "./payrollEngine.js";

export class PayrollError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const istStart = (key) => new Date(`${key}T00:00:00+05:30`);

export function periodBounds(year, month) {
  const days = daysInMonth(year, month);
  const startKey = dateKey(year, month, 1), lastKey = dateKey(year, month, days);
  const nextKey = addDaysToKey(lastKey, 1);
  return { days, startKey, lastKey, nextKey, start: istStart(startKey), end: istStart(nextKey) };
}

export function validatePeriod(monthValue, yearValue) {
  const month = Number(monthValue), year = Number(yearValue);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2200) {
    throw new PayrollError("A valid month (1-12) and year are required");
  }
  return { month, year };
}

export function sanitizeAdjustments(raw = {}) {
  const money = (v, label) => {
    if (v === undefined || v === null || v === "") return 0;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new PayrollError(`${label} must be a non-negative number`);
    return n;
  };
  const items = (list, label) => (Array.isArray(list) ? list : []).slice(0, 20).map((i) => {
    const amount = money(i?.amount, `${label} amount`);
    const text = String(i?.label ?? "").trim().slice(0, 80);
    if (amount > 0 && !text) throw new PayrollError(`Every ${label.toLowerCase()} needs a description`);
    return { label: text, amount };
  }).filter((i) => i.label && i.amount > 0);
  const pt = raw.professionalTax;
  return {
    bonus: money(raw.bonus, "Bonus"),
    tds: money(raw.tds, "TDS"),
    overtimeRate: money(raw.overtimeRate, "Overtime rate"),
    professionalTax: pt === undefined || pt === null || pt === "" ? null : money(pt, "Professional tax"),
    otherEarnings: items(raw.otherEarnings, "Other earning"),
    otherDeductions: items(raw.otherDeductions, "Other deduction"),
    note: String(raw.note ?? "").trim().slice(0, 500),
  };
}

// Returns the full calculation for one employee and period. Never writes payroll data.
//   allowEarly - when the month is not over yet, evaluate completed days and assume the rest are paid.
export async function calculateForEmployee({ employee, month, year, mode = "AUTO", settings, adjustments, manual = {}, allowEarly = true }) {
  const adj = sanitizeAdjustments(adjustments);
  const { days, startKey, lastKey, start, end } = periodBounds(year, month);
  const todayKey = istDateKey(new Date());
  if (startKey > todayKey) throw new PayrollError("Payroll cannot be calculated for a future month");
  const monthOver = lastKey < todayKey;

  if (mode === "MANUAL") {
    const basic = Number(manual.basicSalary);
    const allowances = Number(manual.allowances ?? 0), deductions = Number(manual.deductions ?? 0);
    if (!Number.isFinite(basic) || basic < 0 || !Number.isFinite(allowances) || allowances < 0 || !Number.isFinite(deductions) || deductions < 0) {
      throw new PayrollError("Basic salary, allowances and deductions must be non-negative numbers");
    }
    const result = computeManualPayslip({ year, month, basicSalary: basic, allowances, deductions, adjustments: adj, settings });
    return { result, adjustments: adj, monthOver, salarySource: "MANUAL" };
  }

  if (!monthOver && !allowEarly) {
    throw new PayrollError("This month has not ended yet. Tick “Generate early” to calculate completed days and assume the remaining days are paid.");
  }
  const asOfKey = monthOver ? lastKey : addDaysToKey(todayKey, -1);

  // Make sure no past session is still open, so hours are known before they are counted.
  await closeOpenAttendance({ before: new Date(), employeeId: employee._id });

  const [rows, leaveDocs, structures] = await Promise.all([
    Attendance.find({ employeeId: employee._id, date: { $gte: start, $lt: end } })
      .select("date dateKey status workingHours needsReview checkOut").lean(),
    LeaveApplication.find({ employeeId: employee._id, status: "APPROVED", startDate: { $lt: end }, endDate: { $gte: start } }).lean(),
    Salary.find({ employee: employee._id }).sort({ effectiveFrom: 1 }).lean(),
  ]);

  const leaves = leaveDocs.map((l) => ({
    startKey: istDateKey(l.startDate), endKey: istDateKey(l.endDate), type: l.type,
    requestedDays: l.requestedDays, paidDays: l.paidDays, lopDays: l.lopDays,
  }));
  // Holidays must cover the whole span of every leave so day-by-day apportioning is right.
  let from = start, to = end;
  for (const l of leaveDocs) { if (l.startDate < from) from = l.startDate; if (l.endDate >= to) to = new Date(l.endDate.getTime() + 86400000); }
  const offHolidayKeys = await getOffHolidayKeys(from, to);

  const attendanceByKey = new Map(rows.map((r) => [r.dateKey || istDateKey(r.date), r]));
  const legacyBasic = Number(employee.basicSalary || 0), legacyAllow = Number(employee.allowance || 0);
  const salary = resolveSalaryForPeriod(
    structures.map((s) => ({ effectiveFromKey: istDateKey(s.effectiveFrom), basic: s.basic, hra: s.hra, allowances: s.allowances })),
    { year, month },
    legacyBasic + legacyAllow > 0 ? { basic: legacyBasic, hra: 0, allowances: legacyAllow } : null,
  );

  const attendance = summarizeAttendance({
    year, month, joinKey: employee.joinDate ? istDateKey(employee.joinDate) : null,
    attendanceByKey, leaves, offHolidayKeys, weeklyOffDays: settings.weeklyOffDays, asOfKey,
    thresholds: { fullDayHours: attendancePolicy.FULL_DAY_MIN_HOURS, halfDayHours: attendancePolicy.HALF_DAY_MIN_HOURS, overtimeAfterHours: settings.overtime.afterHours },
  });

  const recurring = Number(employee.deductions) > 0 ? [{ label: "Recurring deduction", amount: Number(employee.deductions) }] : [];
  const result = computePayslip({ year, month, mode: "AUTO", salary, attendance, settings, adjustments: adj, recurringDeductions: recurring });
  if (salary.source === "MIXED") result.warnings.push("Salary changed during this month; each day is paid at the structure in force on that day.");
  if (salary.source === "LEGACY") result.warnings.push("No salary structure found; using the salary saved on the employee record.");
  result.salary.source = salary.source;
  result.salary.segments = salary.segments;
  return { result, adjustments: adj, monthOver, salarySource: salary.source, days };
}

// Maps a calculation result onto Payslip document fields.
export function toPayslipFields({ result, adjustments, mode, settings }) {
  return {
    mode,
    basicSalary: result.legacy.basicSalary,
    allowances: result.legacy.allowances,
    deductions: result.legacy.deductions,
    netSalary: result.legacy.netSalary,
    salary: result.salary,
    attendance: result.attendance || undefined,
    breakdown: { earnings: result.earnings, deductions: result.deductions, employer: result.employer },
    shortfall: result.shortfall,
    warnings: result.warnings,
    adjustments,
    policy: {
      payDaysBasis: settings.payDaysBasis, weeklyOffDays: settings.weeklyOffDays, standardDayHours: settings.standardDayHours,
      overtime: settings.overtime, lateMarks: settings.lateMarks,
      pf: settings.pf, esi: settings.esi, professionalTax: { enabled: settings.professionalTax.enabled },
    },
  };
}
