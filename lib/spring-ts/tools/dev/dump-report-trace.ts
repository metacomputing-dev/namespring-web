/**
 * dump-report-trace.ts -- 리포트 실측 덤프 (인계·회귀 검증용).
 *
 * 엔진을 node에서 직접 돌려, 화면에 실제로 노출될 콘텐츠의 출처를 찍는다:
 *  - 기간별(오늘~올해) 셀의 fragmentId (재생성 classId인지 베이스인지)
 *  - 나이대별(byDaeun) 각 대운의 라벨·별점·fragmentId (등급-텍스트 정합 확인)
 *  - lifeCurve 점 개수, insightFacts 해석 부착 수
 *
 * 사용: npx tsx tools/dev/dump-report-trace.ts [YYYY MM DD HH mm male|female 성 이름 성한자 이름한자...]
 *      (인자 없으면 데모: 최성수 崔成秀 1986-04-19 05:45 male)
 *
 * ※ sql.js wasm을 fetch로 찾는 문제를 우회하기 위해 fetch를 패치한다
 *   (test/integration/namespring-compat.test.ts와 동일 패턴).
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: any, options?: any) => {
  const u = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (u.startsWith('/data/')) {
    const f = path.join(NAMESPRING_DATA, u.replace('/data/', ''));
    if (!fs.existsSync(f)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(f), { status: 200 });
  }
  if (u.includes('sql-wasm.wasm') || u.startsWith('https://sql.js.org/')) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  return originalFetch(url, options);
};

import { SpringEngine } from '../../src/index.js';

const argv = process.argv.slice(2);
const [y, mo, d, h, mi, gender, sur, given, surHanja, ...givenHanja] = argv;
const req = argv.length >= 8
  ? {
    birth: { year: +y, month: +mo, day: +d, hour: +h, minute: +mi, gender: (gender as 'male' | 'female') },
    surname: [{ hangul: sur, hanja: surHanja ?? '' }],
    givenName: [...given].map((ch, i) => ({ hangul: ch, hanja: givenHanja[i] ?? '' })),
    options: { precisionConfig: { surfaceTieredMatrix: true, surfaceInsightFacts: true } },
  }
  : {
    birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
    surname: [{ hangul: '최', hanja: '崔' }],
    givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
    options: { precisionConfig: { surfaceTieredMatrix: true, surfaceInsightFacts: true } },
  };

const engine = new SpringEngine();
for (const repo of [(engine as any).hanjaRepo, (engine as any).fourFrameRepo]) {
  if (repo) (repo as any).wasmUrl = WASM_PATH;
}
await engine.init();

const report: any = await engine.getFortuneReport(req as any);
const frag = (cell: any) => cell?.selectedFragments?.brief?.fragmentId ?? '(placeholder)';
const isRegen = (id: string) => id.split('.').length === 8; // classId 8토큰 = 재생성

console.log('══ 기간별 셀 소스 (재생성 classId = 8토큰) ══');
for (const period of ['today', 'thisWeek', 'thisMonth', 'thisYear'] as const) {
  const p = report.tieredMatrix.periods[period];
  const oid = frag(p.overall);
  console.log(`  ${period.padEnd(9)} overall: ${isRegen(oid) ? '✅재생성' : '⚠베이스'} ${oid}`);
}

console.log('══ 나이대별(byDaeun) — 등급-텍스트 정합 ══');
for (const seg of report.tieredMatrix.periods.life.byDaeun ?? []) {
  const oid = frag(seg.overall);
  const bandInId = oid.split('.').find((t: string) => ['high', 'mid', 'low', 'any'].includes(t)) ?? '?';
  const stars = seg.overall?.stars;
  const expect = stars >= 4 ? 'high' : stars <= 2 ? 'low' : 'mid/any';
  const ok = (stars >= 4 && bandInId === 'high') || (stars <= 2 && bandInId === 'low')
    || (stars === 3 && (bandInId === 'any' || bandInId === 'mid'));
  console.log(`  ${seg.ageLabel} (${seg.pillarDisplay}) ★${stars} → [${bandInId}] ${ok ? '정합✓' : `정합✗(기대 ${expect})`} ${oid.slice(0, 60)}`);
}

const facts = report.insightFacts?.facts ?? [];
console.log('══ 기타 ══');
console.log(`  lifeCurve: ${report.lifeCurve?.points?.length ?? 0}점 / 대운 ${report.lifeCurve?.daeunSegments?.length ?? 0}구간`);
console.log(`  insightFacts: ${facts.length}건 (해석 부착 ${facts.filter((f: any) => f.interpretation).length}, 하이라이트 ${facts.filter((f: any) => f.highlight).length})`);
