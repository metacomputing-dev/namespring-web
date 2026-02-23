/**
 * part5-branchRelations.ts -- 지지 관계 전용 섹션
 *
 * PART 5: 지지 관계(합/충/형/파/해/원진)를 별도 섹션으로 분석합니다.
 * 관계 데이터가 없더라도 원국 지지를 바탕으로 안내 섹션을 반환합니다.
 */

import type {
  ReportInput,
  ReportSection,
  ReportParagraph,
  ReportTable,
  ReportHighlight,
} from '../types.js';

import { lookupBranchInfo } from '../common/elementMaps.js';
import { narrative, tip, caution, positive, emphasis, encouraging } from '../common/sentenceUtils.js';

type RelationCategory = 'hap' | 'chung' | 'hyeong' | 'pa' | 'hae' | 'wonjin' | 'other';
type PrimaryCategory = Exclude<RelationCategory, 'other'>;

interface RawBranchRelation {
  readonly type?: unknown;
  readonly branches?: unknown;
  readonly note?: unknown;
  readonly outcome?: unknown;
  readonly reasoning?: unknown;
}

interface BranchRelation {
  readonly category: RelationCategory;
  readonly typeLabel: string;
  readonly branches: string[];
  readonly memo: string;
}

interface PillarBranchRow {
  readonly pillar: string;
  readonly branch: string;
}

const PRIMARY_CATEGORIES: readonly PrimaryCategory[] = ['hap', 'chung', 'hyeong', 'pa', 'hae', 'wonjin'];

const CATEGORY_LABEL: Record<RelationCategory, string> = {
  hap: '합',
  chung: '충',
  hyeong: '형',
  pa: '파',
  hae: '해',
  wonjin: '원진',
  other: '기타',
};

const CATEGORY_SIMPLE_EXPLANATION: Record<PrimaryCategory, string> = {
  hap: '서로 힘을 모으는 협력 구도',
  chung: '정면 충돌로 큰 변화가 생기기 쉬운 구도',
  hyeong: '긴장과 압박 속에서 조정이 필요한 구도',
  pa: '기존 틀이 깨지며 재정비가 필요한 구도',
  hae: '오해나 거리감이 생기기 쉬운 구도',
  wonjin: '감정이 쌓이기 쉬워 소통 관리가 중요한 구도',
};

const CATEGORY_PRACTICAL_TIP: Record<PrimaryCategory, string> = {
  hap: '중요한 협업과 합의는 문서/메모로 남겨 장점을 확실히 굳히세요.',
  chung: '큰 결정을 서두르지 말고 24시간 룰로 한 번 더 검토하세요.',
  hyeong: '비판보다 기준을 먼저 합의하면 마찰을 크게 줄일 수 있어요.',
  pa: '루틴이 깨질 때는 새 시스템을 1개만 도입해 혼선을 줄이세요.',
  hae: '오해 가능성이 큰 대화는 메시지보다 통화/대면으로 확인하세요.',
  wonjin: '감정이 쌓이기 전에 주 1회 짧은 체크인 대화를 고정하세요.',
};

const PILLAR_KO: Record<'year' | 'month' | 'day' | 'hour', string> = {
  year: '연주',
  month: '월주',
  day: '일주',
  hour: '시주',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toCleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const text = toCleanString(item);
    if (text) out.push(text);
  }
  return out;
}

function compactText(value: string): string {
  return value.toLowerCase().replace(/[\s_\-()]/g, '');
}

function classifyRelationType(typeRaw: string): RelationCategory {
  const compact = compactText(typeRaw);
  if (!compact) return 'other';

  if (compact.includes('wonjin') || compact.includes('원진')) return 'wonjin';
  if (compact.includes('chung') || compact.includes('충')) return 'chung';
  if (compact.includes('hyeong') || compact.includes('형')) return 'hyeong';
  if (compact.includes('pa') || compact.includes('파')) return 'pa';
  if (compact.includes('hae') || compact.includes('해')) return 'hae';
  if (
    compact.includes('samhap')
    || compact.includes('banghap')
    || compact.includes('yukhap')
    || compact === 'hap'
    || compact.includes('합')
  ) {
    return 'hap';
  }

  return 'other';
}

function relationLabel(typeRaw: string, category: RelationCategory): string {
  const compact = compactText(typeRaw);

  if (compact.includes('samhap') || compact.includes('삼합')) return '삼합';
  if (compact.includes('banghap') || compact.includes('방합')) return '방합';
  if (compact.includes('yukhap') || compact.includes('육합')) return '육합';

  if (category !== 'other') return CATEGORY_LABEL[category];
  return typeRaw || CATEGORY_LABEL.other;
}

function formatBranch(branchRaw: string): string {
  const info = lookupBranchInfo(branchRaw);
  if (!info) return branchRaw;
  return `${info.hangul}(${info.hanja})`;
}

function normalizeRelation(raw: RawBranchRelation): BranchRelation | null {
  const typeRaw = toCleanString(raw.type);
  const category = classifyRelationType(typeRaw);
  const typeLabel = relationLabel(typeRaw, category);

  const branches = toStringArray(raw.branches)
    .map(formatBranch)
    .filter(Boolean);

  if (!typeRaw && branches.length === 0) return null;

  const memo = [
    toCleanString(raw.reasoning),
    toCleanString(raw.note),
    toCleanString(raw.outcome),
  ].find(Boolean) ?? '';

  return {
    category,
    typeLabel,
    branches,
    memo,
  };
}

function extractRawRelation(item: unknown): RawBranchRelation | null {
  if (!isRecord(item)) return null;

  const hit = isRecord(item.hit) ? item.hit : null;
  const source = hit ?? item;

  const branches = source.branches ?? source.members ?? item.branches ?? item.members;
  return {
    type: source.type ?? item.type,
    branches,
    note: source.note ?? item.note,
    outcome: source.outcome ?? item.outcome,
    reasoning: source.reasoning ?? item.reasoning,
  };
}

function collectBranchRelations(input: ReportInput): BranchRelation[] {
  const sajuRecord: Record<string, unknown> = input.saju as Record<string, unknown>;
  const relationRoot: Record<string, unknown> = isRecord(sajuRecord.relations)
    ? sajuRecord.relations
    : {};

  const candidates: unknown[] = [
    input.saju.jijiRelations,
    sajuRecord.jijiRelations,
    sajuRecord.branchRelations,
    sajuRecord.resolvedJijiRelations,
    relationRoot.jijiRelations,
    relationRoot.branchRelations,
  ];

  const dedup = new Map<string, BranchRelation>();

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;

    for (const item of candidate) {
      const raw = extractRawRelation(item);
      if (!raw) continue;

      const normalized = normalizeRelation(raw);
      if (!normalized) continue;

      const key = [
        normalized.typeLabel,
        normalized.category,
        [...normalized.branches].sort().join('|'),
      ].join('::');

      if (!dedup.has(key)) dedup.set(key, normalized);
    }
  }

  return [...dedup.values()];
}

function initCounts(): Record<PrimaryCategory, number> {
  return {
    hap: 0,
    chung: 0,
    hyeong: 0,
    pa: 0,
    hae: 0,
    wonjin: 0,
  };
}

function extractPillarBranches(input: ReportInput): PillarBranchRow[] {
  const out: PillarBranchRow[] = [];

  const sajuRecord: Record<string, unknown> = input.saju as Record<string, unknown>;
  const pillars: Record<string, unknown> = isRecord(sajuRecord.pillars) ? sajuRecord.pillars : {};

  const keys: Array<'year' | 'month' | 'day' | 'hour'> = ['year', 'month', 'day', 'hour'];
  for (const key of keys) {
    const pillar = isRecord(pillars[key]) ? pillars[key] : null;
    const branchData = pillar?.branch;
    if (!branchData) continue;

    let branchText = '';

    if (isRecord(branchData)) {
      const hangul = toCleanString(branchData.hangul);
      const hanja = toCleanString(branchData.hanja);
      const code = toCleanString(branchData.code);

      if (hangul && hanja) {
        branchText = `${hangul}(${hanja})`;
      } else if (hangul) {
        branchText = hangul;
      } else if (code) {
        branchText = formatBranch(code);
      }
    } else if (typeof branchData === 'string') {
      branchText = formatBranch(branchData);
    }

    if (!branchText) continue;

    out.push({
      pillar: PILLAR_KO[key],
      branch: branchText,
    });
  }

  return out;
}

function topCategory(counts: Record<PrimaryCategory, number>): PrimaryCategory | null {
  let top: PrimaryCategory | null = null;
  let topCount = 0;

  for (const category of PRIMARY_CATEGORIES) {
    const count = counts[category];
    if (count > topCount) {
      top = category;
      topCount = count;
    }
  }

  return topCount > 0 ? top : null;
}

function buildSummaryTable(counts: Record<PrimaryCategory, number>): ReportTable {
  return {
    title: '지지 관계 요약표',
    headers: ['관계', '개수', '쉽게 이해하기'],
    rows: PRIMARY_CATEGORIES.map((category) => [
      CATEGORY_LABEL[category],
      String(counts[category]),
      CATEGORY_SIMPLE_EXPLANATION[category],
    ]),
  };
}

function buildDetailTable(relations: BranchRelation[]): ReportTable {
  const rows = relations.map((relation) => {
    const branches = relation.branches.length > 0 ? relation.branches.join(' · ') : '-';
    const memo = relation.memo || (relation.category === 'other'
      ? '세부 설명 데이터 없음'
      : CATEGORY_SIMPLE_EXPLANATION[relation.category]);

    const practicalTip = relation.category === 'other'
      ? '중요 일정 전후에 감정/일정 변화를 짧게 기록해 패턴을 확인하세요.'
      : CATEGORY_PRACTICAL_TIP[relation.category];

    return [relation.typeLabel, branches, memo, practicalTip];
  });

  return {
    title: '감지된 지지 관계 상세',
    headers: ['유형', '지지 조합', '핵심 의미', '실전 팁'],
    rows,
  };
}

function buildFallbackPillarTable(pillarRows: PillarBranchRow[]): ReportTable {
  return {
    title: '참고: 현재 확인 가능한 원국 지지',
    headers: ['기둥', '지지'],
    rows: pillarRows.length > 0
      ? pillarRows.map((row) => [row.pillar, row.branch])
      : [['원국', '지지 정보 없음']],
  };
}

function buildHighlightsWithRelations(
  relations: BranchRelation[],
  counts: Record<PrimaryCategory, number>,
): ReportHighlight[] {
  const total = relations.length;
  const cautionCount = counts.chung + counts.hyeong + counts.pa + counts.hae + counts.wonjin;
  const top = topCategory(counts);

  const highlights: ReportHighlight[] = [
    {
      label: '감지된 관계 수',
      value: `${total}개`,
      sentiment: total > 0 ? 'good' : 'neutral',
    },
    {
      label: '합 관계',
      value: `${counts.hap}개`,
      sentiment: counts.hap > 0 ? 'good' : 'neutral',
    },
    {
      label: '주의 관계(충/형/파/해/원진)',
      value: `${cautionCount}개`,
      sentiment: cautionCount > 0 ? 'caution' : 'good',
    },
  ];

  if (top) {
    highlights.push({
      label: '가장 강한 축',
      value: CATEGORY_LABEL[top],
      sentiment: top === 'hap' ? 'good' : 'caution',
    });
  }

  return highlights;
}

function buildHighlightsFallback(pillarRows: PillarBranchRow[]): ReportHighlight[] {
  return [
    {
      label: '관계 데이터 상태',
      value: '지지 관계 데이터 없음',
      sentiment: 'caution',
    },
    {
      label: '확인된 원국 지지',
      value: pillarRows.length > 0 ? `${pillarRows.length}개` : '없음',
      sentiment: 'neutral',
    },
    {
      label: '해석 원칙',
      value: '단정 대신 관찰 중심',
      sentiment: 'caution',
    },
  ];
}

function safeName(input: ReportInput): string {
  return input.name?.trim() || '당신';
}

export function generateBranchRelationsSection(input: ReportInput): ReportSection | null {
  const name = safeName(input);
  const relations = collectBranchRelations(input);
  const pillarRows = extractPillarBranches(input);
  const counts = initCounts();

  for (const relation of relations) {
    if (relation.category === 'other') continue;
    counts[relation.category] += 1;
  }

  const paragraphs: ReportParagraph[] = [];
  const tables: ReportTable[] = [];
  let highlights: ReportHighlight[] = [];

  paragraphs.push(
    narrative(
      '지지 관계는 사람 사이의 호흡처럼, 맞물리면 추진력이 생기고 부딪히면 변화가 시작되는 흐름입니다. '
      + '아래에서는 합·충·형·파·해·원진을 쉽게 풀어 설명하고, 바로 적용 가능한 대응 팁까지 함께 정리합니다.',
    ),
  );

  if (relations.length > 0) {
    const cautionCount = counts.chung + counts.hyeong + counts.pa + counts.hae + counts.wonjin;
    const top = topCategory(counts);

    paragraphs.push(
      emphasis(
        `이번 명식에서 확인된 지지 관계는 총 ${relations.length}개입니다. `
        + `합 ${counts.hap}개, 주의 관계 ${cautionCount}개로 요약됩니다.`,
      ),
    );

    if (counts.hap > 0) {
      paragraphs.push(
        positive(
          `합 관계가 ${counts.hap}개 있어 협업, 조율, 관계 복원에 유리한 장면을 만들 가능성이 큽니다. `
          + '중요한 제안이나 합의는 이 흐름을 활용하면 성과를 더 안정적으로 만들 수 있습니다.',
        ),
      );
    }

    if (cautionCount > 0) {
      paragraphs.push(
        caution(
          `충·형·파·해·원진이 ${cautionCount}개 감지되어, 일정 충돌이나 감정 누적이 생기기 쉬운 구간도 함께 존재합니다. `
          + '갈등이 시작되면 승부보다 조정의 속도를 먼저 확보하는 전략이 유효합니다.',
        ),
      );
    }

    const topTip = top ? CATEGORY_PRACTICAL_TIP[top] : '중요한 대화는 결론보다 기준을 먼저 맞추는 방식이 안전합니다.';
    paragraphs.push(tip(`실전 팁 1: ${topTip}`));
    paragraphs.push(
      tip(
        '실전 팁 2: 일정, 돈, 역할처럼 민감한 주제는 구두 합의로 끝내지 말고 '
        + '짧은 메모/체크리스트로 남기면 충·형·파 리스크를 크게 줄일 수 있습니다.',
      ),
    );

    paragraphs.push(
      encouraging(
        `${name}님의 지지 관계는 "좋다/나쁘다"보다 "어떤 상황에서 어떻게 다룰지"가 핵심입니다. `
        + '관계를 관리하는 방식이 곧 운의 체감 품질을 바꿉니다.',
      ),
    );

    tables.push(buildSummaryTable(counts));
    tables.push(buildDetailTable(relations));
    highlights = buildHighlightsWithRelations(relations, counts);
  } else {
    const pillarText = pillarRows.length > 0
      ? pillarRows.map((row) => `${row.pillar} ${row.branch}`).join(', ')
      : '원국 지지 정보가 충분하지 않음';

    paragraphs.push(
      narrative(
        '현재 입력에서는 합/충/형/파/해/원진 관계 데이터가 비어 있어, 특정 관계를 단정할 수 없습니다. '
        + '그래도 아래의 원국 지지 정보를 바탕으로 안전한 관찰 가이드를 제공합니다.',
      ),
    );

    paragraphs.push(
      caution(
        `확인 가능한 지지는 ${pillarText}입니다. 데이터가 비어 있는 상태에서 길흉을 단정하면 오해가 커질 수 있으니, `
        + '실제 사건 기록(대화 충돌, 협업 성과, 일정 파손)을 2~4주 단위로 추적하면서 해석을 보완하세요.',
      ),
    );

    paragraphs.push(
      tip(
        '실전 팁: 관계 긴장이 반복되는 요일/시간대, 자주 부딪히는 주제를 메모해 두면 '
        + '관계 데이터가 들어왔을 때 훨씬 정확한 맞춤 해석으로 연결됩니다.',
      ),
    );

    paragraphs.push(
      encouraging(
        `${name}님처럼 데이터가 제한된 경우에도, 관찰 기반 접근을 쓰면 관계 리스크를 충분히 줄일 수 있습니다.`,
      ),
    );

    tables.push(buildSummaryTable(counts));
    tables.push(buildFallbackPillarTable(pillarRows));
    highlights = buildHighlightsFallback(pillarRows);
  }

  return {
    id: 'branchRelations',
    title: '지지 관계 분석',
    subtitle: '합·충·형·파·해·원진의 쉬운 해설과 실전 대응',
    paragraphs,
    tables,
    highlights,
  };
}
