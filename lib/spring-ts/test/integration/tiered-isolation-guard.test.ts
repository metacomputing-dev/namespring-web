/**
 * test/integration/tiered-isolation-guard.test.ts
 *
 * NO_AI_POLICY isolation guard.
 *
 * Tiered matrix narrative content (`data/narrative/**`) is AI-derived
 * T1_HYPOTHESIS material per `docs/NO_AI_POLICY.md`. The scoring /
 * judgment layer must NEVER import it — narrative is display-only.
 *
 * This test inspects the source code of every file in `src/calculator/**`,
 * `src/saju-*.ts`, `src/spring-engine.ts`, `src/spring-evaluator.ts` and
 * fails if any of them references `data/narrative/`, `report/tiered/`, or
 * `tiered/`. The check is purely static (string scan) so it runs without
 * compiling — keeps the gate fast and dependency-free.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');

const SCORING_FILE_PATTERNS = [
  'src/calculator',           // directory — recurse
  'src/saju-adapter.ts',
  'src/saju-calculator.ts',
  'src/spring-engine.ts',
  'src/spring-evaluator.ts',
  'src/core',                 // shared evaluator core — same isolation rule
];

const FORBIDDEN_PATTERNS = [
  /data\/narrative\//,
  /report\/tiered\//,
  /from ['"][^'"]*\btiered\b[^'"]*['"]/, // import from "...tiered..." path
];

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

function listFiles(target: string): string[] {
  const full = path.join(SPRING_TS_ROOT, target);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return [full];
  const out: string[] = [];
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile() && (p.endsWith('.ts') || p.endsWith('.mjs'))) out.push(p);
    }
  }
  walk(full);
  return out;
}

console.log('Tiered isolation guard — scoring layer must not import narrative\n');

const allFiles = SCORING_FILE_PATTERNS.flatMap(listFiles);
check('At least one scoring file scanned', allFiles.length > 0,
  `${allFiles.length} files`);

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  for (const pattern of FORBIDDEN_PATTERNS) {
    const match = pattern.exec(content);
    const rel = path.relative(SPRING_TS_ROOT, file);
    check(
      `${rel} does not reference ${pattern.source}`,
      match === null,
      match ? `matched: ${match[0].slice(0, 80)}` : undefined,
    );
  }
}

console.log(`\nTiered isolation guard: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
