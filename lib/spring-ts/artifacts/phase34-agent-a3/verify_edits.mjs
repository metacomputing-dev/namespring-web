/**
 * Verify all 10 P34-A3 edits resulted in 6-paragraph fragments
 * with 흐름이=0 in newly added paragraph and per-para flow ≤2.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');

const targets = [
  ['romance/thisYear', 'romance.thisYear.expert.adult.weak.001'],
  ['romance/thisMonth', 'romance.thisMonth.expert.adult.strong.001'],
  ['romance/life', 'romance.life.expert.adult.strong.001'],
  ['overall/life', 'overall.life.expert.diversity.anchor.507'],
  ['health/today', 'health.today.expert.fire_day.001'],
  ['health/thisWeek', 'health.thisWeek.expert.wild.001'],
  ['health/thisYear', 'health.thisYear.expert.water_year.001'],
  ['health_stress/life', 'health_stress.life.expert.weak_conflicting.001'],
  ['romance/today', 'romance.today.expert.young_adult.001'],
  ['health/life', 'health.life.expert.water_excess.001'],
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
  const newParaLen = paras[paras.length - 1]?.length ?? 0;
  return { count: paras.length, perParaFlow, newParaLen };
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
  const { count, perParaFlow, newParaLen } = paragraphsAndFlow(frag);
  const flag = count === 6 && perParaFlow.every((f) => f <= 2) ? 'OK' : 'BAD';
  console.log(
    `${flag}\tparas=${count}\tnewLen=${newParaLen}\tperParaFlow=${JSON.stringify(perParaFlow)}\t${fid}`,
  );
  if (count !== 6 || perParaFlow.some((f) => f > 2)) ok = false;
}
console.log(ok ? '\nALL 10 ARE 6-PARAGRAPH WITH PER-PARA FLOW≤2' : '\nFAIL');
