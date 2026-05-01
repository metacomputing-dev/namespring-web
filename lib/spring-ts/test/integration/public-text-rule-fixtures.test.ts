/**
 * test/integration/public-text-rule-fixtures.test.ts
 *
 * Verifies Phase 7.3 public classical rule snippets and feature mappings.
 *
 * Run: npm run test:public-text-rule-fixtures
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const SNIPPET_PATH = 'test/baseline/authority/classical/public_text_rule_snippets.json';

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

function readJson<T = any>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(SPRING_TS_ROOT, relativePath), 'utf-8')) as T;
}

function collectRiskyFieldPaths(value: unknown, currentPath = '$'): string[] {
  const riskyFields = new Set(['rawtext', 'ocrtext', 'sourcetext', 'chaptertext', 'fulltext', 'translation']);
  const paths: string[] = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => paths.push(...collectRiskyFieldPaths(item, `${currentPath}[${index}]`)));
    return paths;
  }

  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const nextPath = `${currentPath}.${key}`;
      if (riskyFields.has(key.toLowerCase())) paths.push(nextPath);
      paths.push(...collectRiskyFieldPaths(item, nextPath));
    }
  }

  return paths;
}

function quoteLength(value: string): number {
  return Array.from(value).length;
}

console.log('Phase 7.3 public text rule snippets\n');

const fixture = readJson(SNIPPET_PATH);
const schema = readJson('test/baseline/schema/publicTextRuleExtraction.schema.json');
const sourceRegistry = readJson('data/sources/classical-myeongri.sources.json');
const vocabulary = readJson('data/classical-vocabulary/classical-myeongri-vocabulary.json');
const registeredSourceIds = new Set((sourceRegistry.sources ?? []).map((source: any) => source.id));
const vocabularyTermIds = new Set((vocabulary.entries ?? []).map((entry: any) => entry.termId));
const snippets = Array.isArray(fixture.snippets) ? fixture.snippets : [];
const ids = snippets.map((snippet: any) => snippet.id);
const uniqueIds = new Set(ids);
const groups = new Set(snippets.map((snippet: any) => snippet.group));

check('schema file describes the public text rule version',
  schema.properties?.schemaVersion?.const === 'spring-ts.public-text-rule-extraction.v1');
check('fixture uses expected schemaVersion',
  fixture.schemaVersion === 'spring-ts.public-text-rule-extraction.v1');
check('fixture links Phase 7.1 registry and Phase 7.2 vocabulary',
  fixture.sourceRegistry === 'data/sources/classical-myeongri.sources.json' &&
    fixture.vocabularyDictionary === 'data/classical-vocabulary/classical-myeongri-vocabulary.json');
check('top-level fixture is source evidence, not a case-truth denominator',
  fixture.sourceTier?.tier === 'T4_PRIMARY_TEXT' &&
    fixture.sourceTier?.sourceType === 'classical_public_rule_snippet_fixture' &&
    fixture.sourceTier?.authorityTruthEligible === false);
check('usage policy forbids bulk copied source text',
  fixture.usagePolicy?.noBulkCopy === true &&
    fixture.usagePolicy?.maxQuoteChars === 80 &&
    fixture.usagePolicy?.prohibited?.includes('bulk OCR text') &&
    fixture.usagePolicy?.prohibited?.includes('chapter copy'));
check('snippet IDs are stable and unique',
  uniqueIds.size === ids.length && ids.every((id: string) => /^[a-z0-9_]+$/.test(id)),
  `snippets=${ids.length}, unique=${uniqueIds.size}`);
check('snippets cover all PR-7.3 rule groups',
  ['stemTransparency', 'seasonalCommand', 'specialFrame', 'usefulGodConflict']
    .every((group) => groups.has(group)),
  `groups=${Array.from(groups).sort().join(',')}`);
check('every snippet points at a registered public source',
  snippets.every((snippet: any) => registeredSourceIds.has(snippet.sourceId)),
  `registered=${Array.from(registeredSourceIds).sort().join(',')}`);
check('every snippet sourceTier mirrors its source and quote',
  snippets.every((snippet: any) =>
    snippet.sourceTier?.tier === 'T4_PRIMARY_TEXT' &&
      snippet.sourceTier?.sourceType === 'classical_public_rule_snippet' &&
      snippet.sourceTier?.authorityTruthEligible === false &&
      snippet.sourceTier?.quoteShort === snippet.quoteShort &&
      typeof snippet.sourceTier?.sourceUrl === 'string' &&
      snippet.sourceTier.sourceUrl.startsWith('https://zh.wikisource.org/')));
check('every quoteShort is short enough for classical source policy',
  snippets.every((snippet: any) =>
    typeof snippet.quoteShort === 'string' &&
      quoteLength(snippet.quoteShort) > 0 &&
      quoteLength(snippet.quoteShort) <= 80),
  `max=${Math.max(...snippets.map((snippet: any) => quoteLength(snippet.quoteShort ?? '')))}`);
check('every snippet maps to an engine feature anchor',
  snippets.every((snippet: any) =>
    typeof snippet.feature?.surface === 'string' &&
      snippet.feature.surface.length > 0 &&
      typeof snippet.feature?.fieldPath === 'string' &&
      snippet.feature.fieldPath.length > 0 &&
      typeof snippet.feature?.code === 'string' &&
      snippet.feature.code.length > 0 &&
      typeof snippet.feature?.engineRef === 'string' &&
      snippet.feature.engineRef.length > 0));
check('every vocabulary link resolves against the dictionary',
  snippets.every((snippet: any) =>
    Array.isArray(snippet.linkedVocabularyTermIds) &&
      snippet.linkedVocabularyTermIds.length > 0 &&
      snippet.linkedVocabularyTermIds.every((termId: string) => vocabularyTermIds.has(termId))));
check('stem transparency snippets map to composite feature name',
  snippets
    .filter((snippet: any) => snippet.group === 'stemTransparency')
    .every((snippet: any) =>
      snippet.feature.fieldPath === 'sajuReport.gyeokguk.compositeClassical.features[].name' &&
        snippet.feature.code === 'stemTransparency'));
check('seasonal command snippets map to composite feature name',
  snippets
    .filter((snippet: any) => snippet.group === 'seasonalCommand')
    .every((snippet: any) =>
      snippet.feature.fieldPath === 'sajuReport.gyeokguk.compositeClassical.features[].name' &&
        snippet.feature.code === 'seasonalCommand'));
check('special frame snippets map to jonggyeok candidate features',
  snippets
    .filter((snippet: any) => snippet.group === 'specialFrame')
    .every((snippet: any) =>
      snippet.feature.fieldPath === 'sajuReport.gyeokguk.jonggyeokCandidates[].subtype' &&
        typeof snippet.feature.scoreKey === 'string' &&
        snippet.feature.scoreKey.startsWith('gyeokguk.')));
check('useful-god conflict snippets map to yongshin or remedy features',
  snippets
    .filter((snippet: any) => snippet.group === 'usefulGodConflict')
    .every((snippet: any) =>
      ['GISIN', 'usefulGodAlignment', 'TONGGUAN'].includes(snippet.feature.code)));
check('fixture stores no risky copied-text fields',
  collectRiskyFieldPaths(fixture).length === 0);

const qualityGateJson = JSON.parse(execSync('node tools/quality_gate.mjs --json', {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
  stdio: ['ignore', 'pipe', 'pipe'],
}));
check('quality gate source-tier audit includes snippet rows and passes',
  qualityGateJson.sourceTierAudit?.status === 'PASS' &&
    qualityGateJson.sourceTierAudit?.scanned >= 96,
  `scanned=${qualityGateJson.sourceTierAudit?.scanned}`);

console.log(`\nPublic text rule snippets: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
