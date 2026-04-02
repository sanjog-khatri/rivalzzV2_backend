// controllers/adminController.js
import User from "../models/User.js";
import Faction from "../models/Faction.js";
import Category from "../models/Category.js";
import Challenge from "../models/Challenge.js";
import Report from "../models/Report.js";
import Notification from "../models/Notification.js";

// ==================== USER MANAGEMENT ====================
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").populate("faction", "name");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const warnUser = async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Add warning to user document
    user.warnings.push({ 
      message: message || "You have received a warning from admin." 
    });
    await user.save();

    // Create notification for the user
    const notification = await Notification.create({
      recipient: user._id,
      sender: req.user.id,           // Admin who sent the warning
      type: "warning",
      message: message || "You have received a warning from the admin.",
      // Optional: you can add more data if needed
    });

    const io = req.app.get("io");

    // Send real-time notification
    io.to(`user_${user._id}`).emit("notification", {
      type: "warning",
      message: message || "You have received a warning from the admin.",
      notificationId: notification._id,
    });

    res.json({ 
      message: "Warning sent successfully", 
      warnings: user.warnings 
    });
  } catch (error) {
    console.error("Warn User Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    await User.findByIdAndDelete(id);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==================== FACTION CRUD ====================
const getAllFactions = async (req, res) => {
  try {
    const factions = await Faction.find()
      .populate("createdBy", "username")
      .sort({ totalRating: -1 });
    res.json(factions);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const createFaction = async (req, res) => {
  const { name, description } = req.body;
  const image = req.file ? `/uploads/factions/${req.file.filename}` : "";

  try {
    const faction = await Faction.create({
      name,
      description,
      image,
      createdBy: req.user.id,
    });
    res.status(201).json({ message: "Faction created successfully", faction });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const updateFaction = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const image = req.file ? `/uploads/factions/${req.file.filename}` : undefined;

  try {
    const updateData = { name, description };
    if (image !== undefined) updateData.image = image;

    const faction = await Faction.findByIdAndUpdate(id, updateData, { new: true });

    if (!faction) return res.status(404).json({ message: "Faction not found" });

    res.json({ message: "Faction updated successfully", faction });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const deleteFaction = async (req, res) => {
  const { id } = req.params;
  try {
    await Faction.findByIdAndDelete(id);
    res.json({ message: "Faction deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==================== CATEGORY CRUD (Full CRUD as requested) ====================
const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .populate("createdBy", "username")
      .sort({ createdAt: -1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const createCategory = async (req, res) => {
  const { name, description } = req.body;
  const image = req.file ? `/uploads/categories/${req.file.filename}` : "";

  try {
    const category = await Category.create({
      name,
      description,
      image,
      createdBy: req.user.id,
    });
    res.status(201).json({ message: "Category created successfully", category });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const image = req.file ? `/uploads/categories/${req.file.filename}` : undefined;

  try {
    const updateData = { name, description };
    if (image) updateData.image = image;

    const category = await Category.findByIdAndUpdate(id, updateData, { new: true });

    if (!category) return res.status(404).json({ message: "Category not found" });

    res.json({ message: "Category updated successfully", category });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    // Optional: Check if any challenges are using this category before deleting
    const challengeCount = await Challenge.countDocuments({ category: id });
    if (challengeCount > 0) {
      return res.status(400).json({ 
        message: "Cannot delete category. It is being used in existing challenges." 
      });
    }

    await Category.findByIdAndDelete(id);
    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==================== CHALLENGE MANAGEMENT ====================
const getAllChallenges = async (req, res) => {
  try {
    const challenges = await Challenge.find()
      .populate("challenger", "username profileImage")
      .populate("acceptor", "username profileImage")
      .populate("category", "name image")
      .sort({ createdAt: -1 });
    res.json(challenges);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const deleteChallenge = async (req, res) => {
  const { id } = req.params;
  try {
    await Challenge.findByIdAndDelete(id);
    res.json({ message: "Challenge deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==================== REPORTED CHALLENGES ====================
const getAllReports = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate("reporter", "username")
      .populate("challenge")
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const reviewReport = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const report = await Report.findById(id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.status = status;
    await report.save();

    res.json({ message: "Report status updated", report });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};


export {
  getAllUsers,
  warnUser,
  deleteUser,
  getAllFactions,
  createFaction,
  updateFaction,
  deleteFaction,
  // Category CRUD
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  // Challenge
  getAllChallenges,
  deleteChallenge,
  // Reports
  getAllReports,
  reviewReport,
};