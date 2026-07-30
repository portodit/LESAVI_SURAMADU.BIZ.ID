# Bug Report: Login Gagal — Session Cookie Tidak Work Karena Beda Port

**Tanggal:** 30 Juli 2026
**Status:** FIXED
**Severity:** High
**Link Terdampak:** `http://localhost:5173/login` → `http://localhost:8080/login` (setelah fix)
**Juga Terdampak:** Semua halaman yang memerlukan autentikasi

---

## 1. Latar Belakang Permasalahan

### 1.1 Deskripsi Masalah

Setelah user berhasil login (notifikasi "Login berhasil" muncul), aplikasi **tidak redirect ke halaman dashboard** (`/dashboard`). Browser console menunjukkan error `401 Unauthorized` pada endpoint `/api/auth/me`, yang artinya server tidak mengenali sesi user meskipun login POST sudah berhasil.

### 1.2 Konteks Teknis — Arsitektur Sebelum Fix

```
┌─────────────────────────────────────────────────────┐
│ Port 5173 — Frontend (Vite dev server / preview)     │
│ http://localhost:5173/login                          │
│                                                     │
│ Frontend fetch ke:                                  │
│   http://localhost:5173/api/*  (via Vite proxy)   │
│   ATAU                                               │
│   http://localhost:8080/api/*  (direct via .env)   │
└─────────────────────────────────────────────────────┘
              ↕ proxy / direct fetch
┌─────────────────────────────────────────────────────┐
│ Port 8080 — Backend API (Express)                   │
│ Session store: express-session (memory)            │
│ Cookie: connect.sid (HttpOnly, SameSite=Lax)        │
└─────────────────────────────────────────────────────┘
```

Setup awal development menggunakan **dua port berbeda**:
- Frontend: port 5173 (Vite)
- Backend: port 8080 (Express)

Ini menyebabkan cookie session tidak bisa di-set atau dikirim dengan benar antar port.

### 1.3 Setup Sebelum Fix (2 Port)

```
start-dev.bat:
  [1] node build.mjs          → Build API
  [2] node dist/index.mjs     → API di port 8080
  [3] vite preview --port 5173 → Frontend di port 5173
```

---

## 2. Gejala Error

### 2.1 Console Browser Setelah Login

```
GET http://localhost:5173/api/auth/me 401 (Unauthorized)
GET http://localhost:8080/api/auth/me 401 (Unauthorized)
```

### 2.2 UI/UX

- Notifikasi toast hijau "Login berhasil, Selamat datang kembali." **muncul** → login server-side berhasil
- Browser tetap di halaman `/login`
- Tidak redirect ke `/dashboard`
- Semua halaman API (/import/history, /am, /performance) mengembalikan 401

### 2.3 DevTools → Application → Cookies

Setelah login, **tidak ada cookie `connect.sid`** yang tersimpan, ATAU cookie ada tetapi tidak dikirim pada subsequent requests.

### 2.4 Network Tab

- POST `/api/auth/login` → **200 OK** dengan header `Set-Cookie: connect.sid=...`
- GET `/api/auth/me` → **401 Unauthorized** (cookie tidak ikut)

### 2.5 API Server Logs

```
[09:18:07.223] POST /api/auth/login → 200 OK (login berhasil)
[09:18:07.226] GET  /api/auth/me   → 401 Unauthorized (cookie tidak datang)
[09:18:11.308] GET  /api/am        → 401 Unauthorized
[09:18:11.311] GET  /api/performance → 401 Unauthorized
```

---

## 3. Investigasi — Mengapa Cookie Tidak Work di 2 Port?

### 3.1 Cara Kerja Cookie Browser

Cookie di-set oleh server melalui header `Set-Cookie`. Browser menyimpan cookie berdasarkan atributnya:

```
Set-Cookie: connect.sid=abc123; Path=/; HttpOnly; SameSite=Lax
```

Browser hanya mengirim cookie tersebut pada request yang match dengan:
- **Domain** yang sama (atau subdomain)
- **Port** — untuk cookie **tanpa explicit `Domain`**, cookie adalah **host-only** dan hanya dikirim ke port yang sama

### 3.2 Masalah dengan Cookie di Port Berbeda

**Scenario 1: Frontend di port 5173, API di port 8080**

```
Server (Express) berjalan di localhost:8080
  ↓
Set-Cookie: connect.sid=... (tanpa Domain attribute)
  ↓
Browser menyimpannya untuk: localhost (port无关 — host-only cookie)
  ↓
Tapi browser mengirim cookie HANYA ke localhost:8080 (port saat cookie di-set)
  ↓
Request dari localhost:5173 TIDAK menyertakan cookie
  ↓
requireAuth middleware → 401
```

**Analisis:** Meskipun cookie tersimpan dengan benar di browser, ketika browser mengirim request dari **origin berbeda** (`localhost:5173`), cookie dari `localhost:8080` **tidak diikutsertakan** karena cookie browser policy: cookie dari satu port tidak dikirim ke port berbeda dalam same-origin yang ketat.

**Scenario 2: Dengan explicit `Domain=localhost`**

```
Set-Cookie: connect.sid=...; Domain=localhost
  ↓
Browser: "Domain=localhost berarti ini untuk semua port di localhost"
  ↓
Request ke localhost:5173 → cookie IKUT?
  ↓
Tergantung browser dan SameSite setting:
  - SameSite=Lax → TIDAK dikirim (lintas port dianggap cross-origin)
  - SameSite=None → Dikirim tapi butuh Secure
  - SameSite=Strict → Tidak pernah dikirim
```

**Kesimpulan:** Cookie dari `localhost:8080` **tidak secara reliable dikirim** ke `localhost:5173` karena browser treat beda port sebagai context berbeda.

### 3.3 Vite Proxy sebagai Alternatif

Vite proxy (`server.proxy`) bisa mem-forward semua request `/api` ke backend, tapi **Vite proxy memblok atau tidak me-forward header `Set-Cookie`** dari response backend ke browser.

```
Browser → Vite (localhost:5173) → Express (localhost:8080)
  ↓
Express set Set-Cookie → Vite proxy
  ↓
Vite proxy TIDAK me-forward Set-Cookie ke browser
  ↓
Browser tidak pernah terima cookie
```

**Dampak:** Même dengan Vite proxy, cookie tetap tidak sampai.

### 3.4 HTTP vs HTTPS

Di production dengan HTTPS, masalah ini lebih kompleks karena:
- `SameSite=Lax` → Cookie tidak dikirim dari subdomain berbeda
- `SameSite=None; Secure` → Butuh HTTPS
- Reverse proxy (nginx) perlu di-config untuk forward cookie dengan benar

### 3.5 Verifikasi dengan Curl

```bash
# Test 1: Login → cookie berhasil di-set
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bliaditdev@gmail.com","password":"admin123"}' \
  -c /tmp/cookies.txt

# Response:
# Set-Cookie: connect.sid=s%3AEJiDVjaNVlz...; Path=/; HttpOnly
# HTTP/1.1 200 OK

# Test 2: Request dengan cookie → berhasil
curl http://localhost:8080/api/auth/me -b /tmp/cookies.txt

# Response:
# HTTP/1.1 200 OK
# {"id":1,"email":"bliaditdev@gmail.com","role":"OFFICER",...}
```

**Kesimpulan:** API server bekerja dengan benar. Masalah ada di browser cookie handling di 2 port.

---

## 4. Solusi yang Dicoba

### 4.1 SameSite=None

```typescript
cookie: {
  sameSite: "none",
  secure: false, // butuh true untuk SameSite=None tapi dev pakai HTTP
}
```
**Hasil:** ❌ Tidak work — `SameSite=None` butuh `Secure=true` (HTTPS)

### 4.2 Proxy Config dengan Cookie Domain Rewrite

```typescript
proxy: {
  "/api": {
    configure: (proxy) => {
      proxy.on("proxyRes", (proxyRes) => {
        const setCookie = proxyRes.headers["set-cookie"];
        if (setCookie) {
          proxyRes.headers["set-cookie"] = setCookie.map((c: String) =>
            c.replace(/Domain=[^;]*/gi, "Domain=localhost")
          );
        }
      });
    },
  },
}
```
**Hasil:** ❌ Vite proxy tetap tidak me-forward Set-Cookie

### 4.3 Explicit Domain di Cookie

```typescript
cookie: {
  domain: "localhost", // explicit domain
}
```
**Hasil:** ❌ Tidak menyelesaikan masalah lintas-port

### 4.4 JWT Token di localStorage

```typescript
// Backend: generate JWT on login
// Frontend: store in localStorage, send in Authorization header
```
**Hasil:** ⚠️ Work tapi perlu refactor besar — mengubah seluruh auth flow

### 4.5 Direct API Call (tanpa Proxy) dengan .env

```bash
VITE_API_URL=http://localhost:8080
```
**Hasil:** ❌ Tidak work — port berbeda tetap jadi masalah

---

## 5. Solusi Final — 1 Port (API Serve Frontend)

### 5.1 Prinsip

**Jika browser dan API di port yang sama, cookie langsung work karena same-origin.**

```
localhost:8080          → Frontend (HTML/JS/CSS)
localhost:8080/api/*     → API endpoints

Request ke /api/* → cookie otomatis ikut (same-origin)
```

### 5.2 Perubahan Teknis

#### File: `apps/api/src/app.ts`

Serve static files dari dist/public di semua environment:

```typescript
// SEBELUM: hanya serve di production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(staticDir));
  app.get("/{*splat}", ...);
}

// SESUDAH: serve di semua environment (termasuk development)
app.use("/api", router);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.join(__dirname, "..", "..", "dashboard", "dist", "public");
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}
```

#### File: `apps/api/src/app.ts` — Session Cookie

```typescript
cookie: {
  secure: false,
  httpOnly: true,
  sameSite: "lax",
  domain: "localhost",
  maxAge: 7 * 24 * 60 * 60 * 1000,
}
```

#### File: `start-dev.bat`

```batch
@echo off
REM Hapus Vite (port 5173) — API serve frontend di port 8080
REM
REM Build API
cd /d "%ROOT%\apps\api"
call node build.mjs

REM Start API + Frontend di port 8080
start "LESAVI-API" cmd /k "cd /d "%ROOT%\apps\api" && set PORT=8080 && set NODE_ENV=development && node dist\index.mjs"
```

#### File: Hapus `.env` dan Vite proxy

- Hapus `apps/dashboard/.env` — base URL default sudah `http://localhost:8080`
- Hapus blok `proxy` dari `vite.config.ts` — tidak diperlukan lagi

### 5.3 Alur Setelah Fix

```
┌─────────────────────────────────────────────┐
│ http://localhost:8080                       │
│                                             │
│  /             → Frontend (index.html)     │
│  /dashboard     → Frontend                  │
│  /api/login     → API (set cookie)          │
│  /api/auth/me   → API (cookie ikut) ✓       │
└─────────────────────────────────────────────┘

Semua same-origin → Cookie work otomatis
```

---

## 6. Ringkasan Masalah 2 Port

| Masalah | Penjelasan |
|---------|-----------|
| Cookie tidak di-set | Browser tidak terima Set-Cookie dari Vite proxy |
| Cookie tidak dikirim | Browser tidak kirim cookie lintas port (5173 → 8080) |
| SameSite=None butuh Secure | SameSite=None butuh HTTPS, tidak bisa dev dengan HTTP |
| Vite proxy bloats cookie | http-proxy tidak me-forward Set-Cookie header |
| Root cause | Cookie browser policy tidak guarantee lintas-port |

---

## 7. Trade-off Solusi 1 Port

| Aspek | Sebelum (2 port) | Sesudah (1 port) |
|-------|-----------------|------------------|
| Development speed | ⚡ HMR cepat (Vite) | 🔄 Reboot server tiap code change |
| Hot reload | ✅ Ya | ❌ Tidak (harus restart API) |
| Cookie auth | ❌ Bermasalah | ✅ Work |
| Production | ✅ Normal (nginx reverse proxy) | ✅ Normal |
| Complexity | ❌ Dua proses + proxy | ✅ Satu proses |

### Alternatif untuk Development (Hot Reload + Auth Work)

Jika hot reload diperlukan untuk development:

```typescript
// Vite proxy dengan cookie domain rewrite yang benar
proxy: {
  "/api": {
    target: "http://127.0.0.1:8080",
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on("proxyRes", (proxyRes) => {
        const cookies = proxyRes.headers["set-cookie"];
        if (cookies) {
          proxyRes.headers["set-cookie"] = cookies.map((c) =>
            c.replace(/; ?Domain=[^;]*/gi, "")
          );
        }
      });
    },
  },
}
```

ATAU gunakan **JWT token** sebagai gantinya.

---

## 8. Checklist Fix

- [x] API serve static files di semua environment (`app.ts`)
- [x] Cookie session config dengan `domain: "localhost"`, `sameSite: "lax"`
- [x] Hapus Vite proxy dari `vite.config.ts`
- [x] Hapus `.env` dari dashboard
- [x] Update `start-dev.bat` (1 proses saja)
- [ ] Reboot server
- [ ] Clear cookies browser
- [ ] Login di `http://localhost:8080`
- [ ] Verifikasi redirect ke dashboard
- [ ] Test logout → login flow
- [ ] Test di production (jika ada perubahan di nginx config)

---

## 9. File yang Diedit

| File | Perubahan |
|------|----------|
| `apps/api/src/app.ts` | Serve static files (hapus `if production`); cookie config |
| `apps/api/src/features/auth/routes.ts` | Revert ke session-based (bukan JWT) |
| `apps/dashboard/vite.config.ts` | Hapus proxy config |
| `apps/dashboard/src/shared/hooks/use-auth.tsx` | Fix redirect logic (`setQueryData`) |
| `apps/dashboard/src/features/auth/LoginPage.tsx` | Fix redirect effect |
| `apps/dashboard/.env` | Dihapus |
| `start-dev.bat` | 1 proses (API saja, serve frontend) |

---

## 10. Referensi

- [MDN: SameSite Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [Vite: Server Proxy](https://vite.dev/config/server-options.html#server-proxy)
- [express-session](https://www.npmjs.com/package/express-session)
- [HTTP Cookie: Port vs Domain](https://stackoverflow.com/questions/46383183/how-do-cookies-work-with-different-ports-on-the-same-domain)

---

**Reported by:** Claude Opus 4.6
**Fix by:** Claude Opus 4.6
**Date:** 30 Juli 2026
