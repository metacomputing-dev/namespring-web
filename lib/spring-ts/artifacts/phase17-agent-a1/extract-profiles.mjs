/**
 * artifacts/phase17-agent-a1/extract-profiles.mjs
 *
 * Phase 17 Agent A1: Build a per-fixture FeatureVector from the
 * regenerated tiered samples. Reads only sample artifacts (no engine
 * spawn, no src import). Maps Korean strength labels +
 * yongshin/dayMaster element labels to the canonical gating tokens
 * (BALANCED/STRONG/.../neutral/aligned).
 *
 * Mirrors `feature-selector.ts:toStrengthBand` and
 * `feature-selector.ts:toYongshinAlignment` so the offline analysis
 * lines up with the actual selector at runtime.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const SAMPLES_DIR = path.resolve(SPRING_TS_ROOT, 'artifacts/sample-outputs-2026-05-05-phase3');

function ageBandOf(year, targetYear) {
  const a = targetYear - year;
  if (a < 10) return '0-9';
  if (a < 20) return '10-19';
  if (a < 30) return '20-29';
  if (a < 40) return '30-39';
  if (a < 55) return '40-54';
  if (a < 70) return '55-69';
  return '70+';
}

function strengthFromKoreanLabel(label) {
  const s = String(label || '').trim();
  // The reorder is intentional: the wider 신약/신왕 patterns must check
  // before 균형 (the surface text is "에너지 균형은 신약이에요." — both
  // 균형 and 신약 appear; 신약/신왕 is the load-bearing token).
  if (/극왕|극강|극신왕/.test(s)) return 'EXTREME_STRONG';
  if (/극약|극신약/.test(s)) return 'EXTREME_WEAK';
  if (/신왕|신강/.test(s)) return 'STRONG';
  if (/신약/.test(s)) return 'WEAK';
  if (/중화|평형|균형/.test(s)) return 'BALANCED';
  return null;
}

const KOREAN_TO_ELEMENT = {
  '나무': 'WOOD', '木': 'WOOD',
  '불':   'FIRE', '火': 'FIRE',
  '흙':   'EARTH', '土': 'EARTH',
  '쇠':   'METAL', '金': 'METAL',
  '물':   'WATER', '水': 'WATER',
};
const STEM_TO_ELEMENT = {
  '갑': 'WOOD', '을': 'WOOD',
  '병': 'FIRE', '정': 'FIRE',
  '무': 'EARTH', '기': 'EARTH',
  '경': 'METAL', '신': 'METAL',
  '임': 'WATER', '계': 'WATER',
};

function dayMasterElementFromOverview(overview) {
  // Walk pillars to find 일주 stem
  const ilJu = overview?.pillars?.find((p) => p.position === '일주');
  if (!ilJu?.stem) return null;
  const stem = String(ilJu.stem).trim();
  return STEM_TO_ELEMENT[stem] ?? null;
}

function yongshinElementFromOverview(overview) {
  // yongshinDescription typically contains '쇠(금) 기운', '불 기운', etc.
  const text = String(overview?.yongshinDescription || '');
  for (const ko of Object.keys(KOREAN_TO_ELEMENT)) {
    if (text.includes(ko + ' 기운') || text.includes(ko + '(' )) {
      return KOREAN_TO_ELEMENT[ko];
    }
  }
  return null;
}

function yongshinAlignment(yongshin, dayMaster) {
  if (!yongshin || !dayMaster) return 'neutral';
  if (yongshin === dayMaster) return 'aligned';
  return 'neutral';
}

const TIERED_FILE_RE = /-tiered\.json$/;
const sampleFiles = fs.readdirSync(SAMPLES_DIR).filter((f) => TIERED_FILE_RE.test(f)).sort();

const profiles = [];
for (const file of sampleFiles) {
  const json = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, file), 'utf-8'));
  const birth = json?.request?.birth ?? json?.payload?.nameCompatibility?.input?.birth;
  if (!birth) continue;
  const targetDate = new Date(json?.targetDate ?? json?.request?.targetDate);
  const targetYear = targetDate.getFullYear();
  const ageBand = ageBandOf(birth.year, targetYear);
  const overview = json?.payload?.overviewSummary;

  const dayMasterElement = dayMasterElementFromOverview(overview);
  const yongshinElement = yongshinElementFromOverview(overview);
  const strength = strengthFromKoreanLabel(overview?.strengthDescription);
  const alignment = yongshinAlignment(yongshinElement, dayMasterElement);
  const gender = birth.gender === 'male' || birth.gender === 'female' ? birth.gender : 'neutral';

  profiles.push({
    file,
    age: targetYear - birth.year,
    ageBand,
    gender,
    dayMasterElement,
    yongshinElement,
    yongshinAlignment: alignment,
    dayMasterStrength: strength,
  });
}

// Histograms
const histo = (key) => profiles.reduce((acc, r) => {
  const v = r[key] ?? '(unknown)';
  acc[v] = (acc[v] ?? 0) + 1;
  return acc;
}, {});

console.log('Total fixtures: ' + profiles.length);
for (const k of ['ageBand', 'gender', 'dayMasterStrength', 'yongshinAlignment', 'dayMasterElement', 'yongshinElement']) {
  console.log('\n' + k + ':');
  console.log(JSON.stringify(histo(k), null, 2));
}

console.log('\nFull table:');
const headers = ['file', 'age', 'ageBand', 'gender', 'dayMasterStrength', 'yongshinAlignment', 'dayMasterElement', 'yongshinElement'];
console.log(headers.join('\t'));
for (const r of profiles) {
  console.log(headers.map((h) => r[h] ?? '').join('\t'));
}

// Helper: count fixtures that match a given gating spec
function countMatching(gating) {
  return profiles.filter((p) => {
    for (const [k, allow] of Object.entries(gating)) {
      const v = p[k];
      if (!Array.isArray(allow) || allow.length === 0) continue;
      if (!allow.includes(v)) return false;
    }
    return true;
  }).length;
}

console.log('\n\n--- Common gating profiles + match counts ---');
const commonGatings = [
  { name: 'aligned (any age)', gating: { yongshinAlignment: ['aligned'] } },
  { name: 'neutral (any age)', gating: { yongshinAlignment: ['neutral'] } },
  { name: 'STRONG (any align)', gating: { dayMasterStrength: ['STRONG'] } },
  { name: 'STRONG+EXTREME_STRONG', gating: { dayMasterStrength: ['STRONG', 'EXTREME_STRONG'] } },
  { name: 'WEAK', gating: { dayMasterStrength: ['WEAK'] } },
  { name: 'WEAK+EXTREME_WEAK', gating: { dayMasterStrength: ['WEAK', 'EXTREME_WEAK'] } },
  { name: 'BALANCED', gating: { dayMasterStrength: ['BALANCED'] } },
  { name: 'STRONG+neutral', gating: { dayMasterStrength: ['STRONG'], yongshinAlignment: ['neutral'] } },
  { name: 'WEAK+neutral', gating: { dayMasterStrength: ['WEAK'], yongshinAlignment: ['neutral'] } },
  { name: 'BALANCED+neutral', gating: { dayMasterStrength: ['BALANCED'], yongshinAlignment: ['neutral'] } },
  { name: 'WEAK+EXTREME_WEAK+neutral', gating: { dayMasterStrength: ['WEAK', 'EXTREME_WEAK'], yongshinAlignment: ['neutral'] } },
  { name: 'STRONG+EXTREME_STRONG+neutral', gating: { dayMasterStrength: ['STRONG', 'EXTREME_STRONG'], yongshinAlignment: ['neutral'] } },
  { name: 'adult ageBand (20+)', gating: { ageBand: ['20-29', '30-39', '40-54', '55-69', '70+'] } },
  { name: 'adult+neutral', gating: { ageBand: ['20-29', '30-39', '40-54', '55-69', '70+'], yongshinAlignment: ['neutral'] } },
  { name: 'middle ageBand (30-54)', gating: { ageBand: ['30-39', '40-54'] } },
  { name: 'middle+neutral', gating: { ageBand: ['30-39', '40-54'], yongshinAlignment: ['neutral'] } },
];
for (const c of commonGatings) {
  console.log(`  ${c.name}: ${countMatching(c.gating)} fixtures`);
}
