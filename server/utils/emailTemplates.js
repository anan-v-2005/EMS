const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

export const employeeCreatedEmail = ({ firstName, email }) => ({
  subject: "Your EMS employee account has been created",
  text: `Hello ${firstName}, your Employee Management System account has been created for ${email}. Please sign in using the password provided to you by your administrator.`,
  body: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Welcome to EMS, ${escapeHtml(firstName)}!</h2><p>Your employee account has been created for <strong>${escapeHtml(email)}</strong>.</p><p>Please sign in using the password provided by your administrator.</p><p>Regards,<br>EMS</p></div>`,
});

export const employeeUpdatedEmail = ({ firstName }) => ({
  subject: "Your EMS employee profile was updated",
  text: `Hello ${firstName}, your employee profile or account settings were updated by an administrator.`,
  body: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Profile updated</h2><p>Hello ${escapeHtml(firstName)}, your EMS employee profile or account settings were updated by an administrator.</p><p>Regards,<br>EMS</p></div>`,
});

export const leaveStatusEmail = ({ firstName, type, status }) => ({
  subject: `EMS leave request ${status.toLowerCase()}`,
  text: `Hello ${firstName}, your ${type.toLowerCase()} leave request has been ${status.toLowerCase()}.`,
  body: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Leave request update</h2><p>Hello ${escapeHtml(firstName)}, your ${escapeHtml(type)} leave request has been <strong>${escapeHtml(status.toLowerCase())}</strong>.</p><p>Regards,<br>EMS</p></div>`,
});

export const payslipEmail = ({ firstName, month, year }) => ({
  subject: "New EMS payslip available",
  text: `Hello ${firstName}, your payslip for ${month}/${year} is now available in EMS.`,
  body: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>New payslip available</h2><p>Hello ${escapeHtml(firstName)}, your payslip for <strong>${month}/${year}</strong> is now available in EMS.</p><p>Regards,<br>EMS</p></div>`,
});

export const holidayCreatedEmail = ({ firstName, holidayName, date, type }) => ({
  subject: `EMS holiday announced: ${holidayName}`,
  text: `Hello ${firstName}, ${holidayName} has been added to the EMS holiday calendar for ${date}. Holiday type: ${type}.`,
  body: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>New holiday announced</h2><p>Hello ${escapeHtml(firstName)},</p><p><strong>${escapeHtml(holidayName)}</strong> has been added to the EMS holiday calendar for <strong>${escapeHtml(date)}</strong>.</p><p>Holiday type: <strong>${escapeHtml(type)}</strong>.</p><p>Regards,<br>EMS</p></div>`,
});


export const announcementCreatedEmail = ({ firstName, title, preview, priority }) => ({
  subject: `EMS announcement: ${title}`,
  text: `Hello ${firstName}, ${title} was posted in EMS. ${preview}${priority && priority !== "NORMAL" ? ` Priority: ${priority}.` : ""}`,
  body: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${escapeHtml(title)}</h2><p>Hello ${escapeHtml(firstName)},</p><p>${escapeHtml(preview)}</p>${priority && priority !== "NORMAL" ? `<p>Priority: <strong>${escapeHtml(priority)}</strong></p>` : ""}<p>Open EMS to read the full announcement.</p><p>Regards,<br>EMS</p></div>`,
});
