/**
 * test/integration/tiered-gyeol-compound-boundary.test.ts
 *
 * P19-A3 regression: GYEOL_SUBS in `template-engine.ts` rewrites particle
 * forms `결X → 흐름X` (or alt) for the standalone noun `결`. Without a
 * `(?<![가-힣])` lookbehind, the pattern also fired inside compound nouns
 * whose final morpheme is `결` — e.g. `연결`, `해결`, `종결`, `직결`,
 * `귀결`, `타결`, `완결` — corrupting `연결을` into `연흐름을`.
 *
 * P19-A3 added a leading-Hangul lookbehind to every entry in GYEOL_SUBS.
 * This test pins the resulting behavior against both directions:
 *
 *   • Trailing-`결` compound + particle  → preserved verbatim.
 *   • Standalone `결X` particle form     → still rewritten to `흐름X` (or
 *     to one of GYEOL_ALTERNATIVES once the per-paragraph 흐름 budget
 *     of 2 is exceeded).
 *
 * `substituteGyeolInParagraph` and `reduceOverusedGyeol` are not exported,
 * so the test drives them via `normalizeRenderedText` (the single export
 * that funnels every paragraph through `reduceOverusedGyeol` at line 141).
 *
 * Per-paragraph 흐름 budget recap (template-engine.ts:781):
 *   appliedFlow = (initial 흐름 count) + (substitutions performed)
 *   if appliedFlow > 2  →  alt path (alt cycles 리듬·자리·호흡·걸음)
 *   else                →  flowForm path (`흐름X`)
 */
import { normalizeRenderedText } from '../../src/report/tiered/template-engine.js';

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

console.log('Tiered GYEOL_SUBS compound-boundary lookbehind\n');

// ---- (1) trailing-`결` compounds with particles must NOT be rewritten ----
//
// Each input is a compound whose final morpheme is `결`, immediately
// followed by one of the 13 GYEOL_SUBS particles. The lookbehind sees
// a Hangul character before `결` and skips. Output must equal input.
const compoundCases: ReadonlyArray<{ readonly label: string; readonly input: string }> = [
  { label: '연결을 (object)', input: '연결을' },
  { label: '연결이 (subject)', input: '연결이' },
  { label: '연결은 (topic)', input: '연결은' },
  { label: '연결로 (directional)', input: '연결로' },
  { label: '연결의 (genitive)', input: '연결의' },
  { label: '연결도 (also)', input: '연결도' },
  { label: '연결만 (only)', input: '연결만' },
  { label: '해결을', input: '해결을' },
  { label: '해결이', input: '해결이' },
  { label: '해결로', input: '해결로' },
  { label: '해결의', input: '해결의' },
  { label: '종결을', input: '종결을' },
  { label: '직결의', input: '직결의' },
  { label: '귀결로', input: '귀결로' },
  { label: '완결이에요', input: '완결이에요' },
  { label: '타결입니다', input: '타결입니다' },
  { label: '연결이라', input: '연결이라' },
  { label: '연결이고', input: '연결이고' },
  { label: '연결처럼', input: '연결처럼' },
  { label: '연결마다', input: '연결마다' },
  // Compound embedded in a sentence — surrounding text varies, but the
  // boundary trigger is `(?<![가-힣])` and only `결` is preceded by
  // Hangul, so the pattern is still skipped.
  { label: 'sentence: 사람과의 연결을 챙겨요', input: '사람과의 연결을 챙겨요' },
  { label: 'sentence: 깊은 해결로 이어져요', input: '깊은 해결로 이어져요' },
];
for (const c of compoundCases) {
  const out = normalizeRenderedText(c.input);
  check(`compound preserved: ${c.label}`, out === c.input, `out="${out}"`);
}

// ---- (2) standalone `결X` particle forms still rewrite (within budget) ----
//
// No preceding Hangul, so the lookbehind passes. With initialFlow = 0 and
// only one substitution, appliedFlow = 1 ≤ 2 → flowForm path → `흐름X`.
const standaloneCases: ReadonlyArray<{
  readonly input: string;
  readonly expected: string;
}> = [
  { input: '결을',     expected: '흐름을' },
  { input: '결이',     expected: '흐름이' },
  { input: '결은',     expected: '흐름은' },
  { input: '결로',     expected: '흐름으로' },
  { input: '결의',     expected: '흐름의' },
  { input: '결도',     expected: '흐름도' },
  { input: '결만',     expected: '흐름만' },
  { input: '결처럼',   expected: '흐름처럼' },
  { input: '결마다',   expected: '흐름마다' },
  { input: '결이라',   expected: '흐름이라' },
  { input: '결이고',   expected: '흐름이고' },
  { input: '결이에요', expected: '흐름이에요' },
  // `결입니다` → `흐름입니다` via GYEOL_SUBS, then post-pass rewrites
  // `흐름입니다` → `흐름이에요` (template-engine.ts:698) for service-voice
  // consistency. End-to-end through normalizeRenderedText, the surface
  // form is `흐름이에요`. (The lookbehind fix preserves the substitution,
  // not the post-pass.)
  { input: '결입니다', expected: '흐름이에요' },
];
for (const c of standaloneCases) {
  const out = normalizeRenderedText(c.input);
  check(
    `standalone rewritten: "${c.input}" → "${c.expected}"`,
    out === c.expected,
    `got="${out}"`,
  );
}

// ---- (3) sentence-position boundary checks ------------------------------
//
// `결X` after whitespace or a punctuation mark is still standalone — the
// preceding character is not Hangul, so the lookbehind passes.
const sentenceStandaloneCases: ReadonlyArray<{
  readonly input: string;
  readonly expected: string;
}> = [
  // After a space — preceding char is `.` then ` `; lookbehind sees ` `, passes.
  // Also exercises the post-`!?` space-injection (line 724) which only fires
  // when the next char is Hangul, so the trailing `결` here doesn't kick it.
  { input: '오늘은 결을 따라가요', expected: '오늘은 흐름을 따라가요' },
  // 결 at sentence start.
  { input: '결이 또렷해요', expected: '흐름이 또렷해요' },
];
for (const c of sentenceStandaloneCases) {
  const out = normalizeRenderedText(c.input);
  check(
    `sentence-position rewrite: "${c.input}" → "${c.expected}"`,
    out === c.expected,
    `got="${out}"`,
  );
}

// ---- (4) compound + standalone in same sentence -------------------------
//
// The compound stays, the standalone rewrites — independence of the two.
//
// Trace: initialFlow = 0 (no `흐름` in input). One substitution at the
// standalone `결로` → applied flow = 1 ≤ 2 → flowForm path → `흐름으로`.
// The compound `연결을` is preceded by `의` (Hangul) → lookbehind blocks.
{
  const input = '관계의 연결을 결로 이어 가요';
  const expected = '관계의 연결을 흐름으로 이어 가요';
  const out = normalizeRenderedText(input);
  check(
    `mixed compound+standalone: "${input}" → "${expected}"`,
    out === expected,
    `got="${out}"`,
  );
}

// ---- (5) alt-path activation when 흐름 budget exhausted -----------------
//
// initialFlow = 2 (`흐름이` and `흐름을` both match `/흐름/g`). The single
// substitution at `결로` brings appliedFlow to 3 (> 2) → alt path. The
// first alt picked is `리듬` (GYEOL_ALTERNATIVES[0]); `리듬` has no
// final consonant, so the no-batchim suffix `로` is applied.
{
  const input = '흐름이 흐름을 결로 흐른다';
  const expected = '흐름이 흐름을 리듬으로 흐른다';
  // 리듬 has no batchim → noBatchim suffix `로` chosen by hasFinalConsonant.
  // (The non-Hangul `흐른다` does not match `/흐름/`.)
  const out = normalizeRenderedText(input);
  check(
    `alt path on budget overflow: "${input}" → "${expected}"`,
    out === expected,
    `got="${out}"`,
  );
}

console.log(`\nTiered GYEOL_SUBS compound-boundary: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
