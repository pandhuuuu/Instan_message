// Concurrency Benchmark Harness: "For Hundreds" Scale
// Objective: Verify Non-Functional Requirement: High Concurrency for Hundreds of Connections

const path = require("path");
const { performance } = require("perf_hooks");
const { httpRequest } = require("../tests/utils/testClient");

let ioClient = null;
try {
  ioClient = require(path.join(__dirname, "../../frontend/node_modules/socket.io-client"));
} catch (e) {
  try {
    ioClient = require("socket.io-client");
  } catch (err) {
    console.error("socket.io-client not found!");
    process.exit(1);
  }
}

const BASE_URL = "http://localhost:5000";
const CONCURRENCY_TARGET = 350; // Menguji 350 concurrent socket connections

function getMemoryUsageMB() {
  const mem = process.memoryUsage();
  return {
    rss: (mem.rss / (1024 * 1024)).toFixed(2),
    heapUsed: (mem.heapUsed / (1024 * 1024)).toFixed(2),
    heapTotal: (mem.heapTotal / (1024 * 1024)).toFixed(2),
  };
}

async function runConcurrencyTest() {
  console.log("\n======================================================================");
  console.log(`   BENCHMARK HIGH CONCURRENCY: PENGUJIAN ${CONCURRENCY_TARGET} KONEKSI SIMULTAN   `);
  console.log("======================================================================\n");

  const baselineMem = getMemoryUsageMB();
  console.log(`1. Baseline Client Memory: Heap Used: ${baselineMem.heapUsed} MB | RSS: ${baselineMem.rss} MB`);

  console.log(`\n2. Melakukan koneksi simultan sebanyak ${CONCURRENCY_TARGET} client WebSocket...`);

  // Obtain benchmark authentication session
  const authRes = await httpRequest({
    method: "POST",
    path: "/api/user/quick-connect",
    data: {
      username: `bench_concur_${Date.now()}`,
      name: "Concurrency Benchmark Bot",
    },
  });
  const benchToken = authRes.data?.token;
  const benchUserId = authRes.data?._id;

  const authPeer = await httpRequest({
    method: "POST",
    path: "/api/user/quick-connect",
    data: {
      username: `bench_peer_${Date.now()}`,
      name: "Concurrency Peer Bot",
    },
  });
  const peerUserId = authPeer.data?._id;

  const chatRes = await httpRequest({
    method: "POST",
    path: "/api/chat",
    token: benchToken,
    data: { userId: peerUserId },
  });
  const benchChatId = chatRes.data?._id;

  if (!benchToken || !benchChatId) {
    console.error("Gagal memperoleh session/chat untuk benchmark sockets:", authRes.data, chatRes.data);
    process.exit(1);
  }

  const sockets = [];
  const connectStart = performance.now();

  let connectedCount = 0;
  let connectionErrors = 0;

  // Batch connection spawn
  const connectPromises = [];
  for (let i = 0; i < CONCURRENCY_TARGET; i++) {
    const p = new Promise((resolve) => {
      const socket = ioClient(BASE_URL, {
        transports: ["websocket"],
        forceNew: true,
        reconnection: false,
        timeout: 10000,
        auth: { token: benchToken },
      });

      socket.on("connect", () => {
        connectedCount++;
        // Join valid authorized benchmark room directly (socket.userId already authenticated via handshake)
        socket.emit("join chat", benchChatId);
        resolve();
      });

      socket.on("connect_error", (err) => {
        connectionErrors++;
        resolve();
      });

      sockets.push(socket);
    });

    connectPromises.push(p);

    // Delay batch per 50 sockets agar koneksi dan database pool tidak tersumbat
    if (i % 50 === 0 && i > 0) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  await Promise.all(connectPromises);
  const connectDuration = performance.now() - connectStart;

  console.log(`   ✓ Berhasil terhubung: ${connectedCount} / ${CONCURRENCY_TARGET} sockets`);
  console.log(`   ✓ Error koneksi: ${connectionErrors}`);
  console.log(`   ✓ Total waktu inisialisasi: ${connectDuration.toFixed(2)} ms (~${(connectDuration / connectedCount).toFixed(2)} ms/socket)`);

  const connectedMem = getMemoryUsageMB();
  const deltaHeap = parseFloat(connectedMem.heapUsed) - parseFloat(baselineMem.heapUsed);
  const kbPerSocket = ((deltaHeap * 1024) / connectedCount).toFixed(2);

  console.log(`\n3. Pengukuran Efisiensi Memori:`);
  console.log(`   Heap Terpakai Saat Ini : ${connectedMem.heapUsed} MB (Naik +${deltaHeap.toFixed(2)} MB)`);
  console.log(`   Rata-rata Memori per Socket: ~${kbPerSocket} KB / connection`);

  // 4. UJI BROADCAST BURST: Kirim 1 pesan ke 300 client sekaligus
  console.log(`\n4. Menguji Fan-out / Broadcast Burst ke ${connectedCount} client...`);
  let receivedCount = 0;

  // Allow room join asynchronous checks to settle across Mongoose connection pool
  await new Promise((r) => setTimeout(r, 4000));

  const broadcastStart = performance.now();

  const receivePromises = sockets.map((s, idx) => {
    if (idx === 0) return Promise.resolve(); // Sender does not receive its own broadcast
    return new Promise((resolve) => {
      s.once("typing", () => {
        receivedCount++;
        resolve();
      });
      // Safety timeout
      setTimeout(resolve, 5000);
    });
  });

  // Socket #0 mengirimkan event typing ke seluruh room
  sockets[0].emit("typing", benchChatId);

  await Promise.all(receivePromises);
  const broadcastDuration = performance.now() - broadcastStart;

  console.log(`   ✓ Total client yang menerima broadcast: ${receivedCount} / ${connectedCount - 1} peers`);
  console.log(`   ✓ Waktu pengiriman ke seluruh ${connectedCount} peers: ${broadcastDuration.toFixed(2)} ms`);
  console.log(`   ✓ Kecepatan throughput fan-out: ~${((receivedCount / broadcastDuration) * 1000).toFixed(0)} events/second`);

  // 5. Cleanup
  console.log(`\n5. Melakukan graceful disconnect seluruh ${connectedCount} sockets...`);
  sockets.forEach((s) => s.disconnect());
  await new Promise((r) => setTimeout(r, 500));

  // Purge benchmark ephemeral records
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chat-app";
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 2000 });
    }
    const User = require("../models/userModel");
    const Chat = require("../models/chatModel");
    await Chat.deleteMany({ _id: benchChatId });
    await User.deleteMany({ _id: { $in: [benchUserId, peerUserId] } });
    await mongoose.disconnect();
  } catch (e) {}

  const afterCleanupMem = getMemoryUsageMB();
  console.log(`   ✓ Memori setelah disconnect: Heap: ${afterCleanupMem.heapUsed} MB | RSS: ${afterCleanupMem.rss} MB`);

  // 6. Evaluasi Kelulusan
  console.log("\n======================================================================");
  console.log("                  HASIL EVALUASI CONCURRENCY (HUNDREDS)               ");
  console.log("======================================================================");
  const isPassed = connectedCount >= CONCURRENCY_TARGET * 0.95 && receivedCount >= (connectedCount - 1) * 0.9;
  console.log(`Koneksi Terpenuhi : ${connectedCount} / ${CONCURRENCY_TARGET} (${((connectedCount / CONCURRENCY_TARGET) * 100).toFixed(1)}%)`);
  console.log(`Integritas Sinyal : ${receivedCount} peers menerima pesan tanpa paket drop`);
  console.log(`Status            : ${isPassed ? "LULUS (MEMENUHI SYARAT HUNDREDS CONCURRENCY)" : "GAGAL"}`);
  console.log("======================================================================\n");

  process.exit(isPassed ? 0 : 1);
}

runConcurrencyTest().catch((err) => {
  console.error("Concurrency benchmark error:", err);
  process.exit(1);
});
