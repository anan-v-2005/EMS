export const leavePolicy = Object.freeze({
  sick: 7,
  casual: 7,
  emergency: 3,
  annual: 3,
  total: 20,
  // Unused days carried into the next year when balances reset on 1 January.
  carryForward: Object.freeze({ enabled: true, maxDays: 3, types: Object.freeze(["annual"]) }),
  // Minimum calendar days of notice per leave type (0 / missing = none; sick & emergency are exempt).
  minNoticeDays: Object.freeze({ CASUAL: 1, ANNUAL: 3 }),
  // Employees who join mid-year get a pro-rata allocation (rounded to half days).
  prorateNewJoiners: true,
});
if (leavePolicy.sick + leavePolicy.casual + leavePolicy.emergency + leavePolicy.annual !== 20) throw new Error("Leave policy must total exactly 20 days");
