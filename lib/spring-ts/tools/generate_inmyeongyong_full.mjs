/**
 * tools/generate_inmyeongyong_full.mjs
 *
 * Reads delvier `webhanja.db` (verified by PR-P-5 inspection) and emits
 * `data/inmyeongyong_9389_full.json` — the complete 9,495 registrable
 * hanja with reading(s), meaning gloss, radical id, and stroke count.
 *
 * Output schema (json):
 *   {
 *     schemaVersion: '1.0.0-full',
 *     source: 'delvier/KoreaSCourtCode webhanja.db (Korean Supreme Court mirror)',
 *     sourceVersion: '2024-07-16 refresh, post 2024-06-11 expansion',
 *     license: 'database-as-data; readings/glyphs are factual public-domain',
 *     totalCount: 9495,
 *     officialCount: 9389,
 *     deltaNote: '+106 entries vs official; reconciliation pending',
 *     entries: [
 *       {
 *         hanja: '佳',                         // String.fromCodePoint(parseInt(cd, 16))
 *         codepoint: 'U+4F73',                  // hex
 *         readings: ['가'],                     // ineum split on ','
 *         meaning: '아름답다',                   // dic (may be null when empty)
 *         radicalId: 9,                          // rad_stroke.rad_id
 *         strokeCount: 8,                        // rad_stroke.stroke
 *       },
 *       ...
 *     ]
 *   }
 *
 * The original `data/inmyeongyong_9389.json` (50-char seed) is kept as
 * the conservative default; consumers opt into the full set by reading
 * `inmyeongyong_9389_full.json` instead.
 *
 * Usage:
 *   node tools/generate_inmyeongyong_full.mjs
 *   WEBHANJA_DB=<path> node tools/generate_inmyeongyong_full.mjs
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');

const DEFAULT_DB = path.resolve(SPRING_TS_ROOT, '../../../spring-val/claude/hanja-data/raw/webhanja.db');
const DB_PATH = process.env.WEBHANJA_DB || DEFAULT_DB;

const OUT_PATH = path.resolve(SPRING_TS_ROOT, 'data/inmyeongyong_9389_full.json');

if (!fs.existsSync(DB_PATH)) {
  console.error(`webhanja.db not found at: ${DB_PATH}`);
  process.exit(2);
}

const db = new Database(DB_PATH, { readonly: true });

// 1:N rad_stroke for some hanja → take first row only via aggregation (MIN).
// Each hanja_info.cd is unique (no duplicates among isin=1 base rows).
const rows = db.prepare(`
  SELECT h.cd, h.ineum, h.dic,
         MIN(r.rad_id) AS rad_id, MIN(r.stroke) AS stroke
  FROM hanja_info h LEFT JOIN rad_stroke r ON h.cd = r.cd
  WHERE h.isin = 1
  GROUP BY h.cd
  ORDER BY h.cd ASC
`).all();

console.log(`Read ${rows.length} registrable rows (deduped) from webhanja.db`);

const entries = [];
let dropped = 0;
const droppedRanges = new Map();
for (const r of rows) {
  const cp = parseInt(r.cd, 16);
  if (Number.isNaN(cp) || cp <= 0) {
    dropped += 1;
    continue;
  }
  let hanja;
  try {
    hanja = String.fromCodePoint(cp);
  } catch (err) {
    dropped += 1;
    continue;
  }

  // Note: not range-filtering. Korean court list includes
  // CJK Unified (U+4E00..U+9FFF), Extension A (U+3400..U+4DBF), and
  // Extension B (U+20000..U+2A6DF). Any out-of-range codepoint is logged.
  if (!((cp >= 0x3400 && cp <= 0x4DBF) || (cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x20000 && cp <= 0x2A6DF))) {
    const bucket = `0x${(cp >> 12).toString(16)}xxx`;
    droppedRanges.set(bucket, (droppedRanges.get(bucket) ?? 0) + 1);
  }

  const readings = (r.ineum ?? '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const meaning = r.dic && r.dic.trim() ? r.dic.trim() : null;

  entries.push({
    hanja,
    codepoint: `U+${r.cd.toUpperCase().padStart(4, '0')}`,
    readings,
    meaning,
    radicalId: r.rad_id ?? null,
    strokeCount: r.stroke ?? null,
  });
}

if (droppedRanges.size > 0) {
  console.log(`Codepoint outside standard CJK ranges:`);
  for (const [b, n] of droppedRanges.entries()) console.log(`  ${b}: ${n} entries (kept; not range-filtered)`);
}

console.log(`Mapped ${entries.length} entries; dropped ${dropped} invalid codepoints.`);

// Stats
const noReading = entries.filter((e) => e.readings.length === 0).length;
const multiReading = entries.filter((e) => e.readings.length > 1).length;
const noMeaning = entries.filter((e) => !e.meaning).length;
const noRadical = entries.filter((e) => e.radicalId === null).length;

console.log(`  multi-reading entries: ${multiReading} (${((multiReading / entries.length) * 100).toFixed(1)}%)`);
console.log(`  no-reading entries:    ${noReading}`);
console.log(`  no-meaning entries:    ${noMeaning} (${((noMeaning / entries.length) * 100).toFixed(1)}%)`);
console.log(`  no-radical entries:    ${noRadical}`);

const output = {
  schemaVersion: '1.0.0-full',
  source: 'delvier/KoreaSCourtCode webhanja.db (Korean Supreme Court mirror)',
  sourceVersion: '2024-07-16 refresh, post 2024-06-11 expansion',
  license: 'database-as-data fields are factual; pillars/glyphs/readings public-domain',
  generatedAt: new Date().toISOString(),
  totalCount: entries.length,
  officialCount: 9389,
  deltaNote: `delvier ${entries.length} vs official 9389; +${entries.length - 9389} delta — reconciliation pending`,
  fieldStats: {
    multiReading,
    noReading,
    noMeaning,
    noRadical,
  },
  entries,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 0) + '\n');
const sizeKB = (fs.statSync(OUT_PATH).size / 1024).toFixed(1);
console.log(`\nWrote ${OUT_PATH} (${sizeKB} KB, ${entries.length} entries)`);

db.close();
