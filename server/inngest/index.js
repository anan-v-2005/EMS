import { Inngest } from "inngest";
import Attendance from "../models/Attendance.js";
import AttendanceAudit from "../models/AttendanceAudit.js";
import Employee from "../models/Employee.js";
import LeaveApplication from "../models/LeaveApplication.js";
import User from "../models/User.js";
import { sendEmailSafely } from "../config/notmailer.js";
import {
  attendanceReminderEmail,
  autoCheckoutEmail,
  adminDigestEmail,
  leavePendingReminderEmail,
  absenceMarkedEmail,
} from "../utils/emailTemplates.js";
import {
  isWorkingDay,
  istDayKey,
  istDayRange,
  getWeeklyOffDays,
  getOffHolidayKeys,
} from "../services/workPolicy.js";
import { resetLeaveBalancesForYear } from "../services/leaveBalanceJobs.js";
import { calculateAttendance } from "../services/attendanceSummary.js";
import { istDateLabel } from "../utils/date.js";
import { attendancePolicy } from "../config/attendancePolicy.js";

// Create Inngest client
export const inngest = new Inngest({
  id: "FULLSTACKPROJECT-EMS-CMPICA",
});

// =====================================================
// 1. AUTO CHECKOUT
// Runs at 6:05 PM and 11:55 PM Asia/Kolkata time.
// Records checkout at 6:00 PM, unless check-in was later.
// =====================================================

const autoCheckOut = inngest.createFunction(
  {
    id: "daily-auto-check-out-and-recovery",
    triggers: [
      { cron: "TZ=Asia/Kolkata 0 18 * * *" },
      { cron: "TZ=Asia/Kolkata 0 21 * * *" },
    ],
  },
  async ({ step }) => {
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const start = new Date(`${day}T00:00:00+05:30`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    // TEMPORARY TEST: checkout at 4:30 PM IST.
    // Restore attendancePolicy.SHIFT_END after testing.
    const checkoutAt = new Date(
      `${day}T${attendancePolicy.SHIFT_END}:00+05:30`,
    );
    const now = new Date();
    // The 18:05 trigger is a convenient default. If an organisation changes
    // its configured shift end to a later time, do not close records early.
    if (now.getTime() < checkoutAt.getTime()) {
      return {
        checkedOut: 0,
        pending: 0,
        scheduledCheckout: checkoutAt.toISOString(),
        timezone: attendancePolicy.TIMEZONE,
        skipped: "Configured shift has not ended yet.",
      };
    }

    const pending = await step.run(
      "find-attendance-needing-auto-checkout",
      async () => {
        const rows = await Attendance.find({
          date: { $gte: start, $lt: end },
          checkIn: { $ne: null },
          $or: [{ checkOut: null }, { checkOut: { $exists: false } }],
        })
          .populate(
            "employeeId",
            "firstName lastName email department isDeleted employmentStatus",
          )
          .lean();

        return rows
          .filter(
            (row) =>
              row.employeeId &&
              !row.employeeId.isDeleted &&
              row.employeeId.employmentStatus === "ACTIVE",
          )
          .map((row) => ({
            attendanceId: row._id.toString(),
            employeeId: row.employeeId._id.toString(),
            firstName: row.employeeId.firstName,
            email: row.employeeId.email,
            department: row.employeeId.department,
            checkIn: row.checkIn,
            status: row.status,
          }));
      },
    );

    let checkedOutCount = 0;

    for (const row of pending) {
      const updated = await step.run(
        `auto-checkout-${row.attendanceId}`,
        async () => {
          const rowCheckout = new Date(
            Math.max(
              new Date(row.checkIn).getTime(),
              Math.min(checkoutAt.getTime(), Date.now()),
            ),
          );

          const calculated = calculateAttendance(row.checkIn, rowCheckout, {
            automatic: true,
            existingStatus: row.status,
          });

          const attendance = await Attendance.findOneAndUpdate(
            {
              _id: row.attendanceId,
              $or: [{ checkOut: null }, { checkOut: { $exists: false } }],
            },
            { $set: calculated },
            { returnDocument: "after" },
          );

          if (attendance) {
            await AttendanceAudit.create({
              attendanceId: attendance._id,
              action: "AUTO_CHECKOUT",
              previousCheckOut: null,
              newCheckOut: attendance.checkOut,
              reason: "Scheduled Inngest auto-checkout",
            });
          }

          return Boolean(attendance);
        },
      );

      if (updated) {
        checkedOutCount++;

        // Per-employee auto-checkout emails are noisy; admins get a daily digest instead.
        // Set AUTO_CHECKOUT_EMAIL_EMPLOYEES=true to also email each employee.
        // Always notify the employee after successful automatic checkout.
        if (row.email) {
          await step.run(`email-auto-checkout-${row.attendanceId}`, async () =>
            sendEmailSafely({
              to: row.email,
              ...autoCheckoutEmail({
                firstName: row.firstName,
                department: row.department,
              }),
            }),
          );
        }
      }
    }

    return {
      checkedOut: checkedOutCount,
      pending: pending.length,
      scheduledCheckout: checkoutAt.toISOString(),
      timezone: attendancePolicy.TIMEZONE,
    };
  },
);

// =====================================================
// 2. YEARLY LEAVE BALANCE RESET
// Runs on January 1 at 12:05 AM Asia/Kolkata time.
// =====================================================

const yearlyLeaveBalanceReset = inngest.createFunction(
  {
    id: "yearly-leave-balance-reset",
    triggers: [{ cron: "TZ=Asia/Kolkata 5 0 1 1 *" }],
  },
  async ({ step }) => {
    const year = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
      }).format(new Date()),
    );

    return await step.run("reset-yearly-leave-balances", async () => {
      return await resetLeaveBalancesForYear(year);
    });
  },
);

// =====================================================
// 3. LEAVE APPLICATION REMINDER
// Reminds the admin if an application remains pending
// for 24 hours after the reminder event is received.
// =====================================================

const leaveApplicationReminder = inngest.createFunction(
  {
    id: "leave-application-reminder",
    triggers: [{ event: "leave/pending" }],
  },
  async ({ event, step }) => {
    const { leaveApplicationId } = event.data;

    if (!leaveApplicationId) {
      return { skipped: true, reason: "Missing leaveApplicationId" };
    }

    await step.sleepUntil(
      "wait-for-the-24-hours",
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    );

    const leaveApplication = await step.run("get-leave-application", async () =>
      LeaveApplication.findById(leaveApplicationId).lean(),
    );

    if (!leaveApplication || leaveApplication.status !== "PENDING") {
      return {
        skipped: true,
        reason: "Application no longer pending or not found",
      };
    }

    const employee = await step.run("get-leave-employee", async () =>
      Employee.findById(leaveApplication.employeeId).lean(),
    );

    if (!employee) {
      return { skipped: true, reason: "Employee not found" };
    }

    await step.run("send-leave-reminder-email", async () => {
      const admins = await User.find({ role: "ADMIN" }).select("email").lean();
      const recipients = [
        ...new Set(
          [...admins.map((a) => a.email), process.env.ADMIN_EMAIL].filter(
            Boolean,
          ),
        ),
      ];
      const content = leavePendingReminderEmail({
        employeeName:
          `${employee.firstName || ""} ${employee.lastName || ""}`.trim() ||
          "an employee",
        employeeEmail: employee.email,
        department: employee.department,
        position: employee.position,
        type: leaveApplication.type,
        startDate: istDateLabel(leaveApplication.startDate),
        endDate: istDateLabel(leaveApplication.endDate),
        requestedDays: leaveApplication.requestedDays,
        halfDay: leaveApplication.halfDay,
        reason: String(leaveApplication.reason || "").slice(0, 300),
        appliedOn: istDateLabel(leaveApplication.createdAt),
        hoursPending: leaveApplication.createdAt
          ? (Date.now() - new Date(leaveApplication.createdAt).getTime()) /
            3600000
          : undefined,
        paidDays: leaveApplication.paidDays,
        lopDays: leaveApplication.lopDays,
      });
      await Promise.all(
        recipients.map((to) => sendEmailSafely({ to, ...content })),
      );
    });

    return { reminded: true, leaveApplicationId };
  },
);

// =====================================================
// 4. DAILY ATTENDANCE REMINDER
// Runs at 11:30 AM Asia/Kolkata time.
// Reminds active employees who have not checked in and
// are not on approved leave.
// =====================================================

const attendanceReminderCron = inngest.createFunction(
  {
    id: "attendance-reminder-cron",
    triggers: [{ cron: "TZ=Asia/Kolkata 30 11 * * *" }],
  },
  async ({ step }) => {
    const today = await step.run("get-today-date", async () => {
      const dayKey = istDayKey();
      const { start, end } = istDayRange(dayKey);
      return {
        dayKey,
        startUTC: start.toISOString(),
        endUTC: end.toISOString(),
        working: await isWorkingDay(dayKey),
      };
    });

    // No reminders on weekly offs or company holidays.
    if (!today.working) {
      return {
        skipped: true,
        reason: "Not a working day",
        day: today.dayKey,
        timezone: "Asia/Kolkata",
      };
    }

    const activeEmployees = await step.run("get-active-employees", async () => {
      const employees = await Employee.find({
        isDeleted: { $ne: true },
        employmentStatus: "ACTIVE",
      })
        .populate("userId", "role")
        .lean();

      // Admin accounts also have an Employee record; they are not asked to mark attendance.
      return employees
        .filter((employee) => employee.userId?.role !== "ADMIN")
        .map((employee) => ({
          _id: employee._id.toString(),
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          department: employee.department,
        }));
    });

    const onLeaveIds = await step.run("get-on-leave-ids", async () => {
      const leaves = await LeaveApplication.find({
        status: "APPROVED",
        startDate: { $lt: new Date(today.endUTC) },
        endDate: { $gte: new Date(today.startUTC) },
      }).lean();
      return leaves.map((leave) => leave.employeeId.toString());
    });

    const checkedInIds = await step.run("get-checked-in-ids", async () => {
      const attendances = await Attendance.find({
        date: { $gte: new Date(today.startUTC), $lt: new Date(today.endUTC) },
        checkIn: { $ne: null },
      }).lean();
      return attendances.map((attendance) => attendance.employeeId.toString());
    });

    const onLeave = new Set(onLeaveIds);
    const checkedIn = new Set(checkedInIds);
    const absentEmployees = activeEmployees.filter(
      (employee) => !onLeave.has(employee._id) && !checkedIn.has(employee._id),
    );

    // Send in small batches so a big company does not hammer the SMTP provider.
    const BATCH = 10;
    for (let i = 0; i < absentEmployees.length; i += BATCH) {
      const batch = absentEmployees.slice(i, i + BATCH);
      await step.run(`send-reminder-emails-${i / BATCH}`, async () => {
        await Promise.all(
          batch.map((employee) =>
            sendEmailSafely({
              to: employee.email,
              ...attendanceReminderEmail({
                firstName: employee.firstName,
                department: employee.department,
                date: istDateLabel(new Date()),
              }),
            }),
          ),
        );
      });
    }

    return {
      totalActive: activeEmployees.length,
      onLeave: onLeave.size,
      checkedIn: checkedIn.size,
      absent: absentEmployees.length,
      timezone: "Asia/Kolkata",
    };
  },
);
// =====================================================
// 5. AUTOMATIC ABSENCE MARKING
// Runs at 12:05 PM IST on working days.
// Marks employees absent if they have not checked in.
// Sends an absence notification email.
// =====================================================

const absenceMarkingCron = inngest.createFunction(
  {
    id: "daily-absence-marking-and-email",
    triggers: [{ cron: "TZ=Asia/Kolkata 5 12 * * *" }],
  },
  async ({ step }) => {
    const today = await step.run("get-absence-check-date", async () => {
      const dayKey = istDayKey();
      const { start, end } = istDayRange(dayKey);

      return {
        dayKey,
        startUTC: start.toISOString(),
        endUTC: end.toISOString(),
        working: await isWorkingDay(dayKey),
      };
    });

    // Never mark employees absent on weekly offs or company holidays.
    if (!today.working) {
      return {
        skipped: true,
        reason: "Not a working day",
        day: today.dayKey,
      };
    }

    const start = new Date(today.startUTC);
    const end = new Date(today.endUTC);

    const employees = await step.run(
      "get-employees-for-absence-check",
      async () => {
        const rows = await Employee.find({
          isDeleted: { $ne: true },
          employmentStatus: "ACTIVE",
        })
          .populate("userId", "role")
          .select("firstName lastName email department joinDate")
          .lean();

        const todayStart = start;

        return rows
          .filter((employee) => {
            const joinDayKey = employee.joinDate
              ? istDayKey(new Date(employee.joinDate))
              : null;

            return (
              employee.userId?.role !== "ADMIN" &&
              (!joinDayKey || joinDayKey <= today.dayKey)
            );
          })
          .map((employee) => ({
            _id: employee._id.toString(),
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email,
            department: employee.department,
          }));
      },
    );

    // Get employees with approved leave today.
    const onLeaveIds = await step.run(
      "get-approved-leave-employees",
      async () => {
        const leaves = await LeaveApplication.find({
          status: "APPROVED",
          startDate: { $lt: end },
          endDate: { $gte: start },
        })
          .select("employeeId")
          .lean();

        return leaves.map((leave) => leave.employeeId.toString());
      },
    );

    // Get all employees who already have an attendance record today.
    const recordedIds = await step.run(
      "get-existing-attendance-employees",
      async () => {
        const records = await Attendance.find({
          date: { $gte: start, $lt: end },
        })
          .select("employeeId")
          .lean();

        return records.map((record) => record.employeeId.toString());
      },
    );

    const onLeave = new Set(onLeaveIds);
    const alreadyRecorded = new Set(recordedIds);

    const eligibleEmployees = employees.filter(
      (employee) =>
        !onLeave.has(employee._id) && !alreadyRecorded.has(employee._id),
    );

    const dateLabel = istDateLabel(start);

    let absentMarked = 0;
    let emailAttempts = 0;

    for (const employee of eligibleEmployees) {
      // Create an absence record only once.
      const attendanceId = await step.run(
        `mark-absence-${employee._id}`,
        async () => {
          try {
            const attendance = await Attendance.create({
              employeeId: employee._id,
              date: start,
              dateKey: today.dayKey,
              checkIn: null,
              checkOut: null,
              status: "ABSENT",
              workingHours: null,
              dayType: null,
            });

            try {
              await AttendanceAudit.create({
                attendanceId: attendance._id,
                action: "ABSENCE_MARKED",
                reason:
                  "No check-in recorded by 12:00 PM IST cutoff. Automatically marked absent at 12:05 PM IST.",
              });
            } catch (auditError) {
              console.error(
                "Absence audit creation failed:",
                auditError.message,
              );
            }

            return attendance._id.toString();
          } catch (error) {
            // A duplicate means an attendance record already exists.
            if (error?.code === 11000) {
              return null;
            }

            throw error;
          }
        },
      );

      if (!attendanceId) continue;

      absentMarked++;

      // Send an email only after the absence record is created.
      if (employee.email) {
        emailAttempts++;

        await step.run(`email-absence-${employee._id}`, async () =>
          sendEmailSafely({
            to: employee.email,
            ...absenceMarkedEmail({
              firstName: employee.firstName,
              department: employee.department,
              date: dateLabel,
            }),
          }),
        );
      }
    }

    return {
      day: today.dayKey,
      totalActive: employees.length,
      onLeave: onLeave.size,
      absentMarked,
      emailAttempts,
      timezone: "Asia/Kolkata",
    };
  },
);
// =====================================================
// 5. ADMIN DAILY DIGEST
// Runs at 6:30 PM Asia/Kolkata on working days: who did not check in,
// pending leave requests, and attendance records that need review.
// =====================================================

const adminDailyDigest = inngest.createFunction(
  {
    id: "admin-daily-digest",
    triggers: [{ cron: "TZ=Asia/Kolkata 30 18 * * *" }],
  },
  async ({ step }) => {
    const dayKey = istDayKey();
    if (!(await step.run("check-working-day", () => isWorkingDay(dayKey)))) {
      return { skipped: true, reason: "Not a working day", day: dayKey };
    }

    const summary = await step.run("build-digest", async () => {
      const { start, end } = istDayRange(dayKey);
      const employees = (
        await Employee.find({
          isDeleted: { $ne: true },
          employmentStatus: "ACTIVE",
        })
          .populate("userId", "role")
          .lean()
      ).filter((e) => e.userId?.role !== "ADMIN");
      const [leavesToday, attendanceToday, pending, needsReview] =
        await Promise.all([
          LeaveApplication.find({
            status: "APPROVED",
            startDate: { $lt: end },
            endDate: { $gte: start },
          })
            .select("employeeId")
            .lean(),
          Attendance.find({
            date: { $gte: start, $lt: end },
            checkIn: { $ne: null },
          })
            .select("employeeId")
            .lean(),
          LeaveApplication.find({ status: "PENDING" })
            .sort({ createdAt: 1 })
            .populate("employeeId", "firstName lastName")
            .lean(),
          Attendance.countDocuments({ needsReview: true }),
        ]);
      const onLeave = new Set(leavesToday.map((l) => String(l.employeeId)));
      const checkedIn = new Set(
        attendanceToday.map((a) => String(a.employeeId)),
      );
      return {
        totalActive: employees.length,
        checkedIn: checkedIn.size,
        onLeave: onLeave.size,
        absentees: employees
          .filter(
            (e) => !onLeave.has(String(e._id)) && !checkedIn.has(String(e._id)),
          )
          .map((e) => `${e.firstName} ${e.lastName}`),
        absenteeDetails: employees
          .filter(
            (e) => !onLeave.has(String(e._id)) && !checkedIn.has(String(e._id)),
          )
          .map((e) => ({
            name: `${e.firstName} ${e.lastName}`,
            department: e.department || "",
          })),
        pendingLeaves: pending.map((l) => {
          const days =
            Number(l.requestedDays) > 0 ? `, ${l.requestedDays} day(s)` : "";
          const waiting = Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(l.createdAt).getTime()) / 86400000,
            ),
          );
          const dates =
            l.endDate && istDateLabel(l.endDate) !== istDateLabel(l.startDate)
              ? `${istDateLabel(l.startDate)} to ${istDateLabel(l.endDate)}`
              : istDateLabel(l.startDate);
          return `${l.employeeId?.firstName || "Employee"} ${l.employeeId?.lastName || ""} - ${l.type.toLowerCase()} leave, ${dates}${days} (waiting ${waiting} day(s))`
            .replace(/\s+/g, " ")
            .trim();
        }),
        needsReview,
      };
    });

    await step.run("send-digest", async () => {
      const admins = await User.find({ role: "ADMIN" }).select("email").lean();
      const recipients = [
        ...new Set(
          [...admins.map((a) => a.email), process.env.ADMIN_EMAIL].filter(
            Boolean,
          ),
        ),
      ];
      const content = adminDigestEmail({ date: dayKey, ...summary });
      await Promise.all(
        recipients.map((to) => sendEmailSafely({ to, ...content })),
      );
    });

    return {
      sent: true,
      day: dayKey,
      absent: summary.absentees.length,
      pendingLeaves: summary.pendingLeaves.length,
    };
  },
);
// =====================================================
// 6. ONE-TIME HISTORICAL ABSENCE REPAIR
// Trigger manually using:
// attendance/historical-absence.repair
//
// Repairs missing ABSENT records from employee joining
// date through yesterday. Does not send emails.
// =====================================================

const historicalAbsenceRepair = inngest.createFunction(
  {
    id: "one-time-historical-absence-repair",
    triggers: [{ event: "attendance/historical-absence.repair" }],
  },
  async ({ step }) => {
    const result = await step.run(
      "repair-historical-absences-for-all-employees",
      async () => {
        const todayKey = istDayKey();
        const todayRange = istDayRange(todayKey);
        const todayStart = todayRange.start;

        // Get active, non-admin employees.
        const employees = await Employee.find({
          isDeleted: { $ne: true },
          employmentStatus: "ACTIVE",
        })
          .populate("userId", "role")
          .select("_id firstName lastName joinDate")
          .lean();

        const eligibleEmployees = employees.filter(
          (employee) =>
            employee.userId?.role !== "ADMIN" &&
            employee.joinDate &&
            istDayKey(new Date(employee.joinDate)) < todayKey,
        );

        const weeklyOffDays = await getWeeklyOffDays();

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
            .map((day) =>
              typeof day === "number"
                ? day
                : weekdayMap[String(day).slice(0, 3)],
            )
            .filter(Number.isInteger),
        );

        let totalCreated = 0;
        let totalSkipped = 0;
        let totalErrors = 0;

        for (const employee of eligibleEmployees) {
          try {
            const joinKey = istDayKey(new Date(employee.joinDate));
            const joinRange = istDayRange(joinKey);

            // Get company holidays between joining date and today.
            const holidayKeys = await getOffHolidayKeys(
              joinRange.start,
              todayStart,
            );

            // Get approved leaves overlapping the employee's historical period.
            const approvedLeaves = await LeaveApplication.find({
              employeeId: employee._id,
              status: "APPROVED",
              startDate: { $lt: todayStart },
              endDate: { $gte: joinRange.start },
            })
              .select("startDate endDate")
              .lean();

            const leaveKeys = new Set();

            for (const leave of approvedLeaves) {
              const leaveStartKey = istDayKey(new Date(leave.startDate));
              const leaveEndKey = istDayKey(new Date(leave.endDate));

              let current = new Date(`${leaveStartKey}T00:00:00Z`);
              const leaveEnd = new Date(`${leaveEndKey}T00:00:00Z`);

              while (current <= leaveEnd) {
                const key = current.toISOString().slice(0, 10);
                leaveKeys.add(key);
                current.setUTCDate(current.getUTCDate() + 1);
              }
            }

            // Find existing attendance using both date and dateKey
            // to support older records as well as newer records.
            const existingRecords = await Attendance.find({
              employeeId: employee._id,
              $or: [
                {
                  date: {
                    $gte: joinRange.start,
                    $lt: todayStart,
                  },
                },
                {
                  dateKey: {
                    $gte: joinKey,
                    $lt: todayKey,
                  },
                },
              ],
            })
              .select("date dateKey")
              .lean();

            const existingKeys = new Set(
              existingRecords.map(
                (record) => record.dateKey || istDayKey(new Date(record.date)),
              ),
            );

            // Process each calendar date from joining date through yesterday.
            let current = new Date(`${joinKey}T00:00:00Z`);
            const yesterday = new Date(`${todayKey}T00:00:00Z`);
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);

            while (current <= yesterday) {
              const dayKey = current.toISOString().slice(0, 10);
              const weekday = current.getUTCDay();

              // Skip weekly offs, holidays, approved leave and existing records.
              if (
                weeklyOffSet.has(weekday) ||
                holidayKeys.has(dayKey) ||
                leaveKeys.has(dayKey) ||
                existingKeys.has(dayKey)
              ) {
                totalSkipped++;
                current.setUTCDate(current.getUTCDate() + 1);
                continue;
              }

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

                await AttendanceAudit.create({
                  attendanceId: attendance._id,
                  action: "ABSENCE_MARKED",
                  reason:
                    "Historical absence repair: no attendance record existed for this working day.",
                });

                existingKeys.add(dayKey);
                totalCreated++;
              } catch (error) {
                // Duplicate means another record already exists.
                if (error?.code === 11000) {
                  totalSkipped++;
                } else {
                  throw error;
                }
              }

              current.setUTCDate(current.getUTCDate() + 1);
            }
          } catch (error) {
            totalErrors++;
            console.error(
              `Historical absence repair failed for employee ${employee._id}:`,
              error.message,
            );
          }
        }

        return {
          totalActiveEmployees: employees.length,
          eligibleEmployees: eligibleEmployees.length,
          absentRecordsCreated: totalCreated,
          datesSkipped: totalSkipped,
          employeeErrors: totalErrors,
          processedThrough: istDayKey(
            new Date(todayStart.getTime() - 24 * 60 * 60 * 1000),
          ),
          timezone: "Asia/Kolkata",
        };
      },
    );

    return result;
  },
);

// =====================================================
// EXPORT ALL INNGEST FUNCTIONS
// =====================================================

export const functions = [
  autoCheckOut,
  yearlyLeaveBalanceReset,
  leaveApplicationReminder,
  attendanceReminderCron,
  absenceMarkingCron,
  adminDailyDigest,
  historicalAbsenceRepair,
];
