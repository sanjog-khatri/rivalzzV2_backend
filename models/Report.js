// models/Report.js
import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    challenge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      required: true,
    },
    reason: {
      type: String,
      enum: [
        "inappropriate_content",
        "copyright_violation",
        "spam",
        "harassment",
        "other",
      ],
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "dismissed", "action_taken"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// One user can report the same challenge only once
reportSchema.index({ reporter: 1, challenge: 1 }, { unique: true });

const Report = mongoose.model("Report", reportSchema);
export default Report;