/**
 * part11-relationships.ts
 *
 * PART 11: 대인관계 가이드
 * - 음양 밸런스 + 합/충/형/파/해 신호를 함께 요약
 * - 관계를 "고정 운명"이 아닌 "조율 포인트"로 안내
 * - 데이터가 부족해도 안전하게 동작하는 null-safe fallback
 */

import type {
  ReportHighlight,
  ReportInput,
  ReportParagraph,
  ReportSection,
  ReportTable,
} from '../types.js';

import {
  lookupBranchInfo,
  lookupStemInfo,
} from '../common/elementMaps.js';

import {
  createRng,
  emphasis,
  encouraging,
  narrative,
  tip,
} from '../common/sentenceUtils.js';

type Polarity = 'YIN' | 'YANG';
type YinYangStatus = 'balanced' | 'yinDominant' | 'yangDominant' | 'unknown';
type RelationCategory = 'hap' | 'chung' | 'hyeong' | 'pa' | 'hae' | 'other';

interface YinYangBalance {
  readonly yin: number | null;
  readonly yang: number | null;
  readonly source: 'summary' | 'pillars' | 'dayMaster' | 'unknown';
}

interface RelationCountSummary {
  readonly hap: number;
  readonly chung: number;
  readonly hyeong: number;
  readonly pa: number;
  readonly hae: number;
  readonly other: number;
  readonly total: number;
}

const RELATION_LABEL: Record<RelationCategory, string> = {
  hap: '합',
  chung: '충',
  hyeong: '형',
  pa: '파',
  hae: '해',
  other: '기타',
};

const PRIMARY_RELATION_KEYS: ReadonlyArray<Exclude<RelationCategory, 'other'>> = [
  'hap',
  'chung',
  'hyeong',
  'pa',
  'hae',
];

function safeName(input: ReportInput): string {
  return input.name?.trim() || '당신';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed));
  }
  return null;
}

function normalizePolarity(value: unknown): Polarity | null {
  const raw = asString(value);
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (
    upper.includes('YANG')
    || raw.includes('양')
    || raw.includes('陽')
  ) {
    return 'YANG';
  }
  if (
    upper.includes('YIN')
    || raw.includes('음')
    || raw.includes('陰')
  ) {
    return 'YIN';
  }
  return null;
}

function extractYinYangFromRecord(record: Record<string, unknown>): { yin: number; yang: number } | null {
  const yinKeys = ['yin', 'yinCount', 'yin_count', 'yinTotal', 'yin_total', 'um', 'eum'];
  const yangKeys = ['yang', 'yangCount', 'yang_count', 'yangTotal', 'yang_total'];

  let yin: number | null = null;
  let yang: number | null = null;

  for (const key of yinKeys) {
    const value = toCount(record[key]);
    if (value != null) {
      yin = value;
      break;
    }
  }

  for (const key of yangKeys) {
    const value = toCount(record[key]);
    if (value != null) {
      yang = value;
      break;
    }
  }

  if (yin == null || yang == null) return null;
  return { yin, yang };
}

function readPillarPartPolarity(partRaw: unknown, kind: 'stem' | 'branch'): Polarity | null {
  const part = asRecord(partRaw);
  const direct = normalizePolarity(part?.yinYang ?? part?.polarity);
  if (direct) return direct;

  const code = asString(part?.code) || asString(part?.hangul) || asString(partRaw);
  if (!code) return null;

  if (kind === 'stem') {
    return lookupStemInfo(code)?.yinYang ?? null;
  }
  return lookupBranchInfo(code)?.yinYang ?? null;
}

function countPillarPolarity(saju: Record<string, unknown>): { yin: number; yang: number } | null {
  const pillars = asRecord(saju.pillars);
  if (!pillars) return null;

  const keys: Array<'year' | 'month' | 'day' | 'hour'> = ['year', 'month', 'day', 'hour'];
  let yin = 0;
  let yang = 0;

  for (const key of keys) {
    const pillar = asRecord(pillars[key]);
    if (!pillar) continue;

    const stemPolarity = readPillarPartPolarity(pillar.stem, 'stem');
    const branchPolarity = readPillarPartPolarity(pillar.branch, 'branch');

    if (stemPolarity === 'YIN') yin += 1;
    if (stemPolarity === 'YANG') yang += 1;
    if (branchPolarity === 'YIN') yin += 1;
    if (branchPolarity === 'YANG') yang += 1;
  }

  return yin + yang > 0 ? { yin, yang } : null;
}

function readYinYangBalance(input: ReportInput): YinYangBalance {
  const saju = asRecord(input.saju);
  if (!saju) {
    return { yin: null, yang: null, source: 'unknown' };
  }

  const explicitCandidates: unknown[] = [
    saju.yinYangBalance,
    saju.yinyangBalance,
    saju.yinYang,
    saju.yinyang,
    saju.eumyangBalance,
    saju.umyangBalance,
    saju.eumyang,
    saju.umyang,
    saju,
  ];

  for (const candidate of explicitCandidates) {
    const record = asRecord(candidate);
    if (!record) continue;
    const extracted = extractYinYangFromRecord(record);
    if (extracted) {
      return {
        yin: extracted.yin,
        yang: extracted.yang,
        source: 'summary',
      };
    }
  }

  const fromPillars = countPillarPolarity(saju);
  if (fromPillars) {
    return {
      yin: fromPillars.yin,
      yang: fromPillars.yang,
      source: 'pillars',
    };
  }

  const dayMaster = asRecord(saju.dayMaster);
  const dayMasterPolarity = normalizePolarity(dayMaster?.polarity);
  if (dayMasterPolarity) {
    return {
      yin: dayMasterPolarity === 'YIN' ? 1 : 0,
      yang: dayMasterPolarity === 'YANG' ? 1 : 0,
      source: 'dayMaster',
    };
  }

  return { yin: null, yang: null, source: 'unknown' };
}

function compactType(typeRaw: string): string {
  return typeRaw.toLowerCase().replace(/[\s_\-()]/g, '');
}

function classifyRelation(typeRaw: string): RelationCategory {
  const compact = compactType(typeRaw);
  if (!compact) return 'other';

  if (
    compact.includes('samhap')
    || compact.includes('banghap')
    || compact.includes('yukhap')
    || compact.includes('hap')
    || compact.includes('합')
  ) {
    return 'hap';
  }
  if (
    compact.includes('chung')
    || compact.includes('충')
    || compact.includes('geuk')
    || compact.includes('극')
  ) {
    return 'chung';
  }
  if (compact.includes('hyeong') || compact.includes('형')) {
    return 'hyeong';
  }
  if (compact.includes('pa') || compact.includes('파') || compact.includes('破')) {
    return 'pa';
  }
  if (compact.includes('hae') || compact.includes('해') || compact.includes('害')) {
    return 'hae';
  }
  return 'other';
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const text = asString(item);
    if (text) out.push(text);
  }
  return out;
}

function relationKey(relation: Record<string, unknown>, relationType: string): string {
  const members = normalizeStringArray(
    relation.members ?? relation.stems ?? relation.branches,
  );
  const normalizedMembers = [...members].sort().join('|');
  return `${compactType(relationType)}::${normalizedMembers}`;
}

function collectRelationTypes(input: ReportInput): string[] {
  const saju = asRecord(input.saju);
  if (!saju) return [];

  const relationRoot = asRecord(saju.relations);
  const candidates: unknown[] = [
    saju.cheonganRelations,
    saju.jijiRelations,
    relationRoot?.cheonganRelations,
    relationRoot?.jijiRelations,
    relationRoot?.stemRelations,
    relationRoot?.branchRelations,
  ];

  const out: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;

    for (const item of candidate) {
      const record = asRecord(item);
      if (!record) continue;

      const source = asRecord(record.hit) ?? record;
      const relationType = asString(source.type) || asString(record.type) || asString(source.relationType);
      if (!relationType) continue;

      const key = relationKey(source, relationType);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(relationType);
    }
  }

  return out;
}

function summarizeRelations(relationTypes: string[]): RelationCountSummary {
  let hap = 0;
  let chung = 0;
  let hyeong = 0;
  let pa = 0;
  let hae = 0;
  let other = 0;

  for (const typeRaw of relationTypes) {
    const category = classifyRelation(typeRaw);
    if (category === 'hap') hap += 1;
    else if (category === 'chung') chung += 1;
    else if (category === 'hyeong') hyeong += 1;
    else if (category === 'pa') pa += 1;
    else if (category === 'hae') hae += 1;
    else other += 1;
  }

  return {
    hap,
    chung,
    hyeong,
    pa,
    hae,
    other,
    total: relationTypes.length,
  };
}

function resolveYinYangStatus(balance: YinYangBalance): YinYangStatus {
  if (balance.yin == null || balance.yang == null) return 'unknown';
  if (Math.abs(balance.yin - balance.yang) <= 1) return 'balanced';
  if (balance.yang > balance.yin) return 'yangDominant';
  return 'yinDominant';
}

function yinYangStatusText(balance: YinYangBalance, status: YinYangStatus): string {
  if (status === 'unknown') return '데이터 부족';
  if (status === 'balanced') return `균형형 (음 ${balance.yin} / 양 ${balance.yang})`;
  if (status === 'yangDominant') return `양 우세 (음 ${balance.yin} / 양 ${balance.yang})`;
  return `음 우세 (음 ${balance.yin} / 양 ${balance.yang})`;
}

function yinYangGuide(status: YinYangStatus): string {
  if (status === 'balanced') {
    return '공감과 추진의 리듬이 비교적 고르게 맞는 편이라 관계 조율이 수월합니다.';
  }
  if (status === 'yangDominant') {
    return '표현 속도가 빠른 강점이 있어요. 중요한 대화는 한 템포 쉬고 확인하면 안정감이 더 커집니다.';
  }
  if (status === 'yinDominant') {
    return '배려와 관찰이 강점입니다. 필요한 요청을 먼저 짧게 말하면 오해가 줄어듭니다.';
  }
  return '음양 정보가 제한적이니, 실제 대화 패턴을 1~2주 기록해 보며 맞춤 조율을 권장합니다.';
}

function primarySignalCount(summary: RelationCountSummary): number {
  return summary.hap + summary.chung + summary.hyeong + summary.pa + summary.hae;
}

function tensionSignalCount(summary: RelationCountSummary): number {
  return summary.chung + summary.hyeong + summary.pa + summary.hae;
}

function relationDigest(summary: RelationCountSummary): string {
  const parts: string[] = [];
  for (const key of PRIMARY_RELATION_KEYS) {
    const count = summary[key];
    if (count > 0) {
      parts.push(`${RELATION_LABEL[key]} ${count}`);
    }
  }
  return parts.length > 0 ? parts.join(' · ') : '두드러진 합충형파해 신호 없음';
}

function dominantRelation(summary: RelationCountSummary): string {
  const entries = PRIMARY_RELATION_KEYS.map((key) => ({
    key,
    count: summary[key],
  }));
  entries.sort((a, b) => b.count - a.count);
  if ((entries[0]?.count ?? 0) <= 0) return '특이 신호 적음';
  return RELATION_LABEL[entries[0].key];
}

function relationStateText(category: Exclude<RelationCategory, 'other'>, count: number): string {
  if (count <= 0) return '신호 적음';
  return `${count}개`;
}

function relationGuideText(category: Exclude<RelationCategory, 'other'>, count: number): string {
  if (count <= 0) {
    return '현재 구간에서는 크게 두드러지지 않습니다.';
  }

  if (category === 'hap') {
    return '협력과 회복력이 좋아지기 쉬운 흐름입니다. 공동 목표를 문장으로 합의해 두면 효과가 큽니다.';
  }
  if (category === 'chung') {
    return '의견 속도 차이로 마찰이 생길 수 있어요. 결론보다 기준부터 맞추면 갈등 비용이 줄어듭니다.';
  }
  if (category === 'hyeong') {
    return '역할과 규칙을 재정비하라는 신호로 볼 수 있습니다. 경계선 합의가 관계의 피로를 낮춥니다.';
  }
  if (category === 'pa') {
    return '낡은 습관을 업데이트할 타이밍입니다. 작은 프로세스 수정만으로도 체감이 크게 바뀝니다.';
  }
  return '거리 조절 이슈가 생길 수 있어요. 기대치와 연락 빈도를 먼저 맞추면 안정적입니다.';
}

function combinedGuidance(status: YinYangStatus, summary: RelationCountSummary): string {
  const primarySignals = primarySignalCount(summary);
  const tensionSignals = tensionSignalCount(summary);

  if (primarySignals === 0) {
    if (status === 'unknown') {
      return '현재는 정보가 제한적인 구간이라, 관계를 단정하기보다 대화 습관을 정리해 보는 접근이 가장 안전합니다.';
    }
    return '강한 합충형파해 신호가 적으니, 지금은 기본 신뢰와 소통 규칙을 세우기 좋은 시기입니다.';
  }

  if (status === 'balanced' && summary.hap >= tensionSignals) {
    return '음양 균형이 받쳐 주고 합 신호도 있어, 갈등이 생겨도 복구 속도가 빠를 가능성이 큽니다.';
  }

  if (status === 'yangDominant' && tensionSignals > 0) {
    return '표현 속도가 빠를수록 긴장 신호가 커질 수 있어요. 핵심 결론 전에 질문 1개를 넣는 습관이 효과적입니다.';
  }

  if (status === 'yinDominant' && tensionSignals > 0) {
    return '배려가 큰 장점이지만 속마음 전달이 늦어질 수 있습니다. 요청과 감정을 분리해 말하면 충돌이 줄어듭니다.';
  }

  if (tensionSignals > summary.hap) {
    return '충·형·파·해 신호가 보이더라도 관계의 파국을 뜻하지는 않아요. 조율 포인트가 분명하다는 의미에 가깝습니다.';
  }

  return '관계 신호는 고정 운명이 아니라 조율 힌트입니다. 말의 속도와 기대치를 맞추면 체감이 확실히 좋아집니다.';
}

function yinYangHighlightSentiment(status: YinYangStatus): 'good' | 'caution' | 'neutral' {
  if (status === 'balanced') return 'good';
  if (status === 'unknown') return 'neutral';
  return 'caution';
}

function relationHighlightSentiment(summary: RelationCountSummary): 'good' | 'caution' | 'neutral' {
  const primarySignals = primarySignalCount(summary);
  if (primarySignals === 0) return 'neutral';

  const tensionSignals = tensionSignalCount(summary);
  if (summary.hap >= tensionSignals) return 'good';
  return 'caution';
}

export function generateRelationshipsSection(input: ReportInput): ReportSection | null {
  if (!input || !input.saju) return null;

  const rng = createRng(input);
  for (let i = 0; i < 44; i++) rng.next();

  const name = safeName(input);
  const yinYangBalance = readYinYangBalance(input);
  const yinYangStatus = resolveYinYangStatus(yinYangBalance);
  const relationSummary = summarizeRelations(collectRelationTypes(input));
  const relationDigestText = relationDigest(relationSummary);
  const combinedGuide = combinedGuidance(yinYangStatus, relationSummary);

  const introTemplates = [
    `${name}님의 관계 흐름은 "타고난 기질(음양)"과 "관계 신호(합충형파해)"를 함께 볼 때 가장 현실적으로 읽힙니다.`,
    '대인관계 해석은 좋고 나쁨의 판정보다, 어떤 상황에서 조율이 잘 되는지 찾는 과정에 가깝습니다.',
    `${name}님의 관계 에너지를 음양 밸런스와 합·충·형·파·해 신호를 묶어 실전형으로 정리해 드릴게요.`,
  ] as const;

  const paragraphs: ReportParagraph[] = [
    narrative(rng.pick(introTemplates)),
  ];

  const yinYangText = yinYangStatusText(yinYangBalance, yinYangStatus);
  if (primarySignalCount(relationSummary) > 0) {
    paragraphs.push(
      emphasis(
        `음양 상태는 ${yinYangText}, 관계 신호는 ${relationDigestText}로 나타납니다. ${combinedGuide}`,
      ),
    );
  } else {
    paragraphs.push(
      emphasis(
        `음양 상태는 ${yinYangText}입니다. 현재는 합·충·형·파·해가 크게 겹치지 않아 관계의 기본 리듬을 안정적으로 설계하기 좋습니다.`,
      ),
    );
  }

  paragraphs.push(
    tip(`핵심 가이드: ${yinYangGuide(yinYangStatus)} ${combinedGuide}`),
  );
  paragraphs.push(
    encouraging('관계 신호는 결과 확정이 아니라 소통 습관을 다듬는 지도에 가깝습니다. 작은 조정이 분위기를 크게 바꿀 수 있어요.'),
  );

  const summaryTable: ReportTable = {
    title: '관계 밸런스 요약 (음양 + 합충형파해)',
    headers: ['항목', '현재 상태', '가이드'],
    rows: [
      ['음양 밸런스', yinYangText, yinYangGuide(yinYangStatus)],
      ['합', relationStateText('hap', relationSummary.hap), relationGuideText('hap', relationSummary.hap)],
      ['충', relationStateText('chung', relationSummary.chung), relationGuideText('chung', relationSummary.chung)],
      ['형', relationStateText('hyeong', relationSummary.hyeong), relationGuideText('hyeong', relationSummary.hyeong)],
      ['파', relationStateText('pa', relationSummary.pa), relationGuideText('pa', relationSummary.pa)],
      ['해', relationStateText('hae', relationSummary.hae), relationGuideText('hae', relationSummary.hae)],
    ],
  };

  const highlights: ReportHighlight[] = [
    {
      label: '음양 포지션',
      value: yinYangText,
      sentiment: yinYangHighlightSentiment(yinYangStatus),
    },
    {
      label: '관계 핵심 신호',
      value: relationDigestText,
      sentiment: relationHighlightSentiment(relationSummary),
    },
    {
      label: '우선 체크 포인트',
      value: primarySignalCount(relationSummary) > 0
        ? `${dominantRelation(relationSummary)} 중심으로 대화 기준 먼저 합의`
        : '현재는 기본 신뢰/역할 합의부터 정리',
      sentiment: 'neutral',
    },
  ];

  return {
    id: 'relationships',
    title: '대인관계 가이드',
    subtitle: '음양 밸런스와 합충형파해를 함께 보는 관계 해석',
    paragraphs,
    tables: [summaryTable],
    highlights,
  };
}
