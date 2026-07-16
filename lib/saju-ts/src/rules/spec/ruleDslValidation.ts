import { evalExpr, type Expr, type Rule, type RuleSet } from '../dsl.js';
import {
  type DataRecord,
  type KnownRuleSpecTarget,
  KNOWN_TARGETS,
  assertArray,
  assertDataOnly,
  assertFiniteNumber,
  assertGenericScoreKey,
  assertKnownKeys,
  assertOptionalString,
  assertOptionalStringArray,
  assertRecord,
  assertRequiredString,
  assertSafeDynamicKey,
  fail,
  hasOwn,
  isPlainRecord,
} from './ruleSpecValidationCore.js';

const DSL_ARITY: Readonly<Record<string, { min: number; max: number }>> = {
  and: { min: 1, max: Number.POSITIVE_INFINITY },
  or: { min: 1, max: Number.POSITIVE_INFINITY },
  not: { min: 1, max: 1 },
  eq: { min: 2, max: 2 },
  ne: { min: 2, max: 2 },
  lt: { min: 2, max: 2 },
  lte: { min: 2, max: 2 },
  gt: { min: 2, max: 2 },
  gte: { min: 2, max: 2 },
  in: { min: 2, max: 2 },
  overlap: { min: 2, max: 2 },
  intersect: { min: 2, max: 2 },
  len: { min: 1, max: 1 },
  add: { min: 1, max: Number.POSITIVE_INFINITY },
  sub: { min: 2, max: 2 },
  mul: { min: 1, max: Number.POSITIVE_INFINITY },
  div: { min: 2, max: 2 },
  neg: { min: 1, max: 1 },
  abs: { min: 1, max: 1 },
  min: { min: 1, max: Number.POSITIVE_INFINITY },
  max: { min: 1, max: Number.POSITIVE_INFINITY },
  sum: { min: 1, max: 1 },
  clamp: { min: 3, max: 3 },
  if: { min: 3, max: 3 },
};

function assertSafeVarPath(value: unknown, target: string, path: string): void {
  if (
    typeof value !== 'string'
    || value.trim().length === 0
    || value !== value.trim()
  ) {
    fail(target, path, 'a non-empty trimmed variable path');
  }
  const segments = value.split('.');
  if (
    segments.some(
      (segment) =>
        segment.length === 0
        || segment === '__proto__'
        || segment === 'prototype'
        || segment === 'constructor',
    )
  ) {
    fail(target, path, 'a safe variable path without prototype segments');
  }
}

export function assertRequiredSafeVarPath(
  record: DataRecord,
  key: string,
  target: string,
  path: string,
): void {
  if (!hasOwn(record, key)) fail(target, path, 'a safe variable path');
  assertSafeVarPath(record[key], target, path);
}

export function assertOptionalSafeVarPath(
  record: DataRecord,
  key: string,
  target: string,
  path: string,
): void {
  if (!hasOwn(record, key) || record[key] === undefined) return;
  assertSafeVarPath(record[key], target, path);
}

type DslContext =
  | 'template'
  | 'predicate'
  | 'numeric'
  | 'collection'
  | 'numericCollection'
  | 'membership';

function assertVarNode(
  value: DataRecord,
  target: string,
  path: string,
): void {
  assertKnownKeys(value, target, path, ['var']);
  assertSafeVarPath(value.var, target, `${path}.var`);
}

function readOperator(
  value: DataRecord,
  target: string,
  path: string,
): { op: string; args: unknown[] } {
  assertKnownKeys(value, target, path, ['op', 'args']);
  const op = assertRequiredString(value, 'op', target, `${path}.op`);
  const arity = DSL_ARITY[op];
  if (!arity) fail(target, `${path}.op`, 'a supported DSL operator');
  if (!hasOwn(value, 'args')) fail(target, `${path}.args`, 'an operand array');
  assertArray(value.args, target, `${path}.args`);
  if (value.args.length < arity.min || value.args.length > arity.max) {
    const expected = arity.min === arity.max
      ? `exactly ${arity.min} operands`
      : `at least ${arity.min} operands`;
    fail(target, `${path}.args`, expected);
  }
  return { op, args: value.args };
}

function assertOperatorResult(
  context: DslContext,
  result: 'boolean' | 'number' | 'array',
  target: string,
  path: string,
): void {
  if (context === 'template') return;
  if (context === 'predicate' && (result === 'boolean' || result === 'number')) {
    return;
  }
  if (context === 'numeric' && result === 'number') return;
  if (
    (context === 'collection'
      || context === 'numericCollection'
      || context === 'membership')
    && result === 'array'
  ) {
    return;
  }
  const expected = context === 'numeric'
    ? 'a numeric-returning DSL expression'
    : context === 'predicate'
      ? 'a truthy scalar-returning DSL expression'
      : 'an array-returning DSL expression';
  fail(target, path, expected);
}

function assertTemplateExpr(value: unknown, target: string, path: string): void {
  if (
    value === null
    || typeof value === 'boolean'
    || typeof value === 'string'
  ) {
    return;
  }
  if (typeof value === 'number') {
    assertFiniteNumber(value, target, path);
    return;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertTemplateExpr(value[index], target, `${path}[${index}]`);
    }
    return;
  }
  assertRecord(value, target, path);
  const hasVar = hasOwn(value, 'var');
  const hasOp = hasOwn(value, 'op');
  if (hasVar || hasOp) {
    if (hasVar && hasOp) {
      fail(target, path, 'exactly one of a variable node or operator node');
    }
    if (hasVar) {
      assertVarNode(value, target, path);
      return;
    }
    assertOperator(value, 'template', target, path);
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    assertSafeDynamicKey(key, target, `${path}.${key}`);
    assertTemplateExpr(child, target, `${path}.${key}`);
  }
}

function containsVariableReference(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => containsVariableReference(entry));
  }
  if (!isPlainRecord(value)) return false;
  if (hasOwn(value, 'var')) return true;
  return Object.values(value).some((entry) => containsVariableReference(entry));
}

function evaluateConstantNumber(value: unknown): number | undefined {
  if (containsVariableReference(value)) return undefined;
  const evaluated = evalExpr(value as Expr, {});
  return typeof evaluated === 'number' ? evaluated : undefined;
}

function assertFiniteConstantResult(
  value: DataRecord,
  target: string,
  path: string,
): void {
  const evaluated = evaluateConstantNumber(value);
  if (evaluated !== undefined && !Number.isFinite(evaluated)) {
    fail(target, path, 'a DSL expression with a finite constant result');
  }
}

function assertNoGuaranteedNonFiniteArithmetic(
  op: string,
  args: unknown[],
  target: string,
  path: string,
): void {
  if (op === 'div') {
    const denominator = evaluateConstantNumber(args[1]);
    if (denominator === 0) {
      fail(target, path, 'a DSL expression without guaranteed division by zero');
    }
    return;
  }

  if (op !== 'add' && op !== 'mul') return;
  let accumulator = op === 'add' ? 0 : 1;
  for (const argument of args) {
    const constant = evaluateConstantNumber(argument);
    if (constant === undefined) return;
    accumulator = op === 'add'
      ? accumulator + constant
      : accumulator * constant;
    if (!Number.isFinite(accumulator)) {
      fail(target, path, 'a DSL expression without guaranteed numeric overflow');
    }
  }
}

function assertNoGuaranteedNonFiniteSum(
  value: unknown,
  target: string,
  path: string,
): void {
  if (!Array.isArray(value)) return;
  let accumulator = 0;
  for (const entry of value) {
    const constant = evaluateConstantNumber(entry);
    if (constant === undefined) return;
    accumulator += constant;
    if (!Number.isFinite(accumulator)) {
      fail(target, path, 'a DSL expression without guaranteed numeric overflow');
    }
  }
}

function assertPredicateExpr(
  value: unknown,
  target: string,
  path: string,
): void {
  if (
    value === null
    || typeof value === 'boolean'
    || typeof value === 'string'
  ) {
    return;
  }
  if (typeof value === 'number') {
    assertFiniteNumber(value, target, path);
    return;
  }
  if (!isPlainRecord(value)) {
    fail(target, path, 'a scalar, variable, or scalar-returning DSL expression');
  }
  if (hasOwn(value, 'var')) {
    if (hasOwn(value, 'op')) {
      fail(target, path, 'exactly one of a variable node or operator node');
    }
    assertVarNode(value, target, path);
    return;
  }
  if (!hasOwn(value, 'op')) {
    fail(target, path, 'a scalar, variable, or scalar-returning DSL expression');
  }
  assertOperator(value, 'predicate', target, path);
}

function assertNumericExpr(
  value: unknown,
  target: string,
  path: string,
): void {
  if (typeof value === 'number') {
    assertFiniteNumber(value, target, path);
    return;
  }
  if (!isPlainRecord(value)) {
    fail(target, path, 'a finite number, variable, or numeric DSL expression');
  }
  if (hasOwn(value, 'var')) {
    if (hasOwn(value, 'op')) {
      fail(target, path, 'exactly one of a variable node or operator node');
    }
    assertVarNode(value, target, path);
    return;
  }
  if (!hasOwn(value, 'op')) {
    fail(target, path, 'a finite number, variable, or numeric DSL expression');
  }
  assertOperator(value, 'numeric', target, path);
}

function assertCollectionExpr(
  value: unknown,
  numericItems: boolean,
  target: string,
  path: string,
): void {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (numericItems) {
        assertNumericExpr(value[index], target, `${path}[${index}]`);
      } else {
        assertTemplateExpr(value[index], target, `${path}[${index}]`);
      }
    }
    return;
  }
  if (!isPlainRecord(value)) {
    fail(
      target,
      path,
      numericItems
        ? 'a variable or numeric expression array'
        : 'a variable or array-returning DSL expression',
    );
  }
  if (hasOwn(value, 'var')) {
    if (hasOwn(value, 'op')) {
      fail(target, path, 'exactly one of a variable node or operator node');
    }
    assertVarNode(value, target, path);
    return;
  }
  if (!hasOwn(value, 'op')) {
    fail(
      target,
      path,
      numericItems
        ? 'a variable or numeric expression array'
        : 'a variable or array-returning DSL expression',
    );
  }
  assertOperator(
    value,
    numericItems ? 'numericCollection' : 'collection',
    target,
    path,
  );
}

function assertMembershipExpr(
  value: unknown,
  target: string,
  path: string,
): void {
  if (typeof value === 'string') return;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertTemplateExpr(value[index], target, `${path}[${index}]`);
    }
    return;
  }
  if (!isPlainRecord(value)) {
    fail(target, path, 'a string, collection, object, or variable');
  }
  if (hasOwn(value, 'var')) {
    if (hasOwn(value, 'op')) {
      fail(target, path, 'exactly one of a variable node or operator node');
    }
    assertVarNode(value, target, path);
    return;
  }
  if (hasOwn(value, 'op')) {
    assertOperator(value, 'membership', target, path);
    return;
  }
  assertTemplateExpr(value, target, path);
}

function assertOperator(
  value: DataRecord,
  context: DslContext,
  target: string,
  path: string,
): void {
  const { op, args } = readOperator(value, target, path);
  switch (op) {
    case 'and':
    case 'or':
      assertOperatorResult(context, 'boolean', target, path);
      for (let index = 0; index < args.length; index += 1) {
        assertPredicateExpr(args[index], target, `${path}.args[${index}]`);
      }
      return;
    case 'not':
      assertOperatorResult(context, 'boolean', target, path);
      assertPredicateExpr(args[0], target, `${path}.args[0]`);
      return;
    case 'eq':
    case 'ne':
      assertOperatorResult(context, 'boolean', target, path);
      assertPredicateExpr(args[0], target, `${path}.args[0]`);
      assertPredicateExpr(args[1], target, `${path}.args[1]`);
      return;
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte':
      assertOperatorResult(context, 'boolean', target, path);
      assertNumericExpr(args[0], target, `${path}.args[0]`);
      assertNumericExpr(args[1], target, `${path}.args[1]`);
      return;
    case 'in':
      assertOperatorResult(context, 'boolean', target, path);
      assertPredicateExpr(args[0], target, `${path}.args[0]`);
      assertMembershipExpr(args[1], target, `${path}.args[1]`);
      return;
    case 'overlap':
      assertOperatorResult(context, 'boolean', target, path);
      assertCollectionExpr(args[0], false, target, `${path}.args[0]`);
      assertCollectionExpr(args[1], false, target, `${path}.args[1]`);
      return;
    case 'intersect': {
      assertOperatorResult(context, 'array', target, path);
      const numericItems = context === 'numericCollection';
      assertCollectionExpr(args[0], numericItems, target, `${path}.args[0]`);
      assertCollectionExpr(args[1], numericItems, target, `${path}.args[1]`);
      return;
    }
    case 'len':
      assertOperatorResult(context, 'number', target, path);
      assertMembershipExpr(args[0], target, `${path}.args[0]`);
      return;
    case 'add':
    case 'sub':
    case 'mul':
    case 'div':
    case 'neg':
    case 'abs':
    case 'min':
    case 'max':
    case 'clamp':
      assertOperatorResult(context, 'number', target, path);
      for (let index = 0; index < args.length; index += 1) {
        assertNumericExpr(args[index], target, `${path}.args[${index}]`);
      }
      assertNoGuaranteedNonFiniteArithmetic(op, args, target, path);
      assertFiniteConstantResult(value, target, path);
      return;
    case 'sum':
      assertOperatorResult(context, 'number', target, path);
      assertCollectionExpr(args[0], true, target, `${path}.args[0]`);
      assertNoGuaranteedNonFiniteSum(args[0], target, path);
      assertFiniteConstantResult(value, target, path);
      return;
    case 'if':
      assertPredicateExpr(args[0], target, `${path}.args[0]`);
      if (context === 'numeric') {
        assertNumericExpr(args[1], target, `${path}.args[1]`);
        assertNumericExpr(args[2], target, `${path}.args[2]`);
      } else if (context === 'predicate') {
        assertPredicateExpr(args[1], target, `${path}.args[1]`);
        assertPredicateExpr(args[2], target, `${path}.args[2]`);
      } else if (context === 'collection' || context === 'numericCollection') {
        const numericItems = context === 'numericCollection';
        assertCollectionExpr(args[1], numericItems, target, `${path}.args[1]`);
        assertCollectionExpr(args[2], numericItems, target, `${path}.args[2]`);
      } else if (context === 'membership') {
        assertMembershipExpr(args[1], target, `${path}.args[1]`);
        assertMembershipExpr(args[2], target, `${path}.args[2]`);
      } else {
        assertTemplateExpr(args[1], target, `${path}.args[1]`);
        assertTemplateExpr(args[2], target, `${path}.args[2]`);
      }
      assertFiniteConstantResult(value, target, path);
      return;
    default:
      fail(target, `${path}.op`, 'a supported DSL operator');
  }
}

function assertExpr(value: unknown, target: string, path: string): void {
  assertTemplateExpr(value, target, path);
}

function assertRule(
  value: unknown,
  path: string,
  target: KnownRuleSpecTarget,
): asserts value is Rule {
  assertRecord(value, target, path);
  assertKnownKeys(
    value,
    target,
    path,
    ['id', 'when', 'score', 'emit', 'assert', 'explain', 'tags'],
  );
  assertRequiredString(value, 'id', target, `${path}.id`);

  if (hasOwn(value, 'when') && value.when !== undefined) {
    assertPredicateExpr(value.when, target, `${path}.when`);
  }
  if (hasOwn(value, 'assert') && value.assert !== undefined) {
    assertPredicateExpr(value.assert, target, `${path}.assert`);
  }
  if (hasOwn(value, 'emit') && value.emit !== undefined) {
    assertExpr(value.emit, target, `${path}.emit`);
  }
  if (hasOwn(value, 'score') && value.score !== undefined) {
    assertRecord(value.score, target, `${path}.score`);
    if (Object.keys(value.score).length === 0) {
      fail(target, `${path}.score`, 'a non-empty score map');
    }
    for (const [scoreKey, expr] of Object.entries(value.score)) {
      assertGenericScoreKey(scoreKey, target, `${path}.score.${scoreKey}`);
      assertNumericExpr(expr, target, `${path}.score.${scoreKey}`);
    }
  }
  if (
    (!hasOwn(value, 'score') || value.score === undefined)
    && (!hasOwn(value, 'emit') || value.emit === undefined || value.emit === null)
    && (!hasOwn(value, 'assert') || value.assert === undefined)
  ) {
    fail(target, path, 'at least one of score, emit, or assert');
  }
  assertOptionalString(value, 'explain', target, `${path}.explain`);
  assertOptionalStringArray(value, 'tags', target, `${path}.tags`);
}

function assertRuleArray(
  value: unknown,
  path: string,
  target: KnownRuleSpecTarget,
): asserts value is Rule[] {
  assertArray(value, target, path);
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const rulePath = `${path}[${index}]`;
    assertRule(value[index], rulePath, target);
    const id = (value[index] as Rule).id;
    if (seen.has(id)) fail(target, `${rulePath}.id`, 'a unique rule id');
    seen.add(id);
  }
}

export function assertMacroPresentation(
  macro: DataRecord,
  target: KnownRuleSpecTarget,
  path: string,
): void {
  if (hasOwn(macro, 'when') && macro.when !== undefined) {
    assertPredicateExpr(macro.when, target, `${path}.when`);
  }
  assertOptionalString(macro, 'idPrefix', target, `${path}.idPrefix`, true);
  assertOptionalString(
    macro,
    'explainTemplate',
    target,
    `${path}.explainTemplate`,
  );
  assertOptionalStringArray(macro, 'tags', target, `${path}.tags`);
}

export function assertCustomRulesMacro(
  macro: DataRecord,
  target: KnownRuleSpecTarget,
  path: string,
): void {
  assertKnownKeys(macro, target, path, ['kind', 'rules']);
  if (!hasOwn(macro, 'rules')) fail(target, `${path}.rules`, 'an array of rules');
  assertRuleArray(macro.rules, `${path}.rules`, target);
}

/**
 * Validate a directly supplied RuleSet (`extensions.rulesets` / `rules`).
 */
export function assertValidRuleSet(
  input: unknown,
  path: string,
  target: string,
): asserts input is RuleSet {
  if (!KNOWN_TARGETS.has(target as KnownRuleSpecTarget)) {
    fail(String(target), path, 'a known ruleset target');
  }
  const knownTarget = target as KnownRuleSpecTarget;
  assertDataOnly(input, knownTarget, path);
  assertRecord(input, knownTarget, path);
  assertKnownKeys(
    input,
    knownTarget,
    path,
    ['id', 'version', 'description', 'rules'],
  );
  assertRequiredString(input, 'id', knownTarget, `${path}.id`);
  assertRequiredString(input, 'version', knownTarget, `${path}.version`);
  assertOptionalString(
    input,
    'description',
    knownTarget,
    `${path}.description`,
  );
  if (!hasOwn(input, 'rules')) {
    fail(knownTarget, `${path}.rules`, 'an array of rules');
  }
  assertRuleArray(input.rules, `${path}.rules`, knownTarget);
}

// Compile-time checks keep public signatures aligned with the DSL contracts.
const _exprTypeCheck: Expr | undefined = undefined;
const _ruleSetTypeCheck: RuleSet | undefined = undefined;
void _exprTypeCheck;
void _ruleSetTypeCheck;
