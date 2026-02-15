/**
 * spring-ts 작명 비교 테스트
 * 과거 seed-ts baseline과 동일한 입력으로 SpringEngine을 실행.
 * - 이름(한글/한자/사격수리) 점수는 baseline과 정확히 일치해야 한다
 * - 사주 점수는 saju-ts 서브모듈 업데이트로 변경될 수 있어 별도 리포트
 *
 * npx tsx test/compare-output.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../../namespring/public/data');
const WASM_PATH = path.resolve(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm');

// ── Patch fetch() for Node.js file system access ──
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

import { SpringEngine } from '../src/spring-engine.js';

// ── Load baseline ──
const baseline = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'baseline.json'), 'utf-8'));

const birth = { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const };

const engine = new SpringEngine();
const repos = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const r of repos) if (r) (r as any).wasmUrl = WASM_PATH;

let pass = 0;
let fail = 0;
let sajuDiff = 0;

function assertEqual(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++;
  } else {
    fail++;
    console.log(`  FAIL  ${label}`);
    console.log(`        expected: ${JSON.stringify(expected)}`);
    console.log(`        actual:   ${JSON.stringify(actual)}`);
  }
}

function assertClose(label: string, actual: number, expected: number, tolerance = 0.15) {
  if (Math.abs(actual - expected) <= tolerance) {
    pass++;
  } else {
    fail++;
    console.log(`  FAIL  ${label}`);
    console.log(`        expected: ${expected} (+-${tolerance})`);
    console.log(`        actual:   ${actual} (diff=${Math.abs(actual - expected).toFixed(3)})`);
  }
}

function reportSaju(label: string, actual: number, expected: number) {
  const diff = Math.abs(actual - expected);
  if (diff > 0.15) sajuDiff++;
  const tag = diff <= 0.15 ? 'SAME' : 'DIFF';
  console.log(`  ${tag}  ${label}: ${actual} (baseline: ${expected}, diff=${diff.toFixed(1)})`);
}

try {
  console.log('=== spring-ts 작명 비교 테스트 ===\n');
  console.log('NOTE: saju-ts가 15커밋 업데이트됨 → 사주 점수 차이는 예상됨\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. 최성수 평가 (evaluate)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('1. [평가] 최성수 (1986-04-19 05:45)');
  const evalResult = await engine.analyze({
    birth,
    surname: [{ hangul: '최', hanja: '崔' }],
    givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
    mode: 'evaluate',
  });

  const evalC = evalResult.candidates[0];
  const baseEval = baseline.evaluate;

  // 이름 정보 (must match exactly)
  assertEqual('eval.name.fullHangul', evalC.name.fullHangul, baseEval.name.fullHangul);
  assertEqual('eval.name.fullHanja', evalC.name.fullHanja, baseEval.name.fullHanja);

  // 성씨/이름 자원 (must match exactly)
  assertEqual('eval.surname[0].element', evalC.name.surname[0].element, baseEval.name.surname[0].element);
  assertEqual('eval.surname[0].strokes', evalC.name.surname[0].strokes, baseEval.name.surname[0].strokes);
  for (let i = 0; i < evalC.name.givenName.length; i++) {
    assertEqual(`eval.givenName[${i}].element`, evalC.name.givenName[i].element, baseEval.name.givenName[i].element);
    assertEqual(`eval.givenName[${i}].strokes`, evalC.name.givenName[i].strokes, baseEval.name.givenName[i].strokes);
    assertEqual(`eval.givenName[${i}].meaning`, evalC.name.givenName[i].meaning, baseEval.name.givenName[i].meaning);
  }

  // 이름 점수 (한글/한자/사격 — must match exactly)
  assertClose('eval.scores.hangul', evalC.scores.hangul, baseEval.scores.hangul);
  assertClose('eval.scores.hanja', evalC.scores.hanja, baseEval.scores.hanja);
  assertClose('eval.scores.fourFrame', evalC.scores.fourFrame, baseEval.scores.fourFrame);

  // 한글 분석
  assertEqual('eval.hangul.blocks.length', evalC.analysis.hangul.blocks.length, baseEval.analysis.hangul.blocks.length);
  assertClose('eval.hangul.polarityScore', evalC.analysis.hangul.polarityScore, baseEval.analysis.hangul.polarityScore);
  assertClose('eval.hangul.elementScore', evalC.analysis.hangul.elementScore, baseEval.analysis.hangul.elementScore);

  // 사주 점수 (saju-ts 변경으로 차이 예상 — report only)
  console.log('');
  reportSaju('eval.scores.saju', evalC.scores.saju, baseEval.scores.saju);
  reportSaju('eval.scores.total', evalC.scores.total, baseEval.scores.total);

  console.log(`\n   종합: ${evalC.scores.total} (baseline: ${baseEval.scores.total})`);
  console.log(`   한글: ${evalC.scores.hangul} (baseline: ${baseEval.scores.hangul})`);
  console.log(`   한자: ${evalC.scores.hanja} (baseline: ${baseEval.scores.hanja})`);
  console.log(`   사격: ${evalC.scores.fourFrame} (baseline: ${baseEval.scores.fourFrame})`);
  console.log(`   사주: ${evalC.scores.saju} (baseline: ${baseEval.scores.saju})`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. 최__ 추천 (recommend)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n2. [추천] 최__ (1986-04-19 05:45, top 20)');
  const recResult = await engine.analyze({
    birth,
    surname: [{ hangul: '최', hanja: '崔' }],
    givenNameLength: 2,
    mode: 'recommend',
    options: { limit: 20 },
  });

  const baseRec = baseline.searchRecommend;

  // 총 후보 수
  assertClose('rec.totalCount', recResult.totalCount, baseRec.totalCount, 50);
  console.log(`   총 후보: ${recResult.totalCount} (baseline: ${baseRec.totalCount})`);

  // top 20 출력
  console.log('');
  const baseMap = new Map<string, any>();
  for (const c of baseRec.top20) baseMap.set(c.hanja, c);
  let nameMatchCount = 0;
  let nameScoreMatch = 0;

  for (let i = 0; i < recResult.candidates.length && i < 20; i++) {
    const c = recResult.candidates[i];
    const bm = baseMap.get(c.name.fullHanja);
    const matchTag = bm ? '  ' : '* ';
    console.log(`   ${matchTag}${String(i + 1).padStart(2)}. ${c.name.fullHangul}(${c.name.fullHanja}) total=${c.scores.total} hangul=${c.scores.hangul} hanja=${c.scores.hanja} fourFrame=${c.scores.fourFrame} saju=${c.scores.saju}`);

    if (bm) {
      nameMatchCount++;
      // 이름 점수(한글/한자/사격)만 exact match 검증
      const hOk = Math.abs(c.scores.hangul - bm.scores.hangul) <= 0.15;
      const jOk = Math.abs(c.scores.hanja - bm.scores.hanja) <= 0.15;
      const fOk = Math.abs(c.scores.fourFrame - bm.scores.fourFrame) <= 0.15;
      if (hOk && jOk && fOk) {
        nameScoreMatch++;
        pass++;
      } else {
        fail++;
        console.log(`     FAIL name scores diff: hangul=${c.scores.hangul}/${bm.scores.hangul} hanja=${c.scores.hanja}/${bm.scores.hanja} fourFrame=${c.scores.fourFrame}/${bm.scores.fourFrame}`);
      }
    }
  }
  console.log(`\n   baseline에 있는 이름 겹침: ${nameMatchCount}/20`);
  console.log(`   겹치는 이름 중 이름점수 일치: ${nameScoreMatch}/${nameMatchCount}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. 복성 제갈__ 추천
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n3. [복성] 제갈__ (1990-07-15 10:30 male)');
  const dsBirth = { year: 1990, month: 7, day: 15, hour: 10, minute: 30, gender: 'male' as const };
  const dsResult = await engine.analyze({
    birth: dsBirth,
    surname: [{ hangul: '제', hanja: '諸' }, { hangul: '갈', hanja: '葛' }],
    givenNameLength: 2,
    mode: 'recommend',
    options: { limit: 10 },
  });

  console.log(`   총 후보: ${dsResult.totalCount}`);
  const dsOk = dsResult.totalCount > 0 && dsResult.candidates.length > 0;
  if (dsOk) pass++; else fail++;
  console.log(`   ${dsOk ? 'PASS' : 'FAIL'} 복성 후보 생성됨`);

  for (let i = 0; i < Math.min(5, dsResult.candidates.length); i++) {
    const c = dsResult.candidates[i];
    console.log(`   ${String(i + 1).padStart(2)}. ${c.name.fullHangul}(${c.name.fullHanja}) total=${c.scores.total} hangul=${c.scores.hangul} hanja=${c.scores.hanja} saju=${c.scores.saju}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. 제갈공명 평가
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n4. [복성평가] 제갈공명');
  const dsEval = await engine.analyze({
    birth: dsBirth,
    surname: [{ hangul: '제', hanja: '諸' }, { hangul: '갈', hanja: '葛' }],
    givenName: [{ hangul: '공', hanja: '孔' }, { hangul: '명', hanja: '明' }],
    mode: 'evaluate',
  });

  const dsC = dsEval.candidates[0];
  const dsEvalOk = dsC && dsC.scores.total > 0 && dsC.name.fullHangul === '제갈공명';
  if (dsEvalOk) pass++; else fail++;
  console.log(`   ${dsEvalOk ? 'PASS' : 'FAIL'} 제갈공명 평가`);
  if (dsC) {
    console.log(`   종합: ${dsC.scores.total} 한글: ${dsC.scores.hangul} 한자: ${dsC.scores.hanja} 사격: ${dsC.scores.fourFrame} 사주: ${dsC.scores.saju}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. 긴 이름 (4자)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n5. [긴이름] 제갈공명천재 (복성2 + 이름4)');
  try {
    const longResult = await engine.analyze({
      birth: dsBirth,
      surname: [{ hangul: '제', hanja: '諸' }, { hangul: '갈', hanja: '葛' }],
      givenName: [
        { hangul: '공', hanja: '孔' }, { hangul: '명', hanja: '明' },
        { hangul: '천', hanja: '天' }, { hangul: '재', hanja: '才' },
      ],
      mode: 'evaluate',
    });
    const longOk = longResult.candidates.length > 0 && longResult.candidates[0].scores.total > 0;
    if (longOk) pass++; else fail++;
    console.log(`   ${longOk ? 'PASS' : 'FAIL'} 긴 이름 평가`);
    if (longResult.candidates[0]) {
      const c = longResult.candidates[0];
      console.log(`   종합: ${c.scores.total} 한글: ${c.scores.hangul} 한자: ${c.scores.hanja} 사격: ${c.scores.fourFrame} 사주: ${c.scores.saju}`);
    }
  } catch (e: any) {
    fail++;
    console.log(`   FAIL  에러: ${e.message}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. 사주 데이터 구조 검증
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n6. [사주데이터] 구조 검증');
  const s = evalResult.saju;
  const checks: [string, boolean][] = [
    ['pillars.year defined', !!s.pillars?.year?.stem?.code],
    ['pillars.month defined', !!s.pillars?.month?.stem?.code],
    ['pillars.day defined', !!s.pillars?.day?.stem?.code],
    ['pillars.hour defined', !!s.pillars?.hour?.stem?.code],
    ['dayMaster.element exists', !!s.dayMaster?.element],
    ['strength.level exists', !!s.strength?.level],
    ['yongshin.element exists', !!s.yongshin?.element],
    ['ohaengDistribution exists', !!s.ohaengDistribution && Object.keys(s.ohaengDistribution).length > 0],
    ['timeCorrection exists', !!s.timeCorrection],
  ];

  for (const [label, ok] of checks) {
    if (ok) pass++; else fail++;
    console.log(`   ${ok ? 'PASS' : 'FAIL'} ${label}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Summary
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n' + '='.repeat(55));
  console.log(`  PASS: ${pass}  FAIL: ${fail}  TOTAL: ${pass + fail}`);
  console.log(`  saju-ts 변경으로 인한 사주 점수 차이: ${sajuDiff}건`);
  console.log('='.repeat(55));

  if (fail > 0) process.exit(1);

} finally {
  engine.close();
}
