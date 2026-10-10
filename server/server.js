import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import express from "express";
import "dotenv/config"
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
import { handleUploadError } from "./middleware/upload.js";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js"


const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",").map((v) => v.trim()) : true, credentials: false }));
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

app.use(handleUploadError);

app.use("/api/inngest", serve({ client: inngest, functions }));

await connectDB();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
