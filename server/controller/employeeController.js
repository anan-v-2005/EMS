import Attendance from "../models/Attendance.js";
import AttendanceAudit from "../models/AttendanceAudit.js";
import LeaveApplication from "../models/LeaveApplication.js";

import {
  getWeeklyOffDays,
  getOffHolidayKeys,
  istDayKey,
  istDayRange,
} from "../services/workPolicy.js";
import Employee from "../models/Employee.js";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { deleteImage, isCloudinaryConfigured, uploadImage } from "../services/cloudinary.js";
import { sendEmailSafely } from "../config/notmailer.js";
import { employeeCreatedEmail, employeeUpdatedEmail, passwordChangedEmail } from "../utils/emailTemplates.js";
import { WELCOME_TTL_MS, buildResetLink, createPasswordToken } from "../utils/passwordTokens.js";
import { invalidateAuthCache } from "../middleware/auth.js";
import { ensureLeaveBalance } from "../services/leaveBalances.js";
import { deleteEmployeeSalaries, setEmployeeSalary, withCurrentSalary } from "../services/salaryService.js";
import { formatINR, validateMoney, validatePhone } from "../utils/validation.js";
import { MAX_MONTHLY_AMOUNT } from "../constants/limits.js";
import { istDateLabel, istStamp } from "../utils/date.js";

const publicEmployee = (emp) => ({
  ...emp,
  id: emp._id.toString(),
  user: emp.userId && typeof emp.userId === "object"
    ? { email: emp.userId.email, role: emp.userId.role }
    : undefined,
});

export const getEmployee = async (req, res) => {
  try {
    const { department, status } = req.query;
    const where = { isDeleted: { $ne: true } };
    if (department) where.department = department;
    if (status) where.employmentStatus = status;
    const employees = await Employee.find(where).sort({ createdAt: -1 }).populate("userId", "email role").lean();
    await withCurrentSalary(employees);
    return res.json(employees.map(publicEmployee));
  } catch (error) {
    console.error("Get employees error:", error);
    return res.status(500).json({ error: "Failed to load employees" });
  }
};

export const getArchivedEmployees = async (_req, res) => {
  try {
    const employees = await Employee.find({ isDeleted: true }).sort({ updatedAt: -1 }).populate("userId", "email role").lean();
    await withCurrentSalary(employees);
    return res.json(employees.map(publicEmployee));
  } catch (error) {
    console.error("Get archived employees error:", error);
    return res.status(500).json({ error: "Failed to load archived employees" });
  }
};

export const getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: { $ne: true } }).populate("userId", "email role").lean();
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    await withCurrentSalary(employee);
    return res.json(publicEmployee(employee));
  } catch (error) {
    console.error("Get employee by id error:", error);
    return res.status(500).json({ error: "Failed to load employee" });
  }
};

const MIN_PASSWORD_LENGTH = 8;

// Validates and normalises the pay fields. Returns { error } or { basic, allowance, deductions } (undefined = not sent).
const validatePay = ({ basicSalary, allowance, deductions }) => {
  const out = {};
  for (const [key, raw, label] of [["basic", basicSalary, "Basic salary"], ["allowance", allowance, "Allowances"], ["deductions", deductions, "Deductions"]]) {
    if (raw === undefined) { out[key] = undefined; continue; }
    const result = validateMoney(raw, label);
    if (result.error) return { error: result.error };
    out[key] = result.value;
  }
  const gross = (out.basic ?? 0) + (out.allowance ?? 0);
  if (out.basic !== undefined && out.allowance !== undefined && gross > MAX_MONTHLY_AMOUNT) return { error: `Basic salary and allowances together cannot exceed ₹${formatINR(MAX_MONTHLY_AMOUNT)} per month` };
  if (out.deductions !== undefined && out.basic !== undefined && out.allowance !== undefined && out.deductions > gross) return { error: "Deductions cannot be more than basic salary plus allowances" };
  return out;
};

const validateEmployeeFields = ({ firstName, lastName, email, password, phone, position, joinDate }) => {
  if (!firstName || !lastName || !email || !phone || !position || !joinDate || password === "") return "Missing required fields";
  const phoneCheck = validatePhone(phone);
  if (phoneCheck.error) return phoneCheck.error;
  if (password && String(password).length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (new Date(joinDate).toString() === "Invalid Date") return "Invalid join date";
  return null;
};

const maybeUploadPhoto = async (employee, file) => {
  if (!file) return null;
  if (!isCloudinaryConfigured()) {
    const error = new Error("Cloudinary is not configured on the server");
    error.status = 503;
    throw error;
  }
  return uploadImage({
    buffer: file.buffer,
    mimetype: file.mimetype,
    originalname: file.originalname,
    publicId: `employee_${employee._id}`,
  });
};
// Create historical ABSENT records from the employee's joining date
// through yesterday. Today's attendance remains handled by Inngest.

const backfillPastAbsences = async ({ employee, actorUserId }) => {
  if (
    !employee ||
    employee.employmentStatus !== "ACTIVE" ||
    !employee.joinDate
  ) {
    return 0;
  }

  const todayKey = istDayKey();
  const todayRange = istDayRange(todayKey);

  const yesterdayKey = istDayKey(
    new Date(todayRange.start.getTime() - 86400000),
  );

  const joinKey = istDayKey(employee.joinDate);

  // Do not create historical records for future joining dates
  // or when the employee joins today.
  if (joinKey >= todayKey) return 0;

  const joinRange = istDayRange(joinKey);

  const [
    weeklyOffDays,
    holidayKeys,
    approvedLeaves,
    existingRecords,
  ] = await Promise.all([
    getWeeklyOffDays(),

    getOffHolidayKeys(joinRange.start, todayRange.start),

    LeaveApplication.find({
      employeeId: employee._id,
      status: "APPROVED",
      startDate: { $lt: todayRange.start },
      endDate: { $gte: joinRange.start },
    })
      .select("startDate endDate")
      .lean(),

    Attendance.find({
      employeeId: employee._id,
      $or: [
        {
          dateKey: {
            $gte: joinKey,
            $lte: yesterdayKey,
          },
        },
        {
          date: {
            $gte: joinRange.start,
            $lt: todayRange.start,
          },
        },
      ],
    })
      .select("date dateKey")
      .lean(),
  ]);

  // Support weekly-off settings stored as numbers,
  // short names (Sun), or full names (Sunday).
  const weekdayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const weeklyOffSet = new Set(
    weeklyOffDays
      .map((day) => {
        if (typeof day === "number") return day;

        return weekdayMap[String(day).slice(0, 3)];
      })
      .filter((day) => Number.isInteger(day)),
  );

  // Existing attendance must never be overwritten.
  const existingKeys = new Set();

  for (const record of existingRecords) {
    if (record.dateKey) {
      existingKeys.add(record.dateKey);
    }

    if (record.date) {
      existingKeys.add(istDayKey(record.date));
    }
  }

  // Collect all approved leave dates.
  const leaveKeys = new Set();

  for (const leave of approvedLeaves) {
    const leaveStartKey = istDayKey(leave.startDate);
    const leaveEndKey = istDayKey(leave.endDate);

    const startKey =
      leaveStartKey < joinKey ? joinKey : leaveStartKey;

    const endKey =
      leaveEndKey > yesterdayKey ? yesterdayKey : leaveEndKey;

    if (startKey > endKey) continue;

    let leaveCursor = istDayRange(startKey).start;
    const leaveEnd = istDayRange(endKey).end;

    while (leaveCursor < leaveEnd) {
      leaveKeys.add(istDayKey(leaveCursor));

      leaveCursor = new Date(
        leaveCursor.getTime() + 86400000,
      );
    }
  }

  let absentCount = 0;
  let cursor = joinRange.start;

  // Process every date from joining date through yesterday.
  while (cursor < todayRange.start) {
    const dayKey = istDayKey(cursor);

    const weekday = new Date(
      `${dayKey}T00:00:00Z`,
    ).getUTCDay();

    const isWeeklyOff = weeklyOffSet.has(weekday);
    const isHoliday = holidayKeys.has(dayKey);
    const isApprovedLeave = leaveKeys.has(dayKey);
    const alreadyExists = existingKeys.has(dayKey);

    if (
      !isWeeklyOff &&
      !isHoliday &&
      !isApprovedLeave &&
      !alreadyExists
    ) {
      const dayRange = istDayRange(dayKey);

      try {
        const attendance = await Attendance.create({
          employeeId: employee._id,
          date: dayRange.start,
          dateKey: dayKey,
          checkIn: null,
          checkOut: null,
          status: "ABSENT",
          workingHours: null,
          dayType: null,
        });

        try {
          await AttendanceAudit.create({
            attendanceId: attendance._id,
            actorUserId,
            action: "ABSENCE_MARKED",
            reason:
              "Historical absence created from employee joining date.",
          });
        } catch (auditError) {
          // Do not leave an attendance record without its audit entry.
          await Attendance.findByIdAndDelete(attendance._id);
          throw auditError;
        }

        existingKeys.add(dayKey);
        absentCount++;
      } catch (error) {
        if (error.code === 11000) {
          existingKeys.add(dayKey);
          continue;
        }

        throw error;
      }
    }

    cursor = new Date(cursor.getTime() + 86400000);
  }

  return absentCount;
};



export const createEmployee = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      position,
      basicSalary,
      allowance,
      deductions,
      joinDate,
      bio,
      password,
      role,
      department,
      employmentStatus,
      employmentType,
      reportingManager,
    } = req.body;

    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    const validationError = validateEmployeeFields({
      firstName,
      lastName,
      email: normalizedEmail,
      password,
      phone,
      position,
      joinDate,
    });

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const pay = validatePay({
      basicSalary,
      allowance,
      deductions,
    });

    if (pay.error) {
      return res.status(400).json({ error: pay.error });
    }

    if (
      reportingManager &&
      !/^[a-f\d]{24}$/i.test(String(reportingManager))
    ) {
      return res.status(400).json({
        error: "Invalid reporting manager",
      });
    }

    if (reportingManager) {
      const manager = await Employee.findOne({
        _id: reportingManager,
        isDeleted: { $ne: true },
        employmentStatus: "ACTIVE",
      })
        .select("_id")
        .lean();

      if (!manager) {
        return res.status(400).json({
          error: "Reporting manager must be an active employee",
        });
      }
    }

    if (!password) {
      return res.status(400).json({
        error: "A temporary password is required",
      });
    }

    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(400).json({
        error: "Email already exists",
      });
    }

    const hashed = await bcrypt.hash(String(password), 10);
    const welcome = createPasswordToken(WELCOME_TTL_MS);

    const user = await User.create({
      email: normalizedEmail,
      password: hashed,
      role: role === "ADMIN" ? "ADMIN" : "EMPLOYEE",
      mustChangePassword: true,
      resetTokenHash: welcome.hash,
      resetTokenExpires: welcome.expires,
    });

    let createdEmployee;

    try {
      const employee = (createdEmployee = await Employee.create({
        userId: user._id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        phone: String(phone).trim(),
        position: position.trim(),
        department: department || "Engineering",
        basicSalary: pay.basic ?? 0,
        allowance: pay.allowance ?? 0,
        deductions: pay.deductions ?? 0,
        employmentStatus:
          employmentStatus === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        employmentType: [
          "FULL_TIME",
          "PART_TIME",
          "CONTRACT",
          "INTERN",
          "TEMPORARY",
        ].includes(employmentType)
          ? employmentType
          : null,
        reportingManager: reportingManager || null,
        joinDate: new Date(joinDate),
        bio: String(bio || "").trim(),
      }));

      // Store the employee's first salary structure.
      await setEmployeeSalary({
        employeeId: employee._id,
        basic: pay.basic ?? 0,
        allowance: pay.allowance ?? 0,
        effectiveFrom: employee.joinDate,
        createdBy: req.session.userId,
      });

      // Upload employee photo if provided.
      const photo = await maybeUploadPhoto(employee, req.file);

      if (photo) {
        employee.profilePhotoUrl = photo.url;
        employee.profilePhotoPublicId = photo.publicId;
        employee.profilePhotoUploadedBy = "ADMIN";

        await employee.save();
      }

      // Initialize leave balance.
      const leaveYear = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
        }).format(new Date()),
      );

      await ensureLeaveBalance(
        employee._id,
        leaveYear,
      ).catch((balanceError) => {
        console.error(
          "Leave balance initialization for new employee failed:",
          balanceError,
        );
      });

      // IMPORTANT:
      // Backfill historical ABSENT records for newly created employees.
      // Only normal EMPLOYEE accounts are processed.
      // Today's attendance remains handled by Inngest.
      if (
        user.role === "EMPLOYEE" &&
        employee.employmentStatus === "ACTIVE"
      ) {
        try {
          const markedAbsent = await backfillPastAbsences({
            employee,
            actorUserId: req.session.userId,
          });

          console.log(
            `Historical attendance backfill completed for ${employee.firstName} ${employee.lastName}: ${markedAbsent} absent days.`,
          );
        } catch (backfillError) {
          // Do not fail employee creation if historical backfill fails.
          console.error(
            "Historical attendance backfill failed:",
            backfillError,
          );
        }
      }

      // Send employee welcome email.
      const emailContent = employeeCreatedEmail({
        firstName: employee.firstName,
        email: employee.email,
        setPasswordLink: buildResetLink(
          welcome.token,
          employee.email,
        ),
        role: user.role,
        department: employee.department,
        position: employee.position,
        joinDate: istDateLabel(employee.joinDate),
      });

      void sendEmailSafely({
        to: employee.email,
        ...emailContent,
      });

      await withCurrentSalary(employee);

      return res.status(201).json({
        success: true,
        employee,
      });
    } catch (employeeError) {
      if (createdEmployee?._id) {
        await deleteEmployeeSalaries(
          createdEmployee._id,
        ).catch(() => {});

        await Employee.findByIdAndDelete(
          createdEmployee._id,
        ).catch(() => {});
      }

      await User.findByIdAndDelete(user._id).catch(() => {});

      throw employeeError;
    }
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        error: "Email already exists",
      });
    }

    console.error("Create employee error:", error);

    return res.status(
      error.status >= 400 && error.status < 600
        ? error.status
        : 500,
    ).json({
      error: error.message || "Failed to create employee",
    });
  }
};


export const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, position, department, basicSalary, allowance, deductions, joinDate, bio, password, role, employmentStatus, employmentType, reportingManager } = req.body;
    const employee = await Employee.findById(id);
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    const validationError = validateEmployeeFields({ firstName, lastName, email, password: password || undefined, phone, position, joinDate }); // blank = keep the current password
    if (validationError) return res.status(400).json({ error: validationError });
    const pay = validatePay({ basicSalary, allowance, deductions });
    if (pay.error) return res.status(400).json({ error: pay.error });
    if (reportingManager && !/^[a-f\d]{24}$/i.test(String(reportingManager))) return res.status(400).json({ error: "Invalid reporting manager" });
    if (reportingManager) {
      if (String(reportingManager) === String(employee._id)) return res.status(400).json({ error: "An employee cannot report to themselves" });
      const manager = await Employee.findOne({ _id: reportingManager, isDeleted: { $ne: true }, employmentStatus: "ACTIVE" }).select("_id").lean();
      if (!manager) return res.status(400).json({ error: "Reporting manager must be an active employee" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const duplicate = await User.findOne({ email: normalizedEmail, _id: { $ne: employee.userId } });
    if (duplicate) return res.status(400).json({ error: "Email already exists" });

    const before = {
      "name": `${employee.firstName} ${employee.lastName}`, "email": employee.email, "phone": employee.phone,
      "position": employee.position, "department": employee.department, "employment status": employee.employmentStatus,
      "join date": employee.joinDate ? new Date(employee.joinDate).toISOString().slice(0, 10) : "",
    };

    const userDoc = await User.findById(employee.userId);
    if (!userDoc) return res.status(404).json({ error: "Linked user account not found" });
    if (role && role !== userDoc.role && String(userDoc._id) === String(req.session.userId)) {
      return res.status(400).json({ error: "You cannot change your own role" });
    }

    Object.assign(employee, {
      firstName: firstName.trim(), lastName: lastName.trim(), email: normalizedEmail, phone: String(phone).trim(),
      position: position.trim(), department: department || employee.department,
      deductions: pay.deductions ?? employee.deductions, joinDate: new Date(joinDate), bio: String(bio || "").trim(),
      employmentStatus: employmentStatus === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      employmentType: ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "TEMPORARY"].includes(employmentType) ? employmentType : (employmentType === "" ? null : employee.employmentType),
      reportingManager: reportingManager === undefined ? employee.reportingManager : (reportingManager || null),
    });

    const photo = await maybeUploadPhoto(employee, req.file);
    if (photo) {
      employee.profilePhotoUrl = photo.url;
      employee.profilePhotoPublicId = photo.publicId;
      employee.profilePhotoUploadedBy = "ADMIN";
    }
    await employee.save();

    // Pay changes go to the salary structure (single source of truth); the Employee mirror is refreshed there.
    let salaryChanged = false;
    if (pay.basic !== undefined || pay.allowance !== undefined) {
      const currentPay = (await withCurrentSalary({ ...employee.toObject() }));
      const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
      const joinKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(employee.joinDate);
      const result = await setEmployeeSalary({
        employeeId: employee._id,
        basic: pay.basic ?? currentPay.basicSalary,
        allowance: pay.allowance ?? currentPay.allowance,
        effectiveFrom: new Date(`${joinKey > todayKey ? joinKey : todayKey}T00:00:00+05:30`),
        createdBy: req.session.userId,
      });
      salaryChanged = result.changed;
    }

    userDoc.email = normalizedEmail;
    if (role === "ADMIN" || role === "EMPLOYEE") userDoc.role = role;
    if (password) {
      userDoc.password = await bcrypt.hash(String(password), 10);
      userDoc.passwordChangedAt = new Date(); // signs the user out everywhere
      userDoc.mustChangePassword = true; // admin-set passwords are temporary
    }
    await userDoc.save();
    invalidateAuthCache(userDoc._id);

    const after = {
      "name": `${employee.firstName} ${employee.lastName}`, "email": employee.email, "phone": employee.phone,
      "position": employee.position, "department": employee.department, "employment status": employee.employmentStatus,
      "join date": employee.joinDate ? new Date(employee.joinDate).toISOString().slice(0, 10) : "",
    };
    const changes = Object.keys(after).filter((key) => after[key] !== before[key]).map((key) => `${key}: ${before[key] || "—"} → ${after[key] || "—"}`);
    if (photo) changes.push("profile photo");
    if (salaryChanged) changes.push("salary structure (see your payslips for the updated pay)");

    // Only email when something actually changed (no more "profile updated" on every save).
    if (changes.length) void sendEmailSafely({ to: employee.email, ...employeeUpdatedEmail({ firstName: employee.firstName, changes, updatedOn: istStamp() }) });
    if (password) void sendEmailSafely({ to: employee.email, ...passwordChangedEmail({ firstName: employee.firstName, by: "admin", changedOn: istStamp() }) });
    const fresh = await Employee.findById(employee._id).lean();
    await withCurrentSalary(fresh);
    return res.json({ success: true, employee: fresh });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ error: "Email already exists" });
    console.error("Update employee error:", error);
    return res.status(error.status >= 400 && error.status < 600 ? error.status : 500).json({ error: error.message || "Failed to update employee" });
  }
};

export const uploadEmployeePhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Please select an image" });
    if (!isCloudinaryConfigured()) return res.status(503).json({ error: "Cloudinary is not configured on the server" });
    const employee = await Employee.findById(req.params.id);
    if (!employee || employee.isDeleted) return res.status(404).json({ error: "Active employee not found" });

    const photo = await maybeUploadPhoto(employee, req.file);
    employee.profilePhotoUrl = photo.url;
    employee.profilePhotoPublicId = photo.publicId;
    employee.profilePhotoUploadedBy = "ADMIN";
    await employee.save();
    return res.json({ success: true, profilePhotoUrl: photo.url, profilePhotoPublicId: photo.publicId });
  } catch (error) {
    console.error("Employee photo upload error:", error);
    return res.status(error.status >= 400 && error.status < 600 ? error.status : 500).json({ error: error.message || "Failed to upload employee photo" });
  }
};

export const deleteEmployeePhoto = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    if (employee.profilePhotoPublicId && isCloudinaryConfigured()) await deleteImage(employee.profilePhotoPublicId);
    employee.profilePhotoUrl = "";
    employee.profilePhotoPublicId = "";
    employee.profilePhotoUploadedBy = "";
    await employee.save();
    return res.json({ success: true });
  } catch (error) {
    console.error("Employee photo delete error:", error);
    return res.status(500).json({ error: "Failed to delete employee photo" });
  }
};

export const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    if (String(employee.userId) === String(req.session.userId)) return res.status(400).json({ error: "You cannot archive your own account" });
    employee.employmentStatusBeforeArchive = employee.employmentStatus || "ACTIVE";
    employee.isDeleted = true;
    employee.employmentStatus = "INACTIVE";
    await employee.save();
    invalidateAuthCache(employee.userId);
    return res.json({ success: true, message: "Employee archived" });
  } catch (error) {
    console.error("Archive employee error:", error);
    return res.status(500).json({ error: "Failed to archive employee" });
  }
};

export const restoreEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    if (!employee.isDeleted) return res.status(400).json({ error: "Employee is already active" });
    employee.isDeleted = false;
    // Older archived records have no saved prior status; retain the historical
    // restore default for those records while correctly restoring new archives.
    employee.employmentStatus = employee.employmentStatusBeforeArchive || "ACTIVE";
    employee.employmentStatusBeforeArchive = null;
    await employee.save();
    invalidateAuthCache(employee.userId);
    return res.json({ success: true, message: "Employee restored", employee });
  } catch (error) {
    console.error("Restore employee error:", error);
    return res.status(500).json({ error: "Failed to restore employee" });
  }
};
