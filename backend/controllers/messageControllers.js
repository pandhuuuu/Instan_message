const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const Chat = require("../models/chatModel");

//@description     Get all Messages
//@route           GET /api/Message/:chatId
//@access          Protected
const allMessages = asyncHandler(async (req, res) => {
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

  const isParticipant = chat.users.some(
    (u) => String(u._id || u) === String(req.user._id)
  );
  if (!isParticipant) {
    res.status(403);
    throw new Error("You are not authorized to view messages in this chat");
  }

  try {
    const messages = await Message.find({
      chat: chatId,
      deletedFor: { $ne: req.user._id },
    })
      .populate("sender", "name pic username")
      .populate("chat");
    res.json(messages);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Create New Message
//@route           POST /api/Message/
//@access          Protected
const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId } = req.body;

  if (!content || typeof content !== "string" || !content.trim() || !chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
    return res.status(400).json({ message: "Content and valid chatId are required" });
  }

  const cleanContent = content.trim();
  if (cleanContent.length > 4000) {
    return res.status(400).json({ message: "Message content cannot exceed 4000 characters" });
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Chat not found");
  }

  const isParticipant = chat.users.some(
    (u) => String(u._id || u) === String(req.user._id)
  );
  if (!isParticipant) {
    res.status(403);
    throw new Error("You are not authorized to send messages in this chat");
  }

  var newMessage = {
    sender: req.user._id,
    content: content,
    chat: chatId,
    readBy: [req.user._id],
    deliveredTo: [],
    deletedFor: [],
  };

  try {
    var message = await Message.create(newMessage);

    message = await message.populate("sender", "name pic").execPopulate();
    message = await message.populate("chat").execPopulate();
    message = await User.populate(message, {
      path: "chat.users",
      select: "name pic username",
    });

    // Update latestMessage and revive chat in list for any user who deleted it
    await Chat.findByIdAndUpdate(req.body.chatId, {
      latestMessage: message,
      deletedBy: [],
    });

    res.json(message);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Mark all messages in a chat as read by current user
//@route           PUT /api/message/read/:chatId
//@access          Protected
const markMessagesAsRead = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user._id;

  if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
    res.status(400);
    throw new Error("Invalid chatId");
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Chat not found");
  }

  const isParticipant = chat.users.some(
    (u) => String(u._id || u) === String(userId)
  );
  if (!isParticipant) {
    res.status(403);
    throw new Error("You are not authorized to update messages in this chat");
  }

  try {
    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId },
        readBy: { $ne: userId },
        deletedFor: { $ne: userId },
      },
      {
        $addToSet: {
          readBy: userId,
          deliveredTo: userId,
        },
      }
    );

    res.json({ success: true, chatId, userId });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Mark messages delivered to current user
//@route           PUT /api/message/delivered
//@access          Protected
const markMessagesAsDelivered = asyncHandler(async (req, res) => {
  const { messageIds } = req.body;
  const userId = req.user._id;

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return res.json({ success: true });
  }

  const validMessageIds = messageIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (validMessageIds.length === 0) {
    return res.json({ success: true });
  }

  try {
    // Security / IDOR: Ensure messages belong to chats where user is a participant
    const userChats = await Chat.find({ users: userId }).select("_id");
    const userChatIds = userChats.map((c) => c._id);

    await Message.updateMany(
      {
        _id: { $in: validMessageIds },
        chat: { $in: userChatIds },
        sender: { $ne: userId },
      },
      {
        $addToSet: { deliveredTo: userId },
      }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Clear messages in a chat for the current user
//@route           DELETE /api/message/clear/:chatId
//@access          Protected
const clearChatMessages = asyncHandler(async (req, res) => {
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

  // Soft delete for this user: Add user to deletedFor of all existing messages in this chat
  await Message.updateMany(
    { chat: chatId },
    { $addToSet: { deletedFor: req.user._id } }
  );

  res.json({ success: true, message: "Chat cleared successfully", chatId });
});

//@description     Delete a single message
//@route           DELETE /api/message/:messageId
//@access          Protected
const deleteSingleMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
    res.status(400);
    throw new Error("Invalid messageId");
  }

  const message = await Message.findById(messageId).populate("chat");
  if (!message) {
    res.status(404);
    throw new Error("Message not found");
  }

  const isSender = String(message.sender) === String(req.user._id);
  const chat = message.chat;
  const isGroupAdmin = chat?.isGroupChat && (
    String(chat.groupAdmin) === String(req.user._id) ||
    (chat.groupAdmins && chat.groupAdmins.some((a) => String(a) === String(req.user._id)))
  );

  if (!isSender && !isGroupAdmin) {
    res.status(403);
    throw new Error("You are not authorized to delete this message");
  }

  const chatId = chat?._id;
  await Message.findByIdAndDelete(messageId);

  // Jika pesan yang dihapus adalah latestMessage, perbarui ke pesan sebelumnya
  if (chat && String(chat.latestMessage) === String(messageId)) {
    const prevLatest = await Message.findOne({ chat: chatId }).sort({ createdAt: -1 });
    await Chat.findByIdAndUpdate(chatId, { latestMessage: prevLatest ? prevLatest._id : null });
  }

  res.json({ success: true, messageId, chatId });
});

module.exports = {
  allMessages,
  sendMessage,
  markMessagesAsRead,
  markMessagesAsDelivered,
  clearChatMessages,
  deleteSingleMessage,
};
