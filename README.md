# Instant Messaging (IM) Project 💬

Aplikasi perpesanan instan modern berbasis **MERN Stack** (MongoDB, Express, React, Node.js) dengan komunikasi *real-time* bertenaga **Socket.io**. Dirancang dengan tampilan antarmuka *sleek dark-mode*, sistem kehadiran cerdas (*online/away/offline*), serta performa yang responsif.

---

## 🚀 Fitur Utama

- 🟢 **Status Kehadiran Real-Time (Presence System)**:
  - **Online**: Pengguna terhubung dan aktif berinteraksi.
  - **Away**: Otomatis aktif jika pengguna beralih tab browser atau idle selama 2 menit.
  - **Offline**: Otomatis aktif saat pengguna menutup aplikasi atau koneksi terputus.
- ⏱️ **Last Seen (Terakhir Dilihat)**:
  - Menampilkan waktu terakhir aktif lawan bicara secara akurat (*"Baru saja"*, *"X menit yang lalu"*, *"Hari ini pukul HH:mm"*, dsb.).
- 💬 **Direct & Group Chats**:
  - Obrolan pribadi 1-on-1 dengan indikator status lawan bicara di header.
  - Obrolan grup dengan jumlah anggota dan penghitung anggota yang sedang aktif (*online count*).
  - Manajemen grup: Buat grup baru, ubah nama grup, tambah atau keluarkan anggota (khusus admin grup).
- ✍️ **Typing Indicator**:
  - Indikator animasi saat lawan bicara sedang mengetik pesan.
- 🔔 **Sistem Notifikasi Real-Time**:
  - Notifikasi pesan baru dengan tanda lencana (*badge*) saat sedang membuka ruang chat lain.
- 🔍 **Pencarian Pengguna Cepat**:
  - Cari pengguna lain berdasarkan nama atau username lengkap dengan status online/offline mereka.
- 👤 **Profil Pengguna**:
  - Modal detail profil lengkap dengan foto profil, status aktif, dan handle @username.
- 🎨 **Modern Dark Aesthetic**:
  - Tampilan antarmuka bertema gelap modern dengan animasi halus dan tipografi *Plus Jakarta Sans*.
- 🔐 **Otentikasi & Keamanan**:
  - Registrasi & Login berbasis **Username & Password** dengan enkripsi password menggunakan **bcryptjs** dan otentikasi token berbasis **JWT (JSON Web Token)**.

---

## 🛠️ Tech Stack

| Komponen | Teknologi |
| :--- | :--- |
| **Frontend** | React.js (v17), Chakra UI, Framer Motion, Socket.io-Client, Axios |
| **Backend** | Node.js, Express.js, Socket.io (v4), Mongoose |
| **Database** | MongoDB (Mongoose ODM) |
| **Otentikasi** | JSON Web Token (JWT), bcryptjs |

---

## 📦 Struktur Proyek

```text
IM_Project/
├── backend/
│   ├── config/           # Koneksi database & token generator
│   ├── controllers/      # Logika API user, chat, & message
│   ├── middleware/       # Autentikasi & error handling middleware
│   ├── models/           # Mongoose schemas (User, Chat, Message)
│   ├── routes/           # Express API endpoints
│   └── server.js         # Entry point server & Socket.io logic
├── frontend/
│   ├── public/           # Aset statis & HTML template
│   └── src/
│       ├── components/   # Komponen UI (Chatbox, MyChats, SingleChat, Modal, dll.)
│       ├── Context/      # ChatProvider (Global State & Socket.io Presence)
│       ├── config/       # Logika chat & helper status pengguna
│       └── Pages/        # Halaman utama (Homepage & Chatpage)
├── .env                  # Variabel lingkungan lokal
├── package.json          # Script & dependensi root backend
└── README.md             # Dokumentasi proyek
```

---

## 💻 Panduan Menjalankan Secara Lokal

> 📖 **Panduan Menyiapkan di Laptop Baru**:
> Jika Anda menggunakan laptop yang baru atau baru pertama kali meng-install Node.js & MongoDB, silakan baca panduan lengkap langkah-demi-langkah di file **[PANDUAN_SETUP.md](./PANDUAN_SETUP.md)**.

### 1. Clone Repository
```bash
git clone https://github.com/pandhuuuu/Instan_message.git
cd Instan_message
```

### 2. Install Dependensi
```bash
# Install dependensi backend (root)
npm install

# Install dependensi frontend
cd frontend
npm install --legacy-peer-deps
cd ..
```

### 3. Konfigurasi Environment Variables
Buat file `.env` di folder root proyek:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/chat-app
JWT_SECRET=your_jwt_secret_key_2026
NODE_ENV=development
```

### 4. Jalankan Automated Tests (Verifikasi 44 Skenario)
```bash
npm test
```

### 5. Jalankan Aplikasi
Buka dua jendela terminal terpisah:

**Terminal 1 — Jalankan Backend Server:**
```bash
npm run server
```
*(Server akan berjalan di `http://localhost:5000` dengan nodemon auto-reload)*.

**Terminal 2 — Jalankan Frontend React:**
```bash
cd frontend
npm start
```
*(Aplikasi akan terbuka otomatis di browser pada `http://localhost:3000` atau `3001`)*.

---

## 👤 Author

- **Pandhu** — [@pandhuuuu](https://github.com/pandhuuuu)
