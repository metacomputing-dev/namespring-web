import {
  AUTHORITY_SCOPES,
  authorityTruthForScope,
} from './authority-context.mjs';
import { isAllowedField } from './shared.mjs';

function inferSurfacedCardsFromSnapshot(snapshotResult) {
  const out = snapshotResult.output || {};
  const tokens = new Set();
  if (out.sajuReport?.gyeokgukType) tokens.add('gyeokguk');
  if (out.sajuReport?.yongshinElement) tokens.add('yongshin');
  if (out.fortuneReport?.personalityTraitCount > 0) tokens.add('sipsin');
  if (out.sajuReport?.sajuEnabled) {
    tokens.add('shinsal');
    tokens.add('johu');
  }
  return tokens;
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
  const surfaced = inferSurfacedCardsFromSnapshot(snapshotResult);
  const missing = expected.filter((card) => !surfaced.has(card));
  const allowedMissing = missing.filter((card) =>
    isAllowedField(allowed, `cards.surfacedCardTypes.${card}`)
  );
  const realMissing = missing.filter((card) => !allowedMissing.includes(card));

  return {
    dimension: 'D3',
    status: realMissing.length === 0 ? 'PASS' : 'FAIL',
    cardTruthSource,
    expected,
    surfaced: [...surfaced],
    missing: realMissing,
    allowedMissing,
  };
}
