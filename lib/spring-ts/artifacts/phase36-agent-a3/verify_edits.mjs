/**
 * P36-A3 — Verify all 10 lifts produced 6-paragraph fragments
 * with 흐름이=0 in newly added paragraph and per-para flow <=2.
 * Adapted from artifacts/phase34-agent-a3/verify_edits.mjs.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');

const targets = [
  ['health/today', 'health.today.expert.water_day.001'],
  ['health/thisWeek', 'health.thisWeek.expert.weak.001'],
  ['health/thisMonth', 'health.thisMonth.expert.conflicting.001'],
  ['health/life', 'health.life.expert.extreme_strong.001'],
  ['health_stress/today', 'health_stress.today.expert.wildcard.001'],
  ['health_stress/life', 'health_stress.life.expert.diversity.anchor.001'],
  ['movement/thisYear', 'movement.thisYear.expert.30_39.005'],
  ['romance/thisWeek', 'romance.thisWeek.expert.midlife.aligned.001'],
  ['romance/thisMonth', 'romance.thisMonth.expert.midlife.aligned.001'],
  ['wealth/thisYear', 'wealth.thisYear.expert.wildcard.001'],
];

function paragraphsAndFlow(frag) {
  const tokens = frag?.templateTokens ?? frag?.tokens ?? [];
  let combined = '';
  let textOnly = '';
  for (const t of tokens) {
    if (t?.kind === 'text' && typeof t.value === 'string') {
      combined += t.value;
      textOnly += t.value;
    } else if (t?.kind === 'tag') combined += '#';
  }
  const paras = combined
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const textParas = textOnly.split(/\n\n+/);
  const perParaFlow = textParas.map((p) => (p.match(/흐름이/g) ?? []).length);
  // Count 결X particles per paragraph (결이|결로|결의|결을|결에).
  const perParaGyeolX = textParas.map(
    (p) => (p.match(/결[이로의을에]/g) ?? []).length,
  );
  const newParaLen = paras[paras.length - 1]?.length ?? 0;
  return { count: paras.length, perParaFlow, perParaGyeolX, newParaLen };
}

let ok = true;
for (const [dir, fid] of targets) {
  const file = path.join(SPRING_TS_ROOT, 'data/narrative', dir, 'expert.fragments.json');
  const j = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const frag = j.fragments.find((f) => f.fragmentId === fid);
  if (!frag) {
    console.log('MISSING', fid);
    ok = false;
    continue;
  }
  const { count, perParaFlow, perParaGyeolX, newParaLen } = paragraphsAndFlow(frag);
  const flag =
    count === 6 && perParaFlow.every((f) => f <= 2) ? 'OK' : 'BAD';
  console.log(
    `${flag}\tparas=${count}\tnewLen=${newParaLen}\tperParaFlow=${JSON.stringify(perParaFlow)}\tperParaGyeolX=${JSON.stringify(perParaGyeolX)}\t${fid}`,
  );
  if (count !== 6 || perParaFlow.some((f) => f > 2)) ok = false;
}
console.log(ok ? '\nALL 10 ARE 6-PARAGRAPH WITH PER-PARA FLOW<=2' : '\nFAIL');
