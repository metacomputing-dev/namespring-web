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
import {
  daeunDisplayOffset,
  resolveDaeunDisplayInterval,
} from '../common/daeun-display.js';

export type InsightFactKind =
  | 'shinsal' | 'gongmang' | 'stemRelation' | 'branchRelation'
  | 'hiddenStems' | 'sibiUnseong' | 'daeunPillar';

/** 독자 중심 그룹 — 나열이 아니라 읽는 결로 묶는다. */
export type InsightGroup = 'boon' | 'tension' | 'space';

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
  /** 도움(boon) / 긴장(tension) / 여백(space) — 프론트 그룹핑용. */
  readonly group?: InsightGroup;
  /** 가중치 기반 큐레이션 상위 항목 (기본 노출 대상, 최대 6개). */
  readonly highlight?: boolean;
  /** 엔진 가중 원값(신살 weightedScore 등) — 주요도 정렬의 입력. */
  readonly score?: number;
  /** 주요도 0~1 (weightOf/100) — 프론트가 테두리·배경 농도에 매핑. */
  readonly salience?: number;
}

export interface InsightFactsCard {
  readonly title: string;
  readonly facts: readonly InsightFact[];
}

/** 신살 한글명 → 길신 여부 (백과 type 'auspicious' 기준 + 이름 휴리스틱 폴백). */
const AUSPICIOUS_BY_KOREAN: ReadonlySet<string> = (() => {
  const set = new Set<string>();
  for (const entry of Object.values(SHINSAL_ENCYCLOPEDIA)) {
    if (entry?.korean && entry.type === 'auspicious') set.add(entry.korean);
  }
  return set;
})();

function shinsalGroup(label: string): InsightGroup {
  if (AUSPICIOUS_BY_KOREAN.has(label) || AUSPICIOUS_BY_KOREAN.has(`${label}살`)) return 'boon';
  if (/귀인|천덕|월덕|덕수|천월덕|천의|천사|록신|반안|장성|홍란|천희|금여|복성|학당|문창|문곡/.test(label)) return 'boon';
  return 'tension';
}

function relationGroup(type: string): InsightGroup {
  return /합/.test(type) ? 'boon' : 'tension';
}

/**
 * 큐레이션: 실제 상담처럼 "특기할 것"만 기본 노출로 올린다 (최대 6개, 결정적).
 * 우선순위 — ①겹침 관계(같은 지지쌍에 형·해 등 이중 신호) ②천간충
 * ③삼합/방합(국 형성) ④공망 ⑤A급 신살(최대 3개). 해석 없는 fact는 제외.
 */
function markHighlights(facts: InsightFact[]): InsightFact[] {
  const memberKey = (f: InsightFact): string | null =>
    f.members && f.members.length >= 2 ? [...f.members].sort().join('-') : null;

  // 같은 멤버 조합에 관계 신호가 2개 이상 겹치는 지지쌍 찾기 (예: 인사 형+해)
  const pairCount = new Map<string, number>();
  for (const f of facts) {
    if (f.kind !== 'branchRelation' || !f.interpretation) continue;
    const key = memberKey(f);
    if (key) pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
  }

  const priorityOf = (f: InsightFact): number => {
    if (!f.interpretation) return -1;
    if (f.kind === 'branchRelation') {
      const key = memberKey(f);
      if (key && (pairCount.get(key) ?? 0) >= 2) return 100;
      if (f.label.includes('삼합')) return 85;
      if (f.label.includes('방합')) return 80;
      if (f.label.includes('충')) return 70;
      return 0;
    }
    if (f.kind === 'stemRelation') return f.label.includes('충') ? 90 : 60;
    if (f.kind === 'gongmang') return 75;
    if (f.kind === 'shinsal') return f.grade === 'A' ? 40 : 0;
    return 0;
  };

  const ranked = facts
    .map((f, index) => ({ f, index, priority: priorityOf(f) }))
    .filter((x) => x.priority > 0)
    .sort((a, b) => (b.priority - a.priority) || (a.index - b.index));

  const chosen = new Set<string>();
  let shinsalCount = 0;
  for (const { f } of ranked) {
    if (chosen.size >= 6) break;
    if (chosen.has(f.factId)) continue;
    if (f.kind === 'shinsal') {
      if (shinsalCount >= 3) continue; // 신살이 하이라이트를 도배하지 않게
      shinsalCount += 1;
    }
    chosen.add(f.factId);
  }

  // ── 주요도 정렬 가중치 (하이라이트 선정과 별개 — 전 항목의 표시 순서) ──
  // 겹침 관계 > 천간충 > 삼합 > 방합 > 공망 > 지지충 > 형 > 천간합 > 육합 >
  // 원진 > 해 > A급 신살(weightedScore 비례) > 파 > B/C급 신살 > 지장간(월>일>년>시).
  const weightOf = (f: InsightFact): number => {
    if (f.kind === 'branchRelation') {
      const key = memberKey(f);
      if (key && (pairCount.get(key) ?? 0) >= 2) return 100;
      if (f.label.includes('삼합')) return 85;
      if (f.label.includes('방합')) return 80;
      if (f.label.includes('충')) return 70;
      if (f.label.includes('형')) return 65;
      if (f.label.includes('육합')) return 55;
      if (f.label.includes('원진')) return 50;
      if (f.label.includes('해')) return 46;
      if (f.label.includes('파')) return 42;
      return 35;
    }
    if (f.kind === 'stemRelation') {
      if (f.label.includes('충')) return 90;
      if (f.label.includes('합')) return 58;
      return 35;
    }
    if (f.kind === 'gongmang') return 75;
    if (f.kind === 'shinsal') {
      const base = f.score ?? (f.grade === 'A' ? 100 : f.grade === 'B' ? 50 : 25);
      return base * 0.45; // A(100)→45, B(50)→22.5 — 구조 신호(관계·공망)보다 아래
    }
    if (f.kind === 'sibiUnseong') {
      // 만세력 표준 표기지만 개별 통변 강도는 중간 — 관계·공망 아래, 지장간 위.
      const order: Record<string, number> = { day: 28, month: 26, hour: 24, year: 22 };
      const pos = f.factId.split('.').pop() ?? '';
      return order[pos] ?? 22;
    }
    if (f.kind === 'hiddenStems') {
      const order: Record<string, number> = {
        'hiddenStems.MONTH': 20, 'hiddenStems.DAY': 18, 'hiddenStems.YEAR': 16, 'hiddenStems.HOUR': 14,
      };
      return order[f.factId] ?? 12;
    }
    return 5; // daeunPillar 등 — 말미, 원 순서 유지
  };

  return facts
    .map((f, index) => {
      const salience = Math.max(0, Math.min(1, weightOf(f) / 100));
      const fact = chosen.has(f.factId) ? { ...f, highlight: true, salience } : { ...f, salience };
      return { fact, index };
    })
    .sort((a, b) => ((b.fact.salience ?? 0) - (a.fact.salience ?? 0)) || (a.index - b.index))
    .map((x) => x.fact);
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
      score: typeof hit.weightedScore === 'number' ? hit.weightedScore : undefined,
      group: shinsalGroup(hit.type),
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
      group: 'space',
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
      group: relationGroup(rel.type),
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
      group: relationGroup(rel.type),
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
        group: 'space',
      }));
    }
  }

  // ── 12운성 (sibiUnseong: {기둥: 한글 운성} — springLegacy 배관, 감사 C1) ──
  const sibi = (saju as Record<string, unknown>)['sibiUnseong'];
  if (sibi && typeof sibi === 'object') {
    const posKo: Record<string, string> = { year: '년주', month: '월주', day: '일주', hour: '시주' };
    // 왕성한 국면은 boon, 스러지는 국면은 tension, 잉태·양육 국면은 space.
    const stageGroup: Record<string, InsightGroup> = {
      장생: 'boon', 관대: 'boon', 건록: 'boon', 제왕: 'boon',
      목욕: 'tension', 쇠: 'tension', 병: 'tension', 사: 'tension', 묘: 'tension', 절: 'tension',
      태: 'space', 양: 'space',
    };
    for (const pos of ['year', 'month', 'day', 'hour'] as const) {
      const stage = (sibi as Record<string, unknown>)[pos];
      if (typeof stage !== 'string' || !stage) continue;
      facts.push(withInterpretation({
        factId: `sibiUnseong.${stage}.${pos}`,
        kind: 'sibiUnseong',
        label: `${posKo[pos]} ${stage}`,
        detail: '12운성',
        group: stageGroup[stage] ?? 'space',
      }, [`sibiUnseong.${stage}`]));
    }
  }

  // ── 대운 정체 (daeunInfo — 현재 대운 간지; 신규 계산 없이 원값만) ──
  const daeunRaw = (saju as Record<string, unknown>)['daeunInfo'];
  // 감사 B11: 표기용 정수 대운수(반올림 유파) 오프셋.
  const displayOffset = daeunDisplayOffset(daeunRaw);
  const pillars = daeunRaw && typeof daeunRaw === 'object'
    ? (daeunRaw as Record<string, unknown>)['pillars']
    : null;
  if (Array.isArray(pillars)) {
    for (const [i, p] of pillars.entries()) {
      if (!p || typeof p !== 'object') continue;
      const pp = p as Record<string, unknown>;
      if (typeof pp.stem !== 'string' || typeof pp.branch !== 'string') continue;
      const displayInterval = resolveDaeunDisplayInterval(pp, displayOffset);
      const stemKo = STEM_BY_CODE[pp.stem.toUpperCase()]?.hangul ?? pp.stem;
      const branchKo = BRANCH_BY_CODE[pp.branch.toUpperCase()]?.hangul ?? pp.branch;
      facts.push(withInterpretation({
        factId: `daeunPillar.${pp.stem}-${pp.branch}`,
        kind: 'daeunPillar',
        label: `${i + 1}대운 ${stemKo}${branchKo}`,
        detail: displayInterval
          ? displayInterval.startInclusive + '세~' + displayInterval.endInclusive + '세'
          : undefined,
      }));
    }
  }

  if (facts.length === 0) return null;
  return { title: '전문 인사이트 원자료', facts: markHighlights(facts) };
}
