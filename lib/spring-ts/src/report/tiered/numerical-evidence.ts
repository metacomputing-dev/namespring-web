/**
 * numerical-evidence.ts -- Safe resolver for expert-tier numeric evidence.
 *
 * Narrative fragments may declare deterministic numeric backing as simple
 * value expressions. Only whitelisted object paths are accepted; expressions
 * are never evaluated as JavaScript.
 */

import type { SourceTierMetadata } from '../../types.js';
import type { NumericalEvidenceRow } from '../types.js';
import type { FeatureVector } from './feature-selector.js';
import type { NarrativeFragment } from './fragment-registry.js';

export interface NumericalEvidenceContext {
  readonly feature: FeatureVector;
  readonly cell: {
    readonly stars: number | null;
  };
}

const SAFE_VALUE_EXPRESSION = /^(feature|cell)(\.[A-Za-z_][A-Za-z0-9_]*)+$/;
const BLOCKED_PATH_PARTS = new Set(['__proto__', 'prototype', 'constructor']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isSourceTierMetadata(value: unknown): value is SourceTierMetadata {
  if (!isRecord(value)) return false;
  return typeof value.tier === 'string' &&
    typeof value.sourceType === 'string' &&
    (typeof value.sourceUrl === 'string' || value.sourceUrl === null) &&
    typeof value.accessedAt === 'string' &&
    (typeof value.quoteShort === 'string' || value.quoteShort === null) &&
    typeof value.humanInterpretation === 'string' &&
    typeof value.copyrightNote === 'string' &&
    typeof value.authorityTruthEligible === 'boolean';
}

export function resolveNumericExpression(
  expression: string,
  context: NumericalEvidenceContext,
): number | null {
  if (!SAFE_VALUE_EXPRESSION.test(expression)) return null;
  const parts = expression.split('.');
  if (parts.some((part) => BLOCKED_PATH_PARTS.has(part))) return null;

  let cursor: unknown = context;
  for (const part of parts) {
    if (!isRecord(cursor) || !(part in cursor)) return null;
    cursor = cursor[part];
  }

  return typeof cursor === 'number' && Number.isFinite(cursor) ? cursor : null;
}

export function resolveNumericalEvidence(
  fragment: NarrativeFragment,
  context: NumericalEvidenceContext,
): readonly NumericalEvidenceRow[] | undefined {
  const rows = fragment.numericalEvidence;
  if (!rows?.length) return undefined;

  const resolved: NumericalEvidenceRow[] = [];
  for (const row of rows) {
    const value = resolveNumericExpression(row.valueExpression, context);
    if (value === null || !isSourceTierMetadata(row.sourceTier)) continue;
    resolved.push({
      label: row.label,
      value,
      ...(row.unit ? { unit: row.unit } : {}),
      sourceTier: row.sourceTier,
    });
  }

  return resolved.length ? resolved : undefined;
}
