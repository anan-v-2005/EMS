import "dotenv/config";
import crypto from "node:crypto";
import connectDB from "./config/db.js";
import User from "./models/User.js";
import bcrypt from "bcryptjs";

async function registerAdmin() {
  try {
    const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();

    if (!ADMIN_EMAIL) {
      console.error("Missing ADMIN_EMAIL in ENV variable");
      process.exit(1);
    }
    await connectDB();
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
    if (existingAdmin) {
      console.log("User already exists with role", existingAdmin.role);
      process.exit(1);
    }

    // Use ADMIN_PASSWORD if you set one, otherwise generate a random one-time password.
    const temporaryPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
    if (temporaryPassword.length < 8) {
      console.error("ADMIN_PASSWORD must be at least 8 characters");
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    const admin = await User.create({
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: "ADMIN",
      mustChangePassword: true, // forced change on first login
    });
    console.log("ADMIN user created");
    console.log("\nemail    :", admin.email);
    console.log("password :", temporaryPassword);
    console.log("\nYou will be asked to change this password on first login.");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

registerAdmin();
