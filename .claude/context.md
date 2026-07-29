# Context - 2026-05-07

## Tujuan Sesi
User meminta assistant memahami project ini secara menyeluruh: arsitektur frontend, backend, dan terutama cara kerja Telegram bot agar siap lanjut ke perubahan/fitur berikutnya tanpa investigasi ulang dari nol.

## Progress & Status
- Sudah dilakukan eksplorasi struktur project dan pembacaan file inti frontend/backend/telegram bot.
- Sudah dipetakan alur utama frontend (routing + auth guard), backend (route composition + auth middleware), dan bot (polling, linking akun, role-based menu, import file via Telegram).
- Belum ada perubahan kode implementasi; sesi masih tahap pemahaman dan dokumentasi konteks.
- Task list:
  - #1 Petakan arsitektur frontend — completed
  - #2 Petakan arsitektur backend — completed
  - #3 Pahami alur Telegram bot — in_progress (secara substansi sudah dianalisis, tinggal sinkronisasi status task bila diperlukan)

## File yang Dimodifikasi
Pada sesi ini oleh assistant:
- `.claude/context.md` — dibuat/diperbarui untuk menyimpan ringkasan konteks sesi.

Tidak ada file kode aplikasi yang diedit pada sesi ini.

Kondisi repo saat awal sesi (sudah ada dari sebelum interaksi ini):
- `artifacts/api-server/src/features/gdrive/importer.ts` (modified)
- `artifacts/api-server/src/features/gdrive/routes.ts` (modified)
- `artifacts/api-server/src/features/telegram/poller.ts` (modified)
- `artifacts/api-server/src/features/telegram/service.ts` (modified)
- `.claude/` (untracked)
- `.env` (untracked)

## Keputusan Penting
- Pendekatan yang dipilih: lakukan code-reading terarah pada entrypoint dan modul inti (bukan mengubah kode) untuk membangun pemahaman end-to-end sebelum implementasi.
- Fokus investigasi Telegram bot diarahkan ke 3 titik: `routes.ts` (admin/API control), `poller.ts` (runtime state machine bot), `service.ts` (message builder + delivery).
- Komunikasi tetap Bahasa Indonesia mengikuti instruksi global.

## Konteks Teknis
- Monorepo/workspace dengan area utama:
  - Frontend: `artifacts/lesavi-dashboard` (React, Wouter, TanStack Query, role-based guarded routing).
  - Backend: `artifacts/api-server` (Express, express-session, pino-http logger, modular feature routes).
  - Data layer: `lib/db` (Drizzle ORM schema + PostgreSQL).
- Backend startup:
  - `artifacts/api-server/src/index.ts` menjalankan server, seeding/patching, lalu start scheduler/poller (`Telegram`, `GSheets`, `GDrive`).
- Routing backend:
  - `artifacts/api-server/src/routes/index.ts` memisahkan route public vs dashboard.
  - Route dashboard dilindungi `requireAuth` + `requireManagerOrOfficer`.
- Frontend routing:
  - `artifacts/lesavi-dashboard/src/App.tsx` mengatur public routes, protected routes, dan pembatasan role AM ke presentation-only.
- Telegram bot runtime:
  - Polling via `getUpdates` (bukan webhook), offset `lastUpdateId`, timer loop via `setTimeout`.
  - In-memory chat state per chat (`chatStateMap`) untuk mode interaktif (upload/search/pick).
  - Persistensi user bot ke tabel `telegram_bot_users` lewat upsert.
  - Linking akun AM via kode/deep-link (`/start <code>`), validasi expiry, simpan `telegram_chat_id`.
  - Menu dan flow berbeda berdasarkan role (`AM`, `OFFICER`, `MANAGER`).
  - OFFICER bisa upload Excel di chat → download file Telegram → parse → import ke modul gdrive/importer.
  - Service bot membangun pesan terpisah per tipe data (performance/funnel/activity) dan mengirim via Telegram API.
- Endpoint admin Telegram (`features/telegram/routes.ts`) mencakup send reminder, log, register/link/unlink, generate link, sync-now, bot-status.

## Langkah Selanjutnya
1. Sinkronkan task status #3 menjadi completed jika user setuju bahwa analisis alur bot sudah cukup.
2. Jika user ingin implementasi perubahan, tentukan scope spesifik (contoh: ubah flow linking, format pesan, role permissions, atau upload handling).
3. Sebelum edit kode, cek ulang `git status` dan baca file target terbaru karena repo sudah dirty sejak awal.
4. Setelah implementasi nanti, lakukan verifikasi terarah (readback + test/lint/run yang relevan).

## Catatan Penting
- Jangan asumsi perubahan di `poller.ts`/`service.ts` saat ini berasal dari sesi ini; file tersebut sudah modified dari awal.
- `poller.ts` sangat besar dan berisi banyak branch callback berbasis role; perubahan kecil bisa berdampak ke flow lain, jadi wajib uji tiap role (AM/OFFICER/MANAGER).
- Ada `.env` untracked; jangan ikut ter-commit.
- Jika agent/model berikutnya lanjut pekerjaan, mulai dari file kunci ini:
  - `artifacts/lesavi-dashboard/src/App.tsx`
  - `artifacts/api-server/src/index.ts`
  - `artifacts/api-server/src/routes/index.ts`
  - `artifacts/api-server/src/features/telegram/routes.ts`
  - `artifacts/api-server/src/features/telegram/poller.ts`
  - `artifacts/api-server/src/features/telegram/service.ts`
  - `lib/db/src/schema/accountManagers.ts`
  - `lib/db/src/schema/telegramBotUsers.ts`
  - `lib/db/src/schema/telegramLogs.ts`