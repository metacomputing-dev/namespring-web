/**
 * tools/measure_normalize_inflate_delta.ts
 *
 * Phase 3 Agent A16 (Task 1) — measures the brief-tier headline length
 * crossing introduced by `normalizeRenderedText()` and shows the recovery
 * achieved by the new `compressBriefHeadlineIfApplicable()` post-pass.
 *
 * Method
 * ------
 * For every brief fragment chosen by the selector across the 15 baseline
 * fixtures, render the fragment via `renderFragment(...)` so slot tokens
 * (periodLabel, elementName, ...) are resolved exactly the way the
 * end-user pipeline does. Then split the headline path into two paths:
 *
 *   pre-fix path: take the rendered token stream, re-join the text tokens
 *                 with the same join rule, and apply only `normalizeRenderedText`
 *                 (no compress). This reproduces the pre-PR behaviour.
 *
 *   post-fix path: take `rendered.plainText`, which already includes the
 *                  brief-compress post-pass.
 *
 * The crossover count is the number of (fixture × period × category) cells
 * where pre-fix length > 28 and post-fix length ≤ 28. That is the deliverable
 * for Task 1.
 *
 * Usage:
 *   npx tsx tools/measure_normalize_inflate_delta.ts
 *
 * Output:
 *   artifacts/phase3-agent-a16/normalize-inflate-delta.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeSaju } from '../src/saju-adapter.js';
import { buildFeatureVector } from '../src/report/tiered/feature-selector.js';
import { loadFragmentRegistry } from '../src/report/tiered/fragment-registry.js';
import { selectFragment, buildSelectionSeed } from '../src/report/tiered/fragment-selector.js';
import {
  normalizeRenderedText,
  renderFragment,
  compressBriefHeadlineIfApplicable,
} from '../src/report/tiered/template-engine.js';
import type { BirthInfo } from '../src/types.js';
import type { ParagraphToken } from '../src/report/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(SPRING_TS_ROOT, 'test', 'fixtures', 'spring_ts_baseline_cases.json');
const OUTPUT_PATH = path.join(
  SPRING_TS_ROOT,
  'artifacts',
  'phase3-agent-a16',
  'normalize-inflate-delta.json',
);

const MAX_BRIEF_KOREAN_CHARS = 28;
const TARGET_DATE = new Date('2026-05-02T00:00:00+09:00');

interface Fixture {
  readonly id: string;
  readonly label: string;
  readonly birth: BirthInfo;
  readonly options?: Record<string, unknown>;
}

const PERIODS = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'] as const;
const CATEGORIES = [
  'overall',
  'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
] as const;

function codePointLength(text: string): number {
  return [...text].length;
}

/** Reproduces the pre-fix path: same join rule as `plainTextFromTokens`,
 *  same `normalizeRenderedText` call, but skipping the compress post-pass. */
function preFixPlainText(tokens: readonly ParagraphToken[]): string {
  let out = '';
  const startsWithParticle = (v: string) => /^(은|는|이|가|을|를|의|도|만|부터|까지|처럼|보다|으로|로|에서|에게|께|와|과|이나|나|이라|라|이에요|예요|입니다|입니다만|,|\.|!|\?|\)|\])/u.test(v.trimStart());
  const endsWithWhitespace = (v: string) => /\s$/u.test(v);
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (tok.kind === 'text') { out += tok.value; continue; }
    if (out && !endsWithWhitespace(out)) out += ' ';
    out += `#${tok.label}`;
    const next = tokens[i + 1];
    if (next?.kind === 'text' && next.value && !startsWithParticle(next.value)) out += ' ';
  }
  return normalizeRenderedText(out.replace(/\s{2,}/g, ' '));
}

async function main(): Promise<void> {
  const fixtureFile = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8')) as { readonly fixtures: readonly Fixture[] };
  const fixtures = fixtureFile.fixtures;

  const registry = loadFragmentRegistry();

  let observed = 0;
  let bothOver = 0;     // pre>28 AND post>28 (author-side too long even after compress)
  let crossedDown = 0;  // pre>28 AND post≤28 (the targeted fix)
  let bothUnder = 0;    // both ≤28
  let regression = 0;   // pre≤28 AND post>28 (should be 0 — sanity)

  let maxRecoveredDelta = 0;
  const recoveredSamples: any[] = [];
  const stillOverSamples: any[] = [];

  // idempotence sanity: compress applied twice equals once.
  let idempotenceFailures = 0;

  for (const fixture of fixtures) {
    const summary = await analyzeSaju(fixture.birth, fixture.options as any);
    const feature = buildFeatureVector(summary, fixture.birth, TARGET_DATE);
    const seedKey = buildSelectionSeed(fixture.birth, TARGET_DATE);

    for (const period of PERIODS) {
      for (const category of CATEGORIES) {
        const frag = selectFragment(registry, category, period, 'brief', feature, { seedKey });
        if (!frag) continue;
        observed += 1;
        const rendered = renderFragment(frag, { seedKey, periodLabel: 'today', feature });
        const postFixText = rendered.plainText;
        const preFixText = preFixPlainText(rendered.tokens);
        const preFixLen = codePointLength(preFixText);
        const postFixLen = codePointLength(postFixText);

        // Idempotence: compress applied to already-compressed plainText.
        const recompressed = compressBriefHeadlineIfApplicable(postFixText);
        if (recompressed !== postFixText) idempotenceFailures += 1;

        if (preFixLen > MAX_BRIEF_KOREAN_CHARS && postFixLen > MAX_BRIEF_KOREAN_CHARS) {
          bothOver += 1;
          if (stillOverSamples.length < 10) {
            stillOverSamples.push({
              fixtureId: fixture.id, period, category,
              fragmentId: frag.fragmentId,
              preFix: preFixText, post: postFixText,
              preFixLen, postFixLen,
            });
          }
        } else if (preFixLen > MAX_BRIEF_KOREAN_CHARS && postFixLen <= MAX_BRIEF_KOREAN_CHARS) {
          crossedDown += 1;
          const delta = preFixLen - postFixLen;
          if (delta > maxRecoveredDelta) maxRecoveredDelta = delta;
          recoveredSamples.push({
            fixtureId: fixture.id, period, category,
            fragmentId: frag.fragmentId,
            preFix: preFixText, post: postFixText,
            preFixLen, postFixLen,
          });
        } else if (preFixLen <= MAX_BRIEF_KOREAN_CHARS && postFixLen <= MAX_BRIEF_KOREAN_CHARS) {
          bothUnder += 1;
        } else {
          regression += 1;
        }
      }
    }
  }

  const report = {
    schemaVersion: 'spring-ts.phase3-agent-a16.normalize-inflate-delta.v2',
    purpose:
      'Brief-tier inflation crossover audit. Compares the headline length BEFORE the brief-compress ' +
      'post-pass (= prior production behaviour) to the length AFTER the post-pass (= this PR). ' +
      'Crossover count is the number of cells where the post-pass converted >28-char output back to ≤28.',
    generatedAt: new Date().toISOString(),
    targetDate: TARGET_DATE.toISOString(),
    fixtureCount: fixtures.length,
    observed,
    maxBriefKoreanChars: MAX_BRIEF_KOREAN_CHARS,
    bothOver,
    crossedDown,
    bothUnder,
    regression,
    maxRecoveredDelta,
    idempotenceFailures,
    recoveredSamples,
    stillOverSamples,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`brief headlines surveyed = ${observed}`);
  console.log(`  pre>28 AND post>28  = ${bothOver}    (author-side over; out of A16 scope)`);
  console.log(`  pre>28 AND post≤28  = ${crossedDown} (recovered by brief-compress)`);
  console.log(`  pre≤28 AND post≤28  = ${bothUnder}`);
  console.log(`  pre≤28 AND post>28  = ${regression}  (must be 0 — would be a regression)`);
  console.log(`max recovered delta = ${maxRecoveredDelta}`);
  console.log(`idempotence failures = ${idempotenceFailures}`);
  if (recoveredSamples.length > 0) {
    console.log(`\nRecovered samples:`);
    for (const s of recoveredSamples.slice(0, 10)) {
      console.log(`  [${s.period}/${s.category}] ${s.fragmentId} (${s.preFixLen}→${s.postFixLen})`);
      console.log(`    pre:  ${s.preFix}`);
      console.log(`    post: ${s.post}`);
    }
  }
}

await main();
