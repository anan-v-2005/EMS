import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    priority: { type: String, enum: ["NORMAL", "IMPORTANT", "URGENT"], default: "NORMAL" },
    targetDepartments: { type: [String], default: [] },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

announcementSchema.index({ active: 1, createdAt: -1 });

export default mongoose.models.Announcement || mongoose.model("Announcement", announcementSchema);
