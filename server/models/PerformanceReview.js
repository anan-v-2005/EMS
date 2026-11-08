import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    period: { type: String, required: true, trim: true, maxlength: 40 },
    goals: [
      {
        title: { type: String, required: true, maxlength: 160 },
        description: { type: String, default: "", maxlength: 1000 },
        status: {
          type: String,
          enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"],
          default: "NOT_STARTED",
        },
      },
    ],
    rating: {
  type: Number,
  min: 1,
  max: 5,
  default: null,
  validate: {
    validator: value =>
      value === null || value === undefined || Number.isInteger(value),
    message: 'Rating must be a whole number between 1 and 5.'
  }
},
    strengths: { type: String, default: "", maxlength: 3000 },
    improvements: { type: String, default: "", maxlength: 3000 },
    employeeComments: { type: String, default: "", maxlength: 3000 },
    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED", "ACKNOWLEDGED"],
      default: "DRAFT",
    },
  },
  { timestamps: true },
);
schema.index(
  { employee: 1, period: 1 },
  { unique: true, name: "unique_employee_review_period" },
);
export default mongoose.models.PerformanceReview ||
  mongoose.model("PerformanceReview", schema);
