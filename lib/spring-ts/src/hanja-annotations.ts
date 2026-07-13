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
 *   The full 인명용 한자 list (대법원 가족관계의 등록 등에 관한 규칙
 *   별표 1·2; 2024-06 기준 9,389 자) is BROADER but unfiltered for
 *   naming aesthetics. It must therefore be opt-in via
 *   `precisionConfig.hanjaPool='inmyeongyong_full'`, never the default.
 *
 *   Full-pool mode is backed by the local 9,495-entry mirror plus the
 *   reconciliation ledger. The official 9,389 denominator is tracked
 *   separately so callers can keep the default curated path conservative.
 */

import type { HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
import inmyeongyongData from '../data/inmyeongyong_9389.json';
import inmyeongyongFullData from '../data/inmyeongyong_9389_full.json';
import byeolpyo2Data from '../data/byeolpyo2_variants.json';

export type HanjaLegalStatus =
  | 'allowed'
  | 'variantAllowed'
  | 'hangulOnly'
  | 'unknown'
  | 'notAllowed';

/** PR11 annotations layered over the seed-ts HanjaEntry. */
export interface HanjaLegalAnnotation {
  /** Whether the hanja is on Korea's 인명용 한자 list (대법원 별표 1·2).
   *  - true:      registrable
   *  - false:     not registrable
   *  - undefined: status unknown (current default until data imported)
   */
  readonly legalRegistrable?: boolean;
  /** Public reconciliation bucket for UI/candidate surfaces.
   *  - allowed: orthodox hanja appears in the active legal pool
   *  - variantAllowed: input is a known variant whose orthodox form is legal
   *  - hangulOnly: no hanja glyph is present
   *  - unknown: active pool is intentionally non-definitive
   *  - notAllowed: local full-pool miss
   */
  readonly legalStatus: HanjaLegalStatus;
  /** When this hanja is a 異體字, the canonical 정자 form. Otherwise undefined.
   *  Lookup is symmetric — both 정자 and 약자 entries can reference each
   *  other via this field. */
  readonly isVariantOf?: string;
}

/** Variant → 정자 lookup table. Sourced from `data/byeolpyo2_variants.json`
 *  which mirrors 대법원 가족관계의 등록 등에 관한 규칙 별표 2 (이체자
 *  매핑). PR-I-5 replaces PR11's 20-row seed (which contained Japanese
 *  shinjitai mixed in with Korean variants) with a Korean-administrative-
 *  rule-aligned seed of ~50 rows; the full ~280-row import lands in a
 *  follow-up data PR. */
const VARIANT_TO_ORTHODOX: Readonly<Record<string, string>> =
  (byeolpyo2Data as { variantToOrthodox: Record<string, string> }).variantToOrthodox;

/** Returns the orthodox (정자) form of a hanja, or the input itself when
 *  the hanja is already orthodox / has no known variant. */
export function normalizeToOrthodoxHanja(hanja: string): string {
  return VARIANT_TO_ORTHODOX[hanja] ?? hanja;
}

/** Set of registrable hanja from the 50-char curated seed (PR-I-1).
 *  This is the conservative default; non-seed hanja return `undefined`
 *  status so callers' "accept unknown" default keeps the curated pool's
 *  behavior unchanged. */
const REGISTRABLE_HANJA: ReadonlySet<string> = new Set(
  (inmyeongyongData as { registrable: string[] }).registrable ?? [],
);

/** Set of locally recognized hanja glyphs from the full 9,495-entry mirror (PR-P-6).
 *  Sourced from delvier/KoreaSCourtCode webhanja.db — Korean Supreme
 *  Court mirror, 2024-07-16 refresh, post 2024-06-11 expansion.
 *  The +106 mirror delta remains non-authority until reconciled against
 *  the official 9,389-character denominator.
 *  Activated by `precisionConfig.hanjaPool: 'inmyeongyong_full'`. */
interface FullEntry {
  readonly hanja: string;
  readonly codepoint: string;
  readonly readings: readonly string[];
  readonly meaning: string | null;
  readonly radicalId: number | null;
  readonly strokeCount: number | null;
}
const FULL_REGISTRABLE_HANJA: ReadonlySet<string> = new Set(
  ((inmyeongyongFullData as { entries: readonly FullEntry[] }).entries ?? []).map((e) => e.hanja),
);

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
    || FULL_REGISTRABLE_HANJA.has(normalizeToOrthodoxHanja(glyph));
}

function isBlankHanja(hanja: string): boolean {
  return hanja.trim().length === 0;
}

/** Returns the legal-registrability annotation for a HanjaEntry.
 *
 *  When the hanja appears in the active pool's 인명용 list, returns
 *  `legalRegistrable: true`. When the hanja is outside the pool, returns
 *  `undefined` (status unknown) — `isHanjaUsableForLegalName`'s default
 *  "accept unknown" then lets the curated pool flow through unchanged.
 *
 *  - `pool='curated'` (default): 50-char seed; gives `undefined` for
 *    most input — matches existing baseline-snapshot fixtures.
 *  - `pool='inmyeongyong_full'`: local full 9,495 mirror — set
 *    `legalRegistrable: false` only when explicitly absent from the local
 *    full list, enabling stricter downstream filtering.
 *
 *  The 異體字 isVariantOf field is populated separately by PR-I-5
 *  (별표 2 variants). */
export function getLegalAnnotation(
  entry: HanjaEntry,
  options?: { readonly pool?: HanjaPool },
): HanjaLegalAnnotation {
  const hanja = entry?.hanja;
  if (typeof hanja !== 'string' || isBlankHanja(hanja)) {
    return { legalRegistrable: undefined, legalStatus: 'hangulOnly', isVariantOf: undefined };
  }
  // Normalize to 정자 first — variant inputs share registrability with
  // their orthodox form per 별표 2's pairing convention.
  const orthodox = normalizeToOrthodoxHanja(hanja);
  const isVariant = orthodox !== hanja;
  const pool = options?.pool ?? 'curated';
  const appearsInLocalFullPool = FULL_REGISTRABLE_HANJA.has(orthodox);
  if (!isRecognizedHanjaGlyph(hanja) && !appearsInLocalFullPool) {
    return pool === 'inmyeongyong_full'
      ? { legalRegistrable: false, legalStatus: 'notAllowed', isVariantOf: isVariant ? orthodox : undefined }
      : { legalRegistrable: undefined, legalStatus: 'hangulOnly', isVariantOf: undefined };
  }
  let legalRegistrable: boolean | undefined;
  let legalStatus: HanjaLegalStatus;
  if (pool === 'inmyeongyong_full') {
    // Full pool: local mirror yes/no, never unknown — every non-list hanja
    // is explicitly rejected by this opt-in filter.
    legalRegistrable = appearsInLocalFullPool;
    legalStatus = legalRegistrable
      ? isVariant ? 'variantAllowed' : 'allowed'
      : 'notAllowed';
  } else {
    // Curated seed: only positive matches get true; everything else is
    // 'unknown' so the conservative default preserves existing behavior.
    legalRegistrable = REGISTRABLE_HANJA.has(orthodox) ? true : undefined;
    legalStatus = legalRegistrable
      ? isVariant ? 'variantAllowed' : 'allowed'
      : 'unknown';
  }
  return {
    legalRegistrable,
    legalStatus,
    isVariantOf: isVariant ? orthodox : undefined,
  };
}

/** Filter helper for candidate generation. Returns true when the hanja
 *  is registrable (or its status is unknown — conservative default).
 *  Callers can opt into stricter filtering via
 *  `requireLegalRegistrable: true`, and choose the active pool via
 *  `pool: 'inmyeongyong_full'`. */
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
