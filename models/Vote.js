// models/Vote.js
import mongoose from "mongoose";

const voteSchema = new mongoose.Schema(
  {
    challenge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      required: true,
    },
    voter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    votedFor: {
      type: String,
      enum: ["challenger", "acceptor"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// one vote per user per challenge (prevents duplicates)
voteSchema.index({ challenge: 1, voter: 1 }, { unique: true });

const Vote = mongoose.model("Vote", voteSchema);
export default Vote;