import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

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
  return originalFetch(url, options);
};

import { SpringEngine } from '../src/index.js';

const samplePool = [
  {
    label: 'adult-kim-1971',
    targetDate: '2026-05-01T00:00:00+09:00',
    birth: { year: 1971, month: 2, day: 18, hour: 6, minute: 20, gender: 'male' as const },
    surname: [{ hangul: '김', hanja: '金' }],
    givenName: [{ hangul: '민', hanja: '旻' }, { hangul: '준', hanja: '俊' }],
  },
  {
    label: 'adult-lee-1988',
    targetDate: '2026-05-01T00:00:00+09:00',
    birth: { year: 1988, month: 7, day: 9, hour: 14, minute: 15, gender: 'female' as const },
    surname: [{ hangul: '이', hanja: '李' }],
    givenName: [{ hangul: '서', hanja: '瑞' }, { hangul: '현', hanja: '賢' }],
  },
  {
    label: 'adult-park-1962',
    targetDate: '2026-05-01T00:00:00+09:00',
    birth: { year: 1962, month: 12, day: 27, hour: 21, minute: 5, gender: 'female' as const },
    surname: [{ hangul: '박', hanja: '朴' }],
    givenName: [{ hangul: '지', hanja: '智' }, { hangul: '우', hanja: '祐' }],
  },
  {
    label: 'senior-jung-1954',
    targetDate: '2026-05-01T00:00:00+09:00',
    birth: { year: 1954, month: 4, day: 4, hour: 9, minute: 50, gender: 'male' as const },
    surname: [{ hangul: '정', hanja: '鄭' }],
    givenName: [{ hangul: '도', hanja: '度' }, { hangul: '현', hanja: '賢' }],
  },
  {
    label: 'adult-choi-1994',
    targetDate: '2026-05-01T00:00:00+09:00',
    birth: { year: 1994, month: 9, day: 16, hour: 0, minute: 35, gender: 'female' as const },
    surname: [{ hangul: '최', hanja: '崔' }],
    givenName: [{ hangul: '하', hanja: '夏' }, { hangul: '윤', hanja: '潤' }],
  },
  {
    label: 'adult-kang-1977',
    targetDate: '2026-05-01T00:00:00+09:00',
    birth: { year: 1977, month: 5, day: 30, hour: 18, minute: 10, gender: 'male' as const },
    surname: [{ hangul: '강', hanja: '姜' }],
    givenName: [{ hangul: '유', hanja: '有' }, { hangul: '진', hanja: '珍' }],
  },
] as const;

const lifeBands = ['20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89', '90-99', '100-109'] as const;
const categories = ['overall', 'career', 'movement', 'academic'] as const;

let seed = Number(process.env.P40_SAMPLE_SEED ?? Date.now()) >>> 0;
const initialSeed = seed;
function randomUnit(): number {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return ((seed >>> 0) % 1000000) / 1000000;
}
function pick<T>(values: readonly T[]): T {
  return values[Math.floor(randomUnit() * values.length)] ?? values[0]!;
}
function shuffled<T>(values: readonly T[]): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomUnit() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function cellForKey(tm: any, key: string): any {
  const parts = key.split('.');
  if (parts[0] !== 'life') {
    const period = tm?.periods?.[parts[0] ?? ''];
    return parts[1] === 'overall' ? period?.overall : period?.byCategory?.[parts[1] ?? ''];
  }
  if (parts[1] === 'overall') return tm?.periods?.life?.overall;
  const scoped = tm?.periods?.life?.byAgeBand?.[parts[1] ?? ''];
  return parts[2] === 'overall' ? scoped?.overall : scoped?.byCategory?.[parts[2] ?? ''];
}

function paragraphs(cell: any, tier: 'standard' | 'expert'): string[] {
  return (cell?.[tier]?.paragraphs ?? []).map((paragraph: any) => String(paragraph?.plainText ?? ''));
}

const shortHorizonRe = /오늘|지금 바로|지금 당장|당장|하루 더|다음 한 주|이번 주에 실제로|바로 처리|작은 행동/;

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) {
  if (repo) (repo as any).wasmUrl = WASM_PATH;
}
await engine.init();

console.log(`seed=${initialSeed}`);

for (const sample of shuffled(samplePool).slice(0, 5)) {
  const request = { ...sample, options: { precisionConfig: { surfaceTieredMatrix: true } } };
  const report: any = await engine.getFortuneReport(request);
  const tm = report?.tieredMatrix;
  const keys = [
    `life.${pick(lifeBands)}.${pick(categories)}`,
    `life.${pick(lifeBands)}.${pick(categories)}`,
    `life.${pick(lifeBands)}.career`,
    `life.${pick(lifeBands)}.movement`,
    'thisYear.career',
  ];

  console.log(`\n\n######## ${sample.label} schema=${tm?.schemaVersion ?? 'missing'} ########`);
  for (const key of [...new Set(keys)]) {
    const cell = cellForKey(tm, key);
    if (!cell) {
      console.log(`\n=== ${key} missing ===`);
      continue;
    }
    const standard = paragraphs(cell, 'standard');
    const expert = paragraphs(cell, 'expert').slice(0, 2);
    const shortHits = standard.filter((text) => key.startsWith('life.') && shortHorizonRe.test(text));
    console.log(`\n=== ${key} ===`);
    console.log(`score=${cell?.score ?? 'n/a'} stars=${cell?.stars ?? 'n/a'} meaningfulness=${cell?.meaningfulness ?? 'n/a'} shortHits=${shortHits.length}`);
    standard.forEach((text, index) => console.log(`S${index + 1}. ${text}`));
    expert.forEach((text, index) => console.log(`E${index + 1}. ${text}`));
  }
}