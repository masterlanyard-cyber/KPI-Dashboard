# Dashboard P&L

Aplikasi dashboard Profit & Loss (P&L) berbasis web, dapat dijalankan dan diedit di komputer manapun.

## Fitur
- Frontend: React (folder `frontend`)
- Backend: Node.js/Express (folder `backend`)
- Data utama dari Google Sheets
- Data Quality checker otomatis
- Mudah di-clone, edit, dan dijalankan di mana saja

## Cara Menjalankan di Komputer Baru

1. **Clone repo:**
   ```
   git clone <url-repo-anda>
   cd Dashboard PNL
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

## Struktur Folder
- `frontend/` : React app
- `backend/`  : Node.js/Express API
- `*.csv`     : Template data

## Catatan
- Pastikan file .env (jika ada) tidak diupload ke repo publik.
- Untuk deploy online, bisa gunakan Vercel/Netlify (frontend) dan Railway/Render (backend).

---

**Edit kode, commit, dan push ke repo untuk kolaborasi di mana saja!**
