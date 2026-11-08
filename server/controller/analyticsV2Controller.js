import mongoose from "mongoose";
import { withCurrentSalary } from "../services/salaryService.js";
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import LeaveApplication from "../models/LeaveApplication.js";
import Payslip, { PUBLISHED } from "../models/Payslip.js";
import PerformanceReview from "../models/PerformanceReview.js";
import LeaveBalance from "../models/LeaveBalance.js";
import Salary from "../models/Salary.js";
import EmployeeAnalyticsNote from "../models/EmployeeAnalyticsNote.js";
import HRAuditEvent from "../models/HRAuditEvent.js";
import PayrollSnapshot from "../models/PayrollSnapshot.js";
import { attendanceCreditForRecord } from "../services/attendanceMath.js";
import { getOffHolidayKeys, getWeeklyOffDays } from "../services/workPolicy.js";
import { leaveWorkdayEntries } from "../services/analyticsLeaveDays.js";

const cache = new Map();
const TTL = 120000;
const istYear = () => Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric" }).format(new Date()));
const rangeForYear = (year) => ({ start: new Date(`${year}-01-01T00:00:00+05:30`), end: new Date(`${year + 1}-01-01T00:00:00+05:30`) });
const months = (rows, key = "_id") => { const map = new Map(rows.map(row => [Number(row[key]), row])); return Array.from({ length: 12 }, (_, i) => { const row = map.get(i + 1) || {}; return { month: i + 1, label: new Date(Date.UTC(2020, i, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" }), records: 0, late: 0, hours: 0, fullDays: 0, halfDays: 0, ...row, [key]: i + 1 }; }); };
const respond = (res, error) => res.status(500).json({ error: "Analytics request failed", detail: process.env.NODE_ENV === "development" ? error.message : undefined });
async function getOwnEmployee(req) { const employee = await Employee.findOne({ userId: new mongoose.Types.ObjectId(req.session.userId) }).select("_id firstName lastName department position basicSalary allowance").lean(); return employee ? withCurrentSalary(employee) : employee; }
function yearParam(req) { const year = Number(req.query.year || istYear()); if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new Error("Invalid year parameter"); return year; }
function adminOnly(req, res) { if (req.session.role !== "ADMIN") { res.status(403).json({ error: "Admin access required" }); return false; } return true; }
function cacheGet(key) { const item = cache.get(key); if (!item || item.expires < Date.now()) { cache.delete(key); return null; } return item.value; }
function cacheSet(key, value) { cache.set(key, { value, expires: Date.now() + TTL }); return value; }
function validIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function istMonthsOverlapping(start, end) {
  const parts = (date) => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).formatToParts(date);
  const first = parts(start); const last = parts(new Date(end.getTime() - 1));
  let year = Number(first.find(item => item.type === "year").value);
  let month = Number(first.find(item => item.type === "month").value);
  const lastYear = Number(last.find(item => item.type === "year").value);
  const lastMonth = Number(last.find(item => item.type === "month").value);
  const result = [];
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    result.push({ year, month });
    month += 1; if (month > 12) { month = 1; year += 1; }
  }
  return result;
}

export async function employeeSummary(req, res) { try { const employee = await getOwnEmployee(req); if (!employee) return res.status(404).json({ error: "Employee not found" }); const now = new Date(); const start = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now) + "T00:00:00+05:30"); const end = new Date(start.getTime() + 86400000); const [attendance, leaves, latestPayslip] = await Promise.all([Attendance.aggregate([{ $match: { employeeId: new mongoose.Types.ObjectId(employee._id), date: { $gte: new Date(`${istYear()}-01-01T00:00:00+05:30`), $lt: end } } }, { $group: { _id: null, records: { $sum: 1 }, late: { $sum: { $cond: [{ $eq: ["$status", "LATE"] }, 1, 0] } }, hours: { $sum: { $ifNull: ["$workingHours", 0] } } } }]), LeaveApplication.aggregate([{ $match: { employeeId: new mongoose.Types.ObjectId(employee._id) } }, { $group: { _id: "$status", count: { $sum: 1 } } }]), Payslip.findOne({ employeeId: employee._id, ...PUBLISHED }).sort({ year: -1, month: -1 }).select("month year netSalary").lean()]); res.json({ employee, attendance: attendance[0] || { records: 0, late: 0, hours: 0 }, leaves: Object.fromEntries(leaves.map(x => [x._id.toLowerCase(), x.count])), latestPayslip }); } catch (e) { respond(res, e); } }

export async function employeeAttendance(req, res) { try { const employee = await getOwnEmployee(req); if (!employee) return res.status(404).json({ error: "Employee not found" }); const year = yearParam(req); const { start, end } = rangeForYear(year); const rows = await Attendance.aggregate([{ $match: { employeeId: new mongoose.Types.ObjectId(employee._id), date: { $gte: start, $lt: end } } }, { $group: { _id: { $month: { date: "$date", timezone: "Asia/Kolkata" } }, records: { $sum: 1 }, late: { $sum: { $cond: [{ $eq: ["$status", "LATE"] }, 1, 0] } }, hours: { $sum: { $ifNull: ["$workingHours", 0] } }, fullDays: { $sum: { $cond: [{ $gte: [{ $ifNull: ["$workingHours", 0] }, 8] }, 1, 0] } }, halfDays: { $sum: { $cond: [{ $and: [{ $gte: [{ $ifNull: ["$workingHours", 0] }, 4] }, { $lt: [{ $ifNull: ["$workingHours", 0] }, 8] }] }, 1, 0] } } } }, { $sort: { _id: 1 } }]); res.json({ year, data: months(rows) }); } catch (e) { respond(res, e); } }

export async function employeeLeaves(req, res) { try { const employee = await getOwnEmployee(req); if (!employee) return res.status(404).json({ error: "Employee not found" }); const year = yearParam(req); const { start, end } = rangeForYear(year); const rows = await LeaveApplication.aggregate([{ $match: { employeeId: new mongoose.Types.ObjectId(employee._id), startDate: { $lt: end }, endDate: { $gte: start } } }, { $group: { _id: { month: { $month: { date: "$startDate", timezone: "Asia/Kolkata" } }, status: "$status", type: "$type" }, count: { $sum: 1 }, days: { $sum: { $ifNull: ["$requestedDays", 0] } } } }, { $sort: { "_id.month": 1 } }]); res.json({ year, data: rows.map(row => ({ month: row._id.month, status: row._id.status, type: row._id.type, count: row.count, days: row.days })) }); } catch (e) { respond(res, e); } }

export async function adminOverview(req, res) { if (!adminOnly(req, res)) return; const key = "admin:overview"; const cached = cacheGet(key); if (cached) return res.json(cached); try { const [employeeStats, attendanceStats, leaveStats] = await Promise.all([Employee.aggregate([{ $match: { isDeleted: { $ne: true } } }, { $facet: { total: [{ $count: "count" }], byStatus: [{ $group: { _id: "$employmentStatus", count: { $sum: 1 } } }], byDepartment: [{ $group: { _id: { $ifNull: ["$department", "Unassigned"] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }], newThisMonth: [{ $match: { joinDate: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }, { $count: "count" }] } }]), Attendance.aggregate([{ $match: { date: { $gte: new Date(Date.now() - 30 * 86400000) } } }, { $group: { _id: null, records: { $sum: 1 }, late: { $sum: { $cond: [{ $eq: ["$status", "LATE"] }, 1, 0] } }, averageHours: { $avg: "$workingHours" } } }]), LeaveApplication.aggregate([{ $match: { status: "PENDING" } }, { $count: "count" }])]); const facet = employeeStats[0] || {}; const result = { employees: { total: facet.total?.[0]?.count || 0, byStatus: facet.byStatus || [], byDepartment: facet.byDepartment || [], newThisMonth: facet.newThisMonth?.[0]?.count || 0 }, attendanceLast30Days: attendanceStats[0] || { records: 0, late: 0, averageHours: 0 }, pendingLeaves: leaveStats[0]?.count || 0 }; cacheSet(key, result); res.json(result); } catch (e) { respond(res, e); } }
export async function adminAttendance(req, res) { if (!adminOnly(req, res)) return; try { const year = yearParam(req); const { start, end } = rangeForYear(year); const department = req.query.department; const rows = await Attendance.aggregate([{ $match: { date: { $gte: start, $lt: end } } }, { $lookup: { from: "employees", localField: "employeeId", foreignField: "_id", as: "employee" } }, { $unwind: "$employee" }, ...(department ? [{ $match: { "employee.department": department } }] : []), { $group: { _id: { month: { $month: { date: "$date", timezone: "Asia/Kolkata" } }, status: "$status", department: "$employee.department" }, records: { $sum: 1 }, hours: { $sum: { $ifNull: ["$workingHours", 0] } } } }, { $sort: { "_id.month": 1 } }]); res.json({ year, department: department || null, data: rows }); } catch (e) { respond(res, e); } }
export async function adminLeaves(req, res) { if (!adminOnly(req, res)) return; try { const year = yearParam(req); const { start, end } = rangeForYear(year); const data = await LeaveApplication.aggregate([{ $match: { startDate: { $lt: end }, endDate: { $gte: start } } }, { $group: { _id: { month: { $month: { date: "$startDate", timezone: "Asia/Kolkata" } }, status: "$status", type: "$type" }, count: { $sum: 1 }, days: { $sum: { $ifNull: ["$requestedDays", 0] } } } }, { $sort: { "_id.month": 1 } }]); res.json({ year, data }); } catch (e) { respond(res, e); } }



// Admin comparison view. Metrics are derived only from persisted records.
// Attendance percentage is based on recorded attendance rows (present/late vs absent),
// not inferred working days; productivity is unavailable because no productivity model exists.
export async function adminEmployeeComparison(req, res) {
  if (!adminOnly(req, res)) return;
  try {
    const todayParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const today = new Date(`${todayParts}T00:00:00+05:30`);
    const preset = String(req.query.range || "30d");
    let start;
    let end = new Date(today.getTime() + 86400000);
    const days = { "7d": 7, "30d": 30, month: null, quarter: null, year: null };
    if (preset === "custom") {
      if (!validIsoDate(req.query.startDate) || !validIsoDate(req.query.endDate)) {
        return res.status(400).json({ error: "A valid custom startDate and endDate are required" });
      }
      start = new Date(`${req.query.startDate}T00:00:00+05:30`);
      const customEnd = new Date(`${req.query.endDate}T00:00:00+05:30`);
      if (start > customEnd) {
        return res.status(400).json({ error: "A valid custom startDate and endDate are required" });
      }
      end = new Date(customEnd.getTime() + 86400000);
    } else if (preset === "month") {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).formatToParts(today);
      const y = Number(parts.find(x => x.type === "year").value);
      const m = Number(parts.find(x => x.type === "month").value);
      start = new Date(Date.UTC(y, m - 1, 1) - 330 * 60000);
    } else if (preset === "quarter") {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).formatToParts(today);
      const y = Number(parts.find(x => x.type === "year").value);
      const m = Number(parts.find(x => x.type === "month").value);
      start = new Date(Date.UTC(y, Math.floor((m - 1) / 3) * 3, 1) - 330 * 60000);
    } else if (preset === "year") {
      const year = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric" }).format(today));
      start = new Date(`${year}-01-01T00:00:00+05:30`);
    } else if (days[preset]) {
      start = new Date(today.getTime() - (days[preset] - 1) * 86400000);
    } else {
      return res.status(400).json({ error: "Unsupported date range" });
    }

    const employeeFilter = { isDeleted: { $ne: true } };
    if (req.query.department) employeeFilter.department = String(req.query.department).slice(0, 100);
    if (req.query.designation) employeeFilter.position = String(req.query.designation).slice(0, 100);
    if (req.query.status) employeeFilter.employmentStatus = String(req.query.status).toUpperCase();
    if (req.query.employmentType) {
      const employmentType = String(req.query.employmentType).toUpperCase();
      if (!["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "TEMPORARY"].includes(employmentType)) return res.status(400).json({ error: "Unsupported employment type" });
      employeeFilter.employmentType = employmentType;
    }
    const selected = String(req.query.employeeIds || "").split(",").filter(Boolean);
    if (selected.length > 100) return res.status(400).json({ error: "Select no more than 100 employees at a time" });
    if (selected.length) {
      if (selected.some(id => !mongoose.Types.ObjectId.isValid(id))) {
        return res.status(400).json({ error: "One or more employee IDs are invalid" });
      }
      employeeFilter._id = { $in: selected.map(id => new mongoose.Types.ObjectId(id)) };
    }
    const employees = await Employee.find(employeeFilter)
      .select("firstName lastName email position department employmentStatus employmentType joinDate profilePhotoUrl basicSalary allowance deductions")
      .sort({ firstName: 1, lastName: 1 }).limit(200).lean();
    const ids = employees.map(e => e._id);
    if (!ids.length) return res.json({
      range: { start: start.toISOString(), end: end.toISOString() },
      summary: { totalEmployees: 0, activeEmployees: 0, averageAttendance: null, averageProductivity: null, totalWorkingHours: 0, totalOvertimeHours: 0, totalLeaveTaken: 0, averagePerformanceRating: null },
      employees: [], attendanceTrend: [], leaveByType: [], attendanceStatusDistribution: { present: 0, late: 0, absent: 0, halfDay: 0, approvedLeaveDays: 0 }, unavailable: ["Productivity", "Task contribution", "Login activity", "Salary history"],
    });

    const [attendance, leaves, reviews, salaries, payrollSnapshots, weeklyOffs, holidayKeys] = await Promise.all([
      Attendance.find({ employeeId: { $in: ids }, date: { $gte: start, $lt: end } }).select("employeeId date status dayType workingHours").lean(),
      LeaveApplication.find({ employeeId: { $in: ids }, status: "APPROVED", startDate: { $lt: end }, endDate: { $gte: start } }).select("employeeId type requestedDays paidDays lopDays startDate endDate halfDay").lean(),
      PerformanceReview.find({ employee: { $in: ids }, status: { $in: ["SUBMITTED", "ACKNOWLEDGED"] }, createdAt: { $gte: start, $lt: end } }).select("employee rating period status").lean(),
      Salary.find({ employee: { $in: ids }, isActive: true, effectiveFrom: { $lte: new Date() } }).select("employee basic hra allowances fixedMonthlyGross effectiveFrom").sort({ effectiveFrom: -1 }).lean(),
      PayrollSnapshot.find({ employee: { $in: ids }, status: { $ne: "draft" }, $or: istMonthsOverlapping(start, end).map(({ year, month }) => ({ year, month })) }).select("employee attendance.overtimeHours year month").lean(),
      getWeeklyOffDays(),
      getOffHolidayKeys(start, end),
    ]);

    const attendanceMap = new Map();
    for (const row of attendance) {
      const key = String(row.employeeId);
      if (!attendanceMap.has(key)) attendanceMap.set(key, []);
      attendanceMap.get(key).push(row);
    }
    const leaveMap = new Map();
    const leaveTypes = new Map();
    const leaveTypeByEmployee = new Map();
    for (const row of leaves) {
      const key = String(row.employeeId);
      const days = leaveWorkdayEntries(row, start, end, weeklyOffs, holidayKeys).reduce((sum, entry) => sum + entry.days, 0);
      leaveMap.set(key, (leaveMap.get(key) || 0) + days);
      const type = String(row.type || "OTHER").toUpperCase();
      leaveTypes.set(type, (leaveTypes.get(type) || 0) + days);
      if (!leaveTypeByEmployee.has(key)) leaveTypeByEmployee.set(key, {});
      const perType = leaveTypeByEmployee.get(key);
      perType[type] = Number(((perType[type] || 0) + days).toFixed(2));
    }
    const reviewMap = new Map();
    for (const row of reviews) if (Number.isFinite(row.rating)) {
      const key = String(row.employee);
      if (!reviewMap.has(key)) reviewMap.set(key, []);
      reviewMap.get(key).push(Number(row.rating));
    }
    const overtimeMap = new Map();
    for (const row of payrollSnapshots) overtimeMap.set(String(row.employee), (overtimeMap.get(String(row.employee)) || 0) + Number(row.attendance?.overtimeHours || 0));
    const salaryMap = new Map();
    for (const row of salaries) if (!salaryMap.has(String(row.employee))) salaryMap.set(String(row.employee), row);

    const rows = employees.map(employee => {
      const records = attendanceMap.get(String(employee._id)) || [];
      const marked = records.length;
      const attendanceCredit = records.reduce((sum, record) => sum + attendanceCreditForRecord(record), 0);
      const hours = records.reduce((sum, r) => sum + (Number.isFinite(r.workingHours) ? Number(r.workingHours) : 0), 0);
      const ratings = reviewMap.get(String(employee._id)) || [];
      const salary = salaryMap.get(String(employee._id));
      const statusCounts = records.reduce((counts, record) => {
        if (record.status === "ABSENT") counts.absent += 1;
        else if (record.status === "LATE") counts.late += 1;
        else counts.present += 1;
        return counts;
      }, { present: 0, late: 0, absent: 0 });
      return {
        id: String(employee._id), employeeId: String(employee._id), name: `${employee.firstName || ""} ${employee.lastName || ""}`.trim(),
        email: employee.email, department: employee.department || "Unassigned", designation: employee.position || "—",
        status: employee.employmentStatus || "—", employmentType: employee.employmentType || null, photo: employee.profilePhotoUrl || null,
        attendanceRecords: marked, attendanceStatus: statusCounts, attendancePercent: marked ? Number((attendanceCredit / marked * 100).toFixed(1)) : null,
        leaveDays: Number((leaveMap.get(String(employee._id)) || 0).toFixed(2)),
        leaveTypeDays: leaveTypeByEmployee.get(String(employee._id)) || {},
        workingHours: Number(hours.toFixed(2)),
        overtimeHours: Number((overtimeMap.get(String(employee._id)) || 0).toFixed(2)),
        performanceRating: ratings.length ? Number((ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(2)) : null,
        salary: salary ? { basic: salary.basic, hra: salary.hra, allowances: salary.allowances, deductions: Number(employee.deductions || 0), gross: salary.fixedMonthlyGross } : (employee.basicSalary || employee.allowance ? { basic: Number(employee.basicSalary || 0), hra: 0, allowances: Number(employee.allowance || 0), deductions: Number(employee.deductions || 0), gross: Number(employee.basicSalary || 0) + Number(employee.allowance || 0) } : null),
      };
    });
    const validAttendance = rows.filter(r => r.attendancePercent !== null);
    const validRatings = rows.filter(r => r.performanceRating !== null);
    const totalHours = rows.reduce((sum, r) => sum + r.workingHours, 0);
    const totalLeave = rows.reduce((sum, r) => sum + r.leaveDays, 0);
    const dayBuckets = new Map();
    const attendanceStatusCounts = { present: 0, late: 0, absent: 0, halfDay: 0, leaveDays: Number(totalLeave.toFixed(2)) };
    for (const row of attendance) {
      const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(row.date);
      const item = dayBuckets.get(key) || { date: key, present: 0, late: 0, absent: 0, halfDay: 0 };
      if (row.status === "ABSENT") { item.absent++; attendanceStatusCounts.absent++; }
      else if (["Half Day", "Three Quarter Day"].includes(row.dayType)) attendanceStatusCounts.halfDay++;
      else if (row.status === "LATE") { item.late++; attendanceStatusCounts.late++; }
      else { item.present++; attendanceStatusCounts.present++; }
      if (row.dayType === "Half Day" || row.dayType === "Three Quarter Day") item.halfDay++;
      dayBuckets.set(key, item);
    }
    return res.json({
      range: { start: start.toISOString(), end: end.toISOString() },
      summary: {
        totalEmployees: employees.length,
        activeEmployees: employees.filter(e => e.employmentStatus === "ACTIVE").length,
        averageAttendance: validAttendance.length ? Number((validAttendance.reduce((a,r)=>a+r.attendancePercent,0)/validAttendance.length).toFixed(1)) : null,
        averageProductivity: null,
        totalWorkingHours: Number(totalHours.toFixed(2)),
        totalOvertimeHours: Number(rows.reduce((sum, row) => sum + row.overtimeHours, 0).toFixed(2)),
        totalLeaveTaken: Number(totalLeave.toFixed(2)),
        averagePerformanceRating: validRatings.length ? Number((validRatings.reduce((a,r)=>a+r.performanceRating,0)/validRatings.length).toFixed(2)) : null,
      },
      employees: rows,
      attendanceTrend: [...dayBuckets.values()].sort((a,b)=>a.date.localeCompare(b.date)),
      attendanceStatusDistribution: {
        present: attendance.filter(row => row.status === "PRESENT" && !["Half Day", "Three Quarter Day", "Short Day"].includes(row.dayType)).length,
        late: attendance.filter(row => row.status === "LATE" && !["Half Day", "Three Quarter Day", "Short Day"].includes(row.dayType)).length,
        absent: attendance.filter(row => row.status === "ABSENT").length,
        halfDay: attendance.filter(row => ["Half Day", "Three Quarter Day"].includes(row.dayType)).length,
        approvedLeaveDays: Number(totalLeave.toFixed(2)),
      },
      leaveByType: [...leaveTypes.entries()].map(([type, days]) => ({ type, days: Number(days.toFixed(2)) })),
      unavailable: ["Productivity", "Task contribution", "Login activity", "Salary history"],
    });
  } catch (error) {
    console.error("Admin employee comparison failed:", error);
    return res.status(500).json({ error: "Employee comparison could not be loaded" });
  }
}

// Admin-only employee deep dive. All figures are calculated from live persisted records.
export async function adminEmployeeAnalytics(req, res) {
  if (!adminOnly(req, res)) return;
  try {
    const employeeId = req.params.employeeId;
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ error: "A valid employee ID is required" });
    }

    const employee = await Employee.findOne({
      _id: employeeId,
      isDeleted: { $ne: true },
    }).lean();
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const now = new Date();
    const istParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata", year: "numeric", month: "numeric",
    }).formatToParts(now);
    const currentYear = Number(istParts.find((p) => p.type === "year")?.value);
    const currentMonth = Number(istParts.find((p) => p.type === "month")?.value);
    const monthStarts = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(Date.UTC(currentYear, currentMonth - 12 + index, 1));
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
    });
    const first = monthStarts[0];
    const last = monthStarts[11];
    const istStart = (year, month) => new Date(Date.UTC(year, month - 1, 1) - 330 * 60 * 1000);
    const rangeStart = istStart(first.year, first.month);
    const rangeEnd = istStart(last.month === 12 ? last.year + 1 : last.year, last.month === 12 ? 1 : last.month + 1);
    const keyForDate = (value) => {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).formatToParts(new Date(value));
      return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}`;
    };
    const monthKey = (year, month) => `${year}-${String(month).padStart(2, "0")}`;
    const keys = monthStarts.map(({ year, month }) => monthKey(year, month));
    const monthRanges = monthStarts.map(({ year, month }) => ({ start: istStart(year, month), end: istStart(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1) }));
    const activeEmployees = await Employee.countDocuments({ isDeleted: { $ne: true }, employmentStatus: "ACTIVE" });
    const departmentCount = employee.department
      ? await Employee.countDocuments({ isDeleted: { $ne: true }, employmentStatus: "ACTIVE", department: employee.department })
      : 0;

    const [attendance, leaves, payslips, reviews, leaveBalance, currentSalary, reportingManager, salaryHistory, payrollSnapshots, weeklyOffs, holidayKeys] = await Promise.all([
      Attendance.find({ employeeId: employee._id, date: { $gte: rangeStart, $lt: rangeEnd } }).select("date status dayType workingHours checkIn checkOut").sort({ date: 1 }).lean(),
      LeaveApplication.find({ employeeId: employee._id, startDate: { $lt: rangeEnd }, endDate: { $gte: rangeStart } }).select("type startDate endDate status requestedDays paidDays lopDays halfDay createdAt").sort({ startDate: 1 }).lean(),
      Payslip.find({ employeeId: employee._id, ...PUBLISHED, $or: monthStarts.map(({ year, month }) => ({ year, month })) }).select("year month netSalary basicSalary allowances deductions breakdown.deductions.total status").sort({ year: 1, month: 1 }).lean(),
      PerformanceReview.find({ employee: employee._id, status: { $in: ["SUBMITTED", "ACKNOWLEDGED"] } }).select("period rating status strengths improvements goals createdAt updatedAt").sort({ createdAt: -1 }).limit(12).lean(),
      LeaveBalance.findOne({ employee: employee._id, year: currentYear }).lean(),
      Salary.findOne({ employee: employee._id, isActive: true, effectiveFrom: { $lte: new Date() } }).sort({ effectiveFrom: -1 }).lean(),
      employee.reportingManager ? Employee.findById(employee.reportingManager).select("firstName lastName position").lean() : Promise.resolve(null),
      Salary.find({ employee: employee._id, effectiveFrom: { $lte: now } }).select("basic hra allowances fixedMonthlyGross effectiveFrom").sort({ effectiveFrom: 1 }).lean(),
      PayrollSnapshot.find({ employee: employee._id, status: { $ne: "draft" }, $or: monthStarts.map(({ year, month }) => ({ year, month })) }).select("month year attendance.overtimeHours attendance.workingDays").sort({ year: 1, month: 1 }).lean(),
      getWeeklyOffDays(),
      getOffHolidayKeys(rangeStart, rangeEnd),
    ]);

    const attendanceByMonth = new Map(keys.map((key) => [key, { month: key, records: 0, present: 0, late: 0, absent: 0, averageHours: 0, totalHours: 0, completedDays: 0 }]));
    for (const row of attendance) {
      const bucket = attendanceByMonth.get(keyForDate(row.date));
      if (!bucket) continue;
      bucket.records += 1;
      if (row.status === "LATE") bucket.late += 1;
      else if (row.status === "ABSENT") bucket.absent += 1;
      else bucket.present += 1;
      if (Number.isFinite(row.workingHours)) {
        bucket.totalHours += Number(row.workingHours);
        bucket.completedDays += 1;
      }
    }
    const attendanceTrend = [...attendanceByMonth.values()].map((row, index) => ({
      ...row,
      label: new Date(Date.UTC(monthStarts[index].year, monthStarts[index].month - 1, 1)).toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
      averageHours: row.completedDays ? Number((row.totalHours / row.completedDays).toFixed(2)) : 0,
    }));

    const leaveByMonth = new Map(keys.map((key) => [key, { month: key, requests: 0, approved: 0, pending: 0, rejected: 0, requestedDays: 0, approvedDays: 0 }]));
    for (const row of leaves) {
      const requestMonth = leaveByMonth.get(keyForDate(row.startDate));
      if (requestMonth) {
        requestMonth.requests += 1;
        if (row.status === "APPROVED") requestMonth.approved += 1;
        else if (row.status === "PENDING") requestMonth.pending += 1;
        else if (row.status === "REJECTED") requestMonth.rejected += 1;
      }
      monthRanges.forEach((monthRange, index) => {
        const bucket = leaveByMonth.get(keys[index]);
        const days = leaveWorkdayEntries(row, monthRange.start, monthRange.end, weeklyOffs, holidayKeys).reduce((sum, entry) => sum + entry.days, 0);
        if (bucket) {
          bucket.requestedDays += days;
          if (row.status === "APPROVED") bucket.approvedDays += days;
        }
      });
    }
    const leaveTrend = [...leaveByMonth.values()].map((row, index) => ({
      ...row,
      label: new Date(Date.UTC(monthStarts[index].year, monthStarts[index].month - 1, 1)).toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
    }));

    const leaveCalendar = leaves.filter(row => row.status === "APPROVED").flatMap(leave => leaveWorkdayEntries(leave, rangeStart, rangeEnd, weeklyOffs, holidayKeys).map(entry => ({ date: entry.date, status: "LEAVE", type: leave.type, days: entry.days })));

    const goalStatusSummary = reviews.reduce((summary, review) => {
      for (const goal of review.goals || []) {
        const status = String(goal.status || "NOT_STARTED").toUpperCase();
        summary[status] = (summary[status] || 0) + 1;
      }
      return summary;
    }, {});

    const payrollByMonth = new Map(keys.map((key) => [key, { month: key, netPayroll: 0, payslips: 0 }]));
    for (const row of payslips) {
      const bucket = payrollByMonth.get(monthKey(Number(row.year), Number(row.month)));
      if (!bucket) continue;
      bucket.netPayroll += Number(row.netSalary || 0);
      bucket.payslips += 1;
    }
    const payrollTrend = [...payrollByMonth.values()].map((row, index) => ({
      ...row,
      netPayroll: Number(row.netPayroll.toFixed(2)),
      label: new Date(Date.UTC(monthStarts[index].year, monthStarts[index].month - 1, 1)).toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
    }));

    const totalAttendance = attendance.length;
    const attendanceCredit = attendance.reduce((sum, row) => sum + attendanceCreditForRecord(row), 0);
    const completedHours = attendance.filter((row) => Number.isFinite(row.workingHours));
    const totalPayroll = payslips.reduce((sum, row) => sum + Number(row.netSalary || 0), 0);
    const result = {
      employee: {
        id: employee._id,
        employeeId: String(employee._id),
        reportingManager: reportingManager ? { id: String(reportingManager._id), name: `${reportingManager.firstName} ${reportingManager.lastName}`, position: reportingManager.position } : null,
        profilePhotoUrl: employee.profilePhotoUrl || "",
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone,
        position: employee.position,
        department: employee.department || "Unassigned",
        employmentStatus: employee.employmentStatus,
        joinDate: employee.joinDate,
        basicSalary: Number(employee.basicSalary || 0),
        allowance: Number(employee.allowance || 0),
        salaryStructure: currentSalary ? { basic: Number(currentSalary.basic || 0), hra: Number(currentSalary.hra || 0), allowances: Number(currentSalary.allowances || 0), gross: Number(currentSalary.fixedMonthlyGross || 0) } : null,
      },
      currentSalary: currentSalary ? { basic: currentSalary.basic, hra: currentSalary.hra, allowances: currentSalary.allowances, deductions: Number(employee.deductions || 0), gross: currentSalary.fixedMonthlyGross, effectiveFrom: currentSalary.effectiveFrom } : (employee.basicSalary || employee.allowance || employee.deductions ? { basic: Number(employee.basicSalary || 0), hra: 0, allowances: Number(employee.allowance || 0), deductions: Number(employee.deductions || 0), gross: Number(employee.basicSalary || 0) + Number(employee.allowance || 0), effectiveFrom: null } : null),
      salaryProgression: salaryHistory.map(row => ({ effectiveFrom: row.effectiveFrom, gross: row.fixedMonthlyGross })),
      overtimeTrend: payrollSnapshots.map(row => ({ month: monthKey(Number(row.year), Number(row.month)), overtimeHours: Number(row.attendance?.overtimeHours || 0), workingDays: Number(row.attendance?.workingDays || 0) })),
      attendanceCalendar: attendance.map(row => ({ date: keyForDate(row.date), status: row.status, dayType: row.dayType || null, workingHours: Number.isFinite(row.workingHours) ? Number(row.workingHours) : null })),
      leaveCalendar,
      goalStatusSummary,
      summary: {
        attendanceRecords: totalAttendance,
        attendanceRate: totalAttendance ? Number(((attendanceCredit / totalAttendance) * 100).toFixed(1)) : 0,
        lateArrivals: attendance.filter((row) => row.status === "LATE").length,
        averageWorkingHours: completedHours.length ? Number((completedHours.reduce((sum, row) => sum + Number(row.workingHours), 0) / completedHours.length).toFixed(2)) : 0,
        totalOvertimeHours: Number(payrollSnapshots.reduce((sum, row) => sum + Number(row.attendance?.overtimeHours || 0), 0).toFixed(2)),
        averagePerformanceRating: reviews.filter(row => Number.isFinite(row.rating)).length ? Number((reviews.filter(row => Number.isFinite(row.rating)).reduce((sum, row) => sum + Number(row.rating), 0) / reviews.filter(row => Number.isFinite(row.rating)).length).toFixed(2)) : null,
        leaveRequests: leaves.length,
        approvedLeaveDays: leaveCalendar.reduce((sum, row) => sum + Number(row.days || 0), 0),
        lopDays: leaves.every(row => keyForDate(row.startDate) >= keyForDate(rangeStart) && keyForDate(row.endDate) <= keyForDate(new Date(rangeEnd.getTime() - 1))) ? leaves.reduce((sum, row) => sum + Number(row.lopDays || 0), 0) : null,
        netPayroll: Number(totalPayroll.toFixed(2)),
        latestPayslipDeductions: payslips.length ? Number((payslips[payslips.length - 1].breakdown?.deductions?.total ?? payslips[payslips.length - 1].deductions ?? 0).toFixed(2)) : null,
        publishedPayslips: payslips.length,
        departmentHeadcount: departmentCount,
        activeWorkforce: activeEmployees,
        departmentSharePercent: activeEmployees ? Number(((departmentCount / activeEmployees) * 100).toFixed(1)) : 0,
        leaveBalance: leaveBalance?.balances || null,
      },
      attendanceTrend,
      leaveTrend,
      payrollTrend,
      performanceReviews: reviews,
      leaveByType: Object.entries(leaves.filter(row => row.status === "APPROVED").reduce((map, row) => { const key = String(row.type || "OTHER").toUpperCase(); const days = leaveWorkdayEntries(row, rangeStart, rangeEnd, weeklyOffs, holidayKeys).reduce((sum, entry) => sum + entry.days, 0); map[key] = (map[key] || 0) + days; return map; }, {})).map(([type, days]) => ({ type, days: Number(days.toFixed(2)) })),
      generatedAt: new Date().toISOString(),
    };
    return res.json(result);
  } catch (error) {
    console.error("Admin employee analytics failed:", error);
    return res.status(500).json({ error: "Unable to calculate employee analytics" });
  }
}


// Persistent, admin-only employee analytics notes. Notes are append-only to retain an audit trail.
export async function listEmployeeAnalyticsNotes(req, res) {
  if (!adminOnly(req, res)) return;
  try {
    const employeeId = req.params.employeeId;
    if (!mongoose.Types.ObjectId.isValid(employeeId)) return res.status(400).json({ error: "A valid employee ID is required" });
    const employeeExists = await Employee.exists({ _id: employeeId, isDeleted: { $ne: true } });
    if (!employeeExists) return res.status(404).json({ error: "Employee not found" });
    const notes = await EmployeeAnalyticsNote.find({ employee: employeeId })
      .populate("author", "email")
      .sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ notes });
  } catch (error) {
    console.error("Employee analytics notes list failed:", error);
    return res.status(500).json({ error: "Unable to load employee notes" });
  }
}

export async function createEmployeeAnalyticsNote(req, res) {
  if (!adminOnly(req, res)) return;
  try {
    const employeeId = req.params.employeeId;
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!mongoose.Types.ObjectId.isValid(employeeId)) return res.status(400).json({ error: "A valid employee ID is required" });
    if (!body || body.length > 4000) return res.status(400).json({ error: "Note must contain 1–4000 characters" });
    const employee = await Employee.findOne({ _id: employeeId, isDeleted: { $ne: true } }).select("_id firstName lastName").lean();
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    const note = await EmployeeAnalyticsNote.create({ employee: employee._id, author: req.session.userId, body });
    try {
      await HRAuditEvent.create({ actor: req.session.userId, employee: employee._id, action: "EMPLOYEE_ANALYTICS_NOTE_CREATED", resourceType: "EmployeeAnalyticsNote", resourceId: String(note._id), reason: "Admin added an employee analytics note" });
    } catch (auditError) {
      await EmployeeAnalyticsNote.deleteOne({ _id: note._id });
      throw auditError;
    }
    const populated = await EmployeeAnalyticsNote.findById(note._id).populate("author", "email").lean();
    return res.status(201).json({ note: populated });
  } catch (error) {
    console.error("Employee analytics note creation failed:", error);
    return res.status(500).json({ error: "Unable to save employee note" });
  }
}

export async function adminEmployeeTeamAverage(req, res) {
  if (!adminOnly(req, res)) return;
  try {
    const employeeId = req.query.employeeId;
    if (!mongoose.Types.ObjectId.isValid(String(employeeId || ""))) return res.status(400).json({ error: "A valid employeeId is required" });
    const employee = await Employee.findOne({ _id: employeeId, isDeleted: { $ne: true } }).select("department").lean();
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    const todayParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const end = new Date(`${todayParts}T00:00:00+05:30`);
    const start = new Date(end.getTime() - 29 * 86400000);
    const teamFilter = employee.department ? { department: employee.department } : { $or: [{ department: { $exists: false } }, { department: null }] };
    const team = await Employee.find({ ...teamFilter, employmentStatus: "ACTIVE", isDeleted: { $ne: true } }).select("_id").lean();
    const ids = team.map(item => item._id);
    if (!ids.length) return res.json({ department: employee.department || "Unassigned", teamSize: 0, averageAttendance: null, averageWorkingHours: null, averageLeaveDays: null, averagePerformanceRating: null });
    // Use the same inclusive IST date window for attendance, leave and reviews.
    // The previous implementation referenced undefined teamEnd/weeklyOffs/holidayKeys.
    const teamEnd = new Date(end.getTime() + 86400000);
    const [attendance, leaves, reviews, weeklyOffs, holidayKeys] = await Promise.all([
      Attendance.find({ employeeId: { $in: ids }, date: { $gte: start, $lt: teamEnd } }).select("employeeId status workingHours dayType").lean(),
      LeaveApplication.find({ employeeId: { $in: ids }, status: "APPROVED", startDate: { $lt: teamEnd }, endDate: { $gte: start } }).select("employeeId requestedDays paidDays startDate endDate halfDay type").lean(),
      PerformanceReview.find({ employee: { $in: ids }, status: { $in: ["SUBMITTED", "ACKNOWLEDGED"] }, rating: { $ne: null }, createdAt: { $gte: start, $lt: teamEnd } }).select("employee rating").lean(),
      getWeeklyOffDays(),
      getOffHolidayKeys(start, teamEnd),
    ]);
    const byEmployee = new Map(ids.map(id => [String(id), { rows: 0, credit: 0, hours: 0, leave: 0 }]));
    for (const row of attendance) { const bucket = byEmployee.get(String(row.employeeId)); if (!bucket) continue; bucket.rows++; bucket.credit += attendanceCreditForRecord(row); bucket.hours += Number(row.workingHours || 0); }
    for (const row of leaves) { const bucket = byEmployee.get(String(row.employeeId)); if (bucket) bucket.leave += leaveWorkdayEntries(row, start, teamEnd, weeklyOffs, holidayKeys).reduce((sum, entry) => sum + entry.days, 0); }
    const populated = [...byEmployee.values()];
    const attendanceRows = populated.filter(row => row.rows > 0);
    const average = (values) => values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null;
    const averageHours = attendance.length ? average(attendance.map(row => Number(row.workingHours || 0))) : null;
    return res.json({ department: employee.department || "Unassigned", teamSize: ids.length, averageAttendance: average(attendanceRows.map(row => row.credit / row.rows * 100)), averageWorkingHours: averageHours, averageLeaveDays: average(populated.map(row => row.leave)), averagePerformanceRating: average(reviews.filter(row => Number.isFinite(row.rating)).map(row => Number(row.rating))) });
  } catch (error) {
    console.error("Employee team average failed:", error);
    return res.status(500).json({ error: "Unable to calculate team average" });
  }
}
