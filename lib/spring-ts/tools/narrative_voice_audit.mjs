#!/usr/bin/env node
/**
 * tools/narrative_voice_audit.mjs
 *
 * Audits the tiered narrative corpus for voice separation:
 * - brief/standard text should stay jargon-free and tag-free.
 * - expert text should be anchored by glossary tag tokens.
 *
 * The optional --fix-plain-terms pass only rewrites plain-tier prose fields
 * with conservative everyday-language replacements. It does not touch expert
 * fragments or glossary definitions.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const NARRATIVE_ROOT = path.join(ROOT, 'data', 'narrative');

const PLAIN_DEPTHS = new Set(['brief', 'standard']);
const EXPERT_DEPTH = 'expert';
const SCANNED_PLAIN_KEYS = new Set(['templateTokens', 'slots', 'livingTips', 'cautions', 'hook']);

const PLAIN_TERM_RULES = [
  ['극신강', '기운이 매우 강한 상태'],
  ['극신약', '기운이 매우 약한 상태'],
  ['신강', '기운이 강한 상태'],
  ['신약', '기운이 약한 상태'],
  ['천을귀인', '도움을 받기 쉬운 흐름'],
  ['천덕귀인', '좋은 도움을 받기 쉬운 흐름'],
  ['월덕귀인', '차분한 도움을 받기 쉬운 흐름'],
  ['공망', '힘이 비기 쉬운 구간'],
  ['용신', '도움이 되는 기운'],
  ['희신', '힘을 보태는 기운'],
  ['기신', '주의해야 할 기운'],
  ['구신', '균형을 깨기 쉬운 기운'],
  ['일간', '타고난 중심 기운'],
  ['격국', '삶의 기본 패턴'],
  ['십성', '성향 흐름'],
  ['식상', '표현과 창의 흐름'],
  ['재성', '돈과 관계 흐름'],
  ['관성', '책임과 규칙 흐름'],
  ['인성', '배움과 회복 흐름'],
  ['비겁', '자기주도와 동료 흐름'],
  ['천간', '겉으로 드러나는 기운'],
  ['오행', '다섯 기운'],
  ['음양', '밝고 차분한 흐름'],
  ['신살', '주의 신호'],
  ['대운', '큰 시기 흐름'],
  ['세운', '한 해 흐름'],
  ['정관', '책임과 질서 흐름'],
  ['편관', '도전과 압박 흐름'],
  ['정인', '배움과 보호 흐름'],
  ['편인', '직관과 탐구 흐름'],
  ['상관', '새 해석과 표현 흐름'],
  ['식신', '꾸준한 표현 흐름'],
  ['비견', '자기 기준 흐름'],
  ['겁재', '경쟁과 나눔 흐름'],
];

const PLAIN_TERM_PATTERNS = PLAIN_TERM_RULES.map(([term, replacement]) => ({
  term,
  replacement,
  pattern: new RegExp(escapeRegExp(term), 'g'),
}));

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseArgs(argv) {
  const args = {
    json: false,
    fixPlainTerms: false,
    fixPlainTags: false,
    syncExpertTags: false,
    maxSamples: 20,
    maxPlainTermViolations: null,
    maxPlainTagViolations: null,
    maxExpertUntagged: null,
  };
  for (const arg of argv) {
    if (arg === '--json') {
      args.json = true;
    } else if (arg === '--fix-plain-terms') {
      args.fixPlainTerms = true;
    } else if (arg === '--fix-plain-tags') {
      args.fixPlainTags = true;
    } else if (arg === '--sync-expert-tags') {
      args.syncExpertTags = true;
    } else if (arg.startsWith('--max-samples=')) {
      const value = Number(arg.slice('--max-samples='.length));
      if (Number.isInteger(value) && value >= 0) args.maxSamples = value;
    } else if (arg.startsWith('--max-plain-term-violations=')) {
      const value = Number(arg.slice('--max-plain-term-violations='.length));
      if (Number.isInteger(value) && value >= 0) args.maxPlainTermViolations = value;
    } else if (arg.startsWith('--max-plain-tag-violations=')) {
      const value = Number(arg.slice('--max-plain-tag-violations='.length));
      if (Number.isInteger(value) && value >= 0) args.maxPlainTagViolations = value;
    } else if (arg.startsWith('--max-expert-untagged=')) {
      const value = Number(arg.slice('--max-expert-untagged='.length));
      if (Number.isInteger(value) && value >= 0) args.maxExpertUntagged = value;
    }
  }
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function listFragmentBundles(rootDir) {
  const out = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '_glossary' || entry.name === '_contract') continue;
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.fragments.json')) {
        out.push(full);
      }
    }
  }
  walk(rootDir);
  return out.sort((a, b) => a.localeCompare(b));
}

function collectPlainTextFields(fragment) {
  const fields = [];
  for (const token of fragment?.templateTokens ?? []) {
    if (token?.kind === 'text' && typeof token.value === 'string') {
      fields.push({ path: 'templateTokens[].value', value: token.value });
    }
  }
  for (const [slotName, values] of Object.entries(fragment?.slots ?? {})) {
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      if (typeof value === 'string') {
        fields.push({ path: `slots.${slotName}[]`, value });
      }
    }
  }
  for (const key of ['livingTips', 'cautions']) {
    for (const value of fragment?.[key] ?? []) {
      if (typeof value === 'string') fields.push({ path: `${key}[]`, value });
    }
  }
  if (typeof fragment?.hook === 'string') {
    fields.push({ path: 'hook', value: fragment.hook });
  }
  return fields;
}

function hasTagToken(fragment) {
  return (fragment?.templateTokens ?? []).some((token) => token?.kind === 'tag');
}

function countTagTokens(fragment) {
  return (fragment?.templateTokens ?? []).filter((token) => token?.kind === 'tag').length;
}

function collectTagTokenIds(fragment) {
  return [...new Set((fragment?.templateTokens ?? [])
    .filter((token) => token?.kind === 'tag' && typeof token.tagId === 'string' && token.tagId.length > 0)
    .map((token) => token.tagId))];
}

function replacePlainTerms(value) {
  let next = value;
  for (const { pattern, replacement } of PLAIN_TERM_PATTERNS) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

function fixPlainFragment(fragment) {
  let changed = false;
  if (Array.isArray(fragment?.templateTokens)) {
    for (const token of fragment.templateTokens) {
      if (token?.kind === 'text' && typeof token.value === 'string') {
        const next = replacePlainTerms(token.value);
        if (next !== token.value) {
          token.value = next;
          changed = true;
        }
      }
    }
  }
  if (fragment?.slots && typeof fragment.slots === 'object') {
    for (const [slotName, values] of Object.entries(fragment.slots)) {
      if (!Array.isArray(values)) continue;
      const nextValues = values.map((value) => typeof value === 'string' ? replacePlainTerms(value) : value);
      if (JSON.stringify(nextValues) !== JSON.stringify(values)) {
        fragment.slots[slotName] = nextValues;
        changed = true;
      }
    }
  }
  for (const key of ['livingTips', 'cautions']) {
    if (!Array.isArray(fragment?.[key])) continue;
    const nextValues = fragment[key].map((value) => typeof value === 'string' ? replacePlainTerms(value) : value);
    if (JSON.stringify(nextValues) !== JSON.stringify(fragment[key])) {
      fragment[key] = nextValues;
      changed = true;
    }
  }
  return changed;
}

function samplePush(samples, maxSamples, item) {
  if (samples.length < maxSamples) samples.push(item);
}

function buildVoiceAuditReport(options = {}) {
  const maxSamples = options.maxSamples ?? 20;
  const fixPlainTerms = options.fixPlainTerms === true;
  const fixPlainTags = options.fixPlainTags === true;
  const syncExpertTags = options.syncExpertTags === true;
  const bundles = listFragmentBundles(NARRATIVE_ROOT);

  const samples = {
    plainTermViolations: [],
    plainTagViolations: [],
    expertUntagged: [],
    fixedPlainFragments: [],
    fixedPlainTags: [],
    syncedExpertTags: [],
  };
  const termCounts = Object.fromEntries(PLAIN_TERM_RULES.map(([term]) => [term, 0]));
  const totals = {
    bundleCount: bundles.length,
    fragmentCount: 0,
    plainFragmentCount: 0,
    expertFragmentCount: 0,
    plainTermViolationCount: 0,
    plainTagViolationCount: 0,
    expertUntaggedCount: 0,
    fixedPlainFragmentCount: 0,
    fixedPlainTagFragmentCount: 0,
    syncedExpertTagFragmentCount: 0,
  };

  for (const file of bundles) {
    const rel = path.relative(ROOT, file).replaceAll(path.sep, '/');
    const bundle = readJson(file);
    let changed = false;

    for (const fragment of bundle.fragments ?? []) {
      totals.fragmentCount += 1;
      const depth = fragment?.axis?.depth;
      const id = String(fragment?.fragmentId ?? '');

      if (PLAIN_DEPTHS.has(depth)) {
        totals.plainFragmentCount += 1;
        for (const field of collectPlainTextFields(fragment)) {
          for (const { term, pattern } of PLAIN_TERM_PATTERNS) {
            pattern.lastIndex = 0;
            if (!pattern.test(field.value)) continue;
            const matches = field.value.match(pattern) ?? [];
            termCounts[term] += matches.length;
            totals.plainTermViolationCount += matches.length;
            samplePush(samples.plainTermViolations, maxSamples, {
              file: rel,
              fragmentId: id,
              depth,
              term,
              path: field.path,
              text: field.value,
            });
          }
        }
        const tagCount = countTagTokens(fragment);
        const mirroredTagCount = Array.isArray(fragment?.tags) ? fragment.tags.length : 0;
        if (tagCount > 0 || mirroredTagCount > 0) {
          const count = tagCount + mirroredTagCount;
          totals.plainTagViolationCount += count;
          samplePush(samples.plainTagViolations, maxSamples, {
            file: rel,
            fragmentId: id,
            depth,
            tagTokenCount: tagCount,
            mirroredTagCount,
          });
        }
        if (fixPlainTags && mirroredTagCount > 0) {
          fragment.tags = [];
          changed = true;
          totals.fixedPlainTagFragmentCount += 1;
          samplePush(samples.fixedPlainTags, maxSamples, {
            file: rel,
            fragmentId: id,
            depth,
            removedMirroredTagCount: mirroredTagCount,
          });
        }
        if (fixPlainTerms && fixPlainFragment(fragment)) {
          changed = true;
          totals.fixedPlainFragmentCount += 1;
          samplePush(samples.fixedPlainFragments, maxSamples, {
            file: rel,
            fragmentId: id,
            depth,
          });
        }
      } else if (depth === EXPERT_DEPTH) {
        totals.expertFragmentCount += 1;
        const tagIds = collectTagTokenIds(fragment);
        const tagCount = tagIds.length;
        const mirroredTagCount = Array.isArray(fragment?.tags) ? fragment.tags.length : 0;
        if (tagCount === 0 || mirroredTagCount === 0) {
          totals.expertUntaggedCount += 1;
          samplePush(samples.expertUntagged, maxSamples, {
            file: rel,
            fragmentId: id,
            tagTokenCount: tagCount,
            mirroredTagCount,
            text: collectPlainTextFields(fragment)
              .map((field) => field.value)
              .join(' ')
              .slice(0, 220),
          });
        }
        if (syncExpertTags && tagCount > 0) {
          const current = Array.isArray(fragment?.tags) ? fragment.tags : [];
          if (JSON.stringify(current) !== JSON.stringify(tagIds)) {
            fragment.tags = tagIds;
            changed = true;
            totals.syncedExpertTagFragmentCount += 1;
            samplePush(samples.syncedExpertTags, maxSamples, {
              file: rel,
              fragmentId: id,
              tagCount,
            });
          }
        }
      }
    }

    if (changed) {
      fs.writeFileSync(file, `${JSON.stringify(bundle, null, 2)}\n`);
    }
  }

  const activeTermCounts = Object.fromEntries(
    Object.entries(termCounts).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  );

  return {
    schemaVersion: 'spring-ts.narrative-voice-audit.v1',
    generatedAt: new Date().toISOString(),
    fixPlainTerms,
    fixPlainTags,
    syncExpertTags,
    scannedPlainKeys: [...SCANNED_PLAIN_KEYS],
    plainTerms: PLAIN_TERM_RULES.map(([term, replacement]) => ({ term, replacement })),
    totals,
    termCounts: activeTermCounts,
    samples,
  };
}

function getThresholdFailures(report, options = {}) {
  const failures = [];
  const checks = [
    ['plain term violations', report.totals.plainTermViolationCount, options.maxPlainTermViolations],
    ['plain tag violations', report.totals.plainTagViolationCount, options.maxPlainTagViolations],
    ['untagged expert fragments', report.totals.expertUntaggedCount, options.maxExpertUntagged],
  ];
  for (const [label, actual, threshold] of checks) {
    if (threshold !== null && threshold !== undefined && actual > threshold) {
      failures.push(`${label}: ${actual}/${threshold}`);
    }
  }
  return failures;
}

function renderHuman(report) {
  const lines = [];
  lines.push('Narrative Voice Audit');
  lines.push(`Bundles: ${report.totals.bundleCount}`);
  lines.push(`Fragments: ${report.totals.fragmentCount} total, ${report.totals.plainFragmentCount} plain, ${report.totals.expertFragmentCount} expert`);
  lines.push(`Plain term violations: ${report.totals.plainTermViolationCount}`);
  lines.push(`Plain tag violations: ${report.totals.plainTagViolationCount}`);
  lines.push(`Untagged expert fragments: ${report.totals.expertUntaggedCount}`);
  if (report.fixPlainTerms) {
    lines.push(`Fixed plain fragments: ${report.totals.fixedPlainFragmentCount}`);
  }
  if (report.fixPlainTags) {
    lines.push(`Fixed plain tag fragments: ${report.totals.fixedPlainTagFragmentCount}`);
  }
  if (report.syncExpertTags) {
    lines.push(`Synced expert tag fragments: ${report.totals.syncedExpertTagFragmentCount}`);
  }
  const termRows = Object.entries(report.termCounts);
  if (termRows.length > 0) {
    lines.push('');
    lines.push('Plain term counts:');
    for (const [term, count] of termRows) {
      lines.push(`- ${term}: ${count}`);
    }
  }
  for (const [label, rows] of [
    ['Plain term samples', report.samples.plainTermViolations],
    ['Plain tag samples', report.samples.plainTagViolations],
    ['Untagged expert samples', report.samples.expertUntagged],
    ['Fixed plain samples', report.samples.fixedPlainFragments],
    ['Fixed plain tag samples', report.samples.fixedPlainTags],
    ['Synced expert tag samples', report.samples.syncedExpertTags],
  ]) {
    if (rows.length === 0) continue;
    lines.push('');
    lines.push(`${label}:`);
    for (const row of rows) {
      lines.push(`- ${row.file}#${row.fragmentId}${row.term ? ` (${row.term})` : ''}`);
    }
  }
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const fixRequested = args.fixPlainTerms || args.fixPlainTags || args.syncExpertTags;
  const fixReport = buildVoiceAuditReport({
    maxSamples: args.maxSamples,
    fixPlainTerms: args.fixPlainTerms,
    fixPlainTags: args.fixPlainTags,
    syncExpertTags: args.syncExpertTags,
  });
  const report = fixRequested
    ? buildVoiceAuditReport({ maxSamples: args.maxSamples })
    : fixReport;
  if (fixRequested) {
    report.fixPlainTerms = fixReport.fixPlainTerms;
    report.fixPlainTags = fixReport.fixPlainTags;
    report.syncExpertTags = fixReport.syncExpertTags;
    report.totals.fixedPlainFragmentCount = fixReport.totals.fixedPlainFragmentCount;
    report.totals.fixedPlainTagFragmentCount = fixReport.totals.fixedPlainTagFragmentCount;
    report.totals.syncedExpertTagFragmentCount = fixReport.totals.syncedExpertTagFragmentCount;
    report.samples.fixedPlainFragments = fixReport.samples.fixedPlainFragments;
    report.samples.fixedPlainTags = fixReport.samples.fixedPlainTags;
    report.samples.syncedExpertTags = fixReport.samples.syncedExpertTags;
  }
  const failures = getThresholdFailures(report, {
    maxPlainTermViolations: args.maxPlainTermViolations,
    maxPlainTagViolations: args.maxPlainTagViolations,
    maxExpertUntagged: args.maxExpertUntagged,
  });
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderHuman(report));
  }
  if (failures.length > 0) {
    console.error(`Narrative voice audit failed:\n- ${failures.join('\n- ')}`);
    process.exit(1);
  }
}

export {
  buildVoiceAuditReport,
  getThresholdFailures,
  renderHuman,
};
