/**
 * article-renderer.ts -- Render an authored article into TaggedParagraphs
 *
 * The renderer does exactly two things and nothing else:
 *   1. Slot injection — `{{slotName}}` / `{{slotName:josaPair}}` with
 *      batchim-aware particle resolution.
 *   2. Tag tokenisation — `#{tagId}` becomes a {kind:'tag'} token whose
 *      label resolves from the glossary.
 *
 * There is deliberately NO text-rewriting pipeline here. If rendered prose
 * reads wrong, the authored article is wrong — fix it at the source
 * (WYSIWYG principle, see docs/ARTICLE_STYLE_CONTRACT.md).
 */

import type { GlossaryEntry, ParagraphToken, TagId, TaggedParagraph } from '../types.js';
import type { FeatureVector } from './feature-selector.js';

const ELEMENT_NAME_KO: Record<string, string> = {
  WOOD: '나무', FIRE: '불', EARTH: '흙', METAL: '쇠', WATER: '물',
};

const SEASON_NAME_KO: Record<string, string> = {
  spring: '봄', summer: '여름', autumn: '가을', winter: '겨울',
};

/** Plain-language rendering of 신강/신약 for the general tier — the jargon term
 *  itself stays expert-only. Short adjective form so an author writes
 *  "타고난 기운이 {{strengthPlain}} 편이라…" with no josa needed. BALANCED is
 *  the safe fallback (used when the engine could not band the strength). */
const STRENGTH_PLAIN_KO: Record<string, string> = {
  EXTREME_STRONG: '아주 단단한',
  STRONG: '단단한',
  BALANCED: '고른',
  WEAK: '여린',
  EXTREME_WEAK: '아주 여린',
};

/** Count of a given five-element in the chart. Defaults to 0 (never NaN) so a
 *  `{{yongshinCount}}` slot always renders a clean integer. */
function elementCount(feature: FeatureVector, element: string | null): number {
  switch (element) {
    case 'WOOD': return feature.woodCount ?? 0;
    case 'FIRE': return feature.fireCount ?? 0;
    case 'EARTH': return feature.earthCount ?? 0;
    case 'METAL': return feature.metalCount ?? 0;
    case 'WATER': return feature.waterCount ?? 0;
    default: return 0;
  }
}

export interface ArticleSlotValues {
  readonly periodLabel: string;
  readonly dayMasterName: string;
  readonly yongshinName: string;
  readonly currentSeasonName: string;
  /** 신강/신약 in plain adjective form (단단한/여린/고른…). Always valid. */
  readonly strengthPlain: string;
  /** How many of the day-master element are in the chart, as a string. */
  readonly dayMasterCount: string;
  /** How many of the yongshin element are in the chart, as a string. */
  readonly yongshinCount: string;
}

const SLOT_NAMES = [
  'periodLabel', 'dayMasterName', 'yongshinName', 'currentSeasonName',
  'strengthPlain', 'dayMasterCount', 'yongshinCount',
] as const;
export type ArticleSlotName = typeof SLOT_NAMES[number];

export function isArticleSlotName(value: string): value is ArticleSlotName {
  return (SLOT_NAMES as readonly string[]).includes(value);
}

export function buildSlotValues(periodLabel: string, feature: FeatureVector): ArticleSlotValues {
  return {
    periodLabel,
    // Fallbacks keep josa resolution meaningful when the engine could not
    // resolve an element (rare charts) — both fallbacks end in a batchim-
    // bearing syllable so particle choice stays natural.
    dayMasterName: (feature.dayMasterElement && ELEMENT_NAME_KO[feature.dayMasterElement]) || '중심 기운',
    yongshinName: (feature.yongshinElement && ELEMENT_NAME_KO[feature.yongshinElement]) || '보완 기운',
    currentSeasonName: SEASON_NAME_KO[feature.currentSeason] ?? '이 계절',
    strengthPlain: STRENGTH_PLAIN_KO[feature.dayMasterStrength] ?? '고른',
    dayMasterCount: String(elementCount(feature, feature.dayMasterElement)),
    yongshinCount: String(elementCount(feature, feature.yongshinElement)),
  };
}

/** Supported particle pairs: first form when the word ends in a batchim,
 *  second when it does not. `으로로` follows the ㄹ-batchim exception. */
const JOSA_PAIRS: Record<string, readonly [string, string]> = {
  '이가': ['이', '가'],
  '은는': ['은', '는'],
  '을를': ['을', '를'],
  '과와': ['과', '와'],
  '으로로': ['으로', '로'],
  '이라라': ['이라', '라'],
};

export function isJosaPair(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(JOSA_PAIRS, value);
}

function lastHangulCode(value: string): number | null {
  for (let i = value.length - 1; i >= 0; i -= 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xAC00 && code <= 0xD7A3) return code;
  }
  return null;
}

/** Resolve `value + particle` with batchim awareness. */
export function appendJosa(value: string, pair: string): string {
  const forms = JOSA_PAIRS[pair];
  if (!forms) return value;
  const code = lastHangulCode(value);
  if (code === null) return `${value}${forms[1]}`;
  const jong = (code - 0xAC00) % 28;
  if (pair === '으로로') {
    // ㄹ (jongseong index 8) takes 로, like the no-batchim case.
    return `${value}${jong === 0 || jong === 8 ? forms[1] : forms[0]}`;
  }
  return `${value}${jong === 0 ? forms[1] : forms[0]}`;
}

const SLOT_PATTERN = /\{\{([A-Za-z][A-Za-z0-9]*)(?::([가-힣]+))?\}\}/g;

/** Inject slot values (with optional particle) into raw article text. */
export function fillSlots(text: string, slots: ArticleSlotValues): string {
  return text.replace(SLOT_PATTERN, (whole, name: string, josa: string | undefined) => {
    if (!isArticleSlotName(name)) return whole;
    const value = slots[name];
    return josa ? appendJosa(value, josa) : value;
  });
}

const TAG_PATTERN = /#\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** List the tagIds referenced by `#{tagId}` markers, in order, unique. */
export function extractTagIds(texts: readonly string[]): readonly TagId[] {
  const seen = new Set<TagId>();
  const out: TagId[] = [];
  for (const text of texts) {
    for (const match of text.matchAll(TAG_PATTERN)) {
      const tagId = match[1];
      if (seen.has(tagId)) continue;
      seen.add(tagId);
      out.push(tagId);
    }
  }
  return out;
}

/**
 * Render one authored paragraph: slots filled, `#{tagId}` markers turned
 * into tag tokens. Unknown tagIds degrade to plain `#tagId` text (the
 * quality gate rejects them at authoring time; runtime stays lenient).
 */
export function renderArticleParagraph(
  rawText: string,
  slots: ArticleSlotValues,
  glossary: Readonly<Record<TagId, GlossaryEntry>>,
): TaggedParagraph {
  const filled = fillSlots(rawText, slots).trim();
  const tokens: ParagraphToken[] = [];
  let cursor = 0;
  for (const match of filled.matchAll(TAG_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ kind: 'text', value: filled.slice(cursor, index) });
    const tagId = match[1];
    const entry = glossary[tagId];
    if (entry) tokens.push({ kind: 'tag', tagId, label: entry.label });
    else tokens.push({ kind: 'text', value: `#${tagId}` });
    cursor = index + match[0].length;
  }
  if (cursor < filled.length) tokens.push({ kind: 'text', value: filled.slice(cursor) });

  const plainText = tokens
    .map((token) => (token.kind === 'tag' ? `#${token.label}` : token.value))
    .join('');

  return { tokens, plainText };
}

/** Render a list of authored paragraphs, dropping empties defensively. */
export function renderArticleParagraphs(
  rawParagraphs: readonly string[],
  slots: ArticleSlotValues,
  glossary: Readonly<Record<TagId, GlossaryEntry>>,
): readonly TaggedParagraph[] {
  return rawParagraphs
    .map((raw) => renderArticleParagraph(raw, slots, glossary))
    .filter((para) => para.plainText.length > 0);
}

/** Plain-string variant for summary/hook/tips (slots only, no tag tokens). */
export function renderArticleLine(rawText: string, slots: ArticleSlotValues): string {
  return fillSlots(rawText, slots).trim();
}
