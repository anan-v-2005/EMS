import { MAX_MONTHLY_AMOUNT, PHONE_MAX_DIGITS, PHONE_MIN_DIGITS } from "../constants/limits.js";

export const formatINR = (n) => new Intl.NumberFormat("en-IN").format(n);

// Returns { value } with the cleaned phone number, or { error }.
// Accepts an optional leading "+", digits, spaces, hyphens and brackets; 7-15 digits in total.
export const validatePhone = (raw) => {
  const value = String(raw ?? "").trim();
  if (!value) return { error: "Phone number is required" };
  if (!/^\+?[0-9\s\-()]+$/.test(value)) return { error: "Phone number may contain only digits, spaces, hyphens, brackets and a leading +" };
  const digits = value.replace(/\D/g, "");
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) {
    return { error: `Phone number must have between ${PHONE_MIN_DIGITS} and ${PHONE_MAX_DIGITS} digits` };
  }
  return { value };
};

// Returns { value } (rounded to 2 decimals) or { error }. Empty input counts as 0 unless `required`.
export const validateMoney = (raw, label, { required = false } = {}) => {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return required ? { error: `${label} is required` } : { value: 0 };
  }
  const text = String(raw).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return { error: `${label} must be a valid non-negative number` };
  const number = Number(text);
  if (!Number.isFinite(number)) return { error: `${label} must be a valid number` };
  if (number > MAX_MONTHLY_AMOUNT) return { error: `${label} cannot exceed ₹${formatINR(MAX_MONTHLY_AMOUNT)} per month` };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { error: `${label} can have at most 2 decimal places` };
  return { value: Math.round(number * 100) / 100 };
};
