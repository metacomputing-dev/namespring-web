import { registerTargetCalendarDate } from '../target-date.js';

export const FORTUNE_TARGET_DATE_INVALID = 'FORTUNE_TARGET_DATE_INVALID' as const;
export const FORTUNE_REPORT_BUILD_FAILED = 'FORTUNE_REPORT_BUILD_FAILED' as const;

export class FortuneTargetDateInvalidError extends Error {
  readonly code = FORTUNE_TARGET_DATE_INVALID;
  readonly input: string;

  constructor(input: string) {
    super('운세 기준일 형식이 올바르지 않습니다.');
    this.name = 'FortuneTargetDateInvalidError';
    this.input = input;
  }
}

export class FortuneReportBuildError extends Error {
  readonly code = FORTUNE_REPORT_BUILD_FAILED;
  readonly component: string;

  constructor(component: string, cause: unknown) {
    super('운세 보고서의 필수 계산을 완료하지 못했습니다.', { cause });
    this.name = 'FortuneReportBuildError';
    this.component = component;
  }
}

const STRICT_TARGET_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:$|T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2}))$/;

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1 || year > 9_999 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function resolveFortuneTargetDate(raw: string | undefined): Date {
  if (raw === undefined) return new Date();
  if (typeof raw !== 'string' || raw !== raw.trim()) {
    throw new FortuneTargetDateInvalidError(String(raw));
  }
  const match = STRICT_TARGET_DATE.exec(raw);
  if (!match) throw new FortuneTargetDateInvalidError(raw);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidCalendarDate(year, month, day)) throw new FortuneTargetDateInvalidError(raw);
  if (match[4] !== undefined) {
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = match[6] === undefined ? 0 : Number(match[6]);
    const zone = match[8];
    const offset = zone === 'Z' ? null : zone.slice(1).split(':').map(Number);
    if (hour > 23 || minute > 59 || second > 59
      || (offset !== null && (offset[0] > 14 || offset[1] > 59
        || (offset[0] === 14 && offset[1] !== 0)))) {
      throw new FortuneTargetDateInvalidError(raw);
    }
  }

  const parsed = raw.length === 10
    ? new Date(Date.UTC(year, month - 1, day))
    : new Date(raw);
  if (!Number.isFinite(parsed.getTime())) throw new FortuneTargetDateInvalidError(raw);
  return registerTargetCalendarDate(parsed, { year, month, day });
}
