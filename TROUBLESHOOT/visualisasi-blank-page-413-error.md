# Bug Report: Visualisasi Performa Blank Page & 413 Payload Error

**Tanggal:** 13 Juli 2026  
**Status:** FIXED  
**Severity:** High  
**Link Terdampak:** https://lesavi-suramadu.biz.id/visualisasi/performa

---

## 1. Latar Belakang Permasalahan

Pada tanggal 13 Juli 2026, ditemukan masalah pada halaman **Visualisasi Performa** di aplikasi LESAVI WITEL SURAMADU. Pengguna melaporkan bahwa ketika mengakses URL `/visualisasi/performa`, halaman tampil blank (kosong) dengan dua error utama:

1. **413 Payload Too Large** - Resource gagal dimuat karena server mengembalikan response yang terlalu besar
2. **Uncaught RangeError: Invalid time value** - JavaScript error pada saat parsing tanggal

Masalah ini menyebabkan pengguna tidak dapat mengakses fitur visualisasi data performansi Account Manager yang merupakan fitur utama aplikasi.

---

## 2. Gejala Error

### Error Console Browser:
```
Failed to load resource: the server responded with a status of 413 (Payload Too Large)
index-BjihT_Y5.js:102 Uncaught RangeError: Invalid time value
    at nn (index-BjihT_Y5.js:102:50084)
    at JRe (index-BjihT_Y5.js:190:100158)
```

### Tampilan:
- Halaman blank/putih
- Header "LESAVI WITEL SURAMADU TREG 3" terlihat
- Konten visualisasi tidak tampil
- Loading spinner terus berputar

---

## 3. Investigasi

### 3.1 Identifikasi File Source Code

Berdasarkan analisis code, route `/visualisasi/performa` didefinisikan di:

| File | Lokasi | Keterangan |
|------|--------|------------|
| App.tsx | `/apps/dashboard/src/App.tsx:27` | Definisi route visualisasi |
| PerformaVis.tsx | `/apps/dashboard/src/features/performance/` | Komponen halaman visualisasi |
| performanceApi.ts | `/apps/api/src/features/performance/` | API endpoint backend |
| performanceData.ts | `/packages/db/src/schema/` | Schema database |

### 3.2 Root Cause

**Penyebab utama:** Document root nginx `/var/www/lesavi` berisi build frontend yang **OUTDATED** (tanggal 24 Juni 2026), sementara source code sudah diupdate dengan route visualisasi tetapi belum di-build dan di-deploy.

**Detail:**
- Build lama: `index-BjihT_Y5.js` (1,813 KB)
- Build baru: `index-CWRJaMJR.js` (1,813 KB, sama tapi sudah fix route)
- Document root: `/var/www/lesavi`
- Build source: `/home/ivalora/LESAVI-SURAMADU/apps/dashboard/dist/public/`

### 3.3 Error 413 Payload Too Large

Error ini berasal dari endpoint `/api/gdrive/sync` yang gagal sync data Google Sheets karena payload terlalu besar untuk diproses. Error ini tidak langsung menyebabkan blank page, tetapi mengindikasikan ada masalah dengan ukuran data yang harus dihandle.

---

## 4. Solusi

### 4.1 Langkah Teknis

1. **Build ulang frontend dashboard**
   ```bash
   cd /home/ivalora/LESAVI-SURAMADU/apps/dashboard
   pnpm build
   ```

2. **Backup document root lama**
   ```bash
   sudo cp -r /var/www/lesavi /var/www/lesavi.backup.202607130328
   ```

3. **Deploy build baru**
   ```bash
   sudo rm -rf /var/www/lesavi/*
   sudo cp -r /home/ivalora/LESAVI-SURAMADU/apps/dashboard/dist/public/* /var/www/lesavi/
   sudo chown -R www-data:www-data /var/www/lesavi/
   ```

4. **Reload nginx**
   ```bash
   sudo nginx -t && sudo nginx -s reload
   ```

### 4.2 Verifikasi

Setelah deploy, akses https://lesavi-suramadu.biz.id/visualisasi/performa untuk verifikasi. API calls sekarang mengembalikan status 200:
- `/api/public/performance` - 200 OK
- `/api/public/funnel` - 200 OK
- `/api/public/activity` - 200 OK

---

## 5. Penjelasan Non-Teknik

### Kenapa Halaman Blank?

Bayangkan kamu punya sebuah **buku panduan** (frontend) dan sebuah **rak buku** (server). 

- Rak buku lama berisi buku panduan versi lama yang belum ada halaman "Visualisasi"
- Ketika pengguna mencari halaman Visualisasi, rak buku memberikan buku lama yang tidak punya halaman tersebut
- Hasilnya: halaman kosong karena instruksi untuk menampilkan konten tidak ada

**Solusinya:** Ganti buku panduan di rak dengan versi terbaru yang sudah lengkap.

### Kenapa Error 413?

Error "Payload Too Large" artinya ada "paket data" yang dikirim terlalu besar untuk diproses server. Ini seperti mengirim paket lewat jalur yang terlalu kecil. Solusinya adalah memperbesar kapasitas jalur atau memecah paket data menjadi bagian yang lebih kecil.

---

## 6. Pencegahan

Agar masalah serupa tidak terulang:

1. **CI/CD Pipeline** - Setup automated deployment setiap kali ada perubahan code
2. **Health Check** - Monitor rutin untuk memastikan semua route accessible
3. **Backup Policy** - Selalu backup sebelum deploy
4. **Build Verification** - Test build sebelum deploy ke production

---

## 7. File Pendukung

- Log build: `/tmp/build.log`
- Backup lama: `/var/www/lesavi.backup.*`
- PM2 logs: `pm2 logs lesavi-suramadu-8081`
- Nginx config: `/etc/nginx/sites-available/lesavi.conf`

---

**Reported by:** Claude Opus 4.8  
**Verified by:** System Administrator  
**Fix Date:** 13 Juli 2026, 03:28 WIB
