import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeSaju, buildSajuContext } from '../src/saju-adapter.js';
import type { BirthInfo } from '../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(SPRING_TS_ROOT, 'test', 'fixtures', 'spring_ts_baseline_cases.json');
const AUTHORITY_DIR = path.join(SPRING_TS_ROOT, 'test', 'baseline', 'authority');

const CONSENSUS_AXES = ['eokbu', 'johu', 'gyeokguk', 'tonggwan', 'byeongyak', 'siksangFlow'] as const;
const TEN_GOD_GROUPS = ['friend', 'output', 'wealth', 'authority', 'resource'] as const;

interface BaselineFixture {
  readonly id: string;
  readonly label: string;
  readonly axis?: readonly string[];
  readonly birth: BirthInfo;
  readonly disagreementNotes?: readonly { readonly pendingAuthority?: boolean }[];
  readonly options?: Record<string, unknown>;
}

interface BuildOptions {
  readonly fixtureIds?: readonly string[];
  readonly generatedAt?: string;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function round(value: unknown, digits = 4): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const scale = 10 ** digits;
  return Math.round(n * scale) / scale;
}

function pillarHanja(pillar: any): string | null {
  const stem = pillar?.stem?.hanja;
  const branch = pillar?.branch?.hanja;
  return typeof stem === 'string' && typeof branch === 'string' ? `${stem}${branch}` : null;
}

function pillarCodes(pillar: any): string | null {
  const stem = pillar?.stem?.code;
  const branch = pillar?.branch?.code;
  return typeof stem === 'string' && typeof branch === 'string' ? `${stem}-${branch}` : null;
}

function hasAuthorityCase(fixtureId: string): boolean {
  return fs.existsSync(path.join(AUTHORITY_DIR, `${fixtureId}.json`));
}

function sortedCounts(values: readonly (string | null | undefined)[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value || 'unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function dominantGroup(groupCounts: Record<string, number> | undefined): string | null {
  if (!groupCounts) return null;
  return [...TEN_GOD_GROUPS]
    .map((group) => ({ group, count: Number(groupCounts[group]) || 0 }))
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group))[0]?.group ?? null;
}

function positionGroups(byPosition: Record<string, any> | undefined): Record<string, unknown> {
  if (!byPosition) return {};
  return Object.fromEntries(Object.entries(byPosition).map(([position, row]) => {
    const hiddenGroups = (row.hiddenStems ?? [])
      .map((stem: any) => ({
        group: stem.group ?? null,
        ratio: round(stem.ratio),
        element: stem.element ?? null,
      }))
      .sort((a: any, b: any) => (b.ratio ?? 0) - (a.ratio ?? 0) || String(a.group).localeCompare(String(b.group)));
    return [position, {
      cheonganGroup: row.cheonganGroup ?? null,
      jijiPrincipalGroup: row.jijiPrincipalGroup ?? null,
      hiddenGroups,
    }];
  }).sort((a, b) => a[0].localeCompare(b[0])));
}

function hiddenStemGroupMass(byPosition: Record<string, any> | undefined): Record<string, number> {
  const mass: Record<string, number> = { friend: 0, output: 0, wealth: 0, authority: 0, resource: 0 };
  for (const row of Object.values(byPosition ?? {})) {
    for (const stem of row.hiddenStems ?? []) {
      const group = stem.group;
      if (typeof group === 'string' && group in mass) {
        mass[group] += Number(stem.ratio) || 0;
      }
    }
  }
  return Object.fromEntries(Object.entries(mass).map(([group, value]) => [group, round(value, 3) ?? 0]));
}

function topCompositeFeatures(candidate: any): readonly unknown[] {
  return [...(candidate?.compositeClassical?.features ?? [])]
    .map((feature: any) => ({
      name: feature.name ?? null,
      contribution: round(feature.contribution),
      weight: round(feature.weight),
      score: round(feature.score),
    }))
    .sort((a: any, b: any) => (b.contribution ?? 0) - (a.contribution ?? 0) || String(a.name).localeCompare(String(b.name)))
    .slice(0, 3);
}

function compactGyeokgukCandidates(candidates: readonly any[] | undefined): readonly unknown[] {
  return [...(candidates ?? [])]
    .slice(0, 3)
    .map((candidate) => ({
      type: candidate.type ?? null,
      category: candidate.category ?? null,
      confidence: round(candidate.confidence),
      score: round(candidate.score),
      supportingRules: candidate.supportingRules ?? [],
      blockingRules: candidate.blockingRules ?? [],
      compositeTopFeatures: topCompositeFeatures(candidate),
    }));
}

function compactConsensus(consensus: any): Record<string, unknown> | null {
  if (!consensus?.final) return null;
  const axes = Object.fromEntries(CONSENSUS_AXES.map((axis) => [
    axis,
    {
      element: consensus[axis]?.element ?? null,
      score: round(consensus[axis]?.score),
    },
  ]));
  return {
    final: {
      element: consensus.final.element ?? null,
      confidence: round(consensus.final.confidence),
      topMargin: round(consensus.final.topMargin),
      conflictLevel: consensus.final.conflictLevel ?? null,
      competingElements: consensus.final.competingElements ?? [],
    },
    axes,
  };
}

function topWeightedShinsal(hits: readonly any[] | undefined): readonly unknown[] {
  return [...(hits ?? [])]
    .sort((a, b) => (Number(b.weightedScore) || 0) - (Number(a.weightedScore) || 0) || String(a.type).localeCompare(String(b.type)))
    .slice(0, 5)
    .map((hit) => ({
      type: hit.type ?? null,
      position: hit.position ?? null,
      grade: hit.grade ?? null,
      weightedScore: round(hit.weightedScore),
    }));
}

export async function buildDeepSajuFeatureReport(options: BuildOptions = {}) {
  const fixtures = readJson<{ readonly fixtures: readonly BaselineFixture[] }>(FIXTURE_PATH).fixtures
    .filter((fixture) => !options.fixtureIds || options.fixtureIds.includes(fixture.id));
  const rows = [];

  for (const fixture of fixtures) {
    const summary = await analyzeSaju(fixture.birth, fixture.options as any);
    const context = buildSajuContext(summary, { includeTenGodByPosition: true });
    const output = context.output;
    const tenGod = output?.tenGod;
    const topCandidate = summary.gyeokguk?.candidates?.[0];
    const topShinsal = topWeightedShinsal(summary.shinsalHits);

    rows.push({
      id: fixture.id,
      label: fixture.label,
      axis: fixture.axis ?? [],
      birth: {
        gender: fixture.birth.gender,
        year: fixture.birth.year ?? null,
        hasHour: fixture.birth.hour != null && fixture.birth.minute != null,
      },
      reference: {
        authorityCasePresent: hasAuthorityCase(fixture.id),
        disagreementNoteCount: fixture.disagreementNotes?.length ?? 0,
        pendingAuthorityCount: fixture.disagreementNotes?.filter((note) => note.pendingAuthority).length ?? 0,
      },
      pillars: {
        year: { hanja: pillarHanja(summary.pillars.year), code: pillarCodes(summary.pillars.year) },
        month: { hanja: pillarHanja(summary.pillars.month), code: pillarCodes(summary.pillars.month) },
        day: { hanja: pillarHanja(summary.pillars.day), code: pillarCodes(summary.pillars.day) },
        hour: { hanja: pillarHanja(summary.pillars.hour), code: pillarCodes(summary.pillars.hour) },
      },
      dayMaster: {
        stem: summary.dayMaster.stem || null,
        element: summary.dayMaster.element || null,
        polarity: summary.dayMaster.polarity || null,
      },
      strength: {
        level: summary.strength.level || null,
        isStrong: summary.strength.isStrong,
        totalSupport: round(summary.strength.totalSupport),
        totalOppose: round(summary.strength.totalOppose),
        supportOpposeDelta: round((Number(summary.strength.totalSupport) || 0) - (Number(summary.strength.totalOppose) || 0)),
        judgment: summary.axisStrength?.strength ?? null,
      },
      yongshin: {
        selectedElement: output?.yongshin?.finalYongshin ?? summary.yongshin.element ?? null,
        heeshin: output?.yongshin?.finalHeesin ?? summary.yongshin.heeshin ?? null,
        gisin: output?.yongshin?.gisin ?? summary.yongshin.gishin ?? null,
        confidence: round(output?.yongshin?.finalConfidence ?? summary.yongshin.confidence),
        judgment: summary.axisStrength?.yongshin ?? null,
        consensus: compactConsensus(summary.yongshinConsensus ?? summary.yongshin.consensus),
      },
      gyeokguk: {
        type: output?.gyeokguk?.type ?? summary.gyeokguk.type ?? null,
        category: output?.gyeokguk?.category ?? summary.gyeokguk.category ?? null,
        confidence: round(output?.gyeokguk?.confidence ?? summary.gyeokguk.confidence),
        judgment: summary.axisStrength?.gyeokguk ?? null,
        selectedCandidateTopFeatures: topCompositeFeatures(topCandidate),
        topCandidates: compactGyeokgukCandidates(summary.gyeokguk?.candidates),
      },
      tenGod: {
        groupCounts: tenGod?.groupCounts ?? null,
        dominantGroup: dominantGroup(tenGod?.groupCounts),
        positionGroups: positionGroups(tenGod?.byPosition),
        hiddenStemGroupMass: hiddenStemGroupMass(tenGod?.byPosition),
      },
      relations: {
        cheonganCount: summary.cheonganRelations?.length ?? 0,
        cheonganTypes: [...new Set((summary.cheonganRelations ?? []).map((row: any) => row.type))].sort(),
        jijiCount: summary.jijiRelations?.length ?? 0,
        jijiTypes: [...new Set((summary.jijiRelations ?? []).map((row: any) => row.type))].sort(),
      },
      shinsal: {
        count: summary.shinsalHits?.length ?? 0,
        highWeightCount: (summary.shinsalHits ?? []).filter((hit: any) => (Number(hit.weightedScore) || 0) >= 80).length,
        topWeighted: topShinsal,
        topWeightedType: (topShinsal[0] as any)?.type ?? null,
      },
      gongmang: summary.gongmang ?? null,
    });
  }

  return {
    schemaVersion: 'spring-ts.deep-saju-feature-report.v1',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    fixtureCount: rows.length,
    totals: {
      highConsensusConflictCount: rows.filter((row: any) => row.yongshin.consensus?.final?.conflictLevel === 'high').length,
      withTenGodByPositionCount: rows.filter((row: any) => Object.keys(row.tenGod.positionGroups).length > 0).length,
      pendingAuthorityNoteCount: rows.reduce((sum: number, row: any) => sum + row.reference.pendingAuthorityCount, 0),
    },
    coverage: {
      dayMasterElement: sortedCounts(rows.map((row: any) => row.dayMaster.element)),
      dayMasterPolarity: sortedCounts(rows.map((row: any) => row.dayMaster.polarity)),
      strengthLevel: sortedCounts(rows.map((row: any) => row.strength.level)),
      yongshinElement: sortedCounts(rows.map((row: any) => row.yongshin.selectedElement)),
      gyeokgukType: sortedCounts(rows.map((row: any) => row.gyeokguk.type)),
      gyeokgukCategory: sortedCounts(rows.map((row: any) => row.gyeokguk.category)),
      consensusConflictLevel: sortedCounts(rows.map((row: any) => row.yongshin.consensus?.final?.conflictLevel)),
      dominantTenGodGroup: sortedCounts(rows.map((row: any) => row.tenGod.dominantGroup)),
      topWeightedShinsalType: sortedCounts(rows.map((row: any) => row.shinsal.topWeightedType)),
    },
    rows,
  };
}

export function renderDeepSajuFeatureReport(report: Awaited<ReturnType<typeof buildDeepSajuFeatureReport>>): string {
  const lines = [
    'Deep Saju Feature Report',
    `Fixtures: ${report.fixtureCount}`,
    `High yongshin-consensus conflicts: ${report.totals.highConsensusConflictCount}`,
    `Rows with ten-god position detail: ${report.totals.withTenGodByPositionCount}`,
    `Pending authority notes: ${report.totals.pendingAuthorityNoteCount}`,
    '',
    'Coverage:',
  ];
  for (const [axis, counts] of Object.entries(report.coverage)) {
    const summary = Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(', ');
    lines.push(`- ${axis}: ${summary}`);
  }
  lines.push('');
  lines.push('Rows:');
  for (const row of report.rows as any[]) {
    const pillars = ['year', 'month', 'day', 'hour'].map((pos) => row.pillars[pos].hanja).join(' ');
    lines.push(`- ${row.id}: ${pillars}; DM=${row.dayMaster.element}/${row.dayMaster.polarity}; yongshin=${row.yongshin.selectedElement}; gyeokguk=${row.gyeokguk.type}; tenGod=${row.tenGod.dominantGroup}; shinsal=${row.shinsal.topWeightedType}`);
  }
  return lines.join('\n');
}

function parseArgs(argv: readonly string[]): { json: boolean; fixtureIds?: readonly string[] } {
  const args: { json: boolean; fixtureIds?: readonly string[] } = { json: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--fixtures' && argv[i + 1]) {
      args.fixtureIds = argv[i + 1].split(',').map((id) => id.trim()).filter(Boolean);
      i += 1;
    }
  }
  return args;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv);
  const report = await buildDeepSajuFeatureReport({ fixtureIds: args.fixtureIds });
  process.stdout.write(args.json ? `${JSON.stringify(report, null, 2)}\n` : `${renderDeepSajuFeatureReport(report)}\n`);
}
