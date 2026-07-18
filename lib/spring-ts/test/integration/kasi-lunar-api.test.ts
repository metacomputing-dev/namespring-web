/**
 * test/integration/kasi-lunar-api.test.ts
 *
 * 감사 B1 — KASI 음양력 API 옵션(kasi-lunar-api.ts) 오프라인 결정적 검증.
 * node:http 로컬 목서버 + KASI_LUNISOLAR_API_URL 오버라이드로:
 *   1. 정상 응답 → 양력 파싱 (lunYear 필터 포함)
 *   2. resultCode != 00 → null
 *   3. 서비스키 부재 → null (네트워크 미발생)
 *   4. 헤더 전/후 타임아웃 → null
 *   5. 제한 초과 스트리밍 응답 → 본문 종료 전 fail-closed
 *   6. 어댑터 폴백: lunarConversionSource='kasi' + 키 부재 → builtin + kasiFallback
 *
 * Run: npm run test:kasi-lunar-api
 */
import http from 'node:http';
import { kasiLunarToSolar } from '../../src/calendar/kasi-lunar-api.js';
import { analyzeSajuSafe } from '../../src/saju-adapter.js';

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

interface MockItem {
  lunYear: number;
  lunMonth: number;
  lunDay: number;
  lunLeapmonth: '평' | '윤';
  solYear: number;
  solMonth: number;
  solDay: number;
}

function okXml(items: MockItem[]): string {
  const rows = items.map((i) => `<item><lunYear>${i.lunYear}</lunYear><lunMonth>${String(i.lunMonth).padStart(2, '0')}</lunMonth><lunDay>${String(i.lunDay).padStart(2, '0')}</lunDay><lunLeapmonth>${i.lunLeapmonth}</lunLeapmonth><solYear>${i.solYear}</solYear><solMonth>${String(i.solMonth).padStart(2, '0')}</solMonth><solDay>${String(i.solDay).padStart(2, '0')}</solDay></item>`).join('');
  return `<?xml version="1.0"?><response><header><resultCode>00</resultCode><resultMsg>OK</resultMsg></header><body><items>${rows}</items></body></response>`;
}

console.log('KASI lunar API option (감사 B1)\n');

// ── 목서버 ──
let mode: 'ok' | 'error-code' | 'hang' | 'body-hang' | 'oversized-body' = 'ok';
let requestCount = 0;
const server = http.createServer((req, res) => {
  requestCount += 1;
  if (mode === 'hang') return; // 응답 보류 → 클라이언트 타임아웃
  if (mode === 'body-hang') {
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.write('<?xml version="1.0"?><response>');
    return; // 헤더와 본문 일부만 보낸 뒤 보류 → body read 타임아웃
  }
  if (mode === 'oversized-body') {
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.write('x'.repeat(512 * 1024));
    return; // Content-Length 없이 상한을 넘긴 뒤 보류 → 스트리밍 상한 검증
  }
  if (mode === 'error-code') {
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.end('<?xml version="1.0"?><response><header><resultCode>30</resultCode><resultMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</resultMsg></header></response>');
    return;
  }
  // 연 범위 검색이라 이듬해 동일 음력 월일이 함께 온다 — lunYear 필터 검증용 오염 행 포함.
  res.writeHead(200, { 'Content-Type': 'application/xml' });
  res.end(okXml([
    { lunYear: 2026, lunMonth: 6, lunDay: 1, lunLeapmonth: '윤', solYear: 2026, solMonth: 8, solDay: 13 },
    { lunYear: 2025, lunMonth: 6, lunDay: 1, lunLeapmonth: '평', solYear: 2025, solMonth: 6, solDay: 25 },
    { lunYear: 2025, lunMonth: 6, lunDay: 1, lunLeapmonth: '윤', solYear: 2025, solMonth: 7, solDay: 25 },
  ]));
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = (server.address() as { port: number }).port;
const baseUrl = `http://127.0.0.1:${port}`;

// 1. 정상 + lunYear 필터
mode = 'ok';
const got = await kasiLunarToSolar(
  { year: 2025, month: 6, day: 1, isLeapMonth: true },
  { serviceKey: 'TEST_KEY', baseUrl },
);
check('정상 응답 파싱 + 음력 tuple 필터 (연도·평달 오염 행 무시)',
  got?.year === 2025 && got?.month === 7 && got?.day === 25,
  JSON.stringify(got));

// 2. resultCode != 00
mode = 'error-code';
check('resultCode!=00 → null',
  (await kasiLunarToSolar({ year: 2025, month: 6, day: 1, isLeapMonth: true }, { serviceKey: 'TEST_KEY', baseUrl })) === null);

check('malformed explicit base URL fails closed without throwing',
  (await kasiLunarToSolar(
    { year: 2025, month: 6, day: 1, isLeapMonth: true },
    { serviceKey: 'TEST_KEY', baseUrl: 'not-a-url' },
  )) === null);

const requestCountBeforeInvalidTimeouts = requestCount;
const invalidTimeoutResults = await Promise.all(
  [Number.NaN, Number.POSITIVE_INFINITY, 0, -1, 60_001, 1.5].map((timeoutMs) =>
    kasiLunarToSolar(
      { year: 2025, month: 6, day: 1, isLeapMonth: true },
      { serviceKey: 'TEST_KEY', baseUrl, timeoutMs },
    )),
);
check('invalid timeout values fail closed without starting an external request',
  invalidTimeoutResults.every((result) => result === null)
    && requestCount === requestCountBeforeInvalidTimeouts,
  JSON.stringify({ results: invalidTimeoutResults, requestCount }));

// 3. 서비스키 부재 (env 트리오도 비움)
const savedEnv = {
  KASI_LUNISOLAR_SERVICE_KEY: process.env.KASI_LUNISOLAR_SERVICE_KEY,
  KASI_DATA_GO_KR_SERVICE_KEY: process.env.KASI_DATA_GO_KR_SERVICE_KEY,
  DATA_GO_KR_SERVICE_KEY: process.env.DATA_GO_KR_SERVICE_KEY,
  KASI_LUNISOLAR_API_URL: process.env.KASI_LUNISOLAR_API_URL,
};
process.env.KASI_LUNISOLAR_SERVICE_KEY = 'TEST_KEY';
process.env.KASI_LUNISOLAR_API_URL = 'not-a-url';
check('malformed environment base URL fails closed without throwing',
  (await kasiLunarToSolar(
    { year: 2025, month: 6, day: 1, isLeapMonth: true },
  )) === null);
const malformedEnvFallback = await analyzeSajuSafe(
  {
    year: 2025, month: 6, day: 1, hour: 9, minute: 30,
    gender: 'female', calendarType: 'lunar', isLeapMonth: true, timezone: 'Asia/Seoul',
  },
  { precisionConfig: { lunarConversionSource: 'kasi' } as any },
);
const malformedEnvConversion = (malformedEnvFallback.summary as Record<string, any>).lunarConversion;
check('malformed KASI configuration preserves the built-in lunar fallback',
  malformedEnvFallback.sajuEnabled === true
    && malformedEnvConversion?.source === 'builtin'
    && malformedEnvConversion?.kasiFallback === true,
  JSON.stringify({
    enabled: malformedEnvFallback.sajuEnabled,
    source: malformedEnvConversion?.source,
    kasiFallback: malformedEnvConversion?.kasiFallback,
  }));
delete process.env.KASI_LUNISOLAR_SERVICE_KEY;
delete process.env.KASI_DATA_GO_KR_SERVICE_KEY;
delete process.env.DATA_GO_KR_SERVICE_KEY;
delete process.env.KASI_LUNISOLAR_API_URL;
mode = 'ok';
check('서비스키 부재 → null',
  (await kasiLunarToSolar({ year: 2025, month: 6, day: 1, isLeapMonth: true }, { baseUrl })) === null);

// 4. 헤더 전/후 타임아웃
mode = 'hang';
check('타임아웃 → null',
  (await kasiLunarToSolar({ year: 2025, month: 6, day: 1, isLeapMonth: true }, { serviceKey: 'TEST_KEY', baseUrl, timeoutMs: 300 })) === null);

mode = 'body-hang';
const bodyHangStartedAt = Date.now();
const bodyHangResult = await Promise.race([
  kasiLunarToSolar(
    { year: 2025, month: 6, day: 1, isLeapMonth: true },
    { serviceKey: 'TEST_KEY', baseUrl, timeoutMs: 300 },
  ).then((result) => ({ settled: true, result })),
  new Promise<{ settled: false; result: null }>((resolve) => {
    setTimeout(() => resolve({ settled: false, result: null }), 1_000);
  }),
]);
check('헤더 수신 후 본문 보류도 타임아웃 → null',
  bodyHangResult.settled && bodyHangResult.result === null && Date.now() - bodyHangStartedAt < 1_000,
  JSON.stringify({ settled: bodyHangResult.settled, elapsedMs: Date.now() - bodyHangStartedAt }));

// 5. 응답 크기 상한
mode = 'oversized-body';
const oversizedStartedAt = Date.now();
const oversizedResult = await Promise.race([
  kasiLunarToSolar(
    { year: 2025, month: 6, day: 1, isLeapMonth: true },
    { serviceKey: 'TEST_KEY', baseUrl, timeoutMs: 3_000 },
  ).then((result) => ({ settled: true, result })),
  new Promise<{ settled: false; result: null }>((resolve) => {
    setTimeout(() => resolve({ settled: false, result: null }), 1_000);
  }),
]);
check('제한 초과 스트리밍 응답 → 본문 종료 전 null',
  oversizedResult.settled && oversizedResult.result === null && Date.now() - oversizedStartedAt < 1_000,
  JSON.stringify({ settled: oversizedResult.settled, elapsedMs: Date.now() - oversizedStartedAt }));

// 6. 어댑터 폴백: kasi 옵트인 + 키 부재 → builtin + kasiFallback (env는 여전히 비어 있음)
mode = 'ok';
const fallback = await analyzeSajuSafe(
  {
    year: 2025, month: 6, day: 1, hour: 9, minute: 30,
    gender: 'female', calendarType: 'lunar', isLeapMonth: true, timezone: 'Asia/Seoul',
  },
  { precisionConfig: { lunarConversionSource: 'kasi' } as any },
);
const conv = (fallback.summary as Record<string, any>).lunarConversion;
check('kasi 옵트인 + 키 부재 → 내장 폴백 (source=builtin, kasiFallback=true)',
  fallback.sajuEnabled === true && conv?.source === 'builtin' && conv?.kasiFallback === true,
  JSON.stringify({ source: conv?.source, kasiFallback: conv?.kasiFallback }));

for (const [k, v] of Object.entries(savedEnv)) {
  if (v !== undefined) process.env[k] = v;
}
server.close();

console.log(`\nKASI lunar API option: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
