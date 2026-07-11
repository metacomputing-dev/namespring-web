import { SpringEngine } from '../../src/index.js';
import { emptySaju } from '../../src/saju-adapter.js';
import type { SpringRequest } from '../../src/types.js';

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean, evidence?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${label}`);
    return;
  }
  fail += 1;
  console.log(`  FAIL ${label}${evidence === undefined ? '' : ` (${JSON.stringify(evidence)})`}`);
}

const engine = new SpringEngine() as any;
const firstRequest: SpringRequest = {
  birth: { gender: 'male' },
  surname: [{ hangul: '\uCD5C' }],
  mode: 'recommend',
};
const secondRequest: SpringRequest = {
  birth: { gender: 'female' },
  surname: [{ hangul: '\uAE40' }],
  mode: 'recommend',
};

const first = new Map();
const second = new Map();

await Promise.all([
  (async () => {
    engine.recordCandidateRejection(first, 'unsafe_hanja_meaning', { hangul: '\uAC00' });
    await Promise.resolve();
    engine.recordCandidateRejection(first, 'unsafe_hanja_meaning', { hangul: '\uB098' });
  })(),
  (async () => {
    await Promise.resolve();
    engine.recordCandidateRejection(second, 'outside_legal_hanja_pool', { hangul: '\uB2E4' });
  })(),
]);

const firstResponse = engine.buildResponse(
  firstRequest,
  'recommend',
  emptySaju(),
  [],
  first,
);
const secondResponse = engine.buildResponse(
  secondRequest,
  'recommend',
  emptySaju(),
  [],
  second,
);

const firstRows = firstResponse.meta.candidateRejections ?? [];
const secondRows = secondResponse.meta.candidateRejections ?? [];

check('first request keeps only its own rejection reason',
  firstRows.length === 1
    && firstRows[0]?.reason === 'unsafe_hanja_meaning'
    && firstRows[0]?.count === 2,
  firstRows);
check('second request keeps only its own rejection reason',
  secondRows.length === 1
    && secondRows[0]?.reason === 'outside_legal_hanja_pool'
    && secondRows[0]?.count === 1,
  secondRows);
check('SpringEngine no longer owns request-global rejection state',
  !Object.prototype.hasOwnProperty.call(engine, 'candidateRejections'));

console.log(`\nCandidate rejection isolation: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
