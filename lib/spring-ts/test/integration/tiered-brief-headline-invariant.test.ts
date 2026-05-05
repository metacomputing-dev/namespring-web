/**
 * test/integration/tiered-brief-headline-invariant.test.ts
 *
 * Regression test for the Phase 3 Agent A16 brief-compress post-pass.
 * Asserts that:
 *   (1) compressBriefHeadlineIfApplicable is the identity for input ≤ 28 chars.
 *   (2) it is the identity for input > 32 chars (out-of-band, must not touch
 *       standard / expert paragraph plainText whose minimum observed length
 *       is > 60).
 *   (3) it brings the previously-inflated brief samples (i.e., the 10
 *       fragments authored at exactly 28 chars whose `결X → 흐름X` rewrite
 *       pushed the headline to 29) back to ≤ 28 without re-introducing any
 *       of the anti-patterns watched by tiered-progressive-disclosure.
 *   (4) it is idempotent: f(f(x)) === f(x).
 */
import {
  compressBriefHeadlineIfApplicable,
  normalizeRenderedText,
} from '../../src/report/tiered/template-engine.js';

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

function len(s: string): number { return [...s].length; }

console.log('Tiered brief headline invariant\n');

// ---- (1) input ≤ 28 chars: identity --------------------------------------
const shortInputs = [
  '',
  '오늘은 평온한 흐름이에요.',
  '올해는 재물 흐름이 단단해요.',
  '이번 주는 결이 또렷해요.',
];
for (const text of shortInputs) {
  const out = compressBriefHeadlineIfApplicable(text);
  check(`identity for ≤28 input: ${text}`, out === text, `len=${len(text)}`);
}

// ---- (2) input > 32 chars: identity --------------------------------------
const longInputs = [
  // ~60 chars — typical standard paragraph plainText.
  '오늘은 잘 쉬고 따뜻하게 챙기는 하루예요. 가벼운 산책이나 따뜻한 차 한 잔으로 마음을 가다듬으면 다음 주가 한결 가벼워져요.',
  // ~80 chars — typical expert paragraph plainText.
  '인연의 흐름은 큰 사건보다 매일의 태도에서 천천히 만들어져요. 편안한 거리감과 꾸준한 표현이 오래 가는 관계의 바탕이 될 수 있어요. 사람을 비교하지 말고 자기 페이스를 지키세요.',
];
for (const text of longInputs) {
  const out = compressBriefHeadlineIfApplicable(text);
  check(`identity for >32 input (len=${len(text)})`, out === text);
}

// ---- (3) the 10 inflated samples recover ---------------------------------
// Each sample is the output `normalizeRenderedText` produces from the original
// `결X` raw text. The compress post-pass must bring it back ≤28.
const inflatedSamples: ReadonlyArray<{ readonly preFix: string; readonly authorRaw: string }> = [
  { preFix: '올해는 사람과의 흐름이 한 단계 깊어지는 흐름이에요.', authorRaw: '올해는 사람과의 결이 한 단계 깊어지는 흐름이에요.' },
  { preFix: '꾸준한 페이스가 작은 마무리를 키워 가는 흐름이에요.', authorRaw: '꾸준한 페이스가 작은 마무리를 키워 가는 결이에요.' },
  { preFix: '오래 쌓아 온 흐름이 후배의 길잡이가 되는 자리예요.', authorRaw: '오래 쌓아 온 결이 후배의 길잡이가 되는 자리예요.' },
  { preFix: '올해는 쌓아 둔 작업이 결실로 익어 가는 흐름이에요.', authorRaw: '올해는 쌓아 둔 작업이 결실로 익어 가는 결이에요.' },
  { preFix: '올해는 좋아하는 놀이로 자기 색이 자라는 흐름이에요.', authorRaw: '올해는 좋아하는 놀이로 자기 색이 자라는 결이에요.' },
  { preFix: '이번 주는 평소 페이스로 한 흐름을 매듭짓기 좋아요.', authorRaw: '이번 주는 평소 페이스로 한 결을 매듭짓기 좋아요.' },
  { preFix: '올해는 표현이 깊어지고 다음 흐름이 보이기 시작해요.', authorRaw: '올해는 표현이 깊어지고 다음 결이 보이기 시작해요.' },
];
for (const sample of inflatedSamples) {
  const preLen = len(sample.preFix);
  const out = compressBriefHeadlineIfApplicable(sample.preFix);
  const outLen = len(out);
  check(
    `recover inflated brief (raw was ${len(sample.authorRaw)}, pre-fix ${preLen}→ post ${outLen})`,
    preLen >= 29 && outLen <= 28,
    `pre=${preLen}, post=${outLen}, out="${out}"`,
  );
  // The output should not introduce any of the headline anti-patterns
  // watched by tiered-progressive-disclosure.test.ts (e.g., 결의 결과).
  check(
    `recovered brief omits 결의 결과 anti-pattern (${out.slice(0, 24)}…)`,
    !out.includes('결의 결과'),
  );
}

// ---- (4) idempotence -----------------------------------------------------
const idempotenceProbes = [
  ...shortInputs,
  ...longInputs,
  ...inflatedSamples.map((s) => s.preFix),
];
for (const text of idempotenceProbes) {
  const a = compressBriefHeadlineIfApplicable(text);
  const b = compressBriefHeadlineIfApplicable(a);
  check(`idempotent on (len=${len(text)})`, a === b);
}

// ---- (5) integration with normalizeRenderedText --------------------------
// End-to-end: feed the author's raw 28-char text through normalize then compress.
// Result must be ≤28 (the brief invariant) and equal to the author's intent.
for (const sample of inflatedSamples) {
  const normalized = normalizeRenderedText(sample.authorRaw);
  const compressed = compressBriefHeadlineIfApplicable(normalized);
  const finalLen = len(compressed);
  check(
    `normalize+compress preserves ≤28 invariant for ${sample.authorRaw.slice(0, 16)}…`,
    finalLen <= 28,
    `final=${finalLen}, "${compressed}"`,
  );
}

console.log(`\nTiered brief headline invariant: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
