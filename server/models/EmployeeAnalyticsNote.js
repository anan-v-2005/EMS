import mongoose from "mongoose";

const schema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  body: { type: String, required: true, trim: true, maxlength: 4000 },
}, { timestamps: true });

schema.index({ employee: 1, createdAt: -1 });
export default mongoose.models.EmployeeAnalyticsNote || mongoose.model("EmployeeAnalyticsNote", schema);
