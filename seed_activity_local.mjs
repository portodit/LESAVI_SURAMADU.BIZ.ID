import { createClient } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACTIVITY_FILE = resolve(__dirname, 'apps/api/src/seeds/data/activity.json');

const db = createClient(process.env.DATABASE_URL);

const raw = readFileSync(ACTIVITY_FILE, 'utf8');
const rows = JSON.parse(raw);

console.log(`Loaded ${rows.length} activity rows from seed`);

// Insert in batches
const BATCH = 500;
let total = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const values = batch.map((r, idx) => {
    const offset = idx * 22;
    return `($${offset+1},$${offset+2},$${offset+3},$${offset+4},$${offset+5},$${offset+6},$${offset+7},$${offset+8},$${offset+9},$${offset+10},$${offset+11},$${offset+12},$${offset+13},$${offset+14},$${offset+15},$${offset+16},$${offset+17},$${offset+18},$${offset+19},$${offset+20},$${offset+21},$${offset+22})`;
  }).join(',');
  
  const params = batch.flatMap(r => [
    r.nik||'', r.fullname||'', r.divisi||'', r.segmen||'', r.regional||'',
    r.witel||'', r.nipnas||'', r.ca_name||'', r.activity_type||'',
    r.label||'', r.lopid||'', r.createdat_activity||'', r.activity_start_date||'',
    r.activity_end_date||'', r.pic_name||'', r.pic_jobtitle||'', r.pic_role||'',
    r.pic_phone||'', r.activity_notes||'', r.snapshot_date||null, null, 0
  ]);

  await db.query(`
    INSERT INTO sales_activity (nik,fullname,divisi,segmen,regional,witel,nipnas,ca_name,activity_type,label,lopid,createdat_activity,activity_start_date,activity_end_date,pic_name,pic_jobtitle,pic_role,pic_phone,activity_notes,snapshot_date,import_id,created_at)
    VALUES ${values}
    ON CONFLICT DO NOTHING
  `, params);
  
  total += batch.length;
  console.log(`Inserted ${total}/${rows.length}`);
}

// Create data_imports record
await db.query(`
  INSERT INTO data_imports (type, period, rows_imported, snapshot_date, source_url, auto_telegram_sent, created_at)
  VALUES ('activity', '2026-03', $1, '2026-03-26', 'seed', false, NOW())
`, [rows.length]);

console.log('Done!');
process.exit(0);
