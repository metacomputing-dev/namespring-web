/**
 * tools/measure_brief_headline_invariant.ts
 *
 * Phase 3 Agent A16 (Task 1) — measurement script that probes whether the
 * brief-tier headline ever exceeds the contract's "≤ 28 Korean characters"
 * invariant after `template-engine.ts:normalizeRenderedText` has rewritten
 * the text. This is a non-mutating audit: we run `buildTieredMatrix` over
 * a deterministic fixture sweep and report any (period × category) cell
 * whose `brief.headline` length (Unicode code-point count) is over 28.
 *
 * Usage:
 *   npx tsx tools/measure_brief_headline_invariant.ts
 *
 * Output:
 *   artifacts/phase3-agent-a16/brief-headline-invariant.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeSaju } from '../src/saju-adapter.js';
import { buildTieredMatrix } from '../src/report/tiered/build-tiered-matrix.js';
import type { BirthInfo } from '../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(SPRING_TS_ROOT, 'test', 'fixtures', 'spring_ts_baseline_cases.json');
const OUTPUT_PATH = path.join(
  SPRING_TS_ROOT,
  'artifacts',
  'phase3-agent-a16',
  'brief-headline-invariant.json',
);

const MAX_BRIEF_KOREAN_CHARS = 28;
const TARGET_DATE = new Date('2026-05-02T00:00:00+09:00');

interface Fixture {
  readonly id: string;
  readonly label: string;
  readonly birth: BirthInfo;
  readonly options?: Record<string, unknown>;
}

interface Violation {
  readonly fixtureId: string;
  readonly fixtureLabel: string;
  readonly period: string;
  readonly category: string;
  readonly headline: string;
  readonly codePointLength: number;
  readonly fragmentId?: string;
}

function codePointLength(text: string): number {
  return [...text].length;
}

async function main(): Promise<void> {
  const fixtureFile = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8')) as { readonly fixtures: readonly Fixture[] };
  const fixtures = fixtureFile.fixtures;

  const violations: Violation[] = [];
  let cellCount = 0;
  let maxLength = 0;
  let maxLengthExample: Violation | null = null;

  // Histogram of code-point lengths across all surveyed brief headlines.
  const histogram = new Map<number, number>();

  for (const fixture of fixtures) {
    const summary = await analyzeSaju(fixture.birth, fixture.options as any);
    const matrix = buildTieredMatrix(summary, fixture.birth, TARGET_DATE, {
      enabled: true,
      contentSource: 'authored',
      namingReport: null,
    });
    if (!matrix) continue;

    for (const [periodKey, period] of Object.entries(matrix.periods)) {
      const cells = [
        { category: 'overall' as const, cell: period.overall },
        ...Object.entries(period.byCategory).map(([category, cell]) => ({ category, cell })),
      ];

      for (const { category, cell } of cells) {
        cellCount += 1;
        const headline = cell.brief.headline ?? '';
        const len = codePointLength(headline);
        histogram.set(len, (histogram.get(len) ?? 0) + 1);
        if (len > maxLength) {
          maxLength = len;
          maxLengthExample = {
            fixtureId: fixture.id,
            fixtureLabel: fixture.label,
            period: periodKey,
            category,
            headline,
            codePointLength: len,
            fragmentId: cell.selectedFragments?.brief?.fragmentId,
          };
        }
        if (len > MAX_BRIEF_KOREAN_CHARS) {
          violations.push({
            fixtureId: fixture.id,
            fixtureLabel: fixture.label,
            period: periodKey,
            category,
            headline,
            codePointLength: len,
            fragmentId: cell.selectedFragments?.brief?.fragmentId,
          });
        }
      }
    }
  }

  // Bucketize histogram for compact output.
  const histogramObj: Record<string, number> = {};
  for (const len of [...histogram.keys()].sort((a, b) => a - b)) {
    histogramObj[String(len)] = histogram.get(len)!;
  }

  const report = {
    schemaVersion: 'spring-ts.phase3-agent-a16.brief-headline-invariant.v1',
    purpose:
      'Audit how the brief-tier ≤28-Korean-character invariant fares after normalizeRenderedText() runs. ' +
      'Used to decide whether brief depth needs an opt-out path through the inflate-style regex rewrites.',
    generatedAt: new Date().toISOString(),
    targetDate: TARGET_DATE.toISOString(),
    fixtureCount: fixtures.length,
    cellCount,
    maxBriefKoreanChars: MAX_BRIEF_KOREAN_CHARS,
    maxObservedLength: maxLength,
    maxObservedExample: maxLengthExample,
    violationCount: violations.length,
    violationRatio: cellCount > 0 ? violations.length / cellCount : 0,
    histogram: histogramObj,
    violations: violations.slice(0, 50),
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`cells surveyed = ${cellCount}, max headline length = ${maxLength}, violations = ${violations.length}`);
  if (violations.length > 0) {
    console.log('\nTop 5 violations:');
    for (const v of violations.slice(0, 5)) {
      console.log(`  [${v.fixtureId}/${v.period}/${v.category}] (${v.codePointLength}) ${v.headline}`);
    }
  }
}

await main();
