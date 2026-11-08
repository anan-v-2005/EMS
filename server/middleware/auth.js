
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Employee from "../models/Employee.js";

// =====================================================
// AUTHENTICATION MIDDLEWARE
// Verifies the JWT supplied in the Authorization header.
// =====================================================

// Short-lived cache so we do not hit MongoDB twice on every single API call.
// Entries are dropped explicitly (invalidateAuthCache) when an account is changed or archived.
const AUTH_CACHE_TTL_MS = 15_000;
const authCache = new Map();

export const invalidateAuthCache = (userId) => {
  if (userId) authCache.delete(String(userId));
};

const unauthorized = (res, error, message, status = 401) =>
  res.status(status).json({ success: false, error, message });

// Loads the CURRENT account state, so deactivated/archived users and role changes
// take effect immediately instead of when the 7-day token expires.
const loadAccount = async (userId) => {
  const cached = authCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.value;

  const user = await User.findById(userId).select("email role mustChangePassword passwordChangedAt").lean();
  let value = null;

  if (user) {
    let active = true;
    if (user.role === "EMPLOYEE") {
      const employee = await Employee.findOne({ userId: user._id }).select("isDeleted employmentStatus").lean();
      active = Boolean(employee && !employee.isDeleted && employee.employmentStatus === "ACTIVE");
    }
    value = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      mustChangePassword: Boolean(user.mustChangePassword),
      passwordChangedAt: user.passwordChangedAt ? new Date(user.passwordChangedAt).getTime() : 0,
      active,
    };
  }

  authCache.set(userId, { value, expires: Date.now() + AUTH_CACHE_TTL_MS });
  if (authCache.size > 5000) {
    const now = Date.now();
    for (const [key, entry] of authCache) if (entry.expires <= now) authCache.delete(key);
  }
  return value;
};

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // 1. Check whether a Bearer token was provided.
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return unauthorized(res, "Unauthorized", "Authentication token is missing. Please log in.");
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return unauthorized(res, "Unauthorized", "Authentication token is missing. Please log in.");
  }

  // 2. Ensure the JWT secret is configured on the server.
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not configured.");
    return unauthorized(res, "Server configuration error", "Authentication is temporarily unavailable.", 500);
  }

  // 3. Verify the token.
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return unauthorized(res, "TokenExpired", "Your session has expired. Please log in again.");
    }
    if (error.name === "JsonWebTokenError" || error.name === "NotBeforeError") {
      return unauthorized(res, "InvalidToken", "Your authentication token is invalid. Please log in again.");
    }
    console.error("JWT authentication error:", error.message);
    return unauthorized(res, "AuthenticationError", "An authentication error occurred.", 500);
  }

  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded) || !decoded.userId) {
    return unauthorized(res, "Unauthorized", "Invalid authentication token. Please log in again.");
  }

  // 4. Check the account still exists, is still active, and the password was not changed since.
  try {
    const account = await loadAccount(String(decoded.userId));
    if (!account) return unauthorized(res, "Unauthorized", "Account not found. Please log in again.");
    if (!account.active) {
      return unauthorized(res, "AccountDeactivated", "Your account has been deactivated. Please contact admin.", 403);
    }
    if (account.passwordChangedAt && decoded.iat && decoded.iat * 1000 < account.passwordChangedAt - 1000) {
      return unauthorized(res, "TokenRevoked", "Your password was changed. Please log in again.");
    }

    // Keep the existing session property used by the routes; role now comes from the database.
    req.session = {
      userId: account.userId,
      email: account.email,
      role: account.role,
      mustChangePassword: account.mustChangePassword,
    };
    return next();
  } catch (error) {
    console.error("Account lookup failed:", error.message);
    return unauthorized(res, "AuthenticationError", "An authentication error occurred.", 500);
  }
};

// =====================================================
// ADMIN AUTHORIZATION MIDDLEWARE
// Requires protect to run before protectAdmin.
// =====================================================

export const protectAdmin = (req, res, next) => {
  if (!req.session) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Please log in to continue.",
    });
  }

  if (req.session.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      error: "Forbidden",
      message: "Admin access is required.",
    });
  }

  return next();
};
