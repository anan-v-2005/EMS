
import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    eventType: {
      type: String,
      enum: [
        "JOINED",
        "PROBATION_STARTED",
        "CONFIRMED",
        "PROMOTED",
        "TRANSFERRED",
        "SALARY_REVISED",
        "RESIGNED",
        "NOTICE_STARTED",
        "TERMINATED",
        "CONTRACT_RENEWED",
        "REACTIVATED",
        "OTHER",
      ],
      required: true,
    },

    effectiveDate: {
      type: Date,
      required: true,
    },

    details: {
      type: String,
      default: "",
      maxlength: 2000,
    },

    dedupeKey: {
      type: String,
      required: true,
      immutable: true,
    },

    previousValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

schema.index({ employee: 1, effectiveDate: -1 });

schema.index(
  { dedupeKey: 1 },
  {
    unique: true,
    name: "unique_lifecycle_dedupe_key",
    partialFilterExpression: {
      dedupeKey: { $type: "string" }
    }
  }
);
export default mongoose.models.HRLifecycleEvent ||
  mongoose.model("HRLifecycleEvent", schema);
