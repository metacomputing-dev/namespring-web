import fs from 'node:fs';

const AUTHORITY_SCOPE = 'historical_observation_only' as const;
const CLASSIFICATION = 'HISTORICAL_PHASE_P_OBSERVATION' as const;

type SourceKey = 'lecture' | 'jonheom' | 'korean_modern';
type RuleMode = 'monthly_main' | 'jungki_transparent' | 'composite_classical';
type HistoricalLabelTier =
  | 'phase_p_authored_interpretation_label'
  | 'phase_p_primary_text_label';

interface Cell {
  readonly pass: number;
  readonly comparable: number;
  readonly statedPercent: number;
}

interface Coverage {
  readonly covered: number;
  readonly comparable: number;
}

const SOURCE_KEYS = [
  'lecture',
  'jonheom',
  'korean_modern',
] as const satisfies readonly SourceKey[];

const SOURCE_LABELS: Readonly<Record<SourceKey, string>> = Object.freeze({
  lecture: 'lecture',
  jonheom: 'jonheom',
  korean_modern: 'korean_modern_figures_and_chumyeongga',
});

const HISTORICAL_LABEL_TIER_BY_SOURCE: Readonly<
  Record<SourceKey, HistoricalLabelTier>
> = Object.freeze({
  lecture: 'phase_p_authored_interpretation_label',
  jonheom: 'phase_p_primary_text_label',
  korean_modern: 'phase_p_authored_interpretation_label',
});

const PHASE_P_ROW_BY_MODE: Readonly<Record<RuleMode, string>> = Object.freeze({
  monthly_main: 'monthly_main',
  jungki_transparent: 'jungki_transparent',
  composite_classical: 'monthly_main',
});

const HISTORICAL_COVERAGE_BY_SOURCE: Readonly<
  Record<SourceKey, Coverage>
> = Object.freeze({
  lecture: Object.freeze({ covered: 14, comparable: 14 }),
  jonheom: Object.freeze({ covered: 3, comparable: 6 }),
  korean_modern: Object.freeze({ covered: 6, comparable: 7 }),
});

const HISTORICAL_FLOORS = Object.freeze({
  monthlyMain: Object.freeze({ minPass: 17, comparable: 27 }),
  compositeNet: Object.freeze({ minNetVsMonthlyMain: 0 }),
  totalCoverage: Object.freeze({ minCovered: 23, comparable: 27 }),
  byHistoricalLabelTier: Object.freeze({
    phase_p_authored_interpretation_label:
      Object.freeze({ minCovered: 20, comparable: 21 }),
    phase_p_primary_text_label:
      Object.freeze({ minCovered: 3, comparable: 6 }),
  }),
  bySourceGroup: Object.freeze({
    lecture: Object.freeze({ minCovered: 14, comparable: 14 }),
    jonheom: Object.freeze({ minCovered: 3, comparable: 6 }),
    korean_modern_figures_and_chumyeongga:
      Object.freeze({ minCovered: 6, comparable: 7 }),
  }),
});

function parseRow(text: string, row: string, sourcePath: string): readonly Cell[] {
  const line = text.split(/\r?\n/u)
    .find((candidate) => candidate.trim().startsWith(row));
  if (!line) throw new Error(`Cannot find ${row} in ${sourcePath}`);
  const matches = [
    ...line.matchAll(/(\d+)\s*\/\s*(\d+)\s*\((\d+(?:\.\d+)?)%\)/gu),
  ];
  if (matches.length !== 4) {
    throw new Error(`Cannot parse ${row} table row in ${sourcePath}`);
  }
  return matches.map((match) => ({
    pass: Number(match[1]),
    comparable: Number(match[2]),
    statedPercent: Number(match[3]),
  }));
}

function scoped<T extends Readonly<Record<string, unknown>>>(
  value: T,
): T & {
  readonly authorityScope: typeof AUTHORITY_SCOPE;
  readonly releaseEligible: false;
} {
  return {
    ...value,
    authorityScope: AUTHORITY_SCOPE,
    releaseEligible: false,
  };
}

function summary(
  pass: number,
  comparable: number,
  statedPercent?: number,
  extra: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  const computedPassRate = comparable > 0
    ? Number(((pass / comparable) * 100).toFixed(1))
    : null;
  const passRate = statedPercent ?? computedPassRate;
  return scoped({
    total: comparable,
    pass,
    partial: 0,
    diff: comparable - pass,
    na: 0,
    comparable,
    passRate,
    computedPassRate,
    passOrPartialRate: passRate,
    ...extra,
  });
}

function winLoss(
  current: Pick<Cell, 'pass' | 'comparable'>,
  baseline: Pick<Cell, 'pass' | 'comparable'>,
): Readonly<Record<string, unknown>> {
  const passDelta = current.pass - baseline.pass;
  const currentRate = current.comparable > 0
    ? current.pass / current.comparable
    : null;
  const baselineRate = baseline.comparable > 0
    ? baseline.pass / baseline.comparable
    : null;
  return scoped({
    wins: Math.max(0, passDelta),
    losses: Math.max(0, -passDelta),
    net: passDelta,
    passDelta,
    passRateDelta: currentRate == null || baselineRate == null
      ? null
      : Number(((currentRate - baselineRate) * 100).toFixed(1)),
    baselineMode: 'monthly_main',
  });
}

function coverage(value: Coverage): Readonly<Record<string, unknown>> {
  return scoped({
    covered: value.covered,
    comparable: value.comparable,
    coverageRate: value.comparable > 0
      ? Number(((value.covered / value.comparable) * 100).toFixed(1))
      : null,
    coverageMode:
      'historical_phase_p_label_present_in_evidence_candidates',
  });
}

function nonRegression(
  observation: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return scoped({
    observed: Number(observation.net) >= 0,
    baselineMode: 'monthly_main',
    basis:
      'historical selected agreement only; composite candidates are observation-only',
  });
}

function aggregateCoverageByHistoricalLabelTier(): Record<
  HistoricalLabelTier,
  Coverage
> {
  const result: Record<HistoricalLabelTier, Coverage> = {
    phase_p_authored_interpretation_label: { covered: 0, comparable: 0 },
    phase_p_primary_text_label: { covered: 0, comparable: 0 },
  };
  for (const sourceKey of SOURCE_KEYS) {
    const labelTier = HISTORICAL_LABEL_TIER_BY_SOURCE[sourceKey];
    const before = result[labelTier];
    const add = HISTORICAL_COVERAGE_BY_SOURCE[sourceKey];
    result[labelTier] = {
      covered: before.covered + add.covered,
      comparable: before.comparable + add.comparable,
    };
  }
  return result;
}

function aggregateCoverageTotal(): Coverage {
  return SOURCE_KEYS.reduce<Coverage>(
    (total, sourceKey) => ({
      covered: total.covered + HISTORICAL_COVERAGE_BY_SOURCE[sourceKey].covered,
      comparable:
        total.comparable + HISTORICAL_COVERAGE_BY_SOURCE[sourceKey].comparable,
    }),
    { covered: 0, comparable: 0 },
  );
}

function observationCheck(
  id: string,
  description: string,
  meetsHistoricalFloor: boolean,
  actual: Readonly<Record<string, number | null>>,
  historicalFloor: Readonly<Record<string, number>>,
): Readonly<Record<string, unknown>> {
  return scoped({
    id,
    description,
    meetsHistoricalFloor,
    actual,
    historicalFloor,
  });
}

/**
 * Replays Phase P as a historical observation. Historical label tiers do not
 * re-certify current evidence and this result can never authorize release.
 */
export function buildRuleModeBreakdown(
  phasePResultsPath: string,
): Readonly<Record<string, unknown>> {
  const phaseP = fs.readFileSync(phasePResultsPath, 'utf-8');
  const coverageByLabelTier = aggregateCoverageByHistoricalLabelTier();
  const coverageTotal = aggregateCoverageTotal();
  const defaultCells = parseRow(
    phaseP,
    PHASE_P_ROW_BY_MODE.monthly_main,
    phasePResultsPath,
  );

  const defaultByLabelTier: Record<
    HistoricalLabelTier,
    { pass: number; comparable: number }
  > = {
    phase_p_authored_interpretation_label: { pass: 0, comparable: 0 },
    phase_p_primary_text_label: { pass: 0, comparable: 0 },
  };
  SOURCE_KEYS.forEach((sourceKey, index) => {
    const labelTier = HISTORICAL_LABEL_TIER_BY_SOURCE[sourceKey];
    defaultByLabelTier[labelTier].pass += defaultCells[index].pass;
    defaultByLabelTier[labelTier].comparable +=
      defaultCells[index].comparable;
  });

  const modes: Partial<Record<RuleMode, Record<string, unknown>>> = {};
  for (const [mode, phasePRow] of Object.entries(
    PHASE_P_ROW_BY_MODE,
  ) as Array<[RuleMode, string]>) {
    const cells = parseRow(phaseP, phasePRow, phasePResultsPath);
    const bySourceGroup: Record<string, Record<string, unknown>> = {};
    const byLabelTier: Record<
      HistoricalLabelTier,
      { pass: number; comparable: number }
    > = {
      phase_p_authored_interpretation_label: { pass: 0, comparable: 0 },
      phase_p_primary_text_label: { pass: 0, comparable: 0 },
    };

    SOURCE_KEYS.forEach((sourceKey, index) => {
      const cell = cells[index];
      const sourceLabel = SOURCE_LABELS[sourceKey];
      const labelTier = HISTORICAL_LABEL_TIER_BY_SOURCE[sourceKey];
      bySourceGroup[sourceLabel] = summary(
        cell.pass,
        cell.comparable,
        cell.statedPercent,
        {
          historicalWinLossVsMonthlyMain: winLoss(
            cell,
            defaultCells[index],
          ),
          ...(mode === 'composite_classical'
            ? {
                historicalCandidateCoverage: coverage(
                  HISTORICAL_COVERAGE_BY_SOURCE[sourceKey],
                ),
              }
            : {}),
        },
      );
      byLabelTier[labelTier].pass += cell.pass;
      byLabelTier[labelTier].comparable += cell.comparable;
    });

    const labelTierSummary: Record<
      HistoricalLabelTier,
      Record<string, unknown>
    > = {} as Record<HistoricalLabelTier, Record<string, unknown>>;
    for (const [labelTier, bucket] of Object.entries(byLabelTier) as Array<
      [HistoricalLabelTier, { pass: number; comparable: number }]
    >) {
      const delta = winLoss(bucket, defaultByLabelTier[labelTier]);
      labelTierSummary[labelTier] = summary(
        bucket.pass,
        bucket.comparable,
        undefined,
        {
          historicalWinLossVsMonthlyMain: delta,
          ...(mode === 'composite_classical'
            ? {
                historicalCandidateCoverage:
                  coverage(coverageByLabelTier[labelTier]),
                historicalNonRegressionVsMonthlyMain:
                  nonRegression(delta),
              }
            : {}),
        },
      );
    }

    const totalCell = cells[3];
    const totalDelta = winLoss(totalCell, defaultCells[3]);
    modes[mode] = summary(
      totalCell.pass,
      totalCell.comparable,
      totalCell.statedPercent,
      {
        phasePSourceRow: phasePRow,
        measurementClassification: CLASSIFICATION,
        ...(mode === 'composite_classical'
          ? {
              selectedAgreementMode: 'monthly_main',
              selectionPolicy: 'historical_evidence_only_never_promote',
              historicalCandidateCoverage: coverage(coverageTotal),
              historicalNonRegressionVsMonthlyMain:
                nonRegression(totalDelta),
            }
          : {}),
        historicalWinLossVsMonthlyMain: totalDelta,
        byHistoricalLabelTier: labelTierSummary,
        bySourceGroup,
      },
    );
  }

  const monthlyMain = modes.monthly_main;
  const composite = modes.composite_classical;
  if (!monthlyMain || !composite) {
    throw new Error('Phase-P mode reconstruction is incomplete');
  }
  const compositeDelta =
    composite.historicalWinLossVsMonthlyMain as Record<string, unknown>;
  const compositeCoverage =
    composite.historicalCandidateCoverage as Record<string, unknown>;
  const compositeByLabelTier =
    composite.byHistoricalLabelTier as Record<
      HistoricalLabelTier,
      Record<string, unknown>
    >;
  const compositeBySourceGroup =
    composite.bySourceGroup as Record<string, Record<string, unknown>>;

  const checks: Array<Readonly<Record<string, unknown>>> = [
    observationCheck(
      'monthly_main_historical_selected_agreement',
      'The recorded Phase-P monthly_main row is compared with its historical floor.',
      Number(monthlyMain.pass) >= HISTORICAL_FLOORS.monthlyMain.minPass &&
        monthlyMain.comparable === HISTORICAL_FLOORS.monthlyMain.comparable,
      {
        pass: Number(monthlyMain.pass),
        comparable: Number(monthlyMain.comparable),
      },
      HISTORICAL_FLOORS.monthlyMain,
    ),
    observationCheck(
      'composite_historical_selected_non_regression',
      'The observation-only composite row is compared with the recorded monthly_main row.',
      Number(compositeDelta.net) >=
        HISTORICAL_FLOORS.compositeNet.minNetVsMonthlyMain,
      { netVsMonthlyMain: Number(compositeDelta.net) },
      HISTORICAL_FLOORS.compositeNet,
    ),
    observationCheck(
      'composite_historical_total_candidate_coverage',
      'Historical Phase-P label visibility is compared with the recorded total floor.',
      Number(compositeCoverage.covered) >=
          HISTORICAL_FLOORS.totalCoverage.minCovered &&
        compositeCoverage.comparable ===
          HISTORICAL_FLOORS.totalCoverage.comparable,
      {
        covered: Number(compositeCoverage.covered),
        comparable: Number(compositeCoverage.comparable),
      },
      HISTORICAL_FLOORS.totalCoverage,
    ),
  ];

  for (const [labelTier, floor] of Object.entries(
    HISTORICAL_FLOORS.byHistoricalLabelTier,
  ) as Array<
    [HistoricalLabelTier, { minCovered: number; comparable: number }]
  >) {
    const observed = compositeByLabelTier[labelTier]
      .historicalCandidateCoverage as Record<string, unknown>;
    checks.push(observationCheck(
      `composite_historical_label_tier_${labelTier}_coverage`,
      `${labelTier} is a Phase-P label grouping, not a current source-tier certification.`,
      Number(observed.covered) >= floor.minCovered &&
        observed.comparable === floor.comparable,
      {
        covered: Number(observed.covered),
        comparable: Number(observed.comparable),
      },
      floor,
    ));
  }

  for (const [sourceGroup, floor] of Object.entries(
    HISTORICAL_FLOORS.bySourceGroup,
  )) {
    const observed = compositeBySourceGroup[sourceGroup]
      .historicalCandidateCoverage as Record<string, unknown>;
    checks.push(observationCheck(
      `composite_historical_source_group_${sourceGroup}_coverage`,
      `${sourceGroup} historical label visibility is observation-only.`,
      Number(observed.covered) >= floor.minCovered &&
        observed.comparable === floor.comparable,
      {
        covered: Number(observed.covered),
        comparable: Number(observed.comparable),
      },
      floor,
    ));
  }

  const historicalLabelTierDashboard = Object.fromEntries(
    Object.entries(compositeByLabelTier).map(([labelTier, bucket]) => {
      const candidateCoverage =
        bucket.historicalCandidateCoverage as Record<string, unknown>;
      const nonRegressionObservation =
        bucket.historicalNonRegressionVsMonthlyMain as Record<string, unknown>;
      return [
        labelTier,
        scoped({
          historicalSelectedAgreement: {
            pass: bucket.pass,
            comparable: bucket.comparable,
            passRate: bucket.passRate,
          },
          historicalCandidateCoverage: candidateCoverage,
          nonRegressionObservation,
        }),
      ];
    }),
  );

  return {
    metric:
      'historical Phase-P gyeokguk label agreement by rule-mode candidate',
    authorityScope: AUTHORITY_SCOPE,
    releaseEligible: false,
    note:
      'This is a historical Phase-P observation only. Its label tiers, agreement counts, and candidate coverage do not describe current source eligibility, do not authenticate authority, and cannot produce a release decision.',
    source: 'test/baseline/PHASE_P_RESULTS.md',
    historicalCompositeObservation: {
      classification: CLASSIFICATION,
      authorityScope: AUTHORITY_SCOPE,
      releaseEligible: false,
      allHistoricalFloorsObserved: checks.every(
        (check) => check.meetsHistoricalFloor === true,
      ),
      historicalFloors: HISTORICAL_FLOORS,
      checks,
      historicalLabelTierDashboard,
    },
    modes,
  };
}
