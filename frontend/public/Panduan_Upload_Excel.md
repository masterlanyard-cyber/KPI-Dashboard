# Panduan Upload Data ke Dashboard P&L

Selamat datang di Dashboard P&L! Berikut langkah-langkah untuk meng-upload file agar data langsung tampil di dashboard:

## 1. Siapkan File
- Pastikan file Anda sesuai template yang disediakan (lihat file template di halaman dashboard atau folder project).
- Format file yang didukung: **.xlsx**, **.csv**, atau **.pdf**

## 2. Buka Dashboard
- Jalankan aplikasi (frontend & backend) di komputer Anda.
- Buka browser dan akses: `http://localhost:3000` (atau alamat sesuai instruksi admin).

## 3. Upload File
- Cari tombol **Upload Data** di bagian atas dashboard.
- Klik tombol tersebut, lalu pilih file Excel/CSV/PDF dari komputer Anda.
- Setelah file dipilih, dashboard akan otomatis memproses dan menampilkan data.

## 4. Cek Data
- Data dari file akan langsung muncul di tabel, grafik, atau panel dashboard.
- Jika data tidak muncul, pastikan format file sudah benar dan sesuai template.

## 5. Upload PDF
- PDF yang berisi **tabel teks** (bukan gambar/scan) dapat diekstrak datanya secara otomatis.
- Baris pertama tabel dalam PDF akan digunakan sebagai header kolom.
- PDF hasil scan (gambar) **tidak didukung** — gunakan PDF yang berisi teks yang dapat dipilih/dicopy.
- Koneksi internet diperlukan saat pertama kali menggunakan fitur upload PDF (untuk memuat worker PDF dari CDN).

## 6. Tips & Troubleshooting
- Jika upload gagal, cek pesan error di dashboard.
- Pastikan kolom dan header di file Excel/CSV sesuai dengan template.
- Untuk update data, cukup upload file baru (data akan diganti sesuai file terakhir yang di-upload).
- Jika PDF tidak terbaca, coba konversi ke format Excel atau CSV terlebih dahulu untuk hasil terbaik.

## 7. FAQ
- **Apakah file lama akan hilang?**
  Ya, data akan diganti dengan file terakhir yang di-upload.
- **Bisa upload dari HP?**
  Bisa, asalkan dashboard diakses dari browser HP dan file tersedia di perangkat.
- **Format apa yang paling direkomendasikan?**
  Excel (.xlsx) atau CSV untuk akurasi data terbaik. PDF didukung untuk kemudahan, namun hasil ekstraksi bergantung pada struktur PDF.

---

Jika ada kendala, hubungi admin atau cek dokumentasi lebih lanjut di README project.
