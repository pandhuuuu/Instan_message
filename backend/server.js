const express = require("express");
const connectDB = require("./config/db");
const dotenv = require("dotenv");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const path = require("path");

dotenv.config();
connectDB();
const app = express();

app.use(express.json()); // to accept json data

// Enable CORS for all incoming client requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// app.get("/", (req, res) => {
//   res.send("API Running!");
// });

app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

// --------------------------deployment------------------------------

const __dirname1 = path.resolve();

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname1, "/frontend/build")));

  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname1, "frontend", "build", "index.html"))
  );
} else {
  app.get("/", (req, res) => {
    res.send("API is running..");
  });
}

// --------------------------deployment------------------------------

// Error Handling middlewares
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT;

const server = app.listen(
  PORT,
  console.log(`Server running on PORT ${PORT}...`.yellow.bold)
);

const User = require("./models/userModel");
const Message = require("./models/messageModel");

const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

// Map to track active users: userId -> { sockets: Set, status: 'online' | 'away', lastSeen: Date }
const onlineUsers = new Map();
const socketToUser = new Map();
const socketAwayMap = new Map();

app.set("onlineUsers", onlineUsers);

io.on("connection", (socket) => {
  console.log("Connected to socket.io:", socket.id);

  socket.on("setup", async (userData) => {
    if (!userData || !userData._id) return;
    const userId = userData._id.toString();
    socket.userId = userId;
    socketToUser.set(socket.id, userId);
    socketAwayMap.set(socket.id, false);
    socket.join(userId);

    let userPresence = onlineUsers.get(userId);
    const now = new Date();
    const displayName = userData.name || userData.username || "User";
    const username = userData.username || "";
    const pic = userData.pic || "";

    if (!userPresence) {
      userPresence = {
        sockets: new Set([socket.id]),
        status: "online",
        lastSeen: now,
        name: displayName,
        username: username,
        pic: pic,
      };
      onlineUsers.set(userId, userPresence);
    } else {
      userPresence.sockets.add(socket.id);
      userPresence.status = "online";
      userPresence.name = displayName;
      userPresence.username = username;
      userPresence.pic = pic;
    }

    // Update user in database
    try {
      await User.findByIdAndUpdate(userId, { status: "online", lastSeen: now });
    } catch (err) {
      console.error("Error updating user status:", err);
    }

    // Send the current active users map to the connecting user
    const activeUsersList = {};
    onlineUsers.forEach((val, key) => {
      activeUsersList[key] = {
        status: val.status,
        lastSeen: val.lastSeen,
        name: val.name,
        username: val.username,
        pic: val.pic,
      };
    });
    socket.emit("connected", activeUsersList);

    // Broadcast to everyone that this user is online
    io.emit("user status change", {
      userId,
      status: "online",
      lastSeen: now,
      name: displayName,
      username: username,
      pic: pic,
    });
  });

  socket.on("get online users", () => {
    const activeUsersList = {};
    onlineUsers.forEach((val, key) => {
      activeUsersList[key] = {
        status: val.status,
        lastSeen: val.lastSeen,
        name: val.name,
        username: val.username,
        pic: val.pic,
      };
    });
    socket.emit("online users list", activeUsersList);
  });

  socket.on("user away", async () => {
    if (!socket.userId || !onlineUsers.has(socket.userId)) return;
    socketAwayMap.set(socket.id, true);

    const userPresence = onlineUsers.get(socket.userId);
    // Check if ALL open sockets for this user are away
    const allAway = Array.from(userPresence.sockets).every((sId) => socketAwayMap.get(sId) === true);

    if (allAway) {
      userPresence.status = "away";
      userPresence.lastSeen = new Date();

      try {
        await User.findByIdAndUpdate(socket.userId, {
          status: "away",
          lastSeen: userPresence.lastSeen,
        });
      } catch (err) {
        console.error(err);
      }

      io.emit("user status change", {
        userId: socket.userId,
        status: "away",
        lastSeen: userPresence.lastSeen,
      });
    }
  });

  socket.on("user active", async () => {
    if (!socket.userId || !onlineUsers.has(socket.userId)) return;
    socketAwayMap.set(socket.id, false);

    const userPresence = onlineUsers.get(socket.userId);
    if (userPresence.status !== "online") {
      userPresence.status = "online";

      try {
        await User.findByIdAndUpdate(socket.userId, { status: "online" });
      } catch (err) {
        console.error(err);
      }

      io.emit("user status change", {
        userId: socket.userId,
        status: "online",
        lastSeen: new Date(),
      });
    }
  });

  socket.on("join chat", (room) => {
    if (!room) return;
    const roomStr = String(room);
    socket.join(roomStr);
    console.log("User Joined Room: " + roomStr);
  });

  socket.on("leave chat", (room) => {
    if (!room) return;
    const roomStr = String(room);
    socket.leave(roomStr);
    console.log("User Left Room: " + roomStr);
  });

  socket.on("join user chats", (chatIds) => {
    if (Array.isArray(chatIds)) {
      chatIds.forEach((id) => {
        if (id) socket.join(String(id));
      });
    }
  });

  socket.on("typing", (data) => {
    if (!data) return;
    const room = typeof data === "object" ? String(data.chatId || data.room) : String(data);
    if (!room) return;
    const payload = typeof data === "object" ? data : { chatId: room };
    socket.to(room).emit("typing", payload);
  });

  socket.on("stop typing", (data) => {
    if (!data) return;
    const room = typeof data === "object" ? String(data.chatId || data.room) : String(data);
    if (!room) return;
    const payload = typeof data === "object" ? data : { chatId: room };
    socket.to(room).emit("stop typing", payload);
  });

  socket.on("new message", async (newMessageRecieved) => {
    var chat = newMessageRecieved.chat;
    if (!chat || !chat.users) return console.log("chat.users not defined");

    let isDeliveredToAny = false;
    const deliveredUserIds = [];
    const senderIdStr = String(newMessageRecieved.sender?._id || newMessageRecieved.sender);
    const chatIdStr = String(chat._id);

    chat.users.forEach((user) => {
      const recipientIdStr = String(user._id || user);
      if (recipientIdStr === senderIdStr) return;

      // Broadcast ke room personal penerima
      io.to(recipientIdStr).emit("message recieved", newMessageRecieved);

      // Check if recipient is online
      if (onlineUsers.has(recipientIdStr)) {
        isDeliveredToAny = true;
        deliveredUserIds.push(recipientIdStr);
      }
    });

    if (isDeliveredToAny && newMessageRecieved._id) {
      try {
        await Message.findByIdAndUpdate(newMessageRecieved._id, {
          $addToSet: { deliveredTo: { $each: deliveredUserIds } },
        });

        // Notify sender that message has been delivered to active online user(s)
        socket.emit("message delivered update", {
          messageId: newMessageRecieved._id,
          messageIds: [newMessageRecieved._id],
          chatId: chat._id,
          deliveredTo: deliveredUserIds,
          userId: deliveredUserIds[0],
        });
      } catch (err) {
        console.error("Error updating deliveredTo in new message:", err);
      }
    }
  });

  socket.on("mark messages read", async ({ chatId, userId }) => {
    if (!chatId || !userId) return;
    const chatIdStr = String(chatId);
    try {
      await Message.updateMany(
        {
          chat: chatIdStr,
          sender: { $ne: userId },
          readBy: { $ne: userId },
        },
        {
          $addToSet: {
            readBy: userId,
            deliveredTo: userId,
          },
        }
      );

      // Broadcast to room and chat participants
      io.in(chatIdStr).emit("messages read update", {
        chatId: chatIdStr,
        readerId: userId,
      });
    } catch (err) {
      console.error("Error in mark messages read socket event:", err);
    }
  });

  socket.on("mark messages delivered", async ({ messageIds, userId, chatId }) => {
    if (!messageIds || !messageIds.length || !userId) return;
    try {
      await Message.updateMany(
        {
          _id: { $in: messageIds },
          sender: { $ne: userId },
        },
        {
          $addToSet: { deliveredTo: userId },
        }
      );

      const payload = {
        messageIds,
        messageId: messageIds[0],
        userId,
        deliveredTo: [userId],
        chatId,
      };

      if (chatId) {
        io.in(String(chatId)).emit("message delivered update", payload);
        io.in(String(chatId)).emit("messages delivered update", payload);
      } else {
        io.emit("message delivered update", payload);
        io.emit("messages delivered update", payload);
      }
    } catch (err) {
      console.error("Error in mark messages delivered socket event:", err);
    }
  });

  socket.on("clear chat", (chatId) => {
    io.in(String(chatId)).emit("chat cleared", String(chatId));
  });

  socket.on("delete message", ({ messageId, chatId }) => {
    io.in(String(chatId)).emit("message deleted", { messageId, chatId: String(chatId) });
  });

  socket.on("delete chat", (chatId) => {
    io.in(String(chatId)).emit("chat deleted", String(chatId));
  });

  socket.on("disconnect", async () => {
    const userId = socket.userId || socketToUser.get(socket.id);
    socketAwayMap.delete(socket.id);
    socketToUser.delete(socket.id);

    if (userId && onlineUsers.has(userId)) {
      const userPresence = onlineUsers.get(userId);
      userPresence.sockets.delete(socket.id);

      if (userPresence.sockets.size === 0) {
        onlineUsers.delete(userId);
        const lastSeen = new Date();
        try {
          await User.findByIdAndUpdate(userId, { status: "offline", lastSeen });
        } catch (err) {
          console.error("Error setting user offline:", err);
        }

        io.emit("user status change", {
          userId,
          status: "offline",
          lastSeen,
        });
      } else {
        // If other sockets remain, recheck if any is active
        const anyActive = Array.from(userPresence.sockets).some((sId) => !socketAwayMap.get(sId));
        const newStatus = anyActive ? "online" : "away";
        if (userPresence.status !== newStatus) {
          userPresence.status = newStatus;
          io.emit("user status change", {
            userId,
            status: newStatus,
            lastSeen: userPresence.lastSeen,
          });
        }
      }
    }
  });
});
