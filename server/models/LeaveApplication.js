import mongoose from "mongoose";

const leaveApplicationSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    type: {
      type: String,
      enum: ["SICK", "CASUAL", "EMERGENCY", "ANNUAL"],
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    reason: {
      type: String,
      required: true,
    },
    halfDay: { type: Boolean, default: false },
    requestedDays: { type: Number, min: 0, default: 0 },
    paidDays: { type: Number, min: 0, default: 0 },
    lopDays: { type: Number, min: 0, default: 0 },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },

    // Who decided, when, and why (shown to the employee and included in the decision email).
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true },
);

// Indexes MUST come after schema creation
leaveApplicationSchema.index({
  employeeId: 1,
  createdAt: -1,
});

leaveApplicationSchema.index({
  status: 1,
  createdAt: -1,
});

leaveApplicationSchema.index({ employeeId: 1, status: 1, startDate: 1, endDate: 1 });
leaveApplicationSchema.index({ status: 1, startDate: 1, endDate: 1 });

const LeaveApplication =
  mongoose.models.LeaveApplication ||
  mongoose.model("LeaveApplication", leaveApplicationSchema);

export default LeaveApplication;