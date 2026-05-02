#!/usr/bin/env node
/**
 * tools/seed_placeholder_fragments.mjs
 *
 * Generates Phase 1 placeholder fragments for the tiered fortune matrix
 * narrative system. Output is a single committed JSON bundle at
 *   data/narrative/_seed/placeholder.fragments.json
 *
 * Each (category × period × depth) cell gets one minimal fragment so the
 * fragment-registry has at least one match for every matrix cell. Phase 2
 * agents will replace these stubs with rich variant pools per
 * data/narrative/_contract/v1.json.
 *
 * Determinism: this script is pure; same inputs → same output. No LLM
 * dependency. Generator is a dev tool (lives outside src/**) and produces
 * a static JSON file that itself is properly NO_AI_POLICY-marked.
 *
 * Usage:
 *   node tools/seed_placeholder_fragments.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'narrative', '_seed', 'placeholder.fragments.json');

// ── Axes ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'overall', 'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
];
const PERIODS = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'];
const DEPTHS = ['brief', 'standard', 'expert'];

// ── Korean labels for placeholder prose ──────────────────────────────────
const CATEGORY_LABEL = {
  overall: '총운', wealth: '재물 흐름', health: '건강',
  academic: '학업과 일', romance: '연애와 인연', family: '가족과 집안',
  career: '직업과 자리', study_document: '학업·문서', expression_children: '표현·자녀',
  health_stress: '건강·스트레스', movement: '이동과 변동',
};

const PERIOD_LABEL = {
  life: '인생 전체', today: '오늘', thisWeek: '이번 주',
  thisMonth: '이번 달', thisYear: '올해',
};

// ── Anchor tag IDs (must exist in data/narrative/_glossary/*.json) ───────
const TAG_BY_CATEGORY = {
  overall: ['yongshin', 'sajuCompatibility'],
  wealth: ['jeongjae', 'pyeonjae'],
  health: ['johu', 'water'],
  academic: ['jeongin', 'sikshin'],
  romance: ['baeujagung', 'dohwa'],
  family: ['bumyong', 'jojangung'],
  career: ['jeonggwan', 'pyeongwan'],
  study_document: ['jeongin', 'pyeonin'],
  expression_children: ['sikshin', 'jasikgung'],
  health_stress: ['johu', 'samhyeong'],
  movement: ['yeokma'],
};

// ── Source tier (NO_AI_POLICY) ───────────────────────────────────────────
const SOURCE_TIER = {
  tier: 'T1_HYPOTHESIS',
  sourceType: 'training_derived',
  sourceUrl: null,
  accessedAt: '2026-05-02',
  quoteShort: null,
  humanInterpretation: 'Phase 1 placeholder fragment generated deterministically by tools/seed_placeholder_fragments.mjs. Replaced by Phase 2 fan-out content. Display-only narrative.',
  copyrightNote: 'No source prose copied; original placeholder.',
  authorityTruthEligible: false,
};

// ── Fragment templates per depth ─────────────────────────────────────────
function briefTokens(category, period) {
  return [
    {
      kind: 'text',
      value: `${PERIOD_LABEL[period]}의 ${CATEGORY_LABEL[category]} 흐름은 균형이 잡혀 있어요.`,
    },
  ];
}

function standardTokens(category, period) {
  return [
    {
      kind: 'text',
      value: `${PERIOD_LABEL[period]}의 ${CATEGORY_LABEL[category]} 흐름을 살펴보면, 전체적으로 큰 무리수 없이 흘러가는 그림이에요. 사주의 균형이 잘 잡혀 있어 익숙한 페이스를 유지하면 자연스럽게 결과가 따라와요. 새로운 시도를 한다면 천천히, 단계적으로 접근하는 것이 잘 맞아요. 작은 신호들을 무시하지 않고 메모해 두면 결정의 질이 한 단계 올라가요. 평소의 좋은 습관을 그대로 이어 가는 것만으로도 이 시기엔 충분해요.`,
    },
  ];
}

function expertTokens(category, period) {
  const tags = TAG_BY_CATEGORY[category] ?? [];
  if (tags.length === 0) {
    return [
      {
        kind: 'text',
        value: `${PERIOD_LABEL[period]}의 ${CATEGORY_LABEL[category]}은 사주 전체 균형 안에서 안정적으로 작용합니다.`,
      },
    ];
  }
  const labelMap = {
    yongshin: '용신', sajuCompatibility: '사주적합도',
    jeongjae: '정재', pyeonjae: '편재', johu: '조후', water: '물',
    jeongin: '정인', sikshin: '식신', baeujagung: '배우자궁', dohwa: '도화',
    bumyong: '부모궁', jojangung: '조상궁', jeonggwan: '정관', pyeongwan: '편관',
    pyeonin: '편인', jasikgung: '자식궁', samhyeong: '삼형', yeokma: '역마',
  };
  const primary = tags[0];
  const secondary = tags[1] ?? null;
  const tokens = [
    { kind: 'text', value: `${PERIOD_LABEL[period]}의 ${CATEGORY_LABEL[category]}는 ` },
    { kind: 'tag', tagId: primary, label: labelMap[primary] ?? primary },
    { kind: 'text', value: '의 흐름과 가장 가까이 맞물려 작용합니다.' },
  ];
  if (secondary) {
    tokens.push({ kind: 'text', value: ' 보조적으로는 ' });
    tokens.push({ kind: 'tag', tagId: secondary, label: labelMap[secondary] ?? secondary });
    tokens.push({ kind: 'text', value: '의 결도 함께 살펴봅니다.' });
  }
  return tokens;
}

function tagsForFragment(category, depth) {
  if (depth !== 'expert') return [];
  return TAG_BY_CATEGORY[category] ?? [];
}

function buildTokensFor(category, period, depth) {
  if (depth === 'brief') return briefTokens(category, period);
  if (depth === 'standard') return standardTokens(category, period);
  if (depth === 'expert') return expertTokens(category, period);
  throw new Error(`Unknown depth: ${depth}`);
}

// ── Build all 165 fragment seeds ─────────────────────────────────────────
function buildAllFragments() {
  const fragments = [];
  for (const category of CATEGORIES) {
    for (const period of PERIODS) {
      for (const depth of DEPTHS) {
        fragments.push({
          schemaVersion: 'spring-ts.narrative-fragment.v1',
          fragmentId: `${category}.${period}.${depth}.placeholder.001`,
          axis: { category, period, depth },
          gating: {},
          templateTokens: buildTokensFor(category, period, depth),
          tags: tagsForFragment(category, depth),
          aiGenerated: true,
          sourceTier: SOURCE_TIER,
        });
      }
    }
  }
  return fragments;
}

const fragments = buildAllFragments();
const bundle = {
  schemaVersion: 'spring-ts.narrative-fragment-bundle.v1',
  bundleId: 'placeholder',
  contractVersion: '1.0.0',
  generatedBy: 'tools/seed_placeholder_fragments.mjs',
  fragmentCount: fragments.length,
  fragments,
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(bundle, null, 2) + '\n', 'utf-8');
console.log(`Wrote ${fragments.length} placeholder fragments → ${path.relative(ROOT, OUT_PATH)}`);
