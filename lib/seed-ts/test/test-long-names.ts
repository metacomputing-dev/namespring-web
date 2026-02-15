/**
 * 긴 이름 테스트 (이름 4자, 5자)
 * npx tsx test/test-long-names.ts
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

function printCandidate(label: string, c: any) {
  console.log(`\n   [${label}]`);
  console.log(`   이름: ${c.name.fullHangul}(${c.name.fullHanja})`);
  console.log(`   종합: ${c.scores.total}  한글: ${c.scores.hangul}  한자: ${c.scores.hanja}  사격: ${c.scores.fourFrame}  사주: ${c.scores.saju}`);
  console.log(`   해석: ${c.interpretation}`);
  console.log(`   성씨: ${c.name.surname.map((s: any) => `${s.hangul}(${s.hanja},${s.element},${s.strokes}획)`).join(' ')}`);
  console.log(`   이름: ${c.name.givenName.map((g: any) => `${g.hangul}(${g.hanja},${g.element},${g.strokes}획)`).join(' ')}`);
  console.log(`   한글분석: blocks=${c.analysis.hangul.blocks.length}, polarity=${c.analysis.hangul.polarityScore}, element=${c.analysis.hangul.elementScore}`);
  console.log(`   한자분석: blocks=${c.analysis.hanja.blocks.length}`);
  console.log(`   사격분석: frames=${c.analysis.fourFrame.frames.length}, types=${c.analysis.fourFrame.frames.map((f: any) => f.type).join(',')}`);
  console.log(`   사주분석: yongshin=${c.analysis.saju.yongshinElement}, nameEls=${JSON.stringify(c.analysis.saju.nameElements)}, affinity=${c.analysis.saju.affinityScore}`);
}

const birth = { year: 1990, month: 7, day: 15, hour: 10, minute: 30, gender: 'male' as const };

try {
  console.log('=== 긴 이름 테스트 ===\n');

  // 1. 제갈공명천재 (복성2 + 이름4)
  console.log('1. 제갈공명천재 (복성 2자 + 이름 4자 = 총 6자)');
  try {
    const r1 = await engine.analyze({
      birth,
      surname: [{ hangul: '제', hanja: '諸' }, { hangul: '갈', hanja: '葛' }],
      givenName: [
        { hangul: '공', hanja: '孔' }, { hangul: '명', hanja: '明' },
        { hangul: '천', hanja: '天' }, { hangul: '재', hanja: '才' },
      ],
      mode: 'evaluate',
    });
    if (r1.candidates.length > 0) printCandidate('제갈공명천재', r1.candidates[0]);
    else console.log('   ❌ 후보 없음');
  } catch (e: any) {
    console.log(`   ❌ ERROR: ${e.message}`);
    console.log(`   ${e.stack?.split('\n').slice(0, 3).join('\n   ')}`);
  }

  // 2. 최공명천재왕 (단성1 + 이름5)
  console.log('\n2. 최공명천재왕 (단성 1자 + 이름 5자 = 총 6자)');
  try {
    const r2 = await engine.analyze({
      birth,
      surname: [{ hangul: '최', hanja: '崔' }],
      givenName: [
        { hangul: '공', hanja: '孔' }, { hangul: '명', hanja: '明' },
        { hangul: '천', hanja: '天' }, { hangul: '재', hanja: '才' },
        { hangul: '왕', hanja: '王' },
      ],
      mode: 'evaluate',
    });
    if (r2.candidates.length > 0) printCandidate('최공명천재왕', r2.candidates[0]);
    else console.log('   ❌ 후보 없음');
  } catch (e: any) {
    console.log(`   ❌ ERROR: ${e.message}`);
    console.log(`   ${e.stack?.split('\n').slice(0, 3).join('\n   ')}`);
  }

  console.log('\n=== DONE ===');
} finally {
  engine.close();
}
