import mongoose from "mongoose";

// Single organisation-wide settings document (key = "default").
// `data` holds the validated settings object; defaults are merged at read time so adding
// a new setting later never requires a migration.
const schema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, minimize: false },
);

export default mongoose.models.PayrollSettings || mongoose.model("PayrollSettings", schema);
