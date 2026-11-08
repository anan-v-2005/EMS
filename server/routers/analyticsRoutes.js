import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { getAnalytics } from "../controller/analyticsController.js";
import {
  employeeSummary, employeeAttendance, employeeLeaves,
  adminOverview, adminAttendance, adminLeaves,
  adminEmployeeAnalytics, adminEmployeeComparison,
  adminEmployeeTeamAverage, listEmployeeAnalyticsNotes,
  createEmployeeAnalyticsNote,
} from "../controller/analyticsV2Controller.js";

const router = Router();
router.get("/", protect, getAnalytics);
router.get("/employee/summary", protect, employeeSummary);
router.get("/employee/attendance", protect, employeeAttendance);
router.get("/employee/leaves", protect, employeeLeaves);
router.get("/admin/overview", protect, adminOverview);
router.get("/admin/attendance", protect, adminAttendance);
router.get("/admin/leaves", protect, adminLeaves);
router.get("/admin/comparison", protect, adminEmployeeComparison);
router.get("/admin/team-average", protect, adminEmployeeTeamAverage);
router.get("/admin/employees/:employeeId/notes", protect, listEmployeeAnalyticsNotes);
router.post("/admin/employees/:employeeId/notes", protect, createEmployeeAnalyticsNote);
router.get("/admin/employees/:employeeId", protect, adminEmployeeAnalytics);
export default router;
