// @ts-nocheck
/**
 * section-tenGodPersonality.ts -- Ten-god personality and career analysis
 *
 * Generates the '십성으로 보는 성격과 적성' section of the premium saju report.
 * Analyses the ten-god distribution across the four pillars to provide:
 *   - Overview of ten-god significance
 *   - Table of ten gods by pillar position
 *   - Dominant ten-god category identification and interpretation
 *   - Career / aptitude subsection
 *   - Radar chart of the five ten-god categories
 */

import type {
  SajuSummary,
  BirthInfo,
  PremiumReportSection,
  ElementCode,
  ReportHighlight,
  ReportParagraph,
  ReportTable,
  ReportSubsection,
} from '../types.js';
import {
  SeededRandom,
  pickAndFill,
  narrative,
  positive,
  encouraging,
  caution,
  tip,
  emphasis,
  joinSentences,
} from '../common/sentenceUtils.js';
import {
  TEN_GOD_BY_CODE,
  TEN_GOD_CATEGORY_KOREAN,
} from '../common/elementMaps.js';
import { TEN_GOD_ENCYCLOPEDIA } from '../knowledge/index.js';
import type { TenGodCode } from '../types.js';

// ---------------------------------------------------------------------------
//  Ten-god code normalisation
// ---------------------------------------------------------------------------

const TEN_GOD_KOREAN_TO_CODE: Readonly<Record<string, string>> = {
  '비견': 'BI_GYEON',
  '겁재': 'GEOB_JAE',
  '식신': 'SIK_SHIN',
  '상관': 'SANG_GWAN',
  '편재': 'PYEON_JAE',
  '정재': 'JEONG_JAE',
  '편관': 'PYEON_GWAN',
  '정관': 'JEONG_GWAN',
  '편인': 'PYEON_IN',
  '정인': 'JEONG_IN',
};

function normalizeTenGodCode(raw: string): string {
  return TEN_GOD_KOREAN_TO_CODE[raw] ?? raw;
}

// ---------------------------------------------------------------------------
//  Category helpers
// ---------------------------------------------------------------------------

type TenGodCategoryKey = 'friend' | 'output' | 'wealth' | 'authority' | 'resource';

const CATEGORY_KOREAN_LABELS: Record<TenGodCategoryKey, string> = {
  friend: '비겁',
  output: '식상',
  wealth: '재성',
  authority: '관성',
  resource: '인성',
};

const ALL_CATEGORIES: readonly TenGodCategoryKey[] = [
  'friend', 'output', 'wealth', 'authority', 'resource',
];

/**
 * Resolve a ten-god raw string (either Korean or code form) to its
 * category. Returns null if the code cannot be resolved.
 */
function getTenGodCategory(raw: string): TenGodCategoryKey | null {
  const code = normalizeTenGodCode(raw);
  const info = TEN_GOD_BY_CODE[code];
  return info ? info.category as TenGodCategoryKey : null;
}

/**
 * Resolve a ten-god raw string to a display label (Korean).
 */
function getTenGodKorean(raw: string): string {
  const code = normalizeTenGodCode(raw);
  const info = TEN_GOD_BY_CODE[code];
  return info ? info.korean : raw;
}

// ---------------------------------------------------------------------------
//  Pillar position labels
// ---------------------------------------------------------------------------

const PILLAR_POSITIONS: readonly { key: string; label: string }[] = [
  { key: 'YEAR', label: '년주' },
  { key: 'MONTH', label: '월주' },
  { key: 'HOUR', label: '시주' },
];

// ---------------------------------------------------------------------------
//  Template banks
// ---------------------------------------------------------------------------

const OVERVIEW_TEMPLATES = [
  '십성(十星)은 일간을 기준으로 다른 천간과 지지가 어떤 관계를 맺는지를 보여주는 열 가지 기운이에요. 이를 통해 성격, 재능, 관계 패턴을 파악할 수 있어요.',
  '사주의 십성 배치를 분석하면, 어떤 기운이 강하고 약한지를 통해 성격의 핵심 특징과 적성을 파악할 수 있어요.',
  '십성은 사주 해석의 핵심 도구예요. 일간과 다른 간지의 관계에서 드러나는 열 가지 기운을 통해 타고난 성향과 가능성을 읽어 낼 수 있어요.',
];

const NO_ANALYSIS_TEMPLATES = [
  '십성 분석 데이터가 아직 준비되지 않았어요. 시주(시간) 정보가 확인되면 더 정밀한 분석이 가능해요.',
  '현재 십성 배치 정보가 충분하지 않아 세부 분석을 제공하기 어려워요. 정확한 출생 시간이 확인되면 업데이트할게요.',
];

const DOMINANT_CATEGORY_TEMPLATES = [
  '{{name}}님의 사주에서는 {{category}} 계열의 기운이 가장 두드러져요. {{role}}',
  '십성 분포를 보면 {{category}} 계열이 중심을 이루고 있어요. {{role}}',
  '가장 강한 십성 계열은 {{category}}이에요. {{role}}',
];

const CAREER_INTRO_TEMPLATES = [
  '{{category}} 기운이 강한 사주의 적성과 직업 방향을 살펴볼게요.',
  '주요 십성 기운을 바탕으로 어울리는 분야를 정리해 드릴게요.',
  '{{category}} 중심의 사주에서 빛날 수 있는 적성과 진로 방향이에요.',
];

// ---------------------------------------------------------------------------
//  Main generator
// ---------------------------------------------------------------------------

export function generateTenGodPersonalitySection(
  saju: SajuSummary,
  birth: BirthInfo,
  rng: SeededRandom,
): PremiumReportSection | null {
  const displayName = birth.name ?? '회원';
  const tga = saju.tenGodAnalysis;
  const paragraphs: ReportParagraph[] = [];

  // Overview
  paragraphs.push(
    narrative(pickAndFill(rng, OVERVIEW_TEMPLATES)),
  );

  if (!tga) {
    paragraphs.push(
      caution(pickAndFill(rng, NO_ANALYSIS_TEMPLATES)),
    );
    return {
      id: 'tenGodPersonality',
      title: '십성으로 보는 성격과 적성',
      paragraphs,
    };
  }

  // ------------------------------------------------------------------
  //  Collect ten-god codes from each pillar and build the table
  // ------------------------------------------------------------------
  const categoryCounts: Record<TenGodCategoryKey, number> = {
    friend: 0, output: 0, wealth: 0, authority: 0, resource: 0,
  };

  // Increment category count helper
  function countCategory(raw: string | undefined): void {
    if (!raw) return;
    const cat = getTenGodCategory(raw);
    if (cat) categoryCounts[cat]++;
  }

  const tableRows: string[][] = [];

  for (const { key, label } of PILLAR_POSITIONS) {
    const pos = tga.byPosition[key];
    if (!pos) continue;

    const cheonganDisplay = getTenGodKorean(pos.cheonganTenGod);
    const jijiDisplay = getTenGodKorean(pos.jijiPrincipalTenGod);

    // Count both cheongan and jiji for category tallying
    countCategory(pos.cheonganTenGod);
    countCategory(pos.jijiPrincipalTenGod);

    // Also count hidden stem ten gods
    for (const hidden of pos.hiddenStemTenGod) {
      countCategory(hidden.tenGod);
    }

    // Determine the role description from the cheongan ten god
    const cheonganCode = normalizeTenGodCode(pos.cheonganTenGod);
    const cheonganInfo = TEN_GOD_BY_CODE[cheonganCode];
    const roleDesc = cheonganInfo ? cheonganInfo.shortDesc : '';

    tableRows.push([label, cheonganDisplay, jijiDisplay, roleDesc]);
  }

  // Also count day-pillar jiji if available (dayBranch)
  // The day stem is the day master itself (bi-gyeon relationship)
  const dayPos = tga.byPosition['DAY'];
  if (dayPos) {
    countCategory(dayPos.jijiPrincipalTenGod);
    for (const hidden of dayPos.hiddenStemTenGod) {
      countCategory(hidden.tenGod);
    }
  }

  // Table
  const tables: ReportTable[] = [];
  if (tableRows.length > 0) {
    tables.push({
      title: '주요 십성 배치표',
      headers: ['위치', '천간 십성', '지지 십성', '역할'],
      rows: tableRows,
    });
  }

  // ------------------------------------------------------------------
  //  Determine the dominant category
  // ------------------------------------------------------------------
  let dominantCategory: TenGodCategoryKey = 'friend';
  let maxCount = 0;
  for (const cat of ALL_CATEGORIES) {
    if (categoryCounts[cat] > maxCount) {
      maxCount = categoryCounts[cat];
      dominantCategory = cat;
    }
  }

  const dominantCategoryKorean = TEN_GOD_CATEGORY_KOREAN[dominantCategory]
    ?? CATEGORY_KOREAN_LABELS[dominantCategory];

  // Pick a representative ten-god code from the dominant category to
  // look up detailed encyclopedia information
  const dominantTenGodCode = findRepresentativeTenGod(dominantCategory, tga);
  const encyclopediaEntry = dominantTenGodCode
    ? TEN_GOD_ENCYCLOPEDIA[dominantTenGodCode as TenGodCode] ?? null
    : null;

  // Dominant category paragraph
  const coreRole = encyclopediaEntry?.coreRole ?? '';
  paragraphs.push(
    emphasis(
      pickAndFill(rng, DOMINANT_CATEGORY_TEMPLATES, {
        name: displayName,
        category: dominantCategoryKorean,
        role: coreRole,
      }),
    ),
  );

  // Strengths from encyclopedia
  if (encyclopediaEntry && encyclopediaEntry.strengths.length > 0) {
    const selectedStrengths = rng.sample(
      encyclopediaEntry.strengths,
      Math.min(2, encyclopediaEntry.strengths.length),
    );
    paragraphs.push(positive(joinSentences(...selectedStrengths)));
  }

  // Cautions from encyclopedia
  if (encyclopediaEntry && encyclopediaEntry.cautions.length > 0) {
    const selectedCautions = rng.sample(
      encyclopediaEntry.cautions,
      Math.min(2, encyclopediaEntry.cautions.length),
    );
    paragraphs.push(caution(joinSentences(...selectedCautions)));
  }

  // ------------------------------------------------------------------
  //  Career / aptitude subsection
  // ------------------------------------------------------------------
  const careerParagraphs: ReportParagraph[] = [];
  careerParagraphs.push(
    narrative(
      pickAndFill(rng, CAREER_INTRO_TEMPLATES, {
        category: dominantCategoryKorean,
      }),
    ),
  );

  if (encyclopediaEntry && encyclopediaEntry.careerHints.length > 0) {
    for (const hint of encyclopediaEntry.careerHints) {
      careerParagraphs.push(encouraging(hint));
    }
  }

  const careerSubsection: ReportSubsection = {
    title: '적성과 직업 방향',
    paragraphs: careerParagraphs,
  };

  // ------------------------------------------------------------------
  //  Radar chart: five-category distribution
  // ------------------------------------------------------------------
  const radarData: Record<string, number> = {};
  for (const cat of ALL_CATEGORIES) {
    radarData[CATEGORY_KOREAN_LABELS[cat]] = categoryCounts[cat];
  }

  // ------------------------------------------------------------------
  //  Highlights
  // ------------------------------------------------------------------
  const highlights: ReportHighlight[] = [
    {
      label: '주요 십성 계열',
      value: dominantCategoryKorean,
      sentiment: 'good',
    },
  ];

  if (dominantTenGodCode) {
    const info = TEN_GOD_BY_CODE[dominantTenGodCode];
    if (info) {
      highlights.push({
        label: '대표 십성',
        value: `${info.korean}(${info.hanja})`,
        sentiment: 'neutral',
      });
    }
  }

  // ------------------------------------------------------------------
  //  Assemble section
  // ------------------------------------------------------------------
  return {
    id: 'tenGodPersonality',
    title: '십성으로 보는 성격과 적성',
    subtitle: '열 가지 기운이 알려주는 타고난 성향과 진로',
    paragraphs,
    tables,
    charts: [
      {
        type: 'radar',
        title: '십성 계열 분포',
        data: radarData,
      },
    ],
    highlights,
    subsections: [careerSubsection],
  };
}

// ---------------------------------------------------------------------------
//  Helper: find the most representative ten-god code for a category
// ---------------------------------------------------------------------------

function findRepresentativeTenGod(
  category: TenGodCategoryKey,
  tga: NonNullable<SajuSummary['tenGodAnalysis']>,
): string | null {
  // Collect all ten-god codes that appear in the analysis
  const codeCounts = new Map<string, number>();

  for (const posKey of Object.keys(tga.byPosition)) {
    const pos = tga.byPosition[posKey];
    for (const raw of [pos.cheonganTenGod, pos.jijiPrincipalTenGod]) {
      if (!raw) continue;
      const code = normalizeTenGodCode(raw);
      const info = TEN_GOD_BY_CODE[code];
      if (info && info.category === category) {
        codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
      }
    }
    for (const hidden of pos.hiddenStemTenGod) {
      const code = normalizeTenGodCode(hidden.tenGod);
      const info = TEN_GOD_BY_CODE[code];
      if (info && info.category === category) {
        codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
      }
    }
  }

  if (codeCounts.size === 0) return null;

  // Return the code with the highest count
  let best: string | null = null;
  let bestCount = 0;
  codeCounts.forEach((count, code) => {
    if (count > bestCount) { bestCount = count; best = code; }
  });
  return best;
}
