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
const MATERIAL_PALETTES: readonly string[] = [
  '몸의 감각(호흡·자세·피로·컨디션)',
  '공간과 물건(책상·집·정리·동선)',
  '시간의 결(아침저녁·마감·달력·리듬)',
  '사람 사이(대화·연락·거리감·협업)',
  '말과 기록(메모·일기·말버릇·약속의 언어)',
  '돈과 살림의 장면(장보기·구독·저금통·영수증)',
  '길과 이동(출퇴근·산책·여행·환승)',
  '취향과 몰입(취미·음악·음식·소소한 즐거움)',
];
const STYLE_NOTES: readonly string[] = [
  '비유는 아끼고 담백한 문장으로.',
  '계절과 날씨의 결을 한 스푼만 섞어서.',
  '한두 편쯤은 부드러운 질문으로 열어도 좋게.',
  '동사 중심의 움직이는 문장으로.',
];

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function paletteFor(bundleKey: string): { materials: string[]; style: string } {
  const h = fnv1a(bundleKey);
  const first = h % MATERIAL_PALETTES.length;
  const second = (first + 1 + ((h >>> 8) % (MATERIAL_PALETTES.length - 1))) % MATERIAL_PALETTES.length;
  return {
    materials: [MATERIAL_PALETTES[first], MATERIAL_PALETTES[second]],
    style: STYLE_NOTES[(h >>> 16) % STYLE_NOTES.length],
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
    const lens = isStages
      ? `생애 단계: ${STAGE_LABEL[c.audience] ?? c.audience}`
      : `${PERIOD_LENS[c.period] ?? c.period} / 등급 ${c.band}: ${BAND_TONE[c.band] ?? ''}`;
    return `${i + 1}. \`${c.caseId}\` — ${lens}`;
  }).join('\n');

  const palette = paletteFor(bundleKeyOfCase(c0));
  const genderLine = s.genderTerm
    ? `- 성별: **${s.genderTerm}** — 이 분야(${c0.category})는 성별에 따라 해석이 갈립니다. 평문에선 자연스럽게.`
    : '- 성별 분기 없음. 중립적으로.';
  const nameHonesty = s.nameIsAdverse
    ? '⚠ **이름이 부족한 기운을 채워 주지 않는(오히려 넉넉한 쪽을 키우는) 경우.** 어느 편에서도 "이름이 채워 준다"라고 쓰지 말 것. 부족한 기운은 생활에서 챙기라는 정직한 처방으로, 낙인 없이 담담하게.'
    : '이름 보강은 실제 정도(강/약)만큼만, 과장 없이. 매 편마다 이름 얘기를 반복하지 말고 자연스러운 자리에서만.';

  return `당신은 정통 사주명리학과 성명학(음양오행·자원오행·사격 원형이정·수리)을 깊이 섭렵한 전문가 저술가입니다.
지금부터 **한 사람**을 위해 ${c0.category} 분야의 완결글 **${cases.length}편(챕터)**을 씁니다. 이 ${cases.length}편은
그 사람의 리포트에 **함께 노출**됩니다. 독자는 유료 독자입니다 — 한 편 한 편이 "내 얘기"로 읽히고,
${cases.length}편을 이어 읽어도 같은 말의 반복이 아니라 **한 권의 잘 짜인 챕터들**로 느껴져야 합니다.

## 이 사람 (모든 편에 공통 — 서로 모순 금지)
- 강약: **${s.strengthTerm}**(평문 "${s.strengthPlain}") → 조언 방향: ${s.adviceDirection}
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
2. **전문가 tier(expert)만 용어·#{태그}** — 글로서리 id 2~6개; 권장: ${s.suggestedExpertTags.map((t) => `#{${t}}`).join(', ')} + 격국·강약 근거.
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
- livingTips 2~3(각 ≤30자) / cautions 1~2(각 ≤44자, 해요체).

## 출력
JSON만 반환: { "articles": [{ "caseId", "summary", "hook"?, "body": [], "expert": [], "livingTips": [], "cautions": [] }] }.
articles는 요청한 caseId ${cases.length}개를 **모두, 정확한 id로** 포함해야 합니다. JSON 밖에 다른 텍스트를 쓰지 마세요.`;
}
