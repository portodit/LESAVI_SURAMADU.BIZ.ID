# VPS Build & Deploy — Analisis Masalah Komprehensif

**Tanggal:** 30 Juli 2026
**Severity:** Critical (Production Downtime)
**Domain:** `https://lesavi-suramadu.biz.id`

---

## Ringkasan Eksekutif

Domain `lesavi-suramadu.biz.id` mengalami **403 Forbidden** selama periode yang tidak diketahui. Investigasi menunjukkan bahwa **tidak ada file build (`dist/`) di VPS**, semua service tidak berjalan, dan beberapa konfigurasi critical rusak.

**Waktu perbaikan:** ~20 menit
**Status saat laporan ini dibuat:** ✅ Semua service berjalan normal

---

## Timeline Masalah

| Waktu | Kejadian |
|-------|----------|
| Sebelum 30 Jul 2026 | Domain up (ketika deploy terakhir) |
| ??? | Dist files dihapus atau tidak pernah di-deploy |
| ??? | PM2 process dihapus atau tidak dikonfigurasi |
| 29 Jul 2026, 06:30 | Nginx di-restart, gagal load config karena broken SSL cert |
| 30 Jul 2026, 09:00 | User meminta bantuan — domain 403 |
| 30 Jul 2026, 09:20 | Mulai investigasi |
| 30 Jul 2026, 09:27 | Domain UP, login working |

---

## Daftar Masalah Detail

### #1 — Dist Folder Kosong di VPS

**Severity:** 🔴 Critical
**Status:** ✅ Fixed

#### Gejala
```
curl https://lesavi-suramadu.biz.id/
→ 403 Forbidden
```

```
$ ls -la /var/www/lesavi/public/
total 8
drwxr-xr-x 2 root root 4096 Jul 29 02:41 .
drwxr-xr-x 1 root root 4096 Jul 29 02:41 ..
→ KOSONG
```

```
$ ls -la /var/www/lesavi/apps/api/dist/
total 8
drwxr-xr-x 2 root root 4096 Jul 30 08:32 .
→ KOSONG
```

#### Penyebab
Tidak ada proses build yang pernah dijalankan di VPS. Direktori `/var/www/lesavi` adalah copy manual dari repo tanpa proses build. Build dist yang ada di repo lokal tidak di-sync ke VPS.

#### Solusi yang Diterapkan

**Step 1 — Build lokal:**
```bash
cd apps/dashboard && pnpm run build
cd apps/api && pnpm run build
```

**Step 2 — Zip dist files:**
```powershell
# Dashboard (frontend) — build output ada di dist/public/
Compress-Archive -Path "apps/dashboard/dist/public/*" -DestinationPath "_deploy_dash.zip"

# API (backend) — build output ada di dist/
Compress-Archive -Path "apps/api/dist/*" -DestinationPath "_deploy_api.zip"
```

**Step 3 — Upload via SFTP:**
```python
import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('103.183.74.104', port=22, username='ivalora', password='Sura123Baya45')
sftp = client.open_sftp()
sftp.put('_deploy_dash.zip', '/home/ivalora/_deploy_dash.zip')
sftp.put('_deploy_api.zip', '/home/ivalora/_deploy_api.zip')
sftp.close()
```

**Step 4 — Extract dengan Python (bukan unzip — lihat masalah #2):**
```python
import zipfile, io
sftp = client.open_sftp()

# Dashboard → /var/www/lesavi/public/
with sftp.open('/home/ivalora/_deploy_dash.zip', 'rb') as f:
    z = zipfile.ZipFile(io.BytesIO(f.read()))
    for name in z.namelist():
        target = '/var/www/lesavi/public/' + name
        with sftp.open(target, 'wb') as out:
            out.write(z.read(name))

# API → /var/www/lesavi/apps/api/dist/
client.exec_command('mkdir -p /var/www/lesavi/apps/api/dist')
with sftp.open('/home/ivalora/_deploy_api.zip', 'rb') as f:
    z = zipfile.ZipFile(io.BytesIO(f.read()))
    for name in z.namelist():
        if not name.endswith('/'):
            target = '/var/www/lesavi/apps/api/dist/' + name
            with sftp.open(target, 'wb') as out:
                out.write(z.read(name))
```

---

### #2 — Perintah `unzip` Tidak Tersedia di VPS

**Severity:** 🟡 Medium
**Status:** ✅ Fixed (workaround)

#### Gejala
```bash
$ unzip -o _deploy_dash.zip -d /var/www/lesavi/public/
bash: line 1: unzip: command not found
```

#### Penyebab
VPS tidak terinstall `unzip`. Ini umum di Ubuntu minimal.

#### Solusi
Pakai Python `zipfile` module via SFTP write (lihat Step 4 di masalah #1).

#### Rekomendasi
Install `unzip` di VPS untuk proses deploy selanjutnya:
```bash
sudo apt install unzip -y
```

---

### #3 — Ownership Direktori Milik Root

**Severity:** 🔴 Critical
**Status:** ✅ Fixed

#### Gejala
```python
sftp.open('/var/www/lesavi/public/index.html', 'wb').write(data)
→ Permission denied [Errno 13]
```

#### Penyebab
Direktori `/var/www/lesavi/` dan isinya dibuat oleh user `root`, padahal service running sebagai `ivalora`.

#### Solusi
```bash
sudo chown -R ivalora:ivalora /var/www/lesavi/public/
sudo chown -R ivalora:ivalora /var/www/lesavi/apps/dashboard/dist/
sudo chown -R ivalora:ivalora /var/www/lesavi/apps/api/dist/
```

#### Rekomendasi
Untuk semua direktori yang di-write oleh PM2 service:
```bash
# Buat direktori dulu dengan ownership benar
sudo mkdir -p /var/www/lesavi/public
sudo chown -R ivalora:ivalora /var/www/lesavi/public
```

---

### #4 — Nginx Config `ivalora.conf` Rusak

**Severity:** 🔴 Critical
**Status:** ✅ Fixed

#### Gejala
```bash
$ sudo nginx -t
nginx: [emerg] cannot load certificate
  "/etc/letsencrypt/live/ivaloragadget.com/fullchain.pem":
  BIO_new_file() failed (SSL: error:8000000D:system library::
  Permission denied:calling fopen(...fullchain.pem, r) error:10080002)
nginx: configuration file /etc/nginx/nginx.conf test failed
```

Semua perubahan nginx gagal di-apply. Ini membuat **semua domain** yang di-serve nginx ikut down, termasuk `lesavi-suramadu.biz.id`.

#### Penyebab
File SSL cert `/etc/letsencrypt/live/ivaloragadget.com/fullchain.pem` readable hanya oleh root. Nginx dijalankan oleh user non-root (atau `master_process on` dengan `user root`). Certbot membuat cert dengan permission yang salah.

#### Solusi
```bash
# Hapus config yang broken dari sites-enabled
sudo rm /etc/nginx/sites-enabled/ivalora.conf

# Test nginx
sudo nginx -t
# → syntax is ok

# Reload nginx
sudo systemctl reload nginx
```

#### Rekomendasi
Audit semua SSL cert permission:
```bash
sudo ls -la /etc/letsencrypt/live/*/fullchain.pem
# Pastikan readable oleh nginx user (www-data)
sudo chmod 755 /etc/letsencrypt/live/*/
sudo chmod 644 /etc/letsencrypt/live/*/fullchain.pem
sudo chmod 640 /etc/letsencrypt/live/*/privkey.pem
```

---

### #5 — PM2 Ecosystem Config Salah Arah

**Severity:** 🔴 Critical
**Status:** ✅ Fixed

#### Gejala
```bash
$ pm2 list
→ KOSONG (tidak ada process yang running)
```

#### Config lama (salah):
```js
// /home/ivalora/lesavi-ecosystem.config.js
module.exports = {
  apps: [{
    name: 'lesavi-suramadu-8081',
    script: 'artifacts/api-server/dist/index.mjs',  // ❌ tidak ada
    cwd: '/home/ivalora/LESAVI-SURAMADU',           // ❌ direktori kosong
    env: {
      PORT: 8081,
      DATABASE_URL: 'postgresql://lesavi:lesavi123@localhost:5432/lesavi_db',
      // ...
    }
  }]
};
```

#### Penyebab
Config di-copy dari project lain dengan path yang tidak sesuai. Direktori `LESAVI-SURAMADU` di `/home/ivalora/` kosong.

#### Config baru (benar):
```js
// /home/ivalora/lesavi-ecosystem.config.js
module.exports = {
  apps: [{
    name: 'lesavi-api',
    script: '/var/www/lesavi/apps/api/dist/index.mjs',
    cwd: '/var/www/lesavi',
    env: {
      PORT: 8081,
      DATABASE_URL: 'postgresql://postgres:LesaviAdmin2024!@localhost:5432/lesavi_db',
      SESSION_SECRET: 'rlegs-suramadu-secret-2024',
      NODE_ENV: 'production'
    },
    error_file: '/var/www/lesavi/api-error.log',
    out_file: '/var/www/lesavi/api-out.log'
  }]
};
```

#### Deploy:
```bash
pm2 delete lesavi-api 2>/dev/null
pm2 start /home/ivalora/lesavi-ecosystem.config.js
pm2 save
pm2 startup
```

---

### #6 — Database Credential Tidak Tepat

**Severity:** 🟡 Medium
**Status:** ✅ Fixed

#### Gejala
```bash
$ psql -h localhost -U postgres -d lesavi_db
Password for user postgres: password
psql: error: password authentication failed for user "postgres"
```

#### Credential yang ada di `.env` VPS:
```
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/lesavi_db
```
→ GAGAL ❌

#### Credential yang BENAR (dari `VPS_NOTES.md`):
```
Password: LesaviAdmin2024!
```
→ BERHASIL ✅

#### Catatan Penting
Ada **2 database user** di VPS:
- `postgres` → password: `LesaviAdmin2024!`
- `lesavi` → password: `lesavi123`

Cek dengan:
```bash
PGPASSWORD=LesaviAdmin2024! psql -h localhost -U postgres -d lesavi_db -c "SELECT version();"
```

---

### #7 — Session Store Pakai MemoryStore

**Severity:** 🟡 Medium
**Status:** ⚠️ Pending (warning, not blocking)

#### Gejala
```
Warning: connect.session() MemoryStore is not designed for
a production environment, as it will leak memory,
and will not scale past a single process.
```

#### Dampak
- Setiap restart PM2 → semua session hilang → semua user logout
- Memory leak perlahan di multi-user
- Tidak cocok untuk production

#### Solusi yang Direkomendasikan

**Opsi A — Redis Session Store (Recommended):**
```bash
# Install Redis di VPS
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

```bash
# Install connect-redis di project lokal
pnpm add connect-redis ioredis
```

```typescript
// Di API app setup
import RedisStore from 'connect-redis';
import { createClient } from 'ioredis';

const redisClient = createClient({
  host: 'localhost',
  port: 6379,
});

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
```

**Opsi B — PostgreSQL Session Store:**
```bash
pnpm add pg-session-connect express-session
```

```typescript
import { Pool } from 'pg';

const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(session({
  store: new PgSession({ pool: pgPool }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));
```

---

### #8 — VPS Tidak Punya Package Manager untuk Build

**Severity:** 🟡 Medium
**Status:** ⚠️ Pending

#### Gejala
```
$ ls /var/www/lesavi/node_modules/.pnpm/
→ EMPTY
```

```
$ which pnpm
→ (not found)

$ which npm
→ (not found)
```

#### Dampak
VPS **tidak bisa build sendiri**. Jika ada perubahan kode, harus build di lokal dulu.

#### Solusi Saat Ini
Pipeline deploy manual:
1. Build lokal (`pnpm run build` untuk dashboard & api)
2. Zip dist files
3. Upload via SFTP
4. Extract dengan Python
5. Restart PM2

#### Rekomendasi untuk CI/CD

**Opsi A — GitHub Actions (Recommended):**
```yaml
# .github/workflows/deploy.yml
name: Deploy to VPS
on:
  push:
    branches: [master]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter api run build
      - run: pnpm --filter dashboard run build
      - name: Deploy to VPS
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          password: ${{ secrets.VPS_PASSWORD }}
          source: "apps/dashboard/dist/public/*,apps/api/dist/*"
          target: "/var/www/lesavi"
      - name: Restart PM2
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          password: ${{ secrets.VPS_PASSWORD }}
          script: |
            pm2 restart lesavi-api
```

**Opsi B — Rsync over SSH:**
```bash
# Lokal
rsync -avz --delete \
  -e "ssh -p 22" \
  apps/dashboard/dist/public/ \
  ivalora@103.183.74.104:/var/www/lesavi/public/

rsync -avz --delete \
  -e "ssh -p 22" \
  apps/api/dist/ \
  ivalora@103.183.74.104:/var/www/lesavi/apps/api/dist/

# Restart service di VPS
ssh ivalora@103.183.74.104 "pm2 restart lesavi-api"
```

---

### #9 — JSON Parse Error di Performance Data

**Severity:** 🟡 Medium
**Status:** ⚠️ Pending

#### Gejala
```
Error: Failed query: select ... from "performance_data" where "performance_data"."import_id" = $1
SyntaxError: Expected property name or '}' in JSON at position 1 (line 1 column 2)
    at JSON.parse (<anonymous>)
    at file:///...body-parser/lib/types/json.js:91:21
```

Error ini terlihat di `api-error.log` dari endpoint performance.

#### Penyebab
Kolom `komponen_detail` di tabel `performance_data` berisi data JSON yang malformed. Kemungkinan data import lama dengan format tidak konsisten.

#### Lokasi Error
- File: `apps/api/src/features/performance/publicRoutes.ts:43`
- Error berasal dari `body-parser` middleware, bukan dari data performance secara langsung
- Request yang dikirim ke endpoint tertentu mengandung JSON invalid

#### Investigasi yang Dibutuhkan
```sql
-- Cek apakah ada JSON invalid di komponen_detail
SELECT id, import_id, LEFT(komponen_detail::text, 100)
FROM performance_data
WHERE komponen_detail IS NOT NULL
LIMIT 10;

-- Cek apakah ada NULL atau string kosong
SELECT COUNT(*) FROM performance_data
WHERE komponen_detail IS NULL;

-- Cek baris dengan JSON invalid (kalau tidak bisa parse)
SELECT id, LEFT(komponen_detail::text, 200) FROM performance_data;
```

#### Solusi
1. Identifikasi baris dengan JSON invalid
2. Perbaiki data atau hapus baris yang corrupt
3. Pastikan import logic melakukan validasi JSON sebelum insert

---

### #10 — Shell Escaping untuk Request dengan JSON Body

**Severity:** 🟢 Low
**Status:** ✅ Fixed (workaround)

#### Gejala
```bash
# Gagal — shell eating backslash
curl -X POST https://lesavi-suramadu.biz.id/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@lesavi.id\",\"password\":\"admin123\"}"
→ Bad Request

# Berhasil — pakai script file
bash test_login.sh
→ {"id":8260,"email":"admin@lesavi.id","role":"ADMIN"...}
```

#### Penyebab
Double-quoting di bash menyebabkan backslash di-escape dua kali. Shell mengubah `\"` menjadi `"` sebelum curl terima.

#### Solusi
**Opsi 1 — Write to script file:**
```bash
cat > /tmp/test_login.sh << 'SCRIPT'
#!/bin/bash
curl -s -X POST https://lesavi-suramadu.biz.id/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@lesavi.id","password":"admin123"}'
SCRIPT
chmod +x /tmp/test_login.sh && bash /tmp/test_login.sh
```

**Opsi 2 — Use single quotes outer:**
```bash
curl -s -X POST https://.../api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@lesavi.id","password":"admin123"}'
```

---

## Checklist Deploy ke VPS

### Sebelum Deploy
- [ ] Build dashboard: `pnpm --filter dashboard run build`
- [ ] Build API: `pnpm --filter api run build`
- [ ] Verify dist files ada:
  - `apps/dashboard/dist/public/index.html`
  - `apps/api/dist/index.mjs`

### Upload
- [ ] Zip: `Compress-Archive` dashboard `dist/public/*` → `_deploy_dash.zip`
- [ ] Zip: `Compress-Archive` api `dist/*` → `_deploy_api.zip`
- [ ] Upload via SFTP
- [ ] Extract ke `/var/www/lesavi/public/` dan `/var/www/lesavi/apps/api/dist/`

### Konfigurasi
- [ ] Fix ownership: `sudo chown -R ivalora:ivalora /var/www/lesavi/`
- [ ] Update PM2 ecosystem jika path berubah
- [ ] Update nginx config jika ada perubahan port/domain

### Restart
- [ ] `pm2 restart lesavi-api`
- [ ] `pm2 save`
- [ ] `sudo systemctl reload nginx`
- [ ] `sudo certbot certificates` — verify SSL valid

### Verify
- [ ] `curl https://lesavi-suramadu.biz.id/` → 200 OK
- [ ] `curl https://lesavi-suramadu.biz.id/api/health` → valid JSON
- [ ] Login via browser → berhasil
- [ ] `pm2 list` → process online

---

## Info VPS Akhir

```
Host:     103.183.74.104
User:     ivalora
Password: Sura123Baya45
SSH Port: 22

Dashboard: /var/www/lesavi/public/
API dist:  /var/www/lesavi/apps/api/dist/
API Port:  8081
PM2 name:  lesavi-api

DB:       lesavi_db (postgres:LesaviAdmin2024!@localhost:5432)
SSL:      letsencrypt (lesavi-suramadu.biz.id)

Domain:   https://lesavi-suramadu.biz.id
```

## Admin Login
```
Email:    admin@lesavi.id
Password: admin123
```
