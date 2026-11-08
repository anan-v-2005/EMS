import { leavePolicy } from "../config/leavePolicy.js";

const TYPES = ["sick", "casual", "emergency", "annual"];
const round05 = (n) => Math.round(n * 2) / 2;
const istYear = (date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric" }).format(date));
const istMonth = (date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", month: "numeric" }).format(date)); // 1-12

// Fraction of the year an employee is eligible for: 1 for everyone except people who joined in `year`
// (joining in November -> 2/12, counting the joining month).
export function eligibleFraction(joinDate, year) {
  if (!leavePolicy.prorateNewJoiners || !joinDate) return 1;
  const joined = new Date(joinDate);
  if (!Number.isFinite(joined.getTime())) return 1;
  const joinYear = istYear(joined);
  if (joinYear < year) return 1;
  if (joinYear > year) return 0;
  return (13 - istMonth(joined)) / 12;
}

// Builds the balances object for a new LeaveBalance document.
// `carried` is { annual: 2 } style extra days brought forward from the previous year.
export function buildBalances({ joinDate, year, carried = {} } = {}) {
  const fraction = eligibleFraction(joinDate, year);
  const out = {};
  for (const type of TYPES) {
    const base = fraction >= 1 ? leavePolicy[type] : round05(leavePolicy[type] * fraction);
    const extra = Math.max(0, Number(carried[type] || 0));
    const total = base + extra;
    out[type] = { total, used: 0, pending: 0, remaining: total };
  }
  return out;
}

// How many unused days move to the next year, per type, according to the carry-forward policy.
export function computeCarryForward(previousBalances) {
  const cfg = leavePolicy.carryForward;
  if (!cfg?.enabled || !previousBalances) return {};
  const carried = {};
  for (const type of cfg.types || []) {
    const remaining = Number(previousBalances[type]?.remaining || 0);
    const days = Math.min(Math.max(0, remaining), Number(cfg.maxDays || 0));
    if (days > 0) carried[type] = days;
  }
  return carried;
}
