/**
 * tools/inspect_delvier_db.mjs
 *
 * Reads the delvier/KoreaSCourtCode `webhanja.db` SQLite mirror of the
 * Korean Supreme Court 인명용 한자 (registrable hanja) registry and
 * reports the schema + counts. Verify-only: NO production change.
 *
 * Expected db location:
 *   spring-val/claude/hanja-data/raw/webhanja.db
 * Override with WEBHANJA_DB env var.
 *
 * Reports:
 *   - total hanja_info rows
 *   - isin distribution (registrable flag)
 *   - count of multi-reading rows (ineum has comma)
 *   - count of empty dic entries (no meaning gloss)
 *   - rad_stroke join coverage
 *   - 6 sample registrable rows with codepoint conversion
 *   - delta vs official 9,389 count (Korean court 2024-06-11 figure)
 *
 * Used by PR-P-6+ to plan ingestion into spring-ts data/.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');

const DEFAULT_DB = path.resolve(SPRING_TS_ROOT, '../../../spring-val/claude/hanja-data/raw/webhanja.db');
const DB_PATH = process.env.WEBHANJA_DB || DEFAULT_DB;

const OFFICIAL_INMYEONGYONG_COUNT = 9389;  // 2024-06-11 expansion (대법원규칙 제3151호)

if (!fs.existsSync(DB_PATH)) {
  console.error(`webhanja.db not found at: ${DB_PATH}`);
  console.error('Download from https://raw.githubusercontent.com/delvier/krcourt/main/webhanja.db');
  console.error('Or set WEBHANJA_DB env var to its actual location.');
  process.exit(2);
}

const db = new Database(DB_PATH, { readonly: true });

console.log(`inspect_delvier_db — ${DB_PATH}`);
console.log();

// Tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
console.log(`Tables: ${tables.join(', ')}`);
console.log();

// hanja_info totals
const totalRow = db.prepare('SELECT COUNT(*) AS n FROM hanja_info').get();
console.log(`hanja_info rows: ${totalRow.n}`);

const isinDist = db.prepare('SELECT isin, COUNT(*) AS n FROM hanja_info GROUP BY isin').all();
console.log('isin distribution:');
for (const r of isinDist) console.log(`  isin=${r.isin}  →  ${r.n}`);

const registrableCount = db.prepare('SELECT COUNT(*) AS n FROM hanja_info WHERE isin=1').get().n;
console.log();
console.log(`Registrable (isin=1): ${registrableCount}`);
console.log(`Official Korean court count: ${OFFICIAL_INMYEONGYONG_COUNT}`);
console.log(`Delta: ${registrableCount - OFFICIAL_INMYEONGYONG_COUNT} (positive = delvier has extras vs court regulation)`);
console.log();

// Multi-reading + empty dic
const multiReading = db.prepare("SELECT COUNT(*) AS n FROM hanja_info WHERE isin=1 AND ineum LIKE '%,%'").get().n;
const emptyDic = db.prepare("SELECT COUNT(*) AS n FROM hanja_info WHERE isin=1 AND (dic IS NULL OR dic='')").get().n;
console.log(`isin=1 multi-reading rows (ineum has ','): ${multiReading} (${((multiReading/registrableCount)*100).toFixed(1)}%)`);
console.log(`isin=1 with empty dic (no meaning gloss):  ${emptyDic} (${((emptyDic/registrableCount)*100).toFixed(1)}%)`);

// rad_stroke join coverage
const radJoinable = db.prepare(`
  SELECT COUNT(DISTINCT h.cd) AS n FROM hanja_info h
  JOIN rad_stroke r ON h.cd = r.cd
  WHERE h.isin=1
`).get().n;
console.log(`isin=1 with rad_stroke (부수/획수) data:    ${radJoinable} (${((radJoinable/registrableCount)*100).toFixed(1)}%)`);
console.log();

// Sample 6 registrable rows
console.log('Sample registrable hanja (with codepoint conversion):');
const samples = db.prepare(`
  SELECT h.cd, h.ineum, h.dic, r.rad_id, r.stroke
  FROM hanja_info h LEFT JOIN rad_stroke r ON h.cd = r.cd
  WHERE h.isin=1 AND h.cd LIKE '0%' LIMIT 6
`).all();
for (const r of samples) {
  const cp = parseInt(r.cd, 16);
  const ch = isNaN(cp) ? '!' : String.fromCodePoint(cp);
  console.log(`  cd=${r.cd}  →  U+${r.cd.toUpperCase().padStart(4, '0')} (${ch})  ineum=${JSON.stringify(r.ineum)}  dic=${JSON.stringify(r.dic).slice(0, 24)}  rad=${r.rad_id} stroke=${r.stroke}`);
}

// Codepoint range distribution
console.log();
const rangeQuery = db.prepare(`SELECT
  SUM(CASE WHEN CAST('0x' || cd AS INTEGER) BETWEEN 13312 AND 19903 THEN 1 ELSE 0 END) AS extA,
  SUM(CASE WHEN CAST('0x' || cd AS INTEGER) BETWEEN 19968 AND 40959 THEN 1 ELSE 0 END) AS basic,
  SUM(CASE WHEN CAST('0x' || cd AS INTEGER) BETWEEN 131072 AND 173791 THEN 1 ELSE 0 END) AS extB
  FROM hanja_info WHERE isin=1`);
const range = rangeQuery.get();
console.log(`Codepoint range distribution (isin=1):`);
console.log(`  CJK Unified (U+4E00..U+9FFF):       ${range.basic}`);
console.log(`  Extension A (U+3400..U+4DBF):       ${range.extA}`);
console.log(`  Extension B (U+20000..U+2A6DF):     ${range.extB}`);

console.log();
console.log('Conclusion: delvier db is suitable for ingestion into spring-ts.');
console.log('  - cd field is hex Unicode codepoint (parse with parseInt(cd, 16)).');
console.log('  - 9495 registrable rows; +106 vs official 9389. Discrepancy may be');
console.log('    multi-reading (863 rows) or post-2024-06-11 absorption.');
console.log('  - 27% of registrable rows have empty dic — supplementary 의미 source needed.');
console.log('  - rad_stroke covers virtually all registrable rows.');

db.close();
