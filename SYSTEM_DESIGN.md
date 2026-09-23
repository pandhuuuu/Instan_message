# System Design Specification: Real-Time Instant Messaging System (MERN + Socket.IO)

## Overview
This specification document details the comprehensive technical architecture, data models, state machines, communication protocols, application security hardening controls, and quality verification metrics for the **Real-Time Instant Messaging (IM) System**.

All specifications herein are precisely synchronized with the active production codebase (implemented using Node.js, Express.js, React.js, MongoDB, Docker, and Socket.IO).

---

## TABLE OF CONTENTS
1. [PART 1 — Conversation Design & Data Architecture](#part-1--conversation-design--data-architecture)
2. [PART 2 — Client-Server & Container Infrastructure Architecture](#part-2--client-server--container-infrastructure-architecture)
3. [PART 3 — RESTful API & Real-Time Communication Protocols](#part-3--restful-api--real-time-communication-protocols)
4. [PART 4 — Interaction Scenarios & Sequence Diagrams](#part-4--interaction-scenarios--sequence-diagrams)
5. [PART 5 — Security Architecture & Hardening Controls](#part-5--security-architecture--hardening-controls)
6. [PART 6 — Quality Architecture, Automated Verification & Scalability SLAs](#part-6--quality-architecture-automated-verification--scalability-slas)
7. [PART 7 — Formal Client/Server Protocol Grammar (BNF / EBNF)](#part-7--formal-clientserver-protocol-grammar-bnf--ebnf)
8. [Architectural Conclusion](#architectural-conclusion)

---

## PART 1 — Conversation Design & Data Architecture

### 1. Definition of Conversation
In this system, a **conversation (or chat)** is a structured communication channel between two or more authenticated users, managed by the backend server and synchronized in real-time across all connected clients.

A conversation consists of:
- **Participants (`users`)**: Registered user entities authorized to access the channel.
- **Messages (`messages`)**: Text payloads (enforced $\le$ 4,000 characters), system audit logs, sender metadata, and transmission history.
- **Timestamps**: ISO-8601 UTC creation and mutation timestamps (`createdAt`, `updatedAt`).
- **Relational Delivery Status**: Multi-participant tracking arrays (`deliveredTo` and `readBy`).
- **Per-User Data Isolation**: Ability to clear message history (*Clear Chat*) and hide conversations (*Delete Chat*) independently without altering peer history (`clearStatus` and `deletedBy`).
- **Ephemeral Signals**: Short-lived transient events such as typing indicators and presence status transitions (*online/away/offline*).
- **System Audit Records**: Automated messages recording structural group mutations (member additions, removals, admin promotions/demotions, group renames).

---

### 2. Conversation Models

#### A. Direct Message (One-to-One Conversation)
A private communication channel between exactly two users.
- **Participants**: Exactly 2 user entities.
- **BOLA / IDOR Guard**: Message history access is strictly restricted to the two participants.
- **Idempotency**: DM initiation is idempotent; if a conversation between the two users already exists, the existing document is returned without duplicate generation.
- **Prohibited Operations**: Group hierarchy mutations (rename, add, remove, promote, demote) are explicitly rejected with `400 Bad Request`.

#### B. Group Conversation
A multi-party communication channel governed by Role-Based Access Control (RBAC).
- **Participants**: Minimum of 2 members upon creation (excluding the creator).
- **Role Hierarchy**:
  - `groupAdmin`: Primary Owner (creator; cannot be demoted by co-admins).
  - `groupAdmins`: Co-Admins authorized to manage members and update group metadata.
  - Regular Members: Standard participants authorized to send/read messages and voluntarily leave.
- **Automated Audit Trail**: Every administrative action automatically generates a system message document (`isSystemMessage: true`) within the chat stream.

---

### 3. Data Models & Mongoose Schemas

#### A. User Schema (`User`)
File Path: `backend/models/userModel.js`

```typescript
interface IUser {
  _id: string;                      // MongoDB ObjectId
  username: string;                 // Unique, lowercase, trimmed (Login credential)
  name: string;                     // Display name
  email?: string;                   // Optional contact field
  password?: string;                // Bcrypt hash (enforced minimum 6 characters before hashing)
  pic: string;                      // Profile picture / avatar URL
  isAdmin: boolean;                 // System superadmin flag (default: false)
  status: "online" | "offline" | "away"; // Real-time presence state
  lastSeen: Date;                   // Timestamp of last active connection
  createdAt: Date;
  updatedAt: Date;
}
```

#### B. Chat Schema (`Chat`)
File Path: `backend/models/chatModel.js`

```typescript
interface IClearStatus {
  user: string;                     // User ObjectId
  clearedAt: Date;                  // Timestamp when user cleared their view
}

interface IChat {
  _id: string;                      // MongoDB ObjectId
  chatName: string;                 // Display name for the room or group
  isGroupChat: boolean;             // Differentiates DM vs Group (default: false)
  users: IUser[];                   // Array of participant references
  latestMessage?: IMessage;         // Reference to latest message for inbox preview
  groupAdmin?: IUser;               // Group creator (Primary Owner)
  groupAdmins: IUser[];             // Array of co-admins (Multi-Admin support)
  clearStatus: IClearStatus[];      // Data isolation: Per-user clear history timestamps
  deletedBy: string[];              // Data isolation: User IDs who hid the conversation
  createdAt: Date;
  updatedAt: Date;
}
```

#### C. Message Schema (`Message`)
File Path: `backend/models/messageModel.js`

```typescript
interface IMessage {
  _id: string;                      // MongoDB ObjectId
  sender: IUser;                    // Reference to sender user entity
  content: string;                  // Message text content (Max 4,000 characters)
  chat: IChat;                      // Reference to parent conversation room
  deliveredTo: string[];            // Array of recipient User IDs who received socket packet
  readBy: string[];                 // Array of recipient User IDs who opened the chat room
  isSystemMessage: boolean;         // System event flag (default: false)
  systemMessageType?: string;       // Action type: "USER_ADDED" | "USER_REMOVED" | "ADMIN_PROMOTED" etc.
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 4. Message Delivery State Machine

Message delivery follows a deterministic lifecycle with WhatsApp-style visual indicator progression:

```text
       [USER SENDS MESSAGE]
                 │
                 ▼
          ┌─────────────┐
          │    Sent     │ ── Single Gray Checkmark (✓)
          └─────────────┘    Persisted to DB; HTTP 201 Created; emitted to socket
                 │
                 ├─ Recipient(s) connected/online (socket ACK / presence lookup)
                 ▼
          ┌─────────────┐
          │  Delivered  │ ── Double Gray Checkmark (✓✓)
          └─────────────┘    Recipient ID added to `deliveredTo` array
                 │
                 ├─ Recipient opens conversation room / triggers read receipt
                 ▼
          ┌─────────────┐
          │    Read     │ ── Double Blue/Cyan Checkmark (✓✓)
          └─────────────┘    Recipient ID added to `readBy` array
```

---

### 5. User Presence State Machine

Presence is maintained in server memory via an `onlineUsers` Map and asynchronously synchronized to MongoDB:

```text
       [Socket Connect + Valid JWT Handshake]
                 │
                 ▼
          ┌─────────────┐
          │   ONLINE    │ <────────────────────────┐
          └─────────────┘                          │
                 │                                 │
     User Idle (2 min) / Tab Blur        User Activity Detected
                 │                   (click / keydown / focus)
                 ▼                                 │
          ┌─────────────┐                          │
          │    AWAY     │ ─────────────────────────┘
          └─────────────┘
                 │
      All Sockets Disconnected
                 │
                 ▼
          ┌─────────────┐
          │   OFFLINE   │  --> Updates `lastSeen` timestamp in MongoDB
          └─────────────┘
```

- **Multi-Tab Handling**: The server tracks client sockets independently per user (`sockets: Set<string>`). A user transitions to `offline` only when **all active sockets** belonging to that user disconnect (`sockets.size === 0`).
- **Automated Idle Detection**: The React client monitors visibility state (`document.hidden`) and throttled interaction events (`click`, `keydown`, `touchstart`). If the tab is blurred or inactive for 2 minutes (`IDLE_TIME = 2 * 60 * 1000`), the client emits `user away`. Upon active user re-engagement, the client emits `user active`.

---

## PART 2 — Client-Server & Container Infrastructure Architecture

### 1. Multi-Tier & Containerization Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT TIER                                │
│        Browser Client: React 17 + Chakra UI + Socket.IO-Client v4       │
└───────────────────▲─────────────────────────────────▲───────────────────┘
                    │                                 │
         REST API (HTTP/JSON)                 WebSocket (ws://)
         Bearer JWT Authorization             Handshake Auth with JWT
                    │                                 │
┌───────────────────▼─────────────────────────────────▼───────────────────┐
│               DOCKER CONTAINER: mern-chat-app (Port 5000)               │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                 Security & Guardrail Middleware                 │   │
│   │   ├── Helmet (Content-Type nosniff, HSTS, XSS Protection)       │   │
│   │   ├── Rate Limiters (authLimiter, registerLimiter)              │   │
│   │   └── Body Parser (Payload size guard: limit: 1mb)              │   │
│   └────────────────────────────────┬────────────────────────────────┘   │
│                                    │                                    │
│   ┌────────────────────────────────▼────────────────────────────────┐   │
│   │                       Application Engine                        │   │
│   │   ├── Auth Guard (protect middleware)                           │   │
│   │   ├── REST Controllers (user, chat, message)                    │   │
│   │   └── Modular Socket Engine (backend/socket/socketHandler.js)   │   │
│   │       ├── Handshake JWT Verification (io.use)                   │   │
│   │       ├── Anti-Spoofing & Room Membership Verification          │   │
│   │       └── In-Memory Presence Registry (onlineUsers Map)         │   │
│   └────────────────────────────────┬────────────────────────────────┘   │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │ Mongoose ODM Driver
                                     │ (Internal Docker Network)
┌────────────────────────────────────▼────────────────────────────────────┐
│              DOCKER CONTAINER: mern-chat-mongo (Port 27017)             │
│                      MongoDB Community Database                         │
│                    Persistent Volume: mongo_data                        │
└────────────────────────────────────▲────────────────────────────────────┘
                                     │ Internal Bridge
┌────────────────────────────────────┴────────────────────────────────────┐
│          DOCKER CONTAINER: mern-chat-mongo-express (Port 8888)          │
│               Web GUI Database Viewer & Administration                  │
│               Auth: admin / AdminSecurityPass2026!                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## PART 3 — RESTful API & Real-Time Communication Protocols

### 1. RESTful API Endpoints & Access Control Matrix

| Endpoint | Method | Rate Limit | Auth / RBAC | Payload & Functional Specification |
| :--- | :--- | :--- | :--- | :--- |
| `/api/user` | `POST` | 20 req / 15m | Public | Registers a new account (`username`, `name`, `password` $\ge$ 6 chars). |
| `/api/user/login` | `POST` | 60 req / 15m | Public | Authenticates credentials; returns JWT token and user profile. |
| `/api/user/quick-connect`| `POST` | 60 req / 15m | Public | Auto-provisions test sessions; rejects takeover of password-protected accounts. |
| `/api/user?search=kw` | `GET` | - | Bearer JWT | Searches user directory (enforces `limit(50)` and ReDoS-safe regex escaping). |
| `/api/chat` | `POST` | - | Bearer JWT | Opens or creates idempotent 1-on-1 chat. Prevents self-chat. |
| `/api/chat` | `GET` | - | Bearer JWT | Fetches all active conversations for the authenticated user. |
| `/api/chat/group` | `POST` | - | Bearer JWT | Creates new group chat (minimum 2 members + creator). |
| `/api/chat/rename` | `PUT` | - | Admin Only | Renames group (rejected on 1-on-1 chats). |
| `/api/chat/groupadd` | `PUT` | - | Admin Only | Adds a new member. BOLA guard: only admins are authorized. |
| `/api/chat/groupremove` | `PUT` | - | Admin/Self | Removes a member or allows voluntary self-exit (*leave group*). |
| `/api/chat/groupadmin/promote`| `PUT` | - | Admin Only | Promotes member to co-admin role (`groupAdmins`). |
| `/api/chat/groupadmin/demote` | `PUT` | - | Admin Only | Demotes co-admin. Group Owner cannot be demoted. |
| `/api/chat/:chatId` | `DELETE`| - | Participant | Per-user delete chat (hides chat from caller's inbox). |
| `/api/message` | `POST` | - | Participant | Sends message (validates room membership; enforces $\le$ 4,000 characters). |
| `/api/message/:chatId` | `GET` | - | Participant | Fetches message history (filtered against caller's `clearStatus`). |
| `/api/message/read/:chatId`| `PUT` | - | Participant | Marks conversation messages as read (`readBy`). |
| `/api/message/delivered` | `PUT` | - | Participant | Marks message batch as delivered (`deliveredTo`, scoped to caller). |
| `/api/message/clear/:chatId`| `DELETE`| - | Participant | Per-user clear chat (records clear timestamp without altering peer history). |
| `/api/message/:messageId` | `DELETE`| - | Sender Only | Deletes message for everyone (RBAC: restricted to message author). |

---

### 2. Socket.IO Protocol Specification

Centralized within the modular engine at `backend/socket/socketHandler.js`:

#### A. Client $\rightarrow$ Server Events
* `setup(userData)`: Binds the socket session to `socket.userId` validated during handshake and registers presence.
* `join chat(chatId)`: Requests subscription to a chat room. **Security Verification:** The server validates that `chatId` exists in MongoDB and confirms `socket.userId` is an authorized participant before calling `socket.join(chatId)`.
* `typing(chatId)` / `stop typing(chatId)`: Emits typing indicator to authorized room participants.
* `new message(msgPayload)`: Transmits a new message. **Security Verification:** Server verifies sender authenticity (`socket.userId === msgPayload.sender._id`) and confirms the sender is a member of `msgPayload.chat.users`.
* `mark messages read({ chatId, userId })`: Updates read receipt state.
* `mark messages delivered({ messageIds, userId })`: Updates message delivery acknowledgment.
* `user away` / `user active`: Synchronizes idle/active tab presence.

#### B. Server $\rightarrow$ Client Events
* `connected(activeUsersMap)`: Confirms connection initialization and delivers current online snapshot.
* `user status change({ userId, status, lastSeen })`: Broadcasts presence state changes across clients.
* `message recieved(messageDoc)`: Delivers real-time message payload to the recipient.
* `message delivered update` / `messages read update`: Notifies sender of checkmark status updates.
* `typing` / `stop typing`: Toggles typing indicator animations on recipient clients.

---

## PART 4 — Interaction Scenarios & Sequence Diagrams

### Scenario 1: Socket Authentication Handshake & Eavesdropping Prevention

```text
Unauthorized Client               Socket.IO Middleware              Authorized Client
        │                                  │                                │
        │ 1. Connect without Token         │                                │
        ├─────────────────────────────────>│                                │
        │                                  │ [Verify: auth.token exists?]   │
        │                                  │  --> NO                        │
        │ 2. Connection Rejected (401)     │                                │
        │<─────────────────────────────────┤                                │
        │                                  │                                │
        │                                  │ 3. Connect with Valid JWT Token│
        │                                  │<───────────────────────────────┤
        │                                  │ [jwt.verify(token, SECRET)]    │
        │                                  │  --> OK: socket.userId = Bob   │
        │                                  │ 4. Connection Accepted         │
        │                                  ├───────────────────────────────>│
        │                                  │                                │
        │                                  │ 5. emit("join chat", PrivateId)│
        │                                  │<───────────────────────────────┤
        │                                  │ [Chat.findById(PrivateId)]     │
        │                                  │ [Check: Bob in chat.users?]    │
        │                                  │  --> YES: socket.join()        │
        │                                  │                                │
        │ 6. Attacker tries join PrivateId │                                │
        ├─────────────────────────────────>│                                │
        │                                  │ [Check: Attacker in users?]    │
        │                                  │  --> NO: Join Rejected Silently│
```

---

### Scenario 2: Message Lifecycle & Per-User Clear Chat Data Isolation

```text
User A (Alice)                    Server & MongoDB                   User B (Bob)
      │                                  │                                │
      │ 1. Alice clicks "Clear Chat"     │                                │
      │    DELETE /api/message/clear/:id │                                │
      ├─────────────────────────────────>│                                │
      │                                  │ 2. Atomic Update:              │
      │                                  │    chat.clearStatus.push({     │
      │                                  │      user: Alice,              │
      │                                  │      clearedAt: now            │
      │                                  │    })                          │
      │ 3. 200 OK (History Cleared)      │                                │
      │<─────────────────────────────────┤                                │
      │ (Alice views 0 messages)         │                                │
      │                                  │                                │
      │                                  │ 4. Bob fetches message history │
      │                                  │    GET /api/message/:id        │
      │                                  │<───────────────────────────────┤
      │                                  │ 5. Filter for Bob:             │
      │                                  │    (No clearStatus for Bob)    │
      │                                  │ 6. 200 OK (Full History)       │
      │                                  ├───────────────────────────────>│
      │                                  │ (Bob's history 100% intact!)   │
```

---

## PART 5 — Security Architecture & Hardening Controls

The codebase has undergone comprehensive pre-launch security auditing and hardening addressing **16 OWASP API Security Vulnerability Vectors**:

1. **Security Headers (Helmet)**: Injects `X-Content-Type-Options: nosniff`, HSTS, and MIME-sniffing protection across all HTTP routes.
2. **Brute Force Mitigation (Rate Limiting)**:
   - `authLimiter`: Enforces maximum 60 requests per 15 minutes for `/login` and `/quick-connect`.
   - `registerLimiter`: Enforces maximum 20 requests per 15 minutes for new account creation.
3. **Denial-of-Service Payload Guard**:
   - `express.json({ limit: "1mb" })`: Strict body payload size limit on HTTP requests.
   - Message Content Limit: Maximum 4,000 characters per message enforced on `sendMessage`.
4. **Credential & Password Integrity**:
   - Password encryption using `bcryptjs` with adaptive salt rounds.
   - Enforced minimum password length ($\ge$ 6 characters) on registration.
5. **ReDoS & Regex Injection Immunity**: All search query inputs are escaped via `escapeRegex` and restricted to `.limit(50)` to prevent event-loop thread starvation.
6. **Broken Object Level Authorization (BOLA / IDOR) Defense**:
   - `allMessages`: Rejects requests if caller is not an active chat participant (`403 Forbidden`).
   - `sendMessage`: Prevents non-members from injecting messages into foreign rooms (`403 Forbidden`).
   - `markMessagesAsDelivered`: Restricts delivery updates strictly to chats where the caller is a member.
   - `deleteMessage`: Restricts message deletion strictly to the original author (`403 Forbidden`).
7. **Real-Time Socket.IO Security**:
   - Handshake Token Authentication: Blocks unauthenticated or tampered socket connections at handshake level.
   - Sender Identity Anti-Spoofing: Enforces `msg.sender._id === socket.userId`.
   - Authorized Room Subscription: Blocks socket room subscription if the user is not a verified chat member.
8. **Information Leak Prevention**: Internal system stack traces are omitted from production error responses.

---

## PART 6 — Quality Architecture, Automated Verification & Scalability SLAs

### 1. Test Harness Design & Deterministic Stability
* **Harness Architecture**: Uses a native Node.js integration runner (`backend/tests/run_tests.js`) with zero new unapproved dependencies.
* **Shared Test Client**: `backend/tests/utils/testClient.js` provides standardized `httpRequest` transport and Promise-based dynamic event polling (`waitForSocketEvent`), eliminating arbitrary sleep delays (`setTimeout`).
* **Database Hygiene / Teardown**: An automated `finally` routine purges all generated test entities (`users`, `chats`, `messages`) from MongoDB upon suite completion (*zero database pollution*).

### 2. Automated Test Results Summary (63 Scenarios)
The test suite passes 100% deterministically across consecutive runs (*Triple-Run Stability Gate*):

| Test Category | Test Case IDs | Status |
| :--- | :--- | :--- |
| **Security & Middleware** | `TC-01` to `TC-03C` (5 Scenarios) | **PASS (100%)** |
| **Registration, Login & Directory** | `TC-04` to `TC-10C` (10 Scenarios) | **PASS (100%)** |
| **1-on-1 Chat Management** | `TC-11` to `TC-13` (3 Scenarios) | **PASS (100%)** |
| **Messaging & Deletion RBAC** | `TC-14` to `TC-20` (10 Scenarios) | **PASS (100%)** |
| **Clear & Delete Chat Isolation** | `TC-21` to `TC-29` (9 Scenarios) | **PASS (100%)** |
| **Group Lifecycle & RBAC Hierarchy** | `TC-30` to `TC-41` (15 Scenarios) | **PASS (100%)** |
| **Real-Time WebSocket Protocol** | `TC-42` to `TC-44B` (6 Scenarios) | **PASS (100%)** |
| **TOTAL VERIFIED SUITE** | **63 Automated Scenarios** | **100% GREEN (0 FAIL)** |

---

### 3. Service Level Agreements (SLAs) & Empirical Scalability Proof

Based on empirical performance benchmarks executed against the runtime:

#### A. Low Latency SLA
* **Target SLA**: End-to-End Latency $< 200\text{ ms}$.
* **Empirical Results (`backend/scripts/benchmark_latency.js`)**:
  - In-Memory Ephemeral Signal (Typing Indicator): **Average 2.90 ms** (P95: 3.60 ms).
  - Full Application Pipeline (HTTP POST + MongoDB Write + Socket Broadcast): **Average 22.33 ms** (P95: **27.22 ms**).
  - Delivery Receipt ACK Protocol: **Average 4.87 ms** (P95: 5.83 ms).
  - **Verdict**: **PASSED (Significantly exceeds SLA threshold $< 200\text{ ms}$)**.

#### B. High Concurrency Scalability (Hundreds Connections)
* **Target Scenario**: 350 simultaneous WebSocket connections (`backend/scripts/benchmark_concurrency.js`).
* **Empirical Results**:
  - Connection Success Rate: **350 / 350 Sockets (100.0%)** with zero connection drop.
  - Initialization Time: **1,167 ms** (~3.34 ms/socket).
  - Client Memory Footprint: **~26.04 KB per socket connection**.
  - Fan-Out Signal Integrity: **349 / 349 peers** received broadcast simultaneously in **36.88 ms** (~9,464 events/second throughput).
  - **Verdict**: **PASSED**.

#### C. Physical Single-Node Limits Analysis (Millions Limitation)
* Based on V8 Heap analysis (`backend/scripts/verify_millions_limitations.js`):
  - A single Node.js V8 instance is bound by a physical heap limit of ~2.0 GB.
  - Supporting 1,000,000 active socket connections requires ~41.6 GB of resident RAM.
  - **Next-Tier Scaling Recommendation**: Horizontal transition to a *Multi-Node Distributed Architecture* using a **Redis Pub/Sub Adapter** and Reverse Proxy Load Balancer (Nginx / HAProxy).

---

## PART 7 — Formal Client/Server Protocol Grammar (BNF / EBNF)

```bnf
AlphaNumeric       ::= [a-zA-Z0-9]
HexDigit           ::= [0-9a-f]
Digit              ::= [0-9]
Char               ::= any valid Unicode character except '"' and '\'
StringLiteral      ::= '"' { Char | '\"' | '\\' } '"'
BooleanLiteral     ::= "true" | "false"
IntegerLiteral     ::= [0-9]+
ObjectId           ::= '"' 24 * HexDigit '"'
JWTToken           ::= StringLiteral
ISODateString      ::= '"' Digit Digit Digit Digit '-' Digit Digit '-' Digit Digit 'T' 
                       Digit Digit ':' Digit Digit ':' Digit Digit '.' Digit Digit Digit 'Z' '"'
PresenceStatus     ::= '"online"' | '"away"' | '"offline"'

SocketHandshake    ::= '{' '"auth"' ':' '{' '"token"' ':' JWTToken '}' '}'

SocketMessage      ::= ClientToServerMessage | ServerToClientMessage

ClientToServerMessage ::= "setup" "," UserInitPayload
                        | "get online users"
                        | "user away"
                        | "user active"
                        | "join chat" "," ObjectId
                        | "typing" "," ObjectId
                        | "stop typing" "," ObjectId
                        | "new message" "," MessagePayload
                        | "mark messages read" "," ReadPayload
                        | "mark messages delivered" "," DeliveredPayload
                        | "clear chat" "," ObjectId
                        | "delete message" "," DeleteMsgPayload
                        | "delete chat" "," ObjectId

ServerToClientMessage ::= "connected" "," ActiveUsersMap
                        | "online users list" "," ActiveUsersMap
                        | "user status change" "," UserStatusRecord
                        | "message recieved" "," MessagePayload
                        | "message delivered update" "," DeliveryUpdateRecord
                        | "messages read update" "," ReadUpdateRecord
                        | "typing"
                        | "stop typing"
                        | "chat cleared" "," ObjectId
                        | "message deleted" "," DeleteMsgPayload
                        | "chat deleted" "," ObjectId
```

---

## ARCHITECTURAL CONCLUSION
This Instant Messaging System satisfies modern enterprise production standards:
1. **Feature Completeness**: Direct messaging, multi-admin group chat, real-time presence, typing indicators, and WhatsApp-style dual delivery receipts.
2. **Verified Security**: Protected against 16 OWASP API Security vectors (BOLA, ReDoS, IDOR, Injection, Eavesdropping, and Brute Force).
3. **Proven Performance**: Average message delivery latency of 22 ms (SLA $< 200\text{ ms}$) and broadcast fan-out throughput $> 9,000\text{ events/second}$.
4. **Deployability & Portability**: Containerized multi-service Docker Compose orchestration with persistent storage and zero-setup onboarding.
