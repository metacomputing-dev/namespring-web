/**
 * Characterization benchmark for the mobile ReportDeliveryV1 boundary.
 *
 * This intentionally has no wall-clock pass threshold: CI and mobile devices
 * vary. It enforces transport budgets and prints cold/warm measurements so a
 * regression can be compared with real evidence.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import {
  REPORT_DELIVERY_REQUEST_SCHEMA_V1,
  SpringEngine,
} from '../src/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const namespringData = path.resolve(root, '../../namespring/public/data');
const wasmPath = path.resolve(root, 'node_modules/sql.js/dist/sql-wasm.wasm');
const originalFetch = globalThis.fetch;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith('/data/')) {
    const filePath = path.join(namespringData, url.slice('/data/'.length));
    return fs.existsSync(filePath)
      ? new Response(fs.readFileSync(filePath), { status: 200 })
      : new Response(null, { status: 404 });
  }
  if (url.includes('sql-wasm.wasm') || url === wasmPath) {
    return new Response(fs.readFileSync(wasmPath), { status: 200 });
  }
  return originalFetch(input, init);
};

interface Measurement {
  readonly label: string;
  readonly milliseconds: number;
  readonly bytes: number;
}

async function measure(label: string, work: () => Promise<unknown>): Promise<Measurement> {
  const started = performance.now();
  const value = await work();
  const milliseconds = performance.now() - started;
  const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  return { label, milliseconds: Math.round(milliseconds * 100) / 100, bytes };
}

const engine = new SpringEngine();
for (const repository of [(engine as any).hanjaRepo, (engine as any).fourFrameRepo]) {
  if (repository) repository.wasmUrl = wasmPath;
}
await engine.init();

const subject = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
  targetDate: '2026-07-18',
};
const precision = {
  surfaceNameTrend: true,
  surfacePhoneticEvidence: true,
  surfaceNamingScoreVector: true,
};

const measurements: Measurement[] = [];
measurements.push(await measure('delivery:naming-only:first', () => engine.getReportDelivery({
  ...subject,
  options: { precisionConfig: precision },
  delivery: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{ id: 'naming', depth: 'standard' }],
  },
})));
const sajuOnlyRequest = {
  ...subject,
  delivery: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{
      id: 'saju',
      depth: 'brief',
      timeline: { periods: ['today'], categories: ['overall'] },
    }],
  },
} as const;
measurements.push(await measure('delivery:saju-only:first', () => engine.getReportDelivery(sajuOnlyRequest)));
measurements.push(await measure('delivery:saju-only:repeat', () => engine.getReportDelivery(sajuOnlyRequest)));
const integratedRequest = {
  ...subject,
  options: { precisionConfig: precision },
  delivery: {
    schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
    surfaces: [{
      id: 'integrated' as const,
      depth: 'standard' as const,
      timeline: {
        periods: ['today' as const],
        categories: ['overall', 'wealth', 'health', 'academic', 'romance', 'family'] as const,
      },
    }] as const,
  },
};
measurements.push(await measure('delivery:integrated-today:first', () =>
  engine.getReportDelivery(integratedRequest)));
measurements.push(await measure('delivery:integrated-today:repeat', () =>
  engine.getReportDelivery(integratedRequest)));
measurements.push(await measure('legacy:full-tiered:first', () => engine.getFortuneReport({
  ...subject,
  options: { precisionConfig: { surfaceTieredMatrix: true } },
})));

for (const row of measurements.filter((item) => item.label.startsWith('delivery:'))) {
  assert.ok(row.bytes <= 256 * 1024, `${row.label} exceeds the V1 payload budget`);
}
const integratedBytes = measurements.find((row) => row.label === 'delivery:integrated-today:first')!.bytes;
const legacyBytes = measurements.find((row) => row.label === 'legacy:full-tiered:first')!.bytes;
assert.ok(integratedBytes < legacyBytes,
  `selective integrated payload (${integratedBytes}) must stay below legacy full tiered (${legacyBytes})`);

console.table(measurements.map((row) => ({
  case: row.label,
  ms: row.milliseconds,
  KiB: Math.round((row.bytes / 1024) * 100) / 100,
})));
console.log(`selective/legacy byte ratio: ${Math.round((integratedBytes / legacyBytes) * 10_000) / 100}%`);
engine.close();
