import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["ADMIN", "EMPLOYEE"],
      default: "EMPLOYEE",
    },
    // Force a password change on first login (new accounts, admin resets, seeded admin).
    mustChangePassword: { type: Boolean, default: false },
    // Tokens issued before this moment are rejected (set on every password change/reset).
    passwordChangedAt: { type: Date, default: null },
    // SHA-256 hash of the emailed set/reset-password token. The raw token is never stored.
    resetTokenHash: { type: String, default: "", select: false },
    resetTokenExpires: { type: Date, default: null, select: false },
  },
  { timestamps: true },
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
