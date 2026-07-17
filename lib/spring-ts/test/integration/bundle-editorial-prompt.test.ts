import { buildBundlePrompt, bundleKeyOfCase } from '../../tools/generation/bundle-prompt.js';
import type { GenerationCase } from '../../tools/generation/case-schema.js';

function check(name: string, condition: boolean): void {
  if (!condition) {
    console.error(`FAIL ${name}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${name}`);
}

const baseSpec = {
  archetype: 'family adult balanced bigeop adverse female',
  strengthTerm: '중화',
  strengthPlain: '안정감',
  adviceDirection: '한쪽으로 치우치지 말고 기준을 세운다',
  gyeokgukTerm: '비겁',
  gyeokgukMeaning: '가까운 사람과 역할을 나누는 구조',
  nameEffectPlain: '이름이 필요한 기운을 충분히 보태지 못한다',
  nameEffectExpert: 'name-saju element distribution shows adverse support',
  nameIsAdverse: true,
  genderTerm: '여성',
  audienceSafety: 'adult' as const,
  suggestedExpertTags: ['bigyeon', 'jeongin', 'gishin', 'yongshin'],
};

const cases: GenerationCase[] = [
  {
    caseId: 'family.life.adult.high.balanced.bigeop.adverse.female',
    category: 'family',
    period: 'life',
    audience: 'adult',
    band: 'high',
    gangyak: 'balanced',
    gyeokgukFamily: 'bigeop',
    nameEffect: 'adverse',
    gender: 'female',
    spec: baseSpec,
  },
  {
    caseId: 'family.today.adult.low.balanced.bigeop.adverse.female',
    category: 'family',
    period: 'today',
    audience: 'adult',
    band: 'low',
    gangyak: 'balanced',
    gyeokgukFamily: 'bigeop',
    nameEffect: 'adverse',
    gender: 'female',
    spec: baseSpec,
  },
];

console.log('\nbundle editorial prompt');

const prompt = buildBundlePrompt(cases);

check('bundle key stable', bundleKeyOfCase(cases[0]) === 'family.adult.balanced.bigeop.adverse.female');
check('md prompt rendered', prompt.includes('당신은 한국어 유료 사주·성명학 리포트를 쓰는 시니어 편집자'));
check('hidden editorial process required', prompt.includes('편집 브리프') && prompt.includes('한국어 편집'));
check('article architecture required', prompt.includes('body[0]~body[3]은 첫 번째 완결 글') && prompt.includes('body[4]~body[7]은 두 번째 완결 글') && prompt.includes('body[8]은 원칙적으로 작성'));
check('relaxed body length contract rendered', prompt.includes('60-220자, 1-4문장') && prompt.includes('body 전체는 520-1500자'));
check('informal register reinforced', prompt.includes('게이트 없이 생성하더라도') && prompt.includes('격식체 종결을 쓰지 마세요'));
check('day master slot style reinforced', prompt.includes('{{dayMasterName}}의 성분은') && prompt.includes('{{dayMasterName}}의 기질은') && prompt.includes('{{dayMasterName}}은 사용자 이름이 아니라'));
check('hook is compressed advice', prompt.includes('hook은 선택 항목이지만') && prompt.includes('body의 행동 기준을 압축한 짧은 권고문'));
check('summary copy padding banned', prompt.includes('summary를 body 문단 끝에 반복하지 마세요'));
check('literal axis language banned', prompt.includes('"낮은 흐름에서는"') && prompt.includes('"고른 결"'));
check('raw strengthPlain hidden from shared facts', !prompt.includes('plain direction: 안정감'));
check('causal paragraph logic required', prompt.includes('어떤 상황을 가정했나?') && prompt.includes('왜 중요한가?') && prompt.includes('사용자는 무엇을 하면 되는가?'));
check('hypothetical scene guidance required', prompt.includes('가정형을 기본으로 하되') && prompt.includes('사용자가 실제로 그 일을 이미 했다고 단정하지 마세요'));
check('reader word banned in generated text', prompt.includes('`독자`라는 단어를 쓰지 마세요'));
check('period/category filler openers banned', prompt.includes('평생의 가족 관계에서') && prompt.includes('기간과 카테고리만 반복하는 도입부를 피하세요'));
check('all caseIds included', cases.every((c) => prompt.includes(c.caseId)));
check('case brief md rendered', prompt.includes('사주 해석 메모:') && prompt.includes('전문가 문단 태그:') && prompt.includes('#{bigyeon}'));
check('interpretation memo is not final prose', prompt.includes('최종 문장 후보가 아닙니다') && prompt.includes('그대로 복사하지 마세요'));
check('period realism guidance included', prompt.includes('today에서 명절 준비') && prompt.includes('기간 현실감'));
check('scene candidates are guardrails', prompt.includes('참고 생활 장면 후보') && prompt.includes('도메인 가드레일'));
check('today scenes are realistic', prompt.includes('안부 문자') && !/family\.today\.adult\.low[\s\S]*?참고 생활 장면 후보: [^\n]*명절/u.test(prompt));
check('no unresolved template tokens', !/\[\[[A-Z0-9_]+\]\]/u.test(prompt));

if (process.exitCode) process.exit(process.exitCode);
