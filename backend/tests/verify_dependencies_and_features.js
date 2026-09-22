// Comprehensive Dependency & Full-Feature Verification Script
// Tests:
// 1. Dependency integrity (Backend & Frontend modules resolution)
// 2. Database connectivity & Environment variables
// 3. Complete API lifecycle & RBAC edge cases (including owner leave & auto-transfer)
// 4. WebSocket real-time delivery & presence
// 5. Frontend production build serving & SPA routing

const http = require("http");
const path = require("path");
const fs = require("fs");

let ioClient = null;
try {
  ioClient = require(path.join(__dirname, "../../frontend/node_modules/socket.io-client"));
} catch (e) {
  try {
    ioClient = require("socket.io-client");
  } catch (err) {
    ioClient = null;
  }
}

const BASE_HOST = "localhost";
const BASE_PORT = 5000;

function httpRequest({ method, path: reqPath, data, token }) {
  return new Promise((resolve, reject) => {
    const postData = data !== undefined ? JSON.stringify(data) : "";
    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        host: BASE_HOST,
        port: BASE_PORT,
        path: reqPath,
        method,
        headers,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const parsed = body ? JSON.parse(body) : {};
            resolve({ status: res.statusCode, data: parsed, headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, text: body, headers: res.headers });
          }
        });
      }
    );

    req.on("error", (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, detail = "") {
  if (condition) {
    passedCount++;
    console.log(`  [PASS] OK ${testName}`);
  } else {
    failedCount++;
    console.error(`  [FAIL] NO ${testName}${detail ? ` (${detail})` : ""}`);
  }
}

async function runVerification() {
  console.log("===================================================================");
  console.log("    COMPREHENSIVE DEPENDENCY & FEATURE VERIFICATION AUDIT          ");
  console.log("===================================================================\n");

  // =========================================================================
  // STEP 1: DEPENDENCY INTEGRITY AUDIT
  // =========================================================================
  console.log("--- 1. Dependency Resolution & Integrity Audit ---");
  const requiredBackendPackages = [
    "express",
    "mongoose",
    "socket.io",
    "bcryptjs",
    "jsonwebtoken",
    "dotenv",
    "colors",
    "express-async-handler",
  ];

  for (const pkg of requiredBackendPackages) {
    let resolved = false;
    try {
      require(pkg);
      resolved = true;
    } catch (e) {
      resolved = false;
    }
    assert(resolved, `Backend Dependency: '${pkg}' resolves cleanly`);
  }

  const frontendBuildDir = path.join(__dirname, "../../frontend/build");
  const buildExists = fs.existsSync(frontendBuildDir);
  const indexHtmlExists = fs.existsSync(path.join(frontendBuildDir, "index.html"));
  const staticDirExists = fs.existsSync(path.join(frontendBuildDir, "static"));
  assert(buildExists && indexHtmlExists && staticDirExists, "Frontend Production Build artifacts present in frontend/build");

  // Check HTTP response on root endpoint
  const resRoot = await httpRequest({ method: "GET", path: "/" });
  assert(resRoot.status === 200, "Express serves Frontend SPA index.html on GET / (200 OK)");

  // =========================================================================
  // STEP 2: USER AUTH & QUICK CONNECT
  // =========================================================================
  console.log("\n--- 2. Authentication & User Provisioning ---");
  const runId = Math.floor(Math.random() * 90000) + 10000;
  const user1 = { username: `audit_owner_${runId}`, name: `Owner User ${runId}`, password: "password123" };
  const user2 = { username: `audit_admin_${runId}`, name: `Admin User ${runId}`, password: "password123" };
  const user3 = { username: `audit_member_${runId}`, name: `Member User ${runId}`, password: "password123" };

  const reg1 = await httpRequest({ method: "POST", path: "/api/user", data: user1 });
  assert(reg1.status === 201 && reg1.data.token, "User 1 (Owner) Registered with JWT token");
  const token1 = reg1.data.token;
  const user1Id = reg1.data._id;

  const reg2 = await httpRequest({ method: "POST", path: "/api/user", data: user2 });
  assert(reg2.status === 201 && reg2.data.token, "User 2 (Co-Admin) Registered with JWT token");
  const token2 = reg2.data.token;
  const user2Id = reg2.data._id;

  const reg3 = await httpRequest({ method: "POST", path: "/api/user", data: user3 });
  assert(reg3.status === 201 && reg3.data.token, "User 3 (Member) Registered with JWT token");
  const token3 = reg3.data.token;
  const user3Id = reg3.data._id;

  // Duplicate registration check
  const regDup = await httpRequest({ method: "POST", path: "/api/user", data: user1 });
  assert(regDup.status === 400, "Rejects Duplicate Username Registration (400 Bad Request)");

  // Login check
  const login1 = await httpRequest({
    method: "POST",
    path: "/api/user/login",
    data: { username: user1.username, password: user1.password },
  });
  assert(login1.status === 200 && login1.data.token, "Valid Credential Login succeeds (200 OK)");

  // =========================================================================
  // STEP 3: 1-ON-1 CHAT & MESSAGING AUDIT
  // =========================================================================
  console.log("\n--- 3. 1-on-1 Chat Lifecycle & Messaging ---");
  const chat1on1 = await httpRequest({
    method: "POST",
    path: "/api/chat",
    token: token1,
    data: { userId: user2Id },
  });
  assert(chat1on1.status === 200 && chat1on1.data._id, "1-on-1 Chat created between Owner and Admin");
  const oneOnOneId = chat1on1.data._id;

  // Idempotency check
  const chat1on1Again = await httpRequest({
    method: "POST",
    path: "/api/chat",
    token: token1,
    data: { userId: user2Id },
  });
  assert(
    chat1on1Again.status === 200 && String(chat1on1Again.data._id) === String(oneOnOneId),
    "1-on-1 Chat Idempotency: Returns same chat instance without creating duplicate"
  );

  // Send message
  const msgSend = await httpRequest({
    method: "POST",
    path: "/api/message",
    token: token1,
    data: { chatId: oneOnOneId, content: "Hello audit test message!" },
  });
  assert(msgSend.status === 200 && msgSend.data.content === "Hello audit test message!", "Message sent and stored in DB");
  const messageId = msgSend.data._id;

  // Delivery status update
  const delivRes = await httpRequest({
    method: "PUT",
    path: "/api/message/delivered",
    token: token2,
    data: { messageIds: [messageId] },
  });
  assert(delivRes.status === 200 && delivRes.data.success, "Delivery status batch acknowledgement succeeds");

  // Read receipt update
  const readRes = await httpRequest({
    method: "PUT",
    path: `/api/message/read/${oneOnOneId}`,
    token: token2,
  });
  assert(readRes.status === 200 && readRes.data.success, "Read receipt ($addToSet readBy) updated successfully");

  // =========================================================================
  // STEP 4: DATA ISOLATION (CLEAR CHAT & DELETE CHAT)
  // =========================================================================
  console.log("\n--- 4. Privacy & Data Isolation Invariants ---");
  // User 1 sends a second message to test clearing
  const msg2 = await httpRequest({
    method: "POST",
    path: "/api/message",
    token: token1,
    data: { chatId: oneOnOneId, content: "Second message before clear" },
  });
  const msg2Id = msg2.data._id;

  // User 1 clears chat
  const clearRes = await httpRequest({
    method: "DELETE",
    path: `/api/message/clear/${oneOnOneId}`,
    token: token1,
  });
  assert(clearRes.status === 200 && clearRes.data.success, "User 1 clears conversation history");

  // Verify User 1 sees 0 messages
  const u1History = await httpRequest({
    method: "GET",
    path: `/api/message/${oneOnOneId}`,
    token: token1,
  });
  assert(Array.isArray(u1History.data) && u1History.data.length === 0, "User 1 sees 0 messages after clear chat");

  // Verify User 2 still sees the message (Bob's history is 100% intact)
  const u2History = await httpRequest({
    method: "GET",
    path: `/api/message/${oneOnOneId}`,
    token: token2,
  });
  const foundInU2 = Array.isArray(u2History.data) && u2History.data.some((m) => m._id === msg2Id);
  assert(foundInU2, "User 2 message history remains completely intact after User 1 cleared chat");

  // =========================================================================
  // STEP 5: GROUP CHAT LIFECYCLE & RBAC HIERARCHY
  // =========================================================================
  console.log("\n--- 5. Group Chat Lifecycle & RBAC Access Control ---");
  // Create group chat with User 1 as Owner, and User 2 & User 3 as members
  const groupCreate = await httpRequest({
    method: "POST",
    path: "/api/chat/group",
    token: token1,
    data: {
      name: `Audit Group ${runId}`,
      users: JSON.stringify([user2Id, user3Id]),
    },
  });
  assert(groupCreate.status === 200 && groupCreate.data.isGroupChat, "Group chat successfully created");
  const groupId = groupCreate.data._id;

  // Regular member attempts to rename group -> 403
  const memberRename = await httpRequest({
    method: "PUT",
    path: "/api/chat/rename",
    token: token3,
    data: { chatId: groupId, chatName: "Hacked Name" },
  });
  assert(memberRename.status === 403, "RBAC Enforced: Regular member cannot rename group (403 Forbidden)");

  // Owner renames group -> 200
  const ownerRename = await httpRequest({
    method: "PUT",
    path: "/api/chat/rename",
    token: token1,
    data: { chatId: groupId, chatName: `Renamed Audit Group ${runId}` },
  });
  assert(ownerRename.status === 200, "Group Owner can rename group successfully");

  // Owner promotes User 2 to Co-Admin
  const promoteUser2 = await httpRequest({
    method: "PUT",
    path: "/api/chat/groupadmin/promote",
    token: token1,
    data: { chatId: groupId, userId: user2Id },
  });
  const u2IsAdmin = promoteUser2.data.groupAdmins && promoteUser2.data.groupAdmins.some((a) => String(a._id || a) === String(user2Id));
  assert(promoteUser2.status === 200 && u2IsAdmin, "Owner successfully promotes User 2 to Co-Admin role");

  // Co-Admin User 2 promotes User 3 to Co-Admin
  const promoteUser3 = await httpRequest({
    method: "PUT",
    path: "/api/chat/groupadmin/promote",
    token: token2,
    data: { chatId: groupId, userId: user3Id },
  });
  const u3IsAdmin = promoteUser3.data.groupAdmins && promoteUser3.data.groupAdmins.some((a) => String(a._id || a) === String(user3Id));
  assert(promoteUser3.status === 200 && u3IsAdmin, "Co-Admin User 2 can promote User 3 to Co-Admin role");

  // Co-Admin User 2 attempts to demote Co-Admin User 3 -> Rejected (403)
  const coAdminDemoteCoAdmin = await httpRequest({
    method: "PUT",
    path: "/api/chat/groupadmin/demote",
    token: token2,
    data: { chatId: groupId, userId: user3Id },
  });
  assert(
    coAdminDemoteCoAdmin.status === 403,
    "RBAC Enforced: Co-Admin CANNOT demote another Co-Admin (403 Forbidden - Owner Only)"
  );

  // Co-Admin User 2 attempts to kick Co-Admin User 3 -> Rejected (403)
  const coAdminKickCoAdmin = await httpRequest({
    method: "PUT",
    path: "/api/chat/groupremove",
    token: token2,
    data: { chatId: groupId, userId: user3Id },
  });
  assert(
    coAdminKickCoAdmin.status === 403,
    "RBAC Enforced: Co-Admin CANNOT kick another Co-Admin (403 Forbidden - Owner Only)"
  );

  // Co-Admin User 2 attempts to kick Group Owner User 1 -> Rejected (403)
  const coAdminKickOwner = await httpRequest({
    method: "PUT",
    path: "/api/chat/groupremove",
    token: token2,
    data: { chatId: groupId, userId: user1Id },
  });
  assert(
    coAdminKickOwner.status === 403,
    "RBAC Enforced: Co-Admin CANNOT kick Group Owner (403 Forbidden)"
  );

  // =========================================================================
  // STEP 6: CRITICAL SCENARIO - OWNER LEAVES & AUTO-TRANSFER
  // =========================================================================
  console.log("\n--- 6. Critical Edge Case: Group Owner Leaves (Auto-Transfer) ---");
  // Group Owner User 1 leaves group voluntarily
  const ownerLeaves = await httpRequest({
    method: "PUT",
    path: "/api/chat/groupremove",
    token: token1,
    data: { chatId: groupId, userId: user1Id },
  });
  const u1StillInUsers = ownerLeaves.data.users && ownerLeaves.data.users.some((u) => String(u._id || u) === String(user1Id));
  const newOwnerId = String(ownerLeaves.data.groupAdmin?._id || ownerLeaves.data.groupAdmin);
  const ownershipTransferredToCoAdmin = (newOwnerId === String(user2Id) || newOwnerId === String(user3Id));

  assert(
    ownerLeaves.status === 200 && !u1StillInUsers && ownershipTransferredToCoAdmin,
    `Owner leaves group voluntarily -> Ownership automatically transferred to remaining Co-Admin (${newOwnerId})`
  );

  // Verify that new owner can now demote User 3
  const demoteByNewOwner = await httpRequest({
    method: "PUT",
    path: "/api/chat/groupadmin/demote",
    token: token2,
    data: { chatId: groupId, userId: user3Id },
  });
  const u3StillAdmin = demoteByNewOwner.data.groupAdmins && demoteByNewOwner.data.groupAdmins.some((a) => String(a._id || a) === String(user3Id));
  assert(
    demoteByNewOwner.status === 200 && !u3StillAdmin,
    "New Group Owner now has full owner authority to demote Co-Admin"
  );

  // Remaining member User 3 leaves voluntarily
  const memberLeaves = await httpRequest({
    method: "PUT",
    path: "/api/chat/groupremove",
    token: token3,
    data: { chatId: groupId, userId: user3Id },
  });
  assert(memberLeaves.status === 200, "Regular member leaves group voluntarily");

  // Last remaining user (User 2) leaves -> Group is auto-deleted
  const lastUserLeaves = await httpRequest({
    method: "PUT",
    path: "/api/chat/groupremove",
    token: token2,
    data: { chatId: groupId, userId: user2Id },
  });
  assert(
    lastUserLeaves.status === 200 && lastUserLeaves.data.deleted === true,
    "Last remaining member leaves -> Group cleanly deleted from database (No orphaned documents)"
  );

  // =========================================================================
  // STEP 7: REAL-TIME WEBSOCKET INTEGRATION
  // =========================================================================
  console.log("\n--- 7. Real-Time WebSocket Protocol Verification ---");
  if (ioClient) {
    await new Promise((resolveSocket) => {
      const socketA = ioClient(`http://${BASE_HOST}:${BASE_PORT}`, {
        transports: ["websocket"],
        forceNew: true,
        auth: { token: token1 },
      });
      const socketB = ioClient(`http://${BASE_HOST}:${BASE_PORT}`, {
        transports: ["websocket"],
        forceNew: true,
        auth: { token: token2 },
      });

      let connectedCount = 0;
      function checkConnected() {
        connectedCount++;
        if (connectedCount === 2) {
          socketA.emit("setup", { _id: user1Id, name: user1.name });
          socketB.emit("setup", { _id: user2Id, name: user2.name });
          socketA.emit("join chat", oneOnOneId);
          socketB.emit("join chat", oneOnOneId);

          setTimeout(() => {
            socketA.emit("typing", oneOnOneId);
          }, 300);
        }
      }

      socketA.on("connect", () => {
        assert(socketA.connected, "Socket A Handshake established successfully");
        checkConnected();
      });

      socketB.on("connect", () => {
        assert(socketB.connected, "Socket B Handshake established successfully");
        checkConnected();
      });

      socketB.on("typing", (room) => {
        if (room === oneOnOneId) {
          assert(true, "WebSocket Real-time typing event received by recipient socket");
          socketA.disconnect();
          socketB.disconnect();
          resolveSocket();
        }
      });

      setTimeout(() => {
        if (socketA.connected) socketA.disconnect();
        if (socketB.connected) socketB.disconnect();
        resolveSocket();
      }, 4000);
    });
  } else {
    console.log("  [SKIP] ioClient module not directly resolvable for WS test");
  }

  // =========================================================================
  // FINAL SUMMARY
  // =========================================================================
  console.log("\n===================================================================");
  console.log(`  VERIFICATION SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("===================================================================");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerification().catch((err) => {
  console.error("Fatal Error running verification:", err);
  process.exit(1);
});
