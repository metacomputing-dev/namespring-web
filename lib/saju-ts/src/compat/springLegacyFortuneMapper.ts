import type {
  LegacyDaeunInfoV1,
  LegacySaeunPillarV1,
  LegacyWolunPillarV1,
} from './springLegacyContract.js';

type FortuneEntry = any;

export interface LegacyFortuneSelection {
  readonly daeunCount?: number;
  readonly saeunStartYear?: number | null;
  readonly saeunYearCount?: number;
  readonly wolunStartYear?: number | null;
  readonly wolunMonthCount?: number;
}

export interface LegacyFortuneMapperDependencies {
  readonly stemCodeFromIdx: (idx: unknown) => string;
  readonly branchCodeFromIdx: (idx: unknown) => string;
  readonly annotateLuckPillar: (
    entry: FortuneEntry,
    dayStemIdx: number,
    yearBranchIdx: number,
    lifeStagePolicy: unknown,
    includeAnnualSignals: boolean,
  ) => Record<string, unknown>;
  readonly formatRelationsWithNatal: (entry: FortuneEntry) => unknown | undefined;
  readonly formatRelationsWithDecade: (entries: FortuneEntry[] | undefined) => unknown | undefined;
  readonly approxDaeunUtcMs: (
    entry: FortuneEntry,
    firstStartUtcMsApprox: number | null,
    decadeLengthYears: number,
    edge: 'start' | 'end',
  ) => number | null;
  readonly roundTo: (value: unknown, digits: number) => number;
}

export interface LegacyFortuneMapperInput {
  readonly fortune: FortuneEntry;
  readonly timeline: FortuneEntry;
  readonly relationTimeline: FortuneEntry;
  readonly dayStemIdx: number;
  readonly yearBranchIdx: number;
  readonly lifeStagePolicy: unknown;
  readonly maxSolarYear: number;
  readonly selection: LegacyFortuneSelection;
  readonly dependencies: LegacyFortuneMapperDependencies;
}

export interface LegacyFortunePayload {
  readonly daeunInfo: LegacyDaeunInfoV1;
  readonly saeunPillars: readonly LegacySaeunPillarV1[];
  readonly wolunPillars: readonly LegacyWolunPillarV1[];
}

function relationEntries(
  source: FortuneEntry,
  key: 'decades' | 'years' | 'months' | 'decadeYears',
): FortuneEntry[] {
  return Array.isArray(source?.[key]) ? source[key] : [];
}

function finiteNumberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function entryStemIdx(entry: FortuneEntry): unknown {
  return entry?.pillar?.stem?.idx ?? entry?.pillar?.stem;
}

function entryBranchIdx(entry: FortuneEntry): unknown {
  return entry?.pillar?.branch?.idx ?? entry?.pillar?.branch;
}

/**
 * Pure compatibility mapper for the fortune portion of LegacySajuOutputV1.
 * Calculation policy stays in the engine; this seam only selects and shapes
 * canonical daeun, saeun, wolun, annotation, and relation data.
 */
export function mapLegacyFortune(input: LegacyFortuneMapperInput): LegacyFortunePayload {
  const {
    fortune,
    timeline,
    relationTimeline,
    dayStemIdx,
    yearBranchIdx,
    lifeStagePolicy,
    maxSolarYear,
    selection,
    dependencies,
  } = input;
  const {
    daeunCount,
    saeunStartYear,
    saeunYearCount,
    wolunStartYear,
    wolunMonthCount,
  } = selection;

  const decadeRelationsByIndex = new Map(
    relationEntries(relationTimeline, 'decades')
      .map((entry) => [Number(entry?.index ?? 0), entry] as const),
  );
  const yearRelationsByYear = new Map(
    relationEntries(relationTimeline, 'years')
      .map((entry) => [Number(entry?.solarYear ?? 0), entry] as const),
  );
  const monthRelationsByKey = new Map<string, FortuneEntry>(
    relationEntries(relationTimeline, 'months').map((entry) => [
      `${Number(entry?.solarYear ?? 0)}:${Number(entry?.monthOrder ?? 0)}`,
      entry,
    ] as const),
  );
  const decadeYearRelationsByYear = new Map<number, FortuneEntry[]>();
  for (const entry of relationEntries(relationTimeline, 'decadeYears')) {
    const year = Number(entry?.solarYear ?? 0);
    if (!Number.isFinite(year) || year === 0) continue;
    const existing = decadeYearRelationsByYear.get(year) ?? [];
    existing.push(entry);
    decadeYearRelationsByYear.set(year, existing);
  }

  const decades = Array.isArray(fortune?.decades) ? fortune.decades : [];
  const firstDaeunStartUtcMsApprox = finiteNumberOrNull(
    fortune?.start?.startUtcMsApprox ?? timeline?.start?.startUtcMsApprox,
  );
  const decadeLengthYears = Number(timeline?.policy?.decadeLengthYears ?? 10);
  const ageDisplayMode = String(
    fortune?.start?.ageDisplay ?? timeline?.policy?.ageDisplay ?? 'continuousFromBirth',
  );
  const ageDisplayLabel = String(
    fortune?.start?.ageDisplayLabel
      ?? (ageDisplayMode === 'koreanCountingAge'
        ? 'Korean counting age by configured year boundary'
        : 'Continuous age from birth'),
  );

  const needsExpandedYears = typeof saeunStartYear === 'number' || typeof saeunYearCount === 'number';
  const needsExpandedMonths = typeof wolunStartYear === 'number' || typeof wolunMonthCount === 'number';
  const yearsSource = needsExpandedYears && Array.isArray(timeline?.years)
    ? timeline.years
    : Array.isArray(fortune?.years) ? fortune.years : [];
  const monthsSource = needsExpandedMonths && Array.isArray(timeline?.months)
    ? timeline.months
    : Array.isArray(fortune?.months) ? fortune.months : [];
  const yearsAll = yearsSource.filter(
    (entry: FortuneEntry) => Number(entry?.solarYear) <= maxSolarYear,
  );
  const monthsAll = monthsSource.filter(
    (entry: FortuneEntry) => Number(entry?.solarYear) <= maxSolarYear,
  );
  const yearsFiltered = typeof saeunStartYear === 'number'
    ? yearsAll.filter((entry: FortuneEntry) => Number(entry?.solarYear) >= saeunStartYear)
    : yearsAll;
  const years = typeof saeunYearCount === 'number' && saeunYearCount > 0
    ? yearsFiltered.slice(0, saeunYearCount)
    : yearsFiltered;
  const monthsFiltered = typeof wolunStartYear === 'number'
    ? monthsAll.filter((entry: FortuneEntry) => Number(entry?.solarYear) >= wolunStartYear)
    : monthsAll;
  const months = typeof wolunMonthCount === 'number' && wolunMonthCount > 0
    ? monthsFiltered.slice(0, wolunMonthCount)
    : monthsFiltered;

  const selectedDecades = typeof daeunCount === 'number' && daeunCount > 0
    ? decades.slice(0, daeunCount)
    : decades;
  const daeunPillars = selectedDecades.map((entry: FortuneEntry) => {
    const approxStartUtcMs = dependencies.approxDaeunUtcMs(
      entry,
      firstDaeunStartUtcMsApprox,
      decadeLengthYears,
      'start',
    );
    const approxEndUtcMs = dependencies.approxDaeunUtcMs(
      entry,
      firstDaeunStartUtcMsApprox,
      decadeLengthYears,
      'end',
    );
    const relationsWithNatal = dependencies.formatRelationsWithNatal(
      decadeRelationsByIndex.get(Number(entry?.index ?? 0)),
    );
    return {
      pillar: {
        cheongan: dependencies.stemCodeFromIdx(entryStemIdx(entry)),
        jiji: dependencies.branchCodeFromIdx(entryBranchIdx(entry)),
      },
      startAge: Number(entry?.startAgeYears ?? 0),
      endAge: Number(entry?.endAgeYears ?? 0),
      order: Number(entry?.index ?? 0),
      displayStartAge: Number(entry?.displayStartAge ?? Math.floor(Number(entry?.startAgeYears ?? 0))),
      displayEndAge: Number(entry?.displayEndAge ?? Math.floor(Number(entry?.endAgeYears ?? 0))),
      ...(approxStartUtcMs !== null ? { approxStartUtcMs } : {}),
      ...(approxEndUtcMs !== null ? { approxEndUtcMs } : {}),
      ...dependencies.annotateLuckPillar(entry, dayStemIdx, yearBranchIdx, lifeStagePolicy, false),
      // An evaluated-empty object is meaningful and must not collapse to undefined.
      ...(relationsWithNatal ? { relationsWithNatal } : {}),
    };
  });

  const saeunPillars = years.map((entry: FortuneEntry) => {
    const year = Number(entry?.solarYear ?? 0);
    const relationsWithNatal = dependencies.formatRelationsWithNatal(yearRelationsByYear.get(year));
    const relationsWithDecade = dependencies.formatRelationsWithDecade(decadeYearRelationsByYear.get(year));
    return {
      year,
      pillar: {
        cheongan: dependencies.stemCodeFromIdx(entryStemIdx(entry)),
        jiji: dependencies.branchCodeFromIdx(entryBranchIdx(entry)),
      },
      startUtcMs: Number.isFinite(entry?.startUtcMs) ? Number(entry.startUtcMs) : null,
      endUtcMs: Number.isFinite(entry?.endUtcMs) ? Number(entry.endUtcMs) : null,
      approxStartAgeYears: Number.isFinite(entry?.approxStartAgeYears) ? Number(entry.approxStartAgeYears) : null,
      approxEndAgeYears: Number.isFinite(entry?.approxEndAgeYears) ? Number(entry.approxEndAgeYears) : null,
      ...dependencies.annotateLuckPillar(entry, dayStemIdx, yearBranchIdx, lifeStagePolicy, true),
      ...(relationsWithNatal ? { relationsWithNatal } : {}),
      ...(relationsWithDecade ? { relationsWithDecade } : {}),
    };
  });

  const wolunPillars = months.map((entry: FortuneEntry) => {
    const relationKey = `${Number(entry?.solarYear ?? 0)}:${Number(entry?.monthOrder ?? 0)}`;
    const relationsWithNatal = dependencies.formatRelationsWithNatal(monthRelationsByKey.get(relationKey));
    return {
      year: Number(entry?.solarYear ?? 0),
      monthOrder: Number(entry?.monthOrder ?? 0),
      startJie: String(entry?.startJie ?? ''),
      pillar: {
        cheongan: dependencies.stemCodeFromIdx(entryStemIdx(entry)),
        jiji: dependencies.branchCodeFromIdx(entryBranchIdx(entry)),
      },
      startUtcMs: Number.isFinite(entry?.startUtcMs) ? Number(entry.startUtcMs) : null,
      endUtcMs: Number.isFinite(entry?.endUtcMs) ? Number(entry.endUtcMs) : null,
      approxStartAgeYears: Number.isFinite(entry?.approxStartAgeYears) ? Number(entry.approxStartAgeYears) : null,
      approxEndAgeYears: Number.isFinite(entry?.approxEndAgeYears) ? Number(entry.approxEndAgeYears) : null,
      ...dependencies.annotateLuckPillar(entry, dayStemIdx, yearBranchIdx, lifeStagePolicy, false),
      ...(relationsWithNatal ? { relationsWithNatal } : {}),
    };
  });

  return {
    daeunInfo: {
      isForward: String(fortune?.start?.direction ?? 'FORWARD') !== 'BACKWARD',
      firstDaeunStartAge: Number(fortune?.start?.startAgeYears ?? 0),
      firstDaeunStartAgeDisplay: Number(
        fortune?.start?.startAgeDisplay ?? Math.floor(Number(fortune?.start?.startAgeYears ?? 0)),
      ),
      ageDisplayMode,
      ageDisplayLabel,
      firstDaeunStartMonths: Number(fortune?.start?.startAgeParts?.months ?? 0),
      boundaryMode: String(fortune?.start?.boundary?.id ?? ''),
      boundaryUtcMs: fortune?.start?.boundary?.utcMs ?? null,
      deltaDays: Number.isFinite(fortune?.start?.deltaMs)
        ? dependencies.roundTo(Number(fortune.start.deltaMs) / 86_400_000, 3)
        : null,
      formula: String(fortune?.start?.formula ?? ''),
      warnings: [],
      daeunPillars,
    },
    saeunPillars,
    wolunPillars,
  };
}
