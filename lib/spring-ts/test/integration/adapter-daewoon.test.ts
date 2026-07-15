/**
 * test/integration/adapter-daewoon.test.ts
 *
 * PR-H-D / PR-8: verifies the saju-adapter surfaces daeunInfo,
 * saeunPillars, and wolunPillars through SajuOutputSummary without changing
 * the existing relation/shinsal/gongmang surfaces.
 *
 * Run: npm run test:adapter-daewoon
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string | URL | Request, options?: any) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlStr.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlStr.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlStr.includes('sql-wasm.wasm') || urlStr === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  return originalFetch(url as any, options);
};

import { buildSajuContext, analyzeSaju, extractSaju } from '../../src/saju-adapter.js';
import type { SajuSummary } from '../../src/types.js';

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

function hasNatalRelations(row: any): boolean {
  const relations = row?.relationsWithNatal;
  return !!relations && (
    (Array.isArray(relations.stemRelations) && relations.stemRelations.length > 0) ||
    (Array.isArray(relations.branchRelations) && relations.branchRelations.length > 0)
  );
}

function hasDecadeRelations(row: any): boolean {
  const entries = row?.relationsWithDecade?.decadeRelations;
  return Array.isArray(entries) && entries.some((entry: any) =>
    (Array.isArray(entry?.stemRelations) && entry.stemRelations.length > 0) ||
    (Array.isArray(entry?.branchRelations) && entry.branchRelations.length > 0),
  );
}
function hasStemBranchInteraction(row: any): boolean {
  const interaction = row?.stemBranchInteraction;
  return !!interaction &&
    (interaction.gaedoo === true || interaction.geogak === true) &&
    Array.isArray(interaction.labels) &&
    interaction.labels.length > 0 &&
    typeof interaction.stemElement === 'string' &&
    typeof interaction.branchElement === 'string';
}
function hasCommonLuckAnnotations(row: any): boolean {
  return typeof row?.tenGod === 'string' &&
    typeof row?.lifeStage === 'string' &&
    typeof row?.transitShinsal?.twelveSal === 'string';
}

function hasAnnualLuckAnnotations(row: any): boolean {
  return hasCommonLuckAnnotations(row) &&
    typeof row?.transitShinsal?.samjae?.active === 'boolean' &&
    typeof row?.transitShinsal?.sangmun === 'boolean' &&
    typeof row?.transitShinsal?.jogaek === 'boolean';
}

function excludesAnnualLuckAnnotations(row: any): boolean {
  const shinsal = row?.transitShinsal;
  return hasCommonLuckAnnotations(row) &&
    shinsal?.samjae === undefined && shinsal?.sangmun === undefined && shinsal?.jogaek === undefined;
}

console.log('PR-H-D / PR-8 adapter daewoon richness surface\n');

const summary: SajuSummary = await analyzeSaju({
  year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male',
});

const boundedSummary: SajuSummary = await analyzeSaju({
  year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male',
}, {
  sajuOptions: {
    saeunStartYear: 2105,
    saeunYearCount: 2,
    wolunMonthCount: 120,
  },
});
const boundedSaeun = (boundedSummary as any).saeunPillars;
const countOnlyWolun = (boundedSummary as any).wolunPillars;
check('near-horizon saeun request returns exact count without silent truncation',
  boundedSaeun?.length === 2 && boundedSaeun[0]?.year === 2105 && boundedSaeun[1]?.year === 2106);
check('count-only wolun request returns exact count without silent truncation', countOnlyWolun?.length === 120);

const daeunSource = (summary as any).daeunInfo;
const saeunSource = (summary as any).saeunPillars;
const wolunSource = (summary as any).wolunPillars;

check('SajuSummary.daeunInfo present (existing)', daeunSource !== undefined,
  daeunSource ? `pillars=${daeunSource.pillars?.length}` : 'null');
check('SajuSummary.saeunPillars present (existing)', Array.isArray(saeunSource),
  `length=${saeunSource?.length}`);
check('SajuSummary.wolunPillars present (PR-8 additive)', Array.isArray(wolunSource) && wolunSource.length > 0,
  `length=${wolunSource?.length}`);

const ctx = buildSajuContext(summary);
check('buildSajuContext returns an output object', ctx.output !== null);

if (ctx.output) {
  if (daeunSource) {
    check('SajuOutputSummary.daeunInfo is set when source has structure',
      ctx.output.daeunInfo !== undefined && ctx.output.daeunInfo !== null,
      `pillars=${ctx.output.daeunInfo?.pillars?.length}`);
    if (ctx.output.daeunInfo) {
      check('daeunInfo has isForward boolean', typeof ctx.output.daeunInfo.isForward === 'boolean');
      check('daeunInfo has firstDaeunStartAge number', typeof ctx.output.daeunInfo.firstDaeunStartAge === 'number');
      check('daeunInfo exposes PR-9 age display convention',
        ctx.output.daeunInfo.ageDisplayMode === 'continuousFromBirth' &&
        typeof ctx.output.daeunInfo.ageDisplayLabel === 'string');
      check('daeunInfo exposes a non-empty boundaryTermId with an exact legacy alias',
        typeof ctx.output.daeunInfo.boundaryTermId === 'string' &&
        /^[A-Z_]+$/.test(ctx.output.daeunInfo.boundaryTermId) &&
        ctx.output.daeunInfo.boundaryMode === ctx.output.daeunInfo.boundaryTermId,
        `boundaryTermId=${ctx.output.daeunInfo.boundaryTermId}`);
      check('daeunInfo has pillars array', Array.isArray(ctx.output.daeunInfo.pillars));
      const firstPillar = ctx.output.daeunInfo.pillars?.[0];
      if (firstPillar) {
        check('daeunInfo.pillars[0] has stem/branch/startAge/endAge',
          typeof firstPillar.stem === 'string' &&
          typeof firstPillar.branch === 'string' &&
          typeof firstPillar.startAge === 'number' &&
          typeof firstPillar.endAge === 'number');
        check('daeunInfo.pillars[0] has common luck annotations without annual-only signals',
          excludesAnnualLuckAnnotations(firstPillar));
        check('daeunInfo.pillars[0] has PR-9 display age metadata',
          typeof firstPillar.displayStartAge === 'number' &&
          typeof firstPillar.displayEndAge === 'number' &&
          firstPillar.displayEndAge > firstPillar.displayStartAge);
        check('daeunInfo.pillars[0] has PR-9 approximate boundary UTC metadata',
          typeof firstPillar.approxStartUtcMs === 'number' &&
          typeof firstPillar.approxEndUtcMs === 'number' &&
          firstPillar.approxEndUtcMs > firstPillar.approxStartUtcMs);
        check('daeunInfo.pillars has PR-9 natal relation annotations',
          ctx.output.daeunInfo.pillars.some((pillar: any) => hasNatalRelations(pillar)));
        check('daeunInfo.pillars includes PR-9-8 stem-branch interaction annotations',
          ctx.output.daeunInfo.pillars.some((pillar: any) => hasStemBranchInteraction(pillar)));
      }
    }
  } else {
    check('SajuOutputSummary.daeunInfo is undefined when source is null', ctx.output.daeunInfo === undefined);
  }

  if (Array.isArray(saeunSource) && saeunSource.length > 0) {
    check('SajuOutputSummary.saeunPillars is set when source has rows',
      Array.isArray(ctx.output.saeunPillars) && ctx.output.saeunPillars.length === saeunSource.length,
      `lifted ${ctx.output.saeunPillars?.length} entries`);
    const firstSaeun = ctx.output.saeunPillars![0];
    check('saeunPillars[0] has year/stem/branch shape',
      typeof firstSaeun.year === 'number' &&
      typeof firstSaeun.stem === 'string' &&
      typeof firstSaeun.branch === 'string');
    check('saeunPillars[0] has annual luck annotations', hasAnnualLuckAnnotations(firstSaeun));
    check('saeunPillars includes PR-9 natal relation annotations',
      ctx.output.saeunPillars!.some((pillar: any) => hasNatalRelations(pillar)));
    check('saeunPillars includes PR-9 decade-year relation annotations',
      ctx.output.saeunPillars!.some((pillar: any) => hasDecadeRelations(pillar)));
    check('saeunPillars includes PR-9-8 stem-branch interaction annotations',
      ctx.output.saeunPillars!.some((pillar: any) => hasStemBranchInteraction(pillar)));
  } else {
    check('SajuOutputSummary.saeunPillars is undefined when source is empty', ctx.output.saeunPillars === undefined);
  }

  const wolunOutput = (ctx.output as any).wolunPillars;
  if (Array.isArray(wolunSource) && wolunSource.length > 0) {
    check('SajuOutputSummary.wolunPillars is set when source has rows',
      Array.isArray(wolunOutput) && wolunOutput.length === wolunSource.length,
      `lifted ${wolunOutput?.length} entries`);
    const firstWolun = wolunOutput![0];
    check('wolunPillars[0] has month/stem/branch + PR-8 annotations',
      typeof firstWolun.year === 'number' &&
      typeof firstWolun.monthOrder === 'number' &&
      typeof firstWolun.stem === 'string' &&
      typeof firstWolun.branch === 'string' &&
      excludesAnnualLuckAnnotations(firstWolun));
    check('wolunPillars includes PR-9 natal relation annotations',
      wolunOutput!.some((pillar: any) => hasNatalRelations(pillar)));
    check('wolunPillars includes PR-9-8 stem-branch interaction annotations',
      wolunOutput!.some((pillar: any) => hasStemBranchInteraction(pillar)));
  } else {
    check('SajuOutputSummary.wolunPillars is undefined when source is empty', wolunOutput === undefined);
  }

  check('cheonganRelations regression guard',
    Array.isArray(ctx.output.cheonganRelations) || ctx.output.cheonganRelations === undefined);
  check('shinsalHits regression guard',
    Array.isArray(ctx.output.shinsalHits) || ctx.output.shinsalHits === undefined);
  check('gongmang regression guard',
    Array.isArray(ctx.output.gongmang) || ctx.output.gongmang === undefined);
}

const sajuTsDistPath = path.resolve(SPRING_TS_ROOT, '../saju-ts/dist/index.js');
const sajuModule = await import(pathToFileURL(sajuTsDistPath).href);
const rawOutput = sajuModule.analyzeSaju(sajuModule.createBirthInput({
  birthYear: 1986,
  birthMonth: 4,
  birthDay: 19,
  birthHour: 5,
  birthMinute: 45,
  gender: 'MALE',
}));
const rawBoundaryTermId = rawOutput.daeunInfo.boundaryTermId;
const newPreferredSummary = extractSaju({
  ...rawOutput,
  daeunInfo: {
    ...rawOutput.daeunInfo,
    boundaryMode: 'LEGACY_CONFLICT',
  },
});
check('boundaryTermId wins over a conflicting legacy boundaryMode alias',
  newPreferredSummary.daeunInfo?.boundaryTermId === rawBoundaryTermId &&
  newPreferredSummary.daeunInfo?.boundaryMode === rawBoundaryTermId);

const legacyOnlySummary = extractSaju({
  ...rawOutput,
  daeunInfo: {
    ...rawOutput.daeunInfo,
    boundaryTermId: undefined,
    boundaryMode: rawBoundaryTermId,
  },
});
check('legacy boundaryMode falls back into both normalized fields',
  legacyOnlySummary.daeunInfo?.boundaryTermId === rawBoundaryTermId &&
  legacyOnlySummary.daeunInfo?.boundaryMode === rawBoundaryTermId);

const missingBoundarySummary = extractSaju({
  ...rawOutput,
  daeunInfo: {
    ...rawOutput.daeunInfo,
    boundaryTermId: null,
    boundaryMode: 'LEGACY_STALE',
    boundaryUtcMs: null,
  },
});
check('explicit null boundaryTermId stays authoritative over a stale legacy alias',
  missingBoundarySummary.daeunInfo?.boundaryTermId === null &&
  missingBoundarySummary.daeunInfo?.boundaryMode === '' &&
  missingBoundarySummary.daeunInfo?.boundaryUtcMs === null);

let malformedBoundaryRejected = false;
try {
  extractSaju({
    ...rawOutput,
    daeunInfo: {
      ...rawOutput.daeunInfo,
      boundaryTermId: { malformed: true },
    },
  });
} catch (error) {
  malformedBoundaryRejected = error instanceof TypeError
    && /boundaryTermId must be a string or null/.test(error.message);
}
check('malformed boundaryTermId fails closed without object stringification',
  malformedBoundaryRejected);

const emptySummary: SajuSummary = {
  ...summary,
  daeunInfo: null,
  saeunPillars: [],
  wolunPillars: [],
} as any as SajuSummary;
const emptyCtx = buildSajuContext(emptySummary);
check('null daeunInfo -> output undefined', emptyCtx.output?.daeunInfo === undefined);
check('empty saeunPillars -> output undefined', emptyCtx.output?.saeunPillars === undefined);
check('empty wolunPillars -> output undefined', (emptyCtx.output as any)?.wolunPillars === undefined);

console.log(`\nadapter-daewoon: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
