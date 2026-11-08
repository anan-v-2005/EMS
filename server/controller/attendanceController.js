
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import AttendanceAudit from "../models/AttendanceAudit.js";
import { getIndiaDayRange } from "../utils/date.js";
import LeaveApplication from "../models/LeaveApplication.js";
import { calculateAttendance } from "../services/attendanceSummary.js";
import {
  getWeeklyOffDays,
  getOffHolidayKeys,
  istDayKey,
  istDayRange,
  SHORT_TO_INDEX,
  WEEKDAY_NAMES,
} from "../services/workPolicy.js";
import { attendancePolicy } from "../config/attendancePolicy.js";

// Manual checkout email
import { manualCheckoutEmail } from "../utils/emailTemplates.js";
import { sendEmailSafely } from "../config/notmailer.js";

const getISTTimeParts = (date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: attendancePolicy.TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const getPart = (type) => parts.find((part) => part.type === type)?.value;

  return {
    weekday: getPart("weekday"),
    hour: Number(getPart("hour")),
    minute: Number(getPart("minute")),
  };
};

const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// ------------------------------------------
// CLOCK IN / CLOCK OUT
// ------------------------------------------

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
        error: "Your Account is Deactivated,You can not clock in/out",
      });
    }

    if (employee.employmentStatus && employee.employmentStatus !== "ACTIVE") {
      return res.status(403).json({
        error: "Only active employees can mark attendance.",
      });
    }

    const { start: today, end: tomorrow } = getIndiaDayRange();
    const now = new Date();

    const { weekday, hour, minute } = getISTTimeParts(now);
    const currentMinutes = hour * 60 + minute;

    const checkInStart = timeToMinutes(attendancePolicy.SHIFT_START);
    const checkInCutoff = timeToMinutes(attendancePolicy.CHECK_IN_CUTOFF);
    const lateAfter = checkInStart + attendancePolicy.GRACE_MINUTES;

    const existing = await Attendance.findOne({
      employeeId: employee._id,
      date: today,
    });

    // Apply weekly-off and approved-leave restrictions
    // only when starting a new attendance session.
    if (!existing) {
      const weeklyOffs = await getWeeklyOffDays();
      const weekdayIndex = SHORT_TO_INDEX[weekday];

      if (weeklyOffs.includes(weekdayIndex)) {
        return res.status(403).json({
          error: `Attendance cannot be marked on ${WEEKDAY_NAMES[weekdayIndex]}.`,
        });
      }

      const approvedLeave = await LeaveApplication.exists({
        employeeId: employee._id,
        status: "APPROVED",
        startDate: { $lt: tomorrow },
        endDate: { $gte: today },
      });

      if (approvedLeave) {
        return res.status(403).json({
          error:
            "You have approved leave for this date, so attendance cannot be marked.",
        });
      }
    }

    // ------------------------------------------
    // CHECK IN
    // ------------------------------------------

    if (!existing) {
      if (currentMinutes < checkInStart) {
        return res.status(403).json({
          error: `Check-in is not allowed before ${attendancePolicy.SHIFT_START} AM IST.`,
        });
      }

      if (currentMinutes >= checkInCutoff) {
        return res.status(403).json({
          error: `Check-in is closed after ${attendancePolicy.CHECK_IN_CUTOFF} PM IST. Please contact your administrator if you need an attendance correction.`,
        });
      }

      const isLate = currentMinutes >= lateAfter;

      const dateKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: attendancePolicy.TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);

      const attendance = await Attendance.create({
        employeeId: employee._id,
        date: today,
        dateKey,
        checkIn: now,
        status: isLate ? "LATE" : "PRESENT",
      });

      await AttendanceAudit.create({
        attendanceId: attendance._id,
        actorUserId: session.userId,
        action: "CHECK_IN",
        newCheckIn: attendance.checkIn,
        reason: "Employee check-in",
      });

      return res.json({
        success: true,
        type: "CHECK_IN",
        data: attendance,
      });
    }

    if (existing.status === "ABSENT" && !existing.checkIn) {
      return res.status(403).json({
        error:
          "Your attendance has already been marked ABSENT for today. Please contact your administrator if this is incorrect.",
        data: existing,
      });
    }

    // ------------------------------------------
    // CHECK OUT
    // ------------------------------------------

    if (!existing.checkOut) {
      if (
        !existing.checkIn ||
        new Date(existing.checkIn).getTime() > now.getTime()
      ) {
        return res.status(409).json({
          error:
            "Attendance check-in timestamp is invalid. Please contact an administrator.",
        });
      }

      const calculated = calculateAttendance(existing.checkIn, now, {
        existingStatus: existing.status,
      });

      existing.set(calculated);
      await existing.save();

      // Create audit record before attempting email.
      await AttendanceAudit.create({
        attendanceId: existing._id,
        actorUserId: session.userId,
        action: "CHECK_OUT",
        previousCheckOut: null,
        newCheckOut: existing.checkOut,
        reason: "Employee check-out",
      });

      // ------------------------------------------
      // SEND MANUAL CHECKOUT EMAIL
      // ------------------------------------------

      const emailDate = new Intl.DateTimeFormat("en-IN", {
        timeZone: attendancePolicy.TIMEZONE,
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(now);

      const checkOutTime = new Intl.DateTimeFormat("en-IN", {
        timeZone: attendancePolicy.TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h12",
      }).format(now);

      if (employee.email) {
        await sendEmailSafely({
          to: employee.email,
          ...manualCheckoutEmail({
            firstName: employee.firstName,
            department: employee.department,
            date: emailDate,
            checkOutTime,
          }),
        });
      }

      return res.json({
        success: true,
        type: "CHECK_OUT",
        data: existing,
      });
    }

    // ------------------------------------------
    // ALREADY CHECKED OUT
    // ------------------------------------------

    return res.status(409).json({
      error: "This attendance session has already been checked out.",
      data: existing,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        error:
          "Attendance has already been started for today. Refresh your attendance status.",
      });
    }

    console.error("Error occurred while clocking in/out:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

// ------------------------------------------
// GET ATTENDANCE
// ------------------------------------------

export const getAttendance = async (req, res) => {
  try {
    const session = req.session;

    const limit = Math.min(
      Math.max(parseInt(req.query.limit || 30, 10) || 30, 1),
      500,
    );

    // ------------------------------------------
    // ADMIN ATTENDANCE
    // ------------------------------------------

    if (session.role === "ADMIN") {
      const period = String(req.query.period || "30d");
      const now = new Date();

      const istToday = istDayKey(now);
      const todayRange = istDayRange(istToday);
      const todayStart = todayRange.start;

      const periodDays = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "1y": 365,
      };

      if (period !== "all" && !periodDays[period]) {
        return res.status(400).json({
          error: "Unsupported attendance period",
        });
      }

      const periodStart =
        period === "all"
          ? null
          : new Date(
              todayStart.getTime() - (periodDays[period] - 1) * 86400000,
            );

      const dateFilter = periodStart
        ? {
            date: {
              $gte: periodStart,
              $lt: todayRange.end,
            },
          }
        : {};

      // Get non-deleted employees.
      const activeEmployees = await Employee.find({
        isDeleted: { $ne: true },
      })
        .select("_id firstName lastName department position")
        .lean();

      const employeeIds = activeEmployees.map((employee) => employee._id);

      const employeeMap = new Map(
        activeEmployees.map((employee) => [employee._id.toString(), employee]),
      );

      // Fetch attendance, approved leaves and weekly offs.
      const [attendanceRows, approvedLeaves, weeklyOffs] = await Promise.all([
        Attendance.find({
          employeeId: { $in: employeeIds },
          ...dateFilter,
        })
          .populate("employeeId", "firstName lastName department position")
          .sort({ date: -1 })
          .lean(),

        LeaveApplication.find({
          employeeId: { $in: employeeIds },
          status: "APPROVED",
          endDate: {
            $gte: periodStart || new Date(0),
          },
          startDate: {
            $lt: todayRange.end,
          },
        })
          .select("_id employeeId type startDate endDate halfDay")
          .lean(),

        getWeeklyOffDays(),
      ]);

      // Determine date range for company holidays.
      let holidayStart = periodStart || todayStart;

      if (!periodStart && approvedLeaves.length > 0) {
        const earliestLeave = approvedLeaves.reduce(
          (earliest, leave) =>
            new Date(leave.startDate) < earliest
              ? new Date(leave.startDate)
              : earliest,
          new Date(approvedLeaves[0].startDate),
        );

        holidayStart = istDayRange(istDayKey(earliestLeave)).start;
      }

      const holidayKeys = await getOffHolidayKeys(
        holidayStart,
        todayRange.end,
      );

      // Keep actual attendance records first.
      const dailyRecords = new Map();

      attendanceRows.forEach((record) => {
        const employeeId =
          record.employeeId?._id?.toString() || record.employeeId?.toString();

        if (!employeeId) return;

        const dayKey = record.dateKey || istDayKey(record.date);
        const key = `${employeeId}:${dayKey}`;

        dailyRecords.set(key, {
          ...record,
          id: record._id.toString(),
          dateKey: dayKey,
          employee: record.employeeId,
        });
      });

      // Add approved leave dates as display-only LEAVE records.
      for (const leave of approvedLeaves) {
        const employeeId = leave.employeeId.toString();
        const employee = employeeMap.get(employeeId);

        if (!employee) continue;

        let effectiveStart = istDayKey(leave.startDate);
        const leaveEnd = istDayKey(leave.endDate);

        if (periodStart) {
          const periodStartKey = istDayKey(periodStart);

          if (effectiveStart < periodStartKey) {
            effectiveStart = periodStartKey;
          }
        }

        const effectiveEnd = leaveEnd > istToday ? istToday : leaveEnd;

        if (effectiveStart > effectiveEnd) continue;

        let cursor = new Date(`${effectiveStart}T00:00:00Z`);
        const lastDay = new Date(`${effectiveEnd}T00:00:00Z`);

        while (cursor <= lastDay) {
          const dayKey = cursor.toISOString().slice(0, 10);
          const weekday = cursor.getUTCDay();

          // Exclude weekly offs and company holidays.
          if (!weeklyOffs.includes(weekday) && !holidayKeys.has(dayKey)) {
            const key = `${employeeId}:${dayKey}`;
            const existing = dailyRecords.get(key);

            // Preserve real attendance when an employee checked in.
            // Approved leave overrides an absence-only record.
            if (!existing?.checkIn) {
              const { start } = istDayRange(dayKey);

              dailyRecords.set(key, {
                ...(existing || {}),
                _id: existing?._id || null,
                id: existing?.id || null,
                employeeId: leave.employeeId,
                employee,
                date: start,
                dateKey: dayKey,
                checkIn: null,
                checkOut: null,
                workingHours: null,
                status: "LEAVE",
                leaveType: leave.type,
                halfDay: leave.halfDay,
                isSyntheticLeave: !existing,
              });
            }
          }

          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
      }

      const history = Array.from(dailyRecords.values())
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, limit);

      return res.json({
        role: "ADMIN",
        data: history,
      });
    }

    // ------------------------------------------
    // EMPLOYEE ATTENDANCE
    // ------------------------------------------

    const employee = await Employee.findOne({
      userId: session.userId,
    });

    if (!employee) {
      return res.status(404).json({
        error: "Employee not found",
      });
    }

    // Employee dropdown periods.
    const period = String(req.query.period || "30d");

    const employeePeriodDays = {
      "7d": 7,
      "30d": 30,
      "150d": 150,
    };

    if (period !== "all" && !employeePeriodDays[period]) {
      return res.status(400).json({
        error: "Unsupported attendance period",
      });
    }

    const todayKey = istDayKey(new Date());
    const todayRange = istDayRange(todayKey);

    // For selected periods, calculate the beginning of the range.
    // For "all", the actual earliest available record is determined below.
    const periodStart =
      period === "all"
        ? null
        : new Date(
            todayRange.start.getTime() -
              (employeePeriodDays[period] - 1) * 86400000,
          );

    const rangeEnd = todayRange.end;
    const startKey = periodStart ? istDayKey(periodStart) : null;

    // Fetch actual attendance and approved leave records.
    const attendanceFilter = periodStart
      ? {
          employeeId: employee._id,
          $or: [
            {
              dateKey: {
                $gte: startKey,
                $lte: todayKey,
              },
            },
            {
              date: {
                $gte: periodStart,
                $lt: rangeEnd,
              },
            },
          ],
        }
      : {
          employeeId: employee._id,
          $or: [
            {
              dateKey: {
                $lte: todayKey,
              },
            },
            {
              date: {
                $lt: rangeEnd,
              },
            },
          ],
        };

    const [attendanceRows, approvedLeaves, weeklyOffs] = await Promise.all([
      Attendance.find(attendanceFilter)
        .sort({ date: -1 })
        .lean(),

      LeaveApplication.find({
        employeeId: employee._id,
        status: "APPROVED",
        startDate: { $lt: rangeEnd },
        ...(periodStart ? { endDate: { $gte: periodStart } } : {}),
      })
        .select("_id type startDate endDate halfDay")
        .lean(),

      getWeeklyOffDays(),
    ]);

    // Determine the earliest relevant date for holiday lookup.
    // In "all" mode, include employee join date, attendance and leave history.
    let holidayStart = periodStart || todayRange.start;

    if (!periodStart) {
      const candidateDates = [];

      if (employee.joinDate) {
        const joinDate = new Date(employee.joinDate);

        if (!Number.isNaN(joinDate.getTime())) {
          candidateDates.push(istDayRange(istDayKey(joinDate)).start);
        }
      }

      attendanceRows.forEach((record) => {
        const recordDate = record.dateKey
          ? istDayRange(record.dateKey).start
          : istDayRange(istDayKey(record.date)).start;

        if (!Number.isNaN(recordDate.getTime())) {
          candidateDates.push(recordDate);
        }
      });

      approvedLeaves.forEach((leave) => {
        const leaveDate = new Date(leave.startDate);

        if (!Number.isNaN(leaveDate.getTime())) {
          candidateDates.push(
            istDayRange(istDayKey(leaveDate)).start,
          );
        }
      });

      if (candidateDates.length > 0) {
        holidayStart = candidateDates.reduce(
          (earliest, date) => (date < earliest ? date : earliest),
          candidateDates[0],
        );
      }
    }

    const holidayKeys = await getOffHolidayKeys(
      holidayStart,
      rangeEnd,
    );

    // Keep actual attendance records.
    const dailyRecords = new Map();

    attendanceRows.forEach((record) => {
      const dayKey = record.dateKey || istDayKey(record.date);

      dailyRecords.set(dayKey, {
        ...record,
        dateKey: dayKey,
      });
    });

    // Add approved leave dates as display-only LEAVE records.
    for (const leave of approvedLeaves) {
      const leaveStart = istDayKey(leave.startDate);
      const leaveEnd = istDayKey(leave.endDate);

      const effectiveStart = periodStart
        ? leaveStart < startKey
          ? startKey
          : leaveStart
        : leaveStart;

      const effectiveEnd = leaveEnd > todayKey ? todayKey : leaveEnd;

      if (effectiveStart > effectiveEnd) continue;

      let cursor = new Date(`${effectiveStart}T00:00:00Z`);
      const lastDay = new Date(`${effectiveEnd}T00:00:00Z`);

      while (cursor <= lastDay) {
        const dayKey = cursor.toISOString().slice(0, 10);
        const weekday = cursor.getUTCDay();

        // Exclude weekly offs and company holidays.
        if (!weeklyOffs.includes(weekday) && !holidayKeys.has(dayKey)) {
          const existing = dailyRecords.get(dayKey);

          // Preserve actual attendance if the employee checked in.
          if (!existing?.checkIn) {
            const { start } = istDayRange(dayKey);

            dailyRecords.set(dayKey, {
              ...(existing || {}),

              // Display-only record: no fake MongoDB ID.
              _id: existing?._id || null,
              id: existing?.id || null,

              employeeId: employee._id,

              date: start,
              dateKey: dayKey,

              checkIn: null,
              checkOut: null,
              workingHours: null,

              dayType: null,
              status: "LEAVE",

              leaveType: leave.type,
              halfDay: leave.halfDay,

              isSyntheticLeave: !existing,
            });
          }
        }

        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    const history = Array.from(dailyRecords.values()).sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );

    return res.json({
      role: "EMPLOYEE",
      data: history,
      employee: {
        isDeleted: employee.isDeleted,
      },
    });
  } catch (error) {
    console.error("Error occurred while getting attendance:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};
