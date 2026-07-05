/**
 * insight-facts-card.ts -- 미사용 엔진 출력의 정규화 방출 (해석 확장 레이어).
 *
 * 신살·공망·합충형파해·지장간·대운 정체 등 엔진이 이미 계산하지만 유료
 * 서사에 쓰이지 않던 값을, 타입이 고정된 fact 목록으로 방출한다.
 * **신규 계산은 하지 않는다** — SajuSummary에 이미 실린 값만 읽는다.
 *
 * 각 fact에는 `data/articles/insights/*.insights.json`에서 factId 일치 해석이
 * 있으면 붙는다. 초기엔 해석 파일이 비어 있으므로 interpretation 없는 fact만
 * 방출되고, 프론트는 해석 있는 fact만 렌더 → 화면 무회귀. 해석을 충전할수록
 * 리포트가 점진적으로 풍성해진다 (docs/DESIGN_LIFEFLOW_INSIGHTS.md).
 *
 * 게이팅: 성인 대상자 전용 (미성년 페이로드 제외 — 성인성 신살 필터 규칙이
 * 정의되기 전까지 보수적으로 차단).
 */
import type { SajuSummary } from '../../types.js';
import { getInsightInterpretation, type InsightInterpretation } from '../tiered/insight-registry.js';
import { SHINSAL_ENCYCLOPEDIA } from '../knowledge/shinsalEncyclopedia.js';
import { STEM_BY_CODE, BRANCH_BY_CODE } from '../common/elementMaps.js';

export type InsightFactKind =
  | 'shinsal' | 'gongmang' | 'stemRelation' | 'branchRelation'
  | 'hiddenStems' | 'daeunPillar';

export interface InsightFact {
  /** 안정적 조회 키 — 해석 파일의 entries[].factId와 정확 일치로 매칭. */
  readonly factId: string;
  readonly kind: InsightFactKind;
  /** 엔진 원값 표시용 라벨 (예: '천을귀인', '寅巳 형'). */
  readonly label: string;
  /** 부가 원값 (위치·등급·멤버 등 — 표시용 평탄 문자열). */
  readonly detail?: string;
  readonly members?: readonly string[];
  readonly grade?: string;
  /** 매칭된 해석 (없으면 렌더 생략 대상). */
  readonly interpretation?: InsightInterpretation;
}

export interface InsightFactsCard {
  readonly title: string;
  readonly facts: readonly InsightFact[];
}

/** 신살 백과(사주 평가 보고서의 저작 자산)를 한글명으로 조회하는 폴백 맵. */
const SHINSAL_BY_KOREAN: ReadonlyMap<string, InsightInterpretation> = (() => {
  const map = new Map<string, InsightInterpretation>();
  for (const entry of Object.values(SHINSAL_ENCYCLOPEDIA)) {
    if (!entry?.korean || !entry.meaning) continue;
    map.set(entry.korean, {
      factId: `shinsal.${entry.korean}`,
      text: entry.meaning,
      expertText: Array.isArray(entry.description) ? entry.description.join(' ') : undefined,
    });
  }
  return map;
})();

/**
 * 해석 조회 체인: ①insights 파일의 정확 factId → ②타입 레벨 폴백
 * (예: `branchRelation.형`) → ③신살은 백과 자동 연결.
 * 어디에도 없으면 interpretation 없이 방출(프론트가 렌더 생략).
 */
function withInterpretation(
  fact: Omit<InsightFact, 'interpretation'>,
  fallbackIds: readonly string[] = [],
): InsightFact {
  let interpretation = getInsightInterpretation(fact.factId);
  for (const id of fallbackIds) {
    if (interpretation) break;
    interpretation = getInsightInterpretation(id);
  }
  if (!interpretation && fact.kind === 'shinsal') {
    // 이름 변형 허용: 엔진 hit type '도화' ↔ 백과 '도화살' 류.
    interpretation = SHINSAL_BY_KOREAN.get(fact.label)
      ?? SHINSAL_BY_KOREAN.get(`${fact.label}살`)
      ?? null;
  }
  return interpretation ? { ...fact, interpretation } : fact;
}

export function buildInsightFactsCard(saju: SajuSummary): InsightFactsCard | null {
  const facts: InsightFact[] = [];

  // ── 신살 (ShinsalHitSummary: type/position/grade/weightedScore) ──
  for (const hit of saju.shinsalHits ?? []) {
    if (!hit?.type) continue;
    facts.push(withInterpretation({
      factId: `shinsal.${hit.type}`,
      kind: 'shinsal',
      label: hit.type,
      detail: hit.position ? `${hit.position}` : undefined,
      grade: typeof hit.grade === 'string' ? hit.grade : undefined,
    }));
  }

  // ── 공망 ([지지, 지지] | null) ──
  if (Array.isArray(saju.gongmang) && saju.gongmang.length === 2) {
    facts.push(withInterpretation({
      factId: `gongmang.${[saju.gongmang[0], saju.gongmang[1]].sort().join('-')}`,
      kind: 'gongmang',
      label: '공망',
      members: [saju.gongmang[0], saju.gongmang[1]],
      detail: `${saju.gongmang[0]}, ${saju.gongmang[1]}`,
    }, ['gongmang']));
  }

  // ── 천간 관계 (합/충/극 — CheonganRelationSummary) ──
  for (const rel of saju.cheonganRelations ?? []) {
    if (!rel?.type || !Array.isArray(rel.stems) || rel.stems.length === 0) continue;
    facts.push(withInterpretation({
      factId: `stemRelation.${rel.type}.${[...rel.stems].sort().join('-')}`,
      kind: 'stemRelation',
      label: `천간 ${rel.type}`,
      members: rel.stems,
      detail: rel.note ?? undefined,
    }, [`stemRelation.${rel.type}`]));
  }

  // ── 지지 관계 (합/충/형/파/해/원진 — JijiRelationSummary) ──
  for (const rel of saju.jijiRelations ?? []) {
    if (!rel?.type || !Array.isArray(rel.branches) || rel.branches.length === 0) continue;
    facts.push(withInterpretation({
      factId: `branchRelation.${rel.type}.${[...rel.branches].sort().join('-')}`,
      kind: 'branchRelation',
      label: `지지 ${rel.type}`,
      members: rel.branches,
      detail: rel.note ?? undefined,
    }, [`branchRelation.${rel.type}`]));
  }

  // ── 지장간 (tenGodAnalysis.byPosition[pos].hiddenStems — 런타임 파싱) ──
  const tenGod = (saju as Record<string, unknown>)['tenGodAnalysis'];
  const byPosition = tenGod && typeof tenGod === 'object'
    ? (tenGod as Record<string, unknown>)['byPosition']
    : null;
  if (byPosition && typeof byPosition === 'object') {
    for (const [position, cell] of Object.entries(byPosition as Record<string, unknown>)) {
      if (!cell || typeof cell !== 'object') continue;
      const hidden = (cell as Record<string, unknown>)['hiddenStems'];
      if (!Array.isArray(hidden) || hidden.length === 0) continue;
      const names = hidden
        .map((h) => (h && typeof h === 'object' ? String((h as Record<string, unknown>).stem ?? '') : ''))
        .filter(Boolean);
      if (!names.length) continue;
      const positionKo: Record<string, string> = { YEAR: '년주', MONTH: '월주', DAY: '일주', HOUR: '시주' };
      facts.push(withInterpretation({
        factId: `hiddenStems.${position}`,
        kind: 'hiddenStems',
        label: `${positionKo[position.toUpperCase()] ?? position} 지장간`,
        members: names,
      }));
    }
  }

  // ── 대운 정체 (daeunInfo — 현재 대운 간지; 신규 계산 없이 원값만) ──
  const daeunRaw = (saju as Record<string, unknown>)['daeunInfo'];
  const pillars = daeunRaw && typeof daeunRaw === 'object'
    ? (daeunRaw as Record<string, unknown>)['pillars']
    : null;
  if (Array.isArray(pillars)) {
    for (const [i, p] of pillars.entries()) {
      if (!p || typeof p !== 'object') continue;
      const pp = p as Record<string, unknown>;
      if (typeof pp.stem !== 'string' || typeof pp.branch !== 'string') continue;
      const stemKo = STEM_BY_CODE[pp.stem.toUpperCase()]?.hangul ?? pp.stem;
      const branchKo = BRANCH_BY_CODE[pp.branch.toUpperCase()]?.hangul ?? pp.branch;
      facts.push(withInterpretation({
        factId: `daeunPillar.${pp.stem}-${pp.branch}`,
        kind: 'daeunPillar',
        label: `${i + 1}대운 ${stemKo}${branchKo}`,
        detail: typeof pp.startAge === 'number' && typeof pp.endAge === 'number'
          ? `${Math.floor(pp.startAge)}세~${Math.floor(pp.endAge)}세`
          : undefined,
      }));
    }
  }

  if (facts.length === 0) return null;
  return { title: '전문 인사이트 원자료', facts };
}
