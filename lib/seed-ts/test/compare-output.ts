/**
 * namesprint-w 비교 테스트 스크립트
 * 최성수 평가 + 최__ 이름 생성
 * Birth: 1986-04-19 05:45
 *
 * tsx로 실행: npx tsx test/compare-output.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../../namespring/public/data');
const SEED_TS_DIR = path.resolve(__dirname, '..');
const WASM_PATH = path.resolve(SEED_TS_DIR, 'node_modules/sql.js/dist/sql-wasm.wasm');

// ── Patch fetch() for Node.js file system access ──
const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string | URL | Request, options?: any) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  // Handle DB file fetches
  if (urlStr.startsWith('/data/')) {
    const filePath = path.join(DATA_DIR, urlStr.replace('/data/', ''));
    if (!fs.existsSync(filePath)) {
      return new Response(null, { status: 404, statusText: `Not found: ${filePath}` });
    }
    const data = fs.readFileSync(filePath);
    return new Response(data, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } });
  }
  return originalFetch(url as any, options);
};

// ── Import seed-ts ──
import { SeedEngine } from '../src/calculator/engine.js';

const birth = { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const };

console.log('=== namesprint-w seed-ts 비교 테스트 ===\n');

const engine = new SeedEngine();

// ── Monkey-patch WASM URL to local file path (before init) ──
const repos = [
  (engine as any).hanjaRepo,
  (engine as any).fourFrameRepo,
  (engine as any).nameStatRepo,
];
for (const repo of repos) {
  if (repo && typeof repo === 'object') {
    (repo as any).wasmUrl = WASM_PATH;
  }
}

try {
  // 1. 최성수 평가
  console.log('1. [평가] 최성수 (1986-04-19 05:45)');
  const evalResult = await engine.analyze({
    birth,
    surname: [{ hangul: '최', hanja: '崔' }],
    givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
    mode: 'evaluate',
  });

  if (evalResult.candidates.length > 0) {
    const c = evalResult.candidates[0];
    console.log(`   종합점수: ${c.scores.total}`);
    console.log(`   한글(음령): ${c.scores.hangul}`);
    console.log(`   한자(자원): ${c.scores.hanja}`);
    console.log(`   사격수리: ${c.scores.fourFrame}`);
    console.log(`   사주균형: ${c.scores.saju}`);
    console.log(`   해석: ${c.interpretation}`);
  }

  // 2. 최__ 이름 생성 (recommend)
  console.log('\n2. [생성-추천] 최__ (1986-04-19 05:45, top 20)');
  const searchRecommend = await engine.analyze({
    birth,
    surname: [{ hangul: '최', hanja: '崔' }],
    givenNameLength: 2,
    mode: 'recommend',
    options: { limit: 20 },
  });
  console.log(`   총 후보 수: ${searchRecommend.totalCount}`);
  for (let i = 0; i < Math.min(20, searchRecommend.candidates.length); i++) {
    const c = searchRecommend.candidates[i];
    const name = `${c.name.fullHangul}(${c.name.fullHanja})`;
    console.log(`   ${(i + 1).toString().padStart(2)}. ${name} — 종합: ${c.scores.total} 한글: ${c.scores.hangul} 한자: ${c.scores.hanja} 사격: ${c.scores.fourFrame} 사주: ${c.scores.saju}`);
  }

  // 3. 최__ 이름 생성 (all — same as recommend since no givenName provided)
  console.log('\n3. [생성-전체] 최__ (1986-04-19 05:45, top 20)');
  const searchAll = await engine.analyze({
    birth,
    surname: [{ hangul: '최', hanja: '崔' }],
    givenNameLength: 2,
    mode: 'all',
    options: { limit: 20 },
  });
  console.log(`   총 후보 수: ${searchAll.totalCount}`);
  for (let i = 0; i < Math.min(20, searchAll.candidates.length); i++) {
    const c = searchAll.candidates[i];
    const name = `${c.name.fullHangul}(${c.name.fullHanja})`;
    console.log(`   ${(i + 1).toString().padStart(2)}. ${name} — 종합: ${c.scores.total} 한글: ${c.scores.hangul} 한자: ${c.scores.hanja} 사격: ${c.scores.fourFrame} 사주: ${c.scores.saju}`);
  }

  // Save JSON
  const output = {
    project: 'namesprint-w',
    timestamp: new Date().toISOString(),
    birthInfo: birth,
    evaluate: evalResult.candidates.length > 0 ? {
      name: evalResult.candidates[0].name,
      scores: evalResult.candidates[0].scores,
      analysis: evalResult.candidates[0].analysis,
      interpretation: evalResult.candidates[0].interpretation,
    } : null,
    searchRecommend: {
      totalCount: searchRecommend.totalCount,
      top20: searchRecommend.candidates.slice(0, 20).map(c => ({
        name: c.name.fullHangul,
        hanja: c.name.fullHanja,
        scores: c.scores,
        interpretation: c.interpretation,
      })),
    },
    searchAll: {
      totalCount: searchAll.totalCount,
      top20: searchAll.candidates.slice(0, 20).map(c => ({
        name: c.name.fullHangul,
        hanja: c.name.fullHanja,
        scores: c.scores,
        interpretation: c.interpretation,
      })),
    },
    saju: evalResult.saju,
  };

  const outPath = path.resolve(__dirname, 'compare-output-namesprint-w.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n결과 저장: ${outPath}`);

} finally {
  engine.close();
}
