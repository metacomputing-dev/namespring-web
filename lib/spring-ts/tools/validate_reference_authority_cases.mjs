/**
 * Validate flat Reference A authority fixtures before they can feed
 * quality_gate.mjs as authority-truth records.
 *
 * The checker intentionally scans only direct JSON children of
 * test/baseline/authority. Subdirectories carry separate schemas and their
 * own validators.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  isAuthorityTruthEligible,
  validateSourceTierRecord,
} from './source_tier_policy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const DEFAULT_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority');

const REPORT_SCHEMA_VERSION = 'spring-ts.reference-authority-intake-report.v2';
const SUMMARY_MAX_CHARS = 50;
const SOURCE_TIER_QUOTE_MAX_CHARS = 80;

const REQUIRED_TOP_LEVEL_FIELDS = [
  'case_id',
  'source',
  'expected',
  'narrative',
  'hedge',
  'sourceTier',
  'copyrightNote',
];

const REQUIRED_SOURCE_FIELDS = ['text', 'author', 'page', 'category'];
const ALLOWED_ELEMENTS = new Set(['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER']);
const ALLOWED_STRENGTH_LEVELS = new Set(['신강', '신약', '중화', '극신강', '극신약']);
const NUMERIC_OR_NULL_NARRATIVE_FIELDS = [
  'charsPerClaim',
  'evidenceRowsPerClaim',
  'counterexampleCountPerCard',
];
const PROHIBITED_PROSE_KEYS = new Set([
  'quote',
  'quotes',
  'prosequote',
  'prosequotes',
  'originaltext',
  'originalprose',
  'verbatim',
  'fulltext',
  'sourceprose',
]);

function parseArgs(argv) {
  const args = {
    dir: DEFAULT_DIR,
    json: false,
    allowEmpty: true,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      args.json = true;
    } else if (arg === '--dir' && argv[i + 1]) {
      args.dir = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
    } else if (arg.startsWith('--dir=')) {
      args.dir = path.resolve(process.cwd(), arg.slice('--dir='.length));
    } else if (arg === '--allow-empty=false') {
      args.allowEmpty = false;
    } else if (arg === '--allow-empty=true') {
      args.allowEmpty = true;
    }
  }

  return args;
}

function relPath(filePath) {
  const relative = path.relative(SPRING_TS_ROOT, filePath);
  return relative.startsWith('..')
    ? path.relative(process.cwd(), filePath).replaceAll(path.sep, '/')
    : relative.replaceAll(path.sep, '/');
}

function readFlatJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(dir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function charLength(value) {
  return [...String(value ?? '')].length;
}

function isUnresolved(value) {
  if (value === undefined || value === null) return true;
  const normalized = String(value).trim().toLowerCase();
  return normalized.length === 0 || ['tbd', 'todo', 'unknown', 'n/a', 'na', '미정', '불명'].includes(normalized);
}

function addViolation(violations, filePath, code, pathExpr, message, details = {}) {
  violations.push({
    file: relPath(filePath),
    code,
    path: pathExpr,
    message,
    ...details,
  });
}

function validateRequiredObject(value, violations, filePath, field) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    addViolation(violations, filePath, 'required_object_missing', field, `${field} must be an object`);
    return false;
  }
  return true;
}

function validateNoLongOriginalProse(value, violations, filePath, pathExpr = '') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateNoLongOriginalProse(entry, violations, filePath, `${pathExpr}[${index}]`));
    return;
  }
  if (typeof value !== 'object' || value === null) return;

  for (const [key, entry] of Object.entries(value)) {
    const nextPath = pathExpr ? `${pathExpr}.${key}` : key;
    const normalizedKey = key.toLowerCase().replace(/[_-]/g, '');
    if (nextPath === 'sourceTier.quoteShort') {
      if (typeof entry === 'string' && charLength(entry) > SOURCE_TIER_QUOTE_MAX_CHARS) {
        addViolation(
          violations,
          filePath,
          'source_tier_quote_too_long',
          nextPath,
          `sourceTier.quoteShort must be <= ${SOURCE_TIER_QUOTE_MAX_CHARS} chars`,
          { length: charLength(entry), max: SOURCE_TIER_QUOTE_MAX_CHARS },
        );
      }
      continue;
    }
    if (PROHIBITED_PROSE_KEYS.has(normalizedKey) && typeof entry === 'string' && entry.trim().length > 0) {
      addViolation(
        violations,
        filePath,
        'original_prose_field_present',
        nextPath,
        'flat Reference A records must not store original prose fields',
      );
      continue;
    }
    validateNoLongOriginalProse(entry, violations, filePath, nextPath);
  }
}

function validateCase(record, filePath) {
  const violations = [];

  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    addViolation(violations, filePath, 'record_not_object', '$', 'authority case must be a JSON object');
    return violations;
  }

  for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
    if (!(field in record)) {
      addViolation(violations, filePath, 'required_field_missing', field, `${field} is required`);
    }
  }

  const sourceOk = validateRequiredObject(record.source, violations, filePath, 'source');
  const expectedOk = validateRequiredObject(record.expected, violations, filePath, 'expected');
  const narrativeOk = validateRequiredObject(record.narrative, violations, filePath, 'narrative');
  const hedgeOk = validateRequiredObject(record.hedge, violations, filePath, 'hedge');
  const sourceTierOk = validateRequiredObject(record.sourceTier, violations, filePath, 'sourceTier');

  if (typeof record.case_id !== 'string' || record.case_id.trim().length === 0) {
    addViolation(violations, filePath, 'case_id_missing', 'case_id', 'case_id must be a non-empty string');
  }

  if (sourceOk) {
    for (const field of REQUIRED_SOURCE_FIELDS) {
      if (!(field in record.source) || isUnresolved(record.source[field])) {
        addViolation(violations, filePath, 'source_field_unresolved', `source.${field}`, `source.${field} must be resolved`);
      }
    }
  }

  if (expectedOk) {
    const summary = record.expected.summary50char;
    if (typeof summary !== 'string' || summary.trim().length === 0) {
      addViolation(violations, filePath, 'summary50char_missing', 'expected.summary50char', 'expected.summary50char is required');
    } else if (charLength(summary) > SUMMARY_MAX_CHARS) {
      addViolation(
        violations,
        filePath,
        'summary50char_too_long',
        'expected.summary50char',
        `expected.summary50char must be <= ${SUMMARY_MAX_CHARS} chars`,
        { length: charLength(summary), max: SUMMARY_MAX_CHARS },
      );
    }

    if ('yongshinElement' in record.expected && !ALLOWED_ELEMENTS.has(record.expected.yongshinElement)) {
      addViolation(
        violations,
        filePath,
        'invalid_yongshin_element',
        'expected.yongshinElement',
        'expected.yongshinElement must be WOOD/FIRE/EARTH/METAL/WATER',
      );
    }

    if ('strengthLevel' in record.expected && !ALLOWED_STRENGTH_LEVELS.has(record.expected.strengthLevel)) {
      addViolation(
        violations,
        filePath,
        'invalid_strength_level',
        'expected.strengthLevel',
        'expected.strengthLevel must be 신강/신약/중화/극신강/극신약',
      );
    }
  }

  if (narrativeOk) {
    for (const field of NUMERIC_OR_NULL_NARRATIVE_FIELDS) {
      const value = record.narrative[field];
      if (value !== null && typeof value !== 'number') {
        addViolation(violations, filePath, 'invalid_narrative_metric', `narrative.${field}`, `${field} must be a number or null`);
      }
    }
  }

  if (hedgeOk) {
    if (typeof record.hedge.shouldHedge !== 'boolean') {
      addViolation(violations, filePath, 'invalid_hedge_flag', 'hedge.shouldHedge', 'hedge.shouldHedge must be boolean');
    } else if (record.hedge.shouldHedge && (typeof record.hedge.reason !== 'string' || record.hedge.reason.trim().length === 0)) {
      addViolation(violations, filePath, 'hedge_reason_missing', 'hedge.reason', 'hedge.reason is required when shouldHedge is true');
    }
  }

  if (sourceTierOk) {
    const eligible = record.sourceTier.authorityTruthEligible === true;
    for (const policyViolation of validateSourceTierRecord(record, {
      file: relPath(filePath),
      sourceTierPath: 'sourceTier',
      root: SPRING_TS_ROOT,
    })) {
      addViolation(
        violations,
        filePath,
        policyViolation.code,
        policyViolation.sourceTierPath ?? 'sourceTier',
        policyViolation.message,
      );
    }
    if (eligible && sourceOk && isUnresolved(record.source.page)) {
      addViolation(
        violations,
        filePath,
        'authority_page_unresolved',
        'source.page',
        'authority-truth records require a resolved source page',
      );
    }
  }

  if (!Array.isArray(record.copyrightNote) || record.copyrightNote.length === 0) {
    addViolation(violations, filePath, 'copyright_note_missing', 'copyrightNote', 'copyrightNote must be a non-empty array');
  }

  validateNoLongOriginalProse(record, violations, filePath);
  return violations;
}

function validateDirectory(dir, allowEmpty) {
  const files = readFlatJsonFiles(dir);
  const violations = [];
  const caseSummaries = [];
  let authorityTruthEligibleCaseCount = 0;

  if (files.length === 0 && !allowEmpty) {
    violations.push({
      file: relPath(dir),
      code: 'flat_case_files_missing',
      path: '$',
      message: 'at least one flat Reference A JSON file is required',
    });
  }

  for (const filePath of files) {
    try {
      const record = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const fileViolations = validateCase(record, filePath);
      violations.push(...fileViolations);
      if (
        fileViolations.length === 0 &&
        isAuthorityTruthEligible(record, { root: SPRING_TS_ROOT })
      ) {
        authorityTruthEligibleCaseCount += 1;
      }
      caseSummaries.push({
        file: relPath(filePath),
        caseId: typeof record?.case_id === 'string' ? record.case_id : null,
        authorityTruthEligible: record?.sourceTier?.authorityTruthEligible === true,
        violationCount: fileViolations.length,
      });
    } catch (err) {
      addViolation(violations, filePath, 'json_parse_failed', '$', err.message);
      caseSummaries.push({
        file: relPath(filePath),
        caseId: null,
        authorityTruthEligible: false,
        violationCount: 1,
      });
    }
  }

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    host: os.hostname(),
    directory: relPath(dir),
    flatCaseCount: files.length,
    authorityTruthEligibleCaseCount,
    allowEmpty,
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    violationCount: violations.length,
    violations,
    cases: caseSummaries,
  };
}

function printHuman(report) {
  console.log('Reference authority intake report');
  console.log(`  directory: ${report.directory}`);
  console.log(`  flat cases: ${report.flatCaseCount}`);
  console.log(`  authority-truth eligible cases: ${report.authorityTruthEligibleCaseCount}`);
  console.log(`  status: ${report.status}`);
  if (report.violations.length > 0) {
    console.log('\nViolations');
    for (const violation of report.violations) {
      console.log(`  - ${violation.file} ${violation.path}: ${violation.code} - ${violation.message}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv);
  const report = validateDirectory(args.dir, args.allowEmpty);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }

  if (report.violations.length > 0) {
    process.exit(1);
  }
}

export { DEFAULT_DIR, validateDirectory };
