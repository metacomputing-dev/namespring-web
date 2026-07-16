export type SeedErrorKind = 'validation' | 'calculation';

export type SeedValidationErrorCode =
  | 'INVALID_INPUT'
  | 'EMPTY_SURNAME'
  | 'EMPTY_GIVEN_NAME'
  | 'INVALID_HANGUL_SYLLABLE'
  | 'INVALID_HANJA_CHARACTER'
  | 'INVALID_STROKE_COUNT'
  | 'INVALID_ELEMENT'
  | 'INVALID_POLARITY'
  | 'INVALID_ENERGY'
  | 'INVALID_ONSET'
  | 'INVALID_NUCLEUS'
  | 'INVALID_SURNAME_FLAG'
  | 'INVALID_SURNAME_LENGTH'
  | 'INVALID_GIVEN_NAME_LENGTH'
  | 'INVALID_GENDER'
  | 'INVALID_BIRTH_DATE_TIME'
  | 'INVALID_ANALYSIS_OPTIONS';

export type SeedCalculationErrorCode =
  | 'EMPTY_ENERGY_SET'
  | 'INVALID_SCORE_INPUT'
  | 'NON_FINITE_SCORE';

export type SeedErrorCode = SeedValidationErrorCode | SeedCalculationErrorCode;

export type SeedReceivedSummary = Readonly<
  | { readonly type: 'null' }
  | { readonly type: 'string' }
  | { readonly type: 'number' }
  | { readonly type: 'boolean' }
  | { readonly type: 'bigint' }
  | { readonly type: 'symbol' }
  | { readonly type: 'function' }
  | { readonly type: 'array' }
  | { readonly type: 'object' }
>;

export interface SeedErrorPayload<Code extends SeedErrorCode = SeedErrorCode> {
  readonly kind: SeedErrorKind;
  readonly code: Code;
  readonly message: string;
  readonly path: string;
  readonly receivedSummary?: SeedReceivedSummary;
}

interface SeedErrorInput<Code extends SeedErrorCode> {
  readonly kind: SeedErrorKind;
  readonly code: Code;
  readonly message: string;
  readonly path: string;
  readonly received?: unknown;
}

function summarizeReceived(value: unknown): SeedReceivedSummary | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Object.freeze({ type: 'null' });
  const primitiveType = typeof value;
  if (primitiveType !== 'object') {
    return Object.freeze({ type: primitiveType }) as SeedReceivedSummary;
  }
  try {
    if (Array.isArray(value)) return Object.freeze({ type: 'array' });
  } catch {
    // A revoked proxy is still summarized without reading or retaining it.
  }
  return Object.freeze({ type: 'object' });
}

/**
 * Stable machine-readable error contract for all fail-closed engine failures.
 * Caller input is summarized centrally and is never retained on the error.
 */
export class SeedEngineError<Code extends SeedErrorCode = SeedErrorCode>
  extends Error
  implements SeedErrorPayload<Code> {
  public readonly kind: SeedErrorKind;
  public readonly code: Code;
  public readonly path: string;
  public readonly receivedSummary?: SeedReceivedSummary;

  protected constructor(payload: SeedErrorInput<Code>) {
    super(payload.message);
    this.name = 'SeedEngineError';
    this.kind = payload.kind;
    this.code = payload.code;
    this.path = payload.path;
    this.receivedSummary = summarizeReceived(payload.received);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON(): SeedErrorPayload<Code> {
    return {
      kind: this.kind,
      code: this.code,
      message: this.message,
      path: this.path,
      receivedSummary: this.receivedSummary,
    };
  }
}

export class SeedValidationError extends SeedEngineError<SeedValidationErrorCode> {
  public constructor(
    code: SeedValidationErrorCode,
    message: string,
    path: string,
    received?: unknown,
  ) {
    super({ kind: 'validation', code, message, path, received });
    this.name = 'SeedValidationError';
  }
}

export class SeedCalculationError extends SeedEngineError<SeedCalculationErrorCode> {
  public constructor(
    code: SeedCalculationErrorCode,
    message: string,
    path: string,
    received?: unknown,
  ) {
    super({ kind: 'calculation', code, message, path, received });
    this.name = 'SeedCalculationError';
  }
}
