/**
 * article-quality-gate.ts -- Machine-checkable rules from ARTICLE_STYLE_CONTRACT.md
 *
 * Validates every bundle under data/articles/** against the authoring
 * contract: schema, coverage completeness, length budgets, vocabulary caps,
 * banned phrases, register (해요체), slot/tag grammar, and cross-article
 * duplicate sentences. Any violation fails the gate (exit 1).
 *
 * Run: npx tsx tools/article-quality-gate.ts [--summary]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(SPRING_TS_ROOT, 'data', 'articles');
const GLOSSARY_DIR = path.join(SPRING_TS_ROOT, 'data', 'narrative', '_glossary');

const CATEGORIES = [
  'overall', 'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
] as const;
const PERIODS = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'] as const;
const STAGES = ['stage-teen', 'stage-early', 'stage-mid', 'stage-senior', 'stage-elder'] as const;
const AUDIENCES = ['adult', 'teen', 'child', ...STAGES] as const;
const BANDS = ['high', 'mid', 'low', 'any'] as const;

const SLOT_NAMES = new Set(['periodLabel', 'dayMasterName', 'yongshinName', 'currentSeasonName']);
const JOSA_PAIRS = new Set(['이가', '은는', '을를', '과와', '으로로', '이라라']);

interface GateArticle {
  schemaVersion: string;
  articleId: string;
  category: string;
  period: string;
  audience: string;
  band: string;
  summary: string;
  hook?: string;
  body: string[];
  expert: string[];
  livingTips?: string[];
  cautions?: string[];
  aiGenerated: boolean;
  sourceNote?: string;
}

interface Violation {
  articleId: string;
  rule: string;
  detail: string;
}

const violations: Violation[] = [];
let glossaryTextById = new Map<string, string>();

function fail(articleId: string, rule: string, detail: string): void {
  violations.push({ articleId, rule, detail });
}

function codePointLength(value: string): number {
  return [...value].length;
}

// ---------------------------------------------------------------------------
// Vocabulary rules (contract §5)
// ---------------------------------------------------------------------------

/** substring caps applied to body+expert joined text (compound-word noise
 *  is subtracted before counting where known). */
const CAPPED_WORDS: ReadonlyArray<{ word: string; cap: number; excludeCompounds?: readonly string[] }> = [
  { word: '흐름', cap: 3 },
  { word: '기운', cap: 3 },
  { word: '자리', cap: 2, excludeCompounds: ['잠자리', '일자리', '보금자리'] },
  { word: '호흡', cap: 1 },
];

const BANNED_PHRASES: readonly string[] = [
  '타고난 중심 기운', '흐름의 색', '자기 격에 맞는', '한 흐름으로', '흐름이 모이는',
  '자리가 자주 등장', '결이 갈라', '점수 해석은', '해석을 덮기 전에', '다 읽은 뒤에는',
  '읽고 난 뒤에는', '하나만 남겨 보세요', '정리하면,', '덧붙이면,', '끝으로,',
  '쉬운 기준으로 보면', '흐름의 흐름', '흐름 흐름',
];

/** Standalone noun 결 + particle (결정/결과/결실 etc. stay legal). */
const STANDALONE_GYEOL = /(?:^|[\s"'‘“(])결(?:이|을|은|는|에|의|로)(?=[\s,.!?"'’”)]|$)/u;

/** Medical-adjacent wording banned service-wide (fortune/naming product must
 *  not read as clinical advice). Scanned across every article text field so
 *  it also covers livingTips/cautions, matching the service-visible guard. */
const MEDICAL_ADJACENT: readonly string[] = ['검진'];

/** Saju technical vocabulary must stay OUT of the user-facing general tier
 *  (summary/hook/body/livingTips/cautions). Only the expert tier may carry
 *  jargon + #{tags}; the general tier speaks plain Korean. Listed terms are
 *  unambiguous saju jargon — homonyms (세운=세우다, 상관=상관없이, 편인=~편인지,
 *  관성=일관성/慣性, 인성=人性, 음양, 정관=定款, 정인=情人) are deliberately
 *  excluded to avoid false positives. */
const SAJU_JARGON_GENERAL: readonly string[] = [
  '오행', '용신', '희신', '기신', '구신', '격국', '십성', '십신',
  '정재', '편재', '재성', '편관', '식신', '식상', '겁재', '비겁',
  '신살', '상생', '상극', '조후', '대운', '배우자궁', '자식궁',
  '부모궁', '형제궁', '조상궁', '천이궁', '역마', '도화', '홍염',
  '문창귀인', '학당', '득령', '득지', '득세', '원형이정',
];

/** Minor-audience safety (audiences teen/child/stage-teen): adult-topic
 *  vocabulary must not appear anywhere in the article, and referenced
 *  glossary entries must not carry adult-topic definitions (glossary
 *  entries of used tags ship inside the minor's report payload). */
const MINOR_AUDIENCES = new Set(['teen', 'child', 'stage-teen']);
const MINOR_BANNED_WORDS: readonly string[] = [
  '연애', '결혼', '배우자', '투자', '보증', '전성기', '음주', '술자리', '이혼',
];
const MINOR_BANNED_GLOSSARY_PATTERN = /연애|결혼|배우자|투자|보증/u;

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Register / sentence rules (contract §4)
// ---------------------------------------------------------------------------

function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** A sentence must end in 해요체: …요. / …죠. (allowing closing quotes). */
function endsInHaeyoche(sentence: string): boolean {
  const stripped = sentence.replace(/["'’”)\]]+$/u, '');
  return /(?:요|죠)[.!?]$/u.test(stripped);
}

const FORMAL_ENDING = /(?:습니다|합니다|입니다|됩니다)/u;

// ---------------------------------------------------------------------------
// Slot / tag grammar
// ---------------------------------------------------------------------------

const SLOT_PATTERN = /\{\{([^{}]*)\}\}/gu;
const TAG_PATTERN = /#\{([^{}]*)\}/gu;
const STRAY_BRACE = /\{\{|\}\}|#\{/u;

interface GlossaryInfo {
  ids: Set<string>;
  text: Map<string, string>;
}

function loadGlossaryInfo(): GlossaryInfo {
  const ids = new Set<string>();
  const text = new Map<string, string>();
  if (!fs.existsSync(GLOSSARY_DIR)) return { ids, text };
  for (const file of fs.readdirSync(GLOSSARY_DIR).filter((f) => f.endsWith('.json'))) {
    try {
      const bundle = JSON.parse(fs.readFileSync(path.join(GLOSSARY_DIR, file), 'utf-8')) as {
        entries?: Array<{ id?: string; label?: string; brief?: string; detailed?: string }>;
      };
      for (const entry of bundle.entries ?? []) {
        if (!entry?.id) continue;
        ids.add(entry.id);
        text.set(entry.id, `${entry.label ?? ''} ${entry.brief ?? ''} ${entry.detailed ?? ''}`);
      }
    } catch {
      // unreadable glossary bundles are reported by other suites
    }
  }
  return { ids, text };
}

function checkSlotsAndTags(
  article: GateArticle,
  field: string,
  text: string,
  glossaryIds: Set<string>,
  allowTags: boolean,
): void {
  for (const match of text.matchAll(SLOT_PATTERN)) {
    const inner = match[1];
    const [name, josa, ...rest] = inner.split(':');
    if (rest.length > 0 || !SLOT_NAMES.has(name)) {
      fail(article.articleId, 'slot-invalid', `${field}: {{${inner}}}`);
      continue;
    }
    if (josa !== undefined && !JOSA_PAIRS.has(josa)) {
      fail(article.articleId, 'slot-josa-invalid', `${field}: {{${inner}}}`);
    }
  }
  for (const match of text.matchAll(TAG_PATTERN)) {
    const tagId = match[1];
    if (!allowTags) {
      fail(article.articleId, 'tag-forbidden-in-standard', `${field}: #{${tagId}}`);
      continue;
    }
    if (!glossaryIds.has(tagId)) {
      fail(article.articleId, 'tag-unknown', `${field}: #{${tagId}}`);
    }
  }
  const withoutMarkup = text.replace(SLOT_PATTERN, '').replace(TAG_PATTERN, '');
  if (STRAY_BRACE.test(withoutMarkup)) {
    fail(article.articleId, 'markup-stray-brace', `${field}: unbalanced {{ }} or #{ }`);
  }
}

/** Rendered-length approximation: markup collapses to typical Korean values. */
function approximateRendered(text: string): string {
  return text
    .replace(/\{\{periodLabel(?::[가-힣]+)?\}\}/gu, '이번 주')
    .replace(/\{\{[A-Za-z]+:([가-힣]+)\}\}/gu, '나무가')
    .replace(/\{\{[A-Za-z]+\}\}/gu, '나무')
    .replace(/#\{[A-Za-z_][A-Za-z0-9_]*\}/gu, '#용신');
}

// ---------------------------------------------------------------------------
// Article checks
// ---------------------------------------------------------------------------

function checkTextBlock(
  article: GateArticle,
  field: string,
  raw: string,
  opts: { minChars: number; maxChars: number; minSentences: number; maxSentences: number },
): void {
  const rendered = approximateRendered(raw);
  const chars = codePointLength(rendered);
  if (chars < opts.minChars || chars > opts.maxChars) {
    fail(article.articleId, 'length-paragraph', `${field}: ${chars}자 (허용 ${opts.minChars}~${opts.maxChars})`);
  }
  const sentences = splitSentences(rendered);
  if (sentences.length < opts.minSentences || sentences.length > opts.maxSentences) {
    fail(article.articleId, 'sentence-count', `${field}: ${sentences.length}문장 (허용 ${opts.minSentences}~${opts.maxSentences})`);
  }
  for (const sentence of sentences) {
    if (FORMAL_ENDING.test(sentence)) {
      fail(article.articleId, 'register-formal', `${field}: "${sentence.slice(0, 30)}…"`);
    } else if (!endsInHaeyoche(sentence)) {
      fail(article.articleId, 'register-ending', `${field}: "${sentence.slice(0, 30)}…"`);
    }
  }
}

function checkArticle(article: GateArticle, glossaryIds: Set<string>): void {
  const id = article.articleId;

  // -- id/axis consistency ----------------------------------------------
  if (!(CATEGORIES as readonly string[]).includes(article.category)) {
    fail(id, 'axis-category', article.category);
  }
  if (!(PERIODS as readonly string[]).includes(article.period)) {
    fail(id, 'axis-period', article.period);
  }
  if (!(AUDIENCES as readonly string[]).includes(article.audience)) {
    fail(id, 'axis-audience', article.audience);
  }
  if (!(BANDS as readonly string[]).includes(article.band)) {
    fail(id, 'axis-band', article.band);
  }
  const stageAudience = article.audience.startsWith('stage-');
  if (stageAudience && article.period !== 'life') {
    fail(id, 'axis-stage-period', `stage audience requires period=life, got ${article.period}`);
  }
  const idAxis = stageAudience ? article.audience : article.period;
  const expectedIdPrefix = `${article.category}.${idAxis}.${article.audience}.${article.band}.`;
  if (!id.startsWith(expectedIdPrefix) || !/\.[a-z]$/u.test(id)) {
    fail(id, 'article-id-format', `expected ${expectedIdPrefix}<a-z>`);
  }
  if (article.aiGenerated !== true) {
    fail(id, 'ai-generated-marking', 'NO_AI_POLICY: authored-with-AI articles must set aiGenerated:true');
  }

  // -- brief -------------------------------------------------------------
  const summary = approximateRendered(article.summary).trim();
  if (codePointLength(summary) > 60) fail(id, 'summary-length', `${codePointLength(summary)}자 (≤60)`);
  if (splitSentences(summary).length !== 1) fail(id, 'summary-sentence-count', summary.slice(0, 40));
  if (!endsInHaeyoche(summary) || FORMAL_ENDING.test(summary)) fail(id, 'summary-register', summary.slice(0, 40));
  if (article.hook !== undefined) {
    const hook = approximateRendered(article.hook).trim();
    if (codePointLength(hook) > 24) fail(id, 'hook-length', `${codePointLength(hook)}자 (≤24)`);
  }

  // -- body ----------------------------------------------------------------
  if (article.body.length < 3 || article.body.length > 4) {
    fail(id, 'body-paragraph-count', `${article.body.length}문단 (허용 3~4)`);
  }
  let bodyTotal = 0;
  article.body.forEach((paragraph, index) => {
    bodyTotal += codePointLength(approximateRendered(paragraph));
    checkTextBlock(article, `body[${index}]`, paragraph, {
      minChars: 80, maxChars: 240, minSentences: 2, maxSentences: 5,
    });
    checkSlotsAndTags(article, `body[${index}]`, paragraph, glossaryIds, false);
  });
  if (bodyTotal < 350 || bodyTotal > 800) {
    fail(id, 'body-total-length', `${bodyTotal}자 (허용 350~800)`);
  }

  // -- expert ---------------------------------------------------------------
  if (article.expert.length < 1 || article.expert.length > 2) {
    fail(id, 'expert-paragraph-count', `${article.expert.length}문단 (허용 1~2)`);
  }
  article.expert.forEach((paragraph, index) => {
    checkTextBlock(article, `expert[${index}]`, paragraph, {
      minChars: 100, maxChars: 380, minSentences: 2, maxSentences: 6,
    });
    checkSlotsAndTags(article, `expert[${index}]`, paragraph, glossaryIds, true);
  });
  const tagIds = new Set<string>();
  for (const paragraph of article.expert) {
    for (const match of paragraph.matchAll(TAG_PATTERN)) tagIds.add(match[1]);
  }
  if (tagIds.size < 2 || tagIds.size > 6) {
    fail(id, 'expert-tag-count', `${tagIds.size}개 (허용 2~6)`);
  }

  // -- tips / cautions -------------------------------------------------------
  const tips = article.livingTips ?? [];
  if (tips.length < 2 || tips.length > 3) fail(id, 'living-tips-count', `${tips.length}개 (허용 2~3)`);
  tips.forEach((tip, index) => {
    if (codePointLength(approximateRendered(tip)) > 30) fail(id, 'living-tip-length', `livingTips[${index}] >30자`);
    checkSlotsAndTags(article, `livingTips[${index}]`, tip, glossaryIds, false);
  });
  const cautions = article.cautions ?? [];
  if (cautions.length < 1 || cautions.length > 2) fail(id, 'cautions-count', `${cautions.length}개 (허용 1~2)`);
  cautions.forEach((caution, index) => {
    if (codePointLength(approximateRendered(caution)) > 44) fail(id, 'caution-length', `cautions[${index}] >44자`);
    checkSlotsAndTags(article, `cautions[${index}]`, caution, glossaryIds, false);
  });

  // -- vocabulary --------------------------------------------------------------
  const joined = approximateRendered([...article.body, ...article.expert].join('\n'));
  for (const { word, cap, excludeCompounds } of CAPPED_WORDS) {
    let scrubbed = joined;
    for (const compound of excludeCompounds ?? []) {
      scrubbed = scrubbed.split(compound).join('');
    }
    const count = countOccurrences(scrubbed, word);
    if (count > cap) fail(id, 'vocab-cap', `'${word}' ${count}회 (허용 ≤${cap})`);
  }
  const briefJoined = `${article.summary} ${article.hook ?? ''}`;
  for (const phrase of BANNED_PHRASES) {
    if (joined.includes(phrase) || briefJoined.includes(phrase)) {
      fail(id, 'vocab-banned', `'${phrase}'`);
    }
  }
  if (STANDALONE_GYEOL.test(joined)) {
    fail(id, 'vocab-gyeol', '명사 단독 결 사용');
  }
  const allText = [
    article.summary, article.hook ?? '',
    ...article.body, ...article.expert,
    ...(article.livingTips ?? []), ...(article.cautions ?? []),
  ].join('\n');
  for (const word of MEDICAL_ADJACENT) {
    if (allText.includes(word)) {
      fail(id, 'vocab-medical-adjacent', `'${word}'`);
    }
  }
  // Saju jargon must stay in the expert tier only; the user-facing general
  // tier (summary/hook/body/tips/cautions) speaks plain Korean.
  const generalText = [
    article.summary, article.hook ?? '',
    ...article.body,
    ...(article.livingTips ?? []), ...(article.cautions ?? []),
  ].join('\n');
  for (const term of SAJU_JARGON_GENERAL) {
    if (generalText.includes(term)) {
      fail(id, 'jargon-in-general', `일반 tier에 사주 용어 '${term}' (expert 전용)`);
    }
  }

  // -- minor-audience safety ----------------------------------------------------
  if (MINOR_AUDIENCES.has(article.audience)) {
    const everything = [
      article.summary, article.hook ?? '',
      ...article.body, ...article.expert,
      ...(article.livingTips ?? []), ...(article.cautions ?? []),
    ].join('\n');
    for (const word of MINOR_BANNED_WORDS) {
      if (everything.includes(word)) {
        fail(id, 'minor-banned-word', `'${word}'`);
      }
    }
    for (const paragraph of article.expert) {
      for (const match of paragraph.matchAll(TAG_PATTERN)) {
        const glossaryText = glossaryTextById.get(match[1]) ?? '';
        if (MINOR_BANNED_GLOSSARY_PATTERN.test(glossaryText)) {
          fail(id, 'minor-unsafe-tag', `#{${match[1]}} 글로서리 정의에 성인 어휘 포함`);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Corpus-level checks
// ---------------------------------------------------------------------------

function checkCoverage(articles: GateArticle[]): void {
  const index = new Set(articles.map((a) => `${a.category}|${a.period}|${a.audience}|${a.band}`));
  const has = (cat: string, period: string, audience: string, band: string): boolean =>
    index.has(`${cat}|${period}|${audience}|${band}`);

  for (const cat of CATEGORIES) {
    for (const period of PERIODS) {
      for (const band of ['high', 'mid', 'low']) {
        if (!has(cat, period, 'adult', band)) {
          fail('(corpus)', 'coverage-adult', `${cat}.${period}.adult.${band} 없음`);
        }
      }
      if (!has(cat, period, 'teen', 'any')) fail('(corpus)', 'coverage-teen', `${cat}.${period}.teen.any 없음`);
      if (!has(cat, period, 'child', 'any')) fail('(corpus)', 'coverage-child', `${cat}.${period}.child.any 없음`);
    }
    for (const stage of STAGES) {
      if (!has(cat, 'life', stage, 'any')) fail('(corpus)', 'coverage-stage', `${cat}.${stage}.any 없음`);
    }
  }
}

function checkDuplicates(articles: GateArticle[]): void {
  const seen = new Map<string, string>();
  for (const article of articles) {
    const texts = [...article.body, ...article.expert];
    for (const text of texts) {
      for (const sentence of splitSentences(approximateRendered(text))) {
        const normalized = sentence.replace(/\s+/gu, ' ').trim();
        if (codePointLength(normalized) < 14) continue;
        const prior = seen.get(normalized);
        if (prior && prior !== article.articleId) {
          fail(article.articleId, 'duplicate-sentence', `"${normalized.slice(0, 34)}…" (동일 문장: ${prior})`);
        } else if (!prior) {
          seen.set(normalized, article.articleId);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface GateResult {
  articleCount: number;
  bundleCount: number;
  violations: Violation[];
}

export function runArticleQualityGate(articlesDir: string = ARTICLES_DIR): GateResult {
  violations.length = 0;
  const glossaryInfo = loadGlossaryInfo();
  const glossaryIds = glossaryInfo.ids;
  glossaryTextById = glossaryInfo.text;
  const articles: GateArticle[] = [];
  const seenIds = new Map<string, string>();
  let bundleCount = 0;

  const bundleFiles: string[] = [];
  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.articles.json')) bundleFiles.push(full);
    }
  }
  walk(articlesDir);
  bundleFiles.sort();

  for (const file of bundleFiles) {
    const relative = path.relative(articlesDir, file).replace(/\\/gu, '/');
    let bundle: { schemaVersion?: string; articles?: GateArticle[] };
    try {
      bundle = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (error) {
      fail(relative, 'bundle-parse', String(error));
      continue;
    }
    bundleCount += 1;
    if (bundle.schemaVersion !== 'spring-ts.article-bundle.v1') {
      fail(relative, 'bundle-schema', String(bundle.schemaVersion));
    }
    const dirCategory = relative.split('/')[0];
    const fileBase = path.basename(file, '.articles.json');
    for (const article of bundle.articles ?? []) {
      if (!article || typeof article !== 'object') continue;
      if (article.schemaVersion !== 'spring-ts.article.v1') {
        fail(article.articleId ?? relative, 'article-schema', String(article.schemaVersion));
        continue;
      }
      const prior = seenIds.get(article.articleId);
      if (prior) fail(article.articleId, 'article-id-duplicate', `이미 ${prior}에 존재`);
      seenIds.set(article.articleId, relative);
      if (article.category !== dirCategory) {
        fail(article.articleId, 'bundle-category-mismatch', `${article.category} in ${relative}`);
      }
      if (fileBase === 'stages') {
        if (!article.audience.startsWith('stage-')) {
          fail(article.articleId, 'bundle-audience-mismatch', `stages 파일에는 stage-* 만: ${article.audience}`);
        }
      } else if (article.period !== fileBase) {
        fail(article.articleId, 'bundle-period-mismatch', `${article.period} in ${relative}`);
      }
      articles.push(article);
      checkArticle(article, glossaryIds);
    }
  }

  checkCoverage(articles);
  checkDuplicates(articles);

  return { articleCount: articles.length, bundleCount, violations: [...violations] };
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const result = runArticleQualityGate();
  const byRule = new Map<string, number>();
  for (const violation of result.violations) {
    byRule.set(violation.rule, (byRule.get(violation.rule) ?? 0) + 1);
    console.log(`FAIL [${violation.rule}] ${violation.articleId} — ${violation.detail}`);
  }
  console.log('---');
  console.log(`bundles: ${result.bundleCount}, articles: ${result.articleCount}, violations: ${result.violations.length}`);
  for (const [rule, count] of [...byRule.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${rule}: ${count}`);
  }
  process.exit(result.violations.length > 0 ? 1 : 0);
}
