import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createEngine } from './api/engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GOLDEN_JSON = path.join(ROOT, 'docs', '_golden', 'golden_cases.json');

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function pairFromPillarView(p: any): [number, number] {
  if (!p || !p.stem || !p.branch) {
    throw new Error('Invalid pillar view');
  }
  return [p.stem.idx, p.branch.idx];
}

function pillarsIdxFromSummary(summaryPillars: any) {
  if (!summaryPillars) throw new Error('summary.pillars is missing');
  return {
    year: pairFromPillarView(summaryPillars.year),
    month: pairFromPillarView(summaryPillars.month),
    day: pairFromPillarView(summaryPillars.day),
    hour: pairFromPillarView(summaryPillars.hour),
  };
}

function pillarsTextFromSummary(summaryPillars: any) {
  const y = `${summaryPillars.year.stem.text}${summaryPillars.year.branch.text}`;
  const m = `${summaryPillars.month.stem.text}${summaryPillars.month.branch.text}`;
  const d = `${summaryPillars.day.stem.text}${summaryPillars.day.branch.text}`;
  const h = `${summaryPillars.hour.stem.text}${summaryPillars.hour.branch.text}`;
  return `Y=${y} M=${m} D=${d} H=${h}`;
}

function coreSnapshotFromSummary(summary: any) {
  const s = summary ?? {};
  return {
    pillars: s.pillars,
    tenGods: s.tenGods,
    hiddenStems: s.hiddenStems,
    tenGodsHiddenStems: s.tenGodsHiddenStems,
    elementDistribution: s.elementDistribution,
    lifeStages: s.lifeStages,
    stemRelations: s.stemRelations,
    relations: s.relations,
  };
}

function rulesSnapshotFromSummary(summary: any) {
  const s = summary ?? {};
  return {
    strength: s.strength,
    yongshin: s.yongshin,
    gyeokguk: s.gyeokguk,
    shinsal: s.shinsal,
    shinsalHits: s.shinsalHits,
    shinsalScores: s.shinsalScores,
    shinsalScoresAdjusted: s.shinsalScoresAdjusted,
  };
}

function fortuneStartSnapshotFromSummary(summary: any) {
  const f = summary?.fortune;
  if (!f) return null;
  const first = (arr: any[]) => (Array.isArray(arr) && arr.length ? [arr[0]] : []);
  return {
    start: f.start,
    decades: first(f.decades),
    years: first(f.years),
    months: first(f.months),
    days: first(f.days),
  };
}

const GOLDEN_TOGGLES = {
  pillars: true,
  relations: true,
  tenGods: true,
  hiddenStems: true,
  elementDistribution: true,
  lifeStages: true,
  stemRelations: true,

  // keep heavy/unstable domains opt-in
  fortune: false,
  rules: false,
};

function configForGolden(input: any) {
  const cfg = isPlainObject(input) ? input : {};
  const t = isPlainObject(cfg.toggles) ? cfg.toggles : {};
  return {
    ...cfg,
    toggles: { ...GOLDEN_TOGGLES, ...t },
  };
}

async function loadGolden() {
  const raw = await fs.readFile(GOLDEN_JSON, 'utf8');
  const data = JSON.parse(raw);
  if (!isPlainObject(data) || !Array.isArray((data as any).cases)) {
    throw new Error(`Invalid golden file shape: ${GOLDEN_JSON}`);
  }
  return data as { cases: any[] };
}

describe('golden cases: pillars + core snapshot (known-answer)', async () => {
  const data = await loadGolden();

  for (const tc of data.cases) {
    const id = String(tc?.id ?? 'unknown');
    it(id, () => {
      const eng = createEngine(configForGolden(tc?.config));
      const bundle = eng.analyze(tc.request);
      const pillars = bundle?.summary?.pillars;

      expect(pillarsIdxFromSummary(pillars)).toEqual(tc.expect?.pillarsIdx);
      if (typeof tc?.expect?.pillarsText === 'string' && tc.expect.pillarsText.trim()) {
        expect(pillarsTextFromSummary(pillars)).toEqual(tc.expect.pillarsText);
      }

      // Internal cases freeze a compact "core snapshot".
      if (tc?.expect?.core) {
        expect(coreSnapshotFromSummary(bundle.summary)).toEqual(tc.expect.core);
      }

      // Optional (future): rules/fortune snapshots
      if (tc?.expect?.rules) {
        expect(rulesSnapshotFromSummary(bundle.summary)).toEqual(tc.expect.rules);
      }
      if (tc?.expect?.fortuneStart) {
        expect(fortuneStartSnapshotFromSummary(bundle.summary)).toEqual(tc.expect.fortuneStart);
      }
    });
  }
});
