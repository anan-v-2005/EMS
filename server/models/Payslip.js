import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  { label: { type: String, trim: true, maxlength: 80 }, amount: { type: Number, min: 0 } },
  { _id: false },
);
const historySchema = new mongoose.Schema(
  { action: String, by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, at: { type: Date, default: Date.now }, note: { type: String, default: "" } },
  { _id: false },
);
const money = { type: Number, default: 0 };

const payslipSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    // ---- Legacy summary fields (kept populated so dashboards, analytics, AI and search keep working).
    // basicSalary + allowances - deductions = netSalary
    basicSalary: { type: Number, required: true },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    netSalary: { type: Number, required: true },

    // ---- Workflow ----
    // Default is "finalized" on purpose: documents created before this upgrade have no status field and
    // must keep behaving as published payslips. New payslips are always created explicitly as "draft".
    status: { type: String, enum: ["draft", "finalized"], default: "finalized" },
    mode: { type: String, enum: ["AUTO", "MANUAL"], default: "MANUAL" },
    payslipNumber: { type: String, trim: true },

    // ---- Calculation detail ----
    salary: { basic: money, hra: money, allowances: money, gross: money, source: String, segments: { type: [mongoose.Schema.Types.Mixed], default: undefined } },
    attendance: { type: mongoose.Schema.Types.Mixed, default: undefined },
    breakdown: {
      earnings: {
        basic: money, hra: money, allowances: money, overtime: money, bonus: money,
        otherEarnings: { type: [itemSchema], default: [] }, total: money,
      },
      deductions: {
        lop: money, pf: money, esi: money, professionalTax: money, tds: money,
        otherDeductions: { type: [itemSchema], default: [] }, total: money,
      },
      employer: { pf: money, esi: money },
    },
    shortfall: money,
    warnings: { type: [String], default: [] },

    // Inputs the admin supplied, so a draft can be edited and regenerated.
    adjustments: {
      bonus: money, tds: money, overtimeRate: money,
      professionalTax: { type: Number, default: null },
      otherEarnings: { type: [itemSchema], default: [] },
      otherDeductions: { type: [itemSchema], default: [] },
      note: { type: String, default: "", maxlength: 500 },
    },
    // The policy values that produced this payslip (audit trail; later settings changes never alter it).
    policy: { type: mongoose.Schema.Types.Mixed, default: undefined },

    generatedAt: Date,
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    finalizedAt: Date,
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    legacySnapshotId: { type: mongoose.Schema.Types.ObjectId, default: undefined },

    history: { type: [historySchema], default: [] },
  },
  { timestamps: true, minimize: false },
);

payslipSchema.index({ employeeId: 1, year: -1, month: -1 }, { unique: true });
payslipSchema.index({ year: -1, month: -1, status: 1 });
payslipSchema.index({ legacySnapshotId: 1 }, { unique: true, sparse: true });

// Filter for everything that is visible to employees / counted in dashboards & analytics.
// Matches finalized payslips and pre-upgrade documents that have no status field.
export const PUBLISHED = Object.freeze({ status: { $ne: "draft" } });

const Payslip = mongoose.models.Payslip || mongoose.model("Payslip", payslipSchema);
export default Payslip;
