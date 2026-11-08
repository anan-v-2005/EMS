import mongoose from "mongoose";

// Delivery log for outgoing email. Bodies are never stored (they can contain reset links).
const schema = new mongoose.Schema(
  {
    to: { type: String, required: true },
    subject: { type: String, default: "" },
    status: { type: String, enum: ["SENT", "FAILED", "SKIPPED"], required: true },
    attempts: { type: Number, default: 1 },
    error: { type: String, default: "" },
    messageId: { type: String, default: "" },
  },
  { timestamps: true },
);

schema.index({ createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
// Keep 90 days of history.
schema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.models.EmailLog || mongoose.model("EmailLog", schema);
