// Concurrency Benchmark Harness: "For Hundreds" Scale
// Objective: Verify Non-Functional Requirement: High Concurrency for Hundreds of Connections

const path = require("path");
const { performance } = require("perf_hooks");

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
      });

      socket.on("connect", () => {
        connectedCount++;
        // Emit setup mimicking real user presence
        socket.emit("setup", {
          _id: `user_dummy_${i}_${Date.now()}`,
          name: `User Concurrency #${i}`,
          username: `user_${i}`,
        });
        // Semua join satu common test room
        socket.emit("join chat", "concurrency_benchmark_room");
        resolve();
      });

      socket.on("connect_error", (err) => {
        connectionErrors++;
        resolve();
      });

      sockets.push(socket);
    });

    connectPromises.push(p);

    // Sedikit delay batch per 50 sockets agar tidak kena rate-limit OS socket buffer
    if (i % 50 === 0 && i > 0) {
      await new Promise((r) => setTimeout(r, 20));
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
  const broadcastStart = performance.now();

  const receivePromises = sockets.map((s) => {
    return new Promise((resolve) => {
      s.once("typing", () => {
        receivedCount++;
        resolve();
      });
      // Safety timeout
      setTimeout(resolve, 3000);
    });
  });

  // Socket #0 mengirimkan event typing ke seluruh room
  sockets[0].emit("typing", "concurrency_benchmark_room");

  await Promise.all(receivePromises);
  const broadcastDuration = performance.now() - broadcastStart;

  console.log(`   ✓ Total client yang menerima broadcast: ${receivedCount} / ${connectedCount - 1} peers`);
  console.log(`   ✓ Waktu pengiriman ke seluruh ${connectedCount} peers: ${broadcastDuration.toFixed(2)} ms`);
  console.log(`   ✓ Kecepatan throughput fan-out: ~${((receivedCount / broadcastDuration) * 1000).toFixed(0)} events/second`);

  // 5. Cleanup
  console.log(`\n5. Melakukan graceful disconnect seluruh ${connectedCount} sockets...`);
  sockets.forEach((s) => s.disconnect());
  await new Promise((r) => setTimeout(r, 500));

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
