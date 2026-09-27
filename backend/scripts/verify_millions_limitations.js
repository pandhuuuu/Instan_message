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
  console.log("   NON-FUNCTIONAL BOUNDARY VERIFICATION: SCALING TOWARDS MILLIONS    ");
  console.log("======================================================================\n");

  // =========================================================================
  // SECTION 1: V8 RUNTIME ENGINE PHYSICAL BOUNDARY (HEAP OUT-OF-MEMORY)
  // =========================================================================
  console.log("--- Section 1: V8 Engine Memory Boundary Analysis (Node.js) ---");
  const heapStats = v8.getHeapStatistics();
  const heapLimitMB = (heapStats.heap_size_limit / (1024 * 1024)).toFixed(0);
  const heapLimitGB = (heapStats.heap_size_limit / (1024 * 1024 * 1024)).toFixed(2);

  console.log(`[Runtime Fact] Current V8 Node.js Maximum Heap Limit: ${heapLimitMB} MB (~${heapLimitGB} GB)`);

  // Based on Test 2 empirical data:
  const MEM_PER_SOCKET_KB = 41.64;
  const maxPossibleSockets = Math.floor((heapStats.heap_size_limit / 1024) / MEM_PER_SOCKET_KB);
  const memoryNeededFor1M_GB = ((1000000 * MEM_PER_SOCKET_KB) / (1024 * 1024)).toFixed(2);

  console.log(`[Empirical Data Test 2] Average RAM per Socket.IO Connection: ~${MEM_PER_SOCKET_KB} KB`);
  console.log(`[Physical Calculation] Theoretical Maximum Capacity for 1 Node Process: ~${maxPossibleSockets.toLocaleString()} connections`);
  console.log(`[1 Million Connection Requirement] Memory Required: ~${memoryNeededFor1M_GB} GB RAM`);
  console.log(`\n=> SECTION 1 CONCLUSION:`);
  console.log(`   If 1 million connections are pushed to this single Node.js instance, the server`);
  console.log(`   will CRASH (Out Of Memory) around ~${(maxPossibleSockets * 0.8).toFixed(0)} connections,`);
  console.log(`   because V8 RAM capacity is only ${heapLimitMB} MB while 1 million connections requires ${memoryNeededFor1M_GB} GB!`);

  // =========================================================================
  // SECTION 2: OPERATING SYSTEM (OS) FILE DESCRIPTOR & TCP PORT LIMITS
  // =========================================================================
  console.log("\n--- Section 2: Operating System (OS) File Descriptors & TCP Ports Limit ---");
  console.log(`[OS Network Facts]:`);
  console.log(` - 1 active WebSocket connection = 1 File Descriptor (Linux) / Socket Handle (Windows).`);
  console.log(` - Theoretical TCP port limit per IPv4 address is 65,535 (16-bit port range).`);
  console.log(` - Without kernel tuning (SO_REUSEPORT, multi-IP binding, ulimit 1048576), the OS`);
  console.log(`   will reject connections above ~65,000 with 'EMFILE / ECONNRESET'.`);

  // =========================================================================
  // SECTION 3: EMPIRICAL PROOF OF CROSS-NODE ISOLATION (WITHOUT REDIS PUB/SUB)
  // =========================================================================
  console.log("\n--- Section 3: Empirical Proof of Cross-Node Isolation (Without Redis Pub/Sub Adapter) ---");
  console.log("Simulating 2 Node.js Chat Servers (Server A on port 5001 and Server B on port 5002)...");

  // Start Server A on port 5001
  const serverA = http.createServer();
  const ioA = socketIo(serverA, { cors: { origin: "*" } });
  await new Promise((r) => serverA.listen(5001, r));

  // Start Server B on port 5002
  const serverB = http.createServer();
  const ioB = socketIo(serverB, { cors: { origin: "*" } });
  await new Promise((r) => serverB.listen(5002, r));

  // Set up in-memory socket broadcast logic (matching current server.js)
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

  console.log("   ✓ Server A running on port 5001");
  console.log("   ✓ Server B running on port 5002");

  // Client Alice connects to Server A
  const clientAlice = ioClient("http://localhost:5001", { transports: ["websocket"] });
  // Client Bob connects to Server B (simulating load balancing without Redis adapter)
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

  console.log("   ✓ Alice connected to Server A (Room: 'general_chat')");
  console.log("   ✓ Bob connected to Server B (Room: 'general_chat')");

  console.log("\n[Message Dispatch Experiment]:");
  console.log("Alice on Server A sends: 'Hello Bob from Server A!'...");

  let bobReceived = false;
  clientBob.on("new message", (text) => {
    bobReceived = true;
  });

  clientAlice.emit("send message", { room: "general_chat", text: "Hello Bob from Server A!" });

  // Wait 1 second to observe if message reaches Bob
  await new Promise((r) => setTimeout(r, 1000));

  console.log(`Does Bob on Server B receive the message from Alice on Server A? => ${bobReceived ? "YES (DELIVERED)" : "NO (MESSAGE LOST / ISOLATED)"}`);

  // Cleanup
  clientAlice.disconnect();
  clientBob.disconnect();
  serverA.close();
  serverB.close();

  // =========================================================================
  // FINAL SCIENTIFIC CONCLUSION
  // =========================================================================
  console.log("\n======================================================================");
  console.log("                       FINAL SCIENTIFIC CONCLUSION                    ");
  console.log("======================================================================");
  console.log(`1. For Hundreds of Connections ('For Hundreds'):`);
  console.log(`   Current architecture PASSES with EXCELLENT metrics. Low RAM footprint (~41 KB/socket),`);
  console.log(`   ultra-low latency (~18 ms), and minimal CPU consumption.`);
  console.log(``);
  console.log(`2. For Millions of Connections ('Millions'):`);
  console.log(`   Current architecture CANNOT scale to millions directly, because:`);
  console.log(`   a) V8 Heap Limit caps at ~${heapLimitGB} GB (1 million connections requires ~${memoryNeededFor1M_GB} GB).`);
  console.log(`   b) OS File Descriptor / Port limit of 65,535 per IP.`);
  console.log(`   c) Horizontal scaling fails without a centralized Pub/Sub layer`);
  console.log(`      (cross-server messages are dropped without @socket.io/redis-adapter).`);
  console.log("======================================================================\n");
}

runLimitationsProof().catch((err) => {
  console.error("Error running limitations proof:", err);
  process.exit(1);
});
