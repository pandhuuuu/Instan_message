const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const Chat = require("../models/chatModel");
const User = require("../models/userModel");
const Message = require("../models/messageModel");

const sendGroupSystemMessage = async (req, chatId, content, type) => {
  try {
    const systemMessage = await Message.create({
      sender: req.user._id,
      content,
      chat: chatId,
      isSystemMessage: true,
      systemMessageType: type,
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: systemMessage._id });

    const fullMessage = await Message.findById(systemMessage._id)
      .populate("sender", "name pic username")
      .populate("chat");

    const io = req.app.get("io");
    if (io && fullMessage) {
      io.in(chatId.toString()).emit("message recieved", fullMessage);
      const chatDoc = await Chat.findById(chatId);
      if (chatDoc && chatDoc.users) {
        chatDoc.users.forEach((u) => {
          const uId = (u._id || u).toString();
          io.in(uId).emit("message recieved", fullMessage);
        });
      }
    }
    return fullMessage;
  } catch (err) {
    console.error("Error creating group system message:", err);
  }
};

//@description     Create or fetch One to One Chat
//@route           POST /api/chat/
//@access          Protected
const accessChat = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Valid userId param required" });
  }

  if (String(userId) === String(req.user._id)) {
    return res.status(400).json({ message: "Cannot create 1-on-1 chat with yourself" });
  }

  var isChat = await Chat.find({
    isGroupChat: false,
    $and: [
      { users: { $elemMatch: { $eq: req.user._id } } },
      { users: { $elemMatch: { $eq: userId } } },
    ],
  })
    .populate("users", "-password")
    .populate("latestMessage");

  isChat = await User.populate(isChat, {
    path: "latestMessage.sender",
    select: "name pic username",
  });

  if (isChat.length > 0) {
    // If chat was previously deleted/hidden by current user, restore it
    if (isChat[0].deletedBy && isChat[0].deletedBy.some((u) => String(u) === String(req.user._id))) {
      await Chat.findByIdAndUpdate(isChat[0]._id, {
        $pull: { deletedBy: req.user._id },
      });
    }

    const unread = await Message.countDocuments({
      chat: isChat[0]._id,
      sender: { $ne: req.user._id },
      readBy: { $ne: req.user._id },
      isSystemMessage: { $ne: true },
      deletedFor: { $ne: req.user._id },
    });
    const chatObj = isChat[0].toObject ? isChat[0].toObject() : isChat[0];
    chatObj.unreadCount = unread;

    // If latestMessage is deleted/cleared for current user, find previous or null
    if (
      chatObj.latestMessage &&
      chatObj.latestMessage.deletedFor &&
      chatObj.latestMessage.deletedFor.some(
        (uId) => String(uId._id || uId) === String(req.user._id)
      )
    ) {
      const prevMessage = await Message.findOne({
        chat: chatObj._id,
        deletedFor: { $ne: req.user._id },
      })
        .sort({ createdAt: -1 })
        .populate("sender", "name pic username");
      chatObj.latestMessage = prevMessage || null;
    }

    res.send(chatObj);
  } else {
    var chatData = {
      chatName: "sender",
      isGroupChat: false,
      users: [req.user._id, userId],
    };

    try {
      const createdChat = await Chat.create(chatData);
      const FullChat = await Chat.findOne({ _id: createdChat._id }).populate(
        "users",
        "-password"
      );
      const chatObj = FullChat.toObject ? FullChat.toObject() : FullChat;
      chatObj.unreadCount = 0;
      res.status(200).json(chatObj);
    } catch (error) {
      res.status(400);
      throw new Error(error.message);
    }
  }
});

//@description     Fetch all chats for a user
//@route           GET /api/chat/
//@access          Protected
const fetchChats = asyncHandler(async (req, res) => {
  try {
    let results = await Chat.find({
      users: { $elemMatch: { $eq: req.user._id } },
      deletedBy: { $ne: req.user._id },
    })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate("groupAdmins", "-password")
      .populate("latestMessage")
      .sort({ updatedAt: -1 });

    results = await User.populate(results, {
      path: "latestMessage.sender",
      select: "name pic username",
    });

    // Calculate unread message counts for each chat for current user
    const chatIds = results.map((c) => c._id);
    const unreadCounts = await Message.aggregate([
      {
        $match: {
          chat: { $in: chatIds },
          sender: { $ne: req.user._id },
          readBy: { $ne: req.user._id },
          isSystemMessage: { $ne: true },
          deletedFor: { $ne: req.user._id },
        },
      },
      {
        $group: {
          _id: "$chat",
          count: { $sum: 1 },
        },
      },
    ]);

    const unreadMap = {};
    unreadCounts.forEach((item) => {
      unreadMap[item._id.toString()] = item.count;
    });

    const chatsWithUnread = await Promise.all(
      results.map(async (chat) => {
        const chatObj = chat.toObject ? chat.toObject() : chat;
        chatObj.unreadCount = unreadMap[chat._id.toString()] || 0;

        // If latestMessage was cleared/deleted for this user, resolve to the previous visible message
        if (
          chatObj.latestMessage &&
          chatObj.latestMessage.deletedFor &&
          chatObj.latestMessage.deletedFor.some(
            (uId) => String(uId._id || uId) === String(req.user._id)
          )
        ) {
          const prevMessage = await Message.findOne({
            chat: chatObj._id,
            deletedFor: { $ne: req.user._id },
          })
            .sort({ createdAt: -1 })
            .populate("sender", "name pic username");
          chatObj.latestMessage = prevMessage || null;
        }

        return chatObj;
      })
    );

    res.status(200).send(chatsWithUnread);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Create New Group Chat
//@route           POST /api/chat/group
//@access          Protected
// Helper untuk memeriksa apakah user adalah admin grup (Pemilik atau Co-Admin)
const isUserAdmin = (chat, userId) => {
  const uId = String(userId);
  if (chat.groupAdmin && String(chat.groupAdmin._id || chat.groupAdmin) === uId) return true;
  if (chat.groupAdmins && chat.groupAdmins.some((a) => String(a._id || a) === uId)) return true;
  // Fallback jika grup legacy tidak punya admin yang valid di daftar users
  if (
    chat.users &&
    chat.users.length > 0 &&
    (!chat.groupAdmin || !chat.users.some((u) => String(u._id || u) === String(chat.groupAdmin._id || chat.groupAdmin))) &&
    String(chat.users[0]._id || chat.users[0]) === uId
  ) {
    return true;
  }
  return false;
};

//@description     Create New Group Chat
//@route           POST /api/chat/group
//@access          Protected
const createGroupChat = asyncHandler(async (req, res) => {
  if (!req.body.users || !req.body.name) {
    return res.status(400).send({ message: "Please fill in all fields" });
  }

  let users;
  try {
    users = typeof req.body.users === "string" ? JSON.parse(req.body.users) : req.body.users;
  } catch (err) {
    return res.status(400).send({ message: "Invalid users payload format" });
  }

  if (!Array.isArray(users) || users.length < 2) {
    return res
      .status(400)
      .send("More than 2 users are required to form a group chat");
  }

  users.push(req.user);

  try {
    const groupChat = await Chat.create({
      chatName: req.body.name,
      users: users,
      isGroupChat: true,
      groupAdmin: req.user,
      groupAdmins: [req.user],
    });

    await sendGroupSystemMessage(
      req,
      groupChat._id,
      `${req.user.name} created group "${req.body.name}"`,
      "create"
    );

    const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate("groupAdmins", "-password")
      .populate("latestMessage");

    const chatObj = fullGroupChat.toObject ? fullGroupChat.toObject() : fullGroupChat;
    chatObj.unreadCount = 0;
    res.status(200).json(chatObj);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// @desc    Rename Group
// @route   PUT /api/chat/rename
// @access  Protected
const renameGroup = asyncHandler(async (req, res) => {
  const { chatId, chatName } = req.body;

  if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
    res.status(400);
    throw new Error("Invalid chatId");
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Group not found");
  }

  if (!chat.isGroupChat) {
    res.status(400);
    throw new Error("This operation is only valid for group chats");
  }

  if (!chatName || typeof chatName !== "string" || !chatName.trim() || chatName.trim().length > 100) {
    res.status(400);
    throw new Error("Group name must be between 1 and 100 characters");
  }

  if (!isUserAdmin(chat, req.user._id)) {
    res.status(403);
    throw new Error("Only admins can rename the group");
  }

  chat.chatName = chatName;
  await chat.save();

  await sendGroupSystemMessage(
    req,
    chatId,
    `${req.user.name} changed group name to "${chatName}"`,
    "rename"
  );

  const updatedChat = await Chat.findById(chatId)
    .populate("users", "-password")
    .populate("groupAdmin", "-password")
    .populate("groupAdmins", "-password");

  const io = req.app.get("io");
  if (io) {
    io.in(chatId.toString()).emit("group updated", updatedChat);
  }

  res.json(updatedChat);
});

// @desc    Remove user from Group / Leave Group
// @route   PUT /api/chat/groupremove
// @access  Protected
const removeFromGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
    res.status(400);
    throw new Error("Invalid chatId");
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Group not found");
  }

  if (!chat.isGroupChat) {
    res.status(400);
    throw new Error("This operation is only valid for group chats");
  }

  const isLeaving = String(req.user._id) === String(userId);
  const requesterIsAdmin = isUserAdmin(chat, req.user._id);

  // If not leaving voluntarily, must be admin to remove
  if (!isLeaving && !requesterIsAdmin) {
    res.status(403);
    throw new Error("Only admins can remove members");
  }

  const ownerId = String(chat.groupAdmin?._id || chat.groupAdmin);
  const requesterId = String(req.user._id);

  // Other admins cannot remove the primary group owner
  if (!isLeaving && ownerId === String(userId)) {
    res.status(403);
    throw new Error("The group owner cannot be removed by other admins");
  }

  // Non-owner admin cannot remove another admin
  const isTargetAdmin = chat.groupAdmins && chat.groupAdmins.some((a) => String(a._id || a) === String(userId));
  if (!isLeaving && isTargetAdmin && ownerId !== requesterId) {
    res.status(403);
    throw new Error("Only the group owner can remove other admins");
  }

  const targetUser = await User.findById(userId);
  const targetName = targetUser ? targetUser.name : "Member";

  // Remove from users and groupAdmins
  chat.users = chat.users.filter((u) => String(u._id || u) !== String(userId));
  if (chat.groupAdmins) {
    chat.groupAdmins = chat.groupAdmins.filter((a) => String(a._id || a) !== String(userId));
  }

  // Admin Leaving scenario: auto transfer ownership
  if (isLeaving && ownerId === String(userId)) {
    if (chat.users.length > 0) {
      const newAdmin = chat.groupAdmins && chat.groupAdmins.length > 0
        ? chat.groupAdmins[0]
        : chat.users[0];
      chat.groupAdmin = newAdmin;
      if (!chat.groupAdmins) chat.groupAdmins = [];
      const newAdminId = String(newAdmin._id || newAdmin);
      if (!chat.groupAdmins.some((a) => String(a._id || a) === newAdminId)) {
        chat.groupAdmins.push(newAdmin);
      }
    } else {
      await Chat.findByIdAndDelete(chatId);
      return res.json({ message: "Group deleted because all members left", deleted: true });
    }
  }

  await chat.save();

  const content = isLeaving
    ? `${req.user.name} left the group`
    : `${req.user.name} removed ${targetName}`;

  await sendGroupSystemMessage(
    req,
    chatId,
    content,
    isLeaving ? "leave" : "remove"
  );

  const updated = await Chat.findById(chatId)
    .populate("users", "-password")
    .populate("groupAdmin", "-password")
    .populate("groupAdmins", "-password");

  const io = req.app.get("io");
  if (io) {
    io.in(chatId.toString()).emit("group updated", updated);
    io.in(userId.toString()).emit("group updated", updated);
  }

  res.json(updated);
});

// @desc    Add user to Group
// @route   PUT /api/chat/groupadd
// @access  Protected
const addToGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
    res.status(400);
    throw new Error("Invalid chatId");
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Group not found");
  }

  if (!chat.isGroupChat) {
    res.status(400);
    throw new Error("This operation is only valid for group chats");
  }

  if (!isUserAdmin(chat, req.user._id)) {
    res.status(403);
    throw new Error("Only admins can add new members");
  }

  if (chat.users.some((u) => String(u) === String(userId))) {
    res.status(400);
    throw new Error("User is already in the group");
  }

  const targetUser = await User.findById(userId);
  if (!targetUser) {
    res.status(404);
    throw new Error("User not found");
  }

  chat.users.push(userId);
  await chat.save();

  await sendGroupSystemMessage(
    req,
    chatId,
    `${req.user.name} added ${targetUser.name}`,
    "add"
  );

  const added = await Chat.findById(chatId)
    .populate("users", "-password")
    .populate("groupAdmin", "-password")
    .populate("groupAdmins", "-password");

  const io = req.app.get("io");
  if (io) {
    io.in(chatId.toString()).emit("group updated", added);
    io.in(userId.toString()).emit("group updated", added);
  }

  res.json(added);
});

// @desc    Promote member to Co-Admin
// @route   PUT /api/chat/groupadmin/promote
// @access  Protected
const promoteToAdmin = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
    res.status(400);
    throw new Error("Invalid chatId");
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Group not found");
  }

  if (!chat.isGroupChat) {
    res.status(400);
    throw new Error("This operation is only valid for group chats");
  }

  if (!isUserAdmin(chat, req.user._id)) {
    res.status(403);
    throw new Error("Only admins can promote new admins");
  }

  if (!chat.groupAdmins) chat.groupAdmins = [];
  const ownerId = String(chat.groupAdmin?._id || chat.groupAdmin);
  if (ownerId && !chat.groupAdmins.some((a) => String(a._id || a) === ownerId)) {
    chat.groupAdmins.push(chat.groupAdmin);
  }

  if (!chat.groupAdmins.some((a) => String(a._id || a) === String(userId))) {
    chat.groupAdmins.push(userId);
    await chat.save();
  }

  const targetUser = await User.findById(userId);
  const targetName = targetUser ? targetUser.name : "Member";

  await sendGroupSystemMessage(
    req,
    chatId,
    `${req.user.name} made ${targetName} an admin`,
    "promote"
  );

  const updated = await Chat.findById(chatId)
    .populate("users", "-password")
    .populate("groupAdmin", "-password")
    .populate("groupAdmins", "-password");

  const io = req.app.get("io");
  if (io) {
    io.in(chatId.toString()).emit("group updated", updated);
  }

  res.json(updated);
});

// @desc    Demote Co-Admin to regular member
// @route   PUT /api/chat/groupadmin/demote
// @access  Protected
const demoteAdmin = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
    res.status(400);
    throw new Error("Invalid chatId");
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Group not found");
  }

  if (!chat.isGroupChat) {
    res.status(400);
    throw new Error("This operation is only valid for group chats");
  }

  // Only primary group owner can demote admins
  const ownerId = String(chat.groupAdmin?._id || chat.groupAdmin);
  const requesterId = String(req.user._id);

  if (ownerId !== requesterId) {
    res.status(403);
    throw new Error("Only the group owner can demote admins");
  }

  if (ownerId === String(userId)) {
    res.status(400);
    throw new Error("The group owner cannot be demoted");
  }

  if (chat.groupAdmins) {
    chat.groupAdmins = chat.groupAdmins.filter((a) => String(a._id || a) !== String(userId));
    await chat.save();
  }

  const targetUser = await User.findById(userId);
  const targetName = targetUser ? targetUser.name : "Admin";

  await sendGroupSystemMessage(
    req,
    chatId,
    `${req.user.name} removed admin status from ${targetName}`,
    "demote"
  );

  const updated = await Chat.findById(chatId)
    .populate("users", "-password")
    .populate("groupAdmin", "-password")
    .populate("groupAdmins", "-password");

  const io = req.app.get("io");
  if (io) {
    io.in(chatId.toString()).emit("group updated", updated);
  }

  res.json(updated);
});

// @desc    Delete a chat for current user (per-user soft delete)
// @route   DELETE /api/chat/:chatId
// @access  Protected
const deleteChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
    res.status(400);
    throw new Error("Invalid chatId");
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Chat not found");
  }

  // Validate: Is user a participant
  const isParticipant = chat.users.some(
    (u) => String(u._id || u) === String(req.user._id)
  );
  if (!isParticipant) {
    res.status(403);
    throw new Error("You are not a member of this chat");
  }

  // Mark all current messages in this chat as deleted for req.user._id
  await Message.updateMany(
    { chat: chatId },
    { $addToSet: { deletedFor: req.user._id } }
  );

  // Add user to chat.deletedBy so it is hidden from their chat list
  await Chat.findByIdAndUpdate(chatId, {
    $addToSet: { deletedBy: req.user._id },
  });

  res.json({ success: true, message: "Chat deleted successfully", chatId });
});

module.exports = {
  accessChat,
  fetchChats,
  createGroupChat,
  renameGroup,
  addToGroup,
  removeFromGroup,
  promoteToAdmin,
  demoteAdmin,
  deleteChat,
};
