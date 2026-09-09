// Automated Integration Test Suite for IM System Protocol & Endpoints
const http = require("http");

const BASE_HOST = "localhost";
const BASE_PORT = 5000;

function httpRequest({ method, path, data, token }) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : "";
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
        path,
        method,
        headers,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const parsed = body ? JSON.parse(body) : {};
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, text: body });
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("  INSTANT MESSAGING (IM) SYSTEM AUTOMATED TEST SUITE  ");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  [PASS] ✓ ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ✗ ${testName}`);
      failed++;
    }
  }

  try {
    const suffix = Math.floor(Math.random() * 10000);
    const aliceUser = `alice_autotest_${suffix}`;
    const bobUser = `bob_autotest_${suffix}`;

    // 1. Test Quick Connect for User A
    const resA = await httpRequest({
      method: "POST",
      path: "/api/user/quick-connect",
      data: { username: aliceUser, name: "Alice Auto" },
    });
    assert(resA.status === 200 && resA.data.token, `TC-01: Quick Connect User A (${aliceUser})`);
    const tokenA = resA.data.token;
    const userAId = resA.data._id;

    // 2. Test Quick Connect for User B
    const resB = await httpRequest({
      method: "POST",
      path: "/api/user/quick-connect",
      data: { username: bobUser, name: "Bob Auto" },
    });
    assert(resB.status === 200 && resB.data.token, `TC-02: Quick Connect User B (${bobUser})`);
    const tokenB = resB.data.token;
    const userBId = resB.data._id;

    // 3. Test Invalid Quick Connect (Empty username)
    const resInvalid = await httpRequest({
      method: "POST",
      path: "/api/user/quick-connect",
      data: { username: "" },
    });
    assert(resInvalid.status === 400, "TC-03: Quick Connect Rejects Empty Username (400 Bad Request)");

    // 4. Test 1-on-1 Conversation Creation
    const resChat = await httpRequest({
      method: "POST",
      path: "/api/chat",
      token: tokenA,
      data: { userId: userBId },
    });
    assert(resChat.status === 200 && resChat.data._id, "TC-04: Create 1-on-1 Conversation between A & B");
    const chatId = resChat.data._id;

    // 5. Test Conversation Idempotency (Fetch Existing Chat)
    const resChatAgain = await httpRequest({
      method: "POST",
      path: "/api/chat",
      token: tokenA,
      data: { userId: userBId },
    });
    assert(resChatAgain.status === 200 && resChatAgain.data._id === chatId, "TC-05: Conversation Idempotency (Returns existing instance)");

    // 6. Test Message Transmission
    const testContent = `Hello from automated test ${suffix}`;
    const resMsg = await httpRequest({
      method: "POST",
      path: "/api/message",
      token: tokenA,
      data: { chatId, content: testContent },
    });
    assert(resMsg.status === 200 && resMsg.data.content === testContent, "TC-06: Message Transmission & Persistence via REST");
    const msgId = resMsg.data._id;

    // 7. Test Message History Retrieval
    const resHistory = await httpRequest({
      method: "GET",
      path: `/api/message/${chatId}`,
      token: tokenB,
    });
    const found = Array.isArray(resHistory.data) && resHistory.data.some((m) => m._id === msgId);
    assert(resHistory.status === 200 && found, "TC-07: Recipient Fetches Conversation Message History");

    // 8. Test Atomic Read Receipt Update
    const resRead = await httpRequest({
      method: "PUT",
      path: `/api/message/read/${chatId}`,
      token: tokenB,
      data: {},
    });
    assert(resRead.status === 200 && resRead.data.success === true, "TC-08: Atomic Read Receipt State Update");

    // 9. Test Clear Chat History
    const resClear = await httpRequest({
      method: "DELETE",
      path: `/api/message/clear/${chatId}`,
      token: tokenA,
    });
    assert(resClear.status === 200 && resClear.data.success === true, "TC-09: Clear Conversation History");

    // 10. Verify Chat History is Empty After Clear
    const resHistoryAfter = await httpRequest({
      method: "GET",
      path: `/api/message/${chatId}`,
      token: tokenA,
    });
    assert(resHistoryAfter.status === 200 && resHistoryAfter.data.length === 0, "TC-10: Verify Cleared State Invariant (0 messages)");

  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  }

  console.log("\n-------------------------------------------------------");
  console.log(`  TEST RESULTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
