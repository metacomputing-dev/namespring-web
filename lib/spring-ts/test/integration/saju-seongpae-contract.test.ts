import assert from 'node:assert/strict';
import { extractGyeokgukSeongpae } from '../../src/saju-seongpae-contract.js';

const mapped = extractGyeokgukSeongpae({
  verdict: 'SEONGJUNG_YUPA',
  verdictBeforeMonthBroken: 'SEONGGYEOK',
  usage: 'SUNYONG',
  sangshin: 'JEONG_IN',
  sangshinStemHanja: '癸',
  pagyeokFactor: null,
  gueung: 'SIK_SHIN',
  reasons: ['month damage', 123, null],
  hiddenSangshin: { internal: true },
  authorityTruthEligible: true,
});

assert.deepEqual(mapped, {
  verdict: 'SEONGJUNG_YUPA',
  verdictBeforeMonthBroken: 'SEONGGYEOK',
  usage: 'SUNYONG',
  sangshin: 'JEONG_IN',
  sangshinStemHanja: '癸',
  pagyeokFactor: null,
  gueung: 'SIK_SHIN',
  reasons: ['month damage'],
});
assert.equal(extractGyeokgukSeongpae({ verdict: 'UNKNOWN', usage: 'SUNYONG' }), null);
assert.equal(extractGyeokgukSeongpae({ verdict: 'SEONGGYEOK', usage: 'UNKNOWN' }), null);
assert.equal(extractGyeokgukSeongpae(null), null);

console.log('Saju seongpae boundary contract: PASS');
