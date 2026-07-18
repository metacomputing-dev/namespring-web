import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_DATA_PATH = path.join(ROOT, 'data', 'inmyeongyong_9389_full.json');
const RECEIPT_PATH = path.join(ROOT, 'data', 'official-hanja-lookup-authority.generated.json');

const LOOKUP_PAGE_URL = 'https://efamily.scourt.go.kr/cs/CsBltnWrtList.do?bltnbordId=0000010';
const LOOKUP_ENDPOINT_URL = 'https://efamily.scourt.go.kr/webhanja/whjsearch';
const RULE_URL = 'https://www.law.go.kr/LSW/lumLsLinkPop.do?chrClsCd=010202&lspttninfSeq=104326';
const PRESS_RELEASE_URL = 'https://www.scourt.go.kr/portal/news/NewsViewAction.work?gubun=6&seqnum=2642';
const SOURCE_INTERPRETATION =
  'The official lookup requires designated readings and limits same-character, popular, and abbreviated forms to glyphs returned by the service. A complete ext=0 snapshot matched all 9,495 local glyph representations and 10,381 non-empty designated-reading pairs.';
const SOURCE_COPYRIGHT_NOTE =
  'Official lookup metadata, counts, and cryptographic digests only; no long source text is reproduced.';

const EXPECTED_STROKE_BUCKETS = Object.freeze([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
  12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
  23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 39, 40,
]);
const EXPECTED_ANNOUNCED_CHARACTER_COUNT = 9_389;
const EXPECTED_LOOKUP_GLYPH_COUNT = 9_495;
const EXPECTED_LOOKUP_PAIR_COUNT = 10_381;
const EXPECTED_RESPONSE_ROW_COUNT = 11_498;
const EXPECTED_GLYPHS_SHA256 = '83c79731d2dd9ba94a4550389459e4e5e5c1ecba9782575db7c660851b14acde';
const EXPECTED_PAIRS_SHA256 = '5ae74ad18c3da9ab09a45cc7663459c8d46849ce44951b6fb48d7ad3a0202df9';
const FETCH_TIMEOUT_MS = 15_000;
const REQUEST_PAUSE_MS = 100;

function fail(message) {
  throw new Error(`Official Hanja authority verification failed: ${message}`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isSingleUnicodeScalar(value) {
  if (typeof value !== 'string' || Array.from(value).length !== 1) return false;
  const codePoint = value.codePointAt(0);
  return codePoint !== undefined && (codePoint < 0xD800 || codePoint > 0xDFFF);
}

function isSingleHangulSyllable(value) {
  return typeof value === 'string' && /^[\uAC00-\uD7A3]$/.test(value);
}

function canonicalize(entries) {
  const normalized = entries
    .map((entry) => ({
      glyph: entry.glyph,
      codePoint: entry.glyph.codePointAt(0),
      readings: [...new Set(entry.readings)].sort(compareCodeUnits),
    }))
    .sort((left, right) => left.codePoint - right.codePoint);
  const glyphs = normalized.map((entry) => entry.glyph).join('');
  const pairsPayload = JSON.stringify(normalized.map((entry) => [entry.glyph, entry.readings]));
  return Object.freeze({
    entries: Object.freeze(normalized),
    glyphs,
    pairsPayload,
    glyphCount: normalized.length,
    pairCount: normalized.reduce((sum, entry) => sum + entry.readings.length, 0),
    glyphsSha256: sha256(glyphs),
    pairsSha256: sha256(pairsPayload),
  });
}

function assertPinnedSummary(summary, label) {
  if (summary.glyphCount !== EXPECTED_LOOKUP_GLYPH_COUNT
    || summary.pairCount !== EXPECTED_LOOKUP_PAIR_COUNT
    || summary.glyphsSha256 !== EXPECTED_GLYPHS_SHA256
    || summary.pairsSha256 !== EXPECTED_PAIRS_SHA256) {
    fail(`${label} does not match the reviewed authority pin`);
  }
}

function readLocalData() {
  let document;
  try {
    document = JSON.parse(fs.readFileSync(LOCAL_DATA_PATH, 'utf8'));
  } catch {
    fail('local full-pool JSON is unreadable');
  }
  if (document?.schemaVersion !== '1.0.0-full'
    || document.totalCount !== EXPECTED_LOOKUP_GLYPH_COUNT
    || !Array.isArray(document.entries)
    || document.entries.length !== EXPECTED_LOOKUP_GLYPH_COUNT) {
    fail('local full-pool JSON has an unexpected shape or count');
  }

  const seen = new Set();
  const entries = document.entries.map((entry, index) => {
    if (!isSingleUnicodeScalar(entry?.hanja)
      || seen.has(entry.hanja)
      || typeof entry.codepoint !== 'string'
      || !/^U\+[0-9A-F]{4,6}$/.test(entry.codepoint)
      || Number.parseInt(entry.codepoint.slice(2), 16) !== entry.hanja.codePointAt(0)
      || !Array.isArray(entry.readings)
      || entry.readings.some((reading) => !isSingleHangulSyllable(reading))
      || new Set(entry.readings).size !== entry.readings.length) {
      fail(`local full-pool entry ${index} is malformed`);
    }
    seen.add(entry.hanja);
    return { glyph: entry.hanja, readings: entry.readings };
  });
  const summary = canonicalize(entries);
  assertPinnedSummary(summary, 'local full-pool data');
  return summary;
}

function sameNumberArray(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function verifyReceipt(receipt, localSummary) {
  const snapshot = receipt?.lookupSnapshot;
  if (receipt?.schemaVersion !== 'spring-ts.official-hanja-lookup-authority.v1'
    || receipt.source?.tier !== 'T5_OFFICIAL'
    || receipt.source?.sourceType !== 'official_court_lookup'
    || receipt.source?.authorityTruthEligible !== true
    || receipt.source?.sourceUrl !== LOOKUP_PAGE_URL
    || receipt.source?.quoteShort !== null
    || receipt.source?.humanInterpretation !== SOURCE_INTERPRETATION
    || receipt.source?.copyrightNote !== SOURCE_COPYRIGHT_NOTE
    || receipt.source?.lookupPageUrl !== LOOKUP_PAGE_URL
    || receipt.source?.lookupEndpointUrl !== LOOKUP_ENDPOINT_URL
    || receipt.source?.ruleUrl !== RULE_URL
    || receipt.source?.pressReleaseUrl !== PRESS_RELEASE_URL
    || !/^\d{4}-\d{2}-\d{2}$/.test(receipt.source?.accessedAt ?? '')
    || receipt.announcedCharacterCount !== EXPECTED_ANNOUNCED_CHARACTER_COUNT
    || receipt.lookupGlyphRepresentationCount !== EXPECTED_LOOKUP_GLYPH_COUNT
    || receipt.lookupRepresentationDelta !== EXPECTED_LOOKUP_GLYPH_COUNT - EXPECTED_ANNOUNCED_CHARACTER_COUNT
    || !sameNumberArray(snapshot?.strokeBuckets, EXPECTED_STROKE_BUCKETS)
    || snapshot?.responseRowCount !== EXPECTED_RESPONSE_ROW_COUNT
    || snapshot.distinctGlyphCount !== EXPECTED_LOOKUP_GLYPH_COUNT
    || snapshot.distinctNonEmptyGlyphReadingPairCount !== EXPECTED_LOOKUP_PAIR_COUNT
    || snapshot.glyphsSha256 !== EXPECTED_GLYPHS_SHA256
    || snapshot.glyphReadingPairsSha256 !== EXPECTED_PAIRS_SHA256
    || snapshot.everyReturnedRowMarkedForPersonalName !== true
    || snapshot.localMirrorGlyphDifferenceCount !== 0
    || snapshot.localMirrorGlyphReadingPairDifferenceCount !== 0
    || receipt.reconciliationStatus !== 'OFFICIAL_LOOKUP_PARITY_CONFIRMED') {
    fail('committed official lookup receipt is malformed or stale');
  }
  if (snapshot.glyphsSha256 !== localSummary.glyphsSha256
    || snapshot.glyphReadingPairsSha256 !== localSummary.pairsSha256) {
    fail('local full-pool data diverges from the official lookup receipt');
  }
}

function readAndVerifyReceipt(localSummary) {
  let receipt;
  try {
    receipt = JSON.parse(fs.readFileSync(RECEIPT_PATH, 'utf8'));
  } catch {
    fail('committed official lookup receipt is missing or unreadable');
  }
  verifyReceipt(receipt, localSummary);
  return receipt;
}

async function fetchJson(url, label) {
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    fail(`${label} request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) fail(`${label} returned HTTP ${response.status}`);
  try {
    return await response.json();
  } catch {
    fail(`${label} did not return valid JSON`);
  }
}

function endpointUrl(parameters) {
  const url = new URL(LOOKUP_ENDPOINT_URL);
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, String(value));
  }
  return url;
}

function parseApiReadingList(value) {
  if (typeof value !== 'string') fail('official lookup row has a non-string reading');
  const readings = value
    .split(',')
    .map((reading) => reading.trim())
    .filter(Boolean);
  if (readings.some((reading) => !isSingleHangulSyllable(reading))) {
    fail('official lookup row has a malformed designated reading');
  }
  return readings;
}

async function fetchOfficialSnapshot() {
  const strokeRows = await fetchJson(endpointUrl({
    mode: 'listTotstroke',
    ksnd: '',
    ext: 0,
  }), 'stroke-bucket lookup');
  if (!Array.isArray(strokeRows)) fail('stroke-bucket lookup has an unexpected shape');
  const strokeBuckets = [...new Set(strokeRows.map((row) => Number(row?.totstroke)))]
    .sort((left, right) => left - right);
  if (!sameNumberArray(strokeBuckets, EXPECTED_STROKE_BUCKETS)) {
    fail('official stroke-bucket set changed');
  }

  const byGlyph = new Map();
  let responseRowCount = 0;
  for (const stroke of strokeBuckets) {
    const response = await fetchJson(endpointUrl({
      mode: 'listUnicodeByTotstroke',
      totstroke: stroke,
      ext: 0,
      ksnd: '',
      pgmode: 1,
      pgno: 1,
      pgsize: 10000,
    }), `stroke ${stroke} lookup`);
    if (Number(response?.errno) !== 0
      || Number(response?.pglast) !== 1
      || !Array.isArray(response?.resultlist)
      || Number(response?.resultcount) !== response.resultlist.length) {
      fail(`stroke ${stroke} lookup has an unexpected response contract`);
    }

    for (const row of response.resultlist) {
      responseRowCount += 1;
      if (!/^[0-9A-Fa-f]{4,6}$/.test(String(row?.cd ?? ''))
        || Number(row?.totstroke) !== stroke
        || Number(row?.isin) !== 1
        || Number(row?.ex) !== 1) {
        fail(`stroke ${stroke} lookup returned a non-authority row`);
      }
      const codePoint = Number.parseInt(row.cd, 16);
      if (!Number.isInteger(codePoint) || codePoint > 0x10FFFF
        || (codePoint >= 0xD800 && codePoint <= 0xDFFF)) {
        fail(`stroke ${stroke} lookup returned an invalid Unicode scalar`);
      }
      const glyph = String.fromCodePoint(codePoint);
      let readings = byGlyph.get(glyph);
      if (!readings) {
        readings = new Set();
        byGlyph.set(glyph, readings);
      }
      for (const reading of parseApiReadingList(row.ineum)) readings.add(reading);
    }
    await new Promise((resolve) => setTimeout(resolve, REQUEST_PAUSE_MS));
  }

  const summary = canonicalize([...byGlyph].map(([glyph, readings]) => ({
    glyph,
    readings: [...readings],
  })));
  assertPinnedSummary(summary, 'live official lookup');
  return { summary, strokeBuckets, responseRowCount };
}

function buildReceipt(live) {
  return {
    schemaVersion: 'spring-ts.official-hanja-lookup-authority.v1',
    source: {
      tier: 'T5_OFFICIAL',
      sourceType: 'official_court_lookup',
      authorityTruthEligible: true,
      sourceUrl: LOOKUP_PAGE_URL,
      quoteShort: null,
      humanInterpretation: SOURCE_INTERPRETATION,
      copyrightNote: SOURCE_COPYRIGHT_NOTE,
      lookupPageUrl: LOOKUP_PAGE_URL,
      lookupEndpointUrl: LOOKUP_ENDPOINT_URL,
      ruleUrl: RULE_URL,
      pressReleaseUrl: PRESS_RELEASE_URL,
      accessedAt: new Date().toISOString().slice(0, 10),
      requestPolicy: 'ext=0; enumerate every official total-stroke bucket; retain only isin=1 rows',
    },
    announcedCharacterCount: EXPECTED_ANNOUNCED_CHARACTER_COUNT,
    lookupGlyphRepresentationCount: EXPECTED_LOOKUP_GLYPH_COUNT,
    lookupRepresentationDelta: EXPECTED_LOOKUP_GLYPH_COUNT - EXPECTED_ANNOUNCED_CHARACTER_COUNT,
    lookupSnapshot: {
      strokeBuckets: live.strokeBuckets,
      responseRowCount: live.responseRowCount,
      distinctGlyphCount: live.summary.glyphCount,
      distinctNonEmptyGlyphReadingPairCount: live.summary.pairCount,
      glyphsSha256: live.summary.glyphsSha256,
      glyphReadingPairsSha256: live.summary.pairsSha256,
      everyReturnedRowMarkedForPersonalName: true,
      localMirrorGlyphDifferenceCount: 0,
      localMirrorGlyphReadingPairDifferenceCount: 0,
    },
    reconciliationStatus: 'OFFICIAL_LOOKUP_PARITY_CONFIRMED',
    interpretation: 'The announced 9,389-character denominator and the 9,495 Unicode/PUA glyph representations returned by the official lookup are different counting layers. Exact glyph and designated-reading parity is confirmed; the 106-representation delta is not asserted to be an Appendix 2 mapping without a separate canonical extraction.',
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const offlineCheck = args.size === 1 && args.has('--check');
  const liveRefresh = args.has('--refresh')
    && [...args].every((arg) => arg === '--refresh' || arg === '--write');
  if (!offlineCheck && !liveRefresh) {
    console.error('Usage: node tools/fetch_official_hanja_authority.mjs --check | --refresh [--write]');
    process.exitCode = 2;
    return;
  }

  const localSummary = readLocalData();
  if (offlineCheck) {
    const receipt = readAndVerifyReceipt(localSummary);
    console.log(`Verified official lookup receipt from ${receipt.source.accessedAt}: ${localSummary.glyphCount} glyphs / ${localSummary.pairCount} non-empty designated-reading pairs.`);
    return;
  }

  const live = await fetchOfficialSnapshot();
  if (live.summary.glyphs !== localSummary.glyphs
    || live.summary.pairsPayload !== localSummary.pairsPayload) {
    fail('live official lookup differs from the committed local full-pool data');
  }
  const receipt = buildReceipt(live);
  verifyReceipt(receipt, localSummary);
  if (args.has('--write')) {
    fs.writeFileSync(RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${path.relative(ROOT, RECEIPT_PATH)}.`);
  }
  console.log(`Live official lookup parity: ${live.summary.glyphCount} glyphs / ${live.summary.pairCount} non-empty designated-reading pairs / ${live.responseRowCount} raw rows.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
