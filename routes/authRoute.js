// routes/authRoute.js
import express from "express";
import upload from "../middleware/multer.js";        // ← Import multer
import { signup, login } from "../controllers/authController.js";

const router = express.Router();

// Signup with profile image upload
router.post("/signup", upload.single("profileImage"), signup);   // ← Multer added

// Login (no file upload needed)
router.post("/login", login);

export default router;