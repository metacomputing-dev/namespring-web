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

export interface InsightInterpretation {
  readonly factId: string;
  /** 평문 한 줄 해석 (해요체). */
  readonly text: string;
  /** 전문가 tier 보강 해석 (선택, #{태그} 직조 가능). */
  readonly expertText?: string;
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

function loadAll(): Map<string, InsightInterpretation> {
  if (cached) return cached;
  const map = new Map<string, InsightInterpretation>();

  let modules: Record<string, unknown> = {};
  try {
    // Vite(브라우저)와 vitest 모두 지원. 파일 4~5개 소량이라 eager 인라인해도
    // 번들 영향이 미미하다 — 충전이 커지면 pack 방식으로 전환한다(설계 문서 참조).
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
      if (isValidEntry(entry)) map.set(entry.factId, entry);
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
