/**
 * artifacts/phase3-agent-a21/diff-summary.ts
 *
 * Compare before/after JSONs in before-after/ and emit a focused diff
 * report covering the four service-visible legacy fields the task
 * spec calls out:
 *   - overviewSummary.overallSummary
 *   - dailyFortune.summary
 *   - categoryFortunes[*].summary (5 categories)
 *   - lifeStageFortune.stages[focusIndex].summary
 *
 * Output: artifacts/phase3-agent-a21/before-after-summary.json
 *         artifacts/phase3-agent-a21/before-after-summary.md
 *
 * Run:  npx tsx artifacts/phase3-agent-a21/diff-summary.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, 'before-after');

const fixtureIds = [
  '01-choi-seongsoo-1986-04-19',
  '02-kim-seoyun-2013-07-21',
  '03-park-minji-1992-11-03',
  '04-lee-hajun-2001-01-15',
  '05-kim-jiwon-1990-09-15-strong-gyeokguk',
  '06-jonggyeok-hua-qi-1958-07-11',
];

const TARGET_FIELDS = [
  'overviewSummary.overallSummary',
  'dailyFortune.summary',
  'categoryFortunes.wealth.summary',
  'categoryFortunes.health.summary',
  'categoryFortunes.academic.summary',
  'categoryFortunes.romance.summary',
  'categoryFortunes.family.summary',
  'lifeFortuneOverview.summary',
] as const;

function readJson(p: string): any {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function get(obj: any, dotted: string): unknown {
  const segs = dotted.split('.');
  let cur: any = obj;
  for (const s of segs) {
    if (cur == null) return undefined;
    cur = cur[s];
  }
  return cur;
}

interface FieldDiff {
  field: string;
  before: string | null;
  after: string | null;
  changed: boolean;
}

interface FixtureDiff {
  fixtureId: string;
  label: string;
  fields: FieldDiff[];
}

const diffs: FixtureDiff[] = [];

for (const id of fixtureIds) {
  const beforePath = path.join(DIR, `${id}.before.json`);
  const afterPath = path.join(DIR, `${id}.after.json`);
  if (!fs.existsSync(beforePath) || !fs.existsSync(afterPath)) {
    console.warn(`skipping ${id} — missing before/after`);
    continue;
  }
  const before = readJson(beforePath);
  const after = readJson(afterPath);
  const fields: FieldDiff[] = TARGET_FIELDS.map((field) => {
    const b = get(before.legacyFields, field);
    const a = get(after.legacyFields, field);
    const bs = b == null ? null : String(b);
    const as = a == null ? null : String(a);
    return { field, before: bs, after: as, changed: bs !== as };
  });
  diffs.push({ fixtureId: id, label: before.label ?? id, fields });
}

const summary = {
  generatedAt: new Date().toISOString(),
  fixtureCount: diffs.length,
  trackedFields: TARGET_FIELDS,
  totalFieldChecks: diffs.length * TARGET_FIELDS.length,
  changedCount: diffs.reduce(
    (acc, fx) => acc + fx.fields.filter((f) => f.changed).length,
    0,
  ),
  fixtures: diffs,
};

const outJson = path.join(__dirname, 'before-after-summary.json');
fs.writeFileSync(outJson, `${JSON.stringify(summary, null, 2)}\n`, 'utf-8');
console.log(`wrote ${path.relative(path.dirname(__dirname), outJson)}`);

const md: string[] = [];
md.push('# Phase 3 Agent A21 — before/after summary');
md.push('');
md.push(`Generated at: ${summary.generatedAt}`);
md.push('');
md.push(`- Fixtures: ${summary.fixtureCount}`);
md.push(`- Tracked fields per fixture: ${TARGET_FIELDS.length}`);
md.push(`- Total checks: ${summary.totalFieldChecks}`);
md.push(`- Fields with text change: ${summary.changedCount}`);
md.push('');

for (const fx of diffs) {
  md.push(`## ${fx.fixtureId} — ${fx.label}`);
  md.push('');
  for (const f of fx.fields) {
    md.push(`### ${f.field}`);
    if (!f.changed) {
      md.push('');
      md.push('_unchanged_');
      md.push('');
      continue;
    }
    md.push('');
    md.push('Before:');
    md.push('');
    md.push('```');
    md.push(f.before ?? '(null)');
    md.push('```');
    md.push('');
    md.push('After:');
    md.push('');
    md.push('```');
    md.push(f.after ?? '(null)');
    md.push('```');
    md.push('');
  }
}

const outMd = path.join(__dirname, 'before-after-summary.md');
fs.writeFileSync(outMd, `${md.join('\n')}\n`, 'utf-8');
console.log(`wrote ${path.relative(path.dirname(__dirname), outMd)}`);
