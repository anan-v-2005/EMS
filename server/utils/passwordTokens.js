import crypto from "node:crypto";

export const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

// Returns { token, hash, expires }. Only `hash` is stored; `token` goes into the email link.
export const createPasswordToken = (ttlMs) => {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: hashToken(token), expires: new Date(Date.now() + ttlMs) };
};

export const RESET_TTL_MS = 60 * 60 * 1000; // forgot-password link: 1 hour
export const WELCOME_TTL_MS = 72 * 60 * 60 * 1000; // new-account set-password link: 72 hours

export const clientBaseUrl = () =>
  String(process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/+$/, "");

export const buildResetLink = (token, email) =>
  `${clientBaseUrl()}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
