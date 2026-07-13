import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../../saju-ts/dist');
const u = (p) => pathToFileURL(path.join(ROOT, p)).href;
const { normalizeConfig } = await import(u('api/config.js'));
const { pillar } = await import(u('core/cycle.js'));
const { elementDistributionFromPillars } = await import(u('core/elementDistribution.js'));
const { DEFAULT_SCORE_POLICY } = await import(u('core/scoring.js'));
const { buildRuleFacts } = await import(u('rules/facts.js'));
const { computeYongshin } = await import(u('rules/yongshin.js'));
const { scorePillarsForRuleFacts } = await import(u('rules/ruleFactsScoring.js'));

const ELS = ['WOOD','FIRE','EARTH','METAL','WATER'];
const CLIMATE_TOP = { 0: 'FIRE', 1: 'FIRE', 6: 'WATER' }; // 子·丑월→火, 午월→水

const FIXTURES = [
  { id: 'fix-03', note: '戊土 子月 (baseline 픽스처)', p: { year: pillar(5,3), month: pillar(2,0), day: pillar(4,6), hour: pillar(8,0) } },
  { id: 'fix-05', note: '癸水 子月 겨울 조후 케이스 (baseline)', p: { year: pillar(1,9), month: pillar(4,0), day: pillar(9,7), hour: pillar(1,3) } },
  { id: 'fix-06', note: '戊土 午月 여름 (baseline)', p: { year: pillar(4,6), month: pillar(4,6), day: pillar(4,8), hour: pillar(5,7) } },
  { id: 'S4', note: '庚金 午月 신약 충돌 (丁巳/丙午/庚寅/丁丑)', p: { year: pillar(3,5), month: pillar(2,6), day: pillar(6,2), hour: pillar(3,1) } },
  { id: 'S5', note: '壬水 子月 극신강 물바다 (壬子/壬子/壬申/庚子)', p: { year: pillar(8,0), month: pillar(8,0), day: pillar(8,8), hour: pillar(6,0) } },
];
const EXPECTED = {
  'fix-03': { strength: 0.020, factor: 0.4039, weights: [0.8990, 0.8990, 0.3510], best: 'FIRE', ranking: 'FIRE>METAL>EARTH>WOOD>WATER', climateRank: 1, lambdaMin: 0.000 },
  'fix-05': { strength: -0.085, factor: 0.4039, weights: [0.8990, 0.8990, 0.3510], best: 'METAL', ranking: 'METAL>FIRE>WOOD>EARTH>WATER', climateRank: 2, lambdaMin: 0.078 },
  'fix-06': { strength: 0.806, factor: 0.3200, weights: [0.9200, 0.9200, 0.3300], best: 'METAL', ranking: 'METAL>WATER>WOOD>EARTH>FIRE', climateRank: 2, lambdaMin: 0.011 },
  S4: { strength: -0.416, factor: 0.3200, weights: [0.9200, 0.9200, 0.3300], best: 'EARTH', ranking: 'EARTH>METAL>WATER>WOOD>FIRE', climateRank: 3, lambdaMin: 0.220 },
  S5: { strength: 0.983, factor: 0.4039, weights: [0.8990, 0.8990, 0.3510], best: 'WOOD', ranking: 'WOOD>FIRE>EARTH>METAL>WATER', climateRank: 2, lambdaMin: 0.039 },
};

function assertClose(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}


function run(p, cfg) {
  const config = normalizeConfig(cfg);
  const ed = elementDistributionFromPillars([p.year,p.month,p.day,p.hour], { hiddenStemWeights: config.weights?.hiddenStems });
  const scoring = scorePillarsForRuleFacts(p, DEFAULT_SCORE_POLICY);
  const facts = buildRuleFacts({ config, pillars: p, elementDistribution: ed, scoring });
  return { facts, ys: computeYongshin(config, facts) };
}

for (const f of FIXTURES) {
  const { facts, ys } = run(f.p, {});
  const w = ys.base.effectiveWeights;
  const cs = ys.base.climate?.scores ?? {};
  const monthBranch = f.p.month.branch;
  const cTop = CLIMATE_TOP[monthBranch];
  console.log(`\n===== ${f.id} — ${f.note} =====`);
  console.log(`strength.index=${facts.strength.index.toFixed(3)}  urgencyFactor=${(ys.base.climateUrgency?.factor??0).toFixed(4)}  w={bal:${w.balance.toFixed(3)}, role:${w.role.toFixed(3)}, cli:${w.climate.toFixed(4)}}`);
  const rows = ELS.map(e => {
    const def = ys.base.deficiency[e];
    const pref = ys.base.role[e].preference;
    const c = cs[e] ?? 0;
    const bT = w.balance*def, rT = w.role*pref, cT = w.climate*c;
    return { e, role: ys.base.role[e].role, bT, rT, cT, total: bT+rT+cT };
  }).sort((a,b)=>b.total-a.total);
  for (const r of rows) console.log(`  ${r.e.padEnd(5)} ${r.role.padEnd(9)} bal=${r.bT.toFixed(3)} role=${r.rT.toFixed(3)} cli=${r.cT.toFixed(3)}  Σ=${r.total.toFixed(3)}`);
  const top = rows[0], cRow = rows.find(r=>r.e===cTop);
  const lambdaMin = top.e===cTop ? 0 : (top.total - cRow.total);
  const expected = EXPECTED[f.id];
  assert.ok(expected, `missing characterization expectation: ${f.id}`);
  const ranking = ys.ranking.map((row) => row.element).join('>');
  const climateRank = rows.findIndex((row) => row.e === cTop) + 1;
  assertClose(facts.strength.index, expected.strength, 0.0006, `${f.id} strength.index`);
  assertClose(w.balance, expected.weights[0], 0.0006, `${f.id} balance weight`);
  assertClose(w.role, expected.weights[1], 0.0006, `${f.id} role weight`);
  assertClose(w.climate, expected.weights[2], 0.0006, `${f.id} climate weight`);
  assertClose(lambdaMin, expected.lambdaMin, 0.0006, `${f.id} lambdaMin`);
  assertClose(ys.base.climateUrgency?.factor ?? 0, expected.factor, 0.0001, `${f.id} urgencyFactor`);
  assert.equal(ys.best, expected.best, `${f.id} best`);
  assert.equal(ranking, expected.ranking, `${f.id} ranking`);
  assert.equal(ys.primaryMethod, 'EOKBU', `${f.id} primaryMethod`);
  assert.equal(climateRank, expected.climateRank, `${f.id} climate rank`);
  assert.equal(ys.consensus.johu.element, cTop, `${f.id} consensus.johu`);
  console.log(`  최종랭킹=${ys.ranking.map(r=>r.element).join('>')}  best=${ys.best}  primaryMethod=${ys.primaryMethod}`);
  console.log(`  조후오행(${cTop}) 순위=${rows.findIndex(r=>r.e===cTop)+1}위  1위와 격차 λmin=${lambdaMin.toFixed(3)}  consensus.johu=${ys.consensus.johu.element}`);
  // 프리셋 비교
  for (const school of ['johoo','johoo.strict']) {
    const { ys: y2 } = run(f.p, { school: { id: school } });
    assert.equal(y2.best, cTop, `${f.id} ${school} best`);
    console.log(`  [${school}] best=${y2.best}  ranking=${y2.ranking.map(r=>r.element).join('>')}  wCli=${y2.base.effectiveWeights.climate.toFixed(3)} wTpl=${y2.base.effectiveWeights.johooTemplate.toFixed(3)}`);
  }
}

console.log(`\nF2 characterization: PASS (${FIXTURES.length} fixtures)`);
