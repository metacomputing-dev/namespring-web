import assert from 'node:assert/strict';

import { buildPeriodFortuneCard } from '../../src/report/cards/period-fortune-card.js';
import { getDailyFortune } from '../../src/report/common/fortuneCalculator.js';

const TARGET_DATE = new Date(2025, 6, 10, 12, 0, 0);

type CanonicalRelationType =
  | 'YUKHAP'
  | 'CHUNG'
  | 'JA_HYEONG'
  | 'SAMHYEONG'
  | 'HAE'
  | 'PA';

function makeSaju(
  relationTypes: readonly CanonicalRelationType[] | undefined,
  natalBranchCode: string,
  elements: { readonly dayMaster: string; readonly yongshin: string } = {
    dayMaster: 'WATER',
    yongshin: 'WOOD',
  },
): any {
  const relationsWithNatal = relationTypes
    ? {
      stemRelations: [],
      branchRelations: relationTypes.map((type) => ({
        type,
        members: [],
        natalPositions: ['year'],
        luckPosition: 'luck',
      })),
    }
    : undefined;

  return {
    dayMaster: { element: elements.dayMaster },
    yongshin: { element: elements.yongshin, heeshin: null, gishin: null },
    deficientElements: [],
    // Deliberately retained as a conflicting legacy input in some cases. The
    // report must not derive a relationship from these pillar branch codes.
    pillars: {
      year: { branch: { code: natalBranchCode } },
      month: { branch: { code: natalBranchCode } },
      day: { branch: { code: natalBranchCode } },
      hour: { branch: { code: natalBranchCode } },
    },
    saeunPillars: [{
      year: 2025,
      stem: 'GAP',
      branch: 'O',
      startUtcMs: Date.UTC(2025, 1, 3),
      endUtcMs: Date.UTC(2026, 1, 4),
      ...(relationsWithNatal ? { relationsWithNatal } : {}),
    }],
  };
}

function yearlyWarning(
  relationTypes: readonly CanonicalRelationType[] | undefined,
  natalBranchCode: string,
  elements?: { readonly dayMaster: string; readonly yongshin: string },
): { signal: string; response: string; reason: string } {
  return buildPeriodFortuneCard(
    makeSaju(relationTypes, natalBranchCode, elements),
    'yearly',
    TARGET_DATE,
  ).warning;
}

const annotationWins = yearlyWarning(['CHUNG'], 'JIN');
assert.match(
  annotationWins.signal,
  /원국 지지와 충/,
  'a canonical CHUNG annotation must drive the warning even when raw pillar codes do not collide',
);

const positiveAnnotationBlocksLegacyRecalculation = yearlyWarning(['YUKHAP'], 'JA');
assert.doesNotMatch(
  positiveAnnotationBlocksLegacyRecalculation.signal,
  /원국 지지와 충/,
  'the report must not recompute 午-子 CHUNG when the engine annotation contains only YUKHAP',
);

const missingAnnotationBlocksLegacyRecalculation = yearlyWarning(undefined, 'JA');
assert.doesNotMatch(
  missingAnnotationBlocksLegacyRecalculation.signal,
  /원국 지지와 충/,
  'missing engine annotations must remain unknown instead of triggering report-layer branch math',
);
assert.match(
  missingAnnotationBlocksLegacyRecalculation.signal,
  /관계 판정 자료가 없어/,
  'missing canonical annotations must be disclosed instead of implying that no caution signal exists',
);

const evaluatedEmptyRelationSet = yearlyWarning([], 'JIN');
assert.doesNotMatch(
  evaluatedEmptyRelationSet.signal,
  /관계 판정 자료가 없어/,
  'an explicitly evaluated empty relation set must remain distinguishable from a missing evaluation',
);

const canonicalSamhyeong = yearlyWarning(['SAMHYEONG'], 'JIN');
assert.match(
  canonicalSamhyeong.signal,
  /삼형/,
  'canonical full 삼형 must remain cautionary after constituent HYEONG pairs are suppressed',
);

const canonicalJaHyeong = yearlyWarning(['JA_HYEONG'], 'JIN');
assert.match(
  canonicalJaHyeong.signal,
  /자형/,
  'canonical 자형 must retain a dedicated report warning',
);

const legacyPresentationPriority = yearlyWarning(['HAE', 'PA'], 'JIN');
assert.match(
  legacyPresentationPriority.signal,
  /원국 지지와 파/,
  'report phrasing priority must remain stable even when canonical annotations use engine ordering',
);

const dailyStemElement = getDailyFortune(TARGET_DATE).stemElement;
const missingDaily = buildPeriodFortuneCard(
  makeSaju(undefined, 'JIN', {
    dayMaster: dailyStemElement,
    yongshin: dailyStemElement,
  }),
  'daily',
  TARGET_DATE,
).warning;
assert.match(
  missingDaily.signal,
  /관계 판정 자료가 없어/,
  'daily fallback must disclose that natal relation judgement was excluded',
);

const missingWeekly = buildPeriodFortuneCard(
  makeSaju(undefined, 'JIN', {
    dayMaster: dailyStemElement,
    yongshin: dailyStemElement,
  }),
  'weekly',
  TARGET_DATE,
).warning;
assert.match(
  missingWeekly.signal,
  /관계 판정 자료가 없어/,
  'weekly fallback must disclose that natal relation judgement was excluded',
);

const specificElementWarningWins = yearlyWarning(undefined, 'JIN', {
  dayMaster: 'EARTH',
  yongshin: 'WOOD',
});
assert.doesNotMatch(
  specificElementWarningWins.signal,
  /관계 판정 자료가 없어/,
  'a concrete element-control warning must remain more useful than the missing-relation disclosure',
);

console.log('period-fortune relation source: 11 PASS / 0 FAIL');
