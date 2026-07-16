import type { HanjaEntry } from '../../../seed-ts/src/database/hanja-repository.js';
import { buildHangulPseudoEntry } from '../../../seed-ts/src/utils/hangul-name-entry.js';
import type { EvaluationResult } from './evaluator.js';
import koreanPhonetics from '../../config/korean-phonetics.json';
import interpretationConfig from '../../config/interpretation.json';

// ---------------------------------------------------------------------------
// Korean phonetic tables (loaded from config/korean-phonetics.json)
// ---------------------------------------------------------------------------

export const CHOSEONG = koreanPhonetics.choseong as readonly string[];
export const JUNGSEONG = koreanPhonetics.jungseong as readonly string[];

const { base: HANGUL_BLOCK_START, end: HANGUL_BLOCK_END,
        syllablesPerOnset: SYLLABLES_PER_ONSET,
        syllablesPerNucleus: SYLLABLES_PER_NUCLEUS } = koreanPhonetics.hangulUnicode;

// Unicode ranges for Hangul Compatibility Jamo block (U+3131..U+3163)
const JAMO_CONSONANT_START = 0x3131;
const JAMO_CONSONANT_END   = 0x314E;
const JAMO_VOWEL_START     = 0x314F;
const JAMO_VOWEL_END       = 0x3163;

// ---------------------------------------------------------------------------
// Hangul decomposition
// ---------------------------------------------------------------------------

/**
 * Decomposes a single Hangul syllable character into its onset (choseong)
 * and nucleus (jungseong) components.
 *
 * The Hangul Syllables Unicode block (U+AC00..U+D7A3) encodes each syllable
 * as: base + (onset * 588) + (nucleus * 28) + coda.
 * Subtracting the block start yields a zero-based offset we can divide.
 */
export function decomposeHangul(char: string): { onset: string; nucleus: string } | null {
  const charCode = char.charCodeAt(0);
  const offsetFromBlockStart = charCode - HANGUL_BLOCK_START;

  if (offsetFromBlockStart < 0 || charCode > HANGUL_BLOCK_END) return null;

  const onset   = CHOSEONG[Math.floor(offsetFromBlockStart / SYLLABLES_PER_ONSET)]   ?? 'ㅇ';
  const nucleus = JUNGSEONG[Math.floor((offsetFromBlockStart % SYLLABLES_PER_ONSET) / SYLLABLES_PER_NUCLEUS)] ?? 'ㅏ';

  return { onset, nucleus };
}

// ---------------------------------------------------------------------------
// Jamo filter parsing
// ---------------------------------------------------------------------------

export interface JamoFilter { readonly onset?: string; readonly nucleus?: string }

/**
 * Parses a single character into a jamo-level filter.
 *
 * Handles two cases:
 *   1. Compatibility Jamo consonant (U+3131..U+314E) -- returns onset filter
 *   2. Compatibility Jamo vowel (U+314F..U+3163)     -- returns nucleus filter
 *
 * A precomposed Hangul syllable is a literal reading constraint, never a
 * partial jamo filter. Unsupported or empty input fails closed as `null`.
 */
export function parseJamoFilter(char: string): JamoFilter | null {
  const iterator = char[Symbol.iterator]();
  const first = iterator.next();
  if (first.done || !iterator.next().done) return null;
  const character = first.value;

  const charCode = character.charCodeAt(0);

  // Case 1: Hangul Compatibility Jamo -- consonant range
  if (charCode >= JAMO_CONSONANT_START && charCode <= JAMO_CONSONANT_END) {
    return CHOSEONG.includes(character) ? { onset: character } : null;
  }

  // Case 2: Hangul Compatibility Jamo -- vowel range
  if (charCode >= JAMO_VOWEL_START && charCode <= JAMO_VOWEL_END) {
    return { nucleus: character };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Fallback HanjaEntry construction
// ---------------------------------------------------------------------------

export interface FallbackEntryOptions {
  readonly hanja?: string;
  readonly isSurname?: boolean;
}

export function makeFallbackEntry(hangul: string, options: FallbackEntryOptions = {}): HanjaEntry {
  return buildHangulPseudoEntry(hangul, {
    hanja: options.hanja,
    isSurname: options.isSurname ?? false,
  });
}

// ---------------------------------------------------------------------------
// Interpretation labels & builder (loaded from config/interpretation.json)
// ---------------------------------------------------------------------------

export const FRAME_LABELS: Readonly<Record<string, string>> = interpretationConfig.frameLabels;

/**
 * Builds a human-readable interpretation string from an evaluation result.
 *
 * The overall message is chosen by walking the score tiers in
 * `interpretation.json` (highest threshold first). Per-category warnings
 * are appended for any non-TOTAL category that both failed and scored
 * below the configured warning threshold.
 */
export function buildInterpretation(evaluationResult: EvaluationResult): string {
  const { score, isPassed, categories } = evaluationResult;

  // -- Determine the overall message by matching score against tier thresholds --
  const tiers = isPassed
    ? interpretationConfig.overallMessages
    : interpretationConfig.failedMessages;

  const sortedTiers = Object.values(tiers).sort((a, b) => b.minScore - a.minScore);
  const overall = sortedTiers.find(tier => score >= tier.minScore)?.message
    ?? sortedTiers[sortedTiers.length - 1].message;

  // -- Collect warnings for weak categories --
  const { warningThreshold, warningTemplate } = interpretationConfig;

  const warnings = categories
    .filter((category) => category.frame !== 'TOTAL' && !category.isPassed && category.score < warningThreshold)
    .map((category) => warningTemplate.replace('{label}', FRAME_LABELS[category.frame] ?? category.frame));

  return [overall, ...warnings].join(' ');
}

