import Employee from "../models/Employee.js";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { deleteImage, isCloudinaryConfigured, uploadImage } from "../services/cloudinary.js";
import { sendEmailSafely } from "../config/notmailer.js";
import { employeeCreatedEmail, employeeUpdatedEmail } from "../utils/emailTemplates.js";

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
    return res.json(employees.map(publicEmployee));
  } catch (error) {
    console.error("Get employees error:", error);
    return res.status(500).json({ error: "Failed to load employees" });
  }
};

export const getArchivedEmployees = async (_req, res) => {
  try {
    const employees = await Employee.find({ isDeleted: true }).sort({ updatedAt: -1 }).populate("userId", "email role").lean();
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
    return res.json(publicEmployee(employee));
  } catch (error) {
    console.error("Get employee by id error:", error);
    return res.status(500).json({ error: "Failed to load employee" });
  }
};

const validateEmployeeFields = ({ firstName, lastName, email, password, phone, position, joinDate }) => {
  if (!firstName || !lastName || !email || !phone || !position || !joinDate || password === "") return "Missing required fields";
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

export const createEmployee = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, position, basicSalary, allowance, deductions, joinDate, bio, password, role, department, employmentStatus } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const validationError = validateEmployeeFields({ firstName, lastName, email: normalizedEmail, password, phone, position, joinDate });
    if (validationError) return res.status(400).json({ error: validationError });
    if (await User.findOne({ email: normalizedEmail })) return res.status(400).json({ error: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ email: normalizedEmail, password: hashed, role: role === "ADMIN" ? "ADMIN" : "EMPLOYEE" });
    let createdEmployee;

    try {
      const employee = createdEmployee = await Employee.create({
        userId: user._id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        phone: String(phone).trim(),
        position: position.trim(),
        department: department || "Engineering",
        basicSalary: Math.max(0, Number(basicSalary) || 0),
        allowance: Math.max(0, Number(allowance) || 0),
        deductions: Math.max(0, Number(deductions) || 0),
        employmentStatus: employmentStatus === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        joinDate: new Date(joinDate),
        bio: String(bio || "").trim(),
      });

      const photo = await maybeUploadPhoto(employee, req.file);
      if (photo) {
        employee.profilePhotoUrl = photo.url;
        employee.profilePhotoPublicId = photo.publicId;
        employee.profilePhotoUploadedBy = "ADMIN";
        await employee.save();
      }

      const emailContent = employeeCreatedEmail({ firstName: employee.firstName, email: employee.email });
      void sendEmailSafely({ to: employee.email, ...emailContent });
      return res.status(201).json({ success: true, employee });
    } catch (employeeError) {
      if (createdEmployee?._id) await Employee.findByIdAndDelete(createdEmployee._id).catch(() => {});
      await User.findByIdAndDelete(user._id).catch(() => {});
      throw employeeError;
    }
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ error: "Email already exists" });
    console.error("Create employee error:", error);
    return res.status(error.status >= 400 && error.status < 600 ? error.status : 500).json({ error: error.message || "Failed to create employee" });
  }
};

export const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, position, department, basicSalary, allowance, deductions, joinDate, bio, password, role, employmentStatus } = req.body;
    const employee = await Employee.findById(id);
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    const validationError = validateEmployeeFields({ firstName, lastName, email, password: password || "ok", phone, position, joinDate });
    if (validationError) return res.status(400).json({ error: validationError });

    const normalizedEmail = String(email).trim().toLowerCase();
    const duplicate = await User.findOne({ email: normalizedEmail, _id: { $ne: employee.userId } });
    if (duplicate) return res.status(400).json({ error: "Email already exists" });

    Object.assign(employee, {
      firstName: firstName.trim(), lastName: lastName.trim(), email: normalizedEmail, phone: String(phone).trim(),
      position: position.trim(), department: department || employee.department,
      basicSalary: Math.max(0, Number(basicSalary) || 0), allowance: Math.max(0, Number(allowance) || 0),
      deductions: Math.max(0, Number(deductions) || 0), joinDate: new Date(joinDate), bio: String(bio || "").trim(),
      employmentStatus: employmentStatus === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    });

    const photo = await maybeUploadPhoto(employee, req.file);
    if (photo) {
      employee.profilePhotoUrl = photo.url;
      employee.profilePhotoPublicId = photo.publicId;
      employee.profilePhotoUploadedBy = "ADMIN";
    }
    await employee.save();

    const userUpdate = { email: normalizedEmail };
    if (role === "ADMIN" || role === "EMPLOYEE") userUpdate.role = role;
    if (password) userUpdate.password = await bcrypt.hash(password, 10);
    await User.findByIdAndUpdate(employee.userId, userUpdate, { returnDocument: "after" });

    const emailContent = employeeUpdatedEmail({ firstName: employee.firstName });
    void sendEmailSafely({ to: employee.email, ...emailContent });
    return res.json({ success: true, employee });
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
    employee.isDeleted = true;
    employee.employmentStatus = "INACTIVE";
    await employee.save();
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
    employee.employmentStatus = "ACTIVE";
    await employee.save();
    return res.json({ success: true, message: "Employee restored", employee });
  } catch (error) {
    console.error("Restore employee error:", error);
    return res.status(500).json({ error: "Failed to restore employee" });
  }
};
