# 🚀 Panduan Lengkap Menjalankan Aplikasi dari Awal (Fresh Laptop / Laptop Baru)

Dokumen ini adalah panduan langkah-demi-langkah bagi Anda yang ingin menjalankan aplikasi **Talk-A-Tive Instant Messaging (IM)** di laptop yang benar-benar baru atau belum pernah dipasang dependensi proyek ini sebelumnya.

---

## 📋 Daftar Isi
1. [Prasyarat yang Harus Di-install di Laptop Baru](#1-prasyarat-yang-harus-di-install-di-laptop-baru)
2. [Langkah 1: Clone Repositori dari GitHub](#2-langkah-1-clone-repositori-dari-github)
3. [Langkah 2: Buat File Konfigurasi Lingkungan (`.env`)](#3-langkah-2-buat-file-konfigurasi-lingkungan-env)
4. [Langkah 3: Install Dependensi Proyek (Backend & Frontend)](#4-langkah-3-install-dependensi-proyek-backend--frontend)
5. [Langkah 4: Pastikan Database MongoDB Berjalan](#5-langkah-4-pastikan-database-mongodb-berjalan)
6. [Langkah 5: Jalankan Aplikasi (Development Mode)](#6-langkah-5-jalankan-aplikasi-development-mode)
7. [Langkah 6: Verifikasi dengan Automated Tests (44 Skenario)](#7-langkah-6-verifikasi-dengan-automated-tests-44-skenario)
8. [Langkah 7: Cara Buka dari Laptop / Perangkat Lain (Multi-Device)](#8-langkah-7-cara-buka-dari-laptop--perangkat-lain-multi-device)
9. [Troubleshooting & Solusi Error Umum](#9-troubleshooting--solusi-error-umum)

---

## 1. Prasyarat yang Harus Di-install di Laptop Baru

Sebelum menjalankan kode, pastikan laptop baru Anda telah memasang 3 perangkat lunak utama berikut:

### A. Install Node.js (Runtime JavaScript)
1. Buka browser dan kunjungi: [https://nodejs.org/](https://nodejs.org/)
2. Unduh versi **LTS (Long Term Support)** yang direkomendasikan (misal v18 atau v20).
3. Jalankan installer (`.msi` atau `.pkg`), ikuti petunjuk instalasi sampai selesai (*Next* sampai *Finish*).
4. Verifikasi instalasi dengan membuka **Command Prompt (CMD)** atau **PowerShell**:
   ```bash
   node -v
   npm -v
   ```
   *(Jika versi muncul, misal `v20.x.x` dan `10.x.x`, berarti Node.js sudah terpasang dengan baik)*.

---

### B. Install Git
1. Kunjungi: [https://git-scm.com/downloads](https://git-scm.com/downloads)
2. Unduh installer Git untuk sistem operasi Anda (Windows/macOS/Linux) dan pasang.
3. Verifikasi dengan perintah:
   ```bash
   git --version
   ```

---

### C. Database MongoDB (Pilih Salah Satu Opsi)

#### Opsi 1: Pasang MongoDB Lokal (Rekomendasi untuk Offline / Development)
1. Download **MongoDB Community Server**: [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
2. Saat proses instalasi di Windows, pastikan opsi **"Install MongoDB as a Service"** dan **"Install MongoDB Compass"** tercentang.
3. Setelah selesai, MongoDB otomatis berjalan sebagai *background service* di port `27017`.

#### Opsi 2: Gunakan MongoDB Atlas Cloud (Tanpa Perlu Install MongoDB di Laptop)
1. Daftar gratis di [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Buat klaster gratis (Shared M0).
3. Buat database user dan salin connection string URI Anda.

---

## 2. Langkah 1: Clone Repositori dari GitHub

Buka terminal (**PowerShell** atau **Git Bash**) di folder tempat Anda ingin menyimpan proyek (misalnya folder `Documents` atau `Projects`):

```bash
# Pindah ke direktori tujuan (contoh: Documents)
cd ~/Documents

# Clone repositori proyek
git clone https://github.com/pandhuuuu/Instan_message.git

# Masuk ke folder proyek
cd Instan_message
```

---

## 3. Langkah 2: Buat File Konfigurasi Lingkungan (`.env`)

Demi keamanan, file `.env` tidak disimpan di GitHub. Anda harus membuatnya secara manual di **folder utama (root)** proyek:

1. Buat file baru bernama `.env` di folder root `Instan_message` (sejajar dengan `package.json`).
   * *Di PowerShell / Command Prompt:*
     ```bash
     notepad .env
     ```
2. Salin dan tempel baris berikut ke dalam file `.env`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/chat-app
JWT_SECRET=chat_app_secret_key_2026
NODE_ENV=development
```

> **Catatan:**
> Jika Anda menggunakan **MongoDB Atlas** (Cloud), ganti nilai `MONGO_URI` dengan connection string Atlas Anda, contoh:
> `MONGO_URI=mongodb+srv://user:password@cluster0.mongodb.net/chat-app?retryWrites=true&w=majority`

Simpan file (`Ctrl + S`) lalu tutup.

---

## 4. Langkah 3: Install Dependensi Proyek (Backend & Frontend)

Aplikasi ini terdiri dari dua bagian (Backend dan Frontend React). Keduanya memerlukan instalasi paket dependensi.

### A. Install Dependensi Backend (Folder Root):
Pastikan Anda berada di folder utama `Instan_message`:
```bash
npm install
```

### B. Install Dependensi Frontend:
Masuk ke folder `frontend` dan jalankan instalasi dependensi:
```bash
cd frontend
npm install --legacy-peer-deps
cd ..
```

> 💡 **Penting:** Parameter `--legacy-peer-deps` wajib digunakan saat menginstall dependensi frontend untuk memastikan kesesuaian library React 17 dan komponen UI.

---

## 5. Langkah 4: Pastikan Database MongoDB Berjalan

Jika menggunakan MongoDB lokal, pastikan servicenya aktif:

* **Di Windows (PowerShell Administrator):**
  ```powershell
  net start MongoDB
  ```
  *(Jika muncul "The requested service has already been started", berarti MongoDB sudah aktif).*

* Atau buka aplikasi **MongoDB Compass** dan klik tombol **Connect** ke `mongodb://localhost:27017`.

---

## 6. Langkah 5: Jalankan Aplikasi (Development Mode)

Untuk menjalankan aplikasi secara penuh, Anda perlu membuka **2 jendela terminal terpisah**:

### 🟢 Terminal 1: Menjalankan Backend Server (API & Socket.io)
Di folder root `Instan_message`:
```bash
npm run server
```
*Output yang berhasil:*
```text
Server running on PORT 5000...
MongoDB Connected: 127.0.0.1
```
*(Backend kini aktif melayani REST API dan koneksi Socket.io di `http://localhost:5000`)*.

---

### 🟢 Terminal 2: Menjalankan Frontend React
Buka jendela terminal baru, lalu masuk ke folder `frontend`:
```bash
cd Instan_message/frontend
npm start
```
*Output yang berhasil:*
```text
Compiled successfully!
You can now view frontend in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```
Browser akan otomatis terbuka menampilkan aplikasi di alamat **`http://localhost:3000`** (atau `http://localhost:3001` jika port 3000 sedang terpakai).

---

## 7. Langkah 6: Verifikasi dengan Automated Tests (44 Skenario)

Sebelum mulai menggunakan, Anda dapat memverifikasi bahwa seluruh endpoint API, autentikasi JWT, sistem keamanan RBAC, dan socket real-time bekerja 100% sempurna dengan menjalankan test suite bawaan:

Buka terminal ketiga di folder root `Instan_message`:
```bash
npm test
```
*Hasil yang diharapkan:*
```text
===================================================================
    INSTANT MESSAGING (IM) SYSTEM COMPREHENSIVE AUTOMATED TESTS    
===================================================================
  Section 1: Security, Auth Middleware & Error Handling (TC 01 - 03) [PASS]
  Section 2: User Registration, Credential Login & Search (TC 04 - 10) [PASS]
  Section 3: 1-on-1 Conversation Management & Idempotency (TC 11 - 13) [PASS]
  Section 4: Messaging, Delivery Status & Deletion RBAC (TC 14 - 20) [PASS]
  Section 5: Per-User Clear Chat & Delete Chat Invariants (TC 21 - 29) [PASS]
  Section 6: Group Chat Lifecycle & RBAC Access Control (TC 30 - 41) [PASS]
  Section 7: Real-Time WebSocket Protocol Verification (TC 42 - 44) [PASS]
===================================================================
  TEST RESULTS SUMMARY: 44 PASSED, 0 FAILED (100% SUCCESS)
===================================================================
```

---

## 8. Langkah 7: Cara Buka dari Laptop / Perangkat Lain (Multi-Device)

Aplikasi ini dapat diakses secara bersamaan oleh laptop lain, tablet, atau smartphone yang berada dalam **satu jaringan Wi-Fi yang sama**:

1. **Cek Alamat IP Laptop Host (Laptop Utama)**:
   Buka Command Prompt di laptop utama:
   ```bash
   ipconfig
   ```
   Cari bagian **Wireless LAN adapter Wi-Fi** ➔ lihat **IPv4 Address** (contoh: `192.168.100.14`).

2. **Buka di Browser Laptop Lain**:
   Buka Chrome/Edge di laptop kedua, lalu ketik:
   ```text
   http://192.168.100.14:3000
   ```
   *(Ganti `192.168.100.14` dengan IP laptop utama Anda)*.

3. **Mulai Chatting**:
   - Di laptop 1, login sebagai `user1` (atau gunakan tab **Quick Connect**).
   - Di laptop 2, login sebagai `user2` (via tab **Quick Connect**).
   - Cari kontak dan mulai kirim pesan secara *real-time*!

---

## 9. Troubleshooting & Solusi Error Umum

### ❌ Masalah 1: Error `opensslErrorStack` atau `digital envelope routines` saat `npm start`
* **Penyebab**: Terjadi pada Node.js versi 17 ke atas karena perubahan konfigurasi kriptografi OpenSSL pada template lama Create React App.
* **Solusi**: Script `frontend/package.json` kami sudah otomatis dilengkapi flag `--openssl-legacy-provider`. Jika Anda menjalankannya manual, pastikan menjalankan via:
  ```bash
  npm start
  ```
  Atau di Windows Command Prompt sebelum start:
  ```cmd
  set NODE_OPTIONS=--openssl-legacy-provider
  npm start
  ```

---

### ❌ Masalah 2: `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`
* **Penyebab**: Layanan MongoDB belum dijalankan di laptop Anda.
* **Solusi**:
  1. Buka PowerShell sebagai Administrator.
  2. Ketik: `net start MongoDB`
  3. Jalankan ulang server backend: `npm run server`

---

### ❌ Masalah 3: Error `EADDRINUSE: address already in use :::5000`
* **Penyebab**: Port 5000 masih digunakan oleh proses Node.js yang berjalan sebelumnya di latar belakang.
* **Solusi (Windows CMD)**:
  ```cmd
  # Cari nomor PID yang memakai port 5000
  netstat -ano | findstr :5000

  # Matikan prosesnya (ganti <PID> dengan angka di kolom paling kanan)
  taskkill /PID <PID> /F
  ```

---

### ❌ Masalah 4: Laptop lain tidak bisa mengakses halaman (Loading terus)
* **Penyebab**: Windows Defender Firewall di laptop utama memblokir koneksi port masuk dari luar.
* **Solusi**:
  1. Buka **Windows Security** ➔ **Firewall & network protection**.
  2. Pastikan tipe jaringan Wi-Fi Anda disetel sebagai **Private network** (bukan Public).
  3. Atau klik **Allow an app through firewall** dan centang izin untuk **Node.js JavaScript Runtime**.

---

### 🎯 Selesai!
Laptop baru Anda kini sudah siap 100% menjalankan sistem Instant Messaging dengan tampilan modern, responsif, dan komunikasi real-time bertenaga WebSockets. Selamat mencoba! 🚀
