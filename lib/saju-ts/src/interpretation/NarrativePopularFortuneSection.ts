import { Gender } from '../domain/Gender.js';
import { type SajuAnalysis } from '../domain/SajuAnalysis.js';
import { ShinsalType } from '../domain/Shinsal.js';
import { Sipseong } from '../domain/Sipseong.js';
import {
  CheonganRelationType,
  JijiRelationType,
} from '../domain/Relations.js';
import type { YearlyFortune } from './YearlyFortuneInterpreter.js';

type FortuneLevel = '상승' | '양호' | '보통' | '주의';

export interface PopularFortuneScope {
  readonly yearQualityLabel: string | null;
  readonly monthQualityLabel: string | null;
  readonly dayQualityLabel: string | null;
}

interface FortuneLine {
  readonly label: string;
  readonly level: FortuneLevel;
  readonly summary: string;
  readonly action: string;
}

const WEALTH_STARS = new Set<Sipseong>([Sipseong.PYEON_JAE, Sipseong.JEONG_JAE]);
const OFFICIAL_STARS = new Set<Sipseong>([Sipseong.PYEON_GWAN, Sipseong.JEONG_GWAN]);
const EXPRESSION_STARS = new Set<Sipseong>([Sipseong.SIK_SIN, Sipseong.SANG_GWAN]);
const STUDY_STARS = new Set<Sipseong>([Sipseong.PYEON_IN, Sipseong.JEONG_IN]);
const PEOPLE_STARS = new Set<Sipseong>([Sipseong.BI_GYEON, Sipseong.GYEOB_JAE]);

const MONEY_BOOST_SHINSAL = new Set<ShinsalType>([
  ShinsalType.AMNOK,
  ShinsalType.GEUMYEO,
  ShinsalType.CHEONBOK_GWIIN,
  ShinsalType.CHEONJU_GWIIN,
]);
const MONEY_RISK_SHINSAL = new Set<ShinsalType>([
  ShinsalType.GEOPSAL,
  ShinsalType.GWANBUSAL,
  ShinsalType.YUKHAESAL,
]);
const CAREER_BOOST_SHINSAL = new Set<ShinsalType>([
  ShinsalType.JANGSEONG,
  ShinsalType.CHEONGWAN_GWIIN,
  ShinsalType.BOKSEONG_GWIIN,
  ShinsalType.GUGIN_GWIIN,
  ShinsalType.BANANSAL,
]);
const LOVE_BOOST_SHINSAL = new Set<ShinsalType>([
  ShinsalType.DOHWA,
  ShinsalType.HONGYEOM,
  ShinsalType.GEUMYEO,
]);
const LOVE_RISK_SHINSAL = new Set<ShinsalType>([
  ShinsalType.GOSIN,
  ShinsalType.GWASUK,
  ShinsalType.GORANSAL,
  ShinsalType.WONJIN,
]);
const STUDY_BOOST_SHINSAL = new Set<ShinsalType>([
  ShinsalType.MUNCHANG,
  ShinsalType.HAKDANG,
  ShinsalType.MUNGOK_GWIIN,
]);
const GWIIN_SHINSAL = new Set<ShinsalType>([
  ShinsalType.CHEONUL_GWIIN,
  ShinsalType.TAEGUK_GWIIN,
  ShinsalType.CHEONDEOK_GWIIN,
  ShinsalType.WOLDEOK_GWIIN,
  ShinsalType.CHEONDEOK_HAP,
  ShinsalType.WOLDEOK_HAP,
  ShinsalType.BOKSEONG_GWIIN,
]);
const MOVE_BOOST_SHINSAL = new Set<ShinsalType>([ShinsalType.YEOKMA]);
const MOVE_RISK_SHINSAL = new Set<ShinsalType>([
  ShinsalType.CHEONSAL,
  ShinsalType.JAESAL,
  ShinsalType.JISAL,
]);
const CONTRACT_RISK_SHINSAL = new Set<ShinsalType>([
  ShinsalType.GWANBUSAL,
  ShinsalType.YUKHAESAL,
  ShinsalType.GEOPSAL,
  ShinsalType.MANGSINSAL,
]);
const HEALTH_RISK_SHINSAL = new Set<ShinsalType>([
  ShinsalType.BAEKHO,
  ShinsalType.HYEOLINSAL,
  ShinsalType.JAESAL,
]);
const HEALTH_BOOST_SHINSAL = new Set<ShinsalType>([
  ShinsalType.CHEONUI,
]);
const CHANGE_BOOST_SHINSAL = new Set<ShinsalType>([
  ShinsalType.YEOKMA,
  ShinsalType.JANGSEONG,
  ShinsalType.BANANSAL,
]);
const HOME_BOOST_SHINSAL = new Set<ShinsalType>([
  ShinsalType.GEUMYEO,
  ShinsalType.CHEONDEOK_HAP,
  ShinsalType.WOLDEOK_HAP,
  ShinsalType.BOKSEONG_GWIIN,
]);
const FAMILY_RISK_SHINSAL = new Set<ShinsalType>([
  ShinsalType.GOSIN,
  ShinsalType.GWASUK,
  ShinsalType.GORANSAL,
  ShinsalType.WONJIN,
]);
const CHILD_BOOST_SHINSAL = new Set<ShinsalType>([
  ShinsalType.MUNCHANG,
  ShinsalType.HAKDANG,
  ShinsalType.CHEONBOK_GWIIN,
  ShinsalType.CHEONJU_GWIIN,
]);
const DISPUTE_RISK_SHINSAL = new Set<ShinsalType>([
  ShinsalType.GWANBUSAL,
  ShinsalType.YUKHAESAL,
  ShinsalType.MANGSINSAL,
  ShinsalType.GEOPSAL,
  ShinsalType.JAESAL,
]);

function qualityLabelScore(label: string | null): number {
  if (label === '대길') return 2;
  if (label === '길') return 1;
  if (label === '흉') return -1;
  if (label === '대흉') return -2;
  return 0;
}

function levelFromScore(score: number): FortuneLevel {
  if (score >= 1.1) return '상승';
  if (score >= 0.3) return '양호';
  if (score >= -0.5) return '보통';
  return '주의';
}

function weightedShinsalHits(analysis: SajuAnalysis, types: ReadonlySet<ShinsalType>): number {
  return analysis.weightedShinsalHits.filter(hit => types.has(hit.hit.type)).length;
}

function yearlySipseongIn(yearlyFortune: YearlyFortune | null, stars: ReadonlySet<Sipseong>): boolean {
  return yearlyFortune != null && stars.has(yearlyFortune.sipseong);
}

function tenGodStarCount(analysis: SajuAnalysis, stars: ReadonlySet<Sipseong>): number {
  const tenGod = analysis.tenGodAnalysis;
  if (tenGod == null) return 0;
  let count = 0;
  for (const positionData of Object.values(tenGod.byPosition)) {
    if (positionData == null) continue;
    if (stars.has(positionData.cheonganSipseong)) count += 1;
    if (stars.has(positionData.jijiPrincipalSipseong)) count += 1;
  }
  return count;
}

function spouseStarCount(analysis: SajuAnalysis): number {
  const spouseStars = analysis.input.gender === Gender.MALE ? WEALTH_STARS : OFFICIAL_STARS;
  return tenGodStarCount(analysis, spouseStars);
}

function relationBalanceScore(analysis: SajuAnalysis): number {
  const goodStem = analysis.scoredCheonganRelations.filter(item => item.hit.type === CheonganRelationType.HAP).length;
  const badStem = analysis.scoredCheonganRelations.filter(item => item.hit.type === CheonganRelationType.CHUNG).length;
  const goodBranch = analysis.resolvedJijiRelations.filter(item =>
    item.hit.type === JijiRelationType.YUKHAP ||
    item.hit.type === JijiRelationType.SAMHAP ||
    item.hit.type === JijiRelationType.BANGHAP ||
    item.hit.type === JijiRelationType.BANHAP,
  ).length;
  const badBranch = analysis.resolvedJijiRelations.filter(item =>
    item.hit.type === JijiRelationType.CHUNG ||
    item.hit.type === JijiRelationType.HYEONG ||
    item.hit.type === JijiRelationType.PA ||
    item.hit.type === JijiRelationType.HAE ||
    item.hit.type === JijiRelationType.WONJIN,
  ).length;

  const delta = (goodStem + goodBranch) - (badStem + badBranch);
  if (delta >= 3) return 0.6;
  if (delta >= 1) return 0.3;
  if (delta <= -3) return -0.6;
  if (delta <= -1) return -0.3;
  return 0;
}

function combinedTemporalScore(scope: PopularFortuneScope): number {
  const year = qualityLabelScore(scope.yearQualityLabel);
  const month = qualityLabelScore(scope.monthQualityLabel);
  const day = qualityLabelScore(scope.dayQualityLabel);
  return (year * 0.45) + (month * 0.35) + (day * 0.2);
}

function makeLine(
  label: string,
  score: number,
  highSummary: string,
  cautionSummary: string,
  neutralSummary: string,
  highAction: string,
  cautionAction: string,
  neutralAction: string,
): FortuneLine {
  const level = levelFromScore(score);
  if (level === '상승' || level === '양호') {
    return { label, level, summary: highSummary, action: highAction };
  }
  if (level === '주의') {
    return { label, level, summary: cautionSummary, action: cautionAction };
  }
  return { label, level, summary: neutralSummary, action: neutralAction };
}

function toLineText(item: FortuneLine): string {
  return `- ${item.label}: [${item.level}] ${item.summary} / 실행: ${item.action}`;
}

export function buildPopularFortuneHighlights(
  analysis: SajuAnalysis,
  yearlyFortune: YearlyFortune | null,
  scope: PopularFortuneScope,
): string[] {
  const temporal = combinedTemporalScore(scope);
  const relationScore = relationBalanceScore(analysis);
  const isStrong = analysis.strengthResult?.isStrong ?? true;
  const spouseCount = spouseStarCount(analysis);
  const wealthStarCount = tenGodStarCount(analysis, WEALTH_STARS);
  const officialStarCount = tenGodStarCount(analysis, OFFICIAL_STARS);
  const expressionStarCount = tenGodStarCount(analysis, EXPRESSION_STARS);
  const studyStarCount = tenGodStarCount(analysis, STUDY_STARS);
  const peopleStarCount = tenGodStarCount(analysis, PEOPLE_STARS);

  const moneyBoost = weightedShinsalHits(analysis, MONEY_BOOST_SHINSAL);
  const moneyRisk = weightedShinsalHits(analysis, MONEY_RISK_SHINSAL);
  const careerBoost = weightedShinsalHits(analysis, CAREER_BOOST_SHINSAL);
  const loveBoost = weightedShinsalHits(analysis, LOVE_BOOST_SHINSAL);
  const loveRisk = weightedShinsalHits(analysis, LOVE_RISK_SHINSAL);
  const studyBoost = weightedShinsalHits(analysis, STUDY_BOOST_SHINSAL);
  const gwiinBoost = weightedShinsalHits(analysis, GWIIN_SHINSAL);
  const moveBoost = weightedShinsalHits(analysis, MOVE_BOOST_SHINSAL);
  const moveRisk = weightedShinsalHits(analysis, MOVE_RISK_SHINSAL);
  const contractRisk = weightedShinsalHits(analysis, CONTRACT_RISK_SHINSAL);
  const healthRisk = weightedShinsalHits(analysis, HEALTH_RISK_SHINSAL);
  const healthBoost = weightedShinsalHits(analysis, HEALTH_BOOST_SHINSAL);
  const changeBoost = weightedShinsalHits(analysis, CHANGE_BOOST_SHINSAL);
  const homeBoost = weightedShinsalHits(analysis, HOME_BOOST_SHINSAL);
  const familyRisk = weightedShinsalHits(analysis, FAMILY_RISK_SHINSAL);
  const childBoost = weightedShinsalHits(analysis, CHILD_BOOST_SHINSAL);
  const disputeRisk = weightedShinsalHits(analysis, DISPUTE_RISK_SHINSAL);

  const hasWealthYear = yearlySipseongIn(yearlyFortune, WEALTH_STARS) || yearlySipseongIn(yearlyFortune, EXPRESSION_STARS);
  const hasCareerYear = yearlySipseongIn(yearlyFortune, OFFICIAL_STARS);
  const hasStudyYear = yearlySipseongIn(yearlyFortune, STUDY_STARS);
  const hasPeopleYear = yearlySipseongIn(yearlyFortune, PEOPLE_STARS);
  const hasSpouseYear = analysis.input.gender === Gender.MALE
    ? yearlySipseongIn(yearlyFortune, WEALTH_STARS)
    : yearlySipseongIn(yearlyFortune, OFFICIAL_STARS);
  const hasBusinessYear = yearlyFortune?.sipseong === Sipseong.PYEON_JAE || yearlyFortune?.sipseong === Sipseong.SANG_GWAN;
  const hasChangeYear = yearlyFortune?.sipseong === Sipseong.SANG_GWAN
    || yearlyFortune?.sipseong === Sipseong.GYEOB_JAE
    || yearlyFortune?.sipseong === Sipseong.PYEON_JAE;
  const hasChildYear = yearlySipseongIn(yearlyFortune, EXPRESSION_STARS);

  const totalScore = temporal
    + (relationScore * 0.55)
    + (gwiinBoost * 0.15)
    + (healthBoost > healthRisk ? 0.2 : -0.15)
    + (moneyRisk > 0 ? -0.15 : 0.1);
  const moneyScore = temporal
    + (hasWealthYear ? 0.6 : 0)
    + (wealthStarCount >= 2 ? 0.3 : wealthStarCount === 1 ? 0.1 : -0.1)
    + (moneyBoost * 0.2)
    - (moneyRisk * 0.45)
    + (!isStrong ? -0.2 : 0.1);
  const careerScore = temporal
    + (hasCareerYear ? 0.7 : 0)
    + (officialStarCount >= 2 ? 0.25 : officialStarCount === 0 ? -0.15 : 0)
    + (careerBoost * 0.2)
    + (relationScore * 0.5);
  const businessScore = temporal + (hasBusinessYear ? 0.8 : 0) + (moneyBoost * 0.15) - (moneyRisk * 0.4) + (isStrong ? 0.2 : -0.3);
  const loveScore = temporal + (hasSpouseYear ? 0.4 : 0) + (loveBoost * 0.2) - (loveRisk * 0.35) + (relationScore * 0.4);
  const marriageScore = temporal + (spouseCount > 0 ? 0.4 : -0.2) + (spouseCount >= 3 ? -0.3 : 0) + (loveBoost * 0.15) - (loveRisk * 0.3);
  const familyScore = temporal
    + (relationScore * 0.7)
    + (spouseCount > 0 ? 0.25 : -0.1)
    + (homeBoost * 0.2)
    - (familyRisk * 0.35)
    - (moveRisk * 0.1);
  const childrenScore = temporal
    + (hasChildYear ? 0.5 : 0)
    + (expressionStarCount >= 2 ? 0.35 : expressionStarCount === 0 ? -0.15 : 0.1)
    + (childBoost * 0.2)
    - (familyRisk * 0.2);
  const studyScore = temporal
    + (hasStudyYear ? 0.7 : 0)
    + (studyStarCount >= 2 ? 0.25 : studyStarCount === 0 ? -0.1 : 0)
    + (studyBoost * 0.25);
  const relationshipScore = temporal
    + (hasPeopleYear ? 0.3 : 0)
    + (peopleStarCount >= 2 ? 0.2 : peopleStarCount === 0 ? -0.1 : 0)
    + relationScore
    + (loveRisk > 0 ? -0.2 : 0.1);
  const gwiinScore = temporal + (gwiinBoost * 0.35) + (analysis.weightedShinsalHits.length > 0 ? 0.1 : 0);
  const changeScore = temporal
    + (hasChangeYear ? 0.5 : 0)
    + (changeBoost * 0.25)
    + (careerBoost * 0.12)
    - (moveRisk * 0.25)
    - (contractRisk * 0.1);
  const moveScore = temporal + (moveBoost * 0.4) - (moveRisk * 0.3);
  const contractScore = temporal - (contractRisk * 0.5) + (relationScore * 0.3);
  const disputeScore = temporal
    - (disputeRisk * 0.5)
    + (relationScore * 0.45)
    + (contractRisk === 0 ? 0.1 : -0.05);
  const healthScore = temporal - (healthRisk * 0.45) + (healthBoost * 0.2);

  const lines: FortuneLine[] = [
    makeLine(
      '총운',
      totalScore,
      '전체 흐름이 우상향으로 연결되기 쉬운 시점입니다.',
      '변동성이 커서 일정·관계·자금의 기본기를 먼저 지켜야 하는 시점입니다.',
      '큰 무리 없이 유지할 수 있는 흐름이며, 운영 품질이 결과를 좌우합니다.',
      '우선순위 3가지를 고정하고 강점이 있는 과제에 집중해 속도를 내세요.',
      '새로운 확장보다 손실 방지와 루틴 복구를 먼저 완료하세요.',
      '성과보다 안정성을 먼저 확보하면 다음 기회가 자연스럽게 이어집니다.',
    ),
    makeLine(
      '재물운',
      moneyScore,
      '수익화와 자산 정리의 효율이 살아나는 흐름입니다.',
      '지출·투자·대여 관리가 핵심인 구간입니다.',
      '크게 벌리기보다 현금흐름을 안정화하면 실속이 납니다.',
      '고정지출 구조를 먼저 정리하고 기회 시기에 실행 비중을 높이세요.',
      '고위험 투자·지인 금전거래는 문서화 후 제한적으로 진행하세요.',
      '예산 상한선을 먼저 정하고 지출 결정을 늦추는 방식이 유리합니다.',
    ),
    makeLine(
      '직장/커리어운',
      careerScore,
      '역할 확장과 성과 가시화에 유리한 흐름입니다.',
      '평판 관리와 일정 품질 관리가 우선입니다.',
      '기존 역할을 안정적으로 완수하면 다음 기회로 연결됩니다.',
      '핵심 과제 1~2개를 대표성과로 묶어 제시하세요.',
      '신규 확장보다 실수 예방 체크리스트를 우선 적용하세요.',
      '상급자·동료와 기대치를 먼저 맞추고 작업을 시작하세요.',
    ),
    makeLine(
      '사업/투자운',
      businessScore,
      '실행력이 붙는 구간이라 검증된 아이템 확장에 유리합니다.',
      '확장보다 손실 제한 규칙을 먼저 세워야 하는 흐름입니다.',
      '작은 단위 테스트를 반복하면 리스크를 줄이면서 성장할 수 있습니다.',
      '신규 시도는 실험 단위를 작게 잡고 데이터 기준으로 확대하세요.',
      '레버리지·선투자 비중을 줄이고 현금성 안전판을 확보하세요.',
      '의사결정 기준(손절/철수 조건)을 사전에 문서화하세요.',
    ),
    makeLine(
      '연애운',
      loveScore,
      '인연 접점이 늘고 관계 진전이 쉬운 흐름입니다.',
      '감정 기복·오해 관리가 중요한 구간입니다.',
      '서두르지 않으면 안정적인 관계를 만들 수 있습니다.',
      '관심 표현은 분명히 하되 속도는 상대 리듬에 맞추세요.',
      '반응이 올라온 날일수록 결론을 서두르지 말고 하루 텀을 두세요.',
      '관계 기대치를 초반에 명확히 맞추면 피로를 줄일 수 있습니다.',
    ),
    makeLine(
      '결혼/가정운',
      marriageScore,
      '가정 안정과 장기 관계 설계에 유리한 흐름입니다.',
      '역할 분담·생활 리듬 조정이 필요한 구간입니다.',
      '대화 구조를 정리하면 갈등을 예방하기 좋습니다.',
      '가정 의사결정은 일정·지출·역할을 함께 합의해 추진하세요.',
      '중요한 가정 결정을 한 번에 확정하지 말고 단계적으로 합의하세요.',
      '주 1회 생활 점검 대화를 고정해 작은 불편을 미리 정리하세요.',
    ),
    makeLine(
      '가족/주거운',
      familyScore,
      '가족 협력과 주거 안정화를 함께 잡기 좋은 흐름입니다.',
      '가족 갈등과 생활 동선 충돌을 줄이는 조율이 필요한 구간입니다.',
      '생활 규칙과 역할 분담을 정리하면 안정감을 높일 수 있습니다.',
      '가사·지출·이동 동선을 가볍게 표준화해 반복 마찰을 줄이세요.',
      '감정 대화 전에 사실·일정·지출부터 맞추는 순서로 대화하세요.',
      '작은 합의(생활시간·분담표)부터 맞추면 큰 갈등을 예방할 수 있습니다.',
    ),
    makeLine(
      '자녀/후배운',
      childrenScore,
      '돌봄·코칭·멘토링이 성과로 이어지기 쉬운 흐름입니다.',
      '훈육·기대치 충돌이 커질 수 있어 기준 정렬이 필요한 구간입니다.',
      '과정 중심 피드백을 유지하면 성장 흐름을 안정적으로 만들 수 있습니다.',
      '결과보다 습관·과정 칭찬 비중을 높이면 관계와 성과가 함께 좋아집니다.',
      '규칙은 짧고 일관되게 유지하고, 감정 높은 순간의 판단은 미루세요.',
      '목표를 작게 쪼개고 주간 점검 루틴을 고정해 꾸준히 누적하세요.',
    ),
    makeLine(
      '학업/시험운',
      studyScore,
      '집중력과 이해력이 올라 학습 효율이 좋습니다.',
      '분산 학습보다 오답 정리·기초 보강이 우선입니다.',
      '루틴 기반 학습이 성과로 이어지는 흐름입니다.',
      '단기 몰입 + 복습 주기 고정으로 점수를 끌어올리세요.',
      '범위를 줄이고 빈출 영역 반복으로 안정 점수를 확보하세요.',
      '학습 시간을 짧게 자주 배치해 누적 효과를 만드세요.',
    ),
    makeLine(
      '대인관계운',
      relationshipScore,
      '협업·네트워킹에서 도움을 얻기 쉬운 흐름입니다.',
      '관계 충돌을 예방하는 소통 관리가 필요합니다.',
      '핵심 인맥을 정리해 관리하면 안정적으로 유지됩니다.',
      '핵심 이해관계자와의 소통 주기를 고정해 신뢰를 쌓으세요.',
      '문장 톤을 낮추고 합의 내용을 기록으로 남겨 오해를 줄이세요.',
      '요청·피드백·합의 3단계를 분리해 전달하면 충돌이 줄어듭니다.',
    ),
    makeLine(
      '귀인운',
      gwiinScore,
      '주변 도움을 실제 기회로 연결하기 쉬운 흐름입니다.',
      '혼자 해결하려는 경향을 줄여야 운을 살릴 수 있습니다.',
      '작은 협력도 성과로 이어질 수 있는 보통 이상의 흐름입니다.',
      '도움 요청 범위를 구체적으로 제시해 협업 성공률을 높이세요.',
      '지원 제안이 와도 조건·역할을 먼저 명확히 정리하세요.',
      '고마운 관계를 정기적으로 관리하면 기회가 이어집니다.',
    ),
    makeLine(
      '이직/변화운',
      changeScore,
      '직무 전환·포지션 변경을 설계하기에 유리한 흐름입니다.',
      '성급한 변경은 비용이 커질 수 있어 단계 전환이 필요한 구간입니다.',
      '현 포지션을 지키면서 탐색 범위를 넓히면 안정적으로 전환할 수 있습니다.',
      '현재 역할 성과를 지키면서 병행 탐색(프로젝트·면담·학습)을 운영하세요.',
      '사직·전환 결정을 한 번에 하지 말고 조건 검증 단계를 나누세요.',
      '작은 역할 변경부터 시험해 적합도를 확인한 뒤 확장하세요.',
    ),
    makeLine(
      '이동/여행운',
      moveScore,
      '이동·변화에서 새로운 기회를 찾기 쉬운 흐름입니다.',
      '이동 중 변수 관리와 안전 점검이 필요한 구간입니다.',
      '필요한 이동은 가능하지만 일정 완충 시간을 두는 편이 좋습니다.',
      '출장·여행 일정은 핵심 목적 1~2개 중심으로 간결하게 운영하세요.',
      '교통·장비·건강 체크를 사전에 완료하고 무리한 이동을 줄이세요.',
      '연결 이동보다 단일 목적 이동으로 피로를 관리하세요.',
    ),
    makeLine(
      '문서/계약운',
      contractScore,
      '문서화와 조건 협상에서 주도권을 잡기 쉬운 흐름입니다.',
      '계약·서류 오류가 손실로 이어지기 쉬운 구간입니다.',
      '기본 검토 절차를 지키면 안정적으로 진행할 수 있습니다.',
      '핵심 조항(금액·일정·책임) 3가지를 먼저 고정하세요.',
      '서명 전 재확인과 제3자 검토를 필수 절차로 두세요.',
      '구두 합의도 문서로 남겨 분쟁 가능성을 낮추세요.',
    ),
    makeLine(
      '법률/분쟁운',
      disputeScore,
      '원칙과 근거를 갖추면 협상·조정에서 유리한 흐름입니다.',
      '사소한 충돌이 커질 수 있어 기록·증빙 중심 대응이 필요한 구간입니다.',
      '초기 조율을 잘하면 큰 분쟁으로 번지지 않게 관리할 수 있습니다.',
      '쟁점·근거·요청안을 한 장으로 정리해 대화의 기준을 선점하세요.',
      '감정 반응보다 사실 기록·증빙 확보를 먼저 진행하세요.',
      '이슈가 커지기 전에 기한·책임·절차를 명확히 합의하세요.',
    ),
    makeLine(
      '건강운',
      healthScore,
      '컨디션 회복과 생활 리듬 재정비에 유리한 흐름입니다.',
      '과로·수면 불균형 관리가 핵심인 구간입니다.',
      '무리하지 않는 루틴 운영으로 안정권을 유지할 수 있습니다.',
      '운동 강도보다 수면·식사·회복 주기부터 고정하세요.',
      '피로 신호가 누적되기 전에 검진·휴식을 선제적으로 배치하세요.',
      '일정 사이에 회복 블록을 넣어 기복을 줄이세요.',
    ),
  ];

  const yearLabel = scope.yearQualityLabel ?? '미산출';
  const monthLabel = scope.monthQualityLabel ?? '미산출';
  const dayLabel = scope.dayQualityLabel ?? '미산출';

  return [
    '[관심사별 운세]',
    `- 시점 기준: 올해 ${yearLabel} / 이번달 ${monthLabel} / 오늘 ${dayLabel}`,
    ...lines.map(toLineText),
  ];
}
