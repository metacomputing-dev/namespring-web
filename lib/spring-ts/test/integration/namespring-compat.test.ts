/**
 * test/integration/namespring-compat.test.ts
 *
 * PR-Q-27: NameSpring (consumer app) backward-compatibility contract.
 *
 * NameSpring (irumbom-poc) imports `SpringEngine` from `@spring/spring-engine`
 * (vite alias → `lib/spring-ts/src`). It calls these methods:
 *   - `springEngine.getSpringReport(request)` → SpringReport
 *   - `springEngine.getFortuneReport(request)` → FortuneReport
 *   - (other methods exist but NameSpring only uses these two paths)
 *
 * NameSpring's request **never includes `precisionConfig`** — it passes only
 * `birth`, `surname`, `givenName`, optional `sajuTimePolicy`. So this test
 * simulates that exact shape and asserts the response has all fields
 * NameSpring's UI components access (with the types they expect).
 *
 * Field inventory (manually surveyed 2026-05-01):
 *   FortuneReport: overviewSummary, lifeFortuneOverview, personality,
 *     strengthsWeaknesses, cautions, daily/weekly/monthly/yearlyFortune,
 *     categoryFortunes{wealth,health,academic,romance,family}{title,category,
 *     stars,summary,advice[{text,reason}],caution{signal,response,reason}},
 *     nameCompatibility, lifeStageFortune
 *   SpringReport: namingReport.name.{fullHangul,fullHanja}, rank
 *   SajuReport: pillars (with year/month/day/hour), dayMaster.polarity
 *
 * What this test asserts:
 *   1. Existing field shape preserved when NameSpring's "no-precisionConfig"
 *      request is run.
 *   2. Field types match what UI assumes (string title, number stars, array
 *      advice, etc.) — type guarantees so React doesn't crash on a field.
 *   3. New opt-in additions (subDomains, axisStrength, evidence, palace,
 *      naeum) that surface by default DO NOT break NameSpring's optional
 *      chaining + .filter(Boolean) patterns — i.e., either undefined or a
 *      non-throwing value.
 *
 * If this test ever fails, NameSpring's runtime UI is at risk. New default
 * flips that surface in NameSpring's view should land with NameSpring dev
 * coordination per `lib/spring-ts/FRONTEND_EXTENSIONS.md`.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, '../../namespring/node_modules/sql.js/dist/sql-wasm.wasm');

const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: any, options?: any) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlStr.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlStr.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlStr.includes('sql-wasm.wasm') || urlStr.startsWith('https://sql.js.org/') || urlStr === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  return originalFetch(url, options);
};

import { SpringEngine } from '../../src/index.js';

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) {
  if (repo) {
    (repo as any).wasmUrl = WASM_PATH;
  }
}
await engine.init();

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

console.log('PR-Q-27 NameSpring backward-compat contract\n');

// NameSpring's exact call shape (no precisionConfig).
const namespringRequest = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
  // No options — NameSpring may pass `{ sajuTimePolicy }` but never `precisionConfig`.
};

// ── (1) getSpringReport — namingReport surface ──────────────────────────
const springReport: any = await engine.getSpringReport(namespringRequest);
check(`SpringReport.namingReport defined`, springReport?.namingReport != null);
check(`SpringReport.namingReport.name.fullHangul is string`,
  typeof springReport?.namingReport?.name?.fullHangul === 'string');
check(`SpringReport.namingReport.name.fullHanja is string`,
  typeof springReport?.namingReport?.name?.fullHanja === 'string');
check(`SpringReport.schoolPreset is additive default metadata`,
  springReport?.schoolPreset?.selected === 'korean' &&
    springReport.schoolPreset.source === 'default' &&
    springReport.schoolPreset.scoringEffect === 'inactive');

// ── (2) getFortuneReport — full surface ─────────────────────────────────
const fortuneReport: any = await engine.getFortuneReport(namespringRequest);
const FORTUNE_SECTIONS = [
  'overviewSummary', 'lifeFortuneOverview', 'personality',
  'strengthsWeaknesses', 'cautions',
  'dailyFortune', 'weeklyFortune', 'monthlyFortune', 'yearlyFortune',
  'categoryFortunes', 'nameCompatibility', 'lifeStageFortune',
];
for (const section of FORTUNE_SECTIONS) {
  check(`FortuneReport.${section} present`, fortuneReport?.[section] != null);
}
const namingRecommendationReport = await engine.getNamingRecommendationReport(namespringRequest);
check('NamingRecommendationReport preserves the fortune report surface',
  namingRecommendationReport?.fortuneReport?.nameCompatibility != null);
check('NamingRecommendationReport resolves a complete saju evidence plan',
  namingRecommendationReport?.namingEvidencePlan?.sections?.[0]?.fragments?.[0]?.key
    ?.startsWith('saju-axis/') === true,
  namingRecommendationReport?.namingEvidencePlan?.sections?.[0]?.fragments?.[0]?.key);
const overviewPillarElements = fortuneReport?.overviewSummary?.pillars?.map((pillar: any) =>
  String(pillar?.element ?? '')) ?? [];
check(`FortuneReport.overviewSummary pillar elements expose stem/branch pairs`,
  overviewPillarElements.length === 4 &&
    overviewPillarElements.every((element: string) =>
      element.split('/').filter((part: string) => part.trim().length > 0).length === 2),
  overviewPillarElements.join(', '));
const mixedBranchPattern = /[가-힣](JA|CHUK|IN|MYO|JIN|SA|O|MI|SIN|YU|SUL|HAE)\b/;
check(`FortuneReport.lifeStageFortune has no mixed Korean/romanized branch display`,
  !mixedBranchPattern.test(JSON.stringify(fortuneReport?.lifeStageFortune ?? {})));
check(`FortuneReport.meta.schoolPreset is additive default metadata`,
  fortuneReport?.meta?.schoolPreset?.selected === 'korean' &&
    fortuneReport.meta.schoolPreset.source === 'default' &&
    fortuneReport.meta.schoolPreset.scoringEffect === 'inactive');
check(`FortuneReport does not leak object stringification into user text`,
  !JSON.stringify(fortuneReport).includes('[object Object]'));

const namespringVisibleText = `${JSON.stringify(springReport)} ${JSON.stringify(fortuneReport)}`;
const staleServiceTonePhrases = [
  '정해두',
  '쌓아가는',
  '다져두시면',
  '집중하시면',
  '준비하셔서',
  '된답니다',
  '님께서는',
  '님께서',
  '님은도',
  '님은 각',
  '님 한평생',
  '받으시',
  '하실 수 있어요',
  '하시고',
  '하시면',
  '하시되',
  '쌓으시는',
  '다지시는',
  '출발하시더라도',
  '키워두시면',
  '느끼실 수 있어요',
  '가꾸어 가시길 권해 드려요',
  '후배나 후진',
  '다음 세대을',
  '부귀와 명예',
  '자녀분들이',
  '놓지 않으신다면',
  '좋은 흐름을 만들어 주는 좋은 운이에요',
  '건강하고 번창한다는 이름 그대로',
  '오래오래 건강한 기운 그대로',
  '보내시며',
  '부자의 복이',
  '꽃을 피우는 성과',
  '똑똑한 머리',
  '남다른 똑똑함',
  '빠른 이해력와',
  '특유의 추진력과 머리',
  '쌓아온 명성과 풍요',
  '명성이 가장 높은 곳',
  '보내실 수',
  '재물 모으는 운',
  '큰 재물과 사회적 명성',
  '자녀가 잘 되고 번창하며',
  '용감하게 나아가는 기운',
  '빠른 성공',
  '큰일을 이루고 많은 사람의 존경',
  '복된 삶이 기다리고',
  '건강과 재물, 평판이 고루 갖추어진',
  '사람 복',
  '성공의 열매',
  '복과 오래 사는 기운',
  '풍요로운 생활을 누리게',
  '주변 사람들한테',
  '이름값',
  '성과을',
  '뒷받침해주지',
  '신살입니다.',
  '흉살이나',
  '해석해야 합니다',
];
for (const phrase of staleServiceTonePhrases) {
  check(`NameSpring-visible text avoids stale service phrase '${phrase}'`,
    !namespringVisibleText.includes(phrase));
}

// categoryFortunes 5 default categories (NameSpring's CATEGORY_ORDER)
const CATEGORIES = ['wealth', 'health', 'academic', 'romance', 'family'] as const;
for (const cat of CATEGORIES) {
  const card = fortuneReport.categoryFortunes?.[cat];
  check(`categoryFortunes.${cat}.title is string`,
    typeof card?.title === 'string' && card.title.length > 0);
  check(`categoryFortunes.${cat}.category === '${cat}'`, card?.category === cat);
  check(`categoryFortunes.${cat}.stars is number 1-5`,
    typeof card?.stars === 'number' && card.stars >= 1 && card.stars <= 5);
  check(`categoryFortunes.${cat}.summary is string`,
    typeof card?.summary === 'string');
  check(`categoryFortunes.${cat}.advice is array`,
    Array.isArray(card?.advice));
  // advice[i].text + advice[i].reason are accessed in JSX — must be string-shaped or undefined
  for (const advice of (card?.advice ?? []) as any[]) {
    check(`categoryFortunes.${cat}.advice[].text is string`,
      typeof advice?.text === 'string');
    check(`categoryFortunes.${cat}.advice[].reason is string`,
      typeof advice?.reason === 'string');
  }
  // caution is null OR object with {signal, response, reason}
  if (card?.caution) {
    check(`categoryFortunes.${cat}.caution.signal is string`,
      typeof card.caution.signal === 'string');
    check(`categoryFortunes.${cat}.caution.response is string`,
      typeof card.caution.response === 'string');
    check(`categoryFortunes.${cat}.caution.reason is string`,
      typeof card.caution.reason === 'string');
  }
}

// ── (3) New opt-in fields (PR-Q-15..#16) — additive, must not break ─────
//     NameSpring uses `{...item}` spread + JSX `item?.field`, so new fields
//     either undefined or non-throwing values are both safe.
for (const cat of CATEGORIES) {
  const card = fortuneReport.categoryFortunes?.[cat];
  // subDomains is now populated by default (PR-Q-16). Verify shape.
  if (card?.subDomains !== undefined) {
    check(`categoryFortunes.${cat}.subDomains (PR-K-1) is array`,
      Array.isArray(card.subDomains));
    if (Array.isArray(card.subDomains)) {
      for (const sub of card.subDomains as any[]) {
        check(`subDomains[].name is string`, typeof sub?.name === 'string');
        check(`subDomains[].title is string`, typeof sub?.title === 'string');
        check(`subDomains[].stars is number`, typeof sub?.stars === 'number');
        check(`subDomains[].narrative is string`, typeof sub?.narrative === 'string');
      }
    }
  }
  // axisStrength is optional; if present, must be record (not array, not number)
  if (card?.axisStrength !== undefined) {
    check(`categoryFortunes.${cat}.axisStrength is non-array record`,
      typeof card.axisStrength === 'object' && !Array.isArray(card.axisStrength));
  }
  // evidence is optional; if present, must be array of {axis, claim, ...}
  if (card?.evidence !== undefined) {
    check(`categoryFortunes.${cat}.evidence is array`,
      Array.isArray(card.evidence));
  }
}

// ── (4) SajuReport — pillars + dayMaster ────────────────────────────────
const sajuReport: any = await engine.getSajuReport(namespringRequest);
check(`SajuReport.pillars defined`, sajuReport?.pillars != null);
check(`SajuReport.pillars.year exists`, sajuReport?.pillars?.year != null);
check(`SajuReport.dayMaster defined`, sajuReport?.dayMaster != null);
check(`SajuReport.dayMaster.polarity is string`,
  typeof sajuReport?.dayMaster?.polarity === 'string');

// ── (5) Optional sajuTimePolicy passes through cleanly ──────────────────
const withTimePolicy = await engine.getSajuReport({
  ...namespringRequest,
  options: { sajuTimePolicy: { trueSolarTime: 'on' } },
});
check(`legacy partial sajuTimePolicy keeps the saju calculation enabled`,
  (withTimePolicy as any)?.sajuEnabled === true);

const legacyUiDefaultTimePolicy = await engine.getSajuReport({
  ...namespringRequest,
  birth: {
    ...namespringRequest.birth,
    calendarType: 'solar' as const,
    region: '서울',
    birthPlace: '서울',
  },
  options: {
    sajuTimePolicy: {
      trueSolarTime: 'off',
      longitudeCorrection: 'on',
      yaza: 'off',
    },
  },
});
check(`legacy UI default location/time toggles keep the saju calculation enabled`,
  (legacyUiDefaultTimePolicy as any)?.sajuEnabled === true);
check(`legacy UI default location resolves to Seoul`,
  (legacyUiDefaultTimePolicy as any)?.timeCorrection?.provenance?.location?.resolvedRegionCode === 'SEOUL');

const legacyUiEquationOnly = await engine.getSajuReport({
  ...namespringRequest,
  options: {
    sajuTimePolicy: {
      trueSolarTime: 'on',
      longitudeCorrection: 'off',
      yaza: 'off',
    },
  },
});
check(`legacy UI equation-of-time-only toggle works without a longitude input`,
  (legacyUiEquationOnly as any)?.sajuEnabled === true);
check(`equation-of-time-only toggle leaves longitude correction at zero`,
  (legacyUiEquationOnly as any)?.timeCorrection?.longitudeCorrectionMinutes === 0);

// ── (6) tieredMatrix is OPT-IN (negative assert) ────────────────────────
// NameSpring's request never sets `precisionConfig.surfaceTieredMatrix`.
// Without it, FortuneReport.tieredMatrix MUST be undefined so the
// existing card surface stays the only payload NameSpring sees.
check(`FortuneReport.tieredMatrix is undefined when surface flag absent`,
  fortuneReport?.tieredMatrix === undefined,
  typeof fortuneReport?.tieredMatrix);

// ── (7) tieredMatrix surfaces correctly when opt-in ────────────────────
// Sanity check that the new structure is well-formed when explicitly
// enabled — protects against future regressions where the flag fails to
// activate the matrix.
const tieredOn: any = await engine.getFortuneReport({
  ...namespringRequest,
  options: { precisionConfig: { surfaceTieredMatrix: true } },
});
check(`opt-in tieredMatrix is present`, tieredOn?.tieredMatrix != null);
if (tieredOn?.tieredMatrix) {
  const tm = tieredOn.tieredMatrix;
  check(`tieredMatrix.schemaVersion === 'spring-ts.tiered-matrix.v1'`,
    tm.schemaVersion === 'spring-ts.tiered-matrix.v1');
  check(`tieredMatrix.periods has 5 keys`,
    tm.periods && Object.keys(tm.periods).length === 5,
    `${Object.keys(tm.periods ?? {}).length}`);
  for (const period of ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear']) {
    const p = tm.periods?.[period];
    check(`tieredMatrix.periods.${period} present`, p != null);
    check(`tieredMatrix.periods.${period}.byCategory has 10 keys`,
      p?.byCategory && Object.keys(p.byCategory).length === 10,
      `${Object.keys(p?.byCategory ?? {}).length}`);
  }
  const usedGlossaryCount = tm.glossary?.usedInThisReport?.length ?? 0;
  check(`tieredMatrix.glossary.entries covers used report tags`,
    tm.glossary?.entries &&
      Object.keys(tm.glossary.entries).length === usedGlossaryCount &&
      usedGlossaryCount > 0,
    `${Object.keys(tm.glossary?.entries ?? {}).length}/${usedGlossaryCount}`);
}

engine.close();

console.log(`\nNameSpring compat: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
