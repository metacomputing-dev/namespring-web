import { emptySaju } from '../../src/saju-adapter.js';
import { FortuneSajuUnavailableError, SpringEngine } from '../../src/spring-engine.js';

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

console.log('Fortune API saju fail-closed contract\n');

const engine = new SpringEngine();
(engine as any).init = async () => {};
(engine as any).getSajuReport = async () => ({
  ...emptySaju('SAJU_UNKNOWN_SCHOOL_PRESET'),
  sajuEnabled: false,
});

let caught: unknown = null;
try {
  await engine.getFortuneReport({
    birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
    targetDate: '2026-07-15',
    options: {},
  });
} catch (error) {
  caught = error;
}

check('unusable saju stops before a plausible fortune card is built',
  caught instanceof FortuneSajuUnavailableError);
check('error exposes a stable outer code and original safe reason code',
  caught instanceof FortuneSajuUnavailableError
    && caught.code === 'FORTUNE_SAJU_UNAVAILABLE'
    && caught.reasonCode === 'SAJU_UNKNOWN_SCHOOL_PRESET'
    && caught.analysisStatus === 'failed');
check('error message does not expose the invalid selector or raw exception',
  caught instanceof Error
    && !caught.message.includes('school')
    && !caught.message.includes('preset'));

console.log(`\nFortune API saju fail-closed: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
