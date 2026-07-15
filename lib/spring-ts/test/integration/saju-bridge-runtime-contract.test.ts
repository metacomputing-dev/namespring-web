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

console.log('Saju bridge runtime contract\n');

const modulePath = '../../../saju-ts/dist/index.js';
const actualModule: unknown = await import(modulePath);
assertSajuModuleContract(actualModule);
assertSajuPalaceCapability(actualModule);
assertSajuNaeumCapability(actualModule);
check('real built module satisfies core and optional capability contracts', true);

const validOutput = await createLegacySajuOutputFixture();
assertLegacySajuOutputV1Contract(validOutput);
check('real producer output satisfies the V1 runtime contract', true);

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
  ['required relation array missing', (output) => { delete output.jijiRelations; }],
  ['daeun scalar missing', (output) => { delete output.daeunInfo.firstDaeunStartAge; }],
  ['daeun pillar malformed', (output) => { output.daeunInfo.daeunPillars[0].startAge = Number.NaN; }],
  ['saeun interval malformed', (output) => { delete output.saeunPillars[0].startUtcMs; }],
  ['wolun metadata malformed', (output) => { output.wolunPillars[0].startJie = ''; }],
  ['trace confidence malformed', (output) => { output.trace[0].confidence = Number.POSITIVE_INFINITY; }],
];
for (const [label, mutate] of outputMutations) {
  const output = structuredClone(validOutput) as any;
  mutate(output);
  check(label, rejectsContract(() => assertLegacySajuOutputV1Contract(output)));
}

console.log(`\nSaju bridge runtime contract: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
