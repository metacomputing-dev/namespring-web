/**
 * hanja-annotations.ts
 *
 * spring-ts-side annotations for hanja that are not (yet) carried in the
 * seed-ts HanjaEntry. PR11 introduces these so a UI / candidate filter
 * can answer "is this hanja legally registrable for a Korean given name?"
 * without modifying seed-ts's DB schema.
 *
 * IMPORTANT — POOL POLICY (per maintainer note 2026-04-30):
 *
 *   The default hanja pool is the existing seed-ts DB (~5,000 entries).
 *   That set was *intentionally curated* for naming quality — every
 *   character was hand-picked for naming-suitability, so a hanja being
 *   in the DB is itself a positive quality signal.
 *
 *   The full 인명용 한자 list is BROADER but unfiltered for naming
 *   aesthetics. The Supreme Court announced a 9,389-character denominator
 *   in 2024, while its current official lookup exposes 9,495 registrable
 *   Unicode/PUA glyph representations. It must therefore be opt-in via
 *   `precisionConfig.hanjaPool='inmyeongyong_full'`, never the default.
 *
 *   Full-pool mode is backed by a local 9,495-entry snapshot whose glyphs and
 *   10,381 non-empty designated-reading pairs are pinned to the official
 *   court lookup by an offline release check.
 */

import type { HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
import byeolpyo2Data from '../data/byeolpyo2_variants.json';
import {
  isLocalFullPoolHanjaGlyph,
  isOfficialFullPoolHanjaReading,
} from './full-hanja-glyph-registry.js';

export type HanjaLegalStatus =
  | 'allowed'
  | 'variantAllowed'
  | 'hangulOnly'
  | 'unknown'
  | 'notAllowed';

/** PR11 annotations layered over the seed-ts HanjaEntry. */
export interface HanjaLegalAnnotation {
  /** Whether the input glyph is returned by Korea's official 인명용 한자 lookup.
   *  - true:      registrable
   *  - false:     not registrable
   *  - undefined: no Hanja glyph is present or authority is unavailable
   */
  readonly legalRegistrable?: boolean;
  /** Public reconciliation bucket for UI/candidate surfaces.
   *  - allowed: the input glyph itself appears in the active legal pool
   *  - variantAllowed: reserved for a separately verified official variant map
   *  - hangulOnly: no hanja glyph is present
   *  - unknown: reserved for a future explicitly unavailable authority state
   *  - notAllowed: official full-pool lookup miss
   */
  readonly legalStatus: HanjaLegalStatus;
  /** When a separately authority-verified legal variant map identifies this
   *  glyph, the canonical 정자 form. Search aliases alone never populate it. */
  readonly isVariantOf?: string;
}

/** Search/deduplication aliases only.
 *
 * The legacy asset mixes official-lookup glyphs with 32 Japanese shinjitai
 * inputs that are absent from the official legal lookup. It is therefore not
 * authority evidence and must never participate in legal eligibility. */
const INPUT_ALIAS_TO_ORTHODOX: Readonly<Record<string, string>> =
  (byeolpyo2Data as { variantToOrthodox: Record<string, string> }).variantToOrthodox;

/** Returns a search/deduplication key for a known input alias.
 *
 * This compatibility helper does not establish legal registrability. Legal
 * checks always test the raw input glyph against the active authority set. */
export function normalizeToOrthodoxHanja(hanja: string): string {
  return INPUT_ALIAS_TO_ORTHODOX[hanja] ?? hanja;
}

/** Set of locally recognized hanja glyphs from the full 9,495-entry snapshot.
 *  Its complete glyph and designated-reading parity with the official court
 *  lookup is pinned by `official-hanja-lookup-authority.generated.json`.
 *  Activated by `precisionConfig.hanjaPool: 'inmyeongyong_full'`. */
export type HanjaPool = 'curated' | 'inmyeongyong_full';

/**
 * True for exactly one ordinary Han code point or one locally recognized
 * legal full-pool glyph. The latter includes court-mirror PUA code points;
 * arbitrary PUA values remain rejected.
 */
export function isRecognizedHanjaGlyph(hanja: string): boolean {
  const iterator = hanja[Symbol.iterator]();
  const first = iterator.next();
  if (first.done || !iterator.next().done) return false;
  const glyph = first.value;
  return /^\p{Script=Han}$/u.test(glyph)
    || isLocalFullPoolHanjaGlyph(glyph);
}

function isBlankHanja(hanja: string): boolean {
  return hanja.trim().length === 0;
}

/** Returns the legal-registrability annotation for a HanjaEntry.
 *
 * Candidate-pool selection and legal authority are deliberately independent:
 * both `curated` and `inmyeongyong_full` require the exact raw glyph and Hangul
 * reading pair from the pinned official lookup. The pool option remains in the
 * public signature for compatibility and controls candidate generation in its
 * callers, not the authority result here.
 *
 *  Input alias normalization is deliberately excluded from this decision.
 *  A Japanese shinjitai or other convenience alias is not legally accepted
 *  merely because its normalized target is present. */
export function getLegalAnnotation(
  entry: HanjaEntry,
  _options?: { readonly pool?: HanjaPool },
): HanjaLegalAnnotation {
  const hanja = entry?.hanja;
  if (typeof hanja !== 'string' || isBlankHanja(hanja)) {
    return { legalRegistrable: undefined, legalStatus: 'hangulOnly', isVariantOf: undefined };
  }
  const isOfficialGlyphReadingPair = isOfficialFullPoolHanjaReading(hanja, entry.hangul);
  if (isOfficialGlyphReadingPair) {
    return { legalRegistrable: true, legalStatus: 'allowed', isVariantOf: undefined };
  }
  if (!isRecognizedHanjaGlyph(hanja)) {
    return { legalRegistrable: undefined, legalStatus: 'hangulOnly', isVariantOf: undefined };
  }
  // Candidate-pool breadth and legal authority are separate concerns. Both
  // curated and full modes reject the same unsupported raw glyph-reading pair.
  return { legalRegistrable: false, legalStatus: 'notAllowed', isVariantOf: undefined };
}

/** Filter helper for candidate generation. Hanja entries pass only when the
 *  official raw glyph-reading authority does not explicitly reject them.
 *  Hangul-only entries retain their separate fallback path. */
export function isHanjaUsableForLegalName(
  entry: HanjaEntry,
  options?: { readonly requireLegalRegistrable?: boolean; readonly pool?: HanjaPool },
): boolean {
  const annotation = getLegalAnnotation(entry, { pool: options?.pool });
  if (options?.requireLegalRegistrable === true) {
    return annotation.legalRegistrable === true;
  }
  // Default: reject only when explicitly known to be unregistrable.
  return annotation.legalRegistrable !== false;
}
