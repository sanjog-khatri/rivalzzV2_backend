// server.js
import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "1.0.0.1"]); 

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";

// Routes
import authRoute from "./routes/authRoute.js";
import userRoute from "./routes/userRoute.js";
import adminRoute from "./routes/adminRoute.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", 
    credentials: true,
  },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

connectDB();

// Make io accessible in controllers
app.set("io", io);

// Routes
app.use("/api/auth", authRoute);
app.use("/api/user", userRoute);
app.use("/api/admin", adminRoute);

app.get("/", (req, res) => {
  res.send("Challenge Battle API with Real-time Notifications is running...");
});

// ==================== SOCKET.IO SETUP ====================
const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // User joins their personal notification room (using userId)
    socket.on("joinNotifications", (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
        console.log(`User ${userId} joined their notification room`);
      }
    });

    // Join a challenge room for live voting
    socket.on("joinChallenge", (challengeId) => {
      socket.join(`challenge_${challengeId}`);
    });

    socket.on("leaveChallenge", (challengeId) => {
      socket.leave(`challenge_${challengeId}`);
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
};

setupSocket(io);

// 404 & Error handlers (same as before)
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: "Something went wrong!", 
    error: process.env.NODE_ENV === "development" ? err.message : undefined 
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Socket.io ready for voting + notifications`);
});