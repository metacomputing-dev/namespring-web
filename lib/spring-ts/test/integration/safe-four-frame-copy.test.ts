import assert from 'node:assert/strict';
import { buildSafeFourFrameCopyV1 } from '../../src/report/delivery/safe-four-frame-copy.js';

const copy = buildSafeFourFrameCopyV1({
  type: 'won',
  strokeSum: 14,
  element: 'Fire',
  elementLabel: '불',
  polarity: 'Negative',
  luckyLevel: 5,
});

assert.equal(copy.headline, '주의해서 보는 조합');
assert.equal(copy.paragraphs[0], '이름 두 글자의 획수 합 · 14획 · 화 기운 · 음');
assert.equal(copy.paragraphs.length, 1);
assert.doesNotMatch(copy.paragraphs.join(' '), /질병|혼인|이혼|특정 나이|전문가 검토/u);
assert.equal(Object.isFrozen(copy), true);
assert.equal(Object.isFrozen(copy.paragraphs), true);

console.log('Safe four-frame copy: PASS');
