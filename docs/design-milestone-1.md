# Instant Messaging System — Milestone 1: Design & Protocol Specification

**Course/Project:** Instant Messaging System (IM Project)  
**Deliverable:** Milestone 1 — Conversation Design & Client/Server Protocol  
**Document Target:** `docs/design-milestone-1.pdf`  
**System Architecture:** Hybrid Node.js / Express.js REST API + Real-Time Socket.IO Engine + React Client + MongoDB Store

---

## 1. Overview & System Scope

The goal of this project is to implement a robust, real-time Instant Messaging (IM) system that allows concurrent clients to communicate over a network connection. This document details the conversation design, client/server protocol formalized as a Backus-Naur Form (BNF) grammar, the mutable data structures, and the state machines for both the server and the client.

---

## 2. Conversation Design

### 2.1 Definition of Conversation
In this system, a **Conversation** is a persistent communication channel between two or more authenticated users. A conversation encapsulates:
- An ordered collection of messages exchanged among participants.
- A set of participants (users) with designated authorization privileges.
- Real-time ephemeral states (typing indicators, presence notifications).
- Dynamic message delivery tracking (Sent, Delivered, Read).

### 2.2 Conversation Models

#### A. Direct Message (One-to-One Conversation)
- **Participants:** Exactly two users ($|users| = 2$).
- **Privacy Guarantee:** Exclusively accessible to the two defined participants.
- **Identity Invariant:** Between any two users $U_A$ and $U_B$, there exists at most one direct conversation. Attempting to create an existing DM returns the existing channel instance.

#### B. Group Conversation
- **Participants:** Two or more users ($|users| \ge 2$).
- **Administrative Hierarchy:**
  - `groupAdmin`: The founding owner of the conversation.
  - `groupAdmins`: A set of users with administrative privileges (promoting/demoting admins, adding/removing members, renaming group, clearing history).
- **System Events:** Membership mutations (adding/removing users, role promotions) automatically inject persistent system notification messages into the conversation stream.

### 2.3 Mutable Datatypes & Invariants

The core datatypes within the application are mutable models representing application state. Below are their specifications, invariants, and mutability guarantees:

#### Model 1: `User`
```typescript
interface User {
  _id: ObjectId;                    // Immutable unique identifier
  username: string;                 // Unique, lowercase alphanumeric identifier
  name: string;                     // Mutable display name
  password?: string;                // Hashed credential (bcrypt)
  pic: string;                      // Mutable URL to avatar image
  status: "online" | "away" | "offline"; // Mutable presence state
  lastSeen: Date;                   // Mutable timestamp of last activity
}
```
* **Representation Invariant (RI):**
  - `_id` is non-null and persistent.
  - `username` is unique across all records, non-empty, and contains no whitespace characters.
  - `status` $\in$ `{"online", "away", "offline"}`.
  - `lastSeen` $\le$ `CurrentTime()`.

#### Model 2: `Chat`
```typescript
interface Chat {
  _id: ObjectId;                    // Immutable unique identifier
  chatName: string;                 // Mutable channel name
  isGroupChat: boolean;             // Immutable flag (DM vs Group)
  users: User[];                    // Mutable collection of participating users
  latestMessage?: Message;          // Mutable reference to the most recent message
  groupAdmin?: User;                // Mutable primary group owner
  groupAdmins: User[];              // Mutable set of group administrators
  createdAt: Date;                  // Immutable creation timestamp
  updatedAt: Date;                  // Mutable update timestamp
}
```
* **Representation Invariant (RI):**
  - If `isGroupChat == false`, then `users.length == 2` and `groupAdmins.length == 0`.
  - If `isGroupChat == true`, then `groupAdmin` $\in$ `users` and `groupAdmins` $\subseteq$ `users`.
  - For all $u_i, u_j \in users$, if $i \neq j$ then $u_i._id \neq u_j._id$ (no duplicate participants).

#### Model 3: `Message`
```typescript
interface Message {
  _id: ObjectId;                    // Immutable unique identifier
  sender: User;                     // Immutable reference to sending user
  content: string;                  // Immutable text content of message
  chat: Chat;                       // Immutable reference to containing conversation
  deliveredTo: ObjectId[];          // Mutable set of recipient User IDs who received payload
  readBy: ObjectId[];               // Mutable set of recipient User IDs who opened message
  isSystemMessage: boolean;         // Immutable indicator for system events
  systemMessageType?: string;       // Optional classification ("USER_ADDED", etc.)
  createdAt: Date;                  // Immutable creation timestamp
}
```
* **Representation Invariant (RI):**
  - `content` is non-empty for non-system messages.
  - `deliveredTo` $\subseteq$ `chat.users`.
  - `readBy` $\subseteq$ `deliveredTo` (a message cannot be read before being delivered).
  - `sender._id` $\in$ `readBy` initially upon sending.

---

## 3. Client/Server Protocol Grammar (BNF / EBNF)

The communication protocol operates as a hybrid:
1. **HTTP/1.1 REST Protocol:** Used for session establishment, resource querying, and channel mutations.
2. **WebSocket / Socket.IO Protocol:** Event-driven, full-duplex, asynchronous messaging for real-time messaging, presence synchronization, typing indications, and receipts.

### 3.1 Lexical Elements & Primitives (EBNF)

```bnf
AlphaNumeric       ::= [a-zA-Z0-9]
HexDigit           ::= [0-9a-f]
Digit              ::= [0-9]
Char               ::= any valid Unicode character except '"' and '\'
StringLiteral      ::= '"' { Char | '\"' | '\\' } '"'
BooleanLiteral     ::= "true" | "false"
IntegerLiteral     ::= [0-9]+
ObjectId           ::= '"' 24 * HexDigit '"'
ISODateString      ::= '"' Digit Digit Digit Digit '-' Digit Digit '-' Digit Digit 'T' 
                       Digit Digit ':' Digit Digit ':' Digit Digit '.' Digit Digit Digit 'Z' '"'
PresenceStatus     ::= '"online"' | '"away"' | '"offline"'
```

---

### 3.2 Real-Time Socket.IO Protocol Grammar (EBNF)

Every Socket.IO message consists of an **EventName** followed by a structured **Payload**:

$$\langle SocketMessage \rangle ::= \langle ClientToServerMessage \rangle \mid \langle ServerToClientMessage \rangle$$

#### A. Client-to-Server Messages ($\text{Client} \to \text{Server}$)

```bnf
ClientToServerMessage ::= SetupCommand
                        | GetOnlineUsersCommand
                        | UserAwayCommand
                        | UserActiveCommand
                        | JoinChatCommand
                        | TypingCommand
                        | StopTypingCommand
                        | NewMessageCommand
                        | MarkReadCommand
                        | MarkDeliveredCommand
                        | ClearChatCommand
                        | DeleteMessageCommand
                        | DeleteChatCommand

SetupCommand           ::= "setup" "," UserInitPayload
UserInitPayload        ::= "{" '"_id":' ObjectId ',"username":' StringLiteral { "," StringLiteral ":" Value } "}"

GetOnlineUsersCommand  ::= "get online users"
UserAwayCommand        ::= "user away"
UserActiveCommand      ::= "user active"

JoinChatCommand        ::= "join chat" "," ObjectId
TypingCommand          ::= "typing" "," ObjectId
StopTypingCommand      ::= "stop typing" "," ObjectId

NewMessageCommand      ::= "new message" "," MessagePayload
MarkReadCommand        ::= "mark messages read" "," "{" '"chatId":' ObjectId ',"userId":' ObjectId "}"
MarkDeliveredCommand   ::= "mark messages delivered" "," "{" '"messageIds":' "[" [ ObjectId { "," ObjectId } ] "]" ',"userId":' ObjectId "}"

ClearChatCommand       ::= "clear chat" "," ObjectId
DeleteMessageCommand   ::= "delete message" "," "{" '"messageId":' ObjectId ',"chatId":' ObjectId "}"
DeleteChatCommand      ::= "delete chat" "," ObjectId
```

#### B. Server-to-Client Messages ($\text{Server} \to \text{Client}$)

```bnf
ServerToClientMessage  ::= ConnectedResponse
                         | OnlineUsersListResponse
                         | UserStatusChangeBroadcast
                         | MessageReceivedBroadcast
                         | MessageDeliveredBroadcast
                         | MessagesReadBroadcast
                         | TypingBroadcast
                         | StopTypingBroadcast
                         | ChatClearedBroadcast
                         | MessageDeletedBroadcast
                         | ChatDeletedBroadcast

ConnectedResponse           ::= "connected" "," ActiveUsersMap
OnlineUsersListResponse     ::= "online users list" "," ActiveUsersMap
ActiveUsersMap              ::= "{" [ ObjectId ":" UserPresenceRecord { "," ObjectId ":" UserPresenceRecord } ] "}"
UserPresenceRecord          ::= "{" '"status":' PresenceStatus ',"lastSeen":' ISODateString "}"

UserStatusChangeBroadcast   ::= "user status change" "," "{" 
                                  '"userId":' ObjectId "," 
                                  '"status":' PresenceStatus "," 
                                  '"lastSeen":' ISODateString 
                                "}"

MessageReceivedBroadcast    ::= "message recieved" "," MessagePayload
MessageDeliveredBroadcast   ::= "message delivered update" "," "{" 
                                  '"messageId":' ObjectId "," 
                                  '"chatId":' ObjectId "," 
                                  '"deliveredTo":' "[" [ ObjectId { "," ObjectId } ] "]" 
                                "}"

MessagesReadBroadcast       ::= "messages read update" "," "{" 
                                  '"chatId":' ObjectId "," 
                                  '"readerId":' ObjectId 
                                "}"

TypingBroadcast             ::= "typing"
StopTypingBroadcast         ::= "stop typing"
ChatClearedBroadcast        ::= "chat cleared" "," ObjectId
MessageDeletedBroadcast     ::= "message deleted" "," "{" '"messageId":' ObjectId ',"chatId":' ObjectId "}"
ChatDeletedBroadcast        ::= "chat deleted" "," ObjectId
```

#### C. Shared Data Payload Definitions

```bnf
MessagePayload  ::= "{" 
                      '"_id":' ObjectId "," 
                      '"sender":' UserSummary "," 
                      '"content":' StringLiteral "," 
                      '"chat":' ChatSummary "," 
                      '"deliveredTo":' "[" [ ObjectId { "," ObjectId } ] "]" "," 
                      '"readBy":' "[" [ ObjectId { "," ObjectId } ] "]" "," 
                      '"isSystemMessage":' BooleanLiteral "," 
                      '"createdAt":' ISODateString 
                    "}"

UserSummary     ::= "{" '"_id":' ObjectId ',"name":' StringLiteral ',"username":' StringLiteral [ ',"pic":' StringLiteral ] "}"
ChatSummary     ::= "{" '"_id":' ObjectId ',"chatName":' StringLiteral ',"isGroupChat":' BooleanLiteral ',"users":' "[" [ UserSummary { "," UserSummary } ] "]" "}"
```

---

### 3.3 REST API Protocol Grammar

For operations requiring atomic persistence or queries, HTTP REST request-response pairs follow the grammar below:

```bnf
HttpRequest     ::= Method " " RequestUri " HTTP/1.1\r\n" { Header "\r\n" } "\r\n" [ RequestBody ]
Method          ::= "GET" | "POST" | "PUT" | "DELETE"
RequestUri      ::= "/api/user" [ "?" QueryString ]
                  | "/api/user/login"
                  | "/api/user/quick-connect"
                  | "/api/chat" [ "/" ObjectId ]
                  | "/api/chat/group"
                  | "/api/chat/groupadd"
                  | "/api/chat/groupremove"
                  | "/api/chat/rename"
                  | "/api/message" [ "/" ObjectId ]
                  | "/api/message/read/" ObjectId
                  | "/api/message/clear/" ObjectId

HttpResponse    ::= "HTTP/1.1 " StatusCode " " StatusText "\r\n" { Header "\r\n" } "\r\n" ResponseBody
StatusCode      ::= "200" | "201" | "400" | "401" | "403" | "404" | "409" | "500"
ResponseBody    ::= JSONString
```

---

## 4. State Machines (Client & Server State)

### 4.1 Client State Machine

A client instance maintains internal local state governed by the following Finite State Machine (FSM):

```text
    ┌───────────────────────────┐
    │       DISCONNECTED        │
    └─────────────┬─────────────┘
                  │ Connect(IP, Port, Credentials)
                  ▼
    ┌───────────────────────────┐
    │        CONNECTING         │
    └─────────────┬─────────────┘
                  │ Socket Handshake OK & Auth Token Verified
                  ▼
    ┌───────────────────────────┐        Tab Blur / Inactive (2m)       ┌───────────────────────────┐
    │     AUTHENTICATED_IDLE    │ ────────────────────────────────────> │           AWAY            │
    └─────────────┬─────────────┘ <──────────────────────────────────── └─────────────┬─────────────┘
                  │                      User Activity / Tab Focus                     │
                  │ Select Conversation (chatId)                                       │ Select Conversation
                  ▼                                                                    ▼
    ┌───────────────────────────┐                                       ┌───────────────────────────┐
    │      IN_CONVERSATION      │ ────────────────────────────────────> │     IN_CONVERSATION_AWAY  │
    └─────────────┬─────────────┘        Tab Blur / Inactive (2m)       └───────────────────────────┘
                  │ Leave Conversation / Socket Disconnect
                  ▼
    ┌───────────────────────────┐
    │       DISCONNECTED        │
    └───────────────────────────┘
```

#### Client In-Memory State Variables:
* `user`: Current user profile and JWT authentication token.
* `socket`: Active Socket.IO client instance connection.
* `myStatus`: Local user presence (`"online"` vs `"away"`).
* `chats`: Array of conversations (`Chat[]`) with computed `unreadCount`.
* `selectedChat`: Pointer to the currently focused `Chat` (or `null` if none).
* `messages`: Array of messages (`Message[]`) for the currently active conversation.
* `onlineUsers`: Map of `userId` $\to$ `{ status: "online" | "away", lastSeen: Date }`.
* `isTyping`: Boolean flag indicating if counterparty in `selectedChat` is actively typing.

---

### 4.2 Server State Machine

The server maintains a centralized, multi-client state broker in memory, persisted asynchronously into MongoDB:

```text
                     [Client TCP Connection Established]
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │          UNVERIFIED           │
                     └───────────────┬───────────────┘
                                     │ Event "setup" (Valid userId)
                                     ▼
                     ┌───────────────────────────────┐
                     │          USER_ACTIVE          │ ◄─────────────────────────┐
                     └───────────────┬───────────────┘                           │
                                     │                                           │
                         All Sockets for User Away                   Any Socket Active
                                     │                                           │
                                     ▼                                           │
                     ┌───────────────────────────────┐                           │
                     │           USER_AWAY           │ ──────────────────────────┘
                     └───────────────┬───────────────┘
                                     │
                     All Sockets Disconnected (size == 0)
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │         USER_OFFLINE          │
                     └───────────────────────────────┘
```

#### Server In-Memory State Registries:
1. `onlineUsers: Map<string, { sockets: Set<string>, status: string, lastSeen: Date }>`
   * Tracks all connected users across multiple tabs.
   * A user is `online` if at least one socket is active.
   * A user transitions to `away` only when **all** active sockets report idle.
   * A user transitions to `offline` when `sockets.size == 0`.
2. `socketToUser: Map<string, string>`
   * $O(1)$ reverse-lookup mapping from `socket.id` to `userId`.
3. `socketAwayMap: Map<string, boolean>`
   * Tracks per-tab idle status for each connected socket instance.
4. `io.sockets.adapter.rooms: Map<string, Set<string>>`
   * Socket.IO internal room registry mapping `chatId` to subscriber socket IDs.

---

## 5. Interaction Scenarios (Sequence Diagrams)

### 5.1 Scenario: Message Send, Online Delivery, and Read Flow

```text
Alice (Sender)                  Server (Express & Socket.IO)               Bob (Recipient)
     │                                       │                                    │
     │ 1. POST /api/message                  │                                    │
     │    { chatId, content: "Hello!" }      │                                    │
     │──────────────────────────────────────>│                                    │
     │                                       │ [Persist Message: deliveredTo: []] │
     │ 2. HTTP 201 Created (Message)         │                                    │
     │<──────────────────────────────────────│                                    │
     │ [Render "Hello!" with Single Gray ✓]  │                                    │
     │                                       │                                    │
     │ 3. socket.emit("new message", msg)    │                                    │
     │──────────────────────────────────────>│                                    │
     │                                       │ 4. Lookup: Is Bob in onlineUsers?  │
     │                                       │    --> YES (Bob is connected)      │
     │                                       │                                    │
     │                                       │ 5. socket.emit("message recieved") │
     │                                       │───────────────────────────────────>│
     │                                       │ [DB Update: deliveredTo.push(Bob)] │ [Render notification]
     │ 6. emit("message delivered update")   │                                    │
     │<──────────────────────────────────────│                                    │
     │ [Render "Hello!" with Double Gray ✓✓] │                                    │
     │                                       │                                    │
     │                                       │ 7. Bob clicks/focuses chat         │
     │                                       │    socket.emit("mark messages read"│
     │                                       │    { chatId, userId: Bob })        │
     │                                       │<───────────────────────────────────│
     │                                       │ [DB Update: readBy.push(Bob)]      │
     │ 8. emit("messages read update")       │                                    │
     │<──────────────────────────────────────│                                    │
     │ [Render "Hello!" with Double Blue ✓✓] │                                    │
```

---

## 6. Concurrency Strategy Summary (Milestone 1 Preview)

- **Node.js Single-Threaded Event Loop:** JavaScript execution occurs on a single thread; thus, memory data structures (`onlineUsers`, `socketToUser`) are safe from multi-threaded preemptive race conditions (no thread interleaving on in-memory maps).
- **MongoDB Atomic Operations:** For state persistence, all mutations use atomic MongoDB operators (`$addToSet`, `$pull`, `$in`, `findByIdAndUpdate`) rather than in-memory read-modify-write patterns, eliminating data overwriting races.
- **Idempotent Socket Handlers:** Events such as `mark messages read` and `mark messages delivered` are strictly idempotent. Multiple consecutive emissions do not alter state invariants.
