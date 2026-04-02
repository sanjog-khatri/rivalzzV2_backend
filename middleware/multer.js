// middleware/multer.js
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Get current directory 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads folder if it doesn't exist
const uploadDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Sub-folders for better organization
const profileDir = path.join(uploadDir, "profiles");
const categoryDir = path.join(uploadDir, "categories");
const challengeDir = path.join(uploadDir, "challenges");
const factionDir = path.join(uploadDir, "factions");

[profileDir, categoryDir, challengeDir, factionDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Decide folder based on fieldname
    if (file.fieldname === "profileImage") {
      cb(null, profileDir);
    } else if (file.fieldname === "categoryImage") {
      cb(null, categoryDir);
    } else if (file.fieldname === "challengerImage" || file.fieldname === "acceptorImage") {
      cb(null, challengeDir);
    } else if (file.fieldname === "factionImage" || file.fieldname === "factionImage") {
      cb(null, factionDir);
    } else {
      cb(null, uploadDir); // fallback
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpg, jpeg, png, webp, gif)"));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter,
});

export default upload;