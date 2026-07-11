/**
 * test/integration/time-policy-unknown-hour.test.ts
 *
 * Guards unknown-hour handling and report surfacing. Unknown hour is a valid
 * but provisional saju path: the engine uses a noon fallback, labels the
 * uncertainty, and lowers hour-sensitive confidence tiers.
 *
 * Run: npm run test:time-policy
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeSajuSafe } from '../../src/saju-adapter.js';
import { buildFortuneReport } from '../../src/report/buildFortuneReport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const FIXTURE_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/spring_ts_baseline_cases.json');

type Tier = 'definite' | 'practical' | 'candidate' | 'deferred';

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

function tierRank(value: unknown): number {
  if (value === 'definite') return 4;
  if (value === 'practical') return 3;
  if (value === 'candidate') return 2;
  if (value === 'deferred') return 1;
  return 0;
}

function isOneStepDowngraded(known: unknown, unknown: unknown): boolean {
  if (known === 'definite') return unknown === 'practical';
  if (known === 'practical') return unknown === 'candidate';
  return known === unknown;
}

console.log('Unknown-hour time policy regression\n');

const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8')) as {
  readonly fixtures: readonly Array<{ readonly id: string; readonly axis: readonly string[]; readonly birth: any }>;
};
const unknownHourCase = fixture.fixtures.find((row) => row.id === 'fix-11');

check('fix-11 remains the unknown-hour baseline fixture',
  !!unknownHourCase &&
    unknownHourCase.axis.includes('unknown-hour') &&
    unknownHourCase.birth.hour === null,
  `axis=${unknownHourCase?.axis.join(',') ?? 'missing'}`);

const unknownBirth = unknownHourCase?.birth ?? {
  year: 1995,
  month: 8,
  day: 15,
  hour: null,
  minute: 0,
  gender: 'female',
};
const knownNoonBirth = { ...unknownBirth, hour: 12, minute: 0 };

const unknownResult = await analyzeSajuSafe(unknownBirth, {
  sajuTimePolicy: { trueSolarTime: 'off', longitudeCorrection: 'off', yaza: 'off' },
});
const knownNoonResult = await analyzeSajuSafe(knownNoonBirth, {
  sajuTimePolicy: { trueSolarTime: 'off', longitudeCorrection: 'off', yaza: 'off' },
});

const unknownSummary = unknownResult.summary as Record<string, any>;
const knownSummary = knownNoonResult.summary as Record<string, any>;
const unknownNotes = Array.isArray(unknownSummary.partialInterpretation)
  ? unknownSummary.partialInterpretation.map(String)
  : [];
const knownNotes = Array.isArray(knownSummary.partialInterpretation)
  ? knownSummary.partialInterpretation.map(String)
  : [];
const uncertainty = unknownSummary.inputUncertainty?.unknownHour;
const knownUncertainty = knownSummary.inputUncertainty?.unknownHour;

check('unknown hour still runs full saju when year/month/day are present',
  unknownResult.sajuEnabled === true && !!unknownResult.summary.dayMaster.element,
  `sajuEnabled=${unknownResult.sajuEnabled}`);
check('unknown hour uses documented noon fallback',
  unknownResult.summary.timeCorrection.standardHour === 12 &&
    unknownResult.summary.timeCorrection.standardMinute === 0,
  `standard=${unknownResult.summary.timeCorrection.standardHour}:${unknownResult.summary.timeCorrection.standardMinute}`);
check('unknown hour surfaces partial-interpretation note',
  unknownNotes.some((line) =>
    line.includes('12:00') && line.includes('출생 시각을 확정할 수 없습니다')));
check('known noon twin does not surface unknown-time note',
  !knownNotes.some((line) => line.includes('12:00') && line.includes('미상')));
check('unknown hour surfaces typed input uncertainty',
  uncertainty?.fallbackHour === 12 &&
    uncertainty?.fallbackMinute === 0 &&
    uncertainty?.affectedAxes.includes('hourPillar') &&
    uncertainty?.affectedAxes.includes('fortuneTiming'));
check('known noon twin has no unknown-hour uncertainty',
  knownUncertainty == null);

const axisKeys = ['yongshin', 'gyeokguk', 'strength'] as const;
const knownAxis = knownSummary.axisStrength ?? {};
const unknownAxis = unknownSummary.axisStrength ?? {};
const nonIncreasing = axisKeys.every((axis) => tierRank(unknownAxis[axis]) <= tierRank(knownAxis[axis]));

check('unknown hour does not increase hour-sensitive confidence tiers',
  nonIncreasing,
  `known=${JSON.stringify(knownAxis)}, unknown=${JSON.stringify(unknownAxis)}`);

const downgradeProbeKnown = await analyzeSajuSafe({
  year: 1986,
  month: 4,
  day: 19,
  hour: 12,
  minute: 0,
  gender: 'male',
});
const downgradeProbeUnknown = await analyzeSajuSafe({
  year: 1986,
  month: 4,
  day: 19,
  hour: null,
  minute: null,
  gender: 'male',
});
const probeKnownAxis = (downgradeProbeKnown.summary as Record<string, any>).axisStrength ?? {};
const probeUnknownAxis = (downgradeProbeUnknown.summary as Record<string, any>).axisStrength ?? {};
const expectedDowngrade = axisKeys.every((axis) => isOneStepDowngraded(probeKnownAxis[axis] as Tier | undefined, probeUnknownAxis[axis] as Tier | undefined));
const anyChanged = axisKeys.some((axis) => probeUnknownAxis[axis] !== probeKnownAxis[axis]);

check('unknown hour applies one-step confidence downgrade where possible',
  expectedDowngrade && anyChanged,
  `known=${JSON.stringify(probeKnownAxis)}, unknown=${JSON.stringify(probeUnknownAxis)}`);

const unknownHourKnownMinute = await analyzeSajuSafe({
  year: 1986,
  month: 4,
  day: 19,
  hour: null,
  minute: 37,
  gender: 'male',
}, {
  sajuTimePolicy: { trueSolarTime: 'off', longitudeCorrection: 'off', yaza: 'off' },
});
const unknownHourKnownMinuteSummary = unknownHourKnownMinute.summary as Record<string, any>;
const unknownHourKnownMinuteNotes = Array.isArray(unknownHourKnownMinuteSummary.partialInterpretation)
  ? unknownHourKnownMinuteSummary.partialInterpretation.map(String)
  : [];

check('missing hour ignores a stray minute and still uses 12:00',
  unknownHourKnownMinute.summary.timeCorrection.standardHour === 12
    && unknownHourKnownMinute.summary.timeCorrection.standardMinute === 0,
  `standard=${unknownHourKnownMinute.summary.timeCorrection.standardHour}:${unknownHourKnownMinute.summary.timeCorrection.standardMinute}`);
check('missing hour with a supplied minute remains unknown-hour input',
  unknownHourKnownMinuteSummary.inputUncertainty?.unknownHour?.fallbackHour === 12
    && unknownHourKnownMinuteNotes.some((line: string) =>
      line.includes('12:00') && line.includes('분만으로는 출생 시각을 확정할 수 없습니다')));

const knownHourMissingMinute = await analyzeSajuSafe({
  year: 1986,
  month: 4,
  day: 19,
  hour: 5,
  minute: null,
  gender: 'male',
}, {
  sajuTimePolicy: { trueSolarTime: 'off', longitudeCorrection: 'off', yaza: 'off' },
});
const knownHourExactMinute = await analyzeSajuSafe({
  year: 1986,
  month: 4,
  day: 19,
  hour: 5,
  minute: 0,
  gender: 'male',
}, {
  sajuTimePolicy: { trueSolarTime: 'off', longitudeCorrection: 'off', yaza: 'off' },
});
const knownHourMissingMinuteSummary = knownHourMissingMinute.summary as Record<string, any>;
const knownHourExactMinuteSummary = knownHourExactMinute.summary as Record<string, any>;
const knownHourMissingMinuteNotes = Array.isArray(knownHourMissingMinuteSummary.partialInterpretation)
  ? knownHourMissingMinuteSummary.partialInterpretation.map(String)
  : [];

check('known hour with missing minute uses that hour at :00',
  knownHourMissingMinute.summary.timeCorrection.standardHour === 5
    && knownHourMissingMinute.summary.timeCorrection.standardMinute === 0,
  `standard=${knownHourMissingMinute.summary.timeCorrection.standardHour}:${knownHourMissingMinute.summary.timeCorrection.standardMinute}`);
check('known hour with missing minute surfaces an honest minute-only note',
  knownHourMissingMinuteNotes.some((line: string) =>
    line.includes('출생 분이 없어') && line.includes('05:00')));
check('known hour with missing minute is not marked as unknown hour',
  knownHourMissingMinuteSummary.inputUncertainty?.unknownHour == null);
check('known hour with missing minute records the full minute envelope',
  knownHourMissingMinuteSummary.inputUncertainty?.unknownMinute?.fallbackHour === 5
    && knownHourMissingMinuteSummary.inputUncertainty?.unknownMinute?.fallbackMinute === 0
    && knownHourMissingMinuteSummary.inputUncertainty?.unknownMinute?.evaluatedMinuteRange?.from === 0
    && knownHourMissingMinuteSummary.inputUncertainty?.unknownMinute?.evaluatedMinuteRange?.to === 59
    && knownHourMissingMinuteSummary.inputUncertainty?.unknownMinute?.comparedMinutes?.join(',') === '0,59');
check('stable 05:00..05:59 envelope is recorded without a false downgrade',
  knownHourMissingMinuteSummary.inputUncertainty?.unknownMinute?.boundarySensitive === false
    && knownHourMissingMinuteSummary.inputUncertainty?.unknownMinute?.confidenceTierShift === 'none'
    && knownHourMissingMinuteSummary.inputUncertainty?.unknownMinute?.continuousTimingAffected === true
    && knownHourMissingMinuteSummary.inputUncertainty?.unknownMinute?.affectedAxes?.join(',') === 'fortuneTiming'
    && knownHourMissingMinuteSummary.inputUncertainty?.unknownMinute?.message.includes('연속 운세 시점') === true);
check('known hour with missing minute keeps the exact :00 confidence tiers',
  JSON.stringify(knownHourMissingMinuteSummary.axisStrength ?? {})
    === JSON.stringify(knownHourExactMinuteSummary.axisStrength ?? {}),
  `missing=${JSON.stringify(knownHourMissingMinuteSummary.axisStrength ?? {})}, exact=${JSON.stringify(knownHourExactMinuteSummary.axisStrength ?? {})}`);

const boundaryPolicy01 = {
  sajuTimePolicy: { trueSolarTime: 'off' as const, longitudeCorrection: 'on' as const, yaza: 'off' as const },
};
const boundaryMinute01 = await analyzeSajuSafe({
  year: 1986, month: 4, day: 19, hour: 1, minute: null, gender: 'male',
}, boundaryPolicy01);
const boundaryMinute01Summary = boundaryMinute01.summary as Record<string, any>;

check('01시 분 미상은 선택한 경도 보정에서 경계 민감도를 감지한다',
  boundaryMinute01Summary.inputUncertainty?.unknownMinute?.boundarySensitive === true,
  JSON.stringify(boundaryMinute01Summary.inputUncertainty?.unknownMinute));
check('01시 경계 민감도는 실제 영향 축을 열거한다',
  boundaryMinute01Summary.inputUncertainty?.unknownMinute?.affectedAxes?.includes('hourPillar')
    || boundaryMinute01Summary.inputUncertainty?.unknownMinute?.affectedAxes?.includes('fortuneTiming'),
  JSON.stringify(boundaryMinute01Summary.inputUncertainty?.unknownMinute?.affectedAxes));

const boundaryPolicy23 = {
  sajuTimePolicy: {
    trueSolarTime: 'off' as const,
    longitudeCorrection: 'off' as const,
    yaza: 'on' as const,
    yazaMode: '23:30' as const,
  },
};
const boundaryMinute23 = await analyzeSajuSafe({
  year: 1986, month: 4, day: 19, hour: 23, minute: null, gender: 'male',
}, boundaryPolicy23);
const boundaryMinute23Summary = boundaryMinute23.summary as Record<string, any>;

check('23시 분 미상은 23:30 야자 경계 민감도를 감지한다',
  boundaryMinute23Summary.inputUncertainty?.unknownMinute?.boundarySensitive === true,
  JSON.stringify(boundaryMinute23Summary.inputUncertainty?.unknownMinute));
check('23:30 야자 경계는 일주 또는 그 파생 결과를 영향 축으로 기록한다',
  boundaryMinute23Summary.inputUncertainty?.unknownMinute?.affectedAxes?.includes('dayPillar')
    || boundaryMinute23Summary.inputUncertainty?.unknownMinute?.affectedAxes?.includes('tenGod'),
  JSON.stringify(boundaryMinute23Summary.inputUncertainty?.unknownMinute?.affectedAxes));

const stableNeutralMinute = await analyzeSajuSafe({
  year: 1986, month: 4, day: 19, hour: 5, minute: null, gender: 'neutral',
}, {
  sajuTimePolicy: { trueSolarTime: 'off', longitudeCorrection: 'off', yaza: 'off' },
});
const stableNeutralSummary = stableNeutralMinute.summary as Record<string, any>;
check('stable neutral unknown-minute preserves gender-independent fortune contract',
  stableNeutralSummary.inputUncertainty?.unknownMinute?.boundarySensitive === false
    && stableNeutralSummary.inputUncertainty?.unknownMinute?.confidenceTierShift === 'none'
    && stableNeutralSummary.neutralGenderBasis === 'UNKNOWN'
    && stableNeutralSummary.genderDependentFortuneStatus === 'unavailable_neutral_gender'
    && stableNeutralSummary.daeunInfo == null);

const sensitiveNeutralMinute = await analyzeSajuSafe({
  year: 1986, month: 4, day: 19, hour: 23, minute: null, gender: 'neutral',
}, boundaryPolicy23);
const sensitiveNeutralSummary = sensitiveNeutralMinute.summary as Record<string, any>;
check('23:30 neutral unknown-minute detects day boundary without choosing fortune direction',
  sensitiveNeutralSummary.inputUncertainty?.unknownMinute?.boundarySensitive === true
    && sensitiveNeutralSummary.inputUncertainty?.unknownMinute?.affectedAxes?.includes('dayPillar')
    && sensitiveNeutralSummary.neutralGenderBasis === 'UNKNOWN'
    && sensitiveNeutralSummary.genderDependentFortuneStatus === 'unavailable_neutral_gender'
    && sensitiveNeutralSummary.daeunInfo == null,
  JSON.stringify(sensitiveNeutralSummary.inputUncertainty?.unknownMinute));

const invalidTimeCases: readonly Array<{ readonly label: string; readonly hour: unknown; readonly minute: unknown }> = [
  { label: 'hour 24', hour: 24, minute: 0 },
  { label: 'hour 99', hour: 99, minute: 0 },
  { label: 'decimal hour', hour: 5.5, minute: 0 },
  { label: 'garbage hour', hour: 'five', minute: 0 },
  { label: 'numeric-string hour', hour: '5', minute: 0 },
  { label: 'minute 60', hour: 5, minute: 60 },
  { label: 'decimal minute', hour: 5, minute: 30.5 },
  { label: 'garbage minute', hour: 5, minute: 'thirty' },
  { label: 'numeric-string minute', hour: 5, minute: '30' },
];

for (const row of invalidTimeCases) {
  const result = await analyzeSajuSafe({
    year: 1986,
    month: 4,
    day: 19,
    hour: row.hour,
    minute: row.minute,
    gender: 'male',
  } as any);
  check(`provided-invalid ${row.label} fails closed`,
    result.sajuEnabled === false
      && result.analysisStatus === 'failed'
      && result.diagnostics?.[0]?.reasonCode === 'BIRTH_TIME_INVALID'
      && result.diagnostics?.[0]?.message.includes('0~23') === true,
    JSON.stringify(result.diagnostics));
}

const emptyMinuteResult = await analyzeSajuSafe({
  year: 1986, month: 4, day: 19, hour: 5, minute: '', gender: 'male',
} as any, {
  sajuTimePolicy: { trueSolarTime: 'off', longitudeCorrection: 'off', yaza: 'off' },
});
check('empty minute string preserves the established missing-value contract',
  emptyMinuteResult.sajuEnabled === true
    && (emptyMinuteResult.summary as Record<string, any>).inputUncertainty?.unknownMinute != null);

const emptyHourResult = await analyzeSajuSafe({
  year: 1986, month: 4, day: 19, hour: '', minute: '', gender: 'male',
} as any);
check('empty hour/minute strings preserve the established unknown-hour contract',
  emptyHourResult.sajuEnabled === true
    && (emptyHourResult.summary as Record<string, any>).inputUncertainty?.unknownHour != null);

const report = await buildFortuneReport(unknownResult.summary, new Date('2026-05-01T00:00:00+09:00'), null);
const reportUncertainty = report.meta.uncertainties?.find((row) => row.id === 'unknown-hour');
const overviewEvidence = report.overviewSummary.evidence?.find((row) => row.axis === 'inputTime');

check('fortune report meta carries unknown-hour uncertainty',
  reportUncertainty?.fallback?.hour === 12 &&
    reportUncertainty?.fallback?.timezone === 'Asia/Seoul' &&
    reportUncertainty?.affectedAxes.includes('hourPillar'));
check('overview evidence names affected input-time axes',
  overviewEvidence?.strength === 'candidate' &&
    overviewEvidence.supportingFeatures.some((line) => line.includes('영향을 받을 수 있는 항목')));
check('unknown hour marks all four potentially affected pillars provisional',
  report.overviewSummary.pillars.length === 4
    && report.overviewSummary.pillars.every((pillar) => pillar.position.endsWith('(임시)')),
  report.overviewSummary.pillars.map((pillar) => pillar.position).join(','));
check('unknown hour hedges day-master and overall prose with the provisional basis',
  report.overviewSummary.dayMasterDescription.includes('임시 계산 기준')
    && report.overviewSummary.dayMasterDescription.includes('출생 시각 정보')
    && report.overviewSummary.overallSummary.includes('임시 계산 기준 요약')
    && report.overviewSummary.overallSummary.includes('출생 시각 정보'));

const stableMinuteReport = await buildFortuneReport(
  knownHourMissingMinute.summary,
  new Date('2026-05-01T00:00:00+09:00'),
  null,
);
const stableMinuteMeta = stableMinuteReport.meta.uncertainties?.find((row) => row.id === 'unknown-minute');
const stableMinuteEvidence = stableMinuteReport.overviewSummary.evidence?.find((row) =>
  row.axis === 'inputTime' && row.claim.includes('05:00'));
check('stable unknown-minute report meta is informational, not a false warning',
  stableMinuteMeta?.severity === 'info'
    && stableMinuteMeta.boundarySensitive === false
    && stableMinuteMeta.continuousTimingAffected === true
    && stableMinuteMeta.affectedAxes.includes('fortuneTiming')
    && stableMinuteMeta.confidenceTierShift === 'none');
check('stable unknown-minute imputation still surfaces overview evidence',
  stableMinuteEvidence?.strength === 'practical'
    && stableMinuteEvidence.supportingFeatures.some((line) => line.includes('00~59'))
    && stableMinuteEvidence.supportingFeatures.some((line) => line.includes('연속 운세 시점')));

const sensitiveMinuteReport = await buildFortuneReport(
  boundaryMinute23.summary,
  new Date('2026-05-01T00:00:00+09:00'),
  null,
);
const sensitiveMinuteMeta = sensitiveMinuteReport.meta.uncertainties?.find((row) => row.id === 'unknown-minute');
const sensitiveMinuteEvidence = sensitiveMinuteReport.overviewSummary.evidence?.find((row) =>
  row.axis === 'inputTime' && row.claim.includes('23:00'));
check('boundary-sensitive unknown-minute report meta carries affected axes',
  sensitiveMinuteMeta?.severity === 'medium'
    && sensitiveMinuteMeta.boundarySensitive === true
    && (sensitiveMinuteMeta.affectedAxes.includes('dayPillar')
      || sensitiveMinuteMeta.affectedAxes.includes('tenGod')));
check('boundary-sensitive unknown-minute overview evidence is hedged',
  sensitiveMinuteEvidence?.strength === 'candidate');
check('23:30 yaza boundary marks the affected day pillar provisional',
  sensitiveMinuteReport.overviewSummary.pillars.some((pillar) =>
    pillar.position === '일주(임시)'),
  sensitiveMinuteReport.overviewSummary.pillars.map((pillar) => pillar.position).join(','));
check('23:30 yaza boundary hedges day-master and overall prose by minute uncertainty',
  sensitiveMinuteReport.overviewSummary.dayMasterDescription.includes('임시 계산 기준')
    && sensitiveMinuteReport.overviewSummary.dayMasterDescription.includes('출생 분 정보')
    && sensitiveMinuteReport.overviewSummary.overallSummary.includes('임시 계산 기준 요약')
    && sensitiveMinuteReport.overviewSummary.overallSummary.includes('출생 분 정보'));

const tokyoUnknownHourBirth = {
  year: 1986,
  month: 4,
  day: 19,
  hour: null,
  minute: null,
  gender: 'male' as const,
  timezone: 'Asia/Tokyo',
  latitude: 35.6762,
  longitude: 139.6503,
};
const tokyoUnknownHour = await analyzeSajuSafe(tokyoUnknownHourBirth);
const tokyoReport = await buildFortuneReport(
  tokyoUnknownHour.summary,
  new Date('2026-05-01T00:00:00+09:00'),
  null,
  undefined,
  { ...tokyoUnknownHourBirth, timezone: 'Europe/London' },
);
const tokyoMeta = tokyoReport.meta.uncertainties?.find((row) => row.id === 'unknown-hour');
check('report uses adapter-resolved non-Seoul timezone before caller fallback',
  tokyoMeta?.fallback?.timezone === 'Asia/Tokyo',
  `timezone=${tokyoMeta?.fallback?.timezone}`);

const stableUnknownMinute = knownHourMissingMinute.summary.inputUncertainty?.unknownMinute;
const { fallbackTimezone: _legacyMissingTimezone, ...legacyUnknownMinute } = stableUnknownMinute!;
const legacyTimezoneSummary = {
  ...knownHourMissingMinute.summary,
  inputUncertainty: { unknownMinute: legacyUnknownMinute },
};
const legacyTimezoneReport = await buildFortuneReport(
  legacyTimezoneSummary,
  new Date('2026-05-01T00:00:00+01:00'),
  null,
  undefined,
  {
    year: 1986, month: 4, day: 19, hour: 5, minute: null,
    gender: 'male', timezone: 'Europe/London',
  },
);
const legacyTimezoneMeta = legacyTimezoneReport.meta.uncertainties?.find((row) => row.id === 'unknown-minute');
check('legacy uncertainty without timezone falls back to report birth timezone',
  legacyTimezoneMeta?.fallback?.timezone === 'Europe/London',
  `timezone=${legacyTimezoneMeta?.fallback?.timezone}`);

const legacyDefaultTimezoneReport = await buildFortuneReport(
  legacyTimezoneSummary,
  new Date('2026-05-01T00:00:00+09:00'),
  null,
);
const legacyDefaultTimezoneMeta = legacyDefaultTimezoneReport.meta.uncertainties?.find(
  (row) => row.id === 'unknown-minute',
);
check('legacy uncertainty without summary or birth timezone preserves Seoul default',
  legacyDefaultTimezoneMeta?.fallback?.timezone === 'Asia/Seoul');

console.log(`\nUnknown-hour policy check: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
