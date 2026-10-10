import Announcement from "../models/Announcement.js";
import Employee from "../models/Employee.js";
import Notification from "../models/Notification.js";
import { sendEmailSafely } from "../config/notmailer.js";
import { announcementCreatedEmail } from "../utils/emailTemplates.js";

const getTargetEmployees = async (targetDepartments = []) => {
  const departments = Array.isArray(targetDepartments) ? targetDepartments.filter(Boolean) : [];
  const query = { isDeleted: { $ne: true }, employmentStatus: "ACTIVE" };
  if (departments.length) query.department = { $in: departments };
  return Employee.find(query).select("userId firstName email department").lean();
};

export const getAnnouncements = async (req, res) => {
  try {
    const where = req.session.role === "ADMIN" ? {} : { active: true };
    const data = await Announcement.find(where).sort({ createdAt: -1 }).limit(30).lean();
    res.json({ data });
  } catch { res.status(500).json({ error: "Failed to load announcements" }); }
};

export const createAnnouncement = async (req, res) => {
  try {
    const { title, content, priority = "NORMAL", targetDepartments = [] } = req.body;
    if (!title?.trim() || !content?.trim()) return res.status(400).json({ error: "Title and content are required" });
    if (!["NORMAL", "IMPORTANT", "URGENT"].includes(priority)) return res.status(400).json({ error: "Invalid priority" });
    if (!Array.isArray(targetDepartments)) return res.status(400).json({ error: "targetDepartments must be an array" });
    const announcement = await Announcement.create({ title: title.trim(), content: content.trim(), priority, targetDepartments, createdBy: req.session.userId });
    const employees = await getTargetEmployees(targetDepartments);
    if (employees.length) {
      await Notification.insertMany(employees.map((employee) => ({ userId: employee.userId, type: "ANNOUNCEMENT", title: announcement.title, message: announcement.content.slice(0, 180), link: "/analytics" })));
      await Promise.allSettled(employees.map((employee) => {
        const email = announcementCreatedEmail({ firstName: employee.firstName, title: announcement.title, preview: announcement.content.slice(0, 240), priority: announcement.priority });
        return sendEmailSafely({ to: employee.email, ...email });
      }));
    }
    res.status(201).json({ success: true, data: announcement, notifiedEmployees: employees.length, message: "Announcement added successfully and website + email notifications were triggered." });
  } catch (error) {
    console.error("Create announcement error:", error);
    res.status(500).json({ error: "Failed to create announcement" });
  }
};

export const toggleAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ error: "Announcement not found" });
    announcement.active = !announcement.active;
    await announcement.save();
    res.json({ success: true, data: announcement });
  } catch { res.status(500).json({ error: "Failed to update announcement" }); }
};
