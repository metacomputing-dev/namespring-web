/**
 * 5글자 이름 자모 필터 테스트: 최ㅁ_ㅣ순ㅇ
 * npx tsx test/test-5char-jamo.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../../namespring/public/data');
const WASM_PATH = path.resolve(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm');

const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string | URL | Request, options?: any) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlStr.startsWith('/data/')) {
    const filePath = path.join(DATA_DIR, urlStr.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  return originalFetch(url as any, options);
};

import { SeedEngine } from '../src/calculator/engine.js';

const engine = new SeedEngine();
const repos = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo, (engine as any).nameStatRepo];
for (const r of repos) if (r) (r as any).wasmUrl = WASM_PATH;

const birth = { year: 1990, month: 7, day: 15, hour: 10, minute: 30, gender: 'male' as const };

try {
  console.log('=== 5글자 이름 자모 필터 테스트: 최ㅁ_ㅣ순ㅇ ===\n');
  console.log('의도: 최 + [초성ㅁ][자유][중성ㅣ][순(폐음절)][초성ㅇ]\n');

  const r = await engine.analyze({
    birth,
    surname: [{ hangul: '최', hanja: '崔' }],
    givenName: [
      { hangul: 'ㅁ' },   // 초성 ㅁ 필터
      { hangul: '' },      // 자유 (빈값)
      { hangul: 'ㅣ' },   // 중성 ㅣ 필터
      { hangul: '순' },   // 폐음절 — 고정? 필터?
      { hangul: 'ㅇ' },   // 초성 ㅇ 필터
    ],
    mode: 'recommend',
    options: { limit: 20 },
  });

  console.log(`총 후보: ${r.totalCount}개`);
  console.log(`mode: ${r.mode}\n`);

  for (let i = 0; i < Math.min(20, r.candidates.length); i++) {
    const c = r.candidates[i];
    const detail = c.name.givenName.map((g: any) => `${g.hangul}(${g.hanja},${g.element},${g.strokes}획)`).join(' ');
    console.log(`${(i+1).toString().padStart(2)}. ${c.name.fullHangul}(${c.name.fullHanja})  종합:${String(c.scores.total).padStart(5)}  | ${detail}`);
  }

  if (r.candidates.length === 0) {
    console.log('❌ 후보 0개 — generateCandidates가 5글자를 지원하지 않을 수 있음');
  }

  console.log('\n=== DONE ===');
} finally {
  engine.close();
}
