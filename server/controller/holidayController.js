import Holiday from "../models/Holiday.js";
import Employee from "../models/Employee.js";
import Notification from "../models/Notification.js";
import { isEmailConfigured, sendEmailSafely } from "../config/notmailer.js";
import { holidayCreatedEmail } from "../utils/emailTemplates.js";

const defaultHolidays = [["Republic Day", "2026-01-26"], ["Holi", "2026-03-04"], ["Independence Day", "2026-08-15"], ["Gandhi Jayanti", "2026-10-02"], ["Diwali", "2026-11-08"], ["Christmas Day", "2026-12-25"]];
const employeeQuery = { isDeleted: { $ne: true }, employmentStatus: "ACTIVE" };
const dateLabel = (date) => new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

export const getHolidays = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const range = { date: { $gte: new Date(`${year}-01-01T00:00:00+05:30`), $lt: new Date(`${year + 1}-01-01T00:00:00+05:30`) } };
    let data = await Holiday.find(range).sort({ date: 1 }).lean();
    // The built-in 2026 list used to be returned with fake IDs, so it could not be edited/deleted and was
    // invisible to leave and payroll calculations. Persist it once so it behaves like any other holiday.
    if (!data.length && year === 2026) {
      await Holiday.insertMany(defaultHolidays.map(([name, date]) => ({ name, date: new Date(`${date}T00:00:00+05:30`), type: "PUBLIC" })), { ordered: false });
      data = await Holiday.find(range).sort({ date: 1 }).lean();
    }
    res.json({ data });
  } catch { res.status(500).json({ error: "Failed to load holidays" }); }
};

const notifyHoliday = async (holiday, employees) => {
  if (!employees.length) return { notifications: 0, emailsSent: 0, emailFailures: 0, emailServiceConfigured: isEmailConfigured() };
  const label = dateLabel(holiday.date);
  const notifications = employees.filter((e) => e.userId).map((e) => ({ userId: e.userId, type: "HOLIDAY", title: `Holiday: ${holiday.name}`, message: `${holiday.name} is scheduled for ${label}.`, link: "/analytics" }));
  if (notifications.length) {
    try { await Notification.insertMany(notifications, { ordered: false }); }
    catch (notificationError) { console.error("Holiday notification delivery failed:", notificationError.message); }
  }
  const validEmails = employees.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e.email || "")));
  const sent = await Promise.all(validEmails.map((e) => sendEmailSafely({ to: e.email, ...holidayCreatedEmail({ firstName: e.firstName, holidayName: holiday.name, date: label, type: holiday.type }) })));
  return { notifications: notifications.length, emailsSent: sent.filter(Boolean).length, emailFailures: employees.length - sent.filter(Boolean).length, emailServiceConfigured: isEmailConfigured() };
};

export const createHoliday = async (req, res) => {
  try { const { name, date, type = "PUBLIC" } = req.body; if (!name?.trim() || !date) return res.status(400).json({ error: "Name and date are required" }); if (!["PUBLIC", "COMPANY", "OPTIONAL"].includes(type)) return res.status(400).json({ error: "Invalid holiday type" }); const holidayDate = new Date(date); if (Number.isNaN(holidayDate.getTime())) return res.status(400).json({ error: "Invalid holiday date" }); const holiday = await Holiday.create({ name: name.trim(), date: holidayDate, type }); const employees = await Employee.find(employeeQuery).select("userId firstName email").lean(); const delivery = await notifyHoliday(holiday, employees); res.status(201).json({ success: true, data: holiday, notifiedEmployees: delivery.notifications, ...delivery, message: `Holiday added. ${delivery.notifications} in-app notification(s) created; ${delivery.emailsSent} of ${employees.length} email(s) delivered${delivery.emailServiceConfigured ? "." : "; SMTP email service is not configured on the server."}` }); } catch (error) { console.error("Create holiday error:", error); res.status(500).json({ error: "Failed to create holiday" }); }
};

export const updateHoliday = async (req, res) => {
  try { const holiday = await Holiday.findById(req.params.id); if (!holiday) return res.status(404).json({ error: "Holiday not found" }); const { name, date, type } = req.body; if (name !== undefined) holiday.name = String(name).trim(); if (date !== undefined) { const d = new Date(date); if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Invalid holiday date" }); holiday.date = d; } if (type !== undefined) { if (!["PUBLIC", "COMPANY", "OPTIONAL"].includes(type)) return res.status(400).json({ error: "Invalid holiday type" }); holiday.type = type; } await holiday.save(); const employees = await Employee.find(employeeQuery).select("userId firstName email").lean(); const delivery = await notifyHoliday(holiday, employees); res.json({ success: true, data: holiday, notifiedEmployees: delivery.notifications, ...delivery, message: `Holiday updated. ${delivery.notifications} in-app notification(s) created; ${delivery.emailsSent} of ${employees.length} email(s) delivered${delivery.emailServiceConfigured ? "." : "; SMTP email service is not configured on the server."}` }); } catch (error) { console.error("Update holiday error:", error); res.status(500).json({ error: "Failed to update holiday" }); }
};

export const deleteHoliday = async (req, res) => {
  try { const holiday = await Holiday.findByIdAndDelete(req.params.id); if (!holiday) return res.status(404).json({ error: "Holiday not found" }); res.json({ success: true, message: "Holiday deleted successfully." }); } catch { res.status(500).json({ error: "Failed to delete holiday" }); }
};
