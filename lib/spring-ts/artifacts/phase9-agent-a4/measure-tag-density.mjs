/*
 * P9-A4: Measure rendered expert paragraph tag density across 22 tiered fixtures.
 *
 * Per docs/NARRATIVE_STYLE_GUIDE.md §2-3:
 *   - Tags per paragraph: 2-6
 *   - Tag density: ≤ 1 tag per 30 chars
 *
 * Renderer collapses '\n\n' → ' ' (template-engine.ts:713 plainTextFromTokens),
 * so each `paragraphs[i]` from the tiered matrix output renders as a single
 * prose paragraph for tag-density purposes. We therefore count tags and chars
 * over the rendered plainText (not over template-level '\n\n' splits).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.resolve(__dirname, '../sample-outputs-2026-05-05-phase3');
const OUT_FILE = path.resolve(__dirname, 'tag-density-distribution.json');

const sampleFiles = fs
  .readdirSync(SAMPLES_DIR)
  .filter((name) => /^\d{2}-.*\.json$/.test(name))
  .sort();

function reconstructPlainText(tokens) {
  // Mirror plainTextFromTokens (template-engine.ts:696-713): collapse \n\n → ' '
  // We reconstruct the same way the renderer does so character counts agree.
  let out = '';
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (tok.kind === 'text') {
      out += tok.value;
      continue;
    }
    if (out && !/\s$/u.test(out)) out += ' ';
    out += `#${tok.label}`;
    const next = tokens[i + 1];
    if (next?.kind === 'text' && next.value && !/^(은|는|이|가|을|를|의|도|만|부터|까지|처럼|보다|으로|로|에서|에게|께|와|과|이나|나|이라|라|이에요|예요|입니다|입니다만|,|\.|!|\?|\)|\])/u.test(next.value.trimStart())) {
      out += ' ';
    }
  }
  return out.replace(/\s{2,}/g, ' ');
}

function countTags(tokens) {
  return tokens.filter((t) => t?.kind === 'tag').length;
}

const all = [];
const violations = [];
const closerTagPairs = new Map(); // pairKey -> [{ fixture, period, category, fragmentId }]

for (const file of sampleFiles) {
  const full = path.join(SAMPLES_DIR, file);
  const data = JSON.parse(fs.readFileSync(full, 'utf-8'));
  const matrix = data?.payload?.tieredMatrix;
  if (!matrix?.periods) continue;
  for (const [period, periodObj] of Object.entries(matrix.periods)) {
    const byCategory = periodObj?.byCategory ?? {};
    for (const [category, catObj] of Object.entries(byCategory)) {
      const expert = catObj?.expert;
      if (!expert?.paragraphs) continue;
      for (let pIdx = 0; pIdx < expert.paragraphs.length; pIdx += 1) {
        const para = expert.paragraphs[pIdx];
        const tokens = para?.tokens ?? [];
        const tagCount = countTags(tokens);
        const text = reconstructPlainText(tokens);
        const charCount = text.length;
        const densityPer30 = charCount > 0 ? (tagCount / charCount) * 30 : 0;
        const record = {
          fixture: file,
          period,
          category,
          paragraphIdx: pIdx,
          tagCount,
          charCount,
          densityPer30: Number(densityPer30.toFixed(3)),
          excessByCount: tagCount > 6 ? tagCount - 6 : 0,
          excessByDensity: densityPer30 > 1 ? Number((densityPer30 - 1).toFixed(3)) : 0,
        };
        all.push(record);
        if (record.excessByCount > 0 || record.excessByDensity > 0) {
          violations.push({ ...record, plainText: text });
        }

        // Track last-2-tag closer pair for diversity audit (P7-A4 closer is final 2 tags).
        const tagTokens = tokens.filter((t) => t?.kind === 'tag');
        if (tagTokens.length >= 2) {
          const last2 = tagTokens.slice(-2).map((t) => t.tagId).join('+');
          if (!closerTagPairs.has(last2)) closerTagPairs.set(last2, []);
          closerTagPairs.get(last2).push({ fixture: file, period, category, paragraphIdx: pIdx });
        }
      }
    }
  }
}

// Distribution summary
const histogram = {};
for (const r of all) {
  const bucket = r.tagCount;
  histogram[bucket] = (histogram[bucket] ?? 0) + 1;
}
const charBucket = (n) => {
  if (n < 100) return '<100';
  if (n < 150) return '100-149';
  if (n < 200) return '150-199';
  if (n < 250) return '200-249';
  if (n < 300) return '250-299';
  return '300+';
};
const byCharBucket = {};
for (const r of all) {
  const b = charBucket(r.charCount);
  byCharBucket[b] = (byCharBucket[b] ?? 0) + 1;
}

// Closer diversity per (category, period)
const closerByCellGroup = new Map(); // category -> { closer -> count }
for (const [closer, hits] of closerTagPairs.entries()) {
  for (const h of hits) {
    if (!closerByCellGroup.has(h.category)) closerByCellGroup.set(h.category, new Map());
    const m = closerByCellGroup.get(h.category);
    m.set(closer, (m.get(closer) ?? 0) + 1);
  }
}
const closerDiversityByCategory = {};
for (const [cat, m] of closerByCellGroup.entries()) {
  const entries = [...m.entries()]
    .map(([closer, count]) => ({ closer, count }))
    .sort((a, b) => b.count - a.count);
  closerDiversityByCategory[cat] = {
    uniqueClosers: entries.length,
    total: entries.reduce((s, e) => s + e.count, 0),
    distribution: entries,
  };
}

const out = {
  generatedAt: new Date().toISOString(),
  fixtureCount: sampleFiles.length,
  paragraphCount: all.length,
  violationCount: violations.length,
  byTagCount: histogram,
  byCharCount: byCharBucket,
  closerDiversityByCategory,
  violations,
};

fs.writeFileSync(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`, 'utf-8');
console.log(`Wrote ${OUT_FILE}`);
console.log(`Fixtures: ${sampleFiles.length}, paragraphs: ${all.length}, violations: ${violations.length}`);
console.log('Tag count histogram:', histogram);
