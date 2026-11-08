import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
      required: true,
      index: true,
    },
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    action: {
      type: String,
      enum: [
        "CHECK_IN",
        "CHECK_OUT",
        "AUTO_CHECKOUT",
        "CHECKOUT_EDIT",
        "ABSENCE_MARKED",
      ],
      required: true,
    },
    previousCheckIn: { type: Date, default: null },
    newCheckIn: { type: Date, default: null },
    previousCheckOut: { type: Date, default: null },
    newCheckOut: { type: Date, default: null },
    reason: { type: String, default: "" },
  },
  { timestamps: true },
);
schema.index({ attendanceId: 1, createdAt: -1 });
export default mongoose.models.AttendanceAudit ||
  mongoose.model("AttendanceAudit", schema);
