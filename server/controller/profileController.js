import Employee from "../models/Employee.js";
import { deleteImage, isCloudinaryConfigured, uploadImage } from "../services/cloudinary.js";

export const getProfile = async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.session.userId }).lean();
    if (!employee) {
      return res.json({ firstName: "Admin", lastName: "", email: req.session.email, profilePhotoUrl: "" });
    }
    return res.json(employee);
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.session.userId });
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    if (employee.isDeleted) return res.status(404).json({ error: "Your Account is Deactivated, You can not update your profile" });

    employee.bio = String(req.body.bio || "").trim();
    await employee.save();
    return res.json({ success: true, data: employee });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ error: "Failed to update profile" });
  }
};

export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!isCloudinaryConfigured()) return res.status(503).json({ error: "Cloudinary is not configured on the server" });
    if (!req.file) return res.status(400).json({ error: "Please select an image" });

    const employee = await Employee.findOne({ userId: req.session.userId });
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    if (employee.isDeleted) return res.status(403).json({ error: "Your account is deactivated" });
    if (req.session.role === "EMPLOYEE" && (employee.profilePhotoUploadedBy === "ADMIN" || (!employee.profilePhotoUploadedBy && employee.profilePhotoUrl))) {
      return res.status(403).json({ error: "Your profile photo was uploaded by an administrator and cannot be changed." });
    }

    const result = await uploadImage({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      publicId: `employee_${employee._id}`,
    });

    employee.profilePhotoUrl = result.url;
    employee.profilePhotoPublicId = result.publicId;
    employee.profilePhotoUploadedBy = req.session.role === "ADMIN" ? "ADMIN" : "EMPLOYEE";
    await employee.save();

    return res.json({ success: true, profilePhotoUrl: result.url, profilePhotoPublicId: result.publicId });
  } catch (error) {
    console.error("Profile photo upload error:", error);
    return res.status(error.status >= 400 && error.status < 500 ? error.status : 500).json({ error: error.message || "Failed to upload profile photo" });
  }
};

export const deleteProfilePhoto = async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.session.userId });
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    if (req.session.role === "EMPLOYEE" && (employee.profilePhotoUploadedBy === "ADMIN" || (!employee.profilePhotoUploadedBy && employee.profilePhotoUrl))) {
      return res.status(403).json({ error: "Your profile photo was uploaded by an administrator and cannot be changed." });
    }
    if (employee.profilePhotoPublicId && isCloudinaryConfigured()) await deleteImage(employee.profilePhotoPublicId);
    employee.profilePhotoUrl = "";
    employee.profilePhotoPublicId = "";
    employee.profilePhotoUploadedBy = "";
    await employee.save();
    return res.json({ success: true });
  } catch (error) {
    console.error("Profile photo delete error:", error);
    return res.status(500).json({ error: "Failed to delete profile photo" });
  }
};
