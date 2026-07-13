import {
  RepositoryQueryValidationError,
  type RepositoryDataSource,
} from './repository-errors.js';
import { countCodePointsUpTo } from '../utils/bounded-code-point-count.js';

export const MAX_REPOSITORY_QUERY_LIMIT = 1_000;

interface QueryContext {
  readonly repository: RepositoryDataSource;
  readonly path: string;
}

function fail(context: QueryContext, reason: string): never {
  throw new RepositoryQueryValidationError(
    context.repository,
    context.path,
    reason,
  );
}

export function assertRepositorySafeInteger(
  value: unknown,
  context: QueryContext & { readonly minimum: number; readonly maximum: number },
): number {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < context.minimum
    || value > context.maximum
  ) {
    fail(
      context,
      `expected a safe integer from ${context.minimum} to ${context.maximum}`,
    );
  }
  return value;
}

export function assertRepositoryLimit(
  value: unknown,
  context: QueryContext,
): number {
  return assertRepositorySafeInteger(value, {
    ...context,
    minimum: 1,
    maximum: MAX_REPOSITORY_QUERY_LIMIT,
  });
}

export function assertRepositoryString(
  value: unknown,
  context: QueryContext & {
    readonly minimumLength?: number;
    readonly maximumLength: number;
    readonly trim?: boolean;
  },
): string {
  if (typeof value !== 'string') {
    fail(context, 'expected a string');
  }
  // A Unicode code point occupies at most two UTF-16 code units. Bound the raw
  // input before trim() or code-point iteration so adversarial whitespace
  // cannot turn a small public limit into linear work.
  const maximumCodeUnits = context.maximumLength * 2;
  if (value.length > maximumCodeUnits) {
    fail(context, `raw input exceeds the ${maximumCodeUnits} UTF-16 code-unit safety limit`);
  }
  const normalized = context.trim === false ? value : value.trim();
  const length = countCodePointsUpTo(normalized, context.maximumLength);
  const minimumLength = context.minimumLength ?? 1;
  if (length < minimumLength || length > context.maximumLength) {
    fail(
      context,
      `expected ${minimumLength} to ${context.maximumLength} Unicode characters`,
    );
  }
  return normalized;
}

export function assertRepositoryEnum<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  context: QueryContext,
): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    fail(context, `expected one of: ${[...allowed].join(', ')}`);
  }
  return value as T;
}

export function assertOneHangulSyllable(
  value: unknown,
  context: QueryContext,
): string {
  const text = assertRepositoryString(value, {
    ...context,
    maximumLength: 1,
    trim: false,
  });
  if (!/^[\uAC00-\uD7A3]$/u.test(text)) {
    fail(context, 'expected one precomposed Hangul syllable');
  }
  return text;
}

export function assertOneHanCharacter(
  value: unknown,
  context: QueryContext,
): string {
  const text = assertRepositoryString(value, {
    ...context,
    maximumLength: 1,
    trim: false,
  });
  if (!/^\p{Script=Han}$/u.test(text)) {
    fail(context, 'expected one Unicode Han character');
  }
  return text;
}
