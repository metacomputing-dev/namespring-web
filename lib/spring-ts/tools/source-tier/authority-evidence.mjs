import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  canonicalPolicyValue,
  digestFile,
  hasApprovedAuthorityReview,
  nonEmptyString,
  pathIsWithin,
  violation,
} from './policy-core.mjs';

export const PANEL_ADJUDICATED_SOURCE_TYPE = 'ai_panel_adjudicated_interpretation';

export const AUTHORITY_SCOPES = Object.freeze({
  SAJU_DOCTRINE: 'saju_doctrine',
  NAMING_SCORE_CALIBRATION: 'naming_score_calibration',
  PRODUCT_SURFACE_CONTRACT: 'product_surface_contract',
  SAFETY_COPY_POLICY: 'safety_copy_policy',
  NARRATIVE_SEMANTIC_CONTRACT: 'narrative_semantic_contract',
  SOURCE_REGISTRY: 'source_registry',
  NAMING_DATA: 'naming_data',
  CALENDAR_FACT: 'calendar_fact',
  PHONETIC_DATA: 'phonetic_data',
  LEGAL_NAME_DATA: 'legal_name_data',
  OFFICIAL_CATALOG: 'official_catalog',
  HANJA_DATA: 'hanja_data',
});

export const PANEL_AUTHORITY_SCOPES = Object.freeze([
  AUTHORITY_SCOPES.SAJU_DOCTRINE,
]);
const PANEL_AUTHORITY_SCOPE_SET = new Set(PANEL_AUTHORITY_SCOPES);

export function isPanelAuthorityScope(scope) {
  return PANEL_AUTHORITY_SCOPE_SET.has(scope);
}

const YONGSHIN_ELEMENTS = new Set(['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER']);

export function invalidDoctrineExpectedFields(expected) {
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) {
    return ['expected'];
  }
  const invalid = [];
  for (const [field, value] of Object.entries(expected)) {
    if (
      (field === 'gyeokguk' || field === 'strengthLevel') &&
      !nonEmptyString(value)
    ) {
      invalid.push(field);
    } else if (
      field === 'yongshinElement' &&
      (!nonEmptyString(value) || !YONGSHIN_ELEMENTS.has(value))
    ) {
      invalid.push(field);
    }
  }
  return invalid;
}

const FORCED_NON_AUTHORITY_SOURCE_TYPES = new Set([
  'training_derived',
  'reference_implementation',
  'internal_oracle_policy',
  'internal_rule_policy',
  'internal_scoring_policy',
]);

const AUTHORITY_SOURCE_TYPES_BY_TIER = new Map([
  ['T4_PRIMARY_TEXT', new Set([
    'classical_primary_text',
    'classical_primary_text_registry',
  ])],
  ['T5_OFFICIAL', new Set([
    'official_court_lookup',
    'official_court_statistics',
    'official_court_statistics_guide',
    'official_kosis_statistics',
    'official_kasi_lunar_solar_api',
    'official_kasi_lunar_solar_api_registry',
    'official_kasi_lunisolar_calendar_table',
    'official_kasi_solar_term_api',
    'official_kasi_special_day_api_registry',
    'official_korean_pronunciation_rule',
    'official_law_attachment',
    'official_law_registry',
    'official_press_release',
    'official_public_data_catalog',
    'unicode_standard_annex',
    'unicode_standard_hangul_algorithm',
    'unicode_ucd',
  ])],
]);

const OFFICIAL_SOURCE_DOMAINS = new Map([
  ['official_court_lookup', ['efamily.scourt.go.kr']],
  ['official_court_statistics', ['scourt.go.kr']],
  ['official_court_statistics_guide', ['scourt.go.kr']],
  ['official_kosis_statistics', ['kosis.kr']],
  ['official_kasi_lunar_solar_api', ['data.go.kr', 'kasi.re.kr']],
  ['official_kasi_lunar_solar_api_registry', ['data.go.kr', 'kasi.re.kr']],
  ['official_kasi_lunisolar_calendar_table', ['kasi.re.kr']],
  ['official_kasi_solar_term_api', ['data.go.kr', 'kasi.re.kr']],
  ['official_kasi_special_day_api_registry', ['data.go.kr', 'kasi.re.kr']],
  ['official_korean_pronunciation_rule', ['korean.go.kr']],
  ['official_law_attachment', ['law.go.kr']],
  ['official_law_registry', ['law.go.kr']],
  ['official_press_release', ['scourt.go.kr']],
  ['official_public_data_catalog', ['data.go.kr']],
  ['unicode_standard_annex', ['unicode.org']],
  ['unicode_standard_hangul_algorithm', ['unicode.org']],
  ['unicode_ucd', ['unicode.org']],
]);

const AUTHORITY_SCOPES_BY_SOURCE_TYPE = new Map([
  ['classical_primary_text', [AUTHORITY_SCOPES.SAJU_DOCTRINE]],
  ['classical_primary_text_registry', [AUTHORITY_SCOPES.SOURCE_REGISTRY]],
  ['official_court_lookup', [AUTHORITY_SCOPES.LEGAL_NAME_DATA]],
  ['official_court_statistics', [AUTHORITY_SCOPES.NAMING_DATA]],
  ['official_court_statistics_guide', [AUTHORITY_SCOPES.NAMING_DATA]],
  ['official_kosis_statistics', [AUTHORITY_SCOPES.NAMING_DATA]],
  ['official_kasi_lunar_solar_api', [AUTHORITY_SCOPES.CALENDAR_FACT]],
  ['official_kasi_lunar_solar_api_registry', [AUTHORITY_SCOPES.CALENDAR_FACT]],
  ['official_kasi_lunisolar_calendar_table', [AUTHORITY_SCOPES.CALENDAR_FACT]],
  ['official_kasi_solar_term_api', [AUTHORITY_SCOPES.CALENDAR_FACT]],
  ['official_kasi_special_day_api_registry', [AUTHORITY_SCOPES.CALENDAR_FACT]],
  ['official_korean_pronunciation_rule', [AUTHORITY_SCOPES.PHONETIC_DATA]],
  ['official_law_attachment', [AUTHORITY_SCOPES.LEGAL_NAME_DATA]],
  ['official_law_registry', [AUTHORITY_SCOPES.LEGAL_NAME_DATA]],
  ['official_press_release', [AUTHORITY_SCOPES.LEGAL_NAME_DATA]],
  ['official_public_data_catalog', [AUTHORITY_SCOPES.OFFICIAL_CATALOG]],
  ['unicode_standard_annex', [AUTHORITY_SCOPES.HANJA_DATA]],
  ['unicode_standard_hangul_algorithm', [AUTHORITY_SCOPES.PHONETIC_DATA]],
  ['unicode_ucd', [AUTHORITY_SCOPES.HANJA_DATA]],
]);

export function isForcedNonAuthoritySourceType(sourceType) {
  const canonical = canonicalPolicyValue(sourceType);
  return FORCED_NON_AUTHORITY_SOURCE_TYPES.has(canonical) ||
    /^internal(?:_[a-z0-9]+)*_policy$/.test(canonical);
}

export function isApprovedAuthoritySourceType(sourceTier) {
  const allowed = AUTHORITY_SOURCE_TYPES_BY_TIER.get(sourceTier?.tier);
  return Boolean(allowed?.has(sourceTier?.sourceType));
}

export function authorityScopesForRecord(record) {
  const sourceTier = record?.sourceTier;
  if (sourceTier?.sourceType === PANEL_ADJUDICATED_SOURCE_TYPE) {
    const scopes = sourceTier?.panelAdjudication?.scopes;
    return Array.isArray(scopes)
      ? [...new Set(scopes.filter(isPanelAuthorityScope))].sort()
      : [];
  }
  return [...(AUTHORITY_SCOPES_BY_SOURCE_TYPE.get(sourceTier?.sourceType) ?? [])];
}

function urlMatchesDomains(value, allowedDomains) {
  if (typeof value !== 'string' || !Array.isArray(allowedDomains)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && allowedDomains.some((domain) =>
      url.hostname === domain || url.hostname.endsWith('.' + domain));
  } catch {
    return false;
  }
}

function isGitTrackedFile(rootPath, filePath) {
  const relativePath = path.relative(rootPath, filePath);
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.startsWith('..')) {
    return false;
  }
  const result = spawnSync(
    'git',
    ['-C', rootPath, 'ls-files', '--error-unmatch', '--', relativePath],
    { stdio: 'ignore', windowsHide: true },
  );
  return !result.error && result.status === 0;
}

function resolveTrackedEvidenceFile(root, relativeInput, expectedDigest) {
  if (
    !root ||
    !nonEmptyString(relativeInput) ||
    !/^sha256:[a-f0-9]{64}$/.test(expectedDigest ?? '')
  ) {
    return null;
  }
  try {
    const rootPath = path.resolve(root);
    const input = relativeInput.trim();
    if (path.isAbsolute(input)) return null;
    const candidate = path.resolve(rootPath, input);
    const candidateRelative = path.relative(rootPath, candidate);
    const rootReal = fs.realpathSync(rootPath);
    const fileReal = fs.realpathSync(candidate);
    const relativeReal = path.relative(rootReal, fileReal);
    const hasTemporarySegment = [candidateRelative, relativeReal].some((relativePath) => relativePath
      .split(path.sep)
      .some((segment) => ['.tmp', 'tmp'].includes(segment.toLowerCase())));
    if (
      !pathIsWithin(rootReal, fileReal) ||
      !pathIsWithin(rootPath, candidate) ||
      relativeReal === '' ||
      hasTemporarySegment ||
      !fs.lstatSync(candidate).isFile() ||
      digestFile(fileReal) !== expectedDigest ||
      !isGitTrackedFile(rootPath, candidate)
    ) {
      return null;
    }
    return fileReal;
  } catch {
    return null;
  }
}

export function validateAuthorityEvidenceContract(record, sourceTier, {
  file,
  sourceTierPath,
  root,
}) {
  const violations = [];
  const add = (code, message, extra = {}) => {
    violations.push(violation(file, sourceTierPath, code, message, extra));
  };
  if (sourceTier.sourceType === 'classical_primary_text') {
    const missing = [];
    const allowedTopLevel = new Set([
      'case_id',
      'source',
      'subject',
      'pillars',
      'expected',
      'prose_quote',
      'evidenceBindings',
      'copyrightNote',
      'sourceTier',
    ]);
    const unknownTopLevel = Object.keys(record ?? {})
      .filter((key) => !allowedTopLevel.has(key));
    const allowedSourceFields = new Set([
      'tradition',
      'text',
      'author',
      'edition',
      'page_in_compilation',
      'compilation',
      'category',
    ]);
    const unknownSourceFields = Object.keys(record?.source ?? {})
      .filter((key) => !allowedSourceFields.has(key));
    const allowedExpectedFields = new Set([
      'gyeokguk',
      'strengthLevel',
      'yongshinElement',
    ]);
    const unknownExpectedFields =
      record?.expected && typeof record.expected === 'object' && !Array.isArray(record.expected)
        ? Object.keys(record.expected).filter((key) => !allowedExpectedFields.has(key))
        : [];
    const invalidExpectedFields = invalidDoctrineExpectedFields(record?.expected);
    const allowedSubjectFields = new Set(['name_hanja', 'name_korean']);
    const unknownSubjectFields = Object.keys(record?.subject ?? {})
      .filter((key) => !allowedSubjectFields.has(key));
    const allowedPillarFields = new Set([
      'year_pillar',
      'month_pillar',
      'day_pillar',
      'hour_pillar',
    ]);
    const unknownPillarFields = Object.keys(record?.pillars ?? {})
      .filter((key) => !allowedPillarFields.has(key));
    const allowedProseFields = new Set([
      'verbatim',
      'extracted_from',
      'page_image',
      'page_image_sha256',
      'transcript_file',
      'transcript_sha256',
    ]);
    const unknownProseFields = Object.keys(record?.prose_quote ?? {})
      .filter((key) => !allowedProseFields.has(key));
    const expectedKeys = record?.expected &&
      typeof record.expected === 'object' &&
      !Array.isArray(record.expected)
      ? Object.keys(record.expected)
      : [];
    const evidenceBindings = Array.isArray(record?.evidenceBindings)
      ? record.evidenceBindings
      : [];
    const bindingFields = evidenceBindings
      .map((binding) => binding?.field)
      .filter((field) => typeof field === 'string');
    const invalidEvidenceBindings =
      expectedKeys.length === 0 ||
      !Array.isArray(record?.evidenceBindings) ||
      evidenceBindings.length !== expectedKeys.length ||
      new Set(bindingFields).size !== bindingFields.length ||
      evidenceBindings.some((binding) =>
        !binding ||
        typeof binding !== 'object' ||
        Array.isArray(binding) ||
        Object.keys(binding).some((key) =>
          !['field', 'quoteFragment', 'interpretation'].includes(key)) ||
        !expectedKeys.includes(String(binding.field ?? '').replace(/^expected\./, '')) ||
        binding.field !== 'expected.' + String(binding.field ?? '').replace(/^expected\./, '') ||
        !nonEmptyString(binding.quoteFragment) ||
        [...binding.quoteFragment].length > 80 ||
        !nonEmptyString(binding.interpretation) ||
        !String(record?.prose_quote?.verbatim ?? '').includes(binding.quoteFragment)) ||
      expectedKeys.some((key) => !bindingFields.includes('expected.' + key));
    if (
      unknownTopLevel.length > 0 ||
      unknownSourceFields.length > 0 ||
      unknownExpectedFields.length > 0 ||
      invalidExpectedFields.length > 0 ||
      unknownSubjectFields.length > 0 ||
      unknownPillarFields.length > 0 ||
      unknownProseFields.length > 0 ||
      invalidEvidenceBindings
    ) {
      add(
        'unsupported_primary_text_authority_field',
        'T4 classical authority record contains fields outside the reviewed evidence schema',
        {
          topLevel: unknownTopLevel,
          source: unknownSourceFields,
          expected: unknownExpectedFields,
          invalidExpectedValues: invalidExpectedFields,
          subject: unknownSubjectFields,
          pillars: unknownPillarFields,
          proseQuote: unknownProseFields,
          invalidEvidenceBindings,
        },
      );
    }
    if (invalidExpectedFields.length > 0) {
      add(
        'invalid_primary_text_expected_value',
        'T4 doctrine expected values must use non-empty normalized strings and a known element code',
        { fields: invalidExpectedFields },
      );
    }
    if (!nonEmptyString(record?.case_id)) missing.push('case_id');
    if (!hasApprovedAuthorityReview(sourceTier)) missing.push('approved authorityReview');
    if (!nonEmptyString(record?.source?.text)) missing.push('source.text');
    if (!nonEmptyString(record?.source?.author)) missing.push('source.author');
    if (!nonEmptyString(record?.source?.compilation)) missing.push('source.compilation');
    if (!Number.isInteger(record?.source?.page_in_compilation) ||
        record.source.page_in_compilation <= 0) {
      missing.push('source.page_in_compilation');
    }
    const quote = record?.prose_quote?.verbatim;
    if (!nonEmptyString(quote) || [...quote].length > 80) missing.push('prose_quote.verbatim<=80');
    if (!nonEmptyString(record?.prose_quote?.extracted_from)) {
      missing.push('prose_quote.extracted_from');
    }
    if (!nonEmptyString(record?.prose_quote?.page_image)) {
      missing.push('prose_quote.page_image');
    }
    if (!nonEmptyString(record?.prose_quote?.transcript_file)) {
      missing.push('prose_quote.transcript_file');
    }
    const pageEvidence = resolveTrackedEvidenceFile(
      root,
      record?.prose_quote?.page_image,
      record?.prose_quote?.page_image_sha256,
    );
    const transcriptEvidence = resolveTrackedEvidenceFile(
      root,
      record?.prose_quote?.transcript_file,
      record?.prose_quote?.transcript_sha256,
    );
    const transcriptContainsQuote = Boolean(
      transcriptEvidence &&
      nonEmptyString(quote) &&
      fs.readFileSync(transcriptEvidence, 'utf8').includes(quote),
    );
    const evidenceFilesAreDistinct = Boolean(
      pageEvidence &&
      transcriptEvidence &&
      pageEvidence !== transcriptEvidence &&
      record?.prose_quote?.page_image_sha256 !== record?.prose_quote?.transcript_sha256,
    );
    if (sourceTier.quoteShort !== quote) {
      missing.push('sourceTier.quoteShort equal to prose_quote.verbatim');
    }
    if (!pageEvidence) {
      missing.push('git-tracked repository page evidence+sha256');
    }
    if (!transcriptContainsQuote) {
      missing.push('git-tracked transcript+sha256 containing prose_quote.verbatim');
    }
    if (!evidenceFilesAreDistinct) {
      missing.push('distinct page and transcript evidence files+digests');
    }
    if (missing.length > 0) {
      add(
        'incomplete_primary_text_evidence',
        'T4 classical authority requires a case-bound quote, page provenance, and bound transcript',
        { missing },
      );
    }
  } else if (sourceTier.sourceType === 'classical_primary_text_registry') {
    const hasTruthPayload = AUTHORITY_TRUTH_PAYLOAD_ROOTS.some((rootPath) => {
      const key = rootPath.slice(2);
      return record?.[key] !== undefined;
    });
    if (
      !nonEmptyString(record?.id) ||
      !urlMatchesDomains(sourceTier.sourceUrl, ['wikisource.org']) ||
      record?.usageLimit?.noBulkCopy !== true ||
      !Number.isInteger(record?.usageLimit?.maxQuoteChars) ||
      record.usageLimit.maxQuoteChars < 1 ||
      record.usageLimit.maxQuoteChars > 80 ||
      hasTruthPayload
    ) {
      add(
        'invalid_primary_text_registry_evidence',
        'T4 registry authority requires a Wikisource row, short-quote policy, and no truth payload',
      );
    }
  } else if (sourceTier.tier === 'T5_OFFICIAL') {
    const allowedDomains = OFFICIAL_SOURCE_DOMAINS.get(sourceTier.sourceType);
    if (!urlMatchesDomains(sourceTier.sourceUrl, allowedDomains)) {
      add(
        'invalid_official_source_domain',
        'T5 official authority sourceUrl does not match the reviewed domain contract',
      );
    }
    const expectedKeys =
      record?.expected && typeof record.expected === 'object' && !Array.isArray(record.expected)
        ? Object.keys(record.expected)
        : [];
    const hasSajuInterpretationPayload =
      expectedKeys.some((key) => [
        'gyeokguk',
        'gyeokgukType',
        'scores',
        'strengthLevel',
        'totalScore',
        'yongshin',
        'yongshinElement',
      ].includes(key)) ||
      record?.narrativeClaims !== undefined ||
      record?.cards !== undefined ||
      record?.hedgePolicy !== undefined;
    if (hasSajuInterpretationPayload) {
      add(
        'authority_scope_mismatch',
        'T5 official data sources cannot be promoted to saju-interpretation truth',
      );
    }
  }
  return violations;
}

export const AUTHORITY_TRUTH_PAYLOAD_ROOTS = Object.freeze([
    '$.expected',
    '$.narrativeClaims',
    '$.cards',
    '$.hedgePolicy',
]);
