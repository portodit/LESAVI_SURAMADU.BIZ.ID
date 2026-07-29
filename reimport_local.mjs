import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

import { db, salesFunnelTable, dataImportsTable, accountManagersTable, masterCustomerTable } from '@workspace/db';
import { eq, and, sql } from 'drizzle-orm';
import { cleanFunnelRows } from '../features/import/excel.js';

const SNAPSHOT_DATE = '2026-06-24';
const PERIOD = '2026-06';

async function main() {
  // Read file from local
  const buf = require('fs').readFileSync('/tmp/funnel60.xlsx');
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, raw: true });

  // Detect header row
  function detectHeaderRow(rows) {
    const keyCols = new Set(['NIK', 'NAMA_AM', 'STANDARD_NAME', 'PERIODE', 'TARGET_REVENUE', 'REAL_REVENUE']);
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const row = rows[i];
      const vals = row.map(v => v != null ? String(v).trim().replace(/^Sum of\s+/i, '') : '');
      const found = vals.filter(v => keyCols.has(v)).length;
      if (found >= 2) return i;
    }
    return 0;
  }

  // Normalize headers
  function normalizeColumns(headers) {
    return headers.map(h => {
      if (h == null) return '';
      const s = String(h).trim().replace(/^Sum of\s+/i, '').replace(/\s+/g, '_').toUpperCase();
      return s;
    });
  }

  // Convert to objects
  function rowsToObjects(rows, headerRowIdx) {
    const headers = normalizeColumns(rows[headerRowIdx]);
    const dataRows = rows.slice(headerRowIdx + 1);
    return dataRows.filter(r => r.some(v => v != null)).map(r => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = r[i] ?? null; });
      return obj;
    });
  }

  const headerRowIdx = detectHeaderRow(rawRows);
  const rows = rowsToObjects(rawRows, headerRowIdx);
  
  console.log('Total rows from xlsx:', rows.length);
  console.log('Sample row:', JSON.stringify(rows[0], null, 2));
  
  // Apply cleanFunnelRows
  const cleaned = cleanFunnelRows(rows, {
    preferPembuat: true,
    skipIsReportFilter: true,
    skipWitelFilter: true,
  });
  
  console.log('After cleanFunnelRows:', cleaned.length);
  console.log('Sample cleaned row:', JSON.stringify(cleaned[0], null, 2));
  
  // Delete old data for import 60
  await db.delete(salesFunnelTable).where(eq(salesFunnelTable.importId, 60));
  await db.delete(dataImportsTable).where(eq(dataImportsTable.id, 60));
  console.log('Deleted old snapshot 60');
  
  // Insert new import record
  const [imp] = await db.insert(dataImportsTable).values({
    type: 'funnel',
    rowsImported: cleaned.length,
    period: PERIOD,
    snapshotDate: SNAPSHOT_DATE,
    sourceUrl: 'local:/tmp/funnel60.xlsx',
    autoTelegramSent: false,
  }).returning();
  
  console.log('Created import:', imp.id);
  
  // Insert rows
  for (let i = 0; i < cleaned.length; i += 200) {
    const batch = cleaned.slice(i, i + 200).map(row => ({
      ...row,
      snapshotDate: SNAPSHOT_DATE,
      importId: imp.id,
    }));
    await db.insert(salesFunnelTable).values(batch);
    console.log('Inserted batch', i/200 + 1, 'of', Math.ceil(cleaned.length/200));
  }
  
  console.log('Done! Reimported', cleaned.length, 'rows');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
