// routes/adminRoute.js
import express from "express";
import {
  getAllUsers,
  warnUser,
  deleteUser,
  getAllFactions,
  createFaction,
  updateFaction,
  deleteFaction,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllChallenges,
  deleteChallenge,
  getAllReports,
  reviewReport,
} from "../controllers/adminController.js";

import { protect, isAdmin } from "../middleware/authMiddleware.js";
import upload from "../middleware/multer.js";

const router = express.Router();

// Apply protection + admin check to ALL routes
router.use(protect);
router.use(isAdmin);

// User management
router.get("/users", getAllUsers);
router.patch("/users/:id/warn", warnUser);
router.delete("/users/:id", deleteUser);

// Faction CRUD
router.get("/factions", getAllFactions);
router.post("/factions", upload.single("factionImage"), createFaction);       
router.put("/factions/:id", upload.single("factionImage"), updateFaction);
router.delete("/factions/:id", deleteFaction);

// Category CRUD
router.get("/categories", getAllCategories);
router.post("/categories", upload.single("categoryImage"), createCategory);
router.put("/categories/:id", upload.single("categoryImage"), updateCategory);
router.delete("/categories/:id", deleteCategory);

// Challenge management
router.get("/challenges", getAllChallenges);
router.delete("/challenges/:id", deleteChallenge);

// Reported challenges
router.get("/reports", getAllReports);
router.patch("/reports/:id/review", reviewReport);

export default router;