
import fs from 'fs';
import JSZip from 'jszip';

const buffer = fs.readFileSync('/tmp/PERFORMANSI_RLEGS_2026.xlsx');

console.log('File size:', buffer.length);

const zip = await JSZip.loadAsync(buffer);
const files = Object.keys(zip.files);

console.log('Total files in xlsx:', files.length);
console.log('Pivot cache files:', files.filter(f => f.includes('pivotCache')));

// Check for pivot cache records
if (files.includes('xl/pivotCache/pivotCacheRecords2.xml')) {
  const cacheRec = await zip.files['xl/pivotCache/pivotCacheRecords2.xml'].async('string');
  const recordCount = (cacheRec.match(/<r>/g) || []).length;
  console.log('Pivot cache records found:', recordCount);
}
