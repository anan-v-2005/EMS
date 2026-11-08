import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    date: { type: Date, required: true },
    type: { type: String, enum: ["PUBLIC", "COMPANY", "OPTIONAL"], default: "PUBLIC" },
  },
  { timestamps: true },
);

holidaySchema.index({ date: 1 });

export default mongoose.models.Holiday || mongoose.model("Holiday", holidaySchema);
