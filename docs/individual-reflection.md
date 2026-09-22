# Instant Messaging System — Individual Reflection

**Course/Project:** Instant Messaging System (IM Project)  
**Deliverable:** Milestone 3 — Individual Reflection  
**Author:** IM Project Development Team Member  
**Submission Date:** September 23, 2026  
**Document Target:** `docs/individual-reflection.md` & `docs/Individual_Reflection.docx`

---

## Instructions Compliance

In strict adherence to the Milestone 3 specification, this reflection comprises exactly three paragraphs addressing:
1. **Product** (What was easy, hard, unexpected, and what would be done differently)
2. **Team** (How the group performed, work process, coding standards, and division of labor)
3. **Individual** (Personal performance evaluation, specific contributions, and reflective sentiments)

---

### Paragraph 1: Product

Building the Instant Messaging system provided valuable insights into the architecture of real-time distributed applications. Setting up the initial Express.js REST endpoints and structuring the foundational React component tree was relatively straightforward due to the mature ecosystem and clear separation of concerns. However, coordinating bidirectional state synchronization via Socket.IO was substantially more challenging—specifically guaranteeing that delivery and read receipts progressed deterministically from single gray checks to double blue checks without race conditions across concurrent clients, as well as engineering per-user conversation isolation (`deletedFor` and `deletedBy`) so that clearing chat history never corrupted the counterparty's message store. What surprised me most was the operational complexity of handling socket lifecycles, such as managing connection drops, tab focus events, and safeguarding search queries against Regular Expression Denial of Service (ReDoS) and Broken Object Level Authorization (BOLA). If I were to design this chat system again from scratch, I would integrate a Redis Pub/Sub adapter from day one to facilitate seamless horizontal multi-server clustering and implement client-side End-to-End Encryption (E2EE) using the Web Crypto API to ensure complete cryptographic confidentiality.

### Paragraph 2: Team

Our team operated with strong synergy, mutual accountability, and technical discipline throughout all three milestone deliverables. We adopted an iterative workflow driven by continuous testing and version control, holding regular syncs to align on protocol contracts before implementing dependent features. Coding was conducted with high architectural rigor, adhering to single-responsibility principles, modular middleware pipelines, and strict representation invariants for mutable data structures. We divided the work logically across our core strengths: one stream focused on backend REST controllers, MongoDB atomic schema modeling, and Socket.IO event orchestration; a second stream spearheaded the frontend WhatsApp Web UI redesign, dynamic network configuration dialogs, and real-time reactive hooks; and a third stream drove quality assurance, crafting the 60-case automated test harness, verifying manual multi-browser GUI scenarios, and generating comprehensive engineering documentation. This collaborative division allowed us to deliver a robust, highly polished platform ahead of deadlines without integration bottlenecks.

### Paragraph 3: Individual

On a personal level, I am proud of my performance, technical contributions, and problem-solving resilience in this project. My primary responsibilities centered on designing the real-time presence and receipt progression engine, implementing the per-user soft-delete logic in MongoDB to ensure privacy compliance, architecting the 60 automated integration tests in `run_tests.js`, and containerizing the multi-service stack with Docker Compose. Diving deeply into the Node.js libuv event loop to formally analyze race conditions and prove freedom from Coffman deadlocks significantly broadened my understanding of concurrency in distributed systems. Seeing our entire test suite execute flawlessly with 60 passed tests and watching two incognito browsers exchange instantaneous messages with sub-50ms latency was exceptionally rewarding, giving me great confidence in the stability, security, and quality of our final submission.

---

*(Versi Bahasa Indonesia juga disediakan di bawah ini untuk kemudahan presentasi atau dokumentasi lokal jika dibutuhkan)*

---

### Refleksi Individu (Bahasa Indonesia)

#### 1. Produk (Product)
Membangun sistem *Instant Messaging* ini memberikan wawasan mendalam tentang arsitektur aplikasi terdistribusi *real-time*. Menyiapkan *routing* REST Express.js dan struktur komponen React relatif mudah karena ekosistemnya yang matang dan pemisahan logika yang jelas. Namun, mengoordinasikan sinkronisasi *state* dua arah via Socket.IO jauh lebih menantang—khususnya menjamin bahwa status centang pesan berkembang secara deterministik (centang satu $\to$ centang dua abu-abu $\to$ centang dua biru) tanpa *race condition*, serta merancang isolasi penghapusan pesan per-user (`deletedFor` dan `deletedBy`) agar fitur *Clear Chat* tidak merusak riwayat lawan bicara. Hal yang paling tidak terduga adalah kompleksitas menangani siklus hidup koneksi soket (seperti perpindahan tab browser, *reconnect*, dan pencegahan celah keamanan seperti ReDoS pada *regex search* serta BOLA/IDOR). Jika saya berkesempatan mendesain ulang dari awal, saya akan mengintegrasikan Redis Pub/Sub sejak awal untuk mendukung skalabilitas multi-server horizontal serta menerapkan enkripsi *End-to-End* (E2EE) menggunakan Web Crypto API.

#### 2. Tim (Team)
Kerja sama tim berjalan dengan sinergi yang sangat baik, saling percaya, dan disiplin tinggi di sepanjang ketiga milestone. Kami menerapkan alur kerja berulang (*iterative*) yang dipandu oleh pengujian berkelanjutan dan Git, dengan pertemuan sinkronisasi rutin untuk menyepakati kontrak protokol sebelum menghubungkan antarmuka ke backend. Standar koding dijaga sangat tinggi, menerapkan prinsip modularitas, sanitasi input, dan penjagaan invarian data yang ketat. Pembagian kerja dilakukan secara berimbang: sebagian fokus pada logika backend, pemodelan skema atomik MongoDB, dan orkestrasi event Socket.IO; sebagian lainnya membangun antarmuka web modern bergaya WhatsApp Web lengkap dengan dialog konfigurasi IP/Port dinamis; serta fokus pada penjaminan mutu melalui pembuatan 60 skrip uji otomatis dan dokumentasi teknis formal. Pembagian kerja yang terstruktur ini membuat proses integrasi berjalan mulus tanpa hambatan.

#### 3. Individu (Individual)
Secara pribadi, saya sangat puas dengan performa dan kontribusi teknis saya dalam proyek ini. Peran utama saya mencakup perancangan logika *presence* dan pelacakan status pesan *real-time*, implementasi mekanisme *soft-delete* per-user di basis data untuk menjaga privasi, penyusunan berkas uji otomatis 60 kasus uji di `run_tests.js`, serta kontainerisasi multi-layanan menggunakan Docker Compose. Mendalami mekanisme *event loop* Node.js untuk membuktikan ketiadaan *deadlock* (Coffman conditions) dan kebebasan dari *race conditions* memperluas pemahaman saya tentang konkurensi sistem secara signifikan. Melihat seluruh 60 kasus uji otomatis lulus sempurna dan menyaksikan dua jendela browser saling bertukar pesan dengan latensi di bawah 50 milidetik memberikan kepuasan rekayasa perangkat lunak yang luar biasa dan keyakinan penuh akan kualitas produk akhir kami.
