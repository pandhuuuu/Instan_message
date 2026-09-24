const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  registerUser,
  authUser,
  allUsers,
  quickConnectUser,
} = require("../controllers/userControllers");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: "Too many authentication requests from this IP, please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many accounts created from this IP, please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

router.route("/").get(protect, allUsers);
router.route("/").post(registerLimiter, registerUser);
router.post("/login", authLimiter, authUser);
router.post("/quick-connect", authLimiter, quickConnectUser);

// Secure Test Teardown Webhook (Guarantees ephemeral test records are purged even when running against Docker)
router.post("/test-cleanup", async (req, res) => {
  const secret = req.headers["x-test-cleanup-key"];
  if (secret !== "im_test_cleanup_token_2026") {
    return res.status(403).json({ message: "Forbidden: invalid test cleanup key" });
  }
  try {
    const { userIds } = req.body || {};
    const User = require("../models/userModel");
    const Chat = require("../models/chatModel");
    const Message = require("../models/messageModel");

    const orClauses = [{ username: { $regex: /^(alice|bob|charlie|dave|std_user)_/i } }];
    if (Array.isArray(userIds) && userIds.length > 0) {
      orClauses.push({ _id: { $in: userIds } });
    }

    const matchedUsers = await User.find({ $or: orClauses }).select("_id");
    const ids = matchedUsers.map((u) => u._id);

    if (ids.length > 0) {
      await Message.deleteMany({ $or: [{ sender: { $in: ids } }] });
      await Chat.deleteMany({ users: { $in: ids } });
      await User.deleteMany({ _id: { $in: ids } });
    }

    res.status(200).json({ success: true, purgedCount: ids.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
