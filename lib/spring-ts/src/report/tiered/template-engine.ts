/**
 * template-engine.ts -- Resolve template tokens into ParagraphToken arrays
 *
 * A fragment's `templateTokens` is a mix of {kind:'text', value} (plain
 * prose), {kind:'slot', name, type} (variant pool / feature lookup), and
 * {kind:'tag', tagId, label} (inline glossary reference). The engine
 * resolves slots, leaves text and tag tokens unchanged, then groups
 * everything into ParagraphToken[] suitable for TaggedParagraph consumption.
 */

import type { ParagraphToken, TaggedParagraph } from '../types.js';
import type { FeatureVector } from './feature-selector.js';
import type { NarrativeFragment, FragmentToken } from './fragment-registry.js';

const ELEMENT_NAME_KO: Record<string, string> = {
  WOOD: '나무', FIRE: '불', EARTH: '흙', METAL: '쇠', WATER: '물',
};

const ELEMENT_METAPHOR_KO: Record<string, string> = {
  WOOD: '자라는 나무', FIRE: '피어나는 불꽃', EARTH: '단단한 자리',
  METAL: '맑게 다듬은 쇠', WATER: '깊이 흐르는 물',
};

const AGE_LABEL_KO: Record<string, string> = {
  '0-9': '어린 시절', '10-19': '청소년기', '20-29': '청년기',
  '30-39': '활발한 활동기', '40-54': '장년기', '55-69': '안정기', '70+': '원숙기',
};

function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pickFromPool(pool: readonly string[], seed: number): string {
  if (pool.length === 0) return '';
  return pool[seed % pool.length];
}

export function normalizeRenderedText(value: string): string {
  let out = value;
  out = out.replace(/(나무|불|흙|쇠|물) 타고난 중심 기운에/g, '$1 기운을 타고난 사람에게');
  out = out.replace(/(나무|불|흙|쇠|물) 타고난 중심 기운의/g, '$1 기운을 타고난 사람의');
  out = out.replace(/(나무|불|흙|쇠|물) 타고난 중심 기운/g, '$1 기운을 타고난 사람의 흐름');
  out = out.replace(/(나무|불|흙|쇠|물) 도움이 되는 기운은/g, '$1 기운은');
  out = out.replace(/(나무|불|흙|쇠|물) 도움이 되는 기운이/g, '$1 기운이');
  out = out.replace(/양의 타고난 중심 기운 흐름/g, '바깥으로 향하는 타고난 흐름');
  out = out.replace(/음의 타고난 중심 기운 흐름/g, '안쪽에서 다듬는 타고난 흐름');
  out = out.replace(/중립적인 타고난 중심 기운 흐름/g, '상황에 맞춰 움직이는 타고난 흐름');
  out = out.replace(/기운이 매우 강한 상태 흐름/g, '기운이 매우 강한 흐름');
  out = out.replace(/기운이 강한 상태 흐름/g, '기운이 강한 흐름');
  out = out.replace(/기운이 매우 약한 상태 흐름/g, '기운이 매우 약한 흐름');
  out = out.replace(/기운이 약한 상태 흐름/g, '기운이 약한 흐름');
  out = out.replace(/균형 흐름/g, '균형 잡힌 흐름');
  out = out.replace(/작은 결을 차곡차곡/g, '작은 흐름을 차곡차곡');
  out = out.replace(/다듬는 결/g, '다듬는 방식');
  out = out.replace(/결을 잡아 가는 결/g, '흐름을 잡아 가는 모습');
  out = out.replace(/결이 또렷해지는 결/g, '방향이 또렷해지는 흐름');
  out = out.replace(/결의 결정/g, '결정');
  out = out.replace(/의 결과 잘/g, '의 흐름과 잘');
  out = out.replace(/자리의 결/g, '자리의 방향');
  out = out.replace(/자기 결(?!과|정)/g, '자기 흐름');
  out = out.replace(/평생의 결/g, '평생의 흐름');
  out = out.replace(/한 달의 결/g, '한 달의 방향');
  out = out.replace(/이번 달의 결/g, '이번 달의 흐름');
  out = out.replace(/오늘의 직업 결/g, '오늘의 직업 흐름');
  out = out.replace(/인생 전체의 직업 결/g, '인생 전체의 직업 흐름');
  out = out.replace(/결이 한결/g, '흐름이 한층');
  out = out.replace(/자기 결과 다른 흐름/g, '자기 속도와 다른 흐름');
  out = out.replace(/흐름 흐름/g, '흐름');
  out = out.replace(/학업과 일는/g, '학업과 일은');
  out = out.replace(/겁재이/g, '겁재가');
  out = out.replace(/한 평생/g, '한평생');
  out = out.replace(/#용신방향/g, '#용신 방향');
  out = out.replace(/자기 흐름정의/g, '자기 점검의');
  out = out.replace(/자기 흐름과 옆에/g, '자기 결과 옆에');
  out = out.replace(/친구의 결과를 자기 결과 옆에 둘수록/g, '친구의 성과를 자기 기준으로 삼을수록');
  out = out.replace(/친구의 결과를 자기 결과 옆에 두는 거예요/g, '친구의 성과를 자기 기준으로 삼는 거예요');
  out = out.replace(/자기 결과 가족 흐름/g, '자기 자리와 가족 흐름');
  out = out.replace(/자기 결과 가족 결/g, '자기 자리와 가족 흐름');
  out = out.replace(/결의 시기/g, '흐름의 시기');
  out = out.replace(/좋아하는 결과 잘하는/g, '좋아하는 분야와 잘하는 일이');
  out = out.replace(/자기 가정의 작은 결과 양가의/g, '자기 가정의 작은 일과 양가의');
  out = out.replace(/자기 가정의 결과 양가/g, '자기 가정의 일과 양가');
  out = out.replace(/궁실의 결과 잘/g, '궁실 흐름과 잘');
  out = out.replace(/동료의 결과 잘/g, '동료와도 잘');
  out = out.replace(/자기가 가까운 사람의 자리/g, '가까운 사람의 자리');
  out = out.replace(/큰 결정은 미루고/g, '중요한 결정은 한 번 더 검토하고');
  out = out.replace(/큰 결정은 미루는 게/g, '중요한 결정은 한 번 더 검토하는 게');
  out = out.replace(/큰 결정은 한 박자 미루/g, '중요한 결정은 한 박자 늦추');
  out = out.replace(/큰 결정은 다음 주로 미루/g, '중요한 결정은 다음 주에 다시 보');
  out = out.replace(/큰 결정은 다음 달로 미루/g, '중요한 결정은 다음 달에 다시 보');
  out = out.replace(/큰 결정은 다음 해로 미루/g, '중요한 결정은 다음 해에 다시 보');
  out = out.replace(/큰 결정은 다음 자리로 미루/g, '중요한 결정은 다음 기회에 다시 보');
  out = out.replace(/갑작스런 큰 결정은 미루기/g, '갑작스러운 큰 결정은 한 번 더 검토하기');
  out = out.replace(/큰 결정은 한 박자 늦추기/g, '중요한 결정은 한 박자 늦추기');
  out = out.replace(/하루 유예해 보세요/g, '하루 여유를 두고 확인해 보세요');
  out = out.replace(/#편재 성 선택/g, '#편재가 만드는 기회성 선택');
  out = out.replace(/#정재 식 확인/g, '#정재의 확인 절차');
  out = out.replace(/#도화이/g, '#도화가');
  out = reduceOverusedGyeol(out);
  out = out.replace(/돈 흐름의 흐름/g, '돈의 흐름');
  out = out.replace(/인생 흐름의 흐름/g, '인생 흐름');
  out = out.replace(/흐름의 흐름/g, '흐름');
  out = out.replace(/흐름을 점검하는 흐름/g, '흐름을 점검하는 자리');
  out = out.replace(/흐름을 보여 주는 흐름/g, '흐름을 보여 주는 신호');
  out = out.replace(/흐름의 모양을 만드는 흐름/g, '흐름의 모양을 만들어 가는 과정');
  out = out.replace(/흐름을 잡아 가는 흐름/g, '흐름을 잡아 가는 과정');
  out = out.replace(/흐름을 봐 가는 흐름/g, '흐름을 봐 가는 방식');
  out = out.replace(/흐름이 더 또렷해지는 흐름도/g, '흐름이 더 또렷해지는 경우도');
  out = out.replace(/도움이 되는 흐름도/g, '도움이 될 때도');
  out = out.replace(
    /흐름이 (천천히 |한층 )?(단단해지는|부드러워지는|또렷해지는|깊어지는) 흐름이에요/g,
    (_match, adverb: string | undefined, verb: string) => `흐름이 ${adverb ?? ''}${verb.replace('지는', '져요')}`,
  );
  out = out.replace(/오행 다섯 흐름/g, '오행 다섯 기운');
  out = out.replace(/나무·불·흙·쇠·물 다섯 흐름/g, '나무·불·흙·쇠·물 다섯 기운');
  out = out.replace(/보여 주는 흐름이에요/g, '보여 주는 점수예요');
  out = out.replace(/흐름이라 흐름이/g, '흐름이라 전체 흐름이');
  out = out.replace(/부족한 흐름을 채울 흐름/g, '부족한 부분을 채울 보완점');
  out = out.replace(/더 또렷이 살려 주는 흐름이라/g, '더 또렷이 살려 주는 신호라');
  out = out.replace(/흔들림을 줄이는 흐름이라/g, '흔들림을 줄이는 신호라');
  return out.replace(/([.!?])(?=[가-힣])/g, '$1 ');
}

function reduceOverusedGyeol(value: string): string {
  const count = (value.match(/결/g) ?? []).length;
  if (count === 0) return value;

  let out = value;
  out = out.replace(/결이에요/g, '흐름이에요');
  out = out.replace(/결입니다/g, '흐름입니다');
  out = out.replace(/결이라/g, '흐름이라');
  out = out.replace(/결이고/g, '흐름이고');
  out = out.replace(/결이/g, '흐름이');
  out = out.replace(/결은/g, '흐름은');
  out = out.replace(/결을/g, '흐름을');
  out = out.replace(/결로/g, '흐름으로');
  out = out.replace(/결의/g, '흐름의');
  out = out.replace(/결도/g, '흐름도');
  out = out.replace(/결만/g, '흐름만');
  out = out.replace(/결처럼/g, '흐름처럼');
  out = out.replace(/결마다/g, '흐름마다');
  return out;
}

function startsWithParticle(value: string): boolean {
  return /^(은|는|이|가|을|를|의|도|만|부터|까지|처럼|보다|으로|로|에서|에게|께|와|과|이나|나|이라|라|이에요|예요|입니다|입니다만|,|\.|!|\?|\)|\])/u.test(value.trimStart());
}

function endsWithWhitespace(value: string): boolean {
  return /\s$/u.test(value);
}

function plainTextFromTokens(tokens: readonly ParagraphToken[]): string {
  let out = '';
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (tok.kind === 'text') {
      out += tok.value;
      continue;
    }

    if (out && !endsWithWhitespace(out)) out += ' ';
    out += `#${tok.label}`;

    const next = tokens[i + 1];
    if (next?.kind === 'text' && next.value && !startsWithParticle(next.value)) {
      out += ' ';
    }
  }
  return normalizeRenderedText(out.replace(/\s{2,}/g, ' '));
}

function resolveSlot(
  token: FragmentToken,
  slots: Readonly<Record<string, readonly string[]>> | undefined,
  feature: FeatureVector,
  periodLabel: string,
  seedKey: string,
): string {
  const name = token.name ?? '';
  const type = token.type ?? '';
  const seed = fnv1a(`${seedKey}|slot|${name}`);

  // Feature-vector slots resolve from saju context, not variant pools.
  if (type === 'periodLabel') return periodLabel;
  if (type === 'elementName') {
    return feature.dayMasterElement ? (ELEMENT_NAME_KO[feature.dayMasterElement] ?? '') : '';
  }
  if (type === 'elementMetaphor') {
    return feature.dayMasterElement ? (ELEMENT_METAPHOR_KO[feature.dayMasterElement] ?? '') : '';
  }
  if (type === 'ageLabel') return AGE_LABEL_KO[feature.ageBand] ?? '';

  // Variant pool slots come from the fragment's own slots dict.
  const pool = slots?.[name];
  if (Array.isArray(pool) && pool.length > 0) return pickFromPool(pool, seed);
  return '';
}

function mergeAdjacentText(tokens: ParagraphToken[]): ParagraphToken[] {
  const out: ParagraphToken[] = [];
  for (const tok of tokens) {
    const last = out[out.length - 1];
    if (tok.kind === 'text' && last && last.kind === 'text') {
      out[out.length - 1] = { kind: 'text', value: normalizeRenderedText(last.value + tok.value) };
    } else {
      out.push(tok);
    }
  }
  return out;
}

export interface RenderContext {
  readonly seedKey: string;
  readonly periodLabel: string;
  readonly feature: FeatureVector;
}

/** Render a fragment's templateTokens into a TaggedParagraph. */
export function renderFragment(
  fragment: NarrativeFragment,
  ctx: RenderContext,
): TaggedParagraph {
  const out: ParagraphToken[] = [];
  for (const tok of fragment.templateTokens) {
    if (tok.kind === 'text') {
      out.push({ kind: 'text', value: normalizeRenderedText(tok.value ?? '') });
    } else if (tok.kind === 'slot') {
      const resolved = resolveSlot(tok, fragment.slots, ctx.feature, ctx.periodLabel, ctx.seedKey);
      if (resolved) out.push({ kind: 'text', value: normalizeRenderedText(resolved) });
    } else if (tok.kind === 'tag') {
      if (tok.tagId && tok.label) {
        out.push({ kind: 'tag', tagId: tok.tagId, label: tok.label });
      }
    }
  }
  const merged = mergeAdjacentText(out);
  return { tokens: merged, plainText: plainTextFromTokens(merged) };
}
