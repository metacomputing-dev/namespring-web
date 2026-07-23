/**
 * bundle-prompt.ts -- Prompt + output schema for BUNDLE generation (v3).
 *
 * A bundle = every cell one person can see in one category: the person axes
 * (audience · 강약 · 격국 · nameEffect · 성별) are fixed, the cells vary by
 * period × band (adults: 15 = 5×3, minors: 5, life stages: 5 merged stages).
 * One expert agent writes the whole bundle as "this person's chapter", which
 * makes within-report diversity and cross-cell consistency a property of the
 * writing itself — not something a gate has to retrofit.
 *
 * Diversity contract summary (docs/PLAN_PR1_GENERATED_TEXT_QUALITY.md §6):
 * all summaries structurally distinct, burned phrases banned, one period lens
 * and band tone per cell, no paragraph/sentence reuse between cells.
 */
import type { GenerationCase } from './case-schema.js';
import { BURNED_EXPERT_PHRASES, BURNED_PHRASES } from './text-quality-rules.js';

const JARGON_BANNED =
  '오행·용신·희신·기신·구신·격국·십성·정재·편재·재성·편관·식신·상관·겁재·비겁·신살·상생·상극·조후·대운·득령·득지·원형이정·역마·도화';
const MINOR_BANNED = '연애·결혼·배우자·투자·보증·전성기·음주·술자리·이혼';

/** Stage audiences are merged into one bundle (they render as one life tab). */
export function bundleKeyOfCase(c: GenerationCase): string {
  const audience = c.audience.startsWith('stage-') ? 'stages' : c.audience;
  return [c.category, audience, c.gangyak, c.gyeokgukFamily, c.nameEffect, c.gender ?? 'x'].join('.');
}

export const BUNDLE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['articles'],
  properties: {
    articles: {
      type: 'array',
      minItems: 1,
      maxItems: 24,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['caseId', 'summary', 'body', 'expert', 'livingTips', 'cautions'],
        properties: {
          caseId: { type: 'string', description: '요청된 caseId 그대로' },
          summary: { type: 'string', description: '≤60자, 1문장, 해요체, 평문' },
          hook: { type: 'string', description: '선택, ≤24자' },
          body: { type: 'array', minItems: 3, maxItems: 4, items: { type: 'string', description: '80~240자, 2~5문장, 해요체, 평문' } },
          expert: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string', description: '100~380자, #{태그} 포함(전체 2~6개), 해요체' } },
          livingTips: { type: 'array', minItems: 2, maxItems: 3, items: { type: 'string', description: '≤30자' } },
          cautions: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string', description: '≤44자, 해요체' } },
        },
      },
    },
  },
} as const;

const PERIOD_LENS: Record<string, string> = {
  today: '**오늘 하루** — 지금 바로 해볼 한 가지 행동/장면. 시야가 하루를 넘지 않게.',
  thisWeek: '**이번 주** — 한 주의 리듬 설계(요일 감각, 주중/주말의 완급).',
  thisMonth: '**이번 달** — 한 달짜리 작은 프로젝트, 중간 점검과 마무리 감각.',
  thisYear: '**올해** — 계절의 흐름을 타는 큰 방향, 상반기/하반기 호흡.',
  life: '**타고난 결(평생)** — 기질과 긴 호흡. 특정 시점 조언 금지, 삶의 태도 중심.',
};
const BAND_TONE: Record<string, string> = {
  high: '기운이 잘 풀리는 자리 — 기회를 어디에 어떻게 쓸지 구체적으로. 들뜨지 않게.',
  mid: '무난한 자리 — 유지·정돈·재정비. 밋밋하지 않게 작은 발견 하나를 담기.',
  low: '조심스러운 자리 — 방어·회복·덜어내기. 겁주지 말고 담담하게 지키는 법.',
  any: '등급 중립 — 시기 조언보다 이 사람의 결에 맞는 본질적인 이야기.',
};
// Academic bands are INTENSITY-ONLY: they modulate the strength of the cell's
// injected 격국 task, they must NOT supply a competing generic activity. (Pilot
// showed the generic BAND_TONE.mid "유지·정돈·재정비/작은 발견" made all 격국
// converge on "방식 실험" / "완강+노트" and ignore their distinct task.)
const ACADEMIC_BAND_INTENSITY: Record<string, string> = {
  high: '강도 강 — 아래 핵심 과제를 도전 범위 넓혀 결과가 남는 수준으로(시험·제출·발표). 들뜨지 않게.',
  mid: '강도 중 — 아래 핵심 과제를 무리 없는 유지 강도로(새 범위를 벌이지 말고 그 과제에 집중). 활동 자체를 generic으로 바꾸지 말 것.',
  low: '강도 약 — 아래 핵심 과제를 회복·범위 축소·오류 방지 수준으로. 겁주지 말고 담담하게.',
  any: '강도 중립 — 이 사람의 결에 맞는 본질적인 이야기.',
};
const STAGE_LABEL: Record<string, string> = {
  'stage-teen': '10대(학업·또래·자아)', 'stage-early': '20~30대(자립·시작·탐색)',
  'stage-mid': '40~50대(책임·확장·재정비)', 'stage-senior': '60~70대(내려놓음·건강·관계)',
  'stage-elder': '80대 이상(돌봄·평온·정리)',
};

// ── per-bundle material palette ─────────────────────────────────────────────
// Adjacent bundles (same category, neighboring 격국/nameEffect) get
// near-identical case specs, and identical prompts make OPUS converge on the
// same sentences across bundles (measured in wave 1). A deterministic palette
// per bundleKey gives each bundle its own texture without touching facts.
// 12 materials — enough that the up-to-12 (강약×nameEffect) person-variants of one
// 격국 group each get a DISTINCT primary material (see paletteFor). Without this,
// same-격국 siblings hashed to overlapping palettes and converged on identical
// paragraphs → cross-bundle-duplicate rejects at scale.
const MATERIAL_PALETTES: readonly string[] = [
  '몸의 감각(호흡·자세·피로·컨디션)',
  '공간과 물건(책상·집·정리·동선)',
  '시간의 결(아침저녁·마감·달력·리듬)',
  '사람 사이(대화·연락·거리감·협업)',
  '말과 기록(메모·일기·말버릇·약속의 언어)',
  '돈과 살림의 장면(장보기·구독·저금통·영수증)',
  '길과 이동(출퇴근·산책·여행·환승)',
  '취향과 몰입(취미·음악·음식·소소한 즐거움)',
  '자연과 계절(빛·바람·창밖·산책로·날씨)',
  '부엌과 먹거리(요리·재료·식단·냉장고)',
  '화면과 기기(앱·알림·타이머·플레이리스트)',
  '놀이의 결(승부·기록 갱신·수집·레벨)',
];
const STYLE_NOTES: readonly string[] = [
  '비유는 아끼고 담백한 문장으로.',
  '계절과 날씨의 결을 한 스푼만 섞어서.',
  '한두 편쯤은 부드러운 질문으로 열어도 좋게.',
  '동사 중심의 움직이는 문장으로.',
];
const PALETTE_GANGYAK: readonly string[] = ['weak', 'balanced', 'strong'];
const PALETTE_NAME_EFFECT: readonly string[] = ['adverse', 'boost_mild', 'boost_strong', 'neutral'];

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

// bundleKey = category.audience.강약.격국.nameEffect.gender. Palette is keyed on the
// 격국 GROUP (drop 강약·nameEffect) for the base, then the (강약×nameEffect) combo is
// added to the primary index — so within one 격국 group every person-variant lands on
// a different primary material (12 materials ≥ 12 combos), guaranteeing divergence.
function paletteFor(bundleKey: string): { materials: string[]; style: string } {
  const p = bundleKey.split('.');
  const gangyak = p[2] ?? '';
  const nameEffect = p[4] ?? '';
  const groupKey = [p[0], p[1], p[3], p[5] ?? 'x'].join('.');
  const base = fnv1a(groupKey);
  const combo = Math.max(0, PALETTE_GANGYAK.indexOf(gangyak)) * PALETTE_NAME_EFFECT.length
    + Math.max(0, PALETTE_NAME_EFFECT.indexOf(nameEffect)); // 0..11
  const n = MATERIAL_PALETTES.length;
  const first = (base + combo) % n;
  const second = (first + 1 + ((base >>> 8) % (n - 1))) % n;
  return {
    materials: [MATERIAL_PALETTES[first], MATERIAL_PALETTES[second]],
    style: STYLE_NOTES[(((base >>> 16) + combo) >>> 0) % STYLE_NOTES.length],
  };
}

export function buildBundlePrompt(cases: readonly GenerationCase[]): string {
  if (cases.length === 0) throw new Error('empty bundle');
  const c0 = cases[0];
  // The manifest spec text contains a code identifier; never show it to the
  // writer (the gate rejects it in output, so don't tempt echoing).
  const s = {
    ...c0.spec,
    nameEffectExpert: c0.spec.nameEffectExpert.replace(/combinedDistribution/gu, '이름·사주 합산 오행 분포'),
  };
  const minor = s.audienceSafety === 'minor';
  const isStages = c0.audience.startsWith('stage-');

  const cellLines = cases.map((c, i) => {
    // stage 셀도 band가 지정되면(등급 확장 S4+) 대운 길흉 톤을 함께 싣는다.
    // band 'any'(현행 S3 번들)는 종전과 동일 — 진행 중 생성에 무영향.
    const bandTone = c0.category === 'academic'
      ? (ACADEMIC_BAND_INTENSITY[c.band] ?? '')
      : (BAND_TONE[c.band] ?? '');
    const lens = isStages
      ? `생애 단계: ${STAGE_LABEL[c.audience] ?? c.audience}${c.band && c.band !== 'any' ? ` / 대운 등급 ${c.band}: ${BAND_TONE[c.band] ?? ''}` : ''}`
      : `${PERIOD_LENS[c.period] ?? c.period} / 등급 ${c.band}: ${bandTone}`;
    // Academic: pin this cell's 격국×시기 task (docs/academic-matrix-v1.md) as the
    // MANDATORY core activity. Meaning is enforced, wording is NOT — realize it with
    // this bundle's palette (계약 9). Band = intensity only (see ACADEMIC_BAND_INTENSITY).
    const task = c.spec.periodTask
      ? `\n   → **이 셀의 핵심 활동(필수 — 이 활동이 셀의 중심)**: ${c.spec.periodTask}`
        + `\n     · 밴드(${c.band})는 이 활동의 강도만 바꿀 뿐, 활동 자체를 "무난하니 방식을 한 번 실험" · "듣던 강의를 완강하고 노트 정돈" 같은 generic 유지활동으로 바꾸지 말 것(실측된 mid 수렴 골격).`
        + `\n     · 문구 복붙 금지 — 이 번들 팔레트 소재로 구현.`
      : '';
    // Per-cell anti-repetition hints (academic; undefined elsewhere → no change).
    // Each cell gets a DIFFERENT form so the 15 cells spread instead of stamping.
    const dh = c.spec.diversityHints;
    const hintParts = dh
      ? [
          dh.balancePhrase ? `강약은 평문에서 "${dh.balancePhrase}" 결로(다른 편과 겹치지 않게)` : '',
          dh.expertEndingHint ? `expert는 "…${dh.expertEndingHint}(이)에요"류로 닫기` : '',
          dh.nameFrame && c.spec.nameBenefit ? `이름효과를 쓸 땐 ${dh.nameFrame}` : '',
        ].filter(Boolean)
      : [];
    const hint = hintParts.length ? `\n   → **이 편 지정(반복 방지)**: ${hintParts.join(' · ')}` : '';
    return `${i + 1}. \`${c.caseId}\` — ${lens}${task}${hint}`;
  }).join('\n');

  const palette = paletteFor(bundleKeyOfCase(c0));
  const genderLine = s.genderTerm
    ? `- 성별: **${s.genderTerm}** — 이 분야(${c0.category})는 성별에 따라 해석이 갈립니다. 평문에선 자연스럽게.`
    : '- 성별 분기 없음. 중립적으로.';
  const nameHonesty = s.nameIsAdverse
    ? '⚠ **이름이 부족한 기운을 채워 주지 않는(오히려 넉넉한 쪽을 키우는) 경우.** 어느 편에서도 "이름이 채워 준다"라고 쓰지 말 것. 부족한 기운은 생활에서 챙기라는 정직한 처방으로, 낙인 없이 담담하게.'
    : '이름 보강은 실제 정도(강/약)만큼만, 과장 없이. 매 편마다 이름 얘기를 반복하지 말고 자연스러운 자리에서만.';

  // Academic-only guidance block: injected for this category alone. Every other
  // category resolves to an empty string, so their prompts stay byte-identical.
  // Rationale: paid academic-content review (specificity + study scenes) plus the
  // condition-observation phrasing that keeps the no-absolute-assertion gate happy.
  // Study profile + per-cell period task + name benefit/risk all come from the
  // academic content matrix (docs/academic-matrix-v1.md), carried on the spec.
  const studyProfile = s.studyProfile ?? '';
  const nameBenefit = s.nameBenefit ?? '';
  const nameRisk = s.nameRisk ?? '';
  // Only ASK for name benefit/risk when there IS a benefit (boost cases). For
  // neutral/adverse the benefit is empty; inviting a name mention there is what
  // made the pilot leak positive name-effect → honesty rejects. Suppress instead.
  const nameMatrixLine = nameBenefit
    ? `\n0.5 **이름 작용(매트릭스 — 이 격국 기준)**: 이점 = ${nameBenefit}${nameRisk ? ` / 위험·유의 = ${nameRisk}` : ''}. → 이 이점과 위험을 이름 대목에서 **각각 최소 1회** 비단정형으로 짚어라(3차 평가 합격기준). 문구 복붙 금지 — 편마다 다른 문장·다른 자리로.`
    : (nameRisk
      ? `\n0.5 **이름 작용(매트릭스)**: ${nameRisk}. → ⚠ 이름의 긍정효과(채워 준다·힘을 더한다·잘 맞는다)를 서술하지 마라(정직성 게이트 리젝). 이름을 매 편 꺼내지 말고, 꼭 필요한 자리에서만 "이름이 방향을 바꾸진 않아요/이미 강한 쪽에 더 실려요" 선에서 담담하게.`
      : '');

  const academicGuidance = c0.category === 'academic' ? `

## 학업운 전용 지침 (academic — 위 계약과 함께 지킬 것)
아래 9가지는 "무엇을 쓸지"다. 형식·반복·정직성은 게이트가 자동으로 막으니(9번) 여기선 내용에 집중하라. 각 셀 줄에 붙은 **이 편 지정**(강약 표현·expert 종결·이름효과 문형)이 있으면 그대로 따라 편마다 다르게 써라.

1) **학습 성향(이 격국 고유 — 생활어로, 사주 용어 금지)**: ${studyProfile}
   이 성향과 리스크가 body에 **다른 격국과 구별되게** 드러나야 한다. 3문단(조절)은 이 격국의 리스크를 짚어라. 격국을 가리킬 땐 편마다 다른 낱말·각도로(정의 문장을 그대로 되풀이하면 스탬프로 리젝). 포모도로·커피 같은 일반 공부팁에만 기대지 마라.${nameMatrixLine}
2) **이름효과**: body에 1회, 비단정형으로. 위 "이 편 지정"의 이름효과 문형을 쓰고, 기간마다 의미를 달리하라 — 오늘=한 자리에서 시작한 걸 그 자리에서 끝맺음 / 이번주=요일 흐름의 지속 / 이번달=한 과목 마무리 / 올해=상반기 방향 설정 / 평생=오래 붙들어 축적. 4단계 크기: 약보강=한 단계 위 목표 / 강보강=본인이 감당할 범위에서 크게(남과 비교 아님) / 중립·역작용=이름의 긍정효과를 쓰지 않는다.
3) **mid(무난)**: '무난'은 활동을 generic하게 바꾸라는 게 아니라 위 **핵심 활동을 그대로 하되 강도만 낮추라**는 뜻이다(실측된 mid 수렴 방지). 좋은 예: 비겁 mid=내가 정한 한 구간을 작게라도 끝내기 / 관성 mid=마감 기준 한 칸 점검 / 인성 mid=읽은 대목 하나를 내 말로 정리. "방식을 한 번 실험" · "강의 완강+노트 정돈" 골격으로 수렴하지 마라.
4) **강약 표현**: 위 "이 편 지정"의 강약 표현을 평문(summary·body)에 자연스럽게 넣어라(게이트가 강약 근거를 요구). 등급이 high·low여도 "사람 자체는 기복이 크지 않다"를 한 번 되짚어라 — 등급은 시기의 날씨, 사람은 등급과 별개다.
5) **기간 이벤트**: 기간마다 구체적 학업 이벤트 1개(시험 범위·자격증 과목·강의 복습·발표·제출). 단위 = 오늘: 한 자리 분량 / 이번주: 요일 흐름 / 이번달: 목표→중간점검→마감 / 올해: 상반기 방향→하반기 성과 / 평생: 타고난 방식·장기 전략.
6) **등급·강도 + expert 인과**: high=도전 범위 확대 + 결과가 남는 행동(시험·제출) / mid=유지·정리 / low=회복·범위 축소. expert는 한 번은 인과를 풀어라 — [학습 성향] → [이름이 강화/중립/역행] → [이 기간 신호] → [필요한 행동]. 위 "이 편 지정"의 expert 종결어로 닫아 편마다 다르게.
7) **안전(게이트 밖이라 특히 유의)**:
   · 특정 요일·월·상/하반기를 고정 지시하지 않는다(열람 시점 불명) → "주 초 / 남은 기간 / 절반 지난 시점" 같은 상대 표현. (런타임 슬롯 {{currentSeasonName}}·{{periodLabel}}은 허용.)
   · 출퇴근·물리적 책상·유료 강의 구매를 전제하지 않는다(필요하면 "책상이 있다면"처럼 선택형). 소비 습관·신체 증상을 단정·낙인하지 않는다.
   · 마감은 방치·미루기가 아니라: 필수=기한·최소 조건 확인 후 필수분 처리 / 조정 가능=미리 협의해 재설정 / 비필수 새 범위=뒤로.
   · 평생 편은 생애 기질(반복되는 취약 패턴·지쳤을 때의 장기 방어 습관)로 쓴다.
8) **평이체**: 구체적 공부 행동으로 문장을 연다. 추상어(흐름·기운·힘·결·바탕)는 번들 전체 2회 이내. 한 문장에 한 뜻(짧게). 안전 표현: ~하기 쉬운 편이에요 / ~로 느껴질 수 있어요 / ~와 잘 맞아요 / ~을 먼저 잡아 두면 수월해요. (직유·외래어·은유·연어 오류는 자동 검사가 ERROR로 막으니 애초에 쓰지 않는다.)
9) **게이트가 자동으로 막는 것(참고)**: expert #{태그}는 유효 id만·2~6개(문장 속에 녹여 해요체로) / 문장·문단·팁을 편·번들에 재사용 금지 / 12자 구절이 4편 이상 겹치면 스탬프 리젝 / 한 낱말 번들 30회 이상 리젝 / 평문에 사주 용어·의료어 금지 / 이름 정직성(neutral·adverse) / 마감 방치 금지. — "지키면 통과"가 아니라 "어기면 자동 리젝"이니 위 1~8에 집중하면 자연히 지켜진다.` : '';

  return `당신은 정통 사주명리학과 성명학(음양오행·자원오행·사격 원형이정·수리)을 깊이 섭렵한 전문가 저술가입니다.
지금부터 **한 사람**을 위해 ${c0.category} 분야의 완결글 **${cases.length}편(챕터)**을 씁니다. 이 ${cases.length}편은
그 사람의 리포트에 **함께 노출**됩니다. 독자는 유료 독자입니다 — 한 편 한 편이 "내 얘기"로 읽히고,
${cases.length}편을 이어 읽어도 같은 말의 반복이 아니라 **한 권의 잘 짜인 챕터들**로 느껴져야 합니다.

## 이 사람 (모든 편에 공통 — 서로 모순 금지)
- 강약: **${s.strengthTerm}**(평문 "${s.strengthPlain}") → 조언 방향: ${s.adviceDirection}
- 용신 축(전문가 tier에서만, 오행 단정 금지·방향만): ${s.yongshinAxis}
- 격국(삶의 구조): **${s.gyeokgukTerm}** — ${s.gyeokgukMeaning}
- 이름↔사주: ${s.nameEffectPlain} / (전문가 근거: ${s.nameEffectExpert})
${genderLine}
- 독자: ${c0.audience}${minor ? ' (미성년 — 아래 안전 규칙)' : ''}

## 써야 할 ${cases.length}편 (caseId를 정확히 그대로 반환)
${cellLines}

## 다양성 계약 (하나라도 어기면 그 편은 리젝 후 재작성)
1. **summary ${cases.length}개는 문형이 전부 달라야 합니다** — 어순, 종결, 문장 구조가 서로 다르게.
   "타고난 힘이 X 편이라, Y는 Z할 때 좋아요" 같은 틀 하나를 돌려쓰는 것을 금지합니다.
2. **소각 문구(과거 corpus에 도배되어 영구 퇴출) 사용 금지**: ${BURNED_PHRASES.map((p) => `"${p}"`).join(', ')}.
   전문가 문단에서 금지: ${BURNED_EXPERT_PHRASES.map((p) => `"${p}"`).join(', ')} (자기 글쓰기 과정 설명 금지 — 근거만).
3. **문장·문단 재사용 금지**: 같은 문장이나 절을 두 편 이상에서 쓰지 말 것. 도입 문장의 패턴도 편마다 다르게.
4. **구체 소재를 편마다 다르게**: 같은 조언(예: "기록해라")을 여러 편에서 반복하지 말고, 기간과 등급에
   맞는 서로 다른 장면·행동·소재를 고르세요.
5. livingTips는 번들 전체에서 가능한 한 겹치지 않게 (같은 팁 3편 이상 등장 시 리젝).
6. 위 스펙 문구를 그대로 옮겨 적지 말고 자기 언어로 소화해 쓰세요.
7. **이름↔사주 이야기의 위치·비중·표현을 편마다 달리하세요** — 모든 편의 마지막 문단이 이름
   얘기로 끝나는 식의 고정 배치 금지. 어떤 편은 깊게, 어떤 편은 한 문장으로 스치게, **일부 편
   (특히 expert)에서는 아예 생략해도 됩니다**. (방향 자체는 불변.) ⚠ 같은 구절("이름의 자원오행이
   ~계열로…", "이름이 필요한 기운을 한 글자…")을 번들 안에서 4편 이상 재사용하면 스탬핑 검출로
   리젝됩니다 — 이름 효과를 말할 때마다 문장 구조를 새로 지으세요.
8. 전문가 문단은 **사주의 배치 자체**를 서술하세요("~한 배치예요/구조예요"). 저자의 판단 과정
   ("~라고 보았어요/짚었어요/새겼어요/풀었어요")을 서술하는 문장은 금지.
9. **이 번들의 지문(다른 번들과의 차별화)** — 구체 장면·조언 소재는 다음 팔레트를 우선 활용:
   **${palette.materials.join(' + ')}**. 문체 결: ${palette.style} 흔한 정답(예: "기록해 보세요",
   "산책해 보세요")을 이 팔레트의 구체 장면으로 바꿔 쓰세요. 사실·방향은 팔레트와 무관하게 정확히.

## 페어링·안전 규칙 (기존 계약 — 위반 시 리젝)
1. **평문 tier(summary·body·tips·cautions)에 사주 용어 금지**: ${JARGON_BANNED} 등.
   오행의 우리말 이름(나무·불·흙·쇠·물)과 강약의 쉬운 평문 표현만 허용.
2. **전문가 tier(expert)만 용어·#{태그}** — 글로서리 id 2~6개; 이 사람의 강약·격국에서 유도한 권장: ${s.suggestedExpertTags.map((t) => `#{${t}}`).join(', ')} (용신 축·격국 그룹·강약 처방·이름 보조 순). 이 팔레트를 축으로 삼되 편마다 다른 조합·비중으로 녹여 쓰고, 없는 태그를 지어내지 마세요.
   전문가 문단도 모든 문장 해요체. 코드 단어(영문 식별자) 금지.
   ⚠ **태그는 문장 속에 녹여 쓰세요** — "#{a} #{b} #{c}"처럼 문단 끝에 나열하면 해요체 종결 위반으로
   리젝됩니다. 존재하지 않는 태그 id를 지어내지 말고 권장 목록 위주로 쓰세요.
3. **모순 0**: ${cases.length}편 전부가 같은 사람 — 강약·격국·이름 방향이 편끼리 어긋나면 안 됩니다.
   등급(band)이 달라도 사람이 바뀌는 게 아니라 **시기의 날씨**가 바뀌는 것뿐입니다.
   ⚠ 강약 방향은 매 편의 평문(summary 또는 body)에 자연스럽게 드러나야 합니다.
   **"${s.strengthPlain}"을 억지로 반복하지 말고**, 뜻이 맞는 쉬운 생활어로 풀어 쓰세요.
   예: 중화는 "기복이 크지 않은", "한쪽으로 치우치지 않는", "안정된 흐름";
   신강은 "힘이 실리는", "추진력이 붙는", "주도적으로 밀고 가는";
   신약은 "쉽게 흔들릴 수 있는", "무리하면 지치는", "받침이 필요한" 식입니다.
4. **이름 정직성**: ${nameHonesty}
5. 평문은 절대 단정 대신 "~한 편이라" 조건/서술형. 요약↔본문↔전문가가 한 주제로 pairing.
${minor ? `6. **미성년 안전**: ${MINOR_BANNED} 등 금지, 나이에 맞는 언어.` : '6. 성인: 실행 가능한 조언, 불안 조장 금지.'}
7. 의료어('검진') 금지.

## 슬롯(런타임 치환) — 이것만, 필요할 때만
\`{{periodLabel}}\` \`{{currentSeasonName}}\` \`{{yongshinName}}\`(용신 오행명 — 특정 오행 단정 대신 이 슬롯) \`{{dayMasterName}}\`(일간).
조사 결합형: \`{{yongshinName:이가}}\`(이가/은는/을를/과와/으로로/이라라). 조사만 따로 슬롯으로 쓰지 말 것.

## 분량 (편당 — 엄수)
- summary ≤60자 **정확히 1문장(마침표 1개, 문장을 둘로 나누지 말 것)** 해요체. hook(선택) ≤24자 — 넘칠 것 같으면 생략.
- body 3~4문단, **각 문단 80~240자·2~5문장 — 마지막 문단 포함(한두 문장짜리 짧은 맺음말 문단 금지)**,
  전체 350~800자 — **하한에 붙이지 말고 400자 이상을 목표로** 쓰세요. 모든 문장 해요체(습니다/이다/명사 종결 금지).
- expert 1~2문단, 각 100~380자 — **120자 이상을 목표로**(100자 턱걸이는 리젝 위험). #{태그} 2~6개.
- livingTips 2~3(각 ≤30자) / cautions 1~2(각 ≤44자, 해요체).${academicGuidance}

## 출력
JSON만 반환: { "articles": [{ "caseId", "summary", "hook"?, "body": [], "expert": [], "livingTips": [], "cautions": [] }] }.
articles는 요청한 caseId ${cases.length}개를 **모두, 정확한 id로** 포함해야 합니다. JSON 밖에 다른 텍스트를 쓰지 마세요.`;
}
