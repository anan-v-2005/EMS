// Pure salary rules (no database access) so they can be unit-tested.
// A "structure" here is { effectiveFrom: Date|string, basic, hra, allowances }.

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const IST_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const toKey = (d) => IST_DAY.format(new Date(d)); // YYYY-MM-DD in Asia/Kolkata

// Structure in force on `asOf` = latest effectiveFrom that is not after asOf (same rule payroll uses).
export const pickCurrent = (structures, asOf = new Date()) => {
  const asOfKey = toKey(asOf);
  let current = null;
  for (const s of [...structures].sort(
    (a, b) => new Date(a.effectiveFrom) - new Date(b.effectiveFrom),
  )) {
    if (toKey(s.effectiveFrom) <= asOfKey) current = s;
  }
  return current;
};

// Decides what to do when the Employee form submits Basic salary + Allowances.
//   returns { action: "none" }                         nothing to store / nothing changed
//           { action: "update", target, fields }       overwrite the structure that starts on the same day
//           { action: "create", fields, effectiveKey } add a new structure
export const planSalaryChange = ({
  structures,
  basic,
  allowance,
  effectiveKey,
  asOf = new Date(),
}) => {
  basic = round2(basic);
  allowance = round2(allowance);
  const current = pickCurrent(structures, asOf);
  if (!current && basic + allowance <= 0) return { action: "none" };
  if (
    current &&
    round2(current.basic) === basic &&
    round2((current.hra || 0) + (current.allowances || 0)) === allowance
  )
    return { action: "none", current };

  // Keep the existing HRA/allowance split where it still fits inside the new allowance total.
  const hra =
    current && (current.hra || 0) <= allowance ? round2(current.hra || 0) : 0;
  const allowances = round2(allowance - hra);
  const fields = {
    basic,
    hra,
    allowances,
    fixedMonthlyGross: round2(basic + hra + allowances),
    isActive: true,
  };
  const target = structures.find(
    (s) => toKey(s.effectiveFrom) === effectiveKey,
  );
  return target
    ? { action: "update", target, fields }
    : { action: "create", fields, effectiveKey };
};
