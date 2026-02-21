/**
 * part-sajuNameSynergy.ts -- 사주-이름 시너지 종합 분석 섹션
 *
 * CLAUDE.md를 넘어서는 새로운 관점의 분석:
 *   1. 사주의 약점을 이름이 어떻게 보완하는지
 *   2. 이름의 에너지가 대운/세운과 어떻게 상호작용하는지
 *   3. 신강도에 따른 이름의 역할 변화
 *   4. 격국과 이름의 궁합
 *   5. 이름 오행이 사주의 합충형파해에 미치는 영향
 *
 * 페르소나: "사주+이름 종합 상담사"
 *   - 사주와 이름을 동시에 바라보는 전문가
 *   - 초등학생~중학생도 이해하는 친근한 말투
 *   - 단순 오행 매칭을 넘어 구조적 시너지를 분석
 *
 * Section ID : sajuNameSynergy
 * RNG offset : 48
 */

import type {
  ReportInput,
  ReportSection,
  ReportParagraph,
  ReportTable,
  ReportChart,
  ReportHighlight,
  ReportSubsection,
  ElementCode,
  StrengthLevel,
  YongshinMatchGrade,
} from '../types.js';

import {
  ELEMENT_KOREAN,
  ELEMENT_KOREAN_SHORT,
  ELEMENT_HANJA,
  ELEMENT_COLOR,
  ELEMENT_DIRECTION,
  ELEMENT_NUMBER,
  ELEMENT_SEASON,
  ELEMENT_GENERATES,
  ELEMENT_GENERATED_BY,
  ELEMENT_CONTROLS,
  ELEMENT_CONTROLLED_BY,
  ELEMENT_NATURE,
  ELEMENT_ORGAN,
  ELEMENT_FOOD,
  ELEMENT_EMOTION,
  getElementRelation,
  classifyStrength,
  STRENGTH_KOREAN,
  getYongshinMatchGrade,
  YONGSHIN_GRADE_STARS,
  suriToElement,
  SURI_81_LUCK,
  SURI_LUCK_KOREAN,
  lookupStemInfo,
  lookupBranchInfo,
} from '../common/elementMaps.js';

import {
  createRng,
  pickAndFill,
  fillTemplate,
  narrative,
  positive,
  caution,
  tip,
  emphasis,
  encouraging,
  joinSentences,
  eunNeun,
  iGa,
  eulReul,
  euroRo,
  listJoin,
  pct,
  scoreText,
  type SeededRandom,
} from '../common/sentenceUtils.js';

import {
  buildSajuNameIntegrationSignals,
  type SajuNameIntegrationSignals,
} from '../common/sajuNameIntegration.js';

import {
  scoreNameAgainstSaju,
  type NamingScoreBreakdown,
} from '../common/namingScoreEngine.js';

// =============================================================================
//  1. 유틸리티 & 헬퍼
// =============================================================================

const ALL_ELEMENTS: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

function isElementCode(value: unknown): value is ElementCode {
  return typeof value === 'string' && ALL_ELEMENTS.includes(value as ElementCode);
}

function normalizeElementCodes(
  values: readonly (string | null | undefined)[] | null | undefined,
): ElementCode[] {
  if (!values || values.length === 0) return [];
  return values.filter((value): value is ElementCode => isElementCode(value));
}

function safeName(input: ReportInput): string {
  return input.name?.trim() || '회원';
}

function elFull(c: string | null | undefined): string {
  return c ? (ELEMENT_KOREAN[c as ElementCode] ?? c) : '?';
}

function elShort(c: string | null | undefined): string {
  return c ? (ELEMENT_KOREAN_SHORT[c as ElementCode] ?? c) : '?';
}

function elHanja(c: string | null | undefined): string {
  return c ? (ELEMENT_HANJA[c as ElementCode] ?? c) : '?';
}

function elNature(c: string | null | undefined): string {
  return c ? (ELEMENT_NATURE[c as ElementCode] ?? '') : '';
}

/** 두 오행의 관계를 친근한 말로 설명 */
function describeRelation(a: string, b: string): string {
  const rel = getElementRelation(a as ElementCode, b as ElementCode);
  switch (rel) {
    case 'same': return '같은 기운이라 서로 힘을 보태줘요';
    case 'generates': return `${elShort(a)}가 ${elShort(b)}를 낳아주는 상생 관계예요`;
    case 'generated_by': return `${elShort(b)}가 ${elShort(a)}를 낳아주는 상생 관계예요`;
    case 'controls': return `${elShort(a)}가 ${elShort(b)}를 누르는 상극 관계예요`;
    case 'controlled_by': return `${elShort(b)}가 ${elShort(a)}를 누르는 상극 관계예요`;
    default: return '중립적인 관계예요';
  }
}

/** 신강도 인덱스 추출 (0~100) */
function getStrengthIndex(input: ReportInput): number {
  const s = input.saju.strength;
  const sup = s.totalSupport ?? 0;
  const opp = s.totalOppose ?? 0;
  const total = sup + opp;

  for (const detail of s.details ?? []) {
    const match = detail.match(/강약\s*지수[:\s]*([+-]?\d+\.?\d*)/);
    if (match) {
      const raw = parseFloat(match[1]);
      if (raw >= -1 && raw <= 1) return Math.round((raw + 1) * 50);
      if (raw >= 0 && raw <= 100) return Math.round(raw);
    }
  }
  if (total > 0) return Math.round((sup / total) * 100);
  return s.isStrong ? 65 : 35;
}

/** 5신 체계 산출 */
interface ShenSystem {
  readonly yongshin: ElementCode;
  readonly heeshin: ElementCode;
  readonly gishin: ElementCode;
  readonly gushin: ElementCode;
  readonly hanshin: ElementCode;
}

function deriveShenSystem(input: ReportInput): ShenSystem | null {
  const { yongshin } = input.saju;
  const yongEl = yongshin?.element as ElementCode | undefined;
  if (!yongEl) return null;

  const heeEl = (yongshin.heeshin as ElementCode | null) ?? ELEMENT_GENERATED_BY[yongEl];
  const giEl = (yongshin.gishin as ElementCode | null) ?? ELEMENT_CONTROLLED_BY[yongEl];
  const guEl = (yongshin.gushin as ElementCode | null) ?? ELEMENT_GENERATED_BY[giEl];
  const used = new Set<ElementCode>([yongEl, heeEl, giEl, guEl]);
  const remaining = ALL_ELEMENTS.filter(e => !used.has(e));
  const hanEl = remaining.length > 0 ? remaining[0] : ELEMENT_GENERATES[yongEl];

  return { yongshin: yongEl, heeshin: heeEl, gishin: giEl, gushin: guEl, hanshin: hanEl };
}

/** 이름 오행 추출 (spring 또는 naming에서) */
function extractNameElements(input: ReportInput): string[] {
  // SpringReport의 sajuCompatibility에서
  const spring = input.spring as unknown as Record<string, unknown> | undefined;
  const compat = spring?.['sajuCompatibility'] as Record<string, unknown> | undefined;
  const fromCompat = compat?.['nameElements'] as string[] | undefined;
  if (fromCompat && fromCompat.length > 0) return fromCompat;

  // NamingReport에서
  const naming = input.naming;
  if (!naming) return [];
  const name = naming.name;
  const givenChars = name?.givenName ?? [];
  return givenChars.map(c => c.element).filter(Boolean);
}

/** 수리오행 추출 (NamingReport의 fourFrame) */
function extractSuriElements(input: ReportInput): string[] {
  const naming = input.naming;
  if (!naming) return [];

  const analysis = naming.analysis as Record<string, unknown> | undefined;
  const fourFrame = analysis?.['fourFrame'] as Record<string, unknown> | undefined;
  const frames = fourFrame?.['frames'] as Array<Record<string, unknown>> | undefined;
  if (!frames) return [];
  return frames.map(f => (f['element'] as string) ?? '').filter(Boolean);
}

/** 대운 정보 추출 */
interface DaeunInfo {
  readonly pillar: { stem: string; branch: string };
  readonly element: string;
  readonly startAge: number;
  readonly endAge: number;
}

function extractDaeunList(input: ReportInput): DaeunInfo[] {
  const saju = input.saju as Record<string, unknown>;
  const fortune = saju['fortune'] as Record<string, unknown> | undefined;
  if (!fortune) return [];

  const decades = fortune['decades'] as Array<Record<string, unknown>> | undefined;
  if (!decades) return [];

  return decades.map(d => {
    const pillar = d['pillar'] as Record<string, unknown> | undefined;
    const stem = pillar?.['stem'] as Record<string, unknown> | undefined;
    const branch = pillar?.['branch'] as Record<string, unknown> | undefined;
    const stemEl = (stem?.['element'] as string) ?? '';
    return {
      pillar: {
        stem: (stem?.['hangul'] as string) ?? '',
        branch: (branch?.['hangul'] as string) ?? '',
      },
      element: stemEl,
      startAge: (d['startAgeYears'] as number) ?? 0,
      endAge: (d['endAgeYears'] as number) ?? 0,
    };
  }).filter(d => d.element);
}

/** 합충형파해 관계 추출 */
interface RelationInfo {
  readonly type: string;
  readonly branches: string[];
  readonly outcome?: string | null;
}

function extractJijiRelations(input: ReportInput): RelationInfo[] {
  const relations = input.saju.jijiRelations ?? [];
  return relations.map(r => ({
    type: r.type,
    branches: r.branches ?? [],
    outcome: r.outcome ?? null,
  }));
}

/** 점수를 등급으로 변환 */
type SynergyGrade = 'S' | 'A' | 'B' | 'C' | 'D';

function scoreToGrade(score: number): SynergyGrade {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 55) return 'B';
  if (score >= 35) return 'C';
  return 'D';
}

function gradeKorean(grade: SynergyGrade): string {
  const map: Record<SynergyGrade, string> = {
    S: '최상급 시너지',
    A: '우수한 시너지',
    B: '양호한 시너지',
    C: '보통 수준',
    D: '보완이 필요한 조합',
  };
  return map[grade];
}

function gradeEmoji(grade: SynergyGrade): string {
  const map: Record<SynergyGrade, string> = {
    S: '+++', A: '++', B: '+', C: '=', D: '-',
  };
  return map[grade];
}

// =============================================================================
//  2. 시너지 분석 엔진
// =============================================================================

// -- 2-1. 용신 보완도 ---

interface YongshinCompensation {
  readonly score: number;          // 0~100
  readonly directMatch: number;    // 이름에서 용신과 동일한 오행 수
  readonly generatesYong: number;  // 이름에서 용신을 생(生)하는 오행 수
  readonly controlsYong: number;   // 이름에서 용신을 극(剋)하는 오행 수
  readonly gishinMatch: number;    // 이름에서 기신과 동일한 오행 수
  readonly detail: string;
}

function calcYongshinCompensation(
  shen: ShenSystem,
  nameElements: string[],
  suriElements: string[],
): YongshinCompensation {
  let directMatch = 0;
  let generatesYong = 0;
  let controlsYong = 0;
  let gishinMatch = 0;

  const allNameEl = [...nameElements, ...suriElements];

  for (const el of allNameEl) {
    if (el === shen.yongshin) directMatch++;
    else if (el === shen.heeshin) generatesYong++;
    else if (ELEMENT_GENERATES[el as ElementCode] === shen.yongshin) generatesYong++;
    else if (ELEMENT_CONTROLS[el as ElementCode] === shen.yongshin) controlsYong++;
    if (el === shen.gishin) gishinMatch++;
  }

  // 점수 산출: 직접 일치 30점, 상생 지원 20점, 상극 감점 -15점, 기신 감점 -10점
  const total = allNameEl.length || 1;
  let score = 50; // 기본 50점 (중립)
  score += (directMatch / total) * 30;
  score += (generatesYong / total) * 20;
  score -= (controlsYong / total) * 15;
  score -= (gishinMatch / total) * 10;
  // 자원오행에서 용신/희신 직접 보유 보너스
  const nameDirectYong = nameElements.filter(e => e === shen.yongshin).length;
  const nameDirectHee = nameElements.filter(e => e === shen.heeshin).length;
  score += nameDirectYong * 8;
  score += nameDirectHee * 5;
  score = Math.round(Math.max(0, Math.min(100, score)));

  let detail = '';
  if (directMatch > 0) detail += `용신(${elShort(shen.yongshin)}) 직접 보충 ${directMatch}개. `;
  if (generatesYong > 0) detail += `용신을 생해주는 오행 ${generatesYong}개. `;
  if (gishinMatch > 0) detail += `기신(${elShort(shen.gishin)}) 충돌 ${gishinMatch}개. `;
  if (controlsYong > 0) detail += `용신을 극하는 오행 ${controlsYong}개. `;
  if (!detail) detail = '이름 오행과 용신의 직접적 연결은 없지만, 중립적인 관계예요.';

  return { score, directMatch, generatesYong, controlsYong, gishinMatch, detail };
}

// -- 2-2. 격국 적합도 ---

interface GyeokgukFit {
  readonly score: number;        // 0~100
  readonly category: string;
  readonly fitLevel: string;
  readonly reasoning: string;
}

function calcGyeokgukFit(
  input: ReportInput,
  shen: ShenSystem,
  nameElements: string[],
): GyeokgukFit {
  const gyeokguk = input.saju.gyeokguk;
  const category = gyeokguk?.category ?? '';
  const type = gyeokguk?.type ?? '';

  // 격국 카테고리별 이름 적합 기준
  let score = 50;
  let fitLevel = '보통';
  let reasoning = '';

  const hasYong = nameElements.includes(shen.yongshin);
  const hasHee = nameElements.includes(shen.heeshin);
  const hasGi = nameElements.includes(shen.gishin);

  // 정격(正格): 용신/희신이 이름에 있으면 최적
  if (category === '정격') {
    if (hasYong) { score += 25; fitLevel = '매우 좋음'; reasoning = '정격 사주에서 용신을 이름으로 보강하면 격국의 순수성이 더 높아져요.'; }
    else if (hasHee) { score += 15; fitLevel = '좋음'; reasoning = '정격의 기초를 희신이 뒷받침해서 안정적인 구조예요.'; }
    if (hasGi) { score -= 15; reasoning += ' 다만 기신이 포함되어 격국의 순수성에 약간 영향을 줄 수 있어요.'; }
  }
  // 편격(偏格): 용신+대담한 오행 조합이 유리
  else if (category === '편격') {
    if (hasYong) { score += 20; fitLevel = '좋음'; reasoning = '편격 사주에서 용신이 이름에 있으면 파격적 에너지를 안정적으로 다스릴 수 있어요.'; }
    else if (hasHee) { score += 12; fitLevel = '양호'; reasoning = '편격의 자유로운 기운에 희신이 균형을 잡아줘요.'; }
    if (hasGi) { score -= 10; reasoning += ' 기신이 포함되어 있지만, 편격은 변화를 잘 소화하는 구조라 크게 걱정할 수준은 아니에요.'; }
  }
  // 종격(從格): 강한 흐름을 따르는 이름이 좋음
  else if (category === '종격') {
    // 종격에서는 종하는 오행에 순응하는 것이 중요
    const dominant = input.saju.excessiveElements?.[0] ?? null;
    if (dominant && nameElements.includes(dominant)) {
      score += 25; fitLevel = '매우 좋음';
      reasoning = `종격 사주에서는 흐름에 순응하는 것이 핵심인데, 이름의 ${elShort(dominant)} 오행이 그 흐름을 따라가고 있어요!`;
    } else if (hasYong) {
      score += 15; fitLevel = '좋음';
      reasoning = '종격에서 용신이 이름에 있으면 큰 흐름 속에서 중심을 잡아줄 수 있어요.';
    } else {
      fitLevel = '보통'; reasoning = '종격의 강한 흐름과 이름 오행이 직접적인 연결은 없지만, 해가 되지는 않아요.';
    }
  }
  // 외격 또는 기타
  else {
    if (hasYong) { score += 18; fitLevel = '좋음'; reasoning = '이름의 용신 오행이 격국에 긍정적인 에너지를 보태고 있어요.'; }
    else if (hasHee) { score += 10; fitLevel = '양호'; reasoning = '희신이 이름에 포함되어 격국을 뒷받침해 줘요.'; }
    else { fitLevel = '보통'; reasoning = '이름 오행과 격국 사이에 특별한 충돌이나 조화는 없어요.'; }
  }

  score = Math.round(Math.max(0, Math.min(100, score)));
  return { score, category, fitLevel, reasoning };
}

// -- 2-3. 대운 방어력 (이름이 기신 대운에서 방패 역할) ---

interface DaeunDefense {
  readonly score: number;          // 0~100
  readonly totalDaeun: number;
  readonly protectedDaeun: number;
  readonly vulnerableDaeun: number;
  readonly details: DaeunDefenseDetail[];
}

interface DaeunDefenseDetail {
  readonly ageRange: string;
  readonly daeunElement: string;
  readonly grade: YongshinMatchGrade;
  readonly nameProtection: 'strong' | 'partial' | 'none' | 'conflict';
  readonly explanation: string;
}

function calcDaeunDefense(
  shen: ShenSystem,
  nameElements: string[],
  daeunList: DaeunInfo[],
): DaeunDefense {
  if (daeunList.length === 0) {
    return { score: 50, totalDaeun: 0, protectedDaeun: 0, vulnerableDaeun: 0, details: [] };
  }

  let protectedCount = 0;
  let vulnerableCount = 0;
  const details: DaeunDefenseDetail[] = [];

  for (const daeun of daeunList) {
    const dEl = daeun.element as ElementCode;
    const grade = getYongshinMatchGrade(dEl, shen.yongshin, shen.heeshin, shen.hanshin, shen.gushin, shen.gishin);
    const ageRange = `${daeun.startAge}~${daeun.endAge}세`;

    let nameProtection: 'strong' | 'partial' | 'none' | 'conflict' = 'none';
    let explanation = '';

    // 대운이 기신/구신일 때 이름이 방어하는지
    if (grade <= 2) {
      // 기신/구신 대운
      const nameHasYong = nameElements.includes(shen.yongshin);
      const nameHasHee = nameElements.includes(shen.heeshin);
      // 이름이 기신을 극하는 오행을 가지고 있는지
      const nameControlsGishin = nameElements.some(
        ne => ELEMENT_CONTROLS[ne as ElementCode] === shen.gishin,
      );

      if (nameHasYong || nameControlsGishin) {
        nameProtection = 'strong';
        protectedCount++;
        explanation = `이 시기에 기신(${elShort(shen.gishin)})의 기운이 강해지지만, ` +
          `이름의 ${nameHasYong ? elShort(shen.yongshin) : ''}${nameControlsGishin ? ' 오행' : ''} 에너지가 ` +
          `방어막 역할을 해서 어려움을 줄여줄 수 있어요.`;
      } else if (nameHasHee) {
        nameProtection = 'partial';
        protectedCount++;
        explanation = `기신의 기운이 세지는 시기지만, 이름의 희신(${elShort(shen.heeshin)}) 오행이 ` +
          `완충 역할을 하고 있어요. 완벽하진 않아도 분명 도움이 돼요!`;
      } else if (nameElements.includes(shen.gishin)) {
        nameProtection = 'conflict';
        vulnerableCount++;
        explanation = `이 시기에 기신(${elShort(shen.gishin)})이 강해지는데, 이름에도 같은 오행이 있어서 ` +
          `기신의 영향이 커질 수 있어요. 다른 방법으로 용신을 보강하면 좋겠어요.`;
      } else {
        nameProtection = 'none';
        explanation = `기신의 기운이 강한 시기인데, 이름이 직접적인 방어 역할은 하지 못하고 있어요. ` +
          `이 시기에는 용신(${elShort(shen.yongshin)})을 다른 생활 요소로 보강하는 것이 좋겠어요.`;
      }
    } else if (grade >= 4) {
      // 용신/희신 대운 — 이름과 함께 시너지
      const nameHasYong = nameElements.includes(shen.yongshin);
      if (nameHasYong) {
        nameProtection = 'strong';
        protectedCount++;
        explanation = `용신의 기운이 대운으로도 이름으로도 들어오는 황금기예요! ` +
          `두 배의 좋은 에너지가 합쳐지는 최고의 시기랍니다.`;
      } else {
        nameProtection = 'partial';
        explanation = `대운이 용신/희신과 맞아서 좋은 시기예요. ` +
          `이름이 직접 용신은 아니지만 전반적으로 순탄한 흐름이에요.`;
      }
    } else {
      // 중립 대운
      const nameHasYong = nameElements.includes(shen.yongshin);
      if (nameHasYong) {
        nameProtection = 'partial';
        explanation = `중립적인 대운이지만, 이름의 용신(${elShort(shen.yongshin)}) 오행이 ` +
          `기본적인 에너지를 꾸준히 공급해주고 있어요.`;
      } else {
        nameProtection = 'none';
        explanation = '특별히 좋지도 나쁘지도 않은 시기예요. 꾸준히 용신을 보강하면서 가면 돼요.';
      }
    }

    details.push({
      ageRange,
      daeunElement: daeun.element,
      grade,
      nameProtection,
      explanation,
    });
  }

  // 점수 산출: 방어 비율 기반
  const total = daeunList.length;
  const protectionRatio = total > 0 ? protectedCount / total : 0;
  const vulnerableRatio = total > 0 ? vulnerableCount / total : 0;
  let score = 50 + Math.round(protectionRatio * 35) - Math.round(vulnerableRatio * 25);
  score = Math.max(0, Math.min(100, score));

  return { score, totalDaeun: total, protectedDaeun: protectedCount, vulnerableDaeun: vulnerableCount, details };
}

// -- 2-4. 신강도별 이름 역할 분석 ---

interface StrengthNameRole {
  readonly strengthLevel: StrengthLevel;
  readonly strengthIndex: number;
  readonly role: string;
  readonly explanation: string;
  readonly recommendation: string;
  readonly score: number; // 이름이 해당 역할에 적합한지 0~100
}

function calcStrengthNameRole(
  input: ReportInput,
  shen: ShenSystem,
  nameElements: string[],
): StrengthNameRole {
  const idx = getStrengthIndex(input);
  const level = classifyStrength(idx);

  let role = '';
  let explanation = '';
  let recommendation = '';
  let score = 50;

  const yongEl = shen.yongshin;
  const giEl = shen.gishin;
  const hasYong = nameElements.includes(yongEl);
  const hasHee = nameElements.includes(shen.heeshin);
  const hasGi = nameElements.includes(giEl);
  const dayMasterEl = input.saju.dayMaster?.element as ElementCode | undefined;

  switch (level) {
    case 'EXTREME_STRONG': {
      // 극신강: 이름이 일간의 기운을 설기(泄氣)시켜야 함 → 식상/재성 오행이 좋음
      role = '기운 분산자 (설기 역할)';
      const outputEl = dayMasterEl ? ELEMENT_GENERATES[dayMasterEl] : null;
      const wealthEl = outputEl ? ELEMENT_GENERATES[outputEl] : null;

      if (outputEl && nameElements.includes(outputEl)) {
        score = 80;
        explanation = `극신강 사주는 넘치는 에너지를 밖으로 풀어줘야 해요. 이름의 ${elShort(outputEl)}(식상) 오행이 ` +
          `일간의 강한 기운을 건강하게 표출시켜주는 역할을 하고 있어요.`;
      } else if (wealthEl && nameElements.includes(wealthEl)) {
        score = 70;
        explanation = `극신강 사주에서 이름의 ${elShort(wealthEl)}(재성) 오행은 넘치는 기운을 ` +
          `재물과 현실적 성취로 전환하는 좋은 역할을 해요.`;
      } else if (hasGi) {
        score = 35;
        explanation = `극신강 사주에서 기신(${elShort(giEl)}) 오행이 이름에 있으면 ` +
          `이미 강한 기운을 더 키울 수 있어 주의가 필요해요.`;
      } else {
        score = 50;
        explanation = '극신강 사주에서 이름이 특별한 설기 역할은 하지 못하지만, 큰 해도 없어요.';
      }
      recommendation = `극신강일 때는 식상(${outputEl ? elShort(outputEl) : '?'})이나 재성(${wealthEl ? elShort(wealthEl) : '?'}) ` +
        `오행이 이름에 있으면 가장 좋아요. 넘치는 에너지를 건강하게 활용하는 통로가 되거든요!`;
      break;
    }

    case 'STRONG': {
      // 신강: 용신으로 균형 맞추기, 식상/재성도 좋음
      role = '균형 조절자';
      if (hasYong) {
        score = 85;
        explanation = `신강 사주에서 용신(${elShort(yongEl)})이 이름에 있으면 ` +
          `넘치는 기운에 적절한 브레이크를 걸어주는 효과가 있어요. 아주 좋은 조합이에요!`;
      } else if (hasHee) {
        score = 70;
        explanation = `신강 사주에서 희신(${elShort(shen.heeshin)})이 이름에 있으면 ` +
          `간접적으로 균형을 맞추는 데 도움을 줘요.`;
      } else if (hasGi) {
        score = 30;
        explanation = `신강 사주에서 기신(${elShort(giEl)}) 오행이 이름에 있으면 ` +
          `이미 강한 쪽을 더 강하게 만들 수 있어서 아쉬운 면이 있어요.`;
      } else {
        score = 50;
        explanation = '신강 사주와 이름 오행 사이에 특별한 시너지는 없지만, 중립적이에요.';
      }
      recommendation = `신강 사주에는 용신(${elShort(yongEl)})이나 관성/재성 오행이 이름에 있으면 ` +
        `적절한 균형을 찾는 데 도움이 돼요.`;
      break;
    }

    case 'BALANCED': {
      // 중화: 균형이 잡혀 있으므로 이름이 그 균형을 유지하면 됨
      role = '균형 유지자';
      if (hasYong) {
        score = 75;
        explanation = `중화 사주는 이미 균형이 좋은 편인데, 용신(${elShort(yongEl)})이 이름에 있으면 ` +
          `미세한 불균형까지 잡아주는 "미세 조정" 역할을 해요.`;
      } else if (hasGi) {
        score = 40;
        explanation = `중화 사주에서 기신(${elShort(giEl)}) 오행이 이름에 있으면 ` +
          `좋은 균형을 살짝 흔들 수 있어서 주의가 필요해요.`;
      } else {
        score = 60;
        explanation = '중화 사주는 원래 균형이 좋으니, 이름이 어떤 오행이든 큰 탈은 없어요. 걱정 마세요!';
      }
      recommendation = '중화 사주는 큰 보완 없이도 안정적이에요. 용신 오행이 이름에 있으면 금상첨화!';
      break;
    }

    case 'WEAK': {
      // 신약: 이름이 일간을 도와주는 인성/비겁 오행이 필요
      role = '힘 보태기 (인성/비겁 지원)';
      const resourceEl = dayMasterEl ? ELEMENT_GENERATED_BY[dayMasterEl] : null;

      if (hasYong) {
        score = 85;
        explanation = `신약 사주에서 용신(${elShort(yongEl)})이 이름에 있으면 ` +
          `약한 일간에게 에너지를 직접 공급하는 "보약" 같은 역할을 해요!`;
      } else if (resourceEl && nameElements.includes(resourceEl)) {
        score = 75;
        explanation = `신약 사주에서 인성(${elShort(resourceEl)}) 오행이 이름에 있으면 ` +
          `일간을 생(生)해주어 힘을 보태주는 효과가 있어요.`;
      } else if (dayMasterEl && nameElements.includes(dayMasterEl)) {
        score = 70;
        explanation = `이름에 일간과 같은 ${elShort(dayMasterEl)} 오행(비겁)이 있어서 ` +
          `약한 일간에게 동료의 힘을 보태주고 있어요.`;
      } else if (hasGi) {
        score = 25;
        explanation = `신약 사주에서 기신(${elShort(giEl)}) 오행이 이름에 있으면 ` +
          `이미 약한 일간을 더 압박할 수 있어서 아쉬운 조합이에요.`;
      } else {
        score = 45;
        explanation = '신약 사주에서 이름이 특별한 힘을 보태지는 못하지만, 해가 되지도 않아요.';
      }
      recommendation = `신약 사주에는 인성(${resourceEl ? elShort(resourceEl) : '?'})이나 ` +
        `비겁(${dayMasterEl ? elShort(dayMasterEl) : '?'}) 오행이 이름에 있으면 ` +
        `약한 기운을 든든하게 받쳐줘요!`;
      break;
    }

    case 'EXTREME_WEAK': {
      // 극신약: 종격 가능성 고려, 종격이면 흐름을 따라가는 것이 좋음
      role = '흐름 동반자 (종격 적응)';
      const dominant = input.saju.excessiveElements?.[0] as ElementCode | undefined;

      if (dominant && nameElements.includes(dominant)) {
        score = 80;
        explanation = `극신약/종격 사주에서는 강한 흐름에 순응하는 것이 핵심이에요. ` +
          `이름의 ${elShort(dominant)} 오행이 그 흐름을 따라가고 있어서 좋은 궁합이에요!`;
      } else if (hasYong) {
        score = 70;
        explanation = `극신약 사주에서 용신(${elShort(yongEl)})이 이름에 있으면 ` +
          `약한 기운을 보강하는 "생명줄" 같은 역할을 해요.`;
      } else if (hasGi) {
        score = 20;
        explanation = `극신약 사주에서 기신(${elShort(giEl)}) 오행이 이름에 있으면 ` +
          `약한 일간을 더 억누를 수 있어서 특히 주의가 필요해요.`;
      } else {
        score = 40;
        explanation = '극신약 사주에서 이름의 보강이 절실한데, 현재는 중립적이에요.';
      }
      recommendation = '극신약이면 종격 여부를 확인하고, 종격이면 흐름에 순응하는 오행을, 아니면 인성/비겁 오행을 추천해요!';
      break;
    }
  }

  return { strengthLevel: level, strengthIndex: idx, role, explanation, recommendation, score };
}

// -- 2-5. 합충형파해와 이름의 관계 ---

interface RelationNameImpact {
  readonly score: number;          // 0~100
  readonly positiveRelations: string[];
  readonly negativeRelations: string[];
  readonly nameBufferEffect: string;
  readonly details: string[];
}

function calcRelationNameImpact(
  shen: ShenSystem,
  nameElements: string[],
  relations: RelationInfo[],
): RelationNameImpact {
  const positiveRelations: string[] = [];
  const negativeRelations: string[] = [];
  const details: string[] = [];
  let score = 50;

  const yongEl = shen.yongshin;
  const giEl = shen.gishin;

  // 합(合) 관계 분석
  const haps = relations.filter(r => ['합', 'HAP', '육합', '삼합', '방합', 'YUKHAP', 'SAMHAP', 'BANGHAP'].includes(r.type));
  const chungs = relations.filter(r => ['충', 'CHUNG', 'chung'].includes(r.type));
  const hyeongs = relations.filter(r => ['hyeong', '형'].includes(r.type));
  const pas = relations.filter(r => ['pa', '파'].includes(r.type));
  const haes = relations.filter(r => ['hae', '해'].includes(r.type));

  // 합이 많으면 이름의 역할이 안정화 방향
  if (haps.length > 0) {
    positiveRelations.push(`합(合) ${haps.length}개`);
    const hapDetail = `사주에 합(合)이 ${haps.length}개 있어서 결속력이 좋아요. ` +
      `이름이 용신(${elShort(yongEl)}) 오행이면 이 합의 좋은 에너지를 더 키워줄 수 있어요.`;
    details.push(hapDetail);
    if (nameElements.includes(yongEl)) score += 5;
  }

  // 충(冲)이 있으면 이름이 통관 역할 가능
  if (chungs.length > 0) {
    negativeRelations.push(`충(冲) ${chungs.length}개`);
    // 충하는 두 오행 사이의 통관(다리) 역할 분석
    let hasBuffer = false;
    for (const chung of chungs) {
      const branches = chung.branches;
      if (branches.length >= 2) {
        const b1 = lookupBranchInfo(branches[0]);
        const b2 = lookupBranchInfo(branches[1]);
        if (b1 && b2) {
          // 두 오행의 통관 오행을 찾아, 이름에 있는지 확인
          const bridgeEl = ELEMENT_GENERATES[b1.element] === b2.element ? b1.element
            : ELEMENT_GENERATES[b2.element] === b1.element ? b2.element : null;
          if (bridgeEl && nameElements.includes(bridgeEl)) {
            hasBuffer = true;
            details.push(
              `${b1.hangul}-${b2.hangul} 충(冲)에서 이름의 ${elShort(bridgeEl)} 오행이 ` +
              `두 기운 사이의 다리(통관) 역할을 해줄 수 있어요!`,
            );
            score += 8;
          }
        }
      }
    }
    if (!hasBuffer) {
      details.push(
        `사주에 충(冲)이 ${chungs.length}개 있어 변화와 갈등의 에너지가 있어요. ` +
        `이름이 통관 오행이었다면 완충제 역할을 할 수 있었을 텐데, 현재는 직접적인 완충은 없어요.`,
      );
    }
  }

  // 형(刑)이 있으면 이름의 안정화 역할 분석
  if (hyeongs.length > 0) {
    negativeRelations.push(`형(刑) ${hyeongs.length}개`);
    if (nameElements.includes(yongEl)) {
      details.push(`형(刑)의 부딪히는 에너지가 있지만, 이름의 용신(${elShort(yongEl)}) 오행이 완충 역할을 해줘요.`);
      score += 5;
    } else {
      details.push('형(刑)의 긴장 에너지가 있는데, 이름이 직접적인 완충은 못 하고 있어요. 용신 보강으로 보완하면 좋겠어요.');
    }
  }

  // 파(破), 해(害)
  if (pas.length > 0) {
    negativeRelations.push(`파(破) ${pas.length}개`);
    details.push(`파(破)의 깨지는 에너지가 ${pas.length}개 있어요. 이름의 안정적 오행이 이를 달래줄 수 있답니다.`);
  }
  if (haes.length > 0) {
    negativeRelations.push(`해(害) ${haes.length}개`);
    details.push(`해(害)의 미묘한 갈등이 ${haes.length}개 있어요. 이름이 용신 오행이면 이 갈등을 줄이는 데 도움이 돼요.`);
  }

  // 충/형/파/해가 많을수록 이름의 안정화 역할이 중요
  const negCount = chungs.length + hyeongs.length + pas.length + haes.length;
  if (negCount >= 3 && nameElements.includes(yongEl)) {
    score += 10;
    details.push('충돌이 많은 사주에서 이름의 용신 오행은 특히 소중한 안정장치 역할을 해요!');
  } else if (negCount >= 3) {
    score -= 5;
  }

  let nameBufferEffect = '';
  if (score >= 60 && negCount > 0) {
    nameBufferEffect = '이름이 사주의 충돌 에너지를 일부 완화하는 역할을 하고 있어요.';
  } else if (negCount === 0) {
    nameBufferEffect = '사주에 큰 충돌이 없어서, 이름이 별도의 완충 역할을 할 필요가 적어요.';
  } else {
    nameBufferEffect = '이름이 충돌 에너지의 직접적 완충은 못 하고 있지만, 용신 보강으로 보완 가능해요.';
  }

  score = Math.max(0, Math.min(100, score));
  return { score, positiveRelations, negativeRelations, nameBufferEffect, details };
}

// -- 2-6. 종합 시너지 점수 ---

interface OverallSynergy {
  readonly totalScore: number;
  readonly yongshinScore: number;
  readonly gyeokgukScore: number;
  readonly daeunScore: number;
  readonly strengthScore: number;
  readonly relationScore: number;
  readonly grade: SynergyGrade;
}

function calcOverallSynergy(
  yongshinComp: YongshinCompensation,
  gyeokgukFit: GyeokgukFit,
  daeunDef: DaeunDefense,
  strengthRole: StrengthNameRole,
  relationImpact: RelationNameImpact,
): OverallSynergy {
  // 가중 평균: 용신 30%, 격국 20%, 대운 20%, 신강도 15%, 합충형파해 15%
  const totalScore = Math.round(
    yongshinComp.score * 0.30 +
    gyeokgukFit.score * 0.20 +
    daeunDef.score * 0.20 +
    strengthRole.score * 0.15 +
    relationImpact.score * 0.15,
  );

  return {
    totalScore: Math.max(0, Math.min(100, totalScore)),
    yongshinScore: yongshinComp.score,
    gyeokgukScore: gyeokgukFit.score,
    daeunScore: daeunDef.score,
    strengthScore: strengthRole.score,
    relationScore: relationImpact.score,
    grade: scoreToGrade(totalScore),
  };
}

// =============================================================================
//  3. 문장 템플릿 풀 — "사주+이름 종합 상담사" 페르소나
// =============================================================================

// -- 3-1. 도입부 ---

const INTRO_TEMPLATES: readonly string[] = [
  '지금부터는 사주와 이름을 동시에 놓고 바라보는, 아주 특별한 시간이에요! 사주가 타고난 설계도라면, 이름은 매일 불러주는 에너지 주문 같은 거거든요. {{이름}}님의 이름이 사주와 어떤 시너지를 만들어내는지, 다섯 가지 관점에서 꼼꼼히 분석해 볼게요.',
  '사주만 보거나 이름만 보는 것은 동전의 한 면만 보는 것과 같아요. 진짜 중요한 건 사주와 이름이 만나서 어떤 "케미"를 만드느냐예요! {{이름}}님, 이 둘의 환상적인(혹은 아쉬운?) 조합을 낱낱이 파헤쳐 볼게요.',
  '이름은 하루에도 수십 번 불리고, 수백 번 쓰이죠? 그래서 이름의 오행 에너지는 사주에 끊임없이 영향을 미친답니다. {{이름}}님의 사주 구조와 이름이 만들어내는 시너지를 지금부터 종합적으로 분석해 드릴게요!',
  '사주를 집이라고 하면, 이름은 그 집에 흐르는 전기 같은 거예요. 집이 아무리 잘 지어져도 전기가 불안정하면 불편하고, 반대로 좋은 전기가 흐르면 모든 게 원활하거든요. {{이름}}님의 사주와 이름의 전력 궁합을 알아볼까요?',
  '자, 이제 정말 흥미로운 분석이 시작돼요! 사주의 용신, 격국, 신강도, 대운, 합충형파해... 이 모든 요소가 이름 오행과 만나면 어떤 화학반응이 일어나는지, {{이름}}님과 함께 살펴볼게요.',
  '여기서부터는 "사주+이름 종합 상담"이에요. 단순히 "이 오행이 맞네, 안 맞네"를 넘어서, 사주의 전체 구조와 이름이 얼마나 유기적으로 맞물리는지를 분석하는 거랍니다. {{이름}}님, 준비됐나요?',
];

// -- 3-2. 용신 보완도 해석 ---

const YONG_COMP_HIGH: readonly string[] = [
  '이 이름은 용신({{용신}})을 직접 보충해서 사주의 핵심 약점을 채워주고 있어요! 마치 갈증 날 때 시원한 물을 마시는 것처럼, 딱 필요한 에너지가 이름에 담겨 있는 거예요.',
  '용신({{용신}}) 보완도가 아주 높아요! 이름이 사주에 부족한 기운을 직접 공급하는 "맞춤 영양제" 역할을 하고 있답니다. 이보다 좋은 조합은 드물어요!',
  '이름이 용신({{용신}})을 꼭 품고 있어서, 사주가 가장 필요로 하는 에너지를 24시간 공급받는 셈이에요. 이름을 부를 때마다 좋은 기운이 충전되는 거죠!',
  '{{이름}}님의 이름은 사주의 핵심 필요 오행인 {{용신}}을 직접 담고 있어요. 이건 마치 추운 겨울에 따뜻한 패딩을 입고 있는 것과 같은, 정말 좋은 시너지예요!',
];

const YONG_COMP_MID: readonly string[] = [
  '이름이 용신({{용신}})을 간접적으로 지원하는 구조예요. 용신을 직접 담고 있지는 않지만, 희신이나 상생 관계의 오행이 있어서 우회적으로 도움을 주고 있답니다.',
  '용신({{용신}}) 보완도가 보통 수준이에요. 직접적인 보충은 아니지만, 이름의 오행이 용신과 적대적이지 않아서 충돌 없이 공존하고 있는 거예요.',
  '이름이 용신에 직접 에너지를 보내진 못하지만, 적어도 방해하지는 않고 있어요. 비유하자면, 용신에게 "응원"은 보내지만 "간식"까지는 못 챙기는 거랄까요?',
];

const YONG_COMP_LOW: readonly string[] = [
  '이름의 오행과 용신({{용신}}) 사이에 약간의 엇갈림이 있어요. 하지만 절대 나쁜 이름이라는 뜻은 아니에요! 생활 속에서 용신 오행을 보강하면 충분히 보완 가능하답니다.',
  '용신({{용신}}) 보완도가 아쉬운 편이에요. 이름에 기신 오행이 포함되어 있을 수 있는데, 걱정하지 마세요. 이름 외에도 색상, 방위, 음식 등으로 용신을 채우는 방법이 많거든요!',
  '이름과 용신 사이의 시너지가 약한 편이지만, 이름은 인생의 한 요소일 뿐이에요. 용신({{용신}})에 맞는 생활 습관으로 충분히 보완할 수 있으니 너무 걱정하지 마세요!',
];

// -- 3-3. 격국 적합도 해석 ---

const GYEOK_FIT_HIGH: readonly string[] = [
  '격국과 이름의 궁합이 정말 좋아요! {{격국}} 격국의 특성에 이름의 오행이 딱 맞물려서, 마치 퍼즐의 마지막 조각이 끼워진 것 같은 느낌이에요.',
  '이 이름은 {{격국}} 격국의 장점을 극대화하는 구성이에요. 격국이 원하는 방향과 이름의 에너지가 같은 곳을 향하고 있거든요!',
  '{{격국}} 격국에 이 이름은 찰떡궁합이에요! 격국의 설계도 위에 이름이라는 좋은 자재가 올라간 셈이랍니다.',
];

const GYEOK_FIT_MID: readonly string[] = [
  '격국과 이름의 관계가 나쁘지 않아요. {{격국}} 격국의 큰 틀에서 벗어나지 않으면서, 이름만의 개성도 살아 있는 조합이에요.',
  '{{격국}} 격국과 이름 오행이 서로 큰 충돌 없이 공존하고 있어요. 완벽한 시너지까지는 아니지만, 안정적인 관계랍니다.',
];

const GYEOK_FIT_LOW: readonly string[] = [
  '{{격국}} 격국과 이름의 오행 방향이 조금 다르지만, 이게 꼭 나쁜 것만은 아니에요. 격국은 바꿀 수 없지만, 용신 보강으로 이 간극을 좁힐 수 있거든요.',
  '이름과 격국의 궁합이 아쉬운 편이에요. 하지만 격국은 "큰 틀"이고, 이름은 "세부 장식"에 해당하니 생활 속 보완이 더 중요하답니다.',
];

// -- 3-4. 대운 방어력 해석 ---

const DAEUN_DEF_HIGH: readonly string[] = [
  '이름이 대운의 기복에 대해 훌륭한 방어력을 갖추고 있어요! 기신 대운이 찾아와도 이름의 오행이 든든한 방패가 되어줄 거예요.',
  '대운이 바뀌면서 기신의 기운이 강해지는 시기가 있는데, {{이름}}님의 이름은 그때도 꿋꿋이 용신 에너지를 공급해주는 "비상 발전기" 역할을 해요!',
  '이름의 대운 방어력이 높아요! 좋은 대운에서는 시너지를 극대화하고, 어려운 대운에서는 방어막 역할을 하는 만능 이름이네요.',
];

const DAEUN_DEF_MID: readonly string[] = [
  '이름의 대운 방어력이 보통 수준이에요. 일부 어려운 시기에는 보호를 받을 수 있지만, 모든 기신 대운을 막아주지는 못해요.',
  '대운 타임라인과 이름을 대조해 보면, 절반 정도의 기신 대운에서 이름이 완충 역할을 하고 있어요. 나머지는 다른 방법으로 보강하면 돼요!',
];

const DAEUN_DEF_LOW: readonly string[] = [
  '이름의 대운 방어력이 아쉬운 편이에요. 기신 대운이 올 때 이름만으로는 충분한 보호가 어려워서, 그 시기에 맞춘 추가 보완이 필요해요.',
  '대운 변화에 대한 이름의 방어력이 약한 편이지만, 미리 알고 대비하면 괜찮아요! 기신 대운이 올 때 용신 보강을 집중적으로 하면 돼요.',
];

// -- 3-5. 신강도별 해석 ---

const STRENGTH_ROLE_HIGH: readonly string[] = [
  '{{이름}}님의 신강도({{수준}})에 이름이 딱 맞는 역할을 하고 있어요! {{역할}}로서 사주의 균형을 잡아주는 데 큰 기여를 하고 있답니다.',
  '이름이 "{{역할}}" 역할을 완벽하게 수행하고 있어요! {{수준}} 사주에 이만큼 잘 맞는 이름도 드물어요.',
];

const STRENGTH_ROLE_MID: readonly string[] = [
  '{{수준}} 사주에서 이름의 역할이 보통 수준이에요. "{{역할}}" 역할을 일부 수행하고 있지만, 좀 더 보강하면 더 좋을 거예요.',
  '이름이 {{수준}} 사주의 "{{역할}}" 역할을 어느 정도는 해주고 있어요. 완벽하진 않지만, 큰 탈 없는 조합이에요.',
];

const STRENGTH_ROLE_LOW: readonly string[] = [
  '{{수준}} 사주에서 이름의 역할이 아쉬운 편이에요. "{{역할}}" 역할이 필요한데, 현재 이름 오행은 다른 방향을 향하고 있거든요.',
  '이름과 신강도의 궁합이 살짝 엇나가 있어요. {{수준}} 사주에는 "{{역할}}"이 중요한데, 이름만으로는 부족할 수 있어서 생활 속 보완이 필요해요.',
];

// -- 3-6. 합충형파해 해석 ---

const RELATION_IMPACT_POS: readonly string[] = [
  '사주의 합충형파해 관계에서 이름이 긍정적인 역할을 하고 있어요! 충돌 에너지를 완화하거나, 좋은 합(合)의 에너지를 더 키워주고 있답니다.',
  '이름의 오행이 사주의 충돌을 달래주는 "중재자" 역할을 하고 있어요! 갈등 속에서 평화를 찾는 외교관 같은 이름이네요.',
];

const RELATION_IMPACT_NEU: readonly string[] = [
  '사주의 합충형파해 관계에서 이름은 중립적인 위치에 있어요. 특별히 완충하지도, 악화시키지도 않는 균형 잡힌 관계예요.',
  '이름이 사주의 합충형파해에 특별한 영향을 미치지는 않아요. 중립적인 관계니 걱정할 것은 없답니다.',
];

const RELATION_IMPACT_NEG: readonly string[] = [
  '이름 오행이 사주의 충돌 에너지와 살짝 공명하는 면이 있어요. 하지만 이건 이름 하나로 결정되는 게 아니라, 생활 보완으로 충분히 다스릴 수 있어요.',
  '사주의 충돌 관계에서 이름이 완충보다는 약간의 자극제가 되고 있어요. 용신 보강에 더 신경 쓰면 충분히 해결할 수 있답니다.',
];

// -- 3-7. 종합 평가 ---

const OVERALL_HIGH: readonly string[] = [
  '종합 시너지 점수가 정말 높아요! {{이름}}님의 이름은 사주의 모든 면에서 좋은 파트너 역할을 하고 있답니다. 이름을 부를 때마다 좋은 에너지가 충전되는 거예요!',
  '사주-이름 시너지가 {{등급}} 등급이에요! 사주의 약점은 보완하고, 강점은 극대화하는 이상적인 이름이네요. 정말 잘 지은 이름이에요!',
  '이 분석에서 {{이름}}님의 이름은 사주와 거의 완벽한 시너지를 보여주고 있어요. 용신 보완, 격국 적합, 대운 방어까지 골고루 갖춘 이름이랍니다!',
];

const OVERALL_MID: readonly string[] = [
  '종합 시너지 점수가 양호한 편이에요. {{이름}}님의 이름과 사주는 서로 큰 충돌 없이 함께 가고 있는 관계예요. 일부 보완하면 더 좋아질 수 있어요!',
  '사주-이름 시너지가 {{등급}} 등급으로, 전반적으로 무난한 조합이에요. 강한 시너지는 아니지만, 안정적인 동반자 관계라 할 수 있어요.',
  '{{이름}}님의 이름과 사주는 서로 적당히 어울리는 관계예요. 완벽하지는 않아도, 생활 속 용신 보강으로 한 단계 더 끌어올릴 수 있답니다!',
];

const OVERALL_LOW: readonly string[] = [
  '종합 시너지 점수가 아쉬운 편이지만, 이건 단순히 "나쁜 이름"이라는 뜻이 아니에요! 사주의 특수한 구조와 이름 오행이 방향이 다를 뿐이에요. 생활 속 보완으로 충분히 좋아질 수 있답니다.',
  '사주-이름 시너지 분석 결과가 기대보다 낮을 수 있지만, 너무 걱정하지 마세요. 이름은 인생의 한 요소일 뿐이고, 용신에 맞는 생활 습관이 더 큰 영향을 미치거든요!',
  '{{이름}}님의 이름과 사주가 서로 다른 방향을 보고 있어요. 하지만 방향이 다르다고 해서 나쁜 건 아니에요. 다양성이 오히려 새로운 가능성을 열어줄 수 있답니다!',
];

// -- 3-8. 실생활 조언 ---

const ADVICE_YONG_BOOST: readonly string[] = [
  '용신({{용신}})을 보강하는 게 가장 중요해요! {{색상}} 계열의 소품을 자주 사용하고, {{방위}} 방향으로 책상을 놓으면 좋아요.',
  '이름 외에도 {{색상}} 계열 옷이나 액세서리, {{방위}} 방향의 좌석 선택, {{계절}}에 더 활발하게 활동하기 등으로 용신({{용신}})을 보강해 보세요!',
  '용신({{용신}}) 보강 팁: {{색상}} 노트나 필통, {{방위}} 쪽 창가 자리, {{음식}} 같은 간식이 도움이 돼요!',
];

const ADVICE_DAEUN_PREP: readonly string[] = [
  '기신 대운이 올 때는 미리 준비하면 돼요! 그 시기에 맞춰 용신({{용신}}) 보강을 더 강화하고, 큰 결정은 용신 대운 시기에 하는 게 좋아요.',
  '대운의 변화에 따라 기신이 강해지는 시기가 있는데, 그때를 미리 알고 있으면 "방탄조끼"를 준비할 수 있는 거예요. 용신({{용신}}) 보강에 더 신경 쓰면 됩니다!',
];

const ADVICE_STRENGTH_TIP: readonly string[] = [
  '{{수준}} 사주에서는 {{조언}} 특히 이름의 에너지를 살리려면 이름을 자주 부르는 환경이 좋아요!',
  '신강도가 {{수준}}이니, {{조언}} 이름 오행과 함께 생활 오행을 맞추면 시너지가 배가 될 거예요.',
];

const ADVICE_RELATION_BUFFER: readonly string[] = [
  '사주에 충(冲)이나 형(刑)이 있다면, 충돌의 시기에 용신 보강을 더 집중하세요. 이름이 완충 역할을 못 하는 부분은 색상, 방위, 음식으로 채우면 돼요!',
  '합충형파해가 많은 사주는 변화가 큰 인생이에요. 이름 오행이 안정적이면 좋고, 아니더라도 용신 보강으로 균형을 잡을 수 있어요.',
];

// -- 3-9. 마무리 ---

const CLOSING_TEMPLATES: readonly string[] = [
  '사주와 이름의 시너지 분석은 여기까지예요! 이 분석이 {{이름}}님의 인생을 더 잘 이해하고, 더 좋은 선택을 하는 데 도움이 되길 바랍니다.',
  '이름은 하루에도 수백 번 불리는 에너지의 주문이에요. 이 분석을 통해 {{이름}}님의 이름이 사주와 어떻게 어우러지는지 알게 되셨으니, 이제 그 시너지를 생활 속에서 키워가세요!',
  '사주+이름 종합 분석이 끝났어요. 기억하세요, 이름과 사주의 관계는 고정된 운명이 아니라 "가능성의 지도"예요. {{이름}}님이 어떻게 활용하느냐에 따라 더 빛나는 인생이 될 수 있답니다!',
  '여기까지 사주-이름 시너지를 종합적으로 살펴봤어요. 좋은 점은 더 키우고, 아쉬운 점은 보완하면 돼요. 오늘 분석이 {{이름}}님에게 든든한 길잡이가 되길 바라요!',
  '사주는 하늘이 준 선물이고, 이름은 부모님이 준 선물이에요. 이 두 선물이 만나 만들어내는 시너지를 알았으니, 이제 그 에너지를 {{이름}}님만의 방식으로 활용해 보세요!',
];

// =============================================================================
//  4. 메인 생성 함수
// =============================================================================

export function generateSajuNameSynergySection(input: ReportInput): ReportSection | null {
  const rng = createRng(input);
  for (let i = 0; i < 48; i++) rng.next();

  // spring이나 naming 데이터가 없으면 null
  const spring = input.spring;
  const naming = input.naming;
  if (!spring && !naming) return null;

  const shen = deriveShenSystem(input);
  if (!shen) return null;

  const name = safeName(input);
  const nameElements = extractNameElements(input);
  const suriElements = extractSuriElements(input);
  const daeunList = extractDaeunList(input);
  const relations = extractJijiRelations(input);

  // 데이터가 최소한으로라도 있어야 분석 의미가 있음
  if (nameElements.length === 0 && suriElements.length === 0) return null;

  // ─────────────────────────────────────────────────────────────────
  //  5가지 시너지 분석 실행
  // ─────────────────────────────────────────────────────────────────

  const yongshinComp = calcYongshinCompensation(shen, nameElements, suriElements);
  const gyeokgukFit = calcGyeokgukFit(input, shen, nameElements);
  const daeunDef = calcDaeunDefense(shen, nameElements, daeunList);
  const strengthRole = calcStrengthNameRole(input, shen, nameElements);
  const relationImpact = calcRelationNameImpact(shen, nameElements, relations);
  const overall = calcOverallSynergy(yongshinComp, gyeokgukFit, daeunDef, strengthRole, relationImpact);

  const normalizedNameElements = normalizeElementCodes(nameElements);
  const normalizedSuriElements = normalizeElementCodes(suriElements);
  const normalizedDeficientElements = normalizeElementCodes(
    input.saju.deficientElements as string[] | undefined,
  );
  const normalizedExcessiveElements = normalizeElementCodes(
    input.saju.excessiveElements as string[] | undefined,
  );

  const integrationInputAvailable = normalizedNameElements.length > 0 || normalizedSuriElements.length > 0;

  let integrationSignals: SajuNameIntegrationSignals | null = null;
  let namingEngineScore: NamingScoreBreakdown | null = null;

  if (integrationInputAvailable) {
    try {
      integrationSignals = buildSajuNameIntegrationSignals({
        saju: {
          yongshinElement: shen.yongshin,
          heeshinElement: shen.heeshin,
          gishinElement: shen.gishin,
          deficientElements: normalizedDeficientElements,
          excessiveElements: normalizedExcessiveElements,
        },
        naming: {
          resourceElements: normalizedNameElements,
          strokeElements: normalizedSuriElements,
        },
        actionSuggestionCount: 4,
      });
    } catch {
      integrationSignals = null;
    }

    try {
      namingEngineScore = scoreNameAgainstSaju({
        nameElements: normalizedNameElements,
        suriElements: normalizedSuriElements,
        yongshin: shen.yongshin,
        heeshin: shen.heeshin,
        gishin: shen.gishin,
        deficiency: normalizedDeficientElements,
      });
    } catch {
      namingEngineScore = null;
    }
  }

  const fallbackStrengths: string[] = [];
  if (yongshinComp.score >= 60) {
    fallbackStrengths.push(`Yongshin ${elShort(shen.yongshin)} alignment is stable in the current name.`);
  }
  if (daeunDef.score >= 60) {
    fallbackStrengths.push('Name-based buffering is helping across major luck cycles.');
  }
  if (relationImpact.score >= 60) {
    fallbackStrengths.push('The name currently softens relation friction in the chart.');
  }
  if (fallbackStrengths.length === 0) {
    fallbackStrengths.push('The current name-chart mix is mostly neutral and can be improved step by step.');
  }

  const fallbackCautions: string[] = [];
  if (yongshinComp.score < 45) {
    fallbackCautions.push(`Direct support for yongshin ${elShort(shen.yongshin)} is limited.`);
  }
  if (daeunDef.vulnerableDaeun > 0) {
    fallbackCautions.push('Some major luck periods may require stronger daily balancing habits.');
  }
  if (relationImpact.score < 45) {
    fallbackCautions.push('Conflict-heavy relation periods need slower pacing and one extra review step.');
  }
  if (fallbackCautions.length === 0) {
    fallbackCautions.push('No major conflict signal is dominant, but consistency still matters.');
  }

  const fallbackActions: string[] = [
    `Use ${elShort(shen.yongshin)}-supporting lifestyle cues (color, direction, food) consistently this week.`,
    daeunDef.vulnerableDaeun > 0
      ? 'Before pressure-heavy periods, pre-plan recovery blocks in your schedule.'
      : 'Keep your sleep and work rhythm steady to hold current balance.',
    relationImpact.score < 45
      ? 'When emotions spike, delay important decisions by one short review cycle.'
      : 'Run a short weekly check-in to keep your current strengths active.',
    'At day end, write one win and one adjustment for tomorrow.',
  ];

  const fallbackIntegrationSignals: SajuNameIntegrationSignals = {
    elementHarmonySummary: integrationInputAvailable
      ? `Fallback integration summary: overall synergy ${overall.totalScore}/100 with yongshin fit ${yongshinComp.score}/100.`
      : 'Fallback integration summary: integration inputs were unavailable, so legacy section metrics are used.',
    keySynergyStrengths: fallbackStrengths.slice(0, 4),
    keyCautionPoints: fallbackCautions.slice(0, 4),
    dailyActionSuggestions: fallbackActions.slice(0, 4),
  };

  const integrationSignalsResolved = integrationSignals ?? fallbackIntegrationSignals;

  // ─────────────────────────────────────────────────────────────────
  //  보고서 구성
  // ─────────────────────────────────────────────────────────────────

  const paragraphs: ReportParagraph[] = [];
  const tables: ReportTable[] = [];
  const charts: ReportChart[] = [];
  const highlights: ReportHighlight[] = [];
  const subsections: ReportSubsection[] = [];

  // ── [도입부] ──────────────────────────────────────────────────────

  paragraphs.push(narrative(
    pickAndFill(rng, INTRO_TEMPLATES, { 이름: name }),
  ));

  // 이름 오행 소개
  if (nameElements.length > 0) {
    const elList = nameElements.map(e => `${elShort(e)}(${elHanja(e)})`).join(', ');
    paragraphs.push(narrative(
      `${name}님의 이름을 이루는 자원오행은 ${elList}이에요. ` +
      `이 오행들이 사주의 용신(${elShort(shen.yongshin)}), 격국, 대운 등과 어떤 시너지를 만드는지 하나씩 볼게요!`,
    ));
  }
  if (suriElements.length > 0) {
    const suriList = suriElements.map(e => elShort(e)).join(', ');
    paragraphs.push(narrative(
      `수리오행(획수 기반 오행)은 ${suriList}이에요. 자원오행과 수리오행을 모두 종합해서 분석할 거예요.`,
    ));
  }

  // ── [분석 1] 용신 보완도 ──────────────────────────────────────────

  const yongSubParagraphs: ReportParagraph[] = [];

  if (yongshinComp.score >= 70) {
    yongSubParagraphs.push(positive(
      pickAndFill(rng, YONG_COMP_HIGH, { 이름: name, 용신: elShort(shen.yongshin) }),
      shen.yongshin,
    ));
  } else if (yongshinComp.score >= 40) {
    yongSubParagraphs.push(narrative(
      pickAndFill(rng, YONG_COMP_MID, { 이름: name, 용신: elShort(shen.yongshin) }),
    ));
  } else {
    yongSubParagraphs.push(encouraging(
      pickAndFill(rng, YONG_COMP_LOW, { 이름: name, 용신: elShort(shen.yongshin) }),
    ));
  }

  // 세부 분석 서술
  yongSubParagraphs.push(narrative(yongshinComp.detail));

  // 이름 오행 vs 용신 관계 상세
  if (nameElements.length > 0) {
    const relDescs: string[] = [];
    for (let i = 0; i < nameElements.length; i++) {
      const ne = nameElements[i];
      const rel = getElementRelation(ne as ElementCode, shen.yongshin);
      let desc = '';
      if (rel === 'same') desc = `이름의 ${i + 1}번째 글자 ${elShort(ne)} = 용신! 직접 보충 중!`;
      else if (rel === 'generates') desc = `${i + 1}번째 글자 ${elShort(ne)}가 용신(${elShort(shen.yongshin)})을 낳아줘요 (상생).`;
      else if (rel === 'generated_by') desc = `${i + 1}번째 글자 ${elShort(ne)}는 용신이 낳아주는 오행이에요.`;
      else if (rel === 'controls') desc = `${i + 1}번째 글자 ${elShort(ne)}가 용신을 극하고 있어요 (주의).`;
      else if (rel === 'controlled_by') desc = `${i + 1}번째 글자 ${elShort(ne)}는 용신에게 눌리는 관계예요.`;
      relDescs.push(desc);
    }
    if (relDescs.length > 0) {
      yongSubParagraphs.push(narrative(relDescs.join(' ')));
    }
  }

  subsections.push({
    title: '1. 용신 보완도 분석',
    paragraphs: yongSubParagraphs,
    highlights: [{
      label: '용신 보완도',
      value: `${yongshinComp.score}점`,
      element: shen.yongshin,
      sentiment: yongshinComp.score >= 70 ? 'good' : yongshinComp.score >= 40 ? 'neutral' : 'caution',
    }],
  });

  // ── [분석 2] 격국 적합도 ──────────────────────────────────────────

  const gyeokSubParagraphs: ReportParagraph[] = [];
  const gyeokName = input.saju.gyeokguk?.type ?? '미정';

  if (gyeokgukFit.score >= 70) {
    gyeokSubParagraphs.push(positive(
      pickAndFill(rng, GYEOK_FIT_HIGH, { 격국: gyeokName }),
    ));
  } else if (gyeokgukFit.score >= 40) {
    gyeokSubParagraphs.push(narrative(
      pickAndFill(rng, GYEOK_FIT_MID, { 격국: gyeokName }),
    ));
  } else {
    gyeokSubParagraphs.push(encouraging(
      pickAndFill(rng, GYEOK_FIT_LOW, { 격국: gyeokName }),
    ));
  }

  gyeokSubParagraphs.push(narrative(gyeokgukFit.reasoning));

  // 격국 카테고리별 심화 설명
  const category = gyeokgukFit.category || '';
  if (category === '정격') {
    gyeokSubParagraphs.push(narrative(
      `정격(正格) 사주는 전통적이고 정돈된 구조예요. 이런 사주에서는 용신/희신이 이름에 들어있으면 ` +
      `격국의 순수성을 높여주는 "정석의 조합"이 돼요. ${nameElements.includes(shen.yongshin)
        ? '이름에 용신이 있어서 정석에 딱 맞는 구조예요!'
        : '이름에 용신이 직접 없더라도, 격국 자체가 안정적이라 큰 걱정은 없어요.'}`,
    ));
  } else if (category === '편격') {
    gyeokSubParagraphs.push(narrative(
      `편격(偏格) 사주는 파격적이고 창의적인 에너지를 가지고 있어요. 이름이 이 자유로운 기운을 ` +
      `안정적으로 받쳐주면 "창의성 + 안정감"이라는 최고의 조합이 만들어져요.`,
    ));
  } else if (category === '종격') {
    gyeokSubParagraphs.push(narrative(
      `종격(從格) 사주는 흐름에 순응하는 것이 핵심이에요. 이름도 그 강한 흐름을 따라가는 오행이면 ` +
      `최고의 시너지가 나오고, 거스르는 오행이면 아쉬움이 있을 수 있어요.`,
    ));
  }

  subsections.push({
    title: '2. 격국 적합도 분석',
    paragraphs: gyeokSubParagraphs,
    highlights: [{
      label: '격국 적합도',
      value: `${gyeokgukFit.score}점 (${gyeokgukFit.fitLevel})`,
      sentiment: gyeokgukFit.score >= 70 ? 'good' : gyeokgukFit.score >= 40 ? 'neutral' : 'caution',
    }],
  });

  // ── [분석 3] 대운 방어력 ──────────────────────────────────────────

  const daeunSubParagraphs: ReportParagraph[] = [];

  if (daeunList.length === 0) {
    daeunSubParagraphs.push(narrative(
      '대운 데이터가 충분하지 않아 상세한 대운 방어력 분석은 생략할게요. ' +
      '출생 시간이 정확하면 더 정밀한 분석이 가능해요!',
    ));
  } else {
    if (daeunDef.score >= 70) {
      daeunSubParagraphs.push(positive(
        pickAndFill(rng, DAEUN_DEF_HIGH, { 이름: name }),
      ));
    } else if (daeunDef.score >= 40) {
      daeunSubParagraphs.push(narrative(
        pickAndFill(rng, DAEUN_DEF_MID, { 이름: name }),
      ));
    } else {
      daeunSubParagraphs.push(encouraging(
        pickAndFill(rng, DAEUN_DEF_LOW, { 이름: name }),
      ));
    }

    daeunSubParagraphs.push(narrative(
      `전체 ${daeunDef.totalDaeun}개 대운 중 ` +
      `이름이 보호하는 시기 ${daeunDef.protectedDaeun}개, ` +
      `취약한 시기 ${daeunDef.vulnerableDaeun}개예요.`,
    ));

    // 주요 대운별 상세 (최대 5개)
    const significantDaeun = daeunDef.details
      .filter(d => d.nameProtection !== 'none' || d.grade <= 2 || d.grade >= 4)
      .slice(0, 5);

    for (const d of significantDaeun) {
      const stars = YONGSHIN_GRADE_STARS[d.grade];
      const elStr = elShort(d.daeunElement);
      const protection = d.nameProtection === 'strong' ? '강한 보호'
        : d.nameProtection === 'partial' ? '부분 보호'
        : d.nameProtection === 'conflict' ? '충돌 주의'
        : '보호 없음';

      if (d.nameProtection === 'conflict') {
        daeunSubParagraphs.push(caution(
          `[${d.ageRange}] 대운 ${elStr}(${stars}) — ${protection}: ${d.explanation}`,
        ));
      } else if (d.nameProtection === 'strong' && d.grade >= 4) {
        daeunSubParagraphs.push(positive(
          `[${d.ageRange}] 대운 ${elStr}(${stars}) — ${protection}: ${d.explanation}`,
          d.daeunElement as ElementCode,
        ));
      } else {
        daeunSubParagraphs.push(narrative(
          `[${d.ageRange}] 대운 ${elStr}(${stars}) — ${protection}: ${d.explanation}`,
        ));
      }
    }
  }

  subsections.push({
    title: '3. 대운 방어력 분석',
    paragraphs: daeunSubParagraphs,
    highlights: [{
      label: '대운 방어력',
      value: `${daeunDef.score}점`,
      sentiment: daeunDef.score >= 70 ? 'good' : daeunDef.score >= 40 ? 'neutral' : 'caution',
    }],
  });

  // ── [분석 4] 신강도별 이름의 역할 ─────────────────────────────────

  const strSubParagraphs: ReportParagraph[] = [];
  const strLevel = STRENGTH_KOREAN[strengthRole.strengthLevel];

  if (strengthRole.score >= 70) {
    strSubParagraphs.push(positive(
      pickAndFill(rng, STRENGTH_ROLE_HIGH, {
        이름: name, 수준: strLevel, 역할: strengthRole.role,
      }),
    ));
  } else if (strengthRole.score >= 40) {
    strSubParagraphs.push(narrative(
      pickAndFill(rng, STRENGTH_ROLE_MID, {
        이름: name, 수준: strLevel, 역할: strengthRole.role,
      }),
    ));
  } else {
    strSubParagraphs.push(encouraging(
      pickAndFill(rng, STRENGTH_ROLE_LOW, {
        이름: name, 수준: strLevel, 역할: strengthRole.role,
      }),
    ));
  }

  strSubParagraphs.push(narrative(strengthRole.explanation));
  strSubParagraphs.push(tip(strengthRole.recommendation));

  // 신강도별 심화 해설
  if (strengthRole.strengthLevel === 'EXTREME_STRONG') {
    strSubParagraphs.push(narrative(
      `극신강 사주는 에너지가 넘치는 타입이에요. 마치 물이 넘치는 컵 같아서, 밖으로 흘러보내야 해요. ` +
      `이름이 식상(자기 표현)이나 재성(현실적 성취) 오행이면, 넘치는 에너지를 건강하게 활용하는 통로가 돼요. ` +
      `반대로 인성/비겁 오행이면 물을 더 붓는 격이라 아쉬울 수 있어요.`,
    ));
  } else if (strengthRole.strengthLevel === 'EXTREME_WEAK') {
    strSubParagraphs.push(narrative(
      `극신약 사주는 주변의 기운에 많이 휘둘릴 수 있는 타입이에요. 이럴 때 이름의 인성(나를 도와주는 오행)이나 ` +
      `비겁(나와 같은 오행) 에너지가 있으면, 약한 일간에게 든든한 아군이 생기는 거예요. ` +
      `다만 종격 사주라면 오히려 강한 흐름에 순응하는 오행이 좋을 수도 있어요.`,
    ));
  } else if (strengthRole.strengthLevel === 'BALANCED') {
    strSubParagraphs.push(narrative(
      `중화 사주는 이미 균형이 잘 잡혀 있어서, 이름이 어떤 오행이든 크게 흔들리지 않아요. ` +
      `그래도 용신 오행이 이름에 있으면 미세한 불균형까지 잡아주는 "프리미엄 보험" 같은 효과가 있답니다.`,
    ));
  }

  subsections.push({
    title: '4. 신강도별 이름의 역할',
    paragraphs: strSubParagraphs,
    highlights: [{
      label: '신강도 적합',
      value: `${strengthRole.score}점 (${strLevel})`,
      element: input.saju.dayMaster?.element as ElementCode | undefined,
      sentiment: strengthRole.score >= 70 ? 'good' : strengthRole.score >= 40 ? 'neutral' : 'caution',
    }],
  });

  // ── [분석 5] 합충형파해와 이름의 관계 ─────────────────────────────

  const relSubParagraphs: ReportParagraph[] = [];

  if (relations.length === 0) {
    relSubParagraphs.push(narrative(
      '사주의 지지 관계(합충형파해) 데이터가 제한적이어서, 이름과의 직접적인 상호작용 분석은 간략하게 진행할게요.',
    ));
  } else {
    if (relationImpact.score >= 60) {
      relSubParagraphs.push(positive(rng.pick(RELATION_IMPACT_POS)));
    } else if (relationImpact.score >= 40) {
      relSubParagraphs.push(narrative(rng.pick(RELATION_IMPACT_NEU)));
    } else {
      relSubParagraphs.push(encouraging(rng.pick(RELATION_IMPACT_NEG)));
    }

    // 합/충/형/파/해 각각 설명
    if (relationImpact.positiveRelations.length > 0) {
      relSubParagraphs.push(positive(
        `사주의 긍정적 관계: ${listJoin(relationImpact.positiveRelations)}. ` +
        `이런 합(合)의 에너지는 이름의 안정적 오행과 시너지를 내요.`,
      ));
    }
    if (relationImpact.negativeRelations.length > 0) {
      relSubParagraphs.push(narrative(
        `사주의 긴장 관계: ${listJoin(relationImpact.negativeRelations)}. ` +
        `이런 충돌 에너지에 대해 이름이 완충 역할을 하는지가 중요해요.`,
      ));
    }

    // 상세 분석 서술
    for (const d of relationImpact.details.slice(0, 4)) {
      relSubParagraphs.push(narrative(d));
    }

    relSubParagraphs.push(narrative(relationImpact.nameBufferEffect));
  }

  subsections.push({
    title: '5. 합충형파해와 이름의 관계',
    paragraphs: relSubParagraphs,
    highlights: [{
      label: '관계망 시너지',
      value: `${relationImpact.score}점`,
      sentiment: relationImpact.score >= 60 ? 'good' : relationImpact.score >= 40 ? 'neutral' : 'caution',
    }],
  });

  // ── [종합 평가] ───────────────────────────────────────────────────

  if (overall.totalScore >= 75) {
    paragraphs.push(positive(
      pickAndFill(rng, OVERALL_HIGH, {
        이름: name, 등급: `${overall.grade}(${gradeKorean(overall.grade)})`,
      }),
    ));
  } else if (overall.totalScore >= 45) {
    paragraphs.push(narrative(
      pickAndFill(rng, OVERALL_MID, {
        이름: name, 등급: `${overall.grade}(${gradeKorean(overall.grade)})`,
      }),
    ));
  } else {
    paragraphs.push(encouraging(
      pickAndFill(rng, OVERALL_LOW, {
        이름: name, 등급: `${overall.grade}(${gradeKorean(overall.grade)})`,
      }),
    ));
  }

  // 종합 점수 강조
  paragraphs.push(emphasis(
    `사주-이름 종합 시너지: ${overall.totalScore}점 / 100점 ` +
    `[등급: ${overall.grade} — ${gradeKorean(overall.grade)}]`,
  ));

  // ── [실생활 조언] ──────────────────────────────────────────────────

  paragraphs.push(narrative(integrationSignalsResolved.elementHarmonySummary));

  const integrationStrengthLine = integrationSignalsResolved.keySynergyStrengths.slice(0, 2).join(' / ');
  if (integrationStrengthLine) {
    paragraphs.push(positive(`Integration strengths: ${integrationStrengthLine}`));
  }

  const integrationCautionLine = integrationSignalsResolved.keyCautionPoints.slice(0, 2).join(' / ');
  if (integrationCautionLine) {
    paragraphs.push(caution(`Integration cautions: ${integrationCautionLine}`));
  }

  const yongColor = ELEMENT_COLOR[shen.yongshin] ?? '';
  const yongDir = ELEMENT_DIRECTION[shen.yongshin] ?? '';
  const yongSeason = ELEMENT_SEASON[shen.yongshin] ?? '';
  const yongFoods = ELEMENT_FOOD[shen.yongshin] ?? [];
  const yongFoodStr = rng.sample(yongFoods, 3).join(', ');

  paragraphs.push(tip(
    pickAndFill(rng, ADVICE_YONG_BOOST, {
      이름: name, 용신: elShort(shen.yongshin),
      색상: yongColor, 방위: yongDir, 계절: yongSeason, 음식: yongFoodStr,
    }),
    shen.yongshin,
  ));

  // 대운 대비 조언
  if (daeunDef.vulnerableDaeun > 0) {
    paragraphs.push(tip(
      pickAndFill(rng, ADVICE_DAEUN_PREP, { 용신: elShort(shen.yongshin) }),
    ));
  }

  // 신강도별 조언
  const strAdvice =
    strengthRole.strengthLevel === 'EXTREME_STRONG' || strengthRole.strengthLevel === 'STRONG'
      ? '에너지를 발산하는 활동(운동, 봉사, 창작)이 좋아요.'
      : strengthRole.strengthLevel === 'WEAK' || strengthRole.strengthLevel === 'EXTREME_WEAK'
        ? '에너지를 충전하는 활동(명상, 독서, 충분한 수면)이 좋아요.'
        : '현재 균형을 유지하면서 용신 보강을 꾸준히 해주세요.';

  paragraphs.push(tip(
    pickAndFill(rng, ADVICE_STRENGTH_TIP, { 수준: strLevel, 조언: strAdvice }),
  ));

  // 합충형파해 보완 조언 (충돌이 있을 경우)
  if (relationImpact.negativeRelations.length > 0) {
    paragraphs.push(tip(rng.pick(ADVICE_RELATION_BUFFER)));
  }

  // ── [마무리] ──────────────────────────────────────────────────────

  for (const action of integrationSignalsResolved.dailyActionSuggestions.slice(0, 3)) {
    paragraphs.push(tip(`Daily action: ${action}`, shen.yongshin));
  }

  paragraphs.push(encouraging(
    pickAndFill(rng, CLOSING_TEMPLATES, { 이름: name }),
  ));

  // ═══════════════════════════════════════════════════════════════════
  //  테이블
  // ═══════════════════════════════════════════════════════════════════

  // 테이블 1: 5대 시너지 분석 종합
  tables.push({
    title: '사주-이름 5대 시너지 분석',
    headers: ['분석 항목', '점수', '등급', '핵심 포인트'],
    rows: [
      [
        '용신 보완도',
        `${yongshinComp.score}/100`,
        scoreToGrade(yongshinComp.score),
        yongshinComp.directMatch > 0
          ? `용신(${elShort(shen.yongshin)}) 직접 보충 ${yongshinComp.directMatch}개`
          : yongshinComp.generatesYong > 0
            ? `상생 지원 ${yongshinComp.generatesYong}개`
            : '직접적 연결 없음',
      ],
      [
        '격국 적합도',
        `${gyeokgukFit.score}/100`,
        scoreToGrade(gyeokgukFit.score),
        `${gyeokName} 격국에 ${gyeokgukFit.fitLevel}`,
      ],
      [
        '대운 방어력',
        `${daeunDef.score}/100`,
        scoreToGrade(daeunDef.score),
        daeunList.length > 0
          ? `${daeunDef.totalDaeun}개 대운 중 ${daeunDef.protectedDaeun}개 보호`
          : '대운 데이터 부족',
      ],
      [
        '신강도 적합',
        `${strengthRole.score}/100`,
        scoreToGrade(strengthRole.score),
        `${strLevel} 사주에서 "${strengthRole.role}"`,
      ],
      [
        '관계망 시너지',
        `${relationImpact.score}/100`,
        scoreToGrade(relationImpact.score),
        relationImpact.nameBufferEffect.slice(0, 30) + '...',
      ],
      [
        '종합 시너지',
        `${overall.totalScore}/100`,
        overall.grade,
        gradeKorean(overall.grade),
      ],
    ],
  });

  // 테이블 2: 이름 오행 vs 5신 관계 매트릭스
  if (nameElements.length > 0) {
    const matrixRows: string[][] = [];
    for (let i = 0; i < nameElements.length; i++) {
      const ne = nameElements[i] as ElementCode;
      const shenMatch =
        ne === shen.yongshin ? '용신 일치'
          : ne === shen.heeshin ? '희신 일치'
            : ne === shen.gishin ? '기신 일치'
              : ne === shen.gushin ? '구신 일치'
                : ne === shen.hanshin ? '한신 일치'
                  : '해당 없음';
      const relToYong = getElementRelation(ne, shen.yongshin);
      const relDesc = relToYong === 'same' ? '동일'
        : relToYong === 'generates' ? '상생(생)'
          : relToYong === 'generated_by' ? '상생(피생)'
            : relToYong === 'controls' ? '상극(극)'
              : relToYong === 'controlled_by' ? '상극(피극)'
                : '-';
      const verdict = ne === shen.yongshin || ne === shen.heeshin ? '좋음'
        : ne === shen.gishin || ne === shen.gushin ? '주의'
          : '중립';

      matrixRows.push([
        `${i + 1}번째 글자`,
        elFull(ne),
        shenMatch,
        `용신과 ${relDesc}`,
        verdict,
      ]);
    }

    tables.push({
      title: '이름 글자별 오행 vs 5신 체계',
      headers: ['글자', '오행', '5신 대응', '용신과 관계', '판정'],
      rows: matrixRows,
    });
  }

  // 테이블 3: 대운별 이름 보호 현황 (최대 8개)
  if (daeunDef.details.length > 0) {
    const daeunRows = daeunDef.details.slice(0, 8).map(d => {
      const stars = YONGSHIN_GRADE_STARS[d.grade];
      const protLabel =
        d.nameProtection === 'strong' ? '강한 보호'
          : d.nameProtection === 'partial' ? '부분 보호'
            : d.nameProtection === 'conflict' ? '충돌 주의'
              : '보호 없음';
      return [
        d.ageRange,
        `${elShort(d.daeunElement)} ${stars}`,
        protLabel,
        d.explanation.slice(0, 40) + (d.explanation.length > 40 ? '...' : ''),
      ];
    });

    tables.push({
      title: '대운별 이름 보호 현황',
      headers: ['나이', '대운 (오행/부합도)', '이름 보호', '해석'],
      rows: daeunRows,
    });
  }

  // 테이블 4: 신강도별 이름의 이상적 역할
  tables.push({
    title: '신강도별 이름의 이상적 역할 가이드',
    headers: ['신강도', '이름의 이상적 역할', '추천 이름 오행', '현재 이름 적합도'],
    rows: [
      [
        '극신강 (80+)',
        '기운 분산자 (설기)',
        '식상/재성 오행',
        strengthRole.strengthLevel === 'EXTREME_STRONG' ? `${strengthRole.score}점` : '-',
      ],
      [
        '신강 (60~79)',
        '균형 조절자',
        '용신/관성/재성 오행',
        strengthRole.strengthLevel === 'STRONG' ? `${strengthRole.score}점` : '-',
      ],
      [
        '중화 (41~59)',
        '균형 유지자',
        '용신 오행 (미세조정)',
        strengthRole.strengthLevel === 'BALANCED' ? `${strengthRole.score}점` : '-',
      ],
      [
        '신약 (21~40)',
        '힘 보태기',
        '인성/비겁 오행',
        strengthRole.strengthLevel === 'WEAK' ? `${strengthRole.score}점` : '-',
      ],
      [
        '극신약 (0~20)',
        '흐름 동반자',
        '인성/비겁 또는 종격 순응 오행',
        strengthRole.strengthLevel === 'EXTREME_WEAK' ? `${strengthRole.score}점` : '-',
      ],
    ],
  });

  // ═══════════════════════════════════════════════════════════════════
  //  차트
  // ═══════════════════════════════════════════════════════════════════

  // 차트 1: 레이더 차트 (5대 시너지)
  charts.push({
    type: 'radar',
    title: '사주-이름 시너지 레이더',
    data: {
      '용신 보완': yongshinComp.score,
      '격국 적합': gyeokgukFit.score,
      '대운 방어': daeunDef.score,
      '신강도 적합': strengthRole.score,
      '관계망 시너지': relationImpact.score,
    },
    meta: {
      min: 0,
      max: 100,
      grade: overall.grade,
      totalScore: overall.totalScore,
    },
  });

  // 차트 2: 게이지 차트 (종합 점수)
  charts.push({
    type: 'gauge',
    title: '사주-이름 종합 시너지 점수',
    data: {
      '시너지': overall.totalScore,
    },
    meta: {
      min: 0,
      max: 100,
      thresholds: { D: 35, C: 55, B: 75, A: 90, S: 100 },
      grade: overall.grade,
      gradeLabel: gradeKorean(overall.grade),
    },
  });

  // 차트 3: 바 차트 (5개 항목 비교)
  charts.push({
    type: 'bar',
    title: '5대 시너지 항목별 점수',
    data: {
      '용신 보완도': yongshinComp.score,
      '격국 적합도': gyeokgukFit.score,
      '대운 방어력': daeunDef.score,
      '신강도 적합': strengthRole.score,
      '관계망 시너지': relationImpact.score,
    },
    meta: { maxValue: 100 },
  });

  // ═══════════════════════════════════════════════════════════════════
  //  하이라이트
  // ═══════════════════════════════════════════════════════════════════

  highlights.push({
    label: '종합 시너지',
    value: `${overall.totalScore}/100 [${overall.grade}]`,
    element: shen.yongshin,
    sentiment: overall.totalScore >= 75 ? 'good' : overall.totalScore >= 45 ? 'neutral' : 'caution',
  });

  highlights.push({
    label: '용신 보완도',
    value: `${yongshinComp.score}점`,
    element: shen.yongshin,
    sentiment: yongshinComp.score >= 70 ? 'good' : yongshinComp.score >= 40 ? 'neutral' : 'caution',
  });

  highlights.push({
    label: '격국 적합도',
    value: `${gyeokgukFit.score}점 (${gyeokgukFit.fitLevel})`,
    sentiment: gyeokgukFit.score >= 70 ? 'good' : gyeokgukFit.score >= 40 ? 'neutral' : 'caution',
  });

  highlights.push({
    label: '대운 방어력',
    value: `${daeunDef.score}점`,
    sentiment: daeunDef.score >= 70 ? 'good' : daeunDef.score >= 40 ? 'neutral' : 'caution',
  });

  highlights.push({
    label: '신강도 적합',
    value: `${strengthRole.score}점 (${strLevel})`,
    element: input.saju.dayMaster?.element as ElementCode | undefined,
    sentiment: strengthRole.score >= 70 ? 'good' : strengthRole.score >= 40 ? 'neutral' : 'caution',
  });

  highlights.push({
    label: '이름의 역할',
    value: strengthRole.role,
    sentiment: 'neutral',
  });

  if (namingEngineScore) {
    highlights.push({
      label: 'Integration engine',
      value: `${namingEngineScore.total}/100`,
      sentiment: namingEngineScore.total >= 70
        ? 'good'
        : namingEngineScore.total >= 40
          ? 'neutral'
          : 'caution',
    });
  } else if (!integrationSignals) {
    highlights.push({
      label: 'Integration engine',
      value: 'fallback',
      sentiment: 'neutral',
    });
  }

  const firstIntegrationStrength = integrationSignalsResolved.keySynergyStrengths[0];
  if (firstIntegrationStrength) {
    highlights.push({
      label: 'Integration strength',
      value: firstIntegrationStrength,
      sentiment: 'good',
    });
  }

  const firstIntegrationCaution = integrationSignalsResolved.keyCautionPoints[0];
  if (firstIntegrationCaution) {
    highlights.push({
      label: 'Integration caution',
      value: firstIntegrationCaution,
      sentiment: 'caution',
    });
  }

  const firstDailyAction = integrationSignalsResolved.dailyActionSuggestions[0];
  if (firstDailyAction) {
    highlights.push({
      label: 'Daily action',
      value: firstDailyAction,
      sentiment: 'neutral',
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  섹션 반환
  // ═══════════════════════════════════════════════════════════════════

  return {
    id: 'sajuNameSynergy',
    title: '사주-이름 시너지 종합 분석',
    subtitle: '사주와 이름이 만들어내는 다섯 가지 시너지',
    paragraphs,
    tables: tables.length > 0 ? tables : undefined,
    charts: charts.length > 0 ? charts : undefined,
    highlights: highlights.length > 0 ? highlights : undefined,
    subsections: subsections.length > 0 ? subsections : undefined,
  };
}
