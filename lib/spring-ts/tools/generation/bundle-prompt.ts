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
    return `${i + 1}. \`${c.caseId}\` — ${lens}${task}`;
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

## 학업운 전용 지침 (academic — 이 분야에만 적용, 위 규칙과 함께 지킬 것)
0. **이 사람의 학습 성향·리스크(이 격국 고유 — body에 생활어로 반드시 체감시킬 것, 사주 용어 금지)**: ${studyProfile}
   → body의 조언·리스크가 격국과 무관하게 비슷해지면 안 된다. 위 성향/리스크가 다른 격국과 **구별되게** 드러나야 하고, 특히 3문단(조절법)은 **이 격국의 리스크**를 짚어라. 일반 공부팁(포모도로·커피·음악·간식)에만 기대지 말고, 이 사람이 **어떤 학습에 반응하고(이해형/암기형/문제풀이형/표현형) 압박·마감에 어떻게 반응하며 혼자/함께 중 어느 쪽인지**를 해석에 녹여라.
   ⚠ **단, 격국 성향은 공유해도 구체 장면·문단·문장은 이 번들의 지문(아래 다양성 계약 9의 팔레트)으로 서로 달라야 한다** — 같은 격국의 다른 이름효과 번들(예: 인성·중립 vs 인성·역방향)과 **같은 문단·같은 조언 장면**이 나오면 크로스번들 중복으로 리젝된다. 격국 리스크(예: 인성=출력 밀림)를 말할 때도 그 장면을 **이 번들 팔레트의 소재**로 구현해, 남과 다른 문장으로 써라.${nameMatrixLine}
1. **body는 "공부 팁"이 아니라 "학업운 해석"이다. 3문단 구조로:**
   - 1문단: 이 시기에 공부가 **어떤 식으로 느껴질 수 있는지** + 어떤 공부 단위가 잘 맞는지. 형태 = [시기]+[공부 장면]+[느껴질 가능성]+[맞는 전략]. ⚠ 운세를 단정하지 말 것("학업운이 강하다/약하다·공부가 잘 된다·합격한다" 금지). ⚠ **1문단에 판단·강약·이름효과를 한꺼번에 몰아넣지 말 것** — 1문단은 느껴질 가능성+단위에 집중하고 정보 밀도를 낮춘다. ⚠ **각 body 문단은 170자를 넘기지 말 것**(특히 2문단이 길어지지 않게 — 한 문단 2~4문장으로).
   - 2문단: 그 기간 단위에 맞는 **구체적 공부 사용법**(아래 학업 이벤트 활용).
   - 3문단: **무리하기 쉬운 지점과 조절법**(불안 조장·결과 단정 금지).
2. **이름효과를 body 1문단 또는 3문단에 딱 1회, 비단정형으로 반영**(expert에만 두지 말 것). 예: "이름에서 보강되는 배움의 힘도 한 가지에 몰입하는 쪽과 잘 맞아요", "이름이 보태는 배움의 기운은 넓게 벌리기보다 하나를 붙드는 쪽으로 읽기 좋아요". ⚠ **이름효과가 나타나는 의미를 기간마다 다르게** 하라 — 오늘=한 세션의 마무리감, 이번주=요일 리듬의 지속, 이번달=한 과목 완주, 올해=상반기 방향 설정, 평생=오래 붙들어 축적. "하나에 집중"으로 15편을 수렴시키지 말 것. ⚠ **이름효과 문장 틀을 3~4종으로 로테이션**(비교형 "A보다 B일 때 ~" / 도치·조건형 "B일수록 ~ 또렷해져요" / 부정형 "A로는 잘 안 살고 B일 때 ~" / 명사구형 "이름이 더해 주는 든든함은 B에서 ~")하고, **문단 위치도 1·2·3문단으로 편마다 다르게** 둔다 — 같은 틀이 같은 자리에 반복되면 스탬핑처럼 읽힌다. ⚠ 틀뿐 아니라 **이름효과 주어 명사구도 편마다 바꿔라**(이름값 / 이름 덕에 붙는 뒷심 / 이름이 보태는 힘 / 이름이 더해 주는 든든함 등) — "이름이 받쳐 주는 배움의 뒷심" 같은 같은 구절을 4편 이상 쓰면 스탬핑으로 리젝된다. (nameEffect가 adverse/neutral이면 페어링 규칙을 우선하고 이 항목은 무시.)
3. **학업 이벤트를 기간마다 최소 1개** 구체적으로 넣어라(추상 '분량/주제' 대신): 시험(범위·일정), 자격증(과목), 강의(수강·복습), 발표·제출, 업무 학습. 기간 전략 단위 = 오늘: 한 세션·오늘 끝낼 과제 / 이번주: 요일별 리듬·주중 점검 / 이번달: 달 초 목표·중간 점검·말일 마감 / 올해: 상반기 방향·하반기에 성과로 잇기 / 평생: 타고난 학습 방식·장기 전략.
4. **추상어 상한(번들 전체 최대 2회): 흐름·기운·힘·결·바탕·잔잔.** "배움에 힘이 실려서" 같은 은유 오프닝을 반복하지 말고, 공부 장면에서 문장을 열어라.
5. **비겁 변별**: '같이 공부하는 사람(동료)' 모티프를 전 편에 깔지 말 것. 일부 편에만 쓰고, 나머지는 경쟁(같은 시험 준비자와 겨루기)·자기주도 점검·기록 비교 등 비겁의 다른 얼굴로 바꿔라. ⚠ **같은 등급(특히 mid) 편끼리 서로 비슷해지지 않게** — 기간마다 실제 활동·장면을 다르게 하라(예: today.mid=한 과목 방식 실험 / thisWeek.mid=요일별 과목 배치 / thisMonth.mid=한 강의 완강+노트 재구성 / thisYear.mid=분기별 과목 순환 / life.mid=학습 루틴 정착). "무난 → 방식 손보기 → 발판" 골격을 5편에 반복하지 말 것. ⚠ mid 편에서 "무난하게 흘러/무난하게 지나가는" 같은 상투구를 반복하지 말고, 무난함을 편마다 다른 생활어(기복이 크지 않은/한쪽으로 치우치지 않는/큰 굴곡 없는 등)로 표현하라.
6. **body 안전 표현(권장)**: ~하기 쉬운 편이에요 / ~로 느껴질 수 있어요 / ~와 잘 맞아요 / ~에 도움이 돼요 / ~쪽으로 가져가면 좋아요 / ~을 먼저 잡아두면 수월해요. **금지**: 학업운이 강해서/약해서, 반드시·무조건·확실히, 성공합니다·합격, 끝낼 수밖에·충분히 끝낼 수 있어요. 또한 "성과화"처럼 딱딱한 명사형, "이름값·이름 덕에 붙는 힘"처럼 굳은 상투 표현은 피하고 쉬운 생활어로 풀어 쓴다.
7. **cautions는 인과형**: "[트리거]하면 [학습 리듬/결과]가 [흐려질/흔들릴/줄어들/무거워질] 수 있어요". "하지 마세요"형 금지. 내부 목표 32자·하드 44자, 학습 행동어(분량·목표·자료·진도·복습·점검·계획·자리) 하나 포함.
8. **강약(중화) 반영 필수** — 매 편 summary 또는 body에 다음 표현 중 하나를 **그대로** 넣어라: "기복이 크지 않은", "한쪽으로 치우치지 않는", "한쪽으로 쏠리지 않는", "안정된", "무난한", "균형". 특히 등급이 high·low인 편은 문단1에 중화 기저를 되짚는 절("그래도 평소 기복이 크지 않은 쪽이라 크게 흔들릴 날은 아니니…")을 반드시 둔다 — 시기의 날씨(등급)와 별개로 사람 자체는 중화다. ⚠ 뜻만 맞는 변형("크게 치우치지 않는", "오르내림이 크지 않은")은 검증에서 못 잡히니 위 표현을 그대로 써라. ⚠ 단, 중화 표현은 **평문(summary/body)에만** 넣고 **편마다 다른 것으로 골라** 쓴다(같은 문구를 4편 이상 반복 금지). expert에는 "강약이 한쪽으로 쏠리지 않아/어느 편으로도 기울지 않아" 같은 중화 설명을 **밴드마다 똑같이 반복하지 말 것**(스탬핑으로 리젝된다) — expert에서 균형을 짚어야 하면 편마다 다른 문장으로.
9. **expert 태그 화이트리스트** — #{태그}는 다음 유효 id만 써라: #{yongshin} #{heeshin} #{bigeob} #{bigyeon} #{geobjae} #{sikshin} #{sanggwan} #{inseong} #{jeongin} #{pyeonin} #{jaeseong} #{gwanseong}. 목록에 없는 태그(예: #{ohaengBalance})를 지어내지 말 것. "오행 균형/치우치지 않음"은 태그가 아니라 평문("어느 쪽으로도 기울지 않는")으로 쓴다.
10. **상투 어미 반복 금지** — expert를 매 편 "…짜임이에요"로 닫지 말고 "…배치예요/구조예요/자리예요"를 섞어라. 문단1도 "느껴질 수 있어요 / 단위가 잘 맞아요" 틀을 15편 반복하지 말 것. 특히 low·조심 편 도입을 "~ 편하게 느껴질 수 있어요. 그래도…" 한 틀로 반복하지 말고 편마다 다른 장면으로 열어라.
11. **밴드별 편간 변별(스탬핑 최다 지점 — 한 밴드 5편은 "같은 사람×같은 톤×기간만 다름"이라 골격이 뭉치기 쉽다)**: 게이트는 12자 구절이 4편 이상에 겹치면 밴드 전체를 리젝한다. 한 밴드의 5편(오늘·이번주·이번달·올해·평생)을 **같은 골격에 명사만 갈아 끼워** 쓰지 말고, 편마다 다른 뼈대로 써라.
    - ⚠ **low·mid expert의 tag-weaving 틀 반복 금지** — 실제 리젝 예 "[기간]이 조심스러워도 축은 안 기울어, 무리해서 채우기보다 ~ 지키는 처방이 맞는 구조예요 … #{yongshin}을 ~로 좁혀 채우면서 #{heeshin}으로 곁을 받쳐 두면 …". "#{A}을 …로 좁혀 채우면서 #{B}으로 곁을 받쳐" 같은 구절을 두 편 이상 재사용 금지. 편마다 **태그 개수(2~6)·순서·위치를 바꾸고**(앞/뒤/1개만/일부 생략), 거는 동사도 바꿔라(받쳐/기대/살려/보태/채워 등).
    - ⚠ **high body 문단1 도입 틀 반복 금지** — 실제 리젝 예 "[기간] 손이/속도가/집중이 붙어서, 벼르던 ~ 볼/끝낼 만하게 느껴질 수 있어요. 다만 평소 [중화] 사람이라 [몰아 태우기]보다 ~ 나눠 두면 끝까지 가요". "~ 만하게 느껴질 수 있어요. 다만 평소 ~" 도입을 5편에 돌려쓰지 말 것 — 어떤 편은 공부 장면으로, 어떤 편은 질문으로, 어떤 편은 바로 전략으로 열고, "다만 평소 [중화]…" 절의 위치·문형도 편마다 바꿔라.
    - ⚠ **전략을 그 셀 body의 기간 장면으로 구체화**(추상 골격 금지): low=오늘 복습 한 대목/요일 리듬/한 과목만/기초 재정비/쌓은 것 지키기, high=오늘 한 대목 완결/요일 배분/달 마감/상하반기 방향/장기 축적. 각 편의 핵심 문장이 **그 기간에서만 성립하는 장면**을 담아야 한다.
12. **소프트 템플릿 금지(12자 n-gram이 안 겹쳐 게이트는 통과해도, 병렬로 읽으면 템플릿으로 읽히는 층 — 유료 체감을 직접 깎는다)**: 아래 셋을 피하라.
    - ⚠ **중화 연결 관용구 반복** — 항목8의 중화 키워드는 그대로 넣되(게이트 검출용), 그 키워드를 **매번 "~ 편이니/편이라" 같은 같은 연결 꼴**로 감싸지 마라. 키워드가 겹치는 편끼리는 절 모양·위치를 바꿔라(예: "한쪽으로 치우치지 않는 편이라 ~" / "원래 한쪽으로 치우치지 않아서 ~" / "~ 데다 기복이 크지 않은 사람이라"). 같은 "[중화]+편이니/편이라" 꼴이 3편을 넘기면 감점.
    - ⚠ **이름효과 대비 논리 고정** — "여러 갈래로 벌일 때보다 하나를 오래 붙들 때 살아나요"의 '넓게 벌리기 vs 하나 붙들기' 대비를 3편 넘게 재사용 금지. **대비 축 자체를 편마다 바꿔라**(빠르게 vs 오래 / 혼자 vs 함께 겨루며 / 새로 벌이기 vs 다시 다지기 / 넓게 vs 깊게). 또 이름효과를 매 편 3문단 "다만" 뒤 같은 슬롯에 두지 말고 항목2의 문단 위치 로테이션(1·2·3문단)을 실제로 지켜라.
    - ⚠ **문단 골격·도입 획일화** — 15편이 '중화 프레이밍→전술→다만+이름+맺음' 한 흐름을 따르고 3문단을 거의 다 "다만/하지만"으로 열면 템플릿으로 읽힌다. **최소 5편 이상은 3문단을 "다만" 외 방식**(장면 전환·조건절·바로 조절 지침)으로 열고, 일부 편은 이름효과·조절 지침을 2문단에 섞어 문단 순서를 바꿔라.
13. **격국 정의 문구를 expert에서 셀 간 반복 금지(라이브 청크에서 격국별 리젝 1위 원인)**: 위 "이 사람 · 격국"에 준 정의 문구(관성=규율·책임·지위로 자리를 얻는 / 비겁=자립·경쟁·동료로 나를 세우는 / 인성=배우고 수용해 힘을 얻는 / 식상=표현·생산으로 드러내는 / 재성=재물·현실을 다루는)를 expert가 **거의 그대로 여러 편에 되풀이하면** bundle-ngram-stamp로 밴드 전체가 리젝된다(실측: gwanseong의 "규율과 책임으로 자리를 얻는 …의 축"이 5~7편 반복 → 리젝).
    - ⚠ 격국 축은 **편마다 다른 낱말·다른 각도**로 가리켜라 — 관성이면 자리/책임/규율/자격/질서/직분/관문/절차를, 비겁이면 자립/주도/완주/겨루기/동료를, 인성이면 배움/받침/문서/자격을 편별로 다르게 짚고, **정의 문장을 그대로 옮기지 마라**.
    - ⚠ 격국을 **모든 편에서 설명하지 마라** — 일부 편(특히 low)은 격국 태그·설명을 생략하고 강약 처방·#{yongshin}·#{heeshin}·이름으로만 열어도 된다.
    - ⚠ expert 도입을 "…배치예요/…예요 [격국 정의구]…" 한 틀로 여러 편에 반복하지 말 것 — 편마다 다른 장면·문형으로 시작하라.
14. **특정 날짜·요일 고정 지시 금지(열람 시점이 언제일지 모른다)**: 특정 요일 이름(월·화·수…)·특정 월(3월·6월)·달 초/보름/말일·상반기/하반기를 **고정 지시하지 마라**(이미 지난 시점에 노출되면 어긋난다). 대신 상대 표현을 써라 — "주 초/주 중반/남은 요일", "이번 달 남은 기간", "올해 남은 기간의 앞부분/뒷부분", "전체의 절반이 지나는 시점에 한 번 점검". 요일 배치를 권할 땐 특정 요일 대신 "요일마다 과목을 갈라"처럼 일반화하라. (런타임 슬롯 \`{{currentSeasonName}}\`·\`{{periodLabel}}\`은 허용.)
15. **이름효과 4단계를 행동 수준에서 구분**(mild와 strong이 목표 크기·운용까지 같아지면 안 됨): **boost_mild**=조건이 갖춰질 때 오는 작은 도움, 루틴·꾸준함이 발현 조건 → 목표는 한 단계만 위로. **boost_strong**=더 큰 목표를 감당할 여력 → 도전 범위를 키우되 과신·과잉 사용 경계. **neutral**=이름은 가감하지 않음, 원국(성향)과 시기 신호만으로 설명(이름 긍정효과 서술 금지 — 게이트 리젝). **adverse**=무엇이 이미 과하고 무엇이 부족한지 짚고 → 그 부족을 생활 습관으로 보완.
16. **등급(high/mid/low) 결과 수준을 분리**(high도 low도 "하나만 하고 멈춰라"로 수렴 금지): **high**=도전 범위 확대 + 시험·제출·발표처럼 결과가 남는 행동. **mid**=유지·실험·정리. **low**=회복·범위 축소·오류 방지. 목표 강도와 산출물 수준이 등급마다 달라야 한다. ⚠ **expert는 한 번은 인과를 풀어라**: [이 격국의 학습 성향] → [이름이 그 성향을 강화/중립/역행] → [현재 기간 신호와의 상호작용] → [그래서 필요한 행동]. "용신 채운다/희신 데운다"만 추상 반복하지 말 것.
17. **mid(무난) 밴드 = 번들 간 수렴 최대 감점축(3차 평가·재검수 공통 지적, 실측 확인)**: mid는 '무난'이라 격국과 무관하게 아래 **두 골격**으로 뭉친다(실측: 세 격국이 mid에서 같은 문장이 됨) — ⚠ **이 둘을 mid에 쓰지 마라**:
    - (a) "무난한 하루/달이라 → 공부 **방식을 한 번 실험**/살짝 바꿔 보기"
    - (b) "듣던 **강의를 완강**하고 **노트를 다시 정돈**"
    → '무난'은 활동을 generic으로 바꾸라는 뜻이 **아니라**, 위 셀별 **'핵심 활동'(격국 고유 과제)을 그대로 활동으로 삼되 강도만 낮추라**는 뜻이다. mid 활동도 격국마다 달라야 한다 — 예: 비겁 mid=내가 정한 한 구간을 작게라도 완주 / 관성 mid=마감 기준 한 칸 점검 / 인성 mid=읽은 대목 하나를 내 말로 정리 / 식상 mid=작은 산출 하나 내보내기 / 재성 mid=쓸모 큰 것 하나에 시간 몰기 / 특수 mid=몰입 갈래 하나 이어가며 기본 하나 점검.
18. **livingTips·cautions를 격국 고유로 — 다른 격국 번들과 같은 팁·주의를 쓰지 말 것(게이트가 3번들+ 반복을 리젝)**: 일반 팁("오늘 끝낼 걸 한 대목으로 줄이기")을 전 격국에 돌려쓰지 말고, 이 격국의 행동·실패 패턴에 맞춰라 — 비겁=비교 화면 닫기·막히면 한 질문 보내기·내 기준 최소 몫 / 관성=필수 마감 조건 확인·체크리스트 한 칸·종료 시각 정하기 / 인성=새 자료 차단·기존 메모 한 문단 설명·막힌 곳만 표시 / 식상=만든 것 하나 다듬어 내보내기 / 재성=우선순위 3개만 남기기.
19. **모티프 절제 + 생활환경 중립**: 한 소재(몸·길·책상·좋아하는 것·장보기 등)를 번들에 도배하지 마라 — **같은 낱말은 카드당 최대 4회, 번들 전체 30회 미만**(넘으면 리젝). ⚠ **격국 과제의 핵심어도 모티프로 센다** — 위 '핵심 활동'을 매 셀에 넣다 보면 과제 키워드(관성=통과/관문, 비겁=완주, 인성=정리, 재성=투자, 식상=산출)가 30회를 넘기기 쉽다(실측: gwanseong '통과' 39회 리젝). 과제 자체는 유지하되 **그 낱말은 동의어로 흩어라**(통과→관문·판정 기준·제출 조건·확인 지점, 완주→끝까지·마무리·완결, 정리→요약·되짚기·매듭). 그 소재가 사주 근거보다 앞서면 안 된다. ⚠ **출퇴근·정류장·물리적 책상/책장·유료 강의 구매를 전제하지 말 것**(재택·학생·이동 제약 사용자 배제) — 필요하면 "이동 중이라면/책상이 있다면"처럼 선택형으로. ⚠ 사용자를 **소비 습관으로 낙인**(자꾸 사들이는 사람)하거나 **신체 증상을 사주로 단정**하지 마라.
20. **마감 안전(유료 서비스 필수)**: low·조심 편이라도 **현실 마감을 방치·미루라 하지 마라** — "마감은 기한만 확인하고 손 떼기"·"마감을 넉넉히 미뤄" 금지(게이트 리젝). 대신 **필수 마감=기한·최소 제출 조건 확인 후 필수분만 처리 / 조정 가능=미리 협의해 재설정 / 비필수 새 범위=내일로**. "덜어내기"는 새 일·욕심에 적용하고 의무엔 적용하지 마라.
21. **평생·low 의미 + 이름 확대 표현**: **평생 편은 생애 기질이다** — 평생·low를 "이 국면/이 철" 같은 일시 예보로 쓰지 말고 **반복해서 나타나는 취약 패턴·지쳤을 때의 장기 방어 습관·평생 관리할 균형점**으로 써라. ⚠ 강한 이름효과(boost_strong)는 "**남보다** 한 단계 크게"가 아니라 "**평소보다**(본인이 감당할 범위) 크게"로 — 남과의 우열이 아니라 자기 그릇의 확대다(caution의 '남과 견주지 말라'와 모순 금지).` : '';

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
