import Attendance from "../models/Attendance.js";
import LeaveApplication from "../models/LeaveApplication.js";
import Holiday from "../models/Holiday.js";
import AttendanceAudit from "../models/AttendanceAudit.js";
import { getIndiaWeekday } from "../utils/date.js";
import { attendancePolicy } from "../config/attendancePolicy.js";
import { getWeeklyOffDays } from "./payrollSettings.js";

import { calculateAttendance, classifyWorkHours } from "./attendanceMath.js";
export { calculateAttendance, classifyWorkHours };

export function istDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: attendancePolicy.TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
export function istDayBounds(date = new Date()) {
  const key = istDateKey(date); const start = new Date(`${key}T00:00:00+05:30`);
  return { key, start, end: new Date(start.getTime() + 86400000) };
}

export async function closeOpenAttendance({ before = new Date(), employeeId = null } = {}) {
  const query = { checkIn: { $ne: null }, $or: [{ checkOut: null }, { checkOut: { $exists: false } }], date: { $lt: istDayBounds(before).start } };
  if (employeeId) query.employeeId = employeeId;
  const rows = await Attendance.find(query).select("_id employeeId date checkIn status checkOut").lean();
  let closed = 0;
  for (const row of rows) {
    const dateKey = istDateKey(row.date);
    const scheduled = new Date(`${dateKey}T${attendancePolicy.SHIFT_END}:00+05:30`);
    const checkout = new Date(Math.max(new Date(row.checkIn).getTime(), Math.min(scheduled.getTime(), new Date(before).getTime())));
    const calculated = calculateAttendance(row.checkIn, checkout, { automatic: true, existingStatus: row.status });
    const result = await Attendance.updateOne({ _id: row._id, $or: [{ checkOut: null }, { checkOut: { $exists: false } }] }, { $set: calculated });
    if (result.modifiedCount) {
      await AttendanceAudit.create({ attendanceId: row._id, action: "AUTO_CHECKOUT", previousCheckOut: row.checkOut, newCheckOut: checkout, reason: "Startup/history recovery sweep" });
      closed++;
    }
  }
  return { closed };
}

export async function summarizeEmployeeDay(employeeId, date = new Date()) {
  const { start, end } = istDayBounds(date);
  const attendance = await Attendance.findOne({ employeeId, date: { $gte: start, $lt: end } }).lean();
  const leave = await LeaveApplication.findOne({ employeeId, status: "APPROVED", startDate: { $lt: end }, endDate: { $gte: start } }).lean();
  const holiday = await Holiday.findOne({ date: { $gte: start, $lt: end }, type: { $ne: "OPTIONAL" } }).lean();
  const day = getIndiaWeekday(date);
  const weeklyOffs = await getWeeklyOffDays();
  return { date: istDateKey(date), attendance, leave, holiday, classification: holiday ? "Holiday" : weeklyOffs.includes(day) ? "Weekly off" : leave ? "Paid leave" : attendance?.workingHours >= 8 ? "Present" : attendance?.workingHours >= 4 ? "Half-day" : attendance ? "Absent" : "Absent" };
}
