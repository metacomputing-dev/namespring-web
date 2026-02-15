/**
 * 한글만 입력 (한자 없음) 테스트
 * npx tsx test/test-hangul-only.ts
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

function printResult(label: string, r: any) {
  if (r.candidates.length > 0) {
    const c = r.candidates[0];
    console.log(`   이름: ${c.name.fullHangul}(${c.name.fullHanja})`);
    console.log(`   종합: ${c.scores.total}  한글: ${c.scores.hangul}  한자: ${c.scores.hanja}  사격: ${c.scores.fourFrame}  사주: ${c.scores.saju}`);
    console.log(`   성씨: ${c.name.surname.map((s: any) => `${s.hangul}(${s.hanja},${s.element},${s.strokes}획)`).join(' ')}`);
    console.log(`   이름: ${c.name.givenName.map((g: any) => `${g.hangul}(${g.hanja},${g.element},${g.strokes}획)`).join(' ')}`);
    console.log(`   해석: ${c.interpretation}`);
  } else {
    console.log('   ❌ 후보 없음');
  }
}

try {
  console.log('=== 한글만 입력 테스트 (한자 없음) ===\n');

  // 1. 최임 (한글만)
  console.log('1. 최임 (단성1 + 이름1, 한자 없음)');
  try {
    const r = await engine.analyze({
      birth,
      surname: [{ hangul: '최' }],
      givenName: [{ hangul: '임' }],
      mode: 'evaluate',
    });
    printResult('최임', r);
  } catch (e: any) {
    console.log(`   ❌ ERROR: ${e.message}`);
    console.log(`   ${e.stack?.split('\n').slice(1, 4).join('\n   ')}`);
  }

  // 2. 최성수 (한글만)
  console.log('\n2. 최성수 (단성1 + 이름2, 한자 없음)');
  try {
    const r = await engine.analyze({
      birth,
      surname: [{ hangul: '최' }],
      givenName: [{ hangul: '성' }, { hangul: '수' }],
      mode: 'evaluate',
    });
    printResult('최성수', r);
  } catch (e: any) {
    console.log(`   ❌ ERROR: ${e.message}`);
    console.log(`   ${e.stack?.split('\n').slice(1, 4).join('\n   ')}`);
  }

  // 3. 제갈공명 (한글만, 복성)
  console.log('\n3. 제갈공명 (복성2 + 이름2, 한자 없음)');
  try {
    const r = await engine.analyze({
      birth,
      surname: [{ hangul: '제' }, { hangul: '갈' }],
      givenName: [{ hangul: '공' }, { hangul: '명' }],
      mode: 'evaluate',
    });
    printResult('제갈공명', r);
  } catch (e: any) {
    console.log(`   ❌ ERROR: ${e.message}`);
    console.log(`   ${e.stack?.split('\n').slice(1, 4).join('\n   ')}`);
  }

  console.log('\n=== DONE ===');
} finally {
  engine.close();
}
