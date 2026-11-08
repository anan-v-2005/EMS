// Pure helpers (no database access) so they can be unit-tested.
import { PAYROLL_DEFAULTS } from "../config/payrollDefaults.js";

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

export function mergeSettings(stored = {}, defaults = PAYROLL_DEFAULTS) {
  const out = {};
  for (const [key, def] of Object.entries(defaults)) {
    const value = stored?.[key];
    if (isObj(def)) out[key] = mergeSettings(isObj(value) ? value : {}, def);
    else if (Array.isArray(def)) out[key] = JSON.parse(JSON.stringify(Array.isArray(value) ? value : def)); // an explicitly empty list is a valid choice
    else out[key] = value === undefined || value === null ? def : value;
  }
  return out;
}

const num = (v, label, { min = 0, max = Infinity } = {}) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} must be a number between ${min} and ${max === Infinity ? "∞" : max}`);
  return n;
};

// Validates an admin-supplied settings payload and returns a clean object. Throws Error with a
// human-readable message on the first problem.
export function validateSettingsInput(body = {}) {
  const input = mergeSettings(body);
  const out = {};
  out.companyName = String(input.companyName || "").trim().slice(0, 160) || PAYROLL_DEFAULTS.companyName;
  out.companyAddress = String(input.companyAddress || "").trim().slice(0, 400);
  if (!["CALENDAR", "WORKING"].includes(input.payDaysBasis)) throw new Error("Pay-days basis must be CALENDAR or WORKING");
  out.payDaysBasis = input.payDaysBasis;
  const offs = [...new Set((input.weeklyOffDays || []).map(Number))];
  if (offs.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error("Weekly off days must be between 0 (Sunday) and 6 (Saturday)");
  if (offs.length >= 7) throw new Error("At least one working day per week is required"); // zero weekly offs (7-day week) is allowed
  out.weeklyOffDays = offs.sort((a, b) => a - b);
  out.standardDayHours = num(input.standardDayHours, "Standard day hours", { min: 1, max: 24 });
  out.overtime = {
    enabled: Boolean(input.overtime.enabled),
    afterHours: num(input.overtime.afterHours, "Overtime threshold (hours)", { min: 1, max: 24 }),
    multiplier: num(input.overtime.multiplier, "Overtime multiplier", { min: 1, max: 5 }),
  };
  out.lateMarks = { perHalfDay: Math.floor(num(input.lateMarks.perHalfDay, "Late marks per half-day", { min: 0, max: 31 })) };
  out.pf = {
    enabled: Boolean(input.pf.enabled),
    employeeRate: num(input.pf.employeeRate, "PF employee rate", { max: 100 }),
    employerRate: num(input.pf.employerRate, "PF employer rate", { max: 100 }),
    wageCeiling: num(input.pf.wageCeiling, "PF wage ceiling"),
  };
  out.esi = {
    enabled: Boolean(input.esi.enabled),
    employeeRate: num(input.esi.employeeRate, "ESI employee rate", { max: 100 }),
    employerRate: num(input.esi.employerRate, "ESI employer rate", { max: 100 }),
    grossCeiling: num(input.esi.grossCeiling, "ESI gross ceiling"),
  };
  const slabs = (input.professionalTax.slabs || []).map((s) => ({
    from: num(s.from, "Professional tax slab start"),
    to: s.to === null || s.to === "" || s.to === undefined ? null : num(s.to, "Professional tax slab end"),
    amount: num(s.amount, "Professional tax amount"),
  })).sort((a, b) => a.from - b.from);
  for (let i = 0; i < slabs.length; i++) {
    if (slabs[i].to !== null && slabs[i].to < slabs[i].from) throw new Error("Professional tax slab end must not be below its start");
    if (i > 0 && (slabs[i - 1].to === null || slabs[i].from <= slabs[i - 1].to)) throw new Error("Professional tax slabs must not overlap");
  }
  out.professionalTax = { enabled: Boolean(input.professionalTax.enabled), slabs };
  return out;
}
