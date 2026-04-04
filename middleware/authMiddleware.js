// middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // ====================== BAN CHECK ======================
      if (user.banned) {
        const now = new Date();

        // Case 1: Temporary Ban
        if (user.bannedUntil && user.bannedUntil > now) {
          return res.status(403).json({
            message: `Your account is temporarily banned until ${user.bannedUntil.toLocaleDateString()}.`,
            banReason: user.banReason || "No reason provided",
            bannedUntil: user.bannedUntil,
            isTemporary: true,
          });
        }

        // Case 2: Permanent Ban
        if (user.banned && (!user.bannedUntil || user.bannedUntil <= now)) {
          return res.status(403).json({
            message: "Your account has been permanently banned by the admin.",
            banReason: user.banReason || "No reason provided",
            isTemporary: false,
          });
        }
      }
      // =======================================================

      req.user = user;
      next();
    } catch (error) {
      console.error("Token verification error:", error.message);
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

// Admin middleware (remains the same)
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    return res.status(403).json({ message: "Not authorized as admin" });
  }
};

export { protect, isAdmin };