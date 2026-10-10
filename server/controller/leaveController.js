import { inngest } from "../inngest/index.js";
import Employee from "../models/Employee.js";
import LeaveApplication from "../models/LeaveApplication.js";
import { notifyRole, notifyUsers } from "../utils/notifications.js";
import { sendEmailSafely } from "../config/notmailer.js";
import { leaveStatusEmail } from "../utils/emailTemplates.js";

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

    const {
      type,
      startDate,
      endDate,
      reason,
    } = req.body;

    if (!type || !startDate || !endDate || !reason) {
      return res.status(400).json({
        error: "Missing Fields",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start <= today || end <= today) {
      return res.status(400).json({
        error: "Leave date must be in the future",
      });
    }

    if (end < start) {
      return res.status(400).json({
        error: "Leave dates must be in the future",
      });
    }

    const leave = await LeaveApplication.create({
      employeeId: employee._id,
      type,
      startDate: start,
      endDate: end,
      reason,
      status: "PENDING",
    });

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
    ]);

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

export const updateLeaveStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (
      !["APPROVED", "REJECTED", "PENDING"].includes(status)
    ) {
      return res.status(400).json({
        error: "Invalid status",
      });
    }

    const leave = await LeaveApplication.findById(req.params.id);
    if (!leave) return res.status(404).json({ error: "Leave application not found" });

    const previousStatus = leave.status;
    leave.status = status;
    await leave.save();

    if (previousStatus !== status) {
      const employee = await Employee.findById(leave.employeeId).select("userId firstName lastName email").lean();
      if (employee?.userId) {
        await notifyUsers({
          userIds: [employee.userId],
          type: "LEAVE",
          title: `Leave ${status.toLowerCase()}`,
          message: `Your ${leave.type.toLowerCase()} leave request has been ${status.toLowerCase()}.`,
          link: "/leave",
        });
        if (employee.email) {
          void sendEmailSafely({ to: employee.email, ...leaveStatusEmail({ firstName: employee.firstName, type: leave.type, status }) });
        }
      }
    }

    return res.json({ success: true, data: leave });
  } catch (error) {
    return res.status(500).json({
      error: "Failed",
    });
  }
};