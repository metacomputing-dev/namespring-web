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
 *   Until the 9,389-character list is imported (separate data PR),
 *   `getLegalAnnotation` reports `legalRegistrable: undefined` for every
 *   entry. Callers default to "accept unknown" so the existing curated
 *   pool keeps flowing through unchanged.
 */

import type { HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
import inmyeongyongData from '../data/inmyeongyong_9389.json';
import byeolpyo2Data from '../data/byeolpyo2_variants.json';

/** PR11 annotations layered over the seed-ts HanjaEntry. */
export interface HanjaLegalAnnotation {
  /** Whether the hanja is on Korea's 인명용 한자 list (대법원 별표 1·2).
   *  - true:      registrable
   *  - false:     not registrable
   *  - undefined: status unknown (current default until data imported)
   */
  readonly legalRegistrable?: boolean;
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

/** Set of registrable hanja loaded from the official 인명용 list. PR-I-1
 *  bootstraps this with a 50-char seed; the full 9,389 import lands in a
 *  later data PR (data/inmyeongyong_9389.json `registrable` array). */
const REGISTRABLE_HANJA: ReadonlySet<string> = new Set(
  (inmyeongyongData as { registrable: string[] }).registrable ?? [],
);

/** Returns the legal-registrability annotation for a HanjaEntry.
 *
 *  When the hanja appears in the imported 인명용 list (대법원 별표 1),
 *  `legalRegistrable: true`. When the dataset is incomplete (still in
 *  seed phase), characters outside the seed return `undefined` — i.e.
 *  status unknown — so `isHanjaUsableForLegalName`'s conservative default
 *  ("accept unknown") preserves the curated pool's behavior. The 異體字
 *  isVariantOf field is populated separately by PR-I-5 (별표 2 import). */
export function getLegalAnnotation(entry: HanjaEntry): HanjaLegalAnnotation {
  const hanja = entry?.hanja;
  if (typeof hanja !== 'string' || hanja.length === 0) {
    return { legalRegistrable: undefined, isVariantOf: undefined };
  }
  // Normalize to 정자 first — variant inputs share registrability with
  // their orthodox form per 별표 2's pairing convention.
  const orthodox = normalizeToOrthodoxHanja(hanja);
  const isOnList = REGISTRABLE_HANJA.has(orthodox);
  return {
    legalRegistrable: isOnList ? true : undefined,
    isVariantOf: orthodox !== hanja ? orthodox : undefined,
  };
}

/** Filter helper for candidate generation. Returns true when the hanja
 *  is registrable (or its status is unknown — conservative default).
 *  Callers can opt into stricter filtering via
 *  precisionConfig.requireLegalRegistrable. */
export function isHanjaUsableForLegalName(
  entry: HanjaEntry,
  options?: { readonly requireLegalRegistrable?: boolean },
): boolean {
  const annotation = getLegalAnnotation(entry);
  if (options?.requireLegalRegistrable === true) {
    return annotation.legalRegistrable === true;
  }
  // Default: reject only when explicitly known to be unregistrable.
  return annotation.legalRegistrable !== false;
}
