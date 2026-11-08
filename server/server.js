import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import express from "express";
import "dotenv/config";
import cors from "cors";
import connectDB from "./config/db.js";
import authRouter from "./routers/authRoutes.js";
import employeeRouter from "./routers/employeeRoutes.js";
import profileRouter from "./routers/profileRoutes.js";
import attendanceRouter from "./routers/attendanceRoutes.js";
import leaveRouter from "./routers/leaveRoute.js";
import payslipRouter from "./routers/payslipsRoutes.js";
import dashboardRouter from "./routers/dashboardRoutes.js";
import analyticsRouter from "./routers/analyticsRoutes.js";
import notificationRouter from "./routers/notificationRoutes.js";
import announcementRouter from "./routers/announcementRoutes.js";
import holidayRouter from "./routers/holidayRoutes.js";
import searchRouter from "./routers/searchRoutes.js";
import aiRouter from "./routers/aiRoutes.js";
import enterpriseRouter from "./routers/enterpriseRoutes.js";
import emailLogRouter from "./routers/emailLogRoutes.js";
import hrmsRouter from "./routers/hrmsRoutes.js";
import { securityHeaders } from "./middleware/security.js";
import { closeOpenAttendance } from "./services/attendanceSummary.js";
import { initializeLeaveBalances } from "./services/leaveBalanceJobs.js";
import { backfillSalaryStructures } from "./services/salaryService.js";
import { handleUploadError } from "./middleware/upload.js";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";

const app = express();
const PORT = process.env.PORT || 4000;

// Needed so req.ip (used by the rate limiter) is the real client IP behind Vercel/Render/nginx.
app.set("trust proxy", 1);
app.disable("x-powered-by");

if (process.env.NODE_ENV === "production" && !process.env.CLIENT_URL) {
  console.warn(
    "WARNING: CLIENT_URL is not set; CORS currently allows ANY origin. Set it in production.",
  );
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.warn(
    "WARNING: JWT_SECRET is missing or shorter than 32 characters. Use a long random secret.",
  );
}

// Middleware
app.use(securityHeaders);
app.use(
  cors({
    origin: process.env.CLIENT_URL
      ? process.env.CLIENT_URL.split(",").map((v) => v.trim())
      : true,
    credentials: false,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.send("Server is running");
});
app.use("/api/auth", authRouter);
app.use("/api/employees", employeeRouter);
app.use("/api/profile", profileRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/leave", leaveRouter);
app.use("/api/payslips", payslipRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/announcements", announcementRouter);
app.use("/api/holidays", holidayRouter);
app.use("/api/search", searchRouter);
app.use("/api/ai", aiRouter);
app.use("/api/enterprise", enterpriseRouter);
app.use("/api/email-logs", emailLogRouter);
app.use("/api/hrms", hrmsRouter);

app.use(handleUploadError);

app.use("/api/inngest", serve({ client: inngest, functions }));

// Unknown API routes -> JSON 404 instead of an HTML page.
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Route not found" }),
);

// Last-resort error handler: never leak stack traces to clients.
// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, _next) => {
  console.error("Unhandled error:", error);
  if (res.headersSent) return;
  const status =
    error?.status >= 400 && error?.status < 600 ? error.status : 500;
  res
    .status(status)
    .json({ error: status === 500 ? "Internal server error" : error.message });
});

await connectDB();

// Recover open records from previous IST days on startup.
try {
  const result = await closeOpenAttendance({ before: new Date() });
  if (result.closed)
    console.log(
      `Attendance recovery closed ${result.closed} past open record(s).`,
    );
} catch (error) {
  console.error("Attendance recovery sweep failed:", error);
}
try {
  const result = await initializeLeaveBalances();
  console.log(
    `Leave balance initialization created ${result.initialized} record(s).`,
  );
} catch (error) {
  console.error("Leave balance initialization failed:", error);
}
// One-time self-heal: salaries saved only on the Employee record get a salary structure (idempotent).
try {
  const result = await backfillSalaryStructures();
  if (result.created || result.skipped)
    console.log(
      `Salary backfill created ${result.created} structure(s), skipped ${result.skipped} out-of-range record(s).`,
    );
} catch (error) {
  console.error("Salary backfill failed:", error);
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
