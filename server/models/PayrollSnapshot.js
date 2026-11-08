import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    month: { type: Number, min: 1, max: 12, required: true },
    year: { type: Number, required: true },
    status: { type: String, enum: ["draft", "finalized"], default: "draft" },
    salary: {
      basic: { type: Number, default: 0 },
      hra: { type: Number, default: 0 },
      allowances: { type: Number, default: 0 },
      gross: { type: Number, default: 0 },
    },
    attendance: {
      workingDays: { type: Number, default: 0 },
      present: { type: Number, default: 0 },
      halfDays: { type: Number, default: 0 },
      paidLeaves: { type: Number, default: 0 },
      paidLeaveBreakdown: {
        sick: { type: Number, default: 0 },
        casual: { type: Number, default: 0 },
        emergency: { type: Number, default: 0 },
        annual: { type: Number, default: 0 },
      },
      lopDays: { type: Number, default: 0 },
      lateMarks: { type: Number, default: 0 },
      overtimeHours: { type: Number, default: 0 },
    },
    deductions: {
      lop: { type: Number, default: 0 },
      pf: { type: Number, default: 0 },
      professionalTax: { type: Number, default: 0 },
      tds: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    overtimePay: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    netPay: { type: Number, required: true },
    generatedAt: { type: Date, default: Date.now },
    finalizedAt: { type: Date, default: null },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);
schema.index({ employee: 1, year: -1, month: -1 }, { unique: true });
schema.index({ year: 1, month: 1, status: 1 });
schema.index({ employee: 1, status: 1, year: 1, month: 1 });
export default mongoose.models.PayrollSnapshot ||
  mongoose.model("PayrollSnapshot", schema);
