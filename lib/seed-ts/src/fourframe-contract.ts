export const FOURFRAME_MIN_NUMBER = 1;
export const FOURFRAME_MAX_NUMBER = 81;
export const FOURFRAME_EXPECTED_RECORD_COUNT = 81;

export const FOURFRAME_LUCKY_LEVELS = [
  '\uCD5C\uC0C1\uC6B4\uC218',
  '\uC0C1\uC6B4\uC218',
  '\uC591\uC6B4\uC218',
  '\uD749\uC6B4\uC218',
  '\uCD5C\uD749\uC6B4\uC218',
] as const;

export type FourFrameLuckyLevel = typeof FOURFRAME_LUCKY_LEVELS[number];

const FAVORABLE_LUCKY_LEVELS = new Set<FourFrameLuckyLevel>([
  '\uCD5C\uC0C1\uC6B4\uC218',
  '\uC0C1\uC6B4\uC218',
  '\uC591\uC6B4\uC218',
]);

const ALLOWED_LUCKY_LEVELS = new Set<string>(FOURFRAME_LUCKY_LEVELS);

export type FourFrameContractField = 'title' | 'summary' | 'lucky_level';

export type FourFrameContractIssue =
  | { readonly code: 'EMPTY_DATASET' }
  | {
      readonly code: 'UNEXPECTED_RECORD_COUNT';
      readonly expected: number;
      readonly actual: number;
    }
  | {
      readonly code: 'INVALID_NUMBER';
      readonly rowIndex: number;
      readonly received: unknown;
    }
  | {
      readonly code: 'DUPLICATE_NUMBER';
      readonly number: number;
      readonly firstRowIndex: number;
      readonly duplicateRowIndex: number;
    }
  | {
      readonly code: 'MISSING_NUMBERS';
      readonly numbers: readonly number[];
    }
  | {
      readonly code: 'MISSING_REQUIRED_FIELD';
      readonly rowIndex: number;
      readonly number: number | null;
      readonly field: FourFrameContractField;
    }
  | {
      readonly code: 'INVALID_LUCKY_LEVEL';
      readonly rowIndex: number;
      readonly number: number | null;
      readonly received: unknown;
      readonly allowed: readonly FourFrameLuckyLevel[];
    };

export const FOURFRAME_CONTRACT_INVALID = 'FOURFRAME_CONTRACT_INVALID' as const;

export class FourFrameContractError extends Error {
  public readonly code = FOURFRAME_CONTRACT_INVALID;
  public readonly issues: readonly FourFrameContractIssue[];

  public constructor(issues: readonly FourFrameContractIssue[]) {
    const issueCodes = Array.from(new Set(issues.map((issue) => issue.code))).join(', ');
    super(`Four-frame data contract failed: ${issueCodes}`);
    this.name = 'FourFrameContractError';
    this.issues = issues;
  }
}

export interface FourFrameContractRecord {
  readonly number: number;
  readonly title: string;
  readonly summary: string;
  readonly lucky_level: string | null;
}

export interface CompiledFourFrameContract<T extends FourFrameContractRecord> {
  readonly recordsByNumber: ReadonlyMap<number, T>;
  readonly luckyByNumber: ReadonlyMap<number, FourFrameLuckyLevel>;
  readonly favorableNumbers: ReadonlySet<number>;
}

function isRequiredText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidNumber(value: unknown): value is number {
  return Number.isInteger(value)
    && Number(value) >= FOURFRAME_MIN_NUMBER
    && Number(value) <= FOURFRAME_MAX_NUMBER;
}

export function normalizeFourFrameNumber(value: number): number {
  if (!Number.isSafeInteger(value) || value < FOURFRAME_MIN_NUMBER) {
    throw new RangeError('Four-frame number must be a positive safe integer.');
  }
  return ((value - FOURFRAME_MIN_NUMBER) % FOURFRAME_MAX_NUMBER) + FOURFRAME_MIN_NUMBER;
}

export function compileFourFrameContract<T extends FourFrameContractRecord>(
  records: readonly T[],
): CompiledFourFrameContract<T> {
  if (records.length === 0) {
    throw new FourFrameContractError([{ code: 'EMPTY_DATASET' }]);
  }

  const issues: FourFrameContractIssue[] = [];
  if (records.length !== FOURFRAME_EXPECTED_RECORD_COUNT) {
    issues.push({
      code: 'UNEXPECTED_RECORD_COUNT',
      expected: FOURFRAME_EXPECTED_RECORD_COUNT,
      actual: records.length,
    });
  }

  const firstRowByNumber = new Map<number, number>();
  records.forEach((record, rowIndex) => {
    const number = record.number as unknown;
    const validNumber = isValidNumber(number) ? number : null;
    if (validNumber === null) {
      issues.push({ code: 'INVALID_NUMBER', rowIndex, received: number });
    } else {
      const firstRowIndex = firstRowByNumber.get(validNumber);
      if (firstRowIndex !== undefined) {
        issues.push({
          code: 'DUPLICATE_NUMBER',
          number: validNumber,
          firstRowIndex,
          duplicateRowIndex: rowIndex,
        });
      } else {
        firstRowByNumber.set(validNumber, rowIndex);
      }
    }

    for (const field of ['title', 'summary'] as const) {
      if (!isRequiredText(record[field])) {
        issues.push({
          code: 'MISSING_REQUIRED_FIELD',
          rowIndex,
          number: validNumber,
          field,
        });
      }
    }

    if (!isRequiredText(record.lucky_level)) {
      issues.push({
        code: 'MISSING_REQUIRED_FIELD',
        rowIndex,
        number: validNumber,
        field: 'lucky_level',
      });
    } else if (!ALLOWED_LUCKY_LEVELS.has(record.lucky_level)) {
      issues.push({
        code: 'INVALID_LUCKY_LEVEL',
        rowIndex,
        number: validNumber,
        received: record.lucky_level,
        allowed: FOURFRAME_LUCKY_LEVELS,
      });
    }
  });

  const missingNumbers: number[] = [];
  for (let number = FOURFRAME_MIN_NUMBER; number <= FOURFRAME_MAX_NUMBER; number += 1) {
    if (!firstRowByNumber.has(number)) missingNumbers.push(number);
  }
  if (missingNumbers.length > 0) {
    issues.push({ code: 'MISSING_NUMBERS', numbers: missingNumbers });
  }

  if (issues.length > 0) throw new FourFrameContractError(issues);

  const recordsByNumber = new Map<number, T>();
  const luckyByNumber = new Map<number, FourFrameLuckyLevel>();
  const favorableNumbers = new Set<number>();
  for (const record of [...records].sort((a, b) => a.number - b.number)) {
    const luckyLevel = record.lucky_level as FourFrameLuckyLevel;
    recordsByNumber.set(record.number, record);
    luckyByNumber.set(record.number, luckyLevel);
    if (FAVORABLE_LUCKY_LEVELS.has(luckyLevel)) favorableNumbers.add(record.number);
  }

  return { recordsByNumber, luckyByNumber, favorableNumbers };
}
