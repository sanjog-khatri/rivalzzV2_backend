// models/Challenge.js
import mongoose from "mongoose";

const challengeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    challenger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    acceptor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    challengerImage: {
      type: String,
      required: true,
    },
    acceptorImage: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "ongoing", "completed"],
      default: "pending",
    },
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    voteThreshold: {
      type: Number,
      default: 10,
    },
  },
  { timestamps: true }
);

challengeSchema.index({ status: 1, createdAt: -1 });
challengeSchema.index({ challenger: 1 });
challengeSchema.index({ acceptor: 1 });

const Challenge = mongoose.model("Challenge", challengeSchema);
export default Challenge;