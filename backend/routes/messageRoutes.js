const express = require("express");
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

router.route("/:chatId").get(protect, allMessages);
router.route("/").post(protect, sendMessage);
router.route("/read/:chatId").put(protect, markMessagesAsRead);
router.route("/delivered").put(protect, markMessagesAsDelivered);
router.route("/clear/:chatId").delete(protect, clearChatMessages);
router.route("/:messageId").delete(protect, deleteSingleMessage);

module.exports = router;
