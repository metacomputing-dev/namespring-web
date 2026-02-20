import {
  scoreNameAgainstSaju,
  type ScoreNameAgainstSajuInput,
} from '../src/report/common/namingScoreEngine.ts';

const GOOD_MATCH_INPUT: ScoreNameAgainstSajuInput = {
  nameElements: ['FIRE', 'WOOD', 'FIRE'],
  suriElements: ['WOOD', 'FIRE'],
  yongshin: 'FIRE',
  heeshin: 'WOOD',
  gishin: 'WATER',
  deficiency: ['FIRE', 'WOOD'],
};

const CAUTION_MATCH_INPUT: ScoreNameAgainstSajuInput = {
  nameElements: ['WATER', 'WATER', 'EARTH'],
  suriElements: ['WATER', 'METAL'],
  yongshin: 'FIRE',
  heeshin: 'WOOD',
  gishin: 'WATER',
  deficiency: ['FIRE', 'WOOD'],
};

let passCount = 0;
let failCount = 0;

function assertCheck(label: string, condition: boolean, details?: string): void {
  if (condition) {
    passCount += 1;
    console.log(`PASS ${label}`);
    return;
  }

  failCount += 1;
  console.error(`FAIL ${label}${details ? ` :: ${details}` : ''}`);
}

function main(): void {
  console.log('=== verify-naming-score-engine ===');

  const good = scoreNameAgainstSaju(GOOD_MATCH_INPUT);
  const caution = scoreNameAgainstSaju(CAUTION_MATCH_INPUT);

  console.table([
    {
      case: 'good-match',
      total: good.total,
      nameElements: good.categories.nameElements.score,
      suriElements: good.categories.suriElements.score,
      deficiencyCoverage: good.categories.deficiencyCoverage.score,
      balance: good.categories.balance.score,
    },
    {
      case: 'caution-match',
      total: caution.total,
      nameElements: caution.categories.nameElements.score,
      suriElements: caution.categories.suriElements.score,
      deficiencyCoverage: caution.categories.deficiencyCoverage.score,
      balance: caution.categories.balance.score,
    },
  ]);

  assertCheck('good match deterministic total', good.total === 88, `actual=${good.total}`);
  assertCheck('caution match deterministic total', caution.total === 22, `actual=${caution.total}`);
  assertCheck(
    'good match total score higher than caution match',
    good.total > caution.total,
    `good=${good.total}, caution=${caution.total}`,
  );
  assertCheck(
    'good match deficiency coverage higher than caution match',
    good.categories.deficiencyCoverage.score > caution.categories.deficiencyCoverage.score,
    `good=${good.categories.deficiencyCoverage.score}, caution=${caution.categories.deficiencyCoverage.score}`,
  );

  if (failCount > 0) {
    console.error(`FAIL summary: pass=${passCount}, fail=${failCount}`);
    process.exit(1);
  }

  console.log(`PASS summary: pass=${passCount}, fail=${failCount}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(`FAIL unexpected error: ${message}`);
  process.exit(1);
}
