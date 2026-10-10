import bcrypt from "bcrypt";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import jwt from "jsonwebtoken";

export const login = async (req, res) => {
  try {
    const { email, password, role_type } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !password) return res.status(400).json({ error: "Email and password are required" });
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    if (role_type === "admin" && user.role !== "ADMIN") return res.status(401).json({ error: "Not Authorized as an Admin" });
    if (role_type === "employee" && user.role !== "EMPLOYEE") return res.status(401).json({ error: "Not Authorized as an Employee" });
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: "Invalid email or password" });
    if (user.role === "EMPLOYEE") {
      const employee = await Employee.findOne({ userId: user._id }).select("isDeleted employmentStatus").lean();
      if (!employee || employee.isDeleted || employee.employmentStatus !== "ACTIVE") {
        return res.status(403).json({ error: "Your account has been deactivated. Please contact admin." });
      }
    }
    const payload = { userId: user._id.toString(), email: user.email, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.json({ user: payload, token });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const session = async (req, res) => res.json({ user: req.session });

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Current and new password are required" });
    if (String(newPassword).length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!(await bcrypt.compare(currentPassword, user.password))) return res.status(401).json({ error: "Current password is incorrect" });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.json({ success: true });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ error: "Failed to change password" });
  }
};
