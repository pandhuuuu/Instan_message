const mongoose = require("mongoose");
const dotenv = require("dotenv");
const colors = require("colors");

dotenv.config();

const clearDatabase = async () => {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chat-app";

  try {
    console.log("\n=======================================================".yellow);
    console.log("             RESET & CLEAR DATABASE UTILITY            ".yellow.bold);
    console.log("=======================================================".yellow);
    console.log(`Connecting to: ${mongoUri}`.cyan);

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const User = require("../models/userModel");
    const Chat = require("../models/chatModel");
    const Message = require("../models/messageModel");

    const userCount = await User.countDocuments();
    const chatCount = await Chat.countDocuments();
    const messageCount = await Message.countDocuments();

    console.log(`\nExisting records found:`.white);
    console.log(`  • Users    : ${userCount}`);
    console.log(`  • Chats    : ${chatCount}`);
    console.log(`  • Messages : ${messageCount}`);

    console.log("\nClearing all collections...".yellow);
    await Promise.all([
      User.deleteMany({}),
      Chat.deleteMany({}),
      Message.deleteMany({}),
    ]);

    console.log("  [SUCCESS] All Users deleted.".green);
    console.log("  [SUCCESS] All Chats deleted.".green);
    console.log("  [SUCCESS] All Messages deleted.".green);

    console.log("\n=======================================================".green);
    console.log("  DATABASE HAS BEEN COMPLETELY EMPTIED & RESET!        ".green.bold);
    console.log("=======================================================\n".green);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`\n[ERROR] Failed to clear database: ${error.message}`.red.bold);
    process.exit(1);
  }
};

clearDatabase();
