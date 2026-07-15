/**
 * service-visible-output.test.ts
 *
 * Guards issues found by manual sample review: minor-safe relationship copy,
 * input Hangul display names, service josa polish, medical-adjacent wording,
 * and obvious contradiction between visible category summary and evidence.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
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

import { SpringEngine } from '../../src/index.js';

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

function textOf(value: unknown): string {
  return JSON.stringify(value ?? '');
}

function findFirstMatchPath(value: unknown, pattern: RegExp, path = '$'): string | undefined {
  if (typeof value === 'string') {
    pattern.lastIndex = 0;
    const match = value.match(pattern)?.[0];
    return match ? `${path}: ${match}` : undefined;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const found = findFirstMatchPath(value[i], pattern, `${path}[${i}]`);
      if (found) return found;
    }
    return undefined;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const found = findFirstMatchPath(child, pattern, `${path}.${key}`);
      if (found) return found;
    }
  }
  return undefined;
}

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) { if (repo) (repo as any).wasmUrl = WASM_PATH; }
await engine.init();

console.log('Service-visible output quality\n');

const targetDate = '2026-05-04T00:00:00+09:00';

const choiReport: any = await engine.getFortuneReport({
  targetDate,
  birth: {
    year: 1986,
    month: 4,
    day: 19,
    hour: 5,
    minute: 45,
    gender: 'male',
    calendarType: 'solar',
    region: '서울',
    birthPlace: '서울',
  },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [
    { hangul: '성', hanja: '成' },
    { hangul: '수', hanja: '秀' },
  ],
  options: {
    sajuTimePolicy: {
      yaza: 'on',
      yazaMode: '23:00',
      trueSolarTime: 'on',
      longitudeCorrection: 'on',
    },
  },
});

const minorReport: any = await engine.getFortuneReport({
  targetDate,
  birth: {
    year: 2013,
    month: 7,
    day: 21,
    hour: 14,
    minute: 20,
    gender: 'female',
    calendarType: 'solar',
    region: '부산',
    birthPlace: '부산',
  },
  surname: [{ hangul: '김', hanja: '金' }],
  givenName: [
    { hangul: '서', hanja: '瑞' },
    { hangul: '윤', hanja: '潤' },
  ],
  options: { precisionConfig: { surfaceTieredMatrix: true } },
});

const leeReport: any = await engine.getFortuneReport({
  targetDate,
  birth: {
    year: 2001,
    month: 1,
    day: 15,
    hour: null,
    minute: null,
    gender: 'neutral',
    calendarType: 'solar',
    region: '서울',
    birthPlace: '서울',
  },
  surname: [{ hangul: '이', hanja: '李' }],
  givenName: [
    { hangul: '하', hanja: '河' },
    { hangul: '준', hanja: '俊' },
  ],
  options: { precisionConfig: { surfaceTieredMatrix: true } },
});

const minorRomance = minorReport?.categoryFortunes?.romance;
const minorRomanceText = textOf(minorRomance);
const minorServicePayload = {
  categoryFortunes: minorReport?.categoryFortunes,
  dailyFortune: minorReport?.dailyFortune,
  weeklyFortune: minorReport?.weeklyFortune,
  monthlyFortune: minorReport?.monthlyFortune,
  yearlyFortune: minorReport?.yearlyFortune,
  lifeStageFortune: minorReport?.lifeStageFortune,
  tieredMatrix: minorReport?.tieredMatrix,
};
const minorServiceText = textOf(minorServicePayload);
check('minor relationship card is relabeled away from dating and marriage',
  minorRomance?.title === '친구/관계운',
  String(minorRomance?.title));
check('minor relationship card avoids adult relationship wording',
  !/연애|결혼|새 관계|만남 운|액세서리가 만남/.test(minorRomanceText),
  minorRomanceText.match(/연애|결혼|새 관계|만남 운|액세서리가 만남/)?.[0]);
check('minor tiered relationship output avoids adult dating and marriage terms',
  !/연애|결혼|배우자궁|처궁|만남 운|액세서리가 만남/.test(minorServiceText),
  findFirstMatchPath(minorServicePayload, /연애|결혼|배우자궁|처궁|만남 운|액세서리가 만남/));
check('minor visible output avoids adult financial and peak-life wording',
  !/큰 계약|투자|보증|전성기/.test(minorServiceText),
  findFirstMatchPath(minorServicePayload, /큰 계약|투자|보증|전성기/));

const leeText = textOf(leeReport);
check('input Hangul display name is preserved for Lee surname',
  leeReport?.nameCompatibility?.fullName === '이하준' ||
    leeReport?.nameCompatibility?.name?.fullHangul === '이하준' ||
    leeReport?.tieredMatrix?.namingEvidence?.frames?.some((frame: any) =>
      String(frame?.lifePeriodInfluence ?? '').includes('이하준님')),
  leeReport?.nameCompatibility?.fullName ?? leeReport?.nameCompatibility?.name?.fullHangul);
check('Lee sample does not leak DB reading 리하준',
  !leeText.includes('리하준'), leeText.match(/리하준.{0,12}/)?.[0]);
check('service josa polish covers 성과와 인정',
  !leeText.includes('성과와 인정를'), leeText.match(/성과와 인정를/)?.[0]);
check('unknown-hour report marks the hour pillar as provisional',
  leeReport?.overviewSummary?.pillars?.some((pillar: any) => String(pillar?.position ?? '').includes('시주(임시)')),
  textOf(leeReport?.overviewSummary?.pillars));
check('unknown-hour report hedges yongshin as a candidate',
  String(leeReport?.overviewSummary?.yongshinDescription ?? '').includes('용신 후보'),
  String(leeReport?.overviewSummary?.yongshinDescription ?? ''));

const choiVisibleText = textOf({
  cautions: choiReport?.cautions,
  dailyFortune: choiReport?.dailyFortune,
  weeklyFortune: choiReport?.weeklyFortune,
  monthlyFortune: choiReport?.monthlyFortune,
  yearlyFortune: choiReport?.yearlyFortune,
  categoryFortunes: choiReport?.categoryFortunes,
});
check('general visible report avoids organ-specific and medical-adjacent claims',
  !/(폐와 대장|관련 장기|면역력|장기는|검진)/.test(choiVisibleText),
  choiVisibleText.match(/폐와 대장|관련 장기|면역력|장기는|검진/)?.[0]);

const allGeneratedServiceText = [choiVisibleText, minorServiceText, leeText].join('\n');
check('generated service samples avoid checkup wording',
  !/검진/.test(allGeneratedServiceText),
  allGeneratedServiceText.match(/검진.{0,16}/)?.[0]);
check('general cautions avoid raw shinsal detected phrasing',
  !/(신호가 감지|형살 신호|망신살 신호|재살 신호|천살 신호|공망\()/.test(choiVisibleText),
  choiVisibleText.match(/신호가 감지|형살 신호|망신살 신호|재살 신호|천살 신호|공망\(/)?.[0]);

const romance = choiReport?.categoryFortunes?.romance;
const romanceSummary = String(romance?.summary ?? '');
const romanceEvidence = textOf(romance?.evidence);
check('category summary and evidence do not conflict on gishin alignment',
  !(romanceSummary.includes('좋은 편이에요') && romanceEvidence.includes('보수적 운영')),
  `${romanceSummary} / ${romanceEvidence}`);

engine.close();
console.log(`\nService-visible output quality: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
