const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  allMessages,
  sendMessage,
  markMessagesAsRead,
  markMessagesAsDelivered,
  clearChatMessages,
  deleteSingleMessage,
} = require("../controllers/messageControllers");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // Max 120 messages per minute per IP
  message: { message: "Too many messages sent from this IP, please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

router.route("/:chatId").get(protect, allMessages);
router.route("/").post(protect, messageLimiter, sendMessage);
router.route("/read/:chatId").put(protect, markMessagesAsRead);
router.route("/delivered").put(protect, markMessagesAsDelivered);
router.route("/clear/:chatId").delete(protect, clearChatMessages);
router.route("/:messageId").delete(protect, deleteSingleMessage);

module.exports = router;
