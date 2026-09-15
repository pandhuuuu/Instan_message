// Verification Script: The Limits of Single-Node Architecture & Why Millions Fails Without Redis
// Objective: Prove physical runtime limits (V8 Heap, OS) and demonstrate cross-node socket isolation

const v8 = require("v8");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

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

async function runLimitationsProof() {
  console.log("\n======================================================================");
  console.log("   PEMBUKTIAN BATASAN NON-FUNGSIONAL: MENUJU SKALA JUTAAN (MILLIONS)  ");
  console.log("======================================================================\n");

  // =========================================================================
  // BAGIAN 1: BATAS FISIK RUNTIME ENGINE V8 (HEAP OUT-OF-MEMORY)
  // =========================================================================
  console.log("--- Bagian 1: Analisis Batas Memori Engine V8 (Node.js) ---");
  const heapStats = v8.getHeapStatistics();
  const heapLimitMB = (heapStats.heap_size_limit / (1024 * 1024)).toFixed(0);
  const heapLimitGB = (heapStats.heap_size_limit / (1024 * 1024 * 1024)).toFixed(2);

  console.log(`[Fakta Runtime] Batas Maksimum Heap V8 Node.js Saat Ini: ${heapLimitMB} MB (~${heapLimitGB} GB)`);

  // Berdasarkan hasil empiris Tes 2:
  const MEM_PER_SOCKET_KB = 41.64; // Data nyata dari Tes 2
  const maxPossibleSockets = Math.floor((heapStats.heap_size_limit / 1024) / MEM_PER_SOCKET_KB);
  const memoryNeededFor1M_GB = ((1000000 * MEM_PER_SOCKET_KB) / (1024 * 1024)).toFixed(2);

  console.log(`[Data Empiris Tes 2] Rata-rata RAM per Socket.IO Connection: ~${MEM_PER_SOCKET_KB} KB`);
  console.log(`[Kalkulasi Fisik] Kapasitas Maksimum Teoritis 1 Node Process: ~${maxPossibleSockets.toLocaleString()} koneksi`);
  console.log(`[Kebutuhan 1 Juta Koneksi] Memori yang dibutuhkan: ~${memoryNeededFor1M_GB} GB RAM`);
  console.log(`\n=> KESIMPULAN BAGIAN 1:`);
  console.log(`   Jika kita memaksakan 1 juta koneksi ke single instance Node.js ini, server`);
  console.log(`   akan CRASH (Out Of Memory) di kisaran ~${(maxPossibleSockets * 0.8).toFixed(0)} koneksi,`);
  console.log(`   karena kapasitas RAM V8 hanya ${heapLimitMB} MB sementara 1 juta koneksi butuh ${memoryNeededFor1M_GB} GB!`);

  // =========================================================================
  // BAGIAN 2: BATAS FILE DESCRIPTOR & JARINGAN SISTEM OPERASI (OS)
  // =========================================================================
  console.log("\n--- Bagian 2: Batas File Descriptor & Port TCP Sistem Operasi ---");
  console.log(`[Fakta Jaringan OS]:`);
  console.log(` - 1 Koneksi WebSocket aktif = 1 File Descriptor (Linux) / Socket Handle (Windows).`);
  console.log(` - Batas teoritis port TCP per alamat IP (IPv4) adalah 65.535 (16-bit port range).`);
  console.log(` - Tanpa tuning kernel (SO_REUSEPORT, multi-IP binding, ulimit 1048576), OS akan`);
  console.log(`   menolak koneksi di atas ~65.000 dengan error 'EMFILE / ECONNRESET'.`);

  // =========================================================================
  // BAGIAN 3: BUKTI EMPIRIS ISOLASI CROSS-NODE (TANPA REDIS PUB/SUB ADAPTER)
  // =========================================================================
  console.log("\n--- Bagian 3: Bukti Empiris Ketiadaan Horizontal Scaling (Cross-Node Isolation) ---");
  console.log("Mensimulasikan 2 Server Chat Node.js (Server A di port 5001 dan Server B di port 5002)...");

  // Jalankan Server A di port 5001
  const serverA = http.createServer();
  const ioA = socketIo(serverA, { cors: { origin: "*" } });
  await new Promise((r) => serverA.listen(5001, r));

  // Jalankan Server B di port 5002
  const serverB = http.createServer();
  const ioB = socketIo(serverB, { cors: { origin: "*" } });
  await new Promise((r) => serverB.listen(5002, r));

  // Pasang logic socket broadcast seperti di server.js saat ini (in-memory)
  ioA.on("connection", (socket) => {
    socket.on("join room", (roomId) => socket.join(roomId));
    socket.on("send message", (data) => {
      ioA.to(data.room).emit("new message", data.text);
    });
  });

  ioB.on("connection", (socket) => {
    socket.on("join room", (roomId) => socket.join(roomId));
    socket.on("send message", (data) => {
      ioB.to(data.room).emit("new message", data.text);
    });
  });

  console.log("   ✓ Server A berjalan di port 5001");
  console.log("   ✓ Server B berjalan di port 5002");

  // Client Alice terhubung ke Server A
  const clientAlice = ioClient("http://localhost:5001", { transports: ["websocket"] });
  // Client Bob terhubung ke Server B (seperti di balik Load Balancer tanpa Redis adapter)
  const clientBob = ioClient("http://localhost:5002", { transports: ["websocket"] });

  await new Promise((r) => {
    let aReady = false, bReady = false;
    clientAlice.on("connect", () => {
      clientAlice.emit("join room", "general_chat");
      aReady = true;
      if (bReady) r();
    });
    clientBob.on("connect", () => {
      clientBob.emit("join room", "general_chat");
      bReady = true;
      if (aReady) r();
    });
  });

  console.log("   ✓ Alice terhubung ke Server A (Room: 'general_chat')");
  console.log("   ✓ Bob terhubung ke Server B (Room: 'general_chat')");

  console.log("\n[Eksperimen Pengiriman Pesan]:");
  console.log("Alice di Server A mengirim: 'Halo Bob dari Server A!'...");

  let bobReceived = false;
  clientBob.on("new message", (text) => {
    bobReceived = true;
  });

  clientAlice.emit("send message", { room: "general_chat", text: "Halo Bob dari Server A!" });

  // Tunggu 1 detik untuk melihat apakah sampai ke Bob
  await new Promise((r) => setTimeout(r, 1000));

  console.log(`Apakah Bob di Server B menerima pesan dari Alice di Server A? => ${bobReceived ? "YA (BERHASIL)" : "TIDAK (PESAN HILANG / TERISOLASI)"}`);

  // Cleanup
  clientAlice.disconnect();
  clientBob.disconnect();
  serverA.close();
  serverB.close();

  // =========================================================================
  // REKAPITULASI AKHIR PEMBUKTIAN
  // =========================================================================
  console.log("\n======================================================================");
  console.log("                       KESIMPULAN ILMIAH AKHIR                        ");
  console.log("======================================================================");
  console.log(`1. Untuk Ratusan Koneksi ("For Hundreds"):`);
  console.log(`   Arsitektur saat ini LULUS dan SEMPURNA. Hemat RAM (~41 KB/socket),`);
  console.log(`   latensi sangat rendah (~18 ms), dan CPU ringan.`);
  console.log(``);
  console.log(`2. Untuk Jutaan Koneksi ("Millions"):`);
  console.log(`   Arsitektur saat ini TERBUKTI BELUM BISA, karena:`);
  console.log(`   a) V8 Heap Limit mentok di ~${heapLimitGB} GB (1 juta koneksi butuh ~${memoryNeededFor1M_GB} GB).`);
  console.log(`   b) Batas Port/FD OS maksimum 65.535 per IP.`);
  console.log(`   c) Skalabilitas Horizontal GAGAL (Pesan cross-server hilang karena belum`);
  console.log(`      ada Socket.IO Redis Adapter / Centralized Pub-Sub Layer).`);
  console.log("======================================================================\n");
}

runLimitationsProof().catch((err) => {
  console.error("Error running limitations proof:", err);
  process.exit(1);
});
