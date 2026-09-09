# Instant Messaging System — Milestone 2: Concurrency Strategy

**Deliverable:** Milestone 2 — Concurrency Strategy, Thread-Safety, & Deadlock-Freedom  
**Author/Team:** IM Project Development Team  
**Architecture:** Node.js / Express Single-Threaded Non-Blocking Event Loop + Socket.IO + MongoDB Atomic Commit Layer

---

## 1. Executive Summary & Concurrency Model

In modern concurrent systems, multithreaded architectures (e.g., standard Java or C++ POSIX threads) risk **race conditions** (simultaneous unsynchronized reads/writes to shared memory) and **deadlocks** (circular waiting for acquired locks/mutexes).

Our Instant Messaging (IM) system employs an **Event-Driven, Asynchronous Non-Blocking I/O Architecture** powered by the Node.js runtime (libuv event loop) paired with MongoDB atomic operations. This design eliminates traditional multi-threaded lock-based deadlocks and guarantees memory-level thread safety by construction.

---

## 2. Argument for Freedom from Deadlocks

### 2.1 Theoretical Guarantee: Zero Preemptive Locks in User-Space
In multi-threaded systems (e.g., Java with `synchronized` blocks or `ReentrantLock`), deadlock occurs when the **Coffman conditions** are satisfied:
1. Mutual Exclusion
2. Hold and Wait
3. No Preemption
4. Circular Wait

**In our design:**
* The JavaScript execution runtime is **single-threaded**. Only one event handler or task executes on the CPU call stack at any given millisecond.
* There are **zero user-space locks or mutexes** in our application logic. 
* Because threads do not acquire locks and wait for other threads to release nested locks, **circular wait cannot form**.
* **Conclusion:** Deadlocks are physically impossible within the application's runtime memory space.

---

## 3. Argument for Freedom from Race Conditions

While single-threaded execution eliminates CPU-level memory corruption races, asynchronous systems are vulnerable to **asynchronous race conditions**—situations where concurrent asynchronous tasks interleave out-of-order over network or I/O boundaries. 

Below is our formal strategy and proof that all critical state mutations remain deterministic and free of race conditions:

### 3.1 In-Memory Presence Registry (`onlineUsers` Map)
* **Risk:** Concurrent socket connections or disconnections from multiple tabs of the same user could cause inconsistent counts or premature offline transitions.
* **Safety Mechanism:**
  ```javascript
  // Server-side synchronous mutation block:
  const userPresence = onlineUsers.get(userId);
  userPresence.sockets.delete(socket.id);
  if (userPresence.sockets.size === 0) {
    onlineUsers.delete(userId);
    // Transition to offline ONLY when set of active sockets is completely empty
  }
  ```
* **Invariant:** Because the Map modification and set size check occur synchronously within a single event loop tick without yielding (`await`), no interleaving socket event can execute midway through the check. Multi-tab presence transitions are strictly serial and atomic.

### 3.2 Database State Mutations: MongoDB Atomic Operators
* **Risk:** Two clients simultaneously sending messages or marking messages as read/delivered could overwrite each other's updates if read-modify-write patterns were used.
* **Safety Mechanism:**
  Our codebase strictly prohibits client-side read-modify-write cycles. All state mutations use **native atomic operators**:
  ```javascript
  // Atomic Read Receipt Update:
  await Message.updateMany(
    { chat: chatId, sender: { $ne: userId }, readBy: { $ne: userId } },
    {
      $addToSet: {
        readBy: userId,
        deliveredTo: userId,
      },
    }
  );
  ```
  * `$addToSet` guarantees set uniqueness at the database engine level (document lock granularity). Even if 1,000 read receipts arrive in the exact same millisecond, MongoDB serializes the set insertion atomically without lost updates.
  * `$in` and `$pull` operators ensure deterministic additions and removals from group member lists.

### 3.3 Active Session Collision Handling (Quick Connect)
* **Risk:** Two clients concurrently attempting to log in as the exact same username.
* **Safety Mechanism:**
  1. The server synchronously checks the in-memory `onlineUsers` registry. If an active socket session exists for that username, the request is immediately rejected with `409 Conflict`.
  2. MongoDB enforces a **Unique Index** on the `username` field (`userModel.js: unique: true`). If two users register with the same username simultaneously, the database driver raises an E11000 duplicate key error, which the error middleware catches and reports as a conflict.

### 3.4 Idempotent Socket Message Protocols
* **Risk:** Network retries or duplicate packet emissions (e.g., repeated `mark messages read` or `user away` events).
* **Safety Mechanism:**
  All receipt and presence handlers are mathematically **idempotent**:
  $$f(f(x)) = f(x)$$
  Marking an already read message as read, or setting an already away socket as away, results in an identical terminal state without state corruption or duplicate notifications.

---

## 4. Summary Table of Concurrency Safeguards

| Component / Action | Potential Concurrency Hazard | Applied Design Pattern / Data Structure | Resulting Invariant |
| :--- | :--- | :--- | :--- |
| **Multi-tab Presence** | Premature offline status when closing 1 of 3 tabs | `Set<string>` of socket IDs per user | User remains online until `Set.size === 0`. |
| **Message Delivery Receipts** | Duplicate delivery updates / Race conditions | MongoDB `$addToSet` atomic operator | Each user ID appears at most once in `deliveredTo`. |
| **Message Read Receipts** | Read status before delivered status | Cascading atomic update (`readBy` + `deliveredTo`) | Any user in `readBy` is guaranteed to be in `deliveredTo`. |
| **Username Collisions** | Simultaneous registration of identical username | Database unique B-Tree index + Active Session check | Exactly one user can claim a username; collisions return 409. |
| **Group Chat Administration** | Non-admin adding or removing members concurrently | Role guard check before atomic `$push` / `$pull` | Unauthorized mutations are rejected with 403 Forbidden. |
