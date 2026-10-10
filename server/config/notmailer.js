import nodemailer from "nodemailer";

let transporter;

// Note: Brevo SMTP may require the server IP address to be whitelisted; this cannot be fixed by application code alone.
const getTransporter = () => {
  if (transporter) return transporter;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.SENDER_EMAIL) {
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

const sendEmail = async ({ to, subject, body, text }) => {
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

export const sendEmailSafely = async (options) => {
  try {
    return await sendEmail(options);
  } catch (error) {
    console.error("Email notification failed:", error.message);
    return null;
  }
};

export default sendEmail;
