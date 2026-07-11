import {
  analyzeSaju,
  analyzeSajuSafe,
  buildSajuContext,
  emptySaju,
  resolveNeutralGenderAnalysis,
} from '../../src/saju-adapter.js';
import type { SajuAnalysisReasonCode, SajuSummary } from '../../src/types.js';

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean, evidence?: string): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${label}`);
    return;
  }
  fail += 1;
  console.error(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
}

function assertFailureMapping(
  reasonCode: SajuAnalysisReasonCode,
  expectedStatus: 'unavailable' | 'partial' | 'failed',
): void {
  const summary = emptySaju(reasonCode);
  const diagnostic = summary.diagnostics?.[0];
  const context = buildSajuContext(summary);
  check(`${reasonCode}: status`, summary.analysisStatus === expectedStatus, String(summary.analysisStatus));
  check(`${reasonCode}: reason code`, diagnostic?.reasonCode === reasonCode, diagnostic?.reasonCode);
  check(`${reasonCode}: empty summary has no fabricated yongshin`, summary.yongshin.element === '');
  check(`${reasonCode}: failure cannot create a scoring context`, context.output === null);
  check(`${reasonCode}: failure distribution stays empty`,
    Object.values(context.dist).every((value) => value === 0));
  check(`${reasonCode}: safe message`,
    typeof diagnostic?.message === 'string'
      && diagnostic.message.length > 0
      && !diagnostic.message.includes('Error')
      && !diagnostic.message.includes('\\'),
    diagnostic?.message);
}

console.log('Adapter failure diagnostics regression\n');

function successfulSummary(confidence: number): SajuSummary {
  const base = emptySaju();
  return {
    ...base,
    dayMaster: { stem: 'GAP', element: 'WOOD', polarity: 'YANG' },
    yongshin: { ...base.yongshin, confidence },
  };
}

const success = await analyzeSajuSafe({
  year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male',
});
check('successful analysis remains enabled', success.sajuEnabled === true);
check('successful summary does not gain analysisStatus', !('analysisStatus' in success.summary));
check('successful safe result does not gain diagnostics', !('diagnostics' in success));
check('successful analysis creates a scoring context',
  buildSajuContext(success.summary).output !== null);
const provenanceCandidate = success.summary.gyeokguk.candidates?.[0];
check('candidate keeps the upstream human interpretation',
  provenanceCandidate?.sourceTier.humanInterpretation.startsWith('Derived from saju-ts') === true,
  provenanceCandidate?.sourceTier.humanInterpretation);
check('candidate keeps the upstream copyright note',
  provenanceCandidate?.sourceTier.copyrightNote.startsWith('No quoted source text') === true,
  provenanceCandidate?.sourceTier.copyrightNote);

const missing = await analyzeSajuSafe({ gender: 'neutral' });
check('missing birth input remains disabled', missing.sajuEnabled === false);
check('missing input exposes partial status on summary and safe result',
  missing.analysisStatus === 'partial' && missing.summary.analysisStatus === 'partial');
check('missing input preserves structured reason',
  missing.diagnostics?.[0]?.reasonCode === 'BIRTH_INPUT_INSUFFICIENT'
    && missing.summary.diagnostics?.[0]?.reasonCode === 'BIRTH_INPUT_INSUFFICIENT');

const unsupportedLunar = await analyzeSajuSafe({
  year: 1850, month: 1, day: 1, hour: 12, minute: 0,
  gender: 'female', calendarType: 'lunar',
});
check('unsupported lunar conversion is unavailable',
  unsupportedLunar.analysisStatus === 'unavailable'
    && unsupportedLunar.diagnostics?.[0]?.reasonCode === 'LUNAR_CONVERSION_UNAVAILABLE');

const maleSummary = successfulSummary(0.72);
const femaleSummary = successfulSummary(0.72);
const completeNeutral = resolveNeutralGenderAnalysis(
  (gender) => gender === 'MALE' ? maleSummary : femaleSummary,
);
check('complete neutral comparison does not choose an arbitrary gender basis',
  completeNeutral.basis === null
    && completeNeutral.summary !== maleSummary
    && completeNeutral.summary.daeunInfo === null);
check('complete neutral comparison keeps the success payload free of failure metadata',
  !('analysisStatus' in completeNeutral.summary) && !('diagnostics' in completeNeutral.summary));
check('complete neutral note states that gender-dependent fortune was not selected',
  completeNeutral.interpretationNote?.includes('임의로 선택하지 않았습니다') === true);

const mismatchedNeutral = resolveNeutralGenderAnalysis(
  (gender) => gender === 'MALE' ? maleSummary : successfulSummary(0.81),
);
check('neutral natal mismatch fails closed instead of choosing by confidence',
  mismatchedNeutral.basis === null
    && mismatchedNeutral.summary.analysisStatus === 'failed'
    && mismatchedNeutral.summary.diagnostics?.[0]?.reasonCode === 'NEUTRAL_GENDER_NATAL_MISMATCH');

const realNeutral = await analyzeSaju({
  year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'neutral',
});
check('real neutral analysis preserves natal analysis without daeun direction',
  realNeutral.dayMaster.stem !== ''
    && realNeutral.daeunInfo === null
    && realNeutral.neutralGenderBasis === 'UNKNOWN'
    && realNeutral.genderDependentFortuneStatus === 'unavailable_neutral_gender');
check('real neutral saeun rows exclude gender-dependent decade relations',
  realNeutral.saeunPillars?.every((row) => row.relationsWithDecade === undefined) === true);

const partialNeutral = resolveNeutralGenderAnalysis((gender) => {
  if (gender === 'FEMALE') throw new Error('synthetic female-path failure');
  return maleSummary;
});
check('one-sided neutral comparison is explicitly partial',
  partialNeutral.summary.analysisStatus === 'partial'
    && partialNeutral.summary.diagnostics?.[0]?.reasonCode === 'NEUTRAL_GENDER_ANALYSIS_PARTIAL');
check('one-sided neutral comparison records only the completed basis',
  partialNeutral.basis === null
    && partialNeutral.completedGenders.length === 1
    && partialNeutral.completedGenders[0] === 'MALE'
    && partialNeutral.summary.daeunInfo === null);
check('one-sided neutral comparison keeps a usable day-master payload',
  typeof partialNeutral.summary.dayMaster?.element === 'string'
    && partialNeutral.summary.dayMaster.element.length > 0);
check('one-sided neutral note names the incomplete path without claiming both completed',
  partialNeutral.interpretationNote?.includes('여성 기준 계산은 완료되지 않았습니다') === true
    && !partialNeutral.interpretationNote.includes('남녀 기준을 모두 계산'));
check('one-sided neutral analysis cannot create a scoring context',
  buildSajuContext(partialNeutral.summary).output === null);

for (const code of [
  'SAJU_INVALID_SCHOOL_PRESET_SELECTOR',
  'SAJU_UNKNOWN_SCHOOL_PRESET',
  'SAJU_BRIDGE_CONTRACT_MISMATCH',
] as const) {
  let propagated: unknown = null;
  try {
    resolveNeutralGenderAnalysis(() => {
      throw Object.assign(new Error('synthetic global failure'), { code });
    });
  } catch (error) {
    propagated = error;
  }
  check(`neutral comparison propagates global error ${code}`,
    (propagated as { code?: unknown } | null)?.code === code);
}

const unknownPreset = await analyzeSajuSafe({
  year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male',
}, {
  precisionConfig: { sajuSchoolId: 'missing.school.for-diagnostic-test' },
} as any);
check('unknown school preset remains disabled and preserves its structured reason',
  unknownPreset.sajuEnabled === false
    && unknownPreset.analysisStatus === 'failed'
    && unknownPreset.diagnostics?.[0]?.reasonCode === 'SAJU_UNKNOWN_SCHOOL_PRESET');
check('unknown school preset diagnostic exposes only a safe message',
  unknownPreset.diagnostics?.[0]?.message.includes('missing.school') === false);
check('unknown school preset cannot create a scoring context',
  buildSajuContext(unknownPreset.summary).output === null);

const neutralUnknownPreset = await analyzeSajuSafe({
  year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'neutral',
}, {
  precisionConfig: { sajuSchoolId: 'missing.school.for-neutral-diagnostic-test' },
} as any);
check('neutral request preserves a shared unknown-school failure',
  neutralUnknownPreset.analysisStatus === 'failed'
    && neutralUnknownPreset.diagnostics?.[0]?.reasonCode === 'SAJU_UNKNOWN_SCHOOL_PRESET');

const invalidPresetSelector = await analyzeSajuSafe({
  year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male',
}, {
  sajuConfig: { school: { id: 123 } },
} as any);
check('malformed school preset selector preserves its structured configuration reason',
  invalidPresetSelector.sajuEnabled === false
    && invalidPresetSelector.analysisStatus === 'failed'
    && invalidPresetSelector.diagnostics?.[0]?.reasonCode === 'SAJU_INVALID_SCHOOL_PRESET_SELECTOR');
check('malformed school preset selector diagnostic exposes only a safe message',
  invalidPresetSelector.diagnostics?.[0]?.message.includes('123') === false);

const neutralInvalidPresetSelector = await analyzeSajuSafe({
  year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'neutral',
}, {
  sajuConfig: { school: { id: 123 } },
} as any);
check('neutral request preserves a shared malformed-preset failure',
  neutralInvalidPresetSelector.analysisStatus === 'failed'
    && neutralInvalidPresetSelector.diagnostics?.[0]?.reasonCode === 'SAJU_INVALID_SCHOOL_PRESET_SELECTOR');

assertFailureMapping('SAJU_MODULE_UNAVAILABLE', 'unavailable');
assertFailureMapping('BIRTH_DATE_INVALID', 'failed');
assertFailureMapping('BIRTH_TIME_INVALID', 'failed');
assertFailureMapping('LUNAR_INPUT_INSUFFICIENT', 'partial');
assertFailureMapping('NEUTRAL_GENDER_ANALYSIS_PARTIAL', 'partial');
assertFailureMapping('NEUTRAL_GENDER_NATAL_MISMATCH', 'failed');
assertFailureMapping('NEUTRAL_GENDER_ANALYSIS_FAILED', 'failed');
assertFailureMapping('SAJU_INVALID_SCHOOL_PRESET_SELECTOR', 'failed');
assertFailureMapping('SAJU_UNKNOWN_SCHOOL_PRESET', 'failed');
assertFailureMapping('SAJU_BRIDGE_CONTRACT_MISMATCH', 'failed');
assertFailureMapping('SAJU_CALCULATION_FAILED', 'failed');

console.log(`\nAdapter failure diagnostics: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
