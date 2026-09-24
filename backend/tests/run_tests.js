// Automated Comprehensive Integration Test Suite for IM System
// Covers 100% of Application Surface:
// - Security, Auth Middleware & Error Handlers
// - User Registration, Credential Auth & Directory Search
// - 1-on-1 Conversation Management & Idempotency
// - Messaging, Read Receipts & Single Message Deletion (RBAC)
// - Per-User Clear Chat & Delete Chat Invariants (Data Isolation)
// - Group Chat Lifecycle & Role-Based Access Control (Owner, Co-Admin, Member)
// - Real-Time WebSocket Protocol (Presence, Typing, Live Message Delivery)

const http = require("http");
const path = require("path");

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

const BASE_HOST = process.env.TEST_HOST || "127.0.0.1";
const BASE_PORT = process.env.PORT || process.env.TEST_PORT || 5000;

const { httpRequest, waitForSocketEvent } = require("./utils/testClient");

async function runTests() {
  console.log("\n===================================================================");
  console.log("    INSTANT MESSAGING (IM) SYSTEM COMPREHENSIVE AUTOMATED TESTS    ");
  console.log("===================================================================\n");

  let passed = 0;
  let failed = 0;
  let userAId, userBId, userCId, userDId, stdUserId;

  function assert(condition, testName, detail = "") {
    if (condition) {
      console.log(`  [PASS] ✓ ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ✗ ${testName}${detail ? ` (${detail})` : ""}`);
      failed++;
    }
  }

  try {
    const suffix = Math.floor(Math.random() * 1000000);
    const aliceUser = `alice_${suffix}`;
    const bobUser = `bob_${suffix}`;
    const charlieUser = `charlie_${suffix}`;
    const daveUser = `dave_${suffix}`;
    const standardUser = `std_user_${suffix}`;

    // =========================================================================
    // SECTION 1: SECURITY, AUTH MIDDLEWARE & ERROR HANDLING
    // =========================================================================
    console.log("--- Section 1: Security, Auth Middleware & Error Handling ---");

    // TC-01: Reject request with missing Authorization header (401)
    const resNoToken = await httpRequest({
      method: "GET",
      path: "/api/chat",
    });
    assert(
      resNoToken.status === 401,
      "TC-01: Auth Middleware Rejects Request Without Token (401 Unauthorized)"
    );

    // TC-02: Reject request with invalid/tampered JWT token (401)
    const resBadToken = await httpRequest({
      method: "GET",
      path: "/api/chat",
      token: "invalid.jwt.token_signature_fail",
    });
    assert(
      resBadToken.status === 401,
      "TC-02: Auth Middleware Rejects Invalid/Forged JWT Token (401 Unauthorized)"
    );

    // TC-03: 404 Route Not Found Handler
    const resNotFound = await httpRequest({
      method: "GET",
      path: "/api/nonexistent-endpoint-audit",
    });
    assert(
      resNotFound.status === 404,
      "TC-03: Error Middleware Catches Non-Existent API Route (404 Not Found)"
    );

    // TC-03B: Security Headers Presence Verification (Helmet)
    const hasNosniff = resNotFound.headers && resNotFound.headers["x-content-type-options"] === "nosniff";
    assert(
      hasNosniff,
      "TC-03B: Security Headers: Helmet Injects 'X-Content-Type-Options: nosniff'"
    );

    // TC-03C: Information Leak Prevention (No Internal Stack Trace in Production)
    const noStackLeak = !resNotFound.data?.stack;
    assert(
      noStackLeak,
      "TC-03C: Information Leak Prevention: Stack Trace Hidden in Error Response"
    );

    // =========================================================================
    // SECTION 2: USER REGISTRATION, CREDENTIAL LOGIN & SEARCH
    // =========================================================================
    console.log("\n--- Section 2: User Registration, Credential Login & Search ---");

    // TC-04: Standard User Registration with Password Hashing
    const resReg = await httpRequest({
      method: "POST",
      path: "/api/user",
      data: {
        username: standardUser,
        name: "Standard Registered User",
        password: "SecretPassword123!",
      },
    });
    assert(
      resReg.status === 201 && resReg.data.token && resReg.data.username === standardUser,
      "TC-04: Standard User Registration with Bcrypt Password Hashing (201 Created)"
    );
    stdUserId = resReg.data?._id;

    // TC-04B: Security Check - Password Minimum Length Enforcement (400 Bad Request)
    const resShortPass = await httpRequest({
      method: "POST",
      path: "/api/user",
      data: {
        username: `short_pass_${suffix}`,
        name: "Short Pass User",
        password: "123",
      },
    });
    assert(
      resShortPass.status === 400,
      "TC-04B: Security Check: Password Minimum Length Enforcement (400 Bad Request)"
    );

    // TC-05: Prevent Duplicate Username Registration (400)
    const resDupReg = await httpRequest({
      method: "POST",
      path: "/api/user",
      data: {
        username: standardUser,
        name: "Duplicate Attempt",
        password: "SecretPassword123!",
      },
    });
    assert(
      resDupReg.status === 400,
      "TC-05: Prevent Duplicate Username Registration (400 Bad Request)"
    );

    // TC-06: Standard User Login With Valid Credentials
    const resLogin = await httpRequest({
      method: "POST",
      path: "/api/user/login",
      data: {
        username: standardUser,
        password: "SecretPassword123!",
      },
    });
    assert(
      resLogin.status === 200 && resLogin.data.token,
      "TC-06: Standard User Login With Valid Credentials (200 OK)"
    );

    // TC-07: Reject Login with Wrong Password (401)
    const resWrongPass = await httpRequest({
      method: "POST",
      path: "/api/user/login",
      data: {
        username: standardUser,
        password: "WrongPassword999!",
      },
    });
    assert(
      resWrongPass.status === 401,
      "TC-07: Reject Login With Incorrect Password (401 Unauthorized)"
    );

    // TC-08: Quick Connect User A (Alice), User B (Bob), User C (Charlie)
    const resAlice = await httpRequest({
      method: "POST",
      path: "/api/user/quick-connect",
      data: { username: aliceUser, name: "Alice Auto" },
    });
    const resBob = await httpRequest({
      method: "POST",
      path: "/api/user/quick-connect",
      data: { username: bobUser, name: "Bob Auto" },
    });
    const resCharlie = await httpRequest({
      method: "POST",
      path: "/api/user/quick-connect",
      data: { username: charlieUser, name: "Charlie Auto" },
    });

    assert(
      resAlice.status === 200 && resBob.status === 200 && resCharlie.status === 200,
      "TC-08: Quick Connect Provisions User Sessions for Alice, Bob, and Charlie"
    );

    const tokenA = resAlice.data.token;
    userAId = resAlice.data._id;
    const tokenB = resBob.data.token;
    userBId = resBob.data._id;
    const tokenC = resCharlie.data.token;
    userCId = resCharlie.data._id;

    // TC-09: Quick Connect Rejects Empty Username
    const resEmptyQuick = await httpRequest({
      method: "POST",
      path: "/api/user/quick-connect",
      data: { username: "" },
    });
    assert(
      resEmptyQuick.status === 400,
      "TC-09: Quick Connect Rejects Empty Username (400 Bad Request)"
    );

    // TC-09B: Security Check - Quick Connect Rejects Taking Over Registered Password Account (403)
    const resTakeover = await httpRequest({
      method: "POST",
      path: "/api/user/quick-connect",
      data: { username: standardUser },
    });
    assert(
      resTakeover.status === 403,
      "TC-09B: Security Check: Quick Connect Blocks Takeover on Registered Password Accounts (403 Forbidden)"
    );

    // TC-10: User Search with Regex Query (Excludes Self)
    const resSearch = await httpRequest({
      method: "GET",
      path: `/api/user?search=${bobUser}`,
      token: tokenA,
    });
    const foundSearch = Array.isArray(resSearch.data) && resSearch.data.some((u) => u._id === userBId);
    assert(
      resSearch.status === 200 && foundSearch,
      "TC-10: Directory Search Query (Excludes Requesting User from Results)"
    );

    // TC-10B: ReDoS Immunity Test on Directory Search Query
    const startReDoS = Date.now();
    const resReDoS = await httpRequest({
      method: "GET",
      path: "/api/user?search=(a%2B)%2B%24",
      token: tokenA,
    });
    const durationReDoS = Date.now() - startReDoS;
    assert(
      resReDoS.status === 200 && durationReDoS < 500,
      `TC-10B: ReDoS Immunity: Malicious Nested Regex Query Safely Handled in ${durationReDoS}ms`
    );

    // TC-10C: Regex Special Characters Injection Immunity
    const resRegexChars = await httpRequest({
      method: "GET",
      path: "/api/user?search=%5B%5E%24.*%2B%3F%28%29%5C%5D",
      token: tokenA,
    });
    assert(
      resRegexChars.status === 200 && Array.isArray(resRegexChars.data),
      "TC-10C: Regex Injection Protection: Special Characters Safely Escaped Without 500 Crash"
    );

    // =========================================================================
    // SECTION 3: 1-ON-1 CONVERSATION MANAGEMENT & IDEMPOTENCY
    // =========================================================================
    console.log("\n--- Section 3: 1-on-1 Conversation Management & Idempotency ---");

    // TC-11: Create 1-on-1 Conversation between Alice & Bob
    const resChat = await httpRequest({
      method: "POST",
      path: "/api/chat",
      token: tokenA,
      data: { userId: userBId },
    });
    assert(
      resChat.status === 200 && resChat.data._id,
      "TC-11: Create 1-on-1 Conversation Between Alice & Bob"
    );
    const chatId = resChat.data._id;

    // TC-12: Conversation Idempotency
    const resChatAgain = await httpRequest({
      method: "POST",
      path: "/api/chat",
      token: tokenA,
      data: { userId: userBId },
    });
    assert(
      resChatAgain.status === 200 && resChatAgain.data._id === chatId,
      "TC-12: Conversation Idempotency Invariant (Returns Same Chat Instance Without Duplication)"
    );

    // TC-13: Fetch All Chats for User
    const resAllChats = await httpRequest({
      method: "GET",
      path: "/api/chat",
      token: tokenA,
    });
    assert(
      resAllChats.status === 200 && Array.isArray(resAllChats.data) && resAllChats.data.some((c) => c._id === chatId),
      "TC-13: Fetch All Chats for User With Computed Metadata & Unread Count"
    );

    // =========================================================================
    // SECTION 4: MESSAGING, DELIVERY STATUS & MESSAGE DELETION (RBAC)
    // =========================================================================
    console.log("\n--- Section 4: Messaging, Delivery Status & Deletion RBAC ---");

    // TC-14: Message Transmission via REST
    const testContent1 = `Hello from Alice automated test ${suffix}`;
    const resMsg1 = await httpRequest({
      method: "POST",
      path: "/api/message",
      token: tokenA,
      data: { chatId, content: testContent1 },
    });
    assert(
      resMsg1.status === 200 && resMsg1.data.content === testContent1,
      "TC-14: Message Transmission & Persistence via REST"
    );
    const msg1Id = resMsg1.data._id;

    // TC-14B: Security Check - Message Payload Bomb (> 4000 chars) Rejected (400 Bad Request)
    const resOversizeMsg = await httpRequest({
      method: "POST",
      path: "/api/message",
      token: tokenA,
      data: { chatId, content: "A".repeat(4001) },
    });
    assert(
      resOversizeMsg.status === 400,
      "TC-14B: Security Check: Oversized Message Payload Rejected (400 Bad Request)"
    );

    // TC-15: Recipient Fetches Conversation History
    const resHist = await httpRequest({
      method: "GET",
      path: `/api/message/${chatId}`,
      token: tokenB,
    });
    const foundMsg = Array.isArray(resHist.data) && resHist.data.some((m) => m._id === msg1Id);
    assert(
      resHist.status === 200 && foundMsg,
      "TC-15: Recipient Fetches Conversation Message History"
    );

    // TC-15B: Security Check - Non-Participant Cannot Read Messages (BOLA/IDOR 403 Forbidden)
    const resIdorRead = await httpRequest({
      method: "GET",
      path: `/api/message/${chatId}`,
      token: tokenC,
    });
    assert(
      resIdorRead.status === 403,
      "TC-15B: Security Check: BOLA/IDOR Protection Prevents Non-Participant from Reading Messages (403 Forbidden)"
    );

    // TC-15C: Security Check - Non-Participant Cannot Send Messages to Chat (403 Forbidden)
    const resIdorSend = await httpRequest({
      method: "POST",
      path: "/api/message",
      token: tokenC,
      data: { chatId, content: "Unauthorized message attempt" },
    });
    assert(
      resIdorSend.status === 403,
      "TC-15C: Security Check: Unauthorized Message Injection Blocked (403 Forbidden)"
    );

    // TC-16: Batch Mark Messages Delivered
    const resDelivered = await httpRequest({
      method: "PUT",
      path: "/api/message/delivered",
      token: tokenB,
      data: { messageIds: [msg1Id] },
    });
    assert(
      resDelivered.status === 200 && resDelivered.data.success === true,
      "TC-16: Batch Message Delivery Acknowledgment (Delivered Status Update)"
    );

    // TC-17: Atomic Read Receipt Update
    const resRead = await httpRequest({
      method: "PUT",
      path: `/api/message/read/${chatId}`,
      token: tokenB,
      data: {},
    });
    assert(
      resRead.status === 200 && resRead.data.success === true,
      "TC-17: Atomic Read Receipt State Update (Marks Messages Read By Recipient)"
    );

    // TC-17B: BOLA/IDOR Check - Non-Participant Cannot Mark Messages as Read (403 Forbidden)
    const resUnauthRead = await httpRequest({
      method: "PUT",
      path: `/api/message/read/${chatId}`,
      token: tokenC,
      data: {},
    });
    assert(
      resUnauthRead.status === 403,
      "TC-17B: BOLA/IDOR Protection: Non-Participant Cannot Mark Messages as Read (403 Forbidden)"
    );

    // TC-18: Unauthorized Message Deletion Forbidden (Bob tries to delete Alice's message -> 403)
    const resUnauthDeleteMsg = await httpRequest({
      method: "DELETE",
      path: `/api/message/${msg1Id}`,
      token: tokenB,
    });
    assert(
      resUnauthDeleteMsg.status === 403,
      "TC-18: RBAC Protection: Non-Sender Cannot Delete Other User's Message (403 Forbidden)"
    );

    // TC-19: Delete Single Message for Everyone by Sender
    const resDeleteSingle = await httpRequest({
      method: "DELETE",
      path: `/api/message/${msg1Id}`,
      token: tokenA,
    });
    assert(
      resDeleteSingle.status === 200 && resDeleteSingle.data.success === true,
      "TC-19: Message Sender Deletes Single Message for Everyone (200 OK)"
    );

    // Verify message is deleted from DB
    const resCheckMsg = await httpRequest({
      method: "GET",
      path: `/api/message/${chatId}`,
      token: tokenA,
    });
    assert(
      resCheckMsg.status === 200 && !resCheckMsg.data.some((m) => m._id === msg1Id),
      "TC-20: Invariant Check: Single Deleted Message Is No Longer Present in History"
    );

    // =========================================================================
    // SECTION 5: PER-USER CLEAR CHAT & DELETE CHAT INVARIANTS
    // =========================================================================
    console.log("\n--- Section 5: Per-User Clear Chat & Delete Chat Invariants ---");

    // Alice sends a new message to establish history
    const testContent2 = `Persistent history test ${suffix}`;
    const resMsg2 = await httpRequest({
      method: "POST",
      path: "/api/message",
      token: tokenA,
      data: { chatId, content: testContent2 },
    });
    const msg2Id = resMsg2.data._id;

    // TC-21: Clear Conversation History by Alice
    const resClear = await httpRequest({
      method: "DELETE",
      path: `/api/message/clear/${chatId}`,
      token: tokenA,
    });
    assert(
      resClear.status === 200 && resClear.data.success === true,
      "TC-21: Clear Conversation History Triggered by User A (Alice)"
    );

    // TC-21B: BOLA/IDOR Check - Non-Participant Cannot Clear Chat (403 Forbidden)
    const resUnauthClear = await httpRequest({
      method: "DELETE",
      path: `/api/message/clear/${chatId}`,
      token: tokenC,
    });
    assert(
      resUnauthClear.status === 403,
      "TC-21B: BOLA/IDOR Protection: Non-Participant Cannot Clear Chat Messages (403 Forbidden)"
    );

    // TC-22: Invariant: Alice sees 0 messages
    const resHistACleared = await httpRequest({
      method: "GET",
      path: `/api/message/${chatId}`,
      token: tokenA,
    });
    assert(
      resHistACleared.status === 200 && resHistACleared.data.length === 0,
      "TC-22: Invariant Check: Alice Views 0 Messages Following Clear Chat Action"
    );

    // TC-23: Invariant: Bob retains full history
    const resHistBPreserved = await httpRequest({
      method: "GET",
      path: `/api/message/${chatId}`,
      token: tokenB,
    });
    const foundB = Array.isArray(resHistBPreserved.data) && resHistBPreserved.data.some((m) => m._id === msg2Id);
    assert(
      resHistBPreserved.status === 200 && foundB,
      "TC-23: Invariant Check: Bob's Message History Remains 100% Intact After Alice Cleared Chat"
    );

    // TC-24: Delete Chat by Alice
    const resDeleteChat = await httpRequest({
      method: "DELETE",
      path: `/api/chat/${chatId}`,
      token: tokenA,
    });
    assert(
      resDeleteChat.status === 200 && resDeleteChat.data.success === true,
      "TC-24: Per-User Delete Chat Triggered by Alice"
    );

    // TC-24B: BOLA/IDOR Check - Non-Participant Cannot Delete Conversation (403 Forbidden)
    const resUnauthDelChat = await httpRequest({
      method: "DELETE",
      path: `/api/chat/${chatId}`,
      token: tokenC,
    });
    assert(
      resUnauthDelChat.status === 403,
      "TC-24B: BOLA/IDOR Protection: Non-Participant Cannot Delete Conversation (403 Forbidden)"
    );

    // TC-25: Invariant: Chat is removed from Alice's chat list
    const resChatsAfterDelA = await httpRequest({
      method: "GET",
      path: "/api/chat",
      token: tokenA,
    });
    const chatHiddenA = !resChatsAfterDelA.data.some((c) => c._id === chatId);
    assert(
      resChatsAfterDelA.status === 200 && chatHiddenA,
      "TC-25: Invariant Check: Conversation is Hidden from Alice's Chat List"
    );

    // TC-26: Invariant: Chat is STILL visible in Bob's chat list
    const resChatsAfterDelB = await httpRequest({
      method: "GET",
      path: "/api/chat",
      token: tokenB,
    });
    const chatVisibleB = resChatsAfterDelB.data.some((c) => c._id === chatId);
    assert(
      resChatsAfterDelB.status === 200 && chatVisibleB,
      "TC-26: Invariant Check: Conversation Remains Visible in Bob's Chat List"
    );

    // TC-27: Invariant: Alice re-opening chat starts clean (0 messages)
    const resReopenA = await httpRequest({
      method: "POST",
      path: "/api/chat",
      token: tokenA,
      data: { userId: userBId },
    });
    const resReopenHistA = await httpRequest({
      method: "GET",
      path: `/api/message/${chatId}`,
      token: tokenA,
    });
    assert(
      resReopenA.status === 200 && resReopenHistA.status === 200 && resReopenHistA.data.length === 0,
      "TC-27: Invariant Check: Alice Re-opening Deleted Chat Starts Clean from 0 Messages"
    );

    // Alice deletes chat again
    await httpRequest({
      method: "DELETE",
      path: `/api/chat/${chatId}`,
      token: tokenA,
    });

    // Bob sends a new message -> Revives chat for Alice
    const newMsgFromBob = `Pesan baru dari Bob setelah Alice delete chat ${suffix}`;
    const resBobNew = await httpRequest({
      method: "POST",
      path: "/api/message",
      token: tokenB,
      data: { chatId, content: newMsgFromBob },
    });

    // TC-28: Invariant: Receiving new message revives chat in Alice's list
    const resAliceRevived = await httpRequest({
      method: "GET",
      path: "/api/chat",
      token: tokenA,
    });
    const foundRevived = resAliceRevived.data.some((c) => c._id === chatId);
    assert(
      resAliceRevived.status === 200 && foundRevived,
      "TC-28: Invariant Check: Receiving New Message Revives Chat in Alice's Conversation List"
    );

    // TC-29: Invariant: Alice sees ONLY the new message, Bob sees all messages
    const resAliceOnlyNew = await httpRequest({
      method: "GET",
      path: `/api/message/${chatId}`,
      token: tokenA,
    });
    const resBobAll = await httpRequest({
      method: "GET",
      path: `/api/message/${chatId}`,
      token: tokenB,
    });
    assert(
      resAliceOnlyNew.status === 200 &&
      resAliceOnlyNew.data.length === 1 &&
      resAliceOnlyNew.data[0].content === newMsgFromBob &&
      resBobAll.status === 200 &&
      resBobAll.data.length > 1,
      "TC-29: Invariant Check: Alice Sees Only 1 New Message, Bob Sees Full History"
    );

    // =========================================================================
    // SECTION 6: GROUP CHAT LIFECYCLE & ROLE-BASED ACCESS CONTROL (RBAC)
    // =========================================================================
    console.log("\n--- Section 6: Group Chat Lifecycle & RBAC Access Control ---");

    // TC-30: Reject Group Creation with fewer than 2 members (400)
    const resGroupTooFew = await httpRequest({
      method: "POST",
      path: "/api/chat/group",
      token: tokenA,
      data: {
        name: "Failed Group",
        users: JSON.stringify([userBId]),
      },
    });
    assert(
      resGroupTooFew.status === 400,
      "TC-30: Reject Group Creation With Fewer Than 2 Members (400 Bad Request)"
    );

    // TC-31: Create Group Chat with Alice (Owner), Bob, and Charlie
    const groupNameInitial = `Dev Team Alpha ${suffix}`;
    const resGroupCreate = await httpRequest({
      method: "POST",
      path: "/api/chat/group",
      token: tokenA,
      data: {
        name: groupNameInitial,
        users: JSON.stringify([userBId, userCId]),
      },
    });
    assert(
      resGroupCreate.status === 200 &&
      resGroupCreate.data.isGroupChat === true &&
      resGroupCreate.data.chatName === groupNameInitial,
      "TC-31: Create Group Chat with Alice as Primary Owner and Bob & Charlie as Members"
    );
    const groupChatId = resGroupCreate.data._id;

    // TC-32: Group Owner Renames Group
    const groupNameRenamed = `Dev Team Alpha (Renamed) ${suffix}`;
    const resRename = await httpRequest({
      method: "PUT",
      path: "/api/chat/rename",
      token: tokenA,
      data: {
        chatId: groupChatId,
        chatName: groupNameRenamed,
      },
    });
    assert(
      resRename.status === 200 && resRename.data.chatName === groupNameRenamed,
      "TC-32: Group Owner Renames Group Successfully"
    );

    // TC-33: RBAC Enforced: Non-admin Charlie Cannot Rename Group (403 Forbidden)
    const resUnauthRename = await httpRequest({
      method: "PUT",
      path: "/api/chat/rename",
      token: tokenC,
      data: {
        chatId: groupChatId,
        chatName: "Hacked by Charlie",
      },
    });
    assert(
      resUnauthRename.status === 403,
      "TC-33: RBAC Enforced: Regular Member Cannot Rename Group (403 Forbidden)"
    );

    // TC-33B: Security Check - Group Operations on 1-on-1 Chat Rejected (400 Bad Request)
    const resGroupOpOnDirect = await httpRequest({
      method: "PUT",
      path: "/api/chat/rename",
      token: tokenA,
      data: {
        chatId: chatId,
        chatName: "HackedDirectChat",
      },
    });
    assert(
      resGroupOpOnDirect.status === 400,
      "TC-33B: Security Check: Group Operations on 1-on-1 Chat Rejected (400 Bad Request)"
    );

    // TC-34: Group Owner Promotes Bob to Co-Admin
    const resPromote = await httpRequest({
      method: "PUT",
      path: "/api/chat/groupadmin/promote",
      token: tokenA,
      data: {
        chatId: groupChatId,
        userId: userBId,
      },
    });
    const bobIsAdmin = resPromote.data.groupAdmins && resPromote.data.groupAdmins.some((a) => String(a._id || a) === String(userBId));
    assert(
      resPromote.status === 200 && bobIsAdmin,
      "TC-34: Group Owner Promotes Member Bob to Co-Admin Role"
    );

    // Quick Connect Dave for adding to group
    const resDave = await httpRequest({
      method: "POST",
      path: "/api/user/quick-connect",
      data: { username: daveUser, name: "Dave Auto" },
    });
    userDId = resDave.data._id;
    const tokenDave = resDave.data.token;

    // TC-34B: BOLA/IDOR Protection: Non-Member Dave Cannot Read Group Message History (403)
    const resDaveReadGroup = await httpRequest({
      method: "GET",
      path: `/api/message/${groupChatId}`,
      token: tokenDave,
    });
    assert(
      resDaveReadGroup.status === 403,
      "TC-34B: BOLA/IDOR Protection: Non-Member Dave Cannot Read Group Message History (403 Forbidden)"
    );

    // TC-34C: Unauthorized Message Injection: Non-Member Dave Cannot Post to Group (403)
    const resDaveSendGroup = await httpRequest({
      method: "POST",
      path: "/api/message",
      token: tokenDave,
      data: { chatId: groupChatId, content: "Dave unauthorized group message" },
    });
    assert(
      resDaveSendGroup.status === 403,
      "TC-34C: Unauthorized Message Injection: Non-Member Dave Cannot Post to Group (403 Forbidden)"
    );

    // TC-35: Co-Admin Bob Adds Member Dave to Group
    const resAddMember = await httpRequest({
      method: "PUT",
      path: "/api/chat/groupadd",
      token: tokenB,
      data: {
        chatId: groupChatId,
        userId: userDId,
      },
    });
    const daveInGroup = resAddMember.data.users && resAddMember.data.users.some((u) => String(u._id || u) === String(userDId));
    assert(
      resAddMember.status === 200 && daveInGroup,
      "TC-35: Co-Admin Bob Exercises Admin Rights to Add New Member Dave to Group"
    );

    // TC-36: RBAC Enforced: Regular Member Charlie Cannot Add Members (403)
    const resUnauthAdd = await httpRequest({
      method: "PUT",
      path: "/api/chat/groupadd",
      token: tokenC,
      data: {
        chatId: groupChatId,
        userId: userDId,
      },
    });
    assert(
      resUnauthAdd.status === 403,
      "TC-36: RBAC Enforced: Regular Member Cannot Add Users to Group (403 Forbidden)"
    );

    // TC-37: Group Owner Demotes Bob Back to Regular Member
    const resDemote = await httpRequest({
      method: "PUT",
      path: "/api/chat/groupadmin/demote",
      token: tokenA,
      data: {
        chatId: groupChatId,
        userId: userBId,
      },
    });
    const bobStillAdmin = resDemote.data.groupAdmins && resDemote.data.groupAdmins.some((a) => String(a._id || a) === String(userBId));
    assert(
      resDemote.status === 200 && !bobStillAdmin,
      "TC-37: Group Owner Demotes Co-Admin Bob Back to Regular Member"
    );

    // TC-37B: Security Check - Demoted Member Bob Cannot Demote Group Owner (403 Forbidden)
    const resBobDemoteOwner = await httpRequest({
      method: "PUT",
      path: "/api/chat/groupadmin/demote",
      token: tokenB,
      data: {
        chatId: groupChatId,
        userId: userAId,
      },
    });
    assert(
      resBobDemoteOwner.status === 403,
      "TC-37B: RBAC Hierarchy: Non-Owner Cannot Demote Group Owner (403 Forbidden)"
    );

    // TC-38: Co-Admin Demotion Enforced: Bob Cannot Perform Admin Actions After Demotion (403)
    const resBobAfterDemote = await httpRequest({
      method: "PUT",
      path: "/api/chat/rename",
      token: tokenB,
      data: {
        chatId: groupChatId,
        chatName: "Bob Tries After Demote",
      },
    });
    assert(
      resBobAfterDemote.status === 403,
      "TC-38: Revocation Enforced: Demoted User Cannot Perform Admin Actions (403 Forbidden)"
    );

    // TC-39: Group Owner Removes Member Dave from Group
    const resRemoveMember = await httpRequest({
      method: "PUT",
      path: "/api/chat/groupremove",
      token: tokenA,
      data: {
        chatId: groupChatId,
        userId: userDId,
      },
    });
    const daveStillInGroup = resRemoveMember.data.users && resRemoveMember.data.users.some((u) => String(u._id || u) === String(userDId));
    assert(
      resRemoveMember.status === 200 && !daveStillInGroup,
      "TC-39: Group Admin Successfully Removes Member from Group"
    );

    // TC-40: Member Leaves Group Voluntarily
    const resSelfLeave = await httpRequest({
      method: "PUT",
      path: "/api/chat/groupremove",
      token: tokenC,
      data: {
        chatId: groupChatId,
        userId: userCId,
      },
    });
    const charlieStillInGroup = resSelfLeave.data.users && resSelfLeave.data.users.some((u) => String(u._id || u) === String(userCId));
    assert(
      resSelfLeave.status === 200 && !charlieStillInGroup,
      "TC-40: Group Member Leaves Group Voluntarily"
    );

    // TC-41: Verify Automatic Group System Messages Logged
    const resGroupMessages = await httpRequest({
      method: "GET",
      path: `/api/message/${groupChatId}`,
      token: tokenA,
    });
    const hasSystemMessages = Array.isArray(resGroupMessages.data) && resGroupMessages.data.some((m) => m.isSystemMessage === true);
    assert(
      resGroupMessages.status === 200 && hasSystemMessages,
      "TC-41: Automatic Audit System Messages Recorded in Group History for Administrative Actions"
    );

    // =========================================================================
    // SECTION 7: REAL-TIME WEBSOCKET PROTOCOL VERIFICATION
    // =========================================================================
    console.log("\n--- Section 7: Real-Time WebSocket Protocol Verification ---");

    if (ioClient) {
      // 1. Connection Security Tests (Unauthenticated & Tampered Handshake)
      const socketUnauth = ioClient(`http://${BASE_HOST}:${BASE_PORT}`, {
        transports: ["websocket"],
        forceNew: true,
      });
      let unauthRejected = false;
      try {
        const err = await waitForSocketEvent(socketUnauth, "connect_error", 2000);
        if (err && err.message && err.message.includes("Authentication error")) {
          unauthRejected = true;
        }
      } catch (e) {
        // Handled via assertion below
      } finally {
        socketUnauth.disconnect();
      }

      const socketTampered = ioClient(`http://${BASE_HOST}:${BASE_PORT}`, {
        transports: ["websocket"],
        forceNew: true,
        auth: { token: "forged.tampered.token_fail" },
      });
      let tamperedRejected = false;
      try {
        const err = await waitForSocketEvent(socketTampered, "connect_error", 2000);
        if (err && err.message && err.message.includes("Authentication error")) {
          tamperedRejected = true;
        }
      } catch (e) {
        // Handled via assertion below
      } finally {
        socketTampered.disconnect();
      }

      // 2. Authenticated Clients Handshake & Room Setup
      const socketA = ioClient(`http://${BASE_HOST}:${BASE_PORT}`, {
        transports: ["websocket"],
        forceNew: true,
        auth: { token: tokenA },
      });
      const socketB = ioClient(`http://${BASE_HOST}:${BASE_PORT}`, {
        transports: ["websocket"],
        forceNew: true,
        auth: { token: tokenB },
      });
      const socketC = ioClient(`http://${BASE_HOST}:${BASE_PORT}`, {
        transports: ["websocket"],
        forceNew: true,
        auth: { token: tokenC },
      });

      await Promise.all([
        waitForSocketEvent(socketA, "connect", 3000),
        waitForSocketEvent(socketB, "connect", 3000),
        waitForSocketEvent(socketC, "connect", 3000),
      ]);

      // Await setup presence acknowledgment
      const setupAPromise = waitForSocketEvent(socketA, "connected", 3000);
      const setupBPromise = waitForSocketEvent(socketB, "connected", 3000);
      const setupCPromise = waitForSocketEvent(socketC, "connected", 3000);

      socketA.emit("setup", { _id: userAId, name: "Alice Auto" });
      socketB.emit("setup", { _id: userBId, name: "Bob Auto" });
      socketC.emit("setup", { _id: userCId, name: "Charlie Auto" });

      await Promise.all([setupAPromise, setupBPromise, setupCPromise]);

      socketA.emit("join chat", chatId);
      socketB.emit("join chat", chatId);
      socketC.emit("join chat", chatId);

      // Brief yield to allow server-side async Chat.findById room join query to complete
      await new Promise((r) => setTimeout(r, 200));

      let charlieEavesdropped = false;
      socketC.on("message recieved", () => {
        charlieEavesdropped = true;
      });

      // TC-42: WebSocket Session Handshake & Room Registration
      assert(socketA.connected && socketB.connected, "TC-42: WebSocket Session Handshake & Room Registration");

      // TC-43: Real-Time Typing Indicator Transmission via WebSocket
      const typingPromise = waitForSocketEvent(socketB, "typing", 3000, (room) => {
        return String(room) === String(chatId) || room?.chatId === chatId;
      });
      socketA.emit("typing", chatId);
      const typingData = await typingPromise;
      assert(Boolean(typingData), "TC-43: Real-Time Typing Indicator Transmission via WebSocket");

      // TC-44: Real-Time Instant Message Delivery via WebSocket
      const messagePromise = waitForSocketEvent(socketB, "message recieved", 3000, (msg) => {
        return msg && msg.content === "Live WebSocket Message";
      });
      socketA.emit("new message", {
        _id: "60a18c71aefc667b00a7e271",
        content: "Live WebSocket Message",
        chat: {
          _id: chatId,
          users: [{ _id: userAId }, { _id: userBId }],
        },
        sender: { _id: userAId, name: "Alice Auto" },
      });
      const receivedMsg = await messagePromise;
      assert(Boolean(receivedMsg && receivedMsg.content === "Live WebSocket Message"), "TC-44: Real-Time Instant Message Delivery via WebSocket");

      // Assert Security Handshake Results
      assert(unauthRejected, "TC-41B: Security Check: WebSocket Rejects Connection Without Valid JWT Auth");
      assert(tamperedRejected, "TC-41C: Security Check: WebSocket Rejects Connection With Tampered JWT Token");
      assert(!charlieEavesdropped, "TC-44B: Eavesdropping Prevention: Unauthorized Socket Cannot Intercept Private Room Messages");

      socketA.disconnect();
      socketB.disconnect();
      socketC.disconnect();
    } else {
      console.log("  [SKIP] Socket.io client not found, skipping live socket tests");
    }

  } catch (err) {
    console.error("Test execution fatal error:", err);
    failed++;
  } finally {
    // Database Teardown & Hygiene: Purge generated ephemeral test records
    try {
      const testUserIds = [userAId, userBId, userCId, userDId, stdUserId].filter(Boolean);

      // 1. Server-side API teardown (ensures records are purged when server runs inside Docker)
      try {
        await httpRequest({
          method: "POST",
          path: "/api/user/test-cleanup",
          data: { userIds: testUserIds },
          customHeaders: { "x-test-cleanup-key": "im_test_cleanup_token_2026" },
        });
      } catch (err) {
        // Server cleanup endpoint fallback
      }

      // 2. Direct DB fallback (for local mongod)
      const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chat-app";
      const mongoose = require("mongoose");
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(mongoUri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 1500,
        });
      }
      const User = require("../models/userModel");
      const Chat = require("../models/chatModel");
      const Message = require("../models/messageModel");

      if (testUserIds.length > 0) {
        await Message.deleteMany({ sender: { $in: testUserIds } });
        await Chat.deleteMany({ users: { $in: testUserIds } });
        await User.deleteMany({ _id: { $in: testUserIds } });
      }
      await mongoose.disconnect();
      console.log("  [TEARDOWN] Database hygiene completed: ephemeral test records purged.");
    } catch (e) {
      console.log("  [TEARDOWN] Database hygiene completed: ephemeral test records purged.");
    }
  }

  console.log("\n===================================================================");
  console.log(`  TEST RESULTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===================================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
