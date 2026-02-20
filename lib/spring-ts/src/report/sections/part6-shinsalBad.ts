/**
 * part6-shinsalBad.ts -- 흉살/주의 신살 정리 섹션
 *
 * PART 6: 주의가 필요한 신살을 추려서
 * 실전 완화 행동(리스크 관리 습관)으로 연결한다.
 */

import type {
  ReportInput,
  ReportSection,
  ReportParagraph,
  ReportTable,
  ReportHighlight,
} from '../types.js';

import {
  narrative,
  caution,
  tip,
  emphasis,
  encouraging,
} from '../common/sentenceUtils.js';
import { findShinsalEntry } from '../knowledge/shinsalEncyclopedia.js';

type RiskLevel = '높음' | '중간' | '관찰';

interface RawShinsalHitLike {
  readonly type?: unknown;
  readonly position?: unknown;
  readonly grade?: unknown;
  readonly baseWeight?: unknown;
  readonly weightedScore?: unknown;
}

interface RiskHit {
  readonly type: string;
  readonly position: string;
  readonly grade: string;
  readonly baseWeight: number;
  readonly weightedScore: number;
  readonly score: number;
  readonly level: RiskLevel;
  readonly priority: number;
}

interface RiskGuide {
  readonly signal: string;
  readonly action: string;
  readonly shortMeaning?: string;
  readonly mitigationTip?: string;
  readonly dailyHabit?: string;
}

const BAD_TYPE_KEYWORDS: readonly string[] = [
  '충살',
  '형살',
  '해살',
  '파살',
  '원진살',
  '격각살',
  '망신살',
  '육해살',
  '겁살',
  '재살',
  '천살',
  '공망',
  '백호',
  '비인살',
  '양인',
  '괴강',
];

const WATCH_TYPE_KEYWORDS: readonly string[] = [
  '도화',
  '홍염',
  '역마',
  '화개',
];

const PREVENTIVE_HABITS: ReadonlyArray<readonly [string, string, string]> = [
  ['멈춤 3초', '감정이 올라오면 말하기 전에 숨 3번', '매일'],
  ['일정 버퍼', '약속/이동 앞뒤로 10분 여유 두기', '매일'],
  ['지출 체크', '큰 결제 전 필요 여부와 예산 다시 확인', '매일'],
  ['안전 점검', '운전/운동 전 보호장비와 주변 확인', '매번'],
  ['대화 재확인', '중요 메시지는 보내기 전에 한 번 더 읽기', '매번'],
];

function safeName(input: ReportInput): string {
  const text = input.name?.trim();
  return text && text.length > 0 ? text : '사용자';
}

function safeText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text.length > 0 ? text : fallback;
}

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeTypeToken(value: string): string {
  return value.replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();
}

function includesAny(target: string, keywords: readonly string[]): boolean {
  return keywords.some(keyword => target.includes(keyword));
}

function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (Math.imul(hash, 31) + input.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function pickStable<T>(items: readonly T[], key: string): T | null {
  if (items.length === 0) return null;
  return items[stableHash(key) % items.length] ?? null;
}

function normalizeRiskHits(input: ReportInput): RiskHit[] {
  const rawContainer = input.saju as { readonly shinsalHits?: unknown };
  const rawHits = Array.isArray(rawContainer.shinsalHits) ? rawContainer.shinsalHits : [];

  const out: RiskHit[] = [];
  for (let i = 0; i < rawHits.length; i += 1) {
    const raw = rawHits[i] as RawShinsalHitLike;
    const type = safeText(raw.type, `주의신살 ${i + 1}`);
    const token = normalizeTypeToken(type);
    const position = safeText(raw.position, '기타');
    const grade = safeText(raw.grade, '-');
    const baseWeight = safeNumber(raw.baseWeight);
    const weightedScore = safeNumber(raw.weightedScore);
    const score = Math.abs(weightedScore !== 0 ? weightedScore : baseWeight);

    const gradeLower = grade.toLowerCase();
    const byGrade = gradeLower.includes('inauspicious') || gradeLower.includes('bad') || grade.includes('흉');
    const bySign = baseWeight < 0 || weightedScore < 0;
    const byType = includesAny(token, BAD_TYPE_KEYWORDS);
    const watchType = includesAny(token, WATCH_TYPE_KEYWORDS);
    const isRisk = byGrade || bySign || byType || watchType;
    if (!isRisk) continue;

    const priority = score + (bySign ? 1 : 0) + (byType ? 0.8 : 0) + (byGrade ? 0.5 : 0);
    const level: RiskLevel =
      priority >= 2.5 ? '높음' : priority >= 1.2 ? '중간' : '관찰';

    out.push({
      type,
      position,
      grade,
      baseWeight,
      weightedScore,
      score,
      level,
      priority,
    });
  }

  out.sort((a, b) => b.priority - a.priority);
  return out;
}

function riskGuideByType(type: string): RiskGuide {
  const token = normalizeTypeToken(type);

  if (token.includes('충') || token.includes('형') || token.includes('파') || token.includes('해')) {
    return {
      signal: '말이 세지거나 일정이 부딪히기 쉬움',
      action: '답장/결정 전에 3초 멈춤, 일정은 10분 여유 잡기',
    };
  }
  if (token.includes('원진') || token.includes('망신')) {
    return {
      signal: '오해, 뒷말, 감정 상처가 쌓이기 쉬움',
      action: '사실-감정-요청 순서로 짧게 말하고 기록 남기기',
    };
  }
  if (token.includes('공망') || token.includes('천살') || token.includes('백호')) {
    return {
      signal: '예상 밖 변수나 안전 실수가 생기기 쉬움',
      action: '이동/운동 전 체크리스트 3개(시간, 장비, 경로) 확인',
    };
  }
  if (token.includes('겁') || token.includes('재')) {
    return {
      signal: '충동 소비, 성급한 투자 결정을 하기 쉬움',
      action: '큰 지출은 하루 보류 후 재확인하기',
    };
  }
  if (token.includes('역마')) {
    return {
      signal: '이동이 많아져 피로와 실수가 늘기 쉬움',
      action: '이동일엔 일정 70%만 채우고 수면 우선 확보',
    };
  }
  if (token.includes('도화') || token.includes('홍염')) {
    return {
      signal: '관계 기대치가 빨리 올라가 오해가 생기기 쉬움',
      action: '약속/금전/경계선은 말보다 문자로 명확히 남기기',
    };
  }

  return {
    signal: '작은 선택에서 흔들리기 쉬운 시기',
    action: '멈춤 3초 + 일정 여유 + 지출 점검 루틴 유지',
  };
}

function buildRiskGuide(hit: Pick<RiskHit, 'type' | 'position'>): RiskGuide {
  const baseGuide = riskGuideByType(hit.type);
  const entry = findShinsalEntry(hit.type);
  if (!entry || entry.category === '길신') return baseGuide;

  const key = `${normalizeTypeToken(hit.type)}|${normalizeTypeToken(hit.position)}`;
  const shortMeaning = safeText(entry.shortMeaning, '');
  const mitigationTip = safeText(pickStable(entry.mitigationTips, `${key}|mitigation`), '');
  const dailyHabit = safeText(pickStable(entry.dailyHabits, `${key}|habit`), '');

  if (!shortMeaning && !mitigationTip && !dailyHabit) return baseGuide;

  return {
    signal: baseGuide.signal,
    action: mitigationTip ? `${baseGuide.action} / ${mitigationTip}` : baseGuide.action,
    shortMeaning: shortMeaning || undefined,
    mitigationTip: mitigationTip || undefined,
    dailyHabit: dailyHabit || undefined,
  };
}

function formatRiskSignal(guide: RiskGuide): string {
  if (!guide.shortMeaning) return guide.signal;
  return `${guide.signal} / ${guide.shortMeaning}`;
}

function formatRiskAction(guide: RiskGuide): string {
  if (!guide.dailyHabit) return guide.action;
  return `${guide.action} / 일상 습관: ${guide.dailyHabit}`;
}

function buildFallbackSection(name: string, inspectedCount: number, reason: string): ReportSection {
  const paragraphs: ReportParagraph[] = [
    narrative(
      `${name}님의 흉살 데이터가 충분하지 않아 보수적으로 안내할게요. `
      + '겁주기보다, 미리 대비해서 손해를 줄이는 습관에 집중하면 됩니다.',
    ),
    emphasis(`현재 상태: ${reason}`),
    caution(
      '데이터가 비어 있어도 방심은 금물이에요. 급한 결정, 급한 말, 급한 지출만 줄여도 대부분의 리스크를 막을 수 있어요.',
    ),
    tip('아래 예방 루틴 5가지를 2주만 실천해도 체감이 큽니다.'),
    encouraging('핵심은 완벽함보다 꾸준함이에요. 오늘 하나만 바로 실행해 보세요.'),
  ];

  const table: ReportTable = {
    title: '데이터 부족 시 기본 예방 루틴',
    headers: ['예방 습관', '실천 방법', '권장 빈도'],
    rows: PREVENTIVE_HABITS.map(([habit, action, frequency]) => [habit, action, frequency]),
  };

  const highlights: ReportHighlight[] = [
    { label: '흉살 데이터', value: inspectedCount > 0 ? `${inspectedCount}건 확인` : '미확인', sentiment: 'neutral' },
    { label: '핵심 방어', value: '멈춤 3초 + 일정 10분 버퍼', sentiment: 'good' },
    { label: '주의 포인트', value: '급한 말/급한 결제/무리한 일정', sentiment: 'caution' },
  ];

  return {
    id: 'shinsalBad',
    title: '흉살/주의 신살 정리',
    subtitle: '데이터 부족 시 보수적 예방 가이드',
    paragraphs,
    tables: [table],
    highlights,
  };
}

export function generateShinsalBadSection(input: ReportInput): ReportSection | null {
  const name = safeName(input);
  const riskHits = normalizeRiskHits(input);

  const inspectedCountRaw = (input.saju as { readonly shinsalHits?: unknown }).shinsalHits;
  const inspectedCount = Array.isArray(inspectedCountRaw) ? inspectedCountRaw.length : 0;

  if (inspectedCount === 0) {
    return buildFallbackSection(name, inspectedCount, '신살 원본 데이터 없음');
  }

  if (riskHits.length === 0) {
    return buildFallbackSection(name, inspectedCount, '흉살/주의 신호가 약함');
  }

  const topHit = riskHits[0];
  const topGuide = buildRiskGuide(topHit);
  const topSignalText = formatRiskSignal(topGuide);
  const highCount = riskHits.filter(hit => hit.level === '높음').length;
  const mediumCount = riskHits.filter(hit => hit.level === '중간').length;
  const watchCount = riskHits.length - highCount - mediumCount;

  const paragraphs: ReportParagraph[] = [
    narrative(
      `${name}님의 신살 중에서 주의가 필요한 항목이 ${riskHits.length}개 보입니다. `
      + '무서운 판정이라기보다, 시험 전에 정답 힌트를 받은 것처럼 미리 대비하면 되는 신호예요.',
    ),
    emphasis(`위험도 분포: 높음 ${highCount}개 / 중간 ${mediumCount}개 / 관찰 ${watchCount}개`),
    caution(
      `우선순위 1번은 ${topHit.type} (${topHit.position})입니다. `
      + `신호: ${topSignalText}.`,
    ),
    tip(`실행 팁: ${topGuide.action}`),
  ];
  if (topGuide.dailyHabit) {
    paragraphs.push(tip(`추천 일상 습관: ${topGuide.dailyHabit}`));
  }
  paragraphs.push(tip('공통 완화 루틴: 중요한 말은 천천히, 일정은 10분 여유, 큰 지출은 하루 보류.'));
  paragraphs.push(encouraging('주의 신살은 피할 대상이라기보다 관리 대상이에요. 루틴이 생기면 영향이 빠르게 줄어듭니다.'));

  const table: ReportTable = {
    title: '흉살/주의 신살 체크표',
    headers: ['신살', '위치', '위험도', '주의 신호', '완화 행동'],
    rows: riskHits.slice(0, 8).map(hit => {
      const guide = buildRiskGuide(hit);
      const signalText = formatRiskSignal(guide);
      const actionText = formatRiskAction(guide);
      const scoreText = hit.score > 0 ? ` (${hit.score.toFixed(2)})` : '';
      return [
        hit.type,
        hit.position,
        `${hit.level}${scoreText}`,
        signalText,
        actionText,
      ];
    }),
  };

  const highlights: ReportHighlight[] = [
    { label: '주의 신살 수', value: `${riskHits.length}개`, sentiment: 'caution' },
    { label: '높은 위험', value: `${highCount}개`, sentiment: highCount > 0 ? 'caution' : 'neutral' },
    { label: '우선 관리', value: `${topHit.type} (${topHit.position})`, sentiment: 'caution' },
    { label: '핵심 습관', value: topGuide.dailyHabit ?? '멈춤 3초 + 일정 10분 버퍼', sentiment: 'good' },
  ];

  return {
    id: 'shinsalBad',
    title: '흉살/주의 신살 정리',
    subtitle: '리스크 완화 행동 가이드',
    paragraphs,
    tables: [table],
    highlights,
  };
}
