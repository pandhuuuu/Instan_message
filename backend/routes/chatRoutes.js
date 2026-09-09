const express = require("express");
const {
  accessChat,
  fetchChats,
  createGroupChat,
  removeFromGroup,
  addToGroup,
  renameGroup,
  promoteToAdmin,
  demoteAdmin,
  deleteChat,
} = require("../controllers/chatControllers");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").post(protect, accessChat);
router.route("/").get(protect, fetchChats);
router.route("/group").post(protect, createGroupChat);
router.route("/rename").put(protect, renameGroup);
router.route("/groupremove").put(protect, removeFromGroup);
router.route("/groupadd").put(protect, addToGroup);
router.route("/groupadmin/promote").put(protect, promoteToAdmin);
router.route("/groupadmin/demote").put(protect, demoteAdmin);
router.route("/:chatId").delete(protect, deleteChat);

module.exports = router;
