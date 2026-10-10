import { Inngest } from "inngest";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import LeaveApplication from "../models/LeaveApplication.js";
import { sendEmailSafely } from "../config/notmailer.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "FULLSTACKPROJECT-EMS-CMPICA" });

// Auto-checkout every day at 8:00 PM India Standard Time. The scheduled
// checkout timestamp is fixed to 20:00 IST (not a duration from check-in).
const autoCheckOut = inngest.createFunction(
  {
    id: "daily-8pm-auto-check-out",
    triggers: [{ cron: "TZ=Asia/Kolkata 0 20 * * *" }],
  },
  async ({ step }) => {
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const start = new Date(`${day}T00:00:00+05:30`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const checkoutAt = new Date(`${day}T20:00:00+05:30`);

    const pending = await step.run("find-attendance-needing-auto-checkout", async () => {
      const rows = await Attendance.find({
        date: { $gte: start, $lt: end },
        checkIn: { $ne: null },
        $or: [{ checkOut: null }, { checkOut: { $exists: false } }],
      }).populate("employeeId", "firstName lastName email department isDeleted employmentStatus").lean();
      return rows.filter((row) => row.employeeId && !row.employeeId.isDeleted && row.employeeId.employmentStatus === "ACTIVE")
        .map((row) => ({
          attendanceId: row._id.toString(),
          employeeId: row.employeeId._id.toString(),
          firstName: row.employeeId.firstName,
          email: row.employeeId.email,
          department: row.employeeId.department,
          checkIn: row.checkIn,
        }));
    });

    for (const row of pending) {
      const updated = await step.run(`auto-checkout-${row.attendanceId}`, async () => {
        const attendance = await Attendance.findOneAndUpdate(
          { _id: row.attendanceId, $or: [{ checkOut: null }, { checkOut: { $exists: false } }] },
          {
            $set: {
              checkOut: checkoutAt,
              workingHours: Number(Math.max(0, (checkoutAt.getTime() - new Date(row.checkIn).getTime()) / 3600000).toFixed(2)),
              dayType: (() => {
                const hours = Math.max(0, (checkoutAt.getTime() - new Date(row.checkIn).getTime()) / 3600000);
                return hours >= 8 ? "Full Day" : hours >= 6 ? "Three Quarter Day" : hours >= 4 ? "Half Day" : "Short Day";
              })(),
            },
          },
          { returnDocument: "after" },
        );
        return Boolean(attendance);
      });
      if (updated) {
        await step.run(`email-auto-checkout-${row.attendanceId}`, () => sendEmailSafely({
          to: row.email,
          subject: "Attendance automatically checked out at 8:00 PM",
          text: `Hi ${row.firstName}, your attendance was automatically checked out at 8:00 PM server time today. If you believe this is incorrect, please contact your administrator.`,
          body: `<div style="font-family:Arial,sans-serif;max-width:600px"><h2>Hi ${row.firstName},</h2><p>Your attendance was automatically checked out at <strong>8:00 PM (Asia/Kolkata server time)</strong> today.</p><p>Department: ${row.department || "—"}</p><p>If you believe this is incorrect, please contact your administrator.</p><p>Regards,<br/>EMS</p></div>`,
        }));
      }
    }
    return { checkedOut: pending.length, scheduledCheckout: checkoutAt.toISOString() };
  },
);

// Send email leaves action in 24 hour
const leaveApplicationReminder = inngest.createFunction(
  {
    id: "leave-application-reminder",
    triggers: [{ event: "leave/pending" }],
  },

  async ({ event, step }) => {
    const { leaveApplicationId } = event.data;

    await step.sleepUntil(
      "wait-for-the-24-hours",
      new Date(
        new Date().getTime() +
          24 * 60 * 60 * 1000,
      ),
    );

    const leaveApplication =
      await LeaveApplication.findById(
        leaveApplicationId,
      );

    if (leaveApplication?.status === "PENDING") {
      const employee = await Employee.findById(
        leaveApplication.employeeId,
      );

      // send remember to take action on leave application
      await sendEmailSafely({
        to: process.env.ADMIN_EMAIL,

        subject: `Leave Application Reminder`,

        body: `<div style="max-width: 600px;">
  <h2>Hi Admin, 👋</h2>

  <p style="font-size: 16px;">
    You have a leave application in ${employee.department} today:
  </p>

  <p style="font-size: 18px; font-weight: bold; color: #007bff; margin: 8px 0;">
    ${leaveApplication?.startDate?.toLocaleDateString()}
  </p>

  <p style="font-size: 16px;">
    Please make sure to take action on this leave application.
  </p>

  <br />

  <p style="font-size: 16px;">Best Regards,</p>
  <p style="font-size: 16px;">EMS</p>
</div>`,
      });
    }
  },
);

// CRON checks the attendance and emails absent employee
const attendanceReminderCron = inngest.createFunction(
  {
    id: "attendance-reminder-cron",
    triggers: [{ cron: "TZ=Asia/Kolkata 30 11 * * *" }],
  },

  async ({ step }) => {
    const today = await step.run(
      "get-today-date",
      () => {
        const startUTC = new Date(
          new Date().toLocaleDateString(
            "en-CA",
            {
              timeZone: "Asia/Kolkata",
            },
          ) + "T00:00:00+05:30",
        );

        const endUTC = new Date(
          startUTC.getTime() +
            24 * 60 * 60 * 1000,
        );

        return {
          startUTC: startUTC.toISOString(),
          endUTC: endUTC.toISOString(),
        };
      },
    );

    // get all active non deleted employee
    const activeEmployees = await step.run(
      "get-active-employees",
      async () => {
        const employees = await Employee.find({
          isDeleted: false,
          employmentStatus: "ACTIVE",
        }).lean();

        return employees.map((e) => ({
          _id: e._id.toString(),
          firstName: e.firstName,
          lastName: e.lastName,
          email: e.email,
          department: e.department,
        }));
      },
    );

    // all id on approved leaves
    const onLeaveIds = await step.run(
      "get-on-leave-ids",
      async () => {
        const leaves =
          await LeaveApplication.find({
            status: "APPROVED",

            startDate: {
              $lte: new Date(today.endUTC),
            },

            endDate: {
              $gte: new Date(today.startUTC),
            },
          }).lean();

        return leaves.map((l) =>
          l.employeeId.toString(),
        );
      },
    );

    // who already checkin
    const checkedInIds = await step.run(
      "get-checked-in-ids",
      async () => {
        const attendances = await Attendance.find({
          date: {
            $gte: new Date(today.startUTC),
            $lt: new Date(today.endUTC),
          },
        }).lean();

        return attendances.map((e) =>
          e.employeeId.toString(),
        );
      },
    );

    // filter absent employee
    const absentEmployees =
      activeEmployees.filter(
        (emp) =>
          !onLeaveIds.includes(emp._id) &&
          !checkedInIds.includes(emp._id),
      );

    // send reminder email
    if (absentEmployees.length > 0) {
      await step.run(
        "send-reminder-emails",
        async () => {
          const emailPromises =
            absentEmployees.map((emp) =>
              sendEmailSafely({
                to: emp.email,

                subject:
                  "Attendance Reminder - Please Make Your Attendance",

                body: `<p style="font-size: 16px;">
We noticed you haven't marked your attendance yet today.
</p>

<p style="font-size: 16px;">
The deadline was <strong>11:30 AM</strong> and your attendance is still missing.
</p>

<p style="font-size: 16px;">
Please check in as soon as possible or contact your admin if you're facing any issues.
</p>

<br />

<p style="font-size: 14px; color: #666;">
Department: ${emp.department}
</p>

<br />

<p style="font-size: 16px;">
Best Regards,
</p>

<p style="font-size: 16px;">
<strong>QuickEMS</strong>
</p>`,
              }),
            );

          await Promise.all(emailPromises);
        },
      );
    }

    return {
      totalActive: activeEmployees.length,
      onLeave: onLeaveIds.length,
      checkedIn: checkedInIds.length,
      absent: absentEmployees.length,
    };
  },
);

// Create an empty array where we'll export future Inngest functions
export const functions = [
  autoCheckOut,
  leaveApplicationReminder,
  attendanceReminderCron,
];