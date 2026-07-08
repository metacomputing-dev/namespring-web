/**
 * test/integration/adapter-yinyang.test.ts
 *
 * PR-12-4 (감사 C6) — 음양 균형이 springLegacy → saju-adapter를 거쳐
 * SajuSummary.yinYangBalance로 도달하는지 검증 (5층 배선 exemplar).
 *
 * Run: npm run test:adapter-yinyang
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string | URL | Request, options?: any) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlStr.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlStr.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlStr.includes('sql-wasm.wasm') || urlStr === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  return originalFetch(url as any, options);
};

import { analyzeSaju } from '../../src/saju-adapter.js';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${detail ? ` (${detail})` : ''}`);
  }
}

// 1986-04-19 05:45 male — 丙寅 壬辰 己巳 丁卯: 음양 4:4 EVEN
const summary = await analyzeSaju({ year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' });
const yy: any = (summary as any).yinYangBalance;

check('SajuSummary.yinYangBalance가 존재한다', !!yy, JSON.stringify(yy));
check('천간 2:2', yy?.stems?.yang === 2 && yy?.stems?.yin === 2, JSON.stringify(yy?.stems));
check('지지(체 기준) 2:2', yy?.branches?.yang === 2 && yy?.branches?.yin === 2, JSON.stringify(yy?.branches));
check('합계 4:4 EVEN', yy?.yang === 4 && yy?.yin === 4 && yy?.dominant === 'EVEN', JSON.stringify(yy));
check('합은 항상 8', (yy?.yang ?? 0) + (yy?.yin ?? 0) === 8);

console.log(`\nAdapter yinyang: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
