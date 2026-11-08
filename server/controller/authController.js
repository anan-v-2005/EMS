import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import { invalidateAuthCache } from "../middleware/auth.js";
import { isEmailConfigured, sendEmailSafely } from "../config/notmailer.js";
import { passwordChangedEmail, passwordResetEmail } from "../utils/emailTemplates.js";
import { istStamp } from "../utils/date.js";
import { RESET_TTL_MS, buildResetLink, createPasswordToken, hashToken } from "../utils/passwordTokens.js";

const MIN_PASSWORD_LENGTH = 8;

const signToken = (user) => {
  const payload = { userId: user._id.toString(), email: user.email, role: user.role };
  return { payload, token: jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" }) };
};

const validatePasswordStrength = (password) => {
  const value = String(password || "");
  if (value.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return "Password must contain at least one letter and one number";
  return null;
};

const timingSafeEqualHex = (a, b) => {
  const left = Buffer.from(String(a), "hex");
  const right = Buffer.from(String(b), "hex");
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
};

export const login = async (req, res) => {
  try {
    const { email, password, role_type } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !password) return res.status(400).json({ error: "Email and password are required" });

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    // Verify the password BEFORE revealing anything about the account (role, status).
    const isValid = await bcrypt.compare(String(password), user.password);
    if (!isValid) return res.status(401).json({ error: "Invalid email or password" });

    if (role_type === "admin" && user.role !== "ADMIN") return res.status(401).json({ error: "Not Authorized as an Admin" });
    if (role_type === "employee" && user.role !== "EMPLOYEE") return res.status(401).json({ error: "Not Authorized as an Employee" });

    if (user.role === "EMPLOYEE") {
      const employee = await Employee.findOne({ userId: user._id }).select("isDeleted employmentStatus").lean();
      if (!employee || employee.isDeleted || employee.employmentStatus !== "ACTIVE") {
        return res.status(403).json({ error: "Your account has been deactivated. Please contact admin." });
      }
    }

    const { payload, token } = signToken(user);
    return res.json({ user: { ...payload, mustChangePassword: Boolean(user.mustChangePassword) }, token });
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
    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) return res.status(400).json({ error: strengthError });
    if (String(currentPassword) === String(newPassword)) return res.status(400).json({ error: "New password must be different from the current password" });

    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!(await bcrypt.compare(String(currentPassword), user.password))) return res.status(401).json({ error: "Current password is incorrect" });

    user.password = await bcrypt.hash(String(newPassword), 10);
    user.passwordChangedAt = new Date();
    user.mustChangePassword = false;
    user.resetTokenHash = "";
    user.resetTokenExpires = null;
    await user.save();
    invalidateAuthCache(user._id);

    // Every OTHER session is now revoked; hand this browser a fresh token so the user stays signed in.
    const { token } = signToken(user);
    const employee = await Employee.findOne({ userId: user._id }).select("firstName").lean();
    void sendEmailSafely({ to: user.email, ...passwordChangedEmail({ firstName: employee?.firstName, changedOn: istStamp() }) });
    return res.json({ success: true, token });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ error: "Failed to change password" });
  }
};

// Always answers the same way so the endpoint cannot be used to discover which emails exist.
const GENERIC_FORGOT_RESPONSE = { success: true, message: "If an employee account exists for that email, a reset link has been sent." };

// Forgot Password is an EMPLOYEE-only self-service feature. Admin accounts never receive a reset link
// (they are recovered by another administrator through Employees -> Edit -> Change password).
export const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Email is required" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: "Please enter a valid email address" });

    // Independent of the account, so it does not reveal whether the email exists.
    if (!isEmailConfigured()) {
      console.error("Forgot password: SMTP is not configured (SMTP_USER, SMTP_PASS and SENDER_EMAIL are required).");
      return res.status(503).json({ error: "Email service is currently unavailable. Please contact your administrator." });
    }

    const user = await User.findOne({ email });
    if (user && user.role === "EMPLOYEE") {
      const employee = await Employee.findOne({ userId: user._id }).select("firstName isDeleted employmentStatus").lean();
      const active = employee && !employee.isDeleted && employee.employmentStatus === "ACTIVE";

      if (active) {
        const { token, hash, expires } = createPasswordToken(RESET_TTL_MS);
        user.resetTokenHash = hash;
        user.resetTokenExpires = expires;
        await user.save();
        // Awaited on purpose: on serverless hosts, work after the response may be cut off.
        const sent = await sendEmailSafely({ to: user.email, ...passwordResetEmail({ firstName: employee.firstName, link: buildResetLink(token, user.email), requestedOn: istStamp() }) });
        if (!sent) console.error(`Forgot password: reset email to ${user.email} could not be delivered (see EmailLog).`);
      }
    }
    return res.json(GENERIC_FORGOT_RESPONSE);
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ error: "Could not process the request" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const { token, newPassword } = req.body || {};
    if (!email || !token || !newPassword) return res.status(400).json({ error: "Email, token and new password are required" });
    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) return res.status(400).json({ error: strengthError });

    const user = await User.findOne({ email }).select("+resetTokenHash +resetTokenExpires");
    const valid = user?.resetTokenHash
      && user.resetTokenExpires
      && user.resetTokenExpires.getTime() > Date.now()
      && timingSafeEqualHex(user.resetTokenHash, hashToken(token));
    if (!valid) return res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });

    user.password = await bcrypt.hash(String(newPassword), 10);
    user.passwordChangedAt = new Date();
    user.mustChangePassword = false;
    user.resetTokenHash = "";
    user.resetTokenExpires = null;
    await user.save();
    invalidateAuthCache(user._id);

    const employee = await Employee.findOne({ userId: user._id }).select("firstName").lean();
    void sendEmailSafely({ to: user.email, ...passwordChangedEmail({ firstName: employee?.firstName, changedOn: istStamp() }) });
    return res.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ error: "Could not reset the password" });
  }
};
