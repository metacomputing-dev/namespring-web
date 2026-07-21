import fs from 'node:fs';
import path from 'node:path';

import {
  shouldAuditEvidenceDirectory,
  validateSourceTierRecord,
} from '../source_tier_policy.mjs';

export const DEFAULT_CLASSICAL_QUOTE_MAX_CHARS = 80;

function walkJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && shouldAuditEvidenceDirectory(entry.name)) {
      files.push(...walkJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

function relativePath(root, filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, '/');
}

function validateSourceTierObject(root, record, sourceTier, filePath, sourceTierPath = 'sourceTier') {
  const file = relativePath(root, filePath);
  return validateSourceTierRecord(record, {
    sourceTier,
    file,
    sourceTierPath,
    root,
  });
}

function isClassicalQuoteContext(root, record, filePath, sourceTier) {
  const file = relativePath(root, filePath);
  return file.startsWith('test/baseline/authority/jonheom/') ||
    file.startsWith('test/baseline/authority/classical/') ||
    record?.source?.tradition === 'classical' ||
    record?.tradition === 'classical' ||
    (
      typeof sourceTier?.sourceType === 'string' &&
      sourceTier.sourceType.startsWith('classical_')
    );
}

function validateClassicalQuote(root, quote, filePath, quotePath, classicalQuoteMaxChars) {
  if (typeof quote !== 'string') return [];
  const length = [...quote].length;
  if (length <= classicalQuoteMaxChars) return [];
  return [{
    file: relativePath(root, filePath),
    quotePath,
    code: 'classical_quote_too_long',
    limit: classicalQuoteMaxChars,
    length,
    message: `${quotePath} must be <= ${classicalQuoteMaxChars} characters for classical source fixtures`,
  }];
}

function collectRecordQuoteViolations(
  root,
  record,
  filePath,
  classicalQuoteMaxChars,
  recordPath = '',
  inheritedSourceTier = null,
) {
  const sourceTier = record?.sourceTier ?? inheritedSourceTier;
  if (!isClassicalQuoteContext(root, record, filePath, sourceTier)) return [];

  const violations = [];
  const prefix = recordPath ? `${recordPath}.` : '';
  if (record?.sourceTier) {
    violations.push(...validateClassicalQuote(
      root,
      record.sourceTier.quoteShort,
      filePath,
      `${prefix}sourceTier.quoteShort`,
      classicalQuoteMaxChars,
    ));
  }

  const proseQuote = record?.prose_quote;
  if (typeof proseQuote === 'string') {
    violations.push(...validateClassicalQuote(
      root,
      proseQuote,
      filePath,
      `${prefix}prose_quote`,
      classicalQuoteMaxChars,
    ));
  } else if (proseQuote && typeof proseQuote === 'object' && !Array.isArray(proseQuote)) {
    violations.push(...validateClassicalQuote(
      root,
      proseQuote.verbatim,
      filePath,
      `${prefix}prose_quote.verbatim`,
      classicalQuoteMaxChars,
    ));
  }

  if (Array.isArray(record?.prose_quotes)) {
    record.prose_quotes.forEach((item, index) => {
      if (typeof item === 'string') {
        violations.push(...validateClassicalQuote(
          root,
          item,
          filePath,
          `${prefix}prose_quotes[${index}]`,
          classicalQuoteMaxChars,
        ));
      } else if (item && typeof item === 'object') {
        violations.push(...validateClassicalQuote(
          root,
          item.quote,
          filePath,
          `${prefix}prose_quotes[${index}].quote`,
          classicalQuoteMaxChars,
        ));
      }
    });
  }
  return violations;
}

function auditClassicalQuoteLengths(root, data, filePath, classicalQuoteMaxChars) {
  const violations = collectRecordQuoteViolations(
    root,
    data,
    filePath,
    classicalQuoteMaxChars,
  );
  if (Array.isArray(data?.sources)) {
    data.sources.forEach((source, index) => {
      violations.push(...collectRecordQuoteViolations(
        root,
        source,
        filePath,
        classicalQuoteMaxChars,
        `sources[${index}]`,
        data?.sourceTier,
      ));
    });
  }
  if (Array.isArray(data?.cases)) {
    data.cases.forEach((record, index) => {
      violations.push(...collectRecordQuoteViolations(
        root,
        record,
        filePath,
        classicalQuoteMaxChars,
        `cases[${index}]`,
        data?.sourceTier,
      ));
    });
  }
  if (Array.isArray(data?.snippets)) {
    data.snippets.forEach((record, index) => {
      violations.push(...collectRecordQuoteViolations(
        root,
        record,
        filePath,
        classicalQuoteMaxChars,
        `snippets[${index}]`,
        data?.sourceTier,
      ));
    });
  }
  return violations;
}

function collectSourceTierRefs(data) {
  const topLevelSourceTier = data?.sourceTier ?? data?._meta?.sourceTier;
  const refs = [{
    record: data,
    sourceTier: topLevelSourceTier,
    sourceTierPath: data?.sourceTier ? 'sourceTier' : '_meta.sourceTier',
  }];
  if (Array.isArray(data?.sources)) {
    data.sources.forEach((source, index) => {
      refs.push({
        record: source,
        sourceTier: source?.sourceTier,
        sourceTierPath: `sources[${index}].sourceTier`,
      });
    });
  }
  if (Array.isArray(data?.snippets)) {
    data.snippets.forEach((snippet, index) => {
      refs.push({
        record: snippet,
        sourceTier: snippet?.sourceTier,
        sourceTierPath: `snippets[${index}].sourceTier`,
      });
    });
  }
  if (Array.isArray(data?.cases)) {
    data.cases.forEach((record, index) => {
      if (!record || typeof record !== 'object' || !('sourceTier' in record)) return;
      refs.push({
        record,
        sourceTier: record?.sourceTier,
        sourceTierPath: `cases[${index}].sourceTier`,
      });
    });
  }
  return refs;
}

export function auditSourceTierEvidence({
  root,
  evidenceDirs,
  extraJsonFiles = [],
  classicalQuoteMaxChars = DEFAULT_CLASSICAL_QUOTE_MAX_CHARS,
}) {
  const files = [
    ...evidenceDirs.flatMap((dir) => walkJsonFiles(dir)),
    ...extraJsonFiles.filter((filePath) => fs.existsSync(filePath)),
  ];

  const violations = [];
  let scanned = 0;
  for (const filePath of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      violations.push({
        file: relativePath(root, filePath),
        code: 'invalid_json',
        message: err.message,
      });
      continue;
    }
    const sourceTierRefs = collectSourceTierRefs(data);
    scanned += sourceTierRefs.length;
    for (const ref of sourceTierRefs) {
      violations.push(...validateSourceTierObject(
        root,
        ref.record,
        ref.sourceTier,
        filePath,
        ref.sourceTierPath,
      ));
    }
    violations.push(...auditClassicalQuoteLengths(
      root,
      data,
      filePath,
      classicalQuoteMaxChars,
    ));
  }

  return {
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    scanned,
    violations,
  };
}
