const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const generateToken = require("../config/generateToken");

function escapeRegex(text) {
  return typeof text === "string" ? text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") : "";
}

//@description     Get or Search all users
//@route           GET /api/user?search=
//@access          Public
const allUsers = asyncHandler(async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const keyword = search
    ? {
      $or: [
        { name: { $regex: escapeRegex(search), $options: "i" } },
        { username: { $regex: escapeRegex(search), $options: "i" } },
      ],
    }
    : {};

  const users = await User.find(keyword).find({ _id: { $ne: req.user._id } }).select("-password").limit(50);
  res.send(users);
});

//@description     Register new user
//@route           POST /api/user/
//@access          Public
const registerUser = asyncHandler(async (req, res) => {
  const { username, name, password, pic } = req.body;

  if (!username || !password || typeof username !== "string" || typeof password !== "string") {
    res.status(400);
    throw new Error("Please enter valid username and password");
  }

  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters long");
  }

  const cleanUsername = username.toLowerCase().trim().replace(/\s+/g, "");

  const userExists = await User.findOne({ username: cleanUsername });

  if (userExists) {
    res.status(400);
    throw new Error("Username is already taken, please choose another");
  }

  const displayName = (name && typeof name === "string" && name.trim()) || cleanUsername;

  const cleanPic = (pic && typeof pic === "string" && !pic.includes("anonymous-avatar-icon")) ? pic.trim() : "";

  const user = await User.create({
    username: cleanUsername,
    name: displayName,
    password,
    pic: cleanPic,
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      username: user.username,
      name: user.name,
      isAdmin: user.isAdmin,
      pic: (user.pic && !user.pic.includes("anonymous-avatar-icon")) ? user.pic : "",
      status: user.status,
      lastSeen: user.lastSeen,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error("Failed to create user");
  }
});

//@description     Auth the user
//@route           POST /api/user/login
//@access          Public
const authUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  const rawId = (typeof username === "string" ? username : "") || (typeof email === "string" ? email : "");
  const identifier = rawId.trim();

  if (!identifier || typeof password !== "string" || !password) {
    res.status(400);
    throw new Error("Please enter username and password");
  }

  const safeIdentifier = escapeRegex(identifier);
  const user = await User.findOne({
    $or: [
      { username: identifier.toLowerCase() },
      { name: { $regex: `^${safeIdentifier}$`, $options: "i" } },
      { email: identifier.toLowerCase() },
    ],
  });

  // Constant-time comparison to mitigate timing attacks / user enumeration
  const DUMMY_HASH = "$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr";
  const isMatch = user ? await user.matchPassword(password) : await bcrypt.compare(password, DUMMY_HASH);

  if (user && isMatch) {
    // Check if user is already logged in on another active device/session
    const onlineUsers = req.app.get("onlineUsers");
    if (onlineUsers) {
      const existingPresence = onlineUsers.get(user._id.toString());
      if (
        existingPresence &&
        (existingPresence.status === "online" || existingPresence.status === "away") &&
        existingPresence.sockets &&
        existingPresence.sockets.size > 0
      ) {
        res.status(409);
        throw new Error("Akun ini sedang aktif di perangkat lain. Silakan logout dari perangkat tersebut terlebih dahulu.");
      }
    }

    res.json({
      _id: user._id,
      username: user.username,
      name: user.name,
      isAdmin: user.isAdmin,
      pic: (user.pic && !user.pic.includes("anonymous-avatar-icon")) ? user.pic : "",
      status: user.status,
      lastSeen: user.lastSeen,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error("Invalid username or password");
  }
});

//@description     Quick Connect without password (IM Spec compliance with collision handling)
//@route           POST /api/user/quick-connect
//@access          Public
const quickConnectUser = asyncHandler(async (req, res) => {
  const { username, name } = req.body;

  if (!username || typeof username !== "string" || !username.trim()) {
    res.status(400);
    throw new Error("Please enter a username");
  }

  const cleanUsername = username.toLowerCase().trim().replace(/\s+/g, "");

  // 1. Verify if username is currently active on server (Collision detection)
  const onlineUsers = req.app.get("onlineUsers");
  if (onlineUsers) {
    const isCurrentlyConnected = Array.from(onlineUsers.values()).some((u) => {
      const uName = (u.username || "").toLowerCase();
      const uDisp = (u.name || "").toLowerCase();
      return (
        (uName === cleanUsername || uDisp === cleanUsername) &&
        (u.status === "online" || u.status === "away") &&
        u.sockets &&
        u.sockets.size > 0
      );
    });

    if (isCurrentlyConnected) {
      res.status(409);
      throw new Error("Akun ini sedang aktif di perangkat lain. Silakan logout dari perangkat tersebut terlebih dahulu.");
    }
  }

  // 2. Find existing user or create on-the-fly
  let user = await User.findOne({ username: cleanUsername });

  // Prevent account takeover: Do not allow quick-connect if user is a registered password account
  if (user && !user.isQuickConnect) {
    res.status(403);
    throw new Error("Akun ini terdaftar dengan password. Silakan login melalui form Sign In.");
  }

  if (user && onlineUsers) {
    const existingPresence = onlineUsers.get(user._id.toString());
    if (
      existingPresence &&
      (existingPresence.status === "online" || existingPresence.status === "away") &&
      existingPresence.sockets &&
      existingPresence.sockets.size > 0
    ) {
      res.status(409);
      throw new Error("Akun ini sedang aktif di perangkat lain. Silakan logout dari perangkat tersebut terlebih dahulu.");
    }
  }

  if (!user) {
    const displayName = (name && name.trim()) || cleanUsername;
    user = await User.create({
      username: cleanUsername,
      name: displayName,
      password: crypto.randomBytes(24).toString("hex"),
      isQuickConnect: true,
    });
  }

  if (user) {
    res.status(200).json({
      _id: user._id,
      username: user.username,
      name: user.name,
      isAdmin: user.isAdmin,
      isQuickConnect: user.isQuickConnect || false,
      pic: (user.pic && !user.pic.includes("anonymous-avatar-icon")) ? user.pic : "",
      status: "online",
      lastSeen: new Date(),
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error("Failed to connect user");
  }
});

module.exports = { allUsers, registerUser, authUser, quickConnectUser };
