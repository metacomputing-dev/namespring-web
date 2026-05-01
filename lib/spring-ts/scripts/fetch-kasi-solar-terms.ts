/**
 * Fetch a normalized KASI 24-solar-term fixture for a target year.
 *
 * Primary source:
 *   POST https://astro.kasi.re.kr/almanacContent
 *   body: year=<YYYY>&bbs_uniq_id=calendarData
 *
 * Optional date-level cross-check:
 *   data.go.kr SpcdeInfoService/get24DivisionsInfo
 *   env: KASI_DATA_GO_KR_SERVICE_KEY or DATA_GO_KR_SERVICE_KEY
 *
 * Run:
 *   npx tsx scripts/fetch-kasi-solar-terms.ts 2026
 *   KASI_DATA_GO_KR_SERVICE_KEY=... npx tsx scripts/fetch-kasi-solar-terms.ts 2026 --require-data-go-kr
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type SolarTermKind = 'jie' | 'zhong';

interface TermSpec {
  readonly id: string;
  readonly name: string;
  readonly hanja: string;
  readonly kind: SolarTermKind;
  readonly branch: string | null;
  readonly degree: number;
}

interface ParsedTerm extends TermSpec {
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly kstIso: string;
  readonly source: {
    readonly month: number;
    readonly day: number;
    readonly hour: number;
    readonly minute: number;
  };
}

interface CliOptions {
  readonly year: number;
  readonly outPath: string;
  readonly requireDataGoKr: boolean;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');

const TERM_SPECS: readonly TermSpec[] = [
  { id: 'XIAOHAN', name: '소한', hanja: '小寒', kind: 'jie',   branch: '丑', degree: 285 },
  { id: 'DAHAN', name: '대한', hanja: '大寒', kind: 'zhong', branch: null, degree: 300 },
  { id: 'LICHUN', name: '입춘', hanja: '立春', kind: 'jie',   branch: '寅', degree: 315 },
  { id: 'YUSHUI', name: '우수', hanja: '雨水', kind: 'zhong', branch: null, degree: 330 },
  { id: 'JINGZHE', name: '경칩', hanja: '驚蟄', kind: 'jie',   branch: '卯', degree: 345 },
  { id: 'CHUNFEN', name: '춘분', hanja: '春分', kind: 'zhong', branch: null, degree: 0 },
  { id: 'QINGMING', name: '청명', hanja: '淸明', kind: 'jie',   branch: '辰', degree: 15 },
  { id: 'GUYU', name: '곡우', hanja: '穀雨', kind: 'zhong', branch: null, degree: 30 },
  { id: 'LIXIA', name: '입하', hanja: '立夏', kind: 'jie',   branch: '巳', degree: 45 },
  { id: 'XIAOMAN', name: '소만', hanja: '小滿', kind: 'zhong', branch: null, degree: 60 },
  { id: 'MANGZHONG', name: '망종', hanja: '芒種', kind: 'jie',   branch: '午', degree: 75 },
  { id: 'XIAZHI', name: '하지', hanja: '夏至', kind: 'zhong', branch: null, degree: 90 },
  { id: 'XIAOSHU', name: '소서', hanja: '小暑', kind: 'jie',   branch: '未', degree: 105 },
  { id: 'DASHU', name: '대서', hanja: '大暑', kind: 'zhong', branch: null, degree: 120 },
  { id: 'LIQIU', name: '입추', hanja: '立秋', kind: 'jie',   branch: '申', degree: 135 },
  { id: 'CHUSHU', name: '처서', hanja: '處暑', kind: 'zhong', branch: null, degree: 150 },
  { id: 'BAILU', name: '백로', hanja: '白露', kind: 'jie',   branch: '酉', degree: 165 },
  { id: 'QIUFEN', name: '추분', hanja: '秋分', kind: 'zhong', branch: null, degree: 180 },
  { id: 'HANLU', name: '한로', hanja: '寒露', kind: 'jie',   branch: '戌', degree: 195 },
  { id: 'SHUANGJIANG', name: '상강', hanja: '霜降', kind: 'zhong', branch: null, degree: 210 },
  { id: 'LIDONG', name: '입동', hanja: '立冬', kind: 'jie',   branch: '亥', degree: 225 },
  { id: 'XIAOXUE', name: '소설', hanja: '小雪', kind: 'zhong', branch: null, degree: 240 },
  { id: 'DAXUE', name: '대설', hanja: '大雪', kind: 'jie',   branch: '子', degree: 255 },
  { id: 'DONGZHI', name: '동지', hanja: '冬至', kind: 'zhong', branch: null, degree: 270 },
];

function usage(): never {
  console.error([
    'Usage: npx tsx scripts/fetch-kasi-solar-terms.ts <year> [--out <path>] [--require-data-go-kr]',
    '',
    'Env:',
    '  KASI_24TERMS_YEAR             default year when <year> is omitted',
    '  KASI_24TERMS_OUTPUT           default output path',
    '  KASI_24TERMS_FETCHED_AT       deterministic fetchedAt timestamp',
    '  KASI_ALMANAC_CONTENT_URL      override KASI almanacContent endpoint',
    '  KASI_DATA_GO_KR_SERVICE_KEY   optional data.go.kr key for date cross-check',
    '  DATA_GO_KR_SERVICE_KEY        fallback data.go.kr key',
    '  KASI_SPCDE_INFO_URL           override SpcdeInfoService base URL',
  ].join('\n'));
  process.exit(2);
}

function parseArgs(argv: readonly string[]): CliOptions {
  const positionals: string[] = [];
  let outPath: string | null = process.env.KASI_24TERMS_OUTPUT ?? null;
  let requireDataGoKr = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') {
      outPath = argv[++i];
    } else if (arg === '--require-data-go-kr') {
      requireDataGoKr = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  const rawYear = positionals[0] ?? process.env.KASI_24TERMS_YEAR;
  const year = Number(rawYear);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) usage();

  return {
    year,
    outPath: outPath ?? path.resolve(SPRING_TS_ROOT, 'data/kasi-solar-terms', `kasi_${year}_24terms.json`),
    requireDataGoKr,
  };
}

function normalizeCell(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function toKstIso(year: number, month: number, day: number, hour: number, minute: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mi = String(minute).padStart(2, '0');
  return `${year}-${mm}-${dd}T${hh}:${mi}:00+09:00`;
}

async function fetchCalendarData(year: number): Promise<string> {
  const url = process.env.KASI_ALMANAC_CONTENT_URL ?? 'https://astro.kasi.re.kr/almanacContent';
  const body = new URLSearchParams({
    year: String(year),
    bbs_uniq_id: 'calendarData',
  });
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new Error(`KASI calendarData fetch failed: HTTP ${response.status}`);
  }
  return response.text();
}

function parseCalendarDataTerms(html: string, year: number): ParsedTerm[] {
  const start = html.indexOf('24절기');
  if (start < 0) throw new Error('Could not find 24절기 section in KASI calendarData response.');
  const tail = html.slice(start);
  const nextSection = tail.search(/<h4[^>]*>|기타 명절|국경일과 공휴일/);
  const section = nextSection > 0 ? tail.slice(0, nextSection) : tail;
  const cells = [...section.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map((match) => normalizeCell(match[1]))
    .filter(Boolean);

  const firstTerm = cells.findIndex((cell) => cell === TERM_SPECS[0].name);
  if (firstTerm < 0) {
    throw new Error(`Could not find first solar term (${TERM_SPECS[0].name}) in KASI calendarData table.`);
  }

  const values = cells.slice(firstTerm, firstTerm + TERM_SPECS.length * 5);
  if (values.length !== TERM_SPECS.length * 5) {
    throw new Error(`Expected ${TERM_SPECS.length * 5} solar-term cells, got ${values.length}.`);
  }

  return TERM_SPECS.map((spec, index) => {
    const offset = index * 5;
    const [name, monthRaw, dayRaw, hourRaw, minuteRaw] = values.slice(offset, offset + 5);
    if (name !== spec.name) {
      throw new Error(`Term order mismatch at ${index}: expected ${spec.name}, got ${name}.`);
    }
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    for (const [label, value] of Object.entries({ month, day, hour, minute })) {
      if (!Number.isInteger(value)) {
        throw new Error(`Invalid ${label} for ${name}: ${values.slice(offset, offset + 5).join(', ')}`);
      }
    }
    return {
      ...spec,
      month,
      day,
      hour,
      minute,
      kstIso: toKstIso(year, month, day, hour, minute),
      source: { month, day, hour, minute },
    };
  });
}

function xmlField(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`));
  return match ? normalizeCell(match[1]) : null;
}

async function fetchDataGoKrTerms(year: number): Promise<Array<{ dateName: string; locdate: string }>> {
  const serviceKey = process.env.KASI_DATA_GO_KR_SERVICE_KEY ?? process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) return [];

  const baseUrl = process.env.KASI_SPCDE_INFO_URL ??
    'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/get24DivisionsInfo';
  const url = new URL(baseUrl);
  url.searchParams.set('ServiceKey', serviceKey);
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('numOfRows', '100');
  url.searchParams.set('solYear', String(year));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`data.go.kr get24DivisionsInfo failed: HTTP ${response.status}`);
  }
  const xml = await response.text();
  const resultCode = xmlField(xml, 'resultCode');
  if (resultCode && resultCode !== '00') {
    throw new Error(`data.go.kr get24DivisionsInfo resultCode=${resultCode} resultMsg=${xmlField(xml, 'resultMsg') ?? ''}`);
  }

  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => ({
    dateName: xmlField(match[1], 'dateName') ?? '',
    locdate: xmlField(match[1], 'locdate') ?? '',
  })).filter((row) => row.dateName && row.locdate);
}

function buildDataGoKrCrossCheck(
  terms: readonly ParsedTerm[],
  dataGoKrRows: readonly { readonly dateName: string; readonly locdate: string }[],
): object {
  if (dataGoKrRows.length === 0) {
    return {
      status: 'SKIPPED_NO_SERVICE_KEY',
      env: ['KASI_DATA_GO_KR_SERVICE_KEY', 'DATA_GO_KR_SERVICE_KEY'],
    };
  }

  const byName = new Map(dataGoKrRows.map((row) => [row.dateName, row.locdate]));
  const mismatches = terms
    .map((term) => {
      const expected = `${String(term.month).padStart(2, '0')}${String(term.day).padStart(2, '0')}`;
      const actual = byName.get(term.name);
      return actual?.slice(4) === expected
        ? null
        : { name: term.name, expectedMonthDay: expected, dataGoKrLocdate: actual ?? null };
    })
    .filter(Boolean);

  return {
    status: mismatches.length === 0 ? 'PASS' : 'MISMATCH',
    checkedRows: dataGoKrRows.length,
    mismatches,
  };
}

function buildFixture(
  year: number,
  terms: readonly ParsedTerm[],
  dataGoKrCrossCheck: object,
): object {
  const fetchedAt = process.env.KASI_24TERMS_FETCHED_AT ?? new Date().toISOString();
  const accessedAt = fetchedAt.slice(0, 10);
  return {
    _meta: {
      schemaVersion: 'spring-ts.kasi-solar-terms-fixture.v1',
      source: 'KASI calendarData 24절기 table',
      sourceUrl: `https://astro.kasi.re.kr/life/post/calendarData?year=${year}`,
      fetchUrl: process.env.KASI_ALMANAC_CONTENT_URL ?? 'https://astro.kasi.re.kr/almanacContent',
      fetchedAt,
      accessedAt,
      timezone: 'Asia/Seoul (KST = UTC+9)',
      year,
      totalTerms: terms.length,
      jieTerms: terms.filter((term) => term.kind === 'jie').length,
      zhongTerms: terms.filter((term) => term.kind === 'zhong').length,
      resolution: 'minute',
      allowedEngineErrorMinutes: 10,
      aspirationalErrorMinutes: 2,
      allowedSpringApproxDayErrorDays: 1,
      calendarDataNotice: 'KASI calendarData carries a non-official-data notice; official 월력요항 publication should supersede this minute fixture when available.',
      dataGoKrCrossCheck,
      sourceTier: {
        tier: 'T5_OFFICIAL',
        sourceType: 'official_kasi_calendar_data_preview',
        sourceUrl: 'https://astro.kasi.re.kr/life/post/calendarData',
        accessedAt,
        quoteShort: null,
        humanInterpretation: 'KASI-hosted calendarData table provides normalized 24 solar-term dates and minute-level KST times for regression comparison; it is not treated as authority truth while the source page warns to use official 월력요항 for official publication.',
        copyrightNote: 'Small normalized fact fixture only; no copied prose or bulk mirror.',
        authorityTruthEligible: false,
      },
    },
    terms,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const html = await fetchCalendarData(options.year);
  const terms = parseCalendarDataTerms(html, options.year);

  let dataGoKrRows: Array<{ dateName: string; locdate: string }> = [];
  try {
    dataGoKrRows = await fetchDataGoKrTerms(options.year);
    if (options.requireDataGoKr && dataGoKrRows.length === 0) {
      throw new Error('Missing KASI_DATA_GO_KR_SERVICE_KEY or DATA_GO_KR_SERVICE_KEY.');
    }
  } catch (err) {
    if (options.requireDataGoKr) throw err;
    console.warn(`WARN: data.go.kr cross-check skipped: ${(err as Error).message}`);
  }

  const fixture = buildFixture(options.year, terms, buildDataGoKrCrossCheck(terms, dataGoKrRows));
  fs.mkdirSync(path.dirname(options.outPath), { recursive: true });
  fs.writeFileSync(options.outPath, JSON.stringify(fixture, null, 2) + '\n', 'utf-8');
  console.log(`Wrote ${options.outPath}`);
  console.log(`Terms: ${terms.length}, jie=${terms.filter((term) => term.kind === 'jie').length}`);
}

await main();
