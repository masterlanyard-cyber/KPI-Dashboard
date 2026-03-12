# Dashboard P&L

Aplikasi dashboard Profit & Loss (P&L) berbasis web, dapat dijalankan dan diedit di komputer manapun.

## Fitur
- Frontend: React (folder `frontend`)
- Backend: Node.js/Express (folder `backend`)
- Database: SQLite (otomatis dibuat saat pertama kali dijalankan)
- Data utama dari Google Sheets
- **Autentikasi pengguna** (register & login dengan JWT)
- **Input data P&L manual** (form input Revenue, COGS, Gross Profit, OPEX, Net Profit)
- Data Quality checker otomatis
- Mudah di-clone, edit, dan dijalankan di mana saja

## Cara Menjalankan di Komputer Baru

1. **Clone repo:**
   ```
   git clone <url-repo-anda>
   cd KPI-Dashboard
   ```
2. **Install dependensi:**
   ```
   cd frontend
   npm install
   cd ../backend
   npm install
   ```
3. **Jalankan backend:**
   ```
   cd backend
   npm start
   ```
4. **Jalankan frontend:**
   ```
   cd ../frontend
   npm start
   ```
5. **Akses dashboard:**
   Buka browser ke http://localhost:3000

## Autentikasi

Sebelum menggunakan dashboard, pengguna harus **daftar akun** (Register) lalu **masuk** (Login).

- Registrasi: klik "Daftar sekarang" di halaman login
- Login: masukkan username dan password
- Setelah login, dashboard dan fitur input data P&L dapat diakses

## Input Data P&L

Setelah login, klik tombol **"📝 Input Data P&L"** di pojok kanan atas untuk membuka halaman input data.

Di halaman ini Anda dapat:
- Menambah data P&L baru per bulan/tahun
- Mengedit data yang sudah ada
- Menghapus data
- Gross Profit dan Net Profit dihitung otomatis berdasarkan input

### Kolom yang tersedia:
| Kolom | Keterangan |
|-------|-----------|
| Revenue | Pendapatan / penjualan |
| COGS | Cost of Goods Sold |
| Gross Profit | Revenue - COGS (auto) |
| OPEX | Biaya operasional |
| Net Profit | Gross Profit - OPEX + Other Income (auto) |
| Other Income | Pendapatan/beban lain-lain |
| Catatan | Keterangan tambahan |

## Variabel Lingkungan (Opsional)

Buat file `.env` di folder `backend/` untuk konfigurasi:

```
PORT=4000
JWT_SECRET=ganti-dengan-secret-key-yang-kuat
ALLOWED_ORIGINS=http://localhost:3000
```

> **Penting:** Jangan upload file `.env` ke repositori publik!

## Struktur Folder
- `frontend/` : React app (UI dashboard)
- `backend/`  : Node.js/Express API + SQLite database
- `*.csv`     : Template data untuk import

## Catatan
- Database SQLite dibuat otomatis di `backend/dashboard_pnl.sqlite`
- Untuk deploy online, bisa gunakan Vercel/Netlify (frontend) dan Railway/Render (backend)

---

**Edit kode, commit, dan push ke repo untuk kolaborasi di mana saja!**
