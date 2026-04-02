// routes/authRoute.js
import express from "express";
import upload from "../middleware/multer.js";      
import { signup, login } from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", upload.single("profileImage"), signup);   
router.post("/login", login);

export default router;