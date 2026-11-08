import nodemailer from "nodemailer";
import EmailLog from "../models/EmailLog.js";

let transporter;

// Note: Brevo SMTP may require the server IP address to be whitelisted; this cannot be fixed by application code alone.
const getTransporter = () => {
  if (transporter) return transporter;
  if (
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS ||
    !process.env.SENDER_EMAIL
  ) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    auth: {
      user: String(process.env.SMTP_USER).trim(),
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
};

export const isEmailConfigured = () => Boolean(getTransporter());

const MAX_ATTEMPTS = Math.max(
  1,
  Math.floor(Number(process.env.EMAIL_MAX_ATTEMPTS) || 3),
);

const BASE_DELAY_MS = Math.max(
  500,
  Number(process.env.EMAIL_RETRY_DELAY_MS) || 1500,
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Best-effort logging: a logging failure must never break (or hide) the email result.
const writeLog = async (entry) => {
  try {
    await EmailLog.create(entry);
  } catch (error) {
    console.error("Email log write failed:", error.message);
  }
};

const sendOnce = async ({ to, subject, body, text }) => {
  const mailer = getTransporter();
  if (!mailer) {
    const error = new Error("Email service is not configured");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  return mailer.sendMail({
    from: String(process.env.SENDER_EMAIL).trim(),
    to,
    subject,
    text: text || undefined,
    html: body,
  });
};

// Sends with retry + exponential backoff and records the outcome in EmailLog.
// Throws only after every attempt failed (or immediately if email is not configured).
const sendEmail = async (options) => {
  const { to, subject } = options;
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const info = await sendOnce(options);
      await writeLog({
        to: String(to),
        subject,
        status: "SENT",
        attempts: attempt,
        messageId: info?.messageId || "",
      });
      return info;
    } catch (error) {
      lastError = error;
      if (error.code === "EMAIL_NOT_CONFIGURED") {
        await writeLog({
          to: String(to),
          subject,
          status: "SKIPPED",
          attempts: 0,
          error: error.message,
        });
        throw error;
      }
      if (attempt < MAX_ATTEMPTS)
        await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }

  await writeLog({
    to: String(to),
    subject,
    status: "FAILED",
    attempts: MAX_ATTEMPTS,
    error: String(lastError?.message || lastError).slice(0, 500),
  });
  throw lastError;
};

// Never throws. Use for notifications that must not undo the main action.
export const sendEmailSafely = async (options) => {
  try {
    return await sendEmail(options);
  } catch (error) {
    console.error("Email notification failed:", error.message);
    return null;
  }
};

export default sendEmail;
