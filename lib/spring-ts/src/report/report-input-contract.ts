export const FORTUNE_TARGET_DATE_INVALID = 'FORTUNE_TARGET_DATE_INVALID' as const;
export const FORTUNE_REPORT_BUILD_FAILED = 'FORTUNE_REPORT_BUILD_FAILED' as const;
const MAX_FORTUNE_TARGET_DATE_CODE_UNITS = 128;

export class FortuneTargetDateInvalidError extends Error {
  readonly code = FORTUNE_TARGET_DATE_INVALID;
  readonly retryable = false;

  constructor() {
    super('운세 기준일 형식이 올바르지 않습니다.');
    this.name = 'FortuneTargetDateInvalidError';
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

export function resolveFortuneTargetDate(raw: string | undefined): Date {
  if (raw === undefined) return new Date();
  if (
    typeof raw !== 'string'
    || raw.length > MAX_FORTUNE_TARGET_DATE_CODE_UNITS
  ) {
    throw new FortuneTargetDateInvalidError();
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new FortuneTargetDateInvalidError();
  }
  return parsed;
}
