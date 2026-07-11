export type SeedErrorKind = 'validation' | 'calculation';

export type SeedValidationErrorCode =
  | 'INVALID_INPUT'
  | 'EMPTY_SURNAME'
  | 'EMPTY_GIVEN_NAME'
  | 'INVALID_HANGUL_SYLLABLE'
  | 'INVALID_HANJA_CHARACTER'
  | 'INVALID_STROKE_COUNT'
  | 'INVALID_ELEMENT'
  | 'INVALID_ONSET'
  | 'INVALID_NUCLEUS'
  | 'INVALID_SURNAME_FLAG'
  | 'INVALID_GENDER'
  | 'INVALID_BIRTH_DATE_TIME'
  | 'INVALID_ANALYSIS_OPTIONS';

export type SeedCalculationErrorCode =
  | 'EMPTY_ENERGY_SET'
  | 'NON_FINITE_SCORE';

export type SeedErrorCode = SeedValidationErrorCode | SeedCalculationErrorCode;

export interface SeedErrorPayload<Code extends SeedErrorCode = SeedErrorCode> {
  readonly kind: SeedErrorKind;
  readonly code: Code;
  readonly message: string;
  readonly path: string;
  readonly received?: unknown;
}

/**
 * Stable machine-readable error contract for all fail-closed engine failures.
 */
export class SeedEngineError<Code extends SeedErrorCode = SeedErrorCode>
  extends Error
  implements SeedErrorPayload<Code> {
  public readonly kind: SeedErrorKind;
  public readonly code: Code;
  public readonly path: string;
  public readonly received?: unknown;

  protected constructor(payload: SeedErrorPayload<Code>) {
    super(payload.message);
    this.name = 'SeedEngineError';
    this.kind = payload.kind;
    this.code = payload.code;
    this.path = payload.path;
    this.received = payload.received;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON(): SeedErrorPayload<Code> {
    return {
      kind: this.kind,
      code: this.code,
      message: this.message,
      path: this.path,
      received: this.received,
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
