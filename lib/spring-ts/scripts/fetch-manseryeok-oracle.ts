/**
 * Fetch a normalized day-pillar oracle fixture from the KASI monthly
 * lunisolar table.
 *
 * Primary no-key source:
 *   POST https://astro.kasi.re.kr/life/pageView/5
 *   body: search_year=<YYYY>&search_month=<MM>&search_dp=1&search_check=G
 *
 * Run:
 *   npx tsx scripts/fetch-manseryeok-oracle.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface DatePart {
  readonly month: number;
  readonly day: number;
  readonly label: string;
}

interface CliOptions {
  readonly outPath: string;
  readonly yearStart: number;
  readonly yearEnd: number;
  readonly dateParts: readonly DatePart[];
  readonly concurrency: number;
}

interface ParsedMonthlyRow {
  readonly solar: string;
  readonly dayPillar: string;
}

interface SourceTierBlock {
  readonly tier: 'T5_OFFICIAL';
  readonly sourceType: 'official_kasi_lunisolar_calendar_table';
  readonly sourceUrl: string;
  readonly accessedAt: string;
  readonly quoteShort: string | null;
  readonly humanInterpretation: string;
  readonly copyrightNote: string;
  readonly authorityTruthEligible: true;
}

interface OracleCase {
  readonly id: string;
  readonly solar: string;
  readonly expectedDayPillar: string;
  readonly source: 'KASI';
  readonly sourceTier: SourceTierBlock;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SOURCE_URL = 'https://astro.kasi.re.kr/life/pageView/5';
const DEFAULT_DATES = ['03-15', '07-08', '11-22'];
const STEM_CLASS = '\u7532\u4E59\u4E19\u4E01\u620A\u5DF1\u5E9A\u8F9B\u58EC\u7678';
const BRANCH_CLASS = '\u5B50\u4E11\u5BC5\u536F\u8FB0\u5DF3\u5348\u672A\u7533\u9149\u620C\u4EA5';
const GANJI_PATTERN = `[${STEM_CLASS}][${BRANCH_CLASS}]`;
const DAY_PILLAR_RE = new RegExp(`\\((${GANJI_PATTERN})\\)\\s*\\uC77C`, 'u');
const ANY_PAREN_PILLAR_RE = new RegExp(`\\((${GANJI_PATTERN})\\)`, 'gu');
const GANJI_RE = new RegExp(`^${GANJI_PATTERN}$`, 'u');
const SOLAR_DATE_RE = new RegExp('^(\\d{1,4})\\s*\\uB144\\s*(\\d{1,2})\\s*\\uC6D4\\s*(\\d{1,2})\\s*\\uC77C', 'u');

function usage(): never {
  console.error([
    'Usage: npx tsx scripts/fetch-manseryeok-oracle.ts [--out <path>] [--years <start-end>] [--dates <mm-dd,...>] [--concurrency <n>]',
    '',
    'Defaults:',
    '  --out test/fixtures/manseryeok_oracle_cases.json',
    '  --years 1900-2050',
    `  --dates ${DEFAULT_DATES.join(',')}`,
    '',
    'Env:',
    '  MANSERYEOK_ORACLE_FETCHED_AT  deterministic fetchedAt timestamp',
    '  MANSERYEOK_KASI_PAGE_URL      override KASI monthly table URL',
  ].join('\n'));
  process.exit(2);
}

function parseDatePart(raw: string): DatePart {
  const match = raw.match(/^(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Invalid date part: ${raw}`);
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) throw new Error(`Invalid date part: ${raw}`);
  return { month, day, label: `${pad2(month)}-${pad2(day)}` };
}

function parseYearRange(raw: string): { yearStart: number; yearEnd: number } {
  const match = raw.match(/^(\d{1,4})-(\d{1,4})$/);
  if (!match) throw new Error(`Invalid --years value: ${raw}`);
  const yearStart = Number(match[1]);
  const yearEnd = Number(match[2]);
  if (yearStart > yearEnd) throw new Error(`Invalid --years value: ${raw}`);
  if (yearStart < -59 || yearEnd > 2050) throw new Error(`KASI documented range is -59 through 2050: ${raw}`);
  return { yearStart, yearEnd };
}

function parseArgs(argv: readonly string[]): CliOptions {
  let outPath = path.resolve(SPRING_TS_ROOT, 'test/fixtures/manseryeok_oracle_cases.json');
  let yearStart = 1900;
  let yearEnd = 2050;
  let dateParts = DEFAULT_DATES.map(parseDatePart);
  let concurrency = 4;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') {
      outPath = path.resolve(argv[++i] ?? '');
    } else if (arg === '--years') {
      ({ yearStart, yearEnd } = parseYearRange(argv[++i] ?? ''));
    } else if (arg === '--dates') {
      dateParts = (argv[++i] ?? '').split(',').map((item) => item.trim()).filter(Boolean).map(parseDatePart);
      if (dateParts.length === 0) throw new Error('--dates must contain at least one mm-dd value');
    } else if (arg === '--concurrency') {
      concurrency = Number(argv[++i]);
      if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 12) throw new Error('--concurrency must be an integer from 1 to 12');
    } else if (arg === '--help' || arg === '-h') {
      usage();
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { outPath, yearStart, yearEnd, dateParts, concurrency };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

function assertValidSolarDate(year: number, month: number, day: number): void {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw new Error(`Invalid Gregorian date target: ${isoDate(year, month, day)}`);
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, dec: string) => String.fromCodePoint(Number(dec)));
}

function normalizeCell(raw: string): string {
  return decodeEntities(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSolarDateCell(text: string): string | null {
  const match = text.match(SOLAR_DATE_RE);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  assertValidSolarDate(year, month, day);
  return isoDate(year, month, day);
}

function extractDayPillar(text: string): string | null {
  const direct = text.match(DAY_PILLAR_RE)?.[1];
  if (direct && GANJI_RE.test(direct)) return direct;

  const parenMatches = [...text.matchAll(ANY_PAREN_PILLAR_RE)].map((match) => match[1]).filter(Boolean);
  const fallback = parenMatches.at(-1);
  return fallback && GANJI_RE.test(fallback) ? fallback : null;
}

function parseMonthlyRows(html: string): ParsedMonthlyRow[] {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const parsed: ParsedMonthlyRow[] = [];

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => normalizeCell(match[1]));
    if (cells.length < 3) continue;

    const solar = parseSolarDateCell(cells[0]);
    if (!solar) continue;

    const dayPillar = cells.map(extractDayPillar).find((value): value is string => Boolean(value));
    if (!dayPillar) throw new Error(`KASI row did not include a day pillar for ${solar}: ${cells.join(' | ')}`);
    parsed.push({ solar, dayPillar });
  }

  return parsed;
}

async function fetchMonthlyTable(year: number, month: number): Promise<string> {
  const url = process.env.MANSERYEOK_KASI_PAGE_URL ?? DEFAULT_SOURCE_URL;
  const body = new URLSearchParams({
    search_year: String(year),
    search_month: pad2(month),
    search_dp: '1',
    search_check: 'G',
  });
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'spring-ts-manseryeok-oracle-fetcher/1.0',
    },
    body,
  });
  if (!response.ok) throw new Error(`KASI monthly table fetch failed for ${year}-${pad2(month)}: HTTP ${response.status}`);
  return response.text();
}

async function mapWithConcurrency<T, U>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<U>,
): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function buildSourceTier(sourceUrl: string, accessedAt: string): SourceTierBlock {
  return {
    tier: 'T5_OFFICIAL',
    sourceType: 'official_kasi_lunisolar_calendar_table',
    sourceUrl,
    accessedAt,
    quoteShort: 'monthly table exposes lunar ganzhi rows',
    humanInterpretation: 'KASI monthly lunisolar rows provide the official day-pillar ganji used here as normalized date facts.',
    copyrightNote: 'Stores only normalized dates, day pillars, and source metadata; no copied prose or bulk table mirror.',
    authorityTruthEligible: true,
  };
}

async function fetchOracleCases(options: CliOptions, sourceTier: SourceTierBlock): Promise<OracleCase[]> {
  const targetIso = new Set<string>();
  const monthKeys = new Set<string>();

  for (let year = options.yearStart; year <= options.yearEnd; year += 1) {
    for (const datePart of options.dateParts) {
      assertValidSolarDate(year, datePart.month, datePart.day);
      targetIso.add(isoDate(year, datePart.month, datePart.day));
      monthKeys.add(`${year}-${pad2(datePart.month)}`);
    }
  }

  const rowsBySolar = new Map<string, ParsedMonthlyRow>();
  const keys = [...monthKeys].sort();
  await mapWithConcurrency(keys, options.concurrency, async (key) => {
    const [yearRaw, monthRaw] = key.split('-');
    const rows = parseMonthlyRows(await fetchMonthlyTable(Number(yearRaw), Number(monthRaw)));
    for (const row of rows) {
      if (targetIso.has(row.solar)) rowsBySolar.set(row.solar, row);
    }
  });

  const cases: OracleCase[] = [...targetIso].sort().map((solar) => {
    const row = rowsBySolar.get(solar);
    if (!row) throw new Error(`KASI monthly table did not return target date ${solar}`);
    return {
      id: `mo-${solar}`,
      solar,
      expectedDayPillar: row.dayPillar,
      source: 'KASI',
      sourceTier: buildSourceTier(sourceTier.sourceUrl, sourceTier.accessedAt),
    };
  });

  return cases;
}

function buildFixture(options: CliOptions, cases: readonly OracleCase[], sourceTier: SourceTierBlock): object {
  const fetchedAt = process.env.MANSERYEOK_ORACLE_FETCHED_AT ?? new Date().toISOString();
  const accessedAt = fetchedAt.slice(0, 10);
  return {
    _meta: {
      schemaVersion: 'spring-ts.manseryeok-oracle-fixture.v1',
      source: 'KASI monthly lunisolar table',
      sourceUrl: sourceTier.sourceUrl,
      fetchedAt,
      accessedAt,
      timezone: 'Asia/Seoul (KST = UTC+9)',
      calendarBasis: 'Gregorian solar date to official KASI day pillar',
      samplePolicy: {
        years: [options.yearStart, options.yearEnd],
        datesPerYear: options.dateParts.map((part) => part.label),
        noonPolicy: 'Integration test evaluates each solar date at 12:00 KST to avoid day-pillar boundary ambiguity.',
      },
      totalCases: cases.length,
      sourceTier,
    },
    cases,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const fetchedAt = process.env.MANSERYEOK_ORACLE_FETCHED_AT ?? new Date().toISOString();
  const accessedAt = fetchedAt.slice(0, 10);
  const sourceTier = buildSourceTier(process.env.MANSERYEOK_KASI_PAGE_URL ?? DEFAULT_SOURCE_URL, accessedAt);
  const cases = await fetchOracleCases(options, sourceTier);
  const fixture = buildFixture(options, cases, sourceTier);

  fs.mkdirSync(path.dirname(options.outPath), { recursive: true });
  fs.writeFileSync(options.outPath, JSON.stringify(fixture, null, 2) + '\n', 'utf-8');
  console.log(`Wrote ${options.outPath}`);
  console.log(`Cases: ${cases.length}; years=${options.yearStart}-${options.yearEnd}; dates=${options.dateParts.map((part) => part.label).join(',')}`);
}

await main();
