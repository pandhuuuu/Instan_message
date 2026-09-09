# Instant Messaging System — Testing Strategy & Test Report

**Deliverables:** Milestone 2 (Testing Strategy) & Milestone 3 (Execution Report)  
**System Under Test:** Instant Messaging Client & Server Application

---

## 1. Overview & Test Architecture

The testing strategy follows the **Testing Pyramid**:
1. **Automated Integration & API Tests:** Scripted HTTP and socket validations testing protocol compliance, collision handling, and data invariants independently of the user interface.
2. **Manual End-to-End GUI Tests:** Scenario-driven human tests validating responsiveness, multi-tab presence synchronization, live chat delivery, and visual state cues (checkmarks, badges, modal dialogs).

---

## 2. Automated Test Suite Specification

The automated test suite exercises the server API without requiring a graphical front-end. This permits isolated regression testing of critical protocol invariants.

### Test Categories:
* **TC-AUTO-01: Quick Connect (No-Authentication Mode):**
  - Sends POST `/api/user/quick-connect` with a new username.
  - *Expected:* Returns 200 OK with valid user object and JWT session token.
* **TC-AUTO-02: Active Username Collision Handling:**
  - Connects user $A$. Simulates second client connecting as user $A$ while $A$ is online.
  - *Expected:* Returns 409 Conflict with informative collision message.
* **TC-AUTO-03: Conversation Creation & Retrieval:**
  - Creates a 1-on-1 conversation between user $A$ and user $B$ via POST `/api/chat`.
  - *Expected:* Returns 200 OK with populated participants. Second creation request returns the identical chat instance ($|users| = 2$).
* **TC-AUTO-04: Message Transmission & Persistence:**
  - Sends message via POST `/api/message`.
  - *Expected:* Returns 201 Created. Querying GET `/api/message/:chatId` confirms message content, timestamp, and sender.
* **TC-AUTO-05: Atomic Read Receipt Updates:**
  - Issues PUT `/api/message/read/:chatId` by recipient.
  - *Expected:* Both `readBy` and `deliveredTo` arrays atomicaly contain recipient ID.

---

## 3. Manual Test Matrix & Execution Results (Milestone 3 Report)

The following manual test plan was executed on `localhost:3000` (Client) and `localhost:5000` (Server) using two distinct browser profiles (Profile A in Google Chrome Normal, Profile B in Google Chrome Incognito):

| Test ID | Test Scenario | Execution Steps | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-MAN-01** | **Server IP & Port Configuration** | 1. Open Homepage.<br>2. Click Server Config badge (`localhost:5000`).<br>3. Edit Port to `5000` and save. | Modal saves configuration to `localStorage`, updates target URL, and shows success toast. | Configuration saved, target URL updated to `http://localhost:5000`. | **PASS** |
| **TC-MAN-02** | **Quick IM Login (No Auth)** | 1. Select "Quick IM" tab.<br>2. Enter username `alice_test`.<br>3. Click "Join Chat Network". | Client immediately logs in without password, saves session, and redirects to `/chats`. | Successfully redirected to `/chats` as `alice_test`. | **PASS** |
| **TC-MAN-03** | **Active Users List Facility** | 1. Log in `alice_test` in Window 1.<br>2. Log in `bob_test` in Window 2.<br>3. In Window 1, click "Active Users" tab. | Window 1 displays `bob_test` in the Active Users list with green glowing presence dot and "Chat" button. | `bob_test` immediately rendered in Active Users list with green badge. | **PASS** |
| **TC-MAN-04** | **1-Click Direct Chat Creation** | In "Active Users" tab, click "Chat" button on `bob_test`. | Opens 1-on-1 conversation view with Bob, switches view to "Chats". | Chat window created and focused instantly. | **PASS** |
| **TC-MAN-05** | **Real-Time Message Delivery** | 1. Alice sends "Hello Bob!" to Bob.<br>2. Observe Bob's screen while online. | Bob receives message in real-time. Alice's checkmark transitions to double gray (`✓✓`). | Message arrived instantaneously; delivery confirmed. | **PASS** |
| **TC-MAN-06** | **Read Receipt Verification** | Bob opens Alice's chat window. | Alice's double checkmark turns cyan/blue (`✓✓`) indicating read status. | Checkmarks turned blue in real-time via Socket.IO. | **PASS** |
| **TC-MAN-07** | **Multiple Simultaneous Conversations** | Alice joins Group Chat while chatting with Bob. | Both conversations appear in sidebar. Incoming group messages show unread badge while Alice is viewing Bob's chat. | Green unread badge increments; conversation switching is seamless. | **PASS** |
| **TC-MAN-08** | **Typing Indicators** | Bob types in message box without sending. | Alice's header displays animated "typing..." indicator, disappearing when Bob stops typing. | Typing animation appeared and stopped reliably. | **PASS** |
| **TC-MAN-09** | **Idle / Away State Transition** | Switch browser tab to background or remain idle for 2 minutes. | Status indicator shifts from green ("Online") to amber ("Away"). Peers receive updated status. | Status transitions to "Away" and reverts to "Online" on user activity. | **PASS** |
| **TC-MAN-10** | **Group Chat Creation & Leave Group** | 1. Click "New Group" icon.<br>2. Create group "Project Team" with Bob.<br>3. Bob clicks group settings $\to$ "Leave Group". | Group created; Bob leaves group; Alice sees system message `"Bob left the group"`. | Group created and left successfully with system audit trail. | **PASS** |
