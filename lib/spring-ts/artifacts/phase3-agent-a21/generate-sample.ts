/**
 * artifacts/phase3-agent-a21/generate-sample.ts
 *
 * Phase 3 Agent A21 helper: capture NameSpring legacy-fields output before
 * and after card text polish. Produces one JSON file per fixture into the
 * before-after/ subdirectory using the suffix passed via argv[2].
 *
 *   npx tsx artifacts/phase3-agent-a21/generate-sample.ts before
 *   npx tsx artifacts/phase3-agent-a21/generate-sample.ts after
 *
 * The captured fields focus on what NameSpring (FE without precisionConfig
 * surfaceTieredMatrix) actually renders today: overviewSummary,
 * lifeFortuneOverview, dailyFortune, weekly/monthly/yearlyFortune,
 * categoryFortunes[*], lifeStageFortune, cautions, personality,
 * strengthsWeaknesses, nameCompatibility.summary fields.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');
const OUT_DIR = path.join(__dirname, 'before-after');
const TARGET_DATE = '2026-05-04T00:00:00+09:00';

const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: any, options?: any) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlStr.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlStr.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlStr.includes('sql-wasm.wasm') || urlStr.startsWith('https://sql.js.org/') || urlStr === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  if (originalFetch) return originalFetch(url, options);
  throw new Error(`fetch unavailable for ${urlStr}`);
};

import { SpringEngine } from '../../src/index.js';

type Fixture = {
  readonly id: string;
  readonly label: string;
  readonly request: any;
};

const baseTimePolicy = {
  sajuTimePolicy: {
    yaza: 'on' as const,
    yazaMode: '23:00' as const,
    trueSolarTime: 'on' as const,
    longitudeCorrection: 'on' as const,
  },
};

const fixtures: Fixture[] = [
  {
    id: '01-choi-seongsoo-1986-04-19',
    label: '1986-04-19 최성수 (남, 신약, 용신 METAL)',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 1986,
        month: 4,
        day: 19,
        hour: 5,
        minute: 45,
        gender: 'male' as const,
        calendarType: 'solar' as const,
        region: '서울',
        birthPlace: '서울',
      },
      surname: [{ hangul: '최', hanja: '崔' }],
      givenName: [
        { hangul: '성', hanja: '成' },
        { hangul: '수', hanja: '秀' },
      ],
      options: { ...baseTimePolicy },
    },
  },
  {
    id: '02-kim-seoyun-2013-07-21',
    label: '2013-07-21 김서윤 (어린 여성)',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 2013,
        month: 7,
        day: 21,
        hour: 14,
        minute: 20,
        gender: 'female' as const,
        calendarType: 'solar' as const,
        region: '부산',
        birthPlace: '부산',
      },
      surname: [{ hangul: '김', hanja: '金' }],
      givenName: [
        { hangul: '서', hanja: '瑞' },
        { hangul: '윤', hanja: '潤' },
      ],
      options: {},
    },
  },
  {
    id: '03-park-minji-1992-11-03',
    label: '1992-11-03 박민지 (성인 여성, 야자시)',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 1992,
        month: 11,
        day: 3,
        hour: 23,
        minute: 20,
        gender: 'female' as const,
        calendarType: 'solar' as const,
        region: '대구',
        birthPlace: '대구',
      },
      surname: [{ hangul: '박', hanja: '朴' }],
      givenName: [
        { hangul: '민', hanja: '敏' },
        { hangul: '지', hanja: '智' },
      ],
      options: { ...baseTimePolicy },
    },
  },
  {
    id: '04-lee-hajun-2001-01-15',
    label: '2001-01-15 이하준 (시간 미상, 중립)',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 2001,
        month: 1,
        day: 15,
        hour: null,
        minute: null,
        gender: 'neutral' as const,
        calendarType: 'solar' as const,
        region: '서울',
        birthPlace: '서울',
      },
      surname: [{ hangul: '이', hanja: '李' }],
      givenName: [
        { hangul: '하', hanja: '河' },
        { hangul: '준', hanja: '俊' },
      ],
      options: {},
    },
  },
  {
    id: '05-kim-jiwon-1990-09-15-strong-gyeokguk',
    label: '1990-09-15 김지원 (강한 격국 case)',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 1990,
        month: 9,
        day: 15,
        hour: 12,
        minute: 0,
        gender: 'female' as const,
        calendarType: 'solar' as const,
        region: '서울',
        birthPlace: '서울',
      },
      surname: [{ hangul: '김', hanja: '金' }],
      givenName: [
        { hangul: '지', hanja: '智' },
        { hangul: '원', hanja: '圓' },
      ],
      options: { ...baseTimePolicy },
    },
  },
  {
    id: '06-jonggyeok-hua-qi-1958-07-11',
    label: '1958-07-11 21:00 male - HUA_QI 化氣格 (외격 case)',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 1958,
        month: 7,
        day: 11,
        hour: 21,
        minute: 0,
        gender: 'male' as const,
        calendarType: 'solar' as const,
        region: '서울',
        birthPlace: '서울',
      },
      surname: [{ hangul: '김', hanja: '金' }],
      givenName: [
        { hangul: '성', hanja: '成' },
        { hangul: '수', hanja: '秀' },
      ],
      options: { ...baseTimePolicy },
    },
  },
];

function pickLegacyFields(payload: any): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {};
  return {
    overviewSummary: payload.overviewSummary ?? null,
    lifeFortuneOverview: payload.lifeFortuneOverview ?? null,
    personality: payload.personality ?? null,
    strengthsWeaknesses: payload.strengthsWeaknesses ?? null,
    cautions: payload.cautions ?? null,
    dailyFortune: payload.dailyFortune ?? null,
    weeklyFortune: payload.weeklyFortune ?? null,
    monthlyFortune: payload.monthlyFortune ?? null,
    yearlyFortune: payload.yearlyFortune ?? null,
    categoryFortunes: payload.categoryFortunes ?? null,
    nameCompatibility: payload.nameCompatibility ?? null,
    lifeStageFortune: payload.lifeStageFortune ?? null,
  };
}

function jsonStable(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const suffix = (process.argv[2] ?? 'before').toLowerCase();
if (suffix !== 'before' && suffix !== 'after') {
  console.error(`Usage: npx tsx artifacts/phase3-agent-a21/generate-sample.ts <before|after>`);
  process.exit(2);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) {
  if (repo) repo.wasmUrl = WASM_PATH;
}
await engine.init();

for (const fixture of fixtures) {
  const payload: any = await engine.getFortuneReport(fixture.request);
  const envelope = {
    fixtureId: fixture.id,
    label: fixture.label,
    capturedAt: new Date().toISOString(),
    capturePhase: suffix,
    targetDate: TARGET_DATE,
    request: fixture.request,
    legacyFields: pickLegacyFields(payload),
  };
  const outPath = path.join(OUT_DIR, `${fixture.id}.${suffix}.json`);
  fs.writeFileSync(outPath, jsonStable(envelope), 'utf-8');
  console.log(`wrote ${path.relative(SPRING_TS_ROOT, outPath)}`);
}

engine.close();
console.log(`Captured ${fixtures.length} fixtures (${suffix} phase).`);
