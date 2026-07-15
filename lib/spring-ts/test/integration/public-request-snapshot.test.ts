import assert from 'node:assert/strict';

import { SpringEngine } from '../../src/index.js';
import { snapshotSpringRequest } from '../../src/public-request-snapshot.js';

const PUBLIC_INPUT_ERROR =
  'Spring public request inputs must contain only bounded JSON-compatible plain data.';
const MAX_STRING_LENGTH = 16_384;

function baseRequest(extra: Record<string, unknown> = {}): any {
  return {
    birth: { year: 1990, month: 1, day: 1, gender: 'neutral' },
    surname: [{ hangul: '\uAE40' }],
    givenName: [{ hangul: '\uBBFC' }],
    ...extra,
  };
}

function assertInvalid(value: unknown, label: string): void {
  assert.throws(
    () => snapshotSpringRequest(value as any),
    (error: unknown) => {
      assert.ok(error instanceof TypeError, label);
      assert.equal(error.message, PUBLIC_INPUT_ERROR, label);
      assert.equal('cause' in error, false, label);
      return true;
    },
    label,
  );
}

{
  const boundary = 'x'.repeat(MAX_STRING_LENGTH);
  const accepted: any = snapshotSpringRequest(baseRequest({ unknownPayload: boundary }));
  assert.equal(accepted.unknownPayload.length, MAX_STRING_LENGTH);
  assertInvalid(
    baseRequest({ unknownPayload: boundary + 'x' }),
    'a single oversized string must fail closed',
  );
}

{
  const oversizedKey = 'k'.repeat(MAX_STRING_LENGTH + 1);
  assertInvalid(
    baseRequest({ options: { [oversizedKey]: true } }),
    'an oversized object key must fail before it is copied',
  );
}

{
  const strings: Record<string, string> = {};
  for (let index = 0; index < 65; index += 1) {
    strings['value' + index] = 'x'.repeat(MAX_STRING_LENGTH);
  }
  assertInvalid(
    baseRequest({ options: { sajuConfig: strings } }),
    'many individually valid strings must not exceed the aggregate budget',
  );
}

{
  const shared = { payload: 'x'.repeat(MAX_STRING_LENGTH) };
  assertInvalid(
    baseRequest({ options: { sajuConfig: { repeated: new Array(65).fill(shared) } } }),
    'ordinary shared aliases must still consume budget at every input occurrence',
  );

  const trustedRoot: any = snapshotSpringRequest(baseRequest({
    options: { sajuConfig: shared },
  }));
  const trusted = trustedRoot.options.sajuConfig;
  assertInvalid(
    baseRequest({ options: { sajuConfig: { repeated: new Array(65).fill(trusted) } } }),
    'trusted subtree reuse must not bypass the aggregate budget',
  );
}

{
  const oversizedRequest = baseRequest({
    unknownPayload: 'private-input'.repeat(2_000),
  });
  const endpoints: readonly [string, (engine: any) => Promise<unknown>][] = [
    ['getNamingReport', (engine) => engine.getNamingReport(oversizedRequest)],
    ['getSajuReport', (engine) => engine.getSajuReport(oversizedRequest)],
    ['getSpringReport', (engine) => engine.getSpringReport(oversizedRequest)],
    ['getNameCandidates', (engine) => engine.getNameCandidates(oversizedRequest)],
    ['getNameCandidateSummaries', (engine) => engine.getNameCandidateSummaries(oversizedRequest)],
    ['analyze', (engine) => engine.analyze(oversizedRequest)],
    ['getFortuneReport', (engine) => engine.getFortuneReport(oversizedRequest)],
  ];

  for (const [name, invoke] of endpoints) {
    const engine = new SpringEngine() as any;
    let beginOperationCalls = 0;
    let initCalls = 0;
    engine.beginOperation = () => {
      beginOperationCalls += 1;
      throw new Error('beginOperation must not run for oversized public input');
    };
    engine.init = async () => {
      initCalls += 1;
      throw new Error('init must not run for oversized public input');
    };

    await assert.rejects(
      invoke(engine),
      (error: unknown) => {
        assert.ok(error instanceof TypeError, name);
        assert.equal(error.message, PUBLIC_INPUT_ERROR, name);
        assert.equal(error.message.includes('private-input'), false, name);
        return true;
      },
      name,
    );
    assert.equal(beginOperationCalls, 0, name);
    assert.equal(initCalls, 0, name);
  }
}

console.log('Public request snapshot bounds: PASS');
