// routes/userRoute.js
import express from "express";
import upload from "../middleware/multer.js";  
import { protect } from "../middleware/authMiddleware.js";
import {
  getMyProfile,
  createChallenge,
  getMyChallenges,
  getWaitingChallenges,
  getOngoingChallenges,
  acceptChallenge,
  voteOnChallenge,
  reportChallenge,
  getAllFactions,
  joinFaction,
  leaveFaction,
} from "../controllers/userController.js";
import { getGlobalLeaderboard } from "../controllers/userController.js";
import { getFactionLeaderboard } from "../controllers/userController.js";
// import { completeChallenge } from "../controllers/userController.js";
import { blockUser } from "../controllers/userController.js";
import { unblockUser } from "../controllers/userController.js";
import { getBlockedUsers } from "../controllers/userController.js";
import { getNotifications } from "../controllers/userController.js";
import { markAsRead } from "../controllers/userController.js";
import { markAllAsRead } from "../controllers/userController.js";
import { getAllCategories } from "../controllers/userController.js";
import { updateProfile } from "../controllers/userController.js";

const router = express.Router();

router.use(protect);

// Profile
router.get("/me", getMyProfile);

// Update profile 
router.put("/profile", protect, upload.single("profileImage"), updateProfile);

// Get all categories
router.get("/categories", getAllCategories);

// Challenges
router.post("/challenges", upload.single("challengerImage"), createChallenge);      
router.get("/challenges/my", getMyChallenges);
router.get("/challenges/waiting", getWaitingChallenges);
router.get("/challenges/ongoing", getOngoingChallenges);

router.put(
  "/challenges/:id/accept",
  upload.single("acceptorImage"),      
  acceptChallenge
);

// Voting & Reporting
router.post("/challenges/:id/vote", voteOnChallenge);
router.post("/challenges/:id/report", reportChallenge);

// Factions
router.get("/factions", getAllFactions);
router.post("/factions/:id/join", joinFaction);
router.post("/factions/leave", leaveFaction);

// ==================== NOTIFICATIONS ====================
router.get("/notifications", getNotifications);
router.patch("/notifications/:id/read", markAsRead);
router.patch("/notifications/read-all", markAllAsRead);

// Leaderboards
router.get("/leaderboard/global", getGlobalLeaderboard);
router.get("/leaderboard/factions", getFactionLeaderboard);

// Challenge completion
// router.post("/challenges/:id/complete", completeChallenge);

// Blocking
router.post("/block", blockUser);
router.post("/unblock", unblockUser);
router.get("/blocked", getBlockedUsers);

export default router;

