// End-to-End Latency Benchmark Harness
// Objective: Verify Non-Functional Requirement: Low Latency (< 200 ms)

const http = require("http");
const path = require("path");
const { performance } = require("perf_hooks");

let ioClient = null;
try {
  ioClient = require(path.join(__dirname, "../../frontend/node_modules/socket.io-client"));
} catch (e) {
  try {
    ioClient = require("socket.io-client");
  } catch (err) {
    console.error("socket.io-client not found! Make sure frontend node_modules is installed.");
    process.exit(1);
  }
}

const { httpRequest } = require("../tests/utils/testClient");

const BASE_HOST = process.env.TEST_HOST || "127.0.0.1";
const BASE_PORT = process.env.PORT || process.env.TEST_PORT || 5000;

function calculateStats(latencies) {
  if (!latencies.length) return { min: 0, max: 0, avg: 0, p95: 0, median: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avg = sum / sorted.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95Index = Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1);
  const p95 = sorted[p95Index];
  return { min, max, avg, median, p95 };
}

async function runBenchmark() {
  console.log("\n======================================================================");
  console.log("   END-TO-END LATENCY BENCHMARK (SLA REQUIREMENT: < 200 MS)           ");
  console.log("======================================================================\n");

  const suffix = Math.floor(Math.random() * 1000000);
  const aliceName = `alice_bench_${suffix}`;
  const bobName = `bob_bench_${suffix}`;

  console.log("1. Setting up Test Users & Chat...");
  const resAlice = await httpRequest({
    method: "POST",
    path: "/api/user/quick-connect",
    data: { username: aliceName, name: "Alice Latency Tester" },
  });
  const resBob = await httpRequest({
    method: "POST",
    path: "/api/user/quick-connect",
    data: { username: bobName, name: "Bob Latency Tester" },
  });

  if (resAlice.status !== 200 || resBob.status !== 200) {
    console.error("Failed to create test users:", resAlice.data, resBob.data);
    process.exit(1);
  }

  const alice = resAlice.data;
  const bob = resBob.data;

  // Create 1:1 chat between Alice and Bob
  const resChat = await httpRequest({
    method: "POST",
    path: "/api/chat",
    token: alice.token,
    data: { userId: bob._id },
  });
  const chat = resChat.data;
  console.log(`   ✓ 1:1 Chat ID: ${chat._id} created successfully.`);

  // 2. Connect 2 Client Sockets (Alice & Bob)
  console.log("\n2. Initializing Duplex WebSocket Connections (Socket.IO)...");
  const socketA = ioClient(`http://${BASE_HOST}:${BASE_PORT}`, {
    transports: ["websocket"],
    forceNew: true,
    auth: { token: alice.token },
  });
  const socketB = ioClient(`http://${BASE_HOST}:${BASE_PORT}`, {
    transports: ["websocket"],
    forceNew: true,
    auth: { token: bob.token },
  });

  await new Promise((resolve) => {
    let aReady = false, bReady = false;
    socketA.on("connect", () => {
      socketA.emit("setup", alice);
      socketA.emit("join chat", chat._id);
      aReady = true;
      if (bReady) resolve();
    });
    socketB.on("connect", () => {
      socketB.emit("setup", bob);
      socketB.emit("join chat", chat._id);
      bReady = true;
      if (aReady) resolve();
    });
  });
  // Allow 500ms delay for join room event to settle in server event loop
  await new Promise((r) => setTimeout(r, 500));
  console.log("   ✓ Sockets for Alice and Bob successfully connected and joined room.");

  // 3. TEST 1: Ephemeral In-Memory Signal (Typing Indicator)
  console.log("\n3. Testing Ephemeral Signal Latency (Typing Indicator)...");
  const typingLatencies = [];
  for (let i = 1; i <= 5; i++) {
    const t0 = performance.now();
    await new Promise((resolve) => {
      const retryInterval = setInterval(() => {
        socketA.emit("typing", chat._id);
      }, 500);

      socketB.once("typing", () => {
        clearInterval(retryInterval);
        const rtt = performance.now() - t0;
        typingLatencies.push(rtt);
        console.log(`   Sample #${i} Typing Indicator RTT: ${rtt.toFixed(2)} ms`);
        resolve();
      });
      socketA.emit("typing", chat._id);
    });
    await new Promise((r) => setTimeout(r, 100));
  }

  // 4. TEST 2: Full End-to-End Pipeline (HTTP POST ➔ DB Save ➔ Socket Broadcast ➔ Recipient)
  console.log("\n4. Testing Full End-to-End Pipeline (POST /api/message ➔ DB Save ➔ Socket Broadcast)...");
  const fullPipelineLatencies = [];
  const TOTAL_SAMPLES = 10;

  for (let i = 1; i <= TOTAL_SAMPLES; i++) {
    const content = `Latency test message #${i} at ${Date.now()}`;
    const t0 = performance.now();

    await new Promise(async (resolve) => {
      // Bob waits for message to arrive via socket
      socketB.once("message recieved", (receivedMsg) => {
        const totalDuration = performance.now() - t0;
        fullPipelineLatencies.push(totalDuration);
        console.log(`   Sample #${i} Full Pipeline End-to-End: ${totalDuration.toFixed(2)} ms`);
        resolve();
      });

      // Alice sends via REST API
      const resMsg = await httpRequest({
        method: "POST",
        path: "/api/message",
        token: alice.token,
        data: { chatId: chat._id, content },
      });

      // As soon as the server responds, Alice triggers socket broadcast
      socketA.emit("new message", resMsg.data);
    });

    // Small delay between messages (100 ms)
    await new Promise((r) => setTimeout(r, 100));
  }

  // 5. TEST 3: Delivery Receipt Round-Trip (Server double checkmark ACK)
  console.log("\n5. Testing Delivery Receipt ACK Latency (Grey Double Checkmark)...");
  const deliveryAckLatencies = [];
  for (let i = 1; i <= 5; i++) {
    const dummyMsgId = chat.latestMessage?._id || chat._id;
    const t0 = performance.now();
    await new Promise((resolve) => {
      socketA.once("message delivered update", () => {
        const rtt = performance.now() - t0;
        deliveryAckLatencies.push(rtt);
        console.log(`   Sample #${i} Delivery Receipt ACK RTT: ${rtt.toFixed(2)} ms`);
        resolve();
      });
      socketB.emit("mark messages delivered", {
        messageIds: [dummyMsgId],
        userId: bob._id,
        chatId: chat._id,
      });
    });
    await new Promise((r) => setTimeout(r, 50));
  }

  // Cleanup Sockets
  socketA.disconnect();
  socketB.disconnect();

  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chat-app";
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 2000 });
    }
    const User = require("../models/userModel");
    const Chat = require("../models/chatModel");
    const Message = require("../models/messageModel");
    await Message.deleteMany({ chat: chat._id });
    await Chat.deleteMany({ _id: chat._id });
    await User.deleteMany({ _id: { $in: [alice._id, bob._id] } });
    await mongoose.disconnect();
  } catch (e) {}

  // 6. SLA COMPLIANCE SUMMARY & ANALYSIS
  console.log("\n======================================================================");
  console.log("                  LATENCY BENCHMARK RECAPITULATION RESULTS            ");
  console.log("======================================================================");

  const statsTyping = calculateStats(typingLatencies);
  const statsFull = calculateStats(fullPipelineLatencies);
  const statsAck = calculateStats(deliveryAckLatencies);

  console.log("\n[A] Ephemeral In-Memory (Typing Signal):");
  console.log(`    Min: ${statsTyping.min.toFixed(2)} ms | Max: ${statsTyping.max.toFixed(2)} ms | Average: ${statsTyping.avg.toFixed(2)} ms | P95: ${statsTyping.p95.toFixed(2)} ms`);

  console.log("\n[B] Full Application Pipeline (HTTP POST + MongoDB Write + Socket Broadcast):");
  console.log(`    Min: ${statsFull.min.toFixed(2)} ms | Max: ${statsFull.max.toFixed(2)} ms | Average: ${statsFull.avg.toFixed(2)} ms | P95: ${statsFull.p95.toFixed(2)} ms`);

  console.log("\n[C] Delivery Receipt ACK Protocol:");
  console.log(`    Min: ${statsAck.min.toFixed(2)} ms | Max: ${statsAck.max.toFixed(2)} ms | Average: ${statsAck.avg.toFixed(2)} ms | P95: ${statsAck.p95.toFixed(2)} ms`);

  const SLA_THRESHOLD = 200.0;
  const isPassing = statsFull.p95 < SLA_THRESHOLD && statsFull.max < SLA_THRESHOLD;

  console.log("\n----------------------------------------------------------------------");
  console.log(`SLA Low Latency Criteria : < ${SLA_THRESHOLD} ms`);
  console.log(`Actual P95 Result        : ${statsFull.p95.toFixed(2)} ms`);
  console.log(`Actual Max Result        : ${statsFull.max.toFixed(2)} ms`);
  console.log(`SLA Compliance Status    : ${isPassing ? "PASS (MEETS SLA)" : "FAIL (EXCEEDS SLA)"}`);
  console.log("----------------------------------------------------------------------\n");

  process.exit(isPassing ? 0 : 1);
}

runBenchmark().catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
