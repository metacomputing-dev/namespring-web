import {
  AUTHORITY_SCOPES,
  authorityTruthForScope,
} from './authority-context.mjs';
import { fullNarrativeCorpus } from './shared.mjs';

const D4_FORBIDDEN_ABSOLUTE_PATTERNS = [
  { label: '반드시 (unconditional certainty)', regex: /반드시/u },
  { label: '틀림없- (no-doubt assertion)', regex: /틀림없/u },
  { label: '100% (numeric certainty)', regex: /(?<!신뢰도\s{0,3})100\s*(?:%|퍼센트)/u },
  { label: '확실히 …다 단정', regex: /확실히[^"”]{0,12}(?:됩니다|된다)/u },
];

const D4_STRENGTH_HEDGE_MARKER = /경향/u;
const D4_HOUR_UNCERTAINTY_PILLAR = '시주(임시)';
const D4_HOUR_UNCERTAINTY_CLAIM = /출생 시각[^"]{0,40}(?:임시|참고용)/u;

export function evaluateD4(fixture, snapshotResult, authorityCase, narrativeLookup, options = {}) {
  const authorityTruth = authorityTruthForScope(
    authorityCase,
    AUTHORITY_SCOPES.SAFETY_COPY_POLICY,
    options,
  ) ? authorityCase : null;
  if (!authorityTruth) {
    return {
      dimension: 'D4',
      status: 'N/A',
      reason: 'no authority-truth-eligible hedge-policy reference for this fixture',
    };
  }
  if (!narrativeLookup?.entry) {
    return {
      dimension: 'D4',
      status: 'N/A',
      reason: narrativeLookup?.reason ?? 'narrative golden unavailable — run `npm run narrative:capture`',
    };
  }

  const cards = narrativeLookup.entry.cards;
  const overview = cards?.overviewSummary ?? {};
  const corpus = fullNarrativeCorpus(cards);
  const checks = [];

  for (const { label, regex } of D4_FORBIDDEN_ABSOLUTE_PATTERNS) {
    const match = corpus.match(regex);
    checks.push({
      field: 'narrative.noAbsoluteAssertions',
      pattern: label,
      pass: match === null,
      ...(match ? { matched: match[0] } : {}),
    });
  }

  const hedgePolicy = authorityTruth.hedgePolicy ?? {};
  if (hedgePolicy.requireHedgedStrength === true) {
    const strengthText = String(overview.strengthDescription ?? '');
    checks.push({
      field: 'narrative.hedgedStrength',
      marker: '경향',
      strengthText,
      pass: D4_STRENGTH_HEDGE_MARKER.test(strengthText),
    });
  }

  if (hedgePolicy.requireHourUncertaintyNote === true) {
    const pillars = Array.isArray(overview.pillars) ? overview.pillars : [];
    const hasProvisionalPillar = pillars.some(
      (pillar) => String(pillar?.position ?? '').includes(D4_HOUR_UNCERTAINTY_PILLAR),
    );
    const hasUncertaintyClaim = (overview.evidence ?? []).some((row) =>
      row?.axis === 'inputTime' && D4_HOUR_UNCERTAINTY_CLAIM.test(String(row?.claim ?? '')));
    checks.push({
      field: 'narrative.hourUncertaintyNote',
      pass: hasProvisionalPillar || hasUncertaintyClaim,
      hasProvisionalPillar,
      hasUncertaintyClaim,
    });
  }

  const failed = checks.filter((check) => !check.pass);
  return {
    dimension: 'D4',
    status: failed.length === 0 ? 'PASS' : 'FAIL',
    checks,
    failedCount: failed.length,
    totalChecks: checks.length,
  };
}
