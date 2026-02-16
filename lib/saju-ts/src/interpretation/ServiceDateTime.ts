export interface ServiceDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

export const SERVICE_TIMEZONE = 'Asia/Seoul';

function readPart(
  parts: readonly Intl.DateTimeFormatPart[],
  token: 'year' | 'month' | 'day' | 'hour' | 'minute',
): number {
  const value = parts.find(part => part.type === token)?.value;
  const parsed = value != null ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getDatePartsInTimeZone(date: Date, timeZone: string): ServiceDateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  return {
    year: readPart(parts, 'year'),
    month: readPart(parts, 'month'),
    day: readPart(parts, 'day'),
    hour: readPart(parts, 'hour'),
    minute: readPart(parts, 'minute'),
  };
}

export function getKoreanDateParts(date: Date = new Date()): ServiceDateParts {
  return getDatePartsInTimeZone(date, SERVICE_TIMEZONE);
}
