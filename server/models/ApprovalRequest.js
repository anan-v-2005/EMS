import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ["LEAVE", "DOCUMENT_VERIFICATION", "OTHER"],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", maxlength: 3000 },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    reviewComment: { type: String, default: "", maxlength: 1000 },
  },
  { timestamps: true },
);
schema.index({ status: 1, createdAt: -1 });
export default mongoose.models.ApprovalRequest ||
  mongoose.model("ApprovalRequest", schema);
