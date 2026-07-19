import { assessNatalEvidenceV1, type NatalEvidenceAssessmentV1 } from './natal-evidence.js';
import type { SajuSummary } from './types.js';

const CANONICAL_ELEMENTS = new Set(['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER']);

export type CandidateNatalGuidancePosture = 'unavailable' | 'conservative' | 'ready';
export type CandidateElementPreferenceStrength = 'none' | 'soft' | 'strong';

export interface CandidateElementBalanceSignalsV1 {
  /**
   * Raw natal distribution signals are diagnostic inputs, not aliases for
   * yongshin/忌神 roles. They remain available to the score calculator but
   * never become generation preferences or exclusions by themselves.
   */
  readonly deficientElements: readonly string[];
  readonly excessiveElements: readonly string[];
}

/**
 * Candidate generation deliberately separates preferences from harmful-role
 * diagnostics. A chart may still be scored by the compatibility calculator,
 * but it must not lose candidates before scoring solely because one resource
 * element was classified as harmful.
 */
export interface CandidateElementGuidanceV1 {
  readonly posture: CandidateNatalGuidancePosture;
  readonly natalEvidence: NatalEvidenceAssessmentV1;
  readonly preferenceStrength: CandidateElementPreferenceStrength;
  readonly preferredElements: readonly string[];
  /**
   * Interpreted harmful-role evidence for scoring/explanation only. Candidate
   * generation does not hard-filter a character solely by resource element.
   */
  readonly excludedElements: readonly string[];
  readonly conflictedElements: readonly string[];
  readonly balanceSignals: CandidateElementBalanceSignalsV1;
}

function canonicalElement(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return CANONICAL_ELEMENTS.has(normalized) ? normalized : null;
}

function collectCanonicalElements(...values: readonly unknown[]): Set<string> {
  const result = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const element = canonicalElement(value);
    if (element) result.add(element);
  };
  values.forEach(visit);
  return result;
}

function ordered(elements: ReadonlySet<string>): string[] {
  return [...elements].sort((left, right) => left.localeCompare(right));
}

/**
 * Stable pool ordering for a role-based element preference.
 *
 * A conservative preference alternates preferred and neutral entries so an
 * uncertain yongshin conclusion cannot monopolize a bounded generation pool.
 * A ready preference keeps the established preferred-first behavior.
 */
export function orderCandidatePoolByElementPreference<T>(
  entries: readonly T[],
  preferredElements: ReadonlySet<string>,
  preferenceStrength: CandidateElementPreferenceStrength,
  getElement: (entry: T) => string | null | undefined,
): T[] {
  if (preferenceStrength === 'none' || preferredElements.size === 0) {
    return [...entries];
  }

  const preferred: T[] = [];
  const neutral: T[] = [];
  for (const entry of entries) {
    const element = canonicalElement(getElement(entry));
    (element && preferredElements.has(element) ? preferred : neutral).push(entry);
  }
  if (preferenceStrength === 'strong' || preferred.length === 0 || neutral.length === 0) {
    return [...preferred, ...neutral];
  }

  const orderedEntries: T[] = [];
  const maxLength = Math.max(preferred.length, neutral.length);
  for (let index = 0; index < maxLength; index += 1) {
    if (index < preferred.length) orderedEntries.push(preferred[index]!);
    if (index < neutral.length) orderedEntries.push(neutral[index]!);
  }
  return orderedEntries;
}

export function buildCandidateElementGuidanceV1(
  saju: SajuSummary | null | undefined,
): CandidateElementGuidanceV1 {
  const natalEvidence = assessNatalEvidenceV1(saju);
  if (!saju || natalEvidence.status === 'unavailable') {
    return {
      posture: 'unavailable',
      natalEvidence,
      preferenceStrength: 'none',
      preferredElements: [],
      excludedElements: [],
      conflictedElements: [],
      balanceSignals: {
        deficientElements: [],
        excessiveElements: [],
      },
    };
  }

  // Only interpreted yongshin roles control generation. A mechanically absent
  // or abundant element can still be favourable, neutral, or harmful depending
  // on the chart; treating raw distribution as a role is a category error.
  const preferred = collectCanonicalElements(
    saju.yongshin?.element,
    saju.yongshin?.heeshin,
  );
  const excluded = collectCanonicalElements(
    saju.yongshin?.gishin,
    saju.yongshin?.gushin,
  );
  const conflicted = new Set([...preferred].filter((element) => excluded.has(element)));
  const balanceSignals = {
    deficientElements: ordered(collectCanonicalElements(saju.deficientElements)),
    excessiveElements: ordered(collectCanonicalElements(saju.excessiveElements)),
  };

  for (const element of conflicted) {
    preferred.delete(element);
    excluded.delete(element);
  }

  // Limited evidence may guide exploration, but it cannot remove candidates.
  // Pool ordering is explicitly soft and diversified by
  // orderCandidatePoolByElementPreference().
  if (natalEvidence.status !== 'ready') {
    const suspendPreference = natalEvidence.reasonCodes.includes('SAJU_ANALYSIS_LIMITED')
      || natalEvidence.reasonCodes.includes('YONGSHIN_JONGGYEOK_RISK');
    return {
      posture: 'conservative',
      natalEvidence,
      preferenceStrength: !suspendPreference && preferred.size > 0 ? 'soft' : 'none',
      preferredElements: suspendPreference ? [] : ordered(preferred),
      excludedElements: [],
      conflictedElements: ordered(conflicted),
      balanceSignals,
    };
  }

  // Even in a ready chart, contradictory roles are not silently resolved by
  // whichever Set happens to be applied first. Keep them neutral and surface
  // the conflict to callers that need an explanation.
  return {
    posture: 'ready',
    natalEvidence,
    preferenceStrength: preferred.size > 0 ? 'strong' : 'none',
    preferredElements: ordered(preferred),
    excludedElements: ordered(excluded),
    conflictedElements: ordered(conflicted),
    balanceSignals,
  };
}
