import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    category: {
      type: String,
      enum: [
        "OFFER_LETTER",
        "CONTRACT",
        "IDENTITY",
        "EDUCATION",
        "EXPERIENCE",
        "SALARY_LETTER",
        "POLICY",
        "OTHER",
      ],
      default: "OTHER",
    },

    fileUrl: {
      type: String,
      default: "",
      maxlength: 2048,
    },

    publicId: {
      type: String,
      default: "",
    },

    resourceType: {
      type: String,
      default: "raw",
    },

    format: {
      type: String,
      default: "",
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    verificationStatus: {
      type: String,
      enum: ["PENDING", "VERIFIED", "REJECTED"],
      default: "PENDING",
    },

    notes: {
      type: String,
      default: "",
      maxlength: 1000,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Unique identifier for one document upload attempt.
    // Retries of the same attempt reuse this value.
    uploadRequestId: {
      type: String,
      trim: true,
      default: undefined,
    },
  },
  {
    timestamps: true,
  },
);

schema.index({ employee: 1, createdAt: -1 });

schema.index(
  { uploadRequestId: 1 },
  {
    unique: true,
    sparse: true,
    name: "unique_hrdocument_upload_request",
  },
);

export default mongoose.models.HRDocument ||
  mongoose.model("HRDocument", schema);