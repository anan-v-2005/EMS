import { inngest } from "../inngest/index.js";
import Employee from "../models/Employee.js";
import LeaveApplication from "../models/LeaveApplication.js";
import { notifyRole, notifyUsers } from "../utils/notifications.js";
import { sendEmailSafely } from "../config/notmailer.js";
import { leaveStatusEmail } from "../utils/emailTemplates.js";
import { leavePolicy } from "../config/leavePolicy.js";
import { countLeaveDays, reserveLeaveBalance, releaseLeaveBalance, reverseApprovedLeaveBalance } from "../services/leaveBalances.js";

export const createLeave = async (req, res) => {
  try {
    const session = req.session;

    const employee = await Employee.findOne({
      userId: session.userId,
    });

    if (!employee) {
      return res.status(404).json({
        error: "Employee Not Found",
      });
    }

    if (employee.isDeleted) {
      return res.status(403).json({
        error:
          "Your Account is Deactivated . You cannot apply for leave",
      });
    }

    const { type, startDate, endDate, reason, halfDay = false } = req.body;
    if (!type || !startDate || !endDate || !reason) return res.status(400).json({ error: "Missing fields" });
    if (!["SICK", "CASUAL", "EMERGENCY", "ANNUAL"].includes(type)) return res.status(400).json({ error: "Invalid leave type" });
    const counted = await countLeaveDays(startDate, endDate, Boolean(halfDay));
    const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const todayStart = new Date(`${todayKey}T00:00:00+05:30`);
    if (counted.start < todayStart) return res.status(400).json({ error: "Leave date cannot be in the past" });
    const minNotice = Number(leavePolicy.minNoticeDays?.[type] || 0);
    if (minNotice > 0 && counted.start < new Date(todayStart.getTime() + minNotice * 86400000)) {
      return res.status(400).json({ error: `${type.charAt(0) + type.slice(1).toLowerCase()} leave needs at least ${minNotice} day(s) notice. Use emergency or sick leave for urgent absences.` });
    }
    if (counted.days <= 0) return res.status(400).json({ error: "Selected range contains no working days" });
    const istYear = (date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric" }).format(date));
    if (istYear(counted.end) !== istYear(counted.start)) return res.status(400).json({ error: "Please submit separate leave requests for each calendar year" });
    const overlap = await LeaveApplication.exists({ employeeId: employee._id, status: { $in: ["PENDING", "APPROVED"] }, startDate: { $lte: counted.end }, endDate: { $gte: counted.start } });
    if (overlap) return res.status(409).json({ error: "These dates overlap an existing pending or approved leave request" });
    const { paidDays, lopDays } = await reserveLeaveBalance(employee._id, istYear(counted.start), type, counted.days);
    let leave;
    try {
      leave = await LeaveApplication.create({ employeeId: employee._id, type, startDate: counted.start, endDate: counted.end, reason: String(reason).trim(), halfDay: Boolean(halfDay), requestedDays: counted.days, paidDays, lopDays, status: "PENDING" });
    } catch (error) {
      await releaseLeaveBalance(employee._id, istYear(counted.start), type, paidDays, "RELEASE");
      throw error;
    }

    await Promise.all([
      notifyRole({
        role: "ADMIN",
        type: "LEAVE",
        title: "New leave request",
        message: `${employee.firstName} ${employee.lastName} submitted a ${type.toLowerCase()} leave request.`,
        link: "/leave",
      }),
      inngest.send({
      name: "leave/pending",
      data: {
        leaveApplicationId: leave._id,
      },
      }),
    ]).catch((notificationError) => console.error("Leave request saved, but a notification failed:", notificationError));

    return res.json({
      success: true,
      data: leave,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed",
    });
  }
};

export const getLeaves = async (req, res) => {
  try {
    const session = req.session;

    const isAdmin = session.role === "ADMIN";

    if (isAdmin) {
      const status = req.query.status;

      const activeEmployees = await Employee.find({ isDeleted: { $ne: true } }).select("_id").lean();
      const where = { employeeId: { $in: activeEmployees.map((e) => e._id) } };
      if (status) where.status = status;

      const leaves = await LeaveApplication.find(where)
        .populate("employeeId")
        .sort({ createdAt: -1 });

      const data = leaves.map((l) => {
        const obj = l.toObject();

        return {
          ...obj,
          id: obj._id.toString(),
          employee: obj.employeeId,
          employeeId: obj.employeeId?._id?.toString(),
        };
      });

      return res.json({
        data,
      });
    } else {
      const employee = await Employee.findOne({
        userId: session.userId,
      }).lean();

      if (!employee) {
        return res.status(404).json({
          error: "Not Found",
        });
      }

      const status = req.query.status;

      const where = {
        employeeId: employee._id,
      };

      if (status) {
        where.status = status;
      }

      const leaves = await LeaveApplication.find(where).sort({
        createdAt: -1,
      });

      return res.json({
        data: leaves,
        employee: {
          ...employee,
          id: employee._id.toString(),
        },
      });
    }
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed",
    });
  }
};

const fmtDate = (date) => date ? new Date(date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "";

export const updateLeaveStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const note = String(req.body?.note ?? req.body?.reviewNote ?? "").trim().slice(0, 500);

    if (!["APPROVED", "REJECTED", "PENDING"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const leave = await LeaveApplication.findById(req.params.id);
    if (!leave) return res.status(404).json({ error: "Leave application not found" });

    const previousStatus = leave.status;
    if (status === "PENDING") return res.status(400).json({ error: "A reviewed leave request cannot be reset to pending" });
    if (previousStatus === "REJECTED" && status === "APPROVED") return res.status(409).json({ error: "A rejected leave request cannot be approved again. Ask the employee to submit a new request." });
    if (status === "REJECTED" && previousStatus !== "REJECTED" && !note) {
      return res.status(400).json({ error: "Please give a short reason for rejecting this leave request" });
    }

    if (previousStatus !== status) {
      const leaveYear = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric" }).format(leave.startDate));
      if (previousStatus === "PENDING" && status === "APPROVED") await releaseLeaveBalance(leave.employeeId, leaveYear, leave.type, leave.paidDays, "APPROVE");
      else if (previousStatus === "PENDING" && status === "REJECTED") await releaseLeaveBalance(leave.employeeId, leaveYear, leave.type, leave.paidDays, "RELEASE");
      else if (previousStatus === "APPROVED" && status === "REJECTED") {
        await reverseApprovedLeaveBalance(leave.employeeId, leaveYear, leave.type, leave.paidDays);
      }
      leave.reviewedBy = req.session.userId;
      leave.reviewedAt = new Date();
      leave.reviewNote = note;
    }
    leave.status = status;
    await leave.save();

    if (previousStatus !== status) {
      const employee = await Employee.findById(leave.employeeId).select("userId firstName lastName email").lean();
      if (employee?.userId) {
        await notifyUsers({
          userIds: [employee.userId],
          type: "LEAVE",
          title: `Leave ${status.toLowerCase()}`,
          message: `Your ${leave.type.toLowerCase()} leave request has been ${status.toLowerCase()}.${note ? ` Reason: ${note}` : ""}`,
          link: "/leave",
        });
        if (employee.email) {
          void sendEmailSafely({
            to: employee.email,
            ...leaveStatusEmail({
              firstName: employee.firstName, type: leave.type, status, note,
              startDate: fmtDate(leave.startDate), endDate: fmtDate(leave.endDate),
              paidDays: leave.paidDays, lopDays: leave.lopDays,
              requestedDays: leave.requestedDays, reviewedOn: fmtDate(leave.reviewedAt || new Date()),
            }),
          });
        }
      }
    }

    return res.json({ success: true, data: leave });
  } catch (error) {
    console.error("Update leave status error:", error);
    return res.status(500).json({ error: error?.message?.includes("Leave balance") ? error.message : "Failed" });
  }
};
