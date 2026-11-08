import { DEPARTMENTS } from "../constants/department.js";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import LeaveApplication from "../models/LeaveApplication.js";
import Payslip, { PUBLISHED } from "../models/Payslip.js";
import { getIndiaDayRange, getIndiaMonthRange } from "../utils/date.js";

export const getDashboard = async (req, res) => {
  try {
    const session = req.session;
    const { start: todayStart, end: todayEnd } = getIndiaDayRange();
    const { start: monthStart, end: monthEnd } = getIndiaMonthRange();

    if (session.role === "ADMIN") {
      const employees = await Employee.find({ isDeleted: { $ne: true } }).select("firstName lastName department employmentStatus joinDate").lean();
      const active = employees.filter((e) => e.employmentStatus === "ACTIVE");
      const [todayRecords, pendingLeaves, newHires, onLeave] = await Promise.all([
        Attendance.find({ date: { $gte: todayStart, $lt: todayEnd } }).populate("employeeId", "firstName lastName department").sort({ checkIn: 1 }).lean(),
        LeaveApplication.find({ status: "PENDING" }).populate("employeeId", "firstName lastName department").sort({ createdAt: -1 }).limit(8).lean(),
        Employee.countDocuments({ isDeleted: { $ne: true }, joinDate: { $gte: monthStart, $lt: monthEnd } }),
        LeaveApplication.find({ status: "APPROVED", startDate: { $lt: todayEnd }, endDate: { $gte: todayStart } }).select("employeeId").lean(),
      ]);
      const departments = DEPARTMENTS.map((department) => ({ department, count: employees.filter((e) => e.department === department).length })).filter((d) => d.count);
      const present = todayRecords.filter((r) => ["PRESENT", "LATE"].includes(r.status)).length;
      const late = todayRecords.filter((r) => r.status === "LATE").length;
      const activeToday = active.length - onLeave.length;
      const attendanceRate = activeToday > 0 ? Number(((present / activeToday) * 100).toFixed(1)) : 0;
      const activity = [
        ...(newHires ? [{ type: "employee", title: `${newHires} new hire${newHires === 1 ? "" : "s"} this month`, description: "New employees joined the organization", date: monthStart }] : []),
        ...pendingLeaves.slice(0, 4).map((l) => ({ type: "leave", title: `${l.employeeId?.firstName || "Employee"} submitted leave`, description: `${l.type} request awaiting review`, date: l.createdAt })),
        ...todayRecords.slice(0, 4).map((r) => ({ type: "attendance", title: `${r.employeeId?.firstName || "Employee"} checked in`, description: `${r.status}${Number.isFinite(r.workingHours) ? ` · ${r.workingHours}h` : ""}`, date: r.checkIn })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
      return res.json({ role: "ADMIN", totalEmployees: employees.length, activeEmployees: active.length, employeesOnLeave: onLeave.length, totalDepartments: departments.length, newHiresThisMonth: newHires, todayAttendance: present, todayLate: late, attendanceRate, pendingLeaves: pendingLeaves.length, pendingLeaveRequests: pendingLeaves.map((l) => ({ id: l._id.toString(), employee: l.employeeId ? `${l.employeeId.firstName} ${l.employeeId.lastName}` : "Unknown", department: l.employeeId?.department || "—", type: l.type, startDate: l.startDate, endDate: l.endDate, status: l.status })), today: todayRecords.map((r) => ({ employee: r.employeeId ? `${r.employeeId.firstName} ${r.employeeId.lastName}` : "Unknown", department: r.employeeId?.department || "—", status: r.status, workingHours: r.workingHours })), departments, activity, attritionRate: null });
    }

    const employee = await Employee.findOne({ userId: session.userId, isDeleted: { $ne: true } }).lean();
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    const [today, monthRecords, pendingLeaves, latestPayslip] = await Promise.all([
      Attendance.findOne({ employeeId: employee._id, date: todayStart }).lean(),
      Attendance.find({ employeeId: employee._id, date: { $gte: monthStart, $lt: monthEnd } }).lean(),
      LeaveApplication.find({ employeeId: employee._id, status: "PENDING" }).countDocuments(),
      Payslip.findOne({ employeeId: employee._id, ...PUBLISHED }).sort({ year: -1, month: -1 }).lean(),
    ]);
    const presentDays = monthRecords.filter((r) => ["PRESENT", "LATE"].includes(r.status)).length;
    const completed = monthRecords.filter((r) => Number.isFinite(r.workingHours));
    const avgHours = completed.length ? Number((completed.reduce((s, r) => s + Number(r.workingHours), 0) / completed.length).toFixed(2)) : 0;
    return res.json({ role: "EMPLOYEE", employee: { ...employee, id: employee._id.toString(), currentMonthAttendance: presentDays, pendingLeaves, latestPayslip: latestPayslip ? { ...latestPayslip, id: latestPayslip._id.toString() } : null }, today: today ? { status: today.status, checkIn: today.checkIn, checkOut: today.checkOut, workingHours: today.workingHours, dayType: today.dayType } : null, summary: { presentDays, lateDays: monthRecords.filter((r) => r.status === "LATE").length, completedDays: completed.length, avgHours }, });
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({ error: "Failed to load dashboard" });
  }
};
