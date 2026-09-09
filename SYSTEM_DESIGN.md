# System Design Specification: Real-Time Instant Messaging System (MERN + Socket.IO)

## Overview
Dokumen spesifikasi ini mendokumentasikan arsitektur teknis, model data, mesin status (*state machines*), protokol komunikasi, dan alur interaksi dari sistem **Real-Time Instant Messaging (IM)** yang diimplementasikan pada repositori ini. Dokumen ini diperbarui langsung berdasarkan implementasi nyata pada codebase (berbasis Node.js, Express, React, MongoDB, dan Socket.IO).

---

## PART 1 — Conversation Design & Data Architecture

### 1. Definisi Percakapan (Definition of Conversation)
Dalam sistem ini, **percakapan (conversation / chat)** adalah saluran komunikasi terstruktur antara dua atau lebih pengguna yang dikelola oleh server backend dan disinkronisasi secara real-time ke seluruh klien yang terhubung.

Sebuah percakapan terdiri atas:
- **Partisipan (`users`)**: Entitas pengguna terdaftar yang memiliki otorisasi akses ke percakapan.
- **Pesan (`messages`)**: Payload konten teks, penanda pesan sistem, pengirim, dan riwayat transmisi.
- **Timestamp**: Waktu pembuatan dan pembaruan berbasis ISO-8601 UTC (`createdAt`, `updatedAt`).
- **Status Pengiriman Relasional**: Penanda keterkiriman multi-partisipan berbasis array (`deliveredTo` dan `readBy`).
- **Interaksi Ephemeral**: Aksi pengguna sementara seperti indikator sedang mengetik (*typing indicators*) dan perubahan status kehadiran (*presence status*).
- **Pesan Sistem (System Events)**: Notifikasi terintegrasi ke dalam aliran percakapan untuk perubahan konfigurasi grup (misal: penambahan anggota, pengangkatan admin, pergantian nama grup).

---

### 2. Model Percakapan (Conversation Models)

#### A. Direct Message (One-to-One Conversation)
Saluran komunikasi privat antara tepat dua pengguna.
- **Partisipan**: Tepat 2 entitas pengguna.
- **Privasi**: Hanya dapat diakses oleh kedua partisipan yang bersangkutan (diverifikasi via token JWT).
- **Persistensi**: Disimpan dalam koleksi database `Chat` dengan atribut `isGroupChat: false`.
- **Pembuatan Otomatis**: Jika percakapan antara kedua pengguna sudah ada, server mengembalikan instance yang telah ada; jika belum, instansi baru dibuat secara otomatis.

#### B. Group Conversation
Saluran komunikasi multi-pihak dengan hierarki peran dan kontrol administratif.
- **Partisipan**: Jamak pengguna (dinamis: dapat ditambah atau dikurangi).
- **Pemilik & Hierarki Admin**:
  - `groupAdmin`: Pengguna pembuat grup (Primary Admin).
  - `groupAdmins`: Daftar pengguna yang memiliki hak administratif penuh (Multi-Admin Support).
- **Hak Akses Admin**:
  - Menambah anggota baru (`groupadd`).
  - Mengeluarkan anggota (`groupremove`).
  - Mengubah metadata (nama grup `rename`).
  - Mempromosikan anggota menjadi admin (`groupadmin/promote`).
  - Menurunkan status admin menjadi anggota reguler (`groupadmin/demote`).
- **Pesan Sistem**: Setiap tindakan struktural grup secara otomatis menghasilkan rekaman pesan sistem berformat khusus.

---

### 3. Model Data & Skema (Mongoose Schemas)

#### A. Skema Pengguna (`User`)
Lokasi: `backend/models/userModel.js`

```typescript
interface IUser {
  _id: string;                      // MongoDB ObjectId
  username: string;                 // Unik, lowercase, trim (Kredensial Login)
  name: string;                     // Nama tampilan pengguna
  email?: string;                   // Opsional
  password: string;                 // Hash bcrypt (salt rounds: 10)
  pic: string;                      // URL foto profil/avatar
  isAdmin: boolean;                 // Hak superadmin sistem (default: false)
  status: "online" | "offline" | "away"; // Status kehadiran real-time
  lastSeen: Date;                   // Timestamp terakhir aktif
  createdAt: Date;
  updatedAt: Date;
}
```

#### B. Skema Percakapan (`Chat`)
Lokasi: `backend/models/chatModel.js`

```typescript
interface IChat {
  _id: string;                      // MongoDB ObjectId
  chatName: string;                 // Nama percakapan atau grup
  isGroupChat: boolean;             // Flag pembeda DM vs Grup (default: false)
  users: IUser[];                   // Referensi anggota percakapan
  latestMessage?: IMessage;         // Referensi pesan terakhir untuk cuplikan daftar obrolan
  groupAdmin?: IUser;               // Admin utama / pembuat grup
  groupAdmins: IUser[];             // Daftar seluruh admin grup (multi-admin)
  createdAt: Date;
  updatedAt: Date;
}
```

#### C. Skema Pesan (`Message`)
Lokasi: `backend/models/messageModel.js`

```typescript
interface IMessage {
  _id: string;                      // MongoDB ObjectId
  sender: IUser;                    // Referensi pengguna pengirim
  content: string;                  // Isi teks pesan
  chat: IChat;                      // Referensi room percakapan
  deliveredTo: string[];            // Array of User ObjectIds penerima yang online
  readBy: string[];                 // Array of User ObjectIds penerima yang telah membuka pesan
  isSystemMessage: boolean;         // Flag pesan sistem otomatis (default: false)
  systemMessageType?: string;       // Jenis aksi sistem: "USER_ADDED" | "USER_REMOVED" | "ADMIN_PROMOTED" dll.
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 4. Siklus Hidup Status Pesan (Message Delivery State Machine)

Pada implementasi nyata grup dan direct message, status keterkiriman pesan berevolusi secara dinamis dengan representasi centang bergaya WhatsApp:

```text
       [USER SENDS MESSAGE]
                 │
                 ▼
          ┌─────────────┐
          │    Sent     │ ── Single Gray Checkmark (✓)
          └─────────────┘    Tersimpan di database; server menerima payload
                 │
                 ├─ Recipient(s) connected/online (socket ACK / onlineUsers match)
                 ▼
          ┌─────────────┐
          │  Delivered  │ ── Double Gray Checkmark (✓✓)
          └─────────────┘    ID penerima masuk ke array `deliveredTo`
                 │
                 ├─ Recipient opens chat / reads message
                 ▼
          ┌─────────────┐
          │    Read     │ ── Double Blue/Cyan Checkmark (✓✓)
          └─────────────┘    ID penerima masuk ke array `readBy`
```

1. **Sent (`✓`)**: Pesan berhasil dibuat melalui HTTP POST `/api/message`, tersimpan di MongoDB, dan dipancarkan ke antrean Socket.IO.
2. **Delivered (`✓✓` abu-abu)**: Server mendeteksi penerima berada dalam daftar `onlineUsers`, atau klien penerima memicu `mark messages delivered`. ID penerima dimasukkan ke dalam atribut `deliveredTo`.
3. **Read (`✓✓` biru/cyan)**: Klien penerima membuka ruangan obrolan yang aktif, memicu socket event `mark messages read` atau endpoint HTTP PUT `/api/message/read/:chatId`. ID penerima dimasukkan ke dalam `readBy` dan `deliveredTo`.

---

### 5. Mesin Status Kehadiran Pengguna (User Presence State Machine)

Kehadiran pengguna dikelola secara tersentralisasi pada memori server (`onlineUsers` Map) dan disinkronkan ke MongoDB:

```text
       [Socket Setup / Login]
                 │
                 ▼
          ┌─────────────┐
          │   ONLINE    │ <────────────────────────┐
          └─────────────┘                          │
                 │                                 │
     User Idle (2 min) / Tab Blur         User Activity Detected
                 │                    (click / keydown / focus)
                 ▼                                 │
          ┌─────────────┐                          │
          │    AWAY     │ ─────────────────────────┘
          └─────────────┘
                 │
      All Sockets Disconnected
                 │
                 ▼
          ┌─────────────┐
          │   OFFLINE   │  --> Updates `lastSeen` timestamp
          └─────────────┘
```

- **Penanganan Multi-Tab**: Server melacak setiap koneksi tab browser secara independen (`sockets: Set<string>`). Pengguna hanya bertransisi ke status `offline` ketika **seluruh socket** milik pengguna tersebut terputus (`sockets.size === 0`).
- **Deteksi Idle Otomatis**: Klien React memonitor tab visibility (`document.hidden`) dan interaksi pengguna ter-throttle (`click`, `keydown`, `touchstart`, `mousedown`). Jika tab diminimalkan/beralih, klien langsung emit `user away`. Jika pengguna tidak berinteraksi selama 2 menit (`IDLE_TIME = 2 * 60 * 1000`), event `user away` dikirim ke server. Begitu pengguna kembali aktif, status di-reset ke `online` via `user active`.

---

## PART 2 — Client-Server Architecture & Communication Protocols

### 1. Diagram Arsitektur Sistem

```text
┌──────────────────────────────────────────────────────────────────┐
│                           Client Tier                            │
│           React 17 + Chakra UI + Socket.io-Client v4            │
└───────────────▲──────────────────────────────────▲───────────────┘
                │                                  │
      Stateless REST API                   Stateful Real-Time
      HTTP/JSON Requests                   WebSockets (ws://)
      (Bearer JWT Header)                  (Bi-directional Events)
                │                                  │
┌───────────────▼──────────────────────────────────▼───────────────┐
│                           Server Tier                            │
│                 Node.js / Express.js Application                 │
│   ├── REST Controllers (/api/user, /api/chat, /api/message)      │
│   ├── Auth Middleware (JWT Token Verification & Session Guard)   │
│   └── Socket.IO Engine (Presence Broker, Rooms, Event Router)    │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                         Mongoose ODM Driver
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│                          Database Tier                           │
│                   MongoDB Document Database                      │
│             Collections: users, chats, messages                  │
└──────────────────────────────────────────────────────────────────┘
```

---

### 2. Spesifikasi RESTful API Endpoints

Seluruh rute yang membutuhkan otentikasi diproteksi menggunakan middleware `protect` (verifikasi header `Authorization: Bearer <token>`).

#### A. Rute Pengguna (`/api/user`)
| Method | Endpoint | Hak Akses | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/user` | Publik | Registrasi pengguna baru (`name`, `username`, `password`, `pic`). |
| `POST` | `/api/user/login` | Publik | Otentikasi pengguna menggunakan `username` dan `password`. Mengembalikan token JWT dan profil. |
| `GET` | `/api/user?search=keyword` | Terproteksi | Mencari daftar pengguna berdasarkan nama atau username (mengecualikan pengguna aktif). |

#### B. Rute Percakapan (`/api/chat`)
| Method | Endpoint | Hak Akses | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/chat` | Terproteksi | Mengakses atau membuat percakapan 1-on-1 dengan `userId`. |
| `GET` | `/api/chat` | Terproteksi | Mengambil seluruh percakapan yang diikuti oleh pengguna aktif (diurutkan berdasarkan pembaruan terbaru). |
| `POST` | `/api/chat/group` | Terproteksi | Membuat obrolan grup baru (`name`, daftar `users`). Pembuat otomatis menjadi `groupAdmin`. |
| `PUT` | `/api/chat/rename` | Terproteksi (Admin) | Mengubah nama grup obrolan. |
| `PUT` | `/api/chat/groupadd` | Terproteksi (Admin) | Menambahkan pengguna baru ke dalam grup. |
| `PUT` | `/api/chat/groupremove`| Terproteksi (Admin/Self) | Mengeluarkan anggota dari grup atau keluar mandiri (*leave group*). |
| `PUT` | `/api/chat/groupadmin/promote` | Terproteksi (Admin) | Mempromosikan anggota menjadi admin grup (`groupAdmins`). |
| `PUT` | `/api/chat/groupadmin/demote` | Terproteksi (Admin) | Menurunkan jabatan admin menjadi anggota reguler. |
| `DELETE` | `/api/chat/:chatId` | Terproteksi (Admin/Anggota) | Menghapus seluruh percakapan beserta relasinya. |

#### C. Rute Pesan (`/api/message`)
| Method | Endpoint | Hak Akses | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/message` | Terproteksi | Mengirim pesan baru (`content`, `chatId`). Memperbarui `latestMessage` pada Chat. |
| `GET` | `/api/message/:chatId` | Terproteksi | Mengambil seluruh riwayat pesan pada sebuah percakapan. |
| `PUT` | `/api/message/read/:chatId` | Terproteksi | Menandai seluruh pesan pada percakapan tersebut sebagai telah dibaca (`readBy`). |
| `PUT` | `/api/message/delivered` | Terproteksi | Menandai kumpulan ID pesan tertentu sebagai telah terkirim (`deliveredTo`). |
| `DELETE` | `/api/message/clear/:chatId` | Terproteksi | Mengosongkan seluruh riwayat pesan dalam satu percakapan (*Clear Chat*). |
| `DELETE` | `/api/message/:messageId` | Terproteksi | Menghapus satu pesan spesifik berdasarkan ID. |

---

### 3. Spesifikasi Protokol Real-Time (Socket.IO Events)

Komunikasi real-time dijalankan di atas Socket.IO melalui *event-driven architecture*.

#### A. Event dari Klien ke Server (Client $\rightarrow$ Server)
| Event Name | Parameter Payload | Penjelasan Operasional |
| :--- | :--- | :--- |
| `setup` | `userData: { _id, username, ... }` | Menginisialisasi session socket pengguna, memasukkan socket ke room pribadi `userId`, dan mendaftarkannya ke sistem kehadiran. |
| `get online users` | `-` | Meminta peta status pengguna yang sedang online saat ini. |
| `user away` | `-` | Memberitahu server bahwa tab klien sedang idle atau tidak aktif. |
| `user active` | `-` | Memberitahu server bahwa klien kembali aktif berinteraksi. |
| `join chat` | `room: string (chatId)` | Memasukkan instance socket ke dalam room percakapan spesifik. |
| `typing` | `room: string (chatId)` | Mengirim sinyal indikator sedang mengetik ke seluruh peserta di room obrolan. |
| `stop typing` | `room: string (chatId)` | Menghentikan sinyal indikator sedang mengetik. |
| `new message` | `messagePayload: IMessage` | Memancarkan pesan baru yang baru saja disimpan ke room penerima. |
| `mark messages read`| `{ chatId, userId }` | Memberitahukan server dan peers bahwa pengguna telah membaca pesan di chat terkait. |
| `mark messages delivered` | `{ messageIds: string[], userId }` | Mengonfirmasi bahwa pesan telah berhasil dirender/diterima oleh klien penerima. |
| `clear chat` | `chatId: string` | Memancarkan sinyal bahwa riwayat pesan obrolan telah dibersihkan. |
| `delete message` | `{ messageId, chatId }` | Memancarkan sinyal penghapusan pesan spesifik. |
| `delete chat` | `chatId: string` | Memancarkan sinyal penghapusan ruang obrolan. |

#### B. Event dari Server ke Klien (Server $\rightarrow$ Client)
| Event Name | Parameter Payload | Penjelasan Operasional |
| :--- | :--- | :--- |
| `connected` | `activeUsersList: object` | Konfirmasi inisialisasi socket berhasil disertai snapshot pengguna online. |
| `online users list` | `activeUsersList: object` | Daftar terkini seluruh pengguna yang berstatus `online` atau `away`. |
| `user status change` | `{ userId, status, lastSeen }` | Broadcast perubahan status kehadiran pengguna ke seluruh klien terhubung. |
| `message recieved` | `newMessage: IMessage` | Pengiriman payload pesan baru kepada penerima secara real-time. |
| `message delivered update` | `{ messageId, chatId, deliveredTo }` | Notifikasi kepada pengirim bahwa pesannya telah diterima oleh penerima yang online. |
| `messages read update` | `{ chatId, readerId }` | Notifikasi kepada pengirim/room bahwa pesan telah dibaca (merubah status centang menjadi biru). |
| `messages delivered update` | `{ messageIds, userId }` | Pembaruan status pesan batch ke status delivered. |
| `typing` | `-` | Memicu animasi indikator lawan bicara sedang mengetik di sisi penerima. |
| `stop typing` | `-` | Menyembunyikan animasi indikator mengetik. |
| `chat cleared` | `chatId: string` | Menginstruksikan klien untuk mengosongkan state pesan lokal pada chat terkait. |
| `message deleted` | `{ messageId, chatId }` | Menginstruksikan klien untuk membuang pesan tertentu dari memori lokal. |
| `chat deleted` | `chatId: string` | Menginstruksikan klien untuk menutup tampilan obrolan yang dihapus. |

---

## PART 3 — Interaction Scenarios & Sequence Diagrams

### Skenario 1: Pengiriman Pesan & Siklus Status (Sent $\rightarrow$ Delivered $\rightarrow$ Read)

Diagram berikut mengilustrasikan pengiriman pesan dari **Alice** ke **Bob**, dengan pelacakan status penyerahan secara langsung:

```text
Alice (Client A)            Server (Express & Socket.io)            Bob (Client B)
       │                                  │                                │
       │ 1. POST /api/message             │                                │
       │    { chatId, content: "Halo" }   │                                │
       ├─────────────────────────────────>│                                │
       │                                  │ [Save to DB with status: sent] │
       │ 2. Response 201 Created (IMessage)                                │
       │<─────────────────────────────────┤                                │
       │ (Renders "Halo" with Single ✓)   │                                │
       │                                  │                                │
       │ 3. socket.emit("new message", msg)                                │
       ├─────────────────────────────────>│                                │
       │                                  │ 4. Check if Bob is in onlineUsers?
       │                                  │    --> YES (Bob is online)     │
       │                                  │                                │
       │                                  │ 5. socket.emit("message recieved")
       │                                  │───────────────────────────────>│
       │                                  │                                │ (Renders notification)
       │                                  │ 6. DB Update:                  │
       │                                  │    deliveredTo.push(Bob._id)   │
       │ 7. emit("message delivered update")                               │
       │<─────────────────────────────────┤                                │
       │ (Renders "Halo" with Double Gray ✓✓)                              │
       │                                  │                                │
       │                                  │ 8. Bob opens Chat Window       │
       │                                  │    socket.emit("mark messages read",
       │                                  │    { chatId, userId: Bob._id })│
       │                                  │<───────────────────────────────┤
       │                                  │ 9. DB Update:                  │
       │                                  │    readBy.push(Bob._id)        │
       │ 10. emit("messages read update") │                                │
       │<─────────────────────────────────┤                                │
       │ (Renders "Halo" with Double Blue ✓✓)                              │
```

---

### Skenario 2: Siklus Kehadiran & Penanganan Multi-Tab (Presence & Away Lifecycle)

```text
Browser Tab 1 (Alice)      Browser Tab 2 (Alice)           Server (Socket Broker)
       │                             │                               │
       │ 1. socket.emit("setup")     │                               │
       ├─────────────────────────────┼──────────────────────────────>│
       │                             │                               │ [onlineUsers.set(Alice, { sockets: [T1] })]
       │                             │                               │ broadcast: Alice is ONLINE
       │                             │ 2. socket.emit("setup")       │
       │                             ├──────────────────────────────>│
       │                             │                               │ [onlineUsers.get(Alice).sockets.add(T2)]
       │                             │                               │ (Remains ONLINE)
       │                             │                               │
       │ 3. Idle 2 min / Tab Inactive │                               │
       │    socket.emit("user away") │                               │
       ├─────────────────────────────┼──────────────────────────────>│
       │                             │                               │ Check: Is T2 away? NO.
       │                             │                               │ (Status stays ONLINE)
       │                             │                               │
       │                             │ 4. Idle 2 min / Minimize Tab 2│
       │                             │    socket.emit("user away")   │
       │                             ├──────────────────────────────>│
       │                             │                               │ Check: Are all sockets away? YES.
       │                             │                               │ Updates Alice DB -> "away"
       │                             │                               │ broadcast: Alice is AWAY
       │                             │                               │
       │ 5. Mouse moved on Tab 1     │                               │
       │    socket.emit("user active")                               │
       ├─────────────────────────────┼──────────────────────────────>│
       │                             │                               │ Updates Alice DB -> "online"
       │                             │                               │ broadcast: Alice is ONLINE
```

---

### Skenario 3: Manajemen Grup & Injeksi Pesan Sistem (Group Hierarchy & System Event)

```text
Group Admin (Alice)                 Server (Chat Controller)             Group Member (Bob)
       │                                       │                                  │
       │ 1. PUT /api/chat/groupadd             │                                  │
       │    { chatId, userId: Charlie }        │                                  │
       ├──────────────────────────────────────>│                                  │
       │                                       │ 2. Verify: Is Alice an Admin?    │
       │                                       │    --> YES                       │
       │                                       │ 3. Add Charlie to chat.users     │
       │                                       │ 4. Auto-generate System Message: │
       │                                       │    content: "Alice added Charlie"│
       │                                       │    isSystemMessage: true         │
       │                                       │ 5. Save System Message to DB     │
       │                                       │                                  │
│ 6. Response 200 OK (Updated Chat)     │                                  │
       │<──────────────────────────────────────┤                                  │
       │                                       │ 7. emit("message recieved", sysMsg)
       │                                       │─────────────────────────────────>│
       │ (Renders centered system pill badge:  │                                  │ (Renders centered system pill badge:
       │  "Alice added Charlie")               │                                  │  "Alice added Charlie")
```

---

## PART 4 — Formal Client/Server Protocol Grammar (BNF / EBNF)

### 1. Lexical Primitives & Syntax Tokens
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

### 2. Socket.IO Event Grammar
```bnf
SocketMessage             ::= ClientToServerMessage | ServerToClientMessage

ClientToServerMessage     ::= "setup" "," UserInitPayload
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

ServerToClientMessage     ::= "connected" "," ActiveUsersMap
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

### 3. Client & Server State Specification
* **Client State Invariants:**
  - `user` memegang identitas aktif dan token otentikasi.
  - `selectedChat` menunjuk pada room percakapan aktif yang sedang dibuka.
  - `onlineUsers` memetakan kehadiran seluruh peer online secara real-time.
* **Server State Invariants:**
  - `onlineUsers` Map menyimpan set multi-socket pengguna dan status konsolidasi (`online`/`away`).
  - Pengguna hanya berstatus `offline` bila seluruh socket koneksi terputus (`sockets.size === 0`).
  - `socketToUser` Map menjamin lookup $O(1)$ untuk pembersihan event saat koneksi terputus (*disconnect*).
