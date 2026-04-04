// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    profileImage: {
      type: String,
      default: "",
    },
    rating: {
      type: Number,
      default: 1200,
      min: 0,
    },
    faction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faction",
      default: null,
    },
    banned: {
      type: Boolean,
      default: false,
    },
    banReason: {
      type: String,
      default: "",
    },
    bannedUntil: {
      type: Date,
      default: null,        // null = permanent ban
    },
    warnings: [
      {
        message: { type: String, required: true },
        date: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// userSchema.index({ email: 1 });
// userSchema.index({ username: 1 });

const User = mongoose.model("User", userSchema);
export default User;