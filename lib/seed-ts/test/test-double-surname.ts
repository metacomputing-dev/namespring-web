/**
 * 복성(제갈) 테스트 스크립트
 * npx tsx test/test-double-surname.ts
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
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404, statusText: `Not found: ${filePath}` });
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
  console.log('=== 복성 테스트: 제갈__ (1990-07-15 10:30 male) ===\n');

  // 1. 제갈__ 추천
  console.log('1. [생성-추천] 제갈__ (top 20)');
  const result = await engine.analyze({
    birth,
    surname: [{ hangul: '제', hanja: '諸' }, { hangul: '갈', hanja: '葛' }],
    givenNameLength: 2,
    mode: 'recommend',
    options: { limit: 20 },
  });

  console.log(`   총 후보 수: ${result.totalCount}`);
  console.log(`   사주 용신: ${result.saju.yongshin?.element}, 희신: ${result.saju.yongshin?.heeshin}`);
  console.log(`   일주: ${result.saju.dayMaster?.stem}(${result.saju.dayMaster?.element}/${result.saju.dayMaster?.polarity})`);
  console.log(`   결핍오행: ${JSON.stringify(result.saju.deficientElements)}`);
  console.log(`   과다오행: ${JSON.stringify(result.saju.excessiveElements)}`);
  console.log('');

  for (let i = 0; i < Math.min(20, result.candidates.length); i++) {
    const c = result.candidates[i];
    const name = `${c.name.fullHangul}(${c.name.fullHanja})`;
    const els = c.name.givenName.map(g => g.element).join(',');
    console.log(`   ${(i+1).toString().padStart(2)}. ${name.padEnd(22)} 종합:${String(c.scores.total).padStart(5)}  한글:${String(c.scores.hangul).padStart(5)}  한자:${String(c.scores.hanja).padStart(5)}  사격:${String(c.scores.fourFrame).padStart(5)}  사주:${String(c.scores.saju).padStart(5)}  자원: ${els}`);
  }

  // 2. 제갈공명 평가
  console.log('\n2. [평가] 제갈공명');
  const evalResult = await engine.analyze({
    birth,
    surname: [{ hangul: '제', hanja: '諸' }, { hangul: '갈', hanja: '葛' }],
    givenName: [{ hangul: '공', hanja: '孔' }, { hangul: '명', hanja: '明' }],
    mode: 'evaluate',
  });
  if (evalResult.candidates.length > 0) {
    const c = evalResult.candidates[0];
    console.log(`   이름: ${c.name.fullHangul}(${c.name.fullHanja})`);
    console.log(`   종합: ${c.scores.total}  한글: ${c.scores.hangul}  한자: ${c.scores.hanja}  사격: ${c.scores.fourFrame}  사주: ${c.scores.saju}`);
    console.log(`   해석: ${c.interpretation}`);
    console.log(`   성씨 자원: ${c.name.surname.map(s => `${s.hangul}(${s.hanja},${s.element},${s.strokes}획)`).join(' ')}`);
    console.log(`   이름 자원: ${c.name.givenName.map(g => `${g.hangul}(${g.hanja},${g.element},${g.strokes}획)`).join(' ')}`);
  }
} finally {
  engine.close();
}
