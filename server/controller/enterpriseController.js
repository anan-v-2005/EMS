import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import LeaveBalance from "../models/LeaveBalance.js";
import Salary from "../models/Salary.js";
import AttendanceAudit from "../models/AttendanceAudit.js";
import { leavePolicy } from "../config/leavePolicy.js";
import { buildBalances } from "../services/leaveAllocation.js";
import { attendancePolicy } from "../config/attendancePolicy.js";
import { calculateAttendance } from "../services/attendanceSummary.js";
import LeaveApplication from "../models/LeaveApplication.js";
import { formatINR, validateMoney } from "../utils/validation.js";
import { MAX_MONTHLY_AMOUNT } from "../constants/limits.js";
import { syncEmployeeMirror } from "../services/salaryService.js";
import {
  countLeaveDays,
  ensureLeaveBalance,
  reserveLeaveBalance,
  releaseLeaveBalance,
} from "../services/leaveBalances.js";

const fail = (res, error, status = 400) =>
  res.status(status).json({ error: error?.message || "Request failed" });
const id = (v) => mongoose.Types.ObjectId.isValid(v);
const safeText = (v, max = 4000) =>
  String(v ?? "")
    .trim()
    .slice(0, max);

export const previewLeave = async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.session.userId })
      .select("_id")
      .lean();
    if (!employee) return fail(res, new Error("Employee not found"), 404);
    const { type, startDate, endDate, halfDay = "false" } = req.query;
    if (
      !["SICK", "CASUAL", "EMERGENCY", "ANNUAL"].includes(type) ||
      !startDate ||
      !endDate
    )
      return fail(res, new Error("Choose a leave type and date range"));
    const counted = await countLeaveDays(
      startDate,
      endDate,
      halfDay === "true",
    );
    const year = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
      }).format(counted.start),
    );
    const balance = await ensureLeaveBalance(employee._id, year);
    const key = {
      SICK: "sick",
      CASUAL: "casual",
      EMERGENCY: "emergency",
      ANNUAL: "annual",
    }[type];
    const bucket = balance.balances[key];
    const paidDays = Math.min(
      counted.days,
      Math.max(0, bucket.total - bucket.used - bucket.pending),
    );
    return res.json({
      requestedDays: counted.days,
      paidDays,
      lopDays: Math.max(0, Number((counted.days - paidDays).toFixed(2))),
      remainingBeforeRequest: bucket.remaining,
      type,
      year,
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const listBalances = async (req, res) => {
  try {
    const currentYear = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
      }).format(new Date()),
    );
    const year = Number(req.query.year || currentYear);
    if (!Number.isInteger(year) || year < 2000 || year > 2200)
      return fail(res, new Error("Invalid leave year"));
    const employeeFilter =
      req.session.role === "ADMIN"
        ? { isDeleted: { $ne: true } }
        : { userId: req.session.userId, isDeleted: { $ne: true } };
    const employees = await Employee.find(employeeFilter)
      .select("_id joinDate")
      .lean();
    if (!employees.length && req.session.role !== "ADMIN")
      return fail(res, new Error("Employee not found"), 404);
    const employeeIds = employees.map((employee) => employee._id);
    const existing = await LeaveBalance.find({
      employee: { $in: employeeIds },
      year,
    })
      .select("employee")
      .lean();
    const have = new Set(existing.map((row) => String(row.employee)));
    const missing = employees.filter(
      (employee) => !have.has(String(employee._id)),
    );
    if (missing.length) {
      await LeaveBalance.insertMany(
        missing.map((employee) => ({
          employee: employee._id,
          year,
          balances: buildBalances({ joinDate: employee.joinDate, year }),
        })),
        { ordered: false },
      ).catch((error) => {
        // Concurrent requests may win the unique employee/year insert. Only duplicate-key
        // races are safe to ignore; all other database errors must reach the caller.
        if (
          error.code !== 11000 &&
          !error.writeErrors?.every((item) => item.code === 11000)
        )
          throw error;
      });
    }
    const data = await LeaveBalance.find({
      employee: { $in: employeeIds },
      year,
    })
      .populate("employee", "firstName lastName email department joinDate")
      .lean();
    return res.json({ data, policy: leavePolicy });
  } catch (error) {
    return fail(res, error);
  }
};

export const listSalaryStructures = async (req, res) => {
  try {
    const data = await Salary.find({
      ...(req.query.employee && id(req.query.employee)
        ? { employee: req.query.employee }
        : {}),
    })
      .populate(
        "employee",
        "firstName lastName email department employmentStatus",
      )
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    res.json({ data });
  } catch (e) {
    fail(res, e);
  }
};
export const saveSalaryStructure = async (req, res) => {
  try {
    const b = req.body || {};

    // 1. Validate required fields
    if (
      !id(b.employee) ||
      b.basic == null ||
      b.basic === "" ||
      !b.effectiveFrom
    ) {
      return fail(
        res,
        new Error(
          "employee, basic salary and effective date are required",
        ),
      );
    }

    // 2. Find employee and verify employment status
    const employee = await Employee.findOne({
      _id: b.employee,
      isDeleted: { $ne: true },
    })
      .select("_id employmentStatus")
      .lean();

    if (!employee) {
      return fail(
        res,
        new Error("Employee not found"),
        404,
      );
    }

    if (employee.employmentStatus !== "ACTIVE") {
      return fail(
        res,
        new Error(
          "Salary structures can only be created for active employees",
        ),
        400,
      );
    }

    // 3. Validate salary components
    const parts = [
      validateMoney(b.basic, "Basic salary", {
        required: true,
      }),
      validateMoney(b.hra, "HRA"),
      validateMoney(b.allowances, "Allowances"),
    ];

    const bad = parts.find((p) => p.error);

    if (bad) {
      return fail(res, new Error(bad.error));
    }

    const [basic, hra, allowances] = parts.map(
      (p) => p.value,
    );

    // 4. Calculate monthly gross
    const gross =
      Math.round((basic + hra + allowances) * 100) / 100;

    if (gross > MAX_MONTHLY_AMOUNT) {
      return fail(
        res,
        new Error(
          `Monthly gross cannot exceed ₹${formatINR(
            MAX_MONTHLY_AMOUNT,
          )}`,
        ),
      );
    }

    // 5. Validate effective date
    const effectiveFrom = new Date(b.effectiveFrom);

    if (Number.isNaN(effectiveFrom.getTime())) {
      return fail(
        res,
        new Error("Invalid effective date"),
      );
    }

    // 6. Prepare salary structure
    const payload = {
      employee: employee._id,
      basic,
      hra,
      allowances,
      fixedMonthlyGross: gross,
      effectiveFrom,
      isActive: b.isActive !== false,
      createdBy: req.session.userId,
    };

    let doc;

    // 7. Update an existing salary structure
    if (req.params.id) {
      doc = await Salary.findById(req.params.id);

      if (!doc) {
        return fail(
          res,
          new Error("Salary structure not found"),
          404,
        );
      }

      // Prevent moving an existing salary record to another employee.
      if (
        String(doc.employee) !== String(employee._id)
      ) {
        return fail(
          res,
          new Error(
            "You cannot change the employee of an existing salary structure",
          ),
          400,
        );
      }

      // Deactivate other salary structures if this one is activated.
      if (payload.isActive) {
        await Salary.updateMany(
          {
            employee: employee._id,
            isActive: true,
            _id: { $ne: doc._id },
          },
          {
            $set: { isActive: false },
          },
        );
      }

      doc.set({
        basic: payload.basic,
        hra: payload.hra,
        allowances: payload.allowances,
        fixedMonthlyGross: payload.fixedMonthlyGross,
        effectiveFrom: payload.effectiveFrom,
        isActive: payload.isActive,
      });

      await doc.save();
    } else {
      // 8. Create a new salary record without deleting history.
      const requestedActive = payload.isActive;

      payload.isActive = false;

      doc = await Salary.create(payload);

      if (requestedActive) {
        await Salary.updateMany(
          {
            employee: employee._id,
            isActive: true,
            _id: { $ne: doc._id },
          },
          {
            $set: { isActive: false },
          },
        );

        doc.isActive = true;
        await doc.save();
      }
    }

    // 9. Synchronize employee salary fields.
    await syncEmployeeMirror(employee._id);

    // 10. Return saved salary record.
    const savedDoc = await Salary.findById(doc._id)
      .populate(
        "employee",
        "firstName lastName email department employmentStatus",
      )
      .lean();

    return res
      .status(req.params.id ? 200 : 201)
      .json({
        success: true,
        data: savedDoc,
      });
  } catch (e) {
    console.error("Save salary structure error:", e);

    return fail(res, e);
  }
};

export const runAutoCheckout = async (req, res) => {
  try {
    const now = new Date();
    const todayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const todayStart = new Date(`${todayKey}T00:00:00+05:30`);
    const localTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
    const [shiftHour, shiftMinute] = String(
      attendancePolicy.SHIFT_END || "18:00",
    )
      .split(":")
      .map(Number);
    const [currentHour, currentMinute] = localTime.split(":").map(Number);
    const shiftEndedToday =
      currentHour * 60 + currentMinute >= shiftHour * 60 + shiftMinute;
    const dateFilter = shiftEndedToday
      ? { $lt: new Date(todayStart.getTime() + 86400000) }
      : { $lt: todayStart };
    const rows = await Attendance.find({
      checkIn: { $ne: null },
      $or: [{ checkOut: null }, { checkOut: { $exists: false } }],
      date: dateFilter,
    })
      .select("_id checkIn checkOut date status")
      .lean();
    let closed = 0;
    for (const row of rows) {
      const key = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(row.date);
      const target = new Date(
        `${key}T${attendancePolicy.SHIFT_END || "18:00"}:00+05:30`,
      );
      const checkout = new Date(
        Math.max(
          new Date(row.checkIn).getTime(),
          Math.min(target.getTime(), now.getTime()),
        ),
      );
      const calculated = calculateAttendance(row.checkIn, checkout, {
        automatic: true,
        existingStatus: row.status,
      });
      const updated = await Attendance.findOneAndUpdate(
        {
          _id: row._id,
          $or: [{ checkOut: null }, { checkOut: { $exists: false } }],
        },
        { $set: calculated },
        { returnDocument: "after" },
      );
      if (updated) {
        await AttendanceAudit.create({
          attendanceId: row._id,
          actorUserId: req.session.userId,
          action: "AUTO_CHECKOUT",
          previousCheckOut: row.checkOut,
          newCheckOut: checkout,
          reason: "Admin-triggered auto-checkout sweep",
        });
        closed++;
      }
    }
    return res.json({
      success: true,
      closed,
      checked: rows.length,
      message: closed
        ? `${closed} open attendance record(s) were closed.`
        : "No eligible open attendance records were found. Records are only closed after the configured shift end.",
    });
  } catch (e) {
    return fail(res, e, 500);
  }
};
export const editCheckout = async (req, res) => {
  try {
    const { checkOut, reason = "" } = req.body || {};
    if (!checkOut || Number.isNaN(new Date(checkOut).getTime()))
      return fail(res, new Error("Choose a valid checkout date and time"));
    const doc = await Attendance.findById(req.params.id);
    if (!doc) return fail(res, new Error("Attendance record not found"), 404);
    if (!doc.checkIn || new Date(checkOut) < new Date(doc.checkIn))
      return fail(
        res,
        new Error("Checkout time cannot be earlier than check-in"),
      );
    const previous = doc.checkOut;
    const calculated = calculateAttendance(doc.checkIn, new Date(checkOut), {
      existingStatus: doc.status,
    });
    doc.set({ ...calculated, needsReview: false });
    await doc.save();
    await AttendanceAudit.create({
      attendanceId: doc._id,
      actorUserId: req.session.userId,
      action: "CHECKOUT_EDIT",
      previousCheckOut: previous,
      newCheckOut: doc.checkOut,
      reason: safeText(reason, 1000),
    });
    res.json({ data: doc });
  } catch (e) {
    fail(res, e);
  }
};

export const convertAbsenceToLeave = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);
    if (!attendance)
      return fail(res, new Error("Attendance record not found"), 404);
    if (attendance.status !== "ABSENT" || !attendance.date)
      return fail(
        res,
        new Error(
          "Only attendance records classified as absent can be converted",
        ),
        409,
      );
    const type = String(req.body?.type || "SICK").toUpperCase();
    if (!["SICK", "CASUAL", "EMERGENCY", "ANNUAL"].includes(type))
      return fail(res, new Error("Invalid leave type"));
    const dateKey =
      attendance.dateKey ||
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(attendance.date);
    const dayStart = new Date(`${dateKey}T00:00:00+05:30`);
    if (
      await LeaveApplication.exists({
        employeeId: attendance.employeeId,
        status: "APPROVED",
        startDate: { $lt: new Date(dayStart.getTime() + 86400000) },
        endDate: { $gte: dayStart },
      })
    )
      return fail(
        res,
        new Error("An approved leave already covers this date"),
        409,
      );
    const { paidDays, lopDays } = await reserveLeaveBalance(
      attendance.employeeId,
      Number(dateKey.slice(0, 4)),
      type,
      1,
    );
    let leave;
    try {
      leave = await LeaveApplication.create({
        employeeId: attendance.employeeId,
        type,
        startDate: new Date(`${dateKey}T00:00:00+05:30`),
        endDate: new Date(`${dateKey}T00:00:00+05:30`),
        reason: `Absence converted to leave by admin ${req.session.userId}`,
        status: "APPROVED",
        requestedDays: 1,
        paidDays,
        lopDays,
      });
      if (paidDays > 0)
        await releaseLeaveBalance(
          attendance.employeeId,
          Number(dateKey.slice(0, 4)),
          type,
          paidDays,
          "APPROVE",
        );
    } catch (error) {
      if (paidDays > 0)
        await releaseLeaveBalance(
          attendance.employeeId,
          Number(dateKey.slice(0, 4)),
          type,
          paidDays,
          "RELEASE",
        ).catch(() => {});
      throw error;
    }
    res.status(201).json({ success: true, data: leave, paidDays, lopDays });
  } catch (e) {
    fail(res, e);
  }
};

export const listAttendanceAudit = async (req, res) => {
  try {
    const data = await AttendanceAudit.find({ attendanceId: req.params.id })
      .populate("actorUserId", "email")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ data });
  } catch (e) {
    fail(res, e);
  }
};
