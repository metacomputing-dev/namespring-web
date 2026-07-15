/** 채굴 2차 신규 후보 N-01~N-15 역법 검증 (clock-time fidelity 모드). */
import { analyzeSaju } from '../../../src/saju-adapter.js';

type C = { id: string; y: number; mo: number; d: number; h: number; mi: number; g: 'male' | 'female'; src: string; tz?: string; note?: string };
const CANDS: C[] = [
  { id: 'N-01', y: 1974, mo: 3, d: 11, h: 14, mi: 0, g: 'female', src: '甲寅 丁卯 辛亥 乙未' },
  { id: 'N-02', y: 1977, mo: 6, d: 10, h: 20, mi: 10, g: 'male', src: '丁巳 丙午 戊戌 壬戌' },
  { id: 'N-03', y: 1967, mo: 6, d: 23, h: 12, mi: 10, g: 'male', src: '丁未 丙午 戊午 戊午' },
  { id: 'N-04', y: 1980, mo: 1, d: 25, h: 2, mi: 30, g: 'male', src: '己未 丁丑 丁酉 辛丑' },
  { id: 'N-05', y: 1983, mo: 8, d: 29, h: 18, mi: 40, g: 'female', src: '癸亥 庚申 己丑 癸酉' },
  { id: 'N-06', y: 1973, mo: 1, d: 31, h: 23, mi: 44, g: 'female', src: '壬子 癸丑 戊辰 壬子', note: '23시 환일(익일 일주) — 정자시설 엔진과 일치 확인' },
  { id: 'N-07', y: 2002, mo: 6, d: 18, h: 11, mi: 48, g: 'male', src: '壬午 丙午 丁巳 丙午' },
  { id: 'N-08', y: 1979, mo: 9, d: 17, h: 21, mi: 40, g: 'male', src: '己未 癸酉 丁亥 辛亥' },
  { id: 'N-09', y: 1979, mo: 2, d: 4, h: 9, mi: 36, g: 'male', src: '戊午 乙丑 壬寅 乙巳', note: '입춘 경계일(1979-02-04) — 월주·년주 민감' },
  { id: 'N-10', y: 1981, mo: 10, d: 26, h: 17, mi: 58, g: 'male', src: '辛酉 戊戌 丁丑 己酉' },
  { id: 'N-11', y: 1979, mo: 5, d: 16, h: 2, mi: 51, g: 'male', src: '己未 己巳 癸未 癸丑' },
  { id: 'N-12', y: 1985, mo: 10, d: 13, h: 10, mi: 0, g: 'male', src: '乙丑 丙戌 乙酉 辛巳', note: '음력 8/29 巳時 환산본' },
  { id: 'N-13', y: 1979, mo: 11, d: 8, h: 22, mi: 0, g: 'male', src: '己未 乙亥 己卯 乙亥' },
  { id: 'N-14', y: 1962, mo: 2, d: 10, h: 6, mi: 0, g: 'male', src: '壬寅 壬寅 己卯 丁卯' },
  { id: 'N-15', y: 1980, mo: 5, d: 12, h: 23, mi: 30, g: 'female', src: '庚申 辛巳 乙酉 戊子', tz: 'Asia/Taipei', note: '야자시 시두법(일주 유지+익일 시간두) — JOJA_SPLIT 프로브 별도' },
];

const OPTS: any = { sajuTimePolicy: { trueSolarTime: 'off', longitudeCorrection: 'off' } };
let pass = 0;
const mismatches: string[] = [];
for (const c of CANDS) {
  const birth: any = { year: c.y, month: c.mo, day: c.d, hour: c.h, minute: c.mi, gender: c.g, calendarType: 'solar', longitude: 120, timezone: c.tz ?? 'Asia/Shanghai' };
  const s: any = await analyzeSaju(birth, OPTS);
  const p = s.pillars;
  const got = ['year', 'month', 'day', 'hour'].map((k) => {
    const pp = p?.[k];
    return pp ? `${pp.stem?.hanja ?? pp.stem}${pp.branch?.hanja ?? pp.branch}` : '∅';
  }).join(' ');
  const ok = got === c.src;
  if (ok) pass += 1;
  else mismatches.push(c.id);
  console.log(`${c.id}: ${ok ? 'MATCH   ' : 'MISMATCH'} engine=[${got}] source=[${c.src}]${c.note ? ' | ' + c.note : ''}`);
}
console.log(`\n${pass}/${CANDS.length} MATCH`);

const expectedMismatches = ['N-15'];
const mismatchContractHolds =
  mismatches.length === expectedMismatches.length &&
  mismatches.every((id, index) => id === expectedMismatches[index]);
if (!mismatchContractHolds) {
  console.error(
    `Mismatch contract failed: expected=[${expectedMismatches.join(',')}] actual=[${mismatches.join(',')}]`,
  );
  process.exitCode = 1;
} else {
  console.log(`Expected mismatch contract: PASS (${expectedMismatches.join(',')})`);
}
