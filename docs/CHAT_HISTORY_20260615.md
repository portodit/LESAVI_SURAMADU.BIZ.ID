# LESAVI-SURAMADU - Chat History (2026-06-15)

## Project Info
- VPS: 103.183.74.104
- Dashboard: `C:\Users\USER\LESAVI-SURAMADU\artifacts\lesavi-dashboard`
- API Server: `C:\Users\USER\LESAVI-SURAMADU\artifacts\api-server` (port 3001)
- Database: `lesavi_db` (PostgreSQL @ 127.0.0.1:5432, user: lesavi/lesavi123)

## Problem Solved Today

### Database Migration Issue
Database `lesavi_db` tidak sinkron dengan schema. Beberapa tabel hilang menyebabkan API error 500.

**Tabel yang hilang (sudah dibuat):**
- `admin_users`
- `drive_read_logs`
- `master_customer`
- `pending_am_discoveries`
- `telegram_bot_users`

**Query yang salah:**
- `FROM accounts` → `FROM account_managers`
- Fixed di `artifacts/api-server/src/features/funnel/routes.ts`
- Fixed di `apps/api/src/features/funnel/routes.ts`

**Config fix:**
- `drizzle.config.json` - updated URL ke `lesavi_db`

**Dokumentasi:** `docs/DATABASE_MIGRATION_GUIDE.md`

### Current Status
- ✅ 14/14 tabel ada
- ✅ API server running (port 3001)
- ✅ Dashboard running (port 5173)
- ✅ API server sudah direbuild dan direstart

## RLEGS RAW Data

### File CSV (已有)
- Location: `C:\Users\USER\Downloads\RLEGS_RAW_DATA_20260607.csv`
- 37 kolom, 2.0 MB
- Kolom: PERIODE, NIK, NAMA_AM, LEVEL_AM, POSITION, WITEL_AM, DIVISI_AM, dll

### File Excel Source
- Location: `C:\Users\USER\Downloads\Telegram Desktop\RAW_DATA_PERF_AM_1774951681832.xlsx`
- Sheet: "Raw Data" (A1:AJ7693 = 7,692 rows)
- 36 kolom (sama dengan CSV tapi tanpa kolom 'kw')
- Tidak ada sheet hidden 'perf.am' - data ada di sheet "Raw Data"

### Kolom RLEGS (36-37):
1. PERIODE, 2. NIK, 3. NAMA_AM, 4. LEVEL_AM, 5. POSITION
6. WITEL_AM, 7. DIVISI_AM, 8. NIP_NAS_GROUP, 9. NIP_NAS, 10. STANDARD_NAME
11. GROUP, 12. INDUSTRI, 13. LSEGMEN, 14. SSEGMEN, 15. WITEL_CC
16. TELDA, 17. REGIONAL, 18. DIVISI_CC, 19. KAWASAN, 20. PROPORSI
21. LAYANAN, 22. TEMP, 23. TARGET_REVENUE, 24. TARGET_SUSTAIN, 25. TARGET_SCALING
26. TARGET_NGTMA, 27. REAL_REVENUE, 28. REAL_SUSTAIN, 29. REAL_SCALING, 30. REAL_NGTMA
31. REVENUE_BASE, 32. REVENUE_BILLCOM, 33. a_rev, 34. a_ngtma, 35. a_scaling
36. a_sustain, 37. kw (hanya di CSV, tidak ada di Excel)

## Schema Files Location
`packages/db/src/schema/`
- accountManagers.ts → account_managers
- adminUsers.ts → admin_users
- appSettings.ts → app_settings
- dataImports.ts → data_imports
- driveReadLogs.ts → drive_read_logs
- masterAm.ts → master_customer
- pendingAmDiscoveries.ts → pending_am_discoveries
- performanceData.ts → performance_data
- salesActivity.ts → sales_activity
- salesFunnel.ts → sales_funnel
- telegramBotUsers.ts → telegram_bot_users
- telegramLogs.ts → telegram_logs
