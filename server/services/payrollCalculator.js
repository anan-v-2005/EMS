export function calculatePayroll({ gross, basic = 0, daysInMonth, lopDays = 0, overtimeHours = 0, overtimeRate = 0, professionalTax = 0, tds = 0, otherDeductions = 0, bonus = 0, pfRate = 0, pfAmount = null }) {
  for (const [key, value] of Object.entries({ gross, basic, daysInMonth, lopDays, overtimeHours, overtimeRate, professionalTax, tds, otherDeductions, bonus, pfRate, ...(pfAmount === null ? {} : { pfAmount }) })) if (!Number.isFinite(Number(value)) || Number(value) < 0) throw new Error(`Invalid ${key}`);
  if (!daysInMonth) throw new Error("daysInMonth must be greater than zero");
  const perDay = gross / daysInMonth; const lop = Math.round(lopDays * perDay * 100) / 100;
  const pf = pfAmount === null ? Math.round(basic * Number(pfRate) * 100) / 100 : Math.round(Number(pfAmount) * 100) / 100;
  const overtimePay = Math.round(overtimeHours * overtimeRate * 100) / 100;
  const deductions = { lop, pf, professionalTax: Number(professionalTax), tds: Number(tds), other: Number(otherDeductions) };
  const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0);
  const netPay = Math.max(0, Math.round((gross - totalDeductions + overtimePay + bonus) * 100) / 100);
  return { perDaySalary: Math.round(perDay * 100) / 100, deductions, overtimePay, bonus: Number(bonus), netPay };
}
