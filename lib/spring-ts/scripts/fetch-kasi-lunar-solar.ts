/**
 * Fetch a normalized KASI lunar-solar conversion fixture.
 *
 * Primary no-key source:
 *   POST https://astro.kasi.re.kr/life/pageView/5
 *   body: search_year=<YYYY>&search_month=<MM>&search_dp=1&search_check=G
 *
 * Optional API cross-check:
 *   data.go.kr LrsrCldInfoService/getLunCalInfo
 *   env: KASI_LUNISOLAR_SERVICE_KEY or KASI_DATA_GO_KR_SERVICE_KEY or DATA_GO_KR_SERVICE_KEY
 *
 * Run:
 *   npx tsx scripts/fetch-kasi-lunar-solar.ts
 *   KASI_LUNISOLAR_SERVICE_KEY=... npx tsx scripts/fetch-kasi-lunar-solar.ts --require-data-go-kr
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface TargetCase {
  readonly solarIso: string;
  readonly tags: readonly string[];
}

interface LunarSolarCase {
  readonly id: string;
  readonly tags: readonly string[];
  readonly solar: { readonly year: number; readonly month: number; readonly day: number; readonly iso: string };
  readonly lunar: {
    readonly year: number;
    readonly month: number;
    readonly day: number;
    readonly isLeapMonth: boolean;
    readonly label: string;
  };
  readonly raw: {
    readonly lunLeapmonth: '평' | '윤';
    readonly solWeekKo: string;
    readonly solJd: string;
  };
}

interface CliOptions {
  readonly outPath: string;
  readonly targetCases: readonly TargetCase[];
  readonly requireDataGoKr: boolean;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');

const DEFAULT_TARGET_CASES: readonly TargetCase[] = [
  { solarIso: '2025-07-24', tags: ['normal_month', 'lunar_month_end', 'pre_leap_boundary'] },
  { solarIso: '2025-07-25', tags: ['leap_month', 'lunar_month_start', 'leap_month_start'] },
  { solarIso: '2025-08-22', tags: ['leap_month', 'lunar_month_end', 'leap_month_end'] },
  { solarIso: '2025-08-23', tags: ['normal_month', 'lunar_month_start', 'post_leap_boundary'] },
  { solarIso: '2025-12-31', tags: ['solar_year_boundary', 'solar_year_end'] },
  { solarIso: '2026-01-01', tags: ['solar_year_boundary', 'solar_year_start'] },
  { solarIso: '2026-02-16', tags: ['lunar_new_year_boundary', 'lunar_year_end'] },
  { solarIso: '2026-02-17', tags: ['lunar_new_year_boundary', 'lunar_year_start', 'lunar_month_start'] },
  { solarIso: '2026-04-01', tags: ['normal_month'] },
  { solarIso: '2026-05-16', tags: ['normal_month', 'lunar_month_end'] },
  { solarIso: '2026-05-17', tags: ['normal_month', 'lunar_month_start'] },
  { solarIso: '2026-07-13', tags: ['normal_month', 'lunar_month_end'] },
  { solarIso: '2026-07-14', tags: ['normal_month', 'lunar_month_start'] },
];

function usage(): never {
  console.error([
    'Usage: npx tsx scripts/fetch-kasi-lunar-solar.ts [--out <path>] [--dates <yyyy-mm-dd,...>] [--require-data-go-kr]',
    '',
    'Env:',
    '  KASI_LUNISOLAR_OUTPUT        default output path',
    '  KASI_LUNISOLAR_FETCHED_AT    deterministic fetchedAt timestamp',
    '  KASI_LUNISOLAR_PAGE_URL      override KASI monthly table URL',
    '  KASI_LUNISOLAR_SERVICE_KEY   optional data.go.kr key for cross-check',
    '  KASI_DATA_GO_KR_SERVICE_KEY  fallback data.go.kr key',
    '  DATA_GO_KR_SERVICE_KEY       fallback data.go.kr key',
    '  KASI_LUNISOLAR_API_URL       override LrsrCldInfoService base URL',
  ].join('\n'));
  process.exit(2);
}

function parseArgs(argv: readonly string[]): CliOptions {
  let outPath = process.env.KASI_LUNISOLAR_OUTPUT ??
    path.resolve(SPRING_TS_ROOT, 'data/kasi-lunar-solar/kasi_lunar_solar_2025_2026_cases.json');
  let targetCases: readonly TargetCase[] = DEFAULT_TARGET_CASES;
  let requireDataGoKr = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') {
      outPath = argv[++i];
    } else if (arg === '--dates') {
      const dates = (argv[++i] ?? '').split(',').map((date) => date.trim()).filter(Boolean);
      targetCases = dates.map((solarIso) => ({ solarIso, tags: ['custom'] }));
    } else if (arg === '--require-data-go-kr') {
      requireDataGoKr = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  for (const target of targetCases) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(target.solarIso)) {
      throw new Error(`Invalid --dates value: ${target.solarIso}`);
    }
  }

  return { outPath, targetCases, requireDataGoKr };
}

function normalizeCell(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function parseKoreanSolarDate(text: string): { year: number; month: number; day: number; iso: string } {
  const match = text.match(/^(\d{4})년\s+(\d{2})월\s+(\d{2})일$/);
  if (!match) throw new Error(`Invalid KASI solar date cell: ${text}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return { year, month, day, iso: `${year}-${pad2(month)}-${pad2(day)}` };
}

function parseKoreanLunarDate(text: string): LunarSolarCase['lunar'] {
  const match = text.match(/^(\d{4})년\s+(윤)?(\d{2})월\s+(\d{2})일$/);
  if (!match) throw new Error(`Invalid KASI lunar date cell: ${text}`);
  const year = Number(match[1]);
  const isLeapMonth = match[2] === '윤';
  const month = Number(match[3]);
  const day = Number(match[4]);
  const label = `${year}-${isLeapMonth ? 'leap-' : ''}${pad2(month)}-${pad2(day)}`;
  return { year, month, day, isLeapMonth, label };
}

function lunarKey(lunar: LunarSolarCase['lunar']): string {
  return `${lunar.year}-${lunar.isLeapMonth ? 'leap-' : ''}${pad2(lunar.month)}-${pad2(lunar.day)}`;
}

function idFor(row: LunarSolarCase): string {
  return `solar-${row.solar.iso}-lunar-${lunarKey(row.lunar).replaceAll('leap-', 'leap-')}`;
}

async function fetchMonthlyTable(year: number, month: number): Promise<string> {
  const url = process.env.KASI_LUNISOLAR_PAGE_URL ?? 'https://astro.kasi.re.kr/life/pageView/5';
  const body = new URLSearchParams({
    search_year: String(year),
    search_month: pad2(month),
    search_dp: '1',
    search_check: 'G',
  });
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new Error(`KASI monthly lunisolar fetch failed: HTTP ${response.status}`);
  return response.text();
}

function parseMonthlyRows(html: string): LunarSolarCase[] {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];
  const parsed: LunarSolarCase[] = [];

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => normalizeCell(match[1]));
    if (cells.length < 5 || !/^\d{4}년\s+\d{2}월\s+\d{2}일$/.test(cells[0])) continue;
    const solar = parseKoreanSolarDate(cells[0]);
    const lunar = parseKoreanLunarDate(cells[1]);
    const parsedRow: LunarSolarCase = {
      id: '',
      tags: [],
      solar,
      lunar,
      raw: {
        lunLeapmonth: lunar.isLeapMonth ? '윤' : '평',
        solWeekKo: cells[3].replace(/요일$/, ''),
        solJd: cells[4],
      },
    };
    parsed.push({ ...parsedRow, id: idFor(parsedRow) });
  }

  return parsed;
}

function xmlField(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`));
  return match ? normalizeCell(match[1]) : null;
}

async function fetchDataGoKrLunarForSolar(
  solar: LunarSolarCase['solar'],
): Promise<{ year: number; month: number; day: number; isLeapMonth: boolean } | null> {
  const serviceKey = process.env.KASI_LUNISOLAR_SERVICE_KEY ??
    process.env.KASI_DATA_GO_KR_SERVICE_KEY ??
    process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) return null;

  const baseUrl = process.env.KASI_LUNISOLAR_API_URL ??
    'https://apis.data.go.kr/B090041/openapi/service/LrsrCldInfoService';
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/getLunCalInfo`);
  url.searchParams.set('ServiceKey', serviceKey);
  url.searchParams.set('solYear', String(solar.year));
  url.searchParams.set('solMonth', pad2(solar.month));
  url.searchParams.set('solDay', pad2(solar.day));

  const response = await fetch(url);
  if (!response.ok) throw new Error(`data.go.kr getLunCalInfo failed: HTTP ${response.status}`);
  const xml = await response.text();
  const resultCode = xmlField(xml, 'resultCode');
  if (resultCode && resultCode !== '00') {
    throw new Error(`data.go.kr getLunCalInfo resultCode=${resultCode} resultMsg=${xmlField(xml, 'resultMsg') ?? ''}`);
  }

  const year = Number(xmlField(xml, 'lunYear'));
  const month = Number(xmlField(xml, 'lunMonth'));
  const day = Number(xmlField(xml, 'lunDay'));
  const leap = xmlField(xml, 'lunLeapmonth') === '윤';
  if (![year, month, day].every(Number.isInteger)) return null;
  return { year, month, day, isLeapMonth: leap };
}

async function buildCrossCheck(cases: readonly LunarSolarCase[], requireDataGoKr: boolean): Promise<object> {
  const serviceKey = process.env.KASI_LUNISOLAR_SERVICE_KEY ??
    process.env.KASI_DATA_GO_KR_SERVICE_KEY ??
    process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) {
    if (requireDataGoKr) throw new Error('Missing KASI_LUNISOLAR_SERVICE_KEY, KASI_DATA_GO_KR_SERVICE_KEY, or DATA_GO_KR_SERVICE_KEY.');
    return {
      status: 'SKIPPED_NO_SERVICE_KEY',
      env: ['KASI_LUNISOLAR_SERVICE_KEY', 'KASI_DATA_GO_KR_SERVICE_KEY', 'DATA_GO_KR_SERVICE_KEY'],
      preferredLeapOperation: 'getSpcifyLunCalInfo',
    };
  }

  const mismatches: object[] = [];
  for (const row of cases) {
    const actual = await fetchDataGoKrLunarForSolar(row.solar);
    if (!actual ||
        actual.year !== row.lunar.year ||
        actual.month !== row.lunar.month ||
        actual.day !== row.lunar.day ||
        actual.isLeapMonth !== row.lunar.isLeapMonth) {
      mismatches.push({ id: row.id, expected: row.lunar, actual });
    }
  }

  return {
    status: mismatches.length === 0 ? 'PASS' : 'MISMATCH',
    checkedRows: cases.length,
    mismatches,
    preferredLeapOperation: 'getSpcifyLunCalInfo',
  };
}

async function fetchFixtureRows(targetCases: readonly TargetCase[]): Promise<LunarSolarCase[]> {
  const months = new Map<string, Promise<LunarSolarCase[]>>();
  const rowsBySolar = new Map<string, LunarSolarCase>();

  for (const target of targetCases) {
    const [yearRaw, monthRaw] = target.solarIso.split('-');
    const key = `${yearRaw}-${monthRaw}`;
    if (!months.has(key)) {
      months.set(key, fetchMonthlyTable(Number(yearRaw), Number(monthRaw)).then(parseMonthlyRows));
    }
  }

  for (const rows of await Promise.all(months.values())) {
    for (const row of rows) rowsBySolar.set(row.solar.iso, row);
  }

  return targetCases.map((target) => {
    const row = rowsBySolar.get(target.solarIso);
    if (!row) throw new Error(`KASI monthly table did not return target date ${target.solarIso}`);
    return { ...row, tags: target.tags, id: idFor({ ...row, tags: target.tags }) };
  });
}

function buildFixture(cases: readonly LunarSolarCase[], dataGoKrCrossCheck: object): object {
  const fetchedAt = process.env.KASI_LUNISOLAR_FETCHED_AT ?? new Date().toISOString();
  const accessedAt = fetchedAt.slice(0, 10);
  const years = [...new Set(cases.flatMap((row) => [row.solar.year, row.lunar.year]))].sort();

  return {
    _meta: {
      schemaVersion: 'spring-ts.kasi-lunar-solar-fixture.v1',
      source: 'KASI monthly lunisolar table',
      sourceUrl: 'https://astro.kasi.re.kr/life/pageView/5',
      fetchedAt,
      accessedAt,
      timezone: 'Asia/Seoul (KST = UTC+9)',
      calendarBasis: 'Gregorian solar date to Korean lunisolar date',
      years,
      totalCases: cases.length,
      requiredTags: [
        'normal_month',
        'leap_month',
        'lunar_month_end',
        'lunar_month_start',
        'lunar_new_year_boundary',
        'solar_year_boundary',
      ],
      dataGoKrCrossCheck,
      sourceTier: {
        tier: 'T5_OFFICIAL',
        sourceType: 'official_kasi_lunisolar_calendar_table',
        sourceUrl: 'https://astro.kasi.re.kr/life/pageView/5',
        accessedAt,
        quoteShort: null,
        humanInterpretation: 'KASI-hosted monthly lunisolar table provides normalized Gregorian-to-lunar correspondence rows used for leap-month and boundary regression checks.',
        copyrightNote: 'Small normalized date facts only; no copied prose or bulk mirror.',
        authorityTruthEligible: true,
      },
    },
    cases,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const cases = await fetchFixtureRows(options.targetCases);
  const dataGoKrCrossCheck = await buildCrossCheck(cases, options.requireDataGoKr);
  const fixture = buildFixture(cases, dataGoKrCrossCheck);

  fs.mkdirSync(path.dirname(options.outPath), { recursive: true });
  fs.writeFileSync(options.outPath, JSON.stringify(fixture, null, 2) + '\n', 'utf-8');
  console.log(`Wrote ${options.outPath}`);
  console.log(`Cases: ${cases.length}, leap=${cases.filter((row) => row.lunar.isLeapMonth).length}`);
}

await main();
