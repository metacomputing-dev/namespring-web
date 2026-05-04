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

function normalizeRenderedText(value: string): string {
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
  return out.replace(/([.!?])(?=[가-힣])/g, '$1 ');
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
  const plain = merged
    .map((t) => (t.kind === 'text' ? t.value : `#${t.label}`))
    .join('');
  return { tokens: merged, plainText: normalizeRenderedText(plain) };
}
