import mongoose from "mongoose";
const bucket = () => ({
  total: { type: Number, required: true },
  used: { type: Number, default: 0, min: 0 },
  pending: { type: Number, default: 0, min: 0 },
  remaining: { type: Number, required: true, min: 0 },
});
const schema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    year: { type: Number, required: true },
    balances: {
      sick: { type: bucket(), default: () => ({ total: 7, remaining: 7 }) },
      casual: { type: bucket(), default: () => ({ total: 7, remaining: 7 }) },
      emergency: {
        type: bucket(),
        default: () => ({ total: 3, remaining: 3 }),
      },
      annual: { type: bucket(), default: () => ({ total: 3, remaining: 3 }) },
    },
  },
  { timestamps: true },
);
schema.index({ employee: 1, year: 1 }, { unique: true });
export default mongoose.models.LeaveBalance ||
  mongoose.model("LeaveBalance", schema);
