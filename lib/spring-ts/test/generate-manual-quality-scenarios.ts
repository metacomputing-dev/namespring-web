import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SpringEngine } from '../src/spring-engine.ts';
import { buildIntegratedReport } from '../src/report/buildIntegratedReport.ts';
import type {
  BirthInfo,
  NameCharInput,
  SajuTimePolicyOptions,
  SpringReport,
} from '../src/types.ts';
import type { ReportSectionId } from '../src/report/types.ts';

type GenderCode = 'male' | 'female' | 'neutral';
type CalendarCode = 'solar' | 'lunar';

interface BaseBirthCase {
  readonly id: string;
  readonly surname: NameCharInput[];
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly timezone: string;
  readonly latitude: number;
  readonly longitude: number;
}

interface PolicyCase {
  readonly id: string;
  readonly policy: SajuTimePolicyOptions;
}

interface Scenario {
  readonly id: string;
  readonly birthCaseId: string;
  readonly policyCaseId: string;
  readonly gender: GenderCode;
  readonly calendarType: CalendarCode;
  readonly surname: NameCharInput[];
  readonly birth: BirthInfo;
  readonly policy: SajuTimePolicyOptions;
}

interface ScenarioArtifactIndex {
  readonly id: string;
  readonly birthCaseId: string;
  readonly policyCaseId: string;
  readonly gender: GenderCode;
  readonly calendarType: CalendarCode;
  readonly reportJsonPath: string;
  readonly candidateCount: number;
  readonly topName: string;
  readonly topScore: number;
  readonly sectionCount: number;
}

const FIXED_TODAY = new Date('2024-06-15T00:00:00.000Z');
const FIXED_VARIATION_SEED = 20260221;
const REPORT_ARTIFACT_DIR = 'test/artifacts/manual-quality';
const REPORT_JSON_DIR = `${REPORT_ARTIFACT_DIR}/reports`;

const KEY_SECTION_IDS: readonly ReportSectionId[] = [
  'pillars',
  'dayMaster',
  'elements',
  'tenGods',
  'yongshin',
  'yearlyFortune',
  'nameHarmony',
  'nameComparison',
  'sajuNameSynergy',
  'summary',
  'actionPlan',
];

const BASE_BIRTH_CASES: readonly BaseBirthCase[] = [
  {
    id: 'B1',
    surname: [{ hangul: '김', hanja: '金' }],
    year: 1986,
    month: 4,
    day: 19,
    hour: 5,
    minute: 45,
    timezone: 'Asia/Seoul',
    latitude: 37.5665,
    longitude: 126.978,
  },
  {
    id: 'B2',
    surname: [{ hangul: '이', hanja: '李' }],
    year: 1990,
    month: 7,
    day: 15,
    hour: 10,
    minute: 30,
    timezone: 'Asia/Seoul',
    latitude: 35.1796,
    longitude: 129.0756,
  },
  {
    id: 'B3',
    surname: [{ hangul: '박', hanja: '朴' }],
    year: 2001,
    month: 10,
    day: 23,
    hour: 23,
    minute: 20,
    timezone: 'Asia/Seoul',
    latitude: 33.4996,
    longitude: 126.5312,
  },
  {
    id: 'B4',
    surname: [{ hangul: '최', hanja: '崔' }],
    year: 1977,
    month: 12,
    day: 28,
    hour: 0,
    minute: 20,
    timezone: 'Asia/Seoul',
    latitude: 35.8714,
    longitude: 128.6014,
  },
  {
    id: 'B5',
    surname: [{ hangul: '정', hanja: '鄭' }],
    year: 2011,
    month: 2,
    day: 17,
    hour: 13,
    minute: 10,
    timezone: 'Asia/Seoul',
    latitude: 36.3504,
    longitude: 127.3845,
  },
  {
    id: 'B6',
    surname: [{ hangul: '제', hanja: '諸' }, { hangul: '갈', hanja: '葛' }],
    year: 1968,
    month: 3,
    day: 8,
    hour: 1,
    minute: 10,
    timezone: 'Asia/Seoul',
    latitude: 37.4563,
    longitude: 126.7052,
  },
];

const POLICY_CASES: readonly PolicyCase[] = [
  {
    id: 'P1',
    policy: { trueSolarTime: 'off', longitudeCorrection: 'off', yaza: 'off', yazaMode: '23:00' },
  },
  {
    id: 'P2',
    policy: { trueSolarTime: 'off', longitudeCorrection: 'on', yaza: 'off', yazaMode: '23:00' },
  },
  {
    id: 'P3',
    policy: { trueSolarTime: 'on', longitudeCorrection: 'off', yaza: 'off', yazaMode: '23:00' },
  },
  {
    id: 'P4',
    policy: { trueSolarTime: 'on', longitudeCorrection: 'on', yaza: 'off', yazaMode: '23:00' },
  },
  {
    id: 'P5',
    policy: { trueSolarTime: 'off', longitudeCorrection: 'on', yaza: 'on', yazaMode: '23:00' },
  },
  {
    id: 'P6',
    policy: { trueSolarTime: 'off', longitudeCorrection: 'on', yaza: 'on', yazaMode: '23:30' },
  },
  {
    id: 'P7',
    policy: { trueSolarTime: 'on', longitudeCorrection: 'on', yaza: 'on', yazaMode: '23:00' },
  },
  {
    id: 'P8',
    policy: { trueSolarTime: 'on', longitudeCorrection: 'on', yaza: 'on', yazaMode: '23:30' },
  },
];

const GENDER_ROTATION: readonly GenderCode[] = ['male', 'female', 'neutral'];

function normalizeText(text: string, maxLength = 260): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength)}...`;
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function formatPolicy(policy: SajuTimePolicyOptions): string {
  return [
    `TST=${policy.trueSolarTime ?? 'off'}`,
    `LON=${policy.longitudeCorrection ?? 'off'}`,
    `YAZA=${policy.yaza ?? 'off'}`,
    `YMODE=${policy.yazaMode ?? '23:00'}`,
  ].join(', ');
}

function buildScenarioMatrix(): Scenario[] {
  const scenarios: Scenario[] = [];
  let index = 0;

  for (const birthCase of BASE_BIRTH_CASES) {
    for (const policyCase of POLICY_CASES) {
      const gender = GENDER_ROTATION[index % GENDER_ROTATION.length];
      const calendarType: CalendarCode = index % 2 === 0 ? 'solar' : 'lunar';
      const id = `S${String(index + 1).padStart(3, '0')}__${birthCase.id}__${policyCase.id}__${gender}__${calendarType}`;

      scenarios.push({
        id,
        birthCaseId: birthCase.id,
        policyCaseId: policyCase.id,
        gender,
        calendarType,
        surname: birthCase.surname,
        birth: {
          year: birthCase.year,
          month: birthCase.month,
          day: birthCase.day,
          hour: birthCase.hour,
          minute: birthCase.minute,
          gender,
          calendarType,
          timezone: birthCase.timezone,
          latitude: birthCase.latitude,
          longitude: birthCase.longitude,
        },
        policy: policyCase.policy,
      });

      index += 1;
    }
  }

  return scenarios;
}

async function setupNodeFetchBridge(): Promise<string> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dataDir = path.resolve(__dirname, '../../../namespring/public/data');
  const wasmCandidates = [
    path.resolve(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm'),
    path.resolve(__dirname, '../../seed-ts/node_modules/sql.js/dist/sql-wasm.wasm'),
  ];
  const wasmPath = wasmCandidates.find((candidatePath) => fs.existsSync(candidatePath));
  if (!wasmPath) {
    throw new Error(`sql-wasm.wasm not found. candidates=${wasmCandidates.join(', ')}`);
  }

  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async (url: string | URL | Request, options?: unknown) => {
    const urlStr = typeof url === 'string'
      ? url
      : url instanceof URL
        ? url.toString()
        : '';

    if (urlStr.startsWith('/data/')) {
      const filePath = path.join(dataDir, urlStr.replace('/data/', ''));
      if (!fs.existsSync(filePath)) {
        return new Response(null, { status: 404, statusText: `Not found: ${filePath}` });
      }
      return new Response(fs.readFileSync(filePath), { status: 200 });
    }

    if (urlStr.includes('sql-wasm.wasm') || urlStr === wasmPath) {
      return new Response(fs.readFileSync(wasmPath), { status: 200 });
    }

    return originalFetch(url as any, options as any);
  };

  return wasmPath;
}

async function gatherCandidates(
  engine: SpringEngine,
  scenario: Scenario,
  limit: number,
): Promise<SpringReport[]> {
  const result = await engine.getNameCandidates({
    birth: scenario.birth,
    surname: scenario.surname,
    givenNameLength: 2,
    mode: 'recommend',
    options: {
      limit,
      sajuTimePolicy: scenario.policy,
      pureHangulNameMode: 'off',
    },
  });

  if (result.length > 0) return result;

  const fallback = await engine.getSpringReport({
    birth: scenario.birth,
    surname: scenario.surname,
    givenName: [
      { hangul: '민', hanja: '旻' },
      { hangul: '준', hanja: '俊' },
    ],
    mode: 'evaluate',
    options: {
      sajuTimePolicy: scenario.policy,
      pureHangulNameMode: 'off',
    },
  });
  return [fallback];
}

function sectionExcerpt(report: ReturnType<typeof buildIntegratedReport>, sectionId: ReportSectionId): string {
  const section = report.sections.find((entry) => entry.id === sectionId);
  if (!section) return '- (section missing)';

  const lines: string[] = [];
  lines.push(`- title: ${section.title}`);
  lines.push(`- blocks: paragraphs=${section.paragraphs.length}, tables=${section.tables?.length ?? 0}, charts=${section.charts?.length ?? 0}, highlights=${section.highlights?.length ?? 0}`);

  const para1 = section.paragraphs[0]?.text;
  const para2 = section.paragraphs[1]?.text;
  if (para1) lines.push(`- p1: ${normalizeText(para1)}`);
  if (para2) lines.push(`- p2: ${normalizeText(para2)}`);

  return lines.join('\n');
}

async function main(): Promise<void> {
  console.log('=== generate-manual-quality-scenarios ===');

  ensureDir(REPORT_ARTIFACT_DIR);
  ensureDir(REPORT_JSON_DIR);

  const wasmPath = await setupNodeFetchBridge();
  const engine = new SpringEngine();

  const repoCandidates = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo] as Array<Record<string, unknown> | null>;
  for (const repo of repoCandidates) {
    if (!repo) continue;
    (repo as any).wasmUrl = wasmPath;
  }

  const scenarios = buildScenarioMatrix();
  const markdownLines: string[] = [];
  const indexRows: ScenarioArtifactIndex[] = [];

  markdownLines.push('# Manual Quality Scenario Pack');
  markdownLines.push('');
  markdownLines.push(`- generatedAt: ${new Date().toISOString()}`);
  markdownLines.push(`- scenarioCount: ${scenarios.length}`);
  markdownLines.push('- note: This file is for manual reading and manual scoring.');
  markdownLines.push('');

  let processed = 0;
  for (const scenario of scenarios) {
    const candidates = await gatherCandidates(engine, scenario, 20);
    const primary = candidates[0];

    const report = buildIntegratedReport({
      saju: primary.sajuReport,
      spring: primary,
      name: primary.namingReport.name.fullHangul || scenario.id,
      gender: scenario.gender,
      birthInfo: {
        year: scenario.birth.year ?? null,
        month: scenario.birth.month ?? null,
        day: scenario.birth.day ?? null,
        hour: scenario.birth.hour ?? null,
        minute: scenario.birth.minute ?? null,
      },
      today: FIXED_TODAY,
      options: {
        variationSeed: FIXED_VARIATION_SEED,
      },
      ...( { candidates } as Record<string, unknown> ),
    } as any);

    const fileName = `${sanitizeId(scenario.id)}.json`;
    const reportJsonPath = `${REPORT_JSON_DIR}/${fileName}`;
    fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), 'utf-8');

    const topName = primary.namingReport.name.fullHangul || '(empty)';
    const topScore = primary.finalScore ?? 0;

    indexRows.push({
      id: scenario.id,
      birthCaseId: scenario.birthCaseId,
      policyCaseId: scenario.policyCaseId,
      gender: scenario.gender,
      calendarType: scenario.calendarType,
      reportJsonPath,
      candidateCount: candidates.length,
      topName,
      topScore,
      sectionCount: report.sections.length,
    });

    markdownLines.push(`## ${scenario.id}`);
    markdownLines.push('');
    markdownLines.push(`- birthCase: ${scenario.birthCaseId}`);
    markdownLines.push(`- birth: ${scenario.birth.year}-${String(scenario.birth.month ?? 0).padStart(2, '0')}-${String(scenario.birth.day ?? 0).padStart(2, '0')} ${String(scenario.birth.hour ?? 0).padStart(2, '0')}:${String(scenario.birth.minute ?? 0).padStart(2, '0')}`);
    markdownLines.push(`- gender: ${scenario.gender}`);
    markdownLines.push(`- calendarType: ${scenario.calendarType}`);
    markdownLines.push(`- timezone/coords: ${scenario.birth.timezone} / lat=${scenario.birth.latitude}, lon=${scenario.birth.longitude}`);
    markdownLines.push(`- policy: ${formatPolicy(scenario.policy)}`);
    markdownLines.push(`- candidates: ${candidates.length}`);
    markdownLines.push(`- topCandidate: ${topName} (score=${topScore})`);
    markdownLines.push(`- sections: ${report.sections.length}`);
    markdownLines.push(`- reportJson: ${reportJsonPath}`);
    markdownLines.push('');
    markdownLines.push('### Introduction');
    markdownLines.push(`- p1: ${normalizeText(report.introduction[0]?.text ?? '')}`);
    markdownLines.push(`- p2: ${normalizeText(report.introduction[1]?.text ?? '')}`);
    markdownLines.push('');
    markdownLines.push('### Key Sections');
    for (const sectionId of KEY_SECTION_IDS) {
      markdownLines.push(`#### ${sectionId}`);
      markdownLines.push(sectionExcerpt(report, sectionId));
    }
    markdownLines.push('');
    markdownLines.push('### Conclusion');
    markdownLines.push(`- p1: ${normalizeText(report.conclusion[0]?.text ?? '')}`);
    markdownLines.push(`- p2: ${normalizeText(report.conclusion[1]?.text ?? '')}`);
    markdownLines.push('');
    markdownLines.push('---');
    markdownLines.push('');

    processed += 1;
    if (processed % 8 === 0 || processed === scenarios.length) {
      console.log(`progress: ${processed}/${scenarios.length}`);
    }
  }

  fs.writeFileSync(`${REPORT_ARTIFACT_DIR}/manual-scenario-pack.md`, markdownLines.join('\n'), 'utf-8');
  fs.writeFileSync(`${REPORT_ARTIFACT_DIR}/scenario-index.json`, JSON.stringify(indexRows, null, 2), 'utf-8');

  await engine.close();

  console.log(`done: wrote ${scenarios.length} scenario reports.`);
  console.log(`- markdown: ${REPORT_ARTIFACT_DIR}/manual-scenario-pack.md`);
  console.log(`- index: ${REPORT_ARTIFACT_DIR}/scenario-index.json`);
  console.log(`- report json dir: ${REPORT_JSON_DIR}`);
}

main().catch((error) => {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(`FAIL: ${message}`);
  process.exit(1);
});
