// Organisation-level payroll defaults. Every value can be overridden by an administrator
// from Payslips → Payroll settings; the stored document is merged over these defaults.
//
// Statutory features (PF / ESI / Professional Tax) are DISABLED by default because the
// correct rates, ceilings and slabs depend on your state, establishment and current law.
// The numbers below are common starting points only - verify them before enabling.
export const PAYROLL_DEFAULTS = Object.freeze({
  companyName: "Employee Management System",
  companyAddress: "",
  // CALENDAR: per-day pay = monthly gross / calendar days in the month (most common).
  // WORKING : per-day pay = monthly gross / working days (excludes weekly offs & holidays).
  payDaysBasis: "CALENDAR",
  // 0 = Sunday ... 6 = Saturday. Used consistently by attendance, leave and payroll.
  weeklyOffDays: [0],
  standardDayHours: 8,
  overtime: { enabled: true, afterHours: 9, multiplier: 1.5 },
  // Every N late marks cost half a day of pay. 0 disables the rule.
  lateMarks: { perHalfDay: 0 },
  pf: { enabled: false, employeeRate: 12, employerRate: 12, wageCeiling: 15000 },
  esi: { enabled: false, employeeRate: 0.75, employerRate: 3.25, grossCeiling: 21000 },
  professionalTax: {
    enabled: false,
    slabs: [
      { from: 0, to: 5999, amount: 0 },
      { from: 6000, to: 8999, amount: 80 },
      { from: 9000, to: 11999, amount: 150 },
      { from: 12000, to: null, amount: 200 },
    ],
  },
});
