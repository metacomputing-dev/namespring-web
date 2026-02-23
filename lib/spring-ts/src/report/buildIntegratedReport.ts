/**
 * buildIntegratedReport.ts — 통합 보고서 오케스트레이터
 *
 * 모든 섹션 생성기를 조립하여 하나의 완전한 IntegratedReport를 구성합니다.
 * 각 섹션은 독립적으로 생성되며, 실패한 섹션은 건너뛰어 전체 보고서가
 * 항상 안전하게 생성됩니다.
 */

import type {
  ReportInput,
  ReportSection,
  ReportSectionId,
  IntegratedReport,
  ReportMeta,
  ReportParagraph,
} from './types.js';

import { SeededRandom, createRng, pickAndFill, narrative, positive, encouraging, emphasis, tip } from './common/sentenceUtils.js';
import { elementCodeToKorean, STEM_BY_CODE, BRANCH_BY_CODE } from './common/elementMaps.js';

// ─────────────────────────────────────────────────────────────────────────────
//  섹션 생성기 임포트
// ─────────────────────────────────────────────────────────────────────────────

import { generatePillarsSection } from './sections/part1-pillars.js';
import { generateDayMasterSection } from './sections/part1-daymaster.js';
import { generateHiddenStemsSection } from './sections/part1-hiddenStems.js';
import { generateElementsSection } from './sections/part2-elements.js';
import { generateDeficiencySection } from './sections/part2-deficiency.js';
import { generateTongguanSection } from './sections/part2-tongguan.js';
import { generateClimateSection } from './sections/part2-climate.js';
import { generateTenGodsSection } from './sections/part3-tenGods.js';
import { generateStrengthSection } from './sections/part3-strength.js';
import { generateLifeStagesSection } from './sections/part3-lifeStages.js';
import { generateGyeokgukSection } from './sections/part4-gyeokguk.js';
import { generateYongshinSection } from './sections/part4-yongshin.js';
import { generateYongshinLifeSection } from './sections/part4-yongshinLife.js';
import { generateRelationsSection } from './sections/part5-relations.js';
import { generateBranchRelationsSection } from './sections/part5-branchRelations.js';
import { generateShinsalSection } from './sections/part6-shinsal.js';
import { generateShinsalBadSection } from './sections/part6-shinsalBad.js';
import { generateFortuneSection } from './sections/part7-fortune.js';
import { generateYearlyFortuneSection } from './sections/part7-yearlyFortune.js';
import { generateSaeunSection } from './sections/part7-saeun.js';
import { generateMonthlyFortuneSection } from './sections/part7-monthlyFortune.js';
import { generateWeeklyFortuneSection } from './sections/part7-weeklyFortune.js';
import { generateDailyFortuneSection } from './sections/part7-dailyFortune.js';
import { generateNameBasicSection } from './sections/part8-nameBasic.js';
import { generateNameElementSection } from './sections/part8-nameElement.js';
import { generateNameHarmonySection } from './sections/part8-nameHarmony.js';
import { generateFourFrameSection } from './sections/part8-fourFrame.js';
import { generateNameComparisonSection } from './sections/part8-nameComparison.js';
import { generateSajuNameSynergySection } from './sections/part-sajuNameSynergy.js';
import { generateSummarySection } from './sections/part9-summary.js';
import { generateElementLifestyleSection } from './sections/part10-elementLifestyle.js';
import { generateLuckItemsSection } from './sections/part10-luckItems.js';
import { generateHealthSection } from './sections/part11-health.js';
import { generateCareerSection } from './sections/part11-career.js';
import { generateRelationshipsSection } from './sections/part11-relationships.js';
import { generateActionPlanSection } from './sections/part12-actionPlan.js';

// ─────────────────────────────────────────────────────────────────────────────
//  섹션 레지스트리: 생성 순서와 매핑
// ─────────────────────────────────────────────────────────────────────────────

interface SectionEntry {
  readonly id: ReportSectionId;
  readonly generator: (input: ReportInput) => ReportSection | null;
}

/**
 * 섹션 생성 순서를 정의합니다.
 * 이 순서대로 보고서에 배치됩니다.
 */
const SECTION_REGISTRY: SectionEntry[] = [
  // Part 1: 사주 원국 기본
  { id: 'pillars',        generator: generatePillarsSection },
  { id: 'dayMaster',      generator: generateDayMasterSection },
  { id: 'hiddenStems',    generator: generateHiddenStemsSection },

  // Part 2: 오행 분석
  { id: 'elements',       generator: generateElementsSection },
  { id: 'deficiency',     generator: generateDeficiencySection },
  { id: 'tongguan',       generator: generateTongguanSection },
  { id: 'climate',        generator: generateClimateSection },

  // Part 3: 십성·12운성·신강도
  { id: 'tenGods',        generator: generateTenGodsSection },
  { id: 'lifeStages',     generator: generateLifeStagesSection },
  { id: 'strength',       generator: generateStrengthSection },

  // Part 4: 격국·용신
  { id: 'gyeokguk',       generator: generateGyeokgukSection },
  { id: 'yongshin',       generator: generateYongshinSection },
  { id: 'yongshinLife',   generator: generateYongshinLifeSection },

  // Part 5: 합충형파해
  { id: 'stemRelations',  generator: generateRelationsSection },
  { id: 'branchRelations', generator: generateBranchRelationsSection },

  // Part 6: 신살
  { id: 'shinsalGood',    generator: generateShinsalSection },
  { id: 'shinsalBad',     generator: generateShinsalBadSection },

  // Part 7: 운세
  { id: 'daeun',          generator: generateFortuneSection },
  { id: 'yearlyFortune',  generator: generateYearlyFortuneSection },
  { id: 'saeun',          generator: generateSaeunSection },
  { id: 'monthlyFortune', generator: generateMonthlyFortuneSection },
  { id: 'weeklyFortune',  generator: generateWeeklyFortuneSection },
  { id: 'dailyFortune',   generator: generateDailyFortuneSection },

  // Part 8: 성명학
  { id: 'nameBasic',      generator: generateNameBasicSection },
  { id: 'nameElement',    generator: generateNameElementSection },
  { id: 'fourFrame',      generator: generateFourFrameSection },
  { id: 'nameHarmony',    generator: generateNameHarmonySection },
  { id: 'nameComparison', generator: generateNameComparisonSection },
  { id: 'sajuNameSynergy', generator: generateSajuNameSynergySection },

  // Part 9: 종합
  { id: 'summary',        generator: generateSummarySection },

  // Part 10: lifestyle
  { id: 'elementLifestyle', generator: generateElementLifestyleSection },
  { id: 'luckItems',      generator: generateLuckItemsSection },

  // Part 11: practical guidance
  { id: 'health',         generator: generateHealthSection },
  { id: 'career',         generator: generateCareerSection },
  { id: 'relationships',  generator: generateRelationshipsSection },
  { id: 'actionPlan',     generator: generateActionPlanSection },
];

interface PlaceholderContext {
  readonly name: string;
  readonly dayStemHangul: string;
  readonly dayStemHanja: string;
  readonly dayBranchHangul: string;
  readonly dayBranchHanja: string;
  readonly dayElement: string;
  readonly polarity: string;
  readonly zodiac: string;
  readonly yongshin: string;
  readonly heeshin: string;
  readonly gishin: string;
  readonly gushin: string;
  readonly gyeokguk: string;
  readonly gyeokgukReasoning: string;
}

const ZODIAC_BY_BRANCH_CODE: Readonly<Record<string, string>> = {
  JA: '쥐',
  CHUK: '소',
  IN: '호랑이',
  MYO: '토끼',
  JIN: '용',
  SA: '뱀',
  O: '말',
  MI: '양',
  SIN_BRANCH: '원숭이',
  YU: '닭',
  SUL: '개',
  HAE: '돼지',
};

const SECTION_TITLE_FALLBACK: Readonly<Record<ReportSectionId, string>> = {
  pillars: '사주 사기둥 기본',
  dayMaster: '일간 핵심 분석',
  hiddenStems: '지장간 해설',
  elements: '오행 분포',
  deficiency: '과다·결핍 진단',
  tongguan: '통관 분석',
  climate: '조후 기후 분석',
  tenGods: '십성 구조 분석',
  lifeStages: '12운성 흐름',
  strength: '신강·신약 분석',
  gyeokguk: '격국 해설',
  yongshin: '용신 체계',
  yongshinLife: '용신 생활 가이드',
  stemRelations: '천간 관계',
  branchRelations: '지지 관계',
  shinsalGood: '길신 해설',
  shinsalBad: '흉살 주의',
  daeun: '대운 분석',
  yearlyFortune: '세운 분석',
  saeun: '세운 흐름',
  monthlyFortune: '월운 분석',
  weeklyFortune: '주운 분석',
  dailyFortune: '일운 분석',
  nameBasic: '이름 기본 정보',
  nameElement: '이름 오행',
  fourFrame: '사격 해설',
  nameHarmony: '이름-사주 조화',
  nameComparison: '이름 비교',
  sajuNameSynergy: '사주-이름 시너지',
  summary: '종합 요약',
  elementLifestyle: '오행 생활 가이드',
  luckItems: '개운 아이템',
  health: '건강 제안',
  career: '진로 제안',
  relationships: '관계 제안',
  actionPlan: '실행 계획',
};

type UnknownRecord = Record<string, unknown>;
type PillarPosition = 'year' | 'month' | 'day' | 'hour';

const PILLAR_POSITIONS: readonly PillarPosition[] = ['year', 'month', 'day', 'hour'];
const SIBI_POSITION_ALIASES: Readonly<Record<PillarPosition, readonly string[]>> = {
  year: ['year', 'yearPillar', '연주'],
  month: ['month', 'monthPillar', '월주'],
  day: ['day', 'dayPillar', '일주'],
  hour: ['hour', 'hourPillar', '시주'],
};

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function asNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeBranchCode(branchCode: string): string {
  return branchCode === 'SIN' ? 'SIN_BRANCH' : branchCode;
}

function resolveLifeStageCode(raw: unknown): string | null {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();

  const obj = asRecord(raw);
  if (!obj) return null;

  const candidates = ['code', 'stage', 'lifeStage', 'value', 'korean', 'label'];
  for (const key of candidates) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return null;
}

function normalizeLifeStagesFromSibiUnseong(sajuRecord: UnknownRecord): UnknownRecord | null {
  const raw = asRecord(sajuRecord['sibiUnseong']);
  if (!raw) return null;

  const lifeStages: UnknownRecord = {};
  for (const position of PILLAR_POSITIONS) {
    const aliases = SIBI_POSITION_ALIASES[position];
    let resolved: string | null = null;

    for (const alias of aliases) {
      resolved = resolveLifeStageCode(raw[alias]);
      if (resolved) break;
    }

    if (resolved) {
      lifeStages[position] = resolved;
    }
  }

  return Object.keys(lifeStages).length > 0 ? lifeStages : null;
}

function extractCode(raw: unknown, keys: readonly string[]): string | null {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  const obj = asRecord(raw);
  if (!obj) return null;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function normalizeFortuneFromDaeunInfo(sajuRecord: UnknownRecord): UnknownRecord | null {
  const daeunInfo = asRecord(sajuRecord['daeunInfo']);
  if (!daeunInfo) return null;

  const rawPillars = daeunInfo['pillars'] ?? daeunInfo['daeunPillars'];
  if (!Array.isArray(rawPillars) || rawPillars.length === 0) return null;

  const decades: UnknownRecord[] = [];
  for (const row of rawPillars) {
    const item = asRecord(row);
    if (!item) continue;

    const pillar = asRecord(item['pillar']);

    const stemCodeRaw = extractCode(
      item['stem']
      ?? item['cheongan']
      ?? pillar?.['stem']
      ?? pillar?.['cheongan'],
      ['code', 'stem', 'cheongan', 'hangul'],
    );
    const branchCodeRaw = extractCode(
      item['branch']
      ?? item['jiji']
      ?? pillar?.['branch']
      ?? pillar?.['jiji'],
      ['code', 'branch', 'jiji', 'hangul'],
    );

    if (!stemCodeRaw || !branchCodeRaw) continue;

    const stemCode = stemCodeRaw.toUpperCase();
    const branchCode = normalizeBranchCode(branchCodeRaw.toUpperCase());
    const stemInfo = STEM_BY_CODE[stemCode];
    const branchInfo = BRANCH_BY_CODE[branchCode];

    const startAgeRaw = asNumber(item['startAge'] ?? item['startAgeYears']);
    const endAgeRaw = asNumber(item['endAge'] ?? item['endAgeYears']);
    const startAgeYears = round2(startAgeRaw ?? 0);
    const endAgeYears = round2(endAgeRaw ?? (startAgeYears + 9.99));

    decades.push({
      pillar: {
        stem: {
          hangul: stemInfo?.hangul ?? stemCodeRaw,
          element: stemInfo?.element ?? '',
        },
        branch: {
          hangul: branchInfo?.hangul ?? branchCodeRaw,
          element: branchInfo?.element ?? '',
        },
      },
      startAgeYears,
      endAgeYears,
    });
  }

  if (decades.length === 0) return null;

  const firstStartAge = asNumber(daeunInfo['firstDaeunStartAge']) ?? asNumber((decades[0] as UnknownRecord)['startAgeYears']) ?? 3;
  const isForward = daeunInfo['isForward'] !== false;

  return {
    start: {
      direction: isForward ? 'forward' : 'backward',
      age: round2(firstStartAge),
    },
    decades,
  };
}

function normalizeSajuForReport(saju: ReportInput['saju']): ReportInput['saju'] {
  const raw = asRecord(saju);
  if (!raw) return saju;

  let mutated = false;
  const normalized: UnknownRecord = { ...raw };

  if (!raw['lifeStages']) {
    const lifeStages = normalizeLifeStagesFromSibiUnseong(raw);
    if (lifeStages) {
      normalized['lifeStages'] = lifeStages;
      mutated = true;
    }
  }

  if (!raw['fortune'] && !raw['daeun']) {
    const fortune = normalizeFortuneFromDaeunInfo(raw);
    if (fortune) {
      normalized['fortune'] = fortune;
      mutated = true;
    }
  }

  return mutated ? (normalized as ReportInput['saju']) : saju;
}

function resolveEffectiveInput(input: ReportInput): ReportInput {
  const inputAny = input as unknown as UnknownRecord;
  const candidates = Array.isArray(inputAny['candidates'])
    ? inputAny['candidates'] as Array<Record<string, unknown>>
    : [];

  const firstCandidate = candidates[0] as Record<string, unknown> | undefined;
  const springFromCandidate = firstCandidate as unknown as ReportInput['spring'];
  const inferredSpring = input.spring ?? springFromCandidate ?? null;

  const inferredNaming = input.naming
    ?? (input.spring as any)?.namingReport
    ?? (firstCandidate as any)?.namingReport
    ?? null;

  const normalizedSaju = normalizeSajuForReport(input.saju);

  return {
    ...input,
    saju: normalizedSaju,
    spring: inferredSpring ?? undefined,
    naming: inferredNaming ?? undefined,
  };
}

function buildPlaceholderContext(input: ReportInput): PlaceholderContext {
  const dayStem = input.saju?.pillars?.day?.stem;
  const dayBranch = input.saju?.pillars?.day?.branch;
  const dayBranchCode = dayBranch?.code ?? '';
  const yongshin = input.saju?.yongshin?.element ?? '';
  const heeshin = input.saju?.yongshin?.heeshin ?? '';
  const gishin = input.saju?.yongshin?.gishin ?? '';
  const gushin = (input.saju?.yongshin as unknown as Record<string, unknown> | undefined)?.['gushin'] as string | undefined;

  return {
    name: input.name?.trim() || '고객',
    dayStemHangul: dayStem?.hangul ?? '일간',
    dayStemHanja: dayStem?.hanja ?? '日干',
    dayBranchHangul: dayBranch?.hangul ?? '일지',
    dayBranchHanja: dayBranch?.hanja ?? '日支',
    dayElement: elementCodeToKorean(input.saju?.dayMaster?.element ?? '') || '오행',
    polarity: input.saju?.dayMaster?.polarity === 'YIN' ? '음' : input.saju?.dayMaster?.polarity === 'YANG' ? '양' : '중립',
    zodiac: ZODIAC_BY_BRANCH_CODE[dayBranchCode] ?? '띠',
    yongshin: elementCodeToKorean(yongshin) || '균형 오행',
    heeshin: elementCodeToKorean(heeshin) || '보조 오행',
    gishin: elementCodeToKorean(gishin) || '주의 오행',
    gushin: elementCodeToKorean(gushin ?? '') || '구신',
    gyeokguk: input.saju?.gyeokguk?.type || '균형형',
    gyeokgukReasoning: input.saju?.gyeokguk?.reasoning || '현재 입력값에서 균형 중심으로 해석하는 흐름이에요.',
  };
}

function resolvePlaceholderToken(tokenRaw: string, context: PlaceholderContext): string {
  const token = tokenRaw.trim();
  if (!token) return '';

  if (token.includes('이름')) return context.name;
  if (token.includes('일간한글')) return context.dayStemHangul;
  if (token.includes('일간한자')) return context.dayStemHanja;
  if (token.includes('일간')) return context.dayStemHangul;
  if (token.includes('천간한글')) return context.dayStemHangul;
  if (token.includes('천간한자')) return context.dayStemHanja;
  if (token.includes('지지한글')) return context.dayBranchHangul;
  if (token.includes('지지한자')) return context.dayBranchHanja;
  if (token.includes('음양')) return context.polarity;
  if (token.includes('오행')) return context.dayElement;
  if (token.includes('띠')) return context.zodiac;
  if (token.includes('기둥이름')) return '해당 기둥';
  if (token.includes('격국')) return context.gyeokguk;
  if (token.includes('양식')) return '안정형';
  if (token.includes('설명')) return context.gyeokgukReasoning;
  if (token.includes('용신')) return context.yongshin;
  if (token.includes('희신')) return context.heeshin;
  if (token.includes('기신')) return context.gishin;
  if (token.includes('구신')) return context.gushin;
  if (token.includes('한신')) return '중립 오행';
  if (token.includes('숫자1')) return '3';
  if (token.includes('숫자2')) return '8';
  if (token.includes('방위')) return '동쪽';
  if (token.includes('색상')) return '초록색';
  if (token.includes('음식')) return '따뜻한 국물과 제철 채소';
  if (token.includes('취미')) return '가벼운 산책과 독서';
  return '';
}

function localizeActionPlanEnglish(text: string): string {
  let out = text;

  out = out.replace(
    /(.+?)'s action plan ties saju and naming signals into one execution path:\s*support=([^,]+),\s*secondary=([^,]+),\s*caution=([^.]+)\.?/gi,
    (_, name, support, secondary, caution) => `${name}님의 실행계획은 사주와 이름 신호를 하나로 묶어 진행해요. 보강 오행은 ${support}, 보조 오행은 ${secondary}, 주의 오행은 ${caution}예요.`,
  );

  const replacements: Array<[RegExp, string]> = [
    [/For the next 7 days, keep the plan narrow: one stable morning start, one deep-focus block, one evening check\.?/gi, '앞으로 7일은 계획을 좁게 잡아 주세요. 아침 루틴 1개, 집중 블록 1개, 저녁 점검 1개만 지키면 충분해요.'],
    [/For the next 30 days, move by weekly phases: lock routine, close one key task, align naming behavior, then prevent overload\.?/gi, '앞으로 30일은 주차별 단계로 가면 좋아요. 루틴 고정, 핵심 과제 1개 완료, 이름 행동 정렬, 과부하 예방 순서로 진행하세요.'],
    [/Consistency beats intensity\. Repeated execution over 30 days is the primary success condition\.?/gi, '강도보다 꾸준함이 더 중요해요. 30일 동안 반복 실행하는 것이 가장 큰 성공 조건이에요.'],
    [/Action Plan/gi, '실행 계획'],
    [/Saju \+ naming integrated into deterministic 7-day and 30-day execution\./gi, '사주와 이름 신호를 합쳐 7일·30일 실행 루틴으로 정리했어요.'],
    [/Next 7-day micro plan/gi, '다음 7일 마이크로 실천표'],
    [/Next 30-day focus plan/gi, '다음 30일 집중 실행표'],
    [/Overreaction prevention checklist/gi, '과잉반응 방지 체크리스트'],
    [/30-day priority chart \(0-100\)/gi, '30일 우선순위 차트 (0-100)'],
    [/Saju core direction/gi, '사주 핵심 방향'],
    [/Naming synergy/gi, '이름 시너지'],
    [/Integration balance/gi, '통합 균형'],
    [/7-day start rule/gi, '7일 시작 규칙'],
    [/30-day goal/gi, '30일 목표'],
    [/Overload watch signal/gi, '과부하 감시 신호'],
    [/Keep one morning routine \+ one deep-focus block \+ one evening check\./gi, '아침 루틴 1개 + 집중 블록 1개 + 저녁 점검 1개를 유지해요.'],
    [/Do fewer things, but close one important task each week\./gi, '일을 줄이되, 매주 중요한 과제 1개를 끝내요.'],
    [/Routine lock/gi, '루틴 고정'],
    [/Deep focus/gi, '집중 실행'],
    [/Naming usage/gi, '이름 활용'],
    [/Overload prevention/gi, '과부하 예방'],
    [/Recovery\/review/gi, '회복·점검'],
    [/\bDay\b/gi, '요일'],
    [/Morning routine/gi, '아침 루틴'],
    [/Day focus/gi, '낮 집중'],
    [/Evening routine/gi, '저녁 루틴'],
    [/Check signal/gi, '점검 신호'],
    [/\bRange\b/gi, '기간'],
    [/Primary goal/gi, '핵심 목표'],
    [/Execution method/gi, '실행 방법'],
    [/Completion bar/gi, '완료 기준'],
    [/Check item/gi, '점검 항목'],
    [/Why it matters/gi, '이유'],
    [/Today rule/gi, '오늘 규칙'],
    [/Kickoff/gi, '시작'],
    [/Rhythm lock/gi, '리듬 고정'],
    [/Reinforcement/gi, '강화'],
    [/Mid-check/gi, '중간 점검'],
    [/\bExecution\b/gi, '실행'],
    [/Pace control/gi, '페이스 조절'],
    [/Weekly review/gi, '주간 복기'],
    [/Name element data is missing, so baseline planning is used\./gi, '이름 오행 데이터가 부족해 기본 계획으로 진행해요.'],
    [/Core saju compensation data is limited\. Baseline deterministic routines are used as a safe fallback\./gi, '사주 보정 데이터가 제한적이라 안전한 기본 루틴으로 안내해요.'],
    [/Naming signal data is limited\. The plan keeps name steps simple and action-first\./gi, '이름 신호 데이터가 제한적이라 이름 단계는 간단하게, 실행 우선으로 안내해요.'],
    [/Naming fit summary:/gi, '이름 적합 요약:'],
    [/Integration summary:/gi, '통합 요약:'],
    [/Important:\s*do not replace the whole plan after one bad (?:day|요일)\.\s*If (.+?) overload appears,\s*pause 10 minutes and restart smaller\./gi, '중요: 하루 흐름이 흔들려도 계획 전체를 바꾸지 마세요. $1 과열 신호가 보이면 10분 멈춘 뒤 더 작은 단위로 다시 시작하세요.'],
    [/Name element flow is aligned with compensation direction\./gi, '이름 오행 흐름이 보정 방향과 잘 맞아요.'],
    [/Name element flow is neutral;\s*routine(?: reinforcement| 강화)? matters\./gi, '이름 오행 흐름은 중립이며 루틴 강화가 중요해요.'],
    [/Name element flow conflicts with compensation direction;\s*pace control is important\./gi, '이름 오행 흐름이 보정 방향과 충돌해요. 속도 조절이 특히 중요해요.'],
    [/Integration (\d+)\/100 \(balance (\d+)\/100\)\./gi, '통합 점수 $1/100점 (균형 $2/100점)이에요.'],
    [/integration caution:\s*run at 80% pace \+ one extra review\./gi, '통합 주의 모드: 평소의 80% 속도로 진행하고 점검을 1회 더 하세요.'],
    [/integration strength:\s*keep momentum and close one extra step\./gi, '통합 강점 모드: 현재 리듬을 유지하고 한 단계 더 마무리해 보세요.'],
    [/integration score (\d+)\/100/gi, '통합 점수 $1/100'],
    [/Days\s*1-7/gi, '1~7일차'],
    [/Days\s*8-14/gi, '8~14일차'],
    [/Days\s*15-21/gi, '15~21일차'],
    [/Days\s*22-28/gi, '22~28일차'],
    [/Days\s*29-30/gi, '29~30일차'],
    [/Routine lock-in/gi, '루틴 고정'],
    [/Name-based buffering is helping across major luck cycles\./gi, '이름 기반 보완 효과가 큰 운의 변화 구간에서 완충 역할을 하고 있어요.'],
    [/Yongshin ([^ ]+) alignment is stable in the current name\./gi, '현재 이름에서 용신 $1 정렬이 안정적으로 유지되고 있어요.'],
    [/The name currently softens relation friction in the chart\./gi, '현재 이름이 원국의 관계 마찰을 완화해 주고 있어요.'],
    [/Direct support for yongshin ([^ ]+) is limited\./gi, '용신 $1에 대한 직접 보강이 아직 약한 편이에요.'],
    [/Some major luck periods may require stronger daily balancing habits\./gi, '일부 큰 운 구간에서는 더 강한 일상 균형 습관이 필요해요.'],
    [/Conflict-heavy relation periods need slower pacing and one extra review step\./gi, '관계 충돌이 많은 시기에는 속도를 낮추고 추가 점검 1회를 넣어 주세요.'],
    [/No major conflict signal is dominant,\s*but consistency still matters\./gi, '큰 충돌 신호는 두드러지지 않지만 꾸준함이 여전히 핵심이에요.'],
    [/Use ([^ ]+)-supporting lifestyle cues \(color,\s*direction,\s*food\) consistently this week\./gi, '이번 주에는 $1 보강 생활 신호(색상·방향·음식)를 꾸준히 적용해 주세요.'],
    [/Before pressure-heavy periods,\s*pre-plan recovery blocks in your schedule\./gi, '압박이 큰 시기를 앞두고 회복 시간을 일정에 미리 배치해 주세요.'],
    [/Keep your sleep and work rhythm steady to hold current balance\./gi, '현재 균형을 유지하려면 수면과 작업 리듬을 일정하게 지켜 주세요.'],
    [/When emotions spike,\s*delay important decisions by one short review cycle\./gi, '감정 파도가 올라오면 중요한 결정은 짧은 재검토 1회 뒤로 미뤄 주세요.'],
    [/Run a short weekly check-in to keep your current strengths active\./gi, '현재 강점을 유지하려면 주간 짧은 점검을 꾸준히 실행해 주세요.'],
    [/At day end,\s*write one win and one adjustment for tomorrow\./gi, '하루를 마칠 때 오늘의 성과 1개와 내일의 조정 1개를 기록해 주세요.'],
    [/요일 focus/gi, '낮 집중'],
    [/([목화토금수]) morning:/gi, '$1 아침 루틴:'],
    [/Remove five distractions before starting work\./gi, '일 시작 전 방해요소 5가지를 먼저 정리해요.'],
    [/Take 2 minutes of quiet breathing and clear your head\./gi, '조용한 호흡 2분으로 머릿속을 맑게 정리해요.'],
    [/Choose completion over perfection and close the 요일 cleanly\./gi, '완벽보다 완료를 우선하고 하루를 깔끔하게 마무리해요.'],
    [/Deep work/gi, '집중 작업'],
    [/break/gi, '휴식'],
    [/review/gi, '점검'],
    [/Check:\s*/gi, '점검: '],
    [/집중 작업 20m \+ 휴식 5m \+ 집중 작업 20m \/ mid-week 점검: adjust only one small part\./gi, '집중 작업 20분 + 휴식 5분 + 집중 작업 20분 / 주중 점검: 한 가지 작은 항목만 조정하세요.'],
    [/점검:\s*if completion drops,\s*reduce load by 20% instead of resetting whole plan\./gi, '점검: 완료율이 떨어지면 계획 전체 리셋 대신 업무량을 20% 줄이세요.'],
    [/점검:\s*keep two wins and one lesson,\s*then carry forward one routine\./gi, '점검: 성과 2개와 교훈 1개를 남기고 다음 주 루틴 1개를 이어가세요.'],
    [/mid-week check:\s*adjust only one small part\./gi, '주중 점검: 한 가지 작은 항목만 조정하세요.'],
    [/mid-week 점검:\s*adjust only one small part\./gi, '주중 점검: 한 가지 작은 항목만 조정하세요.'],
    [/weekly review 30m and set one next target\./gi, '주간 복기 30분 후 다음 목표 1개를 정하세요.'],
    [/주간 복기 30m and set one next target\./gi, '주간 복기 30분 후 다음 목표 1개를 정하세요.'],
    [/push one key task to done\./gi, '핵심 과제 1개를 완료까지 밀어붙이세요.'],
    [/add one ([목화토금수]) support action\./gi, '$1 보강 행동 1개를 추가하세요.'],
    [/start\/in-progress\/done/gi, '시작/진행/완료'],
    [/Split work into 시작\/in-progress\/done and close one item fully\./gi, '작업을 시작/진행/완료로 나누고 과제 1개를 완전히 끝내세요.'],
    [/Use 20-minute focus \+ 5-minute reset cycles\./gi, '20분 집중 + 5분 리셋 주기를 사용하세요.'],
    [/Use 25-minute focus \+ 5-minute break rhythm\./gi, '25분 집중 + 5분 휴식 리듬을 사용하세요.'],
    [/Run one 30-minute build block before checking messages\./gi, '메시지 확인 전에 30분 제작 블록 1회를 먼저 실행하세요.'],
    [/Take light movement for 5 minutes and set one communication goal\./gi, '가벼운 움직임 5분 후 소통 목표 1개를 정하세요.'],
    [/Do one high-energy task first,\s*then cool down with a short review\./gi, '고에너지 과제 1개를 먼저 하고 짧은 점검으로 마무리하세요.'],
    [/Lower stimulation for 10 minutes and reset emotional pace\./gi, '10분간 자극을 낮추고 감정 속도를 재정렬하세요.'],
    [/Start at a fixed time and tidy your desk for 5 minutes\./gi, '고정된 시간에 시작하고 책상을 5분 정리하세요.'],
    [/List top 3 tasks for tomorrow in order\./gi, '내일 할 일 상위 3개를 순서대로 적어 두세요.'],
    [/Open a window,\s*stretch for 3 minutes,\s*then pick one growth task\./gi, '창문을 열고 3분 스트레칭 후 성장 과제 1개를 고르세요.'],
    [/Write one sentence about progress and one adjustment for tomorrow\./gi, '진행 성과 1문장과 내일 조정 1문장을 적어 보세요.'],
    [/Say your name cue and commit one key goal\./gi, '이름 앵커 문장을 말하고 핵심 목표 1개를 확정하세요.'],
    [/Write one line linking name energy to today\./gi, '이름 에너지와 오늘 할 일을 한 줄로 연결해 보세요.'],
    [/Start one task with your name cue and close it\./gi, '이름 앵커로 과제 1개를 시작해 끝까지 마무리하세요.'],
    [/Read your name slowly and choose one clear priority\./gi, '이름을 천천히 읽고 분명한 우선순위 1개를 고르세요.'],
    [/Use one ([목화토금수]) reinforcement sentence and plan one next step\./gi, '$1 보강 문장 1개를 읽고 다음 단계 1개를 계획하세요.'],
    [/Log one action where your name cue improved focus\./gi, '이름 앵커가 집중에 도움 된 행동 1개를 기록하세요.'],
    [/Keep routine simple and do one ([목화토금수]) support action first\./gi, '루틴을 단순하게 유지하고 먼저 $1 보강 행동 1개를 하세요.'],
    [/Skip self-critique and check one completed action only\./gi, '자기비판은 멈추고 완료한 행동 1개만 확인하세요.'],
    [/Prioritize execution over score checking\./gi, '점수 확인보다 실행을 우선하세요.'],
    [/Write one gratitude line and one task for tomorrow\./gi, '감사 한 줄과 내일 과제 1개를 적으세요.'],
    [/Complete one small task and mark it done\./gi, '작은 과제 1개를 완료하고 완료 표시를 남기세요.'],
    [/Run a simple 10-minute routine\./gi, '간단한 10분 루틴을 실행하세요.'],
    [/Integration signal:/gi, '통합 신호:'],
    [/if ([목화토금수]) overload appears,\s*pause 10 minutes then resume\./gi, '$1 과열 신호가 보이면 10분 멈춘 뒤 다시 시작하세요.'],
    [/Check:\s*if completion drops,\s*reduce load by 20% instead of resetting whole plan\./gi, '점검: 완료율이 떨어지면 계획 전체 리셋 대신 업무량을 20% 줄이세요.'],
    [/Check:\s*keep two wins and one lesson,\s*then carry forward one routine\./gi, '점검: 성과 2개와 교훈 1개를 남기고 다음 주 루틴 1개를 이어가세요.'],
    [/support routine fixed for 7 days/gi, '보강 루틴을 7일 고정'],
    [/([목화토금수,\s]+)\s*naming routine/gi, '$1 이름 루틴'],
    [/([목화토금수]) overload signal:\s*reduce schedule 20%/gi, '$1 과열 신호: 일정 20% 축소'],
    [/Keep one stable routine for 30 days/gi, '30일 동안 안정 루틴 1개 유지'],
    [/At least 5 days completed/gi, '최소 5일 이상 실행'],
    [/Single-task focus/gi, '단일 과제 집중'],
    [/One deep-focus block per 요일/gi, '하루 집중 블록 1회'],
    [/Close one important task/gi, '중요 과제 1개 완료'],
    [/Name-action alignment/gi, '이름-실행 정렬'],
    [/Write 5\+ daily check notes/gi, '일일 점검 메모 5회 이상'],
    [/No large plan reset/gi, '큰 계획 리셋 금지'],
    [/Review \+ next cycle setup/gi, '복기 + 다음 사이클 준비'],
    [/점검 \+ next cycle setup/gi, '복기 + 다음 사이클 준비'],
    [/next cycle setup/gi, '다음 사이클 준비'],
    [/Choose one routine to carry forward/gi, '이어갈 루틴 1개 선택'],
    [/Are you trying to replace the whole plan after one bad 요일\?/gi, '하루가 흔들렸다고 전체 계획을 바꾸려 하고 있나요?'],
    [/Hard pivots break 실행 continuity\./gi, '급격한 방향 전환은 실행 흐름을 끊어요.'],
    [/Hard pivots 휴식 실행 continuity\./gi, '급격한 방향 전환은 실행 흐름을 끊어요.'],
    [/Adjust only 20% once per week\./gi, '주 1회, 20%만 조정하세요.'],
    [/Did you set a target larger than your current energy\?/gi, '현재 에너지보다 큰 목표를 잡았나요?'],
    [/Overloaded starts collapse the next 요일\./gi, '과부하 시작은 다음 날 흐름까지 무너뜨려요.'],
    [/Reduce volume first,\s*keep the same start time\./gi, '업무량부터 줄이고 시작 시간은 고정하세요.'],
    [/Are you comparing your pace to others right now\?/gi, '지금 다른 사람 속도와 비교하고 있나요?'],
    [/Comparison amplifies caution patterns and weakens focus\./gi, '비교는 불안 패턴을 키우고 집중을 약하게 만들어요.'],
    [/Compare only today vs your own yesterday\./gi, '비교 대상은 어제의 나 하나로만 두세요.'],
    [/Do you see ([목화토금수]) overload signs \(rush,\s*hard tone,\s*impulsive decisions\)\?/gi, '$1 과열 신호(조급함, 말투 경직, 충동 결정)가 보이나요?'],
    [/Escalated emotional state increases error rate\./gi, '감정이 과열되면 실수율이 올라가요.'],
    [/Pause 10 minutes and restart with one small task\./gi, '10분 멈춘 뒤 가장 작은 작업 1개로 재시작하세요.'],
    [/Are you checking scores more than actions\?/gi, '실행보다 점수 확인을 더 자주 하고 있나요?'],
    [/Score follows repeated 실행,\s*not the other way around\./gi, '점수는 반복 실행의 결과예요. 순서를 바꾸지 마세요.'],
    [/점수 follows repeated 실행,\s*not the other way around\./gi, '점수는 반복 실행의 결과예요. 순서를 바꾸지 마세요.'],
    [/Complete one action before any score check\./gi, '점수 확인 전에 실행 1개를 먼저 완료하세요.'],
    [/Complete one action before any 점수 check\./gi, '점수 확인 전에 실행 1개를 먼저 완료하세요.'],
    [/Routine lock/gi, '루틴 고정'],
    [/Deep focus/gi, '집중 실행'],
    [/Naming usage/gi, '이름 활용'],
    [/Recovery\/review/gi, '회복·점검'],
    [/([목화토금수]) support/gi, '$1 보강'],
    [/([목화토금수]) overload response \(impulse\/speed\/emotion spike\)/gi, '$1 과열 대응 (충동/속도/감정 급등)'],
    [/\brecovery-first\b/gi, '회복 우선'],
    [/\bstrong drive\b/gi, '추진 강함'],
    [/\bbalanced pace\b/gi, '균형 리듬'],
    [/\(good\)/gi, '(좋음)'],
    [/\(mid\)/gi, '(보통)'],
    [/\(low\)/gi, '(주의)'],
    [/\(unknown\)/gi, '(미확정)'],
    [/\(supportive\)/gi, '(지원형)'],
    [/\(neutral\)/gi, '(중립형)'],
    [/\(caution\)/gi, '(주의형)'],
  ];

  for (const [pattern, replacement] of replacements) {
    out = out.replace(pattern, replacement);
  }

  return out;
}

function localizeElementWords(text: string): string {
  let out = text;
  const replacements: Array<[RegExp, string]> = [
    [/\bWOOD\b/gi, '목'],
    [/\bFIRE\b/gi, '화'],
    [/\bEARTH\b/gi, '토'],
    [/\bMETAL\b/gi, '금'],
    [/\bWATER\b/gi, '수'],
    [/\bWood\b/g, '목'],
    [/\bFire\b/g, '화'],
    [/\bEarth\b/g, '토'],
    [/\bMetal\b/g, '금'],
    [/\bWater\b/g, '수'],
    [/\bbridge\b/gi, '통관'],
    [/namingScoreEngine/gi, '성명 점수엔진'],
    [/\bvalue\b/gi, '값'],
    [/\blevel\b/gi, '수준'],
    [/\blabel\b/gi, '라벨'],
    [/\bscore\b/gi, '점수'],
    [/\bmin\b/gi, '최소'],
    [/\bmax\b/gi, '최대'],
    [/extremeWeakEnd/gi, '극신약끝'],
    [/weakEnd/gi, '신약끝'],
    [/balancedEnd/gi, '균형끝'],
    [/strongEnd/gi, '신강끝'],
    [/strong tie/gi, '강한 유대'],
  ];

  for (const [pattern, replacement] of replacements) {
    out = out.replace(pattern, replacement);
  }

  return out;
}

function localizeSajuNameSynergyEnglish(text: string): string {
  let out = text;
  out = out.replace(
    /Fallback integration summary:\s*overall synergy\s*(\d+)\/100\s*with yongshin fit\s*(\d+)\/100\./gi,
    '보완 통합 요약: 종합 시너지 $1/100점, 용신 부합 $2/100점이에요.',
  );
  out = out.replace(
    /Fallback integration summary:\s*integration inputs were unavailable,\s*so legacy section metrics are used\./gi,
    '보완 통합 요약: 통합 입력이 일부 부족해 기본 섹션 지표로 안전하게 계산했어요.',
  );
  out = out.replace(/Integration strengths:/gi, '통합 강점:');
  out = out.replace(/Integration cautions:/gi, '통합 주의점:');
  out = out.replace(/Daily action:/gi, '오늘 실천:');
  out = out.replace(/Daily action/gi, '오늘 실천');
  out = out.replace(/Integration engine/gi, '통합 엔진');
  out = out.replace(/Integration strength/gi, '통합 강점');
  out = out.replace(/Integration caution/gi, '통합 주의');
  out = out.replace(/\bfallback\b/gi, '보완모드');
  out = out.replace(/The current name-chart mix is mostly neutral and can be improved step by step\./gi, '현재 이름-사주 조합은 중립에 가까우며 단계적으로 충분히 개선할 수 있어요.');
  out = out.replace(/No major conflict signal is dominant,\s*but consistency still matters\./gi, '큰 충돌 신호는 두드러지지 않지만 꾸준함이 매우 중요해요.');
  out = out.replace(/Use ([^ ]+)-supporting lifestyle cues \(color,\s*direction,\s*food\) consistently this week\./gi, '이번 주에는 $1 보강 생활 신호(색상·방향·음식)를 꾸준히 적용해 주세요.');
  out = out.replace(/Keep your sleep and work rhythm steady to hold current balance\./gi, '현재 균형을 유지하려면 수면과 작업 리듬을 일정하게 지켜 주세요.');
  out = out.replace(/Before pressure-heavy periods,\s*pre-plan recovery blocks in your schedule\./gi, '압박이 큰 시기를 앞두고 회복 시간을 일정에 미리 배치해 주세요.');
  out = out.replace(/When emotions spike,\s*delay important decisions by one short review cycle\./gi, '감정이 크게 흔들릴 때는 중요한 결정을 짧은 재검토 1회 뒤로 미뤄 주세요.');
  out = out.replace(/Run a short weekly check-in to keep your current strengths active\./gi, '현재 강점을 유지하려면 주간 짧은 점검을 꾸준히 실행해 주세요.');
  out = out.replace(/At day end,\s*write one win and one adjustment for tomorrow\./gi, '하루를 마칠 때 오늘의 성과 1개와 내일의 조정 1개를 기록해 주세요.');
  return out;
}

function localizeTenGodsEnglish(text: string): string {
  let out = text;

  // 한글 본문에 붙은 영어 학술어 보조표기를 제거해 가독성을 높입니다.
  out = out.replace(/\(([A-Za-z][A-Za-z0-9\- _.,/]+)\)/g, '');
  out = out.replace(/Big Five/gi, '빅파이브');
  out = out.replace(/MBTI/gi, '성격유형지표');
  out = out.replace(/\btrait\b/gi, '특질');
  out = out.replace(/\s{2,}/g, ' ').trim();

  return out;
}

function sanitizeText(text: string, context: PlaceholderContext, sectionId?: ReportSectionId): string {
  let out = String(text ?? '');
  out = out.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, token) => resolvePlaceholderToken(String(token), context));
  out = localizeElementWords(out);

  if (sectionId === 'actionPlan') {
    out = localizeActionPlanEnglish(out);
  }
  if (sectionId === 'sajuNameSynergy') {
    out = localizeSajuNameSynergyEnglish(out);
  }
  if (sectionId === 'tenGods') {
    out = localizeTenGodsEnglish(out);
  }

  out = out
    .replace(/\bundefined\b/gi, '')
    .replace(/\bnull\b/gi, '')
    .replace(/\[object Object\]/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/^:\s*—\s*/g, '')
    .replace(/^:\s*/g, '')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return out;
}

function sanitizeParagraphs(
  paragraphs: readonly ReportParagraph[],
  context: PlaceholderContext,
  sectionId?: ReportSectionId,
): ReportParagraph[] {
  return paragraphs
    .map((paragraph) => ({
      ...paragraph,
      text: sanitizeText(paragraph.text, context, sectionId),
    }))
    .filter((paragraph) => paragraph.text.trim() !== '' && paragraph.text.trim() !== '---');
}

function sanitizeUnknownValue(
  value: unknown,
  context: PlaceholderContext,
  sectionId?: ReportSectionId,
): unknown {
  if (typeof value === 'string') {
    return sanitizeText(value, context, sectionId);
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeUnknownValue(item, context, sectionId));
  }

  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(input)) {
      const sanitizedKey = sanitizeText(key, context, sectionId);
      output[sanitizedKey] = sanitizeUnknownValue(item, context, sectionId);
    }
    return output;
  }

  return value;
}

function sanitizeSection(
  section: ReportSection,
  expectedId: ReportSectionId,
  context: PlaceholderContext,
): ReportSection {
  return {
    ...section,
    id: expectedId,
    title: sanitizeText(section.title, context, expectedId),
    subtitle: section.subtitle ? sanitizeText(section.subtitle, context, expectedId) : section.subtitle,
    paragraphs: sanitizeParagraphs(section.paragraphs ?? [], context, expectedId),
    tables: section.tables?.map((table) => ({
      ...table,
      title: table.title ? sanitizeText(table.title, context, expectedId) : table.title,
      headers: table.headers.map(header => sanitizeText(header, context, expectedId)),
      rows: table.rows.map(row => row.map(cell => sanitizeText(cell, context, expectedId))),
    })),
    charts: section.charts?.map((chart) => ({
      ...chart,
      title: chart.title ? sanitizeText(chart.title, context, expectedId) : chart.title,
      data: Object.fromEntries(
        Object.entries(chart.data).map(([key, value]) => ([
          sanitizeText(key, context, expectedId),
          typeof value === 'string'
            ? sanitizeText(value, context, expectedId)
            : value,
        ])),
      ),
      meta: chart.meta ? sanitizeUnknownValue(chart.meta, context, expectedId) as Record<string, unknown> : chart.meta,
    })),
    highlights: section.highlights?.map((highlight) => ({
      ...highlight,
      label: sanitizeText(highlight.label, context, expectedId),
      value: sanitizeText(highlight.value, context, expectedId),
    })),
    subsections: section.subsections?.map((subsection) => ({
      ...subsection,
      title: sanitizeText(subsection.title, context, expectedId),
      paragraphs: sanitizeParagraphs(subsection.paragraphs ?? [], context, expectedId),
      tables: subsection.tables?.map((table) => ({
        ...table,
        title: table.title ? sanitizeText(table.title, context, expectedId) : table.title,
        headers: table.headers.map(header => sanitizeText(header, context, expectedId)),
        rows: table.rows.map(row => row.map(cell => sanitizeText(cell, context, expectedId))),
      })),
      charts: subsection.charts?.map((chart) => ({
        ...chart,
        title: chart.title ? sanitizeText(chart.title, context, expectedId) : chart.title,
      })),
      highlights: subsection.highlights?.map((highlight) => ({
        ...highlight,
        label: sanitizeText(highlight.label, context, expectedId),
        value: sanitizeText(highlight.value, context, expectedId),
      })),
    })),
  };
}

function buildFallbackSection(id: ReportSectionId, input: ReportInput): ReportSection {
  const title = SECTION_TITLE_FALLBACK[id] ?? id;
  const name = input.name?.trim() || '고객';
  const dayElement = elementCodeToKorean(input.saju?.dayMaster?.element ?? '') || '중립';
  const yongshin = elementCodeToKorean(input.saju?.yongshin?.element ?? '') || '균형';
  const monthBranch = input.saju?.pillars?.month?.branch?.hangul ?? '월지';

  if (id === 'climate') {
    return {
      id,
      title,
      subtitle: '조후 데이터 보강 중',
      paragraphs: [
        narrative(`${name}님의 월지는 ${monthBranch}이고, 일간 오행은 ${dayElement}이에요. 조후 원본 점수는 이번 입력에서 제공되지 않아 핵심 방향만 먼저 정리해 드려요.`),
        narrative(`실전에서는 ${yongshin} 기운을 생활 루틴에 꾸준히 채우는 것이 가장 안전한 보정 전략이에요. 수면 시간, 체온 관리, 계절 음식 선택을 동일한 기준으로 유지해 주세요.`),
        tip('다음 업데이트에서는 규칙 엔진의 기후 점수(온도/습도 편차)까지 연결해 수치형 조후 리포트로 확장됩니다.'),
      ],
    };
  }

  if (id === 'lifeStages') {
    return {
      id,
      title,
      subtitle: '12운성 계산값 대기',
      paragraphs: [
        narrative(`${name}님의 12운성 원본 값이 현재 데이터에 포함되지 않아, 연주·월주·일주·시주의 세부 에너지 곡선은 보강 단계예요.`),
        narrative('대신 당장 쓸 수 있는 원칙은 간단해요. 시작 단계에서는 목표를 작게, 성장 단계에서는 루틴을 크게, 정리 단계에서는 휴식을 충분히 가져가면 흐름이 안정됩니다.'),
        tip('출생 시각(분 단위)과 정책 옵션이 고정되면 4주별 에너지 표와 시기별 실천 가이드가 자동으로 채워집니다.'),
      ],
    };
  }

  if (id === 'daeun') {
    return {
      id,
      title,
      subtitle: '대운 원본 포맷 점검 중',
      paragraphs: [
        narrative(`${name}님의 대운 원본 필드가 일부 누락되어 10년 단위 세부 해석은 안전 모드로 전환했어요.`),
        narrative(`현재 단계에서는 ${yongshin} 오행을 기준으로 중요한 결정을 분기하면 리스크를 크게 줄일 수 있어요. 큰 결정을 한 번에 몰기보다 분기 단위로 나눠 점검해 주세요.`),
        tip('대운 시작 나이와 기둥 정보가 완전히 연결되면 연령대별 핵심 기회/주의 구간이 표와 차트로 자동 생성됩니다.'),
      ],
    };
  }

  if (id === 'nameBasic' || id === 'fourFrame') {
    return {
      id,
      title,
      subtitle: '성명학 상세값 보강 중',
      paragraphs: [
        narrative(`${name}님의 이름 상세 데이터(한자 획수/사격 일부)가 현재 입력에서 부분만 전달되어, 이 섹션은 핵심 안내 모드로 제공돼요.`),
        narrative(`이름 분석에서는 ${yongshin} 보강, 발음 안정감, 반복 사용성이 가장 중요한 3축이에요. 한 축이라도 흔들리면 점수보다 실제 체감이 먼저 떨어질 수 있어요.`),
        tip('같은 한글 이름이라도 한자 조합이 바뀌면 결과가 크게 달라져요. 최종 확정 전에는 한자 후보를 2~3개 비교해 보세요.'),
      ],
    };
  }

  return {
    id,
    title,
    subtitle: '데이터 보강 안내',
    paragraphs: [
      narrative(`${name}님의 현재 입력 데이터에서는 ${title}의 세부 계산값이 부족해, 핵심 요약을 먼저 제공해요.`),
      narrative(`핵심 방향은 단순해요. 일간 ${dayElement}의 균형과 용신 ${yongshin} 보강에 초점을 맞추면 대부분의 실전 판단이 안정적으로 정리됩니다.`),
      tip('출생 시각(시/분)과 이름 한자 정보가 더 정확하면 이 섹션이 자동으로 더욱 풍부해집니다.'),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  서문·맺음말 템플릿
// ─────────────────────────────────────────────────────────────────────────────

const INTRO_TEMPLATES_WITH_NAME = [
  '{{이름}}님, 안녕하세요! 지금부터 {{이름}}님만을 위한 특별한 사주 이야기를 들려드릴게요.',
  '{{이름}}님의 사주팔자 속에 숨겨진 이야기를 함께 풀어볼까요?',
  '세상에 하나뿐인 {{이름}}님의 사주를 자세히 살펴보겠습니다.',
  '{{이름}}님, 반갑습니다! 태어날 때 하늘이 선물해준 특별한 이야기를 시작할게요.',
  '{{이름}}님의 타고난 기운과 잠재력을 함께 알아보는 시간이에요!',
  '{{이름}}님만의 고유한 사주 지도를 펼쳐볼까요? 흥미진진한 발견이 기다리고 있어요!',
  '지금부터 {{이름}}님의 사주 속 보물찾기를 시작해볼게요!',
  '{{이름}}님, 사주팔자는 마치 태어날 때 받은 특별한 설계도 같은 거예요. 함께 읽어볼까요?',
  '{{이름}}님의 삶에 담긴 하늘의 메시지를 하나씩 풀어보겠습니다.',
  '오늘은 {{이름}}님의 사주 속에 담긴 무한한 가능성을 발견하는 시간이에요!',
];

const INTRO_TEMPLATES_NO_NAME = [
  '안녕하세요! 지금부터 특별한 사주 이야기를 들려드릴게요.',
  '사주팔자 속에 숨겨진 이야기를 함께 풀어볼까요?',
  '태어날 때 하늘이 선물해준 특별한 이야기를 시작할게요.',
  '타고난 기운과 잠재력을 함께 알아보는 시간이에요!',
  '사주 속 보물찾기를 시작해볼게요! 흥미진진한 발견이 기다리고 있어요.',
  '사주팔자는 마치 태어날 때 받은 특별한 설계도 같은 거예요. 함께 읽어볼까요?',
  '삶에 담긴 하늘의 메시지를 하나씩 풀어보겠습니다.',
  '오늘은 사주 속에 담긴 무한한 가능성을 발견하는 시간이에요!',
];

const INTRO_CONTEXT_TEMPLATES = [
  '사주명리학은 동양의 오랜 지혜가 담긴 학문이에요. 태어난 해, 달, 날, 시간의 기운을 통해 타고난 성격과 잠재력을 알아볼 수 있답니다.',
  '사주(四柱)란 태어난 연·월·일·시의 네 기둥을 말해요. 이 네 기둥에 담긴 여덟 글자(팔자)가 바로 우리의 사주팔자랍니다!',
  '동양에서는 수천 년 동안 사주를 통해 사람의 타고난 기질과 운명의 흐름을 이해해왔어요. 지금부터 그 지혜를 함께 나눠볼게요.',
  '사주는 일종의 우주 시계와 같아요. 태어난 순간의 하늘과 땅의 기운이 우리에게 어떤 영향을 미치는지 알려주는 신비로운 학문이랍니다.',
  '사주팔자는 마치 인생의 나침반과 같아요. 어디로 가야 할지, 어떤 재능을 키워야 할지 방향을 알려주는 소중한 길잡이예요.',
];

const CONCLUSION_TEMPLATES_WITH_NAME = [
  '{{이름}}님의 사주에는 정말 멋진 가능성이 가득해요! 타고난 기운을 잘 활용하면, 더욱 빛나는 삶을 만들어갈 수 있답니다.',
  '{{이름}}님, 사주는 정해진 운명이 아니라 가능성의 지도예요. 이 지도를 참고하여 더 나은 선택을 해나가시길 바랍니다!',
  '{{이름}}님의 사주 여행이 즐거우셨기를 바라요! 앞으로도 자신만의 빛을 잃지 마세요.',
  '{{이름}}님만의 특별한 사주 이야기는 여기까지예요. 하늘이 준 선물을 소중히 간직하고, 매일매일 행복하세요!',
  '{{이름}}님, 기억하세요. 사주는 가능성을 보여줄 뿐, 진짜 주인공은 바로 {{이름}}님 자신이에요!',
  '여기까지 {{이름}}님의 사주 이야기를 함께했어요. 타고난 강점을 믿고, 부족한 부분은 노력으로 채워가면 반드시 좋은 결과가 있을 거예요!',
  '{{이름}}님의 사주에 담긴 무한한 가능성을 믿어주세요. 오늘도 내일도 응원하겠습니다!',
  '사주가 알려준 {{이름}}님의 이야기는 시작일 뿐이에요. 진짜 멋진 이야기는 {{이름}}님이 직접 써나가는 거랍니다!',
];

const CONCLUSION_TEMPLATES_NO_NAME = [
  '사주에는 정말 멋진 가능성이 가득해요! 타고난 기운을 잘 활용하면, 더욱 빛나는 삶을 만들어갈 수 있답니다.',
  '사주는 정해진 운명이 아니라 가능성의 지도예요. 이 지도를 참고하여 더 나은 선택을 해나가시길 바랍니다!',
  '사주 여행이 즐거우셨기를 바라요! 앞으로도 자신만의 빛을 잃지 마세요.',
  '특별한 사주 이야기는 여기까지예요. 하늘이 준 선물을 소중히 간직하고, 매일매일 행복하세요!',
  '기억하세요, 사주는 가능성을 보여줄 뿐, 진짜 주인공은 바로 여러분 자신이에요!',
  '타고난 강점을 믿고, 부족한 부분은 노력으로 채워가면 반드시 좋은 결과가 있을 거예요!',
  '사주에 담긴 무한한 가능성을 믿어주세요. 오늘도 내일도 응원하겠습니다!',
];

// ─────────────────────────────────────────────────────────────────────────────
//  메인 빌더
// ─────────────────────────────────────────────────────────────────────────────

const REPORT_VERSION = '1.0.0';

/**
 * 통합 보고서를 생성합니다.
 *
 * @param input - 사주 + 성명학 데이터 및 옵션
 * @returns IntegratedReport 객체
 *
 * @example
 * ```typescript
 * const report = buildIntegratedReport({
 *   saju: sajuSummary,
 *   naming: namingReport,
 *   name: '홍길동',
 *   gender: 'male',
 *   birthInfo: { year: 1990, month: 5, day: 15, hour: 14 },
 * });
 * ```
 */
export function buildIntegratedReport(input: ReportInput): IntegratedReport {
  const effectiveInput = resolveEffectiveInput(input);
  const rng = createRng(effectiveInput);
  const name = effectiveInput.name ?? '';
  const placeholderContext = buildPlaceholderContext(effectiveInput);

  // ── 1. 포함/제외 섹션 결정 ──────────────────────────────────────────────
  const includeSections = effectiveInput.options?.includeSections ?? null;
  const excludeSections = new Set(effectiveInput.options?.excludeSections ?? []);

  const filteredRegistry = SECTION_REGISTRY.filter(entry => {
    if (excludeSections.has(entry.id)) return false;
    if (includeSections && !includeSections.includes(entry.id)) return false;
    return true;
  });

  // ── 2. 각 섹션 생성 (실패 시 건너뜀) ──────────────────────────────────
  const sections: ReportSection[] = [];
  for (const entry of filteredRegistry) {
    let generated: ReportSection | null = null;
    try {
      generated = entry.generator(effectiveInput);
    } catch (err) {
      console.warn(`[report] 섹션 '${entry.id}' 생성 실패:`, err);
    }

    const section = generated
      ? sanitizeSection(generated, entry.id, placeholderContext)
      : buildFallbackSection(entry.id, effectiveInput);
    sections.push(section);
  }

  // ── 3. 서문 생성 ───────────────────────────────────────────────────────
  const introduction = sanitizeParagraphs(
    buildIntroduction(rng, name, effectiveInput),
    placeholderContext,
  );

  // ── 4. 맺음말 생성 ─────────────────────────────────────────────────────
  const conclusion = sanitizeParagraphs(
    buildConclusion(rng, name),
    placeholderContext,
  );

  // ── 5. 메타데이터 ──────────────────────────────────────────────────────
  const meta: ReportMeta = {
    version: REPORT_VERSION,
    generatedAt: new Date().toISOString(),
    targetName: name || undefined,
    targetGender: effectiveInput.gender,
    engineVersion: REPORT_VERSION,
  };

  return { meta, introduction, sections, conclusion };
}

// ─────────────────────────────────────────────────────────────────────────────
//  서문·맺음말 빌더
// ─────────────────────────────────────────────────────────────────────────────

function buildIntroduction(rng: SeededRandom, name: string, input: ReportInput): ReportParagraph[] {
  const paragraphs: ReportParagraph[] = [];

  // 인사말
  if (name) {
    const greeting = pickAndFill(rng, INTRO_TEMPLATES_WITH_NAME, { 이름: name });
    paragraphs.push(positive(greeting));
  } else {
    const greeting = pickAndFill(rng, INTRO_TEMPLATES_NO_NAME);
    paragraphs.push(positive(greeting));
  }

  // 사주 소개
  const context = pickAndFill(rng, INTRO_CONTEXT_TEMPLATES);
  paragraphs.push(narrative(context));

  // 일간 소개 (있을 경우)
  if (input.saju?.dayMaster) {
    const dm = input.saju.dayMaster;
    const elementKo = elementCodeToKorean(dm.element);
    const polarityKo = dm.polarity === 'YANG' ? '양(陽)' : '음(陰)';

    const dayMasterIntros = [
      `${name ? name + '님의 ' : ''}일간은 ${elementKo}의 기운을 가진 ${polarityKo} 성격이에요. 이것이 사주의 중심이 되는 '나'랍니다!`,
      `사주의 중심에는 ${elementKo} 기운의 일간이 있어요. ${polarityKo}의 성질을 가지고 있답니다.`,
      `${name ? name + '님' : '이 사주'}의 핵심은 ${polarityKo} ${elementKo}의 일간이에요. 모든 분석의 출발점이 되는 중요한 글자랍니다!`,
    ];
    paragraphs.push(emphasis(rng.pick(dayMasterIntros)));
  }

  // 보고서 안내
  const guideTemplates = [
    '이 보고서는 사주명리학의 전통 이론에 기반하여 작성되었어요. 재미있게 읽으면서 자신의 장점을 발견해보세요!',
    '지금부터 사주의 다양한 면을 하나씩 살펴볼 거예요. 어렵게 느껴지는 부분도 쉽게 설명해드릴 테니 걱정하지 마세요!',
    '이 보고서에서는 타고난 성격, 재능, 운의 흐름 등을 자세히 알아볼 거예요. 천천히 읽어보시면 많은 발견이 있을 거랍니다!',
  ];
  paragraphs.push(narrative(rng.pick(guideTemplates)));

  return paragraphs;
}

function buildConclusion(rng: SeededRandom, name: string): ReportParagraph[] {
  const paragraphs: ReportParagraph[] = [];

  if (name) {
    const closing = pickAndFill(rng, CONCLUSION_TEMPLATES_WITH_NAME, { 이름: name });
    paragraphs.push(encouraging(closing));
  } else {
    const closing = pickAndFill(rng, CONCLUSION_TEMPLATES_NO_NAME);
    paragraphs.push(encouraging(closing));
  }

  // 면책 조항 (항상 포함)
  paragraphs.push(narrative(
    '※ 이 보고서는 동양 전통 사주명리학 이론에 기반한 참고 자료입니다. ' +
    '사주는 가능성을 제시할 뿐, 미래를 확정짓지 않습니다. ' +
    '중요한 결정은 항상 전문가와 상담하시기 바랍니다.'
  ));

  return paragraphs;
}

// ─────────────────────────────────────────────────────────────────────────────
//  편의 함수: SajuSummary에서 바로 보고서 생성
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SajuSummary 하나만으로 보고서를 빠르게 생성하는 편의 함수입니다.
 */
export function buildSajuOnlyReport(
  saju: ReportInput['saju'],
  options?: {
    name?: string;
    gender?: ReportInput['gender'];
    birthInfo?: ReportInput['birthInfo'];
    today?: Date;
    variationSeed?: number;
  },
): IntegratedReport {
  return buildIntegratedReport({
    saju,
    name: options?.name,
    gender: options?.gender,
    birthInfo: options?.birthInfo,
    today: options?.today ?? new Date(),
    options: {
      variationSeed: options?.variationSeed,
      excludeSections: [
        'nameElement',
        'nameBasic',
        'fourFrame',
        'nameHarmony',
        'nameComparison',
        'sajuNameSynergy',
      ],
    },
  });
}

/**
 * SpringReport (이름+사주 통합)에서 보고서를 생성하는 편의 함수입니다.
 */
export function buildSpringReport(
  spring: NonNullable<ReportInput['spring']>,
  options?: {
    name?: string;
    gender?: ReportInput['gender'];
    birthInfo?: ReportInput['birthInfo'];
    today?: Date;
    variationSeed?: number;
  },
): IntegratedReport {
  return buildIntegratedReport({
    saju: spring.sajuReport,
    naming: spring.namingReport,
    spring,
    name: options?.name,
    gender: options?.gender,
    birthInfo: options?.birthInfo,
    today: options?.today ?? new Date(),
    options: {
      variationSeed: options?.variationSeed,
    },
  });
}
