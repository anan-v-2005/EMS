import mongoose from "mongoose";
import { DEPARTMENTS } from "../constants/department.js";

const employeeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    firstName: {
      type: String,
      required: true,
    },

    lastName: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    position: {
      type: String,
      required: true,
    },

    basicSalary: {
      type: Number,
      default: 0,
    },

    allowance: {
      type: Number,
      default: 0,
    },

    deductions: {
      type: Number,
      default: 0,
    },

    employmentStatus: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },

    joinDate: {
      type: Date,
      required: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    bio: {
      type: String,
      default: "",
    },

    department: {
      type: String,
      enum: DEPARTMENTS,
    },

    profilePhotoUrl: {
      type: String,
      default: "",
      trim: true,
    },

    profilePhotoPublicId: {
      type: String,
      default: "",
      trim: true,
    },

    profilePhotoUploadedBy: {
      type: String,
      enum: ["ADMIN", "EMPLOYEE", ""],
      default: "",
    },
  },
  { timestamps: true },
);

// Indexes MUST come after employeeSchema is created
employeeSchema.index({
  department: 1,
  employmentStatus: 1,
  isDeleted: 1,
});

employeeSchema.index({ email: 1 });

const Employee =
  mongoose.models.Employee || mongoose.model("Employee", employeeSchema);

export default Employee;