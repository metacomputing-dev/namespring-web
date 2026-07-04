/**
 * expert-prompt.ts -- OPUS 사주명리+성명학 expert prompt for one CLASS (v2),
 * plus the structured-output schema.
 *
 * The class fixes 강약(coarse) · 격국family · nameEffect(자원오행 통합의 부호) ·
 * gender(민감분야). The expert writes one paired article; the harness stamps
 * axis + provenance fields so the agent cannot drift.
 */
import type { GenerationCase } from './case-schema.js';

const JARGON_BANNED =
  '오행·용신·희신·기신·구신·격국·십성·정재·편재·재성·편관·식신·상관·겁재·비겁·신살·상생·상극·조후·대운·득령·득지·원형이정·역마·도화';
const MINOR_BANNED = '연애·결혼·배우자·투자·보증·전성기·음주·술자리·이혼';

export const ARTICLE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'body', 'expert', 'livingTips', 'cautions'],
  properties: {
    summary: { type: 'string', description: '≤60자, 1문장, 해요체, 평문(용어 금지)' },
    hook: { type: 'string', description: '선택, ≤24자' },
    body: { type: 'array', minItems: 3, maxItems: 4, items: { type: 'string', description: '80~240자, 2~5문장, 해요체, 평문' } },
    expert: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string', description: '100~380자, #{태그} 포함(전체 2~6개)' } },
    livingTips: { type: 'array', minItems: 2, maxItems: 3, items: { type: 'string', description: '≤30자' } },
    cautions: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string', description: '≤44자' } },
  },
} as const;

export function buildExpertPrompt(c: GenerationCase): string {
  const s = c.spec;
  const minor = s.audienceSafety === 'minor';
  const genderLine = s.genderTerm
    ? `- 성별: **${s.genderTerm}** — 이 분야(${c.category})는 성별에 따라 해석이 갈리는 자리예요(관성=남편/자식 등). 성별에 맞게 서술하되 평문에선 자연스러운 표현으로.`
    : '- 성별: 이 분야에선 성별 분기 없음. 중립적으로.';
  const nameHonesty = s.nameIsAdverse
    ? '⚠ **이름이 부족한 기운을 채워 주지 않는(오히려 넉넉한 쪽을 키우는) 경우**입니다. 평문·전문가 어디서도 "이름이 채워 준다"라고 쓰지 말고, **부족한 기운은 생활에서 챙기라**는 정직한 처방으로. (해로운 이름이라 낙인찍지는 말고, 담담하게.)'
    : '이름 보강을 실제 정도(강/약)만큼만, 과장 없이.';

  return `당신은 정통 사주명리학과 성명학(음양오행·자원오행·사격 원형이정·수리)을 깊이 섭렵한 전문가 저술가입니다.
아래 **하나의 원형(클래스)**에 대해, 그 사람에게 **가장 정확하고 자연스러운 완결글 한 편**을 씁니다.
평문(처음 보이는 글)과 전문가 근거(펼침)가 **괴리 없이 짝(pair)**을 이뤄야 합니다.

## 이 원형
- 분야/기간/독자/등급: **${c.category} / ${c.period} / ${c.audience} / 등급 ${c.band}**
- 강약: **${s.strengthTerm}**(평문 "${s.strengthPlain}") → 조언 방향: **${s.adviceDirection}**
- 격국(삶의 구조): **${s.gyeokgukTerm}** — ${s.gyeokgukMeaning}
- 이름↔사주 통합(자원오행이 사주에 합산된 결과): **${s.nameEffectPlain}** / (전문가 근거: ${s.nameEffectExpert})
${genderLine}

## 페어링·안전 규칙 (하나라도 어기면 리젝)
1. **평문 tier(summary·body·tips·cautions)에 사주 용어 금지**: ${JARGON_BANNED} 등. 오행 **이름**(나무·불·흙·쇠·물)·평문 형용사만.
2. **전문가 tier(expert)만 용어·#{태그}** (글로서리 id 2~6개; 권장: ${s.suggestedExpertTags.map((t) => `#{${t}}`).join(', ')} + 격국·강약 근거).
3. **모순 0**: 평문·전문가가 같은 방향. 강약(${s.strengthTerm}=${s.adviceDirection.split('(')[0]})과 격국 전략을 둘 다 지킴.
4. **이름 정직성**: ${nameHonesty}
5. **절대 단정 완화**(평문은 "~한 편이라"), 요약↔본문↔전문가 pairing 유지.
${minor ? `6. **미성년 안전**: ${MINOR_BANNED} 등 금지, 나이에 맞는 언어.` : '6. 성인: 실행 가능한 조언, 불안 조장 금지.'}
7. 의료어('검진') 금지.

## 슬롯(런타임 치환) — 이것만
- \`{{periodLabel}}\`(기간), \`{{currentSeasonName}}\`(계절), \`{{yongshinName}}\`(용신 오행명 — 이 클래스에선 오행이 고정 안 되므로 특정 오행 단정 대신 이 슬롯), \`{{dayMasterName}}\`(일간). 강약·격국·nameEffect는 고정이니 자연스러운 평문으로 직접.
- 조사: \`{{yongshinName:이가}}\`(이가/은는/을를/과와/으로로/이라라).

## 분량(엄수)
summary ≤60자·1문장·해요체 / body 3~4문단 각 80~240자·해요체 / 전체 350~800자 / expert 1~2문단에 #{태그} 2~6개 / livingTips 2~3(각 ≤30) / cautions 1~2(각 ≤44).

## 출력
StructuredOutput으로 { summary, hook?, body[], expert[], livingTips[], cautions[] } JSON만. 평문은 "내 얘기다", 전문가는 명리·성명학 근거로 정확히, 두 층이 한 몸이 되게.`;
}
