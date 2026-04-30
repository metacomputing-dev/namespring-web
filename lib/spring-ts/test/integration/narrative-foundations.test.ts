/**
 * test/integration/narrative-foundations.test.ts
 *
 * Verifies PR9 narrative-foundations end-to-end:
 *   1. SajuSummary.axisStrength is populated by the adapter.
 *   2. OverviewSummaryCard.axisStrength is forwarded to the report.
 *   3. OverviewSummaryCard.evidence has rows with axis / claim /
 *      supportingFeatures and a yongshin row carries strength tier.
 *   4. The 4-tier mapping (definite / practical / candidate / deferred)
 *      is applied based on upstream confidences.
 *
 * Run: npm run test:narrative
 *      (or: npx tsx test/integration/narrative-foundations.test.ts)
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

import { SpringEngine } from '../../src/index.js';

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) {
  if (!repo) continue;
  (repo as any).wasmUrl = WASM_PATH;
}
await engine.init();

const fortune = await engine.getFortuneReport({
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
});

const sajuReport = await engine.getSajuReport({
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
  surname: [{ hangul: '최', hanja: '崔' }],
});

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

console.log('PR9 narrative foundations\n');
console.log('axisStrength on SajuSummary:', sajuReport.axisStrength);
console.log('evidence rows on overview  :', JSON.stringify(fortune.overviewSummary.evidence?.map(r => ({ axis: r.axis, strength: r.strength })), null, 2));
console.log('');

// ── (1) SajuSummary surfaces axisStrength ─────────────────────────────────
const summaryAxis = (sajuReport as any).axisStrength;
check('SajuSummary.axisStrength populated',
  summaryAxis != null && typeof summaryAxis === 'object');

const VALID_TIERS = ['definite', 'practical', 'candidate', 'deferred'] as const;
type Tier = typeof VALID_TIERS[number];
function isTier(v: unknown): v is Tier {
  return typeof v === 'string' && (VALID_TIERS as readonly string[]).includes(v);
}

check('axisStrength.yongshin is one of 4 tiers',
  isTier(summaryAxis?.yongshin), `${summaryAxis?.yongshin}`);
check('axisStrength.gyeokguk is one of 4 tiers',
  isTier(summaryAxis?.gyeokguk), `${summaryAxis?.gyeokguk}`);
check('axisStrength.strength is one of 4 tiers',
  isTier(summaryAxis?.strength), `${summaryAxis?.strength}`);

// ── (2) OverviewSummaryCard forwards axisStrength ─────────────────────────
const cardAxis = fortune.overviewSummary.axisStrength;
check('OverviewSummaryCard.axisStrength forwarded',
  cardAxis != null && cardAxis.yongshin === summaryAxis?.yongshin,
  `${cardAxis?.yongshin}=${summaryAxis?.yongshin}`);

// ── (3) Evidence rows ─────────────────────────────────────────────────────
const evidence = fortune.overviewSummary.evidence;
check('OverviewSummaryCard.evidence is non-empty array',
  Array.isArray(evidence) && evidence.length >= 2,
  `${evidence?.length ?? 0} rows`);

if (Array.isArray(evidence)) {
  check('every evidence row has axis + claim + supportingFeatures',
    evidence.every(r =>
      typeof r.axis === 'string' && r.axis.length > 0
      && typeof r.claim === 'string' && r.claim.length > 0
      && Array.isArray(r.supportingFeatures)
    ));

  const yongshinRow = evidence.find(r => r.axis === 'yongshin');
  check('yongshin row exists',
    yongshinRow != null);
  check('yongshin row carries 4-tier strength',
    yongshinRow != null && isTier(yongshinRow.strength),
    `${yongshinRow?.strength}`);

  const strengthRow = evidence.find(r => r.axis === 'strength');
  check('strength row exists',
    strengthRow != null);

  const dayMasterRow = evidence.find(r => r.axis === 'dayMaster');
  check('dayMaster row exists',
    dayMasterRow != null);
}

// ── (4) Hedge wording surfaces only when yongshin tier is candidate / deferred ─
if (Array.isArray(evidence)) {
  const yongshinRow = evidence.find(r => r.axis === 'yongshin');
  const isHedgedTier = yongshinRow?.strength === 'candidate' || yongshinRow?.strength === 'deferred';
  const hedgePhrase = '다만 용신 신뢰도가 낮은 편';
  if (isHedgedTier) {
    check('low-confidence yongshin → hedge wording present',
      yongshinRow!.claim.includes(hedgePhrase));
  } else {
    check('high-confidence yongshin → no hedge wording',
      !yongshinRow!.claim.includes(hedgePhrase),
      `tier=${yongshinRow?.strength}, no hedge`);
  }
}

engine.close();

console.log(`\nNarrative foundations: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
