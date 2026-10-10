import "dotenv/config";
import connectDB from "./config/db.js";
import User from "./models/User.js";
import bcrypt from "bcrypt";

const TemporaryPassword = "admin123";

async function registerAdmin() {
  try {
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

    if (!ADMIN_EMAIL) {
      console.error("Missing Admin Email in ENV variable");
      process.exit(1);
    }
    await connectDB();
    const existingAdmin = await User.findOne({
      email: process.env.ADMIN_EMAIL,
    });
    if (existingAdmin) {
      console.log("User Already exists as role", existingAdmin.role);
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(TemporaryPassword, 10);
    const admin = await User.create({
      email: process.env.ADMIN_EMAIL,
      password: hashedPassword,
      role: "ADMIN",
    });
    console.log("ADMIN user Created");
    console.log("\nemail :", admin.email);
    console.log("\npassword :", TemporaryPassword);
    console.log("\nChange the Password after Login");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
  }
}

registerAdmin()