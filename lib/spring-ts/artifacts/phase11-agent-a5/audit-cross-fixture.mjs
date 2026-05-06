#!/usr/bin/env node
// Cross-fixture audit:
// 1. Per-cell distinct ratio: count unique plainText / count fixtures occupying that cell.
//    Cells with ratio < 0.3 (heavy reuse) are flagged.
// 2. Fragment reuse heatmap: for each plainText, count fixtures using it; sort
//    descending. Top 50 are written to fragment-reuse-top.json.
// 3. Group cohesion: jonggyeok-6, senior-pair, choi-seongsoo cluster, etc.
// 4. Same-seed cluster: 02/14/15/21 share selectionSeed but have different
//    precisionConfig — analyze divergence in their prose.
//
// Output: cross-fixture-report.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const corpus = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'prose-corpus.json'), 'utf8'),
);

const records = corpus.records;
const fixtures = corpus.fixtures;

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

const cellMap = new Map();
for (const r of records) {
  if (!cellMap.has(r.cellKey)) {
    cellMap.set(r.cellKey, { fixtures: new Map(), period: r.period, category: r.category, depth: r.depth, slot: r.slot });
  }
  const cell = cellMap.get(r.cellKey);
  if (!cell.fixtures.has(r.fixture)) cell.fixtures.set(r.fixture, []);
  cell.fixtures.get(r.fixture).push(r.plainText);
}

const cells = [];
for (const [cellKey, cell] of cellMap) {
  const fixtureTexts = new Map();
  for (const [fix, texts] of cell.fixtures) {
    fixtureTexts.set(fix, texts.join('\n'));
  }
  const allTexts = [...fixtureTexts.values()];
  const distinctSet = new Set(allTexts);
  cells.push({
    cellKey,
    period: cell.period,
    category: cell.category,
    depth: cell.depth,
    slot: cell.slot,
    fixtureCount: allTexts.length,
    distinctCount: distinctSet.size,
    distinctRatio: allTexts.length === 0 ? 0 : distinctSet.size / allTexts.length,
    duplicates: allTexts.length - distinctSet.size,
  });
}
cells.sort((a, b) => a.distinctRatio - b.distinctRatio);

const proseToOccurrence = new Map();
for (const r of records) {
  const key = r.plainText.trim();
  if (!key) continue;
  if (!proseToOccurrence.has(key)) {
    proseToOccurrence.set(key, { fixtures: new Set(), cells: new Set(), records: [] });
  }
  const e = proseToOccurrence.get(key);
  e.fixtures.add(r.fixture);
  e.cells.add(r.cellKey);
  e.records.push({ fixture: r.fixture, cellKey: r.cellKey });
}

const reuseList = [...proseToOccurrence.entries()].map(([prose, info]) => ({
  prose,
  fixtureCount: info.fixtures.size,
  cellCount: info.cells.size,
  totalOccurrences: info.records.length,
  cellSamples: [...info.cells].slice(0, 4),
}));
reuseList.sort((a, b) => b.fixtureCount - a.fixtureCount || b.totalOccurrences - a.totalOccurrences);
const topReuse = reuseList.slice(0, 80);

const groups = {
  'jonggyeok-6': [
    '23-jonggyeok-jongwang-yeomsang-tiered.json',
    '24-jonggyeok-jongjae-tiered.json',
    '25-jonggyeok-jonggwan-tiered.json',
    '26-jonggyeok-jongsal-tiered.json',
    '27-jonggyeok-jongah-tiered.json',
    '28-jonggyeok-jonggang-tiered.json',
  ],
  'senior-pair': [
    '16-choi-senior-male-tiered.json',
    '17-kim-senior-female-tiered.json',
  ],
  'extreme-strength-pair': [
    '12-jeong-extreme-strong-continuous-tiered.json',
    '13-oh-extreme-weak-continuous-tiered.json',
  ],
  'choi-seongsoo-cluster': [
    '02-choi-seongsoo-tiered-fortune.json',
    '14-choi-palace-naeum-surface-tiered.json',
    '15-choi-consensus-aware-yongshin-tiered.json',
    '21-multi-axis-evaluator-enabled-tiered.json',
  ],
  'gyeokguk-conflict-pair': [
    '19-gyeokguk-conflict-jeonggwan-vs-bigyeop-tiered.json',
    '20-gyeokguk-conflict-consensus-aware-tiered.json',
  ],
  'boundary-pair': [
    '10-choi-yaza-boundary-male-tiered.json',
    '11-park-jeolgi-boundary-female-tiered.json',
    '30-jeolgi-lidong-boundary-tiered.json',
  ],
  'age-spread': [
    '17-kim-senior-female-tiered.json',
    '18-lee-child-male-tiered.json',
    '31-newborn-infant-male-tiered.json',
    '32-nonagenarian-weak-daymaster-tiered.json',
  ],
};

const groupReports = {};
for (const [groupName, members] of Object.entries(groups)) {
  const groupCells = new Map();
  for (const r of records) {
    if (!members.includes(r.fixture)) continue;
    if (!groupCells.has(r.cellKey)) groupCells.set(r.cellKey, new Map());
    const cell = groupCells.get(r.cellKey);
    if (!cell.has(r.fixture)) cell.set(r.fixture, []);
    cell.get(r.fixture).push(r.plainText);
  }
  const cellSummaries = [];
  for (const [cellKey, cellFixtures] of groupCells) {
    const texts = [];
    for (const [_, ts] of cellFixtures) texts.push(ts.join('\n'));
    if (texts.length < 2) continue;
    const distinct = new Set(texts).size;
    cellSummaries.push({
      cellKey,
      memberCount: texts.length,
      distinctCount: distinct,
      ratio: distinct / texts.length,
    });
  }
  cellSummaries.sort((a, b) => a.ratio - b.ratio);
  const allRatios = cellSummaries.map((c) => c.ratio);
  const meanRatio = allRatios.length === 0 ? 0 : allRatios.reduce((a, b) => a + b, 0) / allRatios.length;
  groupReports[groupName] = {
    members,
    memberCount: members.length,
    cellsCompared: cellSummaries.length,
    meanDistinctRatio: meanRatio,
    medianDistinctRatio: median(allRatios),
    cellsFullyDistinct: cellSummaries.filter((c) => c.ratio === 1).length,
    cellsBelow50: cellSummaries.filter((c) => c.ratio < 0.5).length,
    cellsAllIdentical: cellSummaries.filter((c) => c.distinctCount === 1).length,
    worstCells: cellSummaries.slice(0, 8),
  };
}

const seedCluster = ['02-choi-seongsoo-tiered-fortune.json', '14-choi-palace-naeum-surface-tiered.json', '15-choi-consensus-aware-yongshin-tiered.json', '21-multi-axis-evaluator-enabled-tiered.json'];
const seedClusterCells = new Map();
for (const r of records) {
  if (!seedCluster.includes(r.fixture)) continue;
  if (!seedClusterCells.has(r.cellKey)) seedClusterCells.set(r.cellKey, {});
  seedClusterCells.get(r.cellKey)[r.fixture] = r.plainText;
}
const seedDivergences = [];
for (const [cellKey, byFixture] of seedClusterCells) {
  const presentIn = Object.keys(byFixture);
  if (presentIn.length < 2) continue;
  const texts = Object.values(byFixture);
  const distinct = new Set(texts).size;
  if (distinct > 1) {
    seedDivergences.push({
      cellKey,
      presentIn,
      distinctCount: distinct,
      texts: byFixture,
    });
  }
}

const fullyIdenticalCells = cells.filter((c) => c.distinctCount === 1 && c.fixtureCount >= 4);
const heavyReuseCells = cells.filter((c) => c.distinctRatio < 0.3 && c.fixtureCount >= 8);

const allRatios = cells.map((c) => c.distinctRatio);
const summary = {
  fixtureCount: fixtures.length,
  recordCount: records.length,
  uniqueProseStringCount: proseToOccurrence.size,
  totalCells: cells.length,
  meanDistinctRatio: allRatios.reduce((a, b) => a + b, 0) / allRatios.length,
  medianDistinctRatio: median(allRatios),
  cellsFullyDistinct: cells.filter((c) => c.distinctRatio === 1).length,
  cellsAllIdentical: cells.filter((c) => c.distinctCount === 1 && c.fixtureCount >= 2).length,
  cellsHeavyReuse_lt30pct: heavyReuseCells.length,
  fragmentsUsedIn50PctPlus: reuseList.filter((e) => e.fixtureCount >= 16).length,
  fragmentsUsedIn80PctPlus: reuseList.filter((e) => e.fixtureCount >= 26).length,
};

const out = {
  generatedAt: new Date().toISOString(),
  summary,
  fixtures,
  perCellRatios: {
    worstBottom30: cells.slice(0, 30),
    bestTop30: cells.slice(-30).reverse(),
  },
  fullyIdenticalAcross8PlusFixtures: fullyIdenticalCells.slice(0, 30),
  heavyReuseCells: heavyReuseCells.slice(0, 50),
  topReusedFragments: topReuse,
  groupReports,
  sameSeedClusterDivergences: {
    cluster: seedCluster,
    sharedSeed: '1986|4|19|5|45|male|2026-05-04T15:00:00.000Z',
    divergentCells: seedDivergences.length,
    samples: seedDivergences.slice(0, 25),
  },
};

const outPath = path.join(__dirname, 'cross-fixture-report.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

console.log(`fixtures: ${summary.fixtureCount}`);
console.log(`records: ${summary.recordCount}`);
console.log(`unique prose strings: ${summary.uniqueProseStringCount}`);
console.log(`total cells: ${summary.totalCells}`);
console.log(`mean distinct ratio: ${summary.meanDistinctRatio.toFixed(3)}`);
console.log(`median distinct ratio: ${summary.medianDistinctRatio.toFixed(3)}`);
console.log(`cells fully distinct: ${summary.cellsFullyDistinct}`);
console.log(`cells fully identical (>=2 fixtures): ${summary.cellsAllIdentical}`);
console.log(`cells with ratio < 30% (>=8 fixtures): ${summary.cellsHeavyReuse_lt30pct}`);
console.log(`fragments used in >=50% fixtures: ${summary.fragmentsUsedIn50PctPlus}`);
console.log(`fragments used in >=80% fixtures: ${summary.fragmentsUsedIn80PctPlus}`);
console.log(`same-seed cluster divergent cells: ${seedDivergences.length}`);
console.log(`output: ${outPath}`);
