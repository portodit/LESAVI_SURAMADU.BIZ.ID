# TASK: Import Data — Cleanup & Frontend Enhancement

**Tanggal:** 30 Juli 2026
**Status:** DONE
**Total Files Modified:** 5 files (backend + frontend + database)

---

## 1. Latar Belakang

Dalam alur import data sales activity, terdapat kolom-kolom yang tidak diperlukan oleh bisnis namun tetap tersimpan di database dan ditampilkan di frontend. Kolom-kolom ini membuat tabel import menjadi lebar dan tidak fokus pada data penting. Selain itu, UI tabel import memiliki filter yang tidak berfungsi (tidak bisa diklik) dan tidak memiliki fitur sorting kolom.

### Kolom yang Dihapus

| # | Nama Kolom Excel | Field DB | Alasan Dihapus |
|---|-----------------|---------|----------------|
| 1 | Segmen | `segmen` | Tidak diperlukan dalam analisis sales activity |
| 2 | Regional | `regional` | Informasi redundan (sudah terkandung di context witel) |
| 3 | Witel | `witel` | Tidak diperlukan per-record |
| 4 | Tgl Aktivitas / Start Date | `createdat_activity`, `activity_start_date` | Duplikat dengan `activity_end_date` |
| 5 | PIC Name | `pic_name` | Tidak relevan untuk tracking aktivitas AM |
| 6 | PIC Jobtitle | `pic_jobtitle` | Tidak relevan untuk tracking aktivitas AM |
| 7 | PIC Role | `pic_role` | Tidak relevan untuk tracking aktivitas AM |
| 8 | PIC Phone | `pic_phone` | Tidak relevan untuk tracking aktivitas AM |

**Total dihapus: 8 kolom**

---

## 2. Goals

1. Hapus 8 kolom tidak diperlukan dari tabel database `sales_activity`
2. Update schema Drizzle ORM (`packages/db/src/schema/salesActivity.ts`) agar sinkron dengan DB
3. Update backend import logic (`excel.ts` + `routes.ts`) agar tidak insert kolom yang dihapus
4. Update frontend detail table (`ActivityDetailTable.tsx`) dengan:
   - Hapus kolom yang dihapus dari tampilan
   - Perbaiki fitur filter (tidak bisa diklik → bisa diklik dengan popup checkboxes)
   - Tambah fitur sorting kolom (ASC / DESC)
   - Hapus elemen row count statis ("2283 baris")
   - Rapikan layout toolbar (heading + search bar sejajar horizontal)
5. Semua change backward-compatible — data lama tetap ada di DB (DROPPED), data baru hanya menyimpan kolom yang diperlukan

---

## 3. File yang Dikerjakan

### Database Layer
| File | Peran |
|------|-------|
| PostgreSQL (`ALTER TABLE DROP COLUMN`) | Drop kolom-kolom dari tabel `sales_activity` |

### Backend (apps/api)
| File | Peran |
|------|-------|
| `src/features/import/excel.ts` | `cleanActivityRows()` — hapus parsing kolom tidak diperlukan |
| `src/features/import/routes.ts` | INSERT batch — hapus kolom dari query SQL |
| `packages/db/src/schema/salesActivity.ts` | Update Drizzle schema |

### Frontend (apps/dashboard)
| File | Peran |
|------|-------|
| `src/features/import/ActivityDetailTable.tsx` | Tabel import dengan filter + sorting |
| `src/features/import/ImportDetailPage.tsx` | Halaman detail import |

---

## 4. Penjelasan Kode — Backend

### 4.1 Database Migration

```sql
ALTER TABLE sales_activity DROP COLUMN IF EXISTS segmen,
  DROP COLUMN IF EXISTS regional,
  DROP COLUMN IF EXISTS witel,
  DROP COLUMN IF EXISTS createdat_activity,
  DROP COLUMN IF EXISTS activity_start_date,
  DROP COLUMN IF EXISTS pic_name,
  DROP COLUMN IF EXISTS pic_jobtitle,
  DROP COLUMN IF EXISTS pic_role,
  DROP COLUMN IF EXISTS pic_phone;
```

Menggunakan `IF EXISTS` untuk keamanan — jika kolom sudah tidak ada, tidak ada error.

### 4.2 Schema Drizzle (`packages/db/src/schema/salesActivity.ts`)

**SEBELUM:** 20 kolom
```typescript
export const salesActivityTable = pgTable("sales_activity", {
  id: serial("id").primaryKey(),
  nik: text("nik").notNull(),
  fullname: text("fullname"),
  divisi: text("divisi"),
  nipnas: text("nipnas"),
  caName: text("ca_name"),
  // ... 20 fields total
});
```

**SESUDAH:** 13 kolom (kolom tersisa yang relevan)
```typescript
export const salesActivityTable = pgTable("sales_activity", {
  id: serial("id").primaryKey(),
  nik: text("nik").notNull(),
  fullname: text("fullname"),
  divisi: text("divisi"),
  nipnas: text("nipnas"),
  caName: text("ca_name"),
  activityType: text("activity_type"),
  label: text("label"),
  lopid: text("lopid"),
  activityEndDate: text("activity_end_date"),
  activityNotes: text("activity_notes"),
  snapshotDate: text("snapshot_date"),
  importId: integer("import_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**Flow logic:** Schema baru menghasilkan type `SalesActivity` yang hanya punya field-field yang tersisa. Backend import INSERT harus match dengan schema ini.

### 4.3 Excel Parser (`apps/api/src/features/import/excel.ts`)

Fungsi `cleanActivityRows()` melakukan parsing dan mapping kolom Excel ke field database.

**Alur flow:**
```
Excel Row (kolom arbitrary) → mapping manual → cleanActivityRows() → 11 field output
```

```typescript
// Kolom yang di-parse SEBELUM (21 field)
interface DirtyRow {
  nik, fullname, divisi, nipnas, caName, activityType,
  segmen, regional, witel,                   // ← DIHAPUS
  label, lopid,
  createdatActivity, activityStartDate,      // ← DIHAPUS (start date)
  activityEndDate, activityNotes,
  picName, picJobtitle, picRole, picPhone,   // ← DIHAPUS (PIC fields)
  snapshotDate, importId
}

// Kolom yang di-parse SESUDAH (12 field output)
interface CleanRow {
  nik, fullname, divisi, nipnas, caName, activityType,
  label, lopid,
  activityEndDate, activityNotes,
  snapshotDate, importId
}
```

Fungsi `cleanActivityRows()` sekarang mengembalikan hanya 11 field. Kolom yang dihapus (`segmen`, `regional`, `witel`, `createdat_activity`, `activity_start_date`, `pic_name`, `pic_jobtitle`, `pic_role`, `pic_phone`) tidak lagi di-extract dari Excel.

### 4.4 Import Routes (`apps/api/src/features/import/routes.ts`)

Endpoint `POST /import/sales-activity` menerima array Excel rows dan melakukan batch INSERT ke database.

**Alur flow:**
```
Request (Excel rows) → validate → cleanActivityRows() → batch INSERT → Response
```

**SEBELUM:** INSERT 21 kolom
```typescript
await db.insert(salesActivityTable).values(
  rows.map(r => ({
    nik: r.nik,
    fullname: r.fullname,
    divisi: r.divisi,
    nipnas: r.nipnas,
    caName: r.caName,
    activityType: r.activityType,
    segmen: r.segmen,                           // ← DIHAPUS
    regional: r.regional,                       // ← DIHAPUS
    witel: r.witel,                             // ← DIHAPUS
    label: r.label,
    lopid: r.lopid,
    createdatActivity: r.createdatActivity,     // ← DIHAPUS
    activityStartDate: r.activityStartDate,     // ← DIHAPUS
    activityEndDate: r.activityEndDate,
    activityNotes: r.activityNotes,
    picName: r.picName,                         // ← DIHAPUS
    picJobtitle: r.picJobtitle,                 // ← DIHAPUS
    picRole: r.picRole,                         // ← DIHAPUS
    picPhone: r.picPhone,                       // ← DIHAPUS
    snapshotDate: r.snapshotDate,
    importId: r.importId,
  }))
);
```

**SESUDAH:** INSERT 12 kolom
```typescript
await db.insert(salesActivityTable).values(
  rows.map(r => ({
    nik: r.nik,
    fullname: r.fullname,
    divisi: r.divisi,
    nipnas: r.nipnas,
    caName: r.caName,
    activityType: r.activityType,
    label: r.label,
    lopid: r.lopid,
    activityEndDate: r.activityEndDate,
    activityNotes: r.activityNotes,
    snapshotDate: r.snapshotDate,
    importId: r.importId,
  }))
);
```

**Key insight:** Kolom yang dihapus tidak lagi dikirim dari frontend Excel upload. Jika ada data Excel lama yang masih punya kolom tersebut, kolom tersebut tetap tidak di-parse (karena `cleanActivityRows()` sudah tidak extract mereka). Jadi aman untuk data baru maupun proses import ulang.

---

## 5. Penjelasan Kode — Frontend

### 5.1 ActivityDetailTable (`ActivityDetailTable.tsx`)

Komponen utama yang menampilkan tabel hasil import. Mengalami perubahan terbesar.

#### 5.1.1 Interface `ActivityRow`

**SEBELUM:** 19 field (match 19 kolom DB lama)
```typescript
export interface ActivityRow {
  id: number;
  nik: string | null;
  fullname: string | null;
  divisi: string | null;
  nipnas: string | null;
  caName: string | null;
  activityType: string | null;
  label: string | null;
  lopid: string | null;
  activityEndDate: string | null;
  activityNotes: string | null;
  snapshotDate: string | null;
  importId: number | null;
  createdAt: string | null;
  // + 6 fields: segmen, regional, witel, createdatActivity, activityStartDate, dll
}
```

**SESUDAH:** 14 field (match 13 kolom DB + id)
```typescript
export interface ActivityRow {
  id: number;
  nik: string | null;
  fullname: string | null;
  divisi: string | null;
  nipnas: string | null;
  caName: string | null;
  activityType: string | null;
  label: string | null;
  lopid: string | null;
  activityEndDate: string | null;
  activityNotes: string | null;
  snapshotDate: string | null;
  importId: number | null;
  createdAt: string | null;
}
```

#### 5.1.2 `COLUMNS` Array — Definisi Kolom Tabel

Mendefinisikan kolom mana yang ditampilkan di UI. Setiap kolom punya metadata: `field` (nama field data), `label` (header text), `width`, dan opsi tambahan.

```typescript
const COLUMNS: FilterCol[] = [
  { field: "nik", label: "NIK", width: "100px" },
  { field: "fullname", label: "Nama AM", width: "140px" },
  { field: "divisi", label: "Divisi", width: "70px", categorical: true, options: DIVISI_OPTIONS },
  { field: "nipnas", label: "NIPNAS", width: "100px" },
  { field: "caName", label: "CA Name", width: "140px" },
  { field: "activityType", label: "Tipe Aktivitas", width: "130px", categorical: true, options: ACTIVITY_TYPES },
  { field: "label", label: "Label", width: "140px", categorical: true },
  { field: "lopid", label: "LOP ID", width: "90px" },
  { field: "activityEndDate", label: "Tgl Aktivitas", width: "110px" },
  { field: "activityNotes", label: "Catatan", width: "180px", isTextarea: true },
  { field: "snapshotDate", label: "Snapshot Date", width: "100px" },
];
```

- **`categorical: true`** — kolom punya nilai diskrit terbatas → bisa difilter dan di-sort
- **`options`** — daftar opsi tetap untuk kolom kategorikal tertentu
- **`isTextarea: true`** — jika di-edit, render sebagai `<textarea>` bukan `<input>`

Kolom yang dihapus (`segmen`, `regional`, `witel`, `createdat_activity`, `activity_start_date`, `pic_name`, `pic_jobtitle`, `pic_role`, `pic_phone`) **tidak ada** di array ini — tidak akan pernah di-render.

#### 5.1.3 State Management

```typescript
const [page, setPage] = useState(1);                           // Halaman aktif
const [columnFilters, setColumnFilters] = useState<...>({});  // { fieldName: Set<selectedValues> }
const [activeFilterField, setActiveFilterField] = useState<string | null>(null);  // Field filter popup aktif
const [editCell, setEditCell] = useState<EditCell>(null);      // { rowId, field } | null
const [editValue, setEditValue] = useState("");               // Nilai saat edit
const [saving, setSaving] = useState(false);                  // Loading state saat save
const [localRows, setLocalRows] = useState(rows);             // Data lokal (support inline edit)
const [sortField, setSortField] = useState<string | null>(null);  // Kolom yang di-sort
const [sortDir, setSortDir] = useState<SortDir>(null);        // "asc" | "desc" | null
```

#### 5.1.4 Filter Pipeline

```
localRows (data mentah)
  ↓ [search text filter]
filtered (hasil filter teks)
  ↓ [column checkbox filter]
sorted (hasil filter + sort)
  ↓ [pagination]
paged (50 baris per halaman)
```

**Filter teks (search):**
```typescript
const q = currentSearch.trim().toLowerCase();
result = result.filter(r =>
  COLUMNS.some(col => {
    const val = (r as any)[col.field];
    return typeof val === "string" && val.toLowerCase().includes(q);
  })
);
```
→ Mencari di SEMUA kolom yang didefinisikan di `COLUMNS`.

**Filter checkbox per kolom:**
```typescript
for (const [field, selected] of Object.entries(columnFilters)) {
  if (selected.size === 0) continue;
  result = result.filter(r => {
    const val = (r as any)[field] || "";
    return selected.has(val);
  });
}
```
→ Setiap kolom yang punya checkbox filter aktif akan menyaring baris. Jika 0 checkbox dipilih → semua baris kolom itu lolos.

#### 5.1.5 Sorting Logic

```typescript
const sorted = useMemo(() => {
  if (!sortField || !sortDir) return filtered;
  return [...filtered].sort((a, b) => {
    const av = (a as any)[sortField] || "";
    const bv = (b as any)[sortField] || "";
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });
}, [filtered, sortField, sortDir]);
```

**Alur sort per klik:**
1. Klik header kolom → `handleSort(field)`
2. Jika field belum di-sort → set `sortField = field`, `sortDir = "asc"`
3. Jika field sama → toggle: `asc` → `desc` → `null` (clear)
4. Jika field berbeda → switch ke field baru, `sortDir = "asc"`

#### 5.1.6 Filter Popup (`ColumnFilterPopup`)

Komponen popup checkbox untuk filter per kolom. Diposisikan `absolute` tepat di bawah header kolom yang aktif.

**Struktur:**
```
┌─ Header: nama kolom ────── [X] ─┐
│ [ 🔍 Cari...                    ] │
│ [Select All] [Clear]             │
│ ┌─────────────────────────────┐   │
│ │ ☐ Option 1                  │   │  ← max-height 192px, scrollable
│ │ ☑ Option 2                  │   │
│ │ ☐ Option 3                  │   │
│ └─────────────────────────────┘   │
│ 3 dipilih dari 10 nilai           │
└───────────────────────────────────┘
```

**Perbaikan dari versi lama:**
- Popup menggunakan `position: absolute` relatif terhadap `<th>`, bukan `createPortal` ke `document.body`
- Hal ini memperbaiki masalah click tidak berfungsi (karena portal + `stopPropagation` memblokir event bubbling)
- Klik di luar popup → `onClose()`
- `mousedown` events dihentikan propagation agar tidak konflik dengan closing logic

#### 5.1.7 Inline Editing

Double-click cell → muncul input/select/textarea → Enter save / Escape cancel → auto-PATCH ke API `/api/import/:id/rows/:rowId`.

```typescript
// PATCH endpoint menerima { field, value }
// Response: updated row
await apiFetch(`/api/import/${importId}/rows/${rowId}`, {
  method: "PATCH",
  body: JSON.stringify({ field, value: editValue }),
});
```

#### 5.1.8 Props Interface (Perubahan)

**SEBELUM:**
```typescript
export default function ActivityDetailTable({ rows, importId }: { rows: ActivityRow[]; importId: number })
```

**SESUDAH:**
```typescript
export default function ActivityDetailTable({
  rows, importId,
  search,       // ← search string dari parent
  onSearchChange // ← callback ke parent (unused, search dikelola parent)
}: {
  rows: ActivityRow[];
  importId: number;
  search?: string;
  onSearchChange?: (v: string) => void;
})
```

Search dipindahkan ke parent (`ImportDetailPage`) agar toolbar heading + search bisa sejajar horizontal dalam satu komponen.

### 5.2 ImportDetailPage (`ImportDetailPage.tsx`)

Halaman detail yang menampilkan header card (metadata import) + tabel data. Mengelola state `search` dan meneruskannya ke `ActivityDetailTable`.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ [← Kembali]                                             │
│ ┌─ Snapshot Header Card ─────────────────────────────┐  │
│ │ VERSI SNAPSHOT                                     │  │
│ │ SNAPSHOT SALES ACTIVITY WITEL SURAMADU (28 JULI..) │  │
│ │ Import ID: #49 │ Tipe: Sales Activity │ dll       │  │
│ └────────────────────────────────────────────────────┘  │
│ ┌─ Data Table Card ──────────────────────────────────┐  │
│ │ Data Hasil Import (2283 baris tersimpan) [🔍 Search]│  │  ← SEJAJAR
│ │ ─── Table Header (sortable columns) ─────────────── │  │
│ │ #  │ NIK │ Nama AM │ Divisi │ ...                  │  │
│ │ 1  │ ... │ ...     │ DSS    │ ...                  │  │
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**State:**
```typescript
const [search, setSearch] = useState("");  // Search bar dikendalikan di sini
```

**Passing to child:**
```typescript
<ActivityDetailTable
  rows={dataRows}
  importId={importId}
  search={search}           // ← diteruskan
/>
```

---

## 6. Alur Flow Logic Pengerjaan

```
┌──────────────────────────────────────────────────────────────┐
│ STEP 1: Database Migration                                    │
│   └─ ALTER TABLE DROP COLUMN (8 kolom dihapus dari DB)       │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 2: Backend Schema Sync                                  │
│   └─ packages/db/src/schema/salesActivity.ts → 13 kolom       │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 3: Backend Import Logic                                 │
│   ├─ excel.ts → cleanActivityRows() return 11 field          │
│   └─ routes.ts → INSERT batch 12 field                       │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 4: Frontend Interface                                   │
│   ├─ ActivityDetailTable.tsx                                  │
│   │   ├─ COLUMNS array: 11 kolom (tanpa 8 kolom dihapus)     │
│   │   ├─ ActivityRow interface: 14 field                      │
│   │   ├─ Filter pipeline: search → column checkbox → sorted   │
│   │   ├─ ColumnFilterPopup: inline absolute positioning      │
│   │   ├─ Sorting: ASC/DESC per kolom (toggle)                 │
│   │   ├─ Toolbar: dipindahkan ke parent (horizontal layout)    │
│   │   └─ ImportDetailPage: mengelola search state + layout    │
│   └─ ImportDetailPage.tsx → heading + search sejajar         │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 5: Build & Deploy                                       │
│   └─ npm run build (dashboard) → dist/public → API serve     │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Ringkasan Perubahan

| Lokasi | Perubahan | Sebelum | Sesudah |
|--------|-----------|---------|---------|
| DB `sales_activity` | DROP COLUMN | 21 kolom | 13 kolom |
| `salesActivity.ts` schema | field count | 20 field | 13 field |
| `excel.ts` cleanActivityRows | return | ~21 field | 11 field |
| `routes.ts` INSERT | kolom insert | 21 | 12 |
| `ActivityDetailTable.tsx` | kolom display | ~19 | 11 |
| Filter | mekanisme | broken (portal) | works (inline absolute) |
| Sorting | tersedia | tidak ada | semua kolom (ASC/DESC/toggle) |
| Toolbar layout | heading + search | vertikal (2 baris) | horizontal (1 baris) |

---

**Reported by:** Claude Opus 4.6
**Date:** 30 Juli 2026
