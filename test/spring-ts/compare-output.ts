/**
 * spring-ts 작명 비교 테스트
 * 과거 seed-ts baseline과 동일한 입력으로 SpringEngine을 실행.
 * - 이름(한글/한자/사격수리) 점수는 baseline과 유사해야 한다
 * - 사주 점수는 saju-ts 서브모듈 업데이트로 변경될 수 있어 별도 리포트
 *
 * npx tsx test/spring/compare-output.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.resolve(PROJECT_ROOT, 'namespring/public/data');
const WASM_PATH = path.resolve(PROJECT_ROOT, 'namespring/node_modules/sql.js/dist/sql-wasm.wasm');

// ── Patch fetch() for Node.js file system access ──
const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string | URL | Request, options?: any) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlStr.startsWith('/data/')) {
    const filePath = path.join(DATA_DIR, urlStr.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404, statusText: `Not found: ${filePath}` });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlStr.includes('sql-wasm.wasm') || urlStr === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  return originalFetch(url as any, options);
};

import { SpringEngine } from '../../lib/spring-ts/src/spring-engine.js';

// ── Load baseline ──
const baseline = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'baseline.json'), 'utf-8'));

const birth = { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const };

const engine = new SpringEngine();

// ── Patch repository WASM paths for Node.js ──
const hanjaRepo = engine.getHanjaRepository();
(hanjaRepo as any).wasmUrl = WASM_PATH;
// Access fourFrameRepo via engine internals
const fourFrameRepo = (engine as any).fourFrameRepo;
if (fourFrameRepo) (fourFrameRepo as any).wasmUrl = WASM_PATH;

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

function assertClose(label: string, actual: number, expected: number, tolerance = 25) {
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
  if (diff > 2) sajuDiff++;
  const tag = diff <= 2 ? 'SAME' : 'DIFF';
  console.log(`  ${tag}  ${label}: ${actual} (baseline: ${expected}, diff=${diff.toFixed(1)})`);
}

try {
  console.log('=== spring-ts 작명 비교 테스트 ===\n');
  console.log('NOTE: spring-ts는 signal/evaluator 파이프라인 대신 직접 점수 합산을 사용.');
  console.log('      baseline과의 점수 차이는 scoring pipeline 차이로 예상됨.\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. 최성수 평가 (getNamingReport)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('1. [평가] 최성수 (1986-04-19 05:45) - getNamingReport');
  const namingReport = await engine.getNamingReport({
    birth,
    surname: [{ hangul: '최', hanja: '崔' }],
    givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
  });

  const baseEval = baseline.evaluate;

  // 이름 정보 (must match exactly)
  assertEqual('eval.name.fullHangul', namingReport.name.fullHangul, baseEval.name.fullHangul);
  assertEqual('eval.name.fullHanja', namingReport.name.fullHanja, baseEval.name.fullHanja);

  // 성씨/이름 자원 (must match exactly)
  assertEqual('eval.surname[0].element', namingReport.name.surname[0].element, baseEval.name.surname[0].element);
  assertEqual('eval.surname[0].strokes', namingReport.name.surname[0].strokes, baseEval.name.surname[0].strokes);
  for (let i = 0; i < namingReport.name.givenName.length; i++) {
    assertEqual(`eval.givenName[${i}].element`, namingReport.name.givenName[i].element, baseEval.name.givenName[i].element);
    assertEqual(`eval.givenName[${i}].strokes`, namingReport.name.givenName[i].strokes, baseEval.name.givenName[i].strokes);
    assertEqual(`eval.givenName[${i}].meaning`, namingReport.name.givenName[i].meaning, baseEval.name.givenName[i].meaning);
  }

  // 이름 점수 (한글/한자/사격 — should be close to baseline)
  assertClose('eval.scores.hangul', namingReport.scores.hangul, baseEval.scores.hangul);
  assertClose('eval.scores.hanja', namingReport.scores.hanja, baseEval.scores.hanja);
  assertClose('eval.scores.fourFrame', namingReport.scores.fourFrame, baseEval.scores.fourFrame);

  // 한글 분석
  assertEqual('eval.hangul.blocks.length', namingReport.analysis.hangul.blocks.length, baseEval.analysis.hangul.blocks.length);
  assertClose('eval.hangul.polarityScore', namingReport.analysis.hangul.polarityScore, baseEval.analysis.hangul.polarityScore);
  assertClose('eval.hangul.elementScore', namingReport.analysis.hangul.elementScore, baseEval.analysis.hangul.elementScore);

  console.log(`\n   종합: ${namingReport.totalScore}`);
  console.log(`   한글: ${namingReport.scores.hangul} (baseline: ${baseEval.scores.hangul})`);
  console.log(`   한자: ${namingReport.scores.hanja} (baseline: ${baseEval.scores.hanja})`);
  console.log(`   사격: ${namingReport.scores.fourFrame} (baseline: ${baseEval.scores.fourFrame})`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. 최성수 통합 평가 (getNameCandidates - evaluate mode)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n2. [통합평가] 최성수 - getNameCandidates evaluate mode');
  const evalReports = await engine.getNameCandidates({
    birth,
    surname: [{ hangul: '최', hanja: '崔' }],
    givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
    mode: 'evaluate',
  });

  const evalR = evalReports[0];
  const evalOk = !!evalR && evalR.finalScore > 0;
  if (evalOk) pass++; else fail++;
  console.log(`   ${evalOk ? 'PASS' : 'FAIL'} getNameCandidates evaluate returns result`);

  if (evalR) {
    // 사주 점수 비교 (report only)
    reportSaju('eval.sajuCompatibility.affinityScore', evalR.sajuCompatibility.affinityScore, baseEval.scores.saju);
    reportSaju('eval.finalScore', evalR.finalScore, baseEval.scores.total);

    console.log(`\n   finalScore: ${evalR.finalScore} (baseline total: ${baseEval.scores.total})`);
    console.log(`   naming totalScore: ${evalR.namingReport.totalScore}`);
    console.log(`   한글: ${evalR.namingReport.scores.hangul} (baseline: ${baseEval.scores.hangul})`);
    console.log(`   한자: ${evalR.namingReport.scores.hanja} (baseline: ${baseEval.scores.hanja})`);
    console.log(`   사격: ${evalR.namingReport.scores.fourFrame} (baseline: ${baseEval.scores.fourFrame})`);
    console.log(`   사주궁합: ${evalR.sajuCompatibility.affinityScore} (baseline saju: ${baseEval.scores.saju})`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. 최__ 추천 (getNameCandidates - recommend mode)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n3. [추천] 최__ (1986-04-19 05:45, top 20)');
  const recReports = await engine.getNameCandidates({
    birth,
    surname: [{ hangul: '최', hanja: '崔' }],
    givenNameLength: 2,
    mode: 'recommend',
  });

  const baseRec = baseline.searchRecommend;

  console.log(`   총 후보: ${recReports.length} (baseline: ${baseRec.totalCount})`);
  const recCountOk = recReports.length > 0;
  if (recCountOk) pass++; else fail++;
  console.log(`   ${recCountOk ? 'PASS' : 'FAIL'} 추천 후보가 생성됨`);

  // top 20 출력
  console.log('');
  const baseMap = new Map<string, any>();
  for (const c of baseRec.top20) baseMap.set(c.hanja, c);
  let nameMatchCount = 0;
  let nameScoreMatch = 0;

  for (let i = 0; i < Math.min(20, recReports.length); i++) {
    const r = recReports[i];
    const bm = baseMap.get(r.namingReport.name.fullHanja);
    const matchTag = bm ? '  ' : '* ';
    console.log(`   ${matchTag}${String(i + 1).padStart(2)}. ${r.namingReport.name.fullHangul}(${r.namingReport.name.fullHanja}) final=${r.finalScore} hangul=${r.namingReport.scores.hangul} hanja=${r.namingReport.scores.hanja} fourFrame=${r.namingReport.scores.fourFrame} saju=${r.sajuCompatibility.affinityScore}`);

    if (bm) {
      nameMatchCount++;
      const hOk = Math.abs(r.namingReport.scores.hangul - bm.scores.hangul) <= 15;
      const jOk = Math.abs(r.namingReport.scores.hanja - bm.scores.hanja) <= 15;
      const fOk = Math.abs(r.namingReport.scores.fourFrame - bm.scores.fourFrame) <= 15;
      if (hOk && jOk && fOk) {
        nameScoreMatch++;
        pass++;
      } else {
        fail++;
        console.log(`     FAIL name scores diff: hangul=${r.namingReport.scores.hangul}/${bm.scores.hangul} hanja=${r.namingReport.scores.hanja}/${bm.scores.hanja} fourFrame=${r.namingReport.scores.fourFrame}/${bm.scores.fourFrame}`);
      }
    }
  }
  console.log(`\n   baseline에 있는 이름 겹침: ${nameMatchCount}/20`);
  console.log(`   겹치는 이름 중 이름점수 일치: ${nameScoreMatch}/${nameMatchCount}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. 복성 제갈__ 추천
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n4. [복성] 제갈__ (1990-07-15 10:30 male)');
  const dsBirth = { year: 1990, month: 7, day: 15, hour: 10, minute: 30, gender: 'male' as const };
  const dsResults = await engine.getNameCandidates({
    birth: dsBirth,
    surname: [{ hangul: '제', hanja: '諸' }, { hangul: '갈', hanja: '葛' }],
    givenNameLength: 2,
    mode: 'recommend',
  });

  console.log(`   총 후보: ${dsResults.length}`);
  const dsOk = dsResults.length > 0;
  if (dsOk) pass++; else fail++;
  console.log(`   ${dsOk ? 'PASS' : 'FAIL'} 복성 후보 생성됨`);

  for (let i = 0; i < Math.min(5, dsResults.length); i++) {
    const r = dsResults[i];
    console.log(`   ${String(i + 1).padStart(2)}. ${r.namingReport.name.fullHangul}(${r.namingReport.name.fullHanja}) final=${r.finalScore} hangul=${r.namingReport.scores.hangul} hanja=${r.namingReport.scores.hanja} saju=${r.sajuCompatibility.affinityScore}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. 제갈공명 평가
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n5. [복성평가] 제갈공명');
  const dsEvalResults = await engine.getNameCandidates({
    birth: dsBirth,
    surname: [{ hangul: '제', hanja: '諸' }, { hangul: '갈', hanja: '葛' }],
    givenName: [{ hangul: '공', hanja: '孔' }, { hangul: '명', hanja: '明' }],
    mode: 'evaluate',
  });

  const dsC = dsEvalResults[0];
  const dsEvalOk = dsC && dsC.finalScore > 0 && dsC.namingReport.name.fullHangul === '제갈공명';
  if (dsEvalOk) pass++; else fail++;
  console.log(`   ${dsEvalOk ? 'PASS' : 'FAIL'} 제갈공명 평가`);
  if (dsC) {
    console.log(`   finalScore: ${dsC.finalScore} 한글: ${dsC.namingReport.scores.hangul} 한자: ${dsC.namingReport.scores.hanja} 사격: ${dsC.namingReport.scores.fourFrame}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. 사주 데이터 구조 검증 (getSajuReport)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n6. [사주데이터] getSajuReport 구조 검증');
  const sajuReport = await engine.getSajuReport({
    birth,
    surname: [{ hangul: '최', hanja: '崔' }],
  });

  const checks: [string, boolean][] = [
    ['sajuReport.sajuEnabled is boolean', typeof sajuReport.sajuEnabled === 'boolean'],
    ['pillars.year defined', !!sajuReport.pillars?.year?.stem?.code],
    ['pillars.month defined', !!sajuReport.pillars?.month?.stem?.code],
    ['pillars.day defined', !!sajuReport.pillars?.day?.stem?.code],
    ['pillars.hour defined', !!sajuReport.pillars?.hour?.stem?.code],
    ['dayMaster.element exists', !!sajuReport.dayMaster?.element],
    ['strength.level exists', !!sajuReport.strength?.level],
    ['yongshin.element exists', !!sajuReport.yongshin?.element],
    ['elementDistribution exists', !!sajuReport.elementDistribution && Object.keys(sajuReport.elementDistribution).length > 0],
    ['timeCorrection exists', !!sajuReport.timeCorrection],
  ];

  for (const [label, ok] of checks) {
    if (ok) pass++; else fail++;
    console.log(`   ${ok ? 'PASS' : 'FAIL'} ${label}`);
  }
  console.log(`   sajuEnabled: ${sajuReport.sajuEnabled}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 7. getNamingReport 구조 검증
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n7. [getNamingReport] 구조 검증');
  const nrChecks: [string, boolean][] = [
    ['namingReport.name.fullHangul', namingReport.name.fullHangul === '최성수'],
    ['namingReport.name.fullHanja', namingReport.name.fullHanja === '崔成秀'],
    ['namingReport.totalScore > 0', namingReport.totalScore > 0],
    ['namingReport.scores.hangul defined', typeof namingReport.scores.hangul === 'number'],
    ['namingReport.scores.hanja defined', typeof namingReport.scores.hanja === 'number'],
    ['namingReport.scores.fourFrame defined', typeof namingReport.scores.fourFrame === 'number'],
    ['namingReport.analysis.hangul.blocks', Array.isArray(namingReport.analysis.hangul.blocks)],
    ['namingReport.analysis.hanja.blocks', Array.isArray(namingReport.analysis.hanja.blocks)],
    ['namingReport.analysis.fourFrame.frames', Array.isArray(namingReport.analysis.fourFrame.frames)],
    ['namingReport.analysis.fourFrame.frames[0].type', namingReport.analysis.fourFrame.frames[0]?.type === 'won'],
    ['namingReport.analysis.fourFrame.frames[0].element', typeof namingReport.analysis.fourFrame.frames[0]?.element === 'string'],
    ['namingReport.analysis.fourFrame.frames[0].meaning', namingReport.analysis.fourFrame.frames[0]?.meaning !== undefined],
    ['namingReport.analysis.fourFrame.luckScore defined', typeof namingReport.analysis.fourFrame.luckScore === 'number'],
    ['namingReport.interpretation exists', typeof namingReport.interpretation === 'string'],
    ['namingReport.name.surname[0].element', typeof namingReport.name.surname[0]?.element === 'string'],
  ];

  for (const [label, ok] of nrChecks) {
    if (ok) pass++; else fail++;
    console.log(`   ${ok ? 'PASS' : 'FAIL'} ${label}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 8. getNameCandidates 구조 검증
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n8. [getNameCandidates] 구조 검증');
  const first = recReports[0];
  if (first) {
    const scChecks: [string, boolean][] = [
      ['springReport.finalScore > 0', first.finalScore > 0],
      ['springReport.rank === 1', first.rank === 1],
      ['springReport.namingReport exists', !!first.namingReport],
      ['springReport.namingReport.name.fullHangul', typeof first.namingReport.name.fullHangul === 'string'],
      ['springReport.namingReport.totalScore > 0', first.namingReport.totalScore > 0],
      ['springReport.sajuReport exists', !!first.sajuReport],
      ['springReport.sajuReport.sajuEnabled is boolean', typeof first.sajuReport.sajuEnabled === 'boolean'],
      ['springReport.sajuCompatibility exists', !!first.sajuCompatibility],
      ['springReport.sajuCompatibility.yongshinElement', typeof first.sajuCompatibility.yongshinElement === 'string'],
      ['springReport.sajuCompatibility.nameElements is array', Array.isArray(first.sajuCompatibility.nameElements)],
    ];

    for (const [label, ok] of scChecks) {
      if (ok) pass++; else fail++;
      console.log(`   ${ok ? 'PASS' : 'FAIL'} ${label}`);
    }
  } else {
    fail++;
    console.log('   FAIL  No candidates returned');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 9. 자모 필터 + 와일드카드 + 고정 글자: 김ㅇ_사윤 (5글자 이름)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n9. [자모필터] 김ㅇ_사윤 (5글자=성1+이름4, 자모필터+와일드카드+고정글자)');
  const jamoBirth = { year: 1995, month: 3, day: 12, hour: 14, minute: 30, gender: 'female' as const };
  const jamoResults = await engine.getNameCandidates({
    birth: jamoBirth,
    surname: [{ hangul: '김', hanja: '金' }],
    givenName: [
      { hangul: 'ㅇ' },    // position 0: onset=ㅇ 필터
      { hangul: '' },      // position 1: 와일드카드 (제한 없음)
      { hangul: '사' },    // position 2: onset=ㅅ, nucleus=ㅏ 필터
      { hangul: '윤' },    // position 3: 고정 글자
    ],
    mode: 'recommend',
  });

  console.log(`   총 후보: ${jamoResults.length}`);

  const jamoCountOk = jamoResults.length > 0;
  if (jamoCountOk) pass++; else fail++;
  console.log(`   ${jamoCountOk ? 'PASS' : 'FAIL'} 자모필터 후보 생성됨`);

  // 이름 4글자 확인
  const jamoLenOk = jamoResults.every(r => r.namingReport.name.givenName.length === 4);
  if (jamoLenOk) pass++; else fail++;
  console.log(`   ${jamoLenOk ? 'PASS' : 'FAIL'} 이름 글자수 = 4`);

  // 1번째 글자 초성 = ㅇ
  const jamoOnsetOk = jamoResults.every(r => {
    const h = r.namingReport.name.givenName[0]?.hangul;
    if (!h) return false;
    const code = h.charCodeAt(0) - 0xAC00;
    return Math.floor(code / 588) === 11; // ㅇ index
  });
  if (jamoOnsetOk) pass++; else fail++;
  console.log(`   ${jamoOnsetOk ? 'PASS' : 'FAIL'} 1번째 글자 초성 = ㅇ`);

  // 2번째 글자 = 와일드카드 (유효한 한글 음절이면 OK)
  const jamoWildOk = jamoResults.every(r => {
    const h = r.namingReport.name.givenName[1]?.hangul;
    if (!h) return false;
    const code = h.charCodeAt(0);
    return code >= 0xAC00 && code <= 0xD7A3;
  });
  if (jamoWildOk) pass++; else fail++;
  console.log(`   ${jamoWildOk ? 'PASS' : 'FAIL'} 2번째 글자 = 와일드카드 (한글 음절)`);

  // 3번째 글자 = 사 패턴 (초성ㅅ + 중성ㅏ)
  const jamoSaOk = jamoResults.every(r => {
    const h = r.namingReport.name.givenName[2]?.hangul;
    if (!h) return false;
    const code = h.charCodeAt(0) - 0xAC00;
    return Math.floor(code / 588) === 9 && Math.floor((code % 588) / 28) === 0; // ㅅ=9, ㅏ=0
  });
  if (jamoSaOk) pass++; else fail++;
  console.log(`   ${jamoSaOk ? 'PASS' : 'FAIL'} 3번째 글자 = 사 패턴 (ㅅ+ㅏ)`);

  // 4번째 글자 = 윤 (고정)
  const jamoYunOk = jamoResults.every(r => r.namingReport.name.givenName[3]?.hangul === '윤');
  if (jamoYunOk) pass++; else fail++;
  console.log(`   ${jamoYunOk ? 'PASS' : 'FAIL'} 4번째 글자 = 윤`);

  // finalScore > 0
  const jamoScoreOk = jamoResults.every(r => r.finalScore > 0);
  if (jamoScoreOk) pass++; else fail++;
  console.log(`   ${jamoScoreOk ? 'PASS' : 'FAIL'} 모든 후보 finalScore > 0`);

  // top 5 출력
  for (let i = 0; i < Math.min(5, jamoResults.length); i++) {
    const r = jamoResults[i];
    const names = r.namingReport.name.givenName;
    console.log(`   ${String(i + 1).padStart(2)}. ${r.namingReport.name.fullHangul}(${r.namingReport.name.fullHanja}) final=${r.finalScore} elements=[${names.map(n => n.element).join(',')}]`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 10. 복성 자모 필터: 제갈_ㅇ소 (5글자 = 복성2 + 이름3)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n10. [복성+자모필터] 제갈_ㅇ소 (5글자=복성2+이름3, 와일드카드+초성필터+ㅅㅗ필터)');
  const jgBirth = { year: 1990, month: 7, day: 15, hour: 10, minute: 30, gender: 'male' as const };
  const jgResults = await engine.getNameCandidates({
    birth: jgBirth,
    surname: [{ hangul: '제', hanja: '諸' }, { hangul: '갈', hanja: '葛' }],
    givenName: [
      { hangul: '' },      // position 0: 와일드카드
      { hangul: 'ㅇ' },    // position 1: onset=ㅇ 필터
      { hangul: '소' },    // position 2: onset=ㅅ, nucleus=ㅗ 필터
    ],
    mode: 'recommend',
  });

  console.log(`   총 후보: ${jgResults.length}`);

  const jgCountOk = jgResults.length > 0;
  if (jgCountOk) pass++; else fail++;
  console.log(`   ${jgCountOk ? 'PASS' : 'FAIL'} 복성+자모필터 후보 생성됨`);

  // 이름 3글자 확인
  const jgLenOk = jgResults.every(r => r.namingReport.name.givenName.length === 3);
  if (jgLenOk) pass++; else fail++;
  console.log(`   ${jgLenOk ? 'PASS' : 'FAIL'} 이름 글자수 = 3`);

  // 성씨 = 제갈 확인
  const jgSurnameOk = jgResults.every(r =>
    r.namingReport.name.surname.length === 2
    && r.namingReport.name.surname[0].hangul === '제'
    && r.namingReport.name.surname[1].hangul === '갈',
  );
  if (jgSurnameOk) pass++; else fail++;
  console.log(`   ${jgSurnameOk ? 'PASS' : 'FAIL'} 성씨 = 제갈`);

  // 1번째 글자 = 와일드카드 (한글 음절이면 OK)
  const jgWildOk = jgResults.every(r => {
    const h = r.namingReport.name.givenName[0]?.hangul;
    if (!h) return false;
    const code = h.charCodeAt(0);
    return code >= 0xAC00 && code <= 0xD7A3;
  });
  if (jgWildOk) pass++; else fail++;
  console.log(`   ${jgWildOk ? 'PASS' : 'FAIL'} 1번째 글자 = 와일드카드 (한글 음절)`);

  // 2번째 글자 초성 = ㅇ
  const jgOnsetOk = jgResults.every(r => {
    const h = r.namingReport.name.givenName[1]?.hangul;
    if (!h) return false;
    const code = h.charCodeAt(0) - 0xAC00;
    return Math.floor(code / 588) === 11; // ㅇ index
  });
  if (jgOnsetOk) pass++; else fail++;
  console.log(`   ${jgOnsetOk ? 'PASS' : 'FAIL'} 2번째 글자 초성 = ㅇ`);

  // 3번째 글자 = 소 패턴 (초성ㅅ + 중성ㅗ)
  const jgSoOk = jgResults.every(r => {
    const h = r.namingReport.name.givenName[2]?.hangul;
    if (!h) return false;
    const code = h.charCodeAt(0) - 0xAC00;
    return Math.floor(code / 588) === 9 && Math.floor((code % 588) / 28) === 8; // ㅅ=9, ㅗ=8
  });
  if (jgSoOk) pass++; else fail++;
  console.log(`   ${jgSoOk ? 'PASS' : 'FAIL'} 3번째 글자 = 소 패턴 (ㅅ+ㅗ)`);

  // finalScore > 0
  const jgScoreOk = jgResults.every(r => r.finalScore > 0);
  if (jgScoreOk) pass++; else fail++;
  console.log(`   ${jgScoreOk ? 'PASS' : 'FAIL'} 모든 후보 finalScore > 0`);

  // top 5 출력
  for (let i = 0; i < Math.min(5, jgResults.length); i++) {
    const r = jgResults[i];
    const names = r.namingReport.name.givenName;
    console.log(`   ${String(i + 1).padStart(2)}. ${r.namingReport.name.fullHangul}(${r.namingReport.name.fullHanja}) final=${r.finalScore} elements=[${names.map(n => n.element).join(',')}]`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Summary
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n' + '='.repeat(55));
  console.log(`  PASS: ${pass}  FAIL: ${fail}  TOTAL: ${pass + fail}`);
  console.log(`  사주 점수 차이 (리포트): ${sajuDiff}건`);
  console.log('='.repeat(55));

  if (fail > 0) process.exit(1);

} finally {
  engine.close();
}
