# 💬 Talk-A-Tive — Instant Messaging (IM) System

A modern real-time instant messaging application built on the **MERN Stack** (MongoDB, Express.js, React.js, Node.js) with bidirectional communication powered by **Socket.IO**. Engineered with a sleek dark-mode interface, intelligent presence tracking (*online / away / offline*), JWT authentication, comprehensive security hardening, and a 100% deterministic automated test suite.

---

## ⚡ QUICK START GUIDE (CHOOSE ONE OPTION)

You or your collaborators can launch this project using **Option 1 (Docker - Strongly Recommended)** or **Option 2 (Manual Local Setup)**.

---

### 🐳 Option 1: Running with Docker (Recommended, Single Command)

> **Key Advantage:** Zero manual installation required for Node.js or MongoDB. All services (Web Application, MongoDB Database, and Mongo Express Web Database GUI) are automatically built, provisioned, and bridged within isolated containers.

#### 1. Prerequisites
Ensure **Docker Desktop** is installed and actively running on your machine.

#### 2. Clone & Run
Open your terminal (Command Prompt, PowerShell, or Bash):
```bash
git clone https://github.com/pandhuuuu/Instan_message.git
cd Instan_message

# Launch all services (automatically compiles frontend and backend)
docker compose up --build
```

#### 3. Access Services in Browser
Once container provisioning completes:
* 🌐 **Web Chat Application:** [http://localhost:5000](http://localhost:5000)
* 🗄️ **Database Viewer (Mongo Express):** [http://localhost:8888](http://localhost:8888)

#### 4. Database Viewer Credentials (Mongo Express)
When opening [http://localhost:8888](http://localhost:8888), use the default administrative credentials:
* **Username:** `admin`
* **Password:** `AdminSecurityPass2026!`

#### 5. Stopping Containers
To gracefully terminate and remove all containers:
```bash
docker compose down
```

---

### 💻 Option 2: Running Manually (Local Development Without Docker)

Use this option if you wish to run and modify code natively on your host machine.

#### 1. Prerequisites
* **Node.js** (v16, v18, or v20)
* **MongoDB Community Server** (running locally on port `27017`)

#### 2. Clone Repository
```bash
git clone https://github.com/pandhuuuu/Instan_message.git
cd Instan_message
```

#### 3. Configure Environment Variables (`.env`)
A template file [`.env.example`](./.env.example) is included in the repository. Copy it to `.env`:
* **Windows (PowerShell):**
  ```powershell
  Copy-Item .env.example .env
  ```
* **Linux / macOS:**
  ```bash
  cp .env.example .env
  ```

Default `.env` configuration:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/chat-app
JWT_SECRET=chat_app_secret_2026
```

#### 4. Install Dependencies
```bash
# 1. Install Backend dependencies (root)
npm install

# 2. Install Frontend dependencies
cd frontend
npm install --legacy-peer-deps
cd ..
```

#### 5. Start the Application (Development Mode)
Open two separate terminal windows:

* **Terminal 1 — Backend API & Socket Server:**
  ```bash
  npm run server
  ```
  *(Runs on `http://localhost:5000` with nodemon live reload)*

* **Terminal 2 — Frontend React App:**
  ```bash
  cd frontend
  npm start
  ```
  *(Automatically opens your browser at `http://localhost:3000`)*

---

## 🗄️ DATABASE ACCESS & MANAGEMENT (MONGODB)

Inspect, query, and manage database records through the following interfaces:

| Access Method | URL / Connection URI | Username | Password / Auth Mode |
| :--- | :--- | :--- | :--- |
| **Web GUI (Mongo Express)** | `http://localhost:8888` | `admin` | `AdminSecurityPass2026!` |
| **MongoDB Compass (Desktop GUI)** | `mongodb://127.0.0.1:27017/chat-app` | *(None)* | *No Authentication* |
| **Docker Internal Bridge** | `mongodb://mongodb:27017/chat-app` | *(None)* | *No Authentication* |

> 💡 **Inspecting Chat Data:**
> In Mongo Express (`http://localhost:8888`), select the **`chat-app`** database to view collections:
> - `users`: Registered accounts, hashed bcrypt credentials, online presence, and avatars.
> - `chats`: 1-on-1 and Group conversations, admin assignments, and per-user clear timestamps.
> - `messages`: Stored text payloads, delivery/read receipt arrays, and sender references.

---

## 🧪 AUTOMATED TESTING & PERFORMANCE BENCHMARKS

This repository includes a comprehensive, deterministic automated test suite covering security, RBAC hierarchies, data isolation, and duplex WebSocket streaming.

### 1. Execute 63 Automated Integration Tests
Ensure the backend server is running, then execute:
```bash
npm test
```
* **Coverage Matrix:**
  * **Section 1:** Security Headers (Helmet nosniff), Auth Guards, Error Leak Protection.
  * **Section 2:** User Registration, Bcrypt Hashing, Password Minimum Enforcement, ReDoS Immunity, Quick Connect.
  * **Section 3:** 1-on-1 Conversation Management & Idempotency.
  * **Section 4:** Messaging, Delivery Status Acknowledgment, Read Receipts, Single Message Deletion RBAC.
  * **Section 5:** Data Isolation: Per-User Clear Chat & Delete Chat Invariants.
  * **Section 6:** Group Chat Lifecycle: Co-Admin Promotion/Demotion, Member Add/Remove, Audit Trail.
  * **Section 7:** Real-Time WebSocket Session Handshake, Typing Indicators, and Live Message Streaming.
* **Automated Teardown:** A dedicated teardown routine purges all ephemeral test records upon completion (*zero database pollution*).

### 2. End-to-End Latency Benchmark (SLA < 200 ms)
```bash
node backend/scripts/benchmark_latency.js
```
* Measures Round-Trip Time (RTT) for in-memory signals (typing indicator), full database writes, and delivery receipts (Actual P95: **27.22 ms** vs SLA threshold $< 200\text{ ms}$).

### 3. Concurrency Benchmark (Hundreds Connections)
```bash
node backend/scripts/benchmark_concurrency.js
```
* Verifies 350 simultaneous WebSocket connections, per-socket memory footprint (~26 KB), and broadcast burst throughput (~9,400 events/second).

---

## 🔒 SECURITY & GIT CONVENTIONS

To ensure production integrity and protect private credentials when collaborating:

1. **Active `.env` is Kept Out of Git:**
   * Private `.env` files are automatically excluded via `.gitignore`.
   * The public template [`.env.example`](./.env.example) is tracked to guide onboarding.
2. **Internal Documentation (`docs/`):**
   * The `docs/` folder is excluded via `.gitignore` for private records and has zero impact on application runtime.
3. **Shared Test Utility:**
   * The helper [backend/tests/utils/testClient.js](./backend/tests/utils/testClient.js) is tracked in Git to guarantee `npm test` runs deterministically on any machine.

---

## 🛠️ COMMON TROUBLESHOOTING

* **Error: `EADDRINUSE: address already in use :::5000`**
  * Port 5000 is occupied by a previously running process. Terminate existing containers with `docker compose down` or stop lingering Node.js processes.
* **Mongo Express Repeatedly Prompts for Login:**
  * Ensure credentials are entered correctly: Username: `admin`, Password: `AdminSecurityPass2026!`.
* **WebSocket Authentication Error on Connect:**
  * The server enforces handshake authentication. Ensure clients provide a valid JWT token via `auth: { token }`.

---

## 👤 Author
* **Pandhu** — [@pandhuuuu](https://github.com/pandhuuuu)
