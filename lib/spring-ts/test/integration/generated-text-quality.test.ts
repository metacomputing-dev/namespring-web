/**
 * test/integration/generated-text-quality.test.ts
 *
 * Gate contract for text-quality-rules.ts (+ its wiring into
 * validate-generated.ts). Fixtures are FROZEN STRINGS — real defects copied
 * from the 2026-07 stamped corpus — so this test stays green after the corpus
 * is regenerated. See docs/PLAN_PR1_GENERATED_TEXT_QUALITY.md §4/§7.
 *
 * Run: npm run test:generated-quality
 */
import {
  bundleDiversityViolations,
  crossBundleDuplicateViolations,
  paragraphKey,
  summarySkeleton,
  validatePlainTextQuality,
} from '../../tools/generation/text-quality-rules.js';
import { validateGenerated } from '../../tools/generation/validate-generated.js';
import type { GenerationCase } from '../../tools/generation/case-schema.js';

let pass = 0, fail = 0;
function check(label: string, cond: boolean, ev?: string): void {
  if (cond) { pass += 1; console.log(`  PASS ${label}`); }
  else { fail += 1; console.log(`  FAIL ${label}${ev ? ` (${ev})` : ''}`); }
}

console.log('generated text quality gate\n');

// ── 1. stamped article (verbatim from academic corpus @7d4ee70a0) ──────────
const STAMPED = {
  articleId: 'academic.life.adult.high.balanced.bigeop.boost_strong.x',
  summary: '타고난 힘이 고른 편이라, 공부 흐름은 차분히 다질 때 좋아요.',
  body: [
    '당신은 {{dayMasterName}} 기운을 타고난 결이 고른 쪽이라, 공부 흐름은 한 번에 크게 밀기보다 차분히 다질 때 오래 남아요. {{periodLabel}}에는 기회가 비교적 잘 살아나는 구간이에요. 자격증, 강의, 책 한 권, 정리 노트처럼 손에 잡히는 장면부터 살피면 선택이 가벼워져요.',
    '곁의 사람과 기준을 나누고 함께 움직일 때 힘이 붙는 편이에요 그래서 공부도 감으로만 처리하기보다 공부 범위를 작게 나누고 다시 보는 일이 잘 맞아요. 작은 기준을 눈앞에 두면 마음이 급해져도 다시 돌아올 곳이 생겨요.',
    '공부 범위를 작게 나누고 다시 보는 일을 오늘의 첫걸음으로 삼아 보세요. 너무 많은 일을 한꺼번에 바꾸지 않아도 괜찮아요.',
  ],
  expert: [
    '{{dayMasterName}} 일간은 중화 쪽이라 한쪽 기운에 기대기보다 균형을 유지하며 해당 영역을 다루는 편이 자연스러워요 비겁 계열(비견·겁재격)는 자립·경쟁·동료로 나를 세우는 구조. 주체적으로 밀고 나가는 전략이 맞음. 이 판단을 #{yongshin}·#{sikshin}·#{bigyeon} 축과 함께 보아 평문에서는 공부 흐름의 속도와 기준을 조절하는 글로 풀었어요.',
    '이름의 #{yongshin} 자원오행이 combinedDistribution에서 필요한 {{yongshinName}} 기운을 여러 자로 크게 보강해요.',
  ],
  livingTips: ['한 단원만 다시 읽어 보기', '믿을 만한 사람에게 물어보기'],
  cautions: ['범위를 넓히기보다 오늘은 깊이를 챙겨요.'],
};

const stampedRules = new Set(validatePlainTextQuality(STAMPED).map((v) => v.rule));
for (const rule of [
  'burned-phrase',            // 차분히 다질 · 작은 기준 · 오늘의 첫걸음 · 손에 잡히는 장면 …
  'generic-summary-frame',    // …차분히 다질 때 좋아요.
  'missing-period-runon',     // 편이에요 그래서
  'josa-after-paren',         // 겁재격)는
  'code-identifier',          // combinedDistribution
  'formal-fragment',          // …구조. / …전략이 맞음.
  'spec-constant-verbatim',   // 전략이 맞음
  'burned-expert-meta',       // 평문에서는 … 글로 풀었어요
]) check(`stamped article trips ${rule}`, stampedRules.has(rule), [...stampedRules].join(','));

// ── 2. josa vowel harmony ───────────────────────────────────────────────────
const vowelJosa = validatePlainTextQuality({
  summary: '이 시기는 여린 힘을 살려, 이동과 변화을 차분히 다져요.',
}).map((v) => v.rule);
check('모음 뒤 을 (변화을) → josa-vowel-harmony', vowelJosa.includes('josa-vowel-harmony'));

const whitelisted = validatePlainTextQuality({
  body: ['가을 바람이 낯설게 느껴질 만큼 마음이 분주한 주간이에요. 지금은 속도를 늦춰도 손해 보지 않아요.'],
});
check('단어 내 을 (가을) 는 통과', whitelisted.length === 0, JSON.stringify(whitelisted));

// ── 3. skeleton: domain-swap stamps collapse to one skeleton ────────────────
check('도메인 치환 summary 는 같은 골격',
  summarySkeleton('타고난 힘이 단단한 편이라, 가족 관계는 차분히 다질 때 좋아요.')
  === summarySkeleton('타고난 힘이 여린 편이라, 공부 흐름은 차분히 다질 때 좋아요.'));

// ── 4. a GOOD article passes the full validateGenerated gate ────────────────
const GOOD_CASE = {
  caseId: 'wealth.thisWeek.adult.mid.weak.jaeseong.boost_mild.x',
  category: 'wealth', period: 'thisWeek', audience: 'adult', band: 'mid',
  gangyak: 'weak', gyeokgukFamily: 'jaeseong', nameEffect: 'boost_mild', gender: null,
  spec: {
    archetype: 'wealth/thisWeek/adult/mid × 신약 × 재성 × boost_mild',
    strengthTerm: '신약', strengthPlain: '여린',
    adviceDirection: '채우고 다지는 쪽(속도보다 기반, 인성·비겁의 도움 받기)',
    gyeokgukTerm: '재성 계열(정재·편재격)', gyeokgukMeaning: '재물·현실을 다루고 관리하는 구조.',
    nameEffectPlain: '이름이 필요한 기운을 한 글자쯤 거들어 주는',
    nameEffectExpert: '자원오행이 용신을 한 자쯤 완만히 보강',
    nameIsAdverse: false, genderTerm: null, audienceSafety: 'adult',
    suggestedExpertTags: ['yongshin', 'jaeseong'],
  },
} as GenerationCase;

const GOOD = {
  summary: '이번 주 돈 문제는 늘리기보다 새는 곳 하나를 막는 쪽이 이득이에요.',
  body: [
    '여린 기운은 큰돈을 굴릴 때보다 지킬 때 빛나는 결이에요. 이번 주에는 수입을 늘리려 애쓰기보다, 매달 빠져나가는 항목 중 하나를 골라 정리해 보세요. 안 쓰는 구독 하나, 습관처럼 시키는 배달 하나면 충분해요.',
    '주중에 돈 쓸 일이 몰리면 마음이 급해지기 쉬워요. 지갑을 열기 전에 하루만 묵혀 두는 버릇이 이런 결에는 잘 맞아요. 특히 피로가 쌓인 날 저녁의 소비는 다음 날 아침의 눈으로 다시 봐 주세요. 그때도 필요하면 그건 진짜 필요한 물건이에요.',
    '이름이 부족한 기운을 한 글자만큼 살짝 보태 주는 자리라, 무리하지 않는 선에서는 흐름이 순한 편이에요. 다만 받쳐 준다고 속도를 올리라는 뜻은 아니에요. 이번 주의 목표는 자산을 불리는 화려한 그림이 아니라, 어제와 같은 돈이 새지 않고 그대로 남아 있는 잔잔한 통장이에요.',
  ],
  expert: [
    '신약한 일간이 재성을 다루는 주간이라, 벌이를 키우기보다 근기를 지키는 편이 순리예요. #{yongshin} 오행이 일간을 받치고, 이름의 #{jawon_ohaeng} 한 자가 그 방향을 완만하게 거들어요. 재다신약의 부담을 피하려면 확장 대신 지출 구조를 정돈하는 쪽이 #{jaeseong} 운용의 정석이에요.',
  ],
  livingTips: ['고정 지출 목록 한 번 훑기', '배달 앱 알림 꺼 두기'],
  cautions: ['급한 제안일수록 하루 재우고 결정해요.'],
};

const goodPlain = validatePlainTextQuality(GOOD);
check('good article: text rules 위반 0', goodPlain.length === 0,
  goodPlain.map((v) => `${v.rule}:${v.detail}`).join(' | '));
const goodVerdict = validateGenerated(GOOD as never, GOOD_CASE);
check('good article: validateGenerated 통과', goodVerdict.ok, goodVerdict.violations.join(' | '));
const stampedVerdict = validateGenerated(STAMPED as never, {
  ...GOOD_CASE, spec: { ...GOOD_CASE.spec, strengthPlain: '고른' },
} as GenerationCase);
check('stamped article: validateGenerated 리젝', !stampedVerdict.ok);

// ── 5. bundle diversity ─────────────────────────────────────────────────────
const mk = (id: string, summary: string, body: string[], tips: string[]) => ({
  caseId: id, summary, body, expert: [], livingTips: tips,
});
const STAMPED_BUNDLE = [
  mk('c.today.high', '타고난 힘이 여린 편이라, 돈 관리는 천천히 챙길 때 좋아요.',
    ['오늘은 지출 항목 하나를 정해 그대로 지키는 흐름이 잘 어울리는 날이에요. 큰 결정은 내일로 넘겨도 늦지 않아요.'],
    ['지출 목록을 한 번 적어 보기']),
  mk('c.thisWeek.high', '타고난 힘이 여린 편이라, 돈 관리는 천천히 챙길 때 좋아요.',   // exact dup
    ['이번 주는 지출 항목 하나를 정해 그대로 지키는 흐름이 잘 어울리는 주간이에요. 큰 결정은 다음 주로 넘겨도 늦지 않아요.'],  // near-stamp
    ['지출 목록을 한 번 적어 보기']),
  mk('c.thisMonth.high', '타고난 힘이 단단한 편이라, 돈 관리는 천천히 챙길 때 좋아요.', // skeleton dup 3
    ['이번 달은 지출 항목 하나를 정해 그대로 지키는 흐름이 잘 어울리는 달이에요. 큰 결정은 다음 달로 넘겨도 늦지 않아요.'],
    ['지출 목록을 한 번 적어 보기']),
  mk('c.thisYear.high', '타고난 힘이 고른 편이라, 돈 관리는 천천히 챙길 때 좋아요.',
    ['올해는 지출 항목 하나를 정해 그대로 지키는 흐름이 잘 어울리는 해예요. 큰 결정은 내년으로 넘겨도 늦지 않아요.'],
    ['지출 목록을 한 번 적어 보기']),
];
const bundleRules = new Set(bundleDiversityViolations(STAMPED_BUNDLE).map((v) => v.rule));
for (const rule of ['bundle-duplicate-summary', 'bundle-summary-skeleton', 'bundle-ngram-stamp', 'bundle-duplicate-tip'])
  check(`stamped bundle trips ${rule}`, bundleRules.has(rule), [...bundleRules].join(','));

const dupParagraph = bundleDiversityViolations([
  mk('a', '요약 하나예요.', ['똑같은 문단이 두 셀에 그대로 복사된 경우를 잡아야 해요. 이 문장은 그 검증용이에요.'], []),
  mk('b', '요약 둘이에요.', ['똑같은 문단이 두 셀에 그대로 복사된 경우를 잡아야 해요. 이 문장은 그 검증용이에요.'], []),
]).map((v) => v.rule);
check('문단 exact 복제 → bundle-duplicate-paragraph', dupParagraph.includes('bundle-duplicate-paragraph'));

const DIVERSE_BUNDLE = [
  mk('d.today.high', '오늘은 들어온 제안을 저울질하기 좋은 날이에요.',
    ['갑자기 굴러온 기회일수록 조건을 눈으로 확인하고 싶은 날이에요. 문서로 남기면 마음이 놓여요.'],
    ['계약 조건 캡처해 두기']),
  mk('d.thisWeek.mid', '이번 주 지갑은 큰 탈 없이 흘러가는 편이에요.',
    ['씀씀이가 크게 흔들릴 주간은 아니에요. 다만 반복 결제일이 몰려 있으니 날짜만 한 번 훑어 두면 든든해요.'],
    ['반복 결제일 달력에 옮기기']),
  mk('d.thisMonth.low', '이번 달은 벌기보다 지키는 데 무게를 두면 마음이 편해요.',
    ['수입 흐름이 잠시 얇아질 수 있는 달이에요. 고정비부터 줄 세워 보면 불안이 숫자로 바뀌고, 숫자는 다룰 수 있어요.'],
    ['고정비 목록 줄 세우기']),
  mk('d.thisYear.high', '올해 재물운은 상반기에 씨를 뿌리고 하반기에 거두는 그림이에요.',
    ['연초의 선택이 연말의 통장을 정해요. 봄까지는 배움과 관계에 쓰는 돈을 아끼지 말고, 가을부터 회수 구간이라고 봐 주세요.'],
    ['상반기 투자 상한 정하기']),
];
const diverseViolations = bundleDiversityViolations(DIVERSE_BUNDLE);
check('diverse bundle 위반 0', diverseViolations.length === 0,
  diverseViolations.map((v) => `${v.rule}:${v.detail}`).join(' | '));

// ── 6. cross-bundle duplicate paragraph ─────────────────────────────────────
const SHARED_P = '오늘의 이름 기운은 넉넉한 자리만 더 채우는 셈이어서, 모자란 몫은 하루의 사소한 선택들로 메워 가는 게 솔직한 처방이에요.';
const crossIndex = { paragraphs: new Map([[paragraphKey(SHARED_P), 'overall.today.adult.mid.balanced.bigeop.adverse.x']]) };
const crossHit = crossBundleDuplicateViolations(
  { caseId: 'overall.today.adult.mid.balanced.inseong.adverse.x', body: [SHARED_P], expert: [] },
  crossIndex,
);
check('다른 번들과 동일 문단 → cross-bundle-duplicate-paragraph',
  crossHit.some((v) => v.rule === 'cross-bundle-duplicate-paragraph'));
const crossSelf = crossBundleDuplicateViolations(
  { caseId: 'overall.today.adult.mid.balanced.bigeop.adverse.x', body: [SHARED_P], expert: [] },
  crossIndex,
);
check('자기 자신의 문단은 통과', crossSelf.length === 0);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
