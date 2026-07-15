/**
 * tools/quality_gate.mjs
 *
 * 5-dimension quality gate per F-A18 (`spring-info/09_finalization/18_quality_gate.md`).
 *
 * Compares spring-ts default-mode actual output against external reference
 * data (A: Korean myeongri authority cases, B: saju_master CLI oracle) and
 * verifies "능가" — strict binary AND across D1–D5.
 *
 * Status (PR-G1): infrastructure skeleton. Dimensions return N/A when their
 * reference data is unavailable (Phase L wires the actual data: F-A16
 * authority extract + F-A12 oracle capture + F-A9 edge fixture additions).
 *
 * Usage:
 *   node tools/quality_gate.mjs                       # all dim, all fixtures
 *   node tools/quality_gate.mjs --dimensions D1,D3    # specific dimensions
 *   node tools/quality_gate.mjs --fixtures fix-01,03  # specific fixtures
 *   node tools/quality_gate.mjs --json > report.json  # JSON output
 *   node tools/quality_gate.mjs --verbose             # per-fixture diagnostic
 *   node tools/quality_gate.mjs --require-complete     # release: fail on N/A
 *
 * Exit codes:
 *   0 — diagnostic run has no measured failure
 *   1 — measured failure, or incomplete coverage in --require-complete mode
 *   2 — fixture/snapshot unreadable
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyDimensionAggregate,
  classifyGateOverall,
  qualityGateExitCode,
} from './quality_gate_status.mjs';
import {
  isAuthorityTruthEligible as isAuthorityTruthEligibleByPolicy,
  shouldAuditEvidenceDirectory,
  validateSourceTierMetadata,
} from './source_tier_policy.mjs';

// ── paths ─────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const FIXTURES_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/spring_ts_baseline_cases.json');
const JONGGYEOK_FIXTURES_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/jonggyeok_cases.json');
const JONGGYEOK_AUTHORITY_CASES_PATH = path.resolve(
  SPRING_TS_ROOT,
  'test/fixtures/jonggyeok_authority_cases.json',
);
const SNAPSHOT_PATH = path.resolve(SPRING_TS_ROOT, 'test/baseline/spring_ts_snapshot.json');
const NARRATIVES_PATH = path.resolve(SPRING_TS_ROOT, 'test/baseline/spring_ts_narratives.json');
const AUTHORITY_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority');
const ORACLES_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/oracles');
const DATA_SOURCES_DIR = path.resolve(SPRING_TS_ROOT, 'data/sources');

const ALL_DIMENSIONS = ['D1', 'D2', 'D3', 'D4', 'D5'];
const CLASSICAL_SOURCE_QUOTE_MAX_CHARS = 80;

// ── arg parsing ───────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {
    dimensions: null,
    fixtures: null,
    json: false,
    verbose: false,
    requireComplete: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--dimensions' && argv[i + 1]) {
      args.dimensions = argv[i + 1].split(',').map(s => s.trim().toUpperCase());
    } else if (argv[i] === '--fixtures' && argv[i + 1]) {
      args.fixtures = argv[i + 1].split(',').map(s => s.trim());
    } else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--verbose') args.verbose = true;
    else if (argv[i] === '--require-complete') args.requireComplete = true;
  }
  return args;
}

// ── data loaders ──────────────────────────────────────────────────────────
function loadFixtures() {
  if (!fs.existsSync(FIXTURES_PATH)) {
    console.error(`Fixtures not found: ${FIXTURES_PATH}`);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8')).fixtures;
}

function loadSnapshot() {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.error(`Snapshot not found: ${SNAPSHOT_PATH}.`);
    console.error(`  hint: run \`npm run snapshot:capture\` first to generate it.`);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'));
}

/** Narrative golden (tools/narrative_baseline.ts). Absence is not fatal —
 *  D2/D4 degrade to N/A with an explicit reason (fail-closed for release
 *  mode via --require-complete, never fail-open). */
function loadNarratives() {
  if (!fs.existsSync(NARRATIVES_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(NARRATIVES_PATH, 'utf-8'));
  } catch (err) {
    console.error(`Failed to parse narrative golden: ${err.message}`);
    return null;
  }
}

/**
 * Resolve the narrative-golden entry for a fixture, guarding against a
 * stale golden (different target date than the structured snapshot, or a
 * fixture that hasn't been captured yet).
 *
 * Returns { entry, reason } — exactly one of the two is non-null.
 */
export function resolveNarrativeEntry(narratives, fixtureId, snapshotTargetDate) {
  if (!narratives || !Array.isArray(narratives.results)) {
    return { entry: null, reason: 'narrative golden unavailable — run `npm run narrative:capture`' };
  }
  if (snapshotTargetDate && narratives.targetDate !== snapshotTargetDate) {
    return {
      entry: null,
      reason: `narrative golden stale (targetDate ${narratives.targetDate} != snapshot ${snapshotTargetDate}) — run \`npm run narrative:capture\``,
    };
  }
  const entry = narratives.results.find((r) => r?.id === fixtureId) ?? null;
  if (!entry || !entry.cards) {
    return { entry: null, reason: `narrative golden has no entry for ${fixtureId} — run \`npm run narrative:capture\`` };
  }
  return { entry, reason: null };
}

function loadAuthorityCase(fixtureId) {
  const filePath = path.join(AUTHORITY_DIR, `${fixtureId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`Failed to parse authority case ${fixtureId}: ${err.message}`);
    return null;
  }
}

function loadOracleCase(fixtureId) {
  const filePath = path.join(ORACLES_DIR, `${fixtureId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`Failed to parse oracle case ${fixtureId}: ${err.message}`);
    return null;
  }
}

function walkJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && shouldAuditEvidenceDirectory(entry.name)) {
      files.push(...walkJsonFiles(fullPath));
    }
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(fullPath);
  }
  return files;
}

function relPath(filePath) {
  return path.relative(SPRING_TS_ROOT, filePath).replaceAll(path.sep, '/');
}

function validateSourceTierObject(sourceTier, filePath, sourceTierPath = 'sourceTier') {
  const file = relPath(filePath);
  return validateSourceTierMetadata(sourceTier, { file, sourceTierPath });
}

function isClassicalQuoteContext(record, filePath, sourceTier) {
  const file = relPath(filePath);
  return file.startsWith('test/baseline/authority/jonheom/') ||
    file.startsWith('test/baseline/authority/classical/') ||
    record?.source?.tradition === 'classical' ||
    record?.tradition === 'classical' ||
    (
      typeof sourceTier?.sourceType === 'string' &&
      sourceTier.sourceType.startsWith('classical_')
    );
}

function validateClassicalQuote(quote, filePath, quotePath) {
  if (typeof quote !== 'string') return [];
  const length = [...quote].length;
  if (length <= CLASSICAL_SOURCE_QUOTE_MAX_CHARS) return [];
  return [{
    file: relPath(filePath),
    quotePath,
    code: 'classical_quote_too_long',
    limit: CLASSICAL_SOURCE_QUOTE_MAX_CHARS,
    length,
    message: `${quotePath} must be <= ${CLASSICAL_SOURCE_QUOTE_MAX_CHARS} characters for classical source fixtures`,
  }];
}

function collectRecordQuoteViolations(record, filePath, recordPath = '', inheritedSourceTier = null) {
  const sourceTier = record?.sourceTier ?? inheritedSourceTier;
  if (!isClassicalQuoteContext(record, filePath, sourceTier)) return [];

  const violations = [];
  const prefix = recordPath ? `${recordPath}.` : '';
  if (record?.sourceTier) {
    violations.push(...validateClassicalQuote(record.sourceTier.quoteShort, filePath, `${prefix}sourceTier.quoteShort`));
  }

  const proseQuote = record?.prose_quote;
  if (typeof proseQuote === 'string') {
    violations.push(...validateClassicalQuote(proseQuote, filePath, `${prefix}prose_quote`));
  } else if (proseQuote && typeof proseQuote === 'object' && !Array.isArray(proseQuote)) {
    violations.push(...validateClassicalQuote(proseQuote.verbatim, filePath, `${prefix}prose_quote.verbatim`));
  }

  if (Array.isArray(record?.prose_quotes)) {
    record.prose_quotes.forEach((item, index) => {
      if (typeof item === 'string') {
        violations.push(...validateClassicalQuote(item, filePath, `${prefix}prose_quotes[${index}]`));
      } else if (item && typeof item === 'object') {
        violations.push(...validateClassicalQuote(item.quote, filePath, `${prefix}prose_quotes[${index}].quote`));
      }
    });
  }
  return violations;
}

function auditClassicalQuoteLengths(data, filePath) {
  const violations = collectRecordQuoteViolations(data, filePath);
  if (Array.isArray(data?.sources)) {
    data.sources.forEach((source, index) => {
      violations.push(...collectRecordQuoteViolations(source, filePath, `sources[${index}]`, data?.sourceTier));
    });
  }
  if (Array.isArray(data?.cases)) {
    data.cases.forEach((record, index) => {
      violations.push(...collectRecordQuoteViolations(record, filePath, `cases[${index}]`, data?.sourceTier));
    });
  }
  if (Array.isArray(data?.snippets)) {
    data.snippets.forEach((record, index) => {
      violations.push(...collectRecordQuoteViolations(record, filePath, `snippets[${index}]`, data?.sourceTier));
    });
  }
  return violations;
}

function collectSourceTierRefs(data) {
  const topLevelSourceTier = data?.sourceTier ?? data?._meta?.sourceTier;
  const refs = [{
    sourceTier: topLevelSourceTier,
    sourceTierPath: data?.sourceTier ? 'sourceTier' : '_meta.sourceTier',
  }];
  if (Array.isArray(data?.sources)) {
    data.sources.forEach((source, index) => {
      refs.push({
        sourceTier: source?.sourceTier,
        sourceTierPath: `sources[${index}].sourceTier`,
      });
    });
  }
  if (Array.isArray(data?.snippets)) {
    data.snippets.forEach((snippet, index) => {
      refs.push({
        sourceTier: snippet?.sourceTier,
        sourceTierPath: `snippets[${index}].sourceTier`,
      });
    });
  }
  if (Array.isArray(data?.cases)) {
    data.cases.forEach((record, index) => {
      if (!record || typeof record !== 'object' || !('sourceTier' in record)) return;
      refs.push({
        sourceTier: record?.sourceTier,
        sourceTierPath: `cases[${index}].sourceTier`,
      });
    });
  }
  return refs;
}

function auditSourceTiers() {
  const files = [
    ...walkJsonFiles(AUTHORITY_DIR),
    ...walkJsonFiles(ORACLES_DIR),
    ...walkJsonFiles(DATA_SOURCES_DIR),
  ];
  if (fs.existsSync(JONGGYEOK_FIXTURES_PATH)) files.push(JONGGYEOK_FIXTURES_PATH);
  if (fs.existsSync(JONGGYEOK_AUTHORITY_CASES_PATH)) {
    files.push(JONGGYEOK_AUTHORITY_CASES_PATH);
  }

  const violations = [];
  let scanned = 0;
  for (const filePath of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      violations.push({
        file: relPath(filePath),
        code: 'invalid_json',
        message: err.message,
      });
      continue;
    }
    const sourceTierRefs = collectSourceTierRefs(data);
    scanned += sourceTierRefs.length;
    for (const ref of sourceTierRefs) {
      violations.push(...validateSourceTierObject(ref.sourceTier, filePath, ref.sourceTierPath));
    }
    violations.push(...auditClassicalQuoteLengths(data, filePath));
  }

  return {
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    scanned,
    violations,
  };
}

function isAuthorityTruthEligible(record) {
  return isAuthorityTruthEligibleByPolicy(record);
}

// ── dimension evaluators ──────────────────────────────────────────────────
// Each dimension returns one of:
//   { dimension: 'DN', status: 'PASS' | 'FAIL' | 'N/A' | 'NOT_APPLICABLE', ... }
// PASS = all checks passed, FAIL = at least one check failed,
// N/A = reference data missing (blocks release completeness),
// NOT_APPLICABLE = fixture out of the dimension's scope by design (D5 on
// non-edge fixtures) — never blocks the aggregate.

// D1 thresholds per F-A18 §2.1
const D1_TOTALSCORE_TOLERANCE = 2.0;
const D1_INDIVIDUAL_SCORE_TOLERANCE = 1.0;

function isAllowedField(allowedDiff, fieldPath) {
  if (!Array.isArray(allowedDiff)) return false;
  return allowedDiff.some((d) => typeof d === 'string' && d.startsWith(fieldPath));
}

// PR-M-2: spring-ts emits hedged strength labels like "중화(신약 경향)" /
// "중화(신강 경향)"; saju_master emits discrete "신약" / "신강" / "중화 또는
// 약중강". The two systems disagree on labelling but not on the underlying
// band. Treat the labels as equivalent within the same band so D1 doesn't
// flag a labelling-only diff as substantive.
const STRENGTH_BAND = {
  신약: 'weak',
  '중화(신약 경향)': 'weak',
  신강: 'strong',
  '중화(신강 경향)': 'strong',
  중화: 'middle',
  '중화 또는 약중강': 'middle',
  극신약: 'weak',
  극신강: 'strong',
};

function strengthBand(label) {
  if (!label || typeof label !== 'string') return null;
  return STRENGTH_BAND[label] || null;
}

export function strengthLevelMatches(actual, expected) {
  if (actual === expected) return true;
  const a = strengthBand(actual);
  const e = strengthBand(expected);
  if (!a || !e) return false;
  if (a === e) return true;
  return false;
}

// 감사 B4: spring-ts 기본 모드가 월지 비겁을 주류 격명(건록격/양인격/월겁격)으로
// 출력한다. 오라클/authority 픽스처(외부 레퍼런스 캡처)의 "비견격"/"겁재격"은
// 동일 명식의 레거시 명명이므로 동등 격명으로 매칭한다(오라클 파일은 수정하지 않는다).
const GYEOKGUK_EQUIV = {
  비견격: new Set(['비견격', '건록격']),
  겁재격: new Set(['겁재격', '양인격', '월겁격']),
};

function gyeokgukTypeMatches(actual, expected) {
  if (actual === expected) return true;
  const eq = GYEOKGUK_EQUIV[expected];
  return eq ? eq.has(actual) : false;
}

export function evaluateD1(fixture, snapshotResult, authorityCase, oracleCase) {
  const checks = [];
  const allowed = fixture.allowedDiff || [];
  const sajuActual = snapshotResult.output.sajuReport || {};
  const namingActual = snapshotResult.output.namingReport || {};
  const authorityTruth = isAuthorityTruthEligible(authorityCase) ? authorityCase : null;
  const oracleTruth = isAuthorityTruthEligible(oracleCase) ? oracleCase : null;

  // categorical fields from authority (A) — gyeokguk + yongshin + strength
  const categoricalA = [
    { field: 'sajuReport.gyeokgukType', actual: sajuActual.gyeokgukType, expected: authorityTruth?.expected?.gyeokguk },
    { field: 'sajuReport.yongshinElement', actual: sajuActual.yongshinElement, expected: authorityTruth?.expected?.yongshinElement },
    { field: 'sajuReport.strengthLevel', actual: sajuActual.strengthLevel, expected: authorityTruth?.expected?.strengthLevel },
  ];
  for (const c of categoricalA) {
    if (c.expected === undefined || c.expected === null) continue;
    if (isAllowedField(allowed, c.field)) {
      checks.push({ ...c, pass: true, allowedDiff: true });
    } else {
      const pass = c.field === 'sajuReport.strengthLevel'
        ? strengthLevelMatches(c.actual, c.expected)
        : c.field === 'sajuReport.gyeokgukType'
          ? gyeokgukTypeMatches(c.actual, c.expected)
          : c.actual === c.expected;
      checks.push({ ...c, pass });
    }
  }

  // categorical fields from oracle (B) when a future oracle is explicitly
  // promoted to authority-truth eligibility. Current saju_master captures are
  // T2 reference-implementation records and are excluded from D1.
  if (oracleTruth?.expected) {
    const categoricalB = [
      { field: 'sajuReport.gyeokgukType', actual: sajuActual.gyeokgukType, expected: oracleTruth.expected.gyeokgukType },
      { field: 'sajuReport.yongshinElement', actual: sajuActual.yongshinElement, expected: oracleTruth.expected.yongshinElement },
      { field: 'sajuReport.strengthLevel', actual: sajuActual.strengthLevel, expected: oracleTruth.expected.strengthLevel },
    ];
    for (const c of categoricalB) {
      // skip if A already covered the same field (avoid double-count)
      if (categoricalA.some((a) => a.field === c.field && a.expected !== undefined)) continue;
      if (c.expected === undefined || c.expected === null) continue;
      if (isAllowedField(allowed, c.field)) {
        checks.push({ ...c, pass: true, allowedDiff: true, source: 'oracle' });
      } else {
        const pass = c.field === 'sajuReport.strengthLevel'
          ? strengthLevelMatches(c.actual, c.expected)
          : c.field === 'sajuReport.gyeokgukType'
            ? gyeokgukTypeMatches(c.actual, c.expected)
            : c.actual === c.expected;
        checks.push({ ...c, pass, source: 'oracle' });
      }
    }
  }

  // numerical: totalScore + scores.{hangul,hanja,fourFrame}
  const expectedNumerical = authorityTruth?.expected?.scores || oracleTruth?.expected?.scores;
  if (expectedNumerical) {
    const numericalChecks = [
      { field: 'namingReport.totalScore', actual: namingActual.totalScore, expected: authorityTruth?.expected?.totalScore ?? oracleTruth?.expected?.totalScore, tol: D1_TOTALSCORE_TOLERANCE },
      { field: 'namingReport.scores.hangul', actual: namingActual.scores?.hangul, expected: expectedNumerical.hangul, tol: D1_INDIVIDUAL_SCORE_TOLERANCE },
      { field: 'namingReport.scores.hanja', actual: namingActual.scores?.hanja, expected: expectedNumerical.hanja, tol: D1_INDIVIDUAL_SCORE_TOLERANCE },
      { field: 'namingReport.scores.fourFrame', actual: namingActual.scores?.fourFrame, expected: expectedNumerical.fourFrame, tol: D1_INDIVIDUAL_SCORE_TOLERANCE },
    ];
    for (const c of numericalChecks) {
      if (c.expected === undefined || c.expected === null) continue;
      if (c.actual === undefined || c.actual === null) {
        checks.push({
          field: c.field,
          actual: c.actual,
          expected: c.expected,
          diff: null,
          tol: c.tol,
          pass: false,
          reason: 'authority expected a numerical field but actual output is missing',
        });
        continue;
      }
      if (isAllowedField(allowed, c.field)) {
        checks.push({ field: c.field, actual: c.actual, expected: c.expected, diff: Math.abs(c.actual - c.expected), tol: c.tol, pass: true, allowedDiff: true });
      } else {
        const diff = Math.abs(c.actual - c.expected);
        checks.push({ field: c.field, actual: c.actual, expected: c.expected, diff, tol: c.tol, pass: diff <= c.tol });
      }
    }
  }

  if (checks.length === 0) {
    return { dimension: 'D1', status: 'N/A', reason: 'no authority-truth-eligible reference data for this fixture' };
  }

  const failed = checks.filter((c) => !c.pass);
  return {
    dimension: 'D1',
    status: failed.length === 0 ? 'PASS' : 'FAIL',
    checks,
    failedCount: failed.length,
    totalChecks: checks.length,
  };
}

// ── D2 서술 일치 (narrative agreement) ────────────────────────────────────
// Reference: authority fixture expectations (same eligibility bar as D1)
// checked against the narrative golden captured by tools/narrative_baseline.ts.
// All markers below are 실측-grounded against the rendered default-mode cards
// (probe run 2026-07-10, fix-01/05/11/12):
//   strength   → "에너지 균형은 신약이에요." / "에너지 균형은 중화(신강 경향)예요."
//                and overallSummary "전체 에너지는 중화(신약 경향) 수준이고, …"
//   yongshin   → "…용신 후보는 불(화) 기운이에요." (friendly(short) rendering)
//   gyeokguk   → evidence supportingFeatures "격국: 건록격" / "선택 격국: 식신격"

/** Element code → 실측 narrative renderings. The overview card renders
 *  `${friendly}(${short})` (e.g. "불(화)"); `${short}(${hanja})` (e.g.
 *  "화(火)") is the ELEMENT_KOREAN long form used by expert surfaces. */
const NARRATIVE_ELEMENT_TOKENS = {
  WOOD: ['나무(목)', '목(木)'],
  FIRE: ['불(화)', '화(火)'],
  EARTH: ['흙(토)', '토(土)'],
  METAL: ['쇠(금)', '금(金)'],
  WATER: ['물(수)', '수(水)'],
};

const ELEMENT_CODE_BY_KOREAN_CHAR = {
  목: 'WOOD', 화: 'FIRE', 토: 'EARTH', 금: 'METAL', 수: 'WATER',
  木: 'WOOD', 火: 'FIRE', 土: 'EARTH', 金: 'METAL', 水: 'WATER',
};

function normalizeElementCode(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  const upper = value.toUpperCase();
  if (NARRATIVE_ELEMENT_TOKENS[upper]) return upper;
  return ELEMENT_CODE_BY_KOREAN_CHAR[value.charAt(0)] ?? null;
}

/** Longest-first so hedged labels ("중화(신약 경향)") win over their
 *  substrings ("중화", "신약"); matched spans are masked before shorter
 *  labels are probed. */
const STRENGTH_LABELS_LONGEST_FIRST = Object.keys(STRENGTH_BAND)
  .sort((a, b) => b.length - a.length);

export function extractStrengthBands(text) {
  const bands = new Set();
  let rest = String(text ?? '');
  for (const label of STRENGTH_LABELS_LONGEST_FIRST) {
    if (rest.includes(label)) {
      bands.add(STRENGTH_BAND[label]);
      rest = rest.split(label).join('\u0000');
    }
  }
  return bands;
}

function narrativeEvidenceCorpus(overviewSummary) {
  const parts = [];
  for (const row of overviewSummary?.evidence ?? []) {
    if (row?.claim) parts.push(String(row.claim));
    for (const feature of row?.supportingFeatures ?? []) parts.push(String(feature));
    if (row?.weakness) parts.push(String(row.weakness));
  }
  return parts.join('\n');
}

function fullNarrativeCorpus(cards) {
  // Deterministic flattening of every captured sentence — used by the
  // optional `narrativeClaims` regex checks and the D4 global assertion ban.
  return JSON.stringify(cards ?? {});
}

export function evaluateD2(fixture, snapshotResult, authorityCase, narrativeLookup) {
  const authorityTruth = isAuthorityTruthEligible(authorityCase) ? authorityCase : null;
  if (!authorityTruth) {
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
  const expected = authorityTruth.expected ?? {};
  const checks = [];

  // ① strength narrative agreement — the strength wording must express the
  // expected band and must not assert the opposite band.
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

  // ② yongshin narrative agreement — yongshinDescription must carry the
  // expected element's Korean rendering ("불(화)" or "화(火)" style).
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

  // ③ gyeokguk narrative agreement — expertText or the overview evidence
  // rows must mention the expected gyeokguk name (equivalence classes per
  // GYEOKGUK_EQUIV, same as D1).
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

  // ④ optional authority-authored narrative claims (regex, fail-closed on
  // malformed entries).
  const claims = Array.isArray(authorityTruth.narrativeClaims) ? authorityTruth.narrativeClaims : [];
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

  const failed = checks.filter((c) => !c.pass);
  return {
    dimension: 'D2',
    status: failed.length === 0 ? 'PASS' : 'FAIL',
    checks,
    failedCount: failed.length,
    totalChecks: checks.length,
  };
}

// Map snapshot output keys to the saju-master card-type tokens that
// `oracle.cards.surfacedCardTypes` enumerates. The snapshot's
// fortuneReport block carries headline data per card; absence of the
// data implies the card was not surfaced.
function inferSurfacedCardsFromSnapshot(snapshotResult) {
  const out = snapshotResult.output || {};
  const tokens = new Set();
  if (out.sajuReport?.gyeokgukType) tokens.add('gyeokguk');
  if (out.sajuReport?.yongshinElement) tokens.add('yongshin');
  if (out.fortuneReport?.personalityTraitCount > 0) tokens.add('sipsin');
  // shinsal + johu are not captured directly in baseline_snapshot.json,
  // but spring-ts always surfaces ShinsalCard + JohuCard when sajuEnabled
  // is true. saju-adapter PR-H-B lifts shinsal when non-empty; JohuCard
  // is built unconditionally from sajuReport.johu. Snapshot-only inference
  // therefore can't tell us "did the card carry data?" — treat them as
  // surfaced when the upstream report exists. A future snapshot pass can
  // add direct shinsal/johu signal counts to disambiguate.
  if (out.sajuReport?.sajuEnabled) {
    tokens.add('shinsal');
    tokens.add('johu');
  }
  return tokens;
}

export function evaluateD3(fixture, snapshotResult, authorityCase, oracleCase) {
  // Card-surface truth sources: authority fixture file first, oracle capture
  // as fallback. Both must clear the same authority-truth eligibility bar —
  // current saju_master oracle captures are T2 and therefore excluded.
  const authorityTruth = isAuthorityTruthEligible(authorityCase) ? authorityCase : null;
  const oracleTruth = isAuthorityTruthEligible(oracleCase) ? oracleCase : null;
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

// ── D4 hedge 라벨링 (hedge labeling) ──────────────────────────────────────
// 실측-grounded markers (probe run 2026-07-10):
//   borderline strength hedge → "중화(신강 경향)" — marker "경향" inside the
//                               strength wording.
//   unknown-hour note         → pillar position "시주(임시)" + evidence
//                               inputTime claim "출생 시각 정보가 없어 계산에는
//                               낮 12시를 임시 기준으로 사용했어요. …".
// The global assertion ban patterns were audited against all 17 captured
// fixture narratives before adoption: the only "100%" occurrence is the
// grounded confidence-metric display "신뢰도 100%" (gyeokguk candidate
// evidence row) — excluded via lookbehind; every other pattern had 0 matches.
const D4_FORBIDDEN_ABSOLUTE_PATTERNS = [
  { label: '반드시 (unconditional certainty)', regex: /반드시/u },
  { label: '틀림없- (no-doubt assertion)', regex: /틀림없/u },
  { label: '100% (numeric certainty)', regex: /(?<!신뢰도\s{0,3})100\s*(?:%|퍼센트)/u },
  { label: '확실히 …다 단정', regex: /확실히[^"”]{0,12}(?:됩니다|된다)/u },
];

const D4_STRENGTH_HEDGE_MARKER = /경향/u;
const D4_HOUR_UNCERTAINTY_PILLAR = '시주(임시)';
const D4_HOUR_UNCERTAINTY_CLAIM = /출생 시각[^"]{0,40}(?:임시|참고용)/u;

export function evaluateD4(fixture, snapshotResult, authorityCase, narrativeLookup) {
  const authorityTruth = isAuthorityTruthEligible(authorityCase) ? authorityCase : null;
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

  // ① global ban on ungrounded absolute assertions across the whole
  // user-visible narrative corpus.
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

  // ② borderline-strength fixtures must hedge the strength wording.
  if (hedgePolicy.requireHedgedStrength === true) {
    const strengthText = String(overview.strengthDescription ?? '');
    checks.push({
      field: 'narrative.hedgedStrength',
      marker: '경향',
      strengthText,
      pass: D4_STRENGTH_HEDGE_MARKER.test(strengthText),
    });
  }

  // ③ unknown-hour fixtures must surface the hour-uncertainty note.
  if (hedgePolicy.requireHourUncertaintyNote === true) {
    const pillars = Array.isArray(overview.pillars) ? overview.pillars : [];
    const hasProvisionalPillar = pillars.some((p) => String(p?.position ?? '').includes(D4_HOUR_UNCERTAINTY_PILLAR));
    const hasUncertaintyClaim = (overview.evidence ?? []).some((row) =>
      row?.axis === 'inputTime' && D4_HOUR_UNCERTAINTY_CLAIM.test(String(row?.claim ?? '')));
    checks.push({
      field: 'narrative.hourUncertaintyNote',
      pass: hasProvisionalPillar || hasUncertaintyClaim,
      hasProvisionalPillar,
      hasUncertaintyClaim,
    });
  }

  const failed = checks.filter((c) => !c.pass);
  return {
    dimension: 'D4',
    status: failed.length === 0 ? 'PASS' : 'FAIL',
    checks,
    failedCount: failed.length,
    totalChecks: checks.length,
  };
}

// D5 edge axis-tag patterns — per F-A9 fixture taxonomy. Add new edge types
// here (e.g., 'unknown-hour', 'borderline-strength') as Phase L-1 lands them.
const D5_EDGE_AXIS_PATTERNS = [
  /^jonggyeok/i,
  /^jonggwang/i,
  /^jaza-edge$/i,
  /^johu-/i,
  /^unknown-hour$/i,
  /^borderline-strength$/i,
  /^jie-/i,
  /^yaza-window$/i,
  /^lunar-input$/i,
];

function isEdgeFixture(fixture) {
  const axes = Array.isArray(fixture.axis) ? fixture.axis : [];
  return axes.some((a) => D5_EDGE_AXIS_PATTERNS.some((re) => re.test(String(a))));
}

export function evaluateD5(fixture, snapshotResult, authorityCase, oracleCase) {
  if (!isEdgeFixture(fixture)) {
    // Out of scope by design — a non-edge fixture carries no D5 signal and
    // must not block the dimension aggregate (distinct from 'N/A', which
    // means "reference data missing" and keeps blocking release).
    return {
      dimension: 'D5',
      status: 'NOT_APPLICABLE',
      reason: 'not an edge fixture (axis does not match D5 edge patterns)',
    };
  }

  const output = snapshotResult.output || {};
  const sajuReport = output.sajuReport || {};
  const namingReport = output.namingReport || {};

  // Stability checks per F-A18 §2.5 — edge fixtures must surface non-crashing,
  // structurally complete output. Empty/undefined sajuEnabled or missing
  // namingReport totalScore is a D5 FAIL.
  const stabilityChecks = [
    { field: 'output present', pass: typeof snapshotResult.output === 'object' && snapshotResult.output !== null },
    { field: 'sajuReport present', pass: typeof output.sajuReport === 'object' && output.sajuReport !== null },
    { field: 'sajuEnabled defined', pass: sajuReport.sajuEnabled !== undefined },
    { field: 'namingReport present', pass: typeof output.namingReport === 'object' && output.namingReport !== null },
    { field: 'totalScore is finite number', pass: Number.isFinite(namingReport.totalScore) },
  ];

  // If saju is enabled on this edge fixture, also require the scoring categorical
  // fields to surface — collapsing 종격 to undefined would be a critical D5 fail.
  if (sajuReport.sajuEnabled === true) {
    stabilityChecks.push({
      field: 'gyeokgukType surfaced when sajuEnabled',
      pass: typeof sajuReport.gyeokgukType === 'string' && sajuReport.gyeokgukType.length > 0,
    });
    stabilityChecks.push({
      field: 'strengthLevel surfaced when sajuEnabled',
      pass: typeof sajuReport.strengthLevel === 'string' && sajuReport.strengthLevel.length > 0,
    });
  }

  // Reference-driven categorical PASS rate per F-A18 §2.5 — when authority or
  // oracle case is present for the edge fixture, edge D1-equivalent must be
  // 100%. Reuse evaluateD1's pass-rate as the D5 categorical signal.
  let referenceRate = null;
  const authorityTruth = isAuthorityTruthEligible(authorityCase) ? authorityCase : null;
  if (authorityTruth) {
    const d1 = evaluateD1(fixture, snapshotResult, authorityTruth, null);
    if (d1.status !== 'N/A' && d1.totalChecks > 0) {
      const passRate = (d1.totalChecks - d1.failedCount) / d1.totalChecks;
      referenceRate = passRate;
      stabilityChecks.push({
        field: 'edge categorical PASS rate ≥ 1.0 (F-A18 §2.5)',
        pass: passRate >= 1.0,
        passRate,
      });
    }
  }

  const failed = stabilityChecks.filter((c) => !c.pass);
  return {
    dimension: 'D5',
    status: failed.length === 0 ? 'PASS' : 'FAIL',
    checks: stabilityChecks,
    failedCount: failed.length,
    totalChecks: stabilityChecks.length,
    referenceRate,
  };
}

// ── per-fixture aggregator ────────────────────────────────────────────────
function evaluateFixture(fixture, snapshot, dimensionFilter, narratives) {
  const snapshotResult = snapshot.results.find(r => r.id === fixture.id);
  if (!snapshotResult) {
    return {
      fixtureId: fixture.id,
      label: fixture.label,
      status: 'FAIL',
      reason: 'fixture not present in snapshot — run npm run snapshot:capture',
      dimensions: {},
    };
  }

  const authorityCase = loadAuthorityCase(fixture.id);
  const oracleCase = loadOracleCase(fixture.id);
  const narrativeLookup = resolveNarrativeEntry(narratives, fixture.id, snapshot.targetDate);

  const wantDim = (d) => !dimensionFilter || dimensionFilter.includes(d);

  const dimensions = {};
  if (wantDim('D1')) dimensions.D1 = evaluateD1(fixture, snapshotResult, authorityCase, oracleCase);
  if (wantDim('D2')) dimensions.D2 = evaluateD2(fixture, snapshotResult, authorityCase, narrativeLookup);
  if (wantDim('D3')) dimensions.D3 = evaluateD3(fixture, snapshotResult, authorityCase, oracleCase);
  if (wantDim('D4')) dimensions.D4 = evaluateD4(fixture, snapshotResult, authorityCase, narrativeLookup);
  if (wantDim('D5')) dimensions.D5 = evaluateD5(fixture, snapshotResult, authorityCase, oracleCase);

  // 'N/A' = measurement missing (still blocks release completeness);
  // 'NOT_APPLICABLE' = out of scope by design (never counted as measured,
  // never blocks). Both are excluded from the measured set here.
  const measured = Object.values(dimensions)
    .filter(d => d.status !== 'N/A' && d.status !== 'NOT_APPLICABLE');
  const failed = measured.filter(d => d.status === 'FAIL');

  let status;
  if (failed.length > 0) status = 'FAIL';
  else if (measured.length > 0) status = 'PASS';
  else status = 'N/A';

  return {
    fixtureId: fixture.id,
    label: fixture.label,
    status,
    dimensions,
    measuredCount: measured.length,
    failedCount: failed.length,
    disagreementNotes: fixture.disagreementNotes || [],
  };
}

// ── overall runner ────────────────────────────────────────────────────────
export function runGate(args) {
  const sourceTierAudit = auditSourceTiers();
  const fixtures = loadFixtures();
  const snapshot = loadSnapshot();
  const narratives = loadNarratives();

  let filteredFixtures = fixtures;
  if (args.fixtures) {
    const idSet = new Set(args.fixtures.map(f => (f.startsWith('fix-') ? f : `fix-${f}`)));
    filteredFixtures = fixtures.filter(f => idSet.has(f.id));
  }

  const dimFilter = args.dimensions;
  const fixtureReports = filteredFixtures.map(f => evaluateFixture(f, snapshot, dimFilter, narratives));

  const totalFail = fixtureReports.filter(r => r.status === 'FAIL').length;
  const totalPass = fixtureReports.filter(r => r.status === 'PASS').length;
  const totalNA = fixtureReports.filter(r => r.status === 'N/A').length;

  const dimensionAggregate = {};
  for (const d of ALL_DIMENSIONS) {
    if (dimFilter && !dimFilter.includes(d)) continue;
    const dimResults = fixtureReports.map(r => r.dimensions?.[d]).filter(Boolean);
    const fail = dimResults.filter(x => x.status === 'FAIL').length;
    const pass = dimResults.filter(x => x.status === 'PASS').length;
    const na = dimResults.filter(x => x.status === 'N/A').length;
    const notApplicable = dimResults.filter(x => x.status === 'NOT_APPLICABLE').length;
    const status = classifyDimensionAggregate({ pass, fail, na, notApplicable });
    dimensionAggregate[d] = { pass, fail, na, notApplicable, status };
  }

  const overall = classifyGateOverall({
    sourceTierStatus: sourceTierAudit.status,
    totalFailures: totalFail,
    dimensionStatuses: Object.values(dimensionAggregate).map(({ status }) => status),
  });
  const incompleteDimensions = Object.entries(dimensionAggregate)
    .filter(([, aggregate]) => aggregate.status !== 'PASS')
    .map(([dimension]) => dimension);

  return {
    overall,
    incompleteDimensions,
    sourceTierAudit,
    totals: { pass: totalPass, fail: totalFail, na: totalNA, total: fixtureReports.length },
    dimensions: dimensionAggregate,
    fixtures: fixtureReports,
    generatedAt: new Date().toISOString(),
  };
}

// ── reporters ─────────────────────────────────────────────────────────────
function renderHumanSummary(report, verbose) {
  const lines = [];
  lines.push(`Quality Gate Report`);
  lines.push(`─────────────────────────────────`);
  lines.push(`Overall: ${report.overall}`);
  lines.push(
    `Fixtures: ${report.totals.pass} PASS / ${report.totals.fail} FAIL / ${report.totals.na} N/A` +
      ` (total ${report.totals.total})`
  );
  lines.push(
    `Source tiers: ${report.sourceTierAudit.status}` +
      ` (${report.sourceTierAudit.scanned} records scanned, ${report.sourceTierAudit.violations.length} violations)`
  );
  if (report.incompleteDimensions.length > 0) {
    lines.push('Incomplete dimensions: ' + report.incompleteDimensions.join(', '));
  }
  if (report.sourceTierAudit.violations.length > 0) {
    for (const v of report.sourceTierAudit.violations.slice(0, 10)) {
      const field = v.field ? ` ${v.field}` : '';
      lines.push(`  ${v.file}:${field} ${v.code} — ${v.message}`);
    }
    if (report.sourceTierAudit.violations.length > 10) {
      lines.push(`  ... ${report.sourceTierAudit.violations.length - 10} more source-tier violations`);
    }
  }
  lines.push(``);
  lines.push(`Dimensions:`);
  for (const [dim, agg] of Object.entries(report.dimensions)) {
    const notApplicable = agg.notApplicable > 0 ? ` / ${agg.notApplicable} NOT_APPLICABLE` : '';
    lines.push(`  ${dim}: ${agg.status}  (${agg.pass} PASS / ${agg.fail} FAIL / ${agg.na} N/A${notApplicable})`);
  }
  if (verbose) {
    lines.push(``);
    lines.push(`Per-fixture detail:`);
    for (const f of report.fixtures) {
      lines.push(`  ${f.fixtureId} (${f.label}): ${f.status}`);
      if (f.reason) lines.push(`    ${f.reason}`);
      for (const [dim, dimResult] of Object.entries(f.dimensions || {})) {
        const reason = dimResult.reason ? ` — ${dimResult.reason}` : '';
        lines.push(`    ${dim}: ${dimResult.status}${reason}`);
      }
      // PR-M-3: surface documented disagreements alongside FAILs so the
      // reader can distinguish "known / pending Authority" from "unexpected".
      if (f.disagreementNotes?.length) {
        lines.push(`    Documented disagreements (pending Reference A):`);
        for (const note of f.disagreementNotes) {
          const tag = note.needsCodeReview ? ' [code review pending]' : '';
          lines.push(`      ${note.field}: spring-ts=${JSON.stringify(note.spring_ts)} vs saju_master=${JSON.stringify(note.saju_master)}${tag}`);
          lines.push(`        ${note.reason}`);
        }
      }
    }
  }
  return lines.join('\n');
}

// ── main ──────────────────────────────────────────────────────────────────
export function runCli(argv = process.argv) {
  const args = parseArgs(argv);
  const report = runGate(args);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderHumanSummary(report, args.verbose));
  }
  return qualityGateExitCode(report.overall, {
    requireComplete: args.requireComplete,
  });
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) process.exit(runCli());
