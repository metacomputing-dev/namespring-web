import {
  AUTHORITY_SCOPES,
  authorityTruthForScope,
} from './authority-context.mjs';
import { isAllowedField } from './shared.mjs';

function surfacedCardsFromSnapshot(snapshotResult) {
  const raw = snapshotResult?.qualityEvidence?.surfacedCardTypes;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((value) => typeof value === 'string' && value.length > 0));
}

export function evaluateD3(fixture, snapshotResult, authorityCase, oracleCase, options = {}) {
  const authorityTruth = authorityTruthForScope(
    authorityCase,
    AUTHORITY_SCOPES.PRODUCT_SURFACE_CONTRACT,
    options,
  ) ? authorityCase : null;
  const oracleTruth = authorityTruthForScope(
    oracleCase,
    AUTHORITY_SCOPES.PRODUCT_SURFACE_CONTRACT,
    options,
  ) ? oracleCase : null;
  const authorityCards = Array.isArray(authorityTruth?.cards?.surfacedCardTypes) &&
    authorityTruth.cards.surfacedCardTypes.length > 0
    ? authorityTruth.cards.surfacedCardTypes
    : null;
  const oracleCards = Array.isArray(oracleTruth?.cards?.surfacedCardTypes) &&
    oracleTruth.cards.surfacedCardTypes.length > 0
    ? oracleTruth.cards.surfacedCardTypes
    : null;
  const expected = authorityCards ?? oracleCards;
  const cardTruthSource = authorityCards ? 'authority' : oracleCards ? 'oracle' : null;
  if (!expected) {
    return {
      dimension: 'D3',
      status: 'N/A',
      reason: 'authority-truth-eligible card-surface reference unavailable',
    };
  }

  const allowed = fixture.allowedDiff || [];
  const surfaced = surfacedCardsFromSnapshot(snapshotResult);
  const missing = expected.filter((card) => !surfaced.has(card));
  const declaredMissing = missing.filter((card) =>
    isAllowedField(allowed, `cards.surfacedCardTypes.${card}`)
  );

  return {
    dimension: 'D3',
    status: missing.length === 0 ? 'PASS' : 'FAIL',
    cardTruthSource,
    expected,
    surfaced: [...surfaced],
    missing,
    declaredMissing,
  };
}
