import {
  assertLegacySajuOutputV1Contract,
  assertSajuModuleContract,
  assertSajuNaeumCapability,
  assertSajuPalaceCapability,
  SajuBridgeContractMismatchError,
} from '../../src/saju-bridge-contract.js';
import { extractSaju } from '../../src/saju-adapter.js';
import { createLegacySajuOutputFixture } from '../helpers/legacy-saju-output.js';

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}`);
  }
}

function rejectsContract(action: () => unknown): boolean {
  try {
    action();
    return false;
  } catch (error) {
    return error instanceof SajuBridgeContractMismatchError
      && error.code === 'SAJU_BRIDGE_CONTRACT_MISMATCH';
  }
}

function firstHiddenStem(output: any): any {
  const position = Object.values(output.tenGodAnalysis.byPosition)
    .find((entry: any) => Array.isArray(entry?.hiddenStems) && entry.hiddenStems.length > 0) as any;
  if (!position) throw new Error('Expected a ten-god position with hidden stems');
  return position.hiddenStems[0];
}

function anotherTenGod(current: string): string {
  return current === 'BI_GYEON' ? 'JEONG_IN' : 'BI_GYEON';
}

const LEGACY_STEM_CODES = [
  'GAP', 'EUL', 'BYEONG', 'JEONG', 'MU',
  'GI', 'GYEONG', 'SIN', 'IM', 'GYE',
] as const;
const LEGACY_TEN_GOD_ALIAS: Readonly<Record<string, string>> = {
  GEOB_JAE: 'GYEOB_JAE',
  SIK_SHIN: 'SIK_SIN',
};

console.log('Saju bridge runtime contract\n');

const modulePath = '../../../saju-ts/dist/index.js';
const actualModule: unknown = await import(modulePath);
assertSajuModuleContract(actualModule);
assertSajuPalaceCapability(actualModule);
assertSajuNaeumCapability(actualModule);
check('real built module satisfies core and optional capability contracts', true);
const producerTenGodOf = (actualModule as any).tenGodOf;
if (typeof producerTenGodOf !== 'function') {
  throw new Error('Expected the built producer to export tenGodOf');
}

const validOutput = await createLegacySajuOutputFixture();
assertLegacySajuOutputV1Contract(validOutput);
check('real producer output satisfies the V1 runtime contract', true);

for (const dayMaster of LEGACY_STEM_CODES) {
  for (const otherStem of LEGACY_STEM_CODES) {
    const output = structuredClone(validOutput) as any;
    output.pillars.day.cheongan = dayMaster;
    output.pillars.year.cheongan = otherStem;
    output.tenGodAnalysis.dayMaster = dayMaster;
    for (const [position, pillarKey] of [
      ['YEAR', 'year'],
      ['MONTH', 'month'],
      ['DAY', 'day'],
      ['HOUR', 'hour'],
    ] as const) {
      const positionInfo = output.tenGodAnalysis.byPosition[position];
      const relationship = (stem: string): string => {
        const raw = producerTenGodOf(
          LEGACY_STEM_CODES.indexOf(dayMaster),
          LEGACY_STEM_CODES.indexOf(stem as (typeof LEGACY_STEM_CODES)[number]),
        );
        return LEGACY_TEN_GOD_ALIAS[raw] ?? raw;
      };
      positionInfo.cheonganSipseong = relationship(output.pillars[pillarKey].cheongan);
      positionInfo.jijiPrincipalSipseong = relationship(positionInfo.hiddenStems[0].stem);
      positionInfo.hiddenStemSipseong.forEach((entry: any) => {
        entry.sipseong = relationship(entry.entry.stem);
      });
    }
    assertLegacySajuOutputV1Contract(output);
  }
}
check('all 100 producer ten-god stem relationships satisfy the bridge contract', true);

const saryeongBirthInput = actualModule.createBirthInput({
  birthYear: 1986,
  birthMonth: 4,
  birthDay: 19,
  birthHour: 5,
  birthMinute: 45,
  gender: 'MALE',
  calendarType: 'SOLAR',
  timezone: 'Asia/Seoul',
  latitude: 37.5665,
  longitude: 126.978,
});
const baseSaryeongConfig = actualModule.configFromPreset('KOREAN_MAINSTREAM');
const realSaryeongOutputs: any[] = [];
for (const scheme of ['classical', 'scaled'] as const) {
  const output = actualModule.analyzeSaju(
    saryeongBirthInput,
    {
      ...baseSaryeongConfig,
      weights: {
        ...(baseSaryeongConfig.weights ?? {}),
        hiddenStems: {
          ...(baseSaryeongConfig.weights?.hiddenStems ?? {}),
          saryeongScheme: scheme,
        },
      },
    },
    {
      daeunCount: 2,
      saeunStartYear: 1986,
      saeunYearCount: 2,
      wolunStartYear: 1986,
      wolunMonthCount: 2,
    },
  );
  assertLegacySajuOutputV1Contract(output);
  realSaryeongOutputs.push(output);
  check(`real ${scheme} saryeong producer output satisfies the V1 runtime contract`, true);
}

for (const boundaryCase of [
  { label: 'CHUK 9-day boundary', birthYear: 2024, birthMonth: 1, birthDay: 15, birthHour: 5, birthMinute: 49 },
  { label: 'IN 7-day boundary', birthYear: 2024, birthMonth: 2, birthDay: 11, birthHour: 17, birthMinute: 27 },
] as const) {
  const output = actualModule.analyzeSaju(
    actualModule.createBirthInput({
      ...boundaryCase,
      gender: 'MALE',
      calendarType: 'SOLAR',
      timezone: 'Asia/Seoul',
      latitude: 37.5665,
      longitude: 126.978,
    }),
    {
      ...baseSaryeongConfig,
      weights: {
        ...(baseSaryeongConfig.weights ?? {}),
        hiddenStems: {
          ...(baseSaryeongConfig.weights?.hiddenStems ?? {}),
          saryeongScheme: 'classical',
        },
      },
    },
  );
  assertLegacySajuOutputV1Contract(output);
  check(`real classical producer survives rounded ${boundaryCase.label}`, true);
}

const summary = extractSaju(validOutput);
check('bridge schema marker does not leak into service-visible SajuSummary',
  !Object.prototype.hasOwnProperty.call(summary, 'bridgeSchemaVersion'));
check('direct extraction rejects a partial object before zero/empty normalization',
  rejectsContract(() => extractSaju({ weightedShinsalHits: [] })));

const moduleMutations: Array<[string, string]> = [
  ['analyzeSaju missing', 'analyzeSaju'],
  ['createBirthInput missing', 'createBirthInput'],
  ['configFromPreset missing', 'configFromPreset'],
];
for (const [label, key] of moduleMutations) {
  const mutated = { ...(actualModule as Record<string, unknown>) };
  delete mutated[key];
  check(label, rejectsContract(() => assertSajuModuleContract(mutated)));
}

for (const [label, guard, key] of [
  ['palace capability missing', assertSajuPalaceCapability, 'analyzePalaces'],
  ['naeum capability missing', assertSajuNaeumCapability, 'analyzeNaeum'],
] as const) {
  const mutated = { ...(actualModule as Record<string, unknown>) };
  delete mutated[key];
  check(label, rejectsContract(() => guard(mutated)));
}

const outputMutations: Array<[string, (output: any) => void]> = [
  ['schema version missing', (output) => { delete output.bridgeSchemaVersion; }],
  ['schema version unsupported', (output) => { output.bridgeSchemaVersion = 'saju-legacy.v2'; }],
  ['hour pillar missing', (output) => { delete output.pillars.hour; }],
  ['core NaN', (output) => { output.coreResult.adjustedMinute = Number.NaN; }],
  ['strength score missing', (output) => { delete output.strengthResult.score.deukse; }],
  ['yongshin recommendation malformed', (output) => { delete output.yongshinResult.recommendations[0].confidence; }],
  ['gyeokguk candidates missing', (output) => { delete output.gyeokgukResult.candidates; }],
  ['ohaeng key missing', (output) => { delete output.ohaengDistribution.WOOD; }],
  ['ohaeng amount negative', (output) => { output.ohaengDistribution.WOOD = -1; }],
  ['required opaque field missing', (output) => { delete output.tenGodAnalysis; }],
  ['ten-god hidden-stem numeric string rejected', (output) => { firstHiddenStem(output).ratio = '0.6'; }],
  ['ten-god hidden-stem NaN rejected', (output) => { firstHiddenStem(output).ratio = Number.NaN; }],
  ['ten-god hidden-stem Infinity rejected', (output) => { firstHiddenStem(output).ratio = Number.POSITIVE_INFINITY; }],
  ['ten-god hidden-stem negative ratio rejected', (output) => { firstHiddenStem(output).ratio = -0.1; }],
  ['ten-god hidden-stem ratio above one rejected', (output) => { firstHiddenStem(output).ratio = 1.1; }],
  ['ten-god hidden-stem empty stem rejected', (output) => { firstHiddenStem(output).stem = ''; }],
  ['ten-god hidden-stem unknown stem rejected', (output) => { firstHiddenStem(output).stem = 'NOPE'; }],
  ['ten-god day master unknown stem rejected', (output) => { output.tenGodAnalysis.dayMaster = 'NOPE'; }],
  ['ten-god day master must match the day pillar', (output) => {
    output.tenGodAnalysis.dayMaster =
      output.pillars.day.cheongan === 'GAP' ? 'EUL' : 'GAP';
  }],
  ['ten-god positions cannot be empty', (output) => { output.tenGodAnalysis.byPosition = {}; }],
  ['ten-god canonical position cannot be missing', (output) => { delete output.tenGodAnalysis.byPosition.YEAR; }],
  ['ten-god extra position rejected', (output) => { output.tenGodAnalysis.byPosition.EXTRA = output.tenGodAnalysis.byPosition.YEAR; }],
  ['ten-god hidden stems cannot be empty', (output) => { output.tenGodAnalysis.byPosition.YEAR.hiddenStems = []; }],
  ['ten-god hidden stems cannot omit a branch member', (output) => {
    output.tenGodAnalysis.byPosition.YEAR.hiddenStems = [
      { ...output.tenGodAnalysis.byPosition.YEAR.hiddenStems[0], ratio: 1 },
    ];
    output.tenGodAnalysis.byPosition.YEAR.hiddenStemSipseong =
      output.tenGodAnalysis.byPosition.YEAR.hiddenStemSipseong.slice(0, 1);
  }],
  ['ten-god hidden stems cannot add a branch outsider', (output) => {
    output.tenGodAnalysis.byPosition.YEAR.hiddenStems = [
      { stem: 'GAP', ratio: 0.4 },
      { stem: 'BYEONG', ratio: 0.3 },
      { stem: 'MU', ratio: 0.2 },
      { stem: 'SIN', ratio: 0.1 },
    ];
    output.tenGodAnalysis.byPosition.YEAR.hiddenStemSipseong.push({
      entry: { stem: 'SIN' },
      sipseong: 'PYEON_IN',
    });
  }],
  ['ten-god hidden stems cannot use an unsupported branch order', (output) => {
    const stems = output.tenGodAnalysis.byPosition.YEAR.hiddenStems;
    [stems[0], stems[1]] = [stems[1], stems[0]];
    const tenGods = output.tenGodAnalysis.byPosition.YEAR.hiddenStemSipseong;
    [tenGods[0], tenGods[1]] = [tenGods[1], tenGods[0]];
  }],
  ['ten-god stem ten-god map cannot be missing', (output) => { delete output.tenGodAnalysis.byPosition.YEAR.hiddenStemSipseong; }],
  ['ten-god stem ten-god map cannot be partial', (output) => { output.tenGodAnalysis.byPosition.YEAR.hiddenStemSipseong.pop(); }],
  ['ten-god stem ten-god map cannot target another stem', (output) => {
    output.tenGodAnalysis.byPosition.YEAR.hiddenStemSipseong[0].entry.stem = 'GYE';
  }],
  ['ten-god heavenly-stem classification cannot be missing', (output) => {
    delete output.tenGodAnalysis.byPosition.YEAR.cheonganSipseong;
  }],
  ['ten-god branch classification cannot be missing', (output) => {
    delete output.tenGodAnalysis.byPosition.YEAR.jijiPrincipalSipseong;
  }],
  ['ten-god heavenly-stem classification must be canonical', (output) => {
    output.tenGodAnalysis.byPosition.YEAR.cheonganSipseong = 'NOPE';
  }],
  ['ten-god heavenly-stem classification must be semantically correct', (output) => {
    const position = output.tenGodAnalysis.byPosition.YEAR;
    position.cheonganSipseong = anotherTenGod(position.cheonganSipseong);
  }],
  ['ten-god branch classification must be canonical', (output) => {
    output.tenGodAnalysis.byPosition.YEAR.jijiPrincipalSipseong = 'NOPE';
  }],
  ['ten-god branch classification must be semantically correct', (output) => {
    const position = output.tenGodAnalysis.byPosition.YEAR;
    position.jijiPrincipalSipseong = anotherTenGod(position.jijiPrincipalSipseong);
  }],
  ['ten-god hidden-stem classification must be canonical', (output) => {
    output.tenGodAnalysis.byPosition.YEAR.hiddenStemSipseong[0].sipseong = 'NOPE';
  }],
  ['ten-god hidden-stem classification must be semantically correct', (output) => {
    const hidden = output.tenGodAnalysis.byPosition.YEAR.hiddenStemSipseong[0];
    hidden.sipseong = anotherTenGod(hidden.sipseong);
  }],
  ['ten-god hidden-stem ratios cannot have a partial sum', (output) => {
    output.tenGodAnalysis.byPosition.YEAR.hiddenStems.forEach((stem: any) => { stem.ratio = 0.2; });
  }],
  ['ten-god hidden-stem ratios cannot sum above one', (output) => {
    output.tenGodAnalysis.byPosition.YEAR.hiddenStems.forEach((stem: any) => { stem.ratio = 0.5; });
  }],
  ['required relation array missing', (output) => { delete output.jijiRelations; }],
  ['daeun scalar missing', (output) => { delete output.daeunInfo.firstDaeunStartAge; }],
  ['daeun pillar malformed', (output) => { output.daeunInfo.daeunPillars[0].startAge = Number.NaN; }],
  ['saeun interval malformed', (output) => { delete output.saeunPillars[0].startUtcMs; }],
  ['wolun metadata malformed', (output) => { output.wolunPillars[0].startJie = ''; }],
  ['trace confidence malformed', (output) => { output.trace[0].confidence = Number.POSITIVE_INFINITY; }],
  ['jie proximity timestamp order malformed', (output) => {
    output.jieProximity.previousUtcMs = output.jieProximity.birthUtcMs + 1;
  }],
];
for (const [label, mutate] of outputMutations) {
  const output = structuredClone(validOutput) as any;
  mutate(output);
  check(label, rejectsContract(() => assertLegacySajuOutputV1Contract(output)));
}

const zeroRatioOutput = structuredClone(validOutput) as any;
for (const position of Object.values(zeroRatioOutput.tenGodAnalysis.byPosition) as any[]) {
  if (position.hiddenStems.length === 3) {
    position.hiddenStems.forEach((stem: any, index: number) => {
      stem.ratio = index === 0 ? 1 : 0;
    });
  }
}
assertLegacySajuOutputV1Contract(zeroRatioOutput);
check('global static hidden-stem zero ratios remain valid', true);

const disabledRatioOutput = structuredClone(validOutput) as any;
for (const position of Object.values(disabledRatioOutput.tenGodAnalysis.byPosition) as any[]) {
  position.hiddenStems.forEach((stem: any) => { stem.ratio = 0; });
}
assertLegacySajuOutputV1Contract(disabledRatioOutput);
check('explicit all-zero hidden-stem weight policy remains valid', true);

const mixedStaticRatioOutput = structuredClone(validOutput) as any;
mixedStaticRatioOutput.tenGodAnalysis.byPosition.YEAR.hiddenStems
  .forEach((stem: any, index: number) => { stem.ratio = [0.1, 0.8, 0.1][index]; });
check('static ratios cannot diverge between pillars of the same arity',
  rejectsContract(() => assertLegacySajuOutputV1Contract(mixedStaticRatioOutput)));

const saryeongVariantOutput = structuredClone(validOutput) as any;
const saryeongYear = saryeongVariantOutput.tenGodAnalysis.byPosition.YEAR;
const yearTenGodByStem = new Map(
  saryeongYear.hiddenStemSipseong.map((entry: any) => [entry.entry.stem, entry]),
);
saryeongYear.hiddenStems = [
  { stem: 'MU', ratio: 0 },
  { stem: 'BYEONG', ratio: 1 },
  { stem: 'GAP', ratio: 0 },
];
saryeongYear.hiddenStemSipseong = ['MU', 'BYEONG', 'GAP']
  .map((stem) => yearTenGodByStem.get(stem));
check('static and saryeong policies cannot be mixed by position',
  rejectsContract(() => assertLegacySajuOutputV1Contract(saryeongVariantOutput)));

const fractionalSaryeongOutput = structuredClone(realSaryeongOutputs[0]) as any;
fractionalSaryeongOutput.tenGodAnalysis.byPosition.YEAR.hiddenStems
  .forEach((stem: any, index: number) => { stem.ratio = [0.4, 0.3, 0.3][index]; });
check('saryeong hidden-stem ratios must remain one-hot',
  rejectsContract(() => assertLegacySajuOutputV1Contract(fractionalSaryeongOutput)));

const disabledSaryeongOutput = structuredClone(realSaryeongOutputs[0]) as any;
disabledSaryeongOutput.tenGodAnalysis.byPosition.YEAR.hiddenStems
  .forEach((stem: any) => { stem.ratio = 0; });
check('saryeong hidden-stem ratios cannot use the static all-zero policy',
  rejectsContract(() => assertLegacySajuOutputV1Contract(disabledSaryeongOutput)));

const wrongCommandingSaryeongOutput = structuredClone(realSaryeongOutputs[0]) as any;
const wrongCommandingYear =
  wrongCommandingSaryeongOutput.tenGodAnalysis.byPosition.YEAR.hiddenStems;
const currentCommandingIndex = wrongCommandingYear.findIndex((stem: any) => stem.ratio === 1);
wrongCommandingYear.forEach((stem: any, index: number) => {
  stem.ratio = index === (currentCommandingIndex + 1) % wrongCommandingYear.length ? 1 : 0;
});
check('saryeong commanding stem must match one global jie policy',
  rejectsContract(() => assertLegacySajuOutputV1Contract(wrongCommandingSaryeongOutput)));

console.log(`\nSaju bridge runtime contract: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
