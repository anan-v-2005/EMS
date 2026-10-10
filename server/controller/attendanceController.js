import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import { getIndiaDayRange } from "../utils/date.js";
import LeaveApplication from "../models/LeaveApplication.js";

export const clockInOut = async (req, res) => {
  try {
    const session = req.session;

    const employee = await Employee.findOne({
      userId: session.userId,
    });

    if (!employee) {
      return res.status(404).json({
        error: "Employee not found",
      });
    }

    if (employee.isDeleted) {
      return res.status(403).json({
        error:
          "Your Account is Deactivated,You can not clock in/out",
      });
    }

    const { start: today, end: tomorrow } = getIndiaDayRange();

    const approvedLeave = await LeaveApplication.exists({
      employeeId: employee._id,
      status: "APPROVED",
      startDate: { $lt: tomorrow },
      endDate: { $gte: today },
    });
    if (approvedLeave) {
      return res.status(403).json({
        error: "You are on leave today and cannot mark attendance.",
      });
    }

    const existing = await Attendance.findOne({
      employeeId: employee._id,
      date: today,
    });

    const now = new Date();

    // CHECK IN
    if (!existing) {
      const indiaParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(now);
      const hour = Number(indiaParts.find((part) => part.type === "hour")?.value || 0);
      const minute = Number(indiaParts.find((part) => part.type === "minute")?.value || 0);
      const isLate = hour > 9 || (hour === 9 && minute > 0);

      const attendance = await Attendance.create({
        employeeId: employee._id,
        date: today,
        checkIn: now,
        status: isLate ? "LATE" : "PRESENT",
      });


      return res.json({
        success: true,
        type: "CHECK_IN",
        data: attendance,
      });
    }

    // CHECK OUT
    else if (!existing.checkOut) {
      const checkInTime = new Date(
        existing.checkIn
      ).getTime();

      const diffMs = now.getTime() - checkInTime;

      const diffHours =
        diffMs / (1000 * 60 * 60);

      existing.checkOut = now;

      const workingHours = parseFloat(
        diffHours.toFixed(2)
      );

      let dayType = "Half Day";

      if (workingHours >= 8) {
        dayType = "Full Day";
      } else if (workingHours >= 6) {
        dayType = "Three Quarter Day";
      } else if (workingHours >= 4) {
        dayType = "Half Day";
      } else {
        dayType = "Short Day";
      }

      existing.workingHours = workingHours;
      existing.dayType = dayType;

      await existing.save();

      return res.json({
        success: true,
        type: "CHECK_OUT",
        data: existing,
      });
    }

    // ALREADY CHECKED OUT
    else {
      return res.json({
        success: true,
        type: "CHECK_OUT",
        data: existing,
      });
    }
  } catch (error) {
    console.error(
      "Error occurred while clocking in/out:",
      error
    );

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

export const getAttendance = async (req, res) => {
  try {
    const session = req.session;

    const limit = Math.min(Math.max(parseInt(req.query.limit || 30, 10) || 30, 1), 100);

    if (session.role === "ADMIN") {
      const activeEmployees = await Employee.find({ isDeleted: { $ne: true } }).select("_id").lean();
      const history = await Attendance.find({ employeeId: { $in: activeEmployees.map((e) => e._id) } })
        .populate("employeeId", "firstName lastName department position")
        .sort({ date: -1 })
        .limit(limit)
        .lean();

      return res.json({
        role: "ADMIN",
        data: history.map((item) => ({
          ...item,
          id: item._id.toString(),
          employee: item.employeeId,
        })),
      });
    }

    const employee = await Employee.findOne({
      userId: session.userId,
    });

    if (!employee) {
      return res.status(404).json({
        error: "Employee not found",
      });
    }

    const history = await Attendance.find({
      employeeId: employee._id,
    })
      .sort({ date: -1 })
      .limit(limit);

    return res.json({
      role: "EMPLOYEE",
      data: history,
      employee: {
        isDeleted: employee.isDeleted,
      },
    });
  } catch (error) {
    console.error(
      "Error occurred while getting attendance:",
      error
    );

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};