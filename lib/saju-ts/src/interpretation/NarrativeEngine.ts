import { GYEOKGUK_TYPE_INFO } from '../domain/Gyeokguk.js';
import { PillarPosition, PILLAR_POSITION_VALUES } from '../domain/PillarPosition.js';
import { SHINSAL_TYPE_INFO } from '../domain/Shinsal.js';
import { SIPSEONG_INFO } from '../domain/Sipseong.js';
import { LuckQuality, LUCK_QUALITY_INFO } from '../domain/LuckInteraction.js';
import { Ohaeng, OHAENG_VALUES } from '../domain/Ohaeng.js';
import { YONGSHIN_TYPE_INFO } from '../domain/YongshinResult.js';
import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import type { DaeunPillar } from '../domain/DaeunInfo.js';
import type { SaeunPillar } from '../domain/SaeunInfo.js';
import type { IljuInterpretation } from '../domain/IljuInterpretation.js';
import { type CalculationConfig, DEFAULT_CONFIG } from '../config/CalculationConfig.js';
import { GanjiCycle } from '../engine/GanjiCycle.js';
import { LuckInteractionAnalyzer } from '../engine/luck/LuckInteractionAnalyzer.js';
import { SaeunCalculator } from '../engine/luck/SaeunCalculator.js';
import { sentenceCite } from './NarrativeSentenceCite.js';
import { StrengthAwareSipseongInterpreter } from './StrengthAwareSipseongInterpreter.js';
import { formatPillar, ohaengKorean, stemKorean, strengthLevelKorean } from './NarrativeFormatting.js';
import { buildCalculationReasoning, buildTraceOverview } from './NarrativeTraceOverview.js';
import { buildCausalChain, buildLifePathSynthesis } from './NarrativeOverallSynthesisHelpers.js';
import { buildLifeDomainAnalysis } from './NarrativeLifeDomainAnalysisSection.js';
import {
  buildLuckCycleOverview,
  summarizeLifetimeLuck,
  type LifetimeLuckSnapshot,
} from './NarrativeLuckCycleOverviewSection.js';
import { buildSpecialFeatures } from './NarrativeSpecialFeaturesSection.js';
import { buildSourceBibliography } from './NarrativeSourceBibliographySection.js';
import { buildOverview, buildOhaengDistribution } from './NarrativeOverviewSection.js';
import { LuckNarrativeInterpreter } from './LuckNarrativeInterpreter.js';
import {
  buildCoreCharacteristics,
  buildYongshinGuidance,
} from './NarrativeStrengthAndYongshinSection.js';
import { buildPillarInterpretations } from './NarrativePillarSection.js';
import { schoolLabelFor } from './SchoolVariantHelpers.js';
import { buildYearlyFortune, yearlyFortuneToNarrative, type YearlyFortune } from './YearlyFortuneInterpreter.js';
import { getKoreanDateParts, type ServiceDateParts } from './ServiceDateTime.js';
import { buildPopularFortuneHighlights } from './NarrativePopularFortuneSection.js';

export interface SajuNarrative {
  readonly readableSummary: string;
  readonly schoolLabel: string;
  readonly overview: string;
  readonly ohaengDistribution: string;
  readonly coreCharacteristics: string;
  readonly yongshinGuidance: string;
  readonly pillarInterpretations: Record<PillarPosition, string>;
  readonly lifeDomainAnalysis: string;
  readonly specialFeatures: string;
  readonly overallAssessment: string;
  readonly luckCycleOverview: string;
  readonly detailedLuckNarrative: string;
  readonly yearlyFortuneNarrative: string;
  readonly calculationReasoning: string;
  readonly traceOverview: string;
  readonly sourceBibliography: string;
}

function appendRequiredSection(parts: string[], section: string): void {
  if (parts.length > 0) parts.push('');
  parts.push(section);
}

function appendOptionalSection(parts: string[], section: string): void {
  if (!section) return;
  appendRequiredSection(parts, section);
}

export function narrativeToFullReport(n: SajuNarrative): string {
  const parts: string[] = [];
  appendOptionalSection(parts, n.readableSummary);
  appendRequiredSection(parts, n.overview);
  appendOptionalSection(parts, n.ohaengDistribution);
  appendRequiredSection(parts, n.coreCharacteristics);
  appendRequiredSection(parts, n.yongshinGuidance);
  for (const pos of PILLAR_POSITION_VALUES) {
    const interp = n.pillarInterpretations[pos];
    appendOptionalSection(parts, interp);
  }
  appendOptionalSection(parts, n.lifeDomainAnalysis);
  appendRequiredSection(parts, n.specialFeatures);
  appendOptionalSection(parts, n.overallAssessment);
  appendRequiredSection(parts, n.luckCycleOverview);
  appendOptionalSection(parts, n.detailedLuckNarrative);
  appendOptionalSection(parts, n.yearlyFortuneNarrative);
  appendOptionalSection(parts, n.calculationReasoning);
  appendOptionalSection(parts, n.traceOverview);
  appendOptionalSection(parts, n.sourceBibliography);
  return parts.join('\n').trimEnd();
}

function buildOverallAssessment(a: SajuAnalysis): string {
  const lines: string[] = [];
  lines.push(`■ 종합 판단 ${sentenceCite('overall.synthesis')}`);
  lines.push('');

  const dm = a.pillars.day.cheongan;
  const dmName = stemKorean(dm);

  const strengthDesc = a.strengthResult
    ? `${strengthLevelKorean(a.strengthResult.level)} 일간`
    : '일간';
  lines.push(`${dmName} ${strengthDesc}입니다.`);

  if (a.gyeokgukResult) {
    const gti = GYEOKGUK_TYPE_INFO[a.gyeokgukResult.type];
    lines.push(`${gti.koreanName}(${gti.hanja})의 구조를 갖추고 있어, ${a.gyeokgukResult.reasoning}`);
  }

  if (a.yongshinResult) {
    const yr = a.yongshinResult;
    const yongshinName = ohaengKorean(yr.finalYongshin);
    const heesinNote = yr.finalHeesin != null ? `, 희신은 ${ohaengKorean(yr.finalHeesin)}` : '';
    lines.push(`용신은 ${yongshinName}${heesinNote}으로, 이 오행이 강화되는 시기에 운이 상승합니다.`);
    if (yr.gisin != null) {
      lines.push(`반면 기신 ${ohaengKorean(yr.gisin)}이 강해지는 시기는 주의가 필요합니다.`);
    }
  }

  if (a.strengthResult && a.tenGodAnalysis) {
    const sr = a.strengthResult;
    const tga = a.tenGodAnalysis;
    lines.push('');
    lines.push('[강약 관점의 핵심 십성 분석]');

    const monthTg = tga.byPosition[PillarPosition.MONTH];
    if (monthTg) {
      const reading = StrengthAwareSipseongInterpreter.interpret(monthTg.cheonganSipseong, sr.level);
      const ssi = SIPSEONG_INFO[monthTg.cheonganSipseong];
      lines.push(`  월주 ${ssi.koreanName} [${reading.favorability}]: ${reading.commentary}`);
      lines.push(`    → ${reading.advice}`);
    }

    const dayTg = tga.byPosition[PillarPosition.DAY];
    if (dayTg) {
      const reading = StrengthAwareSipseongInterpreter.interpret(dayTg.jijiPrincipalSipseong, sr.level);
      const ssi = SIPSEONG_INFO[dayTg.jijiPrincipalSipseong];
      lines.push(`  일지 ${ssi.koreanName} [${reading.favorability}]: ${reading.commentary}`);
      lines.push(`    → ${reading.advice}`);
    }
  }
  lines.push('');

  if (a.weightedShinsalHits.length > 0) {
    const top3 = uniqueTake(
      [...a.weightedShinsalHits]
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 3)
      .map(w => SHINSAL_TYPE_INFO[w.hit.type].koreanName),
      3,
    ).join(', ');
    lines.push(`특기할 신살: ${top3} — 이들이 원국의 특수한 기질을 형성합니다.`);
  }

  const ilju = a.analysisResults?.get('ilju') as IljuInterpretation | undefined;
  if (ilju) {
    lines.push('');
    lines.push(`일주 "${ilju.nickname}" — ${compactLine(ilju.personality)}`);
  }

  const causalChain = buildCausalChain(a);
  if (causalChain) {
    lines.push('');
    lines.push('[논리 체인: 왜 이런 결론인가?]');
    lines.push(causalChain);
  }

  const synthesis = buildLifePathSynthesis(a);
  if (synthesis) {
    lines.push('');
    lines.push('[인생 방향 종합]');
    lines.push(synthesis);
  }

  return lines.join('\n').trimEnd();
}

function compactMonthLabel(label: string): string {
  return label.replace(/·[^)]*\)/g, ')');
}

function compactLine(text: string): string {
  return compactNumericPrecision(text.replace(/\s+/g, ' ').trim());
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function compactNumericPrecision(text: string): string {
  return text.replace(/\d+\.\d{3,}/g, match => {
    const parsed = Number.parseFloat(match);
    if (!Number.isFinite(parsed)) return match;
    return formatScore(Math.round(parsed * 10) / 10);
  });
}

function stripInlineCitations(text: string): string {
  return compactLine(text.replace(/\[(?:근거|출처):[^\]]+\]/g, '').replace(/\s{2,}/g, ' '));
}

function simplifyForYouth(text: string): string {
  let result = stripInlineCitations(text);
  const replacements: readonly [RegExp, string][] = [
    [/일간/g, '나의 기본 기운'],
    [/용신 오행/g, '나를 돕는 기운'],
    [/용신/g, '도움 기운'],
    [/희신/g, '보조 기운'],
    [/기신/g, '주의 기운'],
    [/인성/g, '공부/배움 기운'],
    [/비겁/g, '협력 기운'],
    [/재성/g, '재물 기운'],
    [/관성/g, '책임 기운'],
    [/식상/g, '표현·기술 기운'],
    [/대운/g, '10년 큰 흐름'],
    [/세운/g, '해마다 흐름'],
    [/오행/g, '기운'],
    [/레버리지/g, '빚을 크게 쓰는 방식'],
    [/종격/g, '한쪽으로 기운이 강하게 쏠린 구조'],
    [/격국/g, '기본 성향 틀'],
    [/정재운/g, '돈을 차근차근 모으기 좋은 흐름'],
    [/편관운/g, '도전과 책임이 커지는 흐름'],
    [/정인운/g, '배우고 성장하는 흐름'],
    [/정재적 접근/g, '계획형 돈 관리'],
    [/생재\(生財\)가/g, '돈이 되는 결과를 만드는 방식이'],
    [/생재\(生財\)/g, '돈이 되는 결과를 만드는 방식'],
    [/공부\/배움 기운\(학습\)/g, '공부 습관'],
    [/공부\/배움 기운\(자기계발\/학습\)/g, '공부 습관'],
    [/협력 기운\(협력\)/g, '주변 도움'],
    [/표현·기술 기운\(아이디어\/기술\)/g, '아이디어와 기술'],
    [/극제/g, '압박'],
    [/부조/g, '도움'],
    [/억제/g, '압박'],
  ];
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  return compactLine(result);
}

function firstSentence(text: string): string {
  const cleaned = stripInlineCitations(text);
  const byDot = cleaned.match(/.*?다\./);
  if (byDot?.[0] != null) return compactLine(byDot[0]);
  const byPeriod = cleaned.match(/.*?[.!?]/);
  if (byPeriod?.[0] != null) return compactLine(byPeriod[0]);
  return compactLine(cleaned);
}

function pickByIndex(variants: readonly string[], index: number): string {
  if (variants.length === 0) return '';
  const normalized = Math.abs(index) % variants.length;
  return variants[normalized]!;
}

function easyStrengthSummary(strengthLabel: string, isStrong: boolean, variantIndex: number): string {
  if (strengthLabel.includes('극신약')) {
    return pickByIndex([
      '내 기운이 많이 약한 편이라서, 혼자 버티기보다 도움을 받을수록 더 잘 풀려요.',
      '지금은 에너지가 쉽게 소모되는 편이라, 큰일은 나눠서 하고 주변 도움을 꼭 받는 게 좋아요.',
      '기본 힘이 약한 축이라 무리하면 금방 지칠 수 있어요. 작은 성공을 자주 만드는 방식이 유리해요.',
    ], variantIndex);
  }
  if (strengthLabel.includes('신약')) {
    return pickByIndex([
      '내 기운이 약한 편이라서, 기본 체력과 주변 도움을 함께 챙기면 안정적으로 좋아져요.',
      '에너지가 빠르게 줄 수 있으니, 일정 여유를 두고 차근차근 가는 방식이 잘 맞아요.',
      '무리한 속도전보다 준비를 먼저 하고 실행하면 훨씬 좋은 결과가 나와요.',
    ], variantIndex);
  }
  if (strengthLabel.includes('극신강')) {
    return pickByIndex([
      '내 기운이 매우 강한 편이라 추진력은 크지만, 속도 조절과 협력이 특히 중요해요.',
      '밀어붙이는 힘이 큰 타입이라, 한 번 더 점검하고 시작하면 실수를 크게 줄일 수 있어요.',
      '주도권을 잡는 능력이 강해요. 다만 내 페이스만 고집하지 않도록 균형을 잡는 게 핵심이에요.',
    ], variantIndex);
  }
  if (strengthLabel.includes('신강')) {
    return pickByIndex([
      '내 기운이 강한 편이라 스스로 밀고 나가는 힘이 좋아요. 다만 무리한 확장은 조심하세요.',
      '추진력이 장점이라 시작은 빠르지만, 중간 점검을 넣으면 성공 확률이 더 높아져요.',
      '독립적으로 해내는 힘이 좋아요. 팀과 역할을 나누면 더 큰 성과가 가능합니다.',
    ], variantIndex);
  }
  return isStrong
    ? pickByIndex([
      '내 기운이 강한 쪽이라 추진력이 장점이에요. 속도 조절을 함께 하면 더 좋아요.',
      '에너지가 앞서 나가는 타입이라, 계획 확인만 더해도 결과가 크게 좋아져요.',
    ], variantIndex)
    : pickByIndex([
      '내 기운이 약한 쪽이라 기본 체력과 도움 네트워크를 챙기면 더 잘 풀려요.',
      '혼자 해결하려 하기보다 도움을 요청하면 시행착오를 줄일 수 있어요.',
    ], variantIndex);
}

function easyYearTone(qualityLabel: string, variantIndex: number): string {
  if (qualityLabel === '대길') {
    return pickByIndex([
      '기회가 크게 들어오는 해',
      '성장 버튼이 눌리는 해',
      '도전하면 성과가 잘 붙는 해',
    ], variantIndex);
  }
  if (qualityLabel === '길') {
    return pickByIndex([
      '대체로 잘 풀리는 해',
      '준비한 만큼 성과가 나기 쉬운 해',
      '안정적으로 전진하기 좋은 해',
    ], variantIndex);
  }
  if (qualityLabel === '대흉') {
    return pickByIndex([
      '손실 방어가 최우선인 해',
      '리스크를 줄이는 운영이 핵심인 해',
      '확장보다 안전한 유지 전략이 필요한 해',
    ], variantIndex);
  }
  if (qualityLabel === '주의') {
    return pickByIndex([
      '실수 관리가 특히 중요한 해',
      '속도보다 점검이 더 중요한 해',
      '조심하면 충분히 지켜낼 수 있는 해',
    ], variantIndex);
  }
  if (qualityLabel === '흉') {
    return pickByIndex([
      '무리하면 손해 보기 쉬운 해',
      '방어와 관리가 최우선인 해',
      '과속을 줄이고 안전하게 가야 하는 해',
    ], variantIndex);
  }
  return pickByIndex([
    '무난하게 관리하면 좋은 해',
    '기본기를 챙기면 안정적인 해',
    '리듬을 유지하면 손해를 줄일 수 있는 해',
  ], variantIndex);
}

function strengthVariantCode(strengthLabel: string): number {
  if (strengthLabel.includes('극신약')) return 0;
  if (strengthLabel.includes('신약')) return 1;
  if (strengthLabel.includes('중화')) return 2;
  if (strengthLabel.includes('신강')) return 3;
  if (strengthLabel.includes('극신강')) return 4;
  return 2;
}

function qualityVariantCode(qualityLabel: string | null): number {
  if (qualityLabel == null) return 0;
  if (qualityLabel === '대흉') return 0;
  if (qualityLabel === '흉') return 1;
  if (qualityLabel === '주의') return 1;
  if (qualityLabel === '평') return 2;
  if (qualityLabel === '길') return 3;
  if (qualityLabel === '대길') return 4;
  return 0;
}

type StrengthStateCode = 'very_weak' | 'weak' | 'balanced' | 'strong' | 'very_strong';

function strengthStateCode(strengthLabel: string): StrengthStateCode {
  if (strengthLabel.includes('극신약')) return 'very_weak';
  if (strengthLabel.includes('신약')) return 'weak';
  if (strengthLabel.includes('극신강')) return 'very_strong';
  if (strengthLabel.includes('신강')) return 'strong';
  return 'balanced';
}

function easyConclusionByState(
  dm: string,
  strengthState: StrengthStateCode,
  relationBand: number,
  balanceBand: number,
  variantIndex: number,
): string {
  const base = strengthState === 'very_weak' || strengthState === 'weak'
    ? `${dm} 타입이며, 지금은 무리하게 밀기보다 도움을 활용하는 전략이 맞아요.`
    : strengthState === 'very_strong' || strengthState === 'strong'
      ? `${dm} 타입이며, 추진력이 장점이라 방향만 정확하면 성과를 내기 좋아요.`
      : `${dm} 타입이며, 균형을 유지하면 안정적으로 성장하기 좋은 흐름이에요.`;

  const relationText = relationBand >= 3
    ? '사람·환경 변화가 잦을 수 있어 소통 확인이 특히 중요해요.'
    : relationBand === 0
      ? '혼자 판단하기 쉬운 흐름이라 중간 점검 파트너를 두면 좋아요.'
      : '관계 흐름은 보통 수준이라 기본 약속 관리만 잘해도 안정적이에요.';

  const balanceText = balanceBand >= 3
    ? '기운 편차가 커서 생활 리듬을 일정하게 유지하는 게 핵심입니다.'
    : balanceBand === 2
      ? '부족한 기운 보완이 중요해서, 보충 루틴을 꾸준히 지키는 게 좋아요.'
      : balanceBand === 1
        ? '강한 기운이 한쪽으로 몰리지 않게 속도 조절이 필요해요.'
        : '기운 균형이 비교적 좋아 기본기를 유지하면 유리해요.';

  return pickByIndex([base, `${base} ${relationText}`, `${base} ${balanceText}`], variantIndex);
}

function easyOpportunityByState(
  strengthState: StrengthStateCode,
  qualityLabel: string | null,
  yongshinLabel: string,
): string {
  if (qualityLabel === '대흉' || qualityLabel === '흉' || qualityLabel === '주의') {
    return `${yongshinLabel} 기운과 맞는 작은 실행부터 쌓으면, 불안정한 흐름에서도 성과를 지킬 수 있어요.`;
  }
  if (strengthState === 'very_strong' || strengthState === 'strong') {
    return `주도적으로 시작하는 힘이 강점입니다. ${yongshinLabel} 관련 활동에 집중하면 성과가 빨라져요.`;
  }
  if (strengthState === 'very_weak' || strengthState === 'weak') {
    return `협업과 도움을 연결하는 능력이 강점으로 작동합니다. ${yongshinLabel} 방향으로 팀플레이를 잡아보세요.`;
  }
  return `균형 감각이 좋아서 안정적으로 성장하기 쉽습니다. ${yongshinLabel} 관련 루틴을 꾸준히 유지하세요.`;
}

function gisinExposureNote(gisinLabel: string, gisinCount: number): string {
  if (gisinCount === 0) {
    return `${gisinLabel} 기운은 원국 노출이 낮아 평소 영향은 제한적이지만, 운에서 유입될 때 변동성이 커질 수 있습니다.`;
  }
  if (gisinCount >= 3) {
    return `${gisinLabel} 기운이 원국에서 이미 강한 편이라 과속·과몰입 관리가 중요합니다.`;
  }
  return `${gisinLabel} 기운이 올라오는 시기에는 판단 속도보다 점검이 우선입니다.`;
}

function gisinElementSummaryNote(gisinLabel: string, gisinCount: number): string {
  if (gisinCount === 0) return `${gisinLabel} 기운은 원국 노출이 낮아 유입 시기만 집중 점검하면 됩니다.`;
  if (gisinCount >= 3) return `${gisinLabel} 기운은 원국에서 강한 편이라 과속 관리가 핵심입니다.`;
  return `${gisinLabel} 기운은 올라오는 시기에만 결정 속도를 조절하세요.`;
}

function gisinCareFocus(gisinElement: Ohaeng | null): string {
  if (gisinElement === Ohaeng.WOOD) return '아이디어를 늘리기보다 우선순위를 1~2개로 압축하세요.';
  if (gisinElement === Ohaeng.FIRE) return '흥분한 상태에서는 결정·발언 전에 한 번 쉬고 검토하세요.';
  if (gisinElement === Ohaeng.EARTH) return '책임을 과하게 떠안지 말고 역할 경계를 분명히 하세요.';
  if (gisinElement === Ohaeng.METAL) return '표현 톤을 부드럽게 조정해 충돌을 줄이세요.';
  if (gisinElement === Ohaeng.WATER) return '수면 리듬을 먼저 고정하고 작은 일부터 순서대로 처리하세요.';
  return '속도를 낮추고 체크리스트로 판단 오차를 줄이세요.';
}

function gisinActionFocus(gisinElement: Ohaeng | null): string {
  if (gisinElement === Ohaeng.WOOD) return '아이디어는 주 1회 리뷰에서 선별해 실행 항목만 남기세요.';
  if (gisinElement === Ohaeng.FIRE) return '중요 대화·결정 전 10분 쿨다운 규칙을 적용하세요.';
  if (gisinElement === Ohaeng.EARTH) return '업무를 혼자 떠안지 말고 역할·마감 책임자를 분리하세요.';
  if (gisinElement === Ohaeng.METAL) return '피드백 문장을 완화형 표현으로 바꿔 전달 충돌을 줄이세요.';
  if (gisinElement === Ohaeng.WATER) return '취침 시간을 고정하고 다음 날 우선순위 3개만 기록하세요.';
  return '체크리스트 기반으로 결정·실행 단계를 분리하세요.';
}

function gisinRiskPhrase(gisinLabel: string, gisinCount: number, gisinElement: Ohaeng | null): string {
  return `${gisinExposureNote(gisinLabel, gisinCount)} ${gisinCareFocus(gisinElement)}`;
}

function easyRiskByState(
  relationBand: number,
  balanceBand: number,
  gisinLabel: string | null,
  gisinCount: number,
  gisinElement: Ohaeng | null,
  qualityLabel: string | null,
  variantIndex: number,
): string {
  if (gisinLabel != null && balanceBand >= 2) {
    return pickByIndex([
      `${gisinRiskPhrase(gisinLabel, gisinCount, gisinElement)} 생활 리듬이 흔들리는 주간에는 새 확장보다 기존 일정 안정화를 우선하세요.`,
      `${gisinRiskPhrase(gisinLabel, gisinCount, gisinElement)} 중요한 일정은 체크리스트로 한 번 더 검증하세요.`,
      `${gisinRiskPhrase(gisinLabel, gisinCount, gisinElement)} 컨디션 저하 구간에는 새 일 시작보다 마무리 업무를 먼저 끝내세요.`,
    ], variantIndex);
  }
  if (gisinLabel != null) {
    return pickByIndex([
      `${gisinRiskPhrase(gisinLabel, gisinCount, gisinElement)} 계약·지출·갈등 이슈는 즉시 확정보다 재확인이 유리합니다.`,
      `${gisinRiskPhrase(gisinLabel, gisinCount, gisinElement)} 중요한 결정은 하루 텀을 두면 오류를 크게 줄일 수 있어요.`,
      `${gisinRiskPhrase(gisinLabel, gisinCount, gisinElement)} 성급한 답변 대신 근거를 메모해 두고 회신하세요.`,
    ], variantIndex + qualityVariantCode(qualityLabel));
  }
  if (balanceBand >= 2) {
    return pickByIndex([
      '기운 편차가 커서 컨디션 기복이 생기기 쉽습니다. 수면·식사 시간을 일정하게 유지하세요.',
      '균형 편차가 큰 편이라 감정·체력의 오르내림이 생길 수 있어 기본 루틴 유지가 중요해요.',
      '기운 불균형이 커질수록 작은 실수가 늘 수 있으니, 하루 리듬을 먼저 고정하세요.',
    ], variantIndex);
  }
  if (relationBand >= 3) {
    return pickByIndex([
      '관계 변화가 자주 생길 수 있으니, 중요한 대화와 약속은 기록으로 남겨 오해를 줄이세요.',
      '사람 이슈가 잦을 수 있어 말로만 합의하지 말고, 핵심 내용은 메모로 정리하세요.',
      '관계 변동성이 큰 흐름이라 소통 확인 루틴(재확인 메시지)이 필요합니다.',
    ], variantIndex);
  }
  if (relationBand === 0) {
    return pickByIndex([
      '혼자 밀어붙이는 습관이 생기기 쉬운 흐름입니다. 중간 점검 파트너를 두세요.',
      '독단적 결정이 늘기 쉬운 흐름이라, 중요한 선택은 제3자 확인을 거치세요.',
      '혼자 해결하려는 경향이 커질 수 있어 주간 점검 회의를 고정하면 좋아요.',
    ], variantIndex);
  }
  return pickByIndex([
    '큰 리스크는 크지 않지만, 서두르면 작은 실수가 누적될 수 있으니 체크리스트를 유지하세요.',
    '전반적 리스크는 낮은 편이지만 기본 점검을 건너뛰면 품질이 흔들릴 수 있어요.',
    '안정 구간이더라도 확인 절차를 지키면 손실 가능성을 더 낮출 수 있습니다.',
  ], variantIndex);
}

function easyOperatingMode(
  strengthState: StrengthStateCode,
  qualityLabel: string | null,
): string {
  if (qualityLabel === '대흉' || qualityLabel === '흉' || qualityLabel === '주의') {
    return '방어형 운영: 손실 최소화, 점검 우선';
  }
  if (strengthState === 'very_strong' || strengthState === 'strong') return '추진형 운영: 빠른 실행 + 중간 점검';
  if (strengthState === 'very_weak' || strengthState === 'weak') return '안정형 운영: 분할 실행 + 협업 강화';
  return '균형형 운영: 무리 없이 꾸준한 누적';
}

function relationBandCode(totalRelations: number): number {
  if (totalRelations === 0) return 0;
  if (totalRelations <= 2) return 1;
  if (totalRelations <= 4) return 2;
  return 3;
}

function balanceBandCode(missingCount: number, dominantCount: number): number {
  if (missingCount > 0 && dominantCount > 0) return 3;
  if (missingCount > 0) return 2;
  if (dominantCount > 0) return 1;
  return 0;
}

function ohaengEasyRoutine(element: Ohaeng): string {
  switch (element) {
    case Ohaeng.WOOD:
      return '걷기·독서·식물 돌보기처럼 “성장” 느낌의 활동을 루틴에 넣으세요.';
    case Ohaeng.FIRE:
      return '햇빛 보기·가벼운 운동·발표 연습처럼 “활력” 활동을 꾸준히 하세요.';
    case Ohaeng.EARTH:
      return '정리정돈·식사시간 고정·가계부처럼 “안정” 루틴을 먼저 세우세요.';
    case Ohaeng.METAL:
      return '체크리스트·물건 정리·시간 약속 지키기처럼 “규칙” 습관이 도움이 됩니다.';
    case Ohaeng.WATER:
      return '수분 섭취·휴식·기록하기처럼 “회복” 습관을 먼저 챙기세요.';
  }
}

function buildYearlyOneLine(
  targetYear: number,
  qualityLabel: string | null,
  tone: string | null,
  overview: string | null,
  variantIndex: number,
): string | null {
  if (qualityLabel == null || tone == null || overview == null) return null;
  const overviewSentence = firstSentence(simplifyForYouth(overview));

  if (qualityLabel === '대흉' || qualityLabel === '흉' || qualityLabel === '주의') {
    return pickByIndex([
      `${targetYear}년은 ${tone}. 좋은 기회가 보여도 작게 시험한 뒤 확대하는 방식이 안전해요.`,
      `${targetYear}년은 ${tone}. 서두르기보다 점검 후 실행하면 손실을 크게 줄일 수 있어요.`,
      `${targetYear}년은 ${tone}. 목표를 줄이고 핵심 1~2개에 집중하면 훨씬 안정적으로 운영할 수 있어요.`,
    ], variantIndex);
  }

  return pickByIndex([
    `${targetYear}년은 ${tone}. ${overviewSentence}`,
    `${targetYear}년은 ${tone}. 준비한 계획을 실행으로 옮기기 좋은 시기예요.`,
    `${targetYear}년은 ${tone}. 성급함만 줄이면 성과를 쌓기 유리합니다.`,
  ], variantIndex);
}

function monthlyOperatingHint(qualityLabel: string): string {
  if (qualityLabel === '대길' || qualityLabel === '길') {
    return '이번 달은 준비된 과제를 실행하고, 완료율을 높이는 운영이 유리합니다.';
  }
  if (qualityLabel === '흉' || qualityLabel === '대흉') {
    return '이번 달은 신규 확장보다 점검·리스크 관리 중심으로 운영하는 편이 안전합니다.';
  }
  return '이번 달은 무리한 변화보다 기본 루틴을 안정적으로 유지하는 운영이 적합합니다.';
}

function twoDigit(value: number): string {
  return `${value}`.padStart(2, '0');
}

function formatIsoDateLabel(date: ServiceDateParts): string {
  return `${date.year}-${twoDigit(date.month)}-${twoDigit(date.day)}`;
}

function luckQualityScore(quality: LuckQuality): number {
  if (quality === LuckQuality.VERY_FAVORABLE) return 2;
  if (quality === LuckQuality.FAVORABLE) return 1;
  if (quality === LuckQuality.UNFAVORABLE) return -1;
  if (quality === LuckQuality.VERY_UNFAVORABLE) return -2;
  return 0;
}

function scoreToLuckQuality(score: number): LuckQuality {
  if (score >= 1.5) return LuckQuality.VERY_FAVORABLE;
  if (score >= 0.5) return LuckQuality.FAVORABLE;
  if (score <= -1.5) return LuckQuality.VERY_UNFAVORABLE;
  if (score <= -0.5) return LuckQuality.UNFAVORABLE;
  return LuckQuality.NEUTRAL;
}

function synthesizeDailyQuality(
  dayQuality: LuckQuality,
  monthQuality: LuckQuality,
  yearQuality: LuckQuality,
): LuckQuality {
  const blendedScore =
    (luckQualityScore(dayQuality) * 0.7) +
    (luckQualityScore(monthQuality) * 0.2) +
    (luckQualityScore(yearQuality) * 0.1);
  return scoreToLuckQuality(blendedScore);
}

function dailyOperatingHint(
  quality: LuckQuality,
  isYongshinElement: boolean,
  isGisinElement: boolean,
): string {
  if (isGisinElement) {
    return '기신 자극이 감지되는 날이라 중요한 결정은 시간차 검토 후 확정하세요.';
  }
  if (isYongshinElement && quality !== LuckQuality.UNFAVORABLE && quality !== LuckQuality.VERY_UNFAVORABLE) {
    return '용신 기운이 맞물리는 날이므로 핵심 과제를 우선 완료하는 쪽이 유리합니다.';
  }
  if (quality === LuckQuality.VERY_FAVORABLE || quality === LuckQuality.FAVORABLE) {
    return '실행력이 살아나는 날이므로 우선순위 1~2개를 끝내는 데 집중하세요.';
  }
  if (quality === LuckQuality.UNFAVORABLE || quality === LuckQuality.VERY_UNFAVORABLE) {
    return '변동성이 큰 날이라 확장보다 점검·정리·마감 중심으로 운영하세요.';
  }
  return '중립 구간이므로 루틴을 지키면서 누적 과제를 안정적으로 처리하세요.';
}

interface CurrentTimingSnapshot {
  readonly yearQualityLabel: string;
  readonly monthQualityLabel: string;
  readonly dayQualityLabel: string;
  readonly yearlySummary: string;
  readonly monthlySummary: string;
  readonly monthlyAction: string;
  readonly todaySummary: string;
  readonly todayAction: string;
}

function buildCurrentTimingSnapshot(
  analysis: SajuAnalysis,
  currentYearBundle: YearlyFortuneBundle | null,
  currentDate: ServiceDateParts,
): CurrentTimingSnapshot | null {
  if (currentYearBundle == null) return null;

  const monthIndex = SaeunCalculator.sajuMonthIndexAt(
    currentDate.year,
    currentDate.month,
    currentDate.day,
    currentDate.hour,
    currentDate.minute,
  );
  const monthHighlight = currentYearBundle.fortune.monthlyHighlights.find(
    mh => mh.sajuMonthIndex === monthIndex,
  ) ?? currentYearBundle.fortune.monthlyHighlights[0];
  if (monthHighlight == null) return null;

  const yearQuality = LUCK_QUALITY_INFO[currentYearBundle.fortune.quality].koreanName;
  const monthQuality = LUCK_QUALITY_INFO[monthHighlight.quality].koreanName;
  const isBestMonth = currentYearBundle.fortune.bestMonths.includes(monthHighlight.monthLabel);
  const isCautionMonth = currentYearBundle.fortune.cautionMonths.includes(monthHighlight.monthLabel);
  const monthlyAction = isBestMonth
    ? '기회월로 분류된 달이라 핵심 과제를 실행하고 마감률을 높이세요.'
    : isCautionMonth
      ? '주의월로 분류된 달이라 점검·보완 작업을 먼저 배치하세요.'
      : monthlyOperatingHint(monthQuality);

  const dayPillar = GanjiCycle.dayPillarByJdn(currentDate.year, currentDate.month, currentDate.day);
  const dayAnalysis = LuckInteractionAnalyzer.analyzeLuckPillar(
    dayPillar,
    analysis.pillars,
    analysis.pillars.day.cheongan,
    analysis.yongshinResult?.finalYongshin ?? null,
    analysis.yongshinResult?.gisin ?? null,
  );
  const todayQuality = synthesizeDailyQuality(
    dayAnalysis.quality,
    monthHighlight.quality,
    currentYearBundle.fortune.quality,
  );
  const todayQualityLabel = LUCK_QUALITY_INFO[todayQuality].koreanName;
  const dayTheme = SIPSEONG_INFO[dayAnalysis.sipseong].koreanName;
  const dayFocus = dayAnalysis.isYongshinElement
    ? '용신 기운이 맞물리는 날'
    : dayAnalysis.isGisinElement
      ? '기신 자극이 들어오는 날'
      : `${dayTheme} 성향이 전면에 드러나는 날`;
  const todaySummary = `${formatPillar(dayPillar)} [${todayQualityLabel}] ${dayFocus}입니다.`;
  const todayAction = isBestMonth && (todayQuality === LuckQuality.VERY_FAVORABLE || todayQuality === LuckQuality.FAVORABLE)
    ? '월운 지원이 겹치는 날이라 미뤄 둔 핵심 업무를 오늘 우선 처리하세요.'
    : isCautionMonth && (todayQuality === LuckQuality.UNFAVORABLE || todayQuality === LuckQuality.VERY_UNFAVORABLE)
      ? '월운·일운 모두 변동 구간이므로 일정 확정보다 검토·보완을 먼저 하세요.'
      : dailyOperatingHint(todayQuality, dayAnalysis.isYongshinElement, dayAnalysis.isGisinElement);

  return {
    yearQualityLabel: yearQuality,
    monthQualityLabel: monthQuality,
    dayQualityLabel: todayQualityLabel,
    yearlySummary: `${yearQuality} — ${simplifyForYouth(currentYearBundle.fortune.overview)}`,
    monthlySummary: `${monthHighlight.monthLabel} [${monthQuality}] ${simplifyForYouth(monthHighlight.highlight)}`,
    monthlyAction,
    todaySummary,
    todayAction,
  };
}

function lifetimeToneSummary(snapshot: LifetimeLuckSnapshot): string {
  if (snapshot.dominantTone === 'upward') return '상승 구간 비중이 높아 기회 포착형 운영이 유리한 편입니다.';
  if (snapshot.dominantTone === 'defensive') return '관리 구간 비중이 높아 리스크 최소화형 운영이 유리한 편입니다.';
  return '상승 구간과 관리 구간이 교차하므로 시기별 전략 전환이 핵심입니다.';
}

function buildEasyActionItems(
  analysis: SajuAnalysis,
  yearlyBundle: YearlyFortuneBundle | null,
  strengthState: StrengthStateCode,
  qualityLabel: string | null,
  relationBand: number,
  balanceBand: number,
  yongshinElement: Ohaeng | null,
  gisinElement: Ohaeng | null,
  gisinCount: number,
  lifeActions: readonly (string | null)[],
  variantIndex: number,
): string[] {
  const primary = qualityLabel === '대흉' || qualityLabel === '흉' || qualityLabel === '주의'
    ? pickByIndex([
      '올해는 큰 확장보다 손실을 줄이는 운영이 우선입니다. 중요한 결정은 24시간 점검 후 실행하세요.',
      '속도보다 정확도가 중요한 시기입니다. 새로운 시도는 작은 단위로 테스트한 뒤 확대하세요.',
      '핵심 과제 1~2개만 남기고 나머지는 줄여서 안정성을 확보하세요.',
    ], variantIndex + relationBand + balanceBand)
    : (strengthState === 'very_weak' || strengthState === 'weak')
      ? pickByIndex([
        '큰 목표는 3단계로 나눠 진행하고, 각 단계마다 도움을 요청하세요.',
        '혼자 해결하려 하기보다 상의 후 실행하면 시행착오를 크게 줄일 수 있어요.',
        '체력·시간·예산의 여유를 먼저 확보한 뒤 과제를 확장하세요.',
      ], variantIndex + relationBand + balanceBand)
      : (strengthState === 'very_strong' || strengthState === 'strong')
        ? pickByIndex([
          '추진력이 장점이므로 빠르게 실행하되, 중간 점검 날짜를 미리 고정해 두세요.',
          '시작은 빠르게, 확장은 천천히가 핵심입니다. 주간 회고로 방향을 바로잡으세요.',
          '결정이 빠른 강점을 살리되, 고위험 결정은 체크리스트를 통과한 뒤 확정하세요.',
        ], variantIndex + relationBand + balanceBand)
        : pickByIndex([
          '지금은 균형 유지가 강점입니다. 무리한 변화보다 꾸준한 누적 전략을 선택하세요.',
          '기본 루틴을 안정적으로 지키면 작은 성과가 꾸준히 쌓이는 흐름입니다.',
          '과속보다 지속가능성을 기준으로 일정과 목표를 조정하세요.',
        ], variantIndex + relationBand + balanceBand);

  const riskGuard = gisinElement != null
    ? gisinCount === 0
      ? `주의 기운 ${ohaengKorean(gisinElement)}은 원국 노출이 낮지만 운에서 유입되는 시기에는 ${gisinActionFocus(gisinElement)}`
      : gisinCount >= 3
        ? `주의 기운 ${ohaengKorean(gisinElement)}이 원국에서 강한 편이라 ${gisinActionFocus(gisinElement)}`
        : `주의 기운 ${ohaengKorean(gisinElement)}이 강해지는 구간에는 ${gisinActionFocus(gisinElement)}`
    : balanceBand >= 2
      ? '기운 편차가 큰 편이라 수면·식사·운동 시간을 일정하게 유지해 컨디션 변동을 줄이세요.'
      : relationBand >= 3
        ? '관계 이슈가 생기기 쉬워서 중요한 대화와 약속은 기록으로 남기는 습관이 필요합니다.'
        : relationBand === 0
          ? '혼자 판단이 쌓이기 쉬우니, 주 1회는 신뢰하는 사람과 계획을 점검하세요.'
          : '큰 리스크는 크지 않지만, 일정과 약속 확인 루틴을 유지하면 실수를 줄일 수 있어요.';

  const firstLifeAction = lifeActions
    .map(action => (action != null ? firstSentence(simplifyForYouth(action)) : ''))
    .find(action => action.length > 0);
  const growthAction = firstLifeAction
    ?? (yongshinElement != null
      ? `나를 돕는 기운 ${ohaengKorean(yongshinElement)} 실천: ${ohaengEasyRoutine(yongshinElement)}`
      : '하루 루틴(수면·식사·운동)을 먼저 안정화해 기본 체력을 지키세요.');

  const monthAction = yearlyBundle != null
    ? (() => {
      const best = yearlyBundle.fortune.bestMonths.slice(0, 2).map(compactMonthLabel).join(', ') || '해당 없음';
      const caution = yearlyBundle.fortune.cautionMonths.slice(0, 2).map(compactMonthLabel).join(', ') || '해당 없음';
      return pickByIndex([
        `${yearlyBundle.targetYear}년 기회월(${best})에는 실행을, 주의월(${caution})에는 점검을 우선하세요.`,
        `${yearlyBundle.targetYear}년은 기회월(${best})에 신규 과제를 배치하고, 주의월(${caution})에는 유지·보수 작업을 배치하세요.`,
        `${yearlyBundle.targetYear}년 일정은 기회월(${best}) 중심으로 확장하고, 주의월(${caution})에는 리스크 관리 중심으로 운영하세요.`,
      ], variantIndex + relationBand);
    })()
    : null;

  const actions = uniqueTake(
    [primary, riskGuard, growthAction, monthAction]
      .filter((item): item is string => item != null && item.length > 0)
      .map(item => firstSentence(simplifyForYouth(item))),
    3,
  );
  return actions.length > 0 ? actions : ['하루 루틴(수면·식사·운동)을 먼저 안정화하세요.'];
}

function uniqueTake(values: readonly string[], limit: number): string[] {
  const unique = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = compactLine(value);
    if (!normalized || unique.has(normalized)) continue;
    unique.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeBodyLine(raw: string): string | null {
  const line = raw.trim();
  if (!line) return null;
  if (line.startsWith('■') || line.startsWith('[') || line.startsWith('※')) return null;
  return compactLine(line.replace(/^[\-•▸·]\s*/, ''));
}

function collectSectionHighlights(
  section: string,
  limit: number,
  keywords: readonly string[] = [],
): string[] {
  const bodyLines = section
    .split('\n')
    .map(normalizeBodyLine)
    .filter((line): line is string => line != null && line.length > 0);
  if (bodyLines.length === 0) return [];

  if (keywords.length === 0) {
    return uniqueTake(bodyLines, limit);
  }

  const prioritized = bodyLines.filter(line =>
    keywords.some(keyword => line.includes(keyword)),
  );
  const remainder = bodyLines.filter(line => !prioritized.includes(line));
  return uniqueTake([...prioritized, ...remainder], limit);
}

function sectionBlockLines(section: string, marker: string): string[] {
  const lines = section.split('\n').map(line => line.trim());
  const startIndex = lines.findIndex(line => line.startsWith(marker));
  if (startIndex < 0) return [];

  const block: string[] = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    if (line.startsWith('■')) break;
    if (line.startsWith('【') && i > startIndex + 1) break;
    block.push(line);
  }
  return block;
}

function firstBodyLine(section: string): string | null {
  return collectSectionHighlights(section, 1)[0] ?? null;
}

function lineContaining(section: string, token: string): string | null {
  for (const raw of section.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.includes(token)) return compactLine(line);
  }
  return null;
}

function sectionLeadLine(section: string, marker: string): string | null {
  for (const line of sectionBlockLines(section, marker)) {
    if (line.startsWith('·') || line.startsWith('▸') || line.startsWith('※') || line.startsWith('→')) {
      continue;
    }
    const normalized = normalizeBodyLine(line);
    if (normalized != null) return normalized;
  }
  return null;
}

function sectionActionLine(section: string, marker: string): string | null {
  for (const line of sectionBlockLines(section, marker)) {
    if (!line.startsWith('→')) continue;
    return compactLine(line.replace(/^→\s*/, ''));
  }
  return null;
}

function combineLeadAndAction(lead: string | null, action: string | null): string {
  if (lead != null && action != null) {
    return lead === action ? lead : `${lead} / 실행: ${action}`;
  }
  if (lead != null) return lead;
  if (action != null) return `실행: ${action}`;
  return '핵심 문장을 추출하지 못했습니다.';
}

function buildOhaengBalanceSummary(analysis: SajuAnalysis): string {
  const distribution = analysis.ohaengDistribution;
  if (distribution == null) return '오행 분포 데이터가 없어 균형 평가는 보수적으로 판단합니다.';

  const counts = OHAENG_VALUES.map(oh => ({ oh, count: distribution.get(oh) ?? 0 }));
  const missing = counts.filter(item => item.count === 0).map(item => ohaengKorean(item.oh));
  const maxCount = Math.max(...counts.map(item => item.count));
  const dominant = counts
    .filter(item => item.count === maxCount && maxCount >= 3)
    .map(item => ohaengKorean(item.oh));

  if (missing.length === 0 && dominant.length === 0) {
    return '오행 편중이 크지 않아, 현재는 균형 유지 전략이 유효합니다.';
  }

  const notes: string[] = [];
  if (dominant.length > 0) notes.push(`강한 축: ${dominant.join(', ')}`);
  if (missing.length > 0) notes.push(`보완 축: ${missing.join(', ')}`);
  return notes.join(' / ');
}

interface YearlyFortuneBundle {
  readonly targetYear: number;
  readonly fortune: YearlyFortune;
  readonly narrative: string;
}

interface SummarySections {
  readonly overview: string;
  readonly ohaengDistribution: string;
  readonly coreCharacteristics: string;
  readonly yongshinGuidance: string;
  readonly lifeDomainAnalysis: string;
  readonly specialFeatures: string;
  readonly overallAssessment: string;
  readonly luckCycleOverview: string;
}

function buildServiceReadableSummary(
  analysis: SajuAnalysis,
  yearlyBundle: YearlyFortuneBundle | null,
  currentYearBundle: YearlyFortuneBundle | null,
  currentDate: ServiceDateParts,
  sections: SummarySections,
): string {
  const lines: string[] = [];

  const dm = stemKorean(analysis.pillars.day.cheongan);
  const strength = analysis.strengthResult
    ? strengthLevelKorean(analysis.strengthResult.level)
    : '미판정';
  const gyeokguk = analysis.gyeokgukResult
    ? GYEOKGUK_TYPE_INFO[analysis.gyeokgukResult.type].koreanName
    : '미판정';
  const yongshin = analysis.yongshinResult
    ? ohaengKorean(analysis.yongshinResult.finalYongshin)
    : '미결정';
  const yongshinElement = analysis.yongshinResult?.finalYongshin ?? null;
  const gisinElement = analysis.yongshinResult?.gisin ?? null;
  const heesin = analysis.yongshinResult?.finalHeesin != null
    ? ohaengKorean(analysis.yongshinResult.finalHeesin)
    : null;
  const gisin = gisinElement != null
    ? ohaengKorean(gisinElement)
    : null;
  const gisinCount = gisinElement != null
    ? (analysis.ohaengDistribution?.get(gisinElement) ?? 0)
    : 0;
  const topCheonganNotes = uniqueTake(
    [...analysis.scoredCheonganRelations]
      .sort((a, b) => b.score.finalScore - a.score.finalScore)
      .map(item => item.hit.note),
    2,
  );
  const topJijiNotes = uniqueTake(
    [...analysis.resolvedJijiRelations]
      .sort((a, b) => (b.score?.finalScore ?? 0) - (a.score?.finalScore ?? 0))
      .map(item => item.hit.note),
    2,
  );
  const topShinsal = uniqueTake(
    [...analysis.weightedShinsalHits]
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 5)
      .map(item => SHINSAL_TYPE_INFO[item.hit.type].koreanName),
    3,
  );
  const topComposites = uniqueTake(
    analysis.shinsalComposites.map(composite => composite.patternName),
    2,
  );
  const strengthLine = lineContaining(sections.coreCharacteristics, '【신강/신약】');
  const yongshinLine = lineContaining(sections.yongshinGuidance, '최종 용신:');
  const overallLine = firstBodyLine(sections.overallAssessment);
  const plainStrengthLine = strengthLine != null ? simplifyForYouth(strengthLine) : null;
  const plainYongshinLine = yongshinLine != null ? simplifyForYouth(yongshinLine) : null;
  const plainOverallLine = overallLine != null ? simplifyForYouth(overallLine) : null;
  const overviewHighlights = collectSectionHighlights(sections.overview, 3, [
    '년주',
    '월주',
    '일간',
    '공망',
  ]);
  const ohaengHighlights = collectSectionHighlights(sections.ohaengDistribution, 4, [
    '과다',
    '부재',
    '음양',
    '상생',
    '단절',
    '소진',
  ]);
  const coreHighlights = collectSectionHighlights(sections.coreCharacteristics, 4, [
    '총합',
    '성격:',
    '조언:',
    '성격/파격',
    '격국용신',
  ]);
  const yongshinHighlights = collectSectionHighlights(sections.yongshinGuidance, 4, [
    '신뢰도',
    '결론:',
    '조후용신',
    '억부용신',
    '격국용신',
    '실천 가이드',
    '기신',
  ]);
  const overallHighlights = collectSectionHighlights(sections.overallAssessment, 3, [
    '용신',
    '기신',
    '특기할 신살',
    '논리 체인',
    '인생 방향',
  ]);
  const luckHighlights = collectSectionHighlights(sections.luckCycleOverview, 3, [
    '대운 방향',
    '핵심 기회',
    '핵심 주의',
    '운세',
  ]);
  const lifeWealth = sectionLeadLine(sections.lifeDomainAnalysis, '【재물운');
  const lifeCareer = sectionLeadLine(sections.lifeDomainAnalysis, '【직업운');
  const lifeHealth = sectionLeadLine(sections.lifeDomainAnalysis, '【건강운');
  const lifeLove = sectionLeadLine(sections.lifeDomainAnalysis, '【연애/결혼운')
    ?? sectionLeadLine(sections.lifeDomainAnalysis, '【연애운');
  const lifeWealthAction = sectionActionLine(sections.lifeDomainAnalysis, '【재물운');
  const lifeCareerAction = sectionActionLine(sections.lifeDomainAnalysis, '【직업운');
  const lifeHealthAction = sectionActionLine(sections.lifeDomainAnalysis, '【건강운');
  const lifeLoveAction = sectionActionLine(sections.lifeDomainAnalysis, '【연애/결혼운')
    ?? sectionActionLine(sections.lifeDomainAnalysis, '【연애운');
  const featuresLead = firstBodyLine(sections.specialFeatures);
  const daeunLead = firstBodyLine(sections.luckCycleOverview);
  const plainFeaturesLead = featuresLead != null ? simplifyForYouth(featuresLead) : null;
  const plainDaeunLead = daeunLead != null ? simplifyForYouth(daeunLead) : null;
  const relationTotal = analysis.scoredCheonganRelations.length + analysis.resolvedJijiRelations.length;
  const missingCount = analysis.ohaengDistribution != null
    ? OHAENG_VALUES.filter(oh => (analysis.ohaengDistribution?.get(oh) ?? 0) === 0).length
    : 0;
  const dominantCount = analysis.ohaengDistribution != null
    ? (() => {
      const counts = OHAENG_VALUES.map(oh => analysis.ohaengDistribution?.get(oh) ?? 0);
      const max = Math.max(...counts);
      return max >= 3 ? counts.filter(c => c === max).length : 0;
    })()
    : 0;
  const qualityLabel = yearlyBundle != null ? LUCK_QUALITY_INFO[yearlyBundle.fortune.quality].koreanName : null;
  const strengthState = strengthStateCode(strength);
  const relationBand = relationBandCode(relationTotal);
  const balanceBand = balanceBandCode(missingCount, dominantCount);
  const interpretationVariant =
    (strengthVariantCode(strength) * 100) +
    (qualityVariantCode(qualityLabel) * 50) +
    (relationBand * 25) +
    (balanceBand * 15) +
    (missingCount * 13) +
    (dominantCount * 17) +
    ((yongshinElement != null ? OHAENG_VALUES.indexOf(yongshinElement) + 1 : 0) * 7) +
    ((gisinElement != null ? OHAENG_VALUES.indexOf(gisinElement) + 1 : 0) * 5) +
    (gisinCount * 11) +
    (topShinsal.length * 3);
  const easyConclusion = analysis.strengthResult != null
    ? easyConclusionByState(dm, strengthState, relationBand, balanceBand, interpretationVariant)
    : pickByIndex([
      `${dm} 타입으로 보이며, 강약 데이터는 추가 확인이 필요해요.`,
      `${dm} 기운이 중심으로 보이지만, 강약은 데이터 보강 후 더 정확히 볼 수 있어요.`,
      `${dm} 타입은 확인되었고, 강약 판정은 데이터가 더 쌓이면 더 정확해집니다.`,
    ], interpretationVariant);
  const easyStrength = analysis.strengthResult != null
    ? easyStrengthSummary(strength, analysis.strengthResult.isStrong, interpretationVariant + relationTotal)
    : '내 기운의 강약 정보가 부족해서, 기본 생활 리듬을 안정적으로 유지하며 관찰이 필요해요.';
  const elementVariantIndex = interpretationVariant + (heesin != null ? 3 : 0) + (gisin != null ? 5 : 0) + (topShinsal.length * 2);
  const gisinExposureLine = gisin != null ? gisinElementSummaryNote(gisin, gisinCount) : null;
  const easyElement = analysis.yongshinResult != null
    ? pickByIndex([
      `도움 기운은 ${yongshin}${heesin ? `, 보조 기운은 ${heesin}` : ''}${gisin ? `, 주의 기운은 ${gisin}` : ''}입니다.${gisinExposureLine ? ` ${gisinExposureLine}` : ''}`,
      `이번 사주는 ${yongshin} 기운이 나를 밀어줍니다.${heesin ? ` ${heesin}도 보조로 도움이 됩니다.` : ''}${gisinExposureLine ? ` ${gisinExposureLine}` : ''}`,
      `생활에서 ${yongshin} 관련 습관을 늘리면 유리합니다.${heesin ? ` ${heesin}도 보탬이 됩니다.` : ''}${gisinExposureLine ? ` ${gisinExposureLine}` : ''}`,
      `핵심은 ${yongshin} 기운을 키우는 것입니다.${heesin ? ` ${heesin}이 함께 받쳐줍니다.` : ''}${gisinExposureLine ? ` ${gisinExposureLine}` : ''}`,
    ], elementVariantIndex)
    : '도움/주의 기운 데이터가 아직 부족해요.';
  const easyOpportunity = easyOpportunityByState(strengthState, qualityLabel, yongshin);
  const easyRisk = easyRiskByState(
    relationBand,
    balanceBand,
    gisin,
    gisinCount,
    gisinElement,
    qualityLabel,
    interpretationVariant + relationTotal,
  );
  const operatingMode = easyOperatingMode(strengthState, qualityLabel);
  const easyActions = buildEasyActionItems(
    analysis,
    yearlyBundle,
    strengthState,
    qualityLabel,
    relationBand,
    balanceBand,
    yongshinElement,
    gisinElement,
    gisinCount,
    [lifeWealthAction, lifeCareerAction, lifeHealthAction, lifeLoveAction],
    interpretationVariant + relationTotal + balanceBand,
  );
  const yearlyTone = yearlyBundle != null
    ? easyYearTone(LUCK_QUALITY_INFO[yearlyBundle.fortune.quality].koreanName, interpretationVariant)
    : null;
  const yearlyOneLine = yearlyBundle != null
    ? buildYearlyOneLine(
      yearlyBundle.targetYear,
      qualityLabel,
      yearlyTone,
      yearlyBundle.fortune.overview,
      interpretationVariant,
    )
    : null;
  const lifetimeSnapshot = summarizeLifetimeLuck(analysis, currentDate.year);
  const currentTimingSnapshot = buildCurrentTimingSnapshot(analysis, currentYearBundle, currentDate);

  lines.push('■ 한눈에 보는 핵심 요약');
  lines.push('');
  lines.push('[핵심 브리핑]');
  lines.push(`- 핵심 결론: ${easyConclusion}`);
  lines.push(`- 현재 상태: ${easyStrength}`);
  lines.push(`- 강점 활용: ${easyOpportunity}`);
  lines.push(`- 주의 포인트: ${easyRisk}`);
  lines.push(`- 운영 모드: ${operatingMode}`);
  lines.push(`- 도움/주의 기운: ${easyElement}`);
  if (yearlyOneLine != null) {
    lines.push(`- 올해 전략: ${yearlyOneLine}`);
  }

  if (lifetimeSnapshot != null) {
    lines.push('');
    lines.push('[일생 흐름 요약]');
    lines.push(`- 전체 톤: ${lifetimeToneSummary(lifetimeSnapshot)}`);
    lines.push(
      `- 운 비율: 상승 ${lifetimeSnapshot.favorableCycles}/${lifetimeSnapshot.totalCycles}, ` +
      `중립 ${lifetimeSnapshot.neutralCycles}/${lifetimeSnapshot.totalCycles}, ` +
      `관리 ${lifetimeSnapshot.cautionCycles}/${lifetimeSnapshot.totalCycles}`,
    );
    if (lifetimeSnapshot.opportunityWindows.length > 0) {
      lines.push(`- 상승 활용 구간: ${lifetimeSnapshot.opportunityWindows.join(', ')}`);
    }
    if (lifetimeSnapshot.cautionWindows.length > 0) {
      lines.push(`- 안정 관리 구간: ${lifetimeSnapshot.cautionWindows.join(', ')}`);
    }
    if (lifetimeSnapshot.currentCycle != null) {
      const currentQuality = lifetimeSnapshot.currentCycleQuality != null
        ? ` [${lifetimeSnapshot.currentCycleQuality}]`
        : '';
      lines.push(`- 현재 대운(${currentDate.year}년 기준): ${lifetimeSnapshot.currentCycle}${currentQuality}`);
    }
  }

  if (currentTimingSnapshot != null) {
    lines.push('');
    lines.push('[현재 시점 운세]');
    lines.push(`- 현재 연도(${currentDate.year}년): ${currentTimingSnapshot.yearlySummary}`);
    lines.push(`- 현재 월(${currentDate.month}월): ${currentTimingSnapshot.monthlySummary}`);
    lines.push(`- 이번 달 운영 포인트: ${currentTimingSnapshot.monthlyAction}`);
    lines.push(`- 오늘 운세(${formatIsoDateLabel(currentDate)}): ${currentTimingSnapshot.todaySummary}`);
    lines.push(`- 오늘 행동 포인트: ${currentTimingSnapshot.todayAction}`);

    const popularFortuneLines = buildPopularFortuneHighlights(
      analysis,
      currentYearBundle?.fortune ?? null,
      {
        yearQualityLabel: currentTimingSnapshot.yearQualityLabel,
        monthQualityLabel: currentTimingSnapshot.monthQualityLabel,
        dayQualityLabel: currentTimingSnapshot.dayQualityLabel,
      },
    );
    if (popularFortuneLines.length > 0) {
      lines.push('');
      lines.push(...popularFortuneLines);
    }
  }
  lines.push('');
  lines.push('[맞춤 실행 플랜]');
  if (easyActions.length > 0) {
    for (let i = 0; i < easyActions.length; i += 1) {
      lines.push(`- 실행 ${i + 1}: ${easyActions[i]}`);
    }
  } else {
    lines.push('- 실행 1: 하루 루틴(수면·식사·운동)을 먼저 안정화하세요.');
  }
  lines.push('');
  lines.push('[용어 가이드]');
  lines.push('- 도움 기운=용신, 보조 기운=희신, 주의 기운=기신, 10년 큰 흐름=대운');
  lines.push('');
  lines.push('[판정 요약]');
  lines.push(
    `- 원국 4주: ${formatPillar(analysis.pillars.year)} / ${formatPillar(analysis.pillars.month)} / ` +
    `${formatPillar(analysis.pillars.day)} / ${formatPillar(analysis.pillars.hour)}`,
  );
  lines.push(`- 일간·강약(내 기본 힘): ${dm} / ${strength}`);
  lines.push(`- 격국(기본 성향 틀): ${gyeokguk}`);
  lines.push(`- 용신 정보(도움/보조/주의 기운): 용신 ${yongshin}${heesin ? `, 희신 ${heesin}` : ''}${gisin ? `, 기신 ${gisin}` : ''}`);
  if (yearlyBundle != null) {
    const qualityLabel = LUCK_QUALITY_INFO[yearlyBundle.fortune.quality].koreanName;
    lines.push(`- ${yearlyBundle.targetYear}년 포인트: ${qualityLabel} — ${compactLine(yearlyBundle.fortune.overview)}`);
  }

  lines.push('');
  lines.push('[핵심 근거]');
  if (analysis.strengthResult != null) {
    const score = analysis.strengthResult.score;
    const total = score.deukryeong + score.deukji + score.deukse;
    lines.push(
      `- 강약 근거(숫자): 득령 ${formatScore(score.deukryeong)} / ` +
      `득지 ${formatScore(score.deukji)} / 득세 ${formatScore(score.deukse)} ` +
      `(총 부조 ${formatScore(total)}, 억제 ${formatScore(score.totalOppose)})`,
    );
    lines.push(
      `- 강약 해석(쉬운 말): ` +
      `${analysis.strengthResult.isStrong ? '내 기운을 밀어주는 점수가 더 큰 편입니다.' : '내 기운을 누르는 점수가 더 큰 편입니다.'}`,
    );
  }
  if (analysis.gyeokgukResult != null) {
    lines.push(`- 격국 근거(왜 이런 틀이 나왔는지): ${simplifyForYouth(analysis.gyeokgukResult.reasoning)}`);
  }
  if (analysis.yongshinResult != null) {
    const methodSummary = analysis.yongshinResult.recommendations
      .slice(0, 3)
      .map(rec => {
        const confidencePct = rec.confidence <= 1 ? rec.confidence * 100 : rec.confidence;
        return `${YONGSHIN_TYPE_INFO[rec.type].koreanName}:${ohaengKorean(rec.primaryElement)}(${Math.round(confidencePct)}%)`;
      })
      .join(' / ');
    lines.push(`- 용신 근거(여러 방법 비교): ${methodSummary || '추천 데이터 없음'}`);
  }
  if (plainStrengthLine != null) lines.push(`- 성향 요지: ${plainStrengthLine}`);
  if (plainYongshinLine != null) lines.push(`- 용신 요지: ${plainYongshinLine}`);
  if (plainOverallLine != null) lines.push(`- 종합 요지: ${plainOverallLine}`);

  lines.push('');
  lines.push('[본문 핵심 캡처]');
  if (overviewHighlights.length > 0) {
    lines.push(`- 원국 요지: ${overviewHighlights.map(simplifyForYouth).join(' / ')}`);
  }
  if (ohaengHighlights.length > 0) {
    lines.push(`- 오행 요지: ${ohaengHighlights.map(simplifyForYouth).join(' / ')}`);
  }
  if (coreHighlights.length > 0) {
    lines.push(`- 성향·격국 요지: ${coreHighlights.map(simplifyForYouth).join(' / ')}`);
  }
  if (yongshinHighlights.length > 0) {
    lines.push(`- 용신·실천 요지: ${yongshinHighlights.map(simplifyForYouth).join(' / ')}`);
  }
  if (overallHighlights.length > 0) {
    lines.push(`- 종합 판단 요지: ${overallHighlights.map(simplifyForYouth).join(' / ')}`);
  }
  if (luckHighlights.length > 0) {
    lines.push(`- 대운·연운 요지: ${luckHighlights.map(simplifyForYouth).join(' / ')}`);
  }

  lines.push('');
  lines.push('[관계·신살 핵심]');
  lines.push(
    `- 천간 관계: ${analysis.scoredCheonganRelations.length}건` +
    (topCheonganNotes.length > 0 ? ` (대표: ${topCheonganNotes.join(', ')})` : ''),
  );
  lines.push(
    `- 지지 관계: ${analysis.resolvedJijiRelations.length}건` +
    (topJijiNotes.length > 0 ? ` (대표: ${topJijiNotes.join(', ')})` : ''),
  );
  lines.push(`- 오행 균형: ${buildOhaengBalanceSummary(analysis)}`);
  if (topShinsal.length > 0) {
    lines.push(`- 주목 신살: ${topShinsal.join(', ')}`);
  } else {
    lines.push('- 주목 신살: 상위 신살 데이터가 충분하지 않습니다.');
  }
  if (topComposites.length > 0) {
    lines.push(`- 신살 조합: ${topComposites.join(', ')}`);
  }
  if (plainFeaturesLead != null) {
    lines.push(`- 특수 요소 요지: ${plainFeaturesLead}`);
  }

  lines.push('');
  lines.push('[생활 영역 핵심]');
  lines.push(`- 재물운: ${combineLeadAndAction(lifeWealth, lifeWealthAction)}`);
  lines.push(`- 직업운: ${combineLeadAndAction(lifeCareer, lifeCareerAction)}`);
  lines.push(`- 건강운: ${combineLeadAndAction(lifeHealth, lifeHealthAction)}`);
  lines.push(`- 연애/결혼운: ${combineLeadAndAction(lifeLove, lifeLoveAction)}`);

  lines.push('');
  lines.push('[운의 흐름 핵심]');
  if (plainDaeunLead != null) {
    lines.push(`- 대운 요지: ${plainDaeunLead}`);
  } else if (analysis.daeunInfo != null) {
    const direction = analysis.daeunInfo.isForward ? '순행' : '역행';
    lines.push(`- 대운 요지: ${direction}, 첫 대운 시작 ${analysis.daeunInfo.firstDaeunStartAge}세`);
  } else {
    lines.push('- 대운 요지: 대운 정보가 없습니다.');
  }
  if (yearlyBundle != null) {
    const best = yearlyBundle.fortune.bestMonths.slice(0, 4).map(compactMonthLabel).join(', ') || '해당 없음';
    const caution = yearlyBundle.fortune.cautionMonths.slice(0, 4).map(compactMonthLabel).join(', ') || '해당 없음';
    lines.push(`- ${yearlyBundle.targetYear}년 운세 요지: ${simplifyForYouth(yearlyBundle.fortune.overview)}`);
    lines.push(`- ${yearlyBundle.targetYear}년 월별 전략: 기회월 ${best} / 주의월 ${caution}`);
  } else {
    lines.push('- 연운 요지: 대상 연도가 지정되지 않았습니다.');
  }

  lines.push('');
  lines.push('[실행 가이드 5가지]');
  lines.push(
    analysis.yongshinResult != null
      ? `1) 용신 ${yongshin} 관련 환경·활동을 일상에 고정 루틴으로 배치하세요.`
      : '1) 용신 미결정 상태이므로, 오행 과다/부족의 균형 회복부터 우선하세요.',
  );
  lines.push(
    analysis.strengthResult != null && !analysis.strengthResult.isStrong
      ? '2) 큰 의사결정은 분할 실행하고, 체력·재정·관계 안전망을 먼저 강화하세요.'
      : '2) 성과가 나는 시기에도 무리한 레버리지보다 품질·지속가능성을 우선하세요.',
  );
  lines.push('3) 재물·직업은 단기 성과보다 누적 가능한 구조(역량, 평판, 협업 네트워크)를 우선 구축하세요.');
  lines.push('4) 건강·관계 이슈는 사전 점검 루틴(수면, 체력, 소통 일정)을 고정해 변동성에 대비하세요.');
  if (yearlyBundle != null) {
    const best = yearlyBundle.fortune.bestMonths.slice(0, 3).map(compactMonthLabel).join(', ') || '해당 없음';
    const caution = yearlyBundle.fortune.cautionMonths.slice(0, 3).map(compactMonthLabel).join(', ') || '해당 없음';
    lines.push(`5) ${yearlyBundle.targetYear}년 실천: 기회월(${best})에 실행하고, 주의월(${caution})은 방어적으로 대응하세요.`);
  } else {
    lines.push('5) 연운 대상 연도를 지정하면 월별 실행·주의 타이밍까지 정밀하게 반영할 수 있습니다.');
  }

  return lines.join('\n').trimEnd();
}

function resolveCurrentDaeun(analysis: SajuAnalysis, year: number): DaeunPillar | null {
  if (analysis.daeunInfo == null) return null;
  return LuckNarrativeInterpreter.findCurrentDaeun(
    analysis.daeunInfo,
    year,
    analysis.input.birthYear,
  );
}

function findSaeunPillarForYear(analysis: SajuAnalysis, year: number): SaeunPillar {
  return analysis.saeunPillars.find(sp => sp.year === year) ?? SaeunCalculator.forYear(year);
}

function buildDetailedLuckNarrative(analysis: SajuAnalysis): string {
  const hasDaeun = analysis.daeunInfo != null && analysis.daeunInfo.daeunPillars.length > 0;
  const hasSaeun = analysis.saeunPillars.length > 0;
  if (!hasDaeun && !hasSaeun) return '';

  const lines: string[] = [];
  const dayMaster = analysis.pillars.day.cheongan;
  const yongshinElement = analysis.yongshinResult?.finalYongshin ?? null;
  const gisinElement = analysis.yongshinResult?.gisin ?? null;

  lines.push('■ 대운·세운 상세 해설');
  lines.push('');

  if (hasDaeun && analysis.daeunInfo != null) {
    lines.push('[대운 상세]');
    lines.push('');

    const daeunAnalyses = LuckInteractionAnalyzer.analyzeAllDaeun(
      analysis.daeunInfo,
      analysis.pillars,
      dayMaster,
      yongshinElement,
      gisinElement,
    );
    for (const daeunAnalysis of daeunAnalyses) {
      const narrative = LuckNarrativeInterpreter.interpretDaeun(
        daeunAnalysis,
        dayMaster,
        yongshinElement,
        gisinElement,
      );
      const qualityLabel = LUCK_QUALITY_INFO[narrative.quality].koreanName;
      lines.push(
        `- ${formatPillar(narrative.daeunPillar.pillar)} ` +
        `(${narrative.daeunPillar.startAge}~${narrative.daeunPillar.endAge}세) [${qualityLabel}]`,
      );
      lines.push(`  테마: ${narrative.sipseongTheme.themeName}`);
      lines.push(`  에너지: ${narrative.energyTheme.energyLevel}`);
      lines.push(`  해설: ${narrative.whySummary}`);
      if (narrative.relationImpacts.length > 0) {
        lines.push(`  관계 변화: ${narrative.relationImpacts.join(' / ')}`);
      }
      if (narrative.transitionWarning.length > 0) {
        lines.push(`  전환기: ${narrative.transitionWarning}`);
      }
      lines.push(`  조언: ${narrative.practicalGuidance}`);
      lines.push('');
    }
  }

  if (hasSaeun) {
    lines.push('[세운 상세]');
    lines.push('');

    for (const saeun of analysis.saeunPillars) {
      const currentDaeun = resolveCurrentDaeun(analysis, saeun.year);
      const saeunAnalysis = LuckInteractionAnalyzer.analyzeSaeun(
        [saeun],
        analysis.pillars,
        currentDaeun?.pillar ?? null,
        dayMaster,
        yongshinElement,
        gisinElement,
      )[0];
      if (saeunAnalysis == null) continue;

      const narrative = LuckNarrativeInterpreter.interpretSaeun(
        saeun,
        saeunAnalysis,
        currentDaeun,
        dayMaster,
        yongshinElement,
        gisinElement,
      );
      const qualityLabel = LUCK_QUALITY_INFO[narrative.quality].koreanName;
      lines.push(`- ${narrative.year}년 ${formatPillar(narrative.pillar)} [${qualityLabel}]`);
      lines.push(`  테마: ${narrative.sipseongTheme.themeName}`);
      lines.push(`  에너지: ${narrative.energyTheme.energyLevel}`);
      lines.push(`  대운 연계: ${narrative.combinedInterpretation}`);
      lines.push(`  해설: ${narrative.whySummary}`);
      lines.push(`  조언: ${narrative.practicalGuidance}`);
      lines.push('');
    }
  }

  return lines.join('\n').trimEnd();
}

function buildYearlyFortuneNarrative(
  yearlyBundle: YearlyFortuneBundle | null,
): string {
  return yearlyBundle?.narrative ?? '';
}

function buildYearlyFortuneBundle(
  analysis: SajuAnalysis,
  targetYear?: number,
): YearlyFortuneBundle | null {
  const resolvedTargetYear = targetYear ?? getKoreanDateParts().year;

  const dayMaster = analysis.pillars.day.cheongan;
  const yongshinElement = analysis.yongshinResult?.finalYongshin ?? null;
  const gisinElement = analysis.yongshinResult?.gisin ?? null;
  const saeun = findSaeunPillarForYear(analysis, resolvedTargetYear);
  const currentDaeun = resolveCurrentDaeun(analysis, resolvedTargetYear);
  const yearlyAnalysis = LuckInteractionAnalyzer.analyzeSaeun(
    [saeun],
    analysis.pillars,
    currentDaeun?.pillar ?? null,
    dayMaster,
    yongshinElement,
    gisinElement,
  )[0];
  if (yearlyAnalysis == null) return null;

  const monthlyAnalyses = SaeunCalculator.monthlyLuck(resolvedTargetYear).map(month => ({
    sajuMonthIndex: month.sajuMonthIndex,
    pillar: month.pillar,
    analysis: LuckInteractionAnalyzer.analyzeLuckPillar(
      month.pillar,
      analysis.pillars,
      dayMaster,
      yongshinElement,
      gisinElement,
    ),
  }));

  const yearlyFortune = buildYearlyFortune(
    analysis,
    resolvedTargetYear,
    saeun.pillar,
    yearlyAnalysis,
    monthlyAnalyses,
  );
  return {
    targetYear: resolvedTargetYear,
    fortune: yearlyFortune,
    narrative: yearlyFortuneToNarrative(yearlyFortune),
  };
}

export function generate(
  analysis: SajuAnalysis,
  config: CalculationConfig = DEFAULT_CONFIG,
  targetYear?: number,
): SajuNarrative {
  const currentDate = getKoreanDateParts();
  const resolvedTargetYear = targetYear ?? currentDate.year;
  const yearlyBundle = buildYearlyFortuneBundle(analysis, resolvedTargetYear);
  const currentYearBundle = yearlyBundle != null && yearlyBundle.targetYear === currentDate.year
    ? yearlyBundle
    : buildYearlyFortuneBundle(analysis, currentDate.year);
  const schoolLabel = schoolLabelFor(config);
  const overview = buildOverview(analysis, config);
  const ohaengDistribution = buildOhaengDistribution(analysis);
  const coreCharacteristics = buildCoreCharacteristics(analysis, config);
  const yongshinGuidance = buildYongshinGuidance(analysis, config);
  const pillarInterpretations = buildPillarInterpretations(analysis, config);
  const lifeDomainAnalysis = buildLifeDomainAnalysis(analysis);
  const specialFeatures = buildSpecialFeatures(analysis, config);
  const overallAssessment = buildOverallAssessment(analysis);
  const luckCycleOverview = buildLuckCycleOverview(analysis);
  const detailedLuckNarrative = buildDetailedLuckNarrative(analysis);
  const yearlyFortuneNarrative = buildYearlyFortuneNarrative(yearlyBundle);
  const calculationReasoning = buildCalculationReasoning(analysis);
  const traceOverview = buildTraceOverview(analysis);
  const sourceBibliography = buildSourceBibliography(analysis);
  const readableSummary = buildServiceReadableSummary(analysis, yearlyBundle, currentYearBundle, currentDate, {
    overview,
    ohaengDistribution,
    coreCharacteristics,
    yongshinGuidance,
    lifeDomainAnalysis,
    specialFeatures,
    overallAssessment,
    luckCycleOverview,
  });

  return {
    readableSummary,
    schoolLabel,
    overview,
    ohaengDistribution,
    coreCharacteristics,
    yongshinGuidance,
    pillarInterpretations,
    lifeDomainAnalysis,
    specialFeatures,
    overallAssessment,
    luckCycleOverview,
    detailedLuckNarrative,
    yearlyFortuneNarrative,
    calculationReasoning,
    traceOverview,
    sourceBibliography,
  };
}

export const NarrativeEngine = {
  generate,
  narrativeToFullReport,
} as const;
