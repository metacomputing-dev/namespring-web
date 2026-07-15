import {
  collectElements as collectElementsFromFacade,
  elementFromSajuCode as elementFromSajuCodeFromFacade,
} from '../../src/saju-adapter.js';
import {
  collectElements,
  elementFromSajuCode,
  normalizeElementCode,
  normalizeElementCodeList,
} from '../../src/saju/element-code.js';

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${label}`);
    return;
  }

  fail += 1;
  console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`);
}

const accepted: ReadonlyArray<readonly [unknown, string]> = [
  ['WOOD', 'WOOD'], ['Wood', 'WOOD'], ['wood', 'WOOD'], ['목', 'WOOD'], ['木', 'WOOD'],
  ['목(木)', 'WOOD'], ['목 ( WOOD )', 'WOOD'],
  ['FIRE', 'FIRE'], ['Fire', 'FIRE'], ['화', 'FIRE'], ['火', 'FIRE'],
  ['화(火)', 'FIRE'], ['화(FIRE)', 'FIRE'],
  ['EARTH', 'EARTH'], ['Earth', 'EARTH'], ['토', 'EARTH'], ['土', 'EARTH'],
  ['토(土)', 'EARTH'], ['토(EARTH)', 'EARTH'],
  ['METAL', 'METAL'], ['Metal', 'METAL'], ['금', 'METAL'], ['金', 'METAL'],
  ['금(金)', 'METAL'], ['금(METAL)', 'METAL'],
  ['WATER', 'WATER'], ['Water', 'WATER'], ['수', 'WATER'], ['水', 'WATER'],
  ['수(水)', 'WATER'], ['수(WATER)', 'WATER'],
];

for (const [input, expected] of accepted) {
  const actual = normalizeElementCode(input);
  check(`accept ${JSON.stringify(input)}`, actual === expected, `expected ${expected}, got ${String(actual)}`);
}

const rejected: readonly unknown[] = [
  null,
  undefined,
  123,
  ['WOOD'],
  [['WATER']],
  { toString: () => 'FIRE' },
  '',
  '알 수 없음',
  '화요일',
  '금지',
  '목표',
  '토론',
  'WOODEN',
  'W O O D',
  'FIRE element',
  '목( W O O D )',
  'unknown(WATER)',
  '용신: 목(木)',
  '목(火)',
];

for (const input of rejected) {
  const actual = normalizeElementCode(input);
  check(`reject ${JSON.stringify(input)}`, actual === null, `got ${String(actual)}`);
}

check(
  'elementFromSajuCode maps exact aliases to Spring keys',
  elementFromSajuCode('금(金)') === 'Metal' && elementFromSajuCode('금지') === null,
);
check(
  'normalizeElementCodeList filters invalid values and keeps stable uniqueness',
  JSON.stringify(normalizeElementCodeList(['Wood', '목(木)', '화요일', '水'])) ===
    JSON.stringify(['WOOD', 'WATER']),
);
check(
  'normalizeElementCodeList rejects nested non-string values',
  JSON.stringify(normalizeElementCodeList([['WATER'], { toString: () => 'FIRE' }, 'WOOD'])) ===
    JSON.stringify(['WOOD']),
);
check(
  'collectElements filters invalid values and keeps canonical Spring keys',
  JSON.stringify([...collectElements(['목', '금지'], '화(火)', 'unknown(WATER)')]) ===
    JSON.stringify(['Wood', 'Fire']),
);
check(
  'adapter facade preserves elementFromSajuCode identity',
  elementFromSajuCodeFromFacade === elementFromSajuCode,
);
check(
  'adapter facade preserves collectElements identity',
  collectElementsFromFacade === collectElements,
);

console.log(`\nSaju element-code boundary: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);
