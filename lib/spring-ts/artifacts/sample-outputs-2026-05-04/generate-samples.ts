import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SpringEngine } from '../../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');
const OUT_DIR = __dirname;
const TARGET_DATE = '2026-05-04T00:00:00+09:00';
const GENERATED_AT = new Date().toISOString();

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

type EngineCall =
  | 'getFortuneReport'
  | 'getSpringReport'
  | 'getSajuReport'
  | 'getNameCandidateSummaries';

type Sample = {
  readonly id: string;
  readonly fileName: string;
  readonly description: string;
  readonly call: EngineCall;
  readonly request: any;
};

const choiSeongsooBirth = {
  year: 1986,
  month: 4,
  day: 19,
  hour: 5,
  minute: 45,
  gender: 'male' as const,
  calendarType: 'solar' as const,
  region: '\uC11C\uC6B8',
  birthPlace: '\uC11C\uC6B8',
};

const choiSeongsooName = {
  surname: [{ hangul: '\uCD5C', hanja: '\u5D14' }],
  givenName: [
    { hangul: '\uC131', hanja: '\u6210' },
    { hangul: '\uC218', hanja: '\u79C0' },
  ],
};

const fullTimePolicy = {
  sajuTimePolicy: {
    yaza: 'on' as const,
    yazaMode: '23:00' as const,
    trueSolarTime: 'on' as const,
    longitudeCorrection: 'on' as const,
  },
};

const tieredPrecision = {
  precisionConfig: {
    surfaceTieredMatrix: true,
  },
};

const namingVectorPrecision = {
  precisionConfig: {
    surfaceNamingScoreVector: true,
    surfaceNameTrend: true,
    surfacePhoneticEvidence: true,
  },
};

const samples: Sample[] = [
  {
    id: 'choi-seongsoo-current-fortune',
    fileName: '01-choi-seongsoo-current-fortune.json',
    description: 'NameSpring-compatible getFortuneReport request: no precisionConfig, full yaza/true-solar/longitude policy.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: choiSeongsooBirth,
      ...choiSeongsooName,
      options: fullTimePolicy,
    },
  },
  {
    id: 'choi-seongsoo-tiered-fortune',
    fileName: '02-choi-seongsoo-tiered-fortune.json',
    description: 'Same input with precisionConfig.surfaceTieredMatrix=true for progressive-disclosure output.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: choiSeongsooBirth,
      ...choiSeongsooName,
      options: {
        ...fullTimePolicy,
        precisionConfig: {
          ...tieredPrecision.precisionConfig,
        },
      },
    },
  },
  {
    id: 'choi-seongsoo-spring-report-vector',
    fileName: '03-choi-seongsoo-spring-report-vector.json',
    description: 'Integrated SpringReport with opt-in naming score vector/trend/phonetic evidence.',
    call: 'getSpringReport',
    request: {
      birth: choiSeongsooBirth,
      ...choiSeongsooName,
      mode: 'evaluate' as const,
      options: {
        ...fullTimePolicy,
        precisionConfig: {
          ...namingVectorPrecision.precisionConfig,
        },
      },
    },
  },
  {
    id: 'kim-seoyun-young-female-tiered',
    fileName: '04-kim-seoyun-young-female-tiered.json',
    description: 'Younger female sample with tiered fortune matrix enabled.',
    call: 'getFortuneReport',
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
        region: '\uBD80\uC0B0',
        birthPlace: '\uBD80\uC0B0',
      },
      surname: [{ hangul: '\uAE40', hanja: '\u91D1' }],
      givenName: [
        { hangul: '\uC11C', hanja: '\u745E' },
        { hangul: '\uC724', hanja: '\u6F64' },
      ],
      options: tieredPrecision,
    },
  },
  {
    id: 'park-minji-late-night-female-tiered',
    fileName: '05-park-minji-late-night-female-tiered.json',
    description: 'Adult female late-night sample with yaza/true-solar/longitude policy and tiered matrix enabled.',
    call: 'getFortuneReport',
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
        region: '\uB300\uAD6C',
        birthPlace: '\uB300\uAD6C',
      },
      surname: [{ hangul: '\uBC15', hanja: '\u6734' }],
      givenName: [
        { hangul: '\uBBFC', hanja: '\u654F' },
        { hangul: '\uC9C0', hanja: '\u667A' },
      ],
      options: {
        ...fullTimePolicy,
        precisionConfig: {
          ...tieredPrecision.precisionConfig,
        },
      },
    },
  },
  {
    id: 'lee-hajun-unknown-hour-neutral-tiered',
    fileName: '06-lee-hajun-unknown-hour-neutral-tiered.json',
    description: 'Unknown-hour neutral-gender sample to inspect uncertainty/fallback surfacing with tiered matrix.',
    call: 'getFortuneReport',
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
        region: '\uC11C\uC6B8',
        birthPlace: '\uC11C\uC6B8',
      },
      surname: [{ hangul: '\uC774', hanja: '\u674E' }],
      givenName: [
        { hangul: '\uD558', hanja: '\u6CB3' },
        { hangul: '\uC900', hanja: '\u4FCA' },
      ],
      options: {
        precisionConfig: {
          ...tieredPrecision.precisionConfig,
        },
      },
    },
  },
  {
    id: 'choi-seongsoo-candidate-summaries',
    fileName: '07-choi-seongsoo-candidate-summaries.json',
    description: 'Recommendation-list sample for UI rendering, including score vectors and presentation-safe candidate filtering.',
    call: 'getNameCandidateSummaries',
    request: {
      birth: choiSeongsooBirth,
      surname: choiSeongsooName.surname,
      givenNameLength: 2,
      mode: 'recommend' as const,
      options: {
        limit: 5,
        ...fullTimePolicy,
        precisionConfig: {
          ...namingVectorPrecision.precisionConfig,
        },
      },
    },
  },
];

function jsonStable(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function payloadSummary(payload: any): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    topLevelKeys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
  };
  if (payload?.tieredMatrix) {
    summary.tieredMatrix = {
      schemaVersion: payload.tieredMatrix.schemaVersion,
      periods: Object.keys(payload.tieredMatrix.periods ?? {}),
      glossaryEntryCount: Object.keys(payload.tieredMatrix.glossary?.entries ?? {}).length,
      usedGlossaryCount: payload.tieredMatrix.glossary?.usedInThisReport?.length ?? null,
    };
  } else {
    summary.tieredMatrix = null;
  }
  if (payload?.meta) {
    summary.meta = payload.meta;
  }
  if (payload?.saju?.summary?.timeCorrection) {
    summary.timeCorrection = payload.saju.summary.timeCorrection;
  }
  if (payload?.sajuReport?.summary?.timeCorrection) {
    summary.timeCorrection = payload.sajuReport.summary.timeCorrection;
  }
  if (Array.isArray(payload)) {
    summary.itemCount = payload.length;
    summary.firstItemKeys = payload[0] ? Object.keys(payload[0]) : [];
  }
  return summary;
}

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) {
  if (repo) repo.wasmUrl = WASM_PATH;
}
await engine.init();

const indexRows: Array<Record<string, unknown>> = [];

for (const sample of samples) {
  const method = (engine as any)[sample.call];
  if (typeof method !== 'function') throw new Error(`missing engine method: ${sample.call}`);
  const payload = await method.call(engine, sample.request);
  const envelope = {
    generatedAt: GENERATED_AT,
    targetDate: TARGET_DATE,
    sampleId: sample.id,
    description: sample.description,
    call: sample.call,
    request: sample.request,
    payload,
  };
  const outPath = path.join(OUT_DIR, sample.fileName);
  fs.writeFileSync(outPath, jsonStable(envelope), 'utf-8');
  indexRows.push({
    sampleId: sample.id,
    fileName: sample.fileName,
    description: sample.description,
    call: sample.call,
    request: sample.request,
    outputBytes: fs.statSync(outPath).size,
    payloadSummary: payloadSummary(payload),
  });
}

fs.writeFileSync(
  path.join(OUT_DIR, 'index.json'),
  jsonStable({
    generatedAt: GENERATED_AT,
    targetDate: TARGET_DATE,
    outputDirectory: OUT_DIR,
    sampleCount: samples.length,
    samples: indexRows,
  }),
  'utf-8',
);

engine.close();
console.log(`Wrote ${samples.length} sample JSON outputs to ${OUT_DIR}`);
