/**
 * Verify all 10 P33-A3 edits resulted in 6-paragraph fragments.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');

const targets = [
  ['health_stress/life', 'health_stress.life.expert.weak_neutral.001'],
  ['romance/thisYear', 'romance.thisYear.expert.adult.strong.001'],
  ['health/today', 'health.today.expert.strong.001'],
  ['health/thisWeek', 'health.thisWeek.expert.aligned.001'],
  ['health/thisMonth', 'health.thisMonth.expert.balanced.001'],
  ['health/thisYear', 'health.thisYear.expert.balanced.001'],
  ['health/life', 'health.life.expert.conflicting.001'],
  ['movement/life', 'movement.life.expert.wildcard.001'],
  ['wealth/thisYear', 'wealth.thisYear.expert.55_69.008'],
  ['study_document/life', 'study_document.life.expert.diversity.anchor.013'],
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
  // Compute flowi per text-only paragraph
  const textParas = textOnly.split(/\n\n+/);
  const perParaFlow = textParas.map((p) => (p.match(/흐름이/g) ?? []).length);
  // Per-para length of LAST paragraph (newly added)
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
  const flag = count === 6 ? 'OK' : 'BAD';
  console.log(`${flag}\tparas=${count}\tnewLen=${newParaLen}\tperParaFlow=${JSON.stringify(perParaFlow)}\t${fid}`);
  if (count !== 6) ok = false;
}
console.log(ok ? '\nALL 10 ARE 6-PARAGRAPH' : '\nFAIL');
