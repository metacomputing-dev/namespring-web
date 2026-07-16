import assert from 'node:assert/strict';

import {
  SPRING_NAME_LIMITS,
  SpringNameRequestValidationError,
  assertSpringNameRequestContract,
} from '../../src/name-input-contract.js';
import { SpringEngine } from '../../src/spring-engine.js';

const birth = {
  year: 1986,
  month: 4,
  day: 19,
  hour: 5,
  minute: 45,
  gender: 'male' as const,
};
const validRequest: any = {
  birth,
  surname: [{ hangul: '김', hanja: '金' }],
  givenName: [{ hangul: '민', hanja: '敏' }],
  mode: 'evaluate',
};

function assertContract(request: any): void {
  assertSpringNameRequestContract(request, {
    allowGivenNameGenerationFilters: true,
  });
}

assertContract(validRequest);
assertContract({ ...validRequest, options: { limit: 1, offset: 0 } });
assertContract({
  ...validRequest,
  options: {
    limit: SPRING_NAME_LIMITS.paginationMax,
    offset: SPRING_NAME_LIMITS.paginationMax,
  },
});

const invalidLimits: readonly unknown[] = [
  null,
  '10',
  true,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  1.5,
  0,
  -1,
  SPRING_NAME_LIMITS.paginationMax + 1,
];
for (const limit of invalidLimits) {
  assert.throws(
    () => assertContract({ ...validRequest, options: { limit } }),
    (error: unknown) => {
      assert.ok(error instanceof SpringNameRequestValidationError);
      assert.equal(error.reason, 'invalid_pagination_limit');
      assert.equal(error.field, 'options.limit');
      return true;
    },
  );
}

const invalidOffsets: readonly unknown[] = [
  null,
  '1',
  false,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  1.5,
  -1,
  SPRING_NAME_LIMITS.paginationMax + 1,
];
for (const offset of invalidOffsets) {
  assert.throws(
    () => assertContract({ ...validRequest, options: { offset } }),
    (error: unknown) => {
      assert.ok(error instanceof SpringNameRequestValidationError);
      assert.equal(error.reason, 'invalid_pagination_offset');
      assert.equal(error.field, 'options.offset');
      return true;
    },
  );
}

const unsupportedSurname: any = {
  ...validRequest,
  surname: [
    { hangul: '김' },
    { hangul: '박' },
  ],
  options: { pureHangulNameMode: 'on' },
};
assert.throws(
  () => assertContract(unsupportedSurname),
  (error: unknown) => {
    assert.ok(error instanceof SpringNameRequestValidationError);
    assert.equal(error.reason, 'unverified_compound_surname');
    assert.equal(error.field, 'surname');
    assert.equal(error.message.includes('김'), false);
    assert.equal(error.message.includes('박'), false);
    return true;
  },
);

const validCompound: any = {
  ...validRequest,
  givenName: [{ hangul: '민' }],
  surname: [
    { hangul: '남' },
    { hangul: '궁' },
  ],
  options: { pureHangulNameMode: 'on' },
};

const operations = [
  {
    name: 'getNamingReport',
    invoke: (engine: SpringEngine, request: any) => engine.getNamingReport(request),
  },
  {
    name: 'getSpringReport',
    invoke: (engine: SpringEngine, request: any) => engine.getSpringReport(request),
  },
  {
    name: 'getNameCandidates',
    invoke: (engine: SpringEngine, request: any) => engine.getNameCandidates(request),
  },
  {
    name: 'getNameCandidateSummaries',
    invoke: (engine: SpringEngine, request: any) => engine.getNameCandidateSummaries(request),
  },
  {
    name: 'analyze',
    invoke: (engine: SpringEngine, request: any) => engine.analyze(request),
  },
  {
    name: 'getFortuneReport(named)',
    invoke: (engine: SpringEngine, request: any) => engine.getFortuneReport({
      birth: request.birth,
      surname: request.surname,
      givenName: request.givenName,
      options: request.options,
      targetDate: '2026-07-15T00:00:00+09:00',
    }),
  },
] as const;

async function assertFailsBeforeInit(
  label: string,
  request: any,
  reason: string,
  field: string,
): Promise<void> {
  for (const operation of operations) {
    const engine = new SpringEngine() as any;
    let initCalls = 0;
    engine.init = async () => {
      initCalls += 1;
      throw new Error('init sentinel');
    };
    await assert.rejects(
      operation.invoke(engine, request),
      (error: unknown) => {
        assert.ok(error instanceof SpringNameRequestValidationError);
        assert.equal(error.reason, reason, operation.name + ' reason');
        assert.equal(error.field, field, operation.name + ' field');
        return true;
      },
      label + ': ' + operation.name,
    );
    assert.equal(initCalls, 0, label + ' must precede init: ' + operation.name);
  }
}

await assertFailsBeforeInit(
  'unsupported surname authority',
  unsupportedSurname,
  'unverified_compound_surname',
  'surname',
);
await assertFailsBeforeInit(
  'invalid pagination limit',
  { ...validRequest, options: { limit: '10' } },
  'invalid_pagination_limit',
  'options.limit',
);
await assertFailsBeforeInit(
  'invalid pagination offset',
  { ...validRequest, options: { offset: -1 } },
  'invalid_pagination_offset',
  'options.offset',
);

for (const operation of operations) {
  const engine = new SpringEngine() as any;
  let initCalls = 0;
  const sentinel = new Error('valid compound reached init');
  engine.init = async () => {
    initCalls += 1;
    throw sentinel;
  };
  await assert.rejects(operation.invoke(engine, validCompound));
  assert.equal(
    initCalls,
    1,
    'registered compound must reach init without overblocking: ' + operation.name,
  );
}

console.log('Name input contract: PASS');