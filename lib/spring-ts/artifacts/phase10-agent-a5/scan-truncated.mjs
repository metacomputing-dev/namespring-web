#!/usr/bin/env node
// Look for truncated/broken Korean endings - noun directly followed by 요.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NARRATIVE_ROOT = path.resolve(__dirname, '..', '..', 'data', 'narrative');

function* walkJsonFiles(dir, root = '') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const f = path.join(dir, e.name);
    const r = path.join(root, e.name);
    if (e.isDirectory()) yield* walkJsonFiles(f, r);
    else if (e.name.endsWith('.json')) yield { full: f, rel: r };
  }
}

function* walkText(node, trail) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) yield* walkText(node[i], [...trail, i]);
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    if ((k === 'value' || k === 'headline') && typeof v === 'string') {
      yield { trail: [...trail, k], text: v };
    }
    yield* walkText(v, [...trail, k]);
  }
}

const SCOPE = ['_coverage', 'overall', 'career', 'wealth', 'health', 'health_stress', 'romance', 'family', 'academic', 'study_document', 'expression_children', 'movement'];

// Common Korean noun-ish endings that should NOT be followed by 요.
// Valid: 자리예요, 시기예요, 흐름이에요, 자산이에요...
// Invalid: 컨디션요. (noun + 요. = broken)
// Pattern: [가-힣]+ ending in non-vowel-ending or non-copula syllable, then 요.
// Easy heuristic: noun stem ending in 받침 (jongseong) directly followed by 요. (no 이에/예/이/예요)

const INVALID_NOUN_RYO_RE = /[가-힣][ㄱ-ㅎ가-힣]?[가-힣]요\.[\s\n]?/u;

// More specific: typical broken patterns
// Korean valid endings: 이에요/예요/돼요/해요/와요/가요/봐요/네요/아요/어요/지요/죠/군요/니다.
// After a NOUN (jongseong-ending or vowel-ending), must be 이에요/예요. Bare 요 is invalid.
// After a VERB stem, valid endings differ but most have ~아요/~어요/~해요/~돼요 etc.
// Catch: word boundary, then NOUN-like, then 요. (no preceding 아/어/해/돼/이에 etc)

const BROKEN_PATTERNS = [
  // Common nouns that should have 이에요/예요 after, not bare 요
  /(?:컨디션|상태|관계|약속|회복|친구|가족|책임|감정|일정|결정|운동|식사|동료|이슈|경험|능력|수입|지출|분야|환경|일과|음식|역할|시간|관점|생각|기준|노력|조심|중심|성장|시점|모습|반복|학교|회사|습관|관리|건강|평소|기억|단계|기회|선택|판단)요\./u,
  // Verb stem with 1 char ending - very suspicious. e.g. "정요" (정해요 truncated), "쉬요" (쉬어요), "좋요" (좋아요)
  // Match bare 1-char hangul + 요. that doesn't fit known patterns.
  // Whitelist: '와요', '가요', '봐요', '돼요', '해요', '예요', '네요', '뿐요?' nope, '잖요?' nope
  // Match suspicious: '정요.', '쉬요.', '좋요.', '읽요.', '듣요.', '먹요.'
  /(?<![가-힣])(?:정|쉬|좋|읽|듣|먹|많|적|크|작|빠|늦|넓|좁|짧|길|밝|어둡|약|강|무겁|가볍|뜨겁|차갑)요\./u,
];

const records = [];
let filesScanned = 0;

for (const top of SCOPE) {
  const dir = path.join(NARRATIVE_ROOT, top);
  if (!fs.existsSync(dir)) continue;
  for (const file of walkJsonFiles(dir, top)) {
    filesScanned++;
    let data;
    try { data = JSON.parse(fs.readFileSync(file.full, 'utf8')); }
    catch { continue; }
    for (const item of walkText(data, [])) {
      const text = item.text;
      for (const re of BROKEN_PATTERNS) {
        const m = text.match(re);
        if (m) {
          records.push({
            file: file.rel,
            trail: item.trail.join('.'),
            match: m[0],
            text,
          });
        }
      }
    }
  }
}

const out = path.join(__dirname, 'truncated-endings.json');
fs.writeFileSync(out, JSON.stringify({ filesScanned, count: records.length, records }, null, 2));

console.log(`Files scanned: ${filesScanned}`);
console.log(`Truncated endings: ${records.length}`);
records.forEach(r => {
  console.log(`  [${r.file}] match="${r.match}"`);
  console.log(`    text="${r.text}"`);
});
console.log(`\noutput: ${out}`);
