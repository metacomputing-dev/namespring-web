/**
 * insight-registry.ts -- 인사이트 해석(interpretation) 레지스트리.
 *
 * `data/articles/insights/<domain>.insights.json` 파일들을 로드한다.
 * 파일 확장자가 `.insights.json`이라 기존 article-registry의
 * `**\/*.articles.json` glob·게이트와 절대 겹치지 않는다.
 *
 * 해석은 factId 정확 일치로 조회하며, 파일이 비어 있으면(초기 상태)
 * 어떤 fact에도 해석이 붙지 않아 렌더에 아무것도 나타나지 않는다(무회귀).
 * 해석 충전은 별도 검증기를 거쳐 진행한다 (docs/DESIGN_LIFEFLOW_INSIGHTS.md §Phase 3).
 */

import { snapshotJsonValue } from './immutable-json-snapshot.js';

export interface InsightInterpretation {
  readonly factId: string;
  /** 평문 한 줄 해석 (해요체). */
  readonly text: string;
  /**
   * 상세 표시용 보강 해석 (선택, #{태그} 직조 가능).
   *
   * `expertText`는 표시 상세도를 뜻할 뿐 전문가 검증이나 권위 승인을 뜻하지
   * 않는다. 권위 적격성은 반드시 `sourceTier.authorityTruthEligible`로 판단한다.
   */
  readonly expertText?: string;
  /** AI-authored content provenance. Present on newly-authored entries. */
  readonly aiGenerated?: boolean;
  readonly sourceTier?: {
    readonly tier: string;
    readonly sourceType: string;
    readonly sourceUrl: string | null;
    readonly accessedAt: string;
    readonly quoteShort: string | null;
    readonly humanInterpretation: string;
    readonly copyrightNote: string;
    readonly authorityTruthEligible: boolean;
  };
}

interface InsightsFile {
  readonly schemaVersion: string;
  readonly domain: string;
  readonly entries: readonly InsightInterpretation[];
}

function isValidFile(value: unknown): value is InsightsFile {
  if (!value || typeof value !== 'object') return false;
  const f = value as Record<string, unknown>;
  return f.schemaVersion === 'spring-ts.insights.v1' && Array.isArray(f.entries);
}

function isValidEntry(value: unknown): value is InsightInterpretation {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return typeof e.factId === 'string' && e.factId.length > 0
    && typeof e.text === 'string' && e.text.length > 0;
}

let cached: Map<string, InsightInterpretation> | null = null;

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}
function isNodeRuntime(): boolean {
  return !isBrowserRuntime() && typeof process !== 'undefined' && Boolean(process.versions?.node);
}

// Node(테스트·SSR): fs 직독 — import.meta.glob은 Vite 전용이라 여기선 안 잡힌다.
// generated-registry와 동일한 top-level 조건부 import 패턴.
const nodeBuiltins = isNodeRuntime()
  ? await (async () => {
    const [fs, path, url] = await Promise.all([import('node:fs'), import('node:path'), import('node:url')]);
    return { fs, path, fileURLToPath: url.fileURLToPath };
  })()
  : null;

function loadFromFs(map: Map<string, InsightInterpretation>): void {
  if (!nodeBuiltins) return;
  try {
    const dir = nodeBuiltins.path.resolve(
      nodeBuiltins.path.dirname(nodeBuiltins.fileURLToPath(import.meta.url)),
      '../../../data/articles/insights',
    );
    if (!nodeBuiltins.fs.existsSync(dir)) return;
    for (const f of nodeBuiltins.fs.readdirSync(dir)) {
      if (!f.endsWith('.insights.json')) continue;
      try {
        const mod: unknown = JSON.parse(nodeBuiltins.fs.readFileSync(nodeBuiltins.path.join(dir, f), 'utf-8'));
        if (!isValidFile(mod)) continue;
        for (const entry of mod.entries) {
          if (isValidEntry(entry)) {
            map.set(entry.factId, snapshotJsonValue(entry));
          }
        }
      } catch { /* skip malformed file */ }
    }
  } catch { /* leave empty */ }
}

function loadAll(): Map<string, InsightInterpretation> {
  if (cached) return cached;
  const map = new Map<string, InsightInterpretation>();

  if (nodeBuiltins) {
    loadFromFs(map);
    cached = map;
    return map;
  }

  let modules: Record<string, unknown> = {};
  try {
    // Vite(브라우저): eager 인라인. 파일 소량이라 번들 영향 미미 —
    // 충전이 커지면 pack 방식으로 전환한다(설계 문서 참조).
    modules = import.meta.glob('../../../data/articles/insights/*.insights.json', {
        eager: true,
      }) as Record<string, unknown>;
  } catch {
    modules = {};
  }

  for (const raw of Object.values(modules)) {
    // eager JSON 모듈은 default export에 실린다 (article-registry와 동일 처리).
    const mod = raw && typeof raw === 'object' && 'default' in (raw as Record<string, unknown>)
      ? (raw as Record<string, unknown>).default
      : raw;
    if (!isValidFile(mod)) continue;
    for (const entry of mod.entries) {
      if (isValidEntry(entry)) {
        map.set(entry.factId, snapshotJsonValue(entry));
      }
    }
  }
  cached = map;
  return map;
}

/** factId에 대한 해석을 반환. 없으면 null (→ 렌더 생략). */
export function getInsightInterpretation(factId: string): InsightInterpretation | null {
  return loadAll().get(factId) ?? null;
}

/** Test-only. */
export function _clearInsightCacheForTesting(): void {
  cached = null;
}
