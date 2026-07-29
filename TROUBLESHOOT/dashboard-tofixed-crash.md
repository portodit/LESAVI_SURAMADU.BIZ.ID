# Bug Report: .toFixed() Crash di /dashboard — TypeError: (intermediate value).toFixed is not a function

**Tanggal:** 28 Juli 2026
**Status:** FIXED
**Severity:** High
**Link Terdampak:** https://lesavi-suramadu.biz.id/dashboard
**Juga Terdampak:** https://lesavi-suramadu.biz.id/presentation

---

## 1. Latar Belakang Permasalahan

Dashboard LESAVI menampilkan halaman blank/blank setelah loading, dengan error
JavaScript di console. Error terjadi di banyak slide dan page karena fungsi
formatting memanggil `.toFixed()` pada nilai yang bukan number.

---

## 2. Gejala Error

### Error Console Browser:
```
Uncaught TypeError: (intermediate value)(intermediate value)(intermediate value).toFixed is not a function
    at ote (index-DIFLcmmV.js:9:146632)
    at Array.map (<anonymous>)
    at pje (index-DIFLcmmV.js:115:6675)
```

### Tampilan:
- Dashboard load tapi sebagian konten blank/missing
- Chart tidak render
- Gauge kosong
- Angka persentase tidak tampil

---

## 3. Root Cause

### Penyebab Utama

`.toFixed()` crash saat dipanggil pada `NaN`, `undefined`, atau `Infinity`.

```typescript
// CRASH: div-by-zero menghasilkan NaN
const pct = (total / target) * 100;  // target=0 → NaN
pct.toFixed(0);  // TypeError!

// CRASH: nullish coalescing tidak handle NaN
const v = value ?? 0;   // value=NaN → v=NaN
v.toFixed(2);           // TypeError!

// CRASH: undefined lewat nullish coalescing
const t = e ?? 0;  // e=undefined → t=undefined (tidak 0!)
undefined.toFixed();  // TypeError!
```

### Lokasi Bug di Source Code

| File | Fungsi / Baris | Bug |
|------|---------------|-----|
| `src/shared/lib/utils.ts` | `formatPercent()` | `v = value ?? 0` tidak handle `NaN` |
| `src/shared/lib/utils.ts` | `formatRupiah()` | sama, `NaN.toFixed()` crash |
| `src/features/funnel/FunnelPage.tsx` | `dpsPct = dpsStats.totalNilai / dpsTgt` | `undefined / 0 = NaN` |
| `src/features/funnel/FunnelPage.tsx` | `dssPct` | sama |
| `src/features/funnel/FunnelPage.tsx` | Gauge `clamp = Math.max(pct, 0)` | `pct=undefined → NaN` |
| `src/features/funnel/FunnelPage.tsx` | `pctRaw = amTotal/amTargetVal` | `undefined/null` tidak di-guard |
| `src/features/performance/PresentationPage.tsx` | 20+ lokasi `.toFixed()` | `cr`, `pctRaw`, `pctRawAm` tidak di-guard |
| `src/features/performance/PerformaPage.tsx` | TrophyCard `topCm.cmAch` | object bisa `undefined` |
| `src/features/performance/PerformaPage.tsx` | row `cmAch`, `ytdAch` | tidak ada guard |

---

## 4. Pola Perbaikan

### Pattern 1 — Nullish coalescing (untuk function parameter)
```typescript
// SEBELUM (crash jika value = NaN)
const v = value ?? 0;
return `${v.toFixed(2)}%`;

// SESUDAH
const v = value ?? 0;
if (!Number.isFinite(v)) return "0%";
return `${v.toFixed(2)}%`;
```

### Pattern 2 — Guard di komputasi (untuk div-by-zero)
```typescript
// SEBELUM
const pct = (total / target) * 100;

// SESUDAH
const pct = target > 0 && total != null ? (total / target) * 100 : 0;
```

### Pattern 3 — Ternary inline (untuk JSX expressions)
```tsx
// SEBELUM
{pct.toFixed(0)}%

// SESUDAH
{typeof pct === "number" && !isNaN(pct) ? pct.toFixed(0) : "0"}%
```

### Pattern 4 — Number.isFinite untuk clamp/pct
```typescript
// SEBELUM
const clamp = Math.min(Math.max(pct, 0), 100);

// SESUDAH
const clamp = Number.isFinite(pct) ? Math.min(Math.max(pct, 0), 100) : 0;
```

---

## 5. Langkah Teknis Fix

### File yang Diedit

1. **`src/shared/lib/utils.ts`**
   - `formatPercent()` — tambah `Number.isFinite(v)` guard
   - `formatRupiah()` — tambah `Number.isFinite(v)` guard
   - `formatRupiahShort()` — sama

2. **`src/features/funnel/FunnelPage.tsx`**
   - `dpsPct` — `dpsStats.totalNilai != null` guard
   - `dssPct` — sama
   - Gauge `clamp` — `Number.isFinite(pct)` guard
   - `pctRaw` — `amTotal != null` guard
   - `pctBar` — `Number.isFinite(pctRaw)` guard
   - 3 lokasi JSX `.toFixed()`加了 typeof guard

3. **`src/features/performance/PresentationPage.tsx`**
   - 20+ lokasi加了 `typeof === "number" && !isNaN()` guard
   - Variabel: `cr`, `displayPct`, `pctRaw`, `pctRawAm`, `crAm`, `topCm.cmAch`, `topYtd.ytdAch`, `row.cmAch`, `row.ytdAch`, `prop`, `cAch`, `footAch`, `totals.cmAch`, `totals.ytdAch`, `tickFormatter`

4. **`src/features/performance/PerformaPage.tsx`**
   - TrophyCard `topCm`, `topYtd`
   - Row `cmAch`, `ytdAch`
   - `prop`, `cAch`, `totals.cmAch`, `totals.ytdAch`

5. **`src/features/import/ImportDetailPage.tsx`** dan **`ImportPage.tsx`**
   - `r.achRate`, `c.proporsi`, `existing.targetValue`

### Deploy
```bash
cd /home/ivalora/LESAVI-SURAMADU/apps/dashboard

# Upload fixes (dari local ke VPS)
# Lalu build
npm run build

# Deploy
sudo cp dist/public/index.html /var/www/lesavi/index.html
sudo cp dist/public/assets/*.js /var/www/lesavi/assets/
sudo rm /var/www/lesavi/assets/index-BGjVWWvt.js  # hapus bundle lama
```

### Cache-Busting
Karena nginx sudah `no-cache`, masalah browser cache bisa terjadi.
Tambahkan query param ke script tag:
```html
<script type="module" src="/assets/index-XXXXX.js?cb=2026072802">
```

---

## 6. Pencegahan

1. **Linting Rule** — tambahkan ESLint rule untuk detect `.toFixed()` tanpa guard
   ```json
   // .eslintrc.json
   {
     "rules": {
       "no-unused-expressions": ["error", {
         "allowShortCircuit": true,
         "allowTernary": true
       }]
     }
   }
   ```
   Pattern: gunakan custom ESLint plugin atau `eslint-plugin-etc`

2. **TypeScript Strict** — aktifkan `strictNullChecks` agar TS强制 guard
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "strictNullChecks": true,
       "noUncheckedIndexedAccess": true
     }
   }
   ```

3. **Code Review Checklist** — setiap `.toFixed()` harus ada guard

4. **Unit Test** — test semua function format dengan input `NaN`, `undefined`, `null`
   ```typescript
   test('formatPercent handles NaN', () => {
     expect(formatPercent(NaN)).toBe('0%');
     expect(formatPercent(undefined)).toBe('0%');
     expect(formatPercent(null)).toBe('0%');
   });
   ```

---

## 7. Ringkasan

| Item | Detail |
|------|--------|
| Bug | `.toFixed()` crash saat value = NaN/undefined/Infinity |
| Root cause | Div-by-zero, nullish coalescing tidak handle NaN, unguarded JSX |
| Files fixed | 5 file (utils.ts, FunnelPage, PresentationPage, PerformaPage, Import pages) |
| Lokasi guard | 30+ titik |
| Bundle hash fix | `index-CUNA-PNH.js` |
| Deploy date | 28 Juli 2026 |

---

**Reported by:** Claude Sonnet 4.6
**Fix by:** Claude Sonnet 4.6
**Fix Date:** 28 Juli 2026
