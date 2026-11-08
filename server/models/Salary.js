import mongoose from "mongoose";
import { MAX_MONTHLY_AMOUNT } from "../constants/limits.js";
const schema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    basic: { type: Number, min: 0, max: MAX_MONTHLY_AMOUNT, required: true },
    hra: { type: Number, min: 0, max: MAX_MONTHLY_AMOUNT, default: 0 },
    allowances: { type: Number, min: 0, max: MAX_MONTHLY_AMOUNT, default: 0 },
    fixedMonthlyGross: {
      type: Number,
      min: 0,
      max: MAX_MONTHLY_AMOUNT,
      required: true,
    },
    effectiveFrom: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);
schema.index({ employee: 1, effectiveFrom: -1 });
schema.index({ employee: 1, isActive: 1, effectiveFrom: -1 });
export default mongoose.models.Salary || mongoose.model("Salary", schema);
