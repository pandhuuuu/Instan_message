# Instant Messaging System — Comprehensive Testing Strategy & Test Report

**Deliverables:** Milestone 2 (Testing Strategy) & Milestone 3 (Execution Report)  
**System Under Test:** Instant Messaging Client & Server Application (MERN Stack with WebSockets)  
**Test Suite Coverage:** 100% Full API & Application Surface (44 Automated Tests + 10 Manual GUI Tests)  
**Current Execution Status:** **54 PASSED / 0 FAILED (100% Pass Rate)**

---

## 1. Overview & Test Architecture

Strategi pengujian sistem mengadopsi prinsip **Testing Pyramid** dengan pemisahan yang jelas antara pengujian level protokol backend (*Automated Integration & API Tests*) dan pengujian pengalaman pengguna antarmuka (*Manual End-to-End GUI Tests*).

```
          / \
         /   \      Manual End-to-End GUI Tests (10 Test Cases)
        / GUI \     - Multi-Browser Incognito Verification
       /-------\    - Presence Badges, Typing Bubbles, Modal Dialogs
      /         \
     / Automated \  Automated Integration & Protocol Tests (44 Test Cases)
    / Integration \ - REST Endpoints, Database Atomic Updates, RBAC Security
   /_______________\- Live WebSocket Handshake, Typing & Instant Message Events
```

### Klasifikasi Tipe Pengujian:
1. **Positive Testing (`[Positive]` — 33 Kasus)**:
   * Menguji alur kerja normal (*happy path*) di mana input valid dan pengguna memiliki hak akses sah.
   * Bertujuan memverifikasi bahwa fitur berfungsi sesuai spesifikasi (`200 OK`, `201 Created`).
2. **Negative Testing (`[Negative]` — 11 Kasus)**:
   * Menguji ketahanan sistem dengan sengaja memasukkan input tidak valid, data kosong, token palsu, atau mencoba melakukan aksi terlarang (pelanggaran hak akses RBAC).
   * Bertujuan memverifikasi bahwa sistem menolak dengan tegas (`400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`) dan tidak mengalami kebocoran data atau *crash*.

---

## 2. Automated Test Suite Specification & Results

Suite pengujian otomatis diimplementasikan secara mandiri pada [`backend/tests/run_tests.js`](file:///c:/Users/athal/Documents/mern-chat-app/backend/tests/run_tests.js) tanpa bergantung pada browser. Seluruh 44 kasus uji otomatis dieksekusi dalam waktu **~3.5 detik**.

### Matriks Pengujian Otomatis (TC-01 s/d TC-44)

| Test ID | Tipe Pengujian | Modul & Skenario | Method & Endpoint | Ekspektasi Invarian / Hasil | Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **TC-01** | **[Negative]** | **Missing Auth Token** | `GET /api/chat` | Ditolak `401 Unauthorized` ("Not authorized, no token") | **PASS** |
| **TC-02** | **[Negative]** | **Invalid/Forged Token** | `GET /api/chat` | Ditolak `401 Unauthorized` ("Not authorized, token failed") | **PASS** |
| **TC-03** | **[Negative]** | **Non-Existent Route** | `GET /api/nonexistent-route` | Ditolak `404 Not Found` oleh error middleware | **PASS** |
| **TC-04** | **[Positive]** | **User Registration** | `POST /api/user` | `201 Created` + Password di-hash Bcrypt + JWT token valid | **PASS** |
| **TC-05** | **[Negative]** | **Duplicate Username** | `POST /api/user` | Ditolak `400 Bad Request` ("Username is already taken") | **PASS** |
| **TC-06** | **[Positive]** | **Credential Login** | `POST /api/user/login` | `200 OK` + Penerbitan JWT session token | **PASS** |
| **TC-07** | **[Negative]** | **Wrong Password** | `POST /api/user/login` | Ditolak `401 Unauthorized` ("Invalid username or password") | **PASS** |
| **TC-08** | **[Positive]** | **Quick Connect Users** | `POST /api/user/quick-connect` | `200 OK` + Sesi instan Alice, Bob, Charlie | **PASS** |
| **TC-09** | **[Negative]** | **Empty Username** | `POST /api/user/quick-connect` | Ditolak `400 Bad Request` ("Please enter a username") | **PASS** |
| **TC-10** | **[Positive]** | **User Directory Search** | `GET /api/user?search=` | `200 OK` + Menampilkan hasil pencarian, mengecualikan diri sendiri | **PASS** |
| **TC-11** | **[Positive]** | **Create 1-on-1 Chat** | `POST /api/chat` | `200 OK` + Chat ID terbentuk dengan 2 partisipan | **PASS** |
| **TC-12** | **[Positive]** | **Chat Idempotency** | `POST /api/chat` | `200 OK` + Mengembalikan Chat ID yang sama tanpa membuat duplikat | **PASS** |
| **TC-13** | **[Positive]** | **Fetch Chat List** | `GET /api/chat` | `200 OK` + Daftar chat lengkap dengan metadata & unread count | **PASS** |
| **TC-14** | **[Positive]** | **Send Message** | `POST /api/message` | `200 OK` + Pesan tersimpan persisten di MongoDB | **PASS** |
| **TC-15** | **[Positive]** | **Fetch History** | `GET /api/message/:chatId` | `200 OK` + Penerima melihat pesan yang dikirimkan | **PASS** |
| **TC-16** | **[Positive]** | **Mark Delivered** | `PUT /api/message/delivered` | `200 OK` + Array `deliveredTo` diperbarui massal | **PASS** |
| **TC-17** | **[Positive]** | **Atomic Read Receipt** | `PUT /api/message/read/:chatId` | `200 OK` + `readBy` dan `deliveredTo` terupdate secara atomik | **PASS** |
| **TC-18** | **[Negative]** | **Delete Other's Message** | `DELETE /api/message/:msgId` | Ditolak `403 Forbidden` (Bob dilarang menghapus pesan Alice) | **PASS** |
| **TC-19** | **[Positive]** | **Delete Single Message** | `DELETE /api/message/:msgId` | `200 OK` + Pengirim menghapus pesan untuk semua orang | **PASS** |
| **TC-20** | **[Positive]** | **Verify Deleted Message** | `GET /api/message/:chatId` | `200 OK` + Pesan yang dihapus tidak lagi ada di riwayat | **PASS** |
| **TC-21** | **[Positive]** | **Alice Clear Chat** | `DELETE /api/message/clear/:id` | `200 OK` + Soft clear riwayat khusus untuk akun Alice | **PASS** |
| **TC-22** | **[Positive]** | **Invariant: Alice Empty** | `GET /api/message/:chatId` | `200 OK` + Riwayat pesan Alice bersih (0 pesan) | **PASS** |
| **TC-23** | **[Positive]** | **Invariant: Bob Intact** | `GET /api/message/:chatId` | `200 OK` + Riwayat pesan Bob tetap 100% utuh dan terbaca | **PASS** |
| **TC-24** | **[Positive]** | **Alice Delete Chat** | `DELETE /api/chat/:chatId` | `200 OK` + Chat disembunyikan untuk akun Alice | **PASS** |
| **TC-25** | **[Positive]** | **Invariant: Hidden from Alice** | `GET /api/chat` | `200 OK` + Chat tidak lagi muncul di daftar chat Alice | **PASS** |
| **TC-26** | **[Positive]** | **Invariant: Visible to Bob** | `GET /api/chat` | `200 OK` + Chat tetap muncul normal di daftar chat Bob | **PASS** |
| **TC-27** | **[Positive]** | **Reopen Starts Clean** | `POST /api/chat` | `200 OK` + Alice membuka kembali chat dengan 0 pesan lama | **PASS** |
| **TC-28** | **[Positive]** | **Revival on New Message** | `GET /api/chat` | `200 OK` + Pesan baru dari Bob memunculkan kembali chat di Alice | **PASS** |
| **TC-29** | **[Positive]** | **Segmented Invariant** | `GET /api/message/:chatId` | Alice hanya melihat 1 pesan baru, Bob melihat seluruh pesan | **PASS** |
| **TC-30** | **[Negative]** | **Group Too Few Members** | `POST /api/chat/group` | Ditolak `400 Bad Request` saat anggota < 2 orang | **PASS** |
| **TC-31** | **[Positive]** | **Create Group Chat** | `POST /api/chat/group` | `200 OK` + `isGroupChat: true`, Alice sebagai Primary Owner | **PASS** |
| **TC-32** | **[Positive]** | **Owner Renames Group** | `PUT /api/chat/rename` | `200 OK` + Nama grup berhasil diubah di database | **PASS** |
| **TC-33** | **[Negative]** | **Member Rename Denied** | `PUT /api/chat/rename` | Ditolak `403 Forbidden` (Anggota biasa dilarang ganti nama) | **PASS** |
| **TC-34** | **[Positive]** | **Promote Co-Admin** | `PUT /api/chat/groupadmin/promote` | `200 OK` + Bob diangkat menjadi Co-Admin grup | **PASS** |
| **TC-35** | **[Positive]** | **Co-Admin Adds Member** | `PUT /api/chat/groupadd` | `200 OK` + Co-Admin Bob menambahkan Dave ke grup | **PASS** |
| **TC-36** | **[Negative]** | **Member Add Denied** | `PUT /api/chat/groupadd` | Ditolak `403 Forbidden` (Anggota biasa dilarang tambah orang) | **PASS** |
| **TC-37** | **[Positive]** | **Demote Co-Admin** | `PUT /api/chat/groupadmin/demote` | `200 OK` + Bob didemosi kembali menjadi anggota biasa | **PASS** |
| **TC-38** | **[Negative]** | **Demoted Rights Revoked** | `PUT /api/chat/rename` | Ditolak `403 Forbidden` (Bob tidak lagi punya hak admin) | **PASS** |
| **TC-39** | **[Positive]** | **Admin Removes Member** | `PUT /api/chat/groupremove` | `200 OK` + Admin berhasil mengeluarkan Dave dari grup | **PASS** |
| **TC-40** | **[Positive]** | **Member Leaves Group** | `PUT /api/chat/groupremove` | `200 OK` + Charlie keluar grup secara sukarela (*self-leave*) | **PASS** |
| **TC-41** | **[Positive]** | **Audit System Messages** | `GET /api/message/:groupId` | `200 OK` + Log mutasi grup tercatat (`isSystemMessage: true`) | **PASS** |
| **TC-42** | **[Positive]** | **Socket Handshake** | WebSocket Event `setup` | `200 OK` + Socket bergabung ke room user privat | **PASS** |
| **TC-43** | **[Positive]** | **Live Typing Event** | WebSocket Event `typing` | Sinyal mengetik diterima secara real-time oleh lawan bicara | **PASS** |
| **TC-44** | **[Positive]** | **Live Instant Message** | WebSocket Event `new message` | Event `message recieved` tiba seketika pada socket penerima | **PASS** |

---

## 3. Manual End-to-End GUI Test Matrix (Milestone 3 Report)

Pengujian manual antarmuka grafis dieksekusi pada browser ganda (*Google Chrome Normal* vs *Google Chrome Incognito*) di alamat `http://localhost:3000`:

| Test ID | Skenario UI & Fungsional | Langkah Pengujian | Perilaku Teramati di GUI | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-MAN-01** | **Server IP & Port Configuration** | Buka dialog Server Config $\to$ ubah port $\to$ simpan. | Modal menyimpan konfigurasi ke `localStorage`, base URL dinamis. | **PASS** |
| **TC-MAN-02** | **Quick IM Login (No Auth)** | Tab "Quick IM" $\to$ username `alice_test` $\to$ Join. | Langsung masuk tanpa password, session tersimpan, redirect ke `/chats`. | **PASS** |
| **TC-MAN-03** | **Active Users Real-Time Presence** | Alice & Bob login di dua window berbeda. | Bob langsung muncul di tab Active Users dengan badge hijau menyala. | **PASS** |
| **TC-MAN-04** | **1-Click Direct Chat Spawn** | Di tab Active Users, klik tombol "Chat" pada Bob. | Jendela obrolan 1-on-1 langsung terbuka tanpa jeda (*zero reload*). | **PASS** |
| **TC-MAN-05** | **Real-Time Message Delivery** | Alice mengirim teks ke Bob saat keduanya online. | Pesan muncul instan di layar Bob; centang di Alice menjadi ganda abu-abu (`✓✓`). | **PASS** |
| **TC-MAN-06** | **Read Receipt Synchronization** | Bob membuka jendela obrolan Alice. | Centang di layar Alice berubah biru/cyan (`✓✓`) secara real-time. | **PASS** |
| **TC-MAN-07** | **Multiple Simultaneous Conversations** | Alice membuka grup sambil mengobrol dengan Bob. | Pesan masuk di grup memicu badge angka hijau tanpa mengganggu chat Bob. | **PASS** |
| **TC-MAN-08** | **Real-Time Typing Indicators** | Bob mengetik di kotak pesan tanpa mengirim. | Tiga titik animasi bubble mengetik muncul di Alice dan hilang saat idle. | **PASS** |
| **TC-MAN-09** | **Idle & Away State Transitions** | Tab browser diminimalkan atau tidak ada aktivitas 2 menit. | Dot indikator status berubah dari hijau (Online) ke kuning/oranye (Away). | **PASS** |
| **TC-MAN-10** | **Group Chat Lifecycle & Audit Trail** | Buat grup, undang anggota, anggota keluar grup. | Grup terbentuk; saat anggota keluar, muncul pesan sistem `"User left the group"`. | **PASS** |

---

## 4. Cara Menjalankan Pengujian (Reproduction Guide)

### 1. Menjalankan Automated Test Suite:
```powershell
# Dari root direktori mern-chat-app
npm test
# atau: node backend/tests/run_tests.js
```
Output terminal akan memvalidasi ke-44 test case dengan ringkasan:
`TEST RESULTS SUMMARY: 44 PASSED, 0 FAILED (100%)`.

### 2. Mengenerate Laporan Dokumen Word Resmi:
```powershell
python backend/scripts/generate_word_docs.py
```
Menghasilkan dokumen resmi format Word di:
`docs/Testing_Strategy_and_Critical_Risk_Analysis.docx`.
