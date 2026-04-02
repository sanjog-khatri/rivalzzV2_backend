// controllers/userController.js
import Challenge from "../models/Challenge.js";
import Vote from "../models/Vote.js";
import Report from "../models/Report.js";
import User from "../models/User.js";
import Faction from "../models/Faction.js";
import Category from "../models/Category.js";
import Block from "../models/Block.js";
import Notification from "../models/Notification.js";

// ==================== HELPER: Simple Elo Rating ====================
const calculateElo = (ratingA, ratingB, scoreA, K = 32) => {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const newRatingA = Math.round(ratingA + K * (scoreA - expectedA));
  const newRatingB = Math.round(ratingB - K * (scoreA - expectedA)); // opposite for B
  return { newRatingA, newRatingB };
};

// Helper to update faction totalRating
const updateFactionRating = async (userId, ratingChange) => {
  const user = await User.findById(userId).populate("faction");
  if (!user?.faction) return;

  // Apply change but never let totalRating go below 0
  user.faction.totalRating = Math.max(0, user.faction.totalRating + ratingChange);

  await user.faction.save();
  return user.faction;
};

// Add at top with other helpers
const checkAndCompleteChallenge = async (challengeId, io) => {
  const challenge = await Challenge.findById(challengeId)
    .populate("challenger", "username rating")
    .populate("acceptor", "username rating");

  if (!challenge || challenge.status !== "ongoing") return;

  const voteCount = await Vote.countDocuments({ challenge: challengeId });

  if (voteCount >= challenge.voteThreshold) {
    // Determine winner by current rating (or by vote count)
    const challengerVotes = await Vote.countDocuments({
      challenge: challengeId,
      votedFor: "challenger",
    });
    const acceptorVotes = voteCount - challengerVotes;

    const winnerId = challengerVotes > acceptorVotes 
      ? challenge.challenger._id 
      : challenge.acceptor._id;

    challenge.status = "completed";
    challenge.winner = winnerId;
    challenge.completedAt = new Date();
    await challenge.save();

    // Notify both participants
    const message = challengerVotes > acceptorVotes 
      ? "You won the challenge!" 
      : "You lost the challenge.";

    await Notification.create({
      recipient: challenge.challenger,
      sender: null,
      type: "challenge_completed",
      message: winnerId.equals(challenge.challenger) ? "You won the challenge!" : "You lost the challenge.",
      challenge: challenge._id,
    });

    await Notification.create({
      recipient: challenge.acceptor,
      sender: null,
      type: "challenge_completed",
      message: winnerId.equals(challenge.acceptor) ? "You won the challenge!" : "You lost the challenge.",
      challenge: challenge._id,
    });

    io.to(`challenge_${challengeId}`).emit("challengeCompleted", {
      challengeId,
      winner: winnerId,
      challengerVotes,
      acceptorVotes,
      message: "Challenge has been completed!",
    });

    console.log(`Challenge ${challengeId} completed automatically`);
  }
};

// ==================== PROFILE ====================
const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("faction", "name totalRating");
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==================== UPDATE PROFILE ====================
const updateProfile = async (req, res) => {
  const { username } = req.body;
  const profileImage = req.file ? `/uploads/profiles/${req.file.filename}` : undefined;

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const updateData = {};

    // Update username if provided and different
    if (username && username.trim() !== user.username) {
      // Check if username is already taken by another user
      const existingUser = await User.findOne({ 
        username: username.trim(), 
        _id: { $ne: req.user.id } 
      });
      
      if (existingUser) {
        return res.status(400).json({ message: "Username is already taken" });
      }
      
      updateData.username = username.trim();
    }

    // Update profile image if uploaded
    if (profileImage !== undefined) {
      updateData.profileImage = profileImage;
    }

    // If nothing to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No changes provided" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.json({
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        profileImage: updatedUser.profileImage,
        rating: updatedUser.rating,
        faction: updatedUser.faction,
      },
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ==================== CATEGORIES (For Users) ====================
const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .select("name description image")   // Only send necessary fields
      .sort({ name: 1 });                 // Sort alphabetically

    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ==================== CHALLENGE CRUD (User side) ====================

const createChallenge = async (req, res) => {
  const { title, description, category } = req.body;
  const challengerImage = req.file ? `/uploads/challenges/${req.file.filename}` : null;

  if (!title) {
    return res.status(400).json({ message: "Title is required" });
  }
  if (!challengerImage) {
    return res.status(400).json({ message: "Challenge image is required" });
  }

  try {
    const catExists = await Category.findById(category);
    if (!catExists) return res.status(400).json({ message: "Invalid category" });

    const challenge = await Challenge.create({
      title,
      description: description || "",
      challenger: req.user.id,
      category,
      challengerImage,
      status: "pending",
      voteThreshold: 30,           // You can make this dynamic later
    });

    res.status(201).json({ 
      message: "Challenge created successfully", 
      challenge 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const getMyChallenges = async (req, res) => {
  try {
    let challenges = await Challenge.find({
      $or: [
        { challenger: req.user.id },
        { acceptor: req.user.id }
      ]
    })
      .populate("challenger", "username profileImage rating")
      .populate("acceptor", "username profileImage rating")
      .populate("category", "name image")
      .sort({ createdAt: -1 });

    // Add vote counts
    challenges = await Promise.all(
      challenges.map(async (challenge) => {
        const challengerVotes = await Vote.countDocuments({
          challenge: challenge._id,
          votedFor: "challenger"
        });

        const acceptorVotes = await Vote.countDocuments({
          challenge: challenge._id,
          votedFor: "acceptor"
        });

        return {
          ...challenge.toObject(),
          votes: {
            challenger: challengerVotes,
            acceptor: acceptorVotes
          }
        };
      })
    );

    res.json(challenges);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const getWaitingChallenges = async (req, res) => {
  try {
    // Get IDs of users that the current user has blocked
    const blockedUsers = await Block.find({ blocker: req.user.id }).select("blocked");
    const blockedIds = blockedUsers.map((b) => b.blocked);

    const challenges = await Challenge.find({
      status: "pending",
      acceptor: null,
      // Exclude:
      // 1. Challenges created by the logged-in user (no point seeing your own to accept)
      // 2. Challenges created by users you have blocked
      challenger: { 
        $ne: req.user.id,           // Not my own challenge
        $nin: blockedIds            // Not from blocked users
      }
    })
      .populate("challenger", "username profileImage rating")
      .populate("category", "name image")
      .sort({ createdAt: -1 });

    res.json(challenges);
  } catch (error) {
    console.error("Error fetching waiting challenges:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getOngoingChallenges = async (req, res) => {
  try {
    const blockedUsers = await Block.find({ blocker: req.user.id }).select("blocked");
    const blockedIds = blockedUsers.map((b) => b.blocked);

    let challenges = await Challenge.find({
      status: "ongoing",
      challenger: { $ne: req.user.id },
      acceptor: { $ne: req.user.id },
      $and: [
        { challenger: { $nin: blockedIds } },
        { acceptor: { $nin: blockedIds } }
      ]
    })
      .populate("challenger", "username profileImage rating")
      .populate("acceptor", "username profileImage rating")
      .populate("category", "name image")
      .sort({ createdAt: -1 });

    // Add vote counts to each challenge
    challenges = await Promise.all(
      challenges.map(async (challenge) => {
        const challengerVotes = await Vote.countDocuments({
          challenge: challenge._id,
          votedFor: "challenger"
        });

        const acceptorVotes = await Vote.countDocuments({
          challenge: challenge._id,
          votedFor: "acceptor"
        });

        return {
          ...challenge.toObject(),
          votes: {
            challenger: challengerVotes,
            acceptor: acceptorVotes
          }
        };
      })
    );

    res.json(challenges);
  } catch (error) {
    console.error("Error fetching ongoing challenges:", error);
    res.status(500).json({ message: "Server error" });
  }
};


const acceptChallenge = async (req, res) => {
  const { id } = req.params;
  const acceptorImage = req.file ? `/uploads/challenges/${req.file.filename}` : null;

  if (!acceptorImage) {
    return res.status(400).json({ message: "Your image is required" });
  }

  try {
    const challenge = await Challenge.findById(id);
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });
    if (challenge.status !== "pending") return res.status(400).json({ message: "Challenge is not pending" });
    if (challenge.challenger.toString() === req.user.id) {
      return res.status(400).json({ message: "You cannot accept your own challenge" });
    }

    challenge.acceptor = req.user.id;
    challenge.acceptorImage = acceptorImage;
    challenge.status = "ongoing";
    await challenge.save();

    const populatedChallenge = await Challenge.findById(id)
      .populate("challenger", "username profileImage")
      .populate("acceptor", "username profileImage")
      .populate("category", "name image");

    const io = req.app.get("io");

    // Save notification
    await Notification.create({
      recipient: challenge.challenger,
      sender: req.user.id,
      type: "challenge_accepted",
      message: `${req.user.username} has accepted your challenge!`,
      challenge: challenge._id,
      data: { status: "ongoing" },
    });

    // Real-time notification
    io.to(`user_${challenge.challenger}`).emit("notification", {
      type: "challenge_accepted",
      message: `${req.user.username} has accepted your challenge!`,
      challenge: populatedChallenge,
    });

    io.to(`challenge_${id}`).emit("challengeUpdated", {
      challenge: populatedChallenge,
      message: "Challenge is now ongoing!",
    });

    res.json({ 
      message: "Challenge accepted successfully", 
      challenge: populatedChallenge 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ==================== VOTING (Faction Points + Safe Total) ====================
const voteOnChallenge = async (req, res) => {
  const { id: challengeId } = req.params;
  const { votedFor } = req.body;

  if (!["challenger", "acceptor"].includes(votedFor)) {
    return res.status(400).json({ message: "Invalid vote" });
  }

  try {
    const challenge = await Challenge.findById(challengeId);
    if (!challenge || challenge.status !== "ongoing") {
      return res.status(400).json({ message: "Challenge is not open for voting" });
    }

    const voterId = req.user.id;
    const challengerId = challenge.challenger;
    const acceptorId = challenge.acceptor;

    if (voterId.toString() === challengerId.toString() || voterId.toString() === acceptorId.toString()) {
      return res.status(403).json({ message: "You cannot vote in your own challenge" });
    }

    const blockedUsers = await Block.find({ blocker: voterId }).select("blocked");
    const blockedIds = blockedUsers.map((b) => b.blocked.toString());

    if (blockedIds.includes(challengerId.toString()) || blockedIds.includes(acceptorId.toString())) {
      return res.status(403).json({ message: "You cannot vote in a challenge involving blocked users" });
    }

    let existingVote = await Vote.findOne({ challenge: challengeId, voter: voterId });
    let oldVotedFor = null;

    if (existingVote) {
      oldVotedFor = existingVote.votedFor;
      if (oldVotedFor === votedFor) {
        return res.json({ message: "You already voted for this side" });
      }
    }

    const challenger = await User.findById(challengerId);
    const acceptor = await User.findById(acceptorId);

    const challengerOldRating = challenger.rating;
    const acceptorOldRating = acceptor.rating;

    // Undo previous vote if changing
    if (existingVote) {
      const oldScore = oldVotedFor === "challenger" ? 1 : 0;
      const { newRatingA: undoA, newRatingB: undoB } = calculateElo(
        challenger.rating,
        acceptor.rating,
        oldScore === 1 ? 0 : 1,
        32
      );
      challenger.rating = undoA;
      acceptor.rating = undoB;

      const undoDelta = challengerOldRating - undoA;  
      await updateFactionRating(challengerId, -undoDelta);
      await updateFactionRating(acceptorId, -(acceptorOldRating - undoB));
    }

    // Apply new vote
    const score = votedFor === "challenger" ? 1 : 0;
    const { newRatingA, newRatingB } = calculateElo(
      challenger.rating,
      acceptor.rating,
      score,
      32
    );

    const challengerRatingChange = newRatingA - challenger.rating;
    const acceptorRatingChange = newRatingB - acceptor.rating;

    challenger.rating = newRatingA;
    acceptor.rating = newRatingB;

    // Update faction with REAL rating change
    await updateFactionRating(challengerId, challengerRatingChange);
    await updateFactionRating(acceptorId, acceptorRatingChange);

    await challenger.save();
    await acceptor.save();

    if (existingVote) {
      existingVote.votedFor = votedFor;
      await existingVote.save();
    } else {
      await Vote.create({
        challenge: challengeId,
        voter: voterId,
        votedFor,
      });
    }

    const io = req.app.get("io");

    // Get populated challenge + vote counts
    const baseChallenge = await Challenge.findById(challengeId)
      .populate("challenger", "username profileImage rating")
      .populate("acceptor", "username profileImage rating")
      .populate("category", "name image");

    const challengerVotes = await Vote.countDocuments({
      challenge: challengeId,
      votedFor: "challenger"
    });

    const acceptorVotes = await Vote.countDocuments({
      challenge: challengeId,
      votedFor: "acceptor"
    });

    const challengeWithVotes = {
      ...baseChallenge.toObject(),
      votes: { challenger: challengerVotes, acceptor: acceptorVotes }
    };

    io.to(`challenge_${challengeId}`).emit("voteUpdated", {
      challengeId,
      challenge: challengeWithVotes,
    });

    // Live faction updates
    if (challenger.faction) {
      const updatedFaction = await Faction.findById(challenger.faction);
      if (updatedFaction) {
        io.emit("factionUpdated", {
          factionId: updatedFaction._id,
          totalRating: updatedFaction.totalRating
        });
      }
    }

    if (acceptor.faction && acceptor.faction.toString() !== challenger.faction?.toString()) {
      const updatedFaction = await Faction.findById(acceptor.faction);
      if (updatedFaction) {
        io.emit("factionUpdated", {
          factionId: updatedFaction._id,
          totalRating: updatedFaction.totalRating
        });
      }
    }

    // Notifications
    if (!existingVote || oldVotedFor !== votedFor) {
      await Notification.create({
        recipient: challengerId,
        sender: voterId,
        type: "new_vote",
        message: "Someone voted in your ongoing challenge!",
        challenge: challengeId,
      });

      await Notification.create({
        recipient: acceptorId,
        sender: voterId,
        type: "new_vote",
        message: "Someone voted in your ongoing challenge!",
        challenge: challengeId,
      });

      io.to(`user_${challengerId}`).emit("notification", {
        type: "new_vote",
        message: "Someone voted in your ongoing challenge!",
        challengeId,
      });

      io.to(`user_${acceptorId}`).emit("notification", {
        type: "new_vote",
        message: "Someone voted in your ongoing challenge!",
        challengeId,
      });
    }

    await checkAndCompleteChallenge(challengeId, io);

    res.json({
      message: "Vote recorded successfully (Elo updated)",
      challengerRating: challenger.rating,
      acceptorRating: acceptor.rating,
    });
  } catch (error) {
    console.error("Vote Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ==================== REPORT CHALLENGE ====================
const reportChallenge = async (req, res) => {
  const { id: challengeId } = req.params;
  const { reason, description } = req.body;

  try {
    // Prevent duplicate reports
    const existing = await Report.findOne({ reporter: req.user.id, challenge: challengeId });
    if (existing) return res.status(400).json({ message: "You already reported this challenge" });

    const report = await Report.create({
      reporter: req.user.id,
      challenge: challengeId,
      reason,
      description: description || "",
    });

    res.status(201).json({ message: "Report submitted", report });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==================== FACTIONS ====================
const getAllFactions = async (req, res) => {
  try {
    const factions = await Faction.find()
      .select("name description image totalRating")   
      .sort({ totalRating: -1 });

    res.json(factions);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const joinFaction = async (req, res) => {
  const { id: factionId } = req.params;

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const newFaction = await Faction.findById(factionId);
    if (!newFaction) return res.status(404).json({ message: "Faction not found" });

    // If user is already in a different faction → remove from old one first
    if (user.faction && user.faction.toString() !== factionId) {
      const oldFaction = await Faction.findById(user.faction);
      if (oldFaction) {
        oldFaction.totalRating -= user.rating;   // Use current rating
        await oldFaction.save();
      }
    }

    // Add user’s CURRENT rating to the new faction
    newFaction.totalRating += user.rating;
    await newFaction.save();

    // Update user's faction reference
    user.faction = factionId;
    await user.save();

    res.json({ 
      message: "Joined faction successfully", 
      faction: newFaction 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const leaveFaction = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.faction) {
      return res.status(400).json({ message: "You are already factionless" });
    }

    const oldFaction = await Faction.findById(user.faction);
    if (oldFaction) {
      // Safe subtraction
      oldFaction.totalRating = Math.max(0, oldFaction.totalRating - user.rating);
      await oldFaction.save();
    }

    user.faction = null;
    await user.save();

    res.json({ message: "You are now factionless" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ==================== NOTIFICATIONS ====================
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .populate("sender", "username profileImage")
      .populate("challenge", "challengerImage acceptorImage status")
      .sort({ createdAt: -1 });

    const unreadCount = await Notification.countDocuments({
      recipient: req.user.id,
      isRead: false,
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const markAsRead = async (req, res) => {
  const { id } = req.params;
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: req.user.id },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: "Notification not found" });

    res.json({ message: "Notification marked as read", notification });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { isRead: true }
    );
    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Leaderboards
const getGlobalLeaderboard = async (req, res) => {
  try {
    const users = await User.find({
      role: { $ne: "admin" }        // Exclude admins
    })
      .select("username profileImage rating faction")
      .populate("faction", "name")
      .sort({ rating: -1 })
      .limit(50);

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const getFactionLeaderboard = async (req, res) => {
  try {
    const factions = await Faction.find()
      .select("name description image totalRating")
      .sort({ totalRating: -1 })
      .limit(20);
    res.json(factions);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// // Challenge Completion (manual + auto-check after vote)
// const completeChallenge = async (req, res) => {
//   const { id } = req.params;
//   try {
//     const challenge = await Challenge.findById(id);
//     if (!challenge) return res.status(404).json({ message: "Challenge not found" });
//     if (challenge.status !== "ongoing") return res.status(400).json({ message: "Challenge is not ongoing" });

//     // Only challenger or acceptor can manually complete
//     if (![challenge.challenger.toString(), challenge.acceptor.toString()].includes(req.user.id)) {
//       return res.status(403).json({ message: "Only participants can complete the challenge" });
//     }

//     challenge.status = "completed";
//     challenge.completedAt = new Date();
//     // Winner can be decided by current ratings or votes - here using ratings
//     const challenger = await User.findById(challenge.challenger);
//     const acceptor = await User.findById(challenge.acceptor);
//     challenge.winner = challenger.rating > acceptor.rating ? challenge.challenger : challenge.acceptor;

//     await challenge.save();

//     const io = req.app.get("io");
//     io.to(`challenge_${id}`).emit("challengeCompleted", { challengeId: id, winner: challenge.winner });

//     res.json({ message: "Challenge completed manually", challenge });
//   } catch (error) {
//     res.status(500).json({ message: "Server error" });
//   }
// };

// User Blocking
const blockUser = async (req, res) => {
  const { userId } = req.body; // ID of user to block
  try {
    if (userId === req.user.id) return res.status(400).json({ message: "You cannot block yourself" });

    await Block.create({ blocker: req.user.id, blocked: userId });
    res.json({ message: "User blocked successfully" });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: "User already blocked" });
    res.status(500).json({ message: "Server error" });
  }
};

const unblockUser = async (req, res) => {
  const { userId } = req.body;
  try {
    await Block.findOneAndDelete({ blocker: req.user.id, blocked: userId });
    res.json({ message: "User unblocked successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const getBlockedUsers = async (req, res) => {
  try {
    const blocked = await Block.find({ blocker: req.user.id }).populate("blocked", "username profileImage");
    res.json(blocked);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
}; 

export {
  getMyProfile,
  updateProfile,
  getAllCategories,
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
  getNotifications,
  markAsRead,
  markAllAsRead,
  getGlobalLeaderboard,
  getFactionLeaderboard,
//completeChallenge,
  blockUser,
  unblockUser,
  getBlockedUsers
};