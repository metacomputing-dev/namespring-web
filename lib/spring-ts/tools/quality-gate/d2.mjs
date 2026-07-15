import {
  AUTHORITY_SCOPES,
  authorityTruthForScope,
} from './authority-context.mjs';
import {
  GYEOKGUK_EQUIV,
  NARRATIVE_ELEMENT_TOKENS,
  extractStrengthBands,
  fullNarrativeCorpus,
  narrativeEvidenceCorpus,
  normalizeElementCode,
  strengthBand,
} from './shared.mjs';

export function evaluateD2(fixture, snapshotResult, authorityCase, narrativeLookup, options = {}) {
  const doctrineTruth = authorityTruthForScope(
    authorityCase,
    AUTHORITY_SCOPES.SAJU_DOCTRINE,
    options,
  ) ? authorityCase : null;
  const semanticTruth = authorityTruthForScope(
    authorityCase,
    AUTHORITY_SCOPES.NARRATIVE_SEMANTIC_CONTRACT,
    options,
  ) ? authorityCase : null;
  if (!doctrineTruth && !semanticTruth) {
    return {
      dimension: 'D2',
      status: 'N/A',
      reason: 'no authority-truth-eligible narrative reference for this fixture',
    };
  }
  if (!narrativeLookup?.entry) {
    return {
      dimension: 'D2',
      status: 'N/A',
      reason: narrativeLookup?.reason ?? 'narrative golden unavailable — run `npm run narrative:capture`',
    };
  }

  const cards = narrativeLookup.entry.cards;
  const overview = cards?.overviewSummary ?? {};
  const expected = doctrineTruth?.expected ?? {};
  const checks = [];

  if (expected.strengthLevel != null) {
    const expectedBand = strengthBand(expected.strengthLevel);
    const strengthText = `${overview.strengthDescription ?? ''}\n${overview.overallSummary ?? ''}`;
    const bands = extractStrengthBands(strengthText);
    const contradiction = [...bands].filter((band) => band !== expectedBand);
    const pass = Boolean(expectedBand) && bands.has(expectedBand) && contradiction.length === 0;
    checks.push({
      field: 'narrative.strength',
      expected: expected.strengthLevel,
      expectedBand,
      narrativeBands: [...bands],
      pass,
      ...(expectedBand ? {} : { reason: `unknown strength label in authority expected: ${expected.strengthLevel}` }),
    });
  }

  if (expected.yongshinElement != null) {
    const code = normalizeElementCode(expected.yongshinElement);
    const tokens = code ? NARRATIVE_ELEMENT_TOKENS[code] : [];
    const yongshinText = String(overview.yongshinDescription ?? '');
    const pass = tokens.length > 0 && tokens.some((token) => yongshinText.includes(token));
    checks.push({
      field: 'narrative.yongshin',
      expected: expected.yongshinElement,
      tokens,
      pass,
      ...(code ? {} : { reason: `unknown element in authority expected: ${expected.yongshinElement}` }),
    });
  }

  if (expected.gyeokguk != null) {
    const equivalents = GYEOKGUK_EQUIV[expected.gyeokguk]
      ? [...GYEOKGUK_EQUIV[expected.gyeokguk]]
      : [expected.gyeokguk];
    const corpus = `${overview.expertText ?? ''}\n${narrativeEvidenceCorpus(overview)}`;
    const matched = equivalents.filter((name) => corpus.includes(name));
    checks.push({
      field: 'narrative.gyeokguk',
      expected: expected.gyeokguk,
      equivalents,
      matched,
      pass: matched.length > 0,
    });
  }

  const claims = Array.isArray(semanticTruth?.narrativeClaims) ? semanticTruth.narrativeClaims : [];
  if (claims.length > 0) {
    const corpus = fullNarrativeCorpus(cards);
    claims.forEach((claim, index) => {
      const field = `narrative.claims[${index}]`;
      try {
        if (claim?.type === 'mustIncludeAny' && Array.isArray(claim.patterns) && claim.patterns.length > 0) {
          const pass = claim.patterns.some((pattern) => new RegExp(pattern, 'u').test(corpus));
          checks.push({ field, type: claim.type, patterns: claim.patterns, pass });
        } else if (claim?.type === 'mustNotMatch' && typeof claim.pattern === 'string') {
          const pass = !new RegExp(claim.pattern, 'u').test(corpus);
          checks.push({ field, type: claim.type, pattern: claim.pattern, pass });
        } else {
          checks.push({ field, pass: false, reason: `unsupported narrativeClaims entry: ${JSON.stringify(claim)}` });
        }
      } catch (err) {
        checks.push({ field, pass: false, reason: `invalid narrativeClaims regex: ${err.message}` });
      }
    });
  }

  if (checks.length === 0) {
    return {
      dimension: 'D2',
      status: 'N/A',
      reason: 'authority case carries no narrative-checkable expectations (expected.{strengthLevel,yongshinElement,gyeokguk} / narrativeClaims all absent)',
    };
  }

  const failed = checks.filter((check) => !check.pass);
  return {
    dimension: 'D2',
    status: failed.length === 0 ? 'PASS' : 'FAIL',
    checks,
    failedCount: failed.length,
    totalChecks: checks.length,
  };
}
