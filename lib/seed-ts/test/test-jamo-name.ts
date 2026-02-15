/**
 * 자모/부분 입력 기반 이름 추천 테스트
 * npx tsx test/test-jamo-name.ts
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

async function testRecommend(label: string, surname: any[], givenName: any[], limit = 10) {
  console.log(`\n${label}`);
  console.log(`   input: ${surname.map((s: any) => s.hangul).join('')}${givenName.map((g: any) => g.hangul).join('')}`);
  try {
    const r = await engine.analyze({ birth, surname, givenName, mode: 'recommend', options: { limit } });
    console.log(`   총 후보: ${r.totalCount}개`);
    for (let i = 0; i < Math.min(limit, r.candidates.length); i++) {
      const c = r.candidates[i];
      console.log(`   ${(i+1).toString().padStart(2)}. ${c.name.fullHangul}(${c.name.fullHanja})  종합:${String(c.scores.total).padStart(5)}  자원: ${c.name.givenName.map((g: any) => `${g.hangul}(${g.element})`).join(',')}`);
    }
    if (r.candidates.length === 0) console.log('   ❌ 후보 0개');
  } catch (e: any) {
    console.log(`   ❌ ERROR: ${e.message}`);
  }
}

try {
  console.log('=== 자모/부분 입력 기반 이름 추천 테스트 ===');

  // 1. 최ㅣㅁ — 중성ㅣ + 초성ㅁ
  await testRecommend(
    '1. 최ㅣㅁ (중성ㅣ + 초성ㅁ)',
    [{ hangul: '최', hanja: '崔' }],
    [{ hangul: 'ㅣ' }, { hangul: 'ㅁ' }]
  );

  // 2. 최ㅁㅣ — 초성ㅁ + 중성ㅣ
  await testRecommend(
    '2. 최ㅁㅣ (초성ㅁ + 중성ㅣ)',
    [{ hangul: '최', hanja: '崔' }],
    [{ hangul: 'ㅁ' }, { hangul: 'ㅣ' }]
  );

  // 3. 최미_ — 개음절(미) + 아무거나
  await testRecommend(
    '3. 최미_ (개음절 미 = ㅁ+ㅣ필터, 2번째 자유)',
    [{ hangul: '최', hanja: '崔' }],
    [{ hangul: '미' }, { hangul: '' }]
  );

  // 4. 최ㅎ — 초성ㅎ 1글자 이름
  await testRecommend(
    '4. 최ㅎ (초성ㅎ, 1글자 이름)',
    [{ hangul: '최', hanja: '崔' }],
    [{ hangul: 'ㅎ' }]
  );

  // 5. 제갈ㅁㅁ — 복성 + 초성필터 2개
  await testRecommend(
    '5. 제갈ㅁㅁ (복성 + 초성ㅁ+초성ㅁ)',
    [{ hangul: '제', hanja: '諸' }, { hangul: '갈', hanja: '葛' }],
    [{ hangul: 'ㅁ' }, { hangul: 'ㅁ' }]
  );

  // 6. 최__ — 빈값 2개 (제약 없음, 기존 추천과 동일해야 함)
  await testRecommend(
    '6. 최__ (빈값 2개 = 제약 없음)',
    [{ hangul: '최', hanja: '崔' }],
    [{ hangul: '' }, { hangul: '' }]
  );

  console.log('\n=== DONE ===');
} finally {
  engine.close();
}
