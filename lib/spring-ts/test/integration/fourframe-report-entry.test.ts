import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getFourframeMeaningByNumber } from '../../../seed-ts/src/fourframe-catalog.js';
import { sanitizeImmutableServiceValue } from '../../../seed-ts/src/service-text-policy.js';
import { SpringEngine, type NamingReport } from '../../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url: string | URL | Request, options?: RequestInit) => {
  const urlText = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlText.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlText.slice('/data/'.length));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlText.includes('sql-wasm.wasm') || urlText === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  return originalFetch(url, options);
};

function assertImmutablePersonalizedMeanings(
  report: NamingReport,
  expectedName: string,
): void {
  const frames = report.analysis.fourFrame.frames;
  const meanings = frames.map((frame) => frame.meaning);
  assert.equal(meanings.length, 4);
  for (const [index, meaning] of meanings.entries()) {
    assert.ok(meaning);
    assert.deepEqual(
      meaning,
      sanitizeImmutableServiceValue(
        getFourframeMeaningByNumber(frames[index].strokeSum),
        expectedName,
      ),
    );
    assert.equal(Object.isFrozen(meaning), true);
    assert.equal(Object.isFrozen(meaning.personality_traits), true);
    assert.equal(Object.isFrozen(meaning.suitable_career), true);
  }

  const serialized = JSON.stringify(meanings);
  assert.equal(serialized.includes('[성함]'), false);
  assert.equal(serialized.includes(expectedName), true);
}

const engine = new SpringEngine();
for (const repository of [(engine as any).hanjaRepo, (engine as any).fourFrameRepo]) {
  repository.wasmUrl = WASM_PATH;
}

try {
  await engine.init();
  const hanjaReport = await engine.getNamingReport({
    birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
    surname: [{ hangul: '최', hanja: '崔' }],
    givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
  });
  const pureHangulReport = await engine.getNamingReport({
    birth: { year: 2024, month: 3, day: 1, hour: 9, minute: 0, gender: 'male' },
    surname: [{ hangul: '박' }],
    givenName: [{ hangul: '민' }, { hangul: '준' }],
    options: { pureHangulNameMode: 'on' },
  });

  assertImmutablePersonalizedMeanings(hanjaReport, '최성수');
  assertImmutablePersonalizedMeanings(pureHangulReport, '박민준');
  assert.equal(Object.hasOwn(engine as object, 'fourFrameMeaningByNumber'), false);
} finally {
  engine.close();
  globalThis.fetch = originalFetch;
}

console.log('Four-frame report entry reuse: PASS');
