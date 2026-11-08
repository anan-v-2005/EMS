// Shared validation limits. Change them here and every form/endpoint follows.
export const PHONE_MIN_DIGITS = 7;   // shortest accepted phone number
export const PHONE_MAX_DIGITS = 15;  // E.164 maximum (country code included)

// Per-component monthly ceiling in INR (basic, HRA, allowances, recurring deduction, and the monthly gross).
// ₹1,00,00,000 (1 crore) per month is far above any real pay and still rejects typing mistakes.
export const MAX_MONTHLY_AMOUNT = 10_000_000;
