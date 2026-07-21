/**
 * SajuCalculator enabled-state publication contract.
 *
 * Enabled calculators must never expose zero or partially computed DTOs before
 * a successful visit(). A failed or superseded visit invalidates the previous
 * result, while backward() remains bound to the context that received the
 * published SAJU_FRAME insight.
 */
import assert from 'node:assert/strict';

import type { HanjaEntry } from '../../../seed-ts/src/database/hanja-repository.js';
import type { EvalContext } from '../../src/core/evaluator.js';
import {
  SAJU_CALCULATOR_NOT_READY,
  SajuCalculator,
  SajuCalculatorStateError,
  type SajuCalculatorReadOperation,
  type SajuCalculatorStateReason,
} from '../../src/saju-calculator.js';
import { SAJU_FRAME } from '../../src/spring-evaluator.js';

const distribution = {
  Wood: 20,
  Fire: 20,
  Earth: 20,
  Metal: 20,
  Water: 20,
} as const;

const surnameEntry: HanjaEntry = {
  id: 1,
  hangul: '최',
  hanja: '崔',
  onset: 'ㅊ',
  nucleus: 'ㅚ',
  strokes: 11,
  stroke_element: 'Wood',
  resource_element: 'Wood',
  meaning: '높을 최',
  radical: '山',
  is_surname: true,
};

const givenNameEntry: HanjaEntry = {
  id: 2,
  hangul: '민',
  hanja: '敏',
  onset: 'ㅁ',
  nucleus: 'ㅣ',
  strokes: 11,
  stroke_element: 'Wood',
  resource_element: 'Water',
  meaning: '민첩할 민',
  radical: '攴',
  is_surname: false,
};

function createContext(insights: EvalContext['insights'] = {}): EvalContext {
  return {
    surnameLength: 1,
    givenLength: 1,
    luckyMap: new Map(),
    insights,
  };
}

function createCalculator(
  surname: HanjaEntry = surnameEntry,
): SajuCalculator {
  return new SajuCalculator(
    [surname],
    [givenNameEntry],
    distribution,
    null,
  );
}

function expectStateError(
  work: () => unknown,
  operation: SajuCalculatorReadOperation,
  reason: SajuCalculatorStateReason,
): void {
  assert.throws(
    work,
    (error: unknown) => error instanceof SajuCalculatorStateError
      && error.code === SAJU_CALCULATOR_NOT_READY
      && error.operation === operation
      && error.reason === reason
      && error.retryable === false
      && error.message.length > 0,
  );
}

{
  const calculator = createCalculator();
  const context = createContext();

  expectStateError(
    () => calculator.backward(context),
    'backward',
    'visit_required',
  );
  expectStateError(
    () => calculator.getAnalysis(),
    'getAnalysis',
    'visit_required',
  );
  expectStateError(
    () => calculator.getCombinedDistribution(),
    'getCombinedDistribution',
    'visit_required',
  );
  assert.equal(context.insights[SAJU_FRAME], undefined);
}

{
  const calculator = createCalculator();
  const context = createContext();
  calculator.visit(context);

  const insight = context.insights[SAJU_FRAME];
  assert.ok(insight);
  assert.equal(calculator.backward(context).signals.length, 1);
  assert.equal(calculator.backward(context).signals[0]?.frame, SAJU_FRAME);

  const analysis = calculator.getAnalysis();
  assert.equal(analysis.type, 'Saju');
  assert.equal(Number.isFinite(analysis.score), true);
  assert.equal(analysis.data.nameElements.length, 2,
    'published element evidence uses the same full-name scope as match counts');

  const combined = calculator.getCombinedDistribution();
  assert.deepEqual(Object.keys(combined).sort(), [
    'Earth',
    'Fire',
    'Metal',
    'Water',
    'Wood',
  ]);

  const firstAnalysis = calculator.getAnalysis();
  calculator.visit(context);
  assert.deepEqual(
    calculator.getAnalysis(),
    firstAnalysis,
    'repeated successful visits must replace state deterministically',
  );

  const differentContext = createContext();
  calculator.visit(differentContext);
  assert.equal(calculator.backward(differentContext).signals.length, 1);
  assert.ok(differentContext.insights[SAJU_FRAME]);
  expectStateError(
    () => calculator.backward(context),
    'backward',
    'context_mismatch',
  );
}

{
  const calculator = createCalculator();
  const context = createContext();
  calculator.visit(context);

  const publishedInsight = context.insights[SAJU_FRAME];
  assert.ok(publishedInsight);
  delete context.insights[SAJU_FRAME];
  expectStateError(
    () => calculator.backward(context),
    'backward',
    'published_insight_mismatch',
  );

  calculator.visit(context);
  const replacedInsight = context.insights[SAJU_FRAME];
  assert.ok(replacedInsight);
  context.insights[SAJU_FRAME] = { ...replacedInsight };
  expectStateError(
    () => calculator.backward(context),
    'backward',
    'published_insight_mismatch',
  );

  calculator.visit(context);
  const mutatedInsight = context.insights[SAJU_FRAME];
  assert.ok(mutatedInsight);
  mutatedInsight.score = 999;
  expectStateError(
    () => calculator.backward(context),
    'backward',
    'published_insight_mismatch',
  );

  calculator.visit(context);
  const signal = calculator.backward(context).signals[0];
  assert.equal(signal?.score, context.insights[SAJU_FRAME]?.score);
  assert.equal(signal?.isPassed, context.insights[SAJU_FRAME]?.isPassed);
}

{
  let failOnResourceRead = false;
  const injectedFailure = new Error('injected calculation failure');
  const faultingSurnameEntry: HanjaEntry = {
    ...surnameEntry,
    get resource_element(): string {
      if (failOnResourceRead) throw injectedFailure;
      return surnameEntry.resource_element;
    },
  };
  const calculator = createCalculator(faultingSurnameEntry);
  const firstContext = createContext();
  calculator.visit(firstContext);
  assert.doesNotThrow(() => calculator.getAnalysis());

  failOnResourceRead = true;
  assert.throws(
    () => calculator.visit(firstContext),
    (error: unknown) => error === injectedFailure,
    'the original calculation failure must remain visible to the caller',
  );
  assert.equal(
    firstContext.insights[SAJU_FRAME],
    undefined,
    'a failed repeat visit must remove the stale insight from the reused context',
  );
  expectStateError(
    () => calculator.getAnalysis(),
    'getAnalysis',
    'visit_required',
  );

  failOnResourceRead = false;
  calculator.visit(firstContext);
  assert.doesNotThrow(() => calculator.getAnalysis());

  const frozenContext = createContext(
    Object.freeze({}) as EvalContext['insights'],
  );
  assert.throws(
    () => calculator.visit(frozenContext),
    TypeError,
    'a context publication failure must remain visible to the caller',
  );
  expectStateError(
    () => calculator.getAnalysis(),
    'getAnalysis',
    'visit_required',
  );
  expectStateError(
    () => calculator.getCombinedDistribution(),
    'getCombinedDistribution',
    'visit_required',
  );
  expectStateError(
    () => calculator.backward(firstContext),
    'backward',
    'visit_required',
  );

  const retryContext = createContext();
  calculator.visit(retryContext);
  assert.doesNotThrow(() => calculator.getAnalysis());
  assert.equal(calculator.backward(retryContext).signals.length, 1);
}

console.log('SajuCalculator enabled-state publication: PASS');
