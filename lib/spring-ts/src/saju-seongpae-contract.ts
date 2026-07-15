import type { GyeokgukSeongpaeSummary } from './types.js';

const VERDICTS = new Set<GyeokgukSeongpaeSummary['verdict']>([
  'SEONGGYEOK',
  'PAGYEOK',
  'PAJUNG_YUGU',
  'SEONGJUNG_YUPA',
  'UNDETERMINED',
]);

const USAGES = new Set<GyeokgukSeongpaeSummary['usage']>(['SUNYONG', 'YEOKYONG']);

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Runtime boundary for saju-ts seongpae evidence.
 *
 * The legacy engine object is deliberately not spread into Spring output:
 * only the documented contract crosses the package boundary.
 */
export function extractGyeokgukSeongpae(value: unknown): GyeokgukSeongpaeSummary | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!VERDICTS.has(raw.verdict as GyeokgukSeongpaeSummary['verdict'])) return null;
  if (!USAGES.has(raw.usage as GyeokgukSeongpaeSummary['usage'])) return null;

  const verdictBeforeMonthBroken = VERDICTS.has(
    raw.verdictBeforeMonthBroken as GyeokgukSeongpaeSummary['verdict'],
  )
    ? raw.verdictBeforeMonthBroken as GyeokgukSeongpaeSummary['verdict']
    : undefined;

  return {
    verdict: raw.verdict as GyeokgukSeongpaeSummary['verdict'],
    ...(verdictBeforeMonthBroken ? { verdictBeforeMonthBroken } : {}),
    usage: raw.usage as GyeokgukSeongpaeSummary['usage'],
    sangshin: nullableString(raw.sangshin),
    sangshinStemHanja: nullableString(raw.sangshinStemHanja),
    pagyeokFactor: nullableString(raw.pagyeokFactor),
    gueung: nullableString(raw.gueung),
    reasons: Array.isArray(raw.reasons)
      ? raw.reasons.filter((reason): reason is string => typeof reason === 'string')
      : [],
  };
}
