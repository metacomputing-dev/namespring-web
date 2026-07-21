/**
 * name-evidence-store.ts -- 슬롯 저장소 (커밋 대상).
 *
 * data/generation/name-evidence/slots/<slotId>.json — 슬롯당 1파일, 고정 키
 * 순서 pretty-print → git diff가 슬롯 단위로 깔끔하고, D-1(사격 공식) 결정
 * 변경 시 폐기는 `git rm …/S6.*` 한 줄이다. 파일명은 slotId(ASCII)라서
 * Windows/git 모두 안전.
 *
 * 저장 레코드는 check_no_ai_policy.mjs의 AI 저작 텍스트 규칙을 준수한다
 * (sourceTier T2 + ai_authored_insight_text + authorityTruthEligible:false).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOT_SCHEMA_VERSION, SLOT_SOURCE_TIER } from './name-evidence-schema.js';
import type { NameEvidenceCase, StoredNameEvidenceSlot } from './name-evidence-schema.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const STORE_DIR = path.resolve(HERE, '../../data/generation/name-evidence/slots');

/** 고정 키 순서 직렬화 — 재저장 시에도 diff가 안정적. */
const STORED_KEY_ORDER: readonly string[] = [
  'schemaVersion', 'slotId', 'family', 'role', 'key', 'plain', 'expert', 'principle',
  'isAdverse', 'allowedVars', 'aiGenerated', 'sourceTier', 'sourceNote', 'keyProvenance',
];

function stableStringify(slot: StoredNameEvidenceSlot): string {
  const ordered: Record<string, unknown> = {};
  for (const k of STORED_KEY_ORDER) {
    const v = (slot as unknown as Record<string, unknown>)[k];
    if (v !== undefined) ordered[k] = v;
  }
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

export function loadAllSlots(): Map<string, StoredNameEvidenceSlot> {
  const out = new Map<string, StoredNameEvidenceSlot>();
  if (!fs.existsSync(STORE_DIR)) return out;
  for (const f of fs.readdirSync(STORE_DIR)) {
    if (!f.endsWith('.json')) continue;
    const raw = JSON.parse(fs.readFileSync(path.join(STORE_DIR, f), 'utf-8')) as StoredNameEvidenceSlot;
    if (raw.schemaVersion !== SLOT_SCHEMA_VERSION) continue;
    out.set(raw.slotId, raw);
  }
  return out;
}

export function saveSlot(slot: StoredNameEvidenceSlot): string {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  const file = path.join(STORE_DIR, `${slot.slotId}.json`);
  fs.writeFileSync(file, stableStringify(slot), 'utf-8');
  return file;
}

export function buildStoredSlot(
  c: NameEvidenceCase,
  generated: { plain: string; expert: string; principle?: string },
  sourceNote: string,
): StoredNameEvidenceSlot {
  return {
    schemaVersion: SLOT_SCHEMA_VERSION,
    slotId: c.slotId,
    family: c.family,
    role: c.role,
    key: c.key,
    plain: generated.plain,
    expert: generated.expert,
    ...(generated.principle ? { principle: generated.principle } : {}),
    isAdverse: c.spec.isAdverse,
    allowedVars: c.spec.allowedVars,
    aiGenerated: true,
    sourceTier: SLOT_SOURCE_TIER,
    sourceNote,
    ...(c.family === 'S6' ? { keyProvenance: 'engine-current-formula-b' as const } : {}),
  };
}

export function partitionRequests(
  requests: readonly NameEvidenceCase[],
  store: ReadonlyMap<string, StoredNameEvidenceSlot>,
): { found: NameEvidenceCase[]; missing: NameEvidenceCase[] } {
  const found: NameEvidenceCase[] = [];
  const missing: NameEvidenceCase[] = [];
  for (const r of requests) (store.has(r.slotId) ? found : missing).push(r);
  return { found, missing };
}
