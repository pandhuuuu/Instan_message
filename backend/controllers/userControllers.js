const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const generateToken = require("../config/generateToken");

//@description     Get or Search all users
//@route           GET /api/user?search=
//@access          Public
const allUsers = asyncHandler(async (req, res) => {
  const keyword = req.query.search
    ? {
      $or: [
        { name: { $regex: req.query.search, $options: "i" } },
        { username: { $regex: req.query.search, $options: "i" } },
      ],
    }
    : {};

  const users = await User.find(keyword).find({ _id: { $ne: req.user._id } });
  res.send(users);
});

//@description     Register new user
//@route           POST /api/user/
//@access          Public
const registerUser = asyncHandler(async (req, res) => {
  const { username, name, password, pic } = req.body;

  if (!username || !password) {
    res.status(400);
    throw new Error("Please enter username and password");
  }

  const cleanUsername = username.toLowerCase().trim().replace(/\s+/g, "");

  const userExists = await User.findOne({ username: cleanUsername });

  if (userExists) {
    res.status(400);
    throw new Error("Username is already taken, please choose another");
  }

  const displayName = (name && name.trim()) || cleanUsername;

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
  const identifier = (username || email || "").trim();

  if (!identifier || !password) {
    res.status(400);
    throw new Error("Please enter username and password");
  }

  const user = await User.findOne({
    $or: [
      { username: identifier.toLowerCase() },
      { name: { $regex: `^${identifier}$`, $options: "i" } },
      { email: identifier.toLowerCase() },
    ],
  });

  if (user && (await user.matchPassword(password))) {
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

  if (!username) {
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
      password: "QuickConnectPassword123!",
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
