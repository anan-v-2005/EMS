export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (m) => MONTHS[(Number(m) || 1) - 1] || "";
export const periodLabel = (m, y) => `${monthName(m)} ${y}`;

export const money = (v) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(v || 0));

export const formatDate = (v) =>
  v ? new Date(v).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "—";

// True once the whole month is in the past (UI hint only - the server makes the final decision).
export const isMonthOver = (month, year) => new Date(Number(year), Number(month), 1) <= new Date();

const ones = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const underHundred = (n) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`);
const underThousand = (n) => {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? `${ones[h]} Hundred` : "", r ? underHundred(r) : ""].filter(Boolean).join(" ");
};

export function amountInWords(value) {
  const total = Math.max(0, Math.round((Number(value) || 0) * 100));
  let rupees = Math.floor(total / 100);
  const paise = total % 100;
  if (rupees === 0 && paise === 0) return "Zero Rupees Only";
  const parts = [];
  for (const [unit, size] of [["Crore", 10000000], ["Lakh", 100000], ["Thousand", 1000]]) {
    if (rupees >= size) { parts.push(`${underThousand(Math.floor(rupees / size))} ${unit}`); rupees %= size; }
  }
  if (rupees > 0) parts.push(underThousand(rupees));
  const rupeeCount = Math.floor(total / 100);
  let text = parts.length ? `${parts.join(" ")} ${rupeeCount === 1 ? "Rupee" : "Rupees"}` : "";
  if (paise) text += `${text ? " and " : ""}${underHundred(paise)} Paise`;
  return `${text} Only`;
}

// [label, amount] rows for a payslip's earnings / deductions (zero lines are hidden, except the first earning).
export const earningRows = (e = {}) =>
  [["Basic salary", e.basic], ["House rent allowance (HRA)", e.hra], ["Other allowances", e.allowances],
    ["Overtime", e.overtime], ["Bonus", e.bonus], ...(e.otherEarnings || []).map((i) => [i.label, i.amount])]
    .filter(([, v], i) => i === 0 || Number(v) > 0);

export const deductionRows = (d = {}) =>
  [["Loss of pay (LOP)", d.lop], ["Provident fund (PF)", d.pf], ["ESI", d.esi], ["Professional tax", d.professionalTax],
    ["TDS", d.tds], ...(d.otherDeductions || []).map((i) => [i.label, i.amount])]
    .filter(([, v]) => Number(v) > 0);

export const errorText = (error, fallback) => error?.response?.data?.error || error?.response?.data?.message || error?.message || fallback;
