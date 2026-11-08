import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },
    // Canonical IST day key for new queries; legacy `date` remains for backward compatibility.
    dateKey: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },

    checkIn: {
      type: Date,
      required: function () {
        return this.status !== "ABSENT";
      },
      default: null,
    },

    checkOut: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["PRESENT", "ABSENT", "LATE"],
      default: "PRESENT",
    },

    workingHours: {
      type: Number,
      default: null,
    },

    autoCheckedOut: { type: Boolean, default: false },
    needsReview: { type: Boolean, default: false },

    dayType: {
      type: String,
      enum: ["Full Day", "Three Quarter Day", "Half Day", "Short Day", null],
      default: "Full Day",
    },
  },
  {
    timestamps: true,
  },
);

attendanceSchema.index(
  {
    employeeId: 1,
    date: 1,
  },
  {
    unique: true,
  },
);

attendanceSchema.index({ date: 1, employeeId: 1 });
attendanceSchema.index(
  { employeeId: 1, dateKey: 1 },
  { unique: true, partialFilterExpression: { dateKey: { $type: "string" } } },
);

const Attendance =
  mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);

export default Attendance;
