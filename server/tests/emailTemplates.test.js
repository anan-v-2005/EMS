import test from "node:test";
import assert from "node:assert/strict";
import * as t from "../utils/emailTemplates.js";

const all = () => [
  t.employeeCreatedEmail({ firstName: "Asha", email: "a@x.com", setPasswordLink: "http://c/reset-password?token=1&email=a%40x.com", role: "EMPLOYEE", department: "Sales", position: "Exec", joinDate: "01 Oct 2026" }),
  t.employeeUpdatedEmail({ firstName: "Asha", changes: ["position: A → B"], updatedOn: "30 Oct 2026" }),
  t.leaveStatusEmail({ firstName: "Asha", type: "SICK", status: "APPROVED", startDate: "01 Nov 2026", endDate: "03 Nov 2026", paidDays: 2, lopDays: 1, requestedDays: 3, reviewedOn: "30 Oct 2026" }),
  t.leaveStatusEmail({ firstName: "Asha", type: "CASUAL", status: "REJECTED", note: "Team deadline", requestedDays: 1 }),
  t.payslipEmail({ firstName: "Asha", month: 10, year: 2026, payslipNumber: "PS-202610-ABC123" }),
  t.holidayCreatedEmail({ firstName: "Asha", holidayName: "Diwali", date: "08 Nov 2026", type: "PUBLIC" }),
  t.announcementCreatedEmail({ firstName: "Asha", title: "Office move", preview: "We move", priority: "URGENT" }),
  t.passwordResetEmail({ firstName: "Asha", link: "http://c/reset-password?token=1&email=a%40x.com", requestedOn: "now" }),
  t.passwordChangedEmail({ firstName: "Asha", by: "admin", changedOn: "now" }),
  t.autoCheckoutEmail({ firstName: "Asha", department: "Sales" }),
  t.attendanceReminderEmail({ firstName: "Asha", department: "Sales", date: "30 Oct 2026" }),
  t.leavePendingReminderEmail({ employeeName: "Asha Rao", employeeEmail: "a@x.com", department: "Sales", position: "Exec", type: "SICK", startDate: "01 Nov 2026", endDate: "03 Nov 2026", requestedDays: 3, reason: "Fever", appliedOn: "29 Oct 2026", hoursPending: 25.4, paidDays: 2, lopDays: 1 }),
  t.adminDigestEmail({ date: "2026-10-30", pendingLeaves: ["Asha Rao - sick leave"], needsReview: 2, absentees: ["Ravi K"], absenteeDetails: [{ name: "Ravi K", department: "IT Support" }], totalActive: 10, checkedIn: 7, onLeave: 2 }),
];

test("every email has a subject, plain-text part and HTML body", () => {
  for (const mail of all()) {
    assert.ok(mail.subject.length > 10 && mail.subject.length < 150, mail.subject);
    assert.ok(mail.text.length > 60, mail.subject);
    assert.ok(mail.body.startsWith("<div style=\"font-family:Arial,sans-serif"), mail.subject);
    assert.ok(mail.body.endsWith("</div>"), mail.subject);
  }
});

test("HTML-escaping is applied to user supplied content", () => {
  const mail = t.leavePendingReminderEmail({ employeeName: "<img src=x onerror=1>", reason: "\"><script>alert(1)</script>" });
  assert.ok(!mail.body.includes("<script>") && !mail.body.includes("<img"));
});

test("reset email keeps the button styling and explains expiry, single use and the fallback link", () => {
  const mail = t.passwordResetEmail({ firstName: "Asha", link: "http://c/reset-password?token=1&email=a%40x.com" });
  assert.ok(mail.body.includes("background:#4A7C59;color:#fff;border-radius:8px"));
  assert.match(mail.body, /1 hour/); assert.match(mail.body, /only once/); assert.match(mail.body, /copy this address/);
  assert.match(mail.body, /token=1&amp;email=/, "ampersands are escaped inside HTML");
});

test("admin leave reminder is detailed: employee, dates, duration, reason, balance impact, action link", () => {
  const mail = t.leavePendingReminderEmail({ employeeName: "Asha Rao", employeeEmail: "a@x.com", department: "Sales", position: "Exec", type: "SICK", startDate: "01 Nov 2026", endDate: "03 Nov 2026", requestedDays: 3, reason: "Fever", appliedOn: "29 Oct 2026", hoursPending: 25.4, paidDays: 2, lopDays: 1 });
  for (const needle of ["Asha Rao", "a@x.com", "Sales", "01 Nov 2026 to 03 Nov 2026", "3 days", "Fever", "29 Oct 2026", "25 hour", "loss of pay", "/leave"]) {
    assert.ok(mail.body.includes(needle) && mail.text.includes(needle.replace("&", "&")), needle);
  }
  assert.match(mail.subject, /Action required/);
});

test("admin digest summarises counts, percentage and what needs attention", () => {
  const mail = t.adminDigestEmail({ date: "2026-10-30", pendingLeaves: ["a", "b"], needsReview: 2, absentees: ["Ravi K"], absenteeDetails: [{ name: "Ravi K", department: "IT Support" }], totalActive: 10, checkedIn: 7, onLeave: 2 });
  assert.match(mail.subject, /3 item\(s\) need attention/);
  assert.match(mail.body, /\(70%\)/); assert.match(mail.body, /Ravi K \(IT Support\)/); assert.match(mail.body, /Needs your attention/);
  const quiet = t.adminDigestEmail({ date: "2026-10-30", totalActive: 3, checkedIn: 3 });
  assert.match(quiet.subject, /all clear/);
});

test("leave decision email states paid/LOP outcome and the reviewer note", () => {
  const approved = t.leaveStatusEmail({ firstName: "A", type: "SICK", status: "APPROVED", paidDays: 2, lopDays: 1, requestedDays: 3 });
  assert.match(approved.body, /2 days will be paid leave and 1 day will be treated as loss of pay/);
  const rejected = t.leaveStatusEmail({ firstName: "A", type: "SICK", status: "REJECTED", note: "Busy" });
  assert.match(rejected.body, /No leave balance has been deducted/); assert.match(rejected.body, /Busy/);
});
