// =====================================================================================
// PAYROLL ENGINE - pure functions only (no database, no clock, no environment).
// Everything the payslip needs is passed in, which makes every rule below unit-testable.
//
// Money is calculated in integer paise internally and exposed as rupees with 2 decimals,
// so line items always add up to the totals shown on the payslip.
// =====================================================================================

// ---------- number helpers ----------
export const toPaise = (n) => Math.round((Number(n) + Number.EPSILON) * 100) || 0;
export const fromPaise = (p) => Math.round(p) / 100;
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100 || 0;
const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const nonNeg = (v) => Math.max(0, num(v));

// ---------- calendar helpers (timezone-free: operate on YYYY-MM-DD keys) ----------
const pad = (n) => String(n).padStart(2, "0");
export const dateKey = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;
export const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();
export const weekdayOfKey = (key) => new Date(`${key}T00:00:00Z`).getUTCDay();
export const addDaysToKey = (key, days) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
export function* eachKey(startKey, endKey) {
  for (let k = startKey; k <= endKey; k = addDaysToKey(k, 1)) yield k;
}
export const isWorkingDay = (key, weeklyOffDays, offHolidayKeys) =>
  !weeklyOffDays.includes(weekdayOfKey(key)) && !offHolidayKeys.has(key);

// =====================================================================================
// SALARY RESOLUTION
// Salary structures are time-ranged (effectiveFrom). If a revision happens mid-month, each
// day of that month is paid at the structure that was in force on that day.
// structures: [{ effectiveFromKey, basic, hra, allowances }]   fallback: {basic,hra,allowances}|null
// =====================================================================================
export function resolveSalaryForPeriod(structures, { year, month }, fallback = null) {
  const sorted = [...(structures || [])].sort((a, b) => a.effectiveFromKey.localeCompare(b.effectiveFromKey));
  const days = daysInMonth(year, month);
  const segments = [];
  let sources = new Set();
  for (let d = 1; d <= days; d++) {
    const key = dateKey(year, month, d);
    let active = null;
    for (const s of sorted) if (s.effectiveFromKey <= key) active = s; else break;
    const source = active ? "STRUCTURE" : fallback ? "LEGACY" : "NONE";
    sources.add(source);
    const comp = active || fallback || { basic: 0, hra: 0, allowances: 0 };
    const sig = `${source}|${comp.basic}|${comp.hra}|${comp.allowances}`;
    const last = segments[segments.length - 1];
    if (last && last.sig === sig) { last.to = key; last.days++; }
    else segments.push({ sig, source, from: key, to: key, days: 1, basic: nonNeg(comp.basic), hra: nonNeg(comp.hra), allowances: nonNeg(comp.allowances) });
  }
  const weighted = (field) => fromPaise(segments.reduce((sum, s) => sum + toPaise(s[field]) * s.days, 0) / days);
  const basic = round2(weighted("basic")), hra = round2(weighted("hra")), allowances = round2(weighted("allowances"));
  const source = sources.size === 1 ? [...sources][0] : "MIXED";
  return {
    basic, hra, allowances,
    gross: fromPaise(toPaise(basic) + toPaise(hra) + toPaise(allowances)),
    source,
    segments: segments.length > 1 ? segments.map(({ sig, ...rest }) => rest) : [],
  };
}

// =====================================================================================
// ATTENDANCE SUMMARY
//   attendanceByKey : Map<dateKey, {status, workingHours, checkIn, checkOut, needsReview}>
//   leaves          : [{startKey,endKey,type,requestedDays,paidDays,lopDays}] (APPROVED only)
//   offHolidayKeys  : Set<dateKey> of company-wide holidays (OPTIONAL holidays excluded upstream)
//   joinKey         : employee join date key (days before it are unpaid, not "absent")
//   asOfKey         : last day (inclusive) to evaluate; later days are "pending" (month in progress)
// =====================================================================================
const LEAVE_KEY = { SICK: "sick", CASUAL: "casual", EMERGENCY: "emergency", ANNUAL: "annual" };

export function summarizeAttendance({
  year, month, joinKey = null, attendanceByKey = new Map(), leaves = [], offHolidayKeys = new Set(),
  weeklyOffDays = [0, 6], thresholds = {}, asOfKey = null,
}) {
  const { fullDayHours = 8, halfDayHours = 4, overtimeAfterHours = 9 } = thresholds;
  const total = daysInMonth(year, month);
  const startKey = dateKey(year, month, 1), lastKey = dateKey(year, month, total);
  const evalUntil = asOfKey && asOfKey < lastKey ? asOfKey : lastKey;

  // Spread each approved leave over its working days (across month boundaries) so that the
  // paid/LOP split of a long leave is attributed day by day, in order.
  const leaveByKey = new Map();
  for (const leave of leaves) {
    const workdays = [];
    for (const k of eachKey(leave.startKey, leave.endKey)) if (isWorkingDay(k, weeklyOffDays, offHolidayKeys)) workdays.push(k);
    const requested = num(leave.requestedDays, workdays.length);
    let reqLeft = requested;
    let paidLeft = num(leave.paidDays, requested);
    let lopLeft = num(leave.lopDays, Math.max(0, requested - paidLeft));
    for (const k of workdays) {
      const part = Math.min(1, Math.max(0, reqLeft)); reqLeft = Math.max(0, reqLeft - part);
      const paid = Math.min(part, Math.max(0, paidLeft)); paidLeft = Math.max(0, paidLeft - paid);
      const lop = Math.min(part - paid, Math.max(0, lopLeft)); lopLeft = Math.max(0, lopLeft - lop);
      if (k >= startKey && k <= lastKey) leaveByKey.set(k, { paid, lop, requested: part, type: leave.type });
    }
  }

  const out = {
    calendarDays: total, workingDays: 0, monthWorkingDays: 0, evaluatedDays: 0, pendingDays: 0,
    present: 0, halfDays: 0, paidLeaves: 0,
    paidLeaveBreakdown: { sick: 0, casual: 0, emergency: 0, annual: 0 },
    lopDays: 0, lateMarks: 0, overtimeHours: 0,
    weeklyOffs: 0, holidays: 0, preJoinDays: 0, preJoinWorkingDays: 0,
    openSessions: 0, reviewFlags: 0, workedOnOffDays: 0,
  };

  for (let day = 1; day <= total; day++) {
    const key = dateKey(year, month, day);
    const working = isWorkingDay(key, weeklyOffDays, offHolidayKeys);
    if (working) out.monthWorkingDays++;
    const row = attendanceByKey.get(key);
    if (row?.needsReview) out.reviewFlags++;

    if (joinKey && key < joinKey) {            // not yet employed
      out.preJoinDays++;
      if (working) out.preJoinWorkingDays++;
      continue;
    }
    if (!working) {                            // weekly off / holiday: paid, never LOP
      if (weeklyOffDays.includes(weekdayOfKey(key))) out.weeklyOffs++; else out.holidays++;
      if (row && key <= evalUntil) out.workedOnOffDays++;
      continue;
    }
    out.workingDays++;
    if (key > evalUntil) { out.pendingDays++; continue; }
    out.evaluatedDays++;

    const leave = leaveByKey.get(key);
    if (leave) {
      out.paidLeaves += leave.paid; out.lopDays += leave.lop;
      const bucket = LEAVE_KEY[leave.type];
      if (bucket) out.paidLeaveBreakdown[bucket] += leave.paid;
      const rest = Math.max(0, 1 - leave.requested);        // part of the day not covered by leave
      if (rest > 0) {
        if (row) { out.present += rest; if (row.status === "LATE") out.lateMarks++; out.overtimeHours += Math.max(0, num(row.workingHours) - overtimeAfterHours); }
        else out.lopDays += rest;
      }
      continue;
    }
    if (!row) { out.lopDays += 1; continue; }
    if (row.status === "LATE") out.lateMarks++;
    const hasHours = row.workingHours !== null && row.workingHours !== undefined && Number.isFinite(Number(row.workingHours));
    if (!hasHours) {                                        // still checked-in: benefit of the doubt, flag it
      out.openSessions++; out.present += 1; continue;
    }
    const hours = Number(row.workingHours);
    if (hours >= fullDayHours) out.present += 1;
    else if (hours >= halfDayHours) { out.present += 0.5; out.halfDays++; out.lopDays += 0.5; }
    else out.lopDays += 1;
    out.overtimeHours += Math.max(0, hours - overtimeAfterHours);
  }
  for (const k of ["present", "paidLeaves", "lopDays", "overtimeHours"]) out[k] = round2(out[k]);
  for (const k of Object.keys(out.paidLeaveBreakdown)) out.paidLeaveBreakdown[k] = round2(out.paidLeaveBreakdown[k]);
  return out;
}

// =====================================================================================
// PAYSLIP COMPUTATION
// =====================================================================================
const cleanItems = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((i) => ({ label: String(i?.label ?? "").trim().slice(0, 80), amount: round2(nonNeg(i?.amount)) }))
    .filter((i) => i.label && i.amount > 0);
const sumItems = (items) => items.reduce((s, i) => s + toPaise(i.amount), 0);

export function professionalTaxForSlab(slabs, monthlyWagesPaise) {
  const wages = monthlyWagesPaise / 100;
  const slab = [...(slabs || [])].sort((a, b) => a.from - b.from).filter((s) => wages >= s.from && (s.to === null || wages <= s.to)).pop();
  return slab ? toPaise(slab.amount) : 0;
}

export function computePayslip({
  year, month, mode = "AUTO", salary, attendance = null, settings,
  adjustments = {}, recurringDeductions = [],
}) {
  if (!settings) throw new Error("Payroll settings are required");
  const warnings = [];
  const total = daysInMonth(year, month);
  const basicP = toPaise(nonNeg(salary?.basic)), hraP = toPaise(nonNeg(salary?.hra)), allowP = toPaise(nonNeg(salary?.allowances));
  const grossP = basicP + hraP + allowP;
  if (grossP === 0) warnings.push("Monthly gross salary is zero. Add a salary structure for this employee.");

  // ----- pay days / loss of pay -----
  const working = settings.payDaysBasis === "WORKING" && attendance?.monthWorkingDays > 0;
  const divisor = working ? attendance.monthWorkingDays : total;
  let lopDays = 0, preJoin = 0, latePenalty = 0;
  if (attendance && mode === "AUTO") {
    lopDays = num(attendance.lopDays);
    preJoin = working ? num(attendance.preJoinWorkingDays) : num(attendance.preJoinDays);
    const perHalf = num(settings.lateMarks?.perHalfDay);
    latePenalty = perHalf > 0 ? Math.floor(num(attendance.lateMarks) / perHalf) * 0.5 : 0;
  }
  const unpaidDays = Math.min(divisor, round2(lopDays + preJoin + latePenalty));
  const perDayP = grossP / divisor;
  const lopP = Math.min(grossP, Math.round(perDayP * unpaidDays));
  const earnedGrossP = grossP - lopP;
  const earnedBasicP = grossP > 0 ? Math.round((basicP * earnedGrossP) / grossP) : 0;

  // ----- overtime -----
  const otHours = attendance && mode === "AUTO" && settings.overtime?.enabled ? num(attendance.overtimeHours) : 0;
  const overrideRate = nonNeg(adjustments.overtimeRate);
  const hourlyP = overrideRate > 0 ? toPaise(overrideRate)
    : Math.round((perDayP / num(settings.standardDayHours, 8)) * num(settings.overtime?.multiplier, 1.5));
  const otP = Math.round(otHours * hourlyP);

  // ----- other earnings -----
  const bonusP = toPaise(nonNeg(adjustments.bonus));
  const otherEarnings = cleanItems(adjustments.otherEarnings);
  const otherEarnP = sumItems(otherEarnings);
  const earningsTotalP = grossP + otP + bonusP + otherEarnP;

  // ----- statutory (automatic only in AUTO mode; MANUAL means "exactly what was typed") -----
  let pfP = 0, pfErP = 0, esiP = 0, esiErP = 0;
  if (mode === "AUTO") {
    if (settings.pf?.enabled) {
      const ceilingP = toPaise(settings.pf.wageCeiling);
      const baseP = ceilingP > 0 ? Math.min(earnedBasicP, ceilingP) : earnedBasicP;
      pfP = Math.round((baseP * num(settings.pf.employeeRate)) / 100);
      pfErP = Math.round((baseP * num(settings.pf.employerRate)) / 100);
    }
    if (settings.esi?.enabled) {
      const ceilingP = toPaise(settings.esi.grossCeiling);
      if (ceilingP === 0 || grossP <= ceilingP) {
        const wagesP = earnedGrossP + otP;
        esiP = Math.round((wagesP * num(settings.esi.employeeRate)) / 100);
        esiErP = Math.round((wagesP * num(settings.esi.employerRate)) / 100);
      }
    }
  }
  const ptOverride = adjustments.professionalTax;
  const hasPtOverride = ptOverride !== null && ptOverride !== undefined && ptOverride !== "";
  let ptP = 0;
  if (hasPtOverride) ptP = toPaise(nonNeg(ptOverride));
  else if (mode === "AUTO" && settings.professionalTax?.enabled) ptP = professionalTaxForSlab(settings.professionalTax.slabs, earnedGrossP + otP + bonusP + otherEarnP);

  const tdsP = toPaise(nonNeg(adjustments.tds));
  const otherDeductions = [...cleanItems(recurringDeductions), ...cleanItems(adjustments.otherDeductions)];
  const otherDedP = sumItems(otherDeductions);
  const deductionsTotalP = lopP + pfP + esiP + ptP + tdsP + otherDedP;

  // ----- net pay -----
  let netP = earningsTotalP - deductionsTotalP, shortfallP = 0;
  if (netP < 0) {
    shortfallP = -netP; netP = 0;
    warnings.push(`Deductions exceed earnings by ₹${fromPaise(shortfallP).toFixed(2)}; net pay has been set to ₹0.00. Review the deductions before finalizing.`);
  }

  // ----- warnings from attendance -----
  if (attendance && mode === "AUTO") {
    if (attendance.pendingDays > 0) warnings.push(`${attendance.pendingDays} working day(s) of this month have not happened yet and are assumed paid. Regenerate after month end.`);
    if (attendance.openSessions > 0) warnings.push(`${attendance.openSessions} attendance record(s) have no check-out and were counted as present.`);
    if (attendance.reviewFlags > 0) warnings.push(`${attendance.reviewFlags} attendance record(s) were auto-closed and still await review.`);
    if (attendance.workedOnOffDays > 0) warnings.push(`Attendance exists on ${attendance.workedOnOffDays} weekly-off/holiday date(s); these days are not paid extra.`);
    if (latePenalty > 0) warnings.push(`${latePenalty} day(s) deducted for ${attendance.lateMarks} late mark(s).`);
  }

  const items = (list) => list.map((i) => ({ label: i.label, amount: i.amount }));
  const earnings = {
    basic: fromPaise(basicP), hra: fromPaise(hraP), allowances: fromPaise(allowP),
    overtime: fromPaise(otP), bonus: fromPaise(bonusP), otherEarnings: items(otherEarnings), total: fromPaise(earningsTotalP),
  };
  const deductions = {
    lop: fromPaise(lopP), pf: fromPaise(pfP), esi: fromPaise(esiP), professionalTax: fromPaise(ptP), tds: fromPaise(tdsP),
    otherDeductions: items(otherDeductions), total: fromPaise(deductionsTotalP),
  };
  return {
    salary: { basic: earnings.basic, hra: earnings.hra, allowances: earnings.allowances, gross: fromPaise(grossP) },
    attendance: attendance ? {
      ...attendance,
      latePenaltyDays: latePenalty, unpaidDays, payableDays: round2(divisor - unpaidDays), payDaysDivisor: divisor,
      perDaySalary: fromPaise(Math.round(perDayP)), overtimeRate: fromPaise(hourlyP),
    } : null,
    earnings, deductions,
    employer: { pf: fromPaise(pfErP), esi: fromPaise(esiErP) },
    netPay: fromPaise(netP), shortfall: fromPaise(shortfallP), warnings,
    // Values for the legacy Payslip fields so older screens/analytics keep working:
    // basicSalary + allowances - deductions = netSalary (when net pay is not clamped).
    legacy: {
      basicSalary: earnings.basic,
      allowances: fromPaise(earningsTotalP - basicP),
      deductions: deductions.total,
      netSalary: fromPaise(netP),
    },
  };
}

// Manual payslips (no attendance): same shape, no automatic LOP or statutory deductions.
export function computeManualPayslip({ year, month, basicSalary, allowances = 0, deductions = 0, adjustments = {}, settings }) {
  return computePayslip({
    year, month, mode: "MANUAL", settings,
    salary: { basic: basicSalary, hra: 0, allowances },
    adjustments,
    recurringDeductions: Number(deductions) > 0 ? [{ label: "Deductions", amount: Number(deductions) }] : [],
  });
}
