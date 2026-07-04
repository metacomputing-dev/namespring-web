/**
 * expert-prompt.ts -- Build the OPUS 사주명리+성명학 expert prompt for one case,
 * plus the structured-output schema the agent must return.
 *
 * The agent receives ONE fully-branched archetype (GenerationCase) and returns
 * a complete, paired article: plain general tier + orthodox expert tier that
 * agree with zero discrepancy (see pairing-contract.md). Axis fields
 * (category/period/audience/band + the branch coords) are NOT asked of the
 * agent — the harness stamps them from the case, so the agent cannot drift.
 */
import type { GenerationCase } from './case-schema.js';

/** Saju jargon banned in the plain tier (mirror of the gate's list). */
const JARGON_BANNED =
  '오행·용신·희신·기신·구신·격국·십성·십신·정재·편재·재성·편관·식신·식상·겁재·비겁·신살·상생·상극·조후·대운·득령·득지·득세·원형이정·역마·도화';

const MINOR_BANNED = '연애·결혼·배우자·투자·보증·전성기·음주·술자리·이혼';

/** JSON Schema for the agent's structured output (article body only; the
 *  harness adds axis + provenance fields). */
export const ARTICLE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'body', 'expert', 'livingTips', 'cautions'],
  properties: {
    summary: { type: 'string', description: '≤60자, 1문장, 해요체, 평문(용어 금지)' },
    hook: { type: 'string', description: '선택, ≤24자' },
    body: {
      type: 'array', minItems: 3, maxItems: 4,
      items: { type: 'string', description: '80~240자, 2~5문장, 해요체, 평문' },
    },
    expert: {
      type: 'array', minItems: 1, maxItems: 2,
      items: { type: 'string', description: '100~380자, 2~6문장, 해요체, #{태그} 포함(전체 2~6개)' },
    },
    livingTips: { type: 'array', minItems: 2, maxItems: 3, items: { type: 'string', description: '≤30자' } },
    cautions: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string', description: '≤44자' } },
  },
} as const;

export function buildExpertPrompt(c: GenerationCase): string {
  const s = c.spec;
  const minor = s.audienceSafety === 'minor';
  const yongshinLine = s.yongshinKo
    ? `- 용신(가장 도움이 되는 오행): **${s.yongshinKo}** — 평문에선 "채움이 필요한 ${s.yongshinKo} 기운"으로, 전문가 tier에선 #{yongshin} 오행으로.`
    : `- 용신 오행은 이 케이스에서 고정하지 않음 → 평문에서 특정 오행 이름을 단정하지 말고, 필요하면 슬롯 {{yongshinName}} 사용.`;

  return `당신은 정통 사주명리학과 성명학(음양오행·자원오행·사격 원형이정·수리)을 깊이 섭렵한 전문가 저술가입니다.
아래 **하나의 사주·이름 원형(archetype)**에 대해, 그 사람에게 **가장 정확하고 자연스러운 완결글 한 편**을 씁니다.
사용자가 처음 보는 **평문**과 "자세히"에서 펼쳐지는 **전문가 근거**가 **괴리 없이 짝(pair)**을 이뤄야 합니다.

## 이 원형(archetype)
- 분야/기간/독자/등급: **${c.category} / ${c.period} / ${c.audience} / 등급 ${c.band}**
- 강약: **${s.strengthTerm}** (평문 형용사: "${s.strengthPlain}")
${yongshinLine}
- 이름↔사주 보강: **${s.nameReinforceKo}** (성명학: 이름의 자원오행이 사주 오행에 더해져 combinedDistribution을 이룬 결과)
- 조언의 방향(강약이 강제): **${s.adviceDirection}**

## 반드시 지킬 페어링·안전 규칙
1. **평문 tier(summary·hook·body·livingTips·cautions)에 사주 용어 금지**: ${JARGON_BANNED} 등 금지.
   오행 **이름**(나무·불·흙·쇠·물)과 평문 형용사는 허용. "${s.strengthPlain}" 같은 평문으로 강약을 표현.
2. **전문가 tier(expert)만 용어와 #{태그}**. 태그는 글로서리 id로 2~6개. 이 케이스에 맞는 것:
   최소 ${s.suggestedExpertTags.map((t) => `#{${t}}`).join(', ')} 포함 권장. (신강/신약 근거, 용신, 분야 십성.)
3. **모순 0**: 평문과 전문가가 같은 방향. 강약 방향(${s.strengthTerm}=${s.adviceDirection.split('(')[0]})을 둘 다 지킴.
   ${c.nameReinforce === 'none' ? '이름보완=none이므로 어디서도 "이름이 채워 준다"라고 쓰지 마세요(정직).' : '이름보완을 과장하지 말고 실제 정도만.'}
4. **절대 단정 완화**: 평문은 "~한 편이라/~기 쉬워요"처럼 서술·조건으로. 운명 단정 금지.
5. **요약↔본문↔전문가 pairing**: 요약이 약속한 주제를 본문이 풀고 전문가가 근거를 댐.
${minor ? `6. **미성년 안전**: ${MINOR_BANNED} 등 성인 주제 금지. 나이에 맞는 언어.` : '6. 성인 독자: 과장·불안 조장 금지, 실행 가능한 조언 중심.'}
7. 의료어('검진' 등) 금지.

## 슬롯(런타임 치환) — 이것만 사용
- \`{{periodLabel}}\`: 기간 표시(예: 올해/이번 주). 기간을 부를 땐 이 슬롯 사용.
- \`{{currentSeasonName}}\`: 현재 계절(봄/여름/…). 필요 시.
- \`{{dayMasterName}}\`: 일간 오행(이 케이스에서 고정 안 됨). 일간을 언급하려면 슬롯으로.
- 강약·용신은 이 케이스에서 **고정**이므로 슬롯 말고 **자연스러운 평문으로 직접** 쓰세요("${s.strengthPlain}", ${s.yongshinKo ? `"${s.yongshinKo} 기운"` : '용신은 슬롯'}).
- 조사가 필요하면 \`{{yongshinName:이가}}\` 형태(쌍: 이가/은는/을를/과와/으로로/이라라).

## 분량(엄수)
- summary ≤60자·1문장·해요체. hook(선택) ≤24자.
- body 3~4문단, 각 80~240자·2~5문장·해요체. 전체 350~800자.
- expert 1~2문단, 각 100~380자, 문단 전체에 서로 다른 #{태그} 2~6개.
- livingTips 2~3개(각 ≤30자), cautions 1~2개(각 ≤44자).

## 출력
StructuredOutput 도구로 { summary, hook?, body[], expert[], livingTips[], cautions[] } JSON만 반환.
평문은 이 원형의 사람이 "내 얘기다" 느끼도록, 전문가는 그 근거를 명리·성명학으로 정확히. 두 층이 한 몸이 되게.`;
}
