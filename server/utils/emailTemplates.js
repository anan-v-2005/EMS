import { clientBaseUrl } from "./passwordTokens.js";

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

// Visual styling is unchanged from the original templates; only the written content is new.
const STYLE = "font-family:Arial,sans-serif;line-height:1.6";
const STYLE_600 =
  "font-family:Arial,sans-serif;max-width:600px;line-height:1.6";
const STYLE_640 =
  "font-family:Arial,sans-serif;max-width:640px;line-height:1.6";
const BUTTON =
  "display:inline-block;padding:10px 18px;background:#4A7C59;color:#fff;border-radius:8px;text-decoration:none";

const appLink = (path = "") => `${clientBaseUrl()}${path}`;
const row = (label, value) =>
  `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value || "—")}</p>`;
const list = (items) =>
  items.length
    ? `<ul>${items.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`
    : "<p>None</p>";
const openLine = (path, label) =>
  `<p>${label} <a href="${escapeHtml(appLink(path))}">${escapeHtml(appLink(path))}</a></p>`;
const SIGN = "<p>Regards,<br>EMS Team</p>";

const pluralDays = (n) => `${n} day${Number(n) === 1 ? "" : "s"}`;
const titleCase = (v = "") =>
  String(v)
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

// ---------------------------------------------------------------- Account / security (employees)

export const employeeCreatedEmail = ({
  firstName,
  email,
  setPasswordLink,
  role = "EMPLOYEE",
  department = "",
  position = "",
  joinDate = "",
}) => {
  const roleLabel = role === "ADMIN" ? "Administrator" : "Employee";
  return {
    subject: "Welcome to EMS - your employee account has been created",
    text: `Hello ${firstName}, your Employee Management System (EMS) account has been created.\n\nAccount email: ${email}\nAccount type: ${roleLabel}${position ? `\nPosition: ${position}` : ""}${department ? `\nDepartment: ${department}` : ""}${joinDate ? `\nJoining date: ${joinDate}` : ""}\n\n${setPasswordLink ? `Set your own password (link valid for 72 hours): ${setPasswordLink}\nYou can also sign in with the temporary password your administrator shared with you; you will be asked to change it on first sign-in.` : "Please sign in with the temporary password provided by your administrator; you will be asked to change it on first sign-in."}\n\nSign in: ${appLink("/login")}\n\nFor your security, EMS staff will never ask for your password. If you were not expecting this account, contact your administrator.`,
    body: `<div style="${STYLE}"><h2>Welcome to EMS, ${escapeHtml(firstName)}!</h2><p>Your Employee Management System account has been created. Here are your account details:</p>${row("Account email", email)}${row("Account type", roleLabel)}${position ? row("Position", position) : ""}${department ? row("Department", department) : ""}${joinDate ? row("Joining date", joinDate) : ""}${setPasswordLink ? `<p><a href="${escapeHtml(setPasswordLink)}" style="${BUTTON}">Set your password</a></p><p>This link is valid for 72 hours. You can also sign in with the temporary password your administrator shared with you; either way you will be asked to choose a new password on first sign-in.</p>` : `<p>Please sign in with the temporary password provided by your administrator. You will be asked to choose a new password on first sign-in.</p>`}${openLine("/login", "Sign in at:")}<p><strong>Security note:</strong> EMS staff will never ask you for your password. If you were not expecting this account, please contact your administrator.</p>${SIGN}</div>`,
  };
};

export const employeeUpdatedEmail = ({
  firstName,
  changes = [],
  updatedOn = "",
}) => {
  const items = changes.length ? changes : ["Your profile details"];
  return {
    subject: "Your EMS employee profile was updated",
    text: `Hello ${firstName}, an administrator updated your employee record in EMS${updatedOn ? ` on ${updatedOn}` : ""}.\n\nWhat changed:\n${items.map((c) => `- ${c}`).join("\n")}\n\nPlease review your details in EMS: ${appLink("/settings")}\nIf you did not expect this change or something looks incorrect, contact your administrator.`,
    body: `<div style="${STYLE}"><h2>Profile updated</h2><p>Hello ${escapeHtml(firstName)}, an administrator updated your employee record in EMS${updatedOn ? ` on <strong>${escapeHtml(updatedOn)}</strong>` : ""}.</p><p><strong>What changed:</strong></p>${list(items)}${openLine("/settings", "Review your details at:")}<p>If you did not expect this change or something looks incorrect, please contact your administrator.</p>${SIGN}</div>`,
  };
};

export const passwordResetEmail = ({
  firstName = "there",
  link,
  requestedOn = "",
}) => ({
  subject: "Reset your EMS password",
  text: `Hello ${firstName}, we received a request${requestedOn ? ` on ${requestedOn}` : ""} to reset the password of your EMS employee account.\n\nReset your password (link valid for 1 hour, can be used once): ${link}\n\nIf you did not request this, you can safely ignore this email - your password will not change. If you keep receiving these emails, please tell your administrator.`,
  body: `<div style="${STYLE}"><h2>Reset your password</h2><p>Hello ${escapeHtml(firstName)}, we received a request${requestedOn ? ` on <strong>${escapeHtml(requestedOn)}</strong>` : ""} to reset the password of your EMS employee account.</p><p><a href="${escapeHtml(link)}" style="${BUTTON}">Reset password</a></p><p>This link is valid for <strong>1 hour</strong> and can be used only once. If the button does not work, copy this address into your browser:<br>${escapeHtml(link)}</p><p>If you did not request a reset, you can safely ignore this email; your password will not change. If you keep receiving these emails, please let your administrator know.</p>${SIGN}</div>`,
});

export const passwordChangedEmail = ({
  firstName = "there",
  by = "you",
  changedOn = "",
}) => {
  const who = by === "admin" ? "an administrator" : "you";
  return {
    subject: "Your EMS password was changed",
    text: `Hello ${firstName}, the password of your EMS account was changed by ${who}${changedOn ? ` on ${changedOn}` : ""}. For security, you have been signed out of other devices.${by === "admin" ? " You will be asked to choose a new password the next time you sign in." : ""}\n\nIf this was not expected, contact your administrator immediately and do not share your password with anyone.`,
    body: `<div style="${STYLE}"><h2>Password changed</h2><p>Hello ${escapeHtml(firstName)}, the password of your EMS account was changed by <strong>${who}</strong>${changedOn ? ` on <strong>${escapeHtml(changedOn)}</strong>` : ""}.</p><p>For security, you have been signed out of your other devices.${by === "admin" ? " You will be asked to choose a new password the next time you sign in." : ""}</p><p><strong>Was this not you?</strong> Contact your administrator immediately and do not share your password with anyone.</p>${SIGN}</div>`,
  };
};

// ---------------------------------------------------------------- Leave

export const leaveStatusEmail = ({
  firstName,
  type,
  status,
  note = "",
  startDate = "",
  endDate = "",
  paidDays,
  lopDays,
  requestedDays,
  reviewedOn = "",
}) => {
  const when = startDate
    ? endDate && endDate !== startDate
      ? `${startDate} to ${endDate}`
      : startDate
    : "";
  const approved = status === "APPROVED";
  const lopNum = Number(lopDays) || 0;
  const paidNum = Number(paidDays) || 0;
  const duration = Number(requestedDays) > 0 ? pluralDays(requestedDays) : "";
  const outcome = approved
    ? lopNum > 0
      ? `${pluralDays(paidNum)} will be paid leave and ${pluralDays(lopNum)} will be treated as loss of pay (LOP) because the balance for this leave type is exhausted.`
      : "The full period will be treated as paid leave."
    : "No leave balance has been deducted. If you still need time off, you can submit a new request or speak to your manager or administrator.";
  const label = `${titleCase(type)} leave`;
  return {
    subject: `EMS leave request ${status.toLowerCase()}: ${label}${when ? ` (${when})` : ""}`,
    text: `Hello ${firstName}, your ${label.toLowerCase()} request has been ${status.toLowerCase()}.\n\nLeave type: ${titleCase(type)}${when ? `\nDates: ${when}` : ""}${duration ? `\nDuration: ${duration}` : ""}\nDecision: ${titleCase(status)}${reviewedOn ? `\nDecided on: ${reviewedOn}` : ""}\n\n${outcome}${note ? `\n\nNote from reviewer: ${note}` : ""}\n\nView your leave history and balances: ${appLink("/leave")}`,
    body: `<div style="${STYLE}"><h2>Leave request update</h2><p>Hello ${escapeHtml(firstName)}, your ${escapeHtml(label.toLowerCase())} request has been <strong>${escapeHtml(status.toLowerCase())}</strong>.</p>${row("Leave type", titleCase(type))}${when ? row("Dates", when) : ""}${duration ? row("Duration", duration) : ""}${row("Decision", titleCase(status))}${reviewedOn ? row("Decided on", reviewedOn) : ""}<p>${escapeHtml(outcome)}</p>${note ? `<p><strong>Note from reviewer:</strong> ${escapeHtml(note)}</p>` : ""}${openLine("/leave", "View your leave history and balances:")}${SIGN}</div>`,
  };
};

// ---------------------------------------------------------------- Payroll / company news

export const payslipEmail = ({
  firstName,
  month,
  year,
  payslipNumber = "",
}) => {
  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const period = MONTHS[Number(month) - 1]
    ? `${MONTHS[Number(month) - 1]} ${year}`
    : `${month}/${year}`;
  return {
    subject: `Your EMS payslip for ${period} is available`,
    text: `Hello ${firstName}, your payslip for ${period}${payslipNumber ? ` (reference ${payslipNumber})` : ""} has been finalised and is now available in EMS.\n\nYou can view the full earnings and deductions breakdown, and print or download it, here: ${appLink("/payslips")}\n\nIf anything in your payslip looks incorrect, please contact your administrator or HR.`,
    body: `<div style="${STYLE}"><h2>New payslip available</h2><p>Hello ${escapeHtml(firstName)}, your payslip for <strong>${escapeHtml(period)}</strong>${payslipNumber ? ` (reference <strong>${escapeHtml(payslipNumber)}</strong>)` : ""} has been finalised and is now available in EMS.</p><p>You can view the full earnings and deductions breakdown, and print or download it, from the Payslips section.</p>${openLine("/payslips", "Open your payslips:")}<p>If anything in your payslip looks incorrect, please contact your administrator or HR.</p>${SIGN}</div>`,
  };
};

export const holidayCreatedEmail = ({ firstName, holidayName, date, type }) => {
  const note =
    {
      PUBLIC: "This is a public holiday; the office is closed.",
      COMPANY: "This is a company holiday; the office is closed.",
      OPTIONAL:
        "This is an optional holiday; you may choose to take it but it is not a company-wide closure.",
    }[type] || "";
  return {
    subject: `EMS holiday announced: ${holidayName} (${date})`,
    text: `Hello ${firstName}, ${holidayName} has been added to the EMS holiday calendar.\n\nHoliday: ${holidayName}\nDate: ${date}\nType: ${titleCase(type)}\n${note}\n\nSee the full holiday calendar: ${appLink("/analytics")}`,
    body: `<div style="${STYLE}"><h2>New holiday announced</h2><p>Hello ${escapeHtml(firstName)},</p><p><strong>${escapeHtml(holidayName)}</strong> has been added to the EMS holiday calendar.</p>${row("Date", date)}${row("Type", titleCase(type))}${note ? `<p>${escapeHtml(note)}</p>` : ""}${openLine("/analytics", "See the full holiday calendar:")}${SIGN}</div>`,
  };
};

export const announcementCreatedEmail = ({
  firstName,
  title,
  preview,
  priority,
}) => {
  const flagged = priority && priority !== "NORMAL";
  return {
    subject: `${flagged ? `[${priority}] ` : ""}EMS announcement: ${title}`,
    text: `Hello ${firstName}, a new announcement was posted in EMS.\n\n${title}${flagged ? `\nPriority: ${titleCase(priority)}` : ""}\n\n${preview}${String(preview || "").length >= 240 ? "..." : ""}\n\nRead the full announcement: ${appLink("/dashboard")}`,
    body: `<div style="${STYLE}"><h2>${escapeHtml(title)}</h2><p>Hello ${escapeHtml(firstName)}, a new announcement was posted in EMS.</p>${flagged ? `<p>Priority: <strong>${escapeHtml(titleCase(priority))}</strong></p>` : ""}<p>${escapeHtml(preview)}${String(preview || "").length >= 240 ? "&hellip;" : ""}</p>${openLine("/dashboard", "Read the full announcement:")}${SIGN}</div>`,
  };
};

// ---------------------------------------------------------------- Attendance

export const autoCheckoutEmail = ({
  firstName = "",
  department = "",
  date = "",
  checkOutTime = "",
}) => ({
  subject: `Your attendance was automatically checked out${date ? ` (${date})` : ""}`,
  text: `Hi ${firstName}, your attendance has been automatically checked out${date ? ` for ${date}` : " today"}${checkOutTime ? ` at ${checkOutTime}` : ""}.${department ? `\nDepartment: ${department}` : ""}

Your attendance record has been updated in EMS.

Review your attendance: ${appLink("/attendance")}

Regards,
EMS Team`,
  body: `<div style="${STYLE_600}"><h2>Hi ${escapeHtml(firstName)},</h2><p>Your attendance has been <strong>automatically checked out</strong>${date ? ` for <strong>${escapeHtml(date)}</strong>` : " today"}${checkOutTime ? ` at <strong>${escapeHtml(checkOutTime)}</strong>` : ""}.</p>${department ? `<p>Department: ${escapeHtml(department)}</p>` : ""}<p>Your attendance record has been updated in EMS.</p>${openLine("/attendance", "Review your attendance:")}${SIGN}</div>`,
});

export const manualCheckoutEmail = ({
  firstName = "",
  department = "",
  date = "",
  checkOutTime = "",
}) => ({
  subject: `Attendance checked out successfully${date ? ` (${date})` : ""}`,
  text: `Hi ${firstName}, your attendance has been successfully checked out${date ? ` for ${date}` : " today"}${checkOutTime ? ` at ${checkOutTime}` : ""}.${department ? `\nDepartment: ${department}` : ""}

Your attendance record has been updated in EMS.

Review your attendance: ${appLink("/attendance")}

Regards,
EMS Team`,
  body: `<div style="${STYLE_600}"><h2>Hi ${escapeHtml(firstName)},</h2><p>Your attendance has been <strong>successfully checked out</strong>${date ? ` for <strong>${escapeHtml(date)}</strong>` : " today"}${checkOutTime ? ` at <strong>${escapeHtml(checkOutTime)}</strong>` : ""}.</p>${department ? `<p>Department: ${escapeHtml(department)}</p>` : ""}<p>Your attendance record has been updated in EMS.</p>${openLine("/attendance", "Review your attendance:")}${SIGN}</div>`,
});

export const attendanceReminderEmail = ({
  firstName = "",
  department = "",
  date = "",
}) => ({
  subject: "Attendance Reminder - Please Mark Your Attendance",
  text: `Hi ${firstName}, we have no check-in recorded for you${date ? ` on ${date}` : " yet today"}.${department ? `\nDepartment: ${department}` : ""}\n\nIf you are working today, please check in now: ${appLink("/attendance")}\nIf you are on leave or unable to work, apply for leave in EMS or let your administrator know so your record stays accurate - unmarked days may be counted as absent in payroll.`,
  body: `<div style="${STYLE_600}"><p>Hi ${escapeHtml(firstName)},</p><p>We have no check-in recorded for you${date ? ` on <strong>${escapeHtml(date)}</strong>` : " yet today"}.</p>${department ? `<p>Department: ${escapeHtml(department)}</p>` : ""}<p>If you are working today, please check in now.</p>${openLine("/attendance", "Mark attendance:")}<p>If you are on leave or unable to work, please apply for leave in EMS or let your administrator know so your record stays accurate. Days without attendance or approved leave may be counted as absent in payroll.</p>${SIGN}</div>`,
});

export const absenceMarkedEmail = ({
  firstName = "",
  department = "",
  date = "",
}) => ({
  subject: `Attendance Marked Absent${date ? ` - ${date}` : ""}`,

  text: `Hi ${firstName},

Our attendance system shows that you did not check in before the 12:00 PM cutoff${date ? ` on ${date}` : " today"}.

Your attendance has therefore been marked as ABSENT.${department ? `\nDepartment: ${department}` : ""}

If you believe this is incorrect, please contact your HR administrator.

Review your attendance: ${appLink("/attendance")}

Regards,
EMS Team`,

  body: `<div style="${STYLE_600}">
    <h2>Hi ${escapeHtml(firstName)},</h2>
    <p>Our attendance system shows that you did not check in before the <strong>12:00 PM cutoff</strong>${date ? ` on <strong>${escapeHtml(date)}</strong>` : " today"}.</p>
    <p>Your attendance has therefore been marked as <strong style="color:#dc2626;">ABSENT</strong>.</p>
    ${department ? `<p>Department: ${escapeHtml(department)}</p>` : ""}
    <p>If you believe this is incorrect, please contact your HR administrator.</p>
    ${openLine("/attendance", "Review your attendance:")}
    ${SIGN}
  </div>`,
});
// ---------------------------------------------------------------- Admin emails

// Sent to every admin when a leave request has been waiting for 24 hours.
export const leavePendingReminderEmail = ({
  employeeName = "an employee",
  employeeEmail = "",
  department = "",
  position = "",
  type = "",
  startDate = "",
  endDate = "",
  requestedDays,
  halfDay = false,
  reason = "",
  appliedOn = "",
  hoursPending,
  paidDays,
  lopDays,
}) => {
  const when = startDate
    ? endDate && endDate !== startDate
      ? `${startDate} to ${endDate}`
      : startDate
    : "";
  const duration =
    Number(requestedDays) > 0
      ? `${pluralDays(requestedDays)}${halfDay ? " (half day)" : ""}`
      : "";
  const lopNum = Number(lopDays) || 0;
  const balanceNote =
    lopNum > 0
      ? `Balance impact: if approved, ${pluralDays(Number(paidDays) || 0)} would be paid leave and ${pluralDays(lopNum)} would be loss of pay (the employee's balance for this leave type is insufficient).`
      : Number(requestedDays) > 0
        ? "Balance impact: the request fits within the employee's available balance."
        : "";
  const pending =
    Number(hoursPending) > 0
      ? `${Math.round(hoursPending)} hour(s)`
      : "over 24 hours";
  const who = [employeeName, position].filter(Boolean).join(" - ");
  return {
    subject: `Action required: ${employeeName}'s ${type ? `${type.toLowerCase()} ` : ""}leave request is pending${when ? ` (${when})` : ""}`,
    text: `Hello Admin,\n\nA leave request has been waiting for your decision for ${pending}.\n\nEmployee: ${who}${employeeEmail ? ` <${employeeEmail}>` : ""}\nDepartment: ${department || "-"}\nLeave type: ${type ? titleCase(type) : "-"}\nDates: ${when || "-"}${duration ? `\nDuration: ${duration}` : ""}${appliedOn ? `\nSubmitted on: ${appliedOn}` : ""}\nReason given: ${reason || "-"}\n${balanceNote ? `\n${balanceNote}\n` : ""}\nApprove or reject the request: ${appLink("/leave")}\n\nThe employee is notified by email as soon as you decide. Requests left pending close to the leave start date can affect attendance and payroll.`,
    body: `<div style="${STYLE_600}"><h2>Hi Admin,</h2><p>A leave request has been waiting for your decision for <strong>${escapeHtml(pending)}</strong>.</p>${row("Employee", who)}${employeeEmail ? row("Email", employeeEmail) : ""}${row("Department", department)}${row("Leave type", type ? titleCase(type) : "")}${row("Leave dates", when)}${duration ? row("Duration", duration) : ""}${appliedOn ? row("Submitted on", appliedOn) : ""}${row("Reason given", reason)}${balanceNote ? `<p>${escapeHtml(balanceNote)}</p>` : ""}${openLine("/leave", "Approve or reject the request:")}<p>The employee is notified by email as soon as you decide. Requests left pending close to the leave start date can affect attendance and payroll.</p>${SIGN}</div>`,
  };
};

// Daily 6:30 PM summary for admins.
//   absentees / pendingLeaves : display strings.   absenteeDetails : optional [{name, department}].
export const adminDigestEmail = ({
  date,
  pendingLeaves = [],
  needsReview = 0,
  absentees = [],
  totalActive = 0,
  checkedIn = 0,
  onLeave = 0,
  absenteeDetails = [],
}) => {
  const presentPct =
    totalActive > 0 ? Math.round((checkedIn / totalActive) * 100) : 0;
  const absentList = absenteeDetails.length
    ? absenteeDetails.map(
        (a) => `${a.name}${a.department ? ` (${a.department})` : ""}`,
      )
    : absentees;
  const attention = [];
  if (pendingLeaves.length)
    attention.push(
      `${pendingLeaves.length} leave request(s) are waiting for your decision.`,
    );
  if (needsReview)
    attention.push(
      `${needsReview} attendance record(s) need review (for example automatic check-outs).`,
    );
  if (absentees.length)
    attention.push(
      `${absentees.length} employee(s) did not check in and have no approved leave.`,
    );
  const summaryLine = `Active employees: ${totalActive} | Checked in: ${checkedIn} (${presentPct}%) | On approved leave: ${onLeave} | Not checked in: ${absentees.length}`;
  return {
    subject: `EMS daily summary - ${date}${attention.length ? ` - ${attention.length} item(s) need attention` : " - all clear"}`,
    text: `EMS daily summary for ${date}\n\n${summaryLine}\n\n${attention.length ? `Needs your attention:\n${attention.map((a) => `- ${a}`).join("\n")}` : "Nothing needs your attention today."}\n\nNot checked in (${absentees.length}):\n${absentList.length ? absentList.map((a) => `- ${a}`).join("\n") : "None"}\n\nPending leave requests (${pendingLeaves.length}):\n${pendingLeaves.length ? pendingLeaves.map((a) => `- ${a}`).join("\n") : "None"}\n\nAttendance records needing review: ${needsReview}\n\nReview pending leave: ${appLink("/leave")}\nReview attendance: ${appLink("/people-operations")}`,
    body: `<div style="${STYLE_640}"><h2>EMS daily summary - ${escapeHtml(date)}</h2><p>Active employees: <strong>${totalActive}</strong> &middot; Checked in: <strong>${checkedIn}</strong> (${presentPct}%) &middot; On approved leave: <strong>${onLeave}</strong> &middot; Not checked in: <strong>${absentees.length}</strong></p><h3>Needs your attention</h3>${attention.length ? list(attention) : "<p>Nothing needs your attention today.</p>"}<h3>Not checked in (${absentees.length})</h3>${list(absentList)}<h3>Pending leave requests (${pendingLeaves.length})</h3>${list(pendingLeaves)}<h3>Attendance needing review</h3><p>${needsReview} record(s)</p>${openLine("/leave", "Review leave requests:")}${openLine("/people-operations", "Review attendance:")}${SIGN}</div>`,
  };
};
export const performanceReviewAssignedEmail = ({ firstName, period }) => {
  const safeFirstName = escapeHtml(firstName || "Employee");
  const safePeriod = escapeHtml(period || "the review period");

  return {
    subject: "New Performance Review Assigned",

    text: `
Hello ${firstName || "Employee"},

A new performance review has been assigned to you.

Review Period: ${period || "Not specified"}

Please log in to your HRMS account to view your performance review.

Regards,
EMS Team
`,

    // IMPORTANT: notmailer.js expects "body", not "html".
    body: `
      <div style="${STYLE}">
        <h2>Performance Review Assigned</h2>
        <p>Hello ${safeFirstName},</p>
        <p>A new performance review has been assigned to you.</p>
        <p><strong>Review Period:</strong> ${safePeriod}</p>
        ${openLine("/hrms", "View your performance review:")}
        ${SIGN}
      </div>
    `,
  };
};
