/**
 * standard-depth-enhancer.ts -- public-reader standard tier enrichment.
 *
 * The authored fragment remains the source of the cell-specific claim. This
 * layer adds deterministic, tag-free reader guidance so the standard tier is
 * easier to read on mobile without mixing in expert terminology.
 */

import type {
  ParagraphToken,
  StarRating,
  StandardFortuneText,
  TaggedParagraph,
  TieredCategoryId,
  TieredPeriodKind,
  TieredFortune,
} from '../types.js';
import type { FeatureVector } from './feature-selector.js';
import { normalizeRenderedText } from './template-engine.js';

const MIN_PUBLIC_PARAGRAPHS = 6;
const MIN_SENTENCES_PER_PUBLIC_PARAGRAPH = 2;
const MAX_PUBLIC_PARAGRAPH_CHARS = 240;
const MAX_PUBLIC_FIRST_PARAGRAPH_SENTENCES = 3;
const SCORE_PACING_PATTERN = /직업 방향이 좋게 보일 때|직업 방향이 좋게 느껴질 때|직업 방향이 무난하게 보일 때|직업 방향이 보통으로 보인다는 말|직업 방향이 낮게 보일 때|진로 감각이 낮게 보일 때|이어 갈 이해|이어 갈 질문|오래 두고 볼 기준|점수가 좋게 보일 때|좋은 흐름이 보이면|마음을 크게 밀어붙이기보다|지금 서로 편한 장면|결론을 서두르지 말고 말투|관계가 애매하다는 뜻|편했던 순간 하나|말의 속도를 늦추라는 표시|안부 한마디나 고마움|서로 예민한 장면|작은 배려가 관계의 안정감|좋게 보이는 흐름|보통으로 보이는 흐름|낮게 보이는 흐름|흐름이 좋게 보일 때|흐름이 좋게 보이더라도|흐름이 보통으로 보일 때|흐름이 보통으로 보인다는 말|흐름이 보통으로 보인다면|흐름이 낮게 보일 때|흐름이 낮게 보이더라도|흐름이 낮게 보이면|결과보다 관찰|점수보다 더 분명한 체감|무난하게 보인다는 말|무난한 흐름일수록|무난하게 보이는 변화|작은 확인을 붙일수록 도움이|보통 점수는|일이 중간처럼 느껴질 때|흐름이 무난할수록|다시 정렬할 여지|아주 강한 흐름|아주 강한 신호|보통으로 보이는 흐름|좋은 분위기일수록|편한 말투 하나|좋은 신호가 보일수록|지금 편한 방식|분위기가 괜찮게 느껴질 때|좋은 흐름은 더 많이 벌리는 신호라기보다|가장 효과가 좋았던 한 가지|자신감을 생활의 리듬으로|낮게 보이는 흐름은|낮은 흐름은 멈추라는 말|조심스럽게 보일 때는 결과를 걱정하기보다|새 결정을 서두르지 말고|낮은 점수는 겁을 주려는 신호|낮은 흐름은 속도를|낮은 흐름은 쉬어|먼저 들을 시간과 쉬어 갈 시간|분위기가 무겁게 느껴질 때|작게 말하고 충분히 쉬면|마음이 잘 맞지 않는 날|결론보다 회복|몸이 보내는 작은 신호|무리한 약속을 줄이고|컨디션 신호가 약하게|보통으로 보이는 흐름은 마음이 식었다는 뜻|반복되는 말투와 시간을|관계가 중간처럼 느껴질 때|좋은 흐름은 더 많이 밀어붙이라는 신호|점수가 높게 느껴질 때|점수가 높게 느껴지는 때|좋은 기세가 있을수록|좋은 기세가 보이면|이미 이해한 내용을 자기 말로|몸이 보내는 신호를 먼저 알아차리는|쉬는 시간을 먼저 잡아|컨디션이 약하게 느껴질 때|대화의 크기를 줄이는|서로 덜 날카로울 시간|모든 이유를 한 번에 풀려고|모든 이유를 그 자리에서 다 풀지 않아도|대화를 쉬어 갈 시간|지금 잘 통했던 방식|상대를 더 밀어붙이기보다|기본을 더 가볍게|익숙한 신뢰|상대의 마음을 단정하기보다|말의 양보다 말의 온도|좋은 흐름은 공부량|좋은 흐름은 배움의 양|성공한 방식을 기록|기초를 가볍게 반복|다시 쓸 수 있는 방법|다음 배움|배움의 출발점|배움이 끊긴 것은 아니에요|배움을 포기하라는 말|계속할 수 있는 크기|이어 갈 크기|흐름이 안정돼요|배운 내용을 생활 속 말|무난하게 보일 때|무난하게 보일 때는 노트를|생활 리듬을 확인|몸을 더 몰아붙이라는 뜻|회복 기준을 또렷하게|몸은 작은 반복에 반응|더 가까워져야만|말의 양보다 반복되는 태도|서로를 다시 맞춰 볼 시간|상대가 편했던 순간|관계가 멈췄다는 뜻|덜 날카롭게 말할|내가 반복하는 반응|관계를 방치하라는 뜻|이동이 막혔다는 뜻|먼 곳보다 익숙한 기준|아무것도 하지 말라는 뜻|새 장소보다 돌아올 시간|지금 자리에서 정리할 일을 먼저|멀리 움직이는 결정을|이동의 흐름이 약하게|가까운 곳의 작은 조정|새 일정은 작게 시험|무거운 이동은 몸과 마음|가장 안전하게 시험할 수 있는 작은 이동|관계를 포기하라는 뜻|대화를 작게 나누라는 신호|말의 순서가 생기면|가까운 사람이 멀어진다는 단정|큰 약속보다 작은 예의|반복되는 말투|서로의 속도를 낮추는|서운함이 커질|먼저 확인할 말|덜 부담스러워할 시간|덜 날카로운 말 하나|다시 시작할 크기를 줄여|공부를 포기하라는 말|쉬운 단계를 먼저 끝내는|실력이 정해졌다는 뜻|일을 더 키우기보다|모든 것을 한꺼번에 넓히라는 뜻|새 목표보다 유지할 기준을 먼저|더 많이 해내라는 압박|모든 빈칸을 한 번에|무난하게 보인다면 지금까지 된 부분|순서를 다시 잡으라는 신호|혼자 책임을 전부 떠안지 않는|실패가 정해진 것은 아니에요|성과보다 회복 가능한 일의 크기|잠시 속도를 낮추라는 안내|이미 맞아떨어진 확인 방식|다시 검토할 기준|한곳에 몰아두지 말고|이름, 날짜, 위치|제출할 것과 보관할 것|확인받을 항목|작은 오류를 잡을 시간|정리 기준을 짧게|보통의 흐름에서는|중간처럼 보이는 흐름|무난한 관계일수록|흐름이 보통일 때|자주 보이는 말투|큰 변화보다 작은 말투|좋은 기세가 있을 때는 많이 해낸 양|성공한 방법을 기록|잘 풀린 조건|보통으로 보이는 흐름은 몸이|무난한 흐름일수록 작은 신호|중간 정도의 흐름은 생활 리듬|보통 점수는 방심하라는 뜻|검토 순서를 짧게|보통 흐름은 다시 확인할 순서를|흐름이 보통으로 보인다면 정리가|헷갈리는 기록|필요한 기록과 나중에 볼 기록|보관 기준을 작게|확인할 항목을 나누|기억에 맡기지 말고|잘 맞은 확인 방식|다시 찾을 자료|보관 위치|급한 제출과 기다려도 되는 기록|돈 문제가 애매하다는 뜻|돈을 더 묶어 두라는 뜻|작은 돈 기준|지출이 흔들린다는 말|돈의 속도를 다시 정리|생활을 흔드는 지출|기다릴 수 있는 돈|돈의 방향을 다시 맞춰 볼 기회|큰 성과보다 작은 확인|돈의 기준을 세우기에는 충분|내 생활을 지키는 지출|영수증 하나|더 아끼라는 압박|서로 편했던 방식을 오래 유지|이미 지킨 작은 예의|관계가 잘 풀리는 듯할수록|보관 방식도 한 번 더|문서를 빨리 끝내라는 뜻보다|찾는 길을 단순하게|정리 기준을 다시 잡기 좋은 때|급한 기록과 기다려도 되는 기록|서류를 한꺼번에 끝내려 하지 않아도|문서 보관도 여러 안전장치|다시 꺼내 볼 길을 분명히/;
const PERIOD_SCOPE_PATTERN = /오늘 안에서는|한 번에 풀려고 하지 않아도|짧게 안부를 전할 시간|눈앞의 대화를 편하게|이번 주에는|이번 달에는|올해에는|긴 흐름에서는/;
const CATEGORY_GUIDANCE_PATTERN = /전체 생활에서는|물건과 작은 선택은|용돈과 물건 관리는|돈과 물건 관리는|몸과 마음에서는|공부와 배움에서는|배움과 이해에서는|친구 관계에서는|친구와 관계에서는|관계에서는|가까운 사람들과는|관계가 편해지려면|가족이나 가까운 사람과는|마음이 가까운 사람일수록|서로를 아끼는 마음|진로 감각은|일과 책임에서는|기록과 서류에서는|표현과 창의에서는|긴장과 회복에서는|이동과 변화에서는/;
const SELF_CHECK_PATTERN = /읽고 난 뒤에는|다 읽은 뒤에는|해석을 덮기 전에|마지막으로 .* 내가 이미 잘하고 있는 부분|마지막으로 인생 전체 흐름에서|마지막으로 인생 전체의 표현과 창의(?: 영역)?에서|새로 가 볼 곳과 돌아올 자리|가장 안전하게 시험해 볼 변화|무리해서 멀리 움직일 일|새로운 환경에서 내가 지킬 기준|출발 시간이나 돌아올 시간|새로 시도할 장소보다 돌아왔을 때|이동 뒤에 쉴 시간|가볍게 움직일 일 하나|비용, 시간, 체력 중 가장 먼저 확인|생활을 흔드는 변화와 생활을 가볍게 하는 변화|새 길을 고르기 전에 돌아올 시간|이동이 필요한 일과 제자리에서 정리할 일|다음 이동에서 챙길 사람|오늘 꼭 지킬 기준|돈을 쓰고 싶은 이유/;
const CLOSING_GUIDANCE_PATTERN = /마지막으로, 이 해석은|끝으로, .*한 번에 맞히는 답보다|덧붙이면, 이 해석은|정리하면, .*(?:점수만 보는 것보다|생활과 함께 읽을 때|함께 놓고 볼 때|생활에 맞는 조절점)|크게 맞고 틀리는 문제|더 불안하게 만들기|여러 조언을 한꺼번에|방향을 넓게 보여 주는|오래 두고 다시 읽을수록|무리하지 않을 순서|큰 사건보다 반복되는 선택|마지막으로, 전체 생활은 한 번 읽고 끝내기보다|덧붙이면, 전체 생활은 좋은 말만 모으는 글|정리하면, 전체 생활은 지금의 나를 몰아붙이기 위한 답|끝으로, 전체 생활은 여러 문장을 모두 적용할 때보다|마지막으로, 전체 생활은 시간이 지나며 의미가 달라질 수|부담을 조금 낮출 방법|덜 무거워지는 선택|모든 답을 한 번에 정하는 글/;
const SCORE_BRIDGE_PATTERN = /숫자와 별점|이 점수는|별점은|숫자는 전체 분위기|점수는 크게|쉬운 기준으로 보면|생활 기준으로 보면|먼저 볼 것은|점수 해석은|점수보다 먼저 볼 것은|이 흐름은 결과를|조금 더 쉽게 보면|실제로 읽을 때는|실제 생활에서는|생활에서는|가장 먼저 볼 부분은/;

type PublicCategory = 'overall' | TieredCategoryId;
type GuidanceVariantSalt = 'scoreBridge' | 'scorePacing' | 'periodHorizon' | 'categoryGuidance' | 'selfCheck' | 'closing' | 'short' | 'sourceMentor' | 'sourceTransition' | 'sourceFamilyReceive' | 'sourceFamilyAutumn' | 'sourceStressRiver' | 'sourceStressRest' | 'sourceStressSupport' | 'sourceStressOverall' | 'sourceHealthStressSmallWell' | 'sourceWealthWell' | 'sourceWealthStandard' | 'sourceWealthPace' | 'sourceWealthSharing' | 'sourceWealthSelfCheck' | 'sourceFamilySelfCheck' | 'sourceRomanceSelfCheck' | 'sourceRomanceSelfCheckDetail' | 'sourceRomanceClosing' | 'sourceOverallSelfCheck' | 'sourceOverallClosing' | 'sourceStudyNotebookFirst' | 'sourceStudyUnknowns' | 'sourceStudyComparison' | 'sourceStudyPraise' | 'sourceExpressionAutumnLight' | 'sourceExpressionSmallWorks' | 'sourceExpressionClosing' | 'sourceFamilySmallCare' | 'sourceAcademicIntro' | 'sourceAcademicSharing' | 'sourceAcademicSharingDetail' | 'sourceAcademicPractice' | 'sourceAcademicRole' | 'sourceAcademicWisdom' | 'sourceStudyBookshelf' | 'sourceStudyRecordShare' | 'sourceStudyDocumentBackup' | 'sourceStudyDocumentLifeBasis' | 'sourceStudyDocumentLifeMethod' | 'sourceStudyDocumentLifeFiling' | 'sourceStudyDocumentLifeShared' | 'sourceStudyDocumentLifeChecklist' | 'sourceStudyAsset' | 'sourceCareerElderIntro' | 'sourceCareerMidlifeTrust' | 'sourceHealthSeniorHabit' | 'sourceHealthSeniorSupport' | 'sourceHealthBalancedBasics' | 'sourceHealthBalancedPace' | 'sourceHealthLifeNeutralOpening' | 'sourceHealthLifeNeutralBasics' | 'sourceHealthLifeNeutralChange' | 'sourceHealthLifeNeutralSignal' | 'sourceHealthLifeNeutralCare' | 'sourceHealthWeekAutumnPace' | 'sourceAcademicSeniorLearning' | 'sourceAcademicSeniorMemo' | 'sourceStudyLearningBase' | 'sourceStudyLearningRecord' | 'sourceStudyLearningPromise' | 'sourceTeenHealthRhythm' | 'sourceTeenHealthRoots' | 'sourceTeenHealthSignal' | 'sourceTeenHealthRecord' | 'sourceTeenHealthSeed' | 'sourceMovementNearby' | 'sourceMovementFarCaution' | 'sourceMovementScoreHigh' | 'sourceMovementReturnBase' | 'sourceMovementFloorOpening' | 'sourceMovementFloorCenter' | 'sourceMovementFloorRecovery' | 'sourceLifeHealth20Habits' | 'sourceLifeHealth20Challenge' | 'sourceLifeHealth20LongView' | 'sourceLifeHealth20Metaphor' | 'sourceLifeFamilyTeenDistance' | 'sourceLifeFamilyTeenPractice' | 'sourceLifeFamilyTeenRoots' | 'sourceLifeFamily20Distance' | 'sourceLifeFamily20Parents' | 'sourceLifeFamily20LongView' | 'sourceLifeRomanceTeenSignal' | 'sourceLifeRomanceTeenExpression' | 'sourceLifeAcademicTeenChallenge' | 'sourceLifeAcademicTeenMetaphor' | 'sourceLifeAcademicTeenRecovery' | 'sourceLifeAcademic20Project' | 'sourceLifeAcademic20Record' | 'sourceRomanceLifeExpression' | 'sourceCareer20Finish' | 'sourceAcademic30Scope' | 'sourceAcademic30Record' | 'sourceAcademicMidlifeScope' | 'sourceAcademicMidlifePractice' | 'sourceAcademicMidlifePace' | 'sourceChildAcademicMonthIntro' | 'sourceChildAcademicGuided' | 'sourceChildHealthSleep' | 'sourceMovementLaterLifePace' | 'sourceLifeCareerTeenSpring' | 'sourceLifeCareerTeenNotebook' | 'careerSelfCheck' | 'movementSelfCheck' | 'sourceStudyDocumentSelfCheck' | 'sourceExpressionRoleBalance' | 'sourceExpressionAutumnHarvest' | 'sourceExpressionLifeGarden' | 'sourceExpressionLegacyPath' | 'sourceMovementFamilyDecision' | 'sourceMovementLifeMetaphor' | 'sourceMovementLifeCurrent' | 'sourceMovementBaggage' | 'lifeHorizonNudge' | 'categoryNudge' | 'futureAdultLifeHorizonNudge' | 'futureAdultLifeCategoryNudge';

export interface StandardDepthEnhancementContext {
  readonly category: PublicCategory;
  readonly period: TieredPeriodKind;
  readonly periodLabel: string;
  readonly feature: FeatureVector;
  readonly readerAgeBand?: FeatureVector['ageBand'];
  readonly stars: StarRating | null;
  readonly meaningfulness: TieredFortune['meaningfulness'];
}

function stableVariantIndex(
  ctx: StandardDepthEnhancementContext,
  salt: GuidanceVariantSalt,
  size: number,
): number {
  if (size <= 1) return 0;
  const seed = [
    salt,
    ctx.category,
    ctx.period,
    ctx.periodLabel,
    ctx.readerAgeBand ?? ctx.feature.ageBand,
    ctx.stars ?? 'none',
    ctx.meaningfulness,
    ctx.feature.dayMasterElement ?? 'none',
    String(ctx.feature.dayMasterElementOrdinal),
    ctx.feature.dayMasterStrength,
    String(ctx.feature.dayMasterStrengthOrdinal),
    ctx.feature.agePhase,
    String(ctx.feature.agePhaseOrdinal),
    ctx.feature.gender,
    String(ctx.feature.genderOrdinal),
    ctx.feature.birthSeason,
    String(ctx.feature.birthSeasonOrdinal),
    ctx.feature.currentSeason,
    String(ctx.feature.currentSeasonOrdinal),
    ctx.feature.dayMasterPolarity,
    String(ctx.feature.dayMasterPolarityOrdinal),
    ctx.feature.yongshinAlignment,
    ctx.feature.yongshinElement ?? 'none',
    String(ctx.feature.yongshinElementOrdinal),
    ctx.feature.heeshinElement ?? 'none',
    String(ctx.feature.heeshinElementOrdinal),
    ctx.feature.gishinElement ?? 'none',
    String(ctx.feature.gishinElementOrdinal),
    ctx.feature.gyeokguk ?? 'none',
    String(ctx.feature.gyeokgukOrdinal),
    String(ctx.feature.ageYears),
    String(ctx.feature.birthMonth),
    String(ctx.feature.currentMonth),
    String(ctx.feature.strengthTotalSupport),
    String(ctx.feature.strengthTotalOppose),
    String(ctx.feature.strengthDeukryeong),
    String(ctx.feature.strengthDeukji),
    String(ctx.feature.strengthDeukse),
    String(ctx.feature.yongshinConfidence),
    String(ctx.feature.gyeokgukConfidence),
    String(ctx.feature.shinsalCount),
    String(ctx.feature.deficientElementCount),
    String(ctx.feature.excessiveElementCount),
    String(ctx.feature.cheonganRelationCount),
    String(ctx.feature.jijiRelationCount),
    String(ctx.feature.woodCount),
    String(ctx.feature.fireCount),
    String(ctx.feature.earthCount),
    String(ctx.feature.metalCount),
    String(ctx.feature.waterCount),
  ].join('|');
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % size;
}

function pickVariant(
  ctx: StandardDepthEnhancementContext,
  salt: GuidanceVariantSalt,
  variants: readonly string[],
): string {
  return variants[stableVariantIndex(ctx, salt, variants.length)] ?? variants[0] ?? '';
}

function publicCharLength(value: string): number {
  return [...value].length;
}

function isMinorAgeBand(ageBand: FeatureVector['ageBand']): boolean {
  return ageBand === '0-9' || ageBand === '10-19';
}


function isYoungChildAgeBand(ageBand: FeatureVector['ageBand']): boolean {
  return ageBand === '0-9';
}

function isMinorReader(ctx: StandardDepthEnhancementContext): boolean {
  return isMinorAgeBand(ctx.readerAgeBand ?? ctx.feature.ageBand);
}

function isYoungChildReader(ctx: StandardDepthEnhancementContext): boolean {
  return isYoungChildAgeBand(ctx.readerAgeBand ?? ctx.feature.ageBand);
}

function isFutureAdultLifeForMinorReader(ctx: StandardDepthEnhancementContext): boolean {
  return ctx.period === 'life' && isMinorReader(ctx) && !isMinorAgeBand(ctx.feature.ageBand);
}

function futureAdultLifeScopeLead(ctx: StandardDepthEnhancementContext): string {
  const band = ctx.feature.ageBand;
  if (band.startsWith('20-')) return '성인이 된 뒤를 넓게 보면';
  if (band.startsWith('30-')) return '생활 책임이 커지는 시기를 넓게 보면';
  if (band.startsWith('40-')) return '역할이 넓어지는 시기를 넓게 보면';
  if (band.startsWith('50-')) return '생활 기준을 다시 정리하는 시기를 넓게 보면';
  if (band.startsWith('60-')) return '후반기를 넓게 보면';
  if (band.startsWith('70-')) return '오래 뒤의 안정된 시기를 넓게 보면';
  if (band.startsWith('80-') || band.startsWith('90-') || band.startsWith('100-')) {
    return '아주 긴 흐름을 넓게 보면';
  }
  return '시간이 지난 뒤를 넓게 보면';
}

function futureAdultLifePeriodPhrase(ctx: StandardDepthEnhancementContext): string {
  if (ctx.category === 'career') return '그 시기의 진로 감각';
  const label = categoryLabel(ctx.category, ctx);
  return ctx.category === 'overall' ? '그 시기의 전체 생활' : `그 시기의 ${label}`;
}

function futureAdultLifePeriodAreaPhrase(ctx: StandardDepthEnhancementContext): string {
  return `${futureAdultLifePeriodPhrase(ctx)}에서`;
}

function minorStageReaderVariant(ctx: StandardDepthEnhancementContext, minorText: string, adultText: string): string {
  return isMinorReader(ctx) ? minorText : adultText;
}

function scoreBridgeSubject(ctx: StandardDepthEnhancementContext): string {
  if (ctx.period === 'thisYear' && ctx.category === 'career') return '올해 일의 방향은';
  if (ctx.period === 'life' && ctx.category === 'career' && !isMinorReader(ctx)) return '길게 보면 일의 방향은';
  if (ctx.period === 'thisWeek' && ctx.category === 'career' && !isMinorReader(ctx)) return '이번 주에는';
  if (ctx.period === 'thisMonth' && ctx.category === 'career' && !isMinorReader(ctx)) return '이번 달에는';
  const label = categoryLabel(ctx.category, ctx);
  const topic = withTopicParticle(label);
  switch (ctx.period) {
    case 'today':
      return `오늘 ${topic}`;
    case 'thisWeek':
      return `이번 주 ${topic}`;
    case 'thisMonth':
      return `이번 달 ${topic}`;
    case 'thisYear':
      return `올해 ${topic}`;
    case 'life':
  if (isFutureAdultLifeForMinorReader(ctx)) {
        return withTopicParticle(futureAdultLifePeriodPhrase(ctx));
      }
      return ctx.category === 'overall' ? '인생 전체 흐름은' : `인생 전체로 보면 ${topic}`;
  }
}

function publicPeriodLabel(period: TieredPeriodKind): string {
  switch (period) {
    case 'today':
      return '오늘';
    case 'thisWeek':
      return '이번 주';
    case 'thisMonth':
      return '이번 달';
    case 'thisYear':
      return '올해';
    case 'life':
      return '긴 흐름';
  }
}

function periodCategoryPhrase(ctx: StandardDepthEnhancementContext): string {
  if (ctx.period === 'thisYear' && ctx.category === 'career') return '올해 일의 방향';
  if (ctx.period === 'life' && ctx.category === 'career' && !isMinorReader(ctx)) return '인생 전체의 일의 방향';
  if (ctx.period === 'thisWeek' && ctx.category === 'career' && !isMinorReader(ctx)) return '이번 주의 일';
  if (ctx.period === 'thisMonth' && ctx.category === 'career' && !isMinorReader(ctx)) return '이번 달의 일';
  const label = categoryLabel(ctx.category, ctx);
  if (ctx.period === 'life' && isFutureAdultLifeForMinorReader(ctx)) {
    return futureAdultLifePeriodPhrase(ctx);
  }
  if (ctx.period === 'life' && ctx.category === 'overall') return '인생 전체 흐름';
  if (ctx.period === 'life') return `인생 전체의 ${label}`;
  return `${publicPeriodLabel(ctx.period)} ${label}`;
}

function periodCategoryAreaPhrase(ctx: StandardDepthEnhancementContext): string {
  if (ctx.period === 'thisWeek' && ctx.category === 'career' && !isMinorReader(ctx)) return '이번 주의 일에서';
  if (ctx.period === 'thisMonth' && ctx.category === 'career' && !isMinorReader(ctx)) return '이번 달의 일에서';
  const label = categoryLabel(ctx.category, ctx);
  if (ctx.period === 'life' && isFutureAdultLifeForMinorReader(ctx)) {
    return futureAdultLifePeriodAreaPhrase(ctx);
  }
  if (ctx.period === 'life' && ctx.category === 'overall') return '인생 전체 흐름에서';
  if (ctx.period === 'life') return `인생 전체의 ${label}에서`;
  return `${publicPeriodLabel(ctx.period)} ${label}에서`;
}

function categoryLabel(category: PublicCategory, ctx: StandardDepthEnhancementContext): string {
  const youngChild = isYoungChildReader(ctx);
  const minor = isMinorReader(ctx);
  const futureAdultLifeForMinor = isFutureAdultLifeForMinorReader(ctx);
  switch (category) {
    case 'overall':
      return '전체 생활';
    case 'wealth':
      if (futureAdultLifeForMinor) return '돈과 물건 관리';
      if (youngChild) return '물건과 작은 선택';
      return minor ? '용돈과 물건 관리' : '돈과 물건 관리';
    case 'health':
      return '몸과 마음';
    case 'academic':
      return '공부와 배움';
    case 'romance':
      if (futureAdultLifeForMinor) return '관계와 마음';
      return minor ? '친구 관계' : '관계와 마음';
    case 'family':
      return '가족과 가까운 관계';
    case 'career':
      if (futureAdultLifeForMinor) return '일과 책임';
      return minor ? '진로 감각' : '일과 책임';
    case 'study_document':
      return '기록과 서류';
    case 'expression_children':
      return '표현과 창의';
    case 'health_stress':
      return '긴장과 회복';
    case 'movement':
      return '이동과 변화';
  }
}

function hasBatchim(value: string): boolean {
  for (let i = value.length - 1; i >= 0; i -= 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 !== 0;
  }
  return false;
}

function withObjectParticle(value: string): string {
  return `${value}${hasBatchim(value) ? '을' : '를'}`;
}

function withSubjectParticle(value: string): string {
  return `${value}${hasBatchim(value) ? '이' : '가'}`;
}

function withTopicParticle(value: string): string {
  return `${value}${hasBatchim(value) ? '은' : '는'}`;
}

function scoreTone(stars: StarRating | null, meaningfulness: TieredFortune['meaningfulness']): string {
  if (meaningfulness === 'na' || stars === null) {
    return '아직 점수로 단정하기 어렵다면, 참고 정도로 보는 편이 좋아요';
  }
  if (stars >= 4) return '잘 풀릴 여지가 커요';
  if (stars === 3) return '큰 흔들림이 적고, 기준을 세울수록 편해요';
  return '신중하게 살필수록 부담이 줄어요';
}

function scoreBridgeGuidance(ctx: StandardDepthEnhancementContext): string {
  const subject = scoreBridgeSubject(ctx);
  const tone = scoreTone(ctx.stars, ctx.meaningfulness);
  if (ctx.category === 'academic') {
    if (isFutureAdultLifeForMinorReader(ctx)) {
      return pickVariant(ctx, 'scoreBridge', [
        `${subject} ${tone}. 점수보다 먼저 볼 것은 나중에 다시 쓸 배움 방식이에요.`,
        `${subject} ${tone}. 쉬운 기준으로 보면 나중에도 남길 질문 하나를 정해 보세요.`,
        `${subject} ${tone}. 쉬운 기준으로 보면 지금 결과보다 배움을 이어 갈 방식을 확인해 보세요.`,
      ]);
    }
    if (isYoungChildReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)) {
      return pickVariant(ctx, 'scoreBridge', [
        `${subject} ${tone}. 쉬운 기준으로 보면 좋아한 장면과 궁금한 질문을 나누어 보세요.`,
        `${subject} ${tone}. 점수보다 먼저 볼 것은 아이가 다시 보고 싶어 한 장면이에요.`,
        `${subject} ${tone}. 쉬운 기준으로 보면 오늘 편하게 배운 단서 하나를 살펴보세요.`,
      ]);
    }
    if (isMinorReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)) {
      return pickVariant(ctx, 'scoreBridge', [
        `${subject} ${tone}. 쉬운 기준으로 보면 이해한 문장과 막힌 질문을 나누어 보세요.`,
        `${subject} ${tone}. 점수보다 먼저 볼 것은 다시 설명할 수 있는 한 줄이에요.`,
        `${subject} ${tone}. 쉬운 기준으로 보면 막힌 질문과 이해한 내용을 나누어 보세요.`,
      ]);
    }
    return pickVariant(ctx, 'scoreBridge', [
      `${subject} ${tone}. 쉬운 기준으로 보면 이해한 내용과 다시 볼 자료를 나누어 보세요.`,
      `${subject} ${tone}. 점수보다 먼저 볼 것은 끝에 남길 요약이나 결과물이에요.`,
      `${subject} ${tone}. 쉬운 기준으로 보면 이해가 막힌 부분과 다시 설명해 볼 내용을 나누어 보세요.`,
    ]);
  }
  const actionCue = scoreBridgeActionCue(ctx);
  const attentionCue = scoreBridgeAttentionCue(ctx);
  const attentionObject = withObjectParticle(attentionCue);
  if ((ctx.category === 'health' || ctx.category === 'health_stress') && String(ctx.period).startsWith('life') && !isMinorReader(ctx)) {
    return pickVariant(ctx, 'scoreBridge', [
      `${subject} ${tone}. 쉬운 기준으로 보면 잠, 식사, 움직임 중 하나만 먼저 보세요.`,
      `${subject} ${tone}. 쉬운 기준으로 보면 줄일 부담과 이어 갈 습관을 하나씩만 나누어 보세요.`,
      `${subject} ${tone}. 쉬운 기준으로 보면 몸이 덜 힘들었던 조건 하나를 기준으로 삼으면 돼요.`,
    ]);
  }
  if (ctx.category === 'study_document' && isFutureAdultLifeForMinorReader(ctx)) {
    return pickVariant(ctx, 'scoreBridge', [
      `그 시기의 기록과 서류 흐름은 ${tone}. 쉬운 기준으로 보면 현재 결과를 정하는 말보다 시간이 지나 다시 찾을 기준을 남겨 보세요.`,
      `그 시기의 기록과 서류 흐름은 ${tone}. 실제로 읽을 때는 기록 이름, 보관 위치, 다시 볼 질문을 나누어 보세요.`,
      `점수보다 먼저 볼 것은 나중에도 다시 볼 수 있는 기준이에요. 보호자는 지금 완성보다 다시 찾을 기준만 가볍게 남겨도 충분해요.`,
    ]);
  }
  if (ctx.category === 'study_document' && isMinorReader(ctx)) {
    const periodLabel = publicPeriodLabel(ctx.period);
    return pickVariant(ctx, 'scoreBridge', [
      `${periodLabel} 기록과 자료 흐름은 ${tone}. 쉬운 기준으로 보면 받은 자료와 다시 물어볼 질문을 나누어 보세요.`,
      `${periodLabel} 기록과 자료 흐름은 ${tone}. 실제로 읽을 때는 자료 이름, 놓을 자리, 물어볼 사람을 정해 보세요.`,
      `점수보다 먼저 볼 것은 다시 찾을 기준이에요. 안내장, 문제 번호, 질문 한 줄 중 하나만 남겨도 다음 확인이 쉬워져요.`,
    ]);
  }
  if (isFutureAdultLifeForMinorReader(ctx)) {
    return pickVariant(ctx, 'scoreBridge', [
      withScoreBridgeCategoryContext(ctx, `${subject} ${tone}. 쉬운 기준으로 보면 ${actionCue}`),
      withScoreBridgeCategoryContext(ctx, `${subject} ${tone}. 쉬운 기준으로 보면 미래를 맞히기보다 ${attentionObject} 차분히 확인하는 참고예요.`),
      withScoreBridgeCategoryContext(ctx, `${subject} ${tone}. 쉬운 기준으로 보면 ${futureAdultLifeScoreBridgeCue(ctx)}`),
    ]);
  }
  if (ctx.category === 'career' && !isMinorReader(ctx)) {
    if (ctx.period === 'life') {
      return pickVariant(ctx, 'scoreBridge', [
        `${subject} ${tone}. 쉬운 기준으로 보면 지난 경험을 남길 기준과 앞으로 나눌 판단 기준을 구분해 보세요.`,
        `${subject} ${tone}. 실제로 읽을 때는 성과의 크기보다 반복해서 지킨 약속과 앞으로 전할 기준을 보세요.`,
        `${subject} ${tone}. 점수보다 먼저 볼 것은 내 경험이 어디에서 쓸모가 되는지예요. 남길 기록과 전할 판단 기준을 가볍게 적어 보세요.`,
      ]);
    }
    if (ctx.period === 'thisYear') {
      return pickVariant(ctx, 'scoreBridge', [
        `올해 일의 방향을 쉬운 기준으로 보면 새 역할이나 제안을 모두 잡기보다 밖에서 볼 수 있는 결과를 정해 보세요.`,
        `올해 일의 방향을 실제로 읽을 때는 완성할 결과와 함께 검토할 사람을 나누어 보세요. 성과를 혼자 들고 끝내지 않는 데 쓰면 좋아요.`,
        `점수보다 먼저 볼 것은 만든 결과가 누가 보아도 이해되는지예요. 문서, 발표, 제안처럼 형태를 정해 보세요.`,
      ]);
    }
    return pickVariant(ctx, 'scoreBridge', [
      `${subject} ${tone}. 쉬운 기준으로 보면 맡을 일과 함께 볼 일을 나누어 보세요. 도움을 청할 사람도 함께 보세요.`,
      `${subject} ${tone}. 실제로 읽을 때는 일의 크기와 함께 볼 사람을 나누어 보세요. 일을 혼자 떠안지 않는 데 쓰면 좋아요.`,
      `${subject} ${tone}. 점수보다 먼저 볼 것은 맡을 일의 크기예요. 직접 할 일과 나눌 일을 함께 확인해 보세요.`,
    ]);
  }
  if (ctx.category === 'study_document' && !isMinorReader(ctx)) {
    const periodLabel = publicPeriodLabel(ctx.period);
    if (ctx.period === 'life') {
      return pickVariant(ctx, 'scoreBridge', [
        `인생 전체의 기록과 서류 흐름은 ${tone}. 쉬운 기준으로 보면 자료를 더 쌓으라는 뜻보다 필요할 때 다시 찾을 길을 정해 보세요.`,
        `인생 전체의 기록과 서류 흐름은 ${tone}. 실제로 읽을 때는 보관 위치, 제출 순서, 다시 볼 날짜를 나누어 보세요.`,
        `점수보다 먼저 볼 것은 기록이 나중에도 설명되는지예요. 이름, 날짜, 남긴 이유를 함께 적어 두면 오래 쓸 자료가 돼요.`,
      ]);
    }
    if (ctx.period === 'thisYear') {
      return pickVariant(ctx, 'scoreBridge', [
        `올해 기록과 서류 흐름은 ${tone}. 쉬운 기준으로 보면 초안, 검토, 제출 순서를 분명히 해 보세요.`,
        `올해 기록과 서류 흐름은 ${tone}. 실제로 읽을 때는 제출할 것, 보관할 것, 다시 물어볼 것을 나누어 보세요.`,
        `점수보다 먼저 볼 것은 올해 남길 확인표예요. 자료 이름, 보관 위치, 다시 볼 날짜를 한 해 기준으로 맞춰 보세요.`,
      ]);
    }
    return pickVariant(ctx, 'scoreBridge', [
      `${periodLabel} 기록과 서류 흐름은 ${tone}. 쉬운 기준으로 보면 자료 이름과 보관 위치를 먼저 맞춰 보세요.`,
      `${periodLabel} 기록과 서류 흐름은 ${tone}. 실제로 읽을 때는 제출할 것, 보관할 것, 다시 확인할 것을 나누는 데 쓰면 좋아요.`,
      `점수보다 먼저 볼 것은 빠뜨리기 쉬운 칸이에요. 이름, 날짜, 제출처 중 하나만 또렷해져도 다음 확인이 쉬워져요.`,
    ]);
  }
  if (ctx.category === 'movement' && !isMinorReader(ctx)) {
    if (ctx.period === 'life') {
      return pickVariant(ctx, 'scoreBridge', [
        `${subject} ${tone}. 쉬운 기준으로 보면 새 길을 넓히되 익숙한 기준을 잃지 않는 쪽으로 살펴보세요.`,
        `${subject} ${tone}. 실제로 읽을 때는 바꿀 동선과 오래 남겨 둘 기준을 나누어 보세요.`,
        `${subject} ${tone}. 점수보다 먼저 볼 것은 변화가 생활을 더 편하게 만드는지예요. 부담이 적은 길과 계속 지킬 기준을 함께 확인해 보세요.`,
      ]);
    }
    return pickVariant(ctx, 'scoreBridge', [
      `${subject} ${tone}. 쉬운 기준으로 보면 움직일 이유와 다녀온 뒤 이어 갈 기준을 함께 확인해 보세요.`,
      `${subject} ${tone}. 실제로 읽을 때는 바꿀 것과 남겨 둘 기준을 나누어 보세요.`,
      `${subject} ${tone}. 점수보다 먼저 볼 것은 이동 뒤 생활이 얼마나 달라지는지예요. 새로 바꿀 것과 그대로 둘 기준을 함께 확인해 보세요.`,
    ]);
  }
  return pickVariant(ctx, 'scoreBridge', [
    withScoreBridgeCategoryContext(ctx, `${subject} ${tone}. 쉬운 기준으로 보면 ${actionCue}`),
    withScoreBridgeCategoryContext(ctx, scoreBridgeAdjustment(ctx)),
    withScoreBridgeCategoryContext(ctx, `${subject} ${tone}. 먼저 볼 것은 ${readerPredicateNoun(attentionCue)}. ${actionCue}`),
    withScoreBridgeCategoryContext(ctx, `${subject} ${tone}. 점수 해석은 생활에서 줄일 부담과 이어 갈 습관을 나누는 데 쓰면 좋아요.`),
    withScoreBridgeCategoryContext(ctx, `${subject} ${tone}. 점수보다 먼저 볼 것은 행동의 크기예요. ${actionCue}`),
    withScoreBridgeCategoryContext(ctx, `${subject} ${tone}. 이 흐름은 결과를 맞히려는 말보다, ${attentionObject} 차분히 확인하라는 신호에 가까워요.`),
    withScoreBridgeCategoryContext(ctx, `${subject} ${tone}. 조금 더 쉽게 보면 ${scoreBridgeTimeScope(ctx)} ${scoreBridgeFocus(ctx)}`),
    withScoreBridgeCategoryContext(ctx, `${subject} ${tone}. 실제 생활에서는 ${actionCue}`),
    withScoreBridgeCategoryContext(ctx, `${subject} ${tone}. 가장 먼저 볼 부분은 ${readerPredicateNoun(attentionCue)}. 크게 바꾸기보다 확인할 순서를 작게 잡으면 좋아요.`),
  ]);
}

function scoreBridgeAttentionCue(ctx: StandardDepthEnhancementContext): string {
  switch (ctx.category) {
    case 'overall':
      return '몸과 마음, 일정, 관계 중 가장 부담되는 한 가지';
    case 'wealth':
      if (isYoungChildReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)) return '갖고 싶은 것과 기다릴 수 있는 것';
      return '고정 지출, 이동 비용, 큰 결정을 확인하는 순서';
    case 'health':
      return '잠, 식사, 움직임 중 가장 먼저 편해질 수 있는 것';
    case 'academic':
      return '이해한 것, 막힌 질문, 다시 설명해 볼 것';
    case 'romance':
      return isMinorReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)
        ? '편한 말투와 조심할 장면'
        : '말투, 거리감, 서로의 속도';
    case 'family':
      return '더 챙길 말과 덜어낼 부담';
    case 'career':
      if (isFutureAdultLifeForMinorReader(ctx)) return '오래 남길 경험과 도움을 청할 사람';
      return isMinorReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)
        ? '관심 있는 일과 더 알아볼 일'
        : '먼저 맡을 일과 덜어낼 부담';
    case 'study_document':
      return isMinorReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)
        ? '다시 찾을 자료 이름과 질문 표시'
        : '자료 이름, 보관 위치, 제출 순서';
    case 'expression_children':
      return '바로 꺼낼 말과 나중에 다듬을 초안';
    case 'health_stress':
      return '참을 일과 풀어야 할 일';
    case 'movement':
      return '바꿀 것과 그대로 둘 것';
  }
}

function scoreBridgeActionCue(ctx: StandardDepthEnhancementContext): string {
  switch (ctx.category) {
    case 'overall':
      return '한 번에 다 고치려 하기보다 먼저 줄일 부담 하나를 고르면 좋아요.';
    case 'wealth':
      if (isYoungChildReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)) {
        return '갖고 싶은 것과 기다릴 수 있는 것을 나누는 데 쓰면 좋아요.';
      }
      return '돈이 새는 곳과 확인할 약속을 나누는 데 쓰면 좋아요.';
    case 'health':
      return '몸이 덜 지치는 선택과 유지할 습관을 고르는 데 쓰면 좋아요.';
    case 'academic':
      return '이해한 내용과 아직 막힌 질문을 나누는 데 쓰면 좋아요.';
    case 'romance':
      return isMinorReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)
        ? '친구와의 말투, 기다릴 말, 조심할 장면을 나누는 데 쓰면 좋아요.'
        : '관계에서 힘을 줄 말과 잠시 늦출 말을 나누는 데 쓰면 좋아요.';
    case 'family':
      return '더 챙길 말과 내려놓을 부담을 나누는 데 쓰면 좋아요.';
    case 'career':
      if (isFutureAdultLifeForMinorReader(ctx)) return '오래 남길 경험과 도움을 청할 사람을 나누는 데 쓰면 좋아요.';
      return isMinorReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)
        ? '관심 있는 일과 아직 더 알아볼 일을 나누는 데 쓰면 좋아요.'
        : '먼저 맡을 일과 도움받을 일을 나누는 데 쓰면 좋아요.';
    case 'study_document':
      return isMinorReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)
        ? '다시 볼 표시와 물어볼 질문을 정하는 데 쓰면 좋아요.'
        : '어디에 둘지와 언제 다시 볼지 정하는 데 쓰면 좋아요.';
    case 'expression_children':
      return '말, 메모, 초안 중 어디에 남길지 정하는 데 쓰면 좋아요.';
    case 'health_stress':
      return '참을 일과 풀어야 할 일을 구분하는 데 쓰면 좋아요.';
    case 'movement':
      return '바꿀 것과 그대로 둘 것을 나누는 데 쓰면 좋아요.';
  }
}

function futureAdultLifeScoreBridgeCue(ctx: StandardDepthEnhancementContext): string {
  switch (ctx.category) {
    case 'overall':
      return '몸, 일정, 관계 중 오래 지킬 기준 하나를 고르는 데 쓰면 좋아요.';
    case 'wealth':
      return '기다릴 선택과 꼭 확인할 조건을 구분하는 데 쓰면 좋아요.';
    case 'health':
      return '몸이 편했던 리듬과 무리했던 신호를 나누는 데 쓰면 좋아요.';
    case 'romance':
      return '가까운 사람과 편해지는 말투와 거리감을 고르는 데 쓰면 좋아요.';
    case 'family':
      return '가까운 사람과 주고받을 부담의 크기를 정하는 데 쓰면 좋아요.';
    case 'career':
      return '오래 남길 경험과 도움을 청할 사람을 나누는 데 쓰면 좋아요.';
    case 'study_document':
      return '다시 찾을 기록의 이름과 보관 위치를 정하는 데 쓰면 좋아요.';
    case 'expression_children':
      return '남길 표현과 천천히 다듬을 표현을 나누는 데 쓰면 좋아요.';
    case 'health_stress':
      return '쉬어 갈 신호와 덜어낼 부담을 고르는 데 쓰면 좋아요.';
    case 'movement':
      return '바꿀 환경과 돌아올 리듬을 함께 고르는 데 쓰면 좋아요.';
    case 'academic':
      return '오래 남길 질문과 다시 쓸 배움 방식을 고르는 데 쓰면 좋아요.';
  }
}

function readerPredicateNoun(value: string): string {
  return `${value}${hasBatchim(value) ? '이에요' : '예요'}`;
}

function withScoreBridgeCategoryContext(ctx: StandardDepthEnhancementContext, value: string): string {
  const context = scoreBridgeCategoryContext(ctx);
  return context ? `${value} ${context}` : value;
}

function scoreBridgeCategoryContext(ctx: StandardDepthEnhancementContext): string {
  if (isFutureAdultLifeForMinorReader(ctx)) {
    switch (ctx.category) {
      case 'overall':
        return '보호자는 현재 도울 생활 기준과 시간이 지나 다시 볼 방향을 구분해 읽어 주세요.';
      case 'wealth':
        return pickVariant(ctx, 'scoreBridge', [
          '현재 아이에게 돈 결정을 맡기라는 뜻은 아니에요. 보호자는 기다림, 기록, 확인하는 습관처럼 성장 뒤에도 도움이 될 바탕만 가볍게 읽으면 돼요.',
          '보호자가 현재 큰 선택을 시키라는 말은 아니에요. 작은 기다림과 기록 습관이 시간이 지나 생활을 지키는 바탕이 될 수 있다는 정도로 읽으면 돼요.',
          '돈 문제를 아이에게 미리 떠넘기려는 말이 아니에요. 지금은 갖고 싶은 마음을 기다려 보는 경험과 확인 습관만 편하게 연결해도 충분해요.',
        ]);
      case 'health':
        return '현재 건강을 평가하라는 뜻이 아니라, 성장 뒤에도 편한 생활 리듬을 미리 살펴보라는 뜻이에요.';
      case 'academic':
        return '현재 결과를 정하는 말이 아니라, 시간이 지나도 이어 갈 배움 방식을 미리 살펴보라는 뜻이에요.';
      case 'romance':
        return '관계를 서둘러 정하라는 뜻이 아니라, 오래 필요한 말투와 거리감을 넓게 살펴보세요.';
      case 'family':
        return '현재 가족 관계를 고치라는 뜻이 아니라, 성장 뒤 가까운 사람과 덜 부담스럽게 지낼 기준을 살펴보세요.';
      case 'career':
        return '성장 뒤 스스로 일을 고를 때 기준이 될 경험과 도움을 청할 사람을 넓게 살펴보세요.';
      case 'study_document':
        return '현재 기록을 완벽히 정리하라는 뜻이 아니라, 시간이 지나 다시 찾기 쉬운 기준을 넓게 살펴보세요.';
      case 'expression_children':
        return '현재 표현을 평가하라는 뜻이 아니라, 시간이 지나 자기 생각을 편하게 남기는 방식을 살펴보세요.';
      case 'health_stress':
        return '현재 마음을 문제로 단정하라는 뜻이 아니라, 성장 뒤 부담을 풀어 내는 기준을 넓게 살펴보세요.';
      case 'movement':
        return '현재 움직일 곳을 정하라는 뜻이 아니라, 시간이 지나 바꿀 것과 지킬 것을 나누어 살펴보세요.';
    }
  }
  switch (ctx.category) {
    case 'wealth':
      return isYoungChildReader(ctx)
        ? '이동할 때 드는 작은 비용도 보호자와 함께 기준을 정하고 천천히 골라도 괜찮아요.'
        : '이동 비용이나 큰돈은 기준을 세우고 확인할 사람과 함께 보면 더 안전해요.';
    case 'health':
    case 'health_stress':
      return '짧은 움직임과 쉬는 시간의 균형을 함께 보세요.';
    case 'academic':
      if (isYoungChildReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)) {
        return '보호자는 좋아한 장면과 궁금한 질문만 함께 남겨도 좋아요.';
      }
      if (isMinorReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)) {
        return '막힌 곳은 질문 한 줄, 이해한 곳은 짧은 설명으로 남겨 보세요.';
      }
      return '막힌 곳은 자료로 확인하고, 이해한 내용은 한 문장으로 남겨 보세요.';
    case 'study_document':
      return isMinorReader(ctx)
        ? '받은 자료는 보호자나 선생님과 놓을 위치를 정해 두면 다시 찾기 쉬워요.'
        : '중요한 내용은 이름, 날짜, 보관 위치를 함께 남겨 두면 더 안전해요.';
    case 'expression_children':
      return isYoungChildReader(ctx)
        ? '즐거운 표현과 쉬는 시간의 균형을 보호자와 함께 보세요.'
        : '잘하고 싶은 마음과 편하게 표현하는 시간의 균형을 함께 보세요.';
    case 'romance':
      if (isYoungChildReader(ctx)) {
        return '친구 관계에서는 아이의 마음만큼 상대 아이의 속도도 보호자가 함께 살펴 주세요.';
      }
      return isMinorReader(ctx)
        ? '친구 관계에서는 내 마음만큼 상대의 속도도 함께 보세요.'
        : '관계에서는 내 마음만큼 상대의 속도도 함께 보세요.';
    case 'career':
      if (isYoungChildReader(ctx)) {
        return '믿을 만한 어른과 아이에게 맞는 속도를 함께 보세요.';
      }
      return isMinorReader(ctx)
        ? '믿을 만한 어른과 나에게 맞는 속도를 함께 보세요.'
        : ctx.period === 'life'
          ? '오래 맡을 일과 함께 나눌 일을 차분히 확인해 보세요.'
          : '맡을 일과 함께 볼 일을 차분히 확인해 보세요.';
    case 'movement':
      return '새로 바꿀 일과 그대로 둘 생활 리듬을 함께 확인해 보세요.';
    case 'overall':
      return '혼자 애매하면 믿을 만한 사람과 오래 지킬 생활 기준을 함께 확인해 보세요.';
    default:
      return '';
  }
}


function scoreBridgeAdjustment(ctx: StandardDepthEnhancementContext): string {
  const subject = scoreBridgeSubject(ctx);
  const tone = scoreTone(ctx.stars, ctx.meaningfulness);
  return `${subject} ${tone}. 실제로 읽을 때는 ${scoreBridgeTimeScope(ctx)} ${scoreBridgeFocus(ctx)}`;
}

function scoreBridgeTimeScope(ctx: StandardDepthEnhancementContext): string {
  switch (ctx.period) {
    case 'today':
      return '오늘 안에';
    case 'thisWeek':
      return '이번 주 안에';
    case 'thisMonth':
      return '이번 달 동안';
    case 'thisYear':
      return '올해 안에서';
    case 'life':
      return isFutureAdultLifeForMinorReader(ctx) ? '시간을 길게 보고' : '오래 두고';
  }
}

function scoreBridgeFocus(ctx: StandardDepthEnhancementContext): string {
  if (isFutureAdultLifeForMinorReader(ctx)) {
    switch (ctx.category) {
      case 'overall':
        return '지금 단정할 결론보다 오래 지킬 생활 기준을 나누어 보세요.';
      case 'wealth':
        return '큰 결정을 요구하는 말이 아니라, 조건을 차분히 확인하는 습관을 나누어 보세요.';
      case 'romance':
        return '성급한 관계 결론보다 말투와 거리감을 나누어 보세요.';
      case 'career':
        return '직업 이름을 현재 정하라는 뜻이 아니라, 오래 남길 경험과 도움을 청할 사람을 나누어 보세요.';
      case 'family':
        return '가까운 사람과 서로 기대고 도울 기준을 나누어 보세요.';
      default:
        return '바로 맞춰야 할 답보다 오래 참고할 기준을 나누어 살펴보세요.';
    }
  }
  switch (ctx.category) {
    case 'overall':
      return '줄일 부담과 유지할 생활 리듬을 나누어 보세요.';
    case 'wealth':
      return isYoungChildReader(ctx)
        ? '갖고 싶은 것, 기다릴 수 있는 것, 이동할 때 드는 작은 비용을 나누어 보세요.'
        : '돈이 새는 곳, 이동 비용, 계속 유지할 기준을 나누어 보세요.';
    case 'health':
      return '덜 지치는 선택, 가벼운 움직임, 유지할 습관을 찾아보세요.';
    case 'academic':
      return '이해한 부분, 막힌 질문, 다시 설명해 볼 내용을 나누어 보세요.';
    case 'romance':
      return isMinorReader(ctx)
        ? '편한 말투와 조심할 장면을 나누어 보세요.'
        : '힘을 줄 말과 잠시 늦출 말을 나누어 보세요.';
    case 'family':
      return '더 챙길 말과 덜어낼 부담을 나누어 보세요.';
    case 'career':
      return isMinorReader(ctx)
        ? '관심 있는 일과 더 알아볼 일을 나누어 보세요.'
        : ctx.period === 'life'
          ? '계속 맡을 일과 편히 넘길 일을 나누어 보세요.'
          : '먼저 맡을 일과 덜어낼 부담을 나누어 보세요.';
    case 'study_document':
      return isMinorReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)
        ? '다시 찾을 자료 이름과 질문 표시를 남겨 보세요.'
        : '자료 이름, 보관 위치, 다시 볼 날짜를 정리해 보세요.';
    case 'expression_children':
      return '바로 꺼낼 말과 나중에 다듬을 초안을 나누어 보세요.';
    case 'health_stress':
      return '참을 일과 풀어야 할 일을 나누어 보세요.';
    case 'movement':
      return '바꿀 것과 그대로 둘 것을 나누어 보세요.';
  }
}
function scorePacingGuidance(ctx: StandardDepthEnhancementContext): string {
  const { stars, meaningfulness } = ctx;
  const scope = periodCategoryPhrase(ctx);
  const area = periodCategoryAreaPhrase(ctx);
  if (ctx.category === 'wealth' && isYoungChildReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)) {
    if (meaningfulness === 'na' || stars === null) {
      return pickVariant(ctx, 'scorePacing', [
        `${scope}에서는 점수보다 아이가 어떤 선택을 편하게 하는지 먼저 살피면 좋아요. 지금 바로 고칠 일보다 보호자와 함께 확인할 작은 장면 하나를 남겨 보세요.`,
        `${area} 아직 점수로 단정하기 어렵다면, 아이가 기다릴 수 있었던 순간을 먼저 봐도 충분해요. 작은 선택을 같이 돌아보면 흐름이 더 잘 보여요.`,
        `${scope}에서는 결과보다 관찰이 먼저예요. 무엇을 바로 갖고 싶어 했고 무엇을 기다릴 수 있었는지 나누어 보면 부담이 줄어요.`,
      ]);
    }

    if (stars >= 4) {
      return pickVariant(ctx, 'scorePacing', [
        `${scope}에서 흐름이 좋게 보일 때는 더 많이 사 주기보다 이미 잘 기다린 장면을 칭찬해 주는 편이 좋아요. 작은 약속 하나를 지키면 선택의 기준이 더 편하게 자라요.`,
        `${area} 흐름이 좋게 보이더라도 모든 결정을 아이 혼자 하게 둘 필요는 없어요. 보호자가 함께 필요한 것과 나중에 해도 되는 것을 나눠 주면 좋은 흐름이 오래 가요.`,
        `${scope}에서 좋은 기세가 보이면 작은 선택을 한 번 더 연습하기 좋아요. 바로 고르지 않고 잠깐 기다린 경험을 살려 주세요.`,
      ]);
    }
    if (stars === 3) {
      return pickVariant(ctx, 'scorePacing', [
        `${scope}에서 흐름이 보통으로 보인다면 좋은 선택과 아쉬운 선택이 함께 있다는 뜻으로 보면 돼요. 오늘은 아이가 기다릴 수 있었던 장면 하나만 찾아도 충분해요.`,
        `${scope}에서 흐름이 보통으로 보일 때는 큰 기준을 세우기보다 작은 약속 하나를 같이 정해 보세요. 갖고 싶은 것과 나중에 해도 되는 것을 나누면 판단이 쉬워져요.`,
        `${area} 흐름이 보통으로 보인다는 말은 아이가 배워 가는 중이라는 뜻에 가까워요. 보호자와 함께 한 번 더 물어보는 습관이 도움이 돼요.`,
      ]);
    }
    return pickVariant(ctx, 'scorePacing', [
      `${scope}에서 흐름이 낮게 보일 때는 혼내기보다 선택을 더 작게 줄여 주는 편이 좋아요. 하나만 고르고 나머지는 다음에 보기로 하면 부담이 덜해져요.`,
      `${scope}에서 흐름이 낮게 보이더라도 나쁜 일이 정해졌다는 뜻은 아니에요. 오늘은 바로 사기보다 기다려 보는 연습 하나만 남겨도 충분해요.`,
      `${area} 흐름이 낮게 보일 때는 새 약속을 늘리기보다 이미 있는 물건을 함께 정리해 보세요. 속도를 낮추면 아이도 선택을 더 편하게 배워요.`,
    ]);
  }
  if (ctx.category === 'study_document' && isMinorReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)) {
    if (meaningfulness === 'na' || stars === null) {
      return pickVariant(ctx, 'scorePacing', [
        `${scope}에서는 점수보다 아이가 배운 것을 어떻게 남기는지 먼저 보면 좋아요. 오늘은 노트, 안내장, 질문 중 하나만 눈에 보이게 정리해도 충분해요.`,
        `${area} 아직 점수로 단정하기 어렵다면, 결과보다 다시 볼 수 있는 흔적을 먼저 살펴보세요. 색 표시, 짧은 질문, 선생님께 물어볼 내용 하나가 좋은 기준이 돼요.`,
        `${scope}에서는 빠른 결론보다 작은 기록이 더 도움이 돼요. 아이가 헷갈린 자료를 편하게 표시할 수 있으면 다음 확인도 덜 막막해져요.`,
      ]);
    }
    if (stars >= 4) {
      return pickVariant(ctx, 'scorePacing', [
        `${scope}에서 흐름이 좋게 보일 때는 분량을 더 늘리기보다 이미 잘 남긴 노트와 표시를 지켜 주는 편이 좋아요. 다시 볼 곳이 보이면 좋은 흐름이 더 오래 이어져요.`,
        `${area} 좋은 흐름이 보이면 안내장이나 과제물을 한곳에 모아 두는 작은 습관을 칭찬해 주세요. 아이가 스스로 찾을 수 있는 기준이 생기면 학교 준비도 더 편해져요.`,
        `${scope}에서 좋은 기세가 있을수록 새 자료를 많이 쌓기보다 오늘 받은 자료에서 다시 볼 표시를 남기는 편이 좋아요. 그 표시가 숙제나 안내장을 다시 찾을 때 길잡이가 돼요.`,
      ]);
    }
    if (stars === 3) {
      return pickVariant(ctx, 'scorePacing', [
        `${scope}에서 흐름이 보통으로 보인다면 정리가 막혔다는 뜻이 아니에요. 지금은 끝낸 것, 다시 볼 것, 물어볼 것을 짧게 나누면 충분해요.`,
        `${area} 무난하게 보일 때는 노트를 한꺼번에 고치려 하지 않아도 돼요. 이번에 다시 볼 단서 하나와 질문 하나만 남기면 다음 확인이 훨씬 쉬워져요.`,
        `${scope}에서 보통 흐름은 다시 확인할 순서를 세우기 좋은 때예요. 숙제, 안내장, 시험 범위 중 가장 헷갈리는 하나부터 차분히 표시해 보세요.`,
      ]);
    }
    return pickVariant(ctx, 'scorePacing', [
      `${scope}에서 흐름이 낮게 보일 때는 아이가 기록을 못한다는 뜻이 아니에요. 분량을 줄이고, 헷갈린 자료 하나나 다시 볼 안내 하나만 남겨도 다음 확인이 쉬워져요.`,
      `${area} 낮게 보이는 흐름은 속도를 잠시 낮추라는 신호에 가까워요. 오늘은 새 자료를 더 만들기보다 이미 받은 안내장이나 노트 한 장을 함께 확인해 보세요.`,
      `${scope}에서 흐름이 낮게 보이면 혼자 끝내려 하지 말고 확인받을 질문을 작게 정해 보세요. 한 사람에게 한 가지를 물어보는 정도만으로도 부담이 줄어요.`,
    ]);
  }
  if (meaningfulness === 'na' || stars === null) {
    return pickVariant(ctx, 'scorePacing', [
      `${withTopicParticle(scope)} 아직 점수로 단정하기 어렵다면, 결과보다 관찰을 먼저 두는 편이 좋아요. 실제로 편해지는 행동이 무엇인지 확인하면서 해석의 무게를 가볍게 잡아 주세요.`,
      `${scope}에서는 빠른 결론보다 작은 확인이 더 도움이 돼요. 몸과 마음이 덜 불편해지는 선택을 찾아보면 결과보다 관찰이 먼저라는 뜻을 이해하기 쉬워요.`,
      `${withTopicParticle(scope)} 결과보다 관찰을 앞에 두면 점수가 비어 있는 부분도 차분히 볼 수 있어요. 지금은 크게 판단하기보다 생활 속 반응을 모아 보는 쪽이 더 안전해요.`,
    ]);
  }
  if ((ctx.category === 'health' || ctx.category === 'health_stress') && stars <= 2) {
    return pickVariant(ctx, 'scorePacing', [
      `${scope}에서 흐름이 낮게 보일 때는 몸이 보내는 신호를 먼저 알아차리는 편이 좋아요. 새 습관을 늘리기보다 잠, 식사, 쉬는 시간 중 하나만 안정시켜 보세요.`,
      `${area} 낮게 보이는 흐름은 몸을 더 몰아붙이라는 뜻이 아니에요. 오늘은 약속 하나를 줄이거나 쉬는 시간을 먼저 잡아 부담을 낮춰 보세요.`,
      `${scope}에서 컨디션이 약하게 느껴질 때는 큰 계획보다 회복 기준이 필요해요. 몸이 편했던 시간대와 피곤했던 시간대를 나누면 다음 선택이 쉬워져요.`,
      `${area} 낮게 보이는 흐름은 나빠질 일이 정해졌다는 뜻이 아니에요. 오늘은 무리한 약속을 줄이고 몸이 편했던 조건 하나를 다시 만드는 쪽이 좋아요.`,
      `${scope}에서 컨디션 신호가 약하게 보일 때는 강한 계획보다 회복할 여유를 먼저 잡아 보세요. 짧은 휴식과 가벼운 움직임만으로도 부담을 낮출 수 있어요.`,
      `${area} 흐름이 낮게 보이더라도 내 몸을 탓할 필요는 없어요. 지금은 더 해내는 것보다 덜 지치는 순서를 찾는 쪽이 실제 생활에 더 도움이 돼요.`,
      `${scope}에서 흐름이 낮게 보일 때는 몸을 다그치기보다 신호를 줄이는 순서가 먼저예요. 잠자는 시간, 먹는 시간, 쉬는 시간 중 가장 흔들린 것 하나만 붙잡아 보세요.`,
      `${area} 낮게 보이는 흐름은 당장 큰 운동을 시작하라는 말이 아니에요. 오늘은 피로가 덜했던 조건을 떠올리고 그 조건을 다시 만들 작은 시간을 남겨 보세요.`,
      `${scope}에서 컨디션이 약하게 느껴질 때는 새 목표보다 회복할 빈칸이 필요해요. 일정 하나를 줄이거나 쉬는 시간을 먼저 정하면 몸의 부담이 내려가요.`,
      `${area} 흐름이 낮게 보이면 생활을 전부 고치려 하지 않아도 돼요. 물 마시기, 일찍 눕기, 짧게 걷기처럼 가장 쉬운 기준 하나부터 잡아 보세요.`,
      `${scope}에서 흐름이 낮게 보일 때는 참고 버티는 힘보다 멈추는 기준이 더 중요해요. 피로가 커지기 전에 쉬어 갈 신호를 정하면 다음 선택이 편해져요.`,
      `${area} 낮게 보이는 흐름은 몸이 틀렸다는 뜻이 아니라 조절할 때가 왔다는 신호예요. 무리한 약속을 줄이고 편했던 리듬 하나를 다시 가져오면 좋아요.`,
      `${scope}에서 낮게 보이는 흐름은 몸을 탓하라는 뜻이 아니에요. 최근 편했던 시간대, 덜 피곤했던 식사, 쉬기 쉬웠던 장소 중 하나만 다시 찾아도 회복이 시작돼요.`,
      `${area} 흐름이 낮게 보일 때는 새 목표보다 부담을 낮추는 기준이 먼저예요. 오늘 줄일 약속 하나와 다시 해 볼 편한 습관 하나를 나누어 보세요.`,
      `${scope}에서 흐름이 낮게 보일 때는 생활이 틀렸다고 보기보다 조절 신호로 보면 좋아요. 잠, 식사, 움직임 중 가장 흔들린 하나만 작게 고쳐도 충분해요.`,
      `${area} 낮게 보이는 흐름은 더 버티라는 말이 아니에요. 몸이 편했던 조건을 떠올리고, 그 조건을 다시 만들 시간을 먼저 남겨 보세요.`,
    ]);
  }
  if ((ctx.category === 'health' || ctx.category === 'health_stress') && stars === 3) {
    return pickVariant(ctx, 'scorePacing', [
      `${scope}에서 무난하게 보인다는 말은 몸이 멈춰 있다는 뜻이 아니에요. 잘 유지되는 습관 하나와 조금 줄일 부담 하나를 나누면 생활에서 바로 써먹기 쉬워요.`,
      `${area} 흐름이 보통으로 보일 때는 큰 치료나 강한 운동보다 생활 리듬을 확인하는 일이 먼저예요. 잠, 식사, 움직임 중 최근 가장 편했던 기준을 남겨 보세요.`,
      `${scope}에서 보통으로 보이는 흐름은 몸을 더 몰아붙이라는 뜻이 아니에요. 이미 괜찮은 습관은 지키고, 피로가 쌓이는 장면만 작게 조절하면 충분해요.`,
      `${area} 무난하게 보인다는 말은 관리할 여지가 남아 있다는 뜻이에요. 컨디션이 좋았던 시간대와 쉽게 지쳤던 시간대를 나누면 다음 일정이 훨씬 편해져요.`,
      `${scope}에서 보통으로 보이는 흐름은 몸이 크게 흔들린다는 뜻이 아니에요. 편했던 리듬과 피로가 쌓인 시간을 나누면 관리할 기준이 보여요.`,
      `${area} 무난한 흐름일수록 작은 신호를 놓치지 않는 편이 좋아요. 덜 피곤했던 시간대와 무리했던 일정을 비교하면 다음 조절이 쉬워져요.`,
      `${scope}에서 중간 정도의 흐름은 생활 리듬을 다시 맞출 여지가 있다는 뜻이에요. 잠, 식사, 움직임 중 가장 흔들린 하나부터 확인해 보세요.`,
      `${area} 보통 점수는 방심하라는 뜻이 아니에요. 이미 괜찮은 습관과 조금 손볼 습관을 나누면 컨디션이 더 안정돼요.`,
      `${scope}에서 흐름이 보통으로 보인다면 새 계획을 많이 세우기보다 회복 기준을 또렷하게 두는 편이 좋아요. 쉬는 날, 걷는 시간, 식사 시간을 하나만 안정시켜 보세요.`,
      `${area} 아주 강한 신호가 아니어도 몸은 작은 반복에 반응해요. 오늘 편했던 습관 하나를 유지하고, 부담스러운 약속 하나를 줄이면 충분한 조절이 돼요.`,
      `${scope}에서 무난하게 보일 때는 괜찮은 부분을 먼저 확인해도 좋아요. 이미 유지되는 생활 습관을 기준으로 삼으면 고칠 부분도 덜 무겁게 느껴져요.`,
      `${area} 흐름이 보통으로 보인다면 몸의 신호를 가볍게 기록해 보세요. 언제 편했고 언제 피곤했는지 한 줄만 남겨도 다음 선택이 더 쉬워져요.`,
      `${scope}에서 무난하게 보인다는 말은 지금의 리듬을 다시 확인하라는 뜻이에요. 이미 몸이 편했던 습관은 남기고, 무리한 일 하나만 줄여도 체감이 달라질 수 있어요.`,
      `${area} 흐름이 보통으로 보일 때는 새 목표를 더하는 것보다 회복 시간을 먼저 확보하는 편이 좋아요. 쉬는 시간과 움직이는 시간을 한 칸씩만 정해도 충분해요.`,
      `${scope}에서 보통으로 보이는 흐름은 관리가 애매하다는 뜻이 아니에요. 잠, 식사, 움직임 중 흔들린 한 가지를 알면 다음 조절이 훨씬 쉬워져요.`,
      `${area} 무난하게 보인다는 말은 당장 크게 바꾸라는 뜻이 아니에요. 편했던 시간대와 부담이 커진 약속을 나누면 생활에 맞는 회복 순서가 보여요.`,
      `${scope}에서 흐름이 보통으로 보인다면 몸이 보내는 작은 신호를 그냥 넘기지 않는 편이 좋아요. 피곤함이 줄었던 조건 하나를 다시 만들면 관리가 현실적이에요.`,
      `${area} 아주 강한 신호가 아니어도 오늘의 몸은 참고할 단서를 줘요. 물을 마신 시간, 쉬었던 시간, 가볍게 움직인 시간을 하나만 떠올려 보세요.`,
      `${scope}에서 무난하게 보일 때는 더 열심히 해야 한다고 받아들이지 않아도 돼요. 유지할 습관과 덜어낼 부담을 나누면 몸을 편하게 돌볼 기준이 생겨요.`,
      `${area} 흐름이 보통으로 보인다면 컨디션을 한 문장으로 남겨 보세요. 편했던 이유와 피곤했던 이유를 짧게 적으면 다음 일정이 덜 흔들려요.`,
    ]);
  }
  if (ctx.category === 'romance' || ctx.category === 'family') {

    if (stars >= 4) {
      return pickVariant(ctx, 'scorePacing', [
        `${scope}에서 흐름이 좋게 보일 때일수록 마음을 크게 밀어붙이기보다 이미 편안한 말투와 작은 약속을 지키는 편이 좋아요. 좋은 분위기일수록 상대의 속도도 함께 살피면 관계가 오래 편안해져요.`,
        `${area} 좋은 흐름이 보이면 새 약속을 늘리기보다 지금 서로 부담이 적은 장면을 조금 더 자주 만드는 편이 좋아요. 짧은 안부와 고마움 표현이 좋은 분위기를 오래 이어 줘요.`,
        `${scope}에서 좋은 기세가 느껴질수록 결론을 서두르지 말고 말투와 시간 약속을 부드럽게 맞춰 보세요. 작은 배려가 관계의 안정감을 키워 줘요.`,
        `${scope}에서 좋은 분위기일수록 더 빨리 결론을 내기보다 지금 편한 방식을 지키는 편이 좋아요. 편한 말투 하나와 지킨 약속 하나가 관계를 오래 안정시켜요.`,
        `${area} 좋은 신호가 보일수록 상대를 바꾸려 하기보다 서로 편했던 장면을 다시 만드는 쪽이 좋아요. 이미 잘 맞는 대화 시간과 약속 방식을 조금 더 살려 보세요.`,
        `${scope}에서 좋은 분위기일수록 관계를 더 빠르게 밀기보다 서로 편했던 리듬을 지키는 편이 좋아요. 말투, 연락 간격, 만나는 시간을 무리 없이 유지하면 안정감이 오래 남아요.`,
        `${area} 흐름이 좋게 보일 때는 새로운 약속을 많이 만들기보다 이미 편했던 방식을 한 번 더 확인해 보세요. 가까운 사람의 부담이 적어야 좋은 흐름도 오래 이어져요.`,
        `${scope}에서 좋은 신호가 보일수록 내가 원하는 속도만 앞세우지 않는 편이 좋아요. 상대가 편안해했던 장면을 같이 떠올리면 관계의 온도가 더 부드럽게 이어져요.`,
        `${area} 좋은 분위기일수록 큰 말보다 반복되는 작은 태도가 더 중요해요. 고마움을 늦추지 않고, 무리한 약속은 조절하면 가까운 관계가 덜 흔들려요.`,
        `${scope}에서 분위기가 괜찮게 느껴질 때는 큰 말보다 작은 배려를 반복하는 편이 더 실속 있어요. 고맙다는 말, 늦지 않는 약속, 짧은 안부가 관계의 바탕을 단단하게 해 줘요.`,
        `${area} 좋은 흐름이 있을 때는 더 큰 약속보다 지금 잘 통했던 방식을 차분히 이어 가는 편이 좋아요. 서로 편했던 시간, 말투, 연락 간격을 기억해 두면 관계가 더 안정돼요.`,
        `${scope}에서 좋은 흐름이 보이면 더 자주 만나기보다 서로 편했던 방식을 오래 유지하는 편이 좋아요. 편한 시간대와 부담 없는 말투를 지키면 관계의 안정감이 더 오래가요.`,
        `${area} 좋은 점수가 보일 때는 큰 약속보다 작은 예의를 먼저 살펴보세요. 이미 지킨 배려가 무엇인지 알면 다음 관계도 덜 급하게 다룰 수 있어요.`,
        `${scope}에서 관계가 잘 풀리는 듯할수록 말의 양보다 말의 온도를 살피면 좋아요. 짧은 안부와 늦지 않는 답이 가까운 사람에게 훨씬 든든하게 남아요.`,
        `${area} 좋은 분위기일수록 모든 대화를 앞으로 당길 필요는 없어요. 지금 무리 없이 이어지는 연락, 식사, 도움의 방식을 조금 더 차분히 지켜 보세요.`,
        `${scope}에서 흐름이 좋게 보일 때는 새 약속을 크게 만들기보다 이미 편했던 시간을 다시 만드는 편이 좋아요. 익숙한 배려가 반복되면 관계도 더 안정돼요.`,
        `${area} 좋은 신호가 보일수록 가까운 사람의 속도를 함께 보는 편이 좋아요. 내가 편한 방식과 상대가 편했던 방식을 나란히 두면 마음이 덜 앞서가요.`,
        `${scope}에서 좋은 신호가 보이면 상대를 더 밀어붙이기보다 편안했던 장면을 다시 만드는 쪽이 좋아요. 작은 배려가 반복되면 좋은 분위기도 오래 이어져요.`,
        `${area} 잘 맞는 흐름이 느껴질수록 기본을 더 가볍게 지키면 좋아요. 고마운 말을 미루지 않고, 부담되는 약속은 미리 조절하면 관계가 덜 흔들려요.`,
        `${scope}에서 관계가 부드럽게 느껴질 때는 새로운 결론보다 익숙한 신뢰를 돌보는 편이 좋아요. 이미 편했던 대화와 함께한 시간을 조금 더 자주 만들어 보세요.`,
        `${area} 좋은 점수가 보일수록 상대의 마음을 단정하기보다 편안했던 반응을 살피면 좋아요. 서로 무리하지 않는 방식이 보여야 좋은 흐름도 오래 남아요.`,
        `${scope}에서 좋은 흐름이 보이면 관계를 더 크게 증명하려 하지 않아도 돼요. 평소보다 편했던 말 한마디와 자연스러웠던 시간을 남기는 것만으로도 충분해요.`,
        `${area} 좋은 신호가 보일수록 작은 예의를 오래 지키는 편이 좋아요. 먼저 안부를 묻고, 약속 시간을 지키고, 부담되는 부탁은 미리 조절해 보세요.`,
        `${scope}에서 흐름이 좋게 보일 때는 상대의 반응을 빨리 결론으로 묶지 않아도 괜찮아요. 편안했던 순간을 조금 더 자주 만들면 마음도 자연스럽게 안정돼요.`,
        `${area} 좋은 분위기일수록 익숙한 신뢰를 가볍게 여기지 않는 편이 좋아요. 이미 잘 맞는 방식이 있다면 새로 꾸미기보다 차분히 반복해 보세요.`,
        `${scope}에서 좋은 분위기가 잡힐 때는 말의 양보다 말의 온도가 중요해요. 짧은 안부, 늦지 않는 답, 약속을 지키는 태도가 관계의 든든한 바탕이 돼요.`,
      ]);
    }
    if (stars === 3) {
      return pickVariant(ctx, 'scorePacing', [
        `${scope}에서 흐름이 보통으로 보인다는 말은 관계가 애매하다는 뜻이 아니라 조금씩 맞춰 갈 여지가 있다는 뜻이에요. 자주 반복되는 대화 장면 하나만 살펴도 다음 말이 훨씬 부드러워져요.`,
        `${scope}에서 흐름이 보통으로 보일 때는 큰 결론보다 작은 확인이 더 잘 맞아요. 상대를 맞히려 하기보다 내가 전하고 싶은 마음을 짧게 정리해 보세요.`,
        `${area} 좋은 쪽과 아쉬운 쪽이 함께 보인다면, 편했던 순간 하나와 불편했던 순간 하나만 나누어 봐도 충분해요. 그 정도의 확인만으로도 관계의 방향이 조금 선명해져요.`,
        `${scope}에서 보통으로 보이는 흐름은 마음이 식었다는 뜻이 아니라 서로 맞춰 볼 여지가 남았다는 뜻이에요. 오늘은 먼저 듣기와 짧게 말하기 중 하나만 골라도 충분해요.`,
        `${area} 무난하게 보일 때는 큰 약속보다 반복되는 말투와 시간을 보는 편이 좋아요. 편했던 대화 하나를 다시 만들면 관계의 감각이 더 선명해져요.`,
        `${scope}에서 관계가 중간처럼 느껴질 때는 답을 빨리 정하지 않아도 괜찮아요. 고마웠던 장면과 불편했던 장면을 하나씩 나누면 다음 말이 부드러워져요.`,
        `${scope}에서 흐름이 보통으로 보인다는 말은 더 가까워져야만 한다는 뜻이 아니에요. 지금 편한 거리와 조금 조심할 거리를 나누면 관계가 덜 부담스러워요.`,
        `${area} 무난하게 보일 때는 말의 양보다 반복되는 태도를 보는 편이 좋아요. 자주 지키는 약속 하나와 자주 놓치는 말투 하나를 확인해 보세요.`,
        `${scope}에서 보통으로 보이는 흐름은 서로를 다시 맞춰 볼 시간이 있다는 뜻이에요. 바로 결론을 내리기보다 다음 대화에서 확인할 말 하나만 정해 보세요.`,
        `${area} 흐름이 보통으로 보인다면 상대가 편했던 순간과 내가 편했던 순간을 함께 살펴보세요. 둘이 겹치는 장면이 관계를 이어 가는 기준이 돼요.`,
        `${scope}에서 무난하게 보인다는 말은 관계가 멈췄다는 뜻이 아니에요. 작은 안부와 약속을 꾸준히 지키면 흐름이 조금씩 더 또렷해져요.`,
        `${area} 좋은 점과 아쉬운 점이 함께 보일 때는 크게 판단하지 않아도 괜찮아요. 오늘은 덜 날카롭게 말할 방법 하나만 고르면 충분해요.`,
        `${scope}에서 흐름이 보통으로 보일 때는 상대를 바꾸려 하기보다 내가 반복하는 반응을 먼저 보세요. 내 반응이 부드러워지면 다음 대화도 편해져요.`,
        `${area} 보통의 흐름에서는 상대의 마음을 맞히려 하기보다 내가 자주 보이는 말투를 먼저 살펴보세요. 작은 반응이 달라지면 관계의 공기도 달라질 수 있어요.`,
        `${scope}에서 중간처럼 보이는 흐름은 서로의 반응을 다시 맞춰 볼 기회예요. 내가 자주 서두르는 말과 기다려 줄 수 있는 말을 나누면 다음 대화가 부드러워져요.`,
        `${area} 무난한 관계일수록 익숙한 반응을 그냥 넘기기 쉬워요. 먼저 고맙다고 말할 장면과 조금 늦춰도 되는 장면을 나누어 보면 부담이 줄어요.`,
        `${scope}에서 흐름이 보통일 때는 큰 변화보다 작은 말투 하나를 바꿔 보는 편이 좋아요. 내가 먼저 부드러워지는 지점이 보이면 상대와 맞출 길도 넓어져요.`,
        `${area} 무난한 흐름은 관계를 방치하라는 뜻이 아니에요. 고마운 말, 늦지 않는 답, 편한 시간을 작게 챙기면 관계가 더 안정돼요.`,
      ]);
    }
    return pickVariant(ctx, 'scorePacing', [
      `${scope}에서 흐름이 낮게 보일 때는 관계가 나빠진다고 단정하기보다 말의 속도를 늦추라는 신호로 보면 좋아요. 바로 설득하려 하기보다 짧게 듣고 쉬어 가면 부담이 줄어요.`,
      `${scope}에서 흐름이 낮게 보이면 큰 대화를 한 번에 끝내려 하지 않는 편이 좋아요. 오늘은 안부 한마디나 고마움 표현처럼 부담이 작은 말부터 남겨 보세요.`,
      `${area} 흐름이 낮게 보이더라도 마음이 정해졌다는 뜻은 아니에요. 서로 예민한 장면을 피하고 편한 시간에 다시 이야기하면 관계를 더 안전하게 살필 수 있어요.`,
      `${scope}에서 흐름이 낮게 보이면 관계를 포기하라는 뜻이 아니라 잠시 말의 온도를 낮추라는 신호로 보면 좋아요. 서운함을 바로 꺼내기보다 들을 시간, 쉬는 시간, 다시 말할 시간을 나누면 부담이 줄어요.`,
      `${area} 분위기가 무겁게 느껴질 때는 모든 이유를 그 자리에서 다 풀지 않아도 괜찮아요. 먼저 불편했던 장면 하나만 짚고, 대화를 쉬어 갈 시간을 남기면 다음 말이 부드러워져요.`,
      `${scope}에서 관계가 무겁게 느껴질 때는 상대를 바로 설득하기보다 대화의 크기를 줄이는 편이 좋아요. 안부, 사과, 고마움처럼 짧은 말부터 고르면 부담이 내려가요.`,
      `${area} 예민한 기운이 느껴지면 그날 결론을 내리지 않아도 괜찮아요. 서로 덜 날카로울 시간에 다시 이야기할 기준을 남겨 두면 관계를 더 안전하게 살필 수 있어요.`,
      `${scope}에서 마음이 잘 맞지 않는 날에는 결론보다 회복을 먼저 두어도 괜찮아요. 짧게 사과할 일, 고맙다고 말할 일, 잠시 미룰 일을 나누면 부담이 줄어요.`,
      `${scope}에서 흐름이 낮게 보일 때는 관계를 포기하라는 뜻이 아니에요. 오늘은 말의 양을 줄이고, 상대가 덜 부담스러워할 시간에 다시 확인하는 편이 좋아요.`,
      `${area} 긴장이 느껴지는 날에는 바로 해명하기보다 서로의 속도를 낮추는 일이 먼저예요. 짧게 듣고 잠시 쉬어 가면 다음 대화가 훨씬 안전해져요.`,
      `${scope}에서 낮은 흐름은 마음이 끝났다는 표시보다 대화를 작게 나누라는 신호에 가까워요. 부탁, 사과, 안부 중 하나만 골라도 관계의 부담이 줄어요.`,
      `${area} 서운함이 커질 때는 그 자리에서 모두 설명하려 하지 않아도 괜찮아요. 오늘은 덜 날카로운 말 하나와 쉬어 갈 시간 하나를 정해 보세요.`,
      `${scope}에서 관계가 예민하게 느껴지면 먼저 확인할 말과 나중에 해도 되는 말을 나누는 편이 좋아요. 말의 순서가 생기면 오해도 줄어들어요.`,
      `${area} 낮게 보이는 흐름은 가까운 사람이 멀어진다는 단정이 아니에요. 잠시 거리를 두고 마음이 가라앉은 뒤 짧은 안부부터 다시 시작해도 충분해요.`,
      `${scope}에서 분위기가 무거울수록 큰 약속보다 작은 예의가 더 중요해요. 늦지 않는 답, 고마운 말, 기다려 주는 태도가 부담을 줄이고 관계를 다시 편하게 만들 수 있어요.`,
      `${area} 불편한 장면이 보이면 바로 고치려 하기보다 반복되는 말투를 먼저 살펴보세요. 어떤 말에서 긴장이 생기는지 알면 다음 대화가 덜 흔들려요.`,
    ]);
  }
  if (ctx.category === 'study_document' && stars >= 4) {
    return pickVariant(ctx, 'scorePacing', [
      `${scope}에서 흐름이 좋게 보일 때는 서류를 더 많이 만들기보다 이미 잘 정리된 기준을 지키는 편이 좋아요. 날짜, 금액, 제출처처럼 자주 쓰는 칸을 같은 방식으로 남기면 다음 확인이 쉬워져요.`,
      `${area} 좋은 흐름이 보이면 자료를 한꺼번에 늘리기보다 다시 찾기 쉬운 이름과 위치를 먼저 정해 보세요. 기록이 잘 찾아지면 중요한 제출도 훨씬 안정돼요.`,
      `${scope}에서 점수가 높게 느껴질 때는 결과보다 다시 쓸 수 있는 검토 순서를 남기는 편이 실속 있어요. 잘 맞았던 확인 순서를 적어 두면 다음 문서도 덜 흔들려요.`,
      `${area} 좋은 기세가 있을수록 서류를 빠르게 끝내기보다 빠뜨리기 쉬운 칸을 먼저 고정해 보세요. 이름, 날짜, 금액을 확인하는 습관이 좋은 흐름을 오래 지켜 줘요.`,
      `${scope}에서 흐름이 좋게 보여도 모든 빈칸을 한 번에 채우려 하지 않아도 돼요. 지금 가장 잘 확인된 항목 하나를 기준으로 삼으면 다음 정리가 더 또렷해져요.`,
      `${area} 좋은 흐름은 더 많이 밀어붙이라는 신호라기보다 확인 방식이 잘 맞고 있다는 뜻에 가까워요. 오늘 편했던 정리 순서와 보관 위치를 남겨 보세요.`,
      `${scope}에서 점수가 높게 느껴질 때는 새 문서를 늘리기보다 이미 맞아떨어진 확인 방식을 저장해 두세요. 이름 붙이는 법, 보관 위치, 다시 볼 날짜가 정리되면 다음 제출도 편해져요.`,
      `${area} 흐름이 좋게 보이면 결과를 빨리 끝내기보다 다시 검토할 기준을 짧게 남기는 편이 좋아요. 같은 방식으로 확인할 수 있으면 좋은 흐름이 실수 없이 이어져요.`,
      `${scope}에서 좋은 기세가 있을수록 중요한 문서를 한곳에만 두지 말고 원본, 사진, 확인할 사람을 나누어 보세요. 안전장치가 나뉘면 급한 순간에도 덜 흔들려요.`,
      `${area} 흐름이 좋게 보이면 보관 방식도 한 번 더 단단히 해 두면 좋아요. 원본은 안전한 곳에 두고, 사진본과 확인할 사람을 정하면 나중에 찾기 쉬워요.`,
      `${scope}에서 좋은 흐름은 문서를 빨리 끝내라는 뜻보다 다시 꺼내 볼 길을 분명히 하라는 뜻에 가까워요. 원본, 사본, 확인받을 사람을 나누면 훨씬 안정적이에요.`,
      `${area} 좋은 기세가 있을 때는 서류를 많이 쌓기보다 찾는 길을 단순하게 만들어 보세요. 어디에 있고 누가 확인했는지만 남겨도 다음 판단이 편해져요.`,
    ]);
  }
  if ((ctx.category === 'academic' || ctx.category === 'study_document') && stars >= 4) {
    return pickVariant(ctx, 'scorePacing', [
      `${scope}에서 흐름이 좋게 보일 때는 욕심을 한꺼번에 늘리기보다 지금 잘 맞는 공부 방식을 지키는 편이 좋아요. 작은 약속을 놓치지 않으면 배움이 더 오래 이어져요.`,
      `${area} 흐름이 좋게 보이더라도 모든 내용을 한 번에 끝낼 필요는 없어요. 가장 이해가 잘 된 부분을 짧게 다시 적어 두면 다음 공부가 훨씬 쉬워져요.`,
      `${scope}에서 좋은 흐름은 더 많이 밀어붙이라는 신호라기보다 잘 맞는 공부 리듬을 알아차리라는 뜻에 가까워요. 오늘 맞았던 시간과 방법을 남겨 보세요.`,
      `${area} 점수가 높게 느껴질 때는 자신감을 기록으로 옮기는 편이 좋아요. 새로 알게 된 것 하나와 다시 볼 것 하나만 적어도 배움이 단단해져요.`,
      `${scope}에서 흐름이 좋게 보일 때는 어려운 것을 더 얹기보다 이미 이해한 내용을 자기 말로 정리해 보세요. 그렇게 남긴 한 줄이 다음 단계의 기준이 돼요.`,
      `${area} 좋은 기세가 있을수록 비교보다 반복이 더 중요해요. 오늘 잘 풀린 방식 하나를 내일도 다시 해 볼 수 있게 작게 남겨 보세요.`,
      `${scope}에서 좋은 흐름은 공부량을 무조건 늘리라는 뜻이 아니에요. 이해가 잘 된 부분을 짧게 설명해 보면 다음 단계로 갈 기준이 더 또렷해져요.`,
      `${area} 점수가 높게 느껴질 때는 새 범위를 넓히기보다 성공한 방식을 기록하는 편이 좋아요. 어떤 시간, 어떤 장소, 어떤 순서가 맞았는지 한 줄만 남겨 보세요.`,
      `${scope}에서 좋은 기세가 있을수록 기초를 가볍게 반복하는 힘이 커져요. 이미 맞힌 문제나 잘 정리한 노트를 다시 보면 자신감이 더 안정돼요.`,
      `${area} 흐름이 좋게 보여도 모든 빈칸을 한 번에 채우려 하지 않아도 돼요. 지금 이해한 한 가지를 내 말로 설명해 보면 다음 공부의 출발점이 더 또렷해져요.`,
      `${scope}에서 점수가 높게 느껴질 때는 결과보다 다시 쓸 수 있는 방법을 남기는 편이 실속 있어요. 잘 풀린 순서를 적어 두면 다음에도 그 방식을 꺼내 쓰기 쉬워요.`,
      `${area} 좋은 기세가 있을 때는 많이 해낸 양보다 다시 반복할 수 있는 방식을 남기는 편이 좋아요. 잘 맞았던 순서를 짧게 적어 두면 다음 공부가 쉬워져요.`,
      `${scope}에서 흐름이 좋게 보일수록 성공한 방법을 기록해 두세요. 어떤 시간, 어떤 설명, 어떤 순서가 맞았는지 알면 다음에도 자신감이 이어져요.`,
      `${area} 점수가 높게 느껴지는 때에는 더 많이 붙잡기보다 잘 풀린 조건을 남기는 편이 좋아요. 그 조건이 다음 배움의 출발점이 돼요.`,
      `${scope}에서 좋은 흐름은 공부량을 늘리라는 압박이 아니에요. 잘 이해된 과정을 한 줄로 남기면 다음에 같은 방법을 다시 쓸 수 있어요.`,
      `${area} 좋은 흐름이 보이면 어려운 목표를 더 얹기보다 배운 내용을 생활 속 말로 바꿔 보세요. 내 말로 바뀐 내용은 오래 남는 기준이 돼요.`,
    ]);
  }
  if ((ctx.category === 'academic' || ctx.category === 'study_document') && stars <= 2) {
    if (ctx.category === 'study_document') {
      return pickVariant(ctx, 'scorePacing', [
        `${scope}에서 흐름이 낮게 보일 때는 새 서류를 더 만들기보다 이미 있는 기록을 먼저 정리하는 편이 좋아요. 날짜, 금액, 제출할 곳처럼 확인할 칸을 줄이면 실수가 줄어요.`,
        `${area} 낮게 보이는 흐름은 기록이 틀렸다는 뜻이 아니라 다시 확인할 순서를 세우라는 신호예요. 오늘은 가장 급한 서류 하나와 나중에 볼 서류 하나만 나누어 보세요.`,
        `${scope}에서 흐름이 낮게 보이면 기억에 맡기지 말고 눈에 보이는 표시를 남기는 편이 좋아요. 파일 이름, 저장 위치, 마감일 중 하나만 또렷해져도 부담이 내려가요.`,
        `${area} 낮게 보이는 흐름은 속도를 낮추라는 신호로 보면 좋아요. 보내기 전에 한 번 더 읽고, 가능하면 믿을 만한 사람에게 빠진 부분을 확인받아 보세요.`,
        `${scope}에서 흐름이 낮게 보일 때는 정리 범위를 크게 잡지 않아도 돼요. 오늘은 버릴 것, 남길 것, 다시 확인할 것만 나누면 충분해요.`,
        `${area} 낮게 보이는 흐름은 서류가 엉망이라는 뜻이 아니에요. 우선 이름, 날짜, 보관 위치 중 하나만 바로잡아도 다음 확인이 훨씬 쉬워져요.`,
        `${scope}에서 흐름이 낮게 보이면 혼자 끝내려 하지 말고 확인받을 항목을 작게 정해 보세요. 한 사람에게 한 가지를 물어보는 정도만으로도 실수를 줄일 수 있어요.`,
        `${area} 낮은 흐름은 속도를 잠시 낮추라는 신호에 가까워요. 급한 제출과 기다려도 되는 기록을 나누면 마음이 덜 복잡해져요.`,
      ]);
    }
    return pickVariant(ctx, 'scorePacing', [
      `${scope}에서 흐름이 낮게 보일 때는 공부가 안 된다고 단정하기보다 범위를 줄이라는 신호로 보면 좋아요. 새 내용을 넓히기보다 이미 배운 부분 하나를 다시 확인해 보세요.`,
      `${area} 낮게 보이는 흐름은 나쁜 결과가 정해졌다는 뜻이 아니에요. 오늘은 어려운 단원보다 다시 볼 단서 하나, 짧은 문제 하나처럼 손에 잡히는 것부터 챙기면 좋아요.`,
      `${scope}에서 낮게 보이는 흐름은 실력이 부족하다는 판정이 아니에요. 이럴 때는 어려운 범위를 줄이고 다시 시작할 단서 하나를 남기는 것이 더 현실적이에요.`,
      `${area} 흐름이 낮게 보일 때는 공부를 크게 고치려 하기보다 시작점을 작게 잡아 보세요. 한 줄 읽기, 한 문제 풀기처럼 손에 잡히는 크기가 좋아요.`,
      `${scope}에서 낮은 흐름은 쉬어 가며 다시 볼 순서를 잡으라는 신호에 가까워요. 오늘 끝낼 작은 범위와 나중에 물어볼 질문을 나누면 부담이 줄어요.`,
      `${area} 낮게 보인다고 해서 배움이 끊긴 것은 아니에요. 모르는 부분을 지우려 하기보다 다음에 다시 만날 표시를 남기면 이어 가기 쉬워요.`,
      `${scope}에서 흐름이 낮게 보이면 오래 앉아 있는 시간보다 시작하기 쉬운 크기가 더 중요해요. 한 단락, 한 문제, 한 줄 요약처럼 작게 잡으면 다시 이어 가기 쉬워요.`,
      `${area} 낮게 보이는 흐름은 속도를 낮추라는 신호로 보면 좋아요. 모르는 부분을 없애려 애쓰기보다 다시 만날 수 있게 표시해 두면 다음 공부가 훨씬 덜 막막해요.`,
      `${scope}에서 흐름이 낮게 보일 때는 비교보다 회복이 먼저예요. 쉬운 범위를 하나 끝내고, 물을 마시거나 잠깐 움직인 뒤 다시 보면 부담이 줄어요.`,
      `${area} 흐름이 낮게 보일 때는 남보다 늦었다고 보기보다 다시 시작할 크기를 줄여 보세요. 오늘은 한 줄 읽기, 한 문제 표시하기처럼 작게 남겨도 충분해요.`,
      `${scope}에서 낮게 보이는 흐름은 공부를 포기하라는 말이 아니에요. 어려운 부분을 잠시 접고 다시 볼 단서 하나만 남기면 다음 시작이 쉬워져요.`,
      `${area} 흐름이 낮게 보이면 오래 버티기보다 쉬운 단계를 먼저 끝내는 편이 좋아요. 작은 성공 하나가 생기면 다음 범위도 덜 무겁게 느껴져요.`,
      `${scope}에서 낮은 흐름은 속도를 늦추라는 신호에 가까워요. 오늘은 모르는 부분을 없애려 하지 말고, 나중에 물어볼 질문 하나만 적어 보세요.`,
      `${area} 낮게 보이는 흐름은 실력이 정해졌다는 뜻이 아니에요. 잠깐 쉬고 다시 볼 단서를 남기면 공부가 끊기지 않고 이어져요.`,
    ]);
  }
  if (ctx.category === 'study_document' && stars === 3) {
    return pickVariant(ctx, 'scorePacing', [
      `${scope}에서 흐름이 보통으로 보일 때는 새 서류를 더 늘리기보다 제출 범위와 검토 순서를 먼저 줄여 보세요. 확인할 칸이 작아지면 실수도 줄어들어요.`,
      `${area} 보통으로 보이는 흐름은 문서가 막혔다는 뜻이 아니에요. 지금은 제출할 것, 다시 볼 것, 잠시 미룰 것을 나누며 검토를 앞당기는 편이 좋아요.`,
      `${scope}에서 흐름이 보통으로 보인다면 기록을 많이 쌓기보다 확인할 순서를 짧게 만드는 일이 먼저예요. 이름, 날짜, 금액처럼 빠뜨리기 쉬운 것부터 보세요.`,
      `${area} 무난하게 보일 때는 큰 결론보다 작은 검토가 더 중요해요. 제출 범위를 줄이고 다시 볼 자료를 표시하면 문서 부담이 훨씬 내려가요.`,
      `${scope}에서 흐름이 보통으로 보일 때는 서류를 방치하라는 뜻이 아니에요. 검토를 부탁할 사람과 다시 볼 항목을 정하면 충돌이나 누락을 작게 줄일 수 있어요.`,
      `${area} 흐름이 보통으로 보인다면 속도를 조금 낮추고 검토 단계를 앞으로 당겨 보세요. 작은 오류를 먼저 잡으면 다음 제출이 훨씬 편해져요.`,
      `${scope}에서 무난하게 보일 때는 자료를 더 모으기보다 이미 있는 기록의 빈칸을 확인하는 편이 좋아요. 빈칸이 보이면 보완할 순서도 자연스럽게 정해져요.`,
      `${area} 아주 강한 신호가 아니어도 서류 관리는 충분히 좋아질 수 있어요. 오늘은 제출 범위 하나를 줄이고, 확인할 문서 하나를 먼저 보는 정도면 충분해요.`,
      `${scope}에서 흐름이 보통으로 보일 때는 새 자료를 늘리기보다 이름, 날짜, 위치를 한 번 더 맞춰 보세요. 기본 칸이 맞으면 다음 정리도 덜 흔들려요.`,
      `${area} 보통으로 보이는 흐름은 급히 끝내라는 신호가 아니에요. 제출할 것과 보관할 것을 나누고, 헷갈리는 칸만 다시 보면 충분해요.`,
      `${scope}에서 무난하게 보일 때는 문서를 한꺼번에 정리하려 하지 않아도 돼요. 오늘 다시 찾을 자료 하나와 확인받을 항목 하나만 정해도 좋아요.`,
      `${area} 흐름이 보통으로 보인다면 지금 필요한 기록과 나중에 볼 기록을 나누어 보세요. 구분이 생기면 서류가 생활 안에서 더 가볍게 느껴져요.`,
      `${scope}에서 보통 흐름은 정리 기준을 다시 잡기 좋은 때예요. 지금 제출할 것, 보관할 것, 다음에 확인할 것을 나누면 문서 부담이 줄어요.`,
      `${area} 무난하게 보일 때는 서류를 한꺼번에 끝내려 하지 않아도 돼요. 오늘 필요한 기록 하나와 나중에 볼 기록 하나만 나누어도 충분해요.`,
      `${scope}에서 흐름이 중간처럼 느껴질 때는 우선순위가 중요해요. 급한 기록과 기다려도 되는 기록을 나누면 실수도 줄고 마음도 정리돼요.`,
      `${scope}에서 보통 점수는 기록을 방치하라는 뜻이 아니에요. 작은 오류를 잡을 시간과 확인해 줄 사람을 정하면 훨씬 안정돼요.`,
      `${area} 무난한 흐름일수록 정리 기준을 짧게 두는 편이 좋아요. 파일 이름, 보관 위치, 다시 볼 날짜 중 하나만 또렷해져도 부담이 줄어요.`,
    ]);
  }
  if ((ctx.category === 'academic' || ctx.category === 'study_document') && stars === 3) {
    return pickVariant(ctx, 'scorePacing', [
      `${scope}에서 흐름이 보통으로 보일 때는 성적을 단번에 올리려 하기보다 헷갈린 부분을 표시하는 일이 먼저예요. 이번에 다시 볼 한 단원만 정해도 다음 공부가 훨씬 가벼워져요.`,
      `${area} 흐름이 보통으로 보인다는 말은 배움이 멈췄다는 뜻이 아니에요. 잘 되는 부분과 다시 볼 부분을 한 줄씩 나누면 공부 방향이 더 또렷해져요.`,
      `${scope}에서 흐름이 보통으로 보인다면 공부 시간을 갑자기 늘리기보다 시작 순서를 작게 정해 보세요. 쉬운 문제 하나, 짧은 문단 하나처럼 손에 잡히는 범위가 좋아요.`,
      `${area} 보통으로 보이는 흐름은 기초를 다시 다질 수 있다는 신호에 가까워요. 맞힌 문제와 틀린 문제를 함께 보며 왜 그런지 한 문장으로 남겨 보세요.`,
      `${scope}에서 무난하게 보인다는 말은 더 애써야만 한다는 뜻이 아니에요. 지금 유지할 공부 습관 하나와 줄일 부담 하나를 나누면 오래 가는 리듬이 생겨요.`,
      `${area} 아주 강한 신호가 아니어도 충분히 쓸모가 있어요. 오늘 배운 내용을 내 말로 바꿔 적고, 내일 다시 볼 단서 하나를 남기는 정도면 좋아요.`,
      `${scope}에서 흐름이 보통으로 보일 때는 모르는 부분을 없애려 하기보다 다시 만날 수 있게 표시하는 편이 좋아요. 표시가 남아 있으면 다음 공부가 막연하지 않아요.`,
      `${area} 흐름이 보통으로 보인다면 잘한 부분을 먼저 확인해도 괜찮아요. 이미 이해한 내용을 기준으로 삼으면 부족한 부분을 고치는 일도 덜 부담스러워져요.`,
      `${scope}에서 흐름이 보통으로 보일 때는 새 범위를 넓히기보다 헷갈린 부분을 다시 만날 준비를 해 두세요. 표시가 있으면 다음 공부가 훨씬 현실적으로 이어져요.`,
      `${area} 보통으로 보이는 흐름은 방향을 다시 잡기 좋은 구간이에요. 잘 맞는 시간대와 자주 막히는 내용을 나누면 공부 계획도 덜 막연해져요.`,
      `${scope}에서 무난하게 보인다면 지금까지 된 부분을 인정하고, 아직 어려운 부분은 작게 접어 두는 편이 좋아요. 둘을 나누면 배움이 오래 이어져요.`,
      `${area} 흐름이 보통으로 보인다는 말은 공부가 애매하다는 뜻이 아니에요. 다시 볼 단서 하나와 오늘 끝낼 범위 하나만 있어도 방향이 선명해져요.`,
      `${scope}에서 보통으로 보이는 흐름은 꾸준함을 다시 세울 수 있다는 뜻이에요. 한 번에 많이 하기보다 다음에도 반복할 수 있는 크기를 남겨 보세요.`,
      `${area} 보통으로 보이는 흐름은 공부를 크게 바꾸라는 말이 아니에요. 오늘 맞았던 방식 하나와 다시 볼 부분 하나만 남기면 충분해요.`,
      `${scope}에서 무난하게 보일 때는 속도를 급히 올리기보다 계속할 수 있는 크기를 찾는 편이 좋아요. 다음에도 할 수 있는 공부 단위가 보이면 흐름이 안정돼요.`,
      `${scope}에서 흐름이 보통으로 보인다는 말은 지금 리듬을 정리할 기회가 있다는 뜻이에요. 공부 시간, 집중되는 장소, 다시 볼 내용을 하나씩 나누면 방향이 분명해져요.`,
      `${area} 보통으로 보이는 흐름은 크게 흔들리지 않는 대신 꾸준함을 시험하는 구간이에요. 오늘은 새 범위를 넓히기보다 어제 헷갈린 내용을 한 번 더 보는 쪽이 좋아요.`,
      `${scope}에서 무난하게 보인다는 말은 지금 방식이 아주 틀렸다는 뜻이 아니에요. 잘 맞는 공부법은 남기고, 오래 미뤄 둔 부분 하나만 작게 다루면 충분해요.`,
      `${area} 아주 강한 신호가 아니어도 배울 수 있는 단서는 남아 있어요. 오늘은 틀린 이유를 길게 분석하기보다 다시 풀 문제 하나와 쉬어 갈 시간을 정해 보세요.`,
      `${scope}에서 흐름이 보통으로 보일 때는 남과 비교하기보다 내 기록을 보는 편이 좋아요. 지난번보다 덜 헷갈린 부분 하나만 찾아도 공부가 이어질 힘이 생겨요.`,
      `${area} 흐름이 보통으로 보인다면 공부가 애매하다는 뜻보다 조절할 여지가 있다는 뜻에 가까워요. 시작 시간을 조금 당기거나 범위를 줄이는 식으로 부담을 낮춰 보세요.`,
    ]);
  }
  if (ctx.category === 'career' && ctx.period === 'life' && (!isMinorReader(ctx) || isFutureAdultLifeForMinorReader(ctx))) {
    if (stars >= 4) {
      return pickVariant(ctx, 'scorePacing', [
        `${scope}에서 좋은 흐름은 더 많이 해내라는 압박이 아니라 이미 쌓인 신뢰가 어디에서 생겼는지 보라는 신호예요. 잘 끝낸 일과 함께 볼 사람을 나누면 장점이 오래 남아요.`,
        `${area} 좋은 흐름이 보이면 일을 더 키우기보다 오래 반복할 마무리 방식을 남기는 편이 좋아요. 어떤 방식으로 신뢰를 얻었는지 보이면 다음 선택도 안정돼요.`,
        `${scope}에서 점수가 높게 느껴질 때는 큰 이름을 좇기보다 내게 맞았던 일의 방식과 도와준 사람을 함께 보세요. 좋은 흐름은 그 연결을 오래 지킬 때 더 선명해져요.`,
      ]);
    }
    if (stars === 3) {
      return pickVariant(ctx, 'scorePacing', [
        `${scope}에서 무난하게 보일 때는 큰 이름보다 오래 남을 마무리 방식을 보는 편이 좋아요. 쌓인 신뢰와 함께 볼 사람을 나누면 남은 선택이 덜 막연해져요.`,
        `${area} 보통으로 보이는 흐름은 멈춰 있다는 뜻이 아니에요. 앞으로도 지킬 일의 원칙과 이제 줄여도 되는 부담을 구분하면 지금까지 쌓은 시간이 더 안정적으로 이어져요.`,
        `${scope}에서 흐름이 보통으로 보인다는 말은 다음 선택을 다시 정리할 여지가 있다는 뜻이에요. 잘 끝낸 일, 함께 볼 사람, 남길 기록을 나누면 기준이 또렷해져요.`,
      ]);
    }
    return pickVariant(ctx, 'scorePacing', [
      `${scope}에서 낮게 보이는 흐름은 실패가 정해졌다는 말이 아니에요. 일의 무게를 줄이고 함께 볼 사람을 정하면 부담이 천천히 내려가요.`,
      `${area} 낮게 보이는 흐름은 더 많이 버티라는 말보다 무게를 나누라는 신호에 가까워요. 직접 챙길 기준, 나누어 맡길 범위, 남길 기록을 구분해 보세요.`,
      `${scope}에서 흐름이 낮게 보일 때는 큰 결정을 혼자 밀어붙이지 않는 편이 좋아요. 확인할 조건과 함께 볼 사람을 나누면 선택이 더 차분해져요.`,
    ]);
  }
  if (ctx.category === 'career' && ctx.period === 'thisYear') {
    if (stars >= 4) {
      return pickVariant(ctx, 'scorePacing', [
        `좋은 흐름은 올해 더 많이 벌리라는 압박이 아니라 이미 만든 성과를 밖에서 볼 수 있게 남기라는 신호예요. 공개할 결과와 함께 검토할 사람을 나누면 기회가 더 선명해져요.`,
        `좋은 흐름이 보이면 새 제안을 모두 잡기보다 올해 완성할 결과를 먼저 정해 보세요. 결과가 문서나 발표처럼 보이는 형태로 남으면 다음 선택도 안정돼요.`,
        `점수가 높게 느껴질 때는 큰 이름보다 결과의 쓰임을 보세요. 누가 이해하고 활용할 수 있는지까지 적으면 성과가 오래 남아요.`,
      ]);
    }
    if (stars === 3) {
      return pickVariant(ctx, 'scorePacing', [
        `무난하게 보일 때는 새 일을 넓히기보다 12월에 보여 줄 결과를 먼저 정하는 편이 좋아요. 보이는 결과, 같이 검토할 사람, 잠시 미룰 제안을 나누면 기준이 또렷해져요.`,
        `보통으로 보이는 흐름은 멈춰 있다는 뜻이 아니에요. 완성할 결과와 다시 볼 기록을 나누면 다음 선택이 덜 막연해져요.`,
        `흐름이 보통으로 보인다는 말은 이 시기에 이미 잘된 일과 밖으로 꺼낼 일을 나누어 보라는 뜻에 가까워요.`,
      ]);
    }
    return pickVariant(ctx, 'scorePacing', [
      `낮게 보이는 흐름은 실패를 단정하라는 말이 아니에요. 결과의 크기를 줄이고 같이 검토할 사람을 정하는 편이 좋아요.`,
      `낮게 보이는 흐름은 더 많이 버티라는 말보다 선택 폭을 좁혀 보라는 신호에 가까워요. 꼭 남길 결과와 잠시 미룰 제안을 구분해 보세요.`,
      `흐름이 낮게 보일 때는 큰 선택을 혼자 밀어붙이지 않는 편이 좋아요. 확인할 조건과 같이 검토할 사람을 정하면 한 해의 방향이 더 차분해져요.`,
    ]);
  }
  if (ctx.category === 'career' && stars === 3) {
    return pickVariant(ctx, 'scorePacing', [
      `${scope}에서 흐름이 보통으로 보인다는 말은 일이 애매하다는 뜻이 아니에요. 맡을 일, 미룰 일, 확인받을 일을 나누면 점수보다 더 분명한 기준이 생겨요.`,
      `${area} 보통으로 보이는 흐름은 지금 역할을 다시 정리할 기회에 가까워요. 오늘 끝낼 한 가지와 도움을 청할 한 가지를 나누면 부담이 줄어요.`,
      `${scope}에서 무난하게 보인다는 말은 크게 밀어붙이라는 뜻이 아니에요. 이미 잘되는 일은 유지하고, 자주 막히는 부분만 작게 조정해 보세요.`,
      `${area} 흐름이 보통으로 보일 때는 성과를 급하게 증명하기보다 순서를 또렷하게 두는 편이 좋아요. 급한 일과 중요한 일을 따로 적으면 실수가 줄어요.`,
      `${scope}에서 흐름이 보통으로 보일 때는 일을 더 크게 벌리기보다 처리 순서를 다시 세우기 좋은 때예요. 먼저 끝낼 일과 확인받을 일을 나누면 책임이 훨씬 가벼워져요.`,
      `${area} 무난하게 보일 때는 성과를 바로 보여 주려 애쓰기보다 역할의 경계를 먼저 정해 보세요. 내가 맡을 일과 함께 볼 일이 나뉘면 움직임도 안정돼요.`,
      `${scope}에서 중간처럼 보이는 흐름은 새 목표보다 현재 맡은 일의 구조를 먼저 보라는 뜻이에요. 마감, 협의할 사람, 내 체력을 따로 보면 다음 행동이 또렷해져요.`,
      `${area} 보통 점수는 멈추라는 뜻이 아니라 정리할 시간을 주는 신호예요. 일의 순서를 다시 적고 도움받을 지점을 정하면 부담이 줄어요.`,
      `${scope}에서 무난하게 보일 때는 잘되는 일을 더 키우기보다 막히는 부분 하나를 작게 풀어 보세요. 작은 정리가 다음 성과를 준비하는 바탕이 돼요.`,
      `${scope}에서 흐름이 보통으로 보인다면 새 일을 넓히기보다 지금 맡은 책임을 보기 쉬운 크기로 나누어 보세요. 작게 끝나는 일이 하나 생기면 체감도 훨씬 선명해져요.`,
      `${area} 아주 강한 신호가 아니어도 일의 기준을 세우는 데는 충분해요. 오늘은 계속할 일 하나와 덜어낼 부담 하나만 정해도 방향이 잡혀요.`,
      `${scope}에서 무난하게 보일 때는 내가 혼자 붙잡은 일이 너무 많지 않은지 살피면 좋아요. 나눌 수 있는 일을 찾으면 일의 무게가 현실적으로 줄어요.`,
      `${area} 무난한 흐름일수록 혼자 책임을 전부 떠안는 방식이 오히려 비효율적일 수 있어요. 함께 볼 일과 내가 끝낼 일을 나누면 결과도 더 안정돼요.`,
      `${scope}에서 흐름이 보통으로 보일 때는 책임의 양보다 나눌 수 있는 구조를 먼저 보세요. 도움받을 부분이 보이면 일의 흐름도 덜 막혀요.`,
      `${area} 흐름이 무난할수록 익숙한 책임을 계속 혼자 들기 쉬워요. 맡을 일과 넘길 일을 구분하면 일의 무게가 현실적인 크기로 줄어요.`,
      `${scope}에서 무난하게 보일 때는 더 많이 맡는 것보다 책임을 정리하는 일이 먼저예요. 함께 확인할 사람과 내가 처리할 범위를 나누면 판단이 쉬워져요.`,
      `${area} 보통의 흐름에서는 내가 붙잡은 일의 수를 줄이는 것만으로도 체감이 달라질 수 있어요. 꼭 내 손에서 끝낼 일과 기준만 남길 일을 구분해 보세요.`,
      `${area} 흐름이 보통으로 보인다는 말은 관리할 여지가 있다는 뜻이에요. 마감, 역할, 컨디션을 나누어 보면 다음 행동이 더 쉽게 정해져요.`,
      `${scope}에서 무난한 흐름일수록 할 일을 더 늘리기보다 맡은 범위를 또렷하게 두는 편이 좋아요. 오늘 직접 할 일과 넘겨도 되는 일을 나누면 책임의 무게가 줄어요.`,
      `${area} 보통 점수는 성과가 부족하다는 말이 아니에요. 일정을 다시 보고 확인받을 지점 하나를 정하면 지금 역할이 더 선명해져요.`,
      `${scope}에서 일이 중간처럼 느껴질 때는 새 과제를 더 얹지 말고 마감과 사람, 내 컨디션을 나누어 보세요. 기준이 보이면 움직임도 가벼워져요.`,
      `${area} 흐름이 무난할수록 익숙한 책임을 자동으로 떠안기 쉬워요. 꼭 내가 해야 할 일과 같이 나눌 일을 구분하면 일의 균형이 좋아져요.`,
      `${scope}에서 보통으로 보이는 흐름은 다시 정렬할 여지가 있다는 뜻이에요. 오늘은 성과를 증명하기보다 일이 막히는 지점 하나를 찾아 작게 풀어 보세요.`,
      `${area} 아주 강한 흐름이 아니어도 역할을 다듬기에는 충분해요. 계속 맡을 일, 도움을 받을 일, 잠시 미룰 일을 나누면 하루가 덜 무거워져요.`,
    ]);
  }
  if (ctx.category === 'expression_children' && stars === 3) {
    return pickVariant(ctx, 'scorePacing', [
      `${scope}에서 흐름이 보통으로 보인다면 좋은 쪽과 아쉬운 쪽이 함께 있다는 뜻으로 보면 돼요. 불편했던 반응은 작게 줄이고, 계속하고 싶은 방식은 천천히 남겨 보세요.`,
      `${area} 보통으로 보이는 흐름은 표현이 막혔다는 뜻이 아니에요. 보여 줄 것과 혼자 다듬을 것을 나누면 부담이 줄고 다음 시도도 덜 흔들려요.`,
      `${scope}에서 무난하게 보인다는 말은 크게 증명하라는 뜻이 아니에요. 오늘은 말, 사진, 메모 중 가장 작게 꺼낼 수 있는 방식 하나만 확인해 보세요.`,
      `${area} 흐름이 보통으로 보일 때는 새 작업을 더 늘리기보다 속도를 조절하는 편이 좋아요. 마음이 불편한 부분과 계속하고 싶은 부분을 한 줄씩 나누면 충분해요.`,
      `${scope}에서 보통으로 보이는 흐름은 완성보다 조절이 필요한 구간이에요. 부담스러운 기준은 덜어 내고, 손에 익은 표현부터 작게 이어 가 보세요.`,
      `${area} 아주 강한 신호가 아니어도 표현의 단서는 남아 있어요. 오늘은 비교를 줄이고, 다시 꺼내 보고 싶은 흔적 하나만 조심스럽게 남겨 보세요.`,
      `${scope}에서 흐름이 보통으로 보인다면 반응을 바로 결론으로 보지 않는 편이 좋아요. 불편한 말은 한 박자 늦추고, 도움이 된 반응만 다음 작업에 작게 붙여 보세요.`,
      `${area} 무난하게 보일 때는 표현을 방치하라는 뜻이 아니에요. 계속할 방식과 잠시 쉬어 갈 방식을 나누면 창의의 부담이 훨씬 줄어요.`,
    ]);
  }
  if (ctx.category === 'career' && stars <= 2) {
    return pickVariant(ctx, 'scorePacing', [
      `${scope}에서 흐름이 낮게 보일 때는 새로 벌리는 일보다 이미 있는 일을 가볍게 정리하는 편이 좋아요. 속도를 낮추면 실수와 피로를 줄이는 데 도움이 돼요.`,
      `${area} 낮게 보이는 흐름은 일이 틀어졌다는 뜻이 아니라 순서를 다시 잡으라는 신호예요. 오늘은 급한 일 하나와 미뤄도 되는 일 하나만 나누어 보세요.`,
      `${scope}에서 흐름이 낮게 보이면 큰 결정을 바로 밀어붙이지 않는 편이 좋아요. 먼저 확인할 사람과 다시 볼 자료를 정하면 불안이 줄어요.`,
      `${area} 낮게 보이는 흐름은 더 많이 버티라는 말이 아니에요. 맡은 일을 줄이고, 도움을 청할 부분을 정하면 실제 부담이 내려가요.`,
      `${scope}에서 흐름이 낮게 보일 때는 성과보다 회복 가능한 일의 크기를 먼저 보세요. 작게 끝낼 수 있는 일부터 정리하면 다시 움직일 힘이 생겨요.`,
      `${area} 흐름이 낮게 보이더라도 실패가 정해진 것은 아니에요. 오늘은 새 약속을 늘리기보다 이미 잡힌 약속의 시간과 범위를 확인해 보세요.`,
      `${scope}에서 낮게 보이는 흐름은 잠시 속도를 낮추라는 신호에 가까워요. 마감, 사람, 몸 상태 중 가장 흔들리는 한 가지부터 붙잡으면 충분해요.`,
      `${area} 일이 무겁게 느껴질 때는 혼자 책임을 전부 떠안지 않는 것이 중요해요. 확인받을 일과 내려놓을 일을 나누면 다음 선택이 더 안전해져요.`,
    ]);
  }
  if (ctx.category === 'movement' && ctx.period === 'life' && stars <= 2) {
    return pickVariant(ctx, 'sourceMovementFarCaution', [
      `${scope}에서 낮게 보이는 흐름은 이동을 막는 말이 아니에요. 먼 곳보다 익숙한 길, 연락할 사람, 쉬어 갈 여유를 먼저 정하면 변화가 덜 부담스러워요.`,
      `${area} 흐름이 낮게 보일 때는 큰 변화보다 자주 다니는 길을 편하게 만드는 쪽이 좋아요. 줄일 피로와 남길 기준을 나누면 작은 변화도 안전해요.`,
      `${scope}에서 낮은 흐름은 속도를 줄이라는 신호에 가까워요. 새 환경을 감당할 여유와 도움을 물을 사람을 정하면 마음이 가벼워져요.`,
    ]);
  }
  if (ctx.category === 'movement' && ctx.period === 'life' && stars === 3) {
    return pickVariant(ctx, 'scorePacing', [
      `${area} 흐름이 보통으로 보인다면 새 환경이 맞는지 작은 범위에서 확인해 보세요. 짧은 방문이나 동선 조정처럼 되돌리기 쉬운 변화가 기준을 만들어 줘요.`,
      `${scope}에서 보통으로 보이는 흐름은 새 장소를 포기하라는 뜻이 아니에요. 먼저 짧게 다녀올 길과 오래 지킬 기준을 나누면 선택이 편해져요.`,
      `${scope}에서 무난하게 보이는 변화는 머무를 곳과 움직일 곳이 함께 보일 때 더 안전해요. 익숙한 사람에게 안부를 남겨 두면 변화도 덜 낯설어요.`,
    ]);
  }
  if (ctx.category === 'movement' && ctx.period === 'life' && stars >= 4) {
    return pickVariant(ctx, 'sourceMovementScoreHigh', [
      `${area} 좋은 흐름이 보이면 새 장소를 많이 늘리기보다 잘 맞았던 조건을 남기는 편이 좋아요. 편했던 거리와 함께한 사람을 기억하면 기세가 오래가요.`,
      `${scope}에서 점수가 좋게 보일 때는 새 환경을 만나는 힘과 익숙한 기준을 지키는 힘을 함께 봐야 해요. 두 기준이 같이 있어야 변화가 덜 피곤해져요.`,
      `${scope}에서 좋은 흐름은 모든 것을 한꺼번에 넓히라는 뜻이 아니에요. 편하게 반복할 수 있고 몸에 부담이 적었던 길을 기억해 보세요.`,
    ]);
  }
  if (ctx.category === 'movement' && stars <= 2) {
    return pickVariant(ctx, 'sourceMovementFarCaution', [
      `${scope}에서 흐름이 낮게 보일 때는 멀리 움직이는 결정을 잠시 작게 줄여 보는 편이 좋아요. 새 생활이 얼마나 달라질지와 다녀온 뒤 여유 중 가장 걸리는 것 하나만 먼저 확인해도 선택이 가벼워져요.`,
      `${area} 낮게 보이는 흐름은 이동이 막혔다는 뜻이 아니에요. 오늘은 새 장소보다 다녀온 뒤 쉴 시간과 여유를 먼저 정하면 변화가 덜 부담스러워요.`,
      `${scope}에서 이동의 흐름이 약하게 느껴질 때는 큰 변화보다 자주 다니는 길을 조금 바꾸는 쪽이 더 잘 맞아요. 시간대 하나, 동행 하나만 바꿔도 충분한 환기가 돼요.`,
      `${area} 흐름이 낮게 보이면 무리해서 방향을 바꾸기보다 내 생활 반경 안에서 정리되는 일을 먼저 보세요. 움직이지 않아도 해결되는 일이 보이면 마음이 훨씬 안정돼요.`,
      `${scope}에서 낮은 흐름은 조심하라는 신호에 가까워요. 새 일정은 작게 시험하고, 다녀온 뒤 회복할 시간을 남겨 두면 다음 선택이 더 안전해져요.`,
      `${area} 무거운 이동은 몸과 마음을 먼저 지치게 할 수 있어요. 꼭 움직여야 한다면 함께할 사람과 다녀온 뒤 일정을 한 번 더 확인해 보세요.`,
      `${scope}에서 흐름이 약할 때는 먼 곳보다 익숙한 기준을 먼저 붙잡는 편이 좋아요. 준비물과 쉬는 시간을 정해 두면 작은 변화도 덜 흔들려요.`,
      `${area} 낮게 보이는 흐름은 아무것도 하지 말라는 뜻이 아니에요. 지금 가장 안전하게 시험할 수 있는 부담 적은 시도 하나만 남겨 보세요.`,
      `${scope}에서 흐름이 낮게 보일 때는 길을 넓히기보다 다녀온 뒤 지킬 리듬을 먼저 정하는 편이 좋아요. 쉴 시간과 확인할 사람을 정하면 선택이 덜 무거워져요.`,
      `${area} 낮게 보이는 흐름에서는 멀리 가야 한다는 부담을 먼저 내려놓아도 괜찮아요. 가까운 길, 짧은 시간, 쉬운 준비물처럼 줄일 수 있는 기준부터 보세요.`,
      `${scope}에서 흐름이 낮게 보이면 새 장소보다 몸과 마음이 회복될 여지를 먼저 챙기세요. 돌아와서 쉴 수 있어야 짧은 외출도 좋은 경험으로 남아요.`,
      `${area} 낮은 흐름은 움직임을 모두 막는 말이 아니에요. 생활 리듬을 흔드는 부담 하나만 줄여도 충분한 조정이 돼요.`,
      `${scope}에서 흐름이 낮게 보일 때는 이동의 크기보다 새 환경을 감당할 여유를 먼저 보세요. 누구와 확인할지, 언제 쉴지 정하면 마음이 훨씬 가벼워져요.`,
      `${area} 낮은 흐름은 방향을 잃었다는 뜻보다 속도를 낮추고 먼저 정리할 일을 살피면 좋다는 신호예요. 큰 변화를 넓히기보다 가까운 부담부터 줄여 보세요.`,
      `${scope}에서 이동이 막혔다는 뜻으로 받아들이지 않아도 돼요. 준비물, 비용, 몸 상태 중 하나만 확인해도 다음 움직임이 더 안전해져요.`,
      `${area} 흐름이 낮게 보일 때는 움직임의 크기를 줄이는 것이 도움이 돼요. 자주 다니는 길을 조금 바꾸는 것부터 해 보면 부담 없이 감각을 되찾을 수 있어요.`,
      `${scope}에서 이동의 흐름이 약하게 느껴지면 새 일정을 바로 늘리지 말아 보세요. 오늘은 다녀온 뒤 쉴 수 있는지부터 확인하는 편이 좋아요.`,
      `${area} 낮게 보이는 흐름에서는 멀리 가는 선택보다 다녀온 뒤 쉴 시간을 분명히 두는 것이 중요해요. 여유가 보이면 작은 변화도 훨씬 편해져요.`,
      `${scope}에서 흐름이 낮게 보일 때는 모든 이동을 멈추기보다 덜 부담스러운 길을 찾는 편이 좋아요. 동선 하나를 짧게 줄여도 충분한 조정이에요.`,
      `${area} 무거운 이동은 몸과 마음을 쉽게 지치게 만들 수 있어요. 꼭 필요한 움직임이라면 움직이기 전후의 여유를 함께 잡아 두세요.`,
    ]);
  }
  if (ctx.category === 'movement' && stars === 3) {
    return pickVariant(ctx, 'scorePacing', [
      `${scope}에서 흐름이 보통으로 보일 때는 큰 이동보다 준비와 정리를 함께 보는 편이 좋아요. 갈 곳, 머무를 시간, 다녀온 뒤 쉴 시간을 나누면 선택이 덜 막연해져요.`,
      `${area} 흐름이 보통으로 보인다면 새 환경이 맞는지 작은 범위에서 확인해 보세요. 짧은 방문이나 동선 조정처럼 되돌리기 쉬운 변화가 기준을 만들어 줘요.`,
      `${scope}에서 흐름이 보통으로 보인다는 말은 움직임이 애매하다는 뜻이 아니에요. 바꿀 부분과 그대로 둘 생활 리듬을 나누면 변화가 훨씬 안전해져요.`,
      `${area} 흐름이 보통으로 보인다면 이동을 크게 늘리기보다 준비할 것과 돌아와서 쉴 시간을 함께 보세요. 출발 전 기준이 있으면 변화도 덜 부담스러워요.`,
      `${scope}에서 보통으로 보이는 흐름은 새 장소를 포기하라는 뜻이 아니에요. 먼저 짧게 다녀올 길과 그대로 지킬 생활 리듬을 나누면 선택이 편해져요.`,
      `${area} 흐름이 보통일 때는 낯선 곳을 바로 넓히기보다 작게 시험하는 편이 좋아요. 길이 얼마나 버거운지 한 가지만 먼저 확인해도 방향이 선명해져요.`,
      `${scope}에서 무난하게 보이는 변화는 다녀온 뒤 지킬 리듬이 있을 때 더 안전해요. 언제 쉬고 무엇을 정리할지 정하면 이동이 생활을 덜 흔들어요.`,
      `${area} 보통으로 보이는 흐름에서는 멀리 가는 것보다 다녀온 뒤 무엇이 편했는지 남기는 일이 중요해요. 경험을 정리해야 다음 이동이 내 기준에 가까워져요.`,
      `${scope}에서 흐름이 보통일 때는 새 장소를 많이 늘리기보다 가장 부담이 작은 시도 하나를 시험해 보세요. 쓸 돈과 몸 상태를 함께 보면 선택이 더 현실적이에요.`,
      `${area} 흐름이 보통으로 보일 때는 변화를 포기하라는 뜻보다 속도를 조절하라는 뜻에 가까워요. 준비물, 동행, 쉬는 시간을 정하면 새 환경도 덜 부담스러워요.`,
      `${scope}에서 무난하게 보이는 변화는 작은 확인을 붙일수록 도움이 커져요. 왜 가는지, 언제 쉬는지, 무엇을 남길지 정하면 움직임이 생활 속 조언으로 바뀌어요.`,
      `${area} 흐름이 보통으로 보인다면 익숙한 생활을 모두 흔들 필요는 없어요. 한 가지 조건만 바꿔 보고 몸과 마음의 반응을 살피면 충분해요.`,
    ]);
  }
  if (ctx.category === 'wealth' && stars === 3) {
    return pickVariant(ctx, 'scorePacing', [
      `${scope}에서 보통으로 보이는 흐름은 돈 문제가 애매하다는 뜻이 아니에요. 들어오는 돈, 나가는 돈, 기다려도 되는 돈을 나누면 다음 판단이 훨씬 차분해져요.`,
      `${area} 무난하게 보인다는 말은 돈을 더 묶어 두라는 뜻이 아니에요. 꼭 쓸 돈과 조금 늦춰도 되는 돈을 구분하면 생활의 부담이 줄어요.`,
      `${scope}에서 흐름이 보통으로 보일 때는 큰 결정보다 작은 돈 기준을 다시 보는 편이 좋아요. 반복 지출 하나만 확인해도 다음 달의 여유가 달라질 수 있어요.`,
      `${area} 보통으로 보이는 흐름은 지출이 흔들린다는 말보다 정리할 기회에 가까워요. 자주 쓰는 항목과 기다릴 수 있는 항목을 나누면 기준이 선명해져요.`,
      `${scope}에서 무난한 흐름일수록 돈의 속도를 다시 정리하면 좋아요. 바로 쓸 돈, 남겨 둘 돈, 누군가와 상의할 돈을 나누면 마음도 덜 급해져요.`,
      `${area} 흐름이 보통으로 보인다면 생활을 흔드는 지출 하나를 먼저 찾아보세요. 금액이 크지 않아도 반복되는 부담을 줄이면 체감이 훨씬 분명해져요.`,
      `${scope}에서 보통 점수는 방심하라는 뜻이 아니에요. 이미 잘 지키는 기준과 이번에 손볼 기준을 나누면 돈 관리가 더 현실적으로 보여요.`,
      `${area} 아주 강한 신호가 아니어도 돈의 기준을 세우기에는 충분해요. 오늘은 줄일 항목보다 계속 지켜도 좋은 기준 하나를 먼저 확인해 보세요.`,
      `${scope}에서 흐름이 보통일 때는 새 선택을 넓히기보다 기다릴 수 있는 돈을 골라 보는 편이 좋아요. 기다릴 수 있는 부분이 보이면 급한 소비도 줄어들어요.`,
      `${area} 중간처럼 보이는 흐름은 돈의 방향을 다시 맞춰 볼 기회예요. 꼭 필요한 비용, 마음이 급해진 비용, 다음에 볼 비용을 나누어 보세요.`,
      `${scope}에서 무난하게 보인다면 큰 성과보다 작은 확인이 더 중요해요. 영수증 하나, 구독 하나, 이체 날짜 하나만 봐도 다음 선택이 가벼워져요.`,
      `${area} 보통으로 보이는 흐름은 더 아끼라는 압박이 아니에요. 내 생활을 지키는 지출과 줄여도 되는 지출을 나누면 돈을 보는 마음이 차분해져요.`,
    ]);
  }
  if (ctx.category === 'movement' && stars >= 4) {
    return pickVariant(ctx, 'sourceMovementScoreHigh', [
      `${scope}에서 점수가 좋게 보일 때는 이동을 더 크게 벌리기보다 잘 맞았던 조건을 남기는 편이 좋아요. 편했던 거리와 다녀온 뒤 몸의 여유를 적어 두면 다음 선택도 안정돼요.`,
      `${area} 좋은 흐름이 보이면 새 장소를 많이 늘리기보다 다녀온 뒤 지킬 리듬을 함께 지키는 편이 좋아요. 잘 맞은 길과 쉬는 시간을 기억하면 기세가 오래가요.`,
      `${scope}에서 흐름이 좋게 보일 때는 자신감만으로 멀리 움직이지 않아도 돼요. 편했던 거리, 함께한 사람, 다녀온 뒤의 회복 시간을 기준으로 삼아 보세요.`,
      `${area} 점수가 좋게 보일 때는 새로운 길을 시험해도 좋지만 생활 리듬을 함께 남겨야 해요. 잘 풀린 이동일수록 쉴 시간까지 같이 기억해 두세요.`,
      `${scope}에서 좋은 흐름은 모든 것을 한꺼번에 넓히라는 뜻이 아니에요. 가장 편하게 움직였던 조건 하나를 지키면 다음 변화도 덜 흔들려요.`,
      `${area} 좋은 흐름이 보이면 큰 변화보다 다시 참고할 이동 기준을 만드는 편이 실속 있어요. 어떤 준비와 회복 여유가 편했는지 남겨 보세요.`,
      `${scope}에서 점수가 좋게 보일 때는 낯선 자극을 생활 안에 무리 없이 넣는 일이 중요해요. 너무 멀리 가기보다 돌아와서도 편한 크기로 시험해 보세요.`,
      `${area} 흐름이 좋게 보이더라도 다녀온 뒤 쉴 시간이 없으면 금방 피곤해질 수 있어요. 좋은 기세일수록 쉬는 시간과 정리할 일을 함께 잡아 두세요.`,
      `${scope}에서 좋은 기세가 있을수록 새 길과 익숙한 기준을 같이 봐야 해요. 익숙한 기준이 남아 있으면 새로운 변화도 더 편하게 이어져요.`,
      `${area} 점수가 좋게 보일 때는 움직임의 양보다 만족이 오래 남은 이유를 보는 편이 좋아요. 그 이유를 알면 다음 이동도 더 현실적으로 고를 수 있어요.`,
      `${scope}에서 흐름이 좋게 보일 때는 이동을 좋은 기억으로 남길 방법을 먼저 정해 보세요. 사진 한 장, 짧은 기록, 충분한 휴식이 다음 선택의 기준이 될 수 있어요.`,
      `${area} 좋은 흐름이 보이면 무조건 멀리 가라는 뜻은 아니에요. 지금 생활을 덜 흔들면서 기분이 환기되는 길을 고르면 충분히 도움이 돼요.`,
      `${scope}에서 점수가 좋게 보일 때는 새로운 길을 넓히기 전에 이미 편했던 이동 조건을 살펴보세요. 잘 맞은 출발 시간과 쉬는 기준을 알면 다음 변화가 더 부드러워져요.`,
      `${area} 좋은 흐름이 보이면 낯선 곳을 더 많이 넣기보다 오래 유지할 수 있는 이동 리듬을 찾는 편이 좋아요. 돌아온 뒤 피로가 적었던 방식을 기준으로 삼아 보세요.`,
      `${scope}에서 흐름이 좋게 보일 때는 움직임을 크게 증명하려 하지 않아도 돼요. 가까운 길이라도 마음이 넓어졌다면 그 방식이 충분히 쓸모 있는 신호예요.`,
      `${area} 점수가 좋게 보일 때는 새 일정과 회복 시간을 한 세트로 두는 편이 좋아요. 다녀온 뒤 쉴 수 있어야 좋은 이동도 생활의 자산으로 남아요.`,
      `${scope}에서 좋은 흐름은 모든 것을 한꺼번에 넓히라는 뜻이 아니에요. 편하게 반복할 수 있고 몸에 부담이 적었던 길을 기억해 보세요.`,
      `${area} 좋은 흐름이 보이면 지금보다 멀리 가야 한다고 느끼지 않아도 돼요. 자주 다시 할 수 있는 짧은 변화가 오히려 오래 도움이 될 수 있어요.`,
      `${scope}에서 점수가 좋게 보일 때는 새 환경을 만나는 힘과 익숙한 생활을 지키는 힘을 함께 봐야 해요. 두 기준이 같이 있어야 변화가 덜 피곤해져요.`,
      `${area} 흐름이 좋게 보이더라도 이동의 폭을 한 번에 넓힐 필요는 없어요. 먼저 편했던 동선 하나를 다시 써 보면 좋은 기세가 더 안정돼요.`,
      `${scope}에서 좋은 기세가 있을수록 이동 뒤에 무엇을 남길지 정해 두면 좋아요. 짧은 기록이나 사진, 몸 상태 메모가 다음 선택의 기준이 돼요.`,
      `${area} 점수가 좋게 보일 때는 움직인 거리보다 돌아온 뒤 마음이 가벼웠는지를 보세요. 그 느낌이 다음 변화의 크기를 정하는 데 더 현실적이에요.`,
      `${scope}에서 흐름이 좋게 보일 때는 낯선 제안을 바로 넓히기보다 작게 시험할 방법을 고르세요. 되돌릴 수 있는 크기라면 좋은 흐름도 부담 없이 살릴 수 있어요.`,
      `${area} 좋은 흐름이 보이면 새 길을 생활에 맞는 크기로 줄여 보는 편이 좋아요. 무리 없이 다녀오고 편히 회복할 수 있다면 그 변화가 오래 남아요.`,
      `${scope}에서 점수가 좋게 보일 때는 이동의 폭보다 다음에도 반복할 수 있는 조건을 보세요. 편한 시간대와 쉬는 기준을 남기면 기회가 더 안정돼요.`,
      `${area} 흐름이 좋게 보일 때는 낯선 곳을 경험하되 돌아올 생활도 함께 지키는 편이 좋아요. 익숙한 기준이 남아 있어야 좋은 자극도 부담이 덜해요.`,
      `${scope}에서 좋은 신호가 보일수록 이동을 많이 해내려 하기보다 만족이 오래 남은 이유를 살피세요. 그 이유가 다음 변화의 크기를 정해 줘요.`,
      `${area} 좋은 흐름이 보이면 이동이 생활을 넓혀 주는 쪽인지 먼저 살펴보세요. 피로만 남는 변화보다 돌아와서도 편한 선택이 더 오래 가요.`,
      `${scope}에서 점수가 좋게 보일 때는 이동을 기회로 보되 몸의 여유도 함께 봐야 해요. 쉬는 시간을 지킬 수 있어야 좋은 기세가 다음 선택까지 이어져요.`,
    ]);
  }

  if (stars >= 4) {
    return pickVariant(ctx, 'scorePacing', [
      `${scope}에서 점수가 좋게 보일 때일수록 너무 크게 벌리기보다, 이미 잘 되는 방식을 반복하는 편이 안정적이에요. 잘 풀리는 날에도 일정과 몸 상태를 한 번 더 확인하면 그 기세를 오래 이어 갈 수 있어요.`,
      `${scope}에서 흐름이 좋게 보일 때는 욕심을 한꺼번에 늘리기보다 지금 잘 맞는 방식을 지키는 편이 좋아요. 작은 약속을 놓치지 않으면 편안함이 더 오래 이어져요.`,
      `${area} 흐름이 좋게 보이더라도 모든 일을 동시에 잡을 필요는 없어요. 가장 잘 풀리는 한 가지를 먼저 살리면 좋은 기세를 무리 없이 이어 갈 수 있어요.`,
      `${scope}에서 좋은 흐름은 더 많이 벌리는 신호라기보다 잘 맞는 방식을 하나만 더 또렷하게 하라는 뜻에 가까워요. 이미 편한 순서와 시간을 지키면 결과도 더 안정적으로 따라와요.`,
      `${area} 좋은 흐름이 보이면 할 일을 늘리기보다 잘 풀린 조건을 먼저 지키는 편이 좋아요. 시간, 사람, 몸 상태 중 무엇이 편했는지 남기면 다음 선택도 안정돼요.`,
      `${scope}에서 흐름이 좋게 보일 때는 새 일을 더 얹기보다 이미 맞았던 순서를 확인해 보세요. 반복할 수 있는 크기로 남겨야 좋은 기세가 오래가요.`,
      `${area} 점수가 좋게 보일 때는 더 큰 계획보다 유지할 수 있는 기준이 중요해요. 오늘 편했던 방식 하나를 적어 두면 다음에도 덜 흔들려요.`,
      `${scope}에서 점수가 좋게 보일 때는 더 밀어붙이기보다 무리 없는 조건을 찾는 편이 좋아요. 잘된 이유를 짧게 남기면 좋은 상태를 현실적으로 이어 갈 수 있어요.`,
      `${area} 흐름이 좋게 보이더라도 모든 약속을 넓힐 필요는 없어요. 지금 가장 편하게 반복할 수 있는 행동 하나를 지키는 쪽이 더 도움이 돼요.`,
      `${scope}에서 좋은 기세가 있을수록 쉬운 기준을 잊지 않는 편이 좋아요. 잘 풀린 순서와 쉬어 갈 시간을 함께 두면 부담 없이 이어져요.`,
      `${area} 좋은 흐름은 더 많이 벌리는 신호라기보다 안정적인 조건을 확인하라는 말에 가까워요. 오늘 맞았던 리듬을 남기면 다음 선택도 차분해져요.`,
      `${scope}에서 점수가 높게 느껴질 때는 자신감을 생활의 리듬으로 옮기는 편이 좋아요. 오늘 잘된 이유를 짧게 적어 두면 다음 선택에서도 흔들림이 줄어요.`,
      `${scope}에서 흐름이 좋게 보일 때는 일을 더 키우기보다 잘 맞았던 순서를 또렷하게 남겨 보세요. 다시 쓸 수 있는 방식이 생기면 좋은 기세도 오래가요.`,
      `${area} 좋은 흐름은 모든 것을 한꺼번에 넓히라는 뜻이 아니에요. 오늘 잘 풀린 조건 하나를 지키면 다음 선택도 더 안정적으로 이어져요.`,
      `${scope}에서 좋은 기세가 있을수록 쉬는 시간과 확인할 기준을 함께 두는 편이 좋아요. 무리하지 않는 반복이 결과를 더 단단하게 붙잡아 줘요.`,
      `${area} 점수가 좋게 보일 때는 새 목표보다 유지할 기준을 먼저 고르면 좋아요. 이미 편했던 방식이 보이면 다음 행동도 덜 흔들려요.`,
      `${scope}에서 좋은 흐름은 더 많이 해내라는 압박이 아니라 잘 맞는 방법을 확인하라는 신호예요. 부담 없는 반복이 가장 오래 남아요.`,
    ]);
  }
  if (stars === 3) {
    return pickVariant(ctx, 'scorePacing', [
      `${scope}에서 흐름이 보통으로 보인다는 말은 애매하다는 뜻이 아니라 관리할 여지가 있다는 뜻이에요. 한 가지를 정해서 끝까지 해 보면 점수보다 더 분명한 체감이 생길 수 있어요.`,
      `${scope}에서 흐름이 보통으로 보일 때는 크게 흔들리지 않는 대신, 반복되는 장면을 살피는 만큼 방향이 또렷해질 수 있어요. 지금 가장 자주 반복되는 부분 하나만 봐도 충분해요.`,
      `${area} 흐름이 보통으로 보인다면 좋은 쪽과 아쉬운 쪽이 함께 있다는 뜻으로 보면 돼요. 서두르지 않고 기준을 하나 세우면 판단이 훨씬 쉬워져요.`,
      `${scope}에서 무난하게 보인다는 말은 멈춰 있다는 뜻이 아니에요. 잘 유지할 것과 작게 고칠 것을 나누면 생활에서 바로 써먹기 쉬워져요.`,
      `${area} 아주 강한 신호가 아니어도 쓸모가 없다는 뜻은 아니에요. 반복되는 선택 하나를 정리하면 다음 판단이 훨씬 가벼워져요.`,
      `${scope}에서 보통으로 보이는 흐름은 속도를 조절하라는 신호에 가까워요. 무리해서 넓히기보다 지금 할 수 있는 범위만 또렷하게 남겨 보세요.`,
    ]);
  }
  return pickVariant(ctx, 'scorePacing', [
    `${scope}에서 흐름이 낮게 보일 때는 겁을 먹기보다 속도를 낮추라는 신호로 보면 좋아요. 무리한 선택을 잠시 미루고, 작게 조절할 부분부터 다루면 부담을 줄일 수 있어요.`,
    `${scope}에서 흐름이 낮게 보일 때는 새로 벌리는 일보다 이미 있는 일을 가볍게 정리하는 편이 좋아요. 속도를 낮추면 실수나 피로를 줄이는 데 도움이 돼요.`,
    `${area} 흐름이 낮게 보이더라도 나쁜 일이 정해졌다는 뜻은 아니에요. 지금은 크게 밀어붙이기보다 쉬운 선택부터 챙기는 편이 더 현실적이에요.`,
    `${scope}에서 낮은 흐름은 멈추라는 말이 아니라 속도와 크기를 줄이라는 신호에 가까워요. 오늘은 가장 부담이 적은 선택 하나만 남겨도 충분해요.`,
    `${area} 조심스럽게 보일 때는 결과를 걱정하기보다 확인할 순서를 짧게 만드는 편이 좋아요. 미룰 일과 바로 볼 일을 나누면 부담이 줄어요.`,
    `${scope}에서 흐름이 낮게 보일 때는 새 결정을 서두르지 말고 이미 있는 기준을 다시 확인해 보세요. 기준이 작아지면 실수도 줄어들어요.`,
    `${area} 낮은 점수는 겁을 주려는 신호가 아니에요. 무리한 선택을 잠시 세워 두고, 지금 안전하게 줄일 수 있는 부분부터 보면 돼요.`,
  ]);
}
function lifeHorizonNudge(ctx: StandardDepthEnhancementContext): string {
  if (isFutureAdultLifeForMinorReader(ctx)) {
    return pickVariant(ctx, 'futureAdultLifeHorizonNudge', [
      '지금 당장 방향을 정하라는 말이 아니라, 성장 뒤 스스로 고를 기준을 미리 살피는 정도로 읽어 주세요.',
      '먼 결론으로 단정하지 말고, 현재는 생활 습관과 마음의 속도를 살피는 정도로 읽어도 충분해요.',
      '긴 시간의 이야기는 현재를 몰아붙이는 숙제가 아니라, 오래 가져갈 기준을 미리 구분해 보라는 뜻이에요.',
      '현재 바로 요구하기보다, 오늘 도울 환경과 시간이 지나 참고할 기준을 나누어 읽어 주세요.',
      '현재 모습과 성장 뒤의 가능성은 다를 수 있으니, 단정 대신 기준을 남기는 데 초점을 두면 좋아요.',
      '당장의 성격이나 능력을 평가하는 말이 아니라, 시간이 지나며 달라질 생활 방향을 넓게 보는 안내예요.',
    ]);
  }
  return pickVariant(ctx, 'lifeHorizonNudge', [
    '내게 필요한 부분만 골라 읽어도 충분해요.',
    '너무 먼 결론보다 오래 가져갈 기준 하나를 남겨 보세요.',
    '이미 지나온 경험도 다음 선택을 돕는 단서가 될 수 있어요.',
    '부담이 큰 주제일수록 한 번에 바꾸기보다 조금씩 다듬으면 좋아요.',
    '내 생활 리듬에 맞는 부분부터 적용하면 훨씬 편하게 읽혀요.',
    '지금 어색한 부분은 잠시 접어 두고, 생활이 바뀐 뒤 다시 확인해도 괜찮아요.',
    '오래 볼 주제일수록 스스로 납득되는 속도로 적용하는 편이 좋아요.',
    '큰 결론 하나보다 반복해서 확인할 작은 기준이 더 오래 도움이 돼요.',
    '이미 익숙한 방식과 새로 바꿀 방식을 나누어 보면 부담이 줄어요.',
    '내 생활에서 편하게 지킬 수 있는 기준부터 고르면 시간이 지나도 다시 읽기 쉬워요.',
  ]);
}

function futureAdultLifeCategoryNudge(ctx: StandardDepthEnhancementContext): string {
  switch (ctx.category) {
    case 'overall':
      return pickVariant(ctx, 'futureAdultLifeCategoryNudge', [
        '현재 생활을 몰아붙이는 말이 아니라, 오래 도움이 될 기준과 오늘 편한 기준을 나누어 보는 정도면 충분해요.',
        '현재 모습만으로 결론 내리지 말고, 보호자가 도울 부분과 시간이 지나 다시 볼 부분을 나누어 읽어 주세요.',
      ]);
    case 'wealth':
      return pickVariant(ctx, 'futureAdultLifeCategoryNudge', [
        '현재 큰 결정을 맡기라는 말이 아니라, 기다릴 수 있는 선택과 꼭 확인할 조건을 구분하는 감각을 넓게 살펴보세요.',
        '현재는 작은 선택을 편하게 배우고, 성장 뒤에는 지출과 약속을 차분히 확인하는 기준으로 이어진다고 보면 좋아요.',
      ]);
    case 'health':
      return pickVariant(ctx, 'futureAdultLifeCategoryNudge', [
        '현재 습관을 곧바로 요구하기보다, 편한 생활 리듬과 성장 뒤 스스로 지킬 건강 기준을 나누어 읽어 주세요.',
        '보호자는 현재의 컨디션을 관찰하고, 이 조언은 시간이 지나 몸을 돌볼 때 참고할 생활 기준으로만 두면 좋아요.',
      ]);
    case 'academic':
      return pickVariant(ctx, 'futureAdultLifeCategoryNudge', [
        '현재 공부 성과를 평가하기보다, 오래 다시 쓸 수 있는 배움 방식 하나를 찾아보는 참고로 읽어 주세요.',
        '보호자는 아이가 편하게 배우는 방식을 살피고, 성장 뒤의 배움은 오래 가져갈 질문 정도로 남기면 충분해요.',
      ]);
    case 'romance':
      return pickVariant(ctx, 'futureAdultLifeCategoryNudge', [
        '관계를 현재 정하라는 말이 아니라, 오래 도움이 될 말투와 거리감의 기준을 넓게 보는 안내예요.',
        '현재의 친구 관계를 단정하지 말고, 시간이 지나 서로 편해지는 속도와 표현 방식을 참고하는 정도로 읽어 주세요.',
      ]);
    case 'family':
      return pickVariant(ctx, 'futureAdultLifeCategoryNudge', [
        '가족 관계를 현재 해결하라는 말이 아니라, 성장 뒤 가까운 사람과 부담을 나누는 순서를 참고해 보세요.',
        '보호자는 현재 관계를 몰아붙이기보다, 오래 도움이 될 안부, 기다림, 도움의 기준을 가볍게 남기면 좋아요.',
      ]);
    case 'career':
      return pickVariant(ctx, 'futureAdultLifeCategoryNudge', [
        '직업 이름을 현재 정하라는 말이 아니라, 성장 뒤 책임을 맡을 때 필요한 순서와 도움받을 기준을 살펴보세요.',
        '현재는 좋아하는 활동과 편한 집중 방식을 살피고, 성장 뒤의 일은 책임을 나누는 기준으로만 넓게 읽어 주세요.',
      ]);
    case 'study_document':
      return pickVariant(ctx, 'futureAdultLifeCategoryNudge', [
        '서류를 현재 완벽히 정리하라는 말이 아니라, 시간이 지나 기록을 찾고 확인하는 기준을 미리 떠올려 살펴보세요.',
        '현재는 작은 기록 습관을 편하게 보고, 성장 뒤에는 이름, 날짜, 확인할 사람을 남기는 기준으로 읽으면 좋아요.',
      ]);
    case 'expression_children':
      return pickVariant(ctx, 'futureAdultLifeCategoryNudge', [
        '표현을 현재 평가하라는 말이 아니라, 시간이 지나 자기 생각을 편한 방식으로 남기는 기준을 살펴보세요.',
        '현재는 좋아하는 표현을 편하게 지켜보고, 시간이 지나 다시 꺼내 볼 말이나 장면을 남기는 참고로 읽어 주세요.',
      ]);
    case 'health_stress':
      return pickVariant(ctx, 'futureAdultLifeCategoryNudge', [
        '마음을 현재 문제로 단정하라는 말이 아니라, 성장 뒤 부담을 줄이고 쉬어 갈 기준을 살펴보세요.',
        '보호자는 현재의 긴장 신호를 가볍게 살피고, 이 조언은 성장 뒤 스스로 회복 순서를 정할 때 참고하면 좋아요.',
      ]);
    case 'movement':
      return pickVariant(ctx, 'futureAdultLifeCategoryNudge', [
        '이동을 현재 정하라는 말이 아니라, 시간이 지나 바꿀 것과 그대로 둘 것을 나누는 기준으로 읽어 주세요.',
        '보호자는 현재 생활의 편한 리듬을 먼저 보고, 성장 뒤의 변화는 돌아올 기준을 함께 두는 참고로 남기면 좋아요.',
      ]);
  }
}

function categoryNudge(ctx: StandardDepthEnhancementContext): string {
  if (isFutureAdultLifeForMinorReader(ctx)) {
    return futureAdultLifeCategoryNudge(ctx);
  }
  if (ctx.category === 'wealth') {
    if (isYoungChildReader(ctx)) {
      return pickVariant(ctx, 'categoryNudge', [
        '보호자와 함께 오늘 고른 것 하나만 돌아봐도 충분해요.',
        '바로 사기보다 잠깐 기다려 보는 연습만 해도 좋아요.',
        '갖고 싶은 것과 기다릴 수 있는 것을 함께 말해 보면 선택이 쉬워져요.',
        '아이 혼자 정답을 찾게 하기보다 옆에서 한 번 더 물어봐 주면 좋아요.',
        '작은 선택 하나를 칭찬해 주면 다음 선택도 더 편해져요.',
        '오늘은 기록보다 대화 한마디가 더 잘 맞을 수 있어요.',
      ]);
    }
    if (isMinorReader(ctx)) {
      return pickVariant(ctx, 'categoryNudge', [
        '이번에는 쓰고 싶은 것 하나만 줄여도 선택이 더 쉬워져요.',
        '이동 비용이나 큰 물건처럼 돈이 많이 드는 일은 먼저 적어 보세요.',
        '친구를 따라 바로 쓰기보다 꼭 필요한지 한 번 더 물어보면 좋아요.',
        '작은 기록 하나가 다음 선택을 훨씬 가볍게 만들어 줘요.',
        '계속 가져갈 습관과 줄일 습관을 하나씩 나눠 보세요.',
        '숫자보다 실제 생활에서 부담이 줄었는지를 함께 보면 좋아요.',
      ]);
    }
    return pickVariant(ctx, 'categoryNudge', [
      '이번에는 지출 하나만 줄여도 흐름을 느끼기 쉬워요.',
      '작은 기록 하나가 다음 선택을 훨씬 가볍게 만들어 줘요.',
      '바로 결정하기보다 한 번 더 확인하는 태도가 도움이 돼요.',
      '들어오는 돈보다 나가는 약속 하나를 먼저 살펴보면 좋아요.',
      '계속 가져갈 습관과 줄일 습관을 하나씩 나눠 보세요.',
      '숫자보다 실제 생활에서 부담이 줄었는지를 함께 보면 좋아요.',
      '이동, 큰 물건, 새 거래가 함께 걸린 지출은 비용과 조건을 따로 적어 보세요.',
      '돈이 크게 움직이는 날에는 혼자 바로 정하지 말고 한 번 더 확인해 보세요.',
    ]);
  }

  if (ctx.category === 'health' || ctx.category === 'health_stress') {
    return pickVariant(ctx, 'categoryNudge', [
      '몸이 보내는 작은 신호 하나만 먼저 확인해도 충분해요.',
      '잠, 식사, 움직임 중 가장 쉬운 것 하나부터 고르면 좋아요.',
      '지금 덜 지치는 선택 하나가 길게 보면 더 도움이 돼요.',
      '컨디션이 흔들리는 장면을 짧게 기억해 두면 다음 조절이 쉬워요.',
      '쉬는 시간을 먼저 정해 두면 나머지 일도 더 편하게 이어져요.',
      '지금 몸에 부담이 적은 방식부터 적용해 보세요.',
      '최근 편했던 시간대와 쉽게 지쳤던 시간대를 나누어 보면 다음 조절이 쉬워요.',
      '피곤한 날에는 새 계획보다 이미 편했던 습관 하나를 다시 해 보세요.',
    ]);
  }
  if (ctx.category === 'family' || ctx.category === 'romance') {
    return pickVariant(ctx, 'categoryNudge', [
      '가까운 사람에게 건넬 짧은 말 하나부터 정해도 충분해요.',
      '길게 설득하기보다 안부나 고마움을 짧게 나누는 편이 좋아요.',
      '마음이 복잡하면 바로 결론 내리지 말고 한 박자 늦춰도 괜찮아요.',
      '함께한 시간 하나를 떠올리면 다음 대화가 조금 쉬워져요.',
      '관계는 한 번에 고치기보다 편한 장면을 조금 늘리는 쪽이 좋아요.',
      '오늘은 상대를 맞히려 하기보다 내 마음 한 줄을 살펴보세요.',
    ]);
  }
  if (ctx.category === 'career' && ctx.period === 'thisYear') {
    return pickVariant(ctx, 'categoryNudge', [
      '새 제안 앞에서 다시 볼 기준 하나만 남겨도 충분해요.',
      '새 제안은 바로 따라가기보다 결과물로 남길 일과 잠시 미룰 일을 나누어 보세요.',
      '같이 검토할 사람과 남길 기록을 정하면 한 해의 방향이 덜 흔들려요.',
      '세 달에 한 번씩 완성한 결과를 한 줄로 남기면 12월 기준이 훨씬 또렷해져요.',
      '공개할 일과 더 다듬을 일을 나누면 기회가 들어와도 판단이 쉬워져요.',
      '올해의 성과를 누가 어떻게 쓸 수 있는지 한 줄로 적어 보세요.',
    ]);
  }
  if (ctx.category === 'study_document') {
    if (isMinorReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)) {
      return pickVariant(ctx, 'categoryNudge', [
        '시작 전에 다시 찾을 안내장이나 단서 하나를 남기면 다음 확인이 쉬워져요.',
        '기억에만 맡기지 말고 노트, 안내장, 질문 중 하나를 눈에 보이게 남겨 보세요.',
        '끝낸 기록에는 다시 찾을 제목을 붙여 두면 다음 확인이 훨씬 편해져요.',
        '빠진 칸은 틀린 부분이 아니라 다시 물어볼 표시로 남겨 두면 좋아요.',
        '오늘 받은 자료 중 다시 꺼내 볼 수 있는 한 줄을 만드는 데 집중해 보세요.',
        '보호자나 선생님에게 확인받을 것과 혼자 볼 것을 나누면 다음 순서가 또렷해져요.',
        '숙제, 안내장, 시험 범위 중 하나만 제자리에 두어도 다음 확인이 훨씬 편해져요.',
      ]);
    }
    return pickVariant(ctx, 'categoryNudge', [
      '시작 전에 지금 확인할 날짜나 이름 하나를 표시하면 다음 정리가 쉬워져요.',
      '기억에 맡긴 항목을 눈에 보이게 남기는 것만으로도 서류 부담이 줄어요.',
      '끝낸 기록에는 다시 찾을 이름을 붙여 두면 다음 확인이 훨씬 편해져요.',
      '빠진 칸은 틀린 부분이 아니라 다시 확인할 표시로 남겨 두면 좋아요.',
      '지금 바로 꺼내 쓸 수 있는 기록 하나를 만드는 데 집중해 보세요.',
      '혼자 볼 항목과 제출할 항목을 나누어 적으면 다음 순서가 또렷해져요.',
      '제출할 것과 보관할 것을 나누어 두면 나중에 다시 볼 때 훨씬 편해져요.',
    ]);
  }
  if (ctx.category === 'academic') {
    return pickVariant(ctx, 'categoryNudge', [
      '시작 전에 오늘 다시 설명해 볼 문장 하나를 골라 보세요. 설명할 문장이 있으면 공부의 방향이 더 선명해져요.',
      '막힌 문제는 답만 확인하기보다 어디서 멈췄는지 한 단어로 표시해 보세요. 이유가 보이면 다음에 물어볼 질문도 쉬워져요.',
      '끝낸 분량, 헷갈린 문장, 다시 볼 표시를 나누어 두면 다음 공부가 훨씬 덜 막막해져요.',
      '기억에만 맡기지 말고 내가 다시 찾을 수 있는 말로 남겨 보세요. 짧은 요약 하나가 다음 복습의 손잡이가 돼요.',
      '잘 안 되는 부분은 틀렸다는 표시가 아니라 다시 만날 단서로 남기면 좋아요. 단서가 있으면 도움을 받을 때도 설명이 쉬워져요.',
      '오늘 배운 내용을 한 줄 요약, 질문 하나, 예시 하나로 나누어 보세요. 세 가지가 보이면 이해한 부분과 막힌 부분이 분명해져요.',
      '확인할 문제와 나중에 물어볼 문제를 나누어 적으면 다음 순서가 또렷해져요. 공부는 한 번에 끝내는 일보다 다시 이어 가는 일이 더 중요해요.',
    ]);
  }
  if (ctx.category === 'expression_children') {
    return pickVariant(ctx, 'categoryNudge', [
      '잘하려는 마음보다 편하게 남길 수 있는 흔적 하나를 먼저 골라 보세요.',
      '오늘 떠오른 장면 하나만 남겨도 다음 표현이 훨씬 쉬워져요.',
      '보여 줄 것과 나만 볼 것을 나누면 표현의 부담이 줄어요.',
      '작은 메모나 사진처럼 손에 익은 방식부터 시작해도 충분해요.',
      '가까운 사람에게 보여 줄 때는 완성보다 느낌을 나누는 쪽이 좋아요.',
      '마음에 남은 색, 말, 장면 중 하나만 붙잡아도 표현이 시작돼요.',
      '혼자 오래 붙잡기보다 편한 방식으로 짧게 남겨 보세요.',
      '오늘의 기분을 한 줄로 적는 것만으로도 다음 표현의 실마리가 돼요.',
    ]);
  }
  return pickVariant(ctx, 'categoryNudge', [
    '가장 현실적인 조언 하나만 골라도 충분해요.',
    '부담이 큰 날에는 가장 쉬운 행동부터 시작해 보세요.',
    '이미 잘되는 부분은 그대로 두고 한 가지만 조정해도 좋아요.',
    '지금 일정에 맞는 작은 행동 하나로 줄여 보면 편해요.',
    '완벽하게 해내려 하기보다 다시 확인할 기준을 남겨 보세요.',
    '작은 장면에서 먼저 시험해 보고, 맞으면 천천히 넓혀 가면 돼요.',
  ]);
}

function periodHorizonGuidance(ctx: StandardDepthEnhancementContext): string {
  const label = categoryLabel(ctx.category, ctx);
  const lifeNudge = ctx.period === 'life' ? lifeHorizonNudge(ctx) : '';
  switch (ctx.period) {
    case 'today':
      if (ctx.category === 'wealth') {
        return pickVariant(ctx, 'periodHorizon', [
          '오늘 안에서는 돈과 물건 관리에서 결제할 것, 보류할 것, 확인받을 것을 하나씩 나누어 보세요. 셋이 구분되면 큰돈이 아니어도 선택이 차분해져요.',
          '오늘 돈 흐름은 크게 바꾸기보다 새는 곳 하나를 찾는 데서 시작하면 좋아요. 결제 전 한 번 멈추는 기준만 있어도 부담이 줄어요.',
        ]);
      }
      if (ctx.category === 'health') {
        return pickVariant(ctx, 'periodHorizon', [
          '오늘 안에서는 몸과 마음에서 잠, 식사, 움직임 중 가장 흔들린 것 하나만 먼저 살펴보세요. 몸의 신호가 좁아지면 무리할 일도 줄어들어요.',
          '오늘 컨디션은 큰 결심보다 한 끼, 한 번의 휴식, 짧은 움직임처럼 확인하기 쉬운 기준이 더 잘 맞아요. 몸이 편했던 장면을 먼저 남겨 보세요.',
        ]);
      }
      if (ctx.category === 'academic') {
        return pickVariant(ctx, 'periodHorizon', [
          '오늘 안에서는 공부와 배움에서 새로 넣을 내용보다 다시 볼 자료 하나를 먼저 정해 보세요. 되짚을 곳이 분명하면 배움이 덜 흩어져요.',
          '오늘 배움은 범위를 넓히기보다 이해한 부분과 막힌 부분을 나누는 쪽이 좋아요. 둘이 구분되면 다음에 볼 자료도 더 선명해져요.',
        ]);
      }
      if (ctx.category === 'career') {
        return pickVariant(ctx, 'periodHorizon', [
          '오늘 안에서는 일과 책임에서 내가 끝낼 일과 함께 볼 일을 먼저 나누어 보세요. 역할의 선이 보이면 하루의 부담도 덜 몰려요.',
          '오늘 일은 큰 방향보다 마감, 사람, 내 컨디션을 한 번 나누어 보는 편이 현실적이에요. 셋 중 하나만 정리돼도 다음 판단이 쉬워져요.',
        ]);
      }
      if (ctx.category === 'study_document') {
        return pickVariant(ctx, 'periodHorizon', [
          '오늘 안에서는 기록과 서류에서 제출할 것, 보관할 것, 다시 확인할 것을 나누어 보세요. 이름과 위치가 정리되면 다음 확인이 쉬워져요.',
          '오늘 문서는 많이 처리하는 것보다 다시 찾을 길을 남기는 쪽이 더 중요해요. 제목, 날짜, 확인할 사람 중 하나만 분명해도 충분해요.',
        ]);
      }
      if (ctx.category === 'expression_children') {
        return pickVariant(ctx, 'periodHorizon', [
          '오늘 안에서는 표현과 창의에서 바로 꺼낼 말과 조금 더 다듬을 말을 나누어 보세요. 한 줄만 남겨도 다음 표현의 실마리가 돼요.',
          '오늘 떠오른 생각은 크게 보여 주기보다 메모, 초안, 짧은 대화 중 하나로 남기는 편이 좋아요. 작게 남긴 표현이 다음 흐름을 이어 줘요.',
        ]);
      }
      if (ctx.category === 'health_stress') {
        return pickVariant(ctx, 'periodHorizon', [
          '오늘 안에서는 긴장과 회복에서 풀어야 할 긴장과 잠시 내려놓을 부담을 나누어 보세요. 구분이 생기면 쉬는 시간도 덜 미뤄져요.',
          '오늘 회복은 오래 참는 힘보다 다시 편해지는 방법을 찾는 쪽에 가까워요. 사람, 장소, 휴식 중 하나만 정해도 긴장이 덜 쌓여요.',
        ]);
      }
      if (ctx.category === 'movement') {
        return pickVariant(ctx, 'periodHorizon', [
          '오늘 안에서는 이동과 변화에서 직접 움직일 일과 제자리에서 정리할 일을 따로 보세요. 움직이지 않아도 풀리는 일이 보이면 선택이 가벼워져요.',
          '오늘 이동은 새 장소보다 준비물, 동행, 쉬는 시간을 먼저 보는 편이 좋아요. 이동 앞뒤의 여유가 보이면 변화도 덜 부담스러워요.',
        ]);
      }
      if (ctx.category === 'romance' || ctx.category === 'family') {
        return pickVariant(ctx, 'periodHorizon', [
          `오늘 안에서는 ${withObjectParticle(label)} 멀리 내다보기보다 짧게 주고받는 말 하나부터 살피면 좋아요. 인사, 고마움, 미안함처럼 바로 건넬 수 있는 말이 하루 분위기를 부드럽게 만들어요.`,
          `오늘 안에서는 ${withObjectParticle(label)} 한 번에 풀려고 하지 않아도 괜찮아요. 함께 웃은 순간이나 짧게 안부를 전할 시간을 하나만 남겨도 충분해요.`,
          `오늘 안에서는 ${withObjectParticle(label)} 크게 판단하기보다 눈앞의 대화를 편하게 만드는 편이 좋아요. 상대를 맞히려 하기보다 내 마음을 짧고 부드럽게 말해 보세요.`,
        ]);
      }
      return pickVariant(ctx, 'periodHorizon', [
        `오늘 안에서는 ${withObjectParticle(label)} 크게 바꾸려 하기보다, 지금 바로 할 수 있는 한 가지를 고르는 게 좋아요. 저녁이 되기 전에 확인할 작은 행동을 정하면 하루의 흐름을 더 또렷하게 느낄 수 있어요.`,
        `오늘 안에서는 ${label}에서 멀리 해석하기보다 지금 가장 가까운 장면 하나로 좁혀 보세요. 아침, 점심, 저녁 중 한때만 정해도 조언이 훨씬 실제처럼 느껴져요.`,
        `오늘 안에서는 ${label}에서 먼저 확인할 순서와 나중에 볼 순서를 하나씩 나누어 보세요. 순서가 보이면 하루 끝에 다시 읽기 쉬워요.`,
        `오늘 안에서는 ${label}에서 큰 결론보다 지금 덜 무거워질 순서를 보는 편이 좋아요. 미룰 것과 바로 할 것을 하나씩 나누면 마음이 차분해져요.`,
        `오늘 안에서는 ${label}에서 읽고 바로 정할 부분보다 잠시 지켜볼 부분을 먼저 나누어 보세요. 구분이 생기면 하루 기준이 덜 흔들려요.`,
        `오늘 안에서는 ${label}에서 완벽한 답으로 받아들이지 않아도 괜찮아요. 지금 상황에 맞는 말 하나만 골라 작은 행동으로 옮기면 돼요.`,
        `오늘 안에서는 ${withObjectParticle(label)} 멀리 내다보기보다 눈앞의 순서를 정하는 편이 좋아요. 하루 중 가장 부담이 적은 때를 하나 골라 두면 실천이 쉬워요.`,
        `오늘 안에서는 ${withObjectParticle(label)} 완벽하게 해결하려 하지 않아도 괜찮아요. 지금 할 수 있는 작은 선택 하나가 하루 전체의 부담을 줄여 줄 수 있어요.`,
      ]);
    case 'thisWeek':
      if (ctx.category === 'career' && !isMinorReader(ctx)) {
        return pickVariant(ctx, 'periodHorizon', [
          '이번 주에는 맡은 일을 하루 단위로 나누어 보세요. 주초의 마음만으로 끝까지 밀고 가기보다, 중간에 한 번 쉬어 가며 다시 맞추면 부담이 덜 쌓여요.',
          '이번 주에는 직접 할 일과 함께 볼 일을 두세 번으로 나누어 확인해 보세요. 중간 점검이 있으면 흐트러져도 다시 맞추기 쉬워요.',
          '이번 주에는 주초의 판단만으로 일을 키우지 않는 편이 좋아요. 주중에 한 번, 주말 전에 한 번 살피면 실제 흐름이 더 잘 보여요.',
        ]);
      }
      return pickVariant(ctx, 'periodHorizon', [
        `이번 주에는 ${withObjectParticle(label)} 하루 단위로 나누어 보는 편이 좋아요. 월요일부터 끝까지 완벽하게 밀고 가려 하기보다, 중간에 한 번 쉬어 가며 다시 맞추면 더 오래 유지돼요.`,
        `이번 주에는 ${withObjectParticle(label)} 한 번에 끝내려 하기보다 두세 번으로 나누어 확인해 보세요. 중간 점검이 있으면 흐트러져도 다시 맞추기 쉬워요.`,
        `이번 주에는 ${withObjectParticle(label)} 주초의 마음만으로 판단하지 않는 게 좋아요. 주중에 한 번, 주말 전에 한 번 살피면 실제 흐름이 더 잘 보여요.`,
      ]);
    case 'thisMonth':
      if (ctx.category === 'career' && !isMinorReader(ctx)) {
        return pickVariant(ctx, 'periodHorizon', [
          '이번 달에는 반복되는 업무 습관을 보는 것이 중요해요. 한두 번의 기분보다 여러 날에 걸쳐 반복되는 선택을 살피면, 무엇을 고치고 무엇을 이어 갈지 더 선명해져요.',
          '이번 달에는 짧은 기분보다 누적된 일의 패턴을 보는 편이 좋아요. 매주 한 번만 돌아봐도 내가 자주 놓치는 부분을 찾을 수 있어요.',
          '이번 달에는 반복되는 선택을 조용히 모아 보세요. 작은 기록이 쌓이면 다음 달에 이어 갈 기준이 훨씬 분명해져요.',
        ]);
      }
      return pickVariant(ctx, 'periodHorizon', [
        `이번 달에는 ${label}에서 반복되는 습관을 보는 것이 중요해요. 한두 번의 기분보다 여러 날에 걸쳐 반복되는 선택을 살피면, 무엇을 고치고 무엇을 이어 갈지 더 선명해져요.`,
        `이번 달에는 ${withObjectParticle(label)} 짧은 기분보다 누적된 패턴으로 보는 편이 좋아요. 매주 한 번만 돌아봐도 내가 자주 놓치는 부분을 찾을 수 있어요.`,
        `이번 달에는 ${label}에서 반복되는 선택을 조용히 모아 보세요. 작은 기록이 쌓이면 다음 달에 이어 갈 기준이 훨씬 분명해져요.`,
      ]);
    case 'thisYear':
      return pickVariant(ctx, 'periodHorizon', [
        `올해에는 ${withObjectParticle(label)} 한 번의 사건보다 방향으로 보는 편이 좋아요. 계절마다 조금씩 달라지는 마음과 환경을 기록하면, 연말에 남길 선택이 더 분명해져요.`,
        `올해에는 ${withObjectParticle(label)} 당장의 성과만으로 판단하기보다 계절별 흐름으로 나누어 보세요. 지금의 선택이 몇 달 뒤 어떤 부담이나 도움으로 이어질지 살피면 좋아요.`,
        `올해에는 ${label}에서 지금 바로 보이는 결과보다 오래 남을 기준을 먼저 보세요. 계절마다 무엇을 줄이고 무엇을 이어 갈지 나누면 방향이 덜 흔들려요.`,
        `올해에는 ${withObjectParticle(label)} 한 번에 결론 내리기보다 몇 달 단위로 다시 확인하는 편이 좋아요. 지금의 선택이 나중에 부담인지 도움이 될지 천천히 살피면 돼요.`,
        `올해에는 ${label}에서 크게 달라질 일과 꾸준히 지킬 일을 나누어 보세요. 두 가지가 보이면 한 해의 흐름을 더 현실적으로 읽을 수 있어요.`,
        `올해에는 ${withObjectParticle(label)} 빠른 판단보다 반복해서 확인할 기준으로 보는 편이 좋아요. 봄, 여름, 가을, 겨울마다 같은 조언도 다르게 느껴질 수 있어요.`,
        `올해에는 ${withObjectParticle(label)} 급하게 결론 내리기보다 오래 유지할 방식으로 잡아 가는 편이 좋아요. 계절마다 한 번 돌아보면 방향을 놓치지 않아요.`,
      ]);
    case 'life':
      return pickVariant(ctx, 'periodHorizon', [
        `긴 흐름에서는 ${withSubjectParticle(label)} 한 시기에만 고정되지 않아요. 지금의 모습이 전부라고 단정하기보다, 나이와 환경이 바뀔 때 어떤 방식으로 조절할지 함께 보는 것이 좋아요. ${lifeNudge}`,
        `긴 흐름에서는 ${withObjectParticle(label)} 한 번의 좋고 나쁨으로 정하지 않는 편이 좋아요. 시간이 지나며 달라지는 역할과 환경을 함께 보면 더 넓게 이해할 수 있어요. ${lifeNudge}`,
        `긴 흐름에서는 ${withSubjectParticle(label)} 나이와 경험에 따라 다른 모습으로 나타날 수 있어요. 앞으로 이어질 준비와 나중에 다시 살필 부분을 나누어 보면 부담이 줄어요. ${lifeNudge}`,
        `긴 흐름에서는 ${withObjectParticle(label)} 한 시기의 모습만으로 결론 내리지 않는 편이 좋아요. 오래 이어지는 습관과 반복해서 달라지는 환경을 함께 보면 선택의 폭이 넓어져요. ${lifeNudge}`,
        `긴 흐름에서는 ${withSubjectParticle(label)} 계절처럼 조금씩 모양을 바꿀 수 있어요. 잘 맞는 방식은 남기고 버거운 방식은 덜어 내면 오래 가는 기준을 찾기 쉬워요. ${lifeNudge}`,
        `긴 흐름에서는 ${withObjectParticle(label)} 한 장면으로 판단하기보다 반복되는 습관으로 보는 것이 좋아요. 여러 해에 걸쳐 비슷하게 나타나는 선택을 살피면 내 기준이 더 또렷해져요. ${lifeNudge}`,
        `긴 흐름에서는 ${withSubjectParticle(label)} 빠르게 답을 내기보다 오래 쓸 수 있는 방향을 찾는 과정에 가까워요. 지금 납득되는 기준과 나중에 다시 볼 기준을 나누면 읽기가 한결 편해요. ${lifeNudge}`,
        `긴 흐름에서는 ${withObjectParticle(label)} 좋다 나쁘다로만 나누지 않는 편이 좋아요. 어떤 환경에서 편해지고 어떤 상황에서 부담이 커지는지 나누어 보면 실제 선택에 더 도움이 돼요. ${lifeNudge}`,
        `긴 흐름에서는 ${withSubjectParticle(label)} 한 번 정한 답으로 끝나지 않아요. 생활이 달라질 때마다 같은 주제도 다르게 느껴질 수 있으니, 생활에 맞춰 조정할 부분부터 가볍게 잡아 보세요. ${lifeNudge}`,
      ]);
  }
}
function wealthSelfCheckGuidance(ctx: StandardDepthEnhancementContext, scope: string): string {
  if (isYoungChildReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)) {
    return pickVariant(ctx, 'sourceWealthSelfCheck', [
      `읽고 난 뒤에는 ${scope} 갖고 싶은 것, 기다릴 수 있는 것, 보호자와 함께 정할 약속을 세 칸으로 나누어 보세요. 세 칸이 보이면 아이도 선택을 더 편하게 배워요.`,
      `다 읽은 뒤에는 ${scope} 바로 고를 것과 조금 기다려도 되는 것을 나누어 보세요. 기다릴 수 있는 선택이 하나만 보여도 다음 결정이 덜 급해져요.`,
      `해석을 덮기 전에 ${scope} 고른 뒤 마음이 편했던 이유를 하나 떠올려 보세요. 이유가 보이면 다음 선택에서도 같은 기준을 다시 쓸 수 있어요.`,
      `읽고 난 뒤에는 ${scope} 보호자에게 먼저 물어볼 것과 아이가 스스로 고를 수 있는 것을 나누어 보세요. 기준이 작으면 선택도 부담보다 연습이 돼요.`,
      `다 읽은 뒤에는 ${scope} 이번에는 기다리고 다음에 다시 볼 물건 하나를 정해 보세요. 기다림을 벌로 느끼지 않게 이유를 함께 말해 주면 좋아요.`,
      `해석을 덮기 전에 ${scope} 오늘 잘 기다린 장면을 하나 찾아보세요. 잘한 장면을 먼저 보면 줄일 부분도 아이에게 덜 무겁게 들려요.`,
    ]);
  }
  const moneyAnchor = isYoungChildReader(ctx)
    ? '갖고 싶은 것, 기다릴 수 있는 것, 보호자와 정할 약속'
    : isMinorReader(ctx)
      ? '용돈, 필요한 물건, 기다릴 수 있는 소비'
      : '고정 지출, 꼭 필요한 지출, 미룰 수 있는 지출';
  return pickVariant(ctx, 'sourceWealthSelfCheck', [
    `읽고 난 뒤에는 ${scope} ${moneyAnchor}을 세 칸으로 나누어 보세요. 돈과 물건을 한꺼번에 판단하지 않으면 지금 필요한 선택이 훨씬 선명해져요.`,
    `다 읽은 뒤에는 ${scope} 바로 써도 되는 것과 하루 더 기다려도 되는 것을 나누어 보세요. 기다릴 수 있는 선택이 보이면 충동보다 기준이 먼저 서요.`,
    `해석을 덮기 전에 ${scope} 최근 만족이 오래간 선택과 금방 부담이 된 선택을 하나씩 떠올려 보세요. 두 장면을 비교하면 다음 소비의 기준이 쉬워져요.`,
    `${scope} 오늘 꼭 지킬 기준과 잠시 미뤄도 되는 선택을 따로 보세요. 두 가지가 나뉘면 지출을 참아야 한다는 압박보다 무엇을 먼저 살필지가 더 분명해져요.`,
    `${scope} 돈을 쓰고 싶은 이유를 한 번만 더 살펴보세요. 꼭 필요한 비용인지, 마음이 급해서 빨리 처리하려는 비용인지가 보이면 기다릴 일과 바로 할 일이 자연스럽게 갈라져요.`,
    `해석을 덮기 전에 ${scope} 한 번 더 확인하면 좋은 선택을 하나 표시해 보세요. 바로 결정하지 않아도 되는 일이 보이면 마음의 속도도 차분해져요.`,
    `읽고 난 뒤에는 ${scope} 작은 기록으로 남길 항목 하나를 고르세요. 날짜와 이유만 적어도 다음에 비슷한 선택을 할 때 훨씬 덜 흔들려요.`,
    `다 읽은 뒤에는 ${scope} 나누거나 선물할 일과 내가 먼저 챙겨야 할 일을 구분해 보세요. 마음이 좋아도 내 부담을 함께 봐야 오래 편해요.`,
    `해석을 덮기 전에 ${scope} 반복해서 나가는 돈이나 물건 습관 하나를 확인해 보세요. 작게 반복되는 선택이 쌓이면 생각보다 큰 흐름을 만들어요.`,
    `읽고 난 뒤에는 ${scope} 오늘 줄일 것보다 계속 지켜도 좋은 기준을 먼저 떠올려 보세요. 이미 잘되는 기준을 알면 줄일 부분도 덜 무겁게 보여요.`,
    `다 읽은 뒤에는 ${scope} 혼자 정하기 어려운 선택을 가까운 사람과 함께 확인할지 생각해 보세요. 짧게 물어보는 것만으로도 실수를 줄일 수 있어요.`,
    `해석을 덮기 전에 ${scope} 다음 선택에서 먼저 물어볼 질문 하나를 남겨 보세요. 지금 꼭 필요한지, 기다릴 수 있는지, 오래 쓸 수 있는지만 확인해도 충분해요.`,
    `읽고 난 뒤에는 ${scope} 다음 지출 앞에서 멈춰 볼 기준을 하나 정해 보세요. 오래 쓸지, 다른 방법이 있는지, 지금 사야 하는지만 물어봐도 선택이 차분해져요.`,
    `다 읽은 뒤에는 ${scope} 바로 결정할 일과 하루 더 생각할 일을 나누어 보세요. 기다릴 수 있는 선택이 보이면 돈의 흐름도 덜 급해져요.`,
    `읽고 난 뒤에는 ${scope} 사고 싶은 마음과 실제로 자주 쓸 장면을 따로 떠올려 보세요. 장면이 잘 보이지 않으면 조금 기다리는 쪽이 더 편할 수 있어요.`,
    `다 읽은 뒤에는 ${scope} 이번에 줄이면 마음이 가벼워질 부담 하나를 골라 보세요. 큰 절약보다 반복되는 작은 부담을 덜어 내는 것이 더 현실적이에요.`,
    `해석을 덮기 전에 ${scope} 돈으로 해결할 일과 말로 조율할 일을 나누어 보세요. 모두 지출로 풀려고 하지 않으면 선택의 폭이 넓어져요.`,
    `읽고 난 뒤에는 ${scope} 돈으로 바로 처리할 일과 먼저 대화가 필요한 일을 나누어 보세요. 이유가 보이면 불필요한 지출도 자연스럽게 줄어요.`,
    `다 읽은 뒤에는 ${scope} 지출로 풀 수 있는 문제와 말로 조율해야 하는 문제를 따로 보세요. 돈이 아닌 방법이 보이면 선택의 폭도 더 넓어져요.`,
    `읽고 난 뒤에는 ${scope} 돈을 쓰기 전에 먼저 말로 풀 수 있는 부분이 있는지 살펴보세요. 일정 조정이나 부탁으로 해결되는 일이 보이면 지출 부담도 줄어요.`,
    `해석을 덮기 전에 ${scope} 비용이 필요한 일과 대화가 먼저 필요한 일을 나누어 보세요. 둘이 구분되면 돈으로만 해결하려는 마음이 차분해져요.`,
    `다 읽은 뒤에는 ${scope} 바로 결제할 일과 먼저 조건을 확인할 일을 나누어 보세요. 조건이 보이면 불필요한 지출을 줄이기 쉬워요.`,
    `읽고 난 뒤에는 ${scope} 돈을 쓰면 편해질 일과 말로 조율하면 가벼워질 일을 따로 떠올려 보세요. 해결 방법이 나뉘면 선택의 폭이 넓어져요.`,
    `해석을 덮기 전에 ${scope} 비용을 쓰기 전에 먼저 확인할 조건 하나를 정해 보세요. 조건이 분명하면 지출이 급한 마음인지 실제 필요인지 구분하기 쉬워요.`,
    `읽고 난 뒤에는 ${scope} 돈을 쓰면 편해지는 일과 대화가 먼저 필요한 일을 나누어 보세요. 둘이 구분되면 불필요한 부담을 줄일 수 있어요.`,
    `다 읽은 뒤에는 ${scope} 오늘 바로 쓸 돈과 먼저 물어볼 일을 한 줄씩 적어 보세요. 한 줄만 있어도 다음 선택에서 속도를 조절하기 쉬워요.`,
    `다 읽은 뒤에는 ${scope} 필요한 비용, 마음이 급해서 쓰는 비용, 누군가와 조율할 비용을 따로 떠올려 보세요. 세 가지가 구분되면 선택이 훨씬 차분해져요.`,
    `해석을 덮기 전에 ${scope} 지출로 해결하려던 일을 말이나 일정 조정으로 줄일 수 있는지 살펴보세요. 돈을 쓰기 전에 방법을 나누면 부담이 덜 커져요.`,
    `읽고 난 뒤에는 ${scope} 돈을 쓰기 전에 바꿔 볼 방법이 있는지 하나만 떠올려 보세요. 일정 조정, 부탁, 기다림 중 하나로 줄어들면 지출도 더 차분해져요.`,
    `다 읽은 뒤에는 ${scope} 돈으로 바로 풀 일과 먼저 이야기해 볼 일을 나누어 보세요. 대화로 줄어드는 부담이 보이면 꼭 지출하지 않아도 되는 선택이 생겨요.`,
    `해석을 덮기 전에 ${scope} 비용을 들이기 전에 시간을 조정하거나 도움을 구할 수 있는지 살펴보세요. 돈이 아닌 방법이 보이면 선택의 폭이 넓어져요.`,
    `읽고 난 뒤에는 ${scope} 지출이 해결책처럼 보이는 일을 한 번만 더 나누어 보세요. 실제 필요와 급한 마음이 구분되면 돈을 쓰는 기준도 훨씬 선명해져요.`,
    `읽고 난 뒤에는 ${scope} 이번에 꼭 써야 할 돈과 기다려도 되는 돈을 한 줄씩 남겨 보세요. 한 줄만 있어도 다음 선택에서 흔들림이 줄어요.`,
    `다 읽은 뒤에는 ${scope} 돈보다 먼저 확인할 약속이나 조건을 하나 정해 보세요. 조건이 또렷하면 지출도 더 안전하게 결정할 수 있어요.`,
    `읽고 난 뒤에는 ${scope} 다음에 같은 선택이 왔을 때 다시 쓸 기준을 한 문장으로 적어 보세요. 기준이 짧을수록 실제 순간에 떠올리기 쉬워요.`,
    `다 읽은 뒤에는 ${scope} 최근 돈을 쓰고도 마음이 편했던 이유를 하나 적어 보세요. 편했던 이유가 보이면 다음 선택에서도 같은 기준을 다시 쓸 수 있어요.`,
    `해석을 덮기 전에 ${scope} 반복해서 미루는 돈 문제 하나를 떠올려 보세요. 금액보다 미룬 이유를 알면 해결할 순서가 훨씬 작아져요.`,
    `읽고 난 뒤에는 ${scope} 이번 선택이 내 생활을 가볍게 하는지 무겁게 하는지 나누어 보세요. 느낌이 갈리면 하루 더 기다리는 쪽이 안전할 수 있어요.`,
    `다 읽은 뒤에는 ${scope} 바로 줄일 돈보다 계속 지켜야 할 기준을 먼저 골라 보세요. 지킬 기준이 있어야 줄이는 일도 오래 이어져요.`,
    `해석을 덮기 전에 ${scope} 돈을 쓰기 전에 물어볼 사람이나 확인할 자료를 정해 보세요. 혼자 급히 결정하지 않으면 실수도 줄어들어요.`,
    `읽고 난 뒤에는 ${scope} 다음 달에도 반복될 선택과 이번 한 번으로 끝날 선택을 나누어 보세요. 반복될 일을 먼저 보면 관리 기준이 더 분명해져요.`,
    `다 읽은 뒤에는 ${scope} 마음이 급해서 쓰려는 돈이 있는지 확인해 보세요. 급한 마음과 실제 필요가 구분되면 선택이 훨씬 차분해져요.`,
  ]);
}

function familySelfCheckGuidance(ctx: StandardDepthEnhancementContext, scope: string): string {
  const familyAnchor = isMinorReader(ctx) ? '보호자나 가까운 어른' : '가족이나 가까운 사람';
  return pickVariant(ctx, 'sourceFamilySelfCheck', [
    `읽고 난 뒤에는 ${scope} 먼저 안부를 전할 사람과 조금 기다려도 되는 대화를 나누어 보세요. 가까운 관계일수록 속도를 맞추는 일이 중요해요.`,
    `해석을 덮기 전에 ${scope} 내가 먼저 건넬 말과 상대가 준비될 때까지 기다릴 말을 나누어 보세요. 가까운 관계도 말의 순서가 보이면 훨씬 편해져요.`,
    `다 읽은 뒤에는 ${scope} 오늘 바로 연락할 사람, 이번 주에 볼 사람, 잠시 쉬어도 되는 관계를 나누어 보세요. 모두를 같은 속도로 챙기지 않아도 괜찮아요.`,
    `다 읽은 뒤에는 ${scope} 내가 맡을 수 있는 작은 역할과 혼자 맡지 않아도 되는 일을 구분해 보세요. 역할이 분명하면 마음의 부담도 줄어요.`,
    `읽고 난 뒤에는 ${scope} 내가 오늘 챙길 몫과 함께 나누어도 되는 몫을 따로 떠올려 보세요. 역할이 나뉘면 가까운 관계도 덜 무거워져요.`,
    `해석을 덮기 전에 ${scope} 혼자 책임지려는 일이 있는지 살펴보세요. 부탁할 일과 기다릴 일을 구분하면 마음의 피로가 줄어요.`,
    `다 읽은 뒤에는 ${scope} 내가 바로 도울 일과 상대가 스스로 해도 되는 일을 나누어 보세요. 구분이 생기면 관계의 균형도 더 편해져요.`,
    `읽고 난 뒤에는 ${scope} 책임의 크기를 작게 나누어 보세요. 내가 맡을 한 가지와 함께 정할 한 가지가 보이면 부담도 현실적인 크기로 줄어요.`,
    `읽고 난 뒤에는 ${scope} 내가 맡아도 되는 일과 함께 나눌 일을 따로 떠올려 보세요. 혼자 감당하지 않아도 되는 부분이 보이면 관계가 덜 무거워져요.`,
    `다 읽은 뒤에는 ${scope} 내가 바로 챙길 일과 가족이나 가까운 사람이 함께 볼 일을 나누어 보세요. 역할이 나뉘면 마음의 무게도 훨씬 현실적으로 보여요.`,
    `해석을 덮기 전에 ${scope} 혼자 안고 있는 책임이 있는지 살펴보세요. 부탁할 일과 기다릴 일을 구분하면 가까운 관계도 덜 지치게 이어져요.`,
    `읽고 난 뒤에는 ${scope} 내가 먼저 움직일 일과 같이 정해야 할 일을 나누어 보세요. 함께 정할 몫이 보이면 서운함이 커지기 전에 조율할 수 있어요.`,
    `다 읽은 뒤에는 ${scope} 도와줄 수 있는 범위와 도움을 받아도 되는 범위를 따로 적어 보세요. 주고받을 기준이 있어야 가까운 마음도 오래 편해져요.`,
    `해석을 덮기 전에 ${scope} 내가 편하게 도울 수 있는 일과 부탁해야 할 일을 나누어 보세요. 주고받을 기준이 생기면 가까운 관계도 오래 편해져요.`,
    `다 읽은 뒤에는 ${scope} 내가 맡을 몫과 다음에 함께 정할 몫을 구분해 보세요. 역할의 크기가 보이면 마음도 훨씬 차분해져요.`,
    `읽고 난 뒤에는 ${scope} 책임이 한쪽으로 몰린 장면이 있는지 살펴보세요. 나눌 수 있는 작은 역할 하나만 찾아도 관계의 부담이 내려가요.`,
    `해석을 덮기 전에 ${scope} 고마웠던 장면 하나와 불편했던 장면 하나를 따로 떠올려 보세요. 둘을 나누면 말투를 고르기가 훨씬 쉬워져요.`,
    `읽고 난 뒤에는 ${scope} 오늘 바로 할 수 있는 짧은 연락 하나를 생각해 보세요. 긴 대화가 아니어도 안부 한마디가 관계의 온도를 지켜 줘요.`,
    `다 읽은 뒤에는 ${scope} 내가 먼저 말할 일과 상대가 말할 때까지 기다릴 일을 나누어 보세요. 기다림도 관계를 돌보는 방식이 될 수 있어요.`,
    `해석을 덮기 전에 ${scope} 최근 마음이 편했던 집안 분위기를 떠올려 보세요. 그때의 말투, 시간, 거리감을 알면 다시 만들 기준이 생겨요.`,
    `읽고 난 뒤에는 ${scope} 도와줄 수 있는 일과 도움을 받아야 하는 일을 함께 보세요. 주고받는 균형이 있어야 가까운 관계가 덜 지쳐요.`,
    `다 읽은 뒤에는 ${scope} ${familyAnchor}에게 확인할 작은 약속 하나를 남겨 보세요. 약속의 크기가 작아야 실제로 지키기 쉬워요.`,
    `해석을 덮기 전에 ${scope} 오래 묵은 이야기는 바로 결론 내리려 하지 말아 보세요. 먼저 오늘 가능한 말 한마디를 고르는 편이 더 안전해요.`,
    `읽고 난 뒤에는 ${scope} 미뤄 둔 대화가 있다면 바로 풀려고 하지 않아도 괜찮아요. 첫마디를 작게 준비하면 마음이 덜 급해져요.`,
    `다 읽은 뒤에는 ${scope} 마음에 남은 가족 이야기를 해결할 일과 기다릴 일로 나누어 보세요. 둘을 구분하면 말의 무게도 훨씬 가벼워져요.`,
    `읽고 난 뒤에는 ${scope} 바로 꺼낼 가족 이야기와 조금 더 시간을 둘 이야기를 나누어 보세요. 말할 순서가 보이면 가까운 관계도 덜 날카로워져요.`,
    `해석을 덮기 전에 ${scope} 마음에 걸린 일을 오늘 가능한 크기로 줄여 보세요. 안부, 고마움, 부탁 중 하나만 골라도 대화가 훨씬 편해져요.`,
    `다 읽은 뒤에는 ${scope} 내가 풀고 싶은 말과 상대가 준비되어야 할 말을 구분해 보세요. 기다릴 말을 알면 관계를 급하게 몰아붙이지 않게 돼요.`,
    `읽고 난 뒤에는 ${scope} 오래된 이야기를 바로 결론 내리려 하지 말고 첫마디만 작게 준비해 보세요. 시작이 작으면 다음 대화도 덜 부담스러워요.`,
    `해석을 덮기 전에 ${scope} 오래된 서운함은 오늘 가능한 크기로만 다루어 보세요. 안부, 고마움, 부탁 중 하나만 골라도 관계를 다시 살필 수 있어요.`,
    `읽고 난 뒤에는 ${scope} 내가 자주 반복하는 반응 하나를 알아차려 보세요. 같은 반응이 보이면 다음 대화에서 조금 다르게 해 볼 틈이 생겨요.`,
    `다 읽은 뒤에는 ${scope} 내가 자주 쓰는 말투와 상대가 편해했던 말투를 나누어 보세요. 둘이 보이면 다음 대화에서 바꿀 지점이 작아져요.`,
    `해석을 덮기 전에 ${scope} 내가 급해지는 말투와 상대가 편안해진 말투를 따로 떠올려 보세요. 차이가 보이면 다음 대화의 속도도 조절하기 쉬워요.`,
    `읽고 난 뒤에는 ${scope} 최근 대화에서 분위기가 부드러워졌던 말을 하나 기억해 보세요. 그 말투를 다시 쓰면 관계가 덜 날카로워져요.`,
    `다 읽은 뒤에는 ${scope} 내가 자주 꺼내는 말과 조금 줄이면 좋을 말을 나누어 보세요. 말의 크기가 정리되면 가까운 관계도 편해져요.`,
    `해석을 덮기 전에 ${scope} 상대가 편하게 들었던 부탁 방식이 있었는지 떠올려 보세요. 부탁의 말투가 보이면 다음 대화의 부담도 줄어요.`,
    `해석을 덮기 전에 ${scope} 같은 상황에서 내가 먼저 굳어지는 순간을 떠올려 보세요. 그 순간을 알면 다음에는 조금 더 부드럽게 반응할 수 있어요.`,
    `읽고 난 뒤에는 ${scope} 자주 반복되는 대화 장면 하나를 떠올려 보세요. 시작을 조금 바꾸면 관계의 분위기도 달라질 수 있어요.`,
    `다 읽은 뒤에는 ${scope} 챙겨야 할 사람과 잠시 거리를 두어도 되는 상황을 나누어 보세요. 가까움과 쉼이 함께 있어야 관계가 오래 편해요.`,
    `해석을 덮기 전에 ${scope} 미안함, 고마움, 부탁 중 지금 가장 가볍게 말할 수 있는 것을 하나 고르세요. 쉬운 말부터 꺼내야 대화가 이어져요.`,
    `읽고 난 뒤에는 ${scope} 나만 참는 일과 서로 맞춰 볼 일을 구분해 보세요. 구분이 생기면 관계를 무겁게 짊어지지 않아도 돼요.`,
    `다 읽은 뒤에는 ${scope} 다음 만남에서 내가 지킬 작은 태도를 하나 정해 보세요. 시간, 말투, 부탁의 크기 중 하나만 가볍게 정해도 관계가 덜 흔들려요.`,
    `해석을 덮기 전에 ${scope} 다음 연락에서 부담을 줄일 기준 하나를 남겨 보세요. 답을 빨리 내기보다 말투와 시간을 먼저 고르면 훨씬 편해져요.`,
    `읽고 난 뒤에는 ${scope} 다음 대화에서 꼭 말할 것과 굳이 오늘 말하지 않아도 되는 것을 나누어 보세요. 덜어낸 말이 있어야 필요한 말도 더 부드럽게 전해져요.`,
    `다 읽은 뒤에는 ${scope} 가까운 사람에게 바라는 점을 부탁, 감사, 기다림 중 하나로 줄여 보세요. 말의 모양이 작아지면 관계도 덜 긴장돼요.`,
    `해석을 덮기 전에 ${scope} 관계를 고치려 하기보다 편해졌던 장면을 다시 만드는 방법을 생각해 보세요. 같은 시간대, 같은 말투, 같은 거리감이 작은 실마리가 될 수 있어요.`,
    `읽고 난 뒤에는 ${scope} 가까운 사람에게 지킬 예의 하나와 잠시 기다릴 말을 나누어 보세요. 둘을 구분하면 마음이 급해질 때도 관계를 덜 몰아붙이게 돼요.`,
    `해석을 덮기 전에 ${scope} 이미 잘 이어지고 있는 습관을 하나 확인해 보세요. 잘되는 부분을 알아야 고칠 부분도 덜 날카롭게 보여요.`,
    `읽고 난 뒤에는 ${scope} 바로 해결할 갈등보다 관계를 덜 힘들게 할 순서 하나를 남겨 보세요. 순서가 보이면 말도 훨씬 차분해져요.`,
  ]);
}

function romanceSelfCheckGuidance(ctx: StandardDepthEnhancementContext, scope: string): string {
  const relationAnchor = isMinorReader(ctx) ? '친구' : '상대';
  return pickVariant(ctx, 'sourceRomanceSelfCheck', [
    `읽고 난 뒤에는 ${scope} 내가 편한 속도와 ${relationAnchor}가 편한 속도를 따로 떠올려 보세요. 속도가 다를 수 있다는 점을 알면 마음이 덜 급해져요.`,
    `다 읽은 뒤에는 ${scope} 바로 말할 감정과 조금 더 지켜볼 감정을 나누어 보세요. 모든 마음을 즉시 결론 내리지 않아도 관계는 이어질 수 있어요.`,
    `해석을 덮기 전에 ${scope} 편했던 대화와 불편했던 대화를 하나씩 떠올려 보세요. 두 장면을 비교하면 다음 말투를 고르기 쉬워요.`,
    `해석을 덮기 전에 ${scope} 마음이 편했던 순간과 조심스러웠던 순간을 나누어 보세요. 두 느낌이 보이면 다음 대화의 속도를 정하기 쉬워요.`,
    `읽고 난 뒤에는 ${scope} 대화가 부드러웠던 이유와 부담스러웠던 이유를 한 가지씩 떠올려 보세요. 이유가 보이면 같은 실수를 줄이기 쉬워요.`,
    `다 읽은 뒤에는 ${scope} 말이 잘 통했던 장면과 마음이 닫혔던 장면을 따로 보세요. 비교가 되면 다음에는 어떤 말투를 줄일지 더 분명해져요.`,
    `해석을 덮기 전에 ${scope} 내가 편했던 거리감과 부담스러웠던 거리감을 나누어 보세요. 거리감이 보이면 관계를 더 안전하게 조절할 수 있어요.`,
    `읽고 난 뒤에는 ${scope} 내가 먼저 다가갈 일과 기다려도 되는 일을 구분해 보세요. 다가감과 기다림이 함께 있어야 관계가 덜 흔들려요.`,
    `다 읽은 뒤에는 ${scope} 마음이 커지는 순간과 부담이 커지는 순간을 나누어 보세요. 둘을 구분하면 좋아하는 마음도 더 안전하게 다룰 수 있어요.`,
    `읽고 난 뒤에는 ${scope} 설레는 장면과 조심하고 싶은 장면을 따로 떠올려 보세요. 두 장면이 보이면 다음 말의 속도도 더 안전하게 정할 수 있어요.`,
    `해석을 덮기 전에 ${scope} 마음이 편안해진 순간과 급해진 순간을 나누어 보세요. 편안한 쪽을 기준으로 삼으면 관계를 무리하게 몰아붙이지 않게 돼요.`,
    `읽고 난 뒤에는 ${scope} 마음이 차분했던 대화와 빨라졌던 대화를 나누어 보세요. 차분한 장면을 기준으로 삼으면 다음 선택도 덜 급해져요.`,
    `해석을 덮기 전에 ${scope} 말이 편하게 오갔던 순간과 마음이 앞섰던 순간을 따로 떠올려 보세요. 둘을 나누면 다음 대화의 속도가 더 안전해져요.`,
    `다 읽은 뒤에는 ${scope} 편안했던 말투와 부담스러웠던 말투를 하나씩 기억해 보세요. 어떤 말이 편했는지 알면 관계를 덜 서두르게 돼요.`,
    `읽고 난 뒤에는 ${scope} 대화 뒤 마음이 가벼웠던 장면을 기준으로 삼아 보세요. 그 장면을 알면 다음 연락이나 만남도 더 차분하게 정할 수 있어요.`,
    `해석을 덮기 전에 ${scope} 마음이 빨라질 때 줄일 말 하나를 골라 보세요. 줄일 말이 보이면 전할 말도 더 부드럽게 남아요.`,
    `다 읽은 뒤에는 ${scope} 설렘이 편안함으로 이어진 순간과 부담으로 바뀐 순간을 따로 떠올려 보세요. 둘을 구분하면 관계의 속도를 정하기 쉬워요.`,
    `해석을 덮기 전에 ${scope} 내가 무리하지 않아도 편했던 장면을 하나 남겨 보세요. 그 장면이 다음 관계의 좋은 기준이 될 수 있어요.`,
    `읽고 난 뒤에는 ${scope} 마음이 앞섰던 순간과 상대의 속도를 기다릴 수 있었던 순간을 나누어 보세요. 기다릴 수 있었던 장면이 관계를 안정시켜요.`,
    `해석을 덮기 전에 ${scope} 다음 대화에서 지킬 작은 기준 하나를 정해 보세요. 답장 속도, 말투, 만나는 시간 중 하나만 분명해도 좋아요.`,
    `읽고 난 뒤에는 ${scope} 내가 자주 기대하는 반응을 하나 확인해 보세요. 기대가 보이면 서운함이 생기기 전에 말로 조절할 수 있어요.`,
    `다 읽은 뒤에는 ${scope} 혼자 상상한 이야기와 실제로 확인한 사실을 나누어 보세요. 둘을 구분하면 마음이 지나치게 앞서가지 않아요.`,
    `해석을 덮기 전에 ${scope} 고마웠던 말과 조심하고 싶은 말을 하나씩 남겨 보세요. 좋은 말도 기준이 되고, 조심할 말도 다음 대화의 안전장치가 돼요.`,
    `읽고 난 뒤에는 ${scope} 가까워지고 싶은 마음과 지켜야 할 내 생활을 함께 보세요. 관계가 좋아도 내 리듬을 잃지 않는 것이 중요해요.`,
    `다 읽은 뒤에는 ${scope} 이번에 꼭 확인할 마음 하나와 그냥 흘려보낼 감정 하나를 나누어 보세요. 모든 감정을 붙잡지 않아야 관계가 가벼워져요.`,
    `해석을 덮기 전에 ${scope} 불편함이 생겼을 때 바로 쓸 수 있는 짧은 말을 준비해 보세요. 어렵게 설명하지 않아도 차분한 한마디가 도움이 돼요.`,
    `읽고 난 뒤에는 ${scope} 나를 편하게 해 주는 거리감을 생각해 보세요. 가까워지는 것만큼 편한 간격을 아는 것도 관계의 중요한 기준이에요.`,
    `다 읽은 뒤에는 ${scope} 더 가까워질 일과 지금 간격을 지켜도 되는 일을 나누어 보세요. 거리감이 정리되면 마음을 급하게 증명하지 않아도 돼요.`,
    `해석을 덮기 전에 ${scope} 편했던 대화의 속도를 떠올려 보세요. 그 속도를 알면 다음 만남에서도 무리 없이 마음을 전할 수 있어요.`,
    `다 읽은 뒤에는 ${scope} 내가 이미 잘하고 있는 배려를 하나 확인해 보세요. 잘하는 부분을 알아야 더 조심할 부분도 부드럽게 보여요.`,
    `해석을 덮기 전에 ${scope} 내가 자주 지키는 작은 예의를 떠올려 보세요. 이미 되는 부분을 알면 다음에 줄일 말투도 더 편하게 보여요.`,
    `읽고 난 뒤에는 ${scope} 상대에게 부담을 덜 준 행동 하나를 기억해 보세요. 그 장면이 다음 관계를 부드럽게 이어 가는 기준이 될 수 있어요.`,
    `다 읽은 뒤에는 ${scope} 내가 잘 듣고 기다렸던 순간을 하나 떠올려 보세요. 그런 장면을 알면 관계에서 계속 살릴 태도도 분명해져요.`,
    `해석을 덮기 전에 ${scope} 다음 만남이나 연락에서 무리하지 않을 기준을 하나 정해 보세요. 작은 기준이 있어야 마음이 커질 때도 덜 흔들려요.`,
    `읽고 난 뒤에는 ${scope} 혼자 결론 내리기 전에 확인해도 되는 질문 하나를 남겨 보세요. 짧고 부드러운 질문은 관계를 더 편하게 만들어 줘요.`,
  ]);
}
function selfCheckGuidance(ctx: StandardDepthEnhancementContext): string {
  const scope = periodCategoryAreaPhrase(ctx);


  if (ctx.period === 'life' && ctx.category === 'academic') {
    return pickVariant(ctx, 'sourceAcademicPractice', [
      '읽고 난 뒤에는 인생 전체의 공부와 배움에서 지금까지 도움이 되었던 방식과 앞으로 줄일 방식을 나누어 보세요. 잘 맞는 공부법을 알아야 새 배움도 덜 부담스럽게 붙어요.',
      '다 읽은 뒤에는 인생 전체의 공부와 배움에서 오래 써먹은 방법과 이제 덜어낼 방법을 나누어 보세요. 남길 방식이 보이면 새로 배울 내용도 더 편하게 들어와요.',
      '해석을 덮기 전에 인생 전체의 공부와 배움에서 나에게 잘 맞았던 학습 환경을 떠올려 보세요. 장소, 시간, 설명 방식 중 하나만 알아도 다음 배움이 덜 막막해져요.',
      '읽고 난 뒤에는 인생 전체의 공부와 배움에서 계속 가져갈 습관과 잠시 내려놓을 부담을 구분해 보세요. 둘을 나누면 배움이 의무보다 생활에 가까워져요.',
      '다 읽은 뒤에는 인생 전체의 공부와 배움에서 새로 시작할 것보다 다시 꺼내 볼 것을 먼저 정해 보세요. 이미 쌓은 배움이 다음 단계의 바탕이 될 수 있어요.',
      '다 읽은 뒤에는 인생 전체의 공부와 배움에서 오래 남은 배움 하나와 아직 부담스러운 배움 하나를 떠올려 보세요. 둘을 나누면 앞으로 무엇을 더 가볍게 볼지 정하기 쉬워요.',
      '해석을 덮기 전에 인생 전체의 공부와 배움에서 다시 시작해도 괜찮은 작은 주제를 하나 정해 보세요. 나이가 달라져도 작게 시작하면 배움은 다시 이어질 수 있어요.',
      '읽고 난 뒤에는 인생 전체의 공부와 배움에서 내가 이해하기 쉬웠던 설명 방식을 떠올려 보세요. 그 방식을 알면 다음 공부를 고를 때도 덜 헤매요.',
      '다 읽은 뒤에는 인생 전체의 공부와 배움에서 기록으로 남길 것과 경험으로만 기억할 것을 나누어 보세요. 모두 붙잡지 않아도 배움의 방향은 충분히 남아요.',
      '해석을 덮기 전에 인생 전체의 공부와 배움에서 도움을 청해도 되는 사람이나 자료를 하나 떠올려 보세요. 혼자 버티기보다 도움받을 길을 알면 배움이 오래 이어져요.',
      '읽고 난 뒤에는 인생 전체의 공부와 배움에서 지금의 생활에 붙일 수 있는 한 가지를 골라 보세요. 바로 써먹을 장면이 보이면 공부가 훨씬 현실적으로 느껴져요.',
      '다 읽은 뒤에는 인생 전체의 공부와 배움에서 예전보다 편해진 부분을 먼저 확인해 보세요. 잘해 온 부분을 알아야 새로 고칠 부분도 덜 무겁게 보여요.',
      '해석을 덮기 전에 인생 전체의 공부와 배움에서 꼭 깊게 볼 주제와 가볍게 지나갈 주제를 나누어 보세요. 힘을 줄 곳이 정해지면 배움의 부담이 줄어요.',
      '읽고 난 뒤에는 인생 전체의 공부와 배움에서 배운 내용을 누구에게 쉽게 설명할 수 있을지 떠올려 보세요. 설명할 사람이 정해지면 어려운 말도 내 말로 바꾸기 쉬워요.',
      '다 읽은 뒤에는 인생 전체의 공부와 배움에서 다시 펼쳐 볼 자료 하나만 정해 보세요. 자료가 많아도 다시 볼 것이 하나면 다음 시작이 훨씬 가벼워요.',
      '해석을 덮기 전에 인생 전체의 공부와 배움에서 오래 미뤄 둔 주제를 너무 크게 잡지 말아 보세요. 작은 단원이나 짧은 글 하나로 줄이면 다시 시작하기 쉬워요.',
      '읽고 난 뒤에는 인생 전체의 공부와 배움에서 내 속도에 맞는 시간대를 떠올려 보세요. 잘 맞는 시간이 보이면 공부를 의지로만 버티지 않아도 돼요.',
      '다 읽은 뒤에는 인생 전체의 공부와 배움에서 성과보다 유지할 리듬을 먼저 정해 보세요. 오래 보는 배움일수록 끝낼 양보다 다시 돌아올 길이 중요해요.',
      '해석을 덮기 전에 인생 전체의 공부와 배움에서 최근 궁금했던 질문 하나를 남겨 보세요. 좋은 질문이 있으면 다음 공부의 방향도 자연스럽게 생겨요.',
      '읽고 난 뒤에는 인생 전체의 공부와 배움에서 지금은 쉬어 가도 되는 범위를 하나 정해 보세요. 덜어낼 범위가 있어야 오래 배울 힘도 남아요.',
      '다 읽은 뒤에는 인생 전체의 공부와 배움에서 나에게 맞는 복습 방법을 하나 골라 보세요. 다시 읽기, 말로 설명하기, 짧게 적기 중 편한 방식이면 충분해요.',
      '해석을 덮기 전에 인생 전체의 공부와 배움에서 앞으로 남기고 싶은 기록의 모양을 떠올려 보세요. 한 줄 메모든 체크리스트든 다시 볼 수 있으면 좋은 자산이 돼요.',
      '읽고 난 뒤에는 인생 전체의 공부와 배움에서 비교를 줄일 기준을 하나 세워 보세요. 남의 속도보다 내 생활 안에서 이어지는지가 더 중요해요.',
      '다 읽은 뒤에는 인생 전체의 공부와 배움에서 배움이 생활을 편하게 만든 장면을 하나 떠올려 보세요. 그 장면이 다음에 무엇을 배울지 정하는 기준이 될 수 있어요.',
      '해석을 덮기 전에 인생 전체의 공부와 배움에서 지금 확인할 질문과 나중에 다시 볼 자료를 나누어 보세요. 둘을 구분하면 긴 해석도 훨씬 편하게 읽혀요.',
      '읽고 난 뒤에는 인생 전체의 공부와 배움에서 예전에 해 본 일과 새로 배우려는 내용을 나란히 놓아 보세요. 완전히 처음부터 시작하지 않아도 지금 가진 경험이 다음 배움의 발판이 될 수 있어요.',
      '다 읽은 뒤에는 인생 전체의 공부와 배움에서 이미 익숙한 경험 하나를 새 배움과 연결해 보세요. 아는 것과 모르는 것이 만나는 지점이 보이면 시작이 덜 막막해져요.',
      '해석을 덮기 전에 인생 전체의 공부와 배움에서 예전 경험이 지금의 공부를 도와줄 수 있는 장면을 떠올려 보세요. 배움은 빈칸에서 시작하기보다 지나온 시간 위에 더해질 때 편해져요.',
      '읽고 난 뒤에는 인생 전체의 공부와 배움에서 새로 배울 것과 이미 몸에 익은 것을 한 줄씩 나누어 보세요. 둘이 이어지는 부분을 찾으면 다음 공부가 훨씬 현실적으로 느껴져요.',
      '다 읽은 뒤에는 인생 전체의 공부와 배움에서 부담이 작아지는 시작 방식을 하나만 남겨 보세요. 제목을 훑기, 목차만 보기, 한 줄로 정리하기처럼 작아도 충분해요.',
      '해석을 덮기 전에 인생 전체의 공부와 배움에서 오래 가져갈 질문 하나와 지금 내려놓을 부담 하나를 나누어 보세요. 질문과 부담이 구분되면 배움이 덜 무겁게 남아요.',
      '읽고 난 뒤에는 인생 전체의 공부와 배움에서 지금의 나에게 필요한 배움과 단순한 호기심을 나누어 보세요. 둘을 구분하면 공부가 의무만으로 느껴지지 않아요.',
      '다 읽은 뒤에는 인생 전체의 공부와 배움에서 누군가에게 물어볼 질문 하나와 혼자 확인할 자료 하나를 정해 보세요. 도움받을 길과 스스로 볼 길이 함께 있으면 배움이 안정돼요.',
      '해석을 덮기 전에 인생 전체의 공부와 배움에서 배워 온 것 중 생활에 이미 도움이 된 장면을 떠올려 보세요. 쓸모를 확인하면 다음 배움도 덜 막연해져요.',
      '읽고 난 뒤에는 인생 전체의 공부와 배움에서 새로 시작할 공부보다 먼저 정리할 기억 하나를 골라 보세요. 이미 가진 경험이 정리되면 새 지식도 더 쉽게 붙어요.',
      '다 읽은 뒤에는 인생 전체의 공부와 배움에서 어려운 말을 내 말로 바꿀 수 있는 주제를 하나 골라 보세요. 쉽게 설명되는 부분이 보이면 배움의 중심도 더 또렷해져요.',
      '해석을 덮기 전에 인생 전체의 공부와 배움에서 앞으로 깊게 볼 분야와 가볍게 참고만 할 분야를 나누어 보세요. 모든 것을 같은 무게로 들지 않아야 오래 배울 수 있어요.',
      '읽고 난 뒤에는 인생 전체의 공부와 배움에서 최근 나를 도와준 책, 사람, 경험 중 하나를 떠올려 보세요. 도움의 출처를 알면 다음에 막힐 때 다시 찾아가기 쉬워요.',
      '다 읽은 뒤에는 인생 전체의 공부와 배움에서 예전보다 덜 막막해진 주제를 하나 떠올려 보세요. 조금 편해진 지점이 다음 배움의 좋은 출발점이 돼요.',
      '해석을 덮기 전에 인생 전체의 공부와 배움에서 배운 뒤 생활이 조금 쉬워진 장면을 확인해 보세요. 실제로 도움이 된 장면이 보이면 다음에 무엇을 배울지도 더 분명해져요.',
      '읽고 난 뒤에는 인생 전체의 공부와 배움에서 두려움이 줄어든 이유를 짧게 적어 보세요. 이유를 알면 다음 배움도 막연한 숙제가 아니라 쓸 수 있는 도구처럼 느껴져요.',
      '다 읽은 뒤에는 인생 전체의 공부와 배움에서 내가 조금 더 편하게 설명할 수 있게 된 내용을 골라 보세요. 설명이 쉬워진 부분은 앞으로 이어 갈 배움의 기준이 돼요.',
      '해석을 덮기 전에 인생 전체의 공부와 배움에서 전보다 자신감이 생긴 작은 장면을 떠올려 보세요. 작은 변화라도 확인해 두면 다음 시작이 훨씬 가벼워져요.',
    ]);
  }

  if (ctx.period === 'life' && ctx.category === 'study_document') {
    return pickVariant(ctx, 'sourceStudyDocumentSelfCheck', [
      '읽고 난 뒤에는 인생 전체의 기록과 서류에서 자주 찾는 자료와 거의 보지 않는 자료를 나누어 보세요. 자주 쓰는 것부터 정리하면 전체 서류가 덜 막막해져요.',
      '다 읽은 뒤에는 인생 전체의 기록과 서류에서 이름을 바꿔야 할 파일 하나와 버려도 되는 기록 하나를 떠올려 보세요. 작은 정리 두 가지가 나중의 시간을 크게 줄여 줘요.',
      '해석을 덮기 전에 인생 전체의 기록과 서류에서 다시 찾을 기준을 하나 정해 보세요. 날짜, 이름, 주제 중 하나만 통일해도 기록은 훨씬 쉬워져요.',
      '읽고 난 뒤에는 인생 전체의 기록과 서류에서 혼자 처리할 일과 확인받을 일을 나누어 보세요. 확인받을 일이 보이면 실수에 대한 부담도 줄어들어요.',
      '다 읽은 뒤에는 인생 전체의 기록과 서류에서 보관할 곳을 먼저 정해 보세요. 좋은 기록도 어디에 있는지 모르면 필요할 때 쓰기 어려워요.',
      '해석을 덮기 전에 인생 전체의 기록과 서류에서 가장 오래 미뤄 둔 정리 하나를 아주 작게 줄여 보세요. 파일 이름 하나 고치는 정도라도 시작이 되면 부담이 내려가요.',
      '읽고 난 뒤에는 인생 전체의 기록과 서류에서 중요한 날짜를 한곳에 모을 방법을 생각해 보세요. 마감일과 갱신일이 보이면 다음 준비가 훨씬 편해져요.',
      '다 읽은 뒤에는 인생 전체의 기록과 서류에서 돈과 관련된 기록만 따로 볼지 정해 보세요. 금액이 들어간 자료는 작은 실수도 커질 수 있어 먼저 기준을 잡는 편이 좋아요.',
      '해석을 덮기 전에 인생 전체의 기록과 서류에서 종이로 남길 것과 사진으로 남길 것을 나누어 보세요. 방식이 정해지면 쌓이는 기록도 관리하기 쉬워요.',
      '읽고 난 뒤에는 인생 전체의 기록과 서류에서 다음에 찾을 사람이 나라고 생각하고 이름을 붙여 보세요. 미래의 내가 알아볼 수 있어야 좋은 정리예요.',
      '다 읽은 뒤에는 인생 전체의 기록과 서류에서 백업이 필요한 자료 하나를 골라 보세요. 한 번 더 저장해 둔 기록은 나중의 불안을 줄여 줘요.',
      '해석을 덮기 전에 인생 전체의 기록과 서류에서 지금 바로 처리하지 않아도 되는 것을 따로 빼 보세요. 급한 것과 기다려도 되는 것이 나뉘면 마음이 정리돼요.',
      '읽고 난 뒤에는 인생 전체의 기록과 서류에서 자주 반복되는 실수 하나를 떠올려 보세요. 그 실수를 막는 체크 한 줄이 다음 일을 훨씬 안전하게 해 줘요.',
      '다 읽은 뒤에는 인생 전체의 기록과 서류에서 내게 필요한 증빙이 무엇인지 한 가지부터 확인해 보세요. 필요한 이유가 분명하면 남길 자료도 더 쉽게 고를 수 있어요.',
      '해석을 덮기 전에 인생 전체의 기록과 서류에서 제출 전에 다시 볼 순서를 정해 보세요. 이름, 날짜, 금액처럼 순서가 있으면 빠뜨리는 일이 줄어요.',
      '읽고 난 뒤에는 인생 전체의 기록과 서류에서 같은 내용이 여러 곳에 흩어져 있는지 살펴보세요. 흩어진 기록을 하나로 모으면 다음 확인이 훨씬 쉬워져요.',
      '다 읽은 뒤에는 인생 전체의 기록과 서류에서 가족이나 동료와 함께 확인해야 할 항목을 하나 정해 보세요. 혼자 판단하기 어려운 것은 함께 보는 편이 안전해요.',
      '해석을 덮기 전에 인생 전체의 기록과 서류에서 함께 확인할 사람과 혼자 먼저 볼 자료를 나누어 보세요. 역할이 나뉘면 서류 확인도 덜 막막해져요.',
      '읽고 난 뒤에는 인생 전체의 기록과 서류에서 가족이나 동료에게 물어볼 질문 하나를 짧게 적어 보세요. 질문이 분명하면 도움도 더 쉽게 받을 수 있어요.',
      '다 읽은 뒤에는 인생 전체의 기록과 서류에서 공동으로 확인할 항목과 내가 정리할 항목을 나누어 보세요. 둘을 나누면 책임의 경계가 또렷해져요.',
      '해석을 덮기 전에 인생 전체의 기록과 서류에서 버릴 기준을 먼저 정해 보세요. 남길 것만 생각하면 정리가 커지지만, 버릴 기준이 있으면 훨씬 가벼워져요.',
      '읽고 난 뒤에는 인생 전체의 기록과 서류에서 가장 자주 여는 폴더나 보관함을 먼저 정리해 보세요. 자주 쓰는 곳이 편해지면 전체 관리도 덜 부담스러워요.',
      '다 읽은 뒤에는 인생 전체의 기록과 서류에서 나중에 설명해야 할 자료를 하나 떠올려 보세요. 누가 봐도 이해되게 메모를 붙이면 다시 확인할 때 시간이 줄어요.',
      '읽고 난 뒤에는 인생 전체의 기록과 서류에서 다른 사람이 봐도 알 수 있게 제목을 붙일 자료를 하나 골라 보세요. 제목이 분명하면 시간이 지나도 다시 찾기 쉬워요.',
      '해석을 덮기 전에 인생 전체의 기록과 서류에서 설명을 덧붙일 문서 하나를 정해 보세요. 왜 남겼는지 한 줄만 적어도 나중의 판단이 훨씬 편해져요.',
      '다 읽은 뒤에는 인생 전체의 기록과 서류에서 가족이나 동료가 함께 알아야 할 자료를 하나 표시해 보세요. 필요한 사람이 바로 찾을 수 있으면 기록의 가치가 커져요.',
      '읽고 난 뒤에는 인생 전체의 기록과 서류에서 나중에 헷갈릴 수 있는 자료를 먼저 떠올려 보세요. 금액, 날짜, 이유 중 하나만 붙여도 다시 확인할 때 덜 헤매요.',
      '해석을 덮기 전에 인생 전체의 기록과 서류에서 마음이 무거운 항목은 이름만 적어 두어도 괜찮아요. 목록에 올라오면 다음에 볼 순서가 생겨요.',
      '읽고 난 뒤에는 인생 전체의 기록과 서류에서 오래 보관할 자료와 잠시만 필요한 자료를 나누어 보세요. 보관 기간이 다르면 정리 방식도 달라져야 해요.',
      '다 읽은 뒤에는 인생 전체의 기록과 서류에서 확인할 사람, 보관할 장소, 다시 볼 날짜를 한 줄로 묶어 보세요. 세 가지가 보이면 서류가 훨씬 덜 복잡해져요.',
      '해석을 덮기 전에 인생 전체의 기록과 서류에서 작은 체크리스트 하나를 만들어 보세요. 매번 새로 고민하지 않아도 되면 서류 관리가 훨씬 편해져요.',
      '다 읽은 뒤에는 인생 전체의 기록과 서류에서 다음번에도 그대로 쓸 확인 순서 하나를 남겨 보세요. 순서가 있으면 같은 일을 다시 만났을 때 훨씬 덜 막막해요.',
      '읽고 난 뒤에는 인생 전체의 기록과 서류에서 자주 헷갈리는 항목 하나를 체크표로 바꿔 보세요. 이름, 날짜, 금액처럼 반복되는 칸부터 시작하면 좋아요.',
      '해석을 덮기 전에 인생 전체의 기록과 서류에서 다음에 찾을 내가 바로 알아볼 단서 하나를 붙여 보세요. 짧은 제목 하나만으로도 정리가 쉬워져요.',
      '읽고 난 뒤에는 인생 전체의 기록과 서류에서 가장 자주 헷갈리는 자료 하나를 고르세요. 이름, 날짜, 보관 위치를 한 줄로 붙이면 다음에 다시 찾을 때 훨씬 편해져요.',
      '다 읽은 뒤에는 인생 전체의 기록과 서류에서 급한 제출물과 오래 보관할 자료를 나누어 보세요. 두 종류가 구분되면 서류 더미가 한꺼번에 덜 복잡해져요.',
      '해석을 덮기 전에 인생 전체의 기록과 서류에서 나중의 내가 고마워할 단서 하나를 남겨 보세요. 짧은 제목, 저장 위치, 확인 날짜 중 하나만 또렷해도 충분해요.',
      '읽고 난 뒤에는 인생 전체의 기록과 서류에서 함께 확인해야 안전한 자료를 하나 떠올려 보세요. 혼자 볼 부분과 물어볼 부분이 나뉘면 실수도 부담도 줄어요.',
      '다 읽은 뒤에는 인생 전체의 기록과 서류에서 오늘 정리할 범위를 작게 줄여 보세요. 폴더 하나, 파일 하나, 사진 한 장처럼 작게 시작해야 오래 이어져요.',
      '해석을 덮기 전에 인생 전체의 기록과 서류에서 다시 볼 이유를 짧게 붙일 자료를 골라 보세요. 왜 남겼는지 보이면 시간이 지나도 기록의 쓸모가 살아 있어요.',
    ]);
  }

  if (ctx.category === 'academic') {
    return pickVariant(ctx, 'sourceAcademicPractice', [
      `읽고 난 뒤에는 ${scope} 이번에 다시 볼 내용 하나와 그냥 넘어가도 되는 내용을 나누어 보세요. 모두 붙잡지 않아야 공부가 다음으로 이어져요.`,
      `다 읽은 뒤에는 ${scope} 새로 배운 점, 아직 헷갈리는 점, 물어볼 점을 한 줄씩 나누어 보세요. 세 줄만 있어도 다음 공부의 순서가 생겨요.`,
      `해석을 덮기 전에 ${scope} 가장 작은 시작점을 하나 정해 보세요. 책상에 앉기, 한 문제 풀기, 한 문단 읽기처럼 쉬운 행동이면 충분해요.`,
      `읽고 난 뒤에는 ${scope} 이미 이해한 부분을 먼저 확인해 보세요. 잘 되는 기준이 있어야 부족한 부분도 덜 무겁게 고칠 수 있어요.`,
      `다 읽은 뒤에는 ${scope} 다음에 다시 볼 표시를 하나 남겨 보세요. 표시가 남아 있으면 공부를 멈췄다가도 다시 시작하기 쉬워요.`,
      `해석을 덮기 전에 ${scope} 공부 시간을 늘릴지, 범위를 줄일지, 도움을 받을지 하나만 골라 보세요. 방향이 하나면 실천이 훨씬 편해요.`,
    ]);
  }
  if (ctx.category === 'study_document' && isMinorReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)) {
    return pickVariant(ctx, 'sourceStudyDocumentSelfCheck', [
      `읽고 난 뒤에는 ${scope} 이번에 다시 볼 단서 하나와 선생님이나 보호자에게 물어볼 질문 하나를 나누어 보세요. 둘이 보이면 다음 확인이 덜 막막해져요.`,
      `다 읽은 뒤에는 ${scope} 제출한 것, 헷갈린 자료, 확인받을 것을 한 줄씩 적어 보세요. 세 줄만 있어도 노트와 안내장이 훨씬 찾기 쉬워져요.`,
      `해석을 덮기 전에 ${scope} 가방이나 책상에서 가장 먼저 찾을 자료 하나를 정해 보세요. 숙제, 안내장, 시험 범위 중 하나만 또렷해도 충분해요.`,
      `읽고 난 뒤에는 ${scope} 혼자 볼 것과 함께 확인할 것을 나누어 보세요. 아이가 물어볼 대상을 알면 기록이 부담보다 도움으로 느껴져요.`,
      `다 읽은 뒤에는 ${scope} 안내장, 숙제, 시험 범위 중 다시 찾을 한 줄을 골라 보세요. 그 한 줄이 다음 확인의 시작점이 될 수 있어요.`,
      `해석을 덮기 전에 ${scope} 노트에 남길 단서 하나와 지워도 되는 부담 하나를 나누어 보세요. 정리가 작아지면 아이도 더 편하게 따라올 수 있어요.`,
    ]);
  }
  if (ctx.category === 'study_document') {
    return pickVariant(ctx, 'sourceStudyDocumentBackup', [
      `읽고 난 뒤에는 ${scope} 가장 먼저 확인할 날짜, 금액, 이름 중 하나를 정해 보세요. 작은 확인 하나가 큰 실수를 줄여 줘요.`,
      `다 읽은 뒤에는 ${scope} 저장할 곳과 다시 찾을 이름을 먼저 정해 보세요. 기록은 많이 남기는 것보다 나중에 찾기 쉬운지가 더 중요해요.`,
      `해석을 덮기 전에 ${scope} 기억에 맡긴 약속이나 제출할 것을 눈에 보이는 곳에 옮겨 보세요. 적어 둔 한 줄이 마음의 부담을 줄여 줘요.`,
      `읽고 난 뒤에는 ${scope} 바로 처리할 것과 확인받을 것을 나누어 보세요. 혼자 끝낼 일과 함께 볼 일이 구분되면 서류가 덜 막막해요.`,
      `다 읽은 뒤에는 ${scope} 버릴 기록, 남길 기록, 백업할 기록을 하나씩 떠올려 보세요. 세 칸으로 나누면 정리가 훨씬 쉬워져요.`,
      `해석을 덮기 전에 ${scope} 지금 가장 부담이 적은 정리 행동을 하나 고르세요. 파일 이름 고치기나 사진 한 장 저장하기처럼 작아도 충분해요.`,
    ]);
  }
  if (ctx.period === 'life' && ctx.category === 'overall') {
    return pickVariant(ctx, 'sourceOverallSelfCheck', [
      '읽고 난 뒤에는 인생 전체 흐름에서 오래 조정할 일과 시간을 두고 볼 일을 나누어 보세요. 두 가지가 구분되면 해석을 한 번에 짊어지지 않아도 돼요.',
      '다 읽은 뒤에는 인생 전체 흐름에서 내 생활을 조금 더 편하게 만드는 선택 하나만 남겨 보세요. 큰 결심보다 작은 기준이 오래 도움이 돼요.',
      '해석을 덮기 전에 인생 전체 흐름에서 이미 잘 버티고 있는 부분을 먼저 떠올려 보세요. 잘하고 있는 점을 알아야 고칠 부분도 덜 무겁게 보여요.',
      '읽고 난 뒤에는 인생 전체 흐름에서 현재 필요한 기준과 나중에 다시 볼 기준을 나누어 보세요. 모든 문장을 한 번에 적용하지 않아도 충분해요.',
      '다 읽은 뒤에는 인생 전체 흐름에서 반복해서 확인할 생활 기준 하나를 정해 보세요. 몸, 관계, 돈, 배움처럼 자주 마주치는 주제일수록 작게 잡는 편이 좋아요.',
      '해석을 덮기 전에 인생 전체 흐름에서 마음이 복잡해진 문장은 잠시 표시만 해 두세요. 오래 도움이 될 한 문장만 생활 기준으로 남겨도 돼요.',
      '읽고 난 뒤에는 인생 전체 흐름에서 생활에서 바로 확인하기 어려운 조언은 따로 접어 두세요. 오래 참고할 기준 하나만 남겨도 해석은 충분히 쓸모가 있어요.',
      '읽고 난 뒤에는 인생 전체 흐름에서 아직 맞지 않는 조언과 오래 도움이 될 조언을 나누어 보세요. 필요한 것만 먼저 남기면 긴 해석도 부담이 덜해져요.',
      '다 읽은 뒤에는 인생 전체 흐름에서 생활 기준으로 남길 문장 하나만 골라도 충분해요. 나머지는 시간이 지나 다시 읽을 여지로 두면 좋아요.',
      '해석을 덮기 전에 인생 전체 흐름에서 마음이 가벼워지는 문장과 아직 먼 문장을 구분해 보세요. 구분이 생기면 조언을 더 현실적으로 쓸 수 있어요.',
      '읽고 난 뒤에는 인생 전체 흐름에서 천천히 살필 것과 아직 기다려도 되는 것을 나누어 보세요. 기다릴 말을 따로 두면 마음이 덜 조급해져요.',
      '다 읽은 뒤에는 인생 전체 흐름에서 내 생활에 가장 가까운 말만 남겨 보세요. 가까운 말 하나가 있어야 긴 조언도 실제 기준으로 이어져요.',
      '해석을 덮기 전에 인생 전체 흐름에서 아직 무겁게 느껴지는 조언은 표시만 해 두어도 괜찮아요. 지금 쓸 수 있는 작은 기준부터 챙기면 충분해요.',
      '다 읽은 뒤에는 인생 전체 흐름에서 마음이 편해진 문장과 아직 낯선 문장을 나누어 보세요. 둘을 구분하면 필요한 부분만 차분히 가져갈 수 있어요.',
      '해석을 덮기 전에 인생 전체 흐름에서 너무 크게 느껴지는 조언은 작은 행동으로 다시 바꿔 보세요. 크기가 줄어들면 실제 생활에 붙이기 쉬워져요.',
      '마지막으로 인생 전체 흐름에서 줄일 부담 하나와 계속 가져갈 습관 하나를 나누어 보세요. 덜어낼 것과 지킬 것이 함께 보여야 조언이 현실적으로 남아요.',
      '읽고 난 뒤에는 인생 전체 흐름에서 다음 달에도 다시 확인하고 싶은 기준을 하나만 남겨 보세요. 오래 보는 주제일수록 반복해서 읽을 수 있어야 도움이 돼요.',
      '다 읽은 뒤에는 인생 전체 흐름에서 내게 가장 자주 반복되는 장면을 하나만 떠올려 보세요. 반복되는 장면을 알면 조언을 어디에 붙일지 더 쉽게 정할 수 있어요.',
      '해석을 덮기 전에 인생 전체 흐름에서 너무 크게 느껴지는 말은 잠시 뒤로 미뤄도 괜찮아요. 지금 생활에 맞는 작은 선택부터 남기면 충분해요.',
      '마지막으로 인생 전체 흐름에서 오래 도움이 될 문장 하나를 골라 보세요. 그 한 문장을 생활 기준으로 줄이면 읽은 내용이 더 오래 남아요.',
      '읽고 난 뒤에는 인생 전체 흐름에서 유지할 것, 줄일 것, 나중에 다시 볼 것을 가볍게 나누어 보세요. 세 칸으로 나누면 마음이 덜 복잡해져요.',
      '다 읽은 뒤에는 인생 전체 흐름에서 내가 이미 잘해 온 선택을 하나 인정해 보세요. 잘한 부분을 확인하면 앞으로 바꿀 부분도 더 차분히 보여요.',
      '다 읽은 뒤에는 인생 전체 흐름에서 나를 덜 힘들게 한 선택과 계속 힘이 된 선택을 하나씩 나누어 보세요. 둘을 구분하면 앞으로 유지할 기준이 더 또렷해져요.',
      '다 읽은 뒤에는 인생 전체 흐름에서 나를 덜 지치게 한 방식과 계속 힘이 되어 준 방식을 나누어 보세요. 둘이 보이면 앞으로 지킬 기준도 더 선명해져요.',
      '읽고 난 뒤에는 인생 전체 흐름에서 편해졌던 선택과 오래 도움이 된 선택을 따로 떠올려 보세요. 당장의 편안함과 긴 도움을 구분하면 다음 기준이 더 현실적이에요.',
      '해석을 덮기 전에 인생 전체 흐름에서 덜어내면 가벼워지는 일과 남겨 두면 힘이 되는 일을 하나씩 적어 보세요. 두 가지가 나뉘면 조언이 덜 막연해져요.',
      '마지막으로 인생 전체 흐름에서 나를 지치게 하지 않았던 선택을 하나 확인해 보세요. 이미 나에게 맞았던 방식이 앞으로의 좋은 기준이 될 수 있어요.',
      '다 읽은 뒤에는 인생 전체 흐름에서 계속 가져가도 좋은 습관과 이제 조금 줄여도 되는 부담을 나누어 보세요. 둘을 나누면 긴 해석도 생활에서 이어 가기 쉬워요.',
      '해석을 덮기 전에 인생 전체 흐름에서 오래 참고할 기준과 시간이 지난 뒤 다시 볼 기준을 나누어 보세요. 이렇게 읽으면 긴 해석도 부담이 줄어요.',
      '마지막으로 인생 전체 흐름에서 최근 나를 안정시킨 습관 하나를 떠올려 보세요. 이미 도움이 된 기준을 알면 새로 바꿀 부분도 더 편하게 고를 수 있어요.',
      '읽고 난 뒤에는 인생 전체 흐름에서 지금 지킬 기준, 조금 덜어낼 부담, 아직 더 살펴볼 일을 가볍게 나누어 보세요. 세 칸으로 읽으면 긴 조언도 실제 생활에서 확인하기 쉬워요.',
      '다 읽은 뒤에는 인생 전체 흐름에서 생활에서 확인할 기준과 시간을 두고 볼 기준을 나누어 보세요. 현재 맞는 말만 골라도 해석이 더 편하게 남아요.',
      '해석을 덮기 전에 인생 전체 흐름에서 계속 가져갈 기준 하나와 내려놓을 부담 하나를 적어 보세요. 둘이 보이면 긴 조언도 훨씬 현실적으로 읽혀요.',
      '마지막으로 인생 전체 흐름에서 마음이 덜 무거워지는 문장 하나만 골라 보세요. 그 문장을 오래 다시 볼 작은 기준으로 바꾸면 시간이 지나도 부담 없이 꺼내 볼 수 있어요.',
      '읽고 난 뒤에는 인생 전체 흐름에서 이미 잘 지키는 것과 새로 조정할 것을 나누어 보세요. 전부 바꾸려 하지 않아야 해석이 오래 도움이 돼요.',
      '다 읽은 뒤에는 인생 전체 흐름에서 마음이 가장 편해진 문장 하나를 골라 보세요. 그 문장을 오래 반복할 작은 기준으로 줄이면 실제 도움이 더 커져요.',
      '읽고 난 뒤에는 인생 전체 흐름에서 지금의 나를 덜 몰아붙이는 문장 하나를 남겨 보세요. 그 문장을 생활 속 작은 기준으로 바꾸면 긴 해석도 부담 없이 다시 볼 수 있어요.',
      '해석을 덮기 전에 인생 전체 흐름에서 천천히 확인할 기준과 다시 볼 일을 나누어 보세요. 긴 흐름은 한 번에 결론 내기보다 필요한 때마다 꺼내 보는 편이 더 실용적이에요.',
      '마지막으로 인생 전체 흐름에서 이미 나를 지켜 준 습관 하나와 앞으로 가볍게 고칠 습관 하나를 골라 보세요. 두 가지가 함께 보이면 조언이 더 균형 있게 남아요.',
      '다 읽은 뒤에는 인생 전체 흐름에서 마음에 남은 말을 내 생활의 언어로 바꿔 보세요. 거창한 결심보다 여러 번 반복할 수 있는 크기여야 오래 도움이 돼요.',
      '해석을 덮기 전에 인생 전체 흐름에서 오래 가져가고 싶은 기준을 너무 크게 잡지 말아 보세요. 작게 반복할 수 있어야 시간이 지나도 다시 써먹기 쉬워요.',
      '해석을 덮기 전에 인생 전체 흐름에서 다음에 다시 읽을 때 확인할 작은 기준을 하나 정해 보세요. 오래 보는 해석도 결국 작은 확인에서 시작돼요.',
      '마지막으로 인생 전체 흐름에서 모든 내용을 맞추려 하지 말고 마음에 남은 순서만 정리해 보세요. 먼저 볼 것과 나중에 볼 것이 나뉘면 부담이 줄어요.',
      '읽고 난 뒤에는 인생 전체 흐름에서 지금의 상황에 맞지 않는 말은 표시만 해 두세요. 시간이 지나 다시 읽을 때 더 잘 맞는 조언이 될 수도 있어요.',
      '다 읽은 뒤에는 인생 전체 흐름에서 자주 반복되는 걱정과 실제로 줄일 수 있는 행동을 나누어 보세요. 생각과 행동이 구분되면 마음이 덜 무거워져요.',
      '해석을 덮기 전에 인생 전체 흐름에서 오래 남길 기준과 현재 필요한 기준을 나누어 보세요. 긴 흐름과 현재의 선택이 함께 보여야 조언이 살아나요.',
      '읽고 난 뒤에는 인생 전체 흐름에서 몸, 돈, 관계, 배움 중 가장 먼저 가볍게 할 주제를 하나 고르세요. 한 주제만 정해도 긴 해석이 훨씬 현실적으로 바뀌어요.',
      '다 읽은 뒤에는 인생 전체 흐름에서 이미 안정된 부분과 아직 흔들리는 부분을 나누어 보세요. 둘을 같이 봐야 삶 전체를 너무 무겁게 보지 않게 돼요.',
      '읽고 난 뒤에는 인생 전체 흐름에서 이미 든든한 기준과 다시 살펴볼 기준을 나누어 보세요. 잘되는 부분이 보여야 조정할 부분도 덜 크게 느껴져요.',
      '해석을 덮기 전에 인생 전체 흐름에서 지금 나를 받쳐 주는 것과 조금 흔들리는 것을 따로 적어 보세요. 두 가지가 같이 보여야 긴 해석도 현실적으로 읽혀요.',
      '다 읽은 뒤에는 인생 전체 흐름에서 지켜도 좋은 습관과 가볍게 고칠 습관을 나누어 보세요. 이미 안정된 부분을 확인하면 변화도 덜 부담스러워요.',
      '읽고 난 뒤에는 인생 전체 흐름에서 마음이 놓이는 부분과 아직 확인이 필요한 부분을 구분해 보세요. 둘을 나누면 전체 흐름을 한꺼번에 짊어지지 않아도 돼요.',
      '해석을 덮기 전에 인생 전체 흐름에서 다음에 다시 읽을 때 확인할 질문 하나를 남겨 보세요. 좋은 질문이 있으면 긴 조언도 오래 쓸 수 있어요.',
      '읽고 난 뒤에는 인생 전체 흐름에서 생활을 지켜 준 사람, 장소, 습관 중 하나를 떠올려 보세요. 이미 기대고 있는 바탕을 알아야 새 변화도 안정돼요.',
      '다 읽은 뒤에는 인생 전체 흐름에서 줄일 불안 하나와 계속 키울 힘 하나를 나누어 보세요. 불안만 보지 않고 힘도 함께 보면 해석이 더 따뜻하게 남아요.',
    ]);
  }
  if (ctx.period === 'life' && ctx.category === 'expression_children') {
    return pickVariant(ctx, 'sourceExpressionSmallWorks', [
      '읽고 난 뒤에는 인생 전체의 표현과 창의에서 남기고 싶은 말이나 기록을 하나만 골라 보세요. 큰 작품이 아니어도 마음이 담긴 흔적이면 충분해요.',
      '다 읽은 뒤에는 인생 전체의 표현과 창의에서 편하게 계속할 수 있는 방식을 하나 떠올려 보세요. 글, 사진, 대화, 작은 작업처럼 손에 익은 것이 좋아요.',
      '해석을 덮기 전에 인생 전체의 표현과 창의에서 보여 주고 싶은 것과 혼자 간직해도 되는 것을 나누어 보세요. 표현의 크기를 고르면 부담이 줄어요.',
      '마지막으로 인생 전체의 표현과 창의에서 이미 오래 이어 온 작은 취미나 기록을 확인해 보세요. 새로 만들기보다 이어 온 것을 살리는 것도 좋은 방향이에요.',
      '읽고 난 뒤에는 인생 전체의 표현과 창의에서 가까운 사람과 나눌 수 있는 짧은 이야기를 하나 떠올려 보세요. 말 한마디나 사진 한 장도 충분한 시작이 돼요.',
      '다 읽은 뒤에는 인생 전체의 표현과 창의에서 완성보다 즐거움을 먼저 둘 일을 하나 남겨 보세요. 즐겁게 이어지는 방식이 오래 남는 결과를 만들어요.',
      '해석을 덮기 전에 인생 전체의 표현과 창의에서 지금 덜어낼 부담을 하나 정해 보세요. 남에게 보여 주기 위한 기준을 조금 낮추면 표현이 더 편해져요.',
      '마지막으로 인생 전체의 표현과 창의에서 지금 바로 남길 수 있는 작은 흔적을 하나 골라 보세요. 한 줄, 한 장, 한마디처럼 작을수록 오래 이어 가기 쉬워요.',
      '읽고 난 뒤에는 인생 전체의 표현과 창의에서 오래 남기고 싶은 장면을 하나 떠올려 보세요. 그 장면을 말, 사진, 메모 중 편한 방식으로 남기면 돼요.',
      '다 읽은 뒤에는 인생 전체의 표현과 창의에서 누군가에게 보여 줄 것과 나만 볼 것을 나누어 보세요. 표현의 대상이 정해지면 부담이 훨씬 줄어요.',
      '해석을 덮기 전에 인생 전체의 표현과 창의에서 최근 마음이 움직였던 말을 하나 적어 보세요. 그 말이 다음 기록이나 대화의 시작점이 될 수 있어요.',
      '마지막으로 인생 전체의 표현과 창의에서 잘하려는 마음보다 계속하고 싶은 마음을 먼저 확인해 보세요. 오래 이어지는 표현은 대개 편한 즐거움에서 시작돼요.',
      '읽고 난 뒤에는 인생 전체의 표현과 창의에서 이번 달에 남길 작은 기록을 하나 정해 보세요. 크기보다 반복할 수 있는지가 더 중요해요.',
      '다 읽은 뒤에는 인생 전체의 표현과 창의에서 가까운 사람에게 들려줄 수 있는 기억을 하나 골라 보세요. 짧게 나누어도 관계와 표현이 함께 따뜻해져요.',
      '해석을 덮기 전에 인생 전체의 표현과 창의에서 남의 평가를 잠시 내려놓을 일을 하나 정해 보세요. 편하게 남긴 흔적이 나중에 더 귀한 자료가 될 수 있어요.',
      '마지막으로 인생 전체의 표현과 창의에서 오늘의 기분을 한 줄로 남겨 보세요. 짧은 기록 하나가 시간이 지나 나를 설명해 주는 단서가 돼요.',
      '읽고 난 뒤에는 인생 전체의 표현과 창의에서 손에 가장 익은 도구를 하나 골라 보세요. 익숙한 방식으로 시작해야 표현이 부담보다 생활에 가까워져요.',
      '다 읽은 뒤에는 인생 전체의 표현과 창의에서 완성하지 않아도 남길 수 있는 흔적을 생각해 보세요. 메모 한 줄이나 사진 한 장도 다음 표현을 열어 줘요.',
      '읽고 난 뒤에는 인생 전체의 표현과 창의에서 오늘 남길 수 있는 아주 작은 조각을 떠올려 보세요. 제목 하나, 사진 설명 하나, 짧은 말 하나도 다음 표현의 문을 열어 줘요.',
      '해석을 덮기 전에 인생 전체의 표현과 창의에서 끝내지 못해도 보관할 만한 장면을 골라 보세요. 미완성의 조각도 나중에는 좋은 재료가 될 수 있어요.',
      '다 읽은 뒤에는 인생 전체의 표현과 창의에서 다시 이어 갈 실마리를 하나 남겨 보세요. 완성보다 다음에 꺼낼 수 있는 단서가 더 중요할 때도 있어요.',
      '읽고 난 뒤에는 인생 전체의 표현과 창의에서 나만 볼 기록과 누군가와 나눌 기록을 구분해 보세요. 대상이 정해지면 표현의 부담이 훨씬 줄어요.',
      '해석을 덮기 전에 인생 전체의 표현과 창의에서 반복해도 지치지 않을 크기를 정해 보세요. 작게 오래 남기는 방식이 나중에 더 큰 자료가 돼요.',
      '읽고 난 뒤에는 인생 전체의 표현과 창의에서 오래 붙잡아도 부담이 적은 방식을 골라 보세요. 한 줄 기록, 짧은 사진 설명, 작은 대화처럼 생활에 붙는 방식이 좋아요.',
      '다 읽은 뒤에는 인생 전체의 표현과 창의에서 이번 주에도 다시 할 수 있는 최소 크기를 정해 보세요. 작게 반복할 수 있어야 표현이 숙제보다 습관에 가까워져요.',
      '해석을 덮기 전에 인생 전체의 표현과 창의에서 완성보다 이어 갈 단서를 하나 남겨 보세요. 다음에 꺼낼 제목이나 장면만 있어도 흐름이 끊기지 않아요.',
      '마지막으로 인생 전체의 표현과 창의에서 남에게 보여 주지 않아도 계속하고 싶은 일을 하나 떠올려 보세요. 편한 즐거움이 있어야 표현도 오래 살아나요.',
      '마지막으로 인생 전체의 표현과 창의에서 나만 아는 기록과 누군가와 나눌 기록을 나누어 보세요. 대상이 정해지면 표현의 긴장이 훨씬 줄어요.',
      '읽고 난 뒤에는 인생 전체의 표현과 창의에서 혼자 간직할 흔적과 가까운 사람에게 보여 줄 흔적을 나누어 보세요. 나눌 범위가 정해지면 표현이 더 편안해져요.',
      '다 읽은 뒤에는 인생 전체의 표현과 창의에서 마음속에 둘 장면과 말로 꺼낼 장면을 구분해 보세요. 표현의 거리가 정해지면 부담도 줄어요.',
      '해석을 덮기 전에 인생 전체의 표현과 창의에서 공개하지 않아도 되는 기록을 먼저 인정해 보세요. 나만 보는 기록도 충분히 의미 있는 표현이에요.',
      '읽고 난 뒤에는 인생 전체의 표현과 창의에서 최근 자주 떠오르는 색, 말, 장면 중 하나를 골라 보세요. 그 하나가 다음 작업의 방향이 될 수 있어요.',
      '다 읽은 뒤에는 인생 전체의 표현과 창의에서 남에게 보여 주기 전 나에게 먼저 편한지 확인해 보세요. 내가 편해야 나누는 과정도 오래 이어져요.',
      '읽고 난 뒤에는 인생 전체의 표현과 창의에서 오래 보관하고 싶은 말과 오늘만 가볍게 남길 말을 나누어 보세요. 둘을 구분하면 기록이 부담보다 즐거움에 가까워져요.',
      '다 읽은 뒤에는 인생 전체의 표현과 창의에서 최근 다시 꺼내 보고 싶은 기억을 하나 골라 보세요. 그 기억을 짧은 문장이나 사진 설명으로 남기면 표현이 생활 안에 들어와요.',
      '해석을 덮기 전에 인생 전체의 표현과 창의에서 계속할 수 있는 최소 크기를 정해 보세요. 매일 한 줄, 주말 사진 한 장처럼 작아야 오래 이어지기 쉬워요.',
      '마지막으로 인생 전체의 표현과 창의에서 누군가에게 보여 줄 이유가 있는 것과 나를 위해 남길 것을 나누어 보세요. 이유가 정해지면 표현의 방향도 더 편해져요.',
      '읽고 난 뒤에는 인생 전체의 표현과 창의에서 지금의 나를 가장 잘 보여 주는 장면을 하나 떠올려 보세요. 잘 만든 결과보다 진짜 마음이 담긴 장면이 더 오래 남아요.',
      '다 읽은 뒤에는 인생 전체의 표현과 창의에서 손이 자주 가는 방식을 먼저 믿어 보세요. 익숙한 도구로 시작하면 표현이 큰 숙제처럼 느껴지지 않아요.',
      '해석을 덮기 전에 인생 전체의 표현과 창의에서 비교를 잠시 내려놓을 기준을 하나 세워 보세요. 남보다 잘하는지보다 내가 계속하고 싶은지가 더 중요해요.',
      '마지막으로 인생 전체의 표현과 창의에서 다음에 이어 쓸 실마리를 하나만 남겨 보세요. 끝까지 완성하지 않아도 다음 시작점이 있으면 표현은 이어져요.',
      '읽고 난 뒤에는 인생 전체의 표현과 창의에서 다음번에 다시 열어 볼 단서를 하나 남겨 보세요. 제목, 색, 장면처럼 작은 단서도 표현을 이어 주는 힘이 돼요.',
      '다 읽은 뒤에는 인생 전체의 표현과 창의에서 오늘 멈춘 지점을 표시해 보세요. 어디서 이어 갈지 보이면 쉬었다가 다시 시작하기 쉬워요.',
      '해석을 덮기 전에 인생 전체의 표현과 창의에서 다음에 덧붙일 한 줄을 남겨 보세요. 완성보다 이어 갈 길이 보이는 것이 더 중요할 때가 있어요.',
      '마지막으로 인생 전체의 표현과 창의에서 다음에 이어 갈 수 있는 작은 단서를 하나 남겨 보세요. 문장 한 줄, 사진 한 장, 떠오른 제목 하나만 있어도 다시 시작하기 쉬워요.',
      '읽고 난 뒤에는 인생 전체의 표현과 창의에서 다음에 다시 꺼낼 수 있는 표시를 하나 남겨 보세요. 제목, 색, 장면처럼 작게 붙여 두면 쉬었다가도 이어 가기 좋아요.',
      '다 읽은 뒤에는 인생 전체의 표현과 창의에서 오래 남길 것과 오늘 가볍게 남길 것을 나누어 보세요. 둘을 구분하면 표현이 큰 숙제처럼 느껴지지 않아요.',
      '해석을 덮기 전에 인생 전체의 표현과 창의에서 다음번에 이어 갈 첫 문장을 하나 떠올려 보세요. 완성보다 다시 시작할 문이 보이는지가 더 중요할 때가 있어요.',
      '마지막으로 인생 전체의 표현과 창의에서 내가 계속하고 싶은 이유를 한 줄로 적어 보세요. 이유가 남아 있으면 잠시 쉬어도 다시 돌아오기 쉬워요.',
      '읽고 난 뒤에는 인생 전체의 표현과 창의에서 마음이 움직인 장면을 하나만 골라 보세요. 그 장면을 말, 사진, 메모 중 편한 방식으로 남기면 충분해요.',
      '읽고 난 뒤에는 인생 전체의 표현과 창의에서 완성하지 못한 조각도 버리지 말고 표시해 두세요. 나중에 다시 보면 그 조각이 다음 표현의 출발점이 될 수 있어요.',
      '다 읽은 뒤에는 인생 전체의 표현과 창의에서 계속하고 싶은 이유를 한 줄로 적어 보세요. 이유가 남아 있으면 잠시 쉬어도 다시 이어 가기 쉬워요.',
      '해석을 덮기 전에 인생 전체의 표현과 창의에서 다시 꺼내 보고 싶은 장면을 하나 골라 보세요. 장면이 정해지면 표현이 막연한 숙제보다 생활 속 기록에 가까워져요.',
      '다 읽은 뒤에는 인생 전체의 표현과 창의에서 나에게 편한 방식과 남에게 보여 줄 방식을 나누어 보세요. 대상이 정리되면 부담은 줄고 계속할 힘은 더 또렷해져요.',
      '해석을 덮기 전에 인생 전체의 표현과 창의에서 다음번에 가장 먼저 꺼낼 소재를 하나 골라 보세요. 소재가 정해지면 표현이 막연한 숙제로 남지 않아요.',
    ]);
  }
  if (ctx.category === 'wealth') {
    return wealthSelfCheckGuidance(ctx, scope);
  }
  if (ctx.category === 'family') {
    return familySelfCheckGuidance(ctx, scope);
  }
  if (ctx.category === 'romance') {
    return romanceSelfCheckGuidance(ctx, scope);
  }
  if (ctx.category === 'health' || ctx.category === 'health_stress') {
    return pickVariant(ctx, 'selfCheck', [
      `읽고 난 뒤에는 ${scope} 최근 몸이 덜 힘들었던 순간과 더 힘들었던 순간을 하나씩 표시해 보세요. 두 장면만 골라도 다음 선택이 훨씬 쉬워져요.`,
      `다 읽은 뒤에는 ${scope} 마음에 남은 말을 쉬운 습관 하나로 바꿔 보세요. 물 마시기, 잠자는 시간 맞추기, 잠깐 걷기처럼 작을수록 오래 이어 가기 좋아요.`,
      `해석을 덮기 전에 ${scope} 부담을 덜어 줄 행동 하나를 정해 보세요. 쉬운 행동일수록 실제 생활에서 다시 해 보기 좋아요.`,
      `읽고 난 뒤에는 ${scope} 마음에 걸린 말을 생활 속 행동으로 줄여 보세요. 잠깐 쉬기, 따뜻하게 먹기, 가볍게 움직이기처럼 바로 할 수 있는 것이 좋아요.`,
      `다 읽은 뒤에는 ${scope} 마음에 남은 조언을 몸이 편해지는 행동 하나로 바꿔 보세요. 물 한 잔, 짧은 산책, 일찍 쉬기처럼 작으면 충분해요.`,
      `해석을 덮기 전에 ${scope} 걱정으로 남은 말을 오늘 할 수 있는 쉬운 행동으로 줄여 보세요. 행동이 작아야 실제로 다시 해 보기 좋아요.`,
      `읽고 난 뒤에는 ${scope} 마음에 걸린 부분을 오래 붙잡기보다 몸이 풀리는 순서 하나를 정해 보세요. 쉬운 순서가 있으면 긴장도 덜 커져요.`,
      `다 읽은 뒤에는 ${scope} 불편한 말을 그대로 믿기보다 회복 행동으로 바꾸어 보세요. 따뜻하게 먹기, 쉬기, 가볍게 움직이기 중 하나면 좋아요.`,
      `다 읽은 뒤에는 ${scope} 나를 진정시키는 작은 반복을 하나 남겨 보세요. 매일 완벽히 지키기보다 힘들 때 다시 돌아갈 기준으로 두면 충분해요.`,
      `해석을 덮기 전에 ${scope} 피곤할 때 가장 먼저 줄일 일을 하나 정해 보세요. 줄일 기준이 있으면 몸이 힘든 날에도 선택이 훨씬 쉬워져요.`,
      `읽고 난 뒤에는 ${scope} 내 몸이 편해졌던 조건을 시간, 음식, 쉬는 방식 중 하나로 떠올려 보세요. 이미 맞았던 조건을 다시 쓰는 것도 좋은 관리예요.`,
      `다 읽은 뒤에는 ${scope} 오늘 해낼 일보다 오늘 덜 무리할 일을 하나 남겨 보세요. 회복을 먼저 넣어야 다른 습관도 오래 이어져요.`,
      `해석을 덮기 전에 ${scope} 내 몸이 편해지는 조건 하나를 골라 보세요. 그 기준이 있으면 다음에도 무리와 회복을 구분하기 쉬워요.`,
      `읽고 난 뒤에는 ${scope} 지금 줄일 부담 하나와 계속 가져갈 습관 하나를 나누어 보세요. 둘을 함께 보면 몸을 챙기는 방향이 더 분명해져요.`,
      `다 읽은 뒤에는 ${scope} 쉬는 시간, 잠, 식사 중 지금 가장 쉽게 챙길 수 있는 것 하나를 정해 보세요. 작은 기준일수록 실제 생활에 오래 남아요.`,
      `읽고 난 뒤에는 ${scope} 가장 덜 피곤했던 순간을 떠올려 보세요. 그때의 시간대, 먹은 것, 쉬는 방식을 하나만 기억해도 다음 조절이 쉬워져요.`,
      `다 읽은 뒤에는 ${scope} 새로 더할 습관보다 먼저 줄일 부담 하나를 골라 보세요. 몸은 계획이 늘어날 때보다 부담이 줄어들 때 더 편해질 수 있어요.`,
      `해석을 덮기 전에 ${scope} 회복을 방해하는 약속이나 습관 하나를 작게 줄여 보세요. 전부 바꾸지 않아도 한 가지가 줄면 몸의 여유가 생겨요.`,
      `읽고 난 뒤에는 ${scope} 내 몸이 편안해지는 가장 쉬운 조건을 하나 적어 보세요. 물, 잠, 따뜻한 식사, 짧은 걷기처럼 생활에 바로 붙는 기준이면 좋아요.`,
      `읽고 난 뒤에는 ${scope} 지금 덜 무리하게 만드는 선택 하나를 표시해 보세요. 많이 바꾸기보다 한 가지를 줄이는 쪽이 몸에는 더 편할 수 있어요.`,
      `다 읽은 뒤에는 ${scope} 잠, 식사, 움직임 중 최근 가장 흔들린 것을 하나만 고르세요. 원인을 길게 따지기보다 다음 한 번을 편하게 만드는 것이 먼저예요.`,
      `해석을 덮기 전에 ${scope} 몸이 편했던 시간대와 쉽게 지쳤던 시간대를 떠올려 보세요. 시간대를 알면 약속과 일을 배치하는 기준이 생겨요.`,
      `읽고 난 뒤에는 ${scope} 몸이 덜 무거웠던 시간대를 하나 떠올려 보세요. 그 시간에 쉬운 일이나 짧은 회복 행동을 붙이면 하루가 덜 흔들려요.`,
      `다 읽은 뒤에는 ${scope} 컨디션이 비교적 편했던 때와 쉽게 지쳤던 때를 나누어 보세요. 시간대가 보이면 약속과 휴식을 배치하기가 쉬워요.`,
      `해석을 덮기 전에 ${scope} 몸이 가장 편하게 움직였던 순간을 하나 표시해 보세요. 그 순간을 기준으로 삼으면 다음 일정도 무리 없이 조절할 수 있어요.`,
      `읽고 난 뒤에는 ${scope} 하루 중 쉬운 일을 붙이기 좋은 시간을 하나 골라 보세요. 작은 기준이 있어야 몸을 챙기는 일이 생활 속에 남아요.`,
      `다 읽은 뒤에는 ${scope} 피로가 몰렸던 장면과 금방 회복된 장면을 나누어 보세요. 두 장면을 알면 다음 일정에서 줄일 부분이 보여요.`,
      `해석을 덮기 전에 ${scope} 최근 내 몸에 부담이 적었던 선택 하나를 골라 보세요. 이미 편했던 선택을 반복하는 것도 좋은 관리예요.`,
      `읽고 난 뒤에는 ${scope} 잠, 식사, 움직임 중 가장 먼저 안정시킬 것을 하나만 정해 보세요. 기준이 작아야 실제 생활에서 오래 지킬 수 있어요.`,
      `읽고 난 뒤에는 ${scope} 지금 더할 습관보다 잠시 덜어낼 일을 하나 정해 보세요. 몸은 새 계획보다 부담이 줄어드는 변화를 더 빨리 느낄 때가 많아요.`,
      `다 읽은 뒤에는 ${scope} 지금 나에게 맞는 회복 신호를 하나 적어 보세요. 숨이 편해지는 시간, 따뜻한 식사, 짧은 산책처럼 쉬운 기준이면 충분해요.`,
      `해석을 덮기 전에 ${scope} 계속 가져갈 작은 습관과 쉬어 갈 약속을 나누어 보세요. 둘을 구분하면 몸을 몰아붙이지 않고도 흐름을 이어 갈 수 있어요.`,
      `읽고 난 뒤에는 ${scope} 이번에 바로 바꾸기 어려운 것은 표시만 해 두세요. 대신 지금 편하게 할 수 있는 한 가지를 고르면 부담이 줄어요.`,
      `다 읽은 뒤에는 ${scope} 내가 지치기 전에 알아차릴 수 있는 신호 하나를 정해 보세요. 그 신호가 보이면 쉬어 가는 기준으로 삼으면 돼요.`,
      `해석을 덮기 전에 ${scope} 최근 몸을 조금 편하게 만든 생활 습관을 하나 떠올려 보세요. 새로 더하지 않아도 이미 맞는 습관을 유지하는 것만으로도 충분한 실천이에요.`,
      `읽고 난 뒤에는 ${scope} 요즘 무리 없이 지킨 작은 습관을 하나 확인해 보세요. 잘되는 기준이 보여야 다음 조정도 덜 부담스럽게 이어져요.`,
      `다 읽은 뒤에는 ${scope} 몸을 덜 피곤하게 만든 반복 행동을 하나 떠올려 보세요. 따뜻한 식사, 이른 잠자리, 짧은 산책처럼 다시 해 볼 수 있는 행동이면 충분해요.`,
      `다 읽은 뒤에는 ${scope} 몸이 먼저 편안해졌던 조건을 하나 남겨 보세요. 시간, 음식, 움직임 중 하나만 보여도 다음 조절이 쉬워져요.`,
      `해석을 덮기 전에 ${scope} 오늘도 무리 없이 이어 갈 회복 행동을 하나 고르세요. 새 계획보다 이미 편했던 행동을 반복하는 것이 더 현실적이에요.`,
      `읽고 난 뒤에는 ${scope} 새로 더할 계획보다 이미 몸에 맞았던 회복 행동을 먼저 떠올려 보세요. 익숙한 기준이 있어야 무리하지 않고 이어 가기 쉬워요.`,
      `다 읽은 뒤에는 ${scope} 오늘도 편하게 반복할 수 있는 작은 관리를 하나 남겨 보세요. 물 마시기, 일찍 눕기, 짧게 걷기처럼 쉬운 행동이면 충분해요.`,
      `해석을 덮기 전에 ${scope} 지금 당장 바꾸기 어려운 것은 표시만 해 두세요. 대신 이미 해 봐서 편했던 행동 하나를 다시 고르면 부담이 줄어요.`,
      `읽고 난 뒤에는 ${scope} 회복을 위해 새 결심을 늘리기보다 오늘 줄일 부담 하나를 골라 보세요. 몸은 덜어낸 자리에서 먼저 편해질 때가 많아요.`,
      `해석을 덮기 전에 ${scope} 새로 시작할 일보다 계속 가져가도 좋은 습관을 먼저 골라 보세요. 이미 도움이 되는 것을 지키는 일도 좋은 관리예요.`,
      `읽고 난 뒤에는 ${scope} 무리한 목표 대신 지금 몸을 덜 피곤하게 할 순서 하나를 정해 보세요. 순서가 보이면 실천이 훨씬 쉬워져요.`,
      `다 읽은 뒤에는 ${scope} 가까운 사람에게 부탁할 수 있는 작은 도움 하나를 생각해 보세요. 혼자 다 해내려는 부담을 줄이는 것도 회복에 도움이 돼요.`,
      `해석을 덮기 전에 ${scope} 쉬어야 할 때와 움직여도 괜찮은 때를 나누어 보세요. 구분이 생기면 다음 선택에서 덜 흔들려요.`,
      `읽고 난 뒤에는 ${scope} 이미 잘 지키고 있는 기본 습관 하나를 확인해 보세요. 잘하고 있는 부분을 알아야 다음 조정도 무리 없이 이어져요.`,
      `읽고 난 뒤에는 ${scope} 이미 지키고 있는 회복 습관 하나를 먼저 확인해 보세요. 잘되는 기준이 있어야 줄일 부분도 더 차분히 보여요.`,
      `다 읽은 뒤에는 ${scope} 새로 더할 일보다 이미 몸에 맞았던 습관을 하나 떠올려 보세요. 그 습관을 유지하는 것만으로도 다음 조정이 쉬워져요.`,
      `해석을 덮기 전에 ${scope} 요즘 무리 없이 지킨 생활 기준을 하나 적어 보세요. 이미 되는 부분을 확인하면 몸을 다그치지 않게 돼요.`,
      `읽고 난 뒤에는 ${scope} 잘 지키고 있는 잠, 식사, 움직임 중 하나를 먼저 인정해 보세요. 그 기준 위에서 작은 조정만 더해도 충분해요.`,
      `다 읽은 뒤에는 ${scope} 몸이 먼저 편안해졌던 행동을 하나 떠올려 보세요. 따뜻하게 먹기, 일찍 눕기, 잠깐 걷기처럼 쉬운 행동이면 충분해요.`,
      `해석을 덮기 전에 ${scope} 내가 무리하기 전에 보이는 작은 신호를 하나 정해 보세요. 그 신호가 보이면 잠시 쉬는 기준으로 삼으면 좋아요.`,
      `읽고 난 뒤에는 ${scope} 회복을 도와준 사람, 장소, 시간을 하나씩 떠올려 보세요. 어디에서 편해지는지 알면 다음에도 덜 헤매요.`,
      `다 읽은 뒤에는 ${scope} 이번에 줄일 약속 하나와 지켜도 좋은 습관 하나를 나누어 보세요. 둘을 구분하면 몸과 마음의 부담이 줄어요.`,
      `해석을 덮기 전에 ${scope} 최근 가장 편하게 쉬었던 방식을 적어 보세요. 내게 맞는 휴식은 거창하지 않아도 다음 선택의 기준이 돼요.`,
      `읽고 난 뒤에는 ${scope} 오늘 바로 챙길 수 있는 회복 행동을 하나만 고르세요. 작게 고를수록 실제 생활에서 반복하기 쉬워요.`,
      `다 읽은 뒤에는 ${scope} 피로가 쌓이기 전에 말할 수 있는 부탁 하나를 생각해 보세요. 혼자 참기보다 미리 나누면 회복이 덜 외로워져요.`,
      `해석을 덮기 전에 ${scope} 몸과 마음이 함께 편해지는 시간을 하나 표시해 보세요. 그 시간을 지키는 것이 긴 흐름의 좋은 기준이 될 수 있어요.`,
      `읽고 난 뒤에는 ${scope} 몸과 마음이 동시에 가벼웠던 조건을 하나 떠올려 보세요. 시간대, 사람, 장소 중 하나만 보여도 오래 쓸 수 있는 기준이 돼요.`,
      `다 읽은 뒤에는 ${scope} 회복이 잘 됐던 장면을 작게 남겨 보세요. 무엇을 덜 했고 무엇을 챙겼는지 알면 다음에도 무리하지 않기 쉬워요.`,
      `해석을 덮기 전에 ${scope} 편안했던 리듬을 다시 만들 방법을 하나 정해 보세요. 긴 흐름도 결국 반복할 수 있는 작은 회복에서 안정돼요.`,
      `읽고 난 뒤에는 ${scope} 마음이 놓였던 시간과 몸이 덜 지쳤던 시간을 나누어 보세요. 두 시간이 겹치는 부분이 좋은 회복 기준이 될 수 있어요.`,
      `다 읽은 뒤에는 ${scope} 앞으로도 지켜 보고 싶은 몸의 신호를 하나 고르세요. 신호가 보이면 쉬어 갈지 움직일지 판단하기가 쉬워져요.`,
    ]);
  }
  if (ctx.category === 'career') {
    if (ctx.period === 'life' && (!isMinorReader(ctx) || isFutureAdultLifeForMinorReader(ctx))) {
      return pickVariant(ctx, 'careerSelfCheck', [
        `읽고 난 뒤에는 ${scope} 앞으로도 직접 챙길 기준과 다른 사람에게 맡겨도 되는 범위를 나누어 보세요. 기준과 범위가 보이면 남은 선택이 덜 막연해져요.`,
        `다 읽은 뒤에는 ${scope} 오래 남길 마무리 방식 하나를 떠올려 보세요. 어떤 일을 잘 끝냈는지 보이면 다음 선택도 더 차분해져요.`,
        `해석을 덮기 전에 ${scope} 혼자 붙잡을 일과 함께 볼 일을 구분해 보세요. 함께 볼 사람이 보이면 부담이 덜 쌓여요.`,
        `읽고 난 뒤에는 ${scope} 필요한 사람에게 나눌 경험 하나를 골라 보세요. 정답보다 판단 순서를 전하면 지나온 시간이 더 쓸모 있게 남아요.`,
        `다 읽은 뒤에는 ${scope} 일의 크기가 달라져도 남는 신뢰가 무엇인지 살펴보세요. 그 신뢰가 다음 역할보다 더 오래 가는 기반이 될 수 있어요.`,
      ]);
    }
    return pickVariant(ctx, 'careerSelfCheck', [
      `읽고 난 뒤에는 ${scope} 지금 내가 맡을 일과 넘겨도 되는 일을 나누어 보세요. 역할이 구분되면 일의 무게가 훨씬 현실적으로 보여요.`,
      `다 읽은 뒤에는 ${scope} 오늘 바로 끝낼 일, 확인받을 일, 미뤄도 되는 일을 한 줄씩 나누어 보세요. 세 칸만 생겨도 다음 행동이 쉬워져요.`,
      `해석을 덮기 전에 ${scope} 오래 가져갈 기준과 이번에만 참고할 기준을 나누어 보세요. 지금 당장 다 맞추려 하지 않아도 충분해요.`,
      `읽고 난 뒤에는 ${scope} 피하고 싶은 일보다 먼저 챙길 수 있는 일을 하나 떠올려 보세요. 작은 우선순위가 정해지면 마음이 덜 복잡해져요.`,
      `다 읽은 뒤에는 ${scope} 내가 혼자 붙잡고 있는 책임이 너무 크지 않은지 살펴보세요. 도움을 청할 부분이 보이면 일의 부담도 줄어들어요.`,
      `해석을 덮기 전에 ${scope} 마감, 사람, 내 컨디션 중 가장 흔들리는 것을 하나만 골라 보세요. 흔들리는 지점이 보여야 조절도 쉬워져요.`,
      `읽고 난 뒤에는 ${scope} 잘해 온 방식 하나와 이제 줄여도 되는 방식 하나를 나누어 보세요. 둘을 구분하면 다음 역할이 더 선명해져요.`,
      `다 읽은 뒤에는 ${scope} 내가 결정할 일과 누군가와 함께 확인할 일을 나누어 보세요. 혼자 정하지 않아도 되는 일이 보이면 부담이 내려가요.`,
      `해석을 덮기 전에 ${scope} 다음 단계로 넘기기 전에 확인할 기준 하나를 남겨 보세요. 기준이 하나만 있어도 결정이 덜 급해져요.`,
      `읽고 난 뒤에는 ${scope} 이번에 꼭 지킬 약속과 다시 조정할 약속을 나누어 보세요. 약속의 크기가 정리되면 일의 흐름도 덜 흔들려요.`,
      `다 읽은 뒤에는 ${scope} 내가 잘 버틴 부분도 하나 같이 확인해 보세요. 버틴 힘을 알아야 앞으로 덜어낼 부분도 차분히 보여요.`,
      `해석을 덮기 전에 ${scope} 지금 바로 할 일보다 먼저 정리할 순서를 하나 적어 보세요. 순서가 있으면 큰 일도 작은 행동으로 나뉘어요.`,
      `읽고 난 뒤에는 ${scope} 내 역할을 더 크게 만들 일과 가볍게 유지할 일을 구분해 보세요. 둘을 나누면 무리한 확장을 줄일 수 있어요.`,
      `다 읽은 뒤에는 ${scope} 주변 사람에게 설명해야 할 기준을 한 문장으로 줄여 보세요. 설명이 쉬워지면 역할 조율도 훨씬 편해져요.`,
      `해석을 덮기 전에 ${scope} 다른 사람에게 설명할 때 꼭 남겨야 할 기준 하나를 고르세요. 기준이 짧아지면 부탁이나 조율도 훨씬 편해져요.`,
      `읽고 난 뒤에는 ${scope} 내 역할을 설명할 문장을 짧게 만들어 보세요. 무엇을 맡고 무엇은 함께 볼지 말할 수 있으면 책임의 경계도 안정돼요.`,
      `다 읽은 뒤에는 ${scope} 일의 기준을 나 혼자만 아는 말로 두지 말아 보세요. 가까운 사람이 이해할 수 있는 문장으로 줄이면 협의가 쉬워져요.`,
      `해석을 덮기 전에 ${scope} 앞으로 같은 일을 만났을 때 설명할 순서를 정해 보세요. 설명 순서가 있으면 역할을 나누는 일도 덜 부담스러워요.`,
      `해석을 덮기 전에 ${scope} 다음에 비슷한 일이 왔을 때 다시 쓸 기준을 하나 남겨 보세요. 같은 고민을 줄이는 것이 좋은 일 관리예요.`,
      `읽고 난 뒤에는 ${scope} 다음번에도 그대로 쓸 수 있는 일의 순서를 하나 적어 보세요. 반복할 기준이 생기면 책임이 덜 막막해져요.`,
      `다 읽은 뒤에는 ${scope} 다시 맡아도 괜찮은 일과 도움을 청할 일을 나누어 보세요. 기준을 나누면 혼자 떠안는 무게가 줄어요.`,
      `읽고 난 뒤에는 ${scope} 내가 직접 처리할 일과 조언만 남길 일을 구분해 보세요. 역할의 크기가 보이면 부담이 덜 막연해져요.`,
      `다 읽은 뒤에는 ${scope} 이미 충분히 해낸 부분과 더 줄여야 할 부분을 함께 보세요. 둘을 같이 봐야 일의 균형이 현실적으로 잡혀요.`,
      `해석을 덮기 전에 ${scope} 누군가에게 넘겨도 되는 기준을 하나 정해 보세요. 모든 일을 끝까지 들고 있지 않아도 역할은 유지될 수 있어요.`,
      `읽고 난 뒤에는 ${scope} 이번에 배운 일 처리 방식을 짧게 남겨 보세요. 다음에 같은 상황이 오면 그 기록이 시간을 줄여 줘요.`,
      `다 읽은 뒤에는 ${scope} 내 책임과 팀이나 가족이 함께 볼 책임을 나누어 보세요. 함께 볼 일이 구분되면 혼자 지는 무게가 줄어요.`,
      `해석을 덮기 전에 ${scope} 앞으로 더 키울 역할과 지금은 가볍게 둘 역할을 나누어 보세요. 모든 역할을 크게 만들 필요는 없어요.`,
      `읽고 난 뒤에는 ${scope} 계속 맡을 책임과 기준만 남기고 넘길 책임을 나누어 보세요. 역할의 크기가 보이면 일도 관계도 덜 무겁게 조정돼요.`,
      `다 읽은 뒤에는 ${scope} 지금 넓힐 일과 잠시 유지할 일을 한 줄씩 적어 보세요. 모두 키우려 하지 않아야 오래 갈 책임도 선명해져요.`,
      `해석을 덮기 전에 ${scope} 내가 직접 결정할 일과 조언만 보태도 되는 일을 구분해 보세요. 손을 뗄 범위가 보여야 다음 역할이 더 건강하게 자라요.`,
      `읽고 난 뒤에는 ${scope} 앞으로 맡고 싶은 역할의 모양을 너무 크게 잡지 말아 보세요. 작게 반복할 기준부터 정하면 책임이 부담보다 성장으로 남아요.`,
      `다 읽은 뒤에는 ${scope} 내 이름으로 끝낼 일과 다른 사람과 나눌 일을 나누어 보세요. 나눌 기준이 생기면 성과를 놓치지 않으면서도 덜 지치게 돼요.`,
      `해석을 덮기 전에 ${scope} 이번 단계에서 키울 실력 하나와 내려놓을 부담 하나를 골라 보세요. 둘을 같이 봐야 일의 방향이 현실적으로 잡혀요.`,
      `읽고 난 뒤에는 ${scope} 가장 자주 반복되는 일의 막힘을 하나 떠올려 보세요. 반복되는 막힘을 알면 다음 조정도 더 정확해져요.`,
      `다 읽은 뒤에는 ${scope} 먼저 정리할 일과 시간을 두고 살펴볼 일을 나누어 보세요. 서두르지 않아도 되는 결정은 늦춰도 흐름을 잃지 않아요.`,
      `해석을 덮기 전에 ${scope} 내 기준을 설명할 사람을 하나 떠올려 보세요. 설명할 상대가 정해지면 기준도 더 쉽게 정리돼요.`,
      `읽고 난 뒤에는 ${scope} 잘 맡아 온 일을 계속 붙잡을지, 기준만 남기고 넘길지 나누어 보세요. 역할 전환이 보이면 마음이 덜 흔들려요.`,
    ]);
  }
  if (ctx.category === 'movement') {
    return pickVariant(ctx, 'movementSelfCheck', [
      `읽고 난 뒤에는 ${scope} 바꿀 것과 그대로 둘 것을 하나씩 나누어 보세요. 두 가지가 구분되면 움직임이 훨씬 덜 부담스러워져요.`,
      `다 읽은 뒤에는 ${scope} 다음에 움직일 때 먼저 확인할 기준 하나를 남겨 보세요. 시간, 비용, 함께할 사람 중 하나만 정해도 선택이 가벼워져요.`,
      `해석을 덮기 전에 ${scope} 새로 가 볼 곳과 다녀온 뒤 이어 갈 기준을 함께 떠올려 보세요. 시작과 마무리가 같이 보이면 변화가 더 편안해져요.`,
      `읽고 난 뒤에는 ${scope} 지금 바로 바꿀 수 있는 작은 동선 하나를 골라 보세요. 익숙한 길에 작은 변화를 주는 것만으로도 기분이 달라질 수 있어요.`,
      `다 읽은 뒤에는 ${scope} 무리해서 멀리 움직일 일과 가볍게 시도할 일을 나누어 보세요. 내 체력에 맞는 기준이 있으면 다음 선택이 쉬워져요.`,
      `읽고 난 뒤에는 ${scope} 지금 바꿔도 되는 작은 길 하나와 아직 그대로 둘 일을 나누어 보세요. 변화를 나누면 마음이 덜 복잡해져요.`,
      `다 읽은 뒤에는 ${scope} 다음 이동에서 먼저 확인할 시간을 하나 정해 보세요. 출발 시간이나 돌아올 시간만 분명해도 선택이 훨씬 편해져요.`,
      `해석을 덮기 전에 ${scope} 새로 시도할 장소보다 돌아왔을 때 지킬 리듬을 먼저 떠올려 보세요. 지킬 리듬이 있으면 움직임이 안정돼요.`,
      `읽고 난 뒤에는 ${scope} 가까운 곳에서 해 볼 작은 변화 하나를 고르세요. 길을 크게 바꾸지 않아도 시간대나 동행만 달라져도 충분해요.`,
      `다 읽은 뒤에는 ${scope} 멀리 갈 일과 가까이에서 해결할 일을 구분해 보세요. 가까운 선택이 더 잘 맞을 때도 충분히 많아요.`,
      `해석을 덮기 전에 ${scope} 이동 뒤에 쉴 시간을 먼저 남겨 보세요. 다녀온 뒤의 여유가 보이면 새 일정도 덜 부담스러워요.`,
      `읽고 난 뒤에는 ${scope} 낯선 변화와 익숙한 생활 사이의 균형을 하나만 정해 보세요. 익숙한 기준이 있으면 새 시도도 편해져요.`,
      `다 읽은 뒤에는 ${scope} 이번에는 부담 없이 다녀올 일 하나만 남겨 보세요. 짧은 시도가 다음 변화를 시험해 보는 좋은 기준이 될 수 있어요.`,
      `해석을 덮기 전에 ${scope} 새로 달라질 생활과 다녀온 뒤 여유 중 가장 먼저 볼 것을 고르세요. 기준이 하나면 움직임을 결정하기 쉬워요.`,
      `읽고 난 뒤에는 ${scope} 바로 움직여야 할 일과 조금 기다려도 되는 일을 나누어 보세요. 급하지 않은 변화는 천천히 잡아도 괜찮아요.`,
      `다 읽은 뒤에는 ${scope} 가까운 사람과 함께 확인할 움직임 하나를 생각해 보세요. 혼자 판단하기 어려울 때는 짧은 대화가 기준이 돼요.`,
      `해석을 덮기 전에 ${scope} 생활을 흔드는 변화와 생활을 가볍게 하는 변화를 구분해 보세요. 같은 이동이라도 부담의 크기는 다를 수 있어요.`,
      `읽고 난 뒤에는 ${scope} 오늘 당장 바꿀 수 있는 작은 순서를 하나 정해 보세요. 시간, 동선, 준비 방식 중 하나만 바꿔도 흐름이 달라져요.`,
      `다 읽은 뒤에는 ${scope} 새로운 곳을 보고 싶을 때 필요한 준비 하나를 먼저 적어 보세요. 준비가 보이면 변화가 더 현실적으로 느껴져요.`,
      `해석을 덮기 전에 ${scope} 무리해서 바꿀 필요가 없는 부분도 함께 확인해 보세요. 그대로 두어도 되는 기준이 있으면 움직임이 더 안정돼요.`,
      `읽고 난 뒤에는 ${scope} 새로 바꿀 것과 그대로 지킬 것을 나누어 보세요. 지켜도 되는 기준이 보여야 이동의 크기도 현실적으로 정해져요.`,
      `다 읽은 뒤에는 ${scope} 지금 생활을 흔들지 않아도 되는 부분을 먼저 확인해 보세요. 그대로 둘 것이 있으면 새 변화도 덜 부담스럽게 받아들일 수 있어요.`,
      `해석을 덮기 전에 ${scope} 이동이 필요한 일과 제자리에서 정리할 일을 따로 떠올려 보세요. 움직이지 않아도 풀리는 일이 보이면 선택이 가벼워져요.`,
      `읽고 난 뒤에는 ${scope} 바꿔 볼 작은 조건 하나와 계속 지킬 생활 기준 하나를 나누어 보세요. 둘이 함께 있어야 변화가 오래 안정돼요.`,
      `읽고 난 뒤에는 ${scope} 가까운 곳에서 해결할 일과 시간을 들여 움직일 일을 나누어 보세요. 거리보다 부담의 크기를 보는 편이 더 현실적이에요.`,
      `다 읽은 뒤에는 ${scope} 이번 변화가 내 생활을 편하게 하는지 먼저 물어보세요. 편해지는 이유가 보이면 움직일 기준도 더 선명해져요.`,
      `해석을 덮기 전에 ${scope} 새 길을 고르기 전에 돌아올 시간을 함께 정해 보세요. 마무리 시간이 있으면 변화가 훨씬 덜 부담스러워요.`,
      `읽고 난 뒤에는 ${scope} 지금 가장 안전하게 시험해 볼 변화를 하나만 남겨 보세요. 작게 움직여 봐야 내게 맞는지 더 쉽게 알 수 있어요.`,
      `다 읽은 뒤에는 ${scope} 부담이 가장 작은 변화부터 골라 보세요. 작은 시도는 실패해도 회복하기 쉬워서 다음 판단이 더 편해져요.`,
      `해석을 덮기 전에 ${scope} 오늘 시험해 볼 수 있는 작은 조정을 하나 정해 보세요. 시간, 길, 동행 중 하나만 바꿔도 충분한 확인이 돼요.`,
      `읽고 난 뒤에는 ${scope} 크게 옮기기 전 먼저 바꿔 볼 조건을 하나 남겨 보세요. 조건이 작으면 내게 맞는지 훨씬 차분하게 볼 수 있어요.`,
      `다 읽은 뒤에는 ${scope} 안전하게 되돌릴 수 있는 선택을 먼저 생각해 보세요. 되돌릴 방법이 보이면 새로운 움직임도 덜 부담스러워요.`,
      `다 읽은 뒤에는 ${scope} 이동이 필요한 일과 제자리에서 정리할 일을 구분해 보세요. 움직이지 않아도 해결되는 일이 보이면 선택이 가벼워져요.`,
      `해석을 덮기 전에 ${scope} 낯선 장소보다 익숙한 기준을 먼저 떠올려 보세요. 익숙한 기준이 있으면 새 환경에서도 덜 흔들려요.`,
      `읽고 난 뒤에는 ${scope} 다음 이동에서 챙길 사람, 시간, 비용 중 하나를 먼저 고르세요. 하나만 분명해도 변화가 더 관리하기 쉬워요.`,
      `다 읽은 뒤에는 ${scope} 크게 옮길 일보다 작게 바꿔 볼 순서를 먼저 정해 보세요. 작은 순서가 보이면 움직임의 부담이 내려가요.`,
      `해석을 덮기 전에 ${scope} 먼저 바꿀 동선과 오래 지킬 기준을 나누어 보세요. 둘이 구분되면 새 변화도 덜 급하게 느껴져요.`,
      `읽고 난 뒤에는 ${scope} 멀리 움직이기 전에 가까운 조정으로 해결될 일을 찾아보세요. 작은 조정이 보이면 큰 변화도 더 차분히 판단할 수 있어요.`,
      `다 읽은 뒤에는 ${scope} 새 환경에서 꼭 지킬 기준 하나를 정해 보세요. 잠, 식사, 비용처럼 기본이 보이면 이동의 부담이 줄어요.`,
      `해석을 덮기 전에 ${scope} 움직인 뒤 다시 회복할 시간을 먼저 남겨 보세요. 돌아올 여유가 있어야 새 시도도 편안하게 이어져요.`,
      `읽고 난 뒤에는 ${scope} 다녀온 뒤 바로 이어질 일정을 함께 살펴보세요. 돌아와 쉴 칸이 보여야 새로운 움직임도 생활을 덜 흔들어요.`,
      `다 읽은 뒤에는 ${scope} 다녀온 뒤 남길 정리 시간 하나를 먼저 잡아 보세요. 끝맺음이 있으면 새 경험도 부담보다 배움으로 남아요.`,
      `해석을 덮기 전에 ${scope} 새로 움직인 뒤 몸과 마음이 따라올 시간을 생각해 보세요. 회복할 시간이 있으면 변화가 더 오래 좋은 기억으로 남아요.`,
      `읽고 난 뒤에는 ${scope} 돌아왔을 때 지킬 식사, 잠, 정리 시간을 하나 떠올려 보세요. 기본 리듬이 남아 있으면 이동도 더 안전하게 느껴져요.`,
      `읽고 난 뒤에는 ${scope} 이번 변화가 줄여 주는 부담과 새로 만드는 부담을 나누어 보세요. 둘을 함께 봐야 움직일지 기다릴지 정하기 쉬워요.`,
      `다 읽은 뒤에는 ${scope} 내 마음이 들뜨는 이유와 조심스러운 이유를 한 줄씩 적어 보세요. 두 이유가 보이면 선택이 충동보다 판단에 가까워져요.`,
      `해석을 덮기 전에 ${scope} 다음 이동에서 꼭 확인할 사람, 비용, 쉬는 시간을 하나씩 떠올려 보세요. 준비가 보이면 낯선 변화도 훨씬 현실적으로 느껴져요.`,
      `해석을 덮기 전에 ${scope} 이동이 기대되는 이유와 걱정되는 이유를 하나씩 적어 보세요. 둘이 함께 보여야 움직임을 더 현실적으로 고를 수 있어요.`,
      `읽고 난 뒤에는 ${scope} 지금 생활을 편하게 만드는 기준과 바꿔 보고 싶은 동선을 나누어 보세요. 남길 것과 바꿀 것이 구분되면 변화가 덜 흔들려요.`,
      `다 읽은 뒤에는 ${scope} 새로 움직일 이유와 그대로 지킬 이유를 나누어 보세요. 이유가 보이면 변화가 충동보다 선택에 가까워져요.`,
      `해석을 덮기 전에 ${scope} 떠날 준비와 돌아와 쉴 준비를 함께 적어 보세요. 시작과 마무리가 같이 보이면 이동이 훨씬 안전해져요.`,
      `읽고 난 뒤에는 ${scope} 바꾸고 싶은 장소보다 먼저 바꾸고 싶은 불편함을 떠올려 보세요. 불편함이 분명하면 꼭 멀리 가지 않아도 해결할 길이 보여요.`,
      `다 읽은 뒤에는 ${scope} 이번 변화가 생활을 가볍게 하는지, 부담을 키우는지 나누어 보세요. 두 가지가 구분되면 다음 움직임을 차분히 고를 수 있어요.`,
      `해석을 덮기 전에 ${scope} 가장 작게 시험할 수 있는 이동을 하나 정해 보세요. 되돌릴 수 있는 변화부터 해 보면 내게 맞는 크기를 더 쉽게 알 수 있어요.`,
      `다 읽은 뒤에는 ${scope} 혼자 움직일 일과 함께 확인할 일을 구분해 보세요. 같이 볼 사람이 정해지면 낯선 변화도 더 안전하게 느껴져요.`,
      `해석을 덮기 전에 ${scope} 새로운 길을 고르기 전 꼭 지킬 생활 기준 하나를 남겨 보세요. 기준이 있으면 움직임이 충동보다 선택에 가까워져요.`,
      `읽고 난 뒤에는 ${scope} 장소를 바꾸지 않아도 달라질 수 있는 시간을 먼저 보세요. 같은 자리에서도 시간대와 준비가 바뀌면 느낌이 달라져요.`,
      `다 읽은 뒤에는 ${scope} 자주 다니는 길 중 줄일 피로 하나를 찾아보세요. 덜 지치는 길을 고르는 것도 충분히 좋은 변화예요.`,
      `해석을 덮기 전에 ${scope} 떠나는 선택과 머무는 선택이 각각 무엇을 지켜 주는지 생각해 보세요. 지켜지는 것이 보이면 결정이 차분해져요.`,
      `읽고 난 뒤에는 ${scope} 다음 변화가 끝난 뒤 돌아올 일상을 함께 그려 보세요. 돌아올 장면이 있으면 새 시도도 더 편안해져요.`,
    ]);
  }
  return pickVariant(ctx, 'selfCheck', [
    `읽고 난 뒤에는 ${scope} 내가 바로 조절할 수 있는 것이 무엇인지 한 번만 물어봐도 좋아요. 답이 거창하지 않아도 괜찮고, 눈앞의 행동이면 충분해요.`,
    `읽고 난 뒤에는 ${scope} 내가 줄일 수 있는 부담이 무엇인지 떠올려 보세요. 아주 작은 정리, 짧은 연락, 쉬는 시간 하나처럼 바로 가능한 행동이면 충분해요.`,
    selfCheckActionPrompt(ctx),
    `다 읽은 뒤에는 ${scope} 다음 선택에 바로 써먹을 수 있는 작은 기준 하나만 남겨 보세요. 기준이 하나만 있어도 다음 선택이 훨씬 쉬워져요.`,
    `해석을 덮기 전에 ${scope} 지금 가장 부담이 적은 행동을 하나 골라 보세요. 큰 계획보다 바로 해 볼 수 있는 일이 더 오래 남아요.`,
    `마지막으로 ${scope} 내가 이미 잘하고 있는 부분도 하나 같이 확인해 보세요. 고칠 점만 보는 것보다 유지할 점을 알아 두는 편이 더 실용적이에요.`,
    `읽고 난 뒤에는 ${scope} 가장 가까운 일정에서 확인할 행동을 하나만 정해 보세요. 작을수록 부담이 덜하고, 다시 이어 가기도 쉬워요.`,
    `읽고 난 뒤에는 ${scope} 내가 이미 반복하고 있는 좋은 습관이 무엇인지 찾아보세요. 새로 시작할 일만 찾기보다 유지할 일을 알아 두면 마음이 가벼워요.`,
    `다 읽은 뒤에는 ${scope} 지금 줄일 말, 줄일 약속, 줄일 걱정 중 하나를 골라 보세요. 덜어낼 것이 보이면 다음 행동도 더 쉽게 정해져요.`,
    `다 읽은 뒤에는 ${scope} 마음에 남은 문장을 하나만 표시해 보세요. 그 문장이 다음 선택을 정할 작은 기준이 될 수 있어요.`,
    selfCheckPeriodChoice(ctx),
    `해석을 덮기 전에 ${scope} 피하고 싶은 일보다 먼저 챙길 수 있는 일을 하나 떠올려 보세요. 작은 우선순위가 정해지면 마음이 덜 복잡해져요.`,
    `마지막으로 ${scope} 내가 이미 잘하고 있는 부분과 조금 덜어낼 부분을 하나씩 나누어 보세요. 둘을 함께 보면 해석이 더 현실적인 조언으로 남아요.`,
  ]);
}


function selfCheckActionPrompt(ctx: StandardDepthEnhancementContext): string {
  const scope = periodCategoryAreaPhrase(ctx);
  switch (ctx.period) {
    case 'today':
      return `읽고 난 뒤에는 ${scope} 지금 미뤄 두지 않아도 되는 작은 확인 하나를 골라 보세요. 행동이 작을수록 해석이 하루 안에서 더 잘 쓰여요.`;
    case 'thisWeek':
      return `읽고 난 뒤에는 ${scope} 이번 주 안에 한 번 확인할 장면을 골라 보세요. 오래 고민하기보다 짧게 점검할 일을 정하면 부담이 줄어요.`;
    case 'thisMonth':
      return `읽고 난 뒤에는 ${scope} 반복해서 확인할 습관 하나를 골라 보세요. 여러 번 나타나는 장면을 보면 바꿀 부분이 더 분명해져요.`;
    case 'thisYear':
      return `읽고 난 뒤에는 ${scope} 올해 안에 계절마다 다시 볼 기준 하나를 골라 보세요. 큰 결심보다 꾸준히 확인할 기준이 더 오래 남아요.`;
    case 'life':
      return `읽고 난 뒤에는 ${scope} 오래 가져갈 기준 하나와 지금만 가볍게 볼 조언 하나를 나누어 보세요. 그렇게 읽으면 부담이 줄고 필요한 말이 더 잘 남아요.`;
  }
}
function selfCheckPeriodChoice(ctx: StandardDepthEnhancementContext): string {
  const scope = periodCategoryAreaPhrase(ctx);
  switch (ctx.period) {
    case 'today':
      return `해석을 덮기 전에 ${scope} 가장 부담 없이 해 볼 선택을 하나만 남겨 보세요. 실제로 할 수 있는 만큼만 정해도 충분해요.`;
    case 'thisWeek':
      return `해석을 덮기 전에 ${scope} 한 번 확인할 선택을 하나만 남겨 보세요. 작게 정하면 중간에 다시 맞추기 쉬워요.`;
    case 'thisMonth':
      return `해석을 덮기 전에 ${scope} 반복해서 확인할 기준을 하나만 남겨 보세요. 여러 날에 걸쳐 볼 수 있어야 실제 생활에 도움이 돼요.`;
    case 'thisYear':
      return `해석을 덮기 전에 ${scope} 계절마다 다시 볼 기준을 하나만 남겨 보세요. 너무 큰 목표보다 오래 유지할 방향이 더 도움이 돼요.`;
    case 'life':
      return `해석을 덮기 전에 ${scope} 오래 가져갈 기준과 지금만 참고할 말을 나누어 보세요. 지금 당장 다 맞추려 하지 않아도 충분해요.`;
  }
}
function categoryPeriodTail(ctx: StandardDepthEnhancementContext): string {
  switch (ctx.period) {
    case 'today':
      return '오늘은 바로 보이는 일 하나에만 적용해도 충분해요.';
    case 'thisWeek':
      return '이번 주에는 중간에 한 번 돌아볼 시간을 미리 잡아 두면 좋아요.';
    case 'thisMonth':
      return '이번 달에는 반복해서 나타나는 장면을 짧게 기록해 두면 도움이 돼요.';
    case 'thisYear':
      return '올해에는 계절마다 한 번씩 기준을 다시 맞추면 방향을 잃지 않아요.';
    case 'life':
      return '긴 흐름에서는 앞으로 이어질 준비와 나중에 다시 볼 부분을 나누어 생각해 보세요.';
  }
}

function categoryCheckTail(ctx: StandardDepthEnhancementContext): string {
  switch (ctx.period) {
    case 'today':
      return '하루가 끝나기 전에 실제로 편해진 부분을 한 번만 확인해 보세요.';
    case 'thisWeek':
      return '주말이 오기 전에 잘된 점과 불편했던 점을 하나씩만 적어 보세요.';
    case 'thisMonth':
      return '월말에는 계속 가져갈 습관과 줄일 습관을 하나씩 나누어 보면 좋아요.';
    case 'thisYear':
      return '연말에 남기고 싶은 기준을 떠올리며 너무 큰 목표보다 유지할 방식을 골라 보세요.';
    case 'life':
      return '한 시기의 모습만으로 단정하지 말고 반복해서 도움이 되는 방식을 찾아보면 좋아요.';
  }
}


function categoryAdjustmentGuidance(ctx: StandardDepthEnhancementContext): string {
  if (isFutureAdultLifeForMinorReader(ctx)) {
    switch (ctx.category) {
      case 'wealth':
        return '지금 용돈을 잘 쓰라는 말로 좁히기보다, 훗날 돈과 물건을 다룰 때 필요한 확인 습관을 넓게 보는 편이 좋아요.';
      case 'career':
        return '직업 이름을 지금 정하라는 말이 아니라, 책임을 맡을 때 어떤 기준과 도움을 함께 볼지 미리 살펴보세요.';
      case 'romance':
        return '성급한 관계 결론이 아니라, 나중에도 필요한 말투와 거리감, 서로의 속도를 부드럽게 배우는 방향으로 읽어 주세요.';
      case 'family':
        return '가족 역할을 미리 정해 두라는 뜻이 아니라, 가까운 사람과 부담을 나누는 태도를 천천히 익히는 참고로 보면 좋아요.';
      case 'health':
      case 'health_stress':
        return '먼 훗날의 몸과 마음을 단정하기보다, 지금 편한 생활 리듬을 알아 두는 일이 나중의 회복 기준이 될 수 있어요.';
      default:
        return '지금 바로 맞춰야 하는 답보다, 나중에 다시 읽어도 도움 될 기준 하나를 남기는 쪽으로 보면 좋아요.';
    }
  }
  switch (ctx.category) {
    case 'wealth':
      return isYoungChildReader(ctx)
        ? '갖고 싶은 것, 기다릴 수 있는 것, 이동할 때 드는 작은 비용을 함께 말해 보면 선택이 더 쉬워져요.'
        : isMinorReader(ctx)
          ? '필요한 지출, 잠깐 미뤄도 되는 큰 물건, 이동 비용을 나누면 훨씬 현실적으로 읽혀요.'
          : '필요한 지출, 잠깐 미뤄도 되는 지출, 이동이나 큰 거래에 붙는 비용을 나누면 훨씬 현실적으로 읽혀요.';
    case 'health':
      return '몸이 보내는 신호 중 바로 챙길 수 있는 것부터 남기면 좋아요. 오늘 편했던 습관 하나를 다시 해 보면 회복 기준을 찾기 쉬워요.';
    case 'academic':
      return '새로 시작하기 전에 오늘 확인할 단서 하나만 남겨도 다음 공부가 가벼워져요.';
    case 'romance':
      return isMinorReader(ctx)
        ? '친구의 마음을 맞히려 하기보다 편하게 말할 수 있는 장면 하나를 늘려 보세요.'
        : '마음을 더 세게 밀어붙이기보다 편안해지는 대화 하나를 늘려 보세요.';
    case 'family':
      return '서로 덜 부담되는 말과 시간을 하나씩 남겨 보면 좋아요.';
    case 'career':
      if (isMinorReader(ctx)) return '관심 있는 일과 아직 더 알아볼 일을 나누면 진로 생각이 덜 복잡해져요.';
      return ctx.period === 'life'
        ? '오래 맡을 일, 함께 나눌 일, 남길 기록 중 하나를 고르면 일의 방향이 덜 흔들려요.'
        : '회의, 연락, 마감처럼 바로 처리할 것 하나를 먼저 정하면 마음이 훨씬 가벼워져요.';
    case 'study_document':
      return '적어 둘 것과 나중에 다시 볼 것을 나누면 머릿속 부담이 줄어요. 중요한 기록은 제출처와 보관 위치를 같이 적어 두면 더 안전해요.';
    case 'expression_children':
      return '잘 보이려는 마음보다 먼저 꺼내 볼 작은 표현 하나를 정해 보세요.';
    case 'health_stress':
      return '참아야 할 일과 풀어야 할 일을 나누면 몸이 덜 긴장해요.';
    case 'movement':
      return '바꿀 것과 그대로 둘 것을 나누면 이동이나 변화도 덜 부담스러워요. 혼자 정하기 애매하면 가까운 사람과 새로 바꿀 일, 지킬 기준, 도움받을 방법을 함께 확인해 보세요.';
    case 'overall':
      return '계속 가져갈 습관과 한 단계 낮출 부담을 나누면 훨씬 현실적으로 읽혀요.';
  }
}
function withCategoryTail(
  ctx: StandardDepthEnhancementContext,
  base: string,
): string {
  if (ctx.period === 'life' && ctx.category === 'movement') {
    return pickVariant(ctx, 'categoryGuidance', [
      `${base} 새로 바꿀 것과 오래 지킬 기준을 나누어 보세요.`,
      `${base} 다녀온 뒤 안부를 나눌 사람을 정해 보세요.`,
      `${base} 바꿀 것과 오래 지킬 기준을 한 가지씩만 남겨 보세요.`,
      `${base} 직접 움직일 일과 자리에서 정리해도 되는 일을 나누어 보세요.`,
    ]);
  }
  if (ctx.period === 'life' && ctx.category === 'overall') {
    return pickVariant(ctx, 'categoryGuidance', [
      base + ' 덜어낼 부담도 함께 보세요.',
      base + ' 한 시기의 장면보다 반복해서 편해지는 방식을 남겨 보세요.',
      base + ' 몸, 관계, 일, 배움의 균형을 긴 흐름으로 나누어 보세요.',
      base + ' 모든 문장을 한 번에 적용하기보다 오래 가져갈 기준 하나만 남겨 보세요.',
    ]);
  }
  if (ctx.period === 'life' && ctx.category === 'career') {
    return pickVariant(ctx, 'categoryGuidance', [
      base + ' 앞으로 전할 판단 기준과 내려놓을 부담을 나누어 보세요.',
      base + ' 잘 끝낸 일의 방식과 다시 확인할 기록 중 하나만 붙잡아 보세요.',
      base + ' 그 신뢰가 어디에서 생겼는지 함께 보세요.',
      base + ' 혼자 붙잡을 부담보다 함께 나눌 경험을 확인해 보세요.',
    ]);
  }
  const nudge = categoryNudge(ctx);
  return pickVariant(ctx, 'categoryGuidance', [
    `${base} ${categoryPeriodTail(ctx)} ${nudge}`,
    `${base} ${categoryCheckTail(ctx)} ${nudge}`,
    `${base} ${publicPeriodLabel(ctx.period)} 안에서 부담이 가장 작은 장면 하나부터 골라 보세요. ${nudge}`,
    `${base} 먼저 떠오르는 한 가지부터 확인하면 충분해요. 기준이 작을수록 실제 생활에 옮기기 쉬워요. ${nudge}`,
    `${base} 바로 바꾸기 어려운 부분은 잠시 접어 두고, 이번에 다룰 한 가지부터 고르면 좋아요. ${nudge}`,
    `${base} ${categoryAdjustmentGuidance(ctx)} ${nudge}`,
    `${base} 여러 가지를 한꺼번에 고치려 하기보다 가장 자주 반복되는 장면 하나만 먼저 살펴보세요. ${nudge}`,
    `${base} 잘 맞는 조언은 작은 장면에서 먼저 시험해 보고, 애매한 조언은 다음 점검 때 다시 봐도 돼요.`,
    `${base} 지금 바로 쓸 한 가지와 조금 더 지켜볼 한 가지를 나누면 읽는 부담이 줄어요.`,
    `${base} 한 문장만 남겨도 다음 선택의 기준이 될 수 있어요. 생활에 맞는 말부터 천천히 적용하면 돼요.`,
  ]);
}
function academicCategoryGuidance(ctx: StandardDepthEnhancementContext): string {
  if (isFutureAdultLifeForMinorReader(ctx)) {
    return pickVariant(ctx, 'categoryGuidance', [
      '공부와 배움에서는 지금의 성적을 미리 정하지 않아도 돼요. 나중에 다시 쓸 질문 하나만 남겨도 충분해요.',
      '공부와 배움에서는 먼 결론보다 오래 남을 배움 방식 하나를 보세요. 편했던 설명이나 다시 볼 자료 하나면 충분해요.',
      '공부와 배움에서는 아이에게 당장 해내라고 요구하기보다 편하게 배우는 방식을 살피면 좋아요. 오래 가져갈 질문 하나만 남겨도 돼요.',
    ]);
  }
  if (isYoungChildReader(ctx)) {
    return pickVariant(ctx, 'categoryGuidance', [
      '공부와 배움에서는 아이가 좋아한 장면과 궁금한 질문을 나누면 충분해요. 다시 볼 자료 하나만 정해도 다음 배움이 이어져요.',
      '공부와 배움에서는 새 내용을 늘리기보다 아이가 재미있어한 순간을 남겨 보세요. 보호자가 옆에서 짧게 확인해 주면 좋아요.',
      '공부와 배움에서는 그림책 한 장면, 만들기 하나, 물어본 말 하나처럼 작은 단서가 좋아요. 즐거웠던 단서가 다음 배움의 시작점이 돼요.',
    ]);
  }
  if (isMinorReader(ctx)) {
    return pickVariant(ctx, 'categoryGuidance', [
      '공부와 배움에서는 이해한 문장과 막힌 질문을 나누어 보세요. 다시 설명할 예시 하나가 있으면 다음 순서가 또렷해져요.',
      '공부와 배움에서는 더 많은 분량보다 다시 말할 수 있는 한 줄이 먼저예요. 한 줄이 보이면 도움받을 질문도 쉬워져요.',
      '공부와 배움에서는 맞힌 것, 어려운 것, 물어볼 것을 세 칸으로 나누어 보세요. 칸이 보이면 막힌 부분도 덜 무겁게 느껴져요.',
    ]);
  }
  if (ctx.period === 'life') {
    return pickVariant(ctx, 'categoryGuidance', [
      '공부와 배움에서는 다시 돌아올 기준 하나가 중요해요. 시간대, 자료, 설명 방식 중 하나만 남겨도 충분해요.',
      '공부와 배움에서는 지나온 경험과 새 지식을 연결해 보세요. 어디에 써 봤는지만 적어도 다음 배움이 분명해져요.',
      '공부와 배움에서는 계속 꺼내 쓸 방법을 남기는 편이 좋아요. 정리 방식이나 질문 방식 하나면 충분해요.',
    ]);
  }
  return pickVariant(ctx, 'categoryGuidance', [
    '공부와 배움에서는 문제 하나, 요약 한 줄, 다시 볼 자료 하나처럼 손에 잡히는 단위를 정해 보세요. 질문이 구체적이면 다음 행동도 쉬워져요.',
    '공부와 배움에서는 오래 붙잡는 시간보다 끝에 남길 결과가 중요해요. 오늘은 풀이, 초안, 다시 볼 자료 중 하나만 정해도 충분해요.',
    '공부와 배움에서는 도움받을 사람을 막연히 찾기보다 어떤 자료를 다시 볼지 먼저 정해 보세요. 질문이 좁아질수록 조언도 실천으로 이어져요.',
  ]);
}
function categoryGuidance(category: PublicCategory, ctx: StandardDepthEnhancementContext): string {
  const futureAdultLifeForMinor = isFutureAdultLifeForMinorReader(ctx);
  const youngChild = isYoungChildReader(ctx) && !futureAdultLifeForMinor;
  const minor = isMinorReader(ctx) && !futureAdultLifeForMinor;
  switch (category) {
    case 'overall':
      return withCategoryTail(ctx, pickVariant(ctx, 'categoryGuidance', [
        '전체 생활에서는 속도를 올리는 것보다 오래 반복되는 순서를 알아보는 일이 먼저예요. 몸, 관계, 일, 배움이 흔들리는 장면을 나누면 전체 흐름도 덜 막연해져요. 혼자 판단하기 애매한 부분은 믿을 만한 사람과 오래 지킬 기준을 함께 확인해 보세요.',
        '전체 생활에서는 한꺼번에 많이 바꾸기보다 오래 가져갈 순서를 정하는 편이 좋아요. 계속 맡을 일, 쉬어 갈 일, 나중에 다시 볼 일을 나누면 해석도 덜 무겁게 남아요.',
        '전체 생활에서는 큰 결론보다 반복해서 줄일 부담을 찾는 일이 먼저예요. 몸 상태, 관계, 일의 리듬 중 가장 자주 흔들리는 부분을 보면 방향이 또렷해져요.',
        '전체 생활에서는 잘되는 부분과 조절할 부분을 함께 보는 태도가 중요해요. 이미 유지되는 습관은 남기고, 부담이 큰 일은 작게 나누면 읽은 내용이 더 현실적으로 남아요.',
        '전체 생활에서는 모든 조언을 동시에 따라 하려 하지 않아도 괜찮아요. 지금 필요한 기준과 나중에 다시 볼 기준을 나누면 마음이 훨씬 가벼워져요.',
        '전체 생활에서는 오래 조정할 일과 그대로 두어도 되는 일을 나누어 보세요. 둘이 구분되면 해석이 막연한 말이 아니라 생활 기준으로 바뀌어요.',
        '전체 생활에서는 무리해서 새 계획을 늘리기보다 자주 흔들리는 순서를 정리하는 편이 좋아요. 작은 기준 하나가 여러 시기의 선택을 더 쉽게 만들어 줘요.',
        '전체 생활에서는 좋은 말만 골라 듣기보다 부담되는 말도 작은 기준으로 줄여 보는 편이 도움이 돼요. 오래 반복할 수 있는 크기로 바꾸면 생활에서 이어 가기 훨씬 쉬워요.',
      ]));
    case 'wealth':
      return withCategoryTail(ctx, youngChild
        ? '물건과 작은 선택은 갖고 싶은 것을 바로 고르기보다 잠깐 기다려 보는 연습에 가까워요. 보호자와 함께 필요한 것, 나중에 해도 되는 것, 이동할 때 드는 작은 비용을 말해 보면 좋아요.'
        : minor
          ? '용돈과 물건 관리는 갖고 싶은 것과 꼭 필요한 것을 나눠 보는 연습이 좋아요. 이동 비용이나 큰 물건처럼 돈이 많이 드는 일도 먼저 적어 보면 자기 기준이 생겨요.'
          : '돈과 물건 관리는 들어오는 것보다 나가는 곳을 먼저 보는 편이 좋아요. 작은 지출과 약속을 확인하면 불필요한 부담을 줄일 수 있어요. 새 거래나 이동이 함께 있는 큰 지출은 비용과 조건을 따로 적어 두면 더 안전해요.');
    case 'health':
      return withCategoryTail(ctx, pickVariant(ctx, 'sourceHealthBalancedBasics', [
        '몸과 마음에서는 거창한 목표보다 다시 반복할 수 있는 기본이 중요해요. 잠, 식사, 가벼운 움직임 중 가장 쉬운 것부터 고르면 좋아요.',
        '컨디션을 볼 때는 좋은 날의 습관과 피곤한 날의 원인을 나누어 보는 편이 좋아요. 한꺼번에 바꾸지 않아도 작은 기준 하나가 몸을 안정시켜요.',
        '몸과 마음은 큰 결심보다 익숙한 리듬에 더 잘 반응해요. 물 마시기, 일찍 눕기, 짧게 걷기처럼 다시 할 수 있는 행동을 골라 보세요.',
        '건강을 읽을 때는 지금 가장 덜 무리한 선택을 찾는 것이 먼저예요. 쉬운 습관 하나를 지키면 다른 변화도 더 편하게 따라와요.',
        '몸과 마음을 볼 때는 많이 바꾸는 것보다 덜 무리한 기준을 찾는 편이 좋아요. 잠, 식사, 움직임 중 하나만 편해져도 다음 변화가 쉬워져요.',
        '컨디션 관리는 큰 결심보다 오늘 줄일 부담 하나에서 시작돼요. 지금 가장 쉽게 지킬 수 있는 회복 행동을 고르면 생활에 오래 남아요.',
        '건강 조언은 어렵게 받아들이지 않아도 돼요. 오늘 몸이 덜 힘들어질 선택 하나를 찾고, 그 기준을 다음 일정에도 작게 붙이면 충분해요.',
        '몸의 신호는 어렵게 해석하지 않아도 돼요. 잠이 흔들렸는지, 식사가 급했는지, 움직임이 부족했는지 한 가지부터 살피면 충분해요.',
        '몸과 마음에서는 잘 버티는 힘보다 오래 유지할 수 있는 기준이 더 중요할 때가 많아요. 편했던 시간대와 지쳤던 장면을 나누어 보세요.',
      ]));
    case 'academic':
      return academicCategoryGuidance(ctx);
    case 'romance':
      return withCategoryTail(ctx, minor
        ? '친구 관계에서는 상대의 마음을 맞히려 하기보다 내 마음을 차분히 말하는 편이 좋아요. 짧고 솔직한 말이 오해를 줄여 줘요. 혼자 오래 고민되면 믿을 만한 어른이나 가까운 사람에게 짧게 말해 보세요.'
        : '관계에서는 상대의 마음을 맞히려 하기보다 내 마음을 차분히 말하는 편이 좋아요. 짧고 솔직한 말이 오해를 줄여 줘요. 혼자 오래 고민되면 믿을 만한 사람과 짧게 나누어 보세요.');
    case 'family':
      return withCategoryTail(ctx, pickVariant(ctx, 'categoryGuidance', [
        '가까운 사람들과는 마음을 길게 설명하기보다 작은 신호를 자주 나누는 편이 좋아요. 짧은 안부, 고마웠던 말, 같이 챙길 일 하나가 분위기를 부드럽게 만들어 줘요.',
        '가까운 사람들과는 완벽한 대화보다 자주 확인하는 태도가 더 도움이 돼요. 오늘 괜찮았는지 묻고, 필요한 일을 하나 나누면 관계의 부담이 줄어요.',
        '가까운 사람들과는 큰 약속보다 매일의 작은 다정함이 오래 남아요. 고맙다는 말, 짧은 연락, 함께 정리할 일 하나가 관계를 안정적으로 이어 줘요.',
        '가까운 사람들과는 서로의 마음을 맞히려 하기보다 확인해 보는 말이 필요해요. 짧게 묻고, 들은 내용을 가볍게 받아 주면 오해가 줄어요.',
        '가까운 사람들과는 잘해 주려는 마음이 커질수록 부담 없는 방식이 더 중요해요. 한마디 안부와 작은 도움을 주고받는 리듬이 관계를 편하게 만들어 줘요.',
        '가까운 관계에서는 많이 해 주는 것보다 서로 편한 크기를 찾는 일이 중요해요. 안부, 부탁, 도움의 범위를 작게 나누면 마음이 덜 지쳐요.',
        '가족이나 가까운 사람과는 큰 해결보다 반복되는 태도가 오래 남아요. 짧게 듣고, 필요한 것을 묻고, 가능한 도움만 약속하면 부담을 서로 나누고 관계도 더 편안해져요.',
        '마음이 가까운 사람일수록 모든 일을 바로 해결하려 하지 않아도 괜찮아요. 오늘은 말 한마디, 작은 확인, 기다려 주는 태도 중 하나만 챙겨도 충분해요.',
        '관계가 편해지려면 잘하려는 마음과 쉬어 가는 시간이 함께 필요해요. 내가 할 수 있는 만큼을 말하고, 상대의 속도도 함께 보면 부담이 줄어요.',
        '가까운 사람들과는 오래 쌓인 마음을 한 번에 풀기보다 지금 가능한 말부터 고르는 편이 좋아요. 고마움, 미안함, 부탁을 짧게 나누면 대화가 덜 무거워져요.',
        '가족과 가까운 관계에서는 작은 예의가 큰 설명보다 더 잘 닿을 때가 많아요. 작은 부딪힘이 생겨도 한 박자 쉬고 짧게 풀면 분위기가 덜 흔들려요. 늦지 않는 답, 편한 시간, 함께 챙길 일 하나가 관계를 안정시켜 줘요.',
        '서로를 아끼는 마음이 있어도 방식이 맞지 않으면 피로가 생길 수 있어요. 먼저 들어 줄 일과 나중에 말할 일을 나누면 관계가 더 부드러워져요.',
        '가까운 관계의 흐름은 한 번의 대화보다 생활 속 반복에서 더 잘 보여요. 자주 지키는 약속과 자주 놓치는 말투를 함께 나누어 보면 관계의 부담이 줄고 다음 행동이 쉬워져요.',
      ]));
    case 'career':
      return withCategoryTail(ctx, minor
        ? pickVariant(ctx, 'categoryGuidance', [
          '진로 감각은 한 번에 정답을 찾기보다 관심 있는 일을 하나씩 경험할 때 또렷해져요. 좋아하는 것과 잘하는 것을 따로 적어 두면 선택이 쉬워져요.',
          '진로 감각은 직업 이름을 빨리 고르는 일보다 내가 어떤 활동에서 오래 집중하는지 알아보는 과정이에요. 해 본 일, 재미있던 일, 조금 어려웠던 일을 나누어 적어 보세요.',
          '진로 감각은 좋아하는 것만으로도, 잘하는 것만으로도 바로 정해지지 않아요. 둘이 만나는 장면을 천천히 모으면 나중에 고를 길의 단서가 생겨요.',
          '진로 감각은 여러 가능성을 작게 만져 볼 때 자라요. 동아리, 수업, 만들기, 대화처럼 실제로 해 본 경험을 남기면 막연한 고민이 줄어요.',
          '진로 감각은 남들이 멋지다고 말하는 길보다 내가 편하게 다시 해 보고 싶은 일을 찾는 데서 시작돼요. 오늘은 관심 있는 활동 하나만 더 살펴봐도 충분해요.',
          '진로 감각은 정답을 맞히는 시험이 아니에요. 내가 즐거웠던 순간과 힘들었지만 배운 순간을 나누어 보면 선택지가 더 현실적으로 보여요.',
        ])
        : ctx.period === 'life'
          ? pickVariant(ctx, 'categoryGuidance', [
            '지나온 경험을 볼 때는 눈앞의 처리보다 오래 남을 마무리 방식을 보는 편이 좋아요. 잘 끝낸 일의 방식, 다시 확인할 기록, 함께 볼 사람을 나누면 다음 선택이 더 차분해져요.',
            '지나온 경험을 볼 때는 모든 일을 동시에 붙잡기보다 앞으로 전할 판단 기준과 내려놓을 부담을 가르는 힘이 중요해요. 구분이 보이면 후반의 선택도 더 안정적으로 남아요.',
            '큰 성과보다 오래 가는 신뢰를 먼저 보세요. 어떤 일을 잘 끝냈고 누구와 함께 볼 때 편했는지 나누면 다음 선택이 더 차분해져요.',
            '일의 무게가 커질수록 혼자 끌고 가기보다 함께 볼 사람과 확인할 조건을 나누는 편이 좋아요. 그 구분이 후반의 선택 폭을 지켜 줘요.',
          ])
          : ctx.period === 'thisYear'
            ? pickVariant(ctx, 'categoryGuidance', [
              '모든 제안을 동시에 붙잡기보다 밖에서 보여 줄 결과를 정하는 힘이 중요해요. 같이 검토할 사람과 잠시 미룰 제안을 나누면 방향이 선명해져요.',
              '올해 일에서는 속도보다 밖에서 볼 수 있는 결과가 더 중요할 때가 있어요. 문서, 발표, 제안처럼 남길 형태를 정하면 새 기회도 더 차분하게 고를 수 있어요.',
              '일의 방향을 볼 때는 많이 해내는지보다 무엇을 보이는 형태로 남길지가 중요해요. 완성할 결과와 다시 검토할 기록을 나누면 한 해의 선택 기준이 훨씬 또렷해져요.',
              '새 제안이 들어와도 바로 방향을 바꾸지 않아도 괜찮아요. 남길 결과와 다음에 넓힐 가능성을 따로 적으면 기회가 와도 판단이 쉬워져요.',
              '올해의 성과는 혼자 끝낸 양보다 누가 이해하고 활용할 수 있는지에서 더 분명해져요. 같이 검토할 사람과 공개할 결과를 나누어 보세요.',
            ])
            : pickVariant(ctx, 'categoryGuidance', [
              '일과 책임에서는 모든 일을 동시에 붙잡기보다 오늘의 순서를 먼저 세우는 게 중요해요. 급한 일, 맡은 일, 확인할 일을 나누면 실수가 줄어요.',
              '일과 책임에서는 먼저 손댈 일과 기다려도 되는 일을 나누는 힘이 중요해요. 순서가 보이면 같은 업무도 훨씬 덜 무겁게 느껴져요.',
              '책임이 많을수록 전부 잘하려는 마음보다 확인할 순서를 세우는 편이 현실적이에요. 오늘 끝낼 것과 도움받을 것을 나누면 실수가 줄어요.',
              '일에서는 속도보다 놓치지 않는 기준이 더 중요할 때가 있어요. 마감, 확인할 사람, 내 컨디션을 함께 보면 다음 행동이 분명해져요.',
              '맡은 일이 많아 보일 때는 가장 작은 완료 지점을 먼저 정해 보세요. 끝낼 크기가 보이면 책임도 관리할 수 있는 일로 바뀌어요.',
              '일과 책임을 볼 때는 많이 해내는지보다 순서가 보이는지가 중요해요. 오늘 끝낼 일, 확인받을 일, 잠시 미룰 일을 나누면 부담이 훨씬 작아져요.',
              '일에서는 능력보다 배치가 먼저 필요할 때가 많아요. 지금 내가 직접 할 일과 도움을 청할 일을 나누면 책임이 한 사람에게 몰리지 않아요.',
              '책임이 커질수록 한 번에 해결하려는 마음을 줄이는 편이 좋아요. 마감, 사람, 내 컨디션을 나누어 보면 다음 행동이 더 차분하게 정해져요.',
              '일과 책임은 큰 결심보다 작은 정리에서 힘이 생겨요. 해야 할 일의 순서와 확인할 기준을 먼저 적으면 실수와 피로를 함께 줄일 수 있어요.',
            ]));
    case 'study_document':
      if (isMinorReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)) {
        return withCategoryTail(ctx, pickVariant(ctx, 'sourceStudyDocumentLifeChecklist', [
          '기록과 서류에서는 노트, 안내장, 숙제처럼 다시 볼 흔적을 편하게 남기는 게 먼저예요. 아이가 헷갈린 자료를 표시하고 누구에게 물어볼지 알면 다음 확인이 덜 막막해져요.',
          '기록과 서류에서는 많이 적는 것보다 다시 찾기 쉬운 표시가 중요해요. 문제 번호, 어려운 단어, 제출할 작은 약속을 나누면 학교생활 속 정리도 훨씬 가벼워져요.',
          '기록과 서류에서는 완벽한 노트보다 다시 펼칠 수 있는 단서가 도움이 돼요. 색 표시, 짧은 질문, 안내장 보관 자리처럼 손에 익은 방식 하나부터 잡아 보세요.',
          '기록과 서류에서는 작은 빠짐이 부담이 될 수 있지만, 혼자 모두 책임질 필요는 없어요. 보호자나 선생님과 함께 다시 볼 부분을 하나 정하면 아이도 더 편하게 따라올 수 있어요.',
          '기록과 서류에서는 머릿속으로만 기억하기보다 눈에 보이게 남기는 편이 좋아요. 받은 안내장, 제출할 것, 다시 찾을 자료를 나누면 학교 기록이 생활 안에서 힘이 돼요.',
          '기록과 서류에서는 빠르게 끝내는 것보다 다음에 다시 시작할 자리를 남기는 일이 중요해요. 제목 하나나 단서 하나만 또렷해도 다음 확인이 훨씬 쉬워져요.',
        ]));
      }
      return withCategoryTail(ctx, pickVariant(ctx, 'sourceStudyDocumentLifeChecklist', [
        '기록과 서류에서는 기억에만 맡기지 않는 게 좋아요. 날짜, 금액, 약속, 제출할 것을 눈에 보이게 적어 두면 마음이 편해져요. 혼자 확인하기 어렵다면 믿을 만한 사람에게 한 번 보여 주고, 빠진 부분을 같이 살피면 더 안전해요.',
        '기록과 서류에서는 나중에 다시 볼 수 있게 남기는 습관이 중요해요. 말로 한 약속도 날짜와 금액, 확인할 사람을 적어 두면 오해가 줄어요. 제출 전에는 빠진 칸과 마감일을 한 번 더 확인해 보세요.',
        '기록과 서류에서는 완벽한 기억보다 다시 확인할 수 있는 흔적이 도움이 돼요. 사진, 메모, 파일 이름처럼 찾기 쉬운 방식으로 남겨 두면 급할 때 덜 당황해요. 중요한 내용은 혼자만 보지 말고 한 사람에게 더 확인받아도 좋아요.',
        '기록과 서류에서는 작은 빠짐이 큰 불편으로 이어질 수 있어요. 그래서 날짜, 이름, 금액, 연락처처럼 기본 항목을 먼저 확인하는 편이 좋아요. 보관할 것과 제출할 것을 나누면 다음 행동도 더 분명해져요.',
        '기록과 서류에서는 머릿속으로만 기억하면 부담이 커질 수 있어요. 해야 할 일, 보낼 곳, 보관할 곳을 나누어 적으면 마음이 훨씬 가벼워져요. 특히 돈이나 계약이 들어간 내용은 다시 읽을 시간을 꼭 남겨 두세요.',
        '기록과 서류에서는 빠르게 끝내는 것보다 나중에 헷갈리지 않는 방식이 더 중요해요. 제목을 쉽게 붙이고, 날짜를 남기고, 확인한 사람을 적어 두면 문제가 생겨도 차분히 돌아볼 수 있어요.',
      ]));
    case 'expression_children':
      return withCategoryTail(ctx, pickVariant(ctx, 'sourceExpressionSmallWorks', [
        '표현과 창의에서는 완벽한 결과보다 편하게 꺼내 보는 일이 먼저예요. 짧은 메모, 사진, 대화처럼 부담 없는 방식으로 시작해도 충분해요. 가까운 사람에게 보여 줄지, 나만 볼지 정해 두면 부담도 줄어요.',
        '표현과 창의에서는 처음부터 잘 보이려 하지 않아도 괜찮아요. 떠오른 생각을 짧게 남기고, 나중에 다듬을 부분만 표시해 두면 이어 가기 쉬워요. 믿을 만한 사람에게 가볍게 보여 줄 기준을 정해 두면 더 편해요.',
        '표현과 창의에서는 남에게 멋지게 보이는 것보다 내 생각을 안전하게 꺼내 보는 과정이 중요해요. 작은 기록 하나만 남겨도 다음 표현의 실마리가 생겨요. 나중에 가까운 사람과 나눌 수 있는 한 줄을 남겨 보세요.',
        '표현과 창의에서는 완성된 작품을 바로 만들기보다 마음에 걸린 장면을 하나 붙잡아 보세요. 말, 글, 그림, 아이디어 중 편한 방식 하나면 충분해요. 조언이 필요하면 믿을 만한 사람에게 한 장면만 보여 줘도 돼요.',
        '표현과 창의에서는 잘해야 한다는 부담을 낮추는 편이 좋아요. 먼저 꺼내 보고, 마음에 남는 부분만 천천히 다듬으면 표현이 훨씬 자연스러워져요. 혼자만 붙잡지 말고 편한 사람과 짧게 나누어도 좋아요.',
        '표현과 창의에서는 마음이 움직인 장면을 작게 붙잡는 일이 중요해요. 한 줄, 한 장, 한마디처럼 짧게 남기면 나중에 다시 이어 가기 쉬워요.',
        '표현과 창의에서는 보여 주기 위한 결과보다 내가 무엇을 느꼈는지 알아차리는 과정이 먼저예요. 편한 방식으로 남기고, 더 다듬을 부분은 나중에 표시해도 충분해요.',
        '표현과 창의에서는 생각을 크게 증명하려 하지 않아도 괜찮아요. 오늘 떠오른 말이나 장면을 작게 남기면 다음 작업의 시작점이 생겨요.',
        '표현과 창의에서는 완성보다 반복이 더 오래 힘이 돼요. 매번 잘하려 하기보다 편하게 남길 수 있는 방식을 하나 정해 두면 좋아요.',
      ]));
    case 'health_stress':
      return withCategoryTail(ctx, pickVariant(ctx, 'sourceStressOverall', [
        '긴장과 회복에서는 오래 참는 힘보다 풀어 내는 방법을 먼저 정하는 편이 좋아요. 숨 고르기, 짧은 산책, 편한 대화처럼 몸이 덜 굳는 행동을 하나 골라 보세요.',
        '마음이 무거울 때는 더 버티는 계획보다 긴장을 낮추는 작은 기준이 필요해요. 잠깐 멈추고, 몸을 풀고, 부담스러운 약속을 줄이는 순서가 도움이 돼요.',
        '회복은 큰 휴가처럼 멀리 있는 일이 아니에요. 하루 중 숨을 돌릴 시간 하나를 정하면 마음의 짐이 조금씩 내려갈 수 있어요.',
        '긴장이 쌓일 때는 원인을 한 번에 해결하려 하기보다 몸을 편하게 만드는 행동부터 고르는 편이 좋아요. 물을 마시고 걷고 쉬는 작은 순서가 회복의 시작이에요.',
        '스트레스가 보일 때는 참아 낸 시간보다 다시 편해지는 방법을 기억하는 것이 중요해요. 나에게 맞았던 휴식, 사람, 장소를 하나씩 떠올려 보세요.',
        '마음과 몸이 동시에 무거워질 때는 해야 할 일을 줄이는 기준이 필요해요. 오늘 덜어낼 약속과 계속 지킬 습관을 나누면 회복이 더 현실적으로 보여요.',
      ]));
    case 'movement':
      if (ctx.period === 'life') {
        return withCategoryTail(ctx, pickVariant(ctx, 'categoryGuidance', [
          '이동과 변화에서는 새로운 길과 익숙한 기준을 함께 보는 태도가 필요해요. 달라질 것과 그대로 둘 것을 나누면 마음이 덜 복잡해져요.',
          '이동과 변화에서는 거리보다 생활이 편해지는지를 먼저 보는 편이 현실적이에요. 편했던 길, 함께 확인할 사람, 줄일 피로 중 하나만 골라도 결정이 쉬워져요.',
          '이동과 변화에서는 큰 결정을 한 번에 만들기보다 작은 시험을 먼저 해 보는 편이 좋아요. 가까운 곳, 짧은 시간, 낮은 비용부터 확인하면 더 안전해요.',
          '이동과 변화에서는 빠르게 바꾸기보다 준비물을 확인하는 편이 좋아요. 길, 필요한 물건, 함께 볼 사람을 미리 살피면 마음의 여유가 생겨요.',
          '이동과 변화에서는 머무를 기준과 움직일 기준이 함께 있을 때 부담이 줄어요. 익숙한 사람에게 안부를 남기고, 낯선 일정은 작게 시험해 보세요.',
        ]));
      }
      return withCategoryTail(ctx, pickVariant(ctx, 'categoryGuidance', [
        '이동과 변화에서는 빠르게 바꾸기보다 준비물을 확인하는 편이 좋아요. 길, 필요한 물건, 함께 볼 사람을 미리 살피면 마음의 여유가 생겨요. 혼자 판단하기 애매하면 가까운 사람과 새로 바꿀 일, 지킬 기준, 도움받을 방법을 함께 확인해 보세요.',
        '이동과 변화에서는 어디로 갈지만 보지 말고 돌아올 시간과 쉴 자리도 함께 정해 두면 좋아요. 시작과 마무리가 보이면 변화의 부담이 줄어요.',
        '이동과 변화에서는 큰 결정을 한 번에 만들기보다 작은 시험을 먼저 해 보는 편이 좋아요. 가까운 곳, 짧은 시간, 낮은 비용부터 확인하면 더 안전해요.',
        '이동과 변화에서는 새로운 길과 익숙한 기준을 함께 보는 태도가 필요해요. 달라질 것과 그대로 둘 것을 나누면 마음이 덜 복잡해져요.',
        '이동과 변화에서는 속도보다 준비가 더 중요할 때가 많아요. 필요한 물건, 함께 확인할 사람, 다녀온 뒤 쉴 시간을 미리 두면 선택이 편해져요.',
        '이동과 변화에서는 먼저 움직이는 것보다 다녀온 뒤 지킬 리듬을 세우는 일이 중요할 수 있어요. 출발 시간, 쉴 시간, 함께 볼 사람을 나누면 변화가 더 현실적으로 보여요.',
        '새로운 곳이 끌릴 때도 준비가 작아야 부담이 줄어요. 누구와 확인할지, 무엇을 챙길지, 다녀온 뒤 언제 쉴지를 정하면 마음이 안정돼요.',
        '이동과 변화에서는 큰 결정보다 작은 확인이 먼저예요. 챙길 것과 다녀온 뒤 쉴 시간을 정해도 선택의 무게가 훨씬 줄어요.',
        '움직임이 필요해 보여도 생활 리듬을 함께 봐야 해요. 새로 바꿀 것과 그대로 둘 것을 나누면 직접 움직일 일과 기다려도 되는 일이 더 또렷해져요.',
        '이동과 변화에서는 낯선 자극을 무조건 피하지 않아도 되지만, 생활 리듬을 흔들 만큼 크게 잡을 필요도 없어요. 생활을 덜 흔드는 변화부터 살피면 충분해요.',
        '이동과 변화에서는 바로 움직일 일과 조금 기다려도 되는 일을 나누어 보세요. 급하지 않은 변화는 천천히 잡아도 흐름을 놓치지 않아요.',
        '이동과 변화에서는 거리보다 부담의 크기를 먼저 보는 편이 현실적이에요. 처음 달라질 생활, 함께 확인할 사람, 다녀온 뒤 여유 중 가장 걸리는 한 가지를 확인하면 결정이 쉬워져요.',
      ]));
  }
}

function closingGuidance(ctx: StandardDepthEnhancementContext): string {
  const label = categoryLabel(ctx.category, ctx);
  if (ctx.category === 'expression_children') {
    const scope = periodCategoryPhrase(ctx);
    return pickVariant(ctx, 'sourceExpressionClosing', [
      `마지막으로, 이 해석은 ${withObjectParticle(scope)} 점수처럼 매기려는 글이 아니에요. 마음에 남은 장면을 한 줄, 한 장, 한마디로 남기면 지금 생활에 바로 붙일 수 있어요.`,
      `끝으로, ${withTopicParticle(scope)} 거창한 결과보다 다시 꺼내 볼 수 있는 작은 흔적에서 힘이 생겨요. 오늘 가장 쉽게 남길 수 있는 방식 하나만 골라도 충분해요.`,
      `정리하면, ${withTopicParticle(scope)} 남에게 잘 보이기 위한 숙제가 아니에요. 내 마음에 남은 말과 장면을 작게 보관하면 다음 표현이 훨씬 편해져요.`,
      `덧붙이면, 이 해석은 ${scope}에서 무엇을 더 해야 하는지 몰아붙이려는 글이 아니에요. 부담 없이 이어 갈 크기를 고르면 생활 속에서 더 오래 도움이 돼요.`,
      `덧붙이면, 이 해석은 ${scope}에서 계속할 수 있는 방식을 찾기 위한 안내예요. 완성보다 반복할 수 있는 크기를 고르면 부담이 줄고 표현도 오래 이어져요.`,
      `정리하면, ${withTopicParticle(scope)} 점수만 보는 것보다 실제로 남길 흔적을 고를 때 더 쓸모가 커져요. 이번에는 편하게 꺼낼 수 있는 기록 하나만 남겨도 충분해요.`,
      `끝으로, ${withTopicParticle(scope)} 한 번에 맞히는 답보다 내 생활에 맞게 꺼내 보고 다듬는 과정이에요. 나만 볼 것과 나눌 것을 나누면 훨씬 편해져요.`,
      `마지막으로, 이 해석은 ${scope}에서 잘해야 할 일을 늘리려는 글이 아니에요. 지금 손에 익은 방식으로 마음에 남은 것을 작게 남기면 충분히 도움이 돼요.`,
      `덧붙이면, 이 해석은 ${withObjectParticle(scope)} 더 불안하게 만들기 위한 글이 아니에요. 비교는 잠시 내려놓고, 다시 이어 가고 싶은 방식 하나를 고르면 좋아요.`,
      `정리하면, ${withTopicParticle(scope)} 생활과 함께 읽을 때 더 의미가 커져요. 말, 사진, 메모, 대화 중 지금 가장 편한 방식 하나로 옮겨 보세요.`,
      `끝으로, ${withTopicParticle(scope)} 한 번에 맞히는 답보다 오래 남는 작은 흔적에서 힘이 생겨요. 지금 떠오른 장면 하나만 붙잡아도 다음 표현이 쉬워져요.`,
      `정리하면, ${withTopicParticle(scope)} 크게 완성해야만 의미가 생기는 영역이 아니에요. 지금 떠오른 장면을 작게 남기고, 나중에 다시 볼 수 있게 두면 충분해요.`,
      `끝으로, ${withTopicParticle(scope)} 잘 보이기 위한 결과보다 다시 이어 갈 실마리가 중요해요. 한 줄이나 한 장면만 남겨도 다음 표현이 훨씬 쉬워져요.`,
      `덧붙이면, ${withTopicParticle(scope)} 오늘의 기분을 안전하게 보관하는 방식으로 읽어도 좋아요. 말, 사진, 메모 중 편한 하나를 고르면 부담이 줄어요.`,
      `마지막으로, 이 해석은 ${scope}에서 내 마음을 살피는 참고 자료예요. 남에게 보여 줄 기준과 나를 위해 남길 기준을 나누면 표현의 긴장이 줄어요.`,
      `정리하면, ${withTopicParticle(scope)} 생활에 맞는 조절점을 찾는 과정이에요. 지금 계속하고 싶은 작은 방식 하나를 남기면 읽은 내용이 생활 안에서 살아나요.`,
      `마지막으로, 이 해석은 ${withObjectParticle(scope)} 더 크게 증명하라는 말이 아니에요. 오늘의 기분을 작게 남기고, 나중에 다시 볼 수 있게 두면 충분해요.`,
      `덧붙이면, 이 해석은 ${scope}에서 표현의 방향을 좁혀 주는 참고표예요. 보여 줄 것, 간직할 것, 나중에 다듬을 것을 나누면 마음이 편해져요.`,
      `정리하면, ${withTopicParticle(scope)} 점수만 보는 것보다 실제 손에 남는 방식이 중요해요. 글, 그림, 사진, 말 중 가장 쉬운 하나를 고르면 좋아요.`,
      `끝으로, ${withTopicParticle(scope)} 한 번에 맞히는 답보다 다시 꺼내 볼 수 있는 흔적을 남기는 일이 더 오래 도움이 돼요. 작은 메모 하나도 충분해요.`,
      `마지막으로, 이 해석은 ${scope}에서 남의 평가를 먼저 보라는 뜻이 아니에요. 내가 편하게 다시 볼 수 있는 방식부터 고르면 표현이 덜 무거워져요.`,
      `덧붙이면, 이 해석은 ${withObjectParticle(scope)} 생활 속에서 다시 확인하기 위한 안내예요. 마음이 움직인 장면 하나를 남기면 다음 선택이 쉬워져요.`,
      `정리하면, ${withTopicParticle(scope)} 생활과 함께 읽을 때 가장 쓸모가 커져요. 완성할 일보다 계속 이어 갈 작은 방식을 먼저 남겨 보세요.`,
      `끝으로, ${withTopicParticle(scope)} 한 번에 맞히는 답보다 내 속도에 맞게 남기고 고쳐 가는 기준이에요. 작게 시작해야 오래 이어져요.`,
      `마지막으로, 이 해석은 ${scope}에서 마음에 남은 것을 알아차리게 돕는 글이에요. 색, 말, 장면 중 하나만 골라도 표현의 시작점이 생겨요.`,
      `덧붙이면, 이 해석은 ${withObjectParticle(scope)} 더 잘 살피기 위한 안내예요. 오늘 바로 나눌 말과 혼자 간직할 말을 나누면 부담이 줄어요.`,
      `정리하면, ${withTopicParticle(scope)} 점수만 보는 것보다 나에게 맞는 도구를 고를 때 도움이 커져요. 익숙한 방식 하나로 옮겨 보면 충분해요.`,
      `끝으로, ${withTopicParticle(scope)} 한 번에 맞히는 답보다 오래 반복할 수 있는 즐거움을 찾는 과정이에요. 작게 남긴 흔적이 다음 표현을 열어 줘요.`,
      `마지막으로, 이 해석은 ${scope}에서 결과물을 판정하려는 글이 아니에요. 지금 남길 수 있는 조각 하나와 나중에 다듬을 조각 하나를 나누면 좋아요.`,
      `덧붙이면, 이 해석은 ${withObjectParticle(scope)} 더 불안하게 만들기 위한 글이 아니에요. 잘해야 한다는 마음을 낮추고, 계속할 수 있는 크기만 남겨 보세요.`,
      `덧붙이면, 이 해석은 ${withObjectParticle(scope)} 평가하려는 글이 아니에요. 오늘 남길 수 있는 작은 흔적 하나를 고르면 표현이 훨씬 편해져요.`,
      `정리하면, ${withTopicParticle(scope)} 잘해야 한다는 마음이 커질수록 크기를 줄여 보는 편이 좋아요. 한 줄, 한 장, 한마디처럼 작게 남겨도 충분히 의미가 있어요.`,
      `끝으로, ${withTopicParticle(scope)} 완성보다 다시 이어 갈 수 있는 실마리가 더 중요해요. 다음에 꺼낼 말 하나만 남겨도 표현은 끊기지 않아요.`,
      `덧붙이면, 이 해석은 ${scope}에서 남과 비교하라는 뜻이 아니에요. 내가 편하게 계속할 방식 하나를 찾으면 표현의 부담이 줄어들어요.`,
      `정리하면, ${withTopicParticle(scope)} 생활에 맞는 조절점을 찾을 때 더 편하게 읽혀요. 오늘의 말 한 줄이나 사진 한 장을 작은 기준으로 삼아도 좋아요.`,
      `끝으로, ${withTopicParticle(scope)} 한 번에 맞히는 답보다 나중에 다시 이어 갈 실마리를 남기는 일이 중요해요. 끝내지 못해도 다음 시작점이 있으면 충분해요.`,
    ]);
  }
  if (ctx.category === 'overall') {
    return pickVariant(ctx, 'sourceOverallClosing', [
      '마지막으로, 이 해석은 전체 생활을 한 번에 결론 내리려는 답이 아니에요. 지금 덜 무리할 선택과 계속 가져갈 습관을 나누어 보는 참고 자료로 쓰면 좋아요.',
      '마지막으로, 이 해석은 전체 생활에서 무엇을 더 편하게 만들 수 있는지 살피는 안내예요. 큰 결정보다 덜 무리하는 기준 하나가 더 오래 도움이 될 수 있어요.',
      '덧붙이면, 전체 생활은 부담을 낮추고 지킬 기준을 고르는 데 도움이 되는 안내예요. 먼저 줄일 부담 하나와 계속 가져갈 습관 하나를 나누면 충분해요.',
      '마지막으로, 전체 생활은 모든 조언을 한꺼번에 실천하라는 뜻이 아니에요. 지금 덜 무거워지는 선택 하나와 그대로 지켜도 좋은 습관 하나를 고르면 돼요.',
      '정리하면, 전체 생활은 내 생활에 맞는 작은 기준을 찾을 때 가장 쓸모가 커져요. 먼저 덜어낼 부담과 계속 지킬 습관을 한 가지씩만 남겨 보세요.',
      '끝으로, 전체 생활은 큰 결론보다 오래 편해지는 순서를 찾는 글이에요. 몸, 관계, 일의 리듬 중 하나만 가볍게 조정해도 읽은 내용이 실제 도움이 돼요.',
      '덧붙이면, 전체 생활은 나를 몰아붙이는 답이 아니라 부담을 나누어 보는 안내예요. 지금 할 수 있는 조정 하나와 유지할 기준 하나면 충분해요.',
      '정리하면, 전체 생활은 큰 결론보다 지금 덜 무거워지는 선택을 찾을 때 도움이 커져요. 가장 쉬운 조정 기준 하나만 생활에서 확인해 보세요.',
      '정리하면, 전체 생활은 점수만 보는 것보다 반복해서 가벼워질 지점을 찾을 때 더 쓸모가 커져요. 약속, 휴식, 정리 중 하나에만 붙여도 충분해요.',
      '끝으로, 전체 생활은 한 번에 맞히는 답보다 여러 날에 걸쳐 맞춰 보는 기준이에요. 지금 편한 선택과 나중에 다시 볼 선택을 나누면 읽은 내용이 덜 무거워져요.',
      '마지막으로, 전체 생활은 큰 사건보다 반복되는 선택 속에서 더 분명해져요. 먼저 줄일 부담 하나와 계속 지킬 습관 하나를 같이 두면 방향이 현실적으로 남아요.',
      '덧붙이면, 이 해석은 전체 생활에서 모든 답을 한 번에 정하는 글이 아니에요. 지금의 몸 상태와 일정에 맞는 조언 하나만 골라도 충분히 도움이 돼요.',
      '정리하면, 전체 생활은 생활과 함께 읽을 때 가장 편해져요. 마음에 걸리는 말은 잠시 접어 두고, 바로 해 볼 수 있는 선택 하나부터 옮겨 보세요.',
      '끝으로, 전체 생활은 모든 답을 한 번에 정하는 글이 아니에요. 지금 편해지는 기준 하나와 나중에 다시 볼 기준 하나만 나누면 충분해요.',
      '마지막으로, 이 해석은 전체 생활을 완벽히 맞히는 답안이 아니라 내 생활을 돌아보는 메모예요. 맞는 부분은 가볍게 적용하고, 애매한 부분은 다음에 다시 확인해도 괜찮아요.',
      '마지막으로, 이 해석은 전체 생활을 단정하는 결론이 아니라 생활을 살피는 안내예요. 지금의 상황과 내 컨디션을 함께 보며 부담 없는 쪽으로 조절해 보세요.',
      '끝으로, 전체 생활은 한 번에 맞히는 답보다 매일 조금씩 조절해 가는 기준에 가까워요. 지금 바로 쓸 수 있는 말 하나만 남겨도 충분해요.',
      '끝으로, 전체 생활은 한 번에 맞히는 답보다 내 생활에 맞게 덜어 내고 남기는 과정이에요. 마음이 가는 조언 하나부터 작게 써 보세요.',
      '마지막으로, 이 해석은 전체 생활을 더 무겁게 만들기 위한 글이 아니에요. 지금 유지할 것과 잠시 내려놓을 것을 나누면 읽은 내용이 훨씬 현실적으로 남아요.',
      '덧붙이면, 이 해석은 전체 생활에서 지금 바로 쓸 기준과 시간이 지나 다시 볼 기준을 가르는 안내예요. 바로 맞지 않는 내용은 잠시 접어 두어도 충분해요.',
      '정리하면, 전체 생활은 생활과 함께 읽을 때 더 선명해져요. 당장 바꿀 일 하나와 그대로 두어도 되는 일 하나를 나누면 부담이 줄어요.',
      '끝으로, 전체 생활은 한 번에 맞히는 답보다 내 속도에 맞게 고쳐 읽는 기준이에요. 지금 몸 상태와 일정에 맞는 조언 하나만 남겨 보세요.',
      '마지막으로, 이 해석은 전체 생활을 점검하는 작은 지도에 가까워요. 모든 길을 한 번에 따라가기보다 지금 가장 안전한 길 하나부터 확인하면 좋아요.',
      '덧붙이면, 이 해석은 전체 생활을 단번에 바꾸라는 뜻이 아니에요. 이미 잘되는 부분은 지키고, 부담되는 부분만 작게 덜어 내면 충분해요.',
      '정리하면, 전체 생활은 점수보다 실제 조절이 중요해요. 마음에 남은 문장을 이번에 정할 약속, 휴식, 정리 중 하나로 옮겨 보면 도움이 커져요.',
      '덧붙이면, 이 해석은 전체 생활을 더 잘 살피기 위한 안내예요. 맞는 문장은 생활에서 작게 확인하고, 아직 애매한 문장은 다음 점검 때 다시 보면 좋아요.',
      '덧붙이면, 이 해석은 전체 생활의 방향을 넓게 보는 참고 자료예요. 지금 할 수 있는 작은 선택과 나중에 다시 볼 조언을 나누면 읽는 부담이 줄어요.',
      '정리하면, 전체 생활은 생활과 함께 읽을 때 가장 쓸모가 커져요. 무리해서 전부 바꾸기보다 지금 덜 복잡해지는 선택 하나를 남겨 보세요.',
      '정리하면, 전체 생활은 점수만 보는 것보다 실제 생활에서 확인할 때 도움이 커져요. 바로 할 수 있는 행동 하나를 고르면 마음도 가벼워져요.',
      '정리하면, 전체 생활은 몸과 마음, 일정, 관계를 함께 놓고 볼 때 더 편하게 읽혀요. 부담되는 말은 덜어 두고 실천 가능한 것부터 남겨 보세요.',
      '정리하면, 전체 생활은 생활에 맞는 조절점을 찾기 위한 안내예요. 맞는 말은 작게 써 보고, 부담되는 말은 다음에 다시 확인해도 괜찮아요.',
      '마지막으로, 이 해석은 전체 생활의 좋고 나쁨을 판정하기보다 다음 선택을 조금 쉽게 만들기 위한 글이에요. 지금 가장 부담 없는 행동 하나만 정해 보세요.',
      '덧붙이면, 이 해석은 전체 생활을 한 번에 평가하려는 글이 아니에요. 오늘 덜 무리할 일과 그대로 지켜도 좋은 일을 하나씩 나누면 충분해요.',
      '정리하면, 전체 생활은 내 생활에 맞춰 읽을 때 가장 쓸모가 커져요. 마음에 남은 말을 휴식, 관계, 정리 중 하나로 작게 남겨 보세요.',
      '끝으로, 전체 생활은 긴 결론보다 다시 확인할 기준을 남기는 일이 중요해요. 오늘은 가장 편해지는 선택 하나와 나중에 볼 기준 하나만 구분해도 좋아요.',
      '마지막으로, 이 해석은 생활을 더 복잡하게 만들기 위한 글이 아니에요. 이미 안정된 부분은 지키고, 부담이 큰 부분만 작은 행동으로 줄여 보세요.',
      '정리하면, 전체 생활은 몸 상태와 관계, 일정을 함께 놓고 볼 때 더 편하게 읽혀요. 마음에 남은 한 문장을 오늘의 약속이나 휴식 하나에 붙여 보면 훨씬 가볍게 남아요.',
      '끝으로, 전체 생활은 한 번에 맞히는 답보다 반복해서 나에게 맞춰 보는 기준이에요. 지금 잘 맞는 부분은 유지하고, 맞지 않는 말은 천천히 다시 보면 돼요.',
      '마지막으로, 전체 생활은 오늘 한 번에 결론을 내리는 글이 아니에요. 지금 내 상황에 맞는 조언은 가볍게 쓰고, 아직 이른 말은 다음에 다시 보면 충분해요.',
      '덧붙이면, 전체 생활은 여러 문장을 모두 같은 무게로 들라는 뜻이 아니에요. 당장 도움이 되는 기준과 나중에 볼 기준을 나누면 읽는 부담이 줄어들어요.',
      '정리하면, 전체 생활은 내 생활에 맞춰 조금씩 고쳐 읽을 때 더 오래 도움이 돼요. 오늘은 가장 현실적인 한 가지 행동만 남겨 보세요.',
      '덧붙이면, 이 해석은 전체 생활에서 힘을 줄 곳과 쉬어 갈 곳을 구분하는 데 도움이 돼요. 한 문장만 실제 일정에 붙여 보아도 충분히 쓸모가 생겨요.',
      '정리하면, 전체 생활은 생활과 함께 읽을 때 더 의미가 커져요. 큰 결론보다 지금 편해지는 작은 조정부터 시작해 보세요.',
      '마지막으로, 이 해석은 전체 생활을 정답처럼 외우라는 뜻이 아니에요. 오늘의 몸 상태, 관계, 일정에 맞게 한 가지씩 골라 쓰면 충분해요.',
      '끝으로, 전체 생활은 모든 조언을 한꺼번에 해내라는 말이 아니에요. 오늘 가장 덜 무리한 선택 하나만 골라도 읽은 내용은 충분히 쓸모가 생겨요.',
      '정리하면, 전체 생활은 내 하루에 맞게 덜어 내고 남기는 기준이에요. 몸 상태, 사람과의 약속, 해야 할 일을 하나씩 나누면 부담이 줄어요.',
      '마지막으로, 이 해석은 전체 생활을 한 번에 정리하라는 뜻이 아니에요. 오늘 지킬 것 하나와 잠시 내려놓을 것 하나만 나누어도 충분히 현실적인 기준이 돼요.',
      '끝으로, 전체 생활은 한 번에 맞히는 답보다 내 상황에 맞게 줄여 쓰는 기준이에요. 지금 편해지는 선택 하나를 고르면 나머지는 천천히 다시 봐도 괜찮아요.',
      '정리하면, 전체 생활은 생활과 함께 읽을 때 더 도움이 돼요. 몸, 관계, 일정 중 지금 부담이 가장 큰 부분 하나만 작게 덜어 보세요.',
      '덧붙이면, 이 해석은 전체 생활을 더 복잡하게 만들기 위한 글이 아니에요. 지금 맞는 기준과 나중에 다시 볼 기준을 나누면 읽는 부담이 줄어요.',
      '마지막으로, 전체 생활은 큰 결론보다 오늘의 선택을 조금 편하게 만드는 안내예요. 가장 쉬운 행동 하나만 남겨도 읽은 내용은 충분히 쓸모가 있어요.',
      '덧붙이면, 이 해석은 전체 생활을 더 잘 돌보기 위한 안내예요. 지금 맞는 기준과 나중에 다시 볼 기준을 나누어 두면 훨씬 편하게 남아요.',
      '마지막으로, 전체 생활은 단번에 바꾸는 숙제가 아니에요. 지금 유지할 습관 하나와 잠시 줄일 부담 하나만 고르면 다음 선택이 더 쉬워져요.',
      '끝으로, 전체 생활은 오늘의 컨디션과 일정에 맞춰 작게 써 볼 때 가장 도움이 돼요. 마음에 남은 한 문장만 실제 행동으로 옮겨도 충분해요.',
      '끝으로, 전체 생활은 크게 맞고 틀리는 문제가 아니라 내 생활에 맞춰 조절하는 기준이에요. 지금 편해지는 선택 하나와 나중에 다시 볼 기준 하나만 나누어 보세요.',
      '덧붙이면, 이 해석은 전체 생활을 더 불안하게 만들기 위한 글이 아니에요. 이미 괜찮은 부분은 그대로 두고, 부담이 큰 부분만 작게 다루면 좋아요.',
      '정리하면, 전체 생활은 여러 조언을 한꺼번에 실천할 때보다 하나를 제대로 고를 때 더 도움이 돼요. 지금 가장 덜 무리한 행동부터 남겨 보세요.',
      '마지막으로, 전체 생활은 오늘 확인할 약속, 휴식, 정리 중 하나와 연결할 때 더 현실적으로 남아요. 작게 이어질 기준 하나만 골라도 충분해요.',
      '끝으로, 전체 생활은 오래 두고 다시 읽을수록 내 상황에 맞는 부분이 더 잘 보여요. 오늘은 바로 쓸 말 하나만 남기고 나머지는 가볍게 지나가도 괜찮아요.',
      '마지막으로, 전체 생활은 한 번 읽고 끝내기보다 필요할 때 다시 꺼내 볼수록 더 현실적으로 다가와요. 지금은 가장 덜 부담스러운 행동 하나만 골라도 충분해요.',
      '덧붙이면, 전체 생활은 좋은 말만 모으는 글이 아니라 내 하루에 맞는 기준을 고르는 글이에요. 바로 해 볼 일과 나중에 볼 일을 나누면 훨씬 편하게 남아요.',
      '정리하면, 전체 생활은 지금의 나를 몰아붙이기 위한 답이 아니에요. 이미 지키고 있는 기준 하나와 줄여도 되는 부담 하나를 나누어 보세요.',
      '끝으로, 전체 생활은 여러 문장을 모두 적용할 때보다 내 상황에 맞는 한 문장을 고를 때 더 쓸모가 커져요. 오늘은 그 한 문장을 작게 시험해 보세요.',
      '마지막으로, 전체 생활은 시간이 지나며 의미가 달라질 수 있어요. 오늘 맞는 말은 가볍게 쓰고, 아직 이른 말은 표시만 해 두어도 충분해요.',
      '덧붙이면, 이 해석은 전체 생활에서 무리하지 않을 순서를 찾는 데 쓰면 좋아요. 힘을 줄 일과 잠시 내려놓을 일을 나누면 다음 선택이 더 쉬워져요.',
      '정리하면, 전체 생활은 큰 사건보다 반복되는 선택 속에서 더 또렷해져요. 작은 습관 하나를 지키거나 부담 하나를 줄이는 식으로 천천히 적용해 보세요.',
    ]);
  }
  if (ctx.category === 'romance') {
    const relationLabel = isMinorReader(ctx) && !isFutureAdultLifeForMinorReader(ctx) ? '친구 관계' : '관계와 마음';
    const relationAction = isMinorReader(ctx) && !isFutureAdultLifeForMinorReader(ctx) ? '답장 속도, 말투, 같이 보낼 시간' : '답장 속도, 만남의 간격, 말투';
    return pickVariant(ctx, 'sourceRomanceClosing', [
      `정리하면, ${withTopicParticle(relationLabel)} 한 번의 말보다 반복되는 태도에서 안정감을 얻어요. ${relationAction} 중 하나만 작게 정해도 다음 대화가 덜 흔들려요.`,
      `끝으로, ${relationLabel}에서는 마음이 커질수록 속도를 조금 낮춰 보는 편이 좋아요. 바로 확인할 말과 천천히 지켜볼 마음을 나누면 관계가 더 편안해져요.`,
      `덧붙이면, ${withTopicParticle(relationLabel)} 좋은 말만 많이 하는 것보다 부담을 덜 주는 방식이 오래 남아요. 짧은 안부, 늦지 않는 약속, 기다려 주는 태도 중 하나를 먼저 살려 보세요.`,
      `마지막으로, ${relationLabel}에서는 상대를 바꾸려 하기보다 내가 반복하는 반응을 살피는 일이 도움이 돼요. 급해지는 말투 하나만 줄여도 다음 만남의 분위기가 부드러워져요.`,
      `정리하면, ${withTopicParticle(relationLabel)} 설렘이나 기대만으로 판단하기보다 생활 속에서 편안하게 이어지는지를 보는 주제예요. 다음 연락에서는 말투와 시간을 작게 정해 두면 마음이 덜 급해져요.`,
      `끝으로, ${withTopicParticle(relationLabel)} 빨리 결론을 내릴수록 오히려 부담이 커질 수 있어요. 오늘은 마음을 전할 말 하나와 아직 기다려도 되는 말 하나만 나누어 보세요.`,
      `덧붙이면, ${relationLabel}에서 가장 실용적인 기준은 서로가 편해지는 장면을 늘리는 거예요. 고맙다는 말, 약속을 지키는 태도, 편한 거리감 중 하나만 다시 써 보세요.`,
      `마지막으로, ${withTopicParticle(relationLabel)} 잘 맞는 사람을 맞히는 시험이 아니에요. 대화 뒤에 마음이 가벼웠는지, 부담이 커졌는지 살피면 다음 선택이 더 현실적으로 보여요.`,
      `정리하면, ${relationLabel}에서는 마음이 앞설 때일수록 확인할 사실과 상상한 이야기를 나누는 편이 좋아요. 둘을 구분하면 서운함도 덜 커지고 말도 부드러워져요.`,
      `끝으로, ${withTopicParticle(relationLabel)} 작은 배려가 반복될 때 신뢰가 쌓여요. 다음에는 오래 설명하기보다 지킬 수 있는 약속 하나와 편한 말투 하나를 남겨 보세요.`,
      `덧붙이면, ${withTopicParticle(relationLabel)} 내 마음만큼 상대의 하루도 함께 봐야 편해져요. 연락 시간, 답장 속도, 만남의 간격 중 하나를 조심스럽게 맞춰 보세요.`,
      `마지막으로, ${relationLabel}에서는 좋은 흐름도 너무 크게 해석하지 않는 편이 안전해요. 편했던 장면을 하나 기억하고, 다음에도 그 크기로 이어 가면 충분해요.`,
      `정리하면, ${withTopicParticle(relationLabel)} 불편함을 숨기거나 급하게 터뜨리는 것보다 작게 말할 길을 찾을 때 좋아져요. 차분한 한마디를 미리 준비해 두면 다음 대화가 덜 어려워져요.`,
      `끝으로, ${withTopicParticle(relationLabel)} 같은 말도 때와 분위기에 따라 다르게 들릴 수 있어요. 꼭 할 말은 짧게 남기고, 감정이 높은 말은 조금 늦춰도 괜찮아요.`,
      `덧붙이면, ${withTopicParticle(relationLabel)} 혼자 결론을 정하는 글이 아니라 다음 대화를 조금 편하게 만드는 참고표예요. 지금은 확인할 질문 하나와 기다릴 마음 하나만 남겨 보세요.`,
      `정리하면, ${relationLabel}에서는 마음이 잘 통했던 순간을 크게 붙잡기보다 다시 만들 수 있는 조건을 보는 편이 좋아요. 시간, 말투, 약속의 크기 중 하나만 기억해도 다음 선택이 쉬워져요.`,
      `끝으로, ${withTopicParticle(relationLabel)} 가까워지는 속도보다 서로 편해지는 방식이 더 중요할 때가 있어요. 오늘은 먼저 다가갈 말과 그대로 두어도 되는 말을 나누어 보세요.`,
      `덧붙이면, ${relationLabel}에서 좋은 신호가 보여도 모든 것을 바로 확인할 필요는 없어요. 짧은 안부 하나와 다음에 볼 기준 하나를 남기면 관계가 덜 무거워져요.`,
      `마지막으로, ${withTopicParticle(relationLabel)} 감정의 크기보다 그 감정이 생활을 편하게 하는지가 중요해요. 대화 뒤에 잠이 편했는지, 마음이 급해졌는지만 봐도 기준이 생겨요.`,
      `정리하면, ${relationLabel}에서는 상대의 반응을 맞히려 하기보다 내가 안전하게 말할 방식을 찾는 일이 먼저예요. 부탁, 감사, 기다림 중 하나로 줄이면 훨씬 말하기 쉬워져요.`,
      `끝으로, ${withTopicParticle(relationLabel)} 오늘의 분위기 하나로 전부 판단하지 않아도 돼요. 며칠 동안 편했던 말투와 불편했던 장면을 나누면 방향이 더 또렷해져요.`,
      `덧붙이면, ${relationLabel}에서는 좋은 관계일수록 부담 없는 반복이 중요해요. 너무 큰 약속보다 지킬 수 있는 연락, 늦지 않는 답, 편한 만남을 먼저 살려 보세요.`,
      `마지막으로, ${withTopicParticle(relationLabel)} 마음을 증명하는 시험이 아니에요. 내가 무리하지 않는 선에서 따뜻하게 이어 갈 방법 하나만 정해도 충분해요.`,
      `정리하면, ${relationLabel}에서는 서운함이 생겼을 때 바로 결론 내리기보다 확인할 말을 작게 만드는 편이 좋아요. 짧게 물어볼 수 있으면 관계도 덜 날카로워져요.`,
      `끝으로, ${withTopicParticle(relationLabel)} 말하지 않아도 되는 감정까지 모두 꺼내야 하는 주제가 아니에요. 지금 나눌 마음과 조용히 지켜볼 마음을 구분해 보세요.`,
      `덧붙이면, ${relationLabel}에서는 편한 거리감이 보일 때 관계가 오래 안정돼요. 가까워질 때와 쉬어 갈 때를 함께 인정하면 마음이 덜 조급해져요.`,
      `마지막으로, ${withTopicParticle(relationLabel)} 한 번의 설렘보다 다시 편하게 만날 수 있는지가 더 오래 남아요. 다음 약속의 크기를 작게 잡으면 부담 없이 이어 가기 좋아요.`,
      `정리하면, ${relationLabel}에서는 상대가 어떻게 생각할지 오래 추측하기보다 확인 가능한 말 하나를 고르는 편이 좋아요. 짧고 부드러운 질문이 있으면 마음이 덜 앞서가요.`,
      `끝으로, ${withTopicParticle(relationLabel)} 급하게 가까워지는 것보다 편안하게 반복되는 장면이 더 오래 남아요. 안부, 약속 시간, 답장의 온도 중 하나만 살려 보세요.`,
      `덧붙이면, ${relationLabel}에서는 서운함을 크게 설명하기 전에 내가 원하는 것을 작게 말해 보는 편이 좋아요. 부탁의 크기가 작아지면 상대도 덜 방어적으로 들을 수 있어요.`,
      `마지막으로, ${withTopicParticle(relationLabel)} 좋은 관계를 맞히는 문제라기보다 서로 덜 부담스러운 방식을 찾는 과정이에요. 오늘 편했던 거리감을 다음에도 작게 이어 보세요.`,
      `정리하면, ${relationLabel}에서는 마음이 급해질 때 사실과 느낌을 나누어 보는 일이 도움이 돼요. 확인한 사실이 적으면 결론도 조금 늦춰도 괜찮아요.`,
      `끝으로, ${withTopicParticle(relationLabel)} 편한 말투를 찾는 것만으로도 충분히 실용적인 조언이 돼요. 다음 대화에서는 길게 설명하기보다 먼저 들을 시간을 남겨 보세요.`,
      `덧붙이면, ${relationLabel}에서는 좋은 순간을 크게 해석하기보다 그 순간이 편했던 이유를 보는 편이 좋아요. 장소, 시간, 말투 중 하나만 보여도 다음 기준이 생겨요.`,
      `마지막으로, ${withTopicParticle(relationLabel)} 내가 계속 참아야 좋은 관계가 되는 것은 아니에요. 말할 수 있는 부탁과 기다릴 수 있는 마음을 나누면 훨씬 안전해져요.`,
      `정리하면, ${relationLabel}에서는 상대를 설득하기보다 서로 편해지는 조건을 찾는 일이 먼저예요. 너무 큰 결론 대신 다음 연락에서 지킬 말투 하나를 정해 보세요.`,
      `끝으로, ${withTopicParticle(relationLabel)} 혼자 만든 결론이 커질수록 실제 대화는 작게 시작하는 편이 좋아요. 한 문장으로 물어볼 수 있으면 관계가 덜 무거워져요.`,
      `덧붙이면, ${relationLabel}에서는 불편한 마음도 다룰 순서가 필요해요. 바로 꺼낼 말, 조금 식힌 뒤 말할 것, 그냥 지나가도 되는 것을 나누어 보세요.`,
      `마지막으로, ${withTopicParticle(relationLabel)} 상대의 하루와 내 하루가 모두 있는 주제예요. 내 속도만 보지 말고 상대가 편히 답할 시간도 함께 남겨 보세요.`,
    ]);
  }
  return pickVariant(ctx, 'closing', [
    `마지막으로, 이 해석은 ${label}의 방향을 잡는 참고 자료예요. 실제 일정, 몸 상태, 주변 사람의 반응을 함께 보면서 조절하면 더 현실적으로 도움이 돼요.`,
    `마지막으로, 이 해석은 ${withObjectParticle(label)} 단정하는 결론이 아니라 생활을 살피는 안내예요. 지금의 상황과 내 컨디션을 함께 보며 부담 없는 쪽으로 조절해 보세요.`,
    `마지막으로, 이 해석은 ${label}에서 무엇을 먼저 볼지 정리해 주는 참고 자료예요. 실제 선택은 지금의 일정, 몸 상태, 주변 분위기를 함께 살피며 정하면 좋아요.`,
    `끝으로, ${withTopicParticle(label)} 한 번에 맞히는 답보다 생활 속에서 조절해 가는 기준에 가까워요. 지금 내 상황에 맞는 부분만 골라 써도 충분해요.`,
    `덧붙이면, ${withTopicParticle(label)} 전부 적용하기보다 지금 확인할 기준 하나를 좁힐 때 더 도움이 돼요. 바로 해 볼 일과 조금 지켜볼 일을 나누어 보세요.`,
    `정리하면, ${withTopicParticle(label)} 생활과 함께 읽을 때 더 의미가 커져요. 무리한 결론보다 부담 없는 조정부터 시작해 보세요.`,
    `마지막으로, 이 해석은 ${withObjectParticle(label)} 완벽히 맞히는 답안이 아니라 내 생활을 돌아보는 메모예요. 맞는 부분은 가볍게 적용하고, 애매한 부분은 다음에 다시 확인해도 괜찮아요.`,
    `마지막으로, 이 해석은 ${label}에서 내가 무엇을 더 편하게 만들 수 있는지 살피는 안내예요. 큰 결정보다 지금 덜 무리하는 선택 하나가 더 오래 도움이 될 수 있어요.`,
    `덧붙이면, 이 해석은 ${label}에서 부담을 조금 낮출 방법을 찾는 안내예요. 오늘 바로 줄일 일 하나와 계속 지킬 습관 하나만 골라도 충분해요.`,
    `정리하면, ${withTopicParticle(label)} 큰 결론보다 지금 덜 무거워지는 선택을 찾을 때 도움이 커져요. 가장 쉬운 조정 하나부터 생활에 붙여 보세요.`,
    `끝으로, ${withTopicParticle(label)} 모든 답을 한 번에 정하는 글이 아니에요. 지금 편해지는 기준 하나와 나중에 다시 볼 기준 하나만 나누면 충분해요.`,
    `끝으로, ${withTopicParticle(label)} 한 번에 맞히는 답보다 여러 날에 걸쳐 확인하는 기준에 가까워요. 지금 바로 맞는 말만 골라 생활 속에서 작게 시험해 보세요.`,
    `덧붙이면, 이 해석은 ${withObjectParticle(label)} 생활 속에서 다시 확인할 수 있는 안내예요. 처음에는 한 문장만 기억해도 충분하고, 필요할 때 천천히 다시 읽어도 좋아요.`,
    closingBalancedContextGuidance(ctx),
    `정리하면, ${withTopicParticle(label)} 생활과 함께 읽을 때 가장 쓸모가 커지는 안내예요. 지금 옮길 작은 행동 하나만 고르면 충분해요.`,
    `정리하면, ${withTopicParticle(label)} 생활에 맞는 조절점을 찾기 위한 안내예요. 맞는 말은 작게 써 보고, 부담되는 말은 다음에 다시 확인해도 괜찮아요.`,
    `정리하면, ${withTopicParticle(label)} 점수만 보는 것보다 실제 생활에서 확인할 때 도움이 커져요. 지금 가능한 선택 하나만 남기면 읽는 부담이 줄어요.`,
    `정리하면, ${withTopicParticle(label)} 좋고 나쁨을 급하게 정하는 내용이 아니라 생활에 맞는 조절점을 찾는 과정이에요. 지금의 나에게 맞는 작은 선택 하나만 남겨 보세요.`,
    `마지막으로, 이 해석은 ${label}에서 당장 전부 바꾸라는 말이 아니에요. 이미 맞는 부분은 남기고, 부담되는 부분만 작게 조정하면 충분해요.`,
    `덧붙이면, 이 해석은 ${withObjectParticle(label)} 생활 속에서 다시 확인할 수 있게 돕는 안내예요. 오늘 맞는 기준과 나중에 다시 볼 기준을 나누면 부담이 줄어요.`,
    `정리하면, ${withTopicParticle(label)} 점수만 보는 것보다 실제 행동으로 줄여 볼 때 도움이 커져요. 지금 가장 쉬운 선택 하나부터 남겨 보세요.`,
    `끝으로, ${withTopicParticle(label)} 한 번에 맞히는 답보다 여러 번 맞춰 보는 기준에 가까워요. 이번에 맞는 부분만 작게 써 보아도 충분해요.`,
    `마지막으로, 이 해석은 ${label}에서 불안을 키우려는 글이 아니에요. 확인할 것과 내려놓을 것을 나누면 읽은 내용이 더 편하게 남아요.`,
    `${withTopicParticle(label)} 지금 살필 부분과 나중에 다시 볼 부분을 나누어 읽을 때 더 편해요. 오늘 필요한 기준 하나만 남기면 충분해요.`,
    `정리하면, ${withTopicParticle(label)} 생활과 함께 읽을 때 가장 현실적으로 도움이 돼요. 지금 확인할 일정, 대화, 정리 중 하나를 골라 연결해 보세요.`,
    `끝으로, ${withTopicParticle(label)} 한 번에 맞히는 답보다 내 상황에 맞게 덜어 내고 남기는 과정이에요. 작게 고른 조언이 오래 가요.`,
    `마지막으로, 이 해석은 ${label}에서 완벽한 결론을 요구하지 않아요. 오늘 필요한 기준 하나만 남기고 나머지는 다음에 다시 봐도 괜찮아요.`,
    `덧붙이면, 이 해석은 ${withObjectParticle(label)} 생활에 맞게 고쳐 읽기 위한 안내예요. 그대로 맞는 말과 조심해서 볼 말을 나누면 더 실용적이에요.`,
    `정리하면, ${withTopicParticle(label)} 생활에 맞는 조절점을 찾기 위한 과정이에요. 한꺼번에 적용하기보다 지금 덜 무리한 행동 하나를 고르면 좋아요.`,
    `끝으로, ${withTopicParticle(label)} 한 번에 맞히는 답보다 다시 읽을수록 내 기준이 선명해지는 과정이에요. 지금 가장 부담 없는 기준 하나만 남겨 보세요.`,
    `마지막으로, 이 해석은 ${withObjectParticle(label)} 한 번에 결론 내리려는 글이 아니에요. 지금 필요한 기준 하나만 골라 오늘 생활에서 확인해 보세요.`,
    `덧붙이면, 이 해석은 ${withObjectParticle(label)} 한 번에 결론 내리기보다 천천히 확인하게 돕는 안내예요. 오늘 맞는 부분과 나중에 볼 부분을 나누어 보세요.`,
    `정리하면, ${withTopicParticle(label)} 생활 속 작은 장면과 연결될 때 더 도움이 돼요. 지금 바로 해 볼 수 있는 약속이나 정리 하나를 고르면 좋아요.`,
    `끝으로, ${withTopicParticle(label)} 좋고 나쁨을 급하게 가르는 답이 아니에요. 부담을 줄일 일 하나와 계속 지킬 일 하나를 나누면 읽은 내용이 더 편하게 남아요.`,
    `${withTopicParticle(label)} 불안을 키우기보다 선택을 조금 가볍게 만들기 위한 참고표예요. 가장 현실적인 행동 하나만 남겨도 충분해요.`,
    `덧붙이면, 이 해석은 ${withObjectParticle(label)} 내 생활에 맞게 줄여 읽을 때 더 쓸모가 커져요. 전부 적용하려 하지 말고 지금 필요한 한 문장만 골라 보세요.`,
    `정리하면, ${withTopicParticle(label)} 긴 설명보다 실제로 반복할 작은 기준이 중요해요. 오늘의 일정이나 대화에 붙일 수 있는 기준 하나를 남겨 보세요.`,
    `끝으로, ${withTopicParticle(label)} 다시 읽을수록 맞는 부분이 달라질 수 있어요. 이럴 때는 마음이 덜 무거워지는 조언 하나만 챙겨도 괜찮아요.`,
  ]);
}

function closingBalancedContextGuidance(ctx: StandardDepthEnhancementContext): string {
  const label = categoryLabel(ctx.category, ctx);
  return `정리하면, ${withTopicParticle(label)} ${closingContextObjects(ctx)} 함께 놓고 볼 때 더 쓸모가 커져요. 부담되는 말은 덜어 두고 실천 가능한 것부터 남겨 보세요.`;
}

function closingContextObjects(ctx: StandardDepthEnhancementContext): string {
  if (isFutureAdultLifeForMinorReader(ctx)) {
    switch (ctx.category) {
      case 'overall':
        return '몸과 마음, 일정, 관계, 돈의 기준을';
      case 'wealth':
        return '비용, 약속, 필요한 물건, 확인할 사람을';
      case 'romance':
        return '말투, 거리감, 서로의 속도를';
      case 'career':
        return '맡을 책임, 도움받을 사람, 내 컨디션을';
      default:
        return '지금의 생활 기준과 나중에 다시 볼 기준을';
    }
  }
  switch (ctx.category) {
    case 'overall':
      return '몸과 마음, 일정, 관계를';
    case 'wealth':
      return isYoungChildReader(ctx) ? '갖고 싶은 것, 기다릴 수 있는 것, 보호자와의 약속을' : '지출, 약속, 이동 비용, 필요한 물건을';
    case 'health':
      return '잠, 식사, 움직임을';
    case 'academic':
      return '집중 시간, 쉬는 시간, 끝낼 범위를';
    case 'romance':
      return isMinorReader(ctx) ? '말투, 친구의 속도, 내 마음을' : '말투, 거리감, 서로의 속도를';
    case 'family':
      return '안부, 시간, 집안 분위기를';
    case 'career':
      return isMinorReader(ctx) ? '관심, 경험, 준비할 것을' : '맡은 일, 마감, 내 컨디션을';
    case 'study_document':
      return '날짜, 약속, 남겨 둘 기록, 확인해 줄 사람을';
    case 'expression_children':
      return '아이디어, 말, 꺼내 볼 표현을';
    case 'health_stress':
      return '긴장 신호, 쉬는 시간, 도움받을 곳을';
    case 'movement':
      return '시간, 길, 비용, 함께 확인할 사람을';
  }
}
function enhancementSentences(ctx: StandardDepthEnhancementContext): readonly string[] {
  return [
    scoreBridgeGuidance(ctx),
    scorePacingGuidance(ctx),
    periodHorizonGuidance(ctx),
    categoryGuidance(ctx.category, ctx),
    selfCheckGuidance(ctx),
    closingGuidance(ctx),
  ];
}

function contextualPublicTone(value: string, ctx: StandardDepthEnhancementContext): string {
  const sourceVariantValue = value
    .replace(
      /긴 흐름의 이동은 떠나는 힘과 돌아올 기준을 함께 보는 영역이에요\. 어디까지 움직이고 언제 쉬며 누구와 확인할지 미리 정하면 변화가 덜 흔들려요\./g,
      pickVariant(ctx, 'sourceMovementFloorOpening', [
        '긴 흐름의 이동은 새로 떠나는 일만큼 다녀온 뒤 생활에 다시 붙는 시간을 함께 정할 때 편해져요. 움직일 곳, 쉴 시간, 확인할 사람을 미리 두면 선택이 덜 흔들려요.',
        '인생 전체의 이동은 멀리 가느냐보다 생활을 지키며 넓히는 흐름에 가까워요. 내 생활이 견딜 수 있는 거리와 다녀온 뒤의 여유를 같이 보면 새 길도 덜 막연해져요.',
        '긴 시간의 변화는 떠나는 순간보다 떠나기 전 기준에서 안정돼요. 어디까지 움직일지와 언제 쉬어 갈지를 정하면 마음이 덜 급해져요.',
        '이동의 흐름은 새 환경을 찾는 힘과 익숙한 생활을 지키는 힘을 함께 봐야 해요. 움직임의 폭과 돌아올 시간을 나누면 판단이 쉬워져요.',
        '인생 전체로 보면 이동은 한 번의 큰 변화보다 생활을 넓히는 방식이에요. 갈 곳, 머물 곳, 다시 정리할 시간을 함께 두면 훨씬 편해요.',
        '긴 흐름의 이동은 무조건 많이 움직이라는 뜻이 아니에요. 나에게 맞는 거리와 쉬는 기준을 알 때 변화도 생활 안에 안정적으로 들어와요.',
        '새로운 곳을 향하는 힘이 있어도 먼저 확인할 기준이 필요해요. 준비 부담과 돌아온 뒤 생활 리듬을 나누어 보면 이동이 부담보다 선택에 가까워져요.',
        '이동과 변화는 마음이 끌리는 방향만 보아서는 오래 버티기 어려워요. 움직일 이유와 쉬어 갈 기준을 같이 적어 두면 흐름이 차분해져요.',
      ]),
    )
    .replace(
      /새 장소나 새 역할이 눈에 들어와도 생활의 중심을 잃지 않는 것이 중요해요\. 시간, 비용, 체력을 따로 적어 두면 선택의 부담이 훨씬 작아져요\./g,
      pickVariant(ctx, 'sourceMovementFloorCenter', [
        '새 장소가 눈에 들어오면 생활의 중심도 함께 점검해 보세요. 바뀔 생활과 그대로 둘 리듬을 나누면 결정이 현실적인 크기로 줄어요.',
        '새 역할을 맡고 싶을 때도 지금 생활이 버틸 수 있는지 먼저 보는 편이 좋아요. 일정과 체력을 함께 보면 무리한 이동을 줄일 수 있어요.',
        '낯선 환경이 좋아 보여도 내 하루가 너무 흔들리면 오래 이어지기 어려워요. 이동 전에 돈, 시간, 몸의 부담을 나누어 보면 선택이 또렷해져요.',
        '새로운 기회는 설렘과 부담을 같이 데려와요. 무엇이 기대되고 무엇이 피곤한지 따로 적으면 실제로 움직일 크기가 보이기 시작해요.',
        '장소나 역할이 바뀔 때는 생활의 기본 리듬을 먼저 붙잡아야 해요. 식사, 잠, 이동 시간을 확인하면 변화가 훨씬 덜 거칠게 느껴져요.',
        '새로운 곳이 끌릴 때일수록 지금 지켜야 할 생활 기준을 먼저 떠올려 보세요. 잠, 식사, 약속 중 하나만 안정돼도 변화가 훨씬 덜 부담스러워요.',
        '역할이 달라질 때는 기대되는 점과 버거운 점을 따로 보는 편이 좋아요. 두 가지가 나뉘면 움직일 크기와 기다릴 이유가 더 분명해져요.',
        '새 환경을 볼 때는 마음의 설렘과 실제 하루의 리듬을 함께 놓아 보세요. 이동 시간, 쉬는 시간, 필요한 비용이 보이면 선택이 현실적으로 줄어들어요.',
        '변화가 눈에 들어올수록 내 생활이 버틸 수 있는 크기를 먼저 정해 보세요. 기준이 작아야 새 역할도 오래 안정적으로 이어져요.',
        '새 길을 고를 때는 좋아 보이는 이유와 버거워질 이유를 함께 보는 편이 안전해요. 두 가지가 나뉘면 지금 갈지, 조금 기다릴지도 정하기 쉬워요.',
        '이동이 많아지는 때일수록 한 번에 다 바꾸려 하지 않는 편이 좋아요. 먼저 지킬 생활 기준을 정하면 새 역할도 더 차분히 살필 수 있어요.',
        '새 환경은 기대만큼 준비도 필요해요. 함께 확인할 사람과 쉬어 갈 시간을 미리 정하면 선택의 무게가 훨씬 가벼워져요.',
        '움직이기 전에는 설렘만 보지 말고 돌아온 뒤의 하루도 같이 떠올려 보세요. 다음 날의 몸 상태까지 생각하면 선택이 더 현실적이에요.',
        '새 환경이 좋아 보여도 지금 지켜야 할 생활 기준을 먼저 적어 보세요. 잠, 식사, 약속 중 하나만 흔들리지 않아도 변화가 덜 부담스러워요.',
        '변화가 커질수록 기준은 작게 잡는 편이 좋아요. 오늘 확인할 비용 하나, 함께 물어볼 사람 하나, 쉬어 갈 시간 하나면 충분해요.',
        '새로운 역할을 살필 때는 내가 감당할 일과 도움받을 일을 나누어 보세요. 혼자 다 들고 움직이지 않아도 변화는 충분히 시작될 수 있어요.',
        '낯선 곳이 끌릴수록 익숙한 생활을 어떻게 지킬지도 함께 봐야 해요. 지킬 기준이 있어야 새 환경도 더 편하게 받아들일 수 있어요.',
        '이동의 선택은 마음만으로 정하기보다 실제 하루에 넣어 보는 편이 좋아요. 이동 시간, 쉬는 시간, 필요한 돈을 나란히 두면 판단이 쉬워져요.',
        '새 기회를 볼 때는 빨리 잡는 것보다 오래 지킬 수 있는지가 더 중요해요. 지금 생활에 들어올 자리가 있는지 먼저 확인해 보세요.',
        '역할이나 장소가 바뀌는 흐름에서는 주변 사람과의 조율도 필요해요. 함께 확인할 사람을 정하면 혼자 결정할 때보다 부담이 줄어요.',
      ]),
    )
    .replace(
      /돌아올 자리가 분명하면 낯선 곳을 살피는 마음도 더 편안해져요\. 이동 뒤에 정리할 일과 회복할 시간을 남겨 두면 변화가 좋은 경험으로 오래 남아요\./g,
      pickVariant(ctx, 'sourceMovementFloorRecovery', [
        '돌아온 뒤 정리할 시간을 남기면 이동이 부담보다 경험으로 남아요. 회복 기준이 있으면 낯선 곳을 볼 때도 마음이 덜 급해져요.',
        '어디든 다녀온 뒤 다시 생활을 맞출 시간이 필요해요. 정리할 일과 쉴 시간을 남기면 변화의 피로가 오래 쌓이지 않아요.',
        '돌아올 자리를 정해 두면 새 환경을 살피는 마음도 훨씬 안정돼요. 다녀온 뒤 무엇을 정리할지만 알아도 다음 이동이 덜 부담스러워요.',
        '이동이 좋은 경험으로 남으려면 끝난 뒤의 회복까지 계획에 넣어야 해요. 쉬는 날, 정리할 물건, 다시 만날 사람을 생각해 두면 편해요.',
        '새 곳을 경험한 뒤에는 바로 다음 일을 벌이기보다 숨을 고르는 시간이 필요해요. 그 여유가 있어야 변화가 생활의 자산으로 남아요.',
        '돌아올 기준은 이동을 막는 장치가 아니라 더 편하게 움직이게 해 주는 기준이에요. 회복할 시간을 남기면 새 선택도 덜 겁나게 느껴져요.',
        '낯선 곳을 다녀온 뒤 내 생활로 다시 돌아오는 과정까지 살펴보세요. 정리와 휴식이 따라오면 변화가 피로보다 배움으로 남기 쉬워요.',
        '다녀온 뒤 쉴 시간을 가볍게 보면 좋은 변화도 금방 부담이 될 수 있어요. 돌아와서 쉬고 정리할 틈을 남기면 다음 선택이 훨씬 안정돼요.',
        '돌아온 뒤 바로 모든 일을 이어 붙이지 않아도 괜찮아요. 하루의 여백을 남기면 새 경험을 정리하고 몸도 따라올 시간을 얻어요.',
        '새로운 곳을 다녀온 뒤에는 무엇이 좋았고 무엇이 힘들었는지 짧게 나누어 보세요. 그 기록이 다음 이동의 기준이 될 수 있어요.',
        '이동을 마친 뒤 정리할 물건, 연락할 사람, 쉬어 갈 시간을 정해 두면 마음이 훨씬 편해져요. 끝맺음이 있어야 다음 변화도 가벼워져요.',
        '돌아올 길을 생각하는 것은 소극적인 태도가 아니에요. 안전하게 돌아올 기준이 있어야 낯선 선택도 더 넓게 경험할 수 있어요.',
        '변화 뒤에는 몸과 마음이 늦게 반응할 수 있어요. 바로 판단하지 말고 하루쯤 쉬어 보아야 그 경험이 내게 맞았는지 더 잘 보여요.',
        '이동 후에 남는 피로를 줄이려면 끝난 뒤의 일정까지 같이 봐야 해요. 정리할 시간과 회복할 시간을 남기면 좋은 기억도 오래 가요.',
        '새로운 자리를 경험했다면 돌아와서 원래 생활을 다시 맞추는 과정도 살펴보세요. 그 과정이 편해야 다음 이동도 무리 없이 이어져요.',
        '회복할 기준이 있으면 이동이 생활을 흔드는 사건보다 배울 수 있는 경험에 가까워져요. 돌아온 뒤 쉬는 시간까지 계획에 넣어 보세요.',
        '다녀온 뒤의 시간을 비워 두면 이동이 피로보다 경험으로 남기 쉬워요. 쉬는 시간과 정리할 일을 함께 두면 다음 변화도 덜 무거워져요.',
        '새로운 곳을 경험한 뒤에는 바로 다음 일로 넘어가지 않아도 괜찮아요. 무엇이 편했고 무엇이 힘들었는지 짧게 나누면 다음 이동의 기준이 생겨요.',
        '돌아온 뒤 회복할 틈이 있어야 좋은 변화도 오래 남아요. 쉬는 날, 정리할 물건, 다시 확인할 사람을 정하면 마음이 훨씬 안정돼요.',
        '이동 뒤의 피로를 줄이려면 끝난 뒤 일정까지 같이 봐야 해요. 돌아와서 쉴 수 있는지 확인하면 움직임의 크기도 더 현실적으로 정해져요.',
      ]),
    )
    .replace(
      /긴 흐름에서는 많이 움직이는 힘과 돌아와 쉴 기반을 함께 갖추는 것이 중요해요\.\s+변화가 잦은 시기일수록 생활의 기준점이 있어야 선택이 흔들리지 않습니다\.\s+돌아올 자리를 분명히 두면 새 곳을 향한 움직임도 더 가벼운 발걸음으로 이어집니다\./g,
      pickVariant(ctx, 'sourceMovementReturnBase', [
        '긴 흐름에서는 움직이는 힘만큼 다녀온 뒤 회복할 여유도 중요해요. 새 환경을 향할 때는 함께 확인할 사람과 생활 리듬을 먼저 정해 두면 변화가 덜 흔들려요. 쉬어 갈 틈이 분명하면 이동도 훨씬 편안해져요.',
        '이동과 변화는 멀리 가는 힘만으로 완성되지 않아요. 새 장소를 살피기 전에 다시 돌아올 생활 리듬과 쉬는 시간을 정해 두면 선택이 더 안전해져요.',
        '많이 움직이는 흐름일수록 기준을 잃지 않는 것이 중요해요. 어디까지 가고 언제 쉬며 누구와 확인할지 정해 두면 새 변화도 생활을 덜 흔들어요.',
        '긴 시간의 이동 흐름은 새로 떠나는 힘과 제자리에서 정리하는 힘을 함께 봐야 해요. 다녀온 뒤 지킬 리듬이 있으면 낯선 곳에서도 마음이 덜 급해지고 다음 선택도 차분해져요.',
        '변화가 잦을 때는 움직임 자체보다 이후의 회복 여유를 먼저 세우는 편이 좋아요. 생활 리듬과 몸의 부담을 나누어 보면 새 길을 고르는 부담이 크게 줄어요.',
        '새로운 곳으로 향하는 힘이 있어도 생활의 중심은 함께 챙겨야 해요. 돌아왔을 때 정리할 일과 쉴 시간을 미리 남기면 변화가 더 좋은 경험으로 남아요.',
      ]),
    )
    .replace(
      /작은 우물에 비유하면, 자주 길어 쓰면서도 자주 채우는 흐름이에요\. 무거운 일 한 가지보다 가벼운 일 여러 가지를 끝내는 식이 (?:더 )?잘 어울려요\./g,
      pickVariant(ctx, 'sourceHealthStressSmallWell', [
        '비유하자면 컵에 물을 조금씩 다시 채우는 흐름이에요. 한 번에 큰일을 끝내기보다 짧게 쉬고 작은 일을 하나씩 마무리할 때 긴장도 덜 쌓여요.',
        '긴장과 회복은 한 번에 많이 버티는 힘보다 자주 다시 채우는 습관에 가까워요. 작은 일 하나를 끝내고 짧게 숨을 고르면 다음 일도 덜 무겁게 이어져요.',
        '이 흐름에서는 무거운 책임 하나를 오래 붙잡기보다 작은 단위로 나누는 편이 잘 맞아요. 잠깐 멈추고 다시 시작하는 리듬이 몸과 마음을 더 안정시켜요.',
        '마음의 에너지는 크게 저장해 두기보다 자주 보충하는 쪽이 좋아요. 쉬운 일 하나, 짧은 휴식 하나, 따뜻한 식사 하나가 긴장감을 천천히 낮춰 줘요.',
        '비유하자면 작은 배터리를 자주 충전하는 모습이에요. 오래 버티려고만 하기보다 중간중간 부담을 내려놓을 때 생활의 페이스가 더 부드러워져요.',
        '큰 회복을 기다리기보다 매일 작게 숨 돌릴 시간을 만드는 편이 좋아요. 가벼운 정리와 짧은 움직임이 쌓이면 몸과 마음의 긴장도 훨씬 덜해져요.',
      ]),
    )
    .replace(
      /기록과 서류, 배움의 자료는 천천히 확인할수록 힘이 커지는 영역이에요\. 대충 넘긴 한 줄이 나중에 부담이 될 수 있으니, 처음부터 완벽하게 하기보다 다시 찾기 쉽게 남기는 것이 중요해요\./g,
      pickVariant(ctx, 'sourceStudyDocumentLifeBasis', [
        '기록과 서류, 필요한 자료는 천천히 확인할수록 힘이 커지는 영역이에요. 처음부터 완벽하게 정리하려 하기보다, 나중에 다시 찾기 쉬운 기준을 남기는 것이 중요해요.',
        '서류와 지식 자료는 급하게 처리할수록 작은 빈칸이 남기 쉬워요. 이름, 날짜, 이유처럼 다시 확인할 단서를 남기면 다음 단계가 훨씬 덜 막막해져요.',
        '기록을 다루는 힘은 꼼꼼함을 자랑하는 일이 아니라 생활을 보호하는 습관에 가까워요. 필요한 자료가 어디 있는지 알게 되면 중요한 순간에도 마음이 덜 흔들려요.',
        '기록과 서류는 한 번 보고 끝나는 것이 아니라 필요할 때 다시 꺼내 쓰는 자료예요. 그래서 지금은 멋진 정리보다 알아볼 수 있는 정리가 더 중요해요.',
        '중요한 기록은 천천히 볼수록 실수가 줄어드는 영역이에요. 어려운 문장도 다시 찾을 기준을 붙여 두면 나중에는 훨씬 쉬운 자료가 돼요.',
      ]),
    )
    .replace(
      /계약, 신청, 보고, 자격 준비처럼 확인이 필요한 일은 서두르기보다 근거를 남기는 방식이 좋아요\. 날짜, 이름, 금액, 조건처럼 기본 항목을 따로 보면 어려운 문서도 훨씬 단순해져요\./g,
      pickVariant(ctx, 'sourceStudyDocumentLifeMethod', [
        '계약, 신청, 보고, 자격 준비처럼 확인이 필요한 일은 서두르기보다 근거를 남기는 방식이 좋아요. 날짜, 이름, 금액, 조건을 따로 보면 어려운 문서도 훨씬 단순해져요.',
        '확인이 필요한 일은 기억에만 맡기지 않는 편이 좋아요. 신청일, 제출처, 금액, 담당자처럼 기본 항목을 나누면 복잡한 문서도 차분히 다룰 수 있어요.',
        '계약이나 갱신처럼 부담이 큰 문서는 한 번에 이해하려 하지 않아도 괜찮아요. 먼저 날짜와 조건을 찾고, 다음에 책임 범위를 보면 실수가 줄어요.',
        '보고서나 자격 자료를 볼 때는 중요한 말에 표시를 남기는 것이 도움이 돼요. 무엇을 냈고 무엇을 다시 확인해야 하는지 보이면 다음 행동이 쉬워져요.',
        '보고서나 자격 자료는 처음부터 전부 이해하려 하지 않아도 괜찮아요. 제출한 것, 보완할 것, 다시 물어볼 것을 나누면 다음 행동이 훨씬 선명해져요.',
        '자격이나 보고 자료를 볼 때는 핵심 조건을 먼저 표시해 보세요. 조건이 보이면 준비할 자료와 나중에 확인할 자료가 자연스럽게 갈라져요.',
        '형식이 있는 자료일수록 작은 표시가 큰 도움이 돼요. 어떤 칸을 채웠고 어떤 칸을 다시 봐야 하는지 남겨 두면 실수도 줄어들어요.',
        '신청서나 보고 자료는 먼저 큰 제목을 보고, 그다음 빠뜨리기 쉬운 칸을 확인하는 편이 좋아요. 순서가 있으면 어려운 문서도 덜 무겁게 느껴져요.',
        '자격 준비나 갱신 자료는 필요한 조건을 따로 적어 두면 훨씬 편해져요. 조건이 보이면 지금 준비할 것과 나중에 볼 것이 자연스럽게 나뉘어요.',
        '보고나 신청처럼 형식이 있는 자료는 표시를 남길수록 실수가 줄어요. 제출한 것, 보완할 것, 확인받을 것을 나누면 다음 행동이 분명해져요.',
        '문서 확인은 빠르게 끝내는 것보다 빠뜨리지 않는 것이 더 중요해요. 이름, 날짜, 금액, 조건을 한 줄씩 나누면 판단이 훨씬 안정돼요.',
        '기록과 서류는 속도보다 다시 찾기 쉬운지가 더 중요할 때가 많아요. 이름, 날짜, 보관 위치를 나누어 적으면 다음 확인이 훨씬 가벼워져요.',
        '급하게 끝낸 문서는 나중에 다시 확인하느라 시간이 더 들 수 있어요. 제출할 것과 보관할 것, 함께 확인할 것을 나누면 실수가 줄어요.',
        '문서를 볼 때는 한 번에 전부 끝내려 하기보다 빠뜨리기 쉬운 칸부터 확인해 보세요. 금액, 날짜, 조건처럼 헷갈리는 항목을 따로 두면 판단이 안정돼요.',
        '기록은 많이 모으는 것보다 필요한 순간에 꺼낼 수 있어야 도움이 돼요. 파일 이름과 저장 위치만 또렷해져도 서류 부담이 크게 줄어요.',
        '문서를 볼 때는 먼저 기본 항목을 분리해 보세요. 이름, 날짜, 금액, 책임 범위가 따로 보이면 어려운 내용도 훨씬 차분하게 읽혀요.',
        '확인이 필요한 자료는 속도보다 순서가 중요해요. 먼저 제목과 날짜를 보고, 그다음 금액과 조건을 보면 빠뜨리는 부분이 줄어요.',
        '복잡한 문서도 작은 칸으로 나누면 부담이 내려가요. 오늘은 이름, 날짜, 금액, 조건 중 가장 헷갈리는 것 하나만 또렷하게 확인해 보세요.',
      ]),
    )
    .replace(
      /자료를 정리할 때는 많이 모으는 것보다 나중에 바로 찾을 수 있는지가 더 중요해요\. 제목을 통일하고 보관할 곳을 정해 두면, 급한 순간에도 마음이 덜 흔들려요\./g,
      pickVariant(ctx, 'sourceStudyDocumentLifeFiling', [
        '자료를 정리할 때는 많이 모으는 것보다 나중에 바로 찾을 수 있는지가 더 중요해요. 제목과 보관 장소가 정해지면 급한 순간에도 마음이 덜 흔들려요.',
        '좋은 기록은 양이 많아서가 아니라 다시 찾기 쉬워서 힘이 생겨요. 파일 이름을 비슷하게 맞추고 보관 위치를 정해 두면 다음 확인이 빨라져요.',
        '쌓인 자료가 많을수록 먼저 기준을 작게 잡는 편이 좋아요. 오늘은 제목 하나, 폴더 하나, 보관 날짜 하나만 정해도 정리의 길이 보이기 시작해요.',
        '자료가 여기저기 흩어져 있으면 중요한 순간에 더 불안해질 수 있어요. 자주 쓰는 것부터 한곳에 모으면 전체 정리도 훨씬 덜 부담스러워요.',
        '자료가 흩어져 있을 때는 먼저 찾는 빈도가 높은 것부터 챙겨 보세요. 가장 자주 여는 자료 하나만 제자리에 있어도 정리 부담이 크게 줄어요.',
        '중요한 자료가 여러 곳에 있으면 급할 때 마음이 흔들리기 쉬워요. 오늘은 최근에 쓴 자료와 곧 다시 쓸 자료만 따로 모아도 충분해요.',
        '흩어진 기록을 전부 모으려 하면 시작이 커져요. 먼저 다시 찾을 가능성이 큰 자료 하나를 골라 이름과 위치만 분명히 해 보세요.',
        '흩어진 자료를 모두 한 번에 모으려 하지 않아도 괜찮아요. 이번에는 가장 자주 찾는 자료 하나만 제자리에 두어도 정리의 시작이 돼요.',
        '자료가 많아질수록 먼저 손댈 곳을 줄이는 편이 좋아요. 자주 여는 폴더, 최근 받은 문서, 곧 제출할 자료 중 하나만 골라 정리해 보세요.',
        '정리의 첫 단계는 완벽한 분류보다 다시 찾을 수 있는 자리예요. 급할 때 찾을 가능성이 큰 자료부터 모으면 마음이 훨씬 가벼워져요.',
        '정리는 한 번에 끝내는 일이 아니라 다시 찾기 쉬운 길을 만드는 일이에요. 나중의 내가 알아볼 수 있는 제목 하나를 붙이는 것부터 시작해도 충분해요.',
        '자료 정리는 완벽한 분류표를 만드는 일이 아니에요. 오늘 자주 찾는 자료 하나에 알아보기 쉬운 이름을 붙이면 다음 확인이 훨씬 빨라져요.',
        '흩어진 자료가 많을 때는 가장 자주 쓰는 것부터 모으는 편이 좋아요. 자주 여는 폴더나 보관함 하나만 편해져도 전체 부담이 줄어들어요.',
        '나중에 다시 볼 자료라면 제목에 날짜나 이유를 짧게 붙여 보세요. 작은 단서 하나가 급한 순간에 큰 시간을 아껴 줘요.',
      ]),
    )
    .replace(
      /누군가와 함께 확인해야 하는 문서는 혼자 끝내려 하지 않아도 괜찮아요\. 내가 먼저 볼 부분과 도움받을 부분을 나누면 실수도 줄고 책임의 경계도 더 또렷해져요\./g,
      pickVariant(ctx, 'sourceStudyDocumentLifeShared', [
        '누군가와 함께 확인해야 하는 문서는 혼자 끝내려 하지 않아도 괜찮아요. 내가 먼저 볼 부분과 도움받을 부분을 나누면 실수도 줄고 확인할 범위도 더 또렷해져요.',
        '혼자 판단하기 어려운 문서는 함께 볼 사람을 정해 두는 편이 안전해요. 질문할 부분을 먼저 적어 두면 도움을 받아도 내 기준이 흐려지지 않아요.',
        '어려운 문서는 혼자 끝내야 한다고 느낄수록 더 막막해질 수 있어요. 먼저 내가 본 부분과 확인받을 부분을 나누면 도움도 훨씬 정확해져요.',
        '함께 확인할 사람이 있다면 질문을 짧게 정리해 보세요. 무엇이 헷갈리는지 보여야 상대의 도움도 내 생활에 맞게 들어와요.',
        '문서가 어렵게 느껴질 때는 믿을 만한 사람에게 한 항목만 물어봐도 좋아요. 질문이 작아지면 확인 과정도 덜 부담스러워져요.',
        '서류가 부담스러울수록 확인할 범위를 나누는 것이 좋아요. 내가 볼 항목과 함께 확인할 항목을 구분하면 불필요한 부담이 줄어들어요.',
        '서류 확인이 커 보일 때는 혼자 볼 항목과 함께 볼 항목을 따로 적어 보세요. 확인 범위가 나뉘면 실수도 줄고 마음도 덜 급해져요.',
        '함께 처리해야 하는 문서는 검토 범위를 먼저 세우는 편이 좋아요. 내가 볼 부분과 확인받을 부분을 나누면 나중에 설명하기도 쉬워요.',
        '부담스러운 서류일수록 확인할 칸을 작게 나누는 편이 좋아요. 내가 먼저 볼 칸, 함께 확인할 칸, 나중에 다시 볼 칸을 나누면 길이 보여요.',
        '중요한 자료는 다른 사람의 눈으로 한 번 더 보는 것만으로도 실수를 줄일 수 있어요. 부탁할 내용을 짧게 정리해 두면 확인 과정도 훨씬 편해져요.',
        '함께 보는 문서는 책임을 미루는 일이 아니라 기준을 안전하게 만드는 일이에요. 서로 볼 항목을 나누면 나중에 설명하기도 쉬워져요.',
        '문서를 함께 본다는 것은 내 판단을 포기하는 일이 아니에요. 빠뜨리기 쉬운 부분을 다른 눈으로 확인해 두는 안전한 절차에 가까워요.',
        '중요한 자료는 혼자 한 번, 함께 한 번 보는 식으로 나누면 좋아요. 같은 내용을 두 눈으로 확인하면 나중에 설명할 때도 훨씬 차분해져요.',
        '함께 확인할 때는 모든 것을 맡기기보다 내가 궁금한 항목을 먼저 정해 보세요. 질문이 또렷하면 기준도 더 안전하게 남아요.',
      ]),
    )
    .replace(
      /쌓아 둔 기록은 다음 단계의 자료가 돼요\. 오늘 작은 체크리스트 하나를 남기면, 다음에 같은 일을 할 때 처음부터 다시 고민하지 않아도 (?:됩니다|돼요)\./g,
      pickVariant(ctx, 'sourceStudyDocumentLifeChecklist', [
        '쌓아 둔 기록은 다음 단계의 자료가 돼요. 오늘 작은 체크리스트 하나를 남기면, 다음에 같은 일을 할 때 처음부터 다시 고민하지 않아도 돼요.',
        '쌓아 둔 기록은 다음번에 길을 찾게 해 주는 표시가 될 수 있어요. 오늘 확인한 순서와 남은 항목을 짧게 적어 두면 같은 일을 다시 만날 때 훨씬 편해요.',
        '기록은 많이 남기는 것보다 다시 꺼내 쓸 수 있게 남기는 것이 중요해요. 확인한 것, 물어볼 것, 보관할 곳을 나누면 다음 단계가 덜 막막해져요.',
        '오늘 만든 작은 확인표는 다음번의 첫 단계를 대신 정해 줘요. 어디부터 볼지 보이면 문서 작업도 훨씬 덜 부담스럽게 시작돼요.',
        '짧은 체크리스트 하나가 나중의 시간을 크게 줄여 줄 수 있어요. 날짜, 이름, 남은 일처럼 반복해서 보는 칸부터 남겨 보세요.',
        '지금 남긴 기록이 완벽하지 않아도 괜찮아요. 다음에 다시 볼 사람과 항목만 보이면 기록은 충분히 쓸모 있는 자료가 돼요.',
        '오늘 정리한 순서는 다음번의 안전장치가 돼요. 같은 일을 다시 할 때 무엇을 확인했는지 보이면 실수도 마음의 부담도 줄어들어요.',
        '기록은 쌓아 두기만 할 때보다 다음에 다시 쓸 수 있을 때 힘이 생겨요. 오늘 확인한 순서 하나를 남기면 같은 일을 다시 만났을 때 훨씬 편해져요.',
        '작은 체크리스트는 나중의 시간을 아껴 주는 도구예요. 무엇을 봤고 무엇이 남았는지만 적어도 다음 단계가 더 선명해져요.',
        '오늘 남긴 기록 한 줄이 다음번의 출발점이 될 수 있어요. 같은 실수를 줄이고 싶다면 확인한 항목과 남은 항목을 짧게 표시해 두세요.',
        '오늘 남긴 확인 순서는 다음번의 시간을 줄여 줘요. 같은 일을 다시 만났을 때 무엇부터 볼지 알면 마음의 부담도 훨씬 작아져요.',
        '기록은 지나간 일을 보관하는 데서 끝나지 않아요. 다음 신청, 다음 보고, 다음 갱신에서 바로 꺼내 쓸 수 있을 때 진짜 힘이 생겨요.',
        '작은 체크리스트는 단순해 보여도 반복되는 일을 크게 편하게 만들어 줘요. 한 번 정한 순서가 있으면 다음에는 더 차분히 확인할 수 있어요.',
        '오늘 정리한 한 줄은 나중의 나에게 보내는 안내문이 될 수 있어요. 다시 볼 날짜와 확인할 항목만 남겨도 다음 단계가 훨씬 쉬워져요.',
        '작게 남긴 확인표는 다음 일을 시작할 때 좋은 길잡이가 돼요. 무엇을 봤고 무엇이 남았는지만 적어도 같은 실수를 줄일 수 있어요.',
        '오늘의 기록이 짧아도 괜찮아요. 다시 볼 날짜, 물어볼 사람, 확인할 칸이 남아 있으면 다음 단계가 훨씬 선명해져요.',
        '한 번 만든 체크 순서는 다음번의 불안을 줄여 줘요. 같은 일을 만났을 때 첫 단계가 보이면 시작이 훨씬 쉬워져요.',
      ]),
    )
    .replace(
      /오늘 정리한 한 줄은 나중의 나에게 보내는 안내문이 될 수 있어요\. 다시 볼 날짜와 확인할 항목만 남겨도 다음 단계가 훨씬 쉬워져요\./g,
      pickVariant(ctx, 'sourceStudyDocumentLifeMethod', [
        '오늘 남긴 확인 순서는 다음번의 출발점이 될 수 있어요. 다시 볼 날짜와 남은 항목을 적어 두면 같은 일을 만났을 때 덜 헤매요.',
        '짧은 기록 한 줄도 다음번에는 좋은 안내가 돼요. 무엇을 확인했고 무엇이 남았는지만 적어도 다시 시작하기 쉬워요.',
        '기록은 길지 않아도 괜찮아요. 날짜, 담당자, 남은 일을 한 줄로 남기면 다음 확인이 훨씬 가벼워져요.',
        '오늘 만든 작은 체크표는 나중의 시간을 아껴 줘요. 다시 볼 것과 끝낸 것을 나누어 두면 같은 실수를 줄일 수 있어요.',
        '확인한 순서를 짧게 남겨 두면 다음번에는 처음부터 다시 고민하지 않아도 돼요. 작은 기록이 다음 행동의 길잡이가 돼요.',
      ]),
    )
    .replace(
      /평생 컨디션은 한 번의 큰 변화보다 매일 반복되는 생활 습관의 영향을 많이 받아요\. 큰 기복 없이 이어질 가능성이 있지만, 작은 피로와 잠의 흔들림을 넘기면 뒤늦게 부담이 커질 수 있어요\./g,
      pickVariant(ctx, 'sourceHealthLifeNeutralOpening', [
        '평생 컨디션은 한 번의 큰 변화보다 매일 반복되는 생활 습관의 영향을 많이 받아요. 큰 기복 없이 이어질 수 있지만, 작은 피로와 잠의 흔들림은 일찍 살피는 편이 좋아요.',
        '몸과 마음의 긴 흐름은 대단한 결심보다 평소 리듬에서 많이 만들어져요. 크게 흔들리지 않는 장점이 있어도 작은 신호를 넘기면 뒤늦게 부담이 커질 수 있어요.',
        '평생 건강을 볼 때는 큰 사건보다 자주 반복되는 습관이 더 중요해요. 잠, 식사, 움직임이 조금씩 흔들릴 때 알아차리면 긴 흐름도 훨씬 편해져요.',
        '컨디션은 갑자기 좋아지거나 나빠지기보다 생활 속 작은 반복에 영향을 받아요. 피로가 작을 때 살피고 쉬어 가면 후반의 부담을 줄일 수 있어요.',
        '긴 시간의 몸 상태는 매일의 리듬이 천천히 쌓인 결과에 가까워요. 큰 문제가 없어 보여도 잠과 피로의 변화를 가볍게 기록해 두면 관리가 쉬워져요.',
      ]),
    )
    .replace(
      /잘 자고, 잘 먹고, 적당히 움직이는 세 가지를 어렵게 만들 필요는 없어요\. 매일 비슷한 시간에 일어나고 몸이 편했던 식사와 움직임을 기억해 두면 관리가 훨씬 쉬워져요\./g,
      pickVariant(ctx, 'sourceHealthLifeNeutralBasics', [
        '잘 자고, 잘 먹고, 적당히 움직이는 세 가지를 어렵게 만들 필요는 없어요. 매일 비슷한 시간에 일어나고 몸이 편했던 식사와 움직임을 기억해 두면 관리가 쉬워져요.',
        '건강 관리는 복잡한 계획보다 기본을 반복할 때 오래가요. 잠든 시간, 식사 속도, 걷는 시간을 가볍게 확인하면 몸이 편한 기준이 보이기 시작해요.',
        '몸이 편해지는 기준은 대단한 계획보다 일상의 작은 반복에서 잘 보여요. 잠, 식사, 움직임 중 가장 안정됐던 하나를 남기면 다음 관리가 쉬워져요.',
        '기본을 반복한다는 말은 완벽한 루틴을 만들라는 뜻이 아니에요. 오늘 몸이 덜 힘들었던 시간과 행동을 기억해 두면 충분한 기준이 돼요.',
        '컨디션은 복잡한 방법보다 다시 할 수 있는 생활 기준에 잘 반응해요. 일어나는 시간, 먹는 속도, 걷는 양 중 하나만 편하게 맞춰 보세요.',
        '몸이 좋아하는 리듬은 생각보다 단순할 때가 많아요. 무리한 운동보다 편하게 먹고, 충분히 쉬고, 조금 움직이는 흐름을 먼저 지켜 보세요.',
        '매일의 기본이 흔들리지 않으면 컨디션도 덜 흔들려요. 수면, 식사, 움직임 중 가장 지키기 쉬운 하나부터 안정시키면 나머지도 따라오기 쉬워요.',
        '건강을 어렵게 볼수록 실천이 멀어질 수 있어요. 오늘은 잠, 식사, 움직임 중 몸이 가장 편했던 순간 하나만 기억해도 충분해요.',
      ]),
    )
    .replace(
      /새 운동이나 건강법은 한 번에 많이 바꾸기보다 내 몸이 받아들이는지 확인하며 들이는 편이 좋아요\. 변화는 작을수록 다시 시도하기 쉽고, 오래 이어질 가능성도 높아요\./g,
      pickVariant(ctx, 'sourceHealthLifeNeutralChange', [
        '새 운동이나 건강법은 한 번에 많이 바꾸기보다 내 몸이 받아들이는지 확인하며 들이는 편이 좋아요. 변화는 작을수록 다시 시도하기 쉽고 오래 이어질 가능성도 높아요.',
        '새로운 관리법을 시작한다면 먼저 크기를 줄여 보세요. 짧은 산책이나 가벼운 스트레칭처럼 몸이 부담 없이 받아들이는지 확인하는 과정이 중요해요.',
        '새 건강 습관은 처음부터 크게 잡지 않는 편이 좋아요. 몸이 편하게 받아들이는지 며칠 살펴보고, 괜찮으면 조금씩 넓혀도 충분해요.',
        '관리법이 좋아 보여도 내 몸에 맞는지는 직접 작게 시험해야 알 수 있어요. 짧은 움직임과 쉬운 식사 조절부터 해 보면 부담이 덜합니다.',
        '새로운 루틴은 작게 시작할수록 오래 남아요. 오늘 다시 할 수 있는 크기인지 먼저 확인하면 실패감보다 안정감이 쌓여요.',
        '좋아 보이는 건강법도 내 생활에 맞아야 오래갑니다. 한꺼번에 바꾸기보다 며칠 해 보고 몸이 덜 힘든지 살피면 선택이 더 현실적이에요.',
        '변화가 필요할 때도 속도는 천천히 잡는 편이 좋아요. 오늘 가능한 만큼만 해 보고, 다음에도 다시 할 수 있는지 확인하면 실패감이 줄어요.',
        '건강 습관은 크게 시작할수록 빨리 지칠 수 있어요. 작게 시험하고 몸의 반응을 본 뒤 조금씩 넓히면 오래 지키기가 훨씬 쉬워요.',
      ]),
    )
    .replace(
      /컨디션이 좋은 시기에는 더 밀어붙이기보다 기준을 남겨 두세요\. 어느 시간대에 덜 피곤했는지, 어떤 약속 뒤에 회복이 필요했는지를 알면 나중에도 스스로 조절할 수 있어요\./g,
      pickVariant(ctx, 'sourceHealthLifeNeutralSignal', [
        '컨디션이 좋은 시기에는 더 밀어붙이기보다 기준을 남겨 두세요. 어느 시간대에 덜 피곤했는지, 어떤 약속 뒤에 회복이 필요했는지를 알면 나중에도 조절하기 쉬워요.',
        '몸이 괜찮을 때일수록 잘 맞았던 조건을 기억해 두면 좋아요. 편했던 시간대와 무리했던 일정을 나누면 다음에 같은 선택을 할 때 기준이 생겨요.',
        '좋은 컨디션은 더 많이 해내라는 신호만은 아니에요. 무엇이 몸을 편하게 만들었는지 남겨 두면 피곤한 시기에도 돌아갈 기준이 생겨요.',
        '괜찮은 날의 기록은 힘든 날에 도움이 돼요. 잠, 식사, 약속의 양 중 무엇이 맞았는지 알면 스스로 속도를 조절하기 쉬워져요.',
        '몸이 괜찮았던 날을 그냥 넘기지 말고 조건을 하나만 남겨 보세요. 어떤 시간에 쉬었고 무엇을 덜 했는지 알면 힘든 날에도 돌아갈 기준이 생겨요.',
        '좋은 컨디션은 우연으로만 넘기기보다 다시 만들 수 있는 조건으로 보아도 좋아요. 편했던 식사, 약속의 양, 쉬는 시간을 짧게 기억해 두세요.',
        '가벼웠던 날의 단서는 나중에 큰 도움이 돼요. 잠과 움직임, 사람 만나는 양 중 무엇이 맞았는지 알면 무리할 때와 쉴 때를 더 빨리 구분할 수 있어요.',
        '몸이 가벼운 시기에는 그 이유를 작게 살펴보세요. 회복이 빨랐던 조건을 알아 두면 다음에 무리와 휴식을 나누는 기준이 더 분명해져요.',
      ]),
    )
    .replace(
      /몸을 돌보는 일은 대단한 결심이 아니라 생활을 덜 흔들리게 만드는 기술이에요\. 쉬는 시간, 물 마시는 시간, 가벼운 산책 하나를 정해 두면 긴 흐름에서 든든한 기준이 (?:됩니다|돼요)\./g,
      pickVariant(ctx, 'sourceHealthLifeNeutralCare', [
        '몸을 돌보는 일은 대단한 결심이 아니라 생활을 덜 흔들리게 만드는 기술이에요. 쉬는 시간, 물 마시는 시간, 가벼운 산책 하나가 긴 흐름에서 든든한 기준이 돼요.',
        '건강 관리는 생활을 크게 바꾸는 일이 아니라 흔들릴 때 돌아갈 기준을 만드는 일이에요. 쉬는 시간 하나만 정해 두어도 몸과 마음이 덜 급해져요.',
        '몸을 돌보는 기준은 복잡할수록 오래가기 어려워요. 피곤할 때 돌아갈 수 있는 쉬운 행동 하나가 있으면 컨디션을 다시 맞추기 좋아요.',
        '건강을 지키는 힘은 거창한 계획보다 반복 가능한 기준에서 나와요. 물 마시기, 잠깐 걷기, 쉬는 시간 정하기처럼 작은 행동이 긴 흐름을 받쳐 줘요.',
        '생활이 흔들릴 때 다시 붙잡을 기준을 만들어 두는 것이 중요해요. 몸이 무거운 날에도 할 수 있는 작은 회복 행동 하나면 충분해요.',
        '몸을 챙긴다는 것은 완벽한 루틴을 만드는 뜻이 아니에요. 물 한 잔, 짧은 걷기, 잠깐 눕기처럼 다시 할 수 있는 행동을 남기는 것이 중요해요.',
        '긴 흐름에서 가장 든든한 관리는 반복 가능한 작은 기준이에요. 오늘 편하게 지킬 수 있는 휴식이나 움직임 하나를 정해 두면 다음 조절도 쉬워져요.',
        '오래 가는 건강 관리는 어려운 계획보다 다시 할 수 있는 기준에서 시작돼요. 잠깐 걷기, 물 마시기, 일찍 쉬기 중 하나만 남겨도 충분해요.',
        '긴 시간의 컨디션은 대단한 결심보다 작은 반복에 더 잘 반응해요. 오늘 지킬 수 있는 습관 하나를 남기면 다음 조절도 덜 막막해져요.',
        '몸을 오래 편하게 지키려면 부담 없는 기준이 필요해요. 매일 완벽하게 하지 않아도 다시 돌아올 습관 하나가 있으면 충분히 도움이 돼요.',
        '컨디션을 지키는 힘은 거창한 목표보다 작은 회복 약속에서 나와요. 몸이 지치기 전에 쉬어 갈 자리를 남기면 생활 전체가 조금 더 안정돼요.',
      ]),
    )
    .replace(
      /무리해서 큰 변화를 만들기보다, 익숙한 페이스를 지키며 작은 차분함을 쌓는 방식이 잘 맞아요\. 건강과 일의 균형을 천천히 다시 짜는 시기가 한 번 와요\./g,
      pickVariant(ctx, 'sourceStressOverall', [
        '큰 변화를 한 번에 만들기보다 익숙한 생활 리듬을 먼저 지키는 편이 좋아요. 몸, 일, 관계 중 가장 흔들리는 한 가지를 차분히 조정하면 다음 시기도 덜 무거워요.',
        '이 시기에는 속도를 올리는 것보다 균형을 다시 맞추는 일이 더 중요해요. 일과 건강을 따로 보지 말고 쉬는 시간, 맡은 일, 도움받을 일을 함께 정리해 보세요.',
        '익숙한 페이스를 지키는 힘이 후반기의 바탕이 돼요. 무리한 새 계획보다 지금 생활에서 덜 피곤해질 조정 하나를 남기는 편이 더 현실적이에요.',
        '생활의 중심이 단단해질수록 작은 균형이 더 중요해져요. 일의 책임과 몸의 회복을 같이 놓고 보면 다음 시기를 준비하는 기준도 차분해져요.',
        '큰 방향을 바꾸지 않아도 삶은 충분히 좋아질 수 있어요. 지금 지키고 싶은 리듬과 줄여야 할 부담을 하나씩 나누면 건강과 일의 균형이 더 선명해져요.',
      ]),
    )
    .replace(
      /80대이고 성별을 넓게 본 경우에는 삶의 리듬을 단순하고 편안하게 유지하는 흐름이 중요해요\./g,
      pickVariant(ctx, 'sourceMovementLaterLifePace', [
        '나중의 80대 구간에서는 생활 동선과 하루 리듬을 단순하고 편안하게 두는 것이 중요해요. 자주 쓰는 물건, 식사, 쉬는 시간을 익숙한 자리에 두면 변화가 와도 덜 흔들려요.',
        '80대 이후의 전체 흐름은 큰 변화보다 안전한 움직임과 익숙한 생활권을 지키는 쪽이 잘 맞아요. 외출이나 이동은 짧게 준비하고, 돌아와 쉴 시간을 함께 남겨 두면 좋아요.',
        '이 구간에서는 어디로 넓게 가느냐보다 하루 동선을 편하게 만드는 일이 더 중요해요. 자주 가는 곳, 쉬는 곳, 도움을 청할 사람을 단순하게 정리하면 생활이 안정돼요.',
        '긴 흐름에서 80대는 새 환경을 크게 늘리기보다 편한 장소와 익숙한 움직임을 지키는 시간이 돼요. 작은 산책이나 가까운 외출도 무리 없는 범위에서 이어 가면 충분해요.',
      ]),
    )
    .replace(
      /일과 사람 사이의 균형이 큰 자산이 되는 사주라, 너무 한쪽으로만 기울지 않으면 좋아요\. 지금 역할에서의 작은 결정이 다음 단계의 폭을 만든다는 점을 기억하면, 한 번씩 들어오는 변화 앞에서 흔들림이 적어요\./g,
      pickVariant(ctx, 'sourceCareerMidlifeTrust', [
        '일과 사람 사이의 균형은 이 시기에 꼭 확인할 기준이에요. 한쪽 책임만 크게 붙잡기보다 내가 맡을 일과 나눌 일을 구분하면 다음 변화 앞에서도 덜 흔들려요.',
        '지금 역할에서 하는 작은 결정들이 다음 단계의 폭을 만들 수 있어요. 그래서 일의 성과뿐 아니라 함께 일하는 사람과의 기준도 차분히 맞춰 두는 편이 좋아요.',
        '일을 잘하는 힘과 사람을 오래 지키는 힘이 함께 필요해지는 시기예요. 무리해서 한쪽으로 기울기보다 역할, 시간, 도움받을 사람을 나누어 두면 안정감이 커져요.',
        '변화가 들어올 때마다 바로 크게 움직이기보다 지금 맡은 책임의 크기부터 확인해 보세요. 함께할 사람과 확인할 기준이 있으면 다음 선택도 훨씬 편해져요.',
        '일과 관계의 균형을 기준으로 삼아야 해요. 성과만 밀어붙이면 주변과의 호흡이 흔들릴 수 있으니, 작은 결정일수록 누구와 나눌지 먼저 생각해 보세요.',
      ]),
    )
    .replace(
      /80대 남성으로 입력된 경우에는 삶의 경험을 조용한 중심으로 남기는 흐름이 중요해요\./g,
      pickVariant(ctx, 'sourceMovementLaterLifePace', [
        '80대 이후에는 삶의 경험을 조용한 중심으로 두되, 생활 동선과 작은 루틴을 단순하게 지키는 흐름이 중요해요. 움직임은 무리하지 않는 범위에서 이어 가고, 돌아와 쉴 기준도 함께 남겨 두면 좋아요.',
        '이 구간에서는 앞장서서 해결하기보다 안전한 움직임과 익숙한 생활권을 지키는 편이 잘 맞아요. 외출, 식사, 휴식의 순서를 단순하게 두면 하루가 더 편안해져요.',
        '나이가 깊어질수록 큰 변화보다 작은 동선의 안정감이 중요해져요. 자주 가는 길, 자주 쓰는 물건, 쉬는 시간을 정리해 두면 생활이 덜 흔들려요.',
      ]),
    )
    .replace(
      /80대 여성으로 입력된 경우에는 관계의 온기를 지키면서도 나의 편안함을 먼저 살피는 흐름이 중요해요\./g,
      pickVariant(ctx, 'sourceMovementLaterLifePace', [
        '80대 이후에는 관계의 온기를 지키되 생활 동선과 쉬는 시간을 더 단순하게 두는 흐름이 중요해요. 외출이나 이동은 짧게 준비하고, 돌아와 쉴 기준을 함께 남기면 편안함이 커져요.',
        '이 구간에서는 주변을 챙기는 마음만큼 나의 움직임과 생활권도 편하게 만드는 일이 중요해요. 자주 가는 곳과 쉬는 자리를 단순하게 정하면 관계도 덜 부담스러워져요.',
        '관계의 따뜻함을 지키려면 몸이 편한 동선과 도움을 받을 기준도 함께 필요해요. 가까운 외출, 짧은 만남, 돌아와 쉬는 시간을 나누면 생활이 안정돼요.',
      ]),
    )
    .replace(
      /이 시기는 인생 전체에서 가꾸어 온 가족의 습관과 마음이 든든한 결실로 모이는 때예요\. 곁에 있어 주는 사람들의 손길, 멀리서 안부를 보내는 마음, 다음 세대로 이어지는 기억이 한데 포개져요\./g,
      pickVariant(ctx, 'sourceFamilyAutumn', [
        '이 시기는 인생 전체에서 가꾸어 온 가족의 습관과 마음이 결실로 모이는 때예요. 곁에 있어 주는 사람, 멀리서 안부를 보내는 사람, 다음 세대의 기억이 서로 균형 있게 기대도록 작은 기준을 나누면 좋아요.',
        '오래 쌓아 온 가족의 마음이 한데 모이는 시기예요. 누가 더 많이 했는지를 따지기보다 기대는 기준과 쉬어 가는 기준을 함께 나누면 관계가 더 편안해져요.',
        '가족 안의 따뜻함이 오래 남는 때일수록 서로의 역할을 가볍게 조절하는 태도가 필요해요. 도움을 주는 사람과 받는 사람이 모두 덜 부담스럽도록 작은 약속을 나누어 보세요.',
        '다음 세대로 이어지는 기억이 중요해지는 시기예요. 안부, 도움, 쉬는 시간을 균형 있게 나누면 가족의 온기가 한 사람에게만 쏠리지 않고 오래 이어져요.',
      ]),
    )
    .replace(
      /잘 풀리는 결은 정리와 나눔이 자연스러울 때예요\. 자녀·후배·이웃과 함께 쓰는 리듬이 자리를 더 단단하게 만들어요\./g,
      pickVariant(ctx, 'sourceWealthSharing', [
        '좋은 흐름은 내가 가진 기준을 필요한 사람과 나눌 때 더 또렷해져요. 물건이나 돈보다 먼저 어떤 마음으로 나눌지 정하면 생활의 안정감도 함께 커져요.',
        '남길 것과 나눌 것을 차분히 고르면 그동안의 선택이 더 분명한 가치로 남아요. 가족, 후배, 이웃에게 필요한 만큼만 전해도 충분히 따뜻한 흐름이 만들어져요.',
        '가족이나 가까운 사람에게 한꺼번에 넘기려 하지 않아도 괜찮아요. 작은 기준 하나, 필요한 물건 하나를 알맞게 나누는 것만으로도 관계와 생활이 한결 단단해져요.',
        '정리한 물건이나 기준을 필요한 곳에 보내는 과정이 이 시기의 장점이에요. 많이 내어 주기보다 서로 부담 없는 크기로 나눌 때 오래 편안하게 이어져요.',
        '정리와 나눔이 잘 맞을 때는 먼저 남길 기준을 작게 정해 보세요. 돈, 물건, 약속을 따로 적어 두면 누구에게 무엇을 전하면 좋을지 훨씬 편하게 보일 수 있어요.',
        '가족이나 후배에게 무언가를 나눌 때는 양보다 기준이 더 중요해요. 왜 남기고, 왜 나누는지 차분히 말해 두면 받는 사람도 부담보다 고마움을 더 크게 느껴요.',
        '나눔은 많이 주는 일이 아니라 서로 편안한 크기를 고르는 일이에요. 지금 내 생활을 지키면서 필요한 사람에게 알맞게 전하면 관계도 돈의 흐름도 더 안정돼요.',
        '오래 쌓아 온 것을 정리할 때는 마음이 앞서기 쉬워요. 먼저 내게 꼭 필요한 것과 다른 사람에게 더 잘 쓰일 것을 나누어 보면 결정이 한결 부드러워져요.',
      ]),
    )
    .replace(
      /잘 익은 나무가 그늘을 넓혀 가는 (?:이미지|그림)예요\. 자녀·후배·제자 같은 결과 만나는 (?:시기가|자리가) 보이지만,? 어떤 형태인지는 사람마다 다르게 풀어요\./g,
      pickVariant(ctx, 'sourceExpressionAutumnLight', [
        '오래 자란 나무가 그늘을 나누듯, 이 시기에는 내가 쌓아 온 표현과 경험이 다른 사람에게 편안한 도움으로 전해질 수 있어요. 꼭 어떤 형태로 남겨야 한다고 정하지 않아도 괜찮아요.',
        '그동안 만든 말, 글, 작업은 시간이 지나며 누군가에게 쉬어 갈 그늘이 될 수 있어요. 자녀, 후배, 제자처럼 이어지는 사람과의 만남은 각자의 방식으로 달라져요.',
        '잘 익은 열매를 나누듯 내가 가진 경험을 필요한 사람에게 조금씩 전하기 좋은 흐름이에요. 중요한 것은 결과의 모양보다 서로 부담 없는 크기로 나누는 태도예요.',
        '이 시기의 표현은 새로 증명하기보다 쌓아 온 것을 편안하게 나누는 쪽에 힘이 있어요. 가까운 사람에게 남길 말, 보여 줄 작업, 함께할 시간을 작게 고르면 충분해요.',
        '오래 가꾼 표현은 한 사람에게만 머물지 않고 주변으로 부드럽게 퍼질 수 있어요. 누군가에게 가르치거나 함께 만드는 기회가 오면 크기보다 편안한 속도를 먼저 보세요.',
      ]),
    )
    .replace(
      /중년의 (?:결|흐름)은 깊이가 빛을 내는 흐름이에요\. 자기 페이스를 지키는 것 자체가 큰 자산이 돼요\./g,
      pickVariant(ctx, 'sourceWealthPace', [
        '중년의 돈과 생활은 깊이보다 균형에서 힘이 나요. 내 속도를 지키되 가족, 일, 건강에 부담이 한쪽으로 몰리지 않는지 함께 살피면 좋아요.',
        '이 시기의 자산은 빠른 확장보다 오래 지킬 기준에서 더 또렷해져요. 자기 페이스를 지키면서도 필요한 대화와 점검을 미루지 않는 태도가 중요해요.',
        '중년에는 이미 쌓은 것을 차분히 다듬는 힘이 커져요. 큰 결정보다 지출, 책임, 회복 시간을 균형 있게 나누면 생활의 바탕이 단단해져요.',
        '깊이가 생기는 시기일수록 무리한 확장보다 내 생활을 지키는 기준이 필요해요. 지금 감당할 수 있는 돈과 책임의 크기를 함께 확인해 보세요.',
        '자기 페이스는 돈을 천천히 보라는 말에 그치지 않아요. 오래 갈 선택인지, 가족과 일의 부담을 함께 낮추는지 살피면 자산의 안정감도 커져요.',
      ]),
    )
    .replace(
      /학교에서 받은 작은 칭찬 한마디, 친구와 함께 풀어 본 한 문제, 모르는 단어를 노트에 적어 둔 한 줄이 큰 자산이 되는 시기예요\. 어른의 큰 자격 어휘를 미리 끌어오지 않아도 충분해요\./g,
      pickVariant(ctx, 'sourceStudyPraise', [
        '학교에서 들은 짧은 칭찬, 친구와 같이 풀어 본 문제, 새로 적어 둔 단어 하나가 모두 배움의 자산이 돼요. 어려운 목표보다 오늘 남긴 작은 흔적을 먼저 믿어도 충분해요.',
        '작은 성공을 그냥 지나치지 않는 것이 중요해요. 맞힌 문제 하나, 질문한 내용 하나, 다시 확인한 단어 하나가 쌓이면 공부를 계속해 볼 힘이 생겨요.',
        '거창한 계획이 없어도 배움은 자라요. 선생님에게 들은 말, 친구와 나눈 풀이, 노트에 남긴 표시가 아이에게는 다음 단계로 가는 든든한 발판이 될 수 있어요.',
        '아이의 배움은 큰 목표보다 오늘 이해한 작은 조각에서 힘을 얻어요. 새로 알게 된 말, 다시 풀어 본 문제, 질문한 순간을 따뜻하게 확인해 주세요.',
        '공부가 눈에 띄게 늘지 않는 날에도 남는 것은 있어요. 헷갈린 부분을 말해 본 경험과 다시 확인한 표시가 다음 공부의 길을 만들어 줘요.',
        '아이에게는 잘한 결과만큼 다시 물어볼 수 있는 분위기가 중요해요. 모르는 것을 편하게 꺼내면 배움이 겁나는 일이 아니라 이어지는 일이 돼요.',
        '작은 칭찬과 짧은 복습은 아이가 자기 방식으로 배우는 감각을 키워 줘요. 오늘 하나라도 덜 헷갈린 부분을 함께 찾아보면 충분해요.',
        '학습은 한 번의 성과보다 다시 돌아올 수 있는 기준이 있을 때 단단해져요. 아이가 표시해 둔 부분을 같이 보고 다음에 볼 순서를 정해 주세요.',
        '오늘의 배움은 큰 자격이나 어려운 이름보다 생활 속 작은 경험으로 충분해요. 칭찬받은 점과 새로 알게 된 점을 짧게 나누면 공부가 더 편안하게 이어져요.',
      ]),
    )
    .replace(
      /잘 익은 가을 햇살처럼 따스한 흐름이에요\. 다음 세대와의 자리는 그 자체로 소중한 시간이고, 어떤 모양이든 무리하지 않고 흘러가는 결이 가장 좋아요\./g,
      pickVariant(ctx, 'sourceExpressionAutumnLight', [
        '따뜻한 오후처럼 오래 곁에 머무는 힘이 커지는 때예요. 무엇을 증명하려 애쓰기보다 편히 듣고 함께 웃는 시간이 가까운 사람에게 더 오래 남아요.',
        '오래 쌓인 표현은 큰 무대가 없어도 전해질 수 있어요. 함께 웃고, 짧게 이야기하고, 예전 기억을 꺼내는 시간이 가까운 사람에게 따뜻한 흔적으로 남아요.',
        '이 시기의 표현은 새로 증명하는 힘보다 부드럽게 나누는 힘에 가까워요. 다음 세대와 같은 시간을 보내며 편히 들어 주는 태도가 오래 기억될 수 있어요.',
        '가을 햇살처럼 차분한 온기가 어울리는 때예요. 무리해서 특별한 결과를 만들기보다, 지금 가진 이야기와 마음을 부담 없는 크기로 나누면 좋아요.',
        '차분히 익어 가는 계절처럼, 지금은 새로 증명하기보다 이미 가진 마음을 편하게 나누는 쪽이 잘 맞아요. 짧은 이야기와 따뜻한 시간이 충분한 표현이 될 수 있어요.',
        '오래 머문 햇빛처럼 부드러운 표현이 힘을 얻는 때예요. 큰 결과를 만들려 하기보다 가까운 사람에게 남길 말과 함께할 시간을 작게 고르면 좋아요.',
        '이 시기의 표현은 화려한 성과보다 편안한 온기에서 더 오래 남아요. 내가 지나온 이야기와 마음을 부담 없는 크기로 나누면 가까운 사람도 편하게 받아들여요.',
        '따뜻하게 익은 오후처럼 말과 마음을 천천히 나누기 좋은 흐름이에요. 특별한 무대를 만들지 않아도 함께 웃고 들어 주는 시간이 좋은 표현이 돼요.',
      ]),
    )
    .replace(
      /봄에서 여름으로 넘어가는 잎처럼 색이 진해지고 그늘이 넓어지는 시기예요\. 가까운 사람과 함께 만들 수 있는 작은 작업이 큰 자산이 돼요\./g,
      pickVariant(ctx, 'sourceExpressionAutumnHarvest', [
        '봄에서 여름으로 넘어가듯 표현의 색이 조금 더 깊어지는 때예요. 가까운 사람과 함께 남긴 말, 사진, 작은 작업이 나중에 다시 꺼낼 수 있는 힘이 돼요.',
        '색이 진해지는 계절처럼 지금까지의 시도가 조금씩 형태를 갖추는 시기예요. 혼자 완성하려 하기보다 가까운 사람과 작은 결과를 나누면 표현이 더 오래 남아요.',
        '이 시기에는 표현이 혼자만의 결과에 머물지 않고 가까운 사람과 나눌 이야기로 넓어질 수 있어요. 작은 협업이나 짧은 대화도 충분히 좋은 자산이 돼요.',
        '봄잎이 그늘을 넓히듯 내가 만든 말과 작업도 주변 사람에게 닿기 쉬워져요. 크게 보여 주려 하기보다 함께 만들 수 있는 작은 흔적부터 남겨 보세요.',
        '표현의 색이 깊어지는 때에는 결과의 크기보다 함께 남길 수 있는 장면이 중요해요. 가까운 사람과 나눈 짧은 작업도 나중에는 든든한 기록이 될 수 있어요.',
      ]),
    )
    .replace(
      /일과 가족의 자리가 함께 자라는 시기라 한쪽으로 무게가 쏠리지 않게 자기 호흡을 두면 좋아요\. 표현 결이 단단해지는 만큼 옆 사람과 나누는 자리도 자연스럽게 넓어지고, 그 흐름이 다음 세대에 닿는 결의 토대가 돼요\./g,
      pickVariant(ctx, 'sourceExpressionRoleBalance', [
        '일과 가족의 역할이 함께 커지는 시기라 한쪽으로만 기울지 않는 호흡이 중요해요. 표현력이 단단해질수록 가까운 사람과 나눌 말과 시간을 함께 챙기면, 그 경험이 다음 사람에게도 좋은 기준으로 이어져요.',
        '내 작업이 깊어질수록 가까운 사람과 나누는 시간도 같이 살펴야 해요. 일, 가족, 표현을 따로 보지 않고 작게 균형을 맞추면 오래 남는 힘이 돼요.',
        '역할이 커지는 시기에는 모든 것을 혼자 책임지려 하지 않는 편이 좋아요. 내가 남길 말과 함께 나눌 시간을 구분하면 표현도 관계도 덜 무거워져요.',
        '표현이 단단해질수록 주변 사람에게 닿는 방식도 중요해져요. 일의 속도와 가족 안의 시간을 함께 조절하면 나의 경험이 더 편안한 도움으로 전해져요.',
        '가까운 사람과 나눌 말이 생기는 때일수록 생활의 균형을 먼저 보세요. 일에만 몰리거나 관계에만 끌려가지 않게 작은 시간을 나누면 표현도 오래 이어져요.',
        '이 시기에는 내 작업과 가족 안의 역할이 함께 넓어질 수 있어요. 그래서 혼자 잘해 내는 것만 보지 말고, 가까운 사람과 나눌 시간과 쉬어 갈 기준도 함께 두는 편이 좋아요.',
        '표현이 깊어질수록 곁의 사람에게 어떤 방식으로 닿는지도 중요해져요. 일과 가족의 무게를 나누어 보고, 내가 남길 말과 함께 보낼 시간을 작게 정하면 다음 세대에도 더 편안하게 전해져요.',
        '일에서 보이는 자기 색과 가족 안에서 나누는 마음이 같이 자라는 때예요. 한쪽에만 힘을 몰기보다 말, 시간, 역할을 조금씩 나누면 표현도 관계도 오래 안정돼요.',
        '자기 표현이 단단해지는 만큼 가까운 사람에게도 그 힘이 닿을 수 있어요. 다만 모두를 이끌어야 한다는 부담보다 함께 나눌 수 있는 작은 장면을 만드는 쪽이 더 건강해요.',
      ]),
    )
    .replace(
      /가을 들판이 한 결로 익듯, 그동안의 시도들이 한꺼번에 익는 시기예요\. 다음 세대에게 무언가를 이어 주고 싶다는 마음도 자연스럽게 깊어지는데, 어떤 모양이 될지는 사람마다 다르게 풀려요\./g,
      pickVariant(ctx, 'sourceExpressionAutumnHarvest', [
        '가을 들판이 천천히 익어 가듯, 그동안 남긴 말과 작업이 뒤늦게 의미를 얻는 시기예요. 다음 사람에게 무엇을 전할지는 한 가지 모양으로 정하지 않아도 되고, 내 방식에 맞게 조금씩 드러나면 충분해요.',
        '오래 해 온 시도들이 한꺼번에 결과처럼 보일 수 있어요. 이때 중요한 것은 대단한 유산을 만들겠다는 부담보다, 내가 지나온 경험을 필요한 사람에게 편한 크기로 나누는 태도예요.',
        '지금까지 쌓아 온 표현이 익어 가며 누군가에게 도움이 될 수 있어요. 자녀, 후배, 가까운 사람에게 무엇이 전해질지는 사람마다 다르니, 모양을 단정하기보다 자연스럽게 나누는 편이 좋아요.',
        '이 시기에는 새로 증명하기보다 이미 쌓은 것을 차분히 정리하는 힘이 커져요. 남길 말과 보여 줄 작업을 작게 고르면, 다음 사람에게도 부담 없는 도움으로 전해질 수 있어요.',
        '그동안의 시도는 사라지지 않고 경험의 결실로 남아요. 누군가에게 이어 줄 마음이 생긴다면 큰 약속보다 짧은 조언, 함께한 시간, 정리된 기록부터 시작해도 충분해요.',
      ]),
    )
    .replace(
      /평생 자리에서 보면 지금은 자기 표현이 곁의 사람을 받쳐 주는 형태로 천천히 넓어져요\. 자기 작품만이 아닌 누군가의 자리를 함께 또렷하게 만들어 주는 표현이, 다음 시기의 단단한 자산이 되어 줘요\./g,
      pickVariant(ctx, 'sourceExpressionLegacyPath', [
        '길게 보면 지금의 표현은 나만 돋보이기 위한 결과보다 곁의 사람을 받쳐 주는 힘으로 넓어져요. 누군가가 자기 길을 더 또렷하게 볼 수 있도록 돕는 말과 작업이 다음 시기의 든든한 자산이 돼요.',
        '인생 전체로 보면 표현은 작품 하나에만 머물지 않아요. 내가 정리한 경험과 따뜻한 말이 가까운 사람의 선택을 밝혀 줄 때, 그 표현은 오래 남는 힘이 됩니다.',
        '지금의 표현은 나의 결과를 쌓는 동시에 다른 사람의 방향을 도울 수 있어요. 후배나 가까운 사람이 자기 길을 찾을 때 건넬 수 있는 말과 기록을 남기면 큰 자산이 돼요.',
        '표현의 힘은 혼자 완성한 결과보다 함께 길을 밝히는 장면에서 더 깊어질 수 있어요. 내가 해 온 일을 쉽게 풀어 주고, 필요한 사람에게 나눌 때 다음 시기의 의미가 커져요.',
        '시간이 지나면 내 표현은 누군가에게 참고할 지도처럼 남을 수 있어요. 작품의 크기보다 경험을 쉽게 설명하고 곁을 밝혀 주는 태도가 오래 힘이 됩니다.',
      ]),
    )
    .replace(
      /비유하자면 평생의 자리는 오래된 정원의 잘 자란 큰 나무 한 그루 같아요\. 가지 끝에 매달린 새 잎 하나하나에 욕심 내지 않아도, 큰 그늘이 곁의 작은 화초들을 자기 자리에서 자라게 받쳐 줘요\./g,
      pickVariant(ctx, 'sourceExpressionLifeGarden', [
        '비유하자면 평생의 표현은 오래된 정원의 큰 나무 같아요. 모든 잎을 완벽하게 돌보려 하지 않아도, 오래 쌓은 그늘이 곁의 작은 싹들을 각자의 속도로 자라게 도와줘요.',
        '큰 나무가 그늘을 내어 주듯, 오래 쌓인 표현은 주변 사람에게 편히 기대는 자리가 될 수 있어요. 작은 결과 하나하나에 조급해하지 않아도 지나온 시간이 충분한 힘이 됩니다.',
        '오래 가꾼 정원처럼 지금의 표현에는 이미 쌓인 시간이 있어요. 새 잎 하나에 매달리기보다 전체 그늘을 넓게 보고, 가까운 사람이 편히 자랄 공간을 남겨 주세요.',
        '비유하자면 지금의 표현은 오래 돌본 나무가 계절마다 그늘을 나누는 모습이에요. 내가 만든 말과 경험이 누군가에게 쉬어 갈 공간이 된다면 그것만으로도 충분히 값진 결과예요.',
        '평생의 표현은 한 번 피는 꽃보다 오래 자란 나무에 가까워요. 완벽한 결과를 서두르지 않아도, 꾸준히 남긴 말과 태도가 곁의 사람을 조용히 받쳐 줘요.',
      ]),
    )
    .replace(
      /다만 일과 가족 사이의 변화는 가까운 사람과 충분히 호흡을 맞춘 뒤 결정해도 늦지 않아요\. 큰 변화일수록 한 번에 밀어붙이기보다 단계적으로 접근하는 방식이 잘 어울려요\./g,
      pickVariant(ctx, 'sourceMovementFamilyDecision', [
        '다만 일과 가족이 함께 흔들리는 변화라면 가까운 사람과 먼저 속도를 맞추는 편이 좋아요. 큰 이동일수록 한 번에 밀어붙이기보다 일정, 비용, 회복 시간을 나누어 확인하면 부담이 줄어요.',
        '가족의 생활과 내 일이 함께 걸린 결정은 조금 늦게 정해도 괜찮아요. 서로의 일정과 걱정을 먼저 듣고 단계별로 옮기면 변화가 훨씬 안정적으로 이어져요.',
        '큰 변화 앞에서는 내 마음만 빠르게 앞서가면 주변이 따라오기 어려울 수 있어요. 가족이나 동료와 맞출 기준을 먼저 정하면 새 환경도 덜 급하게 받아들일 수 있어요.',
        '일과 가족 사이의 선택은 빠른 결론보다 함께 확인한 기준이 중요해요. 누가 어떤 부담을 나눌지 살피고 움직이면, 변화가 갈등보다 협의에 가까워져요.',
        '생활의 폭을 바꾸는 결정은 한 사람의 의지만으로 끝나지 않을 때가 많아요. 가까운 사람의 리듬을 함께 보며 작게 나누어 옮기면 새 변화도 오래 버텨 줘요.',
      ]),
    )
    .replace(
      /비유하자면 30대의 큰 이동은 산길에서 다음 고개를 차분히 넘는 과정이에요\. 한 번에 정상까지 오르려 하지 않아도, 한 단계씩 넘은 경험이 뒤의 시야를 넓혀 줘요\./g,
      pickVariant(ctx, 'sourceMovementLifeMetaphor', [
        '비유하자면 30대의 이동은 산길에서 한 고개씩 넘는 과정이에요. 단번에 멀리 가려 하지 않아도, 한 단계씩 확인하며 옮긴 경험이 뒤의 선택을 더 넓게 보여 줘요.',
        '이 시기의 큰 변화는 정상까지 뛰어오르는 일보다 다음 고개를 무리 없이 넘는 일에 가까워요. 중간에 쉬어 갈 지점을 정하면 변화 뒤에 남는 시야도 더 선명해져요.',
        '산길을 오르듯 30대의 이동도 속도보다 호흡이 중요해요. 오늘 넘을 고개와 잠시 머물 곳을 함께 정하면 다음 선택이 덜 흔들려요.',
        '큰 이동은 한 번의 도약보다 여러 번의 확인으로 안전해져요. 한 단계씩 익히고 넘어갈수록 뒤돌아볼 때 길이 더 또렷하게 남아요.',
        '30대의 변화는 멀리 뛰는 힘보다 다음 고개를 차분히 넘는 힘에서 안정돼요. 작게 옮기고 충분히 익힌 경험이 나중의 큰 결정을 받쳐 줘요.',
      ]),
    )
    .replace(
      /30대의 변화는 나 혼자 빨리 움직이는 일보다 함께 흔들리지 않을 기준을 세우는 일이 중요해요\. 가족, 동료, 생활비, 쉬는 시간을 함께 살피면 새 환경도 더 편하게 받아들일 수 있어요\./g,
      pickVariant(ctx, 'sourceMovementFamilyDecision', [
        '30대의 변화는 혼자 빠르게 움직이는 것보다 함께 흔들리지 않을 기준을 세우는 데서 안정돼요. 가족과 동료에게 미리 알릴 일, 지킬 생활비, 쉬어 갈 시간을 같이 보면 새 환경도 더 현실적으로 받아들일 수 있어요.',
        '이 시기에는 이동 자체보다 움직인 뒤의 생활이 중요해요. 함께 영향을 받는 사람과 쓸 돈, 비워 둘 시간을 먼저 맞추면 변화가 오래 버틸 수 있어요.',
        '새 환경을 고를 때는 내 의욕뿐 아니라 주변의 리듬도 같이 봐야 해요. 가족과 동료의 일정, 지킬 생활비, 쉬어 갈 시간이 보이면 결정이 덜 불안해져요.',
        '혼자 먼저 달려가면 빠를 수는 있지만 오래 안정되기는 어려울 수 있어요. 같이 맞출 기준을 정하고 움직이면 새 환경도 생활 안으로 더 부드럽게 들어와요.',
        '30대의 이동은 생활 전체를 다시 배치하는 선택이 되기 쉬워요. 함께 볼 사람, 쓸 돈, 비워 둘 시간, 쉬어 갈 여유를 같이 점검하면 변화가 무리한 사건보다 관리 가능한 과정이 돼요.',
      ]),
    )
    .replace(
      /흐르는 강물처럼 자리에 닿을 때마다 충분히 익히고 다음 자리로 옮기는 호흡이 잘 맞아요\. (?:자리를 무리해서 바꾸려 하기보다, 익숙한 자리에서 시야를 넓히는 결|무리한 자리 변경 대신 익숙한 자리에서 시야를 넓히는 결|무리한 자리 변경 대신 익숙한 자리에서 시야를 넓히는 흐름)이 결실에 가까워요\./g,
      pickVariant(ctx, 'sourceMovementLifeCurrent', [
        '새 환경에 닿을 때마다 충분히 익히고 다음 단계로 넘어가는 호흡이 잘 맞아요. 무리하게 바꾸기보다 익숙한 곳에서 시야를 넓히면 변화가 더 실속 있게 남아요.',
        '이 이동은 빠르게 자리를 바꾸는 경쟁이 아니에요. 한곳에서 배운 점을 충분히 정리한 뒤 다음 환경으로 옮겨 갈 때 결과가 더 단단해져요.',
        '새로운 곳을 만날 때는 바로 다음 변화로 넘어가기보다 적응한 시간을 먼저 확인해 보세요. 익숙한 기준 위에서 시야를 넓히면 이동이 부담보다 자산으로 남아요.',
        '흐르는 물도 굽이를 지나며 속도를 조절하듯, 변화에도 익숙해질 시간이 필요해요. 무리한 변경보다 지금 있는 곳에서 넓어진 시야를 챙기는 편이 좋아요.',
        '새 환경은 많이 거치는 것보다 충분히 익히는 과정이 더 중요할 때가 있어요. 배운 것과 남길 것을 정리하면 다음 이동도 훨씬 안정적으로 이어져요.',
      ]),
    )
    .replace(
      /한 자리를 옮길 때마다 짐 한 보따리를 정리해 보세요\. 가져갈 것과 두고 갈 것을 한 번 더 가려 두면 새 자리에 닿았을 때 호흡이 가벼워지고, 다음 자리에서의 시야도 또렷해져요\./g,
      pickVariant(ctx, 'sourceMovementBaggage', [
        '한곳을 옮길 때마다 가져갈 것과 두고 갈 것을 작게 나누어 보세요. 물건뿐 아니라 약속, 관계, 생활 습관도 함께 정리하면 새 환경에서 호흡이 훨씬 가벼워져요.',
        '이동이 생길 때는 짐만 싸기보다 마음의 짐도 같이 덜어 보는 편이 좋아요. 계속 가져갈 기준과 내려놓을 부담이 나뉘면 다음 단계의 시야가 더 또렷해져요.',
        '새 환경으로 옮길 때마다 모든 것을 그대로 들고 갈 필요는 없어요. 필요한 것과 잠시 두어도 되는 것을 고르면 변화가 훨씬 가볍게 시작돼요.',
        '움직임 앞에서는 정리가 먼저 도움이 될 때가 많아요. 가져갈 물건, 남길 약속, 다시 볼 일을 나누면 새 곳에 닿았을 때 생활이 덜 복잡해져요.',
        '한 번 이동할 때마다 작은 정리 시간을 남겨 보세요. 무엇을 가져가고 무엇을 내려놓을지 알면 다음 환경에서도 자기 기준을 더 빨리 찾을 수 있어요.',
      ]),
    );
  return softenPublicTone(sourceVariantValue)
    .replace(
      /표현과 돌봄의 흐름은 한 번에 드러나기보다 꾸준히 쌓이면서 힘이 나요\./g,
      pickVariant(ctx, 'sourceExpressionSmallWorks', [
        '표현과 돌봄은 한 번에 크게 드러나기보다 작은 흔적이 쌓이며 힘을 얻어요.',
        '표현하고 돌보는 힘은 매일 조금씩 남긴 말과 태도에서 천천히 자라요.',
        '표현과 돌봄의 흐름은 큰 결과보다 자주 확인하고 다듬는 과정에서 단단해져요.',
        '말, 글, 창작, 돌봄은 급하게 완성할수록 부담이 커질 수 있어요. 작게 남기고 다시 보는 방식이 더 오래 가요.',
        '이 영역은 한 번의 성과보다 꾸준히 살핀 마음이 더 중요해요. 짧은 기록과 작은 질문이 다음 표현의 바탕이 돼요.',
        '표현과 돌봄은 잘해야 하는 숙제보다 자주 돌아보는 생활에 가까워요. 조금씩 다듬는 태도가 오래 갈 힘을 만들어 줘요.',
      ]),
    )
    .replace(
      /평생의 따뜻함이 이어지는 시기이니, 서두르지 말고 천천히 누리면 좋아요\./g,
      pickVariant(ctx, 'sourceFamilySmallCare', [
        '오래 쌓인 따뜻함이 이어지는 시기이니, 급하게 정리하려 하기보다 천천히 누리는 편이 좋아요.',
        '가족에게 남긴 마음이 차분히 이어지는 때예요. 큰 결론보다 오늘 편히 나눌 시간 하나를 소중히 두면 좋아요.',
        '평생 쌓아 온 정이 가까운 사람에게 부드럽게 전해지는 흐름이에요. 서두르지 말고 편한 안부와 작은 시간을 천천히 누려 보세요.',
        '이 시기에는 새로 무언가를 증명하기보다 이미 남아 있는 따뜻함을 편히 확인하는 것이 좋아요. 함께 웃는 시간만으로도 충분해요.',
        '가까운 사람들과의 온기가 오래 이어지는 흐름이에요. 모든 관계를 바로 정리하려 하지 말고, 오늘 나눌 수 있는 작은 정부터 살펴보세요.',
        '오래 함께한 관계는 빠른 결론보다 편히 머무는 시간에서 더 깊어져요. 오늘은 안부 하나, 식사 한 번, 조용한 미소처럼 작은 온기를 챙겨 보세요.',
        '가족에게 남는 것은 큰 정리보다 반복해서 느낀 편안함일 때가 많아요. 서두르지 않고 곁에 있어 주는 시간이 충분한 선물이 될 수 있어요.',
        '지나온 시간이 만든 따뜻함은 억지로 설명하지 않아도 전해질 수 있어요. 짧은 대화와 익숙한 식사처럼 편한 장면을 천천히 누려 보세요.',
        '오래 쌓인 마음은 한 번의 행사보다 평소의 안부와 태도에서 더 잘 살아나요. 오늘 가능한 작은 배려 하나가 관계를 부드럽게 이어 줘요.',
        '가까운 사람과의 시간은 급하게 정답을 찾는 자리보다 편히 숨 돌리는 시간이면 충분해요. 함께 앉아 있는 것만으로도 마음은 많이 누그러져요.',
        '가족의 온기는 크게 말하지 않아도 생활 속에서 오래 남아요. 자주 묻는 안부, 천천히 듣는 태도, 같이 보내는 짧은 시간이 좋은 기준이 돼요.',
        '이미 쌓아 온 정이 있다면 이제는 더 크게 애쓰기보다 편히 나누는 쪽이 잘 맞아요. 부담 없는 연락과 작은 웃음이 관계를 안정시켜요.',
        '오래된 관계일수록 빨리 고치기보다 다시 편히 만날 수 있는 분위기를 남기는 편이 좋아요. 오늘 할 수 있는 작은 온기부터 챙겨 보세요.',
        '가족에게 전해지는 힘은 말의 크기보다 자주 보여 준 태도에서 나와요. 급하게 이끌기보다 곁을 편하게 내어 주면 마음이 오래 남아요.',
        '이 시기의 따뜻함은 새로 만들어 내는 것이 아니라 이미 이어 온 마음을 확인하는 데 가까워요. 작게 묻고, 천천히 듣고, 편히 웃는 시간이 좋아요.',
        '큰 역할을 하지 않아도 가족 안의 온기는 충분히 이어질 수 있어요. 오늘 나눌 수 있는 짧은 말과 작은 시간을 소중히 두면 됩니다.',
        '가까운 사람들에게 남길 것은 완벽한 조언보다 편안한 기억일 수 있어요. 서두르지 않고 함께 머무는 시간이 그 기억을 만들어 줘요.',
        '오래된 가족의 정은 천천히 확인할수록 더 편안해져요. 해결할 이야기를 모두 꺼내기보다 오늘 편히 나눌 수 있는 마음부터 고르면 좋아요.',
        '함께해 온 시간이 있다면 관계를 크게 증명하지 않아도 괜찮아요. 익숙한 안부와 작게 나눈 고마움이 따뜻함을 오래 이어 줘요.',
        '이 시기에는 가족을 이끌어야 한다는 마음보다 편히 기대고 기대어 주는 시간이 더 중요해요. 작은 정을 천천히 나누면 관계가 부드럽게 남아요.',
      ]),
    )
    .replace(
      /장기 이동운은 새로운 경험을 통해 배우는 힘과 연결돼요\./g,
      pickVariant(ctx, 'sourceMovementLaterLifePace', [
        '긴 시간의 이동과 변화는 새로운 경험을 통해 시야를 넓히는 힘과 이어져요.',
        '오래 보면 이동과 변화는 낯선 환경에서 배운 것을 내 기준으로 바꾸는 과정이에요.',
        '인생 전체의 이동과 변화는 많이 떠나는 일보다 경험에서 배운 기준을 남기는 일이 중요해요.',
        '새로운 곳을 만나는 일은 생활의 시야를 넓혀 줄 수 있어요. 다만 다녀온 뒤 지킬 리듬을 함께 남길 때 변화가 더 안전해져요.',
      ]),
    )
    .replace(
      /장기 이동운은 무조건 많이 움직이는 것보다 필요한 변화만 고르는 쪽이 안정적이에요\./g,
      pickVariant(ctx, 'sourceMovementLaterLifePace', [
        '긴 시간의 이동과 변화는 많이 움직이는 쪽보다 꼭 필요한 변화를 고르는 편이 안정적이에요.',
        '오래 이어지는 변화에서는 이동의 횟수보다 생활이 덜 흔들리는지가 중요해요.',
        '인생 전체의 이동과 변화는 새로운 곳을 많이 가는 경쟁이 아니에요. 필요한 변화와 지켜야 할 생활 기준을 함께 고를 때 더 안정적이에요.',
        '큰 변화가 보일수록 어디로 갈지뿐 아니라 무엇을 지킬지도 함께 봐야 해요. 그래야 새 환경이 부담보다 선택으로 남아요.',
      ]),
    )
    .replace(
      /오래 이어지는 이동과 변화에서는 많이 움직이는 것보다 꼭 필요한 변화를 고르는 편이 안정적이에요\./g,
      pickVariant(ctx, 'sourceMovementLaterLifePace', [
        '오래 보면 이동과 변화는 많이 움직이는 일보다 내 생활에 맞는 변화를 고르는 과정이에요. 필요한 움직임과 지켜야 할 기준이 함께 보이면 선택이 더 안정돼요.',
        '긴 흐름의 이동은 멀리 가는 횟수보다 변화 뒤에 생활이 편해지는지가 더 중요해요. 새 환경이 남길 부담과 다녀온 뒤 여유를 함께 보면 선택도 덜 막연해져요.',
        '인생 전체의 이동과 변화는 새 장소를 많이 찾는 경쟁이 아니에요. 내 생활을 지키면서 바꿔 볼 부분을 고르면 변화가 더 오래 도움이 돼요.',
        '오래 이어지는 변화에서는 떠나는 힘만큼 돌아와 정리하는 힘도 필요해요. 꼭 필요한 이동을 고르고, 쉬어 갈 기준을 남기면 흐름이 덜 흔들려요.',
        '새로운 변화의 기회가 보여도 모두 잡을 필요는 없어요. 생활을 가볍게 하는 변화와 부담을 키우는 변화를 나누면 판단이 훨씬 쉬워져요.',
        '이동과 변화는 넓게 움직이는 만큼 익숙한 기준을 지키는 일도 중요해요. 바꿀 동선과 그대로 둘 생활 리듬을 나누면 긴 흐름이 안정돼요.',
        '긴 시간으로 보면 좋은 변화는 생활을 무너뜨리지 않고 시야를 넓혀 주는 쪽이에요. 그래서 이동의 크기보다 준비와 회복의 균형을 먼저 보는 편이 좋아요.',
        '오래 이어지는 이동 흐름은 새로움만 좇으라는 뜻이 아니에요. 나에게 필요한 변화인지, 다녀온 뒤 회복할 수 있는지 확인할 때 더 실속 있게 쓰여요.',
      ]),
    )
    .replace(
      /환경 변화는 한 번에 끝나는 일이 아니에요\. 준비할 시간, 적응할 시간, 다시 쉴 시간을 함께 두면 더 안전해요\./g,
      pickVariant(ctx, 'sourceMovementLaterLifePace', [
        '환경을 바꾸는 일은 결정한 날에 끝나지 않아요. 준비하고 적응하고 회복할 시간을 함께 잡아야 변화가 덜 흔들려요.',
        '새 환경은 출발하는 순간보다 익숙해지는 과정에서 진짜 부담이 보여요. 준비할 것, 익숙해질 것, 쉬어 갈 시간을 나누면 변화가 더 편안해져요.',
        '변화를 선택했다면 그 뒤의 며칠도 함께 계획하는 편이 좋아요. 첫날 일정만 보지 말고 잠, 식사, 정리 시간을 남기면 새 흐름이 덜 버거워요.',
        '이동과 변화는 한 번의 결심보다 적응 과정이 더 중요해요. 다녀온 뒤 몸이 어떤지, 마음이 편한지 확인할 시간을 남기면 다음 선택도 쉬워져요.',
        '새로운 환경을 고를 때는 시작 조건과 마무리 조건을 함께 봐야 해요. 준비물과 쉬는 시간이 정해지면 낯선 변화도 생활 안으로 부드럽게 들어와요.',
        '새 환경에 들어갈 때는 출발만큼 적응 시간이 중요해요. 준비 기간과 쉬어 갈 시간을 남기면 몸과 마음이 더 안전해져요.',
        '변화는 시작보다 이어 가는 과정에서 부담이 드러나요. 미리 준비하고, 익숙해질 시간을 두고, 돌아와 쉴 여유를 남겨 보세요.',
        '새로운 선택은 출발보다 적응 과정에서 진짜 부담이 보일 때가 많아요. 준비할 것, 익숙해질 것, 쉬어 갈 것을 나누면 훨씬 안정적이에요.',
        '변화를 고를 때는 시작 날짜만 보지 말고 그 뒤의 생활도 함께 봐야 해요. 적응할 시간과 회복할 시간을 남기면 새 환경이 덜 무겁게 느껴져요.',
        '큰 변화일수록 한 번에 끝내려 하지 않는 편이 좋아요. 준비, 적응, 휴식을 나누면 새 환경도 더 편하게 받아들일 수 있어요.',
        '새로운 환경은 들어가는 순간보다 자리 잡는 시간이 더 중요해요. 일정과 체력을 조금 남겨 두면 변화가 생활 안에 부드럽게 들어와요.',
        '새 환경에 익숙해지려면 여유 시간이 필요해요. 첫날의 속도보다 며칠 뒤에도 지킬 수 있는 생활 리듬을 남겨 두세요.',
        '새로운 곳에서는 잘 해내는 것만큼 편하게 적응하는 일이 중요해요. 잠, 식사, 이동 시간을 조금 넉넉히 잡으면 부담이 줄어요.',
      ]),
    )
    .replace(
      /한곳에만 머물기보다 새 환경을 조금씩 경험해 보는 것이 도움이 돼요\. 출장, 여행, 교환학생 같은 기회에 작게라도 발을 디디면 그다음 결정이 더 현실적으로 보여요\./g,
      pickVariant(ctx, 'sourceMovementNearby', [
        '한곳에만 오래 머물기보다 가끔은 새 환경을 작게 경험해 보는 일이 도움이 돼요. 짧은 여행, 출장, 새로운 활동처럼 부담이 작은 변화부터 해 보면 다음 선택이 더 현실적으로 보여요.',
        '새 환경은 멀리 떠나야만 만나는 것이 아니에요. 가까운 장소, 다른 동선, 짧은 체험을 통해서도 내게 맞는 변화의 크기를 확인할 수 있어요.',
        '생활의 폭을 넓히고 싶다면 큰 이동보다 작은 경험부터 시작해 보세요. 시간과 비용이 부담스럽지 않은 변화가 다음 결정을 고르는 기준이 돼요.',
        '새로운 곳에 발을 디디는 일은 막연한 상상을 실제 기준으로 바꾸어 줘요. 다녀온 뒤 무엇이 편했고 무엇이 부담이었는지 남기면 다음 선택이 쉬워져요.',
        '변화가 필요할 때는 한 번에 멀리 가기보다 작게 시험해 보는 편이 안정적이에요. 짧은 일정이나 익숙한 사람과의 이동이 좋은 출발점이 될 수 있어요.',
        '새 환경을 만나는 경험은 내 생활의 가능성을 넓혀 줘요. 다만 움직인 뒤에는 비용, 체력, 마음의 반응을 같이 확인해야 그 경험이 내 기준으로 남아요.',
      ]),
    )
    .replace(
      /다만 가벼운 마음으로 환경만 바꾸면 다시 (?:안정감을|익숙한 리듬을) 찾는 시간이 늦어질 수 있어요\. 한 번 옮긴 곳에서 충분히 배우고 정리하는 호흡이 잘 어울려요\./g,
      pickVariant(ctx, 'sourceMovementReturnBase', [
        '다만 기분 전환만 바라보고 환경을 바꾸면 다시 안정되는 데 시간이 걸릴 수 있어요. 한 번 옮긴 곳에서는 무엇을 배웠는지 정리하고 쉬어 갈 여유를 남겨 두세요.',
        '새 환경이 좋더라도 곧바로 다음 변화를 찾을 필요는 없어요. 한곳에서 익숙해지고, 몸과 마음이 적응한 뒤 다음 선택을 보는 편이 더 안정적이에요.',
        '환경을 바꾸는 일은 시작보다 정리가 더 중요할 때가 많아요. 낯선 곳에서 배운 점과 힘들었던 점을 나누면 다음 이동의 부담이 줄어요.',
        '가볍게 바꾼 환경도 생활 리듬에는 영향을 줄 수 있어요. 잠, 식사, 정리 시간을 다시 맞춘 뒤 다음 변화를 고르면 흐름이 덜 흔들려요.',
        '새로운 곳에 들어간 뒤에는 충분히 익숙해질 시간이 필요해요. 바로 또 움직이기보다 배운 것과 남길 것을 정리하면 변화가 더 실속 있게 남아요.',
        '환경만 바꾼다고 마음이 바로 편해지는 것은 아니에요. 새 장소에서 내 리듬을 회복할 시간을 함께 잡아야 다음 단계도 차분하게 이어져요.',
      ]),
    )
    .replace(
      /낯선 장소, 다른 사람, 새로운 일정을 만날수록 선택지는 넓어져요\. 다만 너무 자주 바꾸면 마음의 중심을 잡기 어려울 수 있어요\./g,
      pickVariant(ctx, 'sourceMovementNearby', [
        '낯선 장소와 새로운 사람을 만나면 시야가 넓어질 수 있어요. 다만 변화가 너무 잦으면 무엇이 나에게 맞는지 알아차릴 시간이 부족해져요.',
        '새로운 일정은 생각의 폭을 넓혀 주지만, 계속 바뀌기만 하면 마음이 쉽게 지칠 수 있어요. 바꿀 것과 지킬 것을 함께 정해 두세요.',
        '새 장소를 경험하는 일은 좋은 자극이 될 수 있어요. 대신 돌아와 정리할 시간이 있어야 그 경험이 내 기준으로 남아요.',
        '새로운 장소를 만났다면 좋았던 점과 불편했던 점을 짧게 나누어 보세요. 그 기록이 있어야 다음 이동이 막연한 기대보다 현실적인 선택이 돼요.',
        '낯선 장소는 시야를 넓혀 주지만, 다녀온 뒤 몸과 마음이 어땠는지도 함께 봐야 해요. 피로와 설렘을 같이 적어 두면 다음 움직임이 더 안전해져요.',
        '새로운 일정은 좋은 자극이 될 수 있지만 계속 바뀌기만 하면 쉽게 지칠 수 있어요. 돌아와 쉴 시간과 정리할 시간을 남겨야 경험이 내 기준으로 쌓여요.',
        '장소가 달라지면 생각도 넓어질 수 있어요. 다만 변화가 생활을 편하게 했는지 부담을 키웠는지 확인해야 다음 선택이 더 또렷해져요.',
        '사람과 장소가 달라질수록 선택지는 많아져요. 그럴수록 내 생활에서 꼭 지킬 리듬 하나를 남겨 두는 편이 안정적이에요.',
      ]),
    )
    .replace(
      /새로운 곳을 경험하더라도 돌아올 루틴 하나는 남겨 두세요\. 자기 페이스를 지키는 이동이 가장 안전한 변화예요\./g,
      pickVariant(ctx, 'sourceMovementReturnBase', [
        '새로운 곳을 경험하더라도 돌아와 회복할 기준은 남겨 두세요. 내 페이스를 지키는 변화가 가장 오래 도움이 돼요.',
        '낯선 곳에 가더라도 돌아와서 다시 잡을 생활 리듬이 필요해요. 잠, 식사, 정리 시간 중 하나만 지켜도 변화가 덜 부담스러워요.',
        '새 경험이 좋게 남으려면 다녀온 뒤 정리할 기준도 함께 있어야 해요. 쉬는 시간과 정리할 시간을 남기면 이동 뒤의 피로가 줄어요.',
        '낯선 곳을 경험한 뒤에는 무엇이 편했고 무엇이 힘들었는지 짧게 남겨 보세요. 그 기록이 다음 이동의 부담을 줄여 줘요.',
        '좋은 변화는 떠나는 순간보다 돌아온 뒤의 생활에서 더 분명해져요. 쉴 시간과 정리할 시간을 남겨야 경험이 내 기준으로 쌓여요.',
        '새 환경이 도움이 되었는지는 다녀온 뒤 몸과 마음의 반응을 보면 더 잘 보여요. 피로와 설렘을 함께 적어 두면 다음 선택이 차분해져요.',
        '새로운 움직임은 내 생활을 무너뜨리지 않을 때 더 좋은 경험이 돼요. 돌아와 회복할 시간을 먼저 잡아 두면 마음이 한결 편해져요.',
      ]),
    )
    .replace(
      /친구와 함께한 짧은 여행도, 한 학기 동안의 새 학교 생활도 나중에 좋은 자산이 될 수 있어요\. 두려운 마음보다 호기심을 조금 앞세우면 새 환경도 더 빨리 친근해져요\./g,
      pickVariant(ctx, 'sourceMovementNearby', [
        '친구와 다녀온 짧은 여행이나 새 학교에서 보낸 시간은 나중에 좋은 기억이 될 수 있어요. 처음부터 편하지 않아도 호기심을 조금 남기면 적응이 쉬워져요.',
        '새로운 활동은 꼭 거창하지 않아도 괜찮아요. 친구와 가 본 장소, 새 반에서 익힌 규칙처럼 작은 경험이 나중에 자기 기준을 넓혀 줘요.',
        '낯선 환경은 처음엔 긴장되지만, 한 장면씩 익숙해지면 좋은 배움으로 남아요. 두려움을 없애려 하기보다 궁금한 것 하나를 찾아보면 좋아요.',
        '여행, 체험, 새 학교 생활은 나를 설명하는 경험이 될 수 있어요. 마음에 남은 장면을 짧게 기록하면 다음 변화도 덜 낯설어져요.',
      ]),
    )
    .replace(
      /다만 너무 자주 환경을 바꾸면 마음이 익숙해질 시간이 부족해질 수 있어요\. 한곳에서 충분히 익숙해지는 시간을 가져야 다음 변화도 더 단단하게 받아들일 수 있어요\./g,
      pickVariant(ctx, 'sourceMovementNearby', [
        '다만 변화가 너무 잦으면 마음이 따라갈 시간이 부족할 수 있어요. 한곳에서 충분히 익숙해지는 경험이 있어야 다음 변화도 편하게 받아들일 수 있어요.',
        '새로운 곳을 자주 만나는 것도 좋지만, 익숙해질 시간 없이 계속 바뀌면 쉽게 지칠 수 있어요. 이번에는 적응할 시간을 넉넉히 남겨 보세요.',
        '환경을 자주 바꿀수록 내 기준을 세울 시간이 필요해요. 한곳에서 편해지는 경험을 충분히 해 본 뒤 다음 변화를 고르는 편이 좋아요.',
        '계속 새로움만 찾으면 마음이 쉬어 갈 곳을 잃기 쉬워요. 익숙해지는 시간을 먼저 가진 뒤 다음 움직임을 정하면 더 안정적이에요.',
      ]),
    )
    .replace(
      /30대의 큰 이동은 자기 한 사람만이 아니라 가까운 사람의 생활도 함께 움직이는 시간이에요\. 자기 페이스만 앞서가지 않게 가족·동료의 호흡과 한 박자 맞추면, 30대의 변화를 더 안정적으로 받쳐 줄 수 있어요\./g,
      pickVariant(ctx, 'sourceMovementReturnBase', [
        '30대의 큰 이동은 나만의 결정으로 끝나지 않을 때가 많아요. 가족과 동료의 일정, 생활 리듬, 부담을 함께 맞추면 변화가 훨씬 안정적으로 이어져요.',
        '이 시기의 이동은 가까운 사람들의 생활도 함께 흔들 수 있어요. 내 속도만 앞세우기보다 같이 맞출 부분을 확인하면 결정이 더 오래 버텨 줘요.',
        '30대에 큰 변화를 고를 때는 내 마음과 주변의 생활 리듬을 함께 보는 편이 좋아요. 같이 맞출 시간을 남겨 두면 이동 뒤의 부담도 줄어요.',
        '큰 이동이 열릴수록 먼저 함께 움직이는 사람들을 떠올려 보세요. 가족, 동료, 생활비, 회복 시간을 같이 살피면 변화가 무리보다 선택에 가까워져요.',
        '30대의 변화는 혼자 빨리 가는 일보다 함께 흔들리지 않을 기준을 세우는 일이 중요해요. 주변의 호흡을 확인하면 새 환경도 더 편하게 받아들일 수 있어요.',
      ]),
    )
    .replace(
      /비유하자면 30대의 큰 이동은 산길에서 고갯마루 한 자리를 넘어 두는 시간이에요\. 한 번에 정상까지 오르지 않아도, 한 고개씩 천천히 넘어 두는 자리가 30대 후반의 든든한 시야를 만들어 줘요\./g,
      pickVariant(ctx, 'sourceMovementNearby', [
        '비유하자면 30대의 이동은 산길에서 한 고개씩 넘어가는 과정이에요. 단번에 멀리 가려 하지 않아도, 한 단계씩 넘은 경험이 뒤의 시야를 넓혀 줘요.',
        '이 시기의 큰 변화는 정상까지 뛰어오르는 일보다 다음 고개를 차분히 넘는 일에 가까워요. 짧은 변화를 잘 마무리하면 다음 선택이 훨씬 또렷해져요.',
        '산길을 오르듯 30대의 이동도 중간 지점을 확인하며 가는 편이 좋아요. 한 번에 끝내려 하지 않으면 변화 뒤에 남는 시야가 더 단단해져요.',
        '큰 이동은 한 번의 도약보다 여러 번의 확인으로 안전해져요. 오늘 넘을 고개와 쉬어 갈 자리를 정하면 30대 후반의 선택도 더 넓게 보입니다.',
        '30대의 이동을 산길에 비유하면, 중요한 것은 속도보다 다음 고개를 무리 없이 넘는 힘이에요. 한 단계씩 익히면 뒤돌아볼 때 길이 더 분명해져요.',
      ]),
    )
    .replace(
      /흐르는 강물처럼 새 환경으로 향할 때 한 박자 쉬어 가는 호흡을 두면, 결정의 질이 한 단계 올라가요\. 출장·해외 일정은 무리해서 만들지 않아도 자연스럽게 한 번씩 열려요\./g,
      pickVariant(ctx, 'sourceMovementReturnBase', [
        '새 환경으로 향할 때는 강물처럼 흐르되 중간에 숨 고를 자리를 두는 편이 좋아요. 출장이나 해외 일정은 억지로 만들기보다 열릴 때 조건을 차분히 확인해 보세요.',
        '이동의 기회가 보이면 바로 뛰어들기보다 한 박자 쉬어 가는 호흡이 필요해요. 준비와 회복 시간을 함께 보면 결정의 질이 더 좋아져요.',
        '새 환경을 향한 움직임은 빠른 결정보다 안정된 준비와 잘 맞아요. 출장, 여행, 해외 일정이 열릴 때는 생활 리듬을 함께 확인하면 좋아요.',
        '흐름이 열릴 때일수록 잠깐 멈춰 조건을 살피는 힘이 중요해요. 무리해서 기회를 만들지 않아도, 준비된 이동은 자연스럽게 다음 길을 보여 줘요.',
      ]),
    )
    .replace(
      /강물이 새 길을 내듯 한 곳에만 머물기보다 새 환경을 경험해 볼 시기예요\. 출장·여행·교환학생 같은 기회에 한 번씩 발을 디디면, 그다음 결정이 더 자기 모양에 맞아요\./g,
      pickVariant(ctx, 'sourceMovementNearby', [
        '새 길을 내는 물길처럼, 익숙한 곳 밖의 경험이 시야를 넓혀 줄 수 있어요. 여행, 출장, 교환학생 같은 기회는 작게라도 직접 경험해 보면 다음 결정이 현실적으로 보입니다.',
        '한곳에만 머물기보다 새 환경을 조금씩 만나 보는 것이 도움이 돼요. 다만 발을 디딘 뒤에는 무엇이 맞았는지 기록해 두어야 다음 선택이 더 내 모양에 가까워져요.',
        '새로운 장소를 경험해 보는 일은 막연한 상상보다 훨씬 분명한 기준을 줘요. 짧은 여행이나 출장처럼 부담 적은 변화도 다음 방향을 고르는 데 도움이 돼요.',
        '새 환경에 한 번 발을 들이면 내가 편한 속도와 어려운 조건이 더 잘 보여요. 이동의 크기보다 경험 뒤에 남길 기준을 챙기는 편이 중요해요.',
      ]),
    )
    .replace(
      /작은 부딪힘이 생길 때는 바로 결론을 내리기보다 말투와 역할을 먼저 확인해 보세요\. 누가 무엇을 맡을지, 어디까지 기다릴지 짧게 정하면 빈틈이 줄고 서운함이 커지기 전에 멈출 수 있어요\./g,
      pickVariant(ctx, 'sourceFamilySmallCare', [
        '사소한 서운함이 보이면 바로 결론을 내리기보다 말투와 역할을 먼저 살펴보세요. 누가 무엇을 맡을지 짧게 나누면 마음이 크게 엇갈리기 전에 정리할 수 있어요.',
        '가족 사이에서도 말이 어긋나는 순간은 생길 수 있어요. 그때는 누가 맞는지부터 따지기보다 맡을 일과 기다릴 시간을 나누어 두면 부담이 덜 커져요.',
        '역할이 헷갈릴수록 확인을 미루지 않는 편이 좋아요. 해야 할 일, 부탁할 일, 조금 기다릴 일을 짧게 나누면 작은 빈틈이 큰 서운함으로 번지지 않아요.',
        '가까운 사이일수록 마음을 알아주겠지 하고 넘기기 쉬워요. 말투와 약속을 한 번 더 확인하면 작은 오해가 오래 남는 일을 줄일 수 있어요.',
        '서운한 마음이 올라올 때는 바로 판단하기보다 역할과 기대를 작게 나누어 보세요. 서로의 기준이 보이면 말도 덜 날카로워지고 관계도 안정돼요.',
        '함께 사는 기준이 달라질 때는 작은 확인이 큰 도움이 돼요. 누가 챙길 일인지, 언제 다시 이야기할지 정해 두면 빈틈이 줄고 마음도 덜 흔들려요.',
        '가족 안의 작은 충돌은 빨리 이기는 문제로 보지 않는 편이 좋아요. 말의 온도와 역할의 크기를 함께 조절하면 서운함이 커지기 전에 멈출 수 있어요.',
        '상대가 당연히 알 거라고 넘긴 부분이 나중에 부담이 될 수 있어요. 맡은 일과 기다릴 시간을 짧게 확인하면 가까운 관계도 훨씬 편안해져요.',
        '작은 말다툼이 생기면 이유를 끝까지 캐기보다 다음에 지킬 기준을 정하는 편이 좋아요. 말투, 시간, 역할 중 하나만 맞춰도 긴장이 내려가요.',
        '가족의 기준을 맞출 때는 빠른 결론보다 확인할 순서가 먼저예요. 서로가 놓친 부분을 차분히 보고, 당장 고칠 일과 기다릴 일을 나누면 좋아요.',
      ]),
    )
    .replace(
      /비유하자면 잘 다진 들판 위에 어깨를 기댈 언덕이 자리 잡는 흐름이에요\. 언덕 아래로 가족도 함께 쉴 수 있는 자리가 만들어져요\./g,
      pickVariant(ctx, 'sourceWealthStandard', [
        '오래 다져 온 생활 기준이 가족에게도 쉴 틈을 만들어 주는 흐름이에요. 돈을 더 크게 굴리기보다 함께 부담을 줄일 기준을 나누면 안정감이 오래가요.',
        '그동안 쌓은 선택이 가까운 사람에게도 든든한 바탕이 되는 시기예요. 지출, 도움, 책임의 기준을 같이 이야기하면 돈의 흐름이 한 사람에게만 몰리지 않아요.',
        '잘 다져 온 기반이 빛나는 때일수록 나눌 기준이 필요해요. 가족과 일 사이에서 어디까지 감당할지 정하면 자산도 관계도 더 편안해져요.',
      ]),
    )
    .replace(
      /비유하자면 잘 다진 흙 위에 큰 그늘 나무가 자리 잡는 흐름이에요\. 그늘 아래로 가족도 함께 쉴 수 있는 자리가 만들어져요\./g,
      pickVariant(ctx, 'sourceWealthStandard', [
        '차분히 다져 온 돈의 기준이 가까운 사람에게도 안정감을 주는 흐름이에요. 큰 결정보다 함께 쉴 수 있는 여유와 부담을 나누는 기준이 중요해요.',
        '오래 지켜 온 생활 기준이 가족에게도 그늘처럼 편안한 바탕이 될 수 있어요. 다만 누구 한 사람이 모든 책임을 떠안지 않도록 돈과 역할을 함께 나누어 보세요.',
        '그동안의 차분한 결정이 생활의 안전망으로 느껴지는 때예요. 가족과 함께 쓸 돈, 지킬 돈, 잠시 기다릴 돈을 나누면 안정감이 더 오래 남아요.',
      ]),
    )
    .replace(
      /잘 풀리는 결은 관리의 기준이 또렷할 때예요\. 어디에 쓰고 어디에 모을지 방향이 잡혀 있어, 무리수만 줄이면 자산이 단단해져요\./g,
      pickVariant(ctx, 'sourceWealthPace', [
        '좋은 흐름은 돈의 기준이 또렷할 때 더 잘 살아나요. 쓸 곳과 모을 곳을 나누고 무리한 선택만 줄이면 생활의 안정감이 단단해져요.',
        '잘 맞는 지점은 관리 기준을 분명히 세우는 힘이에요. 필요한 지출, 미룰 지출, 오래 지킬 돈을 나누면 큰 무리 없이 자산을 지킬 수 있어요.',
        '돈의 방향이 잡혀 있을 때 장점이 잘 드러나요. 어디까지 쓰고 어디부터 지킬지 정하면 욕심보다 기준이 먼저 서요.',
      ]),
    )
    .replace(
      /잘 풀리는 결은 관리의 기준을 다시 다듬는 흐름이에요\. 어디에 쓰고 어디에 모을지 방향이 또렷해지면 자산이 단단해져요\./g,
      pickVariant(ctx, 'sourceWealthPace', [
        '좋은 흐름은 관리 기준을 다시 정리할 때 더 또렷해져요. 쓸 돈과 모을 돈의 방향이 보이면 자산도 덜 흔들려요.',
        '잘 맞는 지점은 돈의 기준을 생활에 맞게 고치는 힘이에요. 지금 필요한 지출과 오래 남길 돈을 나누면 결정이 훨씬 차분해져요.',
        '돈의 방향을 다시 다듬기 좋은 흐름이에요. 어디에 쓰고 무엇을 지킬지 말로 정리하면 자산의 안정감도 함께 커져요.',
      ]),
    )
    .replace(
      /주의할 결은 책임이 한쪽에 몰릴 때예요\. 가족·일 사이의 균형이 어긋나면 결도 함께 흔들릴 수 있어요\./g,
      pickVariant(ctx, 'sourceWealthSharing', [
        '조심할 점은 책임이 한 사람에게 몰릴 때예요. 가족과 일 사이에서 돈, 시간, 돌봄의 몫을 나누어야 흐름이 덜 흔들려요.',
        '주의할 부분은 돈보다 책임의 무게가 먼저 커지는 장면이에요. 혼자 감당하기 전에 가족과 역할을 짧게 나누면 자산 관리도 더 안정돼요.',
        '부담이 한쪽으로 쏠리면 좋은 흐름도 쉽게 피곤해질 수 있어요. 가족과 일의 몫을 현실적으로 나누는 대화가 필요해요.',
      ]),
    )
    .replace(
      /주의할 결은 책임이 한쪽에 몰릴 때예요\. 가족과 한 번 나누는 대화가 결을 다시 균형 있게 만들어 줘요\./g,
      pickVariant(ctx, 'sourceWealthSharing', [
        '조심할 점은 책임이 한쪽에 몰리는 순간이에요. 가족과 한 번 나누는 대화만으로도 돈과 역할의 균형을 다시 잡을 수 있어요.',
        '주의할 부분은 혼자 감당하는 책임이 커질 때예요. 가까운 사람과 지출, 도움, 역할을 짧게 나누면 흐름이 다시 차분해져요.',
        '돈의 흐름이 괜찮아도 책임이 한 사람에게 쏠리면 피로가 커져요. 가족과 현실적인 기준을 한 번 맞추는 일이 안정감을 되살려요.',
      ]),
    )
    .replace(
      /잘 풀리는 방향은 관리의 기준이 또렷할 때예요\. 어디에 쓰고 어디에 모을지 방향이 잡혀 있어, 무리수만 줄이면 자산이 단단해져요\./g,
      pickVariant(ctx, 'sourceWealthPace', [
        '좋은 흐름은 돈의 기준이 또렷할 때 더 잘 살아나요. 쓸 곳과 모을 곳을 나누고 무리한 선택만 줄이면 생활의 안정감이 단단해져요.',
        '잘 맞는 지점은 관리 기준을 분명히 세우는 힘이에요. 필요한 지출, 미룰 지출, 오래 지킬 돈을 나누면 큰 무리 없이 자산을 지킬 수 있어요.',
        '돈의 방향이 잡혀 있을 때 장점이 잘 드러나요. 어디까지 쓰고 어디부터 지킬지 정하면 욕심보다 기준이 먼저 서요.',
      ]),
    )
    .replace(
      /잘 풀리는 방향은 관리의 기준을 다시 다듬는 흐름이에요\. 어디에 쓰고 어디에 모을지 방향이 또렷해지면 자산이 단단해져요\./g,
      pickVariant(ctx, 'sourceWealthPace', [
        '좋은 흐름은 관리 기준을 다시 정리할 때 더 또렷해져요. 쓸 돈과 모을 돈의 방향이 보이면 자산도 덜 흔들려요.',
        '잘 맞는 지점은 돈의 기준을 생활에 맞게 고치는 힘이에요. 지금 필요한 지출과 오래 남길 돈을 나누면 결정이 훨씬 차분해져요.',
        '돈의 방향을 다시 다듬기 좋은 흐름이에요. 어디에 쓰고 무엇을 지킬지 말로 정리하면 자산의 안정감도 함께 커져요.',
      ]),
    )
    .replace(
      /주의할 점은 책임이 한쪽에 몰릴 때예요\. 가족·일 사이의 균형이 어긋나면 흐름도 함께 흔들릴 수 있어요\./g,
      pickVariant(ctx, 'sourceWealthSharing', [
        '조심할 점은 책임이 한 사람에게 몰릴 때예요. 가족과 일 사이에서 돈, 시간, 돌봄의 몫을 나누어야 흐름이 덜 흔들려요.',
        '주의할 부분은 돈보다 책임의 무게가 먼저 커지는 장면이에요. 혼자 감당하기 전에 가족과 역할을 짧게 나누면 자산 관리도 더 안정돼요.',
        '부담이 한쪽으로 쏠리면 좋은 흐름도 쉽게 피곤해질 수 있어요. 가족과 일의 몫을 현실적으로 나누는 대화가 필요해요.',
      ]),
    )
    .replace(
      /주의할 점은 책임이 한쪽에 몰릴 때예요\. 가족과 한 번 나누는 대화가 흐름을 다시 균형 있게 만들어 줘요\./g,
      pickVariant(ctx, 'sourceWealthSharing', [
        '조심할 점은 책임이 한쪽에 몰리는 순간이에요. 가족과 한 번 나누는 대화만으로도 돈과 역할의 균형을 다시 잡을 수 있어요.',
        '주의할 부분은 혼자 감당하는 책임이 커질 때예요. 가까운 사람과 지출, 도움, 역할을 짧게 나누면 흐름이 다시 차분해져요.',
        '돈의 흐름이 괜찮아도 책임이 한 사람에게 쏠리면 피로가 커져요. 가족과 현실적인 기준을 한 번 맞추는 일이 안정감을 되살려요.',
      ]),
    )
    .replace(
      /몸과 마음의 기본 균형이 비교적 고르게 이어지는 편이에요\. 시소가 양쪽에 잘 균형 잡힌 모양처럼, 좋고 나쁨이 한쪽으로 크게 기울지 않아 회복도 빠른 편이에요\./g,
      pickVariant(ctx, 'sourceHealthBalancedBasics', [
        '몸과 마음의 기본 균형은 비교적 고르게 이어지는 편이에요. 한쪽으로 크게 기울기보다 무리와 회복을 번갈아 맞추는 힘이 있어요.',
        '컨디션은 크게 흔들리기보다 생활 리듬 안에서 다시 균형을 찾는 쪽에 가까워요. 좋은 날의 습관과 피곤한 날의 신호를 함께 보면 관리가 쉬워져요.',
        '몸과 마음이 한쪽으로 오래 치우치지 않는 점은 장점이에요. 다만 안정적으로 보일수록 작은 신호를 기록해 두면 다음 조절이 더 빨라져요.',
        '기본 흐름은 비교적 안정적인 편이지만, 그 안정감은 매일의 작은 관리에서 더 오래 이어져요. 잠, 식사, 움직임 중 편했던 기준을 남겨 보세요.',
      ]),
    )
    .replace(
      /다만 '큰 사고가 없으니 괜찮겠지'라고 신호를 가볍게 넘기기 쉬워요\. 작은 피로, 소화 불편, 잠의 변화 같은 알림이 올 때 한 박자 쉬어 가면 평생 컨디션이 더 단단해져요\./g,
      pickVariant(ctx, 'sourceHealthBalancedPace', [
        '다만 크게 아프지 않다는 이유로 작은 신호를 넘기기 쉬워요. 피로, 소화, 잠의 변화가 보이면 그때 바로 쉬어 가는 편이 긴 컨디션을 더 안정적으로 지켜 줘요.',
        '조심할 점은 불편함이 작을 때 그냥 지나치는 습관이에요. 몸이 보내는 작은 알림을 초기에 살피면 나중에 크게 쉬어야 하는 일을 줄일 수 있어요.',
        '큰 문제가 없어 보여도 몸은 작은 변화로 먼저 알려 줄 때가 많아요. 피곤한 시간대와 잠의 변화를 가볍게 적어 두면 다음 조절이 훨씬 쉬워져요.',
        '괜찮다고만 넘기기보다 작은 불편을 초기에 알아차리는 태도가 중요해요. 한 박자 쉬고 원인을 살피면 몸과 마음이 더 오래 편안하게 이어져요.',
      ]),
    )
    .replace(
      /익숙한 일상 루틴이 가장 큰 자산이에요\. 새 운동이나 새 식단도 무리 없이 받아들이는 편이지만, 오래 가져갈 한 가지를 정해 두는 쪽이 결국 더 잘 맞아요\./g,
      pickVariant(ctx, 'sourceHealthSeniorHabit', [
        '익숙한 생활 리듬이 가장 든든한 바탕이에요. 새 운동이나 식단을 크게 늘리기보다 오래 이어 갈 한 가지 습관을 정해 두는 편이 더 잘 맞아요.',
        '몸은 낯선 계획보다 익숙하게 반복되는 관리에 더 편하게 반응해요. 걷기, 식사 시간, 잠자리 중 하나를 오래 가져갈 기준으로 삼아 보세요.',
        '새로운 건강법을 시도할 수는 있지만, 결국 오래 남는 힘은 반복하기 쉬운 습관에서 나와요. 무리 없이 다시 할 수 있는 한 가지가 가장 중요해요.',
        '일상 루틴은 평범해 보여도 컨디션을 받치는 실제 기준이에요. 몸이 편했던 반복을 하나 정해 두면 변화가 와도 덜 흔들려요.',
      ]),
    )
    .replace(
      /평생 단위로 보면 큰 기복 없이 이어진다는 점이 장점이에요\. 30대, 50대, 70대를 지나도 작은 신호를 그때마다 살피는 습관이 몸과 마음을 부드럽게 받쳐 줘요\./g,
      pickVariant(ctx, 'sourceHealthBalancedPace', [
        '긴 시간으로 보면 큰 기복보다 꾸준히 관리하는 힘이 장점이에요. 나이가 달라질수록 몸의 신호도 달라지니, 그때마다 기준을 조금씩 맞추면 좋아요.',
        '평생 흐름에서는 크게 몰아붙이는 관리보다 시기마다 조절하는 태도가 더 잘 맞아요. 30대와 50대, 그 이후의 몸은 다르게 반응하므로 작은 신호를 계속 살펴야 해요.',
        '오래 보면 컨디션은 한 번의 결심보다 반복되는 점검에서 안정돼요. 시기가 바뀔 때마다 잠, 식사, 움직임의 기준을 다시 맞추면 몸이 덜 흔들려요.',
        '긴 흐름의 장점은 회복 기준을 계속 다시 만들 수 있다는 데 있어요. 작은 신호를 늦게 보지 않고 그때그때 조절하면 몸과 마음이 더 부드럽게 이어져요.',
      ]),
    )
    .replace(
      /평생의 한 가지 운동을 정해 매주 같은 요일, 같은 시각에 짧게 이어 두세요\. 한 주의 짧은 반복이 한 달 단위로 모이고, 한 해 단위로 쌓이면 자기 컨디션 지도가 또렷해져 다음 시기의 작은 신호도 한결 빠르게 알아차리게 돼요\./g,
      pickVariant(ctx, 'sourceHealthSeniorHabit', [
        '운동은 거창하게 시작하기보다 매주 반복할 수 있는 크기로 정해 보세요. 같은 요일에 짧게 움직이는 습관만 있어도 몸의 변화가 더 잘 보이고 다음 조절이 쉬워져요.',
        '한 가지 움직임을 오래 이어 두면 몸의 기준을 알기 쉬워져요. 걷기, 스트레칭, 가벼운 근력 운동처럼 부담 없는 반복이 컨디션을 살피는 좋은 표시가 돼요.',
        '매주 같은 시간에 짧게 움직여 보면 몸이 편한 날과 무거운 날의 차이가 보이기 시작해요. 그 차이를 알면 무리할 때와 쉬어 갈 때를 더 빨리 구분할 수 있어요.',
        '오래 갈 운동은 힘든 계획보다 다시 할 수 있는 계획이어야 해요. 한 주에 한 번이라도 꾸준히 남기면 컨디션을 읽는 감각이 차분히 쌓여요.',
      ]),
    )
    .replace(
      /평생의 자산으로 모여요/g,
      ctx.category === 'family'
        ? pickVariant(ctx, 'sourceFamilySmallCare', ['오래 남는 믿음으로 쌓여요', '가까운 관계를 받치는 기억으로 남아요', '서로를 편하게 붙잡아 주는 바탕이 돼요', '나중에도 기대기 쉬운 온기로 남아요'])
        : '평생의 자산으로 모여요',
    )
    .replace(
      /평생의 자산이 돼요/g,
      ctx.category === 'family'
        ? pickVariant(ctx, 'sourceFamilySmallCare', ['오래 남는 믿음이 돼요', '관계를 받치는 기억이 돼요', '서로를 편하게 이어 주는 바탕이 돼요', '나중에도 따뜻하게 꺼낼 수 있는 온기가 돼요'])
        : '평생의 자산이 돼요',
    )
    .replace(
      /다 읽은 뒤에는 인생 전체의 몸과 마음에서 몸이 편해졌던 반복 행동을 하나 남겨 보세요\. 따뜻하게 먹기, 일찍 눕기, 잠깐 걷기처럼 쉬운 행동이면 충분해요\./g,
      pickVariant(ctx, 'sourceHealthBalancedPace', [
        '다 읽은 뒤에는 인생 전체의 몸과 마음에서 내가 편해졌던 순간을 하나 떠올려 보세요. 따뜻한 식사, 이른 잠자리, 짧은 산책처럼 작게 반복할 수 있는 행동이면 충분해요.',
        '읽고 난 뒤에는 인생 전체의 몸과 마음에서 지금도 다시 해 볼 수 있는 회복 행동을 하나 고르세요. 너무 큰 계획보다 오늘 다시 할 수 있는 기준이 오래 도움이 돼요.',
        '해석을 덮기 전에 몸이 편해졌던 조건을 한 가지 남겨 보세요. 잠, 식사, 움직임 중 하나만 보여도 다음 시기의 관리가 훨씬 쉬워져요.',
        '마지막에는 인생 전체의 몸과 마음에서 나를 덜 몰아붙이게 해 준 습관을 하나 떠올려 보세요. 이미 도움이 된 행동을 다시 쓰는 것도 좋은 관리예요.',
        '다 읽은 뒤에는 긴 시간 동안 계속 가져가도 좋은 회복 기준을 하나 정해 보세요. 따뜻하게 먹기, 일찍 쉬기, 가볍게 걷기처럼 쉬운 기준이면 충분해요.',
        '마지막에는 몸과 마음을 덜 무겁게 만든 생활 습관을 하나만 골라 보세요. 거창한 계획보다 오늘도 다시 할 수 있는 쉬운 행동이 오래 남아요.',
        '해석을 덮기 전에 최근 몸이 조금 편안했던 시간을 생각해 보세요. 그때의 식사, 수면, 움직임 중 하나를 다음 날에도 이어 가면 관리가 훨씬 쉬워져요.',
        '정리할 때는 몸과 마음이 보내는 좋은 신호를 한 가지 적어 보세요. 잘 먹기, 일찍 쉬기, 가볍게 걷기처럼 생활 안에서 바로 해 볼 수 있는 기준이면 좋아요.',
      ]),
    )
    .replace(
      /이미 곁에 있는 관계를 더 편안하게 돌보는 흐름이 잘 맞아요\. 함께 먹는 밥, 짧은 안부, 오래된 이야기가 가족에게 오래 가는 안정감으로 남아요\./g,
      pickVariant(ctx, 'sourceFamilySmallCare', [
        '이미 곁에 있는 관계를 편안하게 돌보는 쪽이 잘 맞아요. 함께 먹는 식사, 짧은 안부, 오래된 이야기가 가족에게 오래 남는 안정감이 돼요.',
        '가까운 사람과는 새롭게 증명하려는 말보다 익숙한 배려를 다시 이어 가는 편이 좋아요. 한 끼를 같이 먹고, 안부를 묻고, 지나간 이야기를 나누는 시간이 관계를 부드럽게 해 줘요.',
        '가족 관계에서는 큰 변화를 만들기보다 이미 있는 따뜻함을 놓치지 않는 흐름이 잘 맞아요. 자주 보는 얼굴, 짧은 대화, 작은 부탁을 편하게 주고받는 일이 안정감을 키워요.',
        '오래 곁에 있던 사람들에게는 화려한 표현보다 꾸준한 관심이 더 잘 닿아요. 함께 앉는 시간과 가벼운 안부가 쌓이면 관계가 다시 편해질 수 있어요.',
        '이미 가까이 있는 관계일수록 새 약속보다 익숙한 온기를 살피는 편이 좋아요. 짧은 안부와 함께 먹는 한 끼가 오래 가는 안정감이 돼요.',
        '가족에게 필요한 것은 거창한 변화보다 다시 편히 만날 수 있는 분위기일 때가 많아요. 오래된 이야기를 웃으며 꺼내는 시간이 관계를 부드럽게 해 줘요.',
        '곁에 있는 사람들과는 특별한 행사를 만들지 않아도 괜찮아요. 같은 식탁, 짧은 연락, 편하게 묻는 안부가 관계를 천천히 돌봐 줘요.',
        '오래된 관계는 새롭게 증명하기보다 익숙한 믿음을 다시 확인할 때 더 편해져요. 작은 배려와 편한 대화가 가족 안의 안정감을 키워 줘요.',
        '가까운 사람에게는 큰 말보다 자주 보이는 태도가 더 오래 남아요. 무리 없이 묻고, 듣고, 함께 머무는 시간이 관계를 단단하게 해 줘요.',
        '이미 곁에 있는 사람들과는 편안한 반복이 힘이 될 수 있어요. 한 끼를 나누고 안부를 묻는 작은 장면이 오래 가는 기억으로 남아요.',
        '가족 관계는 큰 변화보다 작은 정성을 놓치지 않을 때 더 부드러워져요. 자주 묻는 말과 편히 들어 주는 시간이 마음의 거리를 줄여 줘요.',
        '오래 함께한 사람들에게는 정답보다 편안함이 먼저일 수 있어요. 짧은 연락과 익숙한 이야기가 관계의 바탕을 조용히 받쳐 줘요.',
      ]),
    )
    .replace(
      /가까운 가족에게는 앞장서서 해결하는 말보다 편히 머무는 시간이 더 필요할 수 있어요\. 함께 앉아 먹는 한 끼와 짧은 안부가 관계를 부드럽게 붙잡아 줘요\./g,
      pickVariant(ctx, 'sourceFamilyReceive', [
        '가까운 가족에게는 내가 먼저 해결책을 내놓는 말보다 편하게 곁에 있어 주는 시간이 더 필요할 수 있어요. 함께 먹는 한 끼와 짧은 안부가 관계를 부드럽게 이어 줘요.',
        '가족 사이에서는 빠른 결론보다 같은 자리에 머무는 시간이 더 힘이 될 때가 있어요. 밥을 같이 먹고, 오늘 어땠는지 묻는 작은 행동이 마음의 거리를 줄여 줘요.',
        '가까운 사람에게 도움을 주고 싶다면 먼저 해결하려 하기보다 편히 말할 분위기를 만들어 보세요. 짧은 안부와 차분한 식사 시간이 관계를 덜 날카롭게 해 줘요.',
        '가족에게 필요한 것은 큰 조언보다 곁에서 편하게 들어 주는 태도일 수 있어요. 한 끼를 나누고 가볍게 안부를 묻는 시간이 서로를 다시 안정시켜 줘요.',
      ]),
    )
    .replace(
      /봄바람 맞은 어린 가지처럼 한 방향으로 쭉 뻗어 나가다가도, 다음 해엔 또 다른 흐름으로 가지가 갈라지는 시기예요\. 한 가지 표현을 깊이 파 보는 경험이 평생 자산이 돼요\./g,
      pickVariant(ctx, 'sourceExpressionAutumnLight', [
        '이 시기에는 한 가지 표현에 깊이 빠졌다가도 시간이 지나며 다른 관심으로 넓어질 수 있어요. 그 변화는 흔들림이 아니라 자기 색을 찾아 가는 자연스러운 과정이에요.',
        '좋아하는 방식이 또렷해질수록 다른 길도 함께 열릴 수 있어요. 한 작품이나 활동을 깊게 따라가 본 경험은 나중에 자기 표현을 고르는 든든한 자료가 돼요.',
        '청소년기의 표현은 한 방향으로만 자라지 않아도 괜찮아요. 좋아하는 그림, 글, 영상, 음악을 깊게 만나 보는 시간이 자기 색의 뿌리를 천천히 만들어 줘요.',
        '지금 마음이 오래 머무는 표현을 하나 깊게 파 보는 일이 좋아요. 다음 해에 관심이 바뀌더라도 그 경험은 자기 취향과 기준을 알려 주는 자산으로 남아요.',
      ]),
    )
    .replace(
      /비교에 흔들리기 쉬우니, 자기 페이스를 지키는 연습이 도움이 돼요\. 또래 무대·동아리·작은 발표 자리를 적극적으로 활용해 보면 좋아요\./g,
      pickVariant(ctx, 'sourceExpressionSmallWorks', [
        '또래와 비교되는 순간이 있어도 자기 속도를 잃지 않는 연습이 먼저예요. 동아리, 작은 발표, 짧은 게시처럼 부담이 낮은 자리에서 시도하면 표현이 덜 무거워져요.',
        '남보다 잘하는지보다 내가 계속하고 싶은지 확인해 보는 편이 좋아요. 작은 발표나 모임에서 한 번 꺼내 보면 내 표현의 장점과 다음에 다듬을 점이 보여요.',
        '비교가 마음에 들어올 때는 무대를 크게 잡지 말고 안전한 사람 앞에서 작게 보여 주세요. 짧은 시도라도 반복하면 자기 페이스가 훨씬 단단해져요.',
        '표현은 크게 인정받아야만 자라는 것이 아니에요. 가까운 친구, 동아리, 작은 게시처럼 편한 곳에서 꺼내 보는 경험이 자신감을 천천히 키워 줘요.',
      ]),
    )
    .replace(
      /길게 보면 청소년기의 한 번의 표현 시도가 어른이 된 자기 색의 첫 자료가 돼요\. 짧은 영상, 작은 그림, 한 편의 글처럼 남아 있는 자료가 한 해 한 해 자기 기준을 또렷하게 만들어 줘요\./g,
      pickVariant(ctx, 'sourceExpressionSmallWorks', [
        '길게 보면 지금 남긴 작은 표현이 나중의 나를 설명해 주는 자료가 될 수 있어요. 짧은 영상, 그림, 글 한 편을 모아 두면 무엇을 좋아했는지 더 쉽게 알 수 있어요.',
        '청소년기의 작은 작업은 완성도가 높지 않아도 의미가 있어요. 시간이 지난 뒤 다시 보면 그때의 마음과 취향이 보여서 자기 기준을 잡는 데 도움이 돼요.',
        '지금 만든 표현을 지우지 말고 한곳에 모아 두면 좋아요. 짧은 기록들이 쌓이면 어른이 되었을 때 내 색이 어떻게 자라 왔는지 보여 주는 자료가 돼요.',
        '작은 시도 하나가 당장은 가볍게 보여도 시간이 지나면 자기 취향의 단서가 돼요. 영상, 그림, 글, 사진 중 무엇이든 남아 있으면 다음 표현을 고르기 쉬워져요.',
        '지금의 표현은 완성된 작품보다 나중에 다시 볼 수 있는 흔적이라는 점에서 의미가 있어요. 마음이 움직인 장면을 남겨 두면 시간이 지나 자기 색을 이해하는 데 도움이 돼요.',
        '짧게 만든 결과물도 그냥 지나치지 말고 모아 두면 좋아요. 나중에 보면 어떤 말투, 색, 장면을 좋아했는지 알 수 있어서 자기 기준이 더 또렷해져요.',
        '청소년기의 표현은 잘해야만 가치가 생기는 것이 아니에요. 시도한 흔적 자체가 취향을 알아보는 기록이 되고, 다음 창작을 고르는 작은 기준이 돼요.',
        '작은 작업이 쌓이면 나중에는 자기만의 지도처럼 보일 수 있어요. 그때 무엇에 끌렸고 어떤 방식이 편했는지 알면 표현의 방향도 덜 흔들려요.',
        '지금 남긴 글, 그림, 사진, 영상은 아직 서툴러도 괜찮아요. 시간이 지나 다시 볼 때 그 서툰 흔적이 자기 색이 시작된 자리라는 걸 알려 줄 수 있어요.',
        '표현을 오래 이어 가려면 결과를 바로 평가하기보다 흔적을 보관하는 습관이 필요해요. 짧은 파일명이나 날짜만 붙여도 다음에 다시 꺼내 보기 쉬워져요.',
        '한 번의 시도가 작아 보여도 마음이 움직였다는 증거가 될 수 있어요. 그런 증거가 모이면 남과 비교하기보다 내 취향을 믿는 힘이 자라요.',
        '나중의 자기 색은 갑자기 생기기보다 지금 남긴 작은 조각에서 자라요. 오늘의 한 문장, 한 장면, 한 컷을 가볍게 남기는 것부터 시작해도 좋아요.',
      ]),
    )
    .replace(
      /한 학기 자리에 좋아하는 작가·아티스트의 한 작품을 골라 자기 식으로 한 번 다시 만들어 보세요\. 짧은 모방의 한 자취가 한 해 단위에서 모이면, 또래와 비교하기보다 자기 색을 찾아 가는 단단한 손자취가 자연스럽게 자라나요\./g,
      pickVariant(ctx, 'sourceExpressionSmallWorks', [
        '한 학기에 한 번은 좋아하는 창작물 하나를 골라 내 방식으로 다시 만들어 보세요. 따라 해 보는 과정에서 무엇을 좋아하는지 알게 되고, 그 기록이 자기 색을 찾는 단서가 돼요.',
        '좋아하는 작품을 그대로 베끼는 데서 끝내지 말고 내 말, 내 색, 내 장면을 조금 섞어 보세요. 작은 변화를 남기면 비교보다 자기 기준이 더 분명해져요.',
        '한 작품을 깊게 보고 내 방식으로 바꿔 보는 경험은 좋은 연습이 돼요. 짧은 작업이라도 학기마다 모이면 내가 어떤 표현을 좋아하는지 또렷하게 보여요.',
        '좋아하는 창작자를 참고하되 결과를 완벽하게 맞추려 하지 않아도 괜찮아요. 내가 바꾼 한 줄, 한 장면, 한 색이 쌓이면 자기만의 표현 습관이 자라요.',
      ]),
    )
    .replace(
      /큰 역할만 좇기보다는 지금 맡은 일을 제대로 마무리하는 태도가 다음 신뢰가 된다는 점을 잊지 않으면 좋아요\. 일과 가족 사이의 균형은 어느 한쪽이 무너지지 않게 자기 페이스를 적어 두는 것에서 시작돼요\./g,
      pickVariant(ctx, 'sourceCareerMidlifeTrust', [
        '큰 역할만 바라보기보다 지금 맡은 일을 끝까지 정리하는 태도가 다음 신뢰로 이어져요. 일과 가족의 균형은 어느 한쪽을 더 세게 붙잡기보다 내가 지킬 속도를 적어 두는 데서 시작돼요.',
        '이 시기의 일은 더 큰 이름보다 마무리의 질이 중요해요. 맡은 일을 어떻게 끝냈는지 남겨 두고, 가족과 일 사이에서 무리하지 않을 기준을 함께 세우면 흔들림이 줄어요.',
        '큰 자리로 빨리 옮기는 것보다 지금 역할에서 신뢰를 남기는 편이 더 오래 힘이 돼요. 일과 가족이 함께 걸린 시기에는 속도, 책임, 쉬는 시간을 따로 적어 보는 것이 좋아요.',
        '주변에서 더 큰 역할을 기대하더라도 지금 맡은 일을 차분히 마무리하는 힘을 먼저 보세요. 한쪽으로 기울지 않게 생활 기준을 정해 두면 다음 선택이 더 안정적이에요.',
      ]),
    )
    .replace(
      /큰 결정이 다른 사람의 길에 영향 주는 시기라, 결정의 무게를 너무 빠르게 결재하지 말고 하루 한 박자만 늦춰 두면 후회가 줄어요\. 자기 분야 밖의 새 관점을 한 줄씩 더해 두면 후반에 길이 좁아지지 않아요\./g,
      pickVariant(ctx, 'sourceCareerMidlifeTrust', [
        '큰 결정이 다른 사람에게도 영향을 줄 수 있는 시기라면, 혼자 빠르게 끝내려 하지 않는 편이 좋아요. 하루만 더 확인하고 믿을 만한 사람과 기준을 나누면 후회가 줄어요.',
        '결정이 무거울수록 속도를 늦추는 태도가 필요해요. 영향 받을 사람과 확인할 순서를 먼저 떠올리면 책임도 덜 흔들리고, 선택의 폭도 좁아지지 않아요.',
        '중요한 결정 앞에서는 바로 결론을 내리기보다 한 박자 쉬어 가세요. 자기 분야 밖의 관점도 조금씩 더해 두면 후반의 길이 더 넓게 남아요.',
        '큰 선택을 앞둘수록 혼자 감당하려 하기보다 함께 볼 사람을 정해 두면 좋아요. 새 관점을 한 줄씩 더해 두는 습관이 뒤늦은 후회를 줄여 줘요.',
      ]),
    )
    .replace(
      /단단해진 만큼 후배의 길잡이가 되는 자리도 함께 자라요\./g,
      pickVariant(ctx, 'sourceCareerMidlifeTrust', [
        '쌓인 경험을 필요한 사람에게 나누는 역할도 함께 커져요. 조언을 건넬 때는 정답을 대신 정하기보다 확인할 기준을 함께 보여 주면 좋아요.',
        '이제는 성과를 내는 힘뿐 아니라 경험을 나누는 힘도 중요해져요. 후배나 동료가 길을 고를 때, 내가 겪은 기준을 차분히 들려주는 것만으로도 도움이 돼요.',
        '단단해진 경험은 혼자만의 자산으로 끝나지 않아요. 필요한 사람에게 방향을 함께 살펴 주면 그동안 쌓아 온 신뢰가 더 넓게 쓰일 수 있어요.',
        '역할이 깊어진 만큼 누군가에게 기준을 나누는 일도 자연스럽게 늘어요. 가르치려 하기보다 함께 확인해 주는 태도가 더 오래 신뢰를 남겨요.',
      ]),
    )
    .replace(
      /작은 여행·짧은 출장이 자기 리듬을 회복시켜 줘요\. 큰 변화는 한 번에 하지 않고 단계를 나눠 가면, 호흡이 흐트러지지 않아요\./g,
      pickVariant(ctx, 'sourceMovementNearby', [
        '가까운 외출이나 짧은 일정만으로도 생활 리듬이 환기될 수 있어요. 큰 변화를 한 번에 만들기보다 짧은 변화를 나누어 두면 몸과 마음이 덜 흔들려요.',
        '멀리 움직이지 않아도 리듬을 바꿀 방법은 있어요. 짧은 외출, 다른 길로 걷기, 하루짜리 일정처럼 작게 움직이면 변화가 부담보다 회복으로 남아요.',
        '이동은 거창하지 않아도 충분해요. 가까운 곳을 다녀오거나 평소와 다른 길을 걸어 보는 것만으로도 막혀 있던 기분이 조금 풀릴 수 있어요.',
        '짧은 이동도 생활의 공기를 바꾸는 데 충분할 수 있어요. 가까운 길을 다른 시간에 걷거나, 익숙한 장소를 천천히 다녀오는 것만으로도 마음이 환기돼요.',
        '큰 여행이 아니어도 몸을 조금 옮기면 생각의 방향이 달라질 수 있어요. 부담 없는 거리에서 시작하면 변화가 피로보다 회복에 가까워져요.',
        '가까운 외출은 작은 실험처럼 써 볼 수 있어요. 비용과 시간을 크게 쓰지 않아도 어떤 움직임이 나에게 편한지 확인할 수 있어요.',
        '평소의 길을 조금 다르게 걷는 것만으로도 막힌 기분이 풀릴 때가 있어요. 중요한 것은 멀리 가는지보다 돌아와도 무리가 없는 크기예요.',
        '큰 변화를 한 번에 만들 필요는 없어요. 짧은 이동을 몇 번으로 나누면 생활 리듬을 지키면서도 새로운 자극을 편하게 받아들일 수 있어요.',
      ]),
    )
    .replace(/잠자리·식사 자리·움직임 자리 세 가지를 자기 식대로 챙기는 편이 좋아요\./g, '잠, 식사, 움직임 세 가지를 자기 생활에 맞게 챙기는 편이 좋아요.')
    .replace(/잠 자리·식사 자리·움직임 자리 세 가지를 자기 식대로 챙기는 편이 좋아요\./g, '잠, 식사, 움직임 세 가지를 자기 생활에 맞게 챙기는 편이 좋아요.')
    .replace(/주중에는 짧은 산책이나 가벼운 환기 자리를 자주 만들어 두면 좋아요\./g, '주중에는 짧은 산책이나 가볍게 환기하는 시간을 자주 만들어 두면 좋아요.')
    .replace(/잠 자리는 평소보다 한 시간 일찍 잡으면/g, '잠자는 시간은 평소보다 한 시간 일찍 잡으면')
    .replace(/마음 자리를/g, '마음을')
    .replace(/주말엔 큰 강행군 대신 마음 편한 자리에서 보내는 시간이 잘 맞아요\./g, '주말에는 큰 강행군보다 마음이 편한 사람이나 공간에서 쉬는 시간이 잘 맞아요.')
    .replace(/따뜻한 식사와 가까운 사람과의 짧은 자리가 회복의 결을 단단히 잡아 줘요\./g, '따뜻한 식사와 가까운 사람과의 짧은 대화가 회복감을 안정시켜 줘요.')
    .replace(/오후엔 짧은 환기 자리가 컨디션을 단단히 받쳐 줘요\./g, '오후에는 짧게 환기하고 쉬는 시간이 컨디션을 안정시켜 줘요.')
    .replace(/주말엔 충분한 잠과 마음 편한 자리에서 보내는 시간이 보약이에요\./g, '주말에는 충분한 잠과 마음이 편한 시간이 회복에 도움이 돼요.')
    .replace(/(오늘은|이번 주는|이번 달은|올해는) 가까운 사람의 손길이 내 자리를 자주 받쳐 주는 (하루|시기|한 해)예요\./g, '$1 가까운 사람의 도움이 생활을 든든하게 받쳐 줄 수 있는 $2예요.')
    .replace(/오늘은 가까운 사람의 작은 손길이 내 자리를 부드럽게 받쳐 주는 하루예요\./g, '오늘은 가까운 사람의 작은 도움이 생활을 부드럽게 받쳐 줄 수 있는 하루예요.')
    .replace(
      /삼십 대 남성의 재물운은 가족·일·자기 사이에서 흐름을 잡는 시기예요\. 어느 자리에 무게를 둘지 정리하면 자산도 함께 리듬을 잡아요\./g,
      pickVariant(ctx, 'sourceWealthStandard', [
        '30대에는 돈과 생활 관리가 가족, 일, 나 자신 사이의 균형을 정하는 과정에 가까워요. 어디에 더 힘을 둘지 먼저 정리하면 지출과 저축의 기준도 함께 또렷해져요.',
        '이 시기의 돈 관리는 수입만 보는 일이 아니라 시간과 책임을 함께 나누는 일이에요. 가족, 일, 나를 위한 기준을 따로 적어 보면 돈의 흐름도 훨씬 현실적으로 보여요.',
        '30대에는 돈이 어디로 쓰이는지보다 왜 그쪽으로 무게가 실리는지 보는 일이 중요해져요. 생활의 우선순위를 정리하면 자산 관리도 더 차분해져요.',
      ]),
    )
    .replace(
      /비유하자면 자라나는 나무에 가지치기를 더하는 흐름이에요\. 모든 가지를 다 키우려 하면 뿌리가 부족해지지만, 굵은 가지 두세 개에 집중하면 단단한 리듬이 자리 잡아요\./g,
      pickVariant(ctx, 'sourceWealthStandard', [
        '비유하자면 가지가 많이 뻗은 나무를 차분히 정리하는 모습이에요. 모든 일을 다 키우려 하기보다 중요한 두세 가지에 힘을 모으면 생활의 뿌리가 더 단단해져요.',
        '비유하자면 여러 방향으로 뻗는 가지 중 오래 키울 가지를 고르는 시간이에요. 돈, 일, 가족의 부담을 모두 크게 잡기보다 핵심을 정하면 생활 리듬이 안정돼요.',
        '비유하자면 나무가 더 건강하게 자라도록 가지를 고르는 과정이에요. 지금 가장 중요한 책임을 두세 가지로 좁히면 지출과 에너지도 덜 흩어져요.',
      ]),
    )
    .replace(/잘 풀리는 방향은 장기 관점이 등장할 때예요\. 짧은 결과보다 5년 뒤를 그리는 결정이 흐름을 키워요\./g, '잘 풀리는 방향은 눈앞의 이익보다 긴 계획을 함께 볼 때예요. 5년 뒤에도 부담 없이 유지할 선택인지 확인하면 돈의 기준이 더 단단해져요.')
    .replace(/주의할 점은 가족·일 사이에서 무게가 한쪽에 몰릴 때예요\. 한 자리에서 무리하면 다른 자리도 흔들리기 쉬워요\./g, '주의할 점은 가족과 일 중 한쪽으로 부담이 몰릴 때예요. 한쪽에서 무리하면 지출, 시간, 마음의 균형이 함께 흔들릴 수 있어요.')
    .replace(/어깨에 자리가 많은 시기지만, 한 자리씩 차분히 다듬으면 충분히 흐름을 잡아 갈 수 있어요\./g, '책임이 많은 시기지만, 부담을 한꺼번에 정리하려 하지 않아도 괜찮아요. 가장 급한 항목부터 차분히 다듬으면 돈과 생활의 균형을 다시 잡아 갈 수 있어요.')
    .replace(/어깨에 자리가 많은 시기지만, 한 자리씩 차분히 다듬으면 한 해의 흐름이 단단해져요\./g, '책임이 많은 한 해라도 모든 부담을 한꺼번에 정리할 필요는 없어요. 가장 급한 항목부터 차분히 다듬으면 한 해의 돈과 생활 기준이 더 단단해져요.')
    .replace(
      /잘 풀리는 방향은 정리와 나눔이 자연스러울 때예요\. 자녀·후배·이웃과 나누는 방식이 생활의 기반을 더 단단하게 만들어요\./g,
      pickVariant(ctx, 'sourceWealthSharing', [
        '좋은 흐름은 내가 가진 기준을 필요한 사람과 나눌 때 더 또렷해져요. 물건이나 돈보다 먼저 어떤 마음으로 나눌지 정하면 생활의 안정감도 함께 커져요.',
        '남길 것과 나눌 것을 차분히 고르면 그동안의 선택이 더 분명한 가치로 남아요. 가족, 후배, 이웃에게 필요한 만큼만 전해도 충분히 따뜻한 흐름이 만들어져요.',
        '가족이나 가까운 사람에게 한꺼번에 넘기려 하지 않아도 괜찮아요. 작은 기준 하나, 필요한 물건 하나를 알맞게 나누는 것만으로도 관계와 생활이 한결 단단해져요.',
        '정리한 물건이나 기준을 필요한 곳에 보내는 과정이 이 시기의 장점이에요. 많이 내어 주기보다 서로 부담 없는 크기로 나눌 때 오래 편안하게 이어져요.',
        '정리와 나눔이 잘 맞을 때는 먼저 남길 기준을 작게 정해 보세요. 돈, 물건, 약속을 따로 적어 두면 누구에게 무엇을 전하면 좋을지 훨씬 편하게 보일 수 있어요.',
        '가족이나 후배에게 무언가를 나눌 때는 양보다 기준이 더 중요해요. 왜 남기고, 왜 나누는지 차분히 말해 두면 받는 사람도 부담보다 고마움을 더 크게 느껴요.',
        '나눔은 많이 주는 일이 아니라 서로 편안한 크기를 고르는 일이에요. 지금 내 생활을 지키면서 필요한 사람에게 알맞게 전하면 관계도 돈의 흐름도 더 안정돼요.',
        '오래 쌓아 온 것을 정리할 때는 마음이 앞서기 쉬워요. 먼저 내게 꼭 필요한 것과 다른 사람에게 더 잘 쓰일 것을 나누어 보면 결정이 한결 부드러워져요.',
      ]),
    )
    .replace(
      /비유하자면 작은 노트 한 권을 처음 펼치는 그림이에요\. 첫 줄은 또박또박, 두 줄째는 어제보다 한 글자 더, 이렇게 차곡차곡 채워 가면 한 학기·한 학년 뒤에는 자기만의 책이 한 권 자라 있어요\./g,
      pickVariant(ctx, 'sourceStudyNotebookFirst', [
        '비유하자면 새 공책에 첫 줄을 쓰는 시간이에요. 처음부터 멋지게 채우지 않아도 괜찮고, 오늘 배운 한 줄을 자기 말로 남기면 그것이 다음 공부의 길잡이가 돼요.',
        '처음 쓰는 줄이 조금 삐뚤어도 괜찮아요. 중요한 것은 오늘 알게 된 것 하나를 내 말로 남기고, 다음에 다시 펼칠 수 있게 두는 거예요.',
        '배움의 시작은 멋진 결과보다 다시 볼 수 있는 작은 흔적에서 힘이 생겨요. 한 줄 메모, 단서 하나, 질문 하나가 다음 공부의 문을 열어 줘요.',
        '새 노트는 한 번에 채우는 물건이 아니에요. 오늘 마음에 남은 내용을 짧게 적고 내일 다시 읽어 보면, 내 공부 방식이 천천히 만들어져요.',
        '처음 펼친 노트처럼 이 시기의 배움은 작은 기록에서 시작돼요. 한 줄을 적고, 다시 읽고, 조금 고쳐 보는 경험이 쌓이면 자기만의 공부 방식이 천천히 만들어져요.',
        '작은 기록은 공부가 자라는 바탕이에요. 오늘 모른 것을 한 줄 남기고 내일 다시 확인하는 식으로 이어 가면, 시간이 지나며 스스로 이해한 내용이 분명히 보이기 시작해요.',
        '처음부터 두꺼운 책을 완성하려 하지 않아도 돼요. 마음에 남은 말 하나, 새로 알게 된 것 하나를 꾸준히 적으면 그 기록이 나중에 든든한 공부 자산이 돼요.',
      ]),
    )
    .replace(
      /잘 풀리는 면은, 모르는 것을 솔직하게 적어 두는 자리예요\. 헷갈린 문장, 못 푼 문제, 어려운 단어를 작은 노트에 한 줄씩 모아 두면 그 자체가 다음 주의 학습 지도가 돼요\. 그림이나 색연필로 정리해도 충분해요\./g,
      pickVariant(ctx, 'sourceStudyUnknowns', [
        '잘 풀리는 면은 모르는 것을 숨기지 않고 표시해 두는 태도예요. 헷갈린 문제나 어려운 단어를 한 줄로 남기면, 다음에 무엇부터 보면 좋을지 훨씬 쉽게 알 수 있어요.',
        '모르는 부분을 남겨 두는 일은 틀렸다는 표시가 아니라 다음 공부의 출발점을 만드는 일이에요. 다시 볼 표시가 있으면 도움을 청하기도 쉬워져요.',
        '어려운 단어와 헷갈린 문제를 작게 모아 두면 공부가 훨씬 구체적으로 보여요. 무엇을 모르는지 알게 되는 순간부터 다음 행동이 정해져요.',
        '모르는 것을 덮어 두지 않는 태도가 큰 장점이에요. 짧은 질문으로 바꿔 적어 두면 선생님이나 친구에게 물어볼 때도 마음이 덜 부담스러워요.',
        '모르는 부분을 적어 두는 일은 부족함을 드러내는 것이 아니라 다음 공부의 순서를 잡는 방법이에요. 작은 표시와 짧은 메모만 있어도 다시 볼 때 부담이 줄어요.',
        '헷갈린 내용을 그냥 넘기지 않는 힘이 좋아요. 문제 번호, 어려운 단어, 다시 물어볼 내용을 짧게 남기면 공부가 막연하지 않고 손에 잡히는 계획으로 바뀌어요.',
        '배움은 모르는 것을 발견하는 순간부터 더 깊어져요. 색연필로 표시하거나 그림으로 정리해도 좋으니, 어렵게 느낀 부분을 자기 방식으로 남겨 보세요.',
      ]),
    )
    .replace(
      /살짝 살피면 좋은 점은, 옆 친구의 결과만 보고 자기 페이스를 잃는 면이에요\. 비교는 짧게, 자기 기록 갱신은 꾸준히로 충분해요\. 친구와는 함께 풀어 보는 시간을 만드는 쪽이 더 많은 것을 남겨 줘요\./g,
      pickVariant(ctx, 'sourceStudyComparison', [
        '조심할 점은 친구의 결과와 내 속도를 너무 오래 비교하는 거예요. 잠깐 참고하는 정도는 괜찮지만, 결국 중요한 것은 어제보다 조금 더 이해한 내 기록이에요.',
        '다른 친구가 빨리 푼다고 해서 내 공부가 늦었다는 뜻은 아니에요. 함께 풀어 볼 문제 하나를 정하고, 내가 이해한 부분을 말로 설명해 보면 비교보다 더 많은 것이 남아요.',
        '옆 사람의 속도에 마음이 흔들릴 때는 오늘 내가 끝낼 작은 범위만 다시 보세요. 친구와는 경쟁보다 함께 확인하는 시간을 만들 때 배움이 더 편하게 이어져요.',
        '비교가 시작되면 먼저 오늘 내 기준을 작게 잡아 보세요. 끝낼 문제 하나, 다시 읽을 문단 하나가 있으면 남의 속도에 덜 흔들려요.',
        '친구의 결과는 참고할 수 있지만 내 공부의 전부는 아니에요. 함께 확인할 문제를 하나 정하면 경쟁보다 배움이 더 오래 남아요.',
        '남보다 빠른지보다 어제보다 덜 막히는지가 더 중요해요. 내가 이해한 부분을 말로 설명해 보면 비교하던 마음도 차분해져요.',
        '비교가 길어지면 공부가 무거워질 수 있어요. 대신 지난번보다 덜 헷갈린 부분, 새로 알게 된 한 가지를 찾아보면 자신감이 훨씬 건강하게 쌓여요.',
      ]),
    )
    .replace(
      /잘 익은 나무가 그늘을 넓혀 가는 (?:이미지|그림)예요\. 자녀·후배·제자 같은 결과 만나는 (?:시기가|자리가) 보이지만,? 어떤 형태인지는 사람마다 다르게 풀어요\./g,
      pickVariant(ctx, 'sourceExpressionAutumnLight', [
        '오래 자란 나무가 그늘을 나누듯, 이 시기에는 내가 쌓아 온 표현과 경험이 다른 사람에게 편안한 도움으로 전해질 수 있어요. 꼭 어떤 형태로 남겨야 한다고 정하지 않아도 괜찮아요.',
        '그동안 만든 말, 글, 작업은 시간이 지나며 누군가에게 쉬어 갈 그늘이 될 수 있어요. 자녀, 후배, 제자처럼 이어지는 사람과의 만남은 각자의 방식으로 달라져요.',
        '잘 익은 열매를 나누듯 내가 가진 경험을 필요한 사람에게 조금씩 전하기 좋은 흐름이에요. 중요한 것은 결과의 모양보다 서로 부담 없는 크기로 나누는 태도예요.',
        '이 시기의 표현은 새로 증명하기보다 쌓아 온 것을 편안하게 나누는 쪽에 힘이 있어요. 가까운 사람에게 남길 말, 보여 줄 작업, 함께할 시간을 작게 고르면 충분해요.',
        '오래 가꾼 표현은 한 사람에게만 머물지 않고 주변으로 부드럽게 퍼질 수 있어요. 누군가에게 가르치거나 함께 만드는 기회가 오면 크기보다 편안한 속도를 먼저 보세요.',
      ]),
    )
    .replace(
      /중년의 (?:결|흐름)은 깊이가 빛을 내는 흐름이에요\. 자기 페이스를 지키는 것 자체가 큰 자산이 돼요\./g,
      pickVariant(ctx, 'sourceWealthPace', [
        '중년의 돈과 생활은 깊이보다 균형에서 힘이 나요. 내 속도를 지키되 가족, 일, 건강에 부담이 한쪽으로 몰리지 않는지 함께 살피면 좋아요.',
        '이 시기의 자산은 빠른 확장보다 오래 지킬 기준에서 더 또렷해져요. 자기 페이스를 지키면서도 필요한 대화와 점검을 미루지 않는 태도가 중요해요.',
        '중년에는 이미 쌓은 것을 차분히 다듬는 힘이 커져요. 큰 결정보다 지출, 책임, 회복 시간을 균형 있게 나누면 생활의 바탕이 단단해져요.',
        '깊이가 생기는 시기일수록 무리한 확장보다 내 생활을 지키는 기준이 필요해요. 지금 감당할 수 있는 돈과 책임의 크기를 함께 확인해 보세요.',
        '자기 페이스는 돈을 천천히 보라는 말에 그치지 않아요. 오래 갈 선택인지, 가족과 일의 부담을 함께 낮추는지 살피면 자산의 안정감도 커져요.',
      ]),
    )
    .replace(
      /학교에서 받은 작은 칭찬 한마디, 친구와 함께 풀어 본 한 문제, 모르는 단어를 노트에 적어 둔 한 줄이 큰 자산이 되는 시기예요\. 어른들이 쓰는 어려운 말을 미리 끌어오지 않아도 충분해요\./g,
      pickVariant(ctx, 'sourceStudyPraise', [
        '학교에서 들은 짧은 칭찬, 친구와 같이 풀어 본 문제, 새로 적어 둔 단어 하나가 모두 배움의 자산이 돼요. 어려운 목표보다 오늘 남긴 작은 흔적을 먼저 믿어도 충분해요.',
        '작은 성공을 그냥 지나치지 않는 것이 중요해요. 맞힌 문제 하나, 질문한 내용 하나, 다시 확인한 단어 하나가 쌓이면 공부를 계속해 볼 힘이 생겨요.',
        '거창한 계획이 없어도 배움은 자라요. 선생님에게 들은 말, 친구와 나눈 풀이, 노트에 남긴 표시가 아이에게는 다음 단계로 가는 든든한 발판이 될 수 있어요.',
        '아이의 배움은 큰 목표보다 오늘 이해한 작은 조각에서 힘을 얻어요. 새로 알게 된 말, 다시 풀어 본 문제, 질문한 순간을 따뜻하게 확인해 주세요.',
        '공부가 눈에 띄게 늘지 않는 날에도 남는 것은 있어요. 헷갈린 부분을 말해 본 경험과 다시 확인한 표시가 다음 공부의 길을 만들어 줘요.',
        '아이에게는 잘한 결과만큼 다시 물어볼 수 있는 분위기가 중요해요. 모르는 것을 편하게 꺼내면 배움이 겁나는 일이 아니라 이어지는 일이 돼요.',
        '작은 칭찬과 짧은 복습은 아이가 자기 방식으로 배우는 감각을 키워 줘요. 오늘 하나라도 덜 헷갈린 부분을 함께 찾아보면 충분해요.',
        '학습은 한 번의 성과보다 다시 돌아올 수 있는 기준이 있을 때 단단해져요. 아이가 표시해 둔 부분을 같이 보고 다음에 볼 순서를 정해 주세요.',
        '오늘의 배움은 큰 자격이나 어려운 이름보다 생활 속 작은 경험으로 충분해요. 칭찬받은 점과 새로 알게 된 점을 짧게 나누면 공부가 더 편안하게 이어져요.',
      ]),
    )
    .replace(
      /같은 책을 읽지 않아도 배움은 나눌 수 있어요\. 마음에 남은 문장 하나를 들려주거나 짧은 생각을 주고받는 것만으로도 생활 속 즐거움이 커져요\./g,
      pickVariant(ctx, 'sourceAcademicSharingDetail', [
        '같은 책을 읽지 않아도 배움은 충분히 나눌 수 있어요. 마음에 남은 한 문장을 들려주고, 왜 좋았는지 짧게 말하면 대화가 자연스럽게 깊어져요.',
        '배움은 함께 같은 속도로 읽어야만 나눌 수 있는 것이 아니에요. 오늘 알게 된 점 하나를 편하게 말해 보면 가까운 사람과의 대화도 더 따뜻해져요.',
        '마음에 남은 문장 하나를 가족이나 친구에게 들려주는 것만으로도 배움이 생활 안으로 들어와요. 긴 설명보다 짧은 감상 한마디가 더 오래 남을 수 있어요.',
        '읽은 것을 전부 설명하려 하지 않아도 괜찮아요. 좋았던 문장, 새로 떠오른 생각, 다시 보고 싶은 부분 중 하나만 나누면 배움이 대화로 이어져요.',
        '배움의 즐거움은 혼자 간직할 때보다 가볍게 나눌 때 더 커질 수 있어요. 오늘 마음에 든 말 한 줄을 전하면 그 자체로 충분한 공부가 돼요.',
        '새로 알게 된 내용을 가족이나 친구에게 짧게 말해 보면 배움이 훨씬 오래 남아요. 완벽하게 설명하지 않아도, 왜 마음에 남았는지만 나누면 충분해요.',
        '배운 것을 생활에 붙이는 가장 쉬운 방법은 한 사람에게 편하게 들려주는 거예요. 한 줄 감상이나 작은 질문만 나눠도 생각이 더 또렷해져요.',
        '혼자 읽은 내용도 누군가와 나누면 다른 각도에서 다시 보일 수 있어요. 오늘 배운 말 하나와 아직 궁금한 점 하나를 짧게 나누어 보세요.',
        '배움은 책상 위에만 머물지 않아도 돼요. 가까운 사람과 짧은 대화를 나누면 기억이 정리되고 다음에 더 보고 싶은 부분도 자연스럽게 보여요.',
        '공부한 내용을 산책길이나 식사 자리에서 한 문장으로 말해 보면 배움이 훨씬 오래 남아요. 길게 설명하지 않아도, 내 말로 바꾸는 순간 이해가 단단해져요.',
        '배움은 조용히 읽는 시간뿐 아니라 누군가와 나누는 말 속에서도 자라요. 오늘 새로 알게 된 것 하나를 쉽게 말해 보면 기억이 더 선명해져요.',
        '책상 밖에서 떠오른 생각도 좋은 배움의 일부예요. 산책, 대화, 짧은 메모 속에서 마음에 남은 내용을 붙잡으면 다음 공부가 더 자연스럽게 이어져요.',
        '가까운 사람에게 오늘 배운 점 하나를 말해 보세요. 설명이 길지 않아도 그 과정에서 내가 이해한 부분과 더 볼 부분이 또렷해져요.',
        '같은 내용을 몰라도 대화는 시작될 수 있어요. 내가 새로 알게 된 점을 쉬운 말로 바꾸어 말하면 배움이 내 생활의 언어로 바뀌어요.',
        '읽고 배운 것을 나눌 때는 길게 설명하기보다 마음에 남은 장면 하나를 고르면 좋아요. 그 장면을 말로 꺼내는 순간 배움이 더 살아나요.',
      ]),
    )
    .replace(
      /잘 익은 가을 햇살처럼 따스한 흐름이에요\. 다음 세대와 함께 보내는 시간은 그 자체로 소중하고, 어떤 모양이든 무리하지 않고 흘러가는 흐름이 가장 좋아요\./g,
      pickVariant(ctx, 'sourceExpressionAutumnLight', [
        '따뜻한 오후처럼 오래 곁에 머무는 힘이 커지는 때예요. 무엇을 증명하려 애쓰기보다 편히 듣고 함께 웃는 시간이 가까운 사람에게 더 오래 남아요.',
        '오래 쌓인 표현은 큰 무대가 없어도 전해질 수 있어요. 함께 웃고, 짧게 이야기하고, 예전 기억을 꺼내는 시간이 가까운 사람에게 따뜻한 흔적으로 남아요.',
        '이 시기의 표현은 새로 증명하는 힘보다 부드럽게 나누는 힘에 가까워요. 다음 세대와 같은 시간을 보내며 편히 들어 주는 태도가 오래 기억될 수 있어요.',
        '가을 햇살처럼 차분한 온기가 어울리는 때예요. 무리해서 특별한 결과를 만들기보다, 지금 가진 이야기와 마음을 부담 없는 크기로 나누면 좋아요.',
        '차분히 익어 가는 계절처럼, 지금은 새로 증명하기보다 이미 가진 마음을 편하게 나누는 쪽이 잘 맞아요. 짧은 이야기와 따뜻한 시간이 충분한 표현이 될 수 있어요.',
        '오래 머문 햇빛처럼 부드러운 표현이 힘을 얻는 때예요. 큰 결과를 만들려 하기보다 가까운 사람에게 남길 말과 함께할 시간을 작게 고르면 좋아요.',
        '이 시기의 표현은 화려한 성과보다 편안한 온기에서 더 오래 남아요. 내가 지나온 이야기와 마음을 부담 없는 크기로 나누면 가까운 사람도 편하게 받아들여요.',
        '따뜻하게 익은 오후처럼 말과 마음을 천천히 나누기 좋은 흐름이에요. 특별한 무대를 만들지 않아도 함께 웃고 들어 주는 시간이 좋은 표현이 돼요.',
      ]),
    )
    .replace(
      /작은 기록·이야기·작업이 더 큰 의미를 지니는 시기예요\. 무리한 정리보다 그날그날의 즐거움에 마음을 두면 충분해요\./g,
      pickVariant(ctx, 'sourceExpressionSmallWorks', [
        '짧은 기록이나 작은 이야기가 생각보다 오래 남을 수 있어요. 완성된 작품을 만들려 하기보다 오늘 떠오른 말과 기억을 편하게 남기는 쪽이 더 잘 맞아요.',
        '큰 정리를 한 번에 끝내지 않아도 괜찮아요. 사진 한 장에 설명을 붙이거나, 떠오른 이야기를 한두 줄 적어 두는 정도만으로도 충분히 의미가 있어요.',
        '손에 익은 작은 작업을 계속하는 힘이 좋아요. 글, 그림, 사진, 이야기처럼 편한 방식으로 하루의 즐거움을 남기면 가까운 사람에게도 따뜻하게 전해져요.',
        '오늘 떠오른 장면을 완성된 작품으로 만들 필요는 없어요. 사진 한 장, 짧은 메모, 웃겼던 말 한 줄처럼 작은 흔적이 나중에 충분히 좋은 표현이 돼요.',
        '표현은 거창한 준비보다 손이 먼저 움직이는 작은 방식에서 시작될 수 있어요. 익숙한 도구로 오늘의 기분을 남기면 부담 없이 이어 가기 쉬워요.',
        '가까운 사람에게 보여 줄지 말지는 나중에 정해도 괜찮아요. 먼저 나에게 편한 방식으로 남겨 두면 작은 기록도 따뜻한 이야기로 자라요.',
        '작은 작업은 결과보다 계속 꺼내 볼 수 있다는 점에서 힘이 있어요. 오늘 마음에 남은 색, 말, 장면을 하나만 붙잡아도 표현의 흐름이 살아나요.',
        '완성도를 따지기 전에 오늘의 즐거움을 남기는 일이 먼저예요. 짧은 글이나 사진 설명처럼 작게 시작하면 표현이 숙제보다 생활에 가까워져요.',
        '이 시기에는 결과물의 크기보다 마음이 담긴 흔적이 더 중요해요. 매일 조금씩 남긴 기록과 이야기가 나중에 돌아볼 수 있는 좋은 선물이 돼요.',
      ]),
    )
    .replace(
      /후배나 주변 사람이 묻는 일이 있다면 정답을 대신 내려 주기보다, 판단할 때 살폈던 기준을 차근히 알려 주세요\. 오래 쥐고 있던 노하우를 메모나 짧은 대화로 나눠 두면, 내 경험이 다른 사람의 시행착오를 줄이는 데 도움이 돼요\./g,
      pickVariant(ctx, 'sourceMentor', [
        '누군가가 조언을 구하면 답을 정해 주기보다, 내가 기준을 세웠던 과정을 짧게 들려주는 편이 좋아요. 경험을 한두 줄 메모로 남겨 두면 주변 사람이 같은 시행착오를 줄이는 데 도움이 돼요.',
        '오래 해 온 일에서 배운 기준은 혼자만 알고 있기보다 필요한 사람에게 조금씩 나누면 좋아요. 긴 설명보다 실제로 도움이 됐던 판단 기준 하나를 알려 주는 쪽이 더 오래 남아요.',
        '후배나 동료가 길을 묻는 순간에는 모든 해답을 주려 하기보다, 먼저 확인해야 할 순서를 알려 주세요. 그렇게 남긴 기준 하나가 다른 사람의 선택을 훨씬 가볍게 만들어 줄 수 있어요.',
        '누군가 막막해할 때는 답을 대신 정해 주기보다, 내가 처음 무엇부터 확인했는지 알려 주는 편이 좋아요. 판단 순서 하나만 나눠도 상대는 다음 선택을 훨씬 편하게 시작할 수 있어요.',
        '오래 쌓아 온 경험은 거창한 강의보다 짧은 사례로 전할 때 더 잘 남아요. 어떤 점을 보고 결정했는지 한두 문장으로 남기면 필요한 사람이 바로 따라 해 볼 수 있어요.',
        '경험을 전할 때는 긴 설명보다 실제로 도움이 됐던 확인 순서 하나가 더 잘 닿아요. 무엇을 먼저 보고 어디서 멈췄는지 말해 주면 상대도 따라 하기 쉬워요.',
        '누군가에게 길을 알려 줄 때는 성공담보다 기준이 더 쓸모 있을 수 있어요. 내가 실수하지 않으려고 확인한 항목을 짧게 남기면 현실적인 조언이 돼요.',
        '오래 해 온 일의 힘은 정답을 대신 내려 주는 데만 있지 않아요. 필요한 사람이 스스로 고를 수 있게 질문과 기준을 나누는 태도가 더 오래 도움이 돼요.',
        '경험이 많을수록 모두 설명하려 하기보다 핵심만 골라 주는 편이 좋아요. 확인할 것 하나와 조심할 것 하나만 전해도 상대의 부담이 줄어요.',
        '조언을 줄 때는 모든 길을 설명하려 하기보다 먼저 조심할 한 가지와 확인할 한 가지를 나누면 충분해요. 그렇게 전한 기준은 상대가 자기 방식으로 선택하는 데 도움이 돼요.',
        '경험을 나눌 때는 성공담만 말하지 않아도 괜찮아요. 헷갈렸던 부분과 다시 확인했던 기준을 함께 알려 주면 듣는 사람이 훨씬 현실적으로 따라올 수 있어요.',
        '주변 사람이 판단을 어려워할 때는 결론보다 확인 순서를 나누는 편이 좋아요. 먼저 볼 자료, 물어볼 사람, 멈춰야 할 기준을 알려 주면 부담이 줄어요.',
        '내가 오래 걸려 배운 기준을 한 문장으로 정리해 두면 좋아요. 필요한 사람에게 그 문장을 건네는 것만으로도 길을 찾는 시간이 짧아질 수 있어요.',
        '조언은 많이 줄수록 좋은 것이 아니라 상대가 바로 써먹을 수 있을 때 힘이 생겨요. 오늘은 확인할 기준 하나와 조심할 점 하나만 나누어도 충분해요.',
        '도움을 주고 싶을 때는 길게 설명하기보다 바로 확인할 순서 하나를 알려 주세요. 상대가 자기 상황에 맞게 고를 여지를 남겨 두면 조언이 더 오래 도움이 돼요.',
        '경험을 나눌 때는 결론보다 기준이 더 쓸모 있을 때가 많아요. 무엇을 먼저 보고 어디서 멈췄는지 말해 주면 듣는 사람이 자기 판단을 세우기 쉬워요.',
        '조언이 필요한 사람에게는 큰 이야기보다 오늘 써먹을 작은 기준이 먼저예요. 확인할 것과 조심할 것을 하나씩만 나누면 부담 없이 받아들이기 좋아요.',
        '조언을 구한 사람에게는 긴 설명보다 바로 확인할 첫 단계가 더 도움이 될 수 있어요. 시작할 것 하나와 멈춰야 할 것 하나를 나누어 주면 선택이 가벼워져요.',
        '누군가 막막해할 때는 전체 이야기를 한꺼번에 풀지 않아도 괜찮아요. 지금 확인할 기준 하나와 나중에 다시 볼 기준 하나만 전해도 충분히 실용적이에요.',
        '도움을 주고 싶다면 먼저 상대가 오늘 해 볼 수 있는 크기로 줄여 주세요. 기준이 작아질수록 조언은 압박보다 실제 도움이 되기 쉬워요.',
        '경험을 나눌 때는 큰 결론보다 다시 확인할 순서를 남기는 편이 좋아요. 순서가 있으면 듣는 사람이 자기 상황에 맞게 적용하기 쉬워요.',
        '조언은 많은 내용을 담을수록 좋은 것이 아니에요. 확인할 항목 하나와 조심할 상황 하나가 분명하면 상대가 훨씬 편하게 받아들여요.',
        '누군가 기준을 묻는다면 내가 봤던 핵심 조건을 짧게 정리해 주세요. 결정은 상대가 다시 고를 수 있게 남겨 두면 조언도 덜 무거워져요.',
        '내가 아는 것을 모두 전하려 하지 않아도 괜찮아요. 상대가 바로 해 볼 수 있는 확인 방법 하나만 알려 줘도 충분히 실질적인 도움이 돼요.',
        '누군가 도움을 구할 때는 먼저 그 사람이 직접 고를 수 있는 폭을 남겨 주세요. 내가 본 기준과 실수하기 쉬운 지점만 알려 줘도 상대는 훨씬 편하게 판단할 수 있어요.',
        '경험을 전할 때는 정답보다 질문을 남기는 방식도 좋아요. 무엇을 먼저 확인했고 어떤 조건에서 멈췄는지 알려 주면 듣는 사람이 자기 상황에 맞춰 볼 수 있어요.',
        '오래 쌓은 노하우는 작은 체크리스트로 바뀔 때 가장 쓰기 쉬워요. 확인할 것, 조심할 것, 다시 물어볼 것을 세 줄로 남기면 다음 사람이 덜 헤매요.',
        '누군가 조언을 구하면 대신 결론을 내려 주기보다 먼저 확인할 기준을 함께 정리해 주세요. 선택지는 상대가 고를 수 있게 남겨 두어야 조언이 부담이 아니라 실제 힘으로 남아요.',
        '누군가 길을 물을 때는 대신 골라 주기보다 살펴볼 조건을 같이 정리해 주세요. 마지막 선택을 상대에게 남겨 두면 조언도 관계도 더 편안해져요.',
        '도움을 구한 사람에게는 내 결론보다 판단 순서를 건네는 편이 오래 도움이 돼요. 먼저 볼 조건과 멈춰야 할 기준을 알려 주면 상대가 자기 선택을 세우기 쉬워요.',
        '경험을 나눌 때는 내가 정답을 쥐고 있다는 느낌을 주지 않는 것이 중요해요. 확인할 질문을 함께 만들면 상대가 스스로 결정할 힘을 잃지 않아요.',
        '조언을 건넬 때는 성공한 방식뿐 아니라 조심했던 지점도 짧게 알려 주세요. 그래야 듣는 사람이 기대와 위험을 함께 보고 자기 상황에 맞게 고를 수 있어요.',
        '도움을 청한 사람에게 필요한 것은 정답보다 판단할 손잡이일 수 있어요. 먼저 볼 기준과 조심할 지점을 알려 주고, 결정은 스스로 해 볼 시간을 남겨 주세요.',
        '상대가 막막해할수록 결론을 빨리 주기보다 선택지를 정리해 주는 편이 좋아요. 고를 수 있는 폭이 남아 있어야 조언이 부담으로 느껴지지 않아요.',
        '조언을 구한 사람에게는 내가 겪은 기준을 짧게 건네고, 그 사람이 다시 고를 여지를 남겨 주세요. 그래야 경험이 압박이 아니라 실제 도움으로 남아요.',
        '내 경험을 나눌 때는 잘된 일만 말하지 않아도 괜찮아요. 어려웠던 순간과 그때 확인한 기준을 함께 들려주면 훨씬 현실적인 도움이 돼요.',
        '주변 사람이 조언을 기다릴 때는 긴 설명보다 바로 확인할 순서가 더 필요할 수 있어요. 처음 볼 것 하나와 나중에 볼 것 하나를 나누어 주면 충분해요.',
        '내가 아는 길을 전할 때도 상대의 속도를 남겨 두는 편이 좋아요. 기준을 알려 주고, 결정은 그 사람이 다시 고르게 두면 관계도 조언도 편안해져요.',
        '경험은 쌓아 두기만 하면 흐려질 수 있어요. 필요한 사람에게 짧은 사례와 확인 기준을 나누면 내가 지나온 시간이 실제 도움으로 바뀌어요.',
      ]),
    )
    .replace(
      /큰 역할에서 한 발 물러나는 일이 생겨도 끝이라고 볼 필요는 없어요\. 내가 쌓아 온 방식이 다음 사람에게 이어지고, 나는 더 편안한 속도로 일과 책임을 고를 수 있는 전환점으로 받아들이면 마음이 가벼워져요\./g,
      pickVariant(ctx, 'sourceTransition', [
        '큰 역할에서 한 발 물러나는 일이 생겨도 끝이라고 볼 필요는 없어요. 내가 쌓아 온 방식이 다음 사람에게 이어지고, 나는 더 편안한 속도로 일과 책임을 고를 수 있는 전환점으로 받아들이면 마음이 가벼워져요.',
        '큰 책임을 조금 내려놓는 일이 생겨도 그것이 곧 끝은 아니에요. 이제는 모든 일을 직접 떠안기보다 필요한 곳에 경험을 나누며 내 속도에 맞는 역할을 고르는 전환점으로 볼 수 있어요.',
        '앞에 서는 일이 줄어드는 시기라도 가치가 줄어드는 것은 아니에요. 쌓아 온 방식이 다음 사람에게 이어질 때, 나는 더 가벼운 마음으로 새로운 책임의 크기를 고를 수 있어요.',
        '예전 역할에서 한 걸음 물러나는 결정은 아쉬울 수 있지만, 다음 역할을 준비하는 시간이 될 수 있어요. 직접 해내는 힘에서 방향을 알려 주는 힘으로 옮겨 간다고 보면 마음이 훨씬 편해져요.',
        '맡던 무게가 줄어드는 순간이 와도 그동안의 경험이 사라지는 것은 아니에요. 이제는 직접 다 해내는 방식보다 필요한 사람에게 기준을 나누며 내 속도에 맞는 역할을 고르는 편이 좋아요.',
        '일의 중심에서 조금 비켜서는 시기가 와도 쓸모가 줄었다고 볼 필요는 없어요. 오래 쌓은 판단력은 조언, 점검, 방향 제안처럼 더 가벼운 역할에서도 충분히 빛날 수 있어요.',
        '큰 책임을 내려놓는 일은 마침표라기보다 다음 책임의 크기를 다시 고르는 시간에 가까워요. 내가 계속 맡을 일과 다른 사람에게 넘길 일을 나누면 마음도 훨씬 편해져요.',
        '맡는 일이 줄어드는 시기는 비어 버린 시간이 아니라 다음 역할을 고르는 시간이에요. 지금까지 쌓은 경험을 어디에 나누면 편한지 생각하면 변화가 덜 허전해져요.',
        '앞에서 모두 이끌지 않아도 경험의 값은 그대로 남아요. 이제는 필요한 순간에 기준을 나누고, 내 생활을 지킬 만큼의 책임을 고르는 쪽이 더 잘 맞을 수 있어요.',
        '직접 해내는 양이 줄어들어도 판단력과 기억은 사라지지 않아요. 오히려 누군가가 길을 잃지 않게 한마디를 건네는 역할이 더 편안하게 어울릴 수 있어요.',
        '책임의 크기가 달라져도 내가 쌓아 온 감각은 그대로 남아요. 모든 일을 붙잡기보다 넘길 일과 남길 일을 나누면 다음 단계가 훨씬 가벼워져요.',
        '이전만큼 앞에서 끌고 가지 않아도 내 역할이 사라지는 것은 아니에요. 이제는 필요한 순간에 기준을 알려 주고, 내 생활을 지킬 만큼만 책임을 고르면 좋아요.',
        '역할이 바뀌는 시기는 빈자리를 견디는 시간이 아니라 새 크기를 고르는 시간이에요. 계속 맡을 일, 넘길 일, 조언만 남길 일을 나누면 마음이 덜 흔들려요.',
        '큰 책임을 내려놓는 순간에도 쌓아 온 신뢰는 남아 있어요. 직접 해결하는 일은 줄이고, 방향을 확인해 주는 역할로 옮기면 변화가 더 편안해져요.',
        '앞에 서는 시간이 줄어도 경험의 무게는 그대로예요. 이제는 모든 일을 끌어안기보다 필요한 사람에게 기준을 나누고 내 회복 시간을 지키는 쪽이 잘 맞아요.',
        '예전 역할을 조금 내려놓는 일은 손해가 아니라 조절일 수 있어요. 내가 꼭 맡을 책임과 다른 사람에게 맡겨도 되는 책임을 나누면 다음 단계가 선명해져요.',
        '책임이 줄어드는 시기에는 허전함보다 남는 힘을 어디에 쓸지 보는 편이 좋아요. 경험을 나누고, 생활을 돌보고, 필요한 역할만 고르면 변화가 덜 부담스러워요.',
        '역할의 무게가 달라지는 순간이 와도 내가 쌓아 온 시간이 사라지는 것은 아니에요. 직접 해결할 일은 줄이고 기준을 나눌 일을 남기면 변화가 더 자연스럽게 이어져요.',
        '일의 중심이 바뀔 때는 무엇을 잃었는지보다 어떤 방식으로 남을 수 있는지를 보는 편이 좋아요. 경험을 필요한 곳에 나누고 생활의 속도를 지키면 다음 역할도 덜 부담스러워요.',
        '예전처럼 모든 일을 책임지지 않아도 충분히 의미 있는 역할이 있어요. 확인해 줄 일, 조언해 줄 일, 편히 넘겨도 되는 일을 나누면 내 역할도 더 또렷해져요.',
        '지금은 앞에서 모든 일을 끌고 가기보다 필요한 기준을 남겨 주는 역할도 중요해요. 직접 맡을 일과 조언만 보태도 되는 일을 나누면 부담이 줄어요.',
        '오래 쌓은 경험은 모든 책임을 계속 들고 있을 때보다 알맞게 나눌 때 더 오래 힘을 낼 수 있어요. 확인할 일, 넘길 일, 지켜볼 일을 구분해 보세요.',
        '큰 역할에서 조금 물러난다고 의미가 줄어드는 것은 아니에요. 필요한 사람이 길을 찾도록 기준을 알려 주고, 나머지는 편히 맡기는 태도도 좋은 역할이에요.',
        '지금의 역할은 더 많이 붙잡는 쪽보다 잘 나누는 쪽에서 또렷해질 수 있어요. 내가 끝낼 일과 다른 사람이 이어 갈 일을 구분하면 다음 단계가 가벼워져요.',
        '큰 책임에서 조금 떨어지는 일은 끝이 아니라 조절에 가까워요. 내가 계속 품을 기준과 다음 사람에게 건넬 기준을 나누면 마음이 훨씬 가벼워져요.',
        '앞에서 이끌던 시간이 줄어도 뒤에서 받쳐 주는 힘은 여전히 남아 있어요. 필요한 순간에 방향을 확인해 주고, 내 회복 시간을 지키는 역할이 더 오래 맞을 수 있어요.',
      ]),
    )
    .replace(
      /인생 전체의 직업(?:운| 방향| 흐름)은 그동안 쌓아 온 중심이 단단한 자산으로 자리 잡는 시기예요\. 한 분야에서 인정받은 신뢰가 새 기회의 문을 한 번씩 더 크게 열어 주고, 사람을 받쳐 주는 자리가 늘어나요\./g,
      pickVariant(ctx, 'sourceCareerMidlifeTrust', [
        '인생 전체의 일과 책임은 그동안 쌓아 온 신뢰가 더 넓은 기회로 이어지는 시기예요. 한 분야에서 인정받은 경험은 혼자 빛나는 성과를 넘어, 주변 사람이 믿고 따를 기준이 될 수 있어요.',
        '길게 보면 이 시기의 일은 새로 증명하는 것보다 이미 쌓은 신뢰를 잘 쓰는 쪽에 가까워요. 맡아 온 분야에서 인정받은 경험을 정리해 두면 다음 역할과 협업의 폭이 더 넓어져요.',
        '인생 전체의 일의 방향은 그동안 만든 기준이 더 넓은 책임으로 이어지는 모습이에요. 혼자 성과를 더 내는 것뿐 아니라, 사람을 판단하고 방향을 잡아 주는 힘도 중요한 자산이 돼요.',
        '오래 쌓은 실력과 평판이 일의 다음 문을 열어 주기 쉬운 시기예요. 그래서 더 많은 일을 붙잡기보다 어떤 기준으로 결정하고 누구와 나눌지 정리하는 태도가 중요해요.',
      ]),
    )
    .replace(
      /올해의 직업(?:운| 방향| 흐름)은 그동안 쌓아 온 중심이 단단한 자산으로 자리 잡는 흐름이에요\. 한 분야에서 인정받은 신뢰가 새 기회의 문을 한 번 더 크게 열어 주고, 사람을 받쳐 주는 자리가 늘어나는 한 해예요\./g,
      pickVariant(ctx, 'sourceCareerMidlifeTrust', [
        '올해의 일과 책임은 그동안 쌓아 온 신뢰가 더 넓은 기회로 이어지는 모습이에요. 한 분야에서 인정받은 경험은 혼자만의 성과를 넘어, 주변 사람이 믿고 함께 움직일 기준이 될 수 있어요.',
        '올해는 새로 증명하려 애쓰기보다 이미 쌓은 평판을 차분히 쓰는 쪽이 잘 맞아요. 맡아 온 분야에서 인정받은 경험을 정리해 두면 다음 역할과 협업의 폭이 더 넓어져요.',
        '올해 일의 방향은 오래 만든 기준이 더 넓은 책임으로 이어지는 쪽에 가까워요. 혼자 앞서가는 성과뿐 아니라, 사람들과 방향을 맞추고 기준을 나누는 힘도 중요해져요.',
        '오랫동안 쌓은 실력과 평판이 새 기회를 열어 주기 쉬운 해예요. 그래서 더 많은 일을 붙잡기보다 어떤 결정은 직접 맡고 어떤 결정은 나눌지 정리하는 태도가 필요해요.',
      ]),
    )
    .replace(
      /인생 전체의 일과 책임은 직접 성과를 내는 시기를 지나, 쌓아 온 경험을 다른 사람에게 전해 주는 방향으로 넓어져요\. 예전처럼 모든 일을 앞에서 끌고 가기보다, 필요한 순간에 조언하고 기준을 잡아 주는 역할이 더 잘 어울리는 시기예요\./g,
      pickVariant(ctx, 'sourceCareerElderIntro', [
        '이 시기의 일과 책임은 더 많이 해내는 쪽보다 경험을 필요한 곳에 나누는 쪽으로 넓어져요. 앞에서 모두 끌고 가려 하지 않아도, 중요한 순간에 기준을 잡아 주는 역할만으로 충분히 값져요.',
        '일과 책임은 나이가 들수록 직접 앞에서 해내는 힘만으로 보지 않아도 괜찮아요. 오래 쌓은 기준을 필요한 사람에게 나누고, 중요한 순간에 방향을 잡아 주는 역할이 더 자연스럽게 어울려요.',
        '이 시기의 일은 더 많이 떠안는 것보다 경험을 잘 건네는 쪽에 가까워요. 내가 지나온 시행착오와 판단 기준을 정리해 두면, 주변 사람도 더 안정적으로 다음 선택을 할 수 있어요.',
        '직접 성과를 내는 속도보다 쌓아 온 경험의 쓰임이 더 중요해져요. 모든 일을 맡으려 하기보다 필요한 곳에 조언을 보태는 방식이 일과 책임을 더 편안하게 이어 줘요.',
        '오래 해 온 일은 결과만 남기는 것이 아니라 판단 기준도 남겨요. 그 기준을 정리해 가까운 사람이나 후배에게 나누면 내 경험이 다음 선택을 돕는 자산이 돼요.',
        '이 시기에는 직접 앞장서는 힘보다 필요한 때에 길을 잡아 주는 힘이 더 편하게 어울릴 수 있어요. 내가 겪은 실수와 확인 순서를 나누면 일의 의미도 오래 남아요.',
        '일의 속도가 예전과 달라져도 쌓아 온 감각은 그대로 남아 있어요. 이제는 많이 해내는 양보다 어느 부분을 맡고 어느 부분을 넘길지 고르는 기준이 중요해져요.',
        '후반의 일과 책임은 새로운 성과를 억지로 증명하기보다 경험을 알맞은 곳에 쓰는 흐름이에요. 필요한 사람에게 확인 기준을 건네면 내 역할도 더 편안해져요.',
        '직접 처리하는 일의 양이 줄어도 방향을 보는 눈은 여전히 큰 힘이 돼요. 일의 순서와 조심할 점을 짧게 알려 주는 것만으로도 주변에는 실제 도움이 돼요.',
        '오래 일하며 배운 기준은 혼자만 갖고 있기보다 쓰기 쉬운 말로 남길수록 가치가 커져요. 다음 사람이 덜 헤매도록 확인 순서를 나누면 책임의 모양도 부드러워져요.',
      ]),
    )
    .replace(
      /무리해서 큰 도전을 만들기보다, 좋은 습관을 한 가지씩 더 단단히 만들어 가는 편이 보약이 돼요\. 산책, 가벼운 스트레칭, 따뜻한 한 끼처럼 일상의 작은 자리들이 그대로 큰 자산이 돼요\./g,
      pickVariant(ctx, 'sourceHealthSeniorHabit', [
        '새로운 운동을 크게 시작하기보다 지금 가능한 관리부터 편하게 이어 가면 좋아요. 짧은 산책, 가벼운 스트레칭, 따뜻한 식사처럼 익숙한 일이 몸과 마음을 오래 받쳐 줘요.',
        '큰 목표를 새로 세우기보다 이미 하고 있는 좋은 습관을 조금 더 편하게 이어 가는 편이 좋아요. 짧은 산책, 가벼운 스트레칭, 따뜻한 식사처럼 익숙한 관리가 몸과 마음을 오래 받쳐 줘요.',
        '새로운 계획을 크게 늘리기보다 지금 몸에 맞는 습관을 부드럽게 이어 가는 편이 좋아요. 걷기, 쉬기, 따뜻하게 먹기처럼 다시 할 수 있는 일이 가장 현실적인 관리예요.',
        '몸과 마음은 익숙한 관리가 안정적으로 반복될 때 편안해져요. 무리한 운동보다 짧은 움직임과 편한 식사, 충분한 휴식을 먼저 챙겨 보세요.',
        '건강 관리는 큰 목표보다 오늘도 할 수 있는 작은 기준에서 시작돼요. 산책 몇 분, 스트레칭 한 번, 따뜻한 한 끼가 긴 흐름을 받쳐 줘요.',
        '이미 잘 맞는 습관이 있다면 그것을 조금 더 편하게 유지하는 것이 좋아요. 새로 벌리기보다 지킬 수 있는 리듬을 남기는 편이 오래 갑니다.',
        '컨디션을 위해 대단한 변화를 만들 필요는 없어요. 몸이 덜 힘들었던 습관을 하나 골라 반복하면 다음 일정도 훨씬 부드러워져요.',
        '작은 건강 습관은 단순해 보여도 오래 쌓이면 큰 힘이 돼요. 가볍게 걷고, 천천히 먹고, 쉬는 시간을 놓치지 않는 흐름을 먼저 지켜 보세요.',
        '몸을 돌보는 기준은 어려울수록 오래가기 힘들어요. 오늘 편하게 다시 할 수 있는 움직임과 식사, 휴식 하나를 남기는 편이 좋습니다.',
        '무리한 변화보다 내 몸이 받아들이는 작은 반복이 더 든든해요. 같은 시간에 잠깐 걷고, 편하게 먹고, 쉬는 시간을 놓치지 않으면 컨디션의 바탕이 차분히 살아나요.',
        '생활 습관은 크게 바꾸지 않아도 힘이 생겨요. 매일 비슷한 시간에 움직이고 쉬는 흐름을 남기면 몸이 다음 일정을 덜 버겁게 받아들여요.',
        '컨디션은 대단한 결심보다 작은 반복에서 안정돼요. 천천히 먹기, 잠깐 걷기, 정해 둔 시간에 쉬기처럼 쉬운 기준을 지키면 몸의 부담이 줄어요.',
        '새로운 도전을 크게 벌이지 않아도 괜찮아요. 몸이 편안해지는 작은 습관을 하나씩 남기는 것이 길게 보면 가장 현실적인 관리가 돼요.',
      ]),
    )
    .replace(
      /주변 가족·친구와 함께 챙기는 자리도 의미가 커요\. 마음이 든든해지는 만남을 자주 만들면, 컨디션의 리듬이 자연스럽게 따라와요\./g,
      pickVariant(ctx, 'sourceHealthSeniorSupport', [
        '가족이나 친구와 가볍게 안부를 나누는 시간도 몸과 마음에 도움이 돼요. 마음이 든든해지는 만남을 조금씩 이어 가면 컨디션도 더 편안하게 따라와요.',
        '가까운 사람과 안부를 나누는 시간도 컨디션 관리에 도움이 돼요. 혼자 버티기보다 편하게 웃고 이야기할 수 있는 관계가 마음의 힘을 보태 줘요.',
        '몸을 챙기는 일은 혼자만의 숙제가 아니에요. 가족이나 친구와 가벼운 약속을 만들면 걷기, 식사, 휴식도 더 자연스럽게 이어져요.',
        '마음이 놓이는 사람과 자주 연결되는 것이 큰 도움이 돼요. 짧은 통화나 함께한 식사처럼 작은 만남이 컨디션을 안정시키는 힘이 될 수 있어요.',
        '컨디션을 지키는 데는 약이나 운동만큼 관계의 안정감도 중요할 때가 있어요. 편한 사람과 짧게 웃고 이야기하는 시간이 몸의 긴장을 낮춰 줘요.',
        '가까운 사람과의 만남은 거창하지 않아도 좋아요. 짧은 안부, 함께 걷기, 따뜻한 식사처럼 부담 없는 연결이 회복의 리듬을 만들어 줘요.',
        '혼자 조용히 쉬는 시간과 사람 곁에서 마음이 놓이는 시간을 함께 두면 좋아요. 둘이 균형을 이루면 몸도 마음도 덜 외롭게 회복돼요.',
        '몸이 약간 무거운 날에는 혼자 버티기보다 편한 사람에게 안부를 전해 보세요. 짧은 대화만으로도 긴장이 풀리고 생활 리듬이 부드러워질 수 있어요.',
        '건강 관리는 혼자 잘해야 하는 숙제가 아니에요. 걷는 약속이나 식사 약속처럼 작고 편한 만남이 몸을 챙기는 좋은 계기가 될 수 있어요.',
        '마음이 든든해지는 관계는 컨디션에도 영향을 줘요. 자주 만나지 못하더라도 가벼운 전화나 메시지를 남기면 회복의 바탕이 조금 더 안정돼요.',
        '가까운 사람과 보내는 평범한 시간이 몸을 돌보는 기준이 될 수 있어요. 무리한 만남보다 편하게 웃고 돌아올 수 있는 시간이 더 잘 맞아요.',
        '도움을 받을 수 있는 사람을 떠올려 두는 것만으로도 마음이 덜 긴장해요. 필요할 때 짧게 말할 길이 있으면 회복도 덜 외롭게 이어져요.',
      ]),
    )
    .replace(
      /잘 자고, 잘 먹고, 잘 움직이는 세 가지를 한 번씩 점검하는 습관만 있어도 몸과 마음이 훨씬 부드러워져요\. 매일 같은 시각에 일어나는 작은 규칙이 긴 흐름에서는 큰 도움이 돼요\./g,
      pickVariant(ctx, 'sourceHealthBalancedBasics', [
        '수면, 식사, 움직임을 하루에 한 번씩만 살펴도 몸과 마음이 한결 부드러워져요. 매일 비슷한 시간에 일어나는 작은 규칙은 긴 시간 동안 컨디션을 받쳐 줘요.',
        '잠든 시간, 먹은 시간, 걸은 시간을 가볍게 떠올리는 것만으로도 몸의 흐름이 보이기 시작해요. 크게 바꾸기보다 반복되는 기본을 확인하는 편이 오래 도움이 돼요.',
        '몸과 마음은 작은 기본이 일정할 때 훨씬 편안해져요. 오늘은 잠, 식사, 움직임 중 가장 쉬운 하나만 안정시켜도 다음 조절의 기준이 생겨요.',
        '컨디션을 복잡하게 점검하지 않아도 괜찮아요. 언제 쉬었고, 어떻게 먹었고, 얼마나 움직였는지 한 가지만 봐도 내 몸의 리듬이 조금 더 선명해져요.',
        '건강의 기본은 멀리 있지 않아요. 비슷한 시간에 일어나고, 거르지 않고 먹고, 조금 움직이는 흐름이 쌓이면 몸과 마음이 덜 흔들려요.',
        '새 관리법을 찾기 전에 하루의 기본을 먼저 확인해 보세요. 잠, 식사, 움직임 중 편했던 하나를 붙잡으면 컨디션을 다시 세우기 쉬워요.',
        '수면, 식사, 움직임을 거창하게 바꾸지 않아도 좋아요. 매일 비슷한 시간에 자고 일어나며 몸의 리듬을 확인하는 것만으로도 안정감이 생겨요.',
        '컨디션은 특별한 관리보다 반복되는 기본에서 많이 달라져요. 잠자는 시간, 식사 간격, 하루의 움직임을 가볍게 살피면 몸과 마음이 덜 흔들려요.',
        '하루를 잘 보내는 기본은 단순해요. 충분히 쉬고, 편하게 먹고, 조금 움직이는 흐름을 일정하게 유지하면 긴 시간의 컨디션도 더 부드러워져요.',
        '몸의 기본은 대단한 관리보다 같은 시간에 반복되는 작은 습관에서 만들어져요. 잠드는 시간, 식사 간격, 가벼운 움직임만 살펴도 다음 조절이 쉬워져요.',
        '컨디션을 볼 때는 잘못한 일을 찾기보다 이미 편했던 리듬을 먼저 확인해 보세요. 편했던 시간대를 알면 무리하지 않는 관리가 쉬워져요.',
        '잠, 식사, 움직임은 따로 떨어진 일이 아니에요. 하나가 흔들리면 다른 것도 같이 흔들릴 수 있으니 가장 쉬운 한 가지부터 안정시키면 좋아요.',
        '몸과 마음은 작은 반복을 오래 기억해요. 물을 마신 시간, 잠깐 걸은 시간, 편하게 먹은 한 끼가 쌓이면 컨디션의 바탕이 돼요.',
        '새로운 관리법을 찾기 전에 기본 리듬을 먼저 살펴보세요. 최근 덜 지쳤던 날의 잠, 식사, 움직임을 떠올리면 내게 맞는 기준이 보여요.',
        '건강한 흐름은 거창한 결심보다 유지 가능한 기본에서 시작돼요. 너무 어려운 계획보다 매일 다시 할 수 있는 작은 습관이 더 오래 가요.',
      ]),
    )
    .replace(
      /가벼운 변화나 새 시도는 한 번에 하나씩만 들여 봐도 좋아요\. 무리하지 않는 페이스가 길게 가는 핵심이에요\./g,
      pickVariant(ctx, 'sourceHealthBalancedPace', [
        '가벼운 변화는 한 번에 하나씩만 들여도 충분해요. 무리하지 않는 속도를 지켜야 몸도 마음도 오래 따라와요.',
        '새로운 습관은 한꺼번에 늘리지 않는 편이 좋아요. 하나가 익숙해진 뒤 다음 것을 더하면 몸도 마음도 부담을 덜 느껴요.',
        '좋아 보이는 방법이 많아도 한 번에 다 바꾸지 않아도 괜찮아요. 내 생활에 맞는지 천천히 확인하면서 속도를 조절하는 것이 더 오래 가요.',
        '변화는 작게 넣을수록 유지하기 쉬워요. 오늘 하나만 가볍게 바꿔 보고, 몸이 편한지 며칠 살펴보는 방식이 잘 맞아요.',
        '몸이 편한 변화는 대개 크기가 작아요. 잠을 조금 앞당기기, 물 한 잔 더 마시기, 짧게 걷기처럼 쉬운 변화부터 두면 오래 이어져요.',
        '좋아 보이는 방법이 많을수록 먼저 하나만 고르는 편이 좋아요. 내 몸이 편하게 받아들이는지 확인한 뒤 다음 변화를 더해도 늦지 않아요.',
        '새 습관을 넣을 때는 성공 여부보다 부담이 줄었는지를 먼저 보세요. 덜 지치는 방식이어야 긴 흐름에서도 계속 쓸 수 있어요.',
        '무리하지 않는 속도는 게으른 선택이 아니에요. 몸이 따라올 수 있는 크기로 바꾸는 것이고, 그래야 좋은 습관도 오래 남아요.',
        '변화를 시작했다면 며칠 뒤 몸의 반응을 다시 보세요. 편해졌는지, 피로가 늘었는지 확인해야 내 생활에 맞는 기준이 생겨요.',
        '컨디션 관리는 한 번에 완성하는 일이 아니에요. 잘 맞는 작은 행동을 찾고, 맞지 않는 것은 줄여 가며 내 몸에 맞춰 가면 돼요.',
      ]),
    )
    .replace(
      /새로 배우는 흐름도 좋고, 익힌 것을 정리해 글이나 강의로 남기는 리듬도 좋아요\. 빠른 학습보다 천천히 음미하는 학습이 더 잘 어울리는 시기라, 한 권의 고전을 다시 읽는 흐름이 의외로 큰 깊이를 만들어요\./g,
      pickVariant(ctx, 'sourceAcademicSeniorLearning', [
        '새로운 것을 배우는 일도 좋고, 익힌 것을 글이나 대화로 정리해 보는 일도 좋아요. 빨리 배우기보다 천천히 곱씹는 방식이 더 깊은 배움으로 이어져요.',
        '새로운 것을 배우는 일도 좋지만, 이미 알고 있는 내용을 다시 정리하는 배움도 깊이가 있어요. 빨리 끝내기보다 천천히 읽고 생각을 붙이는 방식이 더 잘 맞아요.',
        '이 시기에는 공부의 속도보다 이해의 깊이가 더 중요해요. 오래전에 배운 내용을 다시 읽고 내 말로 정리하면, 경험과 지식이 자연스럽게 이어져요.',
        '배움은 새 책을 많이 쌓는 일만은 아니에요. 익숙한 주제를 다시 살피고, 내가 느낀 점을 짧게 남기는 과정에서 생각이 더 단단해질 수 있어요.',
        '이 시기의 배움은 새 지식을 빨리 모으는 일보다 지나온 경험과 연결해 보는 일에 더 가까워요. 예전에 알던 내용을 다시 읽으면 지금의 생각이 더 또렷하게 붙어요.',
        '이미 알고 있는 주제도 천천히 다시 보면 새롭게 보일 수 있어요. 한 문장을 읽고 내 경험 하나를 떠올리는 것만으로도 배움이 생활과 자연스럽게 이어져요.',
        '공부는 책상 앞에서만 일어나지 않아요. 강의, 대화, 산책 중 떠오른 생각을 짧게 남기면 그날의 배움이 오래 보관돼요.',
        '이 시기에는 많이 끝내는 것보다 오래 곱씹는 힘이 더 잘 맞아요. 마음에 남은 문장 하나를 며칠 두고 다시 읽어 보면 생각이 깊어져요.',
        '새로운 공부가 부담스럽다면 익숙한 주제부터 다시 펼쳐도 괜찮아요. 이미 가진 경험 위에 한 줄을 더하는 방식이 훨씬 편하게 이어져요.',
        '배움은 나이가 들수록 지나온 시간을 다시 이해하는 도구가 될 수 있어요. 짧은 글 하나도 내 이야기와 연결되면 충분히 깊은 공부가 돼요.',
      ]),
    )
    .replace(
      /손에 잡힌 책 한 권을 천천히 처음부터 다시 읽어 보고 떠오른 생각을 짧은 메모로 남겨 보세요\. 비슷한 길을 걷는 동료와 한 줄을 주고받는 자리도 한 호흡 더 깊은 풍경을 만들어 줘요\./g,
      pickVariant(ctx, 'sourceAcademicSeniorMemo', [
        '책 한 권을 천천히 다시 읽고, 떠오른 생각을 짧은 메모로 남겨 보세요. 비슷한 관심을 가진 사람과 한 줄씩 나누면 배움이 더 따뜻한 대화로 이어져요.',
        '책 한 권을 정해 천천히 다시 읽고, 마음에 남는 문장을 한 줄만 적어 보세요. 그 메모를 가까운 사람과 나누면 배움이 혼자만의 시간이 아니라 대화로 이어져요.',
        '읽은 내용을 길게 정리하지 않아도 괜찮아요. 오늘 떠오른 생각 한 줄, 다시 보고 싶은 문장 하나만 남겨도 나중에 꺼내 볼 좋은 기록이 돼요.',
        '비슷한 관심을 가진 사람과 짧게 생각을 나누면 배움이 더 오래 남아요. 한 문장을 주고받는 정도의 가벼운 대화도 충분히 깊은 공부가 될 수 있어요.',
        '마음에 남은 문장을 작은 쪽지에 적어 두면 나중에 다시 펼쳐 보기 좋아요. 그 쪽지를 가까운 사람과 나누면 배움이 혼자만의 기록에서 생활 속 대화로 이어져요.',
        '읽은 내용을 모두 설명하지 않아도 괜찮아요. 오늘 좋았던 한 문장과 왜 좋았는지만 남겨도 생각이 정리되고 다음 배움의 방향이 보여요.',
        '같은 책을 읽은 사람이 없어도 배움은 나눌 수 있어요. 내가 느낀 점을 쉬운 말로 바꾸는 과정에서 내용이 더 내 것이 돼요.',
        '책을 오래 붙잡기 어려운 날에는 문장 하나만 골라 소리 내어 읽어 보세요. 소리로 꺼낸 말은 기억에 더 오래 남고 대화의 시작점도 돼요.',
        '비슷한 관심을 가진 사람과 만날 일이 있다면 긴 토론보다 한 줄 감상을 나누어 보세요. 가벼운 말 한마디가 다음에 다시 읽을 힘을 만들어 줘요.',
        '메모는 길 필요가 없어요. 제목, 마음에 남은 말, 다음에 떠올릴 질문 하나만 있어도 배움이 다시 이어질 길이 생겨요.',
      ]),
    )
    .replace(
      /긴 흐름에서는 공부를 잘하는 힘보다 배운 것을 다시 꺼내 쓰는 힘이 중요해요\./g,
      pickVariant(ctx, 'sourceStudyLearningBase', [
        '긴 시간으로 보면 공부를 잘하는 힘보다 배운 것을 다시 꺼내 쓰는 힘이 더 중요해요.',
        '오래 보면 많이 외우는 힘보다 필요한 때 다시 찾아 쓰는 힘이 더 중요해요.',
        '기록과 배움은 한 번에 끝내는 일이 아니라, 필요할 때 다시 꺼내 보는 습관과 잘 맞아요.',
        '배운 내용을 오래 살리려면 머릿속에만 두기보다 찾기 쉬운 형태로 남기는 편이 좋아요.',
      ]),
    )
    .replace(
      /기록을 남기고, 필요한 때 찾아보고, 잘못된 부분을 고치는 습관이 쌓이면 문서와 학습 모두 안정돼요\./g,
      pickVariant(ctx, 'sourceStudyLearningRecord', [
        '기록은 길게 남기지 않아도 괜찮아요. 핵심 한 줄, 다시 볼 날짜, 확인할 위치만 적어 두면 다음에 훨씬 빨리 이어서 볼 수 있어요.',
        '문서나 공부 내용은 기억에만 맡기지 않는 편이 좋아요. 어디에 적어 두었는지 알 수 있게 정리하면 나중에 같은 실수를 줄일 수 있어요.',
        '확인한 것, 바꾼 것, 다음에 볼 것을 짧게 나누어 보세요. 세 줄만 남겨도 나중에 판단할 때 덜 헤매고 같은 실수를 줄이기 쉬워요.',
        '기록은 완벽한 노트보다 다시 찾기 쉬운 표식이 더 중요해요. 고친 부분과 확인할 부분을 나누어 두면 문서와 학습이 모두 안정돼요.',
        '공부하거나 확인한 내용은 한 번 보고 끝내기보다, 다음에 다시 볼 수 있게 표시해 두는 편이 좋아요. 날짜와 핵심만 남겨도 기록의 힘이 살아나요.',
        '틀린 부분을 감추지 않고 따로 표시해 두면 다음에는 더 빨리 고칠 수 있어요. 작은 수정 기록이 쌓이면 배움과 문서 관리가 훨씬 편해져요.',
        '중요한 내용은 긴 문장보다 찾기 쉬운 단서로 남겨 보세요. 제목, 날짜, 다시 볼 위치를 함께 적으면 나중에 필요한 내용을 빠르게 꺼낼 수 있어요.',
        '확인한 내용은 그대로 두고, 고친 내용은 따로 표시해 두면 좋아요. 나중에 다시 볼 때 무엇이 바뀌었는지 한눈에 보여서 마음이 훨씬 편해져요.',
        '자료를 남길 때는 다시 찾을 사람을 미래의 나라고 생각해 보세요. 제목, 날짜, 보관 위치를 짧게 붙이면 다음에 훨씬 덜 헤매요.',
        '공부한 내용이나 문서는 한 번에 예쁘게 정리하지 않아도 괜찮아요. 어디까지 봤는지, 무엇을 다시 볼지, 누구에게 물어볼지만 남겨도 충분해요.',
        '기록은 기억을 대신하는 안전장치예요. 중요한 내용은 머릿속에만 두지 말고 다시 열어 볼 수 있는 위치에 짧게 남겨 보세요.',
        '다시 볼 자료는 처음부터 길게 요약하지 않아도 돼요. 핵심 단어와 확인 날짜만 있어도 나중에 이어서 보기 쉬워요.',
        '바뀐 내용이 있는 문서는 고친 이유를 한 줄만 붙여 보세요. 이유가 남아 있으면 시간이 지나도 판단을 다시 세우기 쉬워요.',
        '공부와 문서 관리는 틀린 부분을 지우는 일보다 다시 확인할 길을 남기는 일에 가까워요. 단서 하나가 다음 실수를 줄여 줘요.',
        '중요한 파일이나 노트는 이름을 조금만 분명하게 붙여도 좋아요. 다시 찾기 쉬워지는 순간 기록은 실제 생활의 도움이 돼요.',
        '확인할 내용이 많을 때는 오늘 볼 것과 나중에 볼 것을 나누어 보세요. 두 묶음만 만들어도 기록이 덜 막막해져요.',
        '자료가 여러 곳에 흩어져 있다면 가장 자주 쓰는 것부터 한곳에 모아 보세요. 작은 정리 하나가 다음 확인 시간을 크게 줄여 줘요.',
        '배운 내용은 내 말로 한 줄만 바꿔 적어도 힘이 생겨요. 남의 문장을 그대로 외우는 것보다 다시 꺼내 쓰기 쉬워져요.',
      ]),
    )
    .replace(
      /오래 갈 학습일수록 매일의 작은 약속이 결과를 만들어요\./g,
      pickVariant(ctx, 'sourceStudyLearningPromise', [
        '오래 이어 갈 학습일수록 매일 지킬 수 있는 작은 약속이 결과를 만들어요.',
        '오래 이어 갈 공부라면 거창한 계획보다 매일 지킬 수 있는 작은 약속이 더 힘이 돼요.',
        '하루에 많이 하려는 마음보다 조금씩 이어 가는 습관이 결과를 만들어요.',
        '짧게라도 반복해서 확인하는 습관이 쌓이면 기록과 배움 모두 더 단단해져요.',
      ]),
    )
    .replace(
      /지금 시기는 학업·관계·취미 사이에서 평생 갈 컨디션의 (?:결|흐름)을 다듬는 흐름이에요\. 잠과 식사·움직임의 리듬이 이 시기에 단단해지면, 어른이 된 뒤에도 자기 페이스가 쉽게 흔들리지 않아요\./g,
      pickVariant(ctx, 'sourceTeenHealthRhythm', [
        '지금 시기는 학업·관계·취미 사이에서 몸과 마음의 리듬을 익혀 가는 때예요. 잠, 식사, 움직임이 이 시기에 안정되면 어른이 된 뒤에도 자기 페이스를 지키기 쉬워요.',
        '10대의 컨디션은 공부만이 아니라 친구 관계, 취미, 쉬는 시간과 함께 만들어져요. 이때 내 몸이 편한 리듬을 알아 두면 나중에도 흔들림을 줄이는 데 도움이 돼요.',
        '지금은 몸과 마음의 기본 습관을 배우는 시기예요. 잠자는 시간, 먹는 방식, 움직이는 양을 조금씩 살피면 자기에게 맞는 속도를 찾기 쉬워요.',
      ]),
    )
    .replace(
      /비유하자면 자라는 나무에 잔뿌리가 깊어지는 시기예요\. 큰 가지를 한 번에 키우려 하기보다, 매일의 잠·식사·짧은 움직임 같은 잔뿌리를 단단히 챙겨 두는 자리가 평생 갈 자산이 돼요\./g,
      pickVariant(ctx, 'sourceTeenHealthRoots', [
        '비유하자면 자라는 나무에 잔뿌리가 깊어지는 시기예요. 큰 가지를 한 번에 키우려 하기보다, 매일의 잠·식사·짧은 움직임 같은 잔뿌리를 단단히 챙기면 오래 도움이 돼요.',
        '나무가 천천히 뿌리를 내리듯, 컨디션도 작은 습관에서 자라요. 잠을 충분히 자고, 식사를 거르지 않고, 조금씩 움직이는 일이 몸의 바탕을 만들어 줘요.',
        '큰 변화 하나보다 매일 반복되는 작은 관리가 더 중요해요. 몸이 편한 습관을 일찍 알아 두면 공부와 관계에서도 지치지 않는 힘이 생겨요.',
        '몸의 바탕은 특별한 결심보다 매일 조금씩 지킨 리듬에서 단단해져요. 잠, 식사, 움직임 중 하나만 안정되어도 공부와 관계를 버틸 힘이 달라져요.',
        '지금 익힌 작은 건강 습관은 나중에 힘든 시기를 버티는 기준이 될 수 있어요. 무리해서 바꾸기보다 몸이 편했던 방식을 알아 두는 일이 먼저예요.',
        '컨디션은 큰 목표보다 반복되는 하루 습관의 영향을 더 많이 받아요. 편하게 잠든 날, 잘 먹은 날, 가볍게 움직인 날을 기억해 두면 자기 리듬을 찾기 쉬워요.',
      ]),
    )
    .replace(
      /친구의 페이스나 학교의 분위기에 자기를 무리해서 끼워 맞추지 않아도 괜찮아요\. 마음의 작은 신호 — 짜증·답답함·잠 부족 — 가 있다면 가족이나 가까운 어른에게 짧게라도 나눠 두는 자리, 좋아하는 활동을 한 가지 길게 이어 가는 자리가 자기 색을 단단하게 만들어요\./g,
      pickVariant(ctx, 'sourceTeenHealthSignal', [
        '친구의 페이스나 학교의 분위기에 자기를 무리해서 끼워 맞추지 않아도 괜찮아요. 짜증, 답답함, 잠 부족 같은 신호가 있으면 가족이나 가까운 어른에게 짧게 말해 두는 것이 좋아요. 좋아하는 활동을 꾸준히 이어 가는 것도 자기 색을 지키는 데 도움이 돼요.',
        '학교와 친구 관계가 바쁘게 느껴질수록 내 몸의 신호를 먼저 봐도 괜찮아요. 잠이 부족하거나 마음이 답답하면 믿을 만한 어른에게 짧게 말하고 쉬는 방법을 찾는 편이 좋아요.',
        '주변 분위기에 맞추느라 나를 너무 밀어붙이지 않아도 돼요. 짜증, 피곤함, 답답함이 자주 보이면 잠깐 멈추고 가족이나 가까운 어른에게 도움을 청해 보세요.',
        '친구와 비교하는 마음이 커질 때는 몸과 마음의 속도를 먼저 낮춰 보세요. 좋아하는 활동을 작게 이어 가면 자기 페이스를 잃지 않는 데 도움이 돼요.',
        '학교생활이 빠르게 흘러도 내 컨디션을 억지로 맞출 필요는 없어요. 불편한 신호가 보이면 혼자 참지 말고 편한 어른에게 한 문장으로라도 말해 두세요.',
        '또래의 속도가 전부는 아니에요. 내가 지치는 신호를 알아차리고 쉬어 가는 법을 배우면 공부와 관계에서도 자기 기준이 더 단단해져요.',
        '몸이 보내는 작은 신호는 귀찮은 방해가 아니라 쉬어 가라는 신호일 수 있어요. 잠, 식사, 마음 상태 중 하나만이라도 가까운 어른과 나누어 보세요.',
        '주변 속도에 맞추려다 너무 지치면 몸과 마음이 먼저 신호를 보내요. 그럴 때는 혼자 참기보다 믿을 만한 어른에게 짧게 이야기하고, 내가 편해지는 활동을 하나 남겨 두면 좋아요.',
        '학교생활이 바쁘더라도 내 컨디션을 억지로 밀어붙이지 않는 편이 좋아요. 힘든 신호를 빨리 알아차리고 쉬는 방법을 배우면 자기 페이스가 더 단단해져요.',
      ]),
    )
    .replace(
      /한 학기 한 번은 자기 잠 시각·식사 시간을 한 줄로 적어 두세요\. 그 한 줄을 다음 학기와 비교해 보는 자리가 평생 갈 컨디션의 자기 토대를 가벼운 손길로 단단하게 다듬어 줘요\./g,
      pickVariant(ctx, 'sourceTeenHealthRecord', [
        '한 학기에 한 번쯤 잠자는 시간과 식사 리듬을 한 줄로 적어 보세요. 다음 학기에 다시 보면 내 몸이 편한 기준을 찾는 데 도움이 돼요.',
        '가끔은 내가 가장 편하게 잠든 시간과 덜 피곤했던 식사 패턴을 짧게 적어 보세요. 기록이 작아도 다음에 몸 상태를 비교하는 기준이 돼요.',
        '학기 중에 컨디션이 흔들렸던 때와 편했던 때를 한 줄씩 남겨 두면 좋아요. 나중에 다시 보면 무엇을 유지할지 더 쉽게 고를 수 있어요.',
        '잠과 식사를 완벽하게 관리하려 하지 않아도 괜찮아요. 어느 시간이 편했는지만 짧게 남겨도 내 몸에 맞는 생활 기준을 찾는 데 도움이 돼요.',
        '한동안 지냈던 리듬을 돌아볼 때는 길게 쓰지 않아도 돼요. 잠든 시간, 먹은 시간, 가장 덜 피곤했던 날만 남겨도 다음 학기의 기준이 생겨요.',
        '몸 상태를 기억에만 맡기지 말고 가끔 짧게 표시해 보세요. 편했던 잠과 식사 시간이 보이면 무리하지 않는 생활 리듬을 찾기 쉬워요.',
        '가끔은 내가 언제 자고 어떻게 먹는지 짧게 기록해 두면 좋아요. 기록이 길 필요는 없고, 다음에 컨디션을 비교할 수 있을 정도면 충분해요.',
        '잠, 식사, 움직임을 한 줄씩 적어 보면 몸의 패턴이 더 잘 보여요. 작은 기록이 쌓이면 무엇을 줄이고 무엇을 유지할지 고르기 쉬워요.',
      ]),
    )
    .replace(
      /비유하자면 평생의 컨디션은 매일 한 알씩 심어 두는 잔뿌리 씨앗 같아요\. 한 학기 한 자리에서 큰 변화를 만들려 하지 않아도, 매일 잔뿌리 한 줄씩 자라난 자취가 자기 평생의 단단한 자리를 받쳐 주는 토양이 되어요\./g,
      pickVariant(ctx, 'sourceTeenHealthSeed', [
        '비유하자면 컨디션은 매일 조금씩 자라는 작은 씨앗 같아요. 한 학기에 큰 변화를 만들지 않아도, 잠과 식사와 움직임을 챙긴 흔적이 나중에 몸을 받쳐 주는 바탕이 돼요.',
        '몸의 바탕은 하루아침에 만들어지지 않아요. 매일 조금씩 쉬고 먹고 움직인 경험이 쌓이면, 시간이 지나도 나를 지켜 주는 힘이 돼요.',
        '컨디션은 큰 결심 하나보다 매일 반복한 작은 돌봄에서 자라요. 잘 쉰 날과 덜 무리한 날이 쌓이면 나중에도 버틸 수 있는 힘이 생겨요.',
        '몸은 빠르게 바꾸는 것보다 꾸준히 챙긴 시간을 더 오래 기억해요. 잠깐 쉬고, 잘 먹고, 가볍게 움직인 경험이 결국 생활의 바탕이 돼요.',
        '건강의 토대는 특별한 날보다 평범한 날의 작은 선택에서 만들어져요. 오늘 무리하지 않고 챙긴 습관 하나가 시간이 지나 내 몸을 받쳐 줘요.',
        '매일의 작은 회복은 당장 크게 보이지 않아도 오래 남아요. 쉬는 시간과 식사, 가벼운 움직임을 조금씩 지키면 몸의 기준이 단단해져요.',
        '몸의 힘은 한 번의 변화보다 여러 번의 작은 관리에서 생겨요. 오늘 편했던 리듬을 기억해 두면 나중에 흔들릴 때 다시 돌아올 기준이 됩니다.',
        '작은 습관은 당장 크게 보이지 않아도 오래 남아요. 오늘의 잠, 식사, 움직임을 조금 챙기는 일이 나중의 컨디션을 편하게 만들어 줄 수 있어요.',
      ]),
    )
    .replace(
      /도움을 받는 일이 늘어나 미안함이 올라올 수도 있어요. 하지만 받는 손길을 고맙게 받아들이는 모습도 가족에게 중요한 배움이 돼요. 서로 기대고 돌보는 경험을 통해 다음 세대도 관계를 편안하게 배우게 돼요./g,
      pickVariant(ctx, 'sourceFamilyReceive', [
        '도움을 받는 일이 생기면 미안함보다 고마움을 먼저 말해도 괜찮아요. 서로 기대고 돌보는 경험이 쌓이면 가족 안의 안정감도 더 깊어져요.',
        '누군가 손을 내밀 때는 혼자 버티려 하기보다 필요한 만큼 받아들이는 편이 좋아요. 짧은 고마움 표현 하나가 관계를 더 따뜻하게 만들어 줘요.',
        '돌봄은 한쪽이 약해지는 일이 아니라 관계가 서로를 지키는 방식일 수 있어요. 받을 것은 받고, 할 수 있는 것은 나누면 부담이 훨씬 줄어요.',
        '도움을 받는 일이 늘어나도 그것이 약해졌다는 뜻은 아니에요. 필요한 도움을 편하게 받아들이고 고마움을 전하면 가까운 사람도 마음 놓고 곁에 설 수 있어요.',
        '혼자 다 해내지 못하는 시기가 와도 괜찮아요. 도움을 자연스럽게 받아들이는 모습이 가족에게는 서로 기대는 법을 배우게 해 줘요.',
        '관계는 주는 쪽만으로 깊어지지 않아요. 필요한 순간에 도움을 받고, 마음이 편해졌을 때 고마움을 돌려주면 서로의 신뢰가 더 오래 남아요.',
        '가족 관계에서는 도움을 주는 일과 받는 일이 함께 있어야 오래 편안해져요. 미안함만 크게 보지 말고, 고마움을 말로 남기면 서로가 덜 부담스러워져요.',
        '누군가의 도움을 받는 순간에도 내 마음을 작게 표현할 수 있어요. 고맙다는 말, 편해졌다는 말, 다음에 내가 할 수 있는 일을 나누면 관계가 안정돼요.',
        '돌봄을 주고받는 일은 한쪽의 몫으로만 남기지 않는 편이 좋아요. 지금 받을 도움과 내가 편히 나눌 수 있는 마음을 구분하면 가족 안의 균형이 살아나요.',
        '가까운 사람에게 도움을 받는 시간이 생겨도 관계가 약해지는 것은 아니에요. 필요한 만큼 기대고 고마움을 짧게 표현하면 서로의 부담이 훨씬 부드러워져요.',
        '기대는 일이 어색할 때는 많이 설명하려 하지 않아도 괜찮아요. 고맙다는 말과 다음에 내가 할 수 있는 작은 일을 함께 남기면 관계가 편안해져요.',
        '도움을 받는 순간에도 관계는 새 균형을 찾아갈 수 있어요. 받을 것은 받고, 미안함보다 고마움을 먼저 말하면 가까운 사람도 덜 부담스러워해요.',
        '가까운 관계는 한쪽이 늘 주기만 할 때보다 주고받는 흐름이 있을 때 오래 편해져요. 오늘 받은 도움과 내가 나눌 수 있는 마음을 작게 구분해 보세요.',
        '도움을 받는 일이 어색하다면 먼저 필요한 만큼만 받아들이는 연습을 해 보세요. 다 받은 뒤 설명하려 하기보다, 받는 순간의 고마움을 짧게 전하면 충분해요.',
        '도움을 받을 때마다 길게 미안해하지 않아도 돼요. 필요한 부분을 짧게 말하고 고맙다는 마음을 전하면 관계가 더 편안해져요.',
        '가까운 사람이 손을 내밀면 먼저 필요한 부분만 편하게 받아 보세요. 작은 도움을 받아들이는 태도도 가족에게는 안심이 되는 신호예요.',
        '도움은 관계의 빚이라기보다 서로 돌보는 방식에 가까워요. 오늘 받은 도움을 기억해 두었다가 나중에 할 수 있는 만큼 따뜻하게 돌려주면 충분해요.',
        '혼자 버티는 시간이 길었다면 도움을 받는 연습도 필요해요. 필요한 것을 짧게 말하고, 편해진 마음을 표현하면 가까운 사람도 덜 조심스러워져요.',
        '도움을 받는다고 마음의 빚을 크게 안을 필요는 없어요. 고마운 마음을 짧게 전하고 내 속도를 지키면 주고받는 흐름이 자연스러워져요.',
      ]),
    )
    .replace(
      /비유하자면 잘 익은 가을 들판을 천천히 걷는 시간이에요. 새로 씨를 뿌리지 않아도 오래 쌓인 마음이 은은한 빛으로 가족을 비추고, 그 빛이 다음 세대가 안심하고 걸어갈 힘이 되어 줘요./g,
      pickVariant(ctx, 'sourceFamilyAutumn', [
        '비유하자면 잘 익은 가을 들판을 천천히 걷는 시간이에요. 새로 씨를 뿌리지 않아도 오래 쌓인 마음이 은은한 빛으로 가족을 비추고, 그 빛이 다음 세대가 안심하고 걸어갈 힘이 되어 줘요.',
        '비유하자면 오래 돌본 정원에 햇볕이 천천히 내려앉는 시간이에요. 새 꽃을 더 심지 않아도 그동안 가꾼 마음이 가족에게 편안한 그늘이 돼요. 곁에 있는 사람들은 그 따뜻함을 오래 기억해요.',
        '비유하자면 오래 끓인 국물이 조용히 깊어지는 시간이에요. 특별한 말을 많이 하지 않아도 쌓아 온 마음이 가족의 식탁에 남아요. 그 잔잔한 온기가 다음 세대의 마음도 편하게 해 줘요.',
        '오래 지켜 온 마음은 큰 말보다 평소의 태도에 더 잘 남아요. 함께 앉아 밥을 먹고, 안부를 묻고, 편히 들어 주는 시간이 가족에게 든든한 기억이 돼요.',
        '이 시기에는 무엇을 더 가르치려 하기보다 곁에 있어 주는 힘이 더 크게 느껴질 수 있어요. 조용히 들어 주고 웃어 주는 태도가 가까운 사람에게 안정감을 남겨요.',
        '인생 후반의 가족 관계는 누가 옳은지보다 누가 편히 머물 수 있는지가 더 중요해질 수 있어요. 짧은 안부와 함께 보내는 시간이 가족의 바탕을 든든하게 해 줘요.',
        '가족에게 남는 기억은 큰 조언보다 반복된 편안함일 때가 많아요. 같은 식탁, 같은 안부, 조용히 들어 준 시간이 시간이 지나 더 큰 힘으로 남아요.',
        '오래 쌓은 마음은 특별한 행사보다 평소의 태도에 더 잘 전해져요. 가까운 사람에게 편하게 머물 자리를 남겨 두면 관계가 더 부드럽게 이어져요.',
        '가르치려는 말이 많아질수록 함께 있는 시간을 단순하게 만드는 편이 좋아요. 웃어 주고 들어 주는 태도만으로도 가족 안의 긴장이 낮아질 수 있어요.',
        '이 시기에는 가족의 문제를 모두 정리하려 하기보다 편히 기대는 시간을 만드는 것이 더 도움이 돼요. 작은 안부와 익숙한 식사가 관계를 안정시켜요.',
        '가족에게 남는 것은 거창한 조언보다 반복된 따뜻함일 때가 많아요. 오래 쌓아 온 마음을 편안한 시간과 짧은 안부로 나누면 관계가 더 부드럽게 이어져요.',
        '가족에게 전해지는 힘은 말의 크기보다 자주 보여 준 태도에서 나와요. 함께 앉아 있는 시간, 천천히 듣는 표정, 짧은 안부가 오래 남는 안정감이 될 수 있어요.',
        '가까운 사람에게 모든 답을 주려 하기보다 곁을 편하게 내어 주는 쪽이 더 잘 맞아요. 서로의 생활을 존중하면서 자주 안부를 묻는 흐름이 관계를 천천히 단단하게 해 줘요.',
        '오래된 가족 관계일수록 누가 맞는지보다 다시 편하게 만날 수 있는지가 중요해요. 작은 식사와 짧은 대화가 반복되면 마음의 거리도 자연스럽게 가까워져요.',
        '가족 안에서 역할이 바뀌는 시기에는 조언보다 여백이 더 도움이 될 수 있어요. 필요한 때 찾아올 수 있는 분위기를 만들어 두면 가까운 사람도 덜 부담스러워해요.',
        '가까운 사람에게 필요한 것은 답을 대신 정해 주는 말보다 편하게 다시 찾아올 수 있는 자리일 때가 많아요. 들어 줄 시간을 남겨 두면 관계가 더 부드러워져요.',
        '가족의 역할이 달라질수록 예전 방식만 고집하지 않는 편이 좋아요. 묻는 말에는 짧게 답하고, 스스로 고를 시간도 함께 남겨 주세요.',
        '오래 돌봐 온 마음이 있다면 이제는 해결보다 지지가 더 잘 맞을 수 있어요. 가까운 사람이 자기 속도로 결정하도록 기다려 주면 신뢰가 오래 남아요.',
        '조언을 줄 때는 길게 설명하기보다 돌아올 곳이 있다는 느낌을 주는 것이 좋아요. 부담 없이 물어볼 수 있는 분위기가 가족을 안정시켜요.',
      ]),
    )
    .replace(
      /큰 일을 새로 시작하기보다 매일의 작은 정을 따뜻하게 누리는 흐름이 잘 맞아요\. 자녀 세대·손주 세대와는 무언가를 가르쳐 주려 하기보다, 같이 밥 먹고 안부를 묻고 시간을 보내는 것만으로도 충분한 자산이 돼요\./g,
      pickVariant(ctx, 'sourceFamilySmallCare', [
        '큰 일을 새로 시작하기보다 매일의 작은 정을 따뜻하게 누리는 흐름이 잘 맞아요. 자녀 세대·손주 세대와는 무언가를 가르쳐 주려 하기보다, 같이 밥 먹고 안부를 묻고 시간을 보내는 것만으로도 충분한 힘이 돼요.',
        '이미 곁에 있는 관계를 더 편안하게 돌보는 흐름이 잘 맞아요. 함께 먹는 밥, 짧은 안부, 오래된 이야기가 가족에게 오래 가는 안정감으로 남아요.',
        '이 시기에는 가족을 이끄는 말보다 함께 있어 주는 시간이 더 큰 힘이 돼요. 무언가를 가르치려 애쓰기보다 편안히 듣고 웃어 주는 태도가 가까운 사람의 마음을 부드럽게 해 줘요.',
        '따로 큰 행사를 준비하지 않아도 괜찮아요. 자주 묻는 안부, 함께 나누는 식사, 고맙다는 짧은 말이 쌓이면 가족 안에서 오래 가는 따뜻함이 만들어져요.',
        '가르치려는 마음이 앞서면 서로 부담될 수 있어요. 대신 가까운 사람이 편하게 다가올 수 있도록 시간을 비워 두면, 그 자체가 다음 세대에게 전해지는 좋은 기억이 돼요.',
        '이 시기에는 가족에게 답을 알려 주는 말보다 편히 머물러 주는 시간이 더 오래 남아요. 조언을 앞세우기보다 들어 주고 웃어 주는 태도가 가까운 사람의 마음을 안정시켜요.',
        '가까운 사람에게 먼저 필요한 것은 정답보다 편히 이야기할 수 있는 분위기일 때가 많아요. 판단을 서두르지 않고 들어 주면 마음의 문도 부드럽게 열려요.',
        '가까운 사람과 있을 때는 해결책을 빨리 꺼내기보다 먼저 편히 말할 시간을 주는 편이 좋아요. 들어 주는 태도만으로도 관계의 긴장이 많이 낮아져요.',
        '가족에게 힘이 되는 순간은 큰 조언보다 차분히 곁에 있어 주는 시간일 수 있어요. 상대가 자기 말을 끝까지 할 수 있게 기다리면 마음이 더 쉽게 풀려요.',
        '답을 맞혀 주려는 마음이 앞서면 대화가 무거워질 수 있어요. 먼저 안부를 묻고, 필요한 말만 짧게 더하면 가까운 사람도 편하게 다가와요.',
        '오래 함께한 관계일수록 판단보다 분위기가 먼저 필요할 때가 있어요. 웃어 주고 들어 주는 작은 태도가 가족 안의 마음을 부드럽게 열어 줘요.',
        '가족에게 힘이 되는 태도는 큰 해결책보다 안정된 곁일 수 있어요. 묻는 말에는 짧게 답하고, 스스로 고를 시간을 남겨 주면 관계가 덜 무거워져요.',
        '오래 함께한 관계일수록 말을 많이 보태기보다 편하게 머물 시간을 주는 편이 좋아요. 작은 웃음과 안부가 가까운 사람의 긴장을 낮춰 줘요.',
        '내가 대신 정해 주지 않아도 괜찮아요. 가까운 사람이 자기 속도로 생각할 수 있게 기다려 주면 조언보다 더 깊은 신뢰가 남아요.',
        '가까운 가족에게는 앞장서서 해결하는 말보다 편히 머무는 시간이 더 필요할 수 있어요. 함께 앉아 먹는 한 끼와 짧은 안부가 관계를 부드럽게 붙잡아 줘요.',
        '가까운 사람에게 필요한 것은 큰 가르침보다 편안한 곁일 수 있어요. 묻는 말에 천천히 답하고, 오래된 이야기를 나누는 시간이 관계를 부드럽게 만들어 줘요.',
        '무언가를 정리해 주려는 마음이 커질수록 상대가 편히 다가올 시간을 남겨 두는 편이 좋아요. 조용한 안부와 작은 웃음이 가족 안의 긴장을 낮춰 줘요.',
        '가족에게 힘이 되는 방식은 생각보다 단순할 때가 많아요. 먼저 판단하지 않고 들어 주고, 익숙한 식사 자리를 함께 만드는 것만으로도 마음이 많이 누그러져요.',
        '이끌어야 한다는 마음을 내려놓으면 오히려 관계가 더 편해질 수 있어요. 필요한 말은 짧게 전하고, 나머지는 함께 머무는 시간으로 채우는 편이 오래 남아요.',
        '가까운 사람과의 시간은 큰 결론을 내는 자리보다 편히 숨 돌리는 자리일수록 좋아요. 안부를 묻고 웃어 주는 반복이 가족 안의 믿음을 천천히 쌓아 줘요.',
      ]),
    )
    .replace(
      /50대 후반에서 60대의 배움 흐름은 '정리하며 깊어지는' 흐름이에요\. 그동안 흩어져 있던 경험과 지식이 하나로 모이고, 자기 색깔이 또렷한 분야가 보이기 시작해요\./g,
      pickVariant(ctx, 'sourceAcademicIntro', [
        '50대 후반에서 60대의 공부와 배움은 새로 많이 쌓기보다 이미 가진 경험을 다시 정리하는 흐름에 가까워요. 흩어져 있던 지식이 하나로 모이면 내 색이 또렷한 분야도 더 선명하게 보여요.',
        '이 시기의 배움은 속도보다 깊이에 힘이 있어요. 오래 해 온 일과 관심사를 다시 묶어 보면, 지나온 경험이 단순한 기억이 아니라 앞으로 쓸 수 있는 지혜로 바뀌어요.',
        '50대 후반 이후의 공부는 늦은 시작이 아니라 정리의 힘이 커지는 시간이에요. 예전에 배운 것과 지금의 경험을 함께 놓으면, 내가 오래 다룰 수 있는 주제가 자연스럽게 드러나요.',
        '지금의 배움은 새로운 지식을 급히 더하는 일보다 흩어진 경험을 한곳에 모으는 일에 가까워요. 정리된 경험은 글, 대화, 작은 강의처럼 다른 사람에게도 전해질 수 있어요.',
        '50대 후반에서 60대에는 배움이 생활의 깊이를 더하는 방식으로 나타나기 쉬워요. 이미 알고 있던 내용을 다시 읽으면 지금의 생각과 만나 더 단단한 기준이 됩니다.',
        '이 시기의 공부는 젊을 때처럼 빠르게 외우는 흐름과 달라요. 천천히 읽고, 지나온 경험과 연결하고, 내 말로 다시 정리할 때 배움의 가치가 더 또렷해져요.',
      ]),
    )
    .replace(
      /70대 이후의 배움 흐름은 '즐기며 나누는' 흐름이에요\. 결과를 위한 공부보다, 호기심이 이끄는 한 페이지의 행복이 곁에 머물러요\./g,
      pickVariant(ctx, 'sourceAcademicIntro', [
        '70대 이후의 공부와 배움은 잘해야 하는 숙제보다 즐기며 나누는 시간에 가까워요. 결과를 남기려는 마음보다 한 페이지를 읽으며 마음이 환해지는 경험이 더 오래 남아요.',
        '이 시기의 배움은 시험을 위한 공부보다 마음을 깨우는 작은 호기심에 더 잘 맞아요. 많이 읽는 것보다 오늘 마음에 들어온 문장 하나를 천천히 곱씹는 편이 좋아요.',
        '오래 살아오며 쌓인 경험이 있어, 짧은 글 하나도 자기 이야기와 쉽게 이어질 수 있어요. 그래서 배움은 새 지식을 모으는 일만이 아니라 지나온 시간을 다시 이해하는 기회가 돼요.',
        '70대 이후에는 많이 아는 것보다 즐겁게 다시 만나는 배움이 더 오래 남아요. 책, 강의, 대화 속에서 마음이 움직이는 부분을 천천히 따라가면 충분해요.',
      ]),
    )
    .replace(
      /자녀·손주와 함께 읽고, 동네 모임에서 한 줄씩 나누는 흐름이 의외로 큰 만족을 만들어요\. 한 분야를 너무 빠르게 끝내려 하기보다, 좋아하는 책 한 권을 한 달에 걸쳐 천천히 읽는 식이 가장 잘 어울려요\./g,
      pickVariant(ctx, 'sourceAcademicSharing', [
        '가족이나 이웃과 마음에 남은 문장을 나누면 배움이 혼자만의 시간이 아니라 따뜻한 대화가 돼요. 책 한 권을 빨리 끝내기보다 한 달 동안 천천히 읽고 생각을 나누는 방식이 잘 맞아요.',
        '동네 모임, 가벼운 강좌, 가까운 사람과의 짧은 대화가 배움을 더 즐겁게 만들어 줄 수 있어요. 한꺼번에 많이 배우려 하기보다 마음에 남은 내용을 조금씩 나누면 만족이 커져요.',
        '같은 책을 읽지 않아도 배움은 나눌 수 있어요. 마음에 남은 문장 하나를 들려주거나 짧은 생각을 주고받는 것만으로도 생활 속 즐거움이 커져요.',
        '배운 내용을 가까운 사람에게 짧게 설명해 보면 이해가 더 또렷해져요. 많이 말하기보다 마음에 남은 한 줄과 그 이유를 나누는 정도면 충분해요.',
        '오늘 새로 알게 된 것을 가까운 사람에게 한 문장으로 말해 보세요. 설명이 짧을수록 내가 이해한 부분과 더 볼 부분이 분명해져요.',
        '배움은 혼자 정리할 때와 말로 꺼낼 때 다르게 보일 수 있어요. 가족이나 친구에게 쉬운 말로 전하면 기억도 더 오래 남아요.',
        '마음에 남은 내용을 누군가에게 들려주면 배움이 생활 속 대화로 이어져요. 긴 설명보다 내가 느낀 점 하나를 나누는 정도면 충분해요.',
        '읽은 내용을 전부 말하지 않아도 괜찮아요. 오늘 남은 생각 하나를 가까운 사람과 나누면 공부가 훨씬 따뜻하게 정리돼요.',
        '혼자 읽은 내용도 대화 속에서 다시 살아날 수 있어요. 오늘 새로 알게 된 점을 가족이나 친구에게 편하게 들려주면 배움이 더 오래 남아요.',
        '배운 내용을 나눌 때는 설명을 길게 준비하지 않아도 돼요. 마음에 남은 한 문장과 왜 좋았는지만 말해도 생각이 훨씬 또렷해져요.',
        '책이나 강의에서 건진 작은 생각은 누군가와 나눌 때 생활 속 지식으로 바뀌어요. 식사 자리나 산책길에서 짧게 꺼내면 좋은 복습이 돼요.',
        '오늘 새로 안 내용을 모두 기억하려 하지 않아도 괜찮아요. 가까운 사람에게 가장 쉬운 말로 한 가지만 들려주면 배움이 자연스럽게 정리돼요.',
        '배움은 혼자 쌓아 두는 것보다 가볍게 나눌 때 더 오래 남을 수 있어요. 질문 하나, 느낀 점 하나를 말해 보면 다음에 더 볼 부분도 선명해져요.',
        '가르치려는 마음보다 함께 이야기하려는 마음이 더 잘 맞아요. 내가 새로 느낀 점을 짧게 나누면 배움도 관계도 부담 없이 이어져요.',
        '배움은 책상 위에만 머물지 않아도 좋아요. 산책길 대화, 식사 중 이야기, 짧은 전화 속에서도 오늘의 한 문장이 자연스럽게 이어질 수 있어요.',
        '한 달에 책 한 권을 끝내지 못해도 괜찮아요. 마음에 남은 부분을 천천히 읽고, 가족이나 이웃에게 짧게 말해 보는 과정만으로도 배움의 만족이 커져요.',
        '가벼운 강좌나 모임은 지식을 많이 얻는 자리라기보다 생각을 다시 깨우는 시간이 될 수 있어요. 부담 없는 질문 하나만 가져가도 충분해요.',
        '가까운 사람과 배움을 나눌 때는 가르치려 하기보다 내가 새로 느낀 점을 말하는 편이 좋아요. 그러면 대화가 더 부드럽고 오래 남아요.',
        '혼자 읽은 내용은 짧은 메모로 남기고, 나눌 수 있는 말은 따로 골라 보세요. 기록과 대화가 나뉘면 배움이 더 편하게 이어져요.',
        '배운 내용을 생활에 붙이는 방법은 생각보다 단순해요. 오늘 알게 된 말 하나를 식사 자리나 산책길에서 편하게 꺼내면 그 자체로 좋은 복습이 돼요.',
        '배움을 나누는 일은 많이 아는 사람처럼 보이려는 일이 아니에요. 마음에 남은 작은 생각을 따뜻하게 나누면 관계와 배움이 함께 깊어져요.',
      ]),
    )
    .replace(
      /작은 실천으로는 매일 같은 시각에 짧게 읽는 자리를 만들어 두면 좋아요\. 한 페이지를 손주에게 소리 내어 읽어 주거나, 한 문장을 옮겨 적어 두는 흐름이 그날의 즐거움으로 남아요\./g,
      pickVariant(ctx, 'sourceAcademicPractice', [
        '작은 실천으로는 매일 같은 시각에 짧게 읽는 자리를 만들어 두면 좋아요. 한 페이지를 손주에게 소리 내어 읽어 주거나, 한 문장을 옮겨 적어 두는 흐름이 그날의 즐거움으로 남아요.',
        '매일 10분만 같은 시간에 읽어도 충분해요. 마음에 드는 문장을 달력이나 작은 공책에 적어 두면, 그 기록이 하루를 차분하게 정리해 주는 즐거움이 돼요.',
        '눈이 피곤한 날에는 책을 오래 붙잡지 않아도 괜찮아요. 짧은 글을 소리 내어 읽거나 라디오, 강의, 대화를 통해 들은 말을 한 줄 남기는 정도면 충분해요.',
        '가까운 사람에게 한 문장을 읽어 주거나, 마음에 남은 내용을 짧게 설명해 보세요. 오래 공부했다는 느낌보다 오늘 배운 것을 생활 안에 가볍게 놓아두는 감각이 더 중요해요.',
        '긴 글을 한 번에 읽지 않아도 괜찮아요. 오늘 마음에 남는 문단 하나만 표시하고, 나중에 가족이나 친구에게 짧게 들려주면 배움이 생활과 연결돼요.',
        '읽은 내용을 오래 붙잡기보다 한 줄로 남겨 보세요. 그 한 줄을 다음 날 다시 보면 어제의 생각이 오늘의 작은 기준이 돼요.',
        '오늘 읽은 것 중 마음에 남은 말 하나만 짧게 적어 보세요. 다음 날 다시 보면 그 말이 내 생각을 이어 주는 작은 표시가 돼요.',
        '긴 정리보다 다시 찾기 쉬운 흔적 하나가 더 도움이 될 때가 있어요. 제목, 날짜, 느낌 중 하나만 남겨도 다음 배움이 덜 끊겨요.',
        '배운 내용을 모두 외우려 하지 않아도 괜찮아요. 지금 마음에 남은 문장 하나를 내 말로 바꾸면 생활 속 배움으로 더 오래 남아요.',
        '책을 펴기 어려운 날에는 들은 이야기나 떠오른 기억을 한 문장만 적어도 좋아요. 배움은 긴 시간보다 반복되는 작은 기록에서 더 오래 남아요.',
        '가까운 사람과 같은 글을 읽지 않아도 괜찮아요. 오늘 좋았던 말 하나를 나누면 배움이 대화 속에서 자연스럽게 살아나요.',
        '하루에 한 문장만 골라도 충분해요. 그 문장이 왜 마음에 남았는지 짧게 덧붙이면 나만의 공부 기록이 돼요.',
        '오늘은 문장 하나를 고르고 그 옆에 내 느낌을 한마디만 붙여 보세요. 짧은 기록이 쌓이면 나에게 맞는 배움의 길이 보여요.',
        '많이 읽지 못한 날에도 마음에 남은 표현 하나는 남길 수 있어요. 그 표현을 다시 보면 다음에 어디서 시작할지 알기 쉬워요.',
        '공부 기록은 길지 않아도 괜찮아요. 한 문장과 짧은 이유만 남겨도 나중에 다시 읽을 때 생각의 길이 이어져요.',
        '오래 앉아 읽는 것이 힘든 날에는 소리 내어 한 문장만 읽어도 좋아요. 작게 이어 가는 리듬이 공부를 편안하게 만들어 줘요.',
        '읽은 뒤 오래 붙잡기보다 오늘 마음에 남은 말을 한 줄만 적어 보세요. 다음 날 다시 보면 그 한 줄이 생각을 이어 주는 작은 다리가 돼요.',
        '책장을 많이 넘기지 못한 날에도 문장 하나만 남기면 괜찮아요. 짧은 기록이 쌓이면 나중에 꺼내 볼 수 있는 배움의 길이 생겨요.',
        '오늘 배운 것을 길게 설명하려 하지 말고 한 줄 제목으로 남겨 보세요. 제목이 있으면 다음에 다시 읽을 때 어디서 시작할지 금방 보여요.',
        '읽은 내용을 모두 정리하지 않아도 괜찮아요. 오늘 마음에 남은 부분에 짧은 제목만 붙여도 다음에 다시 열어 볼 길이 생겨요.',
        '배운 내용을 오래 남기고 싶다면 긴 요약보다 다시 찾기 쉬운 단서가 먼저예요. 제목 하나, 날짜 하나, 느낌 하나만 있어도 충분해요.',
        '오늘 배운 말이 많았다면 가장 도움이 된 장면만 짧게 적어 보세요. 한 줄 기록이 있어야 다음 배움도 자연스럽게 이어져요.',
        '공부 기록은 예쁘게 쓰는 것보다 다시 시작할 자리를 남기는 일이 중요해요. 다음에 볼 제목 하나만 적어도 배움이 끊기지 않아요.',
        '마음에 든 문장을 표시하고 내 말로 짧게 바꾸어 보세요. 남의 문장이 내 말이 되는 순간 배움이 생활 안으로 들어와요.',
        '배움은 많이 읽은 양보다 다시 꺼내 보기 쉬운 흔적으로 오래 남아요. 오늘은 한 문장, 한 날짜, 한 느낌만 남겨도 충분해요.',
      ]),
    )
    .replace(
      /평생 모은 지혜가 자연스럽게 다음 사람에게 전해져요\./g,
      pickVariant(ctx, 'sourceAcademicWisdom', [
        '평생 모은 지혜가 자연스럽게 다음 사람에게 전해져요.',
        '거창한 글을 남기지 않아도 괜찮아요. 평소에 해 온 생각과 경험을 짧게 들려주는 것만으로도 누군가에게 좋은 길잡이가 될 수 있어요.',
        '배움은 혼자 간직할 때보다 나눌 때 더 오래 살아나요. 내가 편하게 해 온 방법 하나를 알려 주면 가까운 사람도 자기 방식으로 배움을 이어 갈 수 있어요.',
        '오래 쌓인 경험은 한 번에 설명하지 않아도 전해질 수 있어요. 짧은 메모, 작은 이야기, 함께 읽은 문장 하나가 다음 사람에게 따뜻한 기준이 돼요.',
        '내가 겪어 온 일은 어려운 말로 정리하지 않아도 좋은 배움이 될 수 있어요. 도움이 되었던 방법 하나와 조심했던 기준 하나만 나누어도 충분해요.',
        '지나온 시간은 이미 좋은 교재예요. 누군가에게 전하고 싶은 말이 있다면 긴 설명보다 실제 장면 하나를 차분히 들려주는 편이 더 오래 남아요.',
        '오래 배운 사람의 힘은 정답을 주는 데만 있지 않아요. 어떤 때 기다렸고 어떤 때 도움을 청했는지 알려 주는 것만으로도 다음 사람에게 실질적인 기준이 돼요.',
        '오래 배운 사람은 답을 대신 정하기보다 판단할 때 본 기준을 나누어 줄 수 있어요. 무엇을 먼저 살폈는지 알려 주면 듣는 사람도 자기 선택을 세우기 쉬워요.',
        '경험이 쌓였다는 것은 모든 답을 안다는 뜻이 아니에요. 막혔을 때 어떻게 확인했고 어디서 쉬어 갔는지 들려주는 것만으로도 충분히 좋은 안내가 돼요.',
        '누군가에게 도움이 되는 말은 거창한 결론보다 실제로 확인했던 순서일 때가 많아요. 기다릴 때와 물어볼 때를 나누어 알려 주면 조언이 더 현실적으로 닿아요.',
        '오래 익힌 배움은 필요한 사람에게 작은 기준으로 전할 때 힘이 커져요. 성공한 방법뿐 아니라 조심했던 지점을 함께 말하면 다음 사람이 덜 헤매요.',
        '배움을 나눌 때는 내가 대신 고르는 사람이 되지 않아도 괜찮아요. 판단할 조건과 멈춰야 할 신호를 알려 주면 상대가 스스로 고를 힘을 얻어요.',
        '오래 쌓은 경험은 정리된 글 한 편이 아니어도 전해질 수 있어요. 짧은 조언, 기억나는 장면, 함께 나눈 문장 하나가 누군가에게 길잡이가 돼요.',
        '내가 지나온 길을 전부 설명하지 않아도 괜찮아요. 지금 떠오르는 작은 기준 하나만 나누어도 가까운 사람에게는 충분히 도움이 돼요.',
        '오래 쌓인 지혜는 큰 결론보다 생활에서 나온 짧은 장면으로 더 잘 전해져요. 내가 편했던 방법과 조심했던 기준을 하나씩 나누면 듣는 사람도 자기 상황에 맞춰 볼 수 있어요.',
        '오래 배운 것은 어려운 말보다 쉬운 사례로 더 잘 남아요. 내가 겪은 장면 하나를 차분히 들려주면 가까운 사람도 자기 방식으로 받아들일 수 있어요.',
        '누군가에게 도움이 되고 싶다면 정답을 주려 하기보다 지나온 선택을 짧게 나누어 보세요. 실제 장면이 들어가면 조언도 덜 무겁게 들려요.',
        '평생 쌓인 배움은 생활 속 작은 기준으로 전할 때 더 오래 남아요. 내가 자주 써 온 방법 하나를 알려 주는 것만으로도 충분히 따뜻해요.',
        '지혜를 나눈다는 것은 긴 설명을 남기는 일이 아니에요. 어려웠던 순간과 도움이 된 방법을 짧게 말하면 다음 사람의 길이 조금 가벼워져요.',
        '누군가에게 남길 말이 있다면 길게 쓰기보다 한 장면으로 말해 보세요. 그 장면이 오히려 오래 기억될 수 있어요.',
        '평소에 해 온 선택과 생각은 이미 좋은 자료예요. 가까운 사람이 묻는 순간에 짧게 나누면 배움이 자연스럽게 이어져요.',
        '배움은 나이가 들어도 계속 자라요. 오늘 알게 된 것과 오래 알고 있던 것을 함께 나누면 다음 사람에게도 편안한 힘이 돼요.',
      ]),
    )
    .replace(
      /오래 쓴 책장을 한 칸씩 정리하는 그림을 떠올려 보면 좋아요\. 무엇을 남기고 무엇을 정리할지 결정하는 자리가 큰 가치를 만들어요\./g,
      pickVariant(ctx, 'sourceStudyBookshelf', [
        '오래 쓴 책장을 한 칸씩 정리하는 그림을 떠올려 보면 좋아요. 무엇을 남기고 무엇을 정리할지 결정하는 자리가 큰 가치를 만들어요.',
        '오래 쓴 책장을 정리하듯 기록도 한 묶음씩 살펴보면 좋아요. 남길 것, 버릴 것, 다시 확인할 것을 나누면 머릿속까지 한결 가벼워져요.',
        '서랍을 하나씩 비우듯 오래된 자료를 천천히 꺼내 보세요. 필요한 서류와 추억으로 남길 기록을 구분하면 다음에 찾을 때 훨씬 편해져요.',
        '쌓인 파일에 새 이름을 붙이는 일처럼, 기록도 다시 정리하면 가치가 또렷해져요. 무엇을 남길지 정하는 과정 자체가 앞으로의 생활을 편하게 만들어 줘요.',
        '책장 전체를 한 번에 비우려 하지 말고, 오늘은 한 칸만 골라 보세요. 작은 분류가 끝나면 오래된 기록도 다시 쓸 수 있는 자료처럼 보이기 시작해요.',
        '오래된 서류와 메모를 꺼낼 때는 버릴 것보다 다시 찾기 쉽게 만들 것을 먼저 보세요. 이름을 붙이고 날짜를 적어 두는 것만으로도 기록의 가치가 살아나요.',
        '정리는 과거를 지우는 일이 아니라 필요한 것을 다시 꺼내기 쉽게 만드는 일이에요. 남길 기록과 추억으로 둘 기록을 나누면 마음도 한결 가벼워져요.',
        '묵은 자료를 한 묶음씩 살피면 내가 지나온 과정도 더 선명해져요. 중요한 증명, 다시 볼 메모, 추억으로 둘 자료를 나누면 다음 선택이 편해져요.',
        '오래된 기록을 펼칠 때는 먼저 오늘 다시 쓸 수 있는 것부터 골라 보세요. 증명할 자료, 참고할 메모, 마음에만 둘 기억을 나누면 정리가 훨씬 가벼워져요.',
        '자료가 많이 쌓였을수록 한 번에 끝내려 하지 않는 편이 좋아요. 오늘 필요한 묶음 하나만 고르고, 남길 이유를 짧게 붙이면 다음에 찾기도 쉬워져요.',
        '오래 둔 서류와 메모는 다시 분류할 때 새 의미가 생겨요. 지금 쓸 것, 나중에 볼 것, 추억으로 둘 것을 나누면 지나온 시간도 더 차분하게 정리돼요.',
        '쌓인 자료를 볼 때는 양을 줄이는 것보다 찾는 길을 만드는 일이 먼저예요. 이름, 날짜, 쓰임을 짧게 붙여 두면 다음 선택에서 훨씬 덜 헤매요.',
        '묵은 기록은 한꺼번에 판단하지 않아도 괜찮아요. 오늘은 다시 볼 자료 한 묶음과 편하게 보관할 기억 한 묶음만 나누어도 충분해요.',
        '오래된 자료를 정리하는 일은 과거를 버리는 일이 아니에요. 지금 필요한 것과 마음에 남길 것을 구분하면 지나온 시간이 생활에 도움이 되는 자료로 바뀌어요.',
        '자료가 흩어져 있다면 먼저 가장 자주 찾는 것부터 모아 보세요. 작은 기준이 생기면 나머지 기록도 버릴 것과 남길 것이 조금씩 선명해져요.',
        '오래 둔 메모와 서류는 쓰임을 다시 정해 줄 때 부담이 줄어요. 증명, 참고, 추억처럼 쉬운 이름을 붙이면 정리도 훨씬 편해져요.',
        '오래된 자료를 한꺼번에 정리하려 하지 않아도 괜찮아요. 증명으로 남길 것, 참고할 것, 마음으로만 둘 것을 나누면 자료의 무게가 줄어요.',
        '묵은 기록은 버릴 것과 남길 것을 정할 때 가치가 더 또렷해져요. 다시 쓸 자료와 추억으로 남길 자료를 구분하면 다음 선택도 가벼워져요.',
        '지나온 자료를 살필 때는 양보다 쓰임을 먼저 보세요. 지금 필요한 증명, 나중에 볼 메모, 그냥 간직할 기억을 나누면 정리가 덜 막막해져요.',
        '오래 모인 자료는 내 시간이 쌓인 흔적이기도 해요. 필요한 기록과 마음에 남길 기록을 구분하면 정리도 후회보다 안정감에 가까워져요.',
      ]),
    )
    .replace(
      /잘 풀리는 면은, 다음 세대에 기록을 넘겨주는 자리예요\. 한 줄로 정리한 노하우 한 장이 누군가에게는 큰 길잡이가 돼요\./g,
      pickVariant(ctx, 'sourceStudyRecordShare', [
        '잘 풀리는 면은, 다음 세대에 기록을 넘겨주는 자리예요. 한 줄로 정리한 노하우 한 장이 누군가에게는 큰 길잡이가 돼요.',
        '좋은 점은 쌓아 둔 기록이 누군가의 시행착오를 줄여 줄 수 있다는 거예요. 복잡한 설명보다 순서 한 줄, 확인할 항목 한 줄이 더 큰 도움이 될 때가 많아요.',
        '가족이나 후배에게 필요한 기준을 한 장으로 남기면 좋아요. 어디서 확인했고 무엇을 조심했는지 짧게 적어 두는 것만으로도 다음 사람이 훨씬 덜 헤매요.',
        '내가 겪은 절차를 순서대로 적어 두면 그 기록은 단순한 메모를 넘어 길잡이가 돼요. 누군가에게는 그 한 장이 시간과 걱정을 아껴 주는 자료가 될 수 있어요.',
        '내가 겪은 순서를 짧게 남겨 두면 다음 사람은 같은 실수를 덜 반복해요. 복잡한 경험도 확인할 순서와 조심할 점 두 줄이면 충분히 도움이 돼요.',
        '기록을 전한다는 것은 거창한 설명을 남기는 일이 아니에요. 무엇을 먼저 확인했고 어디서 막혔는지 적어 두면 가까운 사람에게 좋은 안내가 돼요.',
        '오래 쌓은 경험은 말로만 전하면 흩어지기 쉬워요. 한 장짜리 순서표나 짧은 메모로 남기면 시간이 지나도 다시 꺼내 쓸 수 있어요.',
        '누군가에게 넘겨 줄 기록은 완벽한 보고서일 필요가 없어요. 내가 헤맸던 지점과 도움이 됐던 방법만 남겨도 다음 사람의 출발이 훨씬 가벼워져요.',
      ]),
    )
    .replace(
      /살짝 주의할 점은, 중요한 서류를 한 군데에 모아 두는 면이에요\. 자격증·계약서·등기 서류는 한 폴더와 한 사진본 정도로 두 곳에 두면 든든해요\./g,
      pickVariant(ctx, 'sourceStudyDocumentBackup', [
        '살짝 주의할 점은, 중요한 서류를 한 군데에 모아 두는 면이에요. 자격증·계약서·등기 서류는 한 폴더와 한 사진본 정도로 두 곳에 두면 든든해요.',
        '중요한 서류는 한곳에만 두지 않는 편이 좋아요. 종이 원본은 찾기 쉬운 곳에 두고, 사진이나 스캔본을 따로 보관하면 급할 때 훨씬 덜 당황해요.',
        '자격증, 계약서, 등기처럼 다시 찾을 일이 있는 문서는 두 갈래로 보관해 보세요. 실제 종이와 사진본을 함께 남겨 두면 분실 걱정이 줄어요.',
        '찾을 때마다 헤매지 않도록 중요한 서류의 위치를 한 장에 적어 두면 좋아요. 가족이 함께 알아야 할 자료라면 보관 장소를 짧게 공유해 두는 것도 도움이 돼요.',
        '계약서나 자격 서류처럼 다시 찾을 자료는 원본과 사진본을 나누어 두면 좋아요. 어디에 두었는지 함께 적어 두면 급한 순간에도 덜 흔들려요.',
        '중요한 문서는 기억에만 맡기지 않는 편이 안전해요. 보관 위치, 사진본 위치, 확인할 사람을 짧게 적어 두면 나중에 찾는 시간이 크게 줄어요.',
        '종이 서류는 찾기 쉬운 곳에 두고, 휴대폰이나 저장 공간에는 사진본을 남겨 보세요. 두 갈래로 남겨 두면 분실보다 확인이 먼저 떠올라 마음이 편해져요.',
        '서류 정리는 많이 모으는 것보다 다시 찾을 길을 만드는 일이 더 중요해요. 원본, 사진본, 위치 메모를 나누면 필요한 순간에 훨씬 든든해요.',
      ]),
    )
    .replace(
      /정리 자체가 새로운 자산이 되는 모양이에요\./g,
      pickVariant(ctx, 'sourceStudyAsset', [
        '정리 자체가 새로운 자산이 되는 모양이에요.',
        '잘 정리된 기록은 나중에 다시 꺼내 쓸 수 있는 생활의 자산이 돼요.',
        '오늘 정리한 한 묶음이 다음 선택을 편하게 해 주는 든든한 자료로 남아요.',
        '기록을 정돈해 두면 마음도 가벼워지고, 필요한 순간에 바로 꺼내 쓸 힘이 생겨요.',
      ]),
    )
    .replace(
      /(?:마음의 결을 호수에 비유하면, 빠른 강이 아니라 잔잔한 호수처럼 머물게 두는 것이 더 잘 어울려요|마음의 흐름을 호수에 비유하면, 빠른 강이 아니라 (?:잔잔한 호수|고요한 물가)처럼 머물게 두는 것이 더 잘 어울려요|잔잔한 호수에 비유하면, 빠른 강이 아니라 머물게 두는 흐름이 더 잘 어울려요)\. (?:사람과 사람 사이의 따뜻한 자리|사람 사이의 따뜻한 관계)에서 자연스럽게 회복이 일어나요\./g,
      pickVariant(ctx, 'sourceStressRiver', [
        '마음을 물가에 비유하면, 억지로 빨리 흐르게 하기보다 잠시 머물게 두는 시간이 필요해요. 따뜻한 대화와 편안한 만남이 회복을 자연스럽게 도와줘요.',
        '마음이 지친 날에는 빠르게 해결하려 하기보다 잠깐 고요해지는 시간이 더 잘 맞아요. 믿을 만한 사람과 나누는 짧은 말이 회복의 시작이 될 수 있어요.',
        '긴장과 회복은 속도보다 안정감이 중요해요. 편안한 관계 안에서 쉬어 갈 시간을 만들면 마음의 무게가 조금씩 내려가요.',
        '마음이 무거운 날에는 문제를 바로 끝내려 하기보다 먼저 안전한 쉼을 만드는 편이 좋아요. 조용한 자리, 따뜻한 음료, 편한 사람의 한마디가 회복을 시작하게 해 줘요.',
        '지친 마음은 빠른 결론보다 천천히 가라앉을 시간이 필요해요. 오늘 힘들었던 장면을 한 문장으로 말하거나 적어 두면 마음의 물살이 조금 낮아져요.',
        '회복은 마음을 억지로 밝게 만드는 일이 아니에요. 지금 붙잡을 감정과 잠시 흘려보낼 감정을 나누면 숨 쉴 공간이 생겨요.',
        '믿을 만한 사람과 짧게 나누는 말은 생각보다 큰 힘이 돼요. 조언을 많이 듣지 않아도, 내 마음을 한 번 밖으로 꺼내는 것만으로도 긴장이 줄어요.',
        '고요한 시간은 아무것도 하지 않는 시간이 아니라 마음을 다시 정리하는 시간이에요. 잠깐 쉬고 나서 볼 때 해결할 일과 그냥 지나갈 일이 더 잘 나뉘어요.',
        '마음이 빨라질수록 몸의 속도를 먼저 낮춰 보세요. 천천히 걷기, 물 마시기, 조용히 앉기처럼 쉬운 행동이 생각을 차분하게 만들어 줘요.',
        '편안한 관계는 마음이 돌아올 자리가 되어 줘요. 힘든 말을 길게 하지 못해도 곁에 있어 주는 사람을 떠올리면 회복이 덜 외롭게 느껴져요.',
        '지친 날에는 해결책보다 회복할 순서가 먼저예요. 쉬기, 말하기, 적기 중 하나만 골라도 마음을 다시 붙잡을 기준이 생겨요.',
      ]),
    )
    .replace(
      /잘 풀리는 것은 익숙한 일상이에요\. 같은 시각의 산책, (?:가까운 사람과의 )?가벼운 대화, 정해진 식사 (?:자리|시간)(?: 같은 사소한 반복이|가) 마음을 단단히 잡아 줘요\./g,
      pickVariant(ctx, 'sourceStressSupport', [
        '잘 풀리는 것은 거창한 변화보다 익숙한 일상에서 나와요. 같은 시간의 산책, 가벼운 대화, 정해진 식사 시간이 마음을 차분히 붙잡아 줘요.',
        '몸과 마음은 낯선 방법보다 반복되는 생활에서 안정감을 얻을 때가 많아요. 산책, 식사, 짧은 안부처럼 쉬운 루틴을 지키면 하루가 덜 흔들려요.',
        '익숙한 일상을 잘 지키는 것만으로도 회복의 바탕이 생겨요. 정해진 시간에 먹고, 걷고, 가까운 사람과 짧게 이야기하는 습관이 마음을 편하게 해 줘요.',
        '회복은 특별한 방법보다 매일 반복할 수 있는 쉬운 기준에서 시작돼요. 같은 시간에 잠들고, 천천히 먹고, 가까운 사람과 짧게 안부를 나누면 마음이 덜 흔들려요.',
        '몸이 지칠 때는 새 방법을 찾기보다 이미 아는 생활을 다시 단순하게 만드는 편이 좋아요. 걷기, 식사, 잠자는 시간을 일정하게 두면 마음도 조금씩 안정돼요.',
        '익숙한 루틴은 마음을 붙잡아 주는 작은 손잡이와 같아요. 하루에 하나라도 반복되는 시간을 남겨 두면 불안한 날에도 다시 돌아올 자리가 생겨요.',
        '낯선 처방보다 오래 할 수 있는 생활 습관이 더 큰 힘이 될 수 있어요. 무리 없는 산책과 정해진 식사, 짧은 대화가 쌓이면 회복의 바탕이 단단해져요.',
      ]),
    )
    .replace(
      /주의할 점은 감정을 미루는 거예요\. 일 위주로 사는 시기일수록 작은 마음 신호를 모아 두기 쉬워요\. 가까운 사람과 가벼운 대화로 한 번씩 풀어 주면 무리 없이 흘러가요\./g,
      pickVariant(ctx, 'sourceStressSupport', [
        '주의할 점은 마음이 힘들다는 신호를 너무 오래 미루는 거예요. 일이 많을수록 짧은 대화, 산책, 쉬는 시간을 미리 두면 감정이 한꺼번에 쌓이는 일을 줄일 수 있어요.',
        '일이 중심이 되는 시기에는 마음의 신호를 뒤로 보내기 쉬워요. 가까운 사람에게 오늘 힘들었던 일을 한 문장만 말해도 긴장이 조금 풀리고 다음 선택이 편해져요.',
        '감정을 오래 모아 두면 작은 일도 크게 느껴질 수 있어요. 믿을 만한 사람과 가볍게 이야기하거나 잠깐 걸으면서 마음의 압력을 조금씩 낮춰 보세요.',
        '조심할 부분은 괜찮은 척하며 마음의 부담을 계속 쌓아 두는 거예요. 가까운 사람과 짧게 나누는 말이 있어야 일의 무게도 덜 외롭게 느껴져요.',
        '책임이 커질수록 감정 정리를 나중으로 미루기 쉬워요. 하루 끝에 힘들었던 장면 하나와 고마웠던 장면 하나를 나누면 마음이 훨씬 차분해져요.',
      ]),
    )
    .replace(
      /주의할 점은 감정을 미루는 거예요\. (?:작은 마음 신호를 모아 두기보다, 가까운 사람과 가볍게 풀어 주면|가까운 사람과 가볍게 대화를 나누면|가까운 사람과 가벼운 대화를 나누면) 무리 없이 흘러가요\./g,
      pickVariant(ctx, 'sourceStressSupport', [
        '주의할 점은 마음의 부담을 너무 오래 혼자 들고 가는 거예요. 가까운 사람과 짧게 이야기하면 감정이 커지기 전에 정리하기 쉬워요.',
        '감정은 미룰수록 더 무겁게 느껴질 수 있어요. 힘든 장면을 한 문장으로 말하거나 적어 두면 마음의 긴장이 조금 내려가요.',
        '괜찮은 척 오래 참기보다 작은 신호가 보일 때 풀어 주는 편이 좋아요. 가벼운 대화나 짧은 산책만으로도 마음이 훨씬 부드러워질 수 있어요.',
        '마음이 답답할 때는 큰 조언을 구하지 않아도 괜찮아요. 믿을 만한 사람에게 지금 불편한 것 하나만 말해도 회복의 시작이 돼요.',
      ]),
    )
    .replace(
      /주의할 점은 새로운 변화를 한꺼번에 받는 거예요\. 큰 변화(?:는 한 가지씩 천천히 받아들이는 흐름이 좋아요|를 한 번에 안기보다 한 가지씩 천천히 받아들이는 흐름이 잘 맞아요)\./g,
      pickVariant(ctx, 'sourceStressRest', [
        '새로운 변화를 한꺼번에 받아들이려 하면 몸과 마음이 쉽게 지칠 수 있어요. 큰 변화일수록 하나씩 확인하고, 익숙해진 뒤 다음 단계로 넘어가면 훨씬 편해요.',
        '변화가 많을수록 속도를 늦추는 편이 좋아요. 한 번에 다 바꾸기보다 오늘 감당할 수 있는 한 가지부터 정하면 부담이 줄어요.',
        '새로운 일정이나 역할이 들어올 때는 한꺼번에 끌어안지 않아도 괜찮아요. 먼저 가장 중요한 것 하나를 고르고 나머지는 차례로 살피면 마음이 덜 복잡해져요.',
        '새 역할이 생길 때는 잘해 내야 한다는 마음이 먼저 커질 수 있어요. 하지만 오늘 바로 해야 할 일과 천천히 익혀도 되는 일을 나누면 몸과 마음이 덜 지쳐요.',
        '변화가 들어오는 시기에는 속도를 조절하는 힘이 필요해요. 한 번에 다 받아들이려 하기보다 일정, 사람, 책임을 따로 살피면 부담이 훨씬 작아져요.',
        '갑자기 바뀐 흐름 앞에서는 먼저 숨을 고르는 편이 좋아요. 무엇을 지금 결정해야 하고 무엇은 며칠 더 봐도 되는지 나누면 마음이 한결 안정돼요.',
        '새로운 일이 좋은 기회처럼 보여도 내 생활의 여유를 함께 확인해야 해요. 잠과 식사, 기존 약속을 크게 무너뜨리지 않는 범위부터 받아들이면 오래 이어 가기 쉬워요.',
      ]),
    )
    .replace(
      /비유하자면 해가 천천히 기우는 들판에서 한 해 농사를 갈무리하는 흐름이에요\. 모은 곡식을 어디에 둘지, 다음 사람에게 무엇을 남길지 정리하는 시기예요\./g,
      pickVariant(ctx, 'sourceWealthStandard', [
        '비유하자면 오래 가꾼 창고를 차분히 정리하는 시간이에요. 무엇을 남기고 무엇을 나눌지 고르면 지나온 선택의 가치가 더 또렷해져요.',
        '이 시기에는 새로 크게 벌리기보다 이미 쌓아 둔 것을 정리하는 힘이 중요해요. 남길 것과 나눌 것을 나누면 돈과 물건의 기준도 한결 가벼워져요.',
        '오래 모아 온 것을 돌아보며 필요한 곳에 잘 배치하는 시기예요. 정리와 나눔이 분명해질수록 생활의 안정감도 더 선명해져요.',
        '오래 쌓아 온 것은 그냥 두면 무게가 되지만, 기준을 세워 정리하면 든든한 자산이 돼요. 무엇을 계속 지킬지, 무엇을 나눌지 적어 보면 생활이 더 가벼워져요.',
        '이 흐름은 새로 벌리는 힘보다 이미 가진 것을 잘 돌보는 힘에 가까워요. 돈과 물건, 약속을 한 번씩 살피면 남길 것과 내려놓을 것이 자연스럽게 구분돼요.',
        '비유하자면 집 안의 오래된 서랍을 다시 정돈하는 시간이에요. 필요한 것은 잘 보이게 두고, 더 잘 쓰일 곳이 있는 것은 나누면 마음도 한결 편해져요.',
        '오래 쓰던 장부를 다시 펼쳐 보는 시간처럼 읽어도 좋아요. 남길 항목과 정리할 항목을 나누면 돈과 물건이 막연한 부담이 아니라 관리 가능한 기준으로 보여요.',
        '창고의 선반을 다시 정리하는 듯한 흐름이에요. 자주 쓰는 것, 넘길 것, 기록만 남길 것을 나누면 생활의 여유가 조금씩 생겨요.',
        '그동안 모아 둔 것을 다시 이름 붙이는 시간이에요. 필요한 것은 가까이 두고, 덜 필요한 것은 쓰임을 찾아 주면 마음의 공간도 넓어져요.',
        '한 해 농사를 갈무리하듯 지나온 선택을 차분히 보는 흐름이에요. 지금 남길 기준을 정하면 다음 돈 선택도 덜 흔들려요.',
        '오래 품고 있던 물건과 약속을 다시 살피기 좋아요. 계속 지킬 것과 가볍게 내려놓을 것을 나누면 안정감이 더 선명해져요.',
        '그동안의 선택을 돌아보는 일은 후회하려는 과정이 아니에요. 남은 힘을 어디에 쓰면 좋을지 정하는 과정이고, 그 기준이 돈의 안정감을 더 또렷하게 해 줘요.',
      ]),
    )
    .replace(
      /쌓아 온 (?:결|흐름)은 이미 충분해요\. 정리하고 나누는 (?:자리|시간)이 가장 자연스럽(?:게 어울리는|러운) 시기예요\./g,
      pickVariant(ctx, 'sourceWealthPace', [
        '이미 쌓아 온 기준은 충분히 의미가 있어요. 이제는 더 늘리기보다 무엇을 남기고 무엇을 나눌지 차분히 고르는 편이 좋아요. 목록을 적어 보면 생활의 기준도 더 또렷해져요.',
        '새로 더 증명하려 애쓰지 않아도 괜찮아요. 필요한 것만 남기고 나눌 것을 고르는 태도가 이 시기에는 더 잘 맞아요. 큰 정리는 하루에 끝내려 하지 말고, 가족이나 믿을 만한 사람과 기준을 나누어 보세요.',
        '그동안 모아 온 경험과 기준을 차분히 정돈해 보세요. 나에게 필요한 만큼 남기고 나눌 것은 나누면 마음도 훨씬 가벼워져요. 금액, 물건, 약속을 따로 적으면 무엇부터 정리할지 더 쉽게 보여요.',
        '지금은 더 많이 모으는 일보다 이미 가진 것을 보기 쉬운 모양으로 정리하는 일이 잘 맞아요. 자주 쓰는 것, 남겨 둘 것, 나눌 것을 나누면 마음의 부담도 줄어요.',
        '오래 쌓은 기준은 그대로 두어도 가치가 있어요. 다만 어디에 쓰고 누구와 나눌지 정해 두면 돈과 물건이 막연한 무게가 아니라 생활을 돕는 힘이 돼요.',
        '정리와 나눔은 잃는 일이 아니라 쓰임을 다시 찾는 과정이에요. 필요한 것은 가까이에 두고, 덜 필요한 것은 더 잘 쓰일 곳을 찾으면 생활이 가벼워져요.',
        '이 시기에는 새 계획을 크게 벌이기보다 가진 것의 자리를 다시 잡는 편이 좋아요. 목록을 만들고 우선순위를 정하면 돈과 물건의 흐름이 더 또렷해져요.',
        '이미 충분히 해 온 선택이 있으니 다시 증명하려 애쓰지 않아도 돼요. 지금은 남길 기준을 고르고, 나눌 때의 부담을 미리 정하는 것이 더 실용적이에요.',
        '모아 둔 것은 많아질수록 관리 기준이 필요해요. 금액, 물건, 약속을 작게 나누어 보면 무엇을 지키고 무엇을 덜어낼지 더 쉽게 결정할 수 있어요.',
        '나눔을 생각할 때도 내 생활의 안정이 먼저예요. 마음이 가는 대로 모두 내어 주기보다 감당 가능한 범위를 정하면 오래 편한 선택이 돼요.',
        '지나온 선택을 돌아보는 일은 후회하려는 시간이 아니에요. 앞으로 더 편하게 쓰기 위해 남길 것과 내려놓을 것을 고르는 정리 시간에 가까워요.',
      ]),
    )
    .replace(
      /(?:사주에서 )?인연 자리가 넉넉하면 가족·오랜 친구와의 리듬이 단단하고, 자리가 비어 있던 부분도 시간이 흐르며 자연스럽게 채워지는 (?:결|흐름)을 자주 만나요\. 큰 결정보다 일상 속 작은 다정함이 관계의 향기를 길게 남겨요\./g,
      pickVariant(ctx, 'sourceFamilyReceive', [
        '가까운 관계에서는 큰 사건보다 매일의 작은 신뢰가 더 오래 남아요. 약속을 지키고 안부를 묻고 함께 보낸 시간을 기억하는 일이 관계의 바탕을 단단하게 만들어 줘요.',
        '관계가 깊어지는 순간은 거창한 결정만이 아니에요. 가족이나 오랜 친구와 반복해서 나눈 안부와 작은 배려가 시간이 지나 더 든든한 힘으로 남아요.',
        '이미 곁에 있는 사람들과는 특별한 사건보다 편안한 반복이 중요해요. 짧은 연락, 늦지 않는 약속, 함께한 식사처럼 익숙한 장면이 관계를 오래 지켜 줘요.',
        '가까운 사람과의 관계는 큰 약속보다 평소의 태도에서 더 잘 드러나요. 자주 묻고, 늦지 않고, 고마움을 놓치지 않는 습관이 마음의 거리를 줄여 줘요.',
        '익숙한 관계일수록 특별한 말보다 반복되는 태도가 더 오래 남아요. 안부를 묻고, 약속을 지키고, 고마움을 표현하는 작은 습관이 신뢰를 천천히 채워 줘요.',
        '오랜 관계는 한 번의 큰 사건보다 생활 속 작은 확인으로 단단해져요. 서로의 시간을 존중하고 필요한 순간에 짧게 마음을 전하면 거리가 부드러워져요.',
        '곁에 있는 사람들과는 다정함을 크게 증명하지 않아도 괜찮아요. 놓치지 않는 연락과 편안한 말투가 시간이 지나 더 든든한 기억으로 남아요.',
        '관계는 한 번의 큰 결정으로만 깊어지지 않아요. 익숙한 사람들과 쌓은 작은 신뢰가 빈틈을 천천히 채우고, 생활 속 다정함이 오래 기억돼요.',
        '이미 곁에 있는 사람들과의 리듬이 중요한 흐름이에요. 멀리서 큰 답을 찾기보다 자주 안부를 묻고 약속을 지키는 쪽이 관계를 더 편하게 만들어 줘요.',
      ]),
    )
    .replace(
      /주의할 점은 새로 큰 결정을 갑자기 내릴 때예요\. 익숙하지 않은 흐름에 끌려가면 호흡이 흐트러질 수 있으니, 권유를 받아도 한 박자 늦추면 좋아요\./g,
      pickVariant(ctx, 'sourceWealthStandard', [
        '새로운 제안이 들어와도 바로 결론 내리지 않는 편이 좋아요. 낯선 조건은 하루만 지나도 다르게 보일 수 있으니, 금액과 기간, 내가 감당할 책임을 한 번 더 확인해 보세요.',
        '익숙하지 않은 제안일수록 속도를 늦추는 게 도움이 돼요. 마음이 급해질 때는 내가 지킬 금액, 미룰 수 있는 일, 꼭 확인할 조건을 먼저 적어 보고 결정해도 늦지 않아요.',
        '갑자기 큰 선택을 해야 할 것처럼 느껴져도 잠시 멈춰도 괜찮아요. 조건을 다시 읽고 믿을 만한 사람과 한 번 나누면 불필요한 흔들림을 줄일 수 있어요. 혼자 바로 답하지 않는 것만으로도 위험한 결정을 줄일 수 있어요.',
        '새 제안이 좋아 보여도 먼저 내 생활에 들어왔을 때의 부담을 살펴야 해요. 돈이 오가는 방식, 책임지는 기간, 빠져나올 수 있는 조건을 적어 보면 판단이 훨씬 차분해져요.',
        '권유가 강할수록 한 박자 늦추는 습관이 필요해요. 당장 이득처럼 보이는 말보다 내가 감당할 책임과 시간을 확인하면 불필요한 손실을 줄일 수 있어요.',
        '결정을 재촉받을 때는 바로 답하지 않는 것만으로도 자신을 지킬 수 있어요. 조건을 가족이나 믿을 만한 사람과 다시 읽어 보고, 마음이 가라앉은 뒤 선택해도 늦지 않아요.',
        '누군가 빠른 결정을 요구할수록 먼저 조건을 글로 남겨 보세요. 금액, 기간, 책임을 나누어 보면 감당할 수 있는 선택인지 더 차분히 보여요.',
        '좋아 보이는 제안도 바로 답해야 하는 것은 아니에요. 하루를 두고 다시 읽으면 빠뜨린 조건과 내 생활의 부담이 더 잘 보여요.',
        '마음이 급해질 때는 이득보다 책임을 먼저 적어 보세요. 책임의 크기가 보이면 받아들일 일과 넘길 일이 훨씬 분명해져요.',
        '권유가 강하게 들어올수록 내 속도를 지키는 편이 좋아요. 믿을 만한 사람과 조건을 한 번 나누면 돈의 흔들림을 줄일 수 있어요.',
        '새로운 선택 앞에서는 좋은 말보다 빠져나올 기준을 먼저 확인해 보세요. 언제 멈출 수 있는지 알면 결정이 훨씬 안전해져요.',
        '낯선 조건은 처음에는 좋아 보여도 다음 날 다르게 느껴질 수 있어요. 하루를 두고 금액, 약속, 책임을 다시 살피면 돈의 흐름이 더 안전해져요.',
      ]),
    )
    .replace(
      /전체적으로 큰 무리수만 피하면 마음(?:과 몸|·몸)이 따뜻하게 자리 ?잡는 시기예요\. 가까운 사람과의 시간이 (?:오래 남는 기억|평생의 결실)으로 이어져요\./g,
      pickVariant(ctx, 'sourceStressOverall', [
        '몸과 마음은 크게 무리하지 않을 때 더 안정되기 쉬워요. 가까운 사람과 편안하게 보낸 시간이 회복의 기억으로 남고, 생활의 온기도 천천히 살아나요.',
        '이 시기에는 거창한 변화보다 편안한 관계와 쉬는 시간이 더 큰 힘이 돼요. 무리하지 않고 가까운 사람과 시간을 나누면 마음이 훨씬 부드러워져요.',
        '몸과 마음을 따뜻하게 돌보는 일이 중요해요. 가까운 사람과 함께 보내는 평범한 시간이 오래 남는 안정감이 될 수 있어요.',
        '무리하지 않는 선택은 게으른 선택이 아니라 오래 가기 위한 기준이에요. 몸이 보내는 피로 신호를 일찍 알아차리고 가까운 사람과 쉬어 가면 마음의 회복도 더 빨라져요.',
        '이 시기에는 큰 변화를 해내는 것보다 생활을 편안하게 유지하는 힘이 더 중요해요. 잠, 식사, 가벼운 만남이 안정되면 마음도 덜 흔들리고 다음 선택을 차분히 볼 수 있어요.',
        '몸과 마음이 지치지 않도록 하루의 속도를 조금 낮춰 보세요. 해야 할 일을 줄이고 편안한 대화를 남겨 두면 회복이 생활 안에서 자연스럽게 이어져요.',
      ]),
    )
    .replace(
      /자녀 세대와의 흐름은 어른 대 어른의 호흡이 자리 잡고, 손주 세대가 있다면 어린 시절의 보호자 흐름을 새로 만들어 가는 자리이기도 해요\. 형제와의 결, 오래된 친구와의 리듬도 인생 후반에 가장 단단한 자산이 되니, 같이 시간을 보내는 자리를 자주 만들어 두면 좋아요\./g,
      pickVariant(ctx, 'sourceFamilyAutumn', [
        '나이가 들수록 가족과의 관계는 서로의 생활을 존중하는 쪽으로 바뀌기 쉬워요. 자녀 세대와는 어른 대 어른으로 대화하고, 어린 가족이 있다면 편안한 기억을 함께 만들어 가면 좋아요.',
        '가족 관계는 시간이 지나며 돌봄의 모양이 달라져요. 조언을 앞세우기보다 함께 듣고 웃는 시간을 늘리면 형제, 오랜 친구, 다음 세대와의 거리도 더 부드러워져요.',
        '인생 후반의 가족운은 누가 옳은지 가르는 것보다 서로 편히 머무는 시간을 만드는 데 힘이 있어요. 짧은 안부와 함께 보내는 시간이 관계의 든든한 바탕이 돼요.',
        '인생 후반의 가족 관계는 맞고 틀림을 가르는 자리보다 편히 다시 만나는 자리에 가까워요. 짧은 안부와 함께 먹는 식사가 쌓이면 서로의 마음도 덜 딱딱해져요.',
        '가족과 오래 지낼수록 큰 조언보다 편안한 반복이 더 오래 남아요. 묻고, 듣고, 기다려 주는 시간이 쌓이면 다음 세대도 그 따뜻함을 자연스럽게 기억해요.',
        '이 시기의 가족운은 관계를 새로 고치기보다 이미 있는 마음을 부드럽게 돌보는 힘에 가까워요. 짧은 연락과 익숙한 만남을 꾸준히 남기면 관계의 바탕이 안정돼요.',
        '서로의 생각이 달라도 편히 머물 수 있는 시간을 만드는 것이 중요해요. 누가 옳은지 오래 따지기보다 함께 보낸 시간을 늘리면 관계가 훨씬 따뜻하게 남아요.',
        '가족에게 필요한 것은 완벽한 해결보다 돌아와도 괜찮은 분위기일 때가 많아요. 짧은 안부, 작은 식사, 조용히 들어 주는 태도가 후반의 관계를 든든하게 해 줘요.',
      ]),
    )
    .replace(
      /마음의 흐름을 강물에 비유한다면, 너무 막거나 너무 트면 둘 다 고요해지지 않아요\. 흐를 곳은 흘려보내고 머무를 곳은 머무르게 두는 식의 가벼운 분류가 평생 도움이 돼요\. 작은 산책, 같은 시각의 잠, 일정한 호흡 같은 사소한 습관이 강의 폭을 넓혀 줘요\./g,
      pickVariant(ctx, 'sourceStressRiver', [
        '마음을 강물처럼 보면 억지로 막는 일과 한꺼번에 쏟아 내는 일 모두 부담이 될 수 있어요. 흘려보낼 감정과 잠시 붙잡을 일을 나누면 마음이 훨씬 차분해져요. 산책, 일정한 잠자리, 느린 호흡처럼 쉬운 습관이 그 균형을 도와줘요.',
        '마음을 물길처럼 보면, 억지로 막는 것보다 어디로 흐르는지 살피는 편이 더 편해요. 쉬어야 할 때 쉬고, 움직일 때 조금 움직이는 구분이 오래 도움이 돼요. 작은 산책이나 일정한 잠자리처럼 쉬운 습관이 마음의 폭을 넓혀 줘요.',
        '긴장과 회복은 한쪽으로만 몰아붙이면 금방 지치기 쉬워요. 흘려보낼 감정과 잠시 붙잡을 일을 나누어 보면 마음이 훨씬 차분해져요. 매일 비슷한 시간의 휴식과 호흡이 그 균형을 오래 지켜 줘요.',
        '감정이 많아지는 시기에는 바로 답을 내기보다 마음을 내려놓을 자리를 먼저 만들어 보세요. 짧게 걷고 물을 마신 뒤, 오늘 가장 무거운 생각 하나만 적어도 부담이 조금 가벼워져요.',
        '회복은 마음을 억지로 없애는 일이 아니라 지금 감당할 수 있는 크기로 나누는 과정이에요. 오늘 붙잡을 일과 나중에 다시 볼 일을 가르면 마음이 덜 흔들려요.',
        '마음이 무거울 때는 모든 감정을 한 번에 해결하려 하지 않아도 돼요. 지금 할 일, 쉬어 갈 일, 누군가에게 말할 일을 나누면 회복의 길이 조금 더 선명해져요.',
        '회복은 참는 힘만으로 만들어지지 않아요. 내일로 미뤄도 되는 걱정과 지금 돌볼 몸의 신호를 구분하면 마음의 부담이 작아져요.',
        '감정이 복잡할수록 먼저 크기를 줄여 보는 편이 좋아요. 혼자 볼 일, 함께 상의할 일, 잠시 쉬어 갈 일을 나누면 마음이 현실적으로 정리돼요.',
        '마음이 복잡할수록 생활 리듬을 단순하게 만드는 것이 도움이 돼요. 같은 시간에 자고, 가볍게 움직이고, 깊게 숨을 고르는 반복이 긴 흐름의 안정감을 만들어 줘요.',
        '힘든 감정을 밀어내기보다 이름을 붙여 보는 것도 좋은 방법이에요. 피곤함, 서운함, 긴장처럼 간단히 나누면 지금 필요한 휴식이 더 잘 보여요.',
        '마음이 복잡할 때는 먼저 감정을 작게 나누어 보세요. 지친 마음인지, 서운한 마음인지, 불안한 마음인지 이름을 붙이면 다음 행동이 덜 막막해져요.',
        '힘든 기분을 없애려 애쓰기보다 지금 어떤 마음인지 알아차리는 것이 먼저예요. 이름이 붙은 감정은 쉬어야 할지, 말해야 할지, 기다려야 할지 알려 줘요.',
        '마음의 무게가 커질수록 한꺼번에 해결하려 하지 않는 편이 좋아요. 피로, 걱정, 서운함을 나누어 적으면 필요한 회복 방법도 더 분명해져요.',
        '감정은 모양이 보일 때 다루기 쉬워져요. 지금의 마음을 한 단어로 적어 보면 몸을 쉬게 할지, 대화를 나눌지, 잠시 미룰지 고르기 좋아요.',
        '무거운 마음을 억지로 밀어내지 말고 간단한 이름부터 붙여 보세요. 이름이 생기면 감정이 조금 작아지고, 지금 필요한 돌봄도 더 잘 보여요.',
      ]),
    )
    .replace(
      /마음을 흐르는 강에 비유한다면, 물살이 빨라질수록 가끔 고요한 호수 같은 시간이 필요해요\. 짧은 명상, 따뜻한 차 한 잔, 한 권의 책 같은 작은 호수가 마음을 또렷하게 만들어요\./g,
      pickVariant(ctx, 'sourceStressRiver', [
        '마음을 강물처럼 보면 빠르게 흐를 때일수록 잠시 고요해지는 시간이 필요해요. 짧은 산책, 따뜻한 차 한 잔, 조용히 읽는 글 한쪽이 마음의 속도를 낮춰 줄 수 있어요.',
        '마음이 빨리 흔들릴 때는 더 빨리 해결하려 하기보다 잠깐 멈추는 시간이 도움이 돼요. 숨을 고르고, 물을 마시고, 조용한 문장 하나를 읽는 것만으로도 생각이 또렷해져요.',
        '긴장과 회복은 계속 달리는 힘만으로 이어지지 않아요. 하루 안에 작은 쉼을 넣어 두면 마음이 과하게 넘치기 전에 다시 균형을 찾을 수 있어요.',
        '마음의 물살이 빨라졌다고 느껴지면 먼저 속도를 낮출 장면을 정해 보세요. 짧은 호흡, 따뜻한 음료, 잠깐의 정리가 생각을 차분하게 만들어 줘요.',
        '회복은 거창한 휴가만으로 생기지 않아요. 매일 짧게 고요해지는 시간이 있어야 마음이 자기 속도를 다시 찾을 수 있어요.',
      ]),
    )
    .replace(
      /잘 풀리는 것은 가까운 사람과의 대화예요\. 마음을 한 번씩 입 밖으로 꺼내는 것만으로도 무게가 줄어들 수 있으니, 들어 주는 사람을 가까이에 두면 평생의 회복 기반이 돼요\./g,
      pickVariant(ctx, 'sourceStressSupport', [
        '잘 풀리는 쪽은 마음을 혼자만 들고 있지 않는 데 있어요. 가까운 사람에게 오늘 힘들었던 일 하나만 말해도 무게가 줄고, 다시 움직일 힘이 생겨요.',
        '마음은 말로 꺼낼 때 정리되는 부분이 있어요. 긴 설명이 아니어도 괜찮으니 믿을 만한 사람에게 한 문장만 나누어 보세요.',
        '들어 주는 사람이 가까이에 있다는 사실만으로도 회복의 바탕이 생겨요. 짧은 통화, 산책 중 대화, 식사 자리의 안부가 마음을 가볍게 해 줘요.',
        '혼자 견디는 시간이 길어질수록 생각이 더 무거워질 수 있어요. 편한 사람과 사실과 감정을 짧게 나누면 다음 행동도 더 쉽게 정해져요.',
        '잘 풀리는 방식은 큰 조언을 듣는 것보다 마음을 안전하게 꺼낼 수 있는 관계를 두는 거예요. 그런 대화가 반복되면 회복도 생활 속 습관이 돼요.',
      ]),
    )
    .replace(
      /주의할 점은 비교에서 오는 마음 무게예요\. 친구의 성과를 자기 기준으로 삼을수록 마음이 빠르게 무거워지기 쉬워요\. 자기 페이스를 살피는 시간이 가장 좋은 회복이에요\./g,
      pickVariant(ctx, 'sourceStressSupport', [
        '주의할 점은 다른 사람의 성과를 내 기준처럼 붙잡는 거예요. 비교가 길어질수록 마음이 쉽게 무거워지니, 오늘 내 속도에서 줄일 부담 하나를 먼저 보세요.',
        '비교는 잠깐 참고할 수는 있지만 오래 붙잡으면 회복을 방해해요. 친구의 속도보다 내 몸과 마음이 덜 지치는 기준을 찾는 편이 더 도움이 돼요.',
        '다른 사람의 결과가 좋아 보여도 내 생활의 리듬과 같을 필요는 없어요. 지금 내게 맞는 속도를 확인하면 마음의 무게가 훨씬 줄어요.',
        '주의할 부분은 남의 기준을 따라가다 내 신호를 놓치는 거예요. 오늘 잘한 작은 선택 하나를 확인하면 비교에서 오는 부담이 조금 내려가요.',
        '마음이 무거워질 때는 누가 앞섰는지보다 내가 계속 갈 수 있는지를 먼저 보세요. 회복은 내 페이스를 다시 찾는 데서 시작돼요.',
      ]),
    )
    .replace(
      /주의할 점은 모든 책임을 자기에게 두는 습관이에요\. 다른 사람의 몫까지 가져오면 어느 순간 마음이 무거워져요\. 적당히 나누는 연습이 평생 가볍게 가는 방법이에요\./g,
      pickVariant(ctx, 'sourceStressRest', [
        '주의할 점은 책임을 모두 내 몫으로만 가져오는 습관이에요. 내가 할 일과 다른 사람이 맡을 일을 나누면 마음의 무게가 훨씬 현실적으로 줄어요.',
        '모든 일을 혼자 책임지려 하면 마음이 쉽게 지칠 수 있어요. 부탁할 일, 기다릴 일, 내가 할 일을 나누어 보는 연습이 오래 가는 회복의 기준이 돼요.',
        '책임감이 강한 사람일수록 다른 사람의 몫까지 들고 오기 쉬워요. 오늘은 내려놓을 일 하나와 확인만 하면 되는 일 하나를 구분해 보세요.',
        '적당히 나누는 일은 무책임한 태도가 아니에요. 내 몫을 또렷하게 알고, 남의 몫은 돌려주는 연습이 마음을 오래 가볍게 지켜 줘요.',
        '마음이 무거울 때는 내가 실제로 결정할 수 있는 일과 그렇지 않은 일을 나누어 보세요. 구분이 생기면 필요 없는 책임감이 조금 내려가요.',
      ]),
    )
    .replace(
      /주의할 점은 책임감이 클수록 쉼을 미루기 쉽다는 거예요\. 쉬는 시간을 일과 같은 무게로 일정에 적어 두면, 무리가 쌓여서 한 번에 무너지는 일이 거의 없어요\. 짐을 내려놓는 일 자체가 다음 일을 위한 준비라는 감각이 큰 도움이 돼요\./g,
      pickVariant(ctx, 'sourceStressRest', [
        '주의할 점은 책임감이 클수록 쉼을 미루기 쉽다는 거예요. 쉬는 시간을 일과 같은 무게로 일정에 적어 두면, 무리가 쌓여서 한 번에 무너지는 일이 거의 없어요. 짐을 내려놓는 일 자체가 다음 일을 위한 준비라는 감각이 큰 도움이 돼요.',
        '책임감이 강할수록 쉬는 일을 뒤로 미루기 쉬워요. 그래서 휴식도 해야 할 일처럼 일정 안에 넣어 두는 편이 좋아요. 잠깐 내려놓는 시간이 있어야 다음 일을 더 안정적으로 이어 갈 수 있어요.',
        '책임이 많은 시기일수록 쉬는 시간을 남겨 두는 일이 더 현실적인 관리예요. 잠시 내려놓을 일과 오늘 꼭 할 일을 나누면 무리가 한꺼번에 쌓이는 일을 줄일 수 있어요.',
        '계속 버티는 힘이 있어도 몸과 마음에는 멈출 기준이 필요해요. 하루 안에 짧게 숨 고를 시간을 넣어 두면 다음 책임도 덜 급하게 이어져요.',
        '쉬는 시간을 미루는 습관이 반복되면 피로가 늦게라도 크게 올라올 수 있어요. 먼저 줄일 약속 하나를 정하고, 회복할 시간을 일정 안에 넣어 보세요.',
        '책임을 잘 지키려면 힘을 남기는 방식도 함께 필요해요. 오늘 내려놓아도 되는 일과 꼭 챙길 일을 구분하면 마음이 훨씬 차분해져요.',
        '조심할 부분은 버티는 힘을 너무 오래 쓰는 거예요. 쉬는 시간을 미리 정해 두면 피로가 한꺼번에 몰리는 일을 줄일 수 있어요. 쉬는 것은 멈추는 일이 아니라 다음 선택을 준비하는 과정이에요.',
        '버티는 힘이 강할수록 몸과 마음의 신호를 늦게 알아차릴 수 있어요. 그래서 쉬는 시간을 미리 일정에 넣어 두는 편이 좋아요. 잠깐 멈추는 일이 오히려 긴 흐름을 지켜 줘요.',
        '오래 참는 태도만으로는 회복이 충분하지 않을 수 있어요. 피로가 커지기 전에 쉬는 날과 가벼운 정리 시간을 정해 두면 마음의 부담이 덜 쌓여요.',
        '오래 참아 온 일일수록 쉬는 시간을 나중으로 미루기 쉬워요. 피로가 작을 때 멈출 기준을 정하면 다음 책임도 더 차분히 이어져요.',
        '참는 힘이 좋다는 말은 계속 버티라는 뜻이 아니에요. 오늘은 일찍 내려놓을 일과 내일까지 봐도 되는 일을 나누어 보세요.',
        '회복은 긴 휴가만 기다리는 일이 아니에요. 물 한 잔, 짧은 걷기, 알림 줄이기처럼 바로 할 수 있는 멈춤도 긴장을 낮춰 줘요.',
        '회복은 하루를 통째로 비워야만 시작되는 일이 아니에요. 잠깐 눈을 쉬게 하고, 몸을 움직이고, 답장을 늦추는 작은 선택도 마음을 가볍게 해 줘요.',
        '큰 휴식이 어렵다면 작게 멈추는 기준부터 정해 보세요. 물을 마시고 숨을 고르고 화면을 잠깐 덮는 행동만으로도 몸의 긴장이 조금 내려가요.',
        '계속 견디는 방식이 익숙하다면 먼저 내려놓을 작은 일을 하나 정해 보세요. 쉬는 기준이 있어야 다음 책임도 더 차분히 이어 갈 수 있어요.',
        '버티는 힘이 강한 사람일수록 쉬어야 할 때를 늦게 알아차릴 수 있어요. 오늘 줄일 약속 하나와 지켜도 되는 책임 하나를 나누면 회복이 훨씬 현실적이에요.',
        '무조건 참는 방식은 오래가면 마음과 몸을 함께 지치게 해요. 잠시 미룰 일, 부탁할 일, 오늘 꼭 할 일을 나누면 부담이 작아져요.',
        '책임을 다하려는 마음이 커도 회복 시간을 빼면 오래 이어지기 어려워요. 먼저 내려놓을 작은 일 하나를 정하면 다음 선택도 덜 급해져요.',
        '쉬는 일은 책임을 포기하는 것이 아니에요. 다시 해낼 힘을 남기기 위해 오늘 덜어낼 일을 고르는 과정에 가까워요.',
        '쉬는 시간을 뒤로 미루다 보면 몸보다 마음이 먼저 지칠 수 있어요. 하루 안에 멈출 시간을 작게 정해 두면 다음 일정도 덜 무겁게 이어져요.',
      ]),
    )
    .replace(
      /잘 풀리는 것은 사람과의 관계 속에서 회복이 일어나요\. 혼자 짊어지기보다 가까운 사람과 가벼운 대화를 나누는 자리에서 마음의 짐이 자연스럽게 내려가요\. 같은 일도 옆에 사람이 있으면 더 가볍게 느껴지는 흐름이에요\./g,
      pickVariant(ctx, 'sourceStressSupport', [
        '회복은 가까운 사람과 부담 없는 말을 나눌 때 더 자연스럽게 시작될 수 있어요. 긴 설명이 아니어도 괜찮아요. 안부 한마디, 함께한 식사, 짧은 산책이 마음의 긴장을 낮춰 줘요.',
        '회복은 혼자만의 힘으로 만들기보다 가까운 사람과 나누는 말 속에서 더 쉽게 찾아와요. 무거운 이야기가 아니어도 괜찮아요. 짧은 안부나 가벼운 대화만으로도 마음의 무게가 조금 내려갈 수 있어요.',
        '사람과 연결되는 시간이 회복의 단서가 될 수 있어요. 혼자 해결하려고 애쓰기보다 믿을 만한 사람에게 짧게 말해 보는 편이 좋아요. 같은 상황도 함께 나누면 훨씬 덜 무겁게 느껴져요.',
        '마음이 무거울 때는 큰 조언보다 편히 들어 줄 사람이 더 도움이 될 수 있어요. 가까운 사람에게 오늘 힘들었던 일을 한 문장만 말해도 긴장이 조금 내려가요.',
        '지친 날에는 해결책을 바로 찾기보다 내 말을 들어 줄 사람을 떠올리는 것만으로도 도움이 돼요. 짧은 안부와 한 문장 대화가 마음의 압력을 낮춰 줘요.',
        '회복이 필요할 때는 혼자 정답을 찾으려 애쓰지 않아도 괜찮아요. 믿을 만한 사람에게 지금 가장 무거운 장면 하나만 말하면 마음이 조금 정리돼요.',
        '무거운 마음은 밖으로 꺼낼 때 크기가 달라질 수 있어요. 가까운 사람과 사실 하나, 감정 하나만 나누어도 다음 행동이 덜 급해져요.',
        '마음이 가라앉는 날에는 조언을 많이 듣기보다 안전하게 말할 자리가 필요해요. 편한 사람에게 짧게 털어놓으면 긴장이 천천히 내려가요.',
        '혼자 버티는 시간이 길어졌다면 먼저 가벼운 연결부터 만들어 보세요. 같이 걷기, 차 한잔하기, 짧은 통화처럼 부담 없는 방식이면 충분해요.',
        '도움을 받는 일은 약해지는 일이 아니에요. 필요한 순간에 기대고, 괜찮아진 뒤 고마움을 나누면 관계도 회복도 더 오래 이어져요.',
        '같은 문제라도 함께 바라보면 무게가 달라질 수 있어요. 믿을 만한 사람과 사실, 감정, 다음 행동을 짧게 나누면 마음이 훨씬 정리돼요.',
        '혼자 생각이 길어질수록 문제는 더 크게 느껴질 수 있어요. 믿을 만한 사람에게 지금 상황과 필요한 도움을 짧게 말하면 회복의 순서가 보이기 시작해요.',
        '마음이 무거운 날에는 해결책보다 같이 확인해 줄 사람이 먼저 필요할 수 있어요. 사실과 감정을 나누어 말하면 다음 행동도 덜 급해져요.',
        '도움을 청하는 일은 문제를 키우는 행동이 아니에요. 함께 볼 사람을 정하면 혼자 떠안던 부담이 현실적인 크기로 줄어들어요.',
        '같은 고민도 말로 꺼내면 모양이 달라져요. 믿을 만한 사람과 지금 할 일, 기다릴 일, 내려놓을 일을 나누면 마음이 한결 정리돼요.',
      ]),
    )
    .replace(
      /전체적으로 큰 무리수만 피하면 마음과 몸이 단단히 자리 잡는 흐름이에요\. 평생을 보면 휴식이 곧 가장 큰 자산이 되는 흐름이니, 회복을 비용이 아니라 장기적인 준비로 보는 시선이 잘 맞아요\./g,
      pickVariant(ctx, 'sourceStressOverall', [
        '몸과 마음은 크게 몰아붙이지 않을 때 오히려 더 오래 안정될 수 있어요. 쉬는 시간을 낭비로 보지 말고 생활을 지키는 기본 자산으로 두세요. 회복을 미루지 않는 태도가 긴 흐름에서 가장 든든한 준비가 돼요.',
        '긴 흐름에서는 많이 해내는 힘보다 꾸준히 회복하는 힘이 더 중요해져요. 피로가 작을 때 쉬고, 무리가 커지기 전에 일정을 줄이면 생활의 기준이 더 단단해져요.',
        '이 흐름에서는 강하게 밀어붙이는 것보다 오래 유지하는 힘이 더 중요해요. 몸과 마음이 보내는 신호를 일찍 알아차리면 큰 부담을 줄일 수 있어요. 휴식은 뒤처지는 시간이 아니라 다음 걸음을 위한 기반이에요.',
        '몸과 마음의 안정은 대단한 계획보다 반복되는 기본에서 만들어져요. 잠, 식사, 움직임, 대화 중 하나만 꾸준히 챙겨도 긴 시간의 부담이 훨씬 줄어요.',
        '회복을 뒤로 미루는 습관이 쌓이면 작은 피로도 크게 느껴질 수 있어요. 그래서 평소에 쉬는 기준을 먼저 정해 두는 편이 좋아요. 쉬어 갈 틈이 있어야 다음 책임도 오래 이어져요.',
        '몸이 지친 뒤에야 쉬기보다 지치기 전에 멈출 기준을 정해 두는 편이 좋아요. 잠깐 쉬는 시간을 일정 안에 넣어 두면 책임도 더 오래 안정적으로 이어져요.',
        '회복은 일이 끝난 뒤 남는 시간이 아니라 일을 오래 하기 위한 기본 조건이에요. 피곤한 신호가 작을 때 물러서면 다음 선택도 훨씬 차분해져요.',
        '쉼을 미루는 일이 반복되면 마음도 쉽게 날카로워질 수 있어요. 하루 중 내려놓을 시간 하나를 먼저 정하면 생활 전체의 긴장이 조금씩 풀려요.',
        '무리하지 않는 선택은 소극적인 태도가 아니에요. 내 몸이 감당할 수 있는 속도를 아는 것이고, 그 기준이 있어야 좋은 기회도 오래 붙잡을 수 있어요.',
        '쉬어 가는 기준을 세워 두면 기회가 왔을 때도 더 오래 버틸 수 있어요. 피곤한 몸을 억지로 끌고 가기보다 회복할 시간을 남겨 두는 편이 결과적으로 더 든든해요.',
        '몸이 보내는 작은 신호를 무시하지 않는 것이 중요해요. 잠이 부족하거나 식사가 흔들릴 때는 먼저 기본을 바로잡아야 마음도 차분하게 따라와요.',
        '컨디션은 큰 이상이 생긴 뒤에만 챙기는 것이 아니에요. 잠, 식사, 움직임 중 하나가 흔들릴 때 바로 알아차리면 회복도 훨씬 쉬워져요.',
        '몸의 작은 반응은 귀찮은 방해가 아니라 조절하라는 신호일 수 있어요. 피곤함, 예민함, 식사 리듬을 일찍 살피면 마음도 덜 흔들려요.',
        '작은 신호를 일찍 알아차리면 큰 무리를 줄일 수 있어요. 오늘은 잠을 보충할지, 식사를 편하게 할지, 움직임을 줄일지 하나만 골라도 충분해요.',
        '몸이 보내는 신호는 참고 넘길수록 커질 때가 있어요. 가벼운 피로가 보이면 먼저 쉬는 시간과 따뜻한 식사를 챙기는 편이 안전해요.',
        '무리하지 않는다는 말은 아무것도 하지 않는다는 뜻이 아니에요. 할 일의 크기를 줄이고 회복할 시간을 남겨 두는 방식으로 생활을 오래 이어 가는 거예요.',
        '긴장과 회복은 한 번에 해결되는 문제가 아니라 생활 속에서 계속 조절하는 주제예요. 오늘 줄일 부담과 계속 가져갈 습관을 하나씩 나누면 방향이 더 분명해져요.',
      ]),
    )
    .replace(
      /비유하자면 작은 우물을 매년 한 두레박씩 채워 넣는 그림이에요\. 한 번에 가득 채우려 할수록 흙탕물이 일고, 한 번에 한 두레박만 더해도 시간이 지나면 깊은 우물이 돼요\./g,
      pickVariant(ctx, 'sourceWealthWell', [
        '비유하자면 저금통에 동전을 하나씩 넣는 모습에 가까워요. 한 번에 크게 채우려 하기보다 꾸준히 더하는 습관이 시간이 지나며 든든한 기반이 돼요. 작아 보여도 반복되는 선택은 생각보다 큰 힘을 만들어요.',
        '돈의 흐름은 한 번에 크게 바꾸기보다 자주 확인할 때 더 안정돼요. 오늘 아낀 지출, 매달 남긴 금액, 미리 적어 둔 기준이 시간이 지나며 든든한 바탕이 돼요.',
        '비유하자면 작은 화분에 물을 조금씩 주는 일과 비슷해요. 많이 붓는 날보다 알맞게 자주 챙기는 날이 쌓여야 뿌리가 튼튼해져요. 돈 관리도 그런 반복에서 힘이 생겨요.',
        '큰 수익을 한 번에 기대하기보다 새는 지출을 천천히 줄이는 쪽이 더 현실적이에요. 작은 금액을 정리하는 습관이 쌓이면 생활의 여유도 함께 커져요.',
        '돈은 큰 사건보다 평소의 선택에서 방향이 잡혀요. 어디에 쓰면 마음이 편하고 어디에서 멈춰야 하는지 적어 두면 다음 선택이 훨씬 쉬워져요.',
        '비유하자면 매달 같은 자리에 작은 표시를 남기는 가계부와 비슷해요. 많이 벌 때보다 꾸준히 확인할 때 내 생활에 맞는 돈의 속도가 더 잘 보여요.',
        '돈 관리는 큰 결심보다 반복되는 확인에서 힘이 생겨요. 이번 달에 지켜 낸 기준 하나와 다음 달에 줄일 부담 하나를 나누면 흐름이 훨씬 또렷해져요.',
        '한 번의 큰 성과보다 새지 않게 붙잡은 작은 금액이 오래 힘이 될 수 있어요. 어디서 줄였고 어디에 남겼는지 알면 다음 선택도 덜 흔들려요.',
        '비유하자면 깊은 우물보다 먼저 물길을 막지 않는 일이 중요해요. 들어오는 돈만 보지 말고 자주 새는 지출을 확인하면 생활의 바탕이 더 안정돼요.',
        '돈의 기준은 멀리 있는 큰 목표보다 오늘의 작은 선택에서 자라요. 편하게 쓴 돈과 아쉬움이 남은 돈을 나누어 보면 다음 판단이 쉬워져요.',
        '재물의 바탕은 갑자기 생기지 않아요. 매달 남기는 금액, 미루기로 한 소비, 꼭 지킨 약속이 쌓이면서 내 기준이 천천히 단단해져요.',
        '비유하자면 오래 쓰는 물건을 고르듯 돈도 자주 살피는 손길이 필요해요. 한 번에 완벽하게 정리하려 하지 말고, 반복되는 지출 하나부터 다루면 충분해요.',
      ]),
    )
    .replace(
      /관리 기준이 또렷하면 돈의 방향도 또렷해져요\. 큰 무리수 한 번보다, 작은 결정을 꾸준히 다듬는 방식이 평생의 자산을 단단하게 만들어 줘요\./g,
      pickVariant(ctx, 'sourceWealthStandard', [
        '돈을 볼 때는 큰 결정보다 기준을 먼저 세우는 편이 좋아요. 어디에 쓰고 어디에서 멈출지 정해 두면 불필요한 흔들림이 줄어요. 작은 기준을 꾸준히 지키는 힘이 오래가는 자산을 만들어요.',
        '기준이 분명하면 돈의 쓰임도 훨씬 편하게 보일 수 있어요. 한 번의 큰 선택보다 매번 같은 기준으로 확인하는 습관이 더 중요해요. 그렇게 쌓인 판단이 생활의 안정감을 키워 줘요.',
        '돈을 모으는 힘은 금액의 크기보다 기준의 선명함에서 시작돼요. 꼭 필요한 지출, 미룰 수 있는 지출, 나중을 위한 금액을 나누면 마음도 덜 복잡해져요.',
        '지출을 줄이라는 말보다 먼저 돈이 어디로 가는지 보는 것이 중요해요. 한 달에 한 번만 흐름을 적어도 내 생활에 맞는 기준이 조금씩 잡혀요.',
        '평생의 돈 관리는 대단한 기술보다 반복되는 확인에서 힘을 얻어요. 같은 기준으로 쓰고 모으는 습관이 있으면 갑작스러운 선택 앞에서도 덜 흔들려요.',
        '기준을 정한다는 말은 돈을 쓰지 말라는 뜻이 아니에요. 쓸 곳, 기다릴 곳, 누군가와 상의할 곳을 나누면 돈이 생활을 덜 흔들게 돼요.',
        '돈의 방향은 수입만으로 정해지지 않아요. 매달 반복되는 지출과 마음이 급해지는 순간을 함께 보면 내게 맞는 관리법이 더 선명해져요.',
        '큰 계획이 없어도 기준은 만들 수 있어요. 자주 쓰는 항목 하나를 정리하고, 다음 선택에서 같은 실수를 줄이는 것부터 시작해도 충분해요.',
        '좋은 돈 관리는 숫자를 많이 아는 일보다 내 생활의 우선순위를 아는 일에 가까워요. 꼭 지킬 것과 천천히 바꿀 것을 나누면 마음도 편해져요.',
        '기준이 흐리면 작은 지출도 크게 느껴질 수 있어요. 먼저 필요한 비용과 기분으로 쓰는 비용을 나누면 돈의 방향이 차분해져요.',
        '오래 가는 자산 관리는 무리한 절약보다 반복 가능한 기준에서 시작돼요. 내 생활을 지키는 금액과 줄일 수 있는 부담을 구분해 보세요.',
        '돈은 한 번에 해결해야 할 숙제가 아니에요. 이번 달에 확인할 항목 하나, 미룰 항목 하나, 계속 지킬 항목 하나만 있어도 기준이 살아나요.',
      ]),
    )
    .replace(
      /잘 풀리는 지점은 꾸준함이에요\. 매(?:주|월) 같은 날 자동이체(?: 점검)?, 작은 적금(?: 점검)?처럼 일정한 자산 관리가 빛을 내요\./g,
      pickVariant(ctx, 'sourceWealthPace', [
        '돈 관리는 한 번 크게 바꾸는 것보다 같은 기준을 자주 확인할 때 안정돼요. 자동이체, 작은 저축, 반복 지출 중 하나만 정해 봐도 흐름이 훨씬 또렷해져요.',
        '잘 맞는 지점은 반복되는 확인이에요. 같은 날에 들어오고 나가는 돈을 살피면 새는 부분이 보이고, 작은 저축도 부담 없이 이어져요.',
        '꾸준함은 돈을 묶어 두라는 뜻이 아니에요. 매번 같은 기준으로 확인하고, 기다릴 지출과 지킬 저축을 나누는 습관이 생활을 편하게 해 줘요.',
        '큰 금액보다 작은 약속을 지키는 힘이 좋아요. 정해 둔 날짜에 지출과 저축을 함께 보면 돈의 흐름이 덜 막연해져요.',
        '돈의 안정감은 특별한 비법보다 반복되는 점검에서 생겨요. 들어오는 돈, 나가는 돈, 남겨 둘 돈을 같은 순서로 보면 선택이 차분해져요.',
      ]),
    )
    .replace(
      /무리수만 한 박자 줄이면 충분해요\. 자기 페이스를 지키는 것 자체가 이 재물운의 가장 큰 강점이에요\./g,
      pickVariant(ctx, 'sourceWealthPace', [
        '크게 욕심내기보다 한 박자 늦춰 확인하는 태도가 잘 맞아요. 자기 속도를 지키면 돈 문제에서도 불필요한 흔들림이 줄어요.',
        '조금 천천히 결정해도 괜찮아요. 무리한 선택을 줄이고 내 기준을 지키는 것만으로도 돈 관리의 안정감이 커져요.',
        '큰 결정을 앞두고 있다면 바로 움직이기보다 하루 더 살펴보는 편이 좋아요. 숫자를 다시 보고 마음이 급해진 이유를 확인하면 선택이 훨씬 단단해져요.',
        '돈 문제에서는 빠른 결론보다 멈출 줄 아는 힘이 더 도움이 될 때가 많아요. 사고 싶은 마음과 꼭 필요한 이유를 나누면 불필요한 부담을 줄일 수 있어요.',
        '무리하지 않는 속도가 이 흐름의 장점이에요. 조금 덜 쓰고, 조금 더 확인하고, 내 기준을 지키는 반복이 생활의 안정감을 천천히 키워 줘요.',
        '급하게 결정하고 싶은 순간일수록 하루만 더 두고 보는 편이 좋아요. 마음이 가라앉은 뒤에도 필요한 선택이면 그때 더 차분히 움직일 수 있어요.',
        '돈의 속도를 늦춘다고 기회를 놓치는 것은 아니에요. 조건을 다시 읽고 감당할 범위를 확인하면 오히려 오래 갈 선택이 남아요.',
        '무리한 선택을 줄이는 일은 소극적인 태도가 아니에요. 내 생활을 지키면서 돈을 쓰는 방법을 찾는 가장 현실적인 기준이에요.',
        '좋아 보이는 제안일수록 바로 답하지 않아도 괜찮아요. 금액, 기간, 책임을 다시 확인하면 선택의 무게가 더 분명해져요.',
        '내 페이스를 지키는 사람은 돈 문제에서도 덜 흔들려요. 급한 마음이 올라올 때는 지금 필요한지, 기다릴 수 있는지 먼저 나누어 보세요.',
        '천천히 본다는 것은 미루는 것이 아니라 실수를 줄이는 과정이에요. 한 번 더 묻고, 한 번 더 계산하면 부담스러운 선택을 피하기 쉬워요.',
        '돈을 다룰 때는 빠른 확신보다 다시 확인할 여유가 더 안전할 때가 많아요. 오늘은 결정보다 확인할 질문 하나를 남겨도 충분해요.',
      ]),
    )
    .replace(
      /마음이 깊고 차분하게 머무는 시기라, 서두른 답보다 천천히 확인한 진심이 곁의 사람에게 오래 닿아요\. 짧은 한마디라도 상대를 배려한 시간이 담기면 신뢰가 단단해져요\. 빠른 답을 요구받는 상황에서는 잠시 숨을 고른 뒤 말하는 흐름이 잘 어울려요\./g,
      pickVariant(ctx, 'sourceRomanceLifeExpression', [
        '이 시기에는 빠른 결론보다 천천히 확인한 진심이 관계를 더 편하게 만들어요. 짧은 말이라도 상대를 배려하는 시간이 담기면 신뢰가 오래 남아요. 급하게 답해야 하는 상황에서는 잠시 숨을 고른 뒤 말해도 충분해요.',
        '마음이 깊어지는 흐름에서는 화려한 표현보다 차분한 말투가 더 오래 닿아요. 고마움이나 안부를 짧게 전하더라도 진심이 담기면 가까운 사람에게 안정감으로 남아요. 답을 재촉받을 때는 바로 정하지 말고 한 박자 늦춰도 괜찮아요.',
        '관계에서는 서두른 확답보다 천천히 살핀 마음이 더 믿음직하게 느껴질 때가 있어요. 상대를 배려한 한마디와 지킬 수 있는 작은 약속이 쌓이면 신뢰가 단단해져요. 마음이 급해질수록 잠깐 쉬고 말하는 편이 잘 맞아요.',
        '이 흐름은 마음을 크게 드러내기보다 조용히 오래 지키는 태도와 잘 어울려요. 짧은 안부, 부드러운 말투, 기다려 주는 태도가 가까운 사람에게 오래 남아요. 빠른 답을 요구받아도 내 마음을 정리할 시간을 먼저 가져 보세요.',
        '가까운 관계에서는 깊은 마음을 빨리 증명하려 하지 않아도 괜찮아요. 상대가 편하게 받을 수 있는 말 한마디를 고르고, 급한 결론은 잠시 미루면 관계가 덜 흔들려요. 천천히 확인한 진심이 오히려 더 오래 닿아요.',
      ]),
    )
    .replace(
      /큰 약속의 시기를 미리 못 박지 않아도 시간이 자연스럽게 맞춰 줄 수 있어요\. 자기 생활과 마음을 돌보는 일이 좋은 관계를 오래 지키는 바탕이 돼요\./g,
      pickVariant(ctx, 'sourceRomanceLifeExpression', [
        '큰 약속의 시기를 지금 미리 정하지 않아도 괜찮아요. 생활이 안정되고 마음의 속도가 맞아 갈수록 관계의 다음 단계도 더 차분하게 보일 수 있어요.',
        '관계의 중요한 선택은 서둘러 날짜를 정하기보다 서로의 생활이 편안하게 맞는지 보는 편이 좋아요. 내 마음과 생활을 돌보는 태도가 오래 가는 관계의 바탕이 돼요.',
        '앞으로의 약속을 너무 빨리 결론 내리지 않아도 돼요. 지금은 서로에게 무리 없는 속도와 지킬 수 있는 태도를 확인하는 일이 더 중요해요.',
        '시간이 조금 더 지나야 자연스럽게 보이는 관계의 길도 있어요. 내 생활을 잘 지키고 마음을 차분히 돌보면 가까운 관계도 더 안정적으로 이어질 수 있어요.',
        '큰 약속은 마음이 급할 때 정하기보다 서로의 신뢰가 충분히 쌓였을 때 보는 편이 좋아요. 지금은 오늘 지킬 수 있는 배려와 생활의 균형을 먼저 챙겨 보세요.',
      ]),
    )
    .replace(
      /마음을 표현할 때 정확하고 단정한 한마디가 가장 큰 자산이 돼요\. 빠르게 결론짓는 자리보다 짧은 약속을 정확히 지키는 자리가 인연의 토대를 단단하게 만들어 줘요\. 곁의 사람에게는 큰 표현보다 한결같은 자리가 한층 부드럽게 닿아요\./g,
      pickVariant(ctx, 'sourceRomanceLifeExpression', [
        '관계에서는 정확한 말보다 꾸준히 지키는 태도가 더 크게 남을 때가 많아요. 짧은 약속을 차분히 지키고, 마음을 과하게 밀어붙이지 않으면 신뢰가 천천히 단단해져요.',
        '마음을 전할 때는 큰 표현보다 차분한 한마디와 지킨 약속이 더 오래 남아요. 상대가 편하게 받아들일 수 있는 속도를 지키면 관계의 바탕도 부드러워져요.',
        '가까운 사람에게는 화려한 말보다 반복되는 배려가 더 잘 닿아요. 빠르게 결론을 내리기보다 오늘 지킬 수 있는 작은 약속을 정확히 지키는 편이 좋아요.',
        '관계의 신뢰는 큰 선언보다 일상에서 반복되는 말투와 약속에서 자라요. 단정한 한마디를 고르고, 지킬 수 있는 만큼만 약속하면 마음이 덜 흔들려요.',
        '표현이 강하지 않아도 관계는 충분히 깊어질 수 있어요. 고른 말투, 늦지 않는 약속, 부담을 주지 않는 태도가 곁의 사람에게 안정감으로 남아요.',
        '마음을 빨리 증명하려 하기보다 오늘 할 수 있는 다정한 말과 작은 약속을 지켜 보세요. 그런 반복이 인연의 바탕을 더 편안하게 만들어 줘요.',
      ]),
    );
}
function softenPublicTone(value: string): string {
  return normalizeRenderedText(value)
    .replace(/가족나/g, '가족이나')
    .replace(/기준가/g, '기준이')
    .replace(/자료은/g, '자료는')
    .replace(/약속를/g, '약속을')
    .replace(/범위을/g, '범위를')
    .replace(/자료이/g, '자료가')
    .replace(/조건, 조건/g, '조건, 확인할 사람')
    .replace(/이번 달은 마음에 닿는 관심사 하나를 더 깊이 파 보기 좋은 때예요\. 한 가지 분야의 책 한 권이나 자료 묶음을 한 달 동안 챙겨 두면, 나중에 고를 길의 단서가 생겨요\./g, '이번 달은 관심 있는 일을 실제로 작게 경험하되 속도를 함께 조절해 보기 좋은 때예요. 짧은 체험, 동아리 활동, 관련된 사람과의 대화처럼 손에 잡히는 경험과 부담을 나누면 나중에 고를 길이 더 선명해져요.')
    .replace(/방향실/g, '실마리')
    .replace(/실마리을/g, '실마리를')
    .replace(/작은 실천 흐름으로는/g, '작은 실천으로는')
    .replace(/작은 자문 한 번이 후배의 결정 한 번을 살리는 식이라/g, '작은 자문 한 번이 후배의 결정을 돕는 식이라')
    .replace(/오래 쥐고 있던 노하우를 너무 깊이 넣어 두지 않으면 좋아요/g, '오래 쥐고 있던 노하우를 조금씩 나눠 보면 좋아요')
    .replace(/큰 자리에서 한 발 물러나는 결정도 또 다른 자리의 시작이 되니/g, '큰 역할에서 한 발 물러나는 결정도 다음 역할의 시작이 될 수 있으니')
    .replace(/오늘 한 자리에서는/g, '오늘은')
    .replace(/그 한 자리가 오늘의 마음을/g, '그 한마디가 오늘의 마음을')
    .replace(/다음 자리로 자연스럽게 이어져요/g, '다음 대화로 자연스럽게 이어져요')
    .replace(/누군가의 큰 자리의 디딤돌이 되는 모양이에요/g, '누군가가 큰 결정을 하는 데 디딤돌이 될 수 있어요')
    .replace(/자기다운 또 다른 자리를 만들어 줘요/g, '자기다운 다음 역할을 만들어 줘요')
    .replace(/미래의 (?:자리|선택지)가 자기에게 맞춰져 와요/g, '나중에 고를 길의 단서가 생겨요')
    .replace(/선택지가 자기에게 맞춰져 와요/g, '고를 길의 단서가 생겨요')
    .replace(/그 씨앗이 미리 정해 두는 자리가 돼요/g, '그 씨앗이 나중의 방향을 보여 주는 단서가 돼요')
    .replace(/새로운 도구·이야기·노래를 만나는 자리가 자연스럽게 생기고/g, '새로운 도구·이야기·노래를 만날 기회가 자연스럽게 생기고')
    .replace(/새로운 도구·이야기·노래를 만나는 자리가/g, '새로운 도구·이야기·노래를 만날 기회가')
    .replace(/한 점씩 더해 두는 작은 자리가 모여/g, '한 점씩 더해 둔 기록이 모여')
    .replace(/한 곳에 모아 두면 자기 흐름의 자취가 또렷해져요/g, '한 곳에 모아 두면 아이가 좋아하는 방식이 더 잘 보여요')
    .replace(/자유롭게 풀어 주는 환경이 가장 좋은 거름이에요/g, '자유롭게 풀어 볼 수 있는 환경이 가장 좋은 바탕이에요')
    .replace(/분기마다/g, '세 달에 한 번씩')
    .replace(/첫 자료집으로 남아 줘요/g, '나중에 다시 볼 자료가 돼요')
    .replace(/상자 한 칸씩 채워 두는 시간이 일 년의 끝에서 자기 색을 또렷하게 받쳐 주는 나중에 다시 볼 자료가 돼요/g, '상자 한 칸씩 채워 두면 일 년의 끝에서 아이가 무엇을 좋아했는지 다시 보기 쉬워요')
    .replace(/세 달에 한 번씩 한 번씩/g, '세 달에 한 번씩')
    .replace(/세 달에 한 번씩씩/g, '세 달에 한 번씩')
    .replace(/세 달에 한 번씩 한 번/g, '세 달에 한 번씩')
    .replace(/한 세 달에 한 번씩/g, '세 달에 한 번씩')
    .replace(/다음 분기의 물살이 더 또렷하게 자기 기준에 흘러요/g, '다음 계절의 페이스를 더 편하게 잡을 수 있어요')
    .replace(/비유하자면 강한 한 해의 체력은 큰 강물의 물살 같아요\. 빠른 물살을 한 해 내내 그대로 두면 둑이 닳기도 하니, 세 달에 한 번씩 작은 둑을 두어 흐름을 잠시 잡아 두면 다음 계절의 페이스를 더 편하게 잡을 수 있어요\./g, '비유하자면 체력이 좋은 해일수록 속도를 중간중간 확인해야 해요. 세 달에 한 번씩 쉬는 날과 점검 시간을 정해 두면 다음 계절도 무리 없이 이어 가기 쉬워요.')
    .replace(/어린 시절의 인연은 좋아하는 사람을 미리 정하는 그림이 아니라, 가족과 친구 사이에서 마음을 주고받는 법을 차곡차곡 익히는 시간이에요\. 이 시기엔 좋아하는 사람이 생겨도 큰 약속의 모양으로 풀리기보다, 함께 노는 시간 안에서 자기 마음과 상대의 마음을 알아 가는 자연스러운 흐름으로 자라요\./g, '어린 시절의 관계는 가족과 친구 사이에서 마음을 주고받는 법을 배우는 시간이에요. 좋아하는 친구가 생겨도 큰 약속보다 함께 노는 시간 안에서 마음을 알아 가면 충분해요.')
    .replace(/인생 전체의 관계 흐름을 살펴보면, 한 번에 모든 것이 결정되는 그림이 아니라 시기마다 사람과 사람 사이의 거리가 천천히 다듬어지는 모습이에요\. 어떤 때는 새 인연을 만날 가능성이 넓어지고, 또 어떤 때는 곁의 사람과 더 깊어지는 시간이 길어져요\./g, '인생 전체의 관계는 한 번에 결정되기보다 시기마다 조금씩 달라져요. 새 만남이 넓어지는 때도 있고, 곁의 사람과 더 깊어지는 때도 있어요.')
    .replace(/계절이 바뀌는 자리마다/g, '계절이 바뀔 때마다')
    .replace(/함께 보내는 시간을 즐겁게 챙기는 자리가/g, '함께 보내는 시간을 즐겁게 챙기는 일이')
    .replace(/평안하게 흐르는 자리예요/g, '평안하게 이어지는 한 주예요')
    .replace(/매일의 작은 흐름을 따뜻하게 누리는 흐름/g, '매일의 작은 리듬을 따뜻하게 누리는 모습')
    .replace(/익숙한 자리에서의 짧은 산책/g, '익숙한 길을 걷는 짧은 산책')
    .replace(/평생 가꾸어 온 가풍의 흐름이 이미 모여 있는 자리이니/g, '평생 가꾸어 온 가풍이 이미 쌓여 있으니')
    .replace(/정리하고 나누는 자리에서 흐름이 빛을 내요/g, '정리하고 나누는 과정에서 흐름이 빛나요')
    .replace(/흐름이 고른 흐름이라 큰 변화 없이 흘러가는 흐름이에요/g, '기복이 크지 않아 큰 변화 없이 이어지는 모습이에요')
    .replace(/흐름이 고른 흐름이라 큰 기복 없이 흘러가요/g, '기복이 크지 않아 잔잔하게 이어져요')
    .replace(/흐름이 고른 흐름이라 큰 기복 없이 가벼운 하루로 흘러가요/g, '기복이 크지 않아 가볍게 이어지는 하루예요')
    .replace(/흐름실/g, '기억')
    .replace(/어른의 큰 자격 어휘/g, '어른들이 쓰는 어려운 말')
    .replace(/어른들이 쓰는 어려운 말를/g, '어른들이 쓰는 어려운 말을')
    .replace(/평생의 기억로/g, '오래 남는 기억으로')
    .replace(/평생 흐름에서도/g, '긴 시간으로 보아도')
    .replace(/평생 흐름에서/g, '긴 시간으로 보면')
    .replace(/활동량을 받아 낼 힘이 큰 해예요/g, '활동량을 받아 낼 힘이 비교적 넉넉해요')
    .replace(/위로 뻗는 힘이 좋아 활동량을 받아 낼 힘이 비교적 넉넉해요/g, '위로 뻗는 기세가 있어 활동량을 비교적 넉넉하게 받아낼 수 있어요')
    .replace(/정기 점검·정기 휴식 자리를 미리 짜 두는 편이/g, '정기 점검과 휴식 시간을 미리 정해 두는 편이')
    .replace(/정기 점검·정기 휴식 자리를 일정에 미리 넣어 두는 편이/g, '정기 점검과 휴식 시간을 일정에 미리 넣어 두는 편이')
    .replace(/정기 점검·정기 휴식 자리를/g, '정기 점검과 휴식 시간을')
    .replace(/월초·중간·말 세 번 정도 자기 페이스 점검 자리를 만들어 봐도 좋아요/g, '월초, 중간, 말 세 번 정도 자기 페이스를 점검해 봐도 좋아요')
    .replace(/월초·월말 두 번 정도 컨디션 점검 자리를 만들어 봐도 좋아요/g, '월초와 월말 두 번 정도 컨디션을 점검해 봐도 좋아요')
    .replace(/점검 자리 한 번에/g, '점검할 때')
    .replace(/점검 자리를/g, '점검 시간을')
    .replace(/휴식 자리를/g, '휴식 시간을')
    .replace(/푹 쉬는 자리를/g, '푹 쉬는 시간을')
    .replace(/푹 쉬는 자리도/g, '푹 쉬는 시간도')
    .replace(/푹 쉬는 자리가/g, '푹 쉬는 시간이')
    .replace(/쉬어 가는 자리를/g, '쉬어 가는 시간을')
    .replace(/산책 자리를/g, '산책 시간을')
    .replace(/한 달 끝에서/g, '한 달이 끝날 때')
    .replace(/자기 노트를 펼쳐 또래 한 명에게 짧게 보여 주는 자리를 만들어 두세요/g, '자기 노트를 펼쳐 또래 한 명에게 짧게 보여 주는 기회를 만들어 두세요')
    .replace(/자기 글이 다른 시선과 만나는 작은 자리가/g, '자기 글을 다른 사람이 읽어 보는 작은 경험이')
    .replace(/한 달 끝에 자기 컨디션을/g, '한 달이 끝날 때 자기 컨디션을')
    .replace(/친구의 페이스에 자기를 끌려가지 않게/g, '친구의 페이스에 휩쓸리지 않도록')
    .replace(/친구 페이스에 자기를 끌려가지 않기/g, '친구 페이스에 휩쓸리지 않기')
    .replace(/친구의 페이스에 자기를 무리해서 맞추지 않기/g, '친구의 페이스에 무리해서 맞추지 않기')
    .replace(/친구의 페이스에 자기를 맞추지 않기/g, '친구의 페이스에 무리해서 맞추지 않기')
    .replace(/흐트러지는 게 아니라 다듬는 자리를 만들어 가는 시기를 한 번씩 가지면/g, '컨디션이 흐트러졌다고만 보지 말고, 몸을 다듬는 시간을 한 번씩 가지면')
    .replace(/누적된 자리가 후반에 한 번에 와요/g, '누적된 피로가 후반에 한 번에 올 수 있어요')
    .replace(/활동량과 책임 자리가 늘어나기 쉬운 흐름이에요/g, '활동량과 책임이 함께 늘어나기 쉬운 한 달이에요')
    .replace(/한 달이라는 자리에서 자기 페이스를 또렷이 잡아 두면 누적된 자리가 후반에 한 번에 오는 일을 막을 수 있어요/g, '한 달 안에서 자기 페이스를 또렷이 잡아 두면 피로가 후반에 한 번에 몰리는 일을 줄일 수 있어요')
    .replace(/강한 결일수록/g, '체력이 강하게 느껴질수록')
    .replace(/강한 기운일수록/g, '체력이 좋게 느껴질수록')
    .replace(/한 박자 늦추는 자리를 의식적으로 만드는 것이/g, '한 박자 늦춰 쉴 시간을 의식적으로 만드는 것이')
    .replace(/한 박자 늦추는 자리를 의식적으로 만들어 두면/g, '한 박자 늦춰 쉴 시간을 의식적으로 만들어 두면')
    .replace(/한 박자 늦추는 자리를 의식적으로 만들면/g, '한 박자 늦춰 쉴 시간을 의식적으로 만들면')
    .replace(/큰 결정 앞에서는 한 박자 늦추는 자리를 만들면/g, '큰 결정 앞에서는 한 박자 늦춰 생각할 시간을 두면')
    .replace(/한 박자 천천히 가는 자리를 만들어 두면/g, '한 박자 천천히 쉴 시간을 만들어 두면')
    .replace(/주변과 함께 챙기는 (?:결|흐름)을 자연스럽게 받아들이는 (?:사주|흐름)이에요\./g, '주변 사람과 함께 몸과 마음을 챙기면 회복이 더 자연스럽게 이어져요.')
    .replace(/마음 편한 자리에서 회복이 빨라지니/g, '마음 편한 대화와 만남이 회복을 도와 주니')
    .replace(/그런 자리를 자주 만들어 두면 후반까지 가볍게 흘러가요/g, '그런 시간을 자주 두면 후반기에도 컨디션을 가볍게 지키기 쉬워요')
    .replace(/비유하자면 평생의 컨디션은 마당 한쪽 우물물처럼 천천히 차오르는 자리예요\. 한 번에 길어 올리지 않아도 매일 두 손으로 가만히 떠 두는 작은 자리가 평생을 든든하게 받쳐 줘요\./g, '비유하자면 평생의 컨디션은 마당 한쪽 우물처럼 천천히 차오르는 물이에요. 한 번에 많이 길어 올리지 않아도, 매일 조금씩 챙긴 습관이 오래 든든하게 받쳐 줘요.')
    .replace(/호수처럼 잔잔한 자리에서 가까운 친구·가족과 함께하는 짧은 여행이 가장 잘 어울려요\./g, '호수처럼 잔잔한 분위기에서 가까운 친구나 가족과 함께하는 짧은 여행이 가장 잘 어울려요.')
    .replace(/익숙한 자리의 작은 변화도 좋은 자극이 돼요\./g, '익숙한 길에 작은 변화를 주는 것만으로도 좋은 자극이 돼요.')
    .replace(/짧고 잔잔한 (?:결|흐름)의 이동을 권해 드려요\./g, '무리 없는 짧은 이동이 더 잘 맞아요.')
    .replace(/정리하고 나누는 자리가 가장 자연스러운 시기예요\./g, '정리하고 나누는 시간이 가장 자연스럽게 어울리는 시기예요.')
    .replace(/멀리 가지 않아도 가까운 자리에서 풍요로운 풍경을 만나요/g, '멀리 가지 않아도 가까운 곳에서 충분히 풍요로운 풍경을 만날 수 있어요')
    .replace(/올해 이동 (?:결|흐름)은 가까운 여행과 머무름의 흐름이 함께하는 흐름이에요/g, '올해의 이동은 가까운 여행과 편안한 머무름이 함께 어울리는 시기예요')
    .replace(/이 시기 이동 (?:결|흐름)은 여유로운 여행과 머무름의 흐름이 함께하는 흐름이에요/g, '이 시기의 이동은 여유로운 여행과 편안한 머무름이 함께 어울리는 모습이에요')
    .replace(/올해 이동 리듬은 가까운 여행과 머무름의 흐름이 함께하는 흐름이에요/g, '올해의 이동은 가까운 여행과 편안한 머무름이 함께 어울리는 시기예요')
    .replace(/이 시기 이동 리듬은 여유로운 여행과 머무름의 흐름이 함께하는 흐름이에요/g, '이 시기의 이동은 여유로운 여행과 편안한 머무름이 함께 어울리는 모습이에요')
    .replace(/오늘의 이동 결은/g, '오늘의 이동과 변화는')
    .replace(/이번 주 이동 결은/g, '이번 주 이동과 변화는')
    .replace(/이번 달 이동 결은/g, '이번 달 이동과 변화는')
    .replace(/올해 이동 결은/g, '올해의 이동과 변화는')
    .replace(/40·50대 이동 결은/g, '40·50대의 이동과 변화는')
    .replace(/후반기 이동 결은/g, '후반기의 이동과 변화는')
    .replace(/이 시기 이동 결은/g, '이 시기의 이동과 변화는')
    .replace(/평생 이동 흐름이에요/g, '긴 시간에 걸친 이동과 변화예요')
    .replace(/한 해 이동 흐름이에요/g, '한 해 동안의 이동과 변화예요')
    .replace(/강한 타고난 중심 기운이/g, '스스로 정한 기준과 추진력이')
    .replace(/새 환경을 곧장 자기 자리로 만들어 가요/g, '새 환경에서도 자기 페이스를 빠르게 찾아가요')
    .replace(/새 자리에서 추진력이 시원하게 풀리는 흐름이에요/g, '새 환경에서 추진력이 잘 살아나는 모습이에요')
    .replace(/새 자리의 만남에서 의외의 큰 결이 등장하기도 해요/g, '새 환경에서 뜻밖의 만남이나 기회가 생길 수도 있어요')
    .replace(/새로 가 보는 자리에서 의외의 좋은 만남도 생겨요/g, '새로 가 보는 곳에서 뜻밖의 좋은 만남도 생길 수 있어요')
    .replace(/한번 결정하면 빠르게 자리를 잡는 결이 강해서/g, '한번 결정하면 빠르게 적응하는 힘이 있어서')
    .replace(/자기 결을 잃지 않는 한 줄/g, '자기 기준을 지키는 한 줄')
    .replace(/한 주 끝의 결이 단단하게 모여요/g, '한 주 끝의 기준이 단단하게 남아요')
    .replace(/다음 자리의 흐름/g, '다음 일정의 흐름')
    .replace(/다음 자리의 결/g, '다음 선택의 기준')
    .replace(/결이 또렷이 보여요/g, '방향이 또렷이 보여요')
    .replace(/결을 단단하게 해 줘요/g, '기준을 단단하게 해 줘요')
    .replace(/무리하지 않는 결이 가장 잘 어울려요/g, '무리하지 않는 방식이 가장 잘 어울려요')
    .replace(/잔잔한 결로/g, '잔잔한 분위기로')
    .replace(/즐거운 결을 만나요/g, '즐거운 기분을 만날 수 있어요')
    .replace(/짧고 잔잔한 결의 이동/g, '무리 없는 짧은 이동')
    .replace(/30대의 큰 이동은 자기 한 사람만의 자리가 아닌 가까운 사람의 자리도 함께 움직이는 시간이에요\. 자기 페이스만 빠르지 않게 가족·동료의 호흡과 한 박자 맞추는 자리가, 30대의 변화를 자기 자리에서 단단하게 받쳐 줘요\./g, '30대의 큰 이동은 자기 한 사람만이 아니라 가까운 사람의 생활도 함께 움직이는 시간이에요. 자기 페이스만 앞서가지 않게 가족·동료의 호흡과 한 박자 맞추면, 30대의 변화를 더 안정적으로 받쳐 줄 수 있어요.')
    .replace(/흐르는 강물처럼 자리에 닿을 때마다 충분히 익히고 다음 자리로 옮기는 호흡이 잘 맞아요\. 자리를 무리해서 바꾸려 하기보다, 익숙한 자리에서 시야를 넓히는 흐름이 결실에 가까워요\./g, '흐르는 강물처럼 새 환경에 닿을 때마다 충분히 익히고 다음 단계로 옮기는 호흡이 잘 맞아요. 무리하게 바꾸려 하기보다, 익숙한 곳에서 시야를 넓히는 쪽이 결실에 가까워요.')
    .replace(/흐르는 강물처럼 자리에 닿을 때마다 충분히 익히고 다음 자리로 옮기는 호흡이 잘 맞아요\. 무리한 자리 변경 대신 익숙한 자리에서 시야를 넓히는 결이 결실에 가까워요\./g, '흐르는 강물처럼 새 환경에 닿을 때마다 충분히 익히고 다음 단계로 옮기는 호흡이 잘 맞아요. 무리한 변경보다 익숙한 곳에서 시야를 넓히는 쪽이 결실에 가까워요.')
    .replace(/흐르는 강물처럼 자리에 닿을 때마다 충분히 익히고 다음 자리로 옮기는 호흡이 잘 맞아요\. 무리한 자리 변경 대신 익숙한 자리에서 시야를 넓히는 흐름이 결실에 가까워요\./g, '흐르는 강물처럼 새 환경에 닿을 때마다 충분히 익히고 다음 단계로 옮기는 호흡이 잘 맞아요. 무리한 변경보다 익숙한 곳에서 시야를 넓히는 쪽이 결실에 가까워요.')
    .replace(/오늘의 직업 흐름은 첫 자리에서의 작은 결정 하나가 다음 자리의 디딤돌로 이어지는 하루예요\. 큰 자리·큰 인정을 미리 그리기보다, 지금 자리에서 작게라도 인정받는 흔적을 한 번 만들어 두면 자기 색이 펼쳐지는 자리가 단단해져요\./g, '오늘 일과 책임은 첫 결정 하나가 다음 단계의 디딤돌로 이어지는 하루예요. 큰 인정만 미리 그리기보다, 지금 맡은 일에서 작게라도 인정받는 흔적을 남겨 두면 자기 색이 펼쳐질 기반이 단단해져요.')
    .replace(/오늘의 직업운은 첫 자리에서의 작은 결정 하나가 다음 자리의 디딤돌로 이어지는 하루예요\. 큰 자리·큰 인정을 미리 그리기보다, 지금 자리에서 작게라도 인정받는 흔적을 한 번 만들어 두면 자기 색이 펼쳐지는 자리가 단단해져요\./g, '오늘 일과 책임은 첫 결정 하나가 다음 단계의 디딤돌로 이어지는 하루예요. 큰 인정만 미리 그리기보다, 지금 맡은 일에서 작게라도 인정받는 흔적을 남겨 두면 자기 색이 펼쳐질 기반이 단단해져요.')
    .replace(/작은 자문 한 번이 후배의 결정 한 번을 살리는 식이라, 오래 쥐고 있던 노하우를 너무 깊이 넣어 두지 않으면 좋아요\. 큰 자리에서 한 발 물러나는 결정도 또 다른 자리의 시작이 되니, 이별이 아닌 전환으로 받아들이면 마음이 가벼워요\./g, '작은 자문 한 번이 후배의 결정을 돕는 식이라, 오래 쥐고 있던 노하우를 조금씩 나눠 보면 좋아요. 큰 역할에서 한 발 물러나는 결정도 다음 역할의 시작이 될 수 있으니, 끝이 아니라 전환으로 받아들이면 마음이 가벼워요.')
    .replace(/이번 주의 직업운은 첫 자리에서의 작은 시도가 다음 자리의 방향로 이어지는 흐름이에요\. 큰 자리·큰 인정을 미리 그리기보다, 지금 자리에서 작게라도 인정받는 리듬을 한 번 만들어 두면 자기 자리가 단단해져요\./g, '이번 주에는 작은 시도 하나가 다음 방향으로 이어지는 흐름이에요. 큰 인정만 미리 그리기보다, 지금 맡은 일에서 작게라도 인정받는 리듬을 만들어 두면 자기 기반이 단단해져요.')
    .replace(/올해의 직업 자리는 오래 쌓아 온 리듬이 후배의 길잡이가 되는 자리로 자라는 흐름이에요\. 결과를 내는 자리에서 길을 알려 주는 자리로 무게중심이 옮겨 가는 흐름이라, 작은 자문 한 번이 후배의 결정 한 번을 살리는 식이에요\./g, '올해 일의 방향은 오래 쌓은 경험을 필요한 사람에게 나누는 흐름이에요. 결과를 내는 역할에서 기준을 나누는 역할로 무게중심이 옮겨 가니, 작은 자문 한 번도 후배의 결정을 살리는 도움이 될 수 있어요.')
    .replace(/주중 한 자리에서는 평소보다 조금 일찍 잠자리에 들어 보세요\. 십 분 남짓 앞당긴 그 자리가 다음 날 아침의 첫 자리를 가볍게 시작하게 해 주고, 한 주 전체의 호흡을 자연스럽게 정돈해 줘요\./g, '주중 하루는 평소보다 조금 일찍 잠자리에 들어 보세요. 십 분 남짓 앞당긴 시간이 다음 날 아침을 가볍게 시작하게 해 주고, 한 주 전체의 호흡을 자연스럽게 정돈해 줘요.')
    .replace(/한 해 안에 짧은 여행 자리를 두세 번 미리 정해 두세요\. 여행 자리마다 가장 좋았던 한 장면을 한 줄로 적어 두면, 한 해의 끝에서 자기 색이 또렷하게 모이고 다음 해의 자리도 자기 자리에서 자연스레 잡혀 가요\./g, '한 해 안에 짧은 여행을 두세 번 미리 정해 두세요. 여행마다 가장 좋았던 한 장면을 한 줄로 적어 두면, 한 해의 끝에서 자기 색이 또렷하게 모이고 다음 해의 방향도 자연스럽게 잡혀 가요.')
    .replace(/비유하자면 이번 달의 분주함은 빠른 강물 위를 건너는 자리예요\. 빠른 물살에서는 한 발 더 보태기보다 한 발의 자리를 단단히 딛는 것이 자기 자리를 지키니, 큰 결정은 잠잠한 자리에서 다시 한번 살펴 두면 좋아요\./g, '비유하자면 이번 달의 분주함은 빠른 강물 위를 건너는 모습이에요. 빠른 물살에서는 한 발 더 보태기보다 한 걸음을 단단히 딛는 것이 중심을 지켜 주니, 큰 결정은 잠잠해진 뒤 다시 한번 살펴 두면 좋아요.')
    .replace(/방향로/g, '방향으로')
    .replace(/평생 자리에서 보면/g, '길게 보면')
    .replace(/평생 자리에서 펼쳐 보면/g, '시간이 지나 펼쳐 보면')
    .replace(/평생 자리에서 또렷한/g, '오래 지나도 또렷한')
    .replace(/사주에서 /g, '')
    .replace(/사주라/g, '흐름이라')
    .replace(/사주예요/g, '흐름이에요')
    .replace(/사주이니/g, '흐름이니')
    .replace(/사주가/g, '흐름이')
    .replace(/([가-힣]+) 자리에서 보면/g, '$1 단위로 보면')
    .replace(/한 끼 자리에서/g, '한 끼를 나누는 시간에')
    .replace(/작은 한 마디 자리가/g, '작은 한마디가')
    .replace(/가족 자리에 둔 짧은 시간과 친구 자리에 둔 짧은 시간이/g, '가족에게 둔 짧은 시간과 친구에게 둔 짧은 시간이')
    .replace(/자기 자리를 단단히 받쳐 줘요/g, '자기 기반을 단단히 받쳐 줘요')
    .replace(/자기 자리도 자연스레 단단해지는 모습이에요/g, '자기 마음도 자연스레 단단해지는 모습이에요')
    .replace(/새 자리로 옮기는 자체보다 옮기는 호흡/g, '새 환경으로 옮기는 일 자체보다 그 호흡')
    .replace(/익숙한 자리의 한 가지를 함께 챙겨 새 자리로 옮긴/g, '익숙한 것 하나를 함께 챙겨 새 환경으로 옮긴')
    .replace(/새 자리로 향하는/g, '새 환경으로 향하는')
    .replace(/새 자리에서도/g, '새 환경에서도')
    .replace(/새 자리는/g, '새 환경은')
    .replace(/익숙한 자리를 한 단계/g, '익숙한 생활을 한 단계')
    .replace(/흐름이 고른 흐름이라/g, '흐름이 고른 편이라')
    .replace(/익숙한 자리들이 평소처럼 정돈돼요/g, '익숙한 생활 리듬이 평소처럼 정돈돼요')
    .replace(/익숙한 자리들이 평소처럼 흘러가니/g, '익숙한 생활 리듬이 평소처럼 이어지니')
    .replace(/익숙한 자리들이 평소처럼 자리 ?잡으니/g, '익숙한 생활 리듬이 평소처럼 이어지니')
    .replace(/잠 자리를/g, '잠자리를')
    .replace(/관리을/g, '관리를')
    .replace(/관리이/g, '관리가')
    .replace(/관리은/g, '관리는')
    .replace(/관계을/g, '관계를')
    .replace(/관계이/g, '관계가')
    .replace(/창의이/g, '창의가')
    .replace(/관계이/g, '관계가')
    .replace(/사람에서/g, '사람 영역에서')
    .replace(/줍니다\./g, '줘요.')
    .replace(/배우자궁/g, '가까운 관계')
    .replace(/처궁/g, '가까운 관계')
    .replace(/투자로/g, '장기적인 준비로')
    .replace(/투자를/g, '장기적인 준비를')
    .replace(/투자는/g, '장기적인 준비는')
    .replace(/투자/g, '장기적인 준비')
    .replace(/보증을/g, '무거운 약속을')
    .replace(/보증은/g, '무거운 약속은')
    .replace(/보증/g, '무거운 약속')
    .replace(/큰 계약/g, '큰 약속')
    .replace(/짝과 관련한 큰 결정은 한참 뒤의 이야기로 두고/g, '마음이 가는 친구와의 큰 결론은 서두르지 말고')
    .replace(/사주에 가장 필요한 기운이 물\(水\)인 사람의 (?:인연 자리는|관계 흐름은) 큰 사건의 단정보다, 천천히 스며드는 다정함이 모양을 잡는 (?:흐름|리듬)으로 풀려요/g, '관계에서는 큰 사건보다 천천히 쌓이는 다정함이 더 오래 남을 수 있어요')
    .replace(/사주에 가장 필요한 기운이 쇠\(金\)인 사람의 (?:인연 자리는|관계 흐름은) 한 번에 빠르게 만들어지기보다, 잘 다듬은 도구처럼 천천히 형태를 잡는 모양이에요/g, '관계에서는 한 번에 빠르게 가까워지기보다, 서로의 기준을 천천히 맞추며 신뢰를 쌓는 모습이 잘 어울려요')
    .replace(/여성으로 살아가는 인생 전체의 인연운은 우물처럼 깊은 자리에 마음을 두는 시기가 많아요/g, '인생 전체의 관계 흐름은 깊고 차분한 마음을 오래 품는 시기가 많아요')
    .replace(/남성으로 살아가는 인생 전체의 인연 흐름은 가을바람처럼 담백한 결을 가까이 두는 시기가 많아요/g, '인생 전체의 관계 흐름은 담백하고 분명한 태도가 가까운 관계를 편하게 만드는 시기가 많아요')
    .replace(/인연운/g, '관계 흐름')
    .replace(/인연 흐름/g, '관계 흐름')
    .replace(/인연 자리는/g, '관계는')
    .replace(/빠른 답을 강요받는 자리에서는/g, '빠른 답을 요구받는 상황에서는')
    .replace(/빠른 답을 강요받는 상황에서는/g, '빠른 답을 요구받는 상황에서는')
    .replace(/자기 기준가/g, '자기 기준이')
    .replace(/자기 기준를/g, '자기 기준을')
    .replace(/자기 기준을 가꾸는 일이 가장 큰 좋은 관계의 기억이 돼요/g, '자기 기준을 가꾸는 일이 좋은 관계를 오래 지키는 기반이 돼요')
    .replace(/시간이 자연스럽게 자리를 잡아 줘요/g, '시간이 자연스럽게 맞춰 줄 수 있어요')
    .replace(/친구·가족과 어울리는 자리에서 표정이 밝아져요/g, '친구나 가족과 어울리는 시간에 표정이 밝아져요')
    .replace(/아이는 이번 주 한참 노는 흐름 위에 있어요/g, '아이는 이번 주 놀이와 활동에 깊이 빠지기 쉬워요')
    .replace(/시험·발표 같은 자리에 닿아도/g, '시험이나 발표 같은 순간에도')
    .replace(/정해진 식사 자리/g, '정해진 식사 시간')
    .replace(/사람과 사람 사이의 따뜻한 자리/g, '사람 사이의 따뜻한 관계')
    .replace(/30대의 학업 방향은 학교 중심의 공부에서 자기 분야를 키우는 공부로 옮겨 가는 흐름이에요/g, '나중에 자기 분야를 키워 갈 때의 배움은 학교 공부와 생활 속 배움이 조금씩 이어지는 모습이에요')
    .replace(/20대의 학업 방향은 단순히 수업을 듣는 것을 넘어 자기 분야를 고르고 다듬는 시기예요/g, '나중에 성인이 되었을 때의 배움은 수업을 듣는 것에서 더 나아가 자기 관심 분야를 천천히 고르는 과정이에요')
    .replace(/자격증, 실무 공부, 책 한 권을 끝내는 작은 도전/g, '관심 분야 공부, 책 한 권, 작은 프로젝트를 끝내는 도전')
    .replace(/30대 한 해 동안/g, '그 시기 동안')
    .replace(/가족·일과의 균형/g, '생활과 공부의 균형')
    .replace(/용돈을 어디에 썼는지 적어 두는 작은 기록이 평생 갈 자산이 돼요/g, '용돈을 어디에 썼는지 적어 두는 작은 기록이 오래 도움이 되는 돈 습관이 돼요')
    .replace(/월말 한 줄 정리, 작은 적금 한 가지가 평생 갈 자산이 돼요/g, '월말 한 줄 정리와 작은 적금 한 가지가 오래 도움이 되는 돈 습관이 돼요')
    .replace(/주말 한 줄 정리, 작은 적금 한 가지가 평생 갈 자산이 돼요/g, '주말 한 줄 정리와 작은 적금 한 가지가 오래 도움이 되는 돈 습관이 돼요')
    .replace(/큰돈을 다루는 자리가 아니라/g, '큰돈을 다루는 때가 아니라')
    .replace(/무리하지 않는 자리에서/g, '무리하지 않는 상황에서')
    .replace(/한 가지가 자리 잡으면/g, '한 가지가 익숙해지면')
    .replace(/전성기로/g, '중요한 때로')
    .replace(/전성기를/g, '중요한 때를')
    .replace(/전성기는/g, '중요한 때는')
    .replace(/전성기/g, '중요한 때')
    .replace(/잘 맞습니다\./g, '잘 맞아요.')
    .replace(/만듭니다\./g, '만들어요.')
    .replace(/보입니다\./g, '보여요.')
    .replace(/가깝습니다\./g, '가까워요.')
    .replace(/바랍니다\./g, '바라요.')
    .replace(/흘러나옵니다\./g, '흘러나와요.')
    .replace(/따라옵니다\./g, '따라와요.')
    .replace(/남습니다\./g, '남아요.')
    .replace(/적습니다\./g, '적어요.')
    .replace(/찾습니다\./g, '찾아요.')
    .replace(/바뀝니다\./g, '바뀌어요.')
    .replace(/도움이 됩니다\./g, '도움이 돼요.')
    .replace(/안정됩니다\./g, '안정돼요.')
    .replace(/선명해집니다\./g, '선명해져요.')
    .replace(/빨라집니다\./g, '빨라져요.')
    .replace(/살아납니다\./g, '살아나요.')
    .replace(/잡힙니다\./g, '잡혀요.')
    .replace(/바꿉니다\./g, '바꿔요.')
    .replace(/갑니다\./g, '가요.')
    .replace(/납니다\./g, '나요.')
    .replace(/넓어집니다\./g, '넓어져요.')
    .replace(/좋아집니다\./g, '좋아져요.')
    .replace(/가벼워집니다\./g, '가벼워져요.')
    .replace(/단순해집니다\./g, '단순해져요.')
    .replace(/분명해집니다\./g, '분명해져요.')
    .replace(/또렷해집니다\./g, '또렷해져요.')
    .replace(/쉬워집니다\./g, '쉬워져요.')
    .replace(/커집니다\./g, '커져요.')
    .replace(/이어집니다\./g, '이어져요.')
    .replace(/깊어집니다\./g, '깊어져요.')
    .replace(/강해집니다\./g, '강해져요.')
    .replace(/([가-힣]+)해집니다\./g, '$1해져요.')
    .replace(/([가-힣]+)워집니다\./g, '$1워져요.')
    .replace(/어렵습니다\./g, '어려워요.')
    .replace(/괜찮습니다\./g, '괜찮아요.')
    .replace(/쉽습니다\./g, '쉬워요.')
    .replace(/좋습니다\./g, '좋아요.')
    .replace(/중요합니다\./g, '중요해요.')
    .replace(/필요합니다\./g, '필요해요.')
    .replace(/만들어집니다\./g, '만들어져요.')
    .replace(/만들어 줍니다\./g, '만들어 줘요.')
    .replace(/지칩니다\./g, '지쳐요.')
    .replace(/줄어듭니다\./g, '줄어들어요.')
    .replace(/얻습니다\./g, '얻어요.')
    .replace(/이어 줍니다\./g, '이어 줘요.')
    .replace(/자랍니다\./g, '자라요.')
    .replace(/버는 자리와 지키는 자리를 함께 두는 흐름이 긴 시간 동안 자기 자산을 단단하게 만들어 줘요\./g, '버는 힘과 지키는 습관을 함께 보는 태도가 긴 시간 동안 자기 자산을 단단하게 만들어 줘요.')
    .replace(/쌓입니다\./g, '쌓여요.')
    .replace(/생깁니다\./g, '생겨요.')
    .replace(/좋습니다\./g, '좋아요.')
    .replace(/않습니다\./g, '않아요.')
    .replace(/있습니다\./g, '있어요.')
    .replace(/없습니다\./g, '없어요.')
    .replace(/필요합니다\./g, '필요해요.')
    .replace(/효율적입니다\./g, '효율적이에요.')
    .replace(/안정적입니다\./g, '안정적이에요.')
    .replace(/시기입니다\./g, '시기예요.')
    .replace(/힘입니다\./g, '힘이에요.')
    .replace(/([가-힣]+)입니다\./g, (_match, word: string) => `${word}${hasBatchim(word) ? '이에요' : '예요'}.`)
    .replace(/합니다\./g, '해요.')
    .replace(/됩니다\./g, '돼요.');
}

export function sanitizeMinorAudienceText(value: string): string {
  return normalizeRenderedText(value)
    .replace(/가족나/g, '가족이나')
    .replace(/기준가/g, '기준이')
    .replace(/자료은/g, '자료는')
    .replace(/약속를/g, '약속을')
    .replace(/범위을/g, '범위를')
    .replace(/자료이/g, '자료가')
    .replace(/조건, 조건/g, '조건, 확인할 사람')
    .replace(/올해 직업운은/g, '올해 진로 감각은')
    .replace(/올해 직업운이/g, '올해 진로 감각이')
    .replace(/올해 직업운을/g, '올해 진로 감각을')
    .replace(/올해 직업운에서/g, '올해 진로 감각에서')
    .replace(/인생 전체의 직업운/g, '먼 훗날의 일의 방향')
    .replace(/평생의 직업운/g, '먼 훗날의 일의 방향')
    .replace(/직업운/g, '일의 방향')
    .replace(/너무 어려운 어른의 어휘를 미리 들이밀지 않아도 돼요\./g, '어른들이 쓰는 어려운 말로 관계를 미리 부르지 않아도 괜찮아요.')
    .replace(/너무 어려운 어른의 어휘를 들이밀지 않아도 돼요\./g, '어른들이 쓰는 어려운 말로 관계를 부르지 않아도 괜찮아요.')
    .replace(/너무 어려운 어른의 어휘를 들이밀지 않고/g, '어른들이 쓰는 어려운 말을 앞세우지 않고')
    .replace(/나이에 맞는 친구·가족의 자리를 즐기는 것만으로/g, '가까운 친구나 가족과 편하게 웃는 시간만으로')
    .replace(/나이에 맞는 자리를 즐기는 모양으로/g, '가까운 사람들과 편하게 지내는 모양으로')
    .replace(/인연 자산/g, '좋은 관계의 기억')
    .replace(/어른의 직업 단어로 미래를 미리 정해 두지 않아도 괜찮아요\./g, '직업 이름을 미리 정해 두지 않아도 괜찮아요.')
    .replace(/어른의 직업 단어로 아이의 미래를 미리 좁혀 두지 않아도 괜찮아요\./g, '직업 이름으로 아이의 미래를 미리 좁혀 두지 않아도 괜찮아요.')
    .replace(/어른의 직업 단어로 한 해의 자리를 미리 정해 두지 않아도 괜찮아요\./g, '직업 이름으로 한 해의 방향을 미리 정해 두지 않아도 괜찮아요.')
    .replace(/어른의 직업 단어에 너무 빨리 자기를 끼워 맞추지 않아도 괜찮아요\./g, '직업 이름에 너무 빨리 자기를 끼워 맞추지 않아도 괜찮아요.')
    .replace(/어떤 씨앗이 자기 흙에 잘 맞을지/g, '어떤 활동이 자기에게 잘 맞을지')
    .replace(/한 줌은 작아 보여도 한 학기가 지나면 그릇이 묵직해지고, 그 무게가 자기 학습의 뼈대가 되어 줘요\./g, '한 줌은 작아 보여도 한 학기가 지나면 내가 해낸 흔적이 눈에 보여요. 그 흔적이 다음 공부를 시작하는 힘이 돼요.')
    .replace(/연애와/g, '친구 관계와')
    .replace(/연애를/g, '친구 관계를')
    .replace(/연애는/g, '친구 관계는')
    .replace(/연애/g, '친구 관계')
    .replace(/결혼으로/g, '가족 약속으로')
    .replace(/결혼을/g, '가족 약속을')
    .replace(/결혼은/g, '가족 약속은')
    .replace(/결혼/g, '가족 약속')
    .replace(/자녀·손주와/g, '가족과')
    .replace(/자녀와/g, '가족과')
    .replace(/손주와/g, '가족과')
    .replace(/자녀·손주에게/g, '가족에게')
    .replace(/자녀에게/g, '가족에게')
    .replace(/손주에게/g, '가족에게')
    .replace(/자녀·손주/g, '가족')
    .replace(/자녀/g, '가족')
    .replace(/손주/g, '가족')
    .replace(/배우자궁/g, '가까운 관계')
    .replace(/처궁/g, '가까운 관계')
    .replace(/투자로/g, '장기적인 준비로')
    .replace(/투자를/g, '장기적인 준비를')
    .replace(/투자는/g, '장기적인 준비는')
    .replace(/투자/g, '장기적인 준비')
    .replace(/보증을/g, '무거운 약속을')
    .replace(/보증은/g, '무거운 약속은')
    .replace(/보증/g, '무거운 약속')
    .replace(/큰 계약/g, '큰 약속')
    .replace(/짝과 관련한 큰 결정은 한참 뒤의 이야기로 두고/g, '마음이 가는 친구와의 큰 결론은 서두르지 말고')
    .replace(/사주에 가장 필요한 기운이 물\(水\)인 사람의 (?:인연 자리는|관계 흐름은) 큰 사건의 단정보다, 천천히 스며드는 다정함이 모양을 잡는 (?:흐름|리듬)으로 풀려요/g, '관계에서는 큰 사건보다 천천히 쌓이는 다정함이 더 오래 남을 수 있어요')
    .replace(/사주에 가장 필요한 기운이 쇠\(金\)인 사람의 (?:인연 자리는|관계 흐름은) 한 번에 빠르게 만들어지기보다, 잘 다듬은 도구처럼 천천히 형태를 잡는 모양이에요/g, '관계에서는 한 번에 빠르게 가까워지기보다, 서로의 기준을 천천히 맞추며 신뢰를 쌓는 모습이 잘 어울려요')
    .replace(/여성으로 살아가는 인생 전체의 인연운은 우물처럼 깊은 자리에 마음을 두는 시기가 많아요/g, '인생 전체의 관계 흐름은 깊고 차분한 마음을 오래 품는 시기가 많아요')
    .replace(/남성으로 살아가는 인생 전체의 인연 흐름은 가을바람처럼 담백한 결을 가까이 두는 시기가 많아요/g, '인생 전체의 관계 흐름은 담백하고 분명한 태도가 가까운 관계를 편하게 만드는 시기가 많아요')
    .replace(/인연운/g, '관계 흐름')
    .replace(/인연 흐름/g, '관계 흐름')
    .replace(/인연 자리는/g, '관계는')
    .replace(/빠른 답을 강요받는 자리에서는/g, '빠른 답을 요구받는 상황에서는')
    .replace(/빠른 답을 강요받는 상황에서는/g, '빠른 답을 요구받는 상황에서는')
    .replace(/자기 기준가/g, '자기 기준이')
    .replace(/자기 기준를/g, '자기 기준을')
    .replace(/자기 기준을 가꾸는 일이 가장 큰 좋은 관계의 기억이 돼요/g, '자기 기준을 가꾸는 일이 좋은 관계를 오래 지키는 기반이 돼요')
    .replace(/시간이 자연스럽게 자리를 잡아 줘요/g, '시간이 자연스럽게 맞춰 줄 수 있어요')
    .replace(/친구·가족과 어울리는 자리에서 표정이 밝아져요/g, '친구나 가족과 어울리는 시간에 표정이 밝아져요')
    .replace(/아이는 이번 주 한참 노는 흐름 위에 있어요/g, '아이는 이번 주 놀이와 활동에 깊이 빠지기 쉬워요')
    .replace(/시험·발표 같은 자리에 닿아도/g, '시험이나 발표 같은 순간에도')
    .replace(/정해진 식사 자리/g, '정해진 식사 시간')
    .replace(/사람과 사람 사이의 따뜻한 자리/g, '사람 사이의 따뜻한 관계')
    .replace(/30대의 학업 방향은 학교 중심의 공부에서 자기 분야를 키우는 공부로 옮겨 가는 흐름이에요/g, '나중에 자기 분야를 키워 갈 때의 배움은 학교 공부와 생활 속 배움이 조금씩 이어지는 모습이에요')
    .replace(/20대의 학업 방향은 단순히 수업을 듣는 것을 넘어 자기 분야를 고르고 다듬는 시기예요/g, '나중에 성인이 되었을 때의 배움은 수업을 듣는 것에서 더 나아가 자기 관심 분야를 천천히 고르는 과정이에요')
    .replace(/자격증, 실무 공부, 책 한 권을 끝내는 작은 도전/g, '관심 분야 공부, 책 한 권, 작은 프로젝트를 끝내는 도전')
    .replace(/30대 한 해 동안/g, '그 시기 동안')
    .replace(/가족·일과의 균형/g, '생활과 공부의 균형')
    .replace(/흐름실/g, '기억')
    .replace(/어른의 큰 자격 어휘/g, '어른들이 쓰는 어려운 말')
    .replace(/어른들이 쓰는 어려운 말를/g, '어른들이 쓰는 어려운 말을')
    .replace(/평생의 기억로/g, '오래 남는 기억으로')
    .replace(/평생 흐름에서도/g, '긴 시간으로 보아도')
    .replace(/평생 흐름에서/g, '긴 시간으로 보면')
    .replace(/활동량을 받아 낼 힘이 큰 해예요/g, '활동량을 받아 낼 힘이 비교적 넉넉해요')
    .replace(/위로 뻗는 힘이 좋아 활동량을 받아 낼 힘이 비교적 넉넉해요/g, '위로 뻗는 기세가 있어 활동량을 비교적 넉넉하게 받아낼 수 있어요')
    .replace(/정기 점검·정기 휴식 자리를 미리 짜 두는 편이/g, '정기 점검과 휴식 시간을 미리 정해 두는 편이')
    .replace(/정기 점검·정기 휴식 자리를 일정에 미리 넣어 두는 편이/g, '정기 점검과 휴식 시간을 일정에 미리 넣어 두는 편이')
    .replace(/정기 점검·정기 휴식 자리를/g, '정기 점검과 휴식 시간을')
    .replace(/월초·중간·말 세 번 정도 자기 페이스 점검 자리를 만들어 봐도 좋아요/g, '월초, 중간, 말 세 번 정도 자기 페이스를 점검해 봐도 좋아요')
    .replace(/월초·월말 두 번 정도 컨디션 점검 자리를 만들어 봐도 좋아요/g, '월초와 월말 두 번 정도 컨디션을 점검해 봐도 좋아요')
    .replace(/점검 자리 한 번에/g, '점검할 때')
    .replace(/점검 자리를/g, '점검 시간을')
    .replace(/휴식 자리를/g, '휴식 시간을')
    .replace(/푹 쉬는 자리를/g, '푹 쉬는 시간을')
    .replace(/푹 쉬는 자리도/g, '푹 쉬는 시간도')
    .replace(/푹 쉬는 자리가/g, '푹 쉬는 시간이')
    .replace(/쉬어 가는 자리를/g, '쉬어 가는 시간을')
    .replace(/산책 자리를/g, '산책 시간을')
    .replace(/한 달 끝에서/g, '한 달이 끝날 때')
    .replace(/자기 노트를 펼쳐 또래 한 명에게 짧게 보여 주는 자리를 만들어 두세요/g, '자기 노트를 펼쳐 또래 한 명에게 짧게 보여 주는 기회를 만들어 두세요')
    .replace(/자기 글이 다른 시선과 만나는 작은 자리가/g, '자기 글을 다른 사람이 읽어 보는 작은 경험이')
    .replace(/한 달 끝에 자기 컨디션을/g, '한 달이 끝날 때 자기 컨디션을')
    .replace(/친구의 페이스에 자기를 끌려가지 않게/g, '친구의 페이스에 휩쓸리지 않도록')
    .replace(/친구 페이스에 자기를 끌려가지 않기/g, '친구 페이스에 휩쓸리지 않기')
    .replace(/친구의 페이스에 자기를 무리해서 맞추지 않기/g, '친구의 페이스에 무리해서 맞추지 않기')
    .replace(/친구의 페이스에 자기를 맞추지 않기/g, '친구의 페이스에 무리해서 맞추지 않기')
    .replace(/흐트러지는 게 아니라 다듬는 자리를 만들어 가는 시기를 한 번씩 가지면/g, '컨디션이 흐트러졌다고만 보지 말고, 몸을 다듬는 시간을 한 번씩 가지면')
    .replace(/누적된 자리가 후반에 한 번에 와요/g, '누적된 피로가 후반에 한 번에 올 수 있어요')
    .replace(/활동량과 책임 자리가 늘어나기 쉬운 흐름이에요/g, '활동량과 책임이 함께 늘어나기 쉬운 한 달이에요')
    .replace(/한 달이라는 자리에서 자기 페이스를 또렷이 잡아 두면 누적된 자리가 후반에 한 번에 오는 일을 막을 수 있어요/g, '한 달 안에서 자기 페이스를 또렷이 잡아 두면 피로가 후반에 한 번에 몰리는 일을 줄일 수 있어요')
    .replace(/강한 결일수록/g, '체력이 강하게 느껴질수록')
    .replace(/강한 기운일수록/g, '체력이 좋게 느껴질수록')
    .replace(/한 박자 늦추는 자리를 의식적으로 만드는 것이/g, '한 박자 늦춰 쉴 시간을 의식적으로 만드는 것이')
    .replace(/한 박자 늦추는 자리를 의식적으로 만들어 두면/g, '한 박자 늦춰 쉴 시간을 의식적으로 만들어 두면')
    .replace(/한 박자 늦추는 자리를 의식적으로 만들면/g, '한 박자 늦춰 쉴 시간을 의식적으로 만들면')
    .replace(/큰 결정 앞에서는 한 박자 늦추는 자리를 만들면/g, '큰 결정 앞에서는 한 박자 늦춰 생각할 시간을 두면')
    .replace(/한 박자 천천히 가는 자리를 만들어 두면/g, '한 박자 천천히 쉴 시간을 만들어 두면')
    .replace(/주변과 함께 챙기는 (?:결|흐름)을 자연스럽게 받아들이는 (?:사주|흐름)이에요\./g, '주변 사람과 함께 몸과 마음을 챙기면 회복이 더 자연스럽게 이어져요.')
    .replace(/마음 편한 자리에서 회복이 빨라지니/g, '마음 편한 대화와 만남이 회복을 도와 주니')
    .replace(/그런 자리를 자주 만들어 두면 후반까지 가볍게 흘러가요/g, '그런 시간을 자주 두면 후반기에도 컨디션을 가볍게 지키기 쉬워요')
    .replace(/비유하자면 평생의 컨디션은 마당 한쪽 우물물처럼 천천히 차오르는 자리예요\. 한 번에 길어 올리지 않아도 매일 두 손으로 가만히 떠 두는 작은 자리가 평생을 든든하게 받쳐 줘요\./g, '비유하자면 평생의 컨디션은 마당 한쪽 우물처럼 천천히 차오르는 물이에요. 한 번에 많이 길어 올리지 않아도, 매일 조금씩 챙긴 습관이 오래 든든하게 받쳐 줘요.')
    .replace(/호수처럼 잔잔한 자리에서 가까운 친구·가족과 함께하는 짧은 여행이 가장 잘 어울려요\./g, '호수처럼 잔잔한 분위기에서 가까운 친구나 가족과 함께하는 짧은 여행이 가장 잘 어울려요.')
    .replace(/익숙한 자리의 작은 변화도 좋은 자극이 돼요\./g, '익숙한 길에 작은 변화를 주는 것만으로도 좋은 자극이 돼요.')
    .replace(/짧고 잔잔한 (?:결|흐름)의 이동을 권해 드려요\./g, '무리 없는 짧은 이동이 더 잘 맞아요.')
    .replace(/정리하고 나누는 자리가 가장 자연스러운 시기예요\./g, '정리하고 나누는 시간이 가장 자연스럽게 어울리는 시기예요.')
    .replace(/멀리 가지 않아도 가까운 자리에서 풍요로운 풍경을 만나요/g, '멀리 가지 않아도 가까운 곳에서 충분히 풍요로운 풍경을 만날 수 있어요')
    .replace(/올해 이동 (?:결|흐름)은 가까운 여행과 머무름의 흐름이 함께하는 흐름이에요/g, '올해의 이동은 가까운 여행과 편안한 머무름이 함께 어울리는 시기예요')
    .replace(/이 시기 이동 (?:결|흐름)은 여유로운 여행과 머무름의 흐름이 함께하는 흐름이에요/g, '이 시기의 이동은 여유로운 여행과 편안한 머무름이 함께 어울리는 모습이에요')
    .replace(/올해 이동 리듬은 가까운 여행과 머무름의 흐름이 함께하는 흐름이에요/g, '올해의 이동은 가까운 여행과 편안한 머무름이 함께 어울리는 시기예요')
    .replace(/이 시기 이동 리듬은 여유로운 여행과 머무름의 흐름이 함께하는 흐름이에요/g, '이 시기의 이동은 여유로운 여행과 편안한 머무름이 함께 어울리는 모습이에요')
    .replace(/오늘의 이동 결은/g, '오늘의 이동과 변화는')
    .replace(/이번 주 이동 결은/g, '이번 주 이동과 변화는')
    .replace(/이번 달 이동 결은/g, '이번 달 이동과 변화는')
    .replace(/올해 이동 결은/g, '올해의 이동과 변화는')
    .replace(/40·50대 이동 결은/g, '40·50대의 이동과 변화는')
    .replace(/후반기 이동 결은/g, '후반기의 이동과 변화는')
    .replace(/이 시기 이동 결은/g, '이 시기의 이동과 변화는')
    .replace(/평생 이동 흐름이에요/g, '긴 시간에 걸친 이동과 변화예요')
    .replace(/한 해 이동 흐름이에요/g, '한 해 동안의 이동과 변화예요')
    .replace(/강한 타고난 중심 기운이/g, '스스로 정한 기준과 추진력이')
    .replace(/새 환경을 곧장 자기 자리로 만들어 가요/g, '새 환경에서도 자기 페이스를 빠르게 찾아가요')
    .replace(/새 자리에서 추진력이 시원하게 풀리는 흐름이에요/g, '새 환경에서 추진력이 잘 살아나는 모습이에요')
    .replace(/새 자리의 만남에서 의외의 큰 결이 등장하기도 해요/g, '새 환경에서 뜻밖의 만남이나 기회가 생길 수도 있어요')
    .replace(/새로 가 보는 자리에서 의외의 좋은 만남도 생겨요/g, '새로 가 보는 곳에서 뜻밖의 좋은 만남도 생길 수 있어요')
    .replace(/한번 결정하면 빠르게 자리를 잡는 결이 강해서/g, '한번 결정하면 빠르게 적응하는 힘이 있어서')
    .replace(/자기 결을 잃지 않는 한 줄/g, '자기 기준을 지키는 한 줄')
    .replace(/한 주 끝의 결이 단단하게 모여요/g, '한 주 끝의 기준이 단단하게 남아요')
    .replace(/다음 자리의 흐름/g, '다음 일정의 흐름')
    .replace(/다음 자리의 결/g, '다음 선택의 기준')
    .replace(/결이 또렷이 보여요/g, '방향이 또렷이 보여요')
    .replace(/결을 단단하게 해 줘요/g, '기준을 단단하게 해 줘요')
    .replace(/무리하지 않는 결이 가장 잘 어울려요/g, '무리하지 않는 방식이 가장 잘 어울려요')
    .replace(/잔잔한 결로/g, '잔잔한 분위기로')
    .replace(/즐거운 결을 만나요/g, '즐거운 기분을 만날 수 있어요')
    .replace(/짧고 잔잔한 결의 이동/g, '무리 없는 짧은 이동')
    .replace(/용돈을 어디에 썼는지 적어 두는 작은 기록이 평생 갈 자산이 돼요/g, '용돈을 어디에 썼는지 적어 두는 작은 기록이 오래 도움이 되는 돈 습관이 돼요')
    .replace(/월말 한 줄 정리, 작은 적금 한 가지가 평생 갈 자산이 돼요/g, '월말 한 줄 정리와 작은 적금 한 가지가 오래 도움이 되는 돈 습관이 돼요')
    .replace(/주말 한 줄 정리, 작은 적금 한 가지가 평생 갈 자산이 돼요/g, '주말 한 줄 정리와 작은 적금 한 가지가 오래 도움이 되는 돈 습관이 돼요')
    .replace(/큰돈을 다루는 자리가 아니라/g, '큰돈을 다루는 때가 아니라')
    .replace(/무리하지 않는 자리에서/g, '무리하지 않는 상황에서')
    .replace(/한 가지가 자리 잡으면/g, '한 가지가 익숙해지면')
    .replace(/전성기로/g, '중요한 때로')
    .replace(/전성기를/g, '중요한 때를')
    .replace(/전성기는/g, '중요한 때는')
    .replace(/전성기/g, '중요한 때');
}

function sentenceCount(value: string): number {
  const punctuation = value.match(/[.!?]/g)?.length ?? 0;
  if (punctuation > 0) return punctuation;
  return value.trim().length > 0 ? 1 : 0;
}

function splitPublicSentences(value: string): string[] {
  return normalizeRenderedText(value)
    .replace(/가족나/g, '가족이나')
    .replace(/기준가/g, '기준이')
    .replace(/자료은/g, '자료는')
    .replace(/약속를/g, '약속을')
    .replace(/범위을/g, '범위를')
    .replace(/자료이/g, '자료가')
    .replace(/조건, 조건/g, '조건, 확인할 사람')
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0) ?? [];
}

function publicSentenceBucket(sentence: string): string | null {
  if (/(먼저 끝낼 일|나중에 볼 일|기다려도 되는 일|급한 일|확인할 일|바로 처리할 것)/.test(sentence) && /(실수가 줄어요|마음이 훨씬 가벼워져요|순서)/.test(sentence)) {
    return 'career-order';
  }
  if (/(한 단원|한 문제|한 문단|작은 범위|끝낼 범위|작게 쪼개|작게 나누|오늘 확인할 표시)/.test(sentence) && /(공부|집중|부담|시작|가벼워져요|쉬워져요)/.test(sentence)) {
    return 'academic-small-scope';
  }
  if (/(모르는 부분|잘 안 되는 부분)/.test(sentence) && /(표시|확인표)/.test(sentence)) {
    return 'academic-check-marker';
  }
  if (/흐름이 보통/.test(sentence) && /(관리할 여지|좋은 쪽과 아쉬운 쪽|반복되는 장면|속도를 조절)/.test(sentence)) {
    return 'score-normal-flow';
  }
  return null;
}

const PUBLIC_SENTENCE_STOPWORDS = new Set([
  '그리고', '하지만', '그래서', '오늘', '이번', '올해', '인생', '전체', '영역에서',
  '흐름이', '보이면', '보일', '때는', '좋아요', '충분해요', '있어요', '것을',
  '것이', '같아요', '먼저', '하나', '작게', '지금', '다음', '해석이', '생활에',
]);

function sentenceKeywordSet(sentence: string): Set<string> {
  const tokens = sentence
    .replace(/[^0-9A-Za-z가-힣]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !PUBLIC_SENTENCE_STOPWORDS.has(token));
  return new Set(tokens);
}

function areSimilarPublicSentences(a: string, b: string): boolean {
  const aBucket = publicSentenceBucket(a);
  const bBucket = publicSentenceBucket(b);
  if (aBucket !== null && aBucket === bBucket) return true;

  const aKeywords = sentenceKeywordSet(a);
  const bKeywords = sentenceKeywordSet(b);
  const smaller = Math.min(aKeywords.size, bKeywords.size);
  const larger = Math.max(aKeywords.size, bKeywords.size);
  if (smaller < 4) return false;

  let overlap = 0;
  for (const keyword of aKeywords) {
    if (bKeywords.has(keyword)) overlap += 1;
  }
  return overlap / smaller >= 0.78 && overlap / larger >= 0.58;
}

function dedupeAudienceSentences(value: string): string {
  const sentences = splitPublicSentences(value);
  if (sentences.length < 2) return normalizeRenderedText(value)
    .replace(/가족나/g, '가족이나')
    .replace(/기준가/g, '기준이')
    .replace(/자료은/g, '자료는')
    .replace(/약속를/g, '약속을')
    .replace(/범위을/g, '범위를')
    .replace(/자료이/g, '자료가')
    .replace(/조건, 조건/g, '조건, 확인할 사람');

  const seenBuckets = new Set<string>();
  const kept: string[] = [];
  for (const sentence of sentences) {
    const bucket = publicSentenceBucket(sentence);
    if (bucket !== null && seenBuckets.has(bucket)) continue;
    if (kept.some((existing) => areSimilarPublicSentences(existing, sentence))) continue;
    if (bucket !== null) seenBuckets.add(bucket);
    kept.push(sentence);
  }
  return normalizeRenderedText(kept.join(' '));
}

function compactPublicText(value: string): string {
  return normalizeRenderedText(value)
    .replace(/가족나/g, '가족이나')
    .replace(/기준가/g, '기준이')
    .replace(/자료은/g, '자료는')
    .replace(/약속를/g, '약속을')
    .replace(/범위을/g, '범위를')
    .replace(/자료이/g, '자료가')
    .replace(/조건, 조건/g, '조건, 확인할 사람')
    .replace(/[^0-9A-Za-z가-힣]+/g, '');
}

function significantPublicSentences(value: string): string[] {
  return splitPublicSentences(value)
    .filter((sentence) => compactPublicText(sentence).length >= 18);
}

function isParagraphCoveredByEarlier(candidate: string, earlier: string): boolean {
  const compactCandidate = compactPublicText(candidate);
  if (compactCandidate.length < 42) return false;

  const compactEarlier = compactPublicText(earlier);
  if (compactEarlier.includes(compactCandidate)) return true;

  const candidateSentences = significantPublicSentences(candidate);
  if (candidateSentences.length < 2) return false;
  const earlierSentences = significantPublicSentences(earlier);
  if (earlierSentences.length === 0) return false;

  return candidateSentences.every((candidateSentence) =>
    earlierSentences.some((earlierSentence) => {
      const compactCandidateSentence = compactPublicText(candidateSentence);
      const compactEarlierSentence = compactPublicText(earlierSentence);
      return compactCandidateSentence === compactEarlierSentence ||
        compactEarlierSentence.includes(compactCandidateSentence) ||
        areSimilarPublicSentences(candidateSentence, earlierSentence);
    }),
  );
}

function plainTextFromTokens(tokens: readonly ParagraphToken[]): string {
  return tokens.map((token) => token.kind === 'text' ? token.value : `#${token.label}`).join('');
}

function retoneParagraph(paragraph: TaggedParagraph, ctx: StandardDepthEnhancementContext): TaggedParagraph {
  const tokens = paragraph.tokens.map((token): ParagraphToken => {
    if (token.kind !== 'text') return token;
    return { ...token, value: contextualPublicTone(token.value, ctx) };
  });
  return {
    tokens,
    plainText: contextualPublicTone(plainTextFromTokens(tokens), ctx),
  };
}

function appendSentence(paragraph: TaggedParagraph, sentence: string): TaggedParagraph {
  const addition = softenPublicTone(sentence).trim();
  if (!addition) return paragraph;

  const tokens = [...paragraph.tokens];
  const lastTextIndex = (() => {
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      if (tokens[i]?.kind === 'text') return i;
    }
    return -1;
  })();
  const spacer = paragraph.plainText.trim().length > 0 ? ' ' : '';

  if (lastTextIndex >= 0) {
    const current = tokens[lastTextIndex] as Extract<ParagraphToken, { kind: 'text' }>;
    tokens[lastTextIndex] = {
      ...current,
      value: softenPublicTone(`${current.value}${spacer}${addition}`),
    };
  } else {
    tokens.push({ kind: 'text', value: addition });
  }

  const plainText = softenPublicTone(`${paragraph.plainText}${spacer}${addition}`);
  return { tokens, plainText };
}

function textParagraph(value: string): TaggedParagraph {
  const text = softenPublicTone(value).trim();
  return {
    tokens: [{ kind: 'text', value: text }],
    plainText: text,
  };
}

function hasParagraphMatching(paragraphs: readonly TaggedParagraph[], pattern: RegExp): boolean {
  return paragraphs.some((paragraph) => {
    pattern.lastIndex = 0;
    return pattern.test(paragraph.plainText);
  });
}

function conflictsWithExistingGuidanceRole(
  candidate: string,
  existingParagraphs: readonly TaggedParagraph[],
): boolean {
  const rolePatterns = [SCORE_PACING_PATTERN, PERIOD_SCOPE_PATTERN, SELF_CHECK_PATTERN] as const;
  return rolePatterns.some((pattern) => {
    pattern.lastIndex = 0;
    const candidateMatchesRole = pattern.test(candidate);
    pattern.lastIndex = 0;
    return candidateMatchesRole && hasParagraphMatching(existingParagraphs, pattern);
  });
}

function ensureGuidanceParagraph(
  paragraphs: TaggedParagraph[],
  pattern: RegExp,
  sentence: string,
): void {
  if (hasParagraphMatching(paragraphs, pattern)) return;
  paragraphs.push(textParagraph(sentence));
}

function guidancePatternForEnricher(index: number): RegExp | undefined {
  switch (index) {
    case 1:
      return SCORE_PACING_PATTERN;
    case 2:
      return PERIOD_SCOPE_PATTERN;
    case 3:
      return CATEGORY_GUIDANCE_PATTERN;
    case 4:
      return SELF_CHECK_PATTERN;
    default:
      return undefined;
  }
}

function shortParagraphContinuation(
  ctx: StandardDepthEnhancementContext,
  existingParagraphs?: readonly TaggedParagraph[],
): string {
  const scope = periodCategoryPhrase(ctx);
  if (ctx.period === 'life') {
    const lifeLongHorizonShort = [
      `${withTopicParticle(scope)} 한 번에 전부 적용하는 답이 아니에요. 오늘 생활에 맞는 한 가지와 시간이 지나 다시 확인할 한 가지를 나누면 읽기가 편해져요.`,
      `${scope}에서는 오래 가져갈 기준 하나만 남겨도 충분해요. 당장 바꾸기보다 반복해서 도움이 될 장면을 기억해 두세요.`,
      `${withObjectParticle(scope)} 큰 결론으로 묶기보다 여러 시기에 다시 확인할 기준으로 두면 좋아요. 부담되는 말은 접어 두고 편한 기준부터 남겨 보세요.`,
      `${scope}에서는 현재 생활에 맞는 기준과 먼 훗날 다시 볼 기준을 구분해 보세요. 둘을 나누면 긴 해석도 덜 무겁게 남아요.`,
      `${withTopicParticle(scope)} 지금의 모습만으로 단정하지 않는 편이 좋아요. 시간이 지나며 달라질 수 있는 부분은 표시만 해 두어도 충분해요.`,
      `${scope}에서는 새 결론보다 오래 반복할 수 있는 기준이 더 중요할 수 있어요. 내 생활에 맞는 한 문장만 남기면 다음에 다시 읽기도 쉬워져요.`,
      `${withObjectParticle(scope)} 지금 당장 해결할 숙제처럼 읽지 않아도 괜찮아요. 오래 가져갈 기준과 지금 편한 기준을 나누면 부담이 줄어요.`,
      `${scope}에서는 마음이 편해지는 기준 하나와 천천히 살필 기준 하나를 따로 남겨 보세요. 긴 흐름은 이렇게 나누어 읽을 때 더 현실적으로 다가와요.`,
      `${withTopicParticle(scope)} 한 번 읽고 끝낼 답보다 시간이 지나며 다시 확인할 기준에 가까워요. 지금 필요한 기준과 나중에 볼 기준을 나누면 훨씬 편해요.`,
      `${scope}에서는 크게 맞고 틀리는 결론보다 반복해서 도움이 되는 작은 기준을 찾는 편이 좋아요. 편한 문장 하나만 남겨도 읽은 값이 충분히 생겨요.`,
    ] as const;
    const start = stableVariantIndex(ctx, 'short', lifeLongHorizonShort.length);
    if (!existingParagraphs) return lifeLongHorizonShort[start] ?? lifeLongHorizonShort[0] ?? '';
    for (let offset = 0; offset < lifeLongHorizonShort.length; offset += 1) {
      const candidate = lifeLongHorizonShort[(start + offset) % lifeLongHorizonShort.length] ?? lifeLongHorizonShort[0] ?? '';
      const alreadyUsed = existingParagraphs.some((paragraph) => normalizeRenderedText(paragraph.plainText).includes(candidate));
      if (!alreadyUsed && !conflictsWithExistingGuidanceRole(candidate, existingParagraphs)) {
        return candidate;
      }
    }
    return '마음에 남은 부분을 작게 표시해 두면 다음에 다시 읽을 때 훨씬 편해요. 한 번에 전부 정리하지 않아도 괜찮아요.';
  }
  if (ctx.category === 'study_document' && isMinorReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)) {
    const minorStudyDocumentShort = [
      '안내장과 숙제는 한곳에 몰아두기보다 자주 꺼내는 위치를 정하면 좋아요. 다시 물어볼 질문 표시를 붙이면 아이가 다음에 덜 헤매요.',
      '노트와 안내장은 많이 쌓는 것보다 다시 찾기 쉬운 이름을 붙이는 일이 더 중요해요. 아이가 스스로 찾을 수 있으면 준비 부담도 줄어요.',
      '질문 표시는 틀렸다는 뜻이 아니라 다음에 확인할 길을 남기는 일이에요. 작은 단서 하나가 선생님이나 보호자에게 물어볼 말을 쉽게 만들어 줘요.',
      '보호자나 선생님과 함께 볼 자료는 따로 표시해 두면 좋아요. 혼자 볼 것과 함께 볼 것이 나뉘면 아이도 정리를 덜 무겁게 느껴요.',
      '가방, 책상, 파일철 중 어디에 둘지 하나만 정해도 기록은 훨씬 쉬워져요. 자리가 정해지면 안내장과 숙제를 다시 찾는 시간이 줄어요.',
    ] as const;
    const start = stableVariantIndex(ctx, 'short', minorStudyDocumentShort.length);
    if (!existingParagraphs) return minorStudyDocumentShort[start] ?? minorStudyDocumentShort[0] ?? '';
    for (let offset = 0; offset < minorStudyDocumentShort.length; offset += 1) {
      const candidate = minorStudyDocumentShort[(start + offset) % minorStudyDocumentShort.length] ?? minorStudyDocumentShort[0] ?? '';
      const alreadyUsed = existingParagraphs.some((paragraph) => normalizeRenderedText(paragraph.plainText).includes(candidate));
      if (!alreadyUsed && !conflictsWithExistingGuidanceRole(candidate, existingParagraphs)) {
        return candidate;
      }
    }
    return '안내장이나 숙제에서 다시 볼 단서 하나를 남겨 보세요. 작은 표시가 다음 확인을 더 쉽게 만들어 줘요.';
  }
  if (ctx.category === 'study_document') {
    const adultStudyDocumentShort = [
      '보관할 자료와 제출할 자료를 다른 칸으로 나누어 보세요. 다시 볼 날짜까지 적어 두면 다음 확인이 훨씬 쉬워져요.',
      '문서는 빨리 끝내는 것보다 다시 찾는 길이 보여야 좋아요. 파일 이름, 보관 위치, 마감일 중 하나만 또렷해도 부담이 줄어요.',
      '계약이나 증빙처럼 중요한 자료는 원본과 확인본을 구분해 두면 좋아요. 어디에 있는지 알면 급한 순간에도 덜 흔들려요.',
      '제출할 자료는 마감일을 먼저 보고, 보관할 자료는 다시 찾을 이름을 붙여 보세요. 두 기준이 나뉘면 정리가 훨씬 가벼워져요.',
      '나중에 찾을 사람을 떠올리며 제목을 붙이면 좋아요. 내가 다시 봐도 알아볼 수 있어야 좋은 정리예요.',
    ] as const;
    const start = stableVariantIndex(ctx, 'short', adultStudyDocumentShort.length);
    if (!existingParagraphs) return adultStudyDocumentShort[start] ?? adultStudyDocumentShort[0] ?? '';
    for (let offset = 0; offset < adultStudyDocumentShort.length; offset += 1) {
      const candidate = adultStudyDocumentShort[(start + offset) % adultStudyDocumentShort.length] ?? adultStudyDocumentShort[0] ?? '';
      const alreadyUsed = existingParagraphs.some((paragraph) => normalizeRenderedText(paragraph.plainText).includes(candidate));
      if (!alreadyUsed && !conflictsWithExistingGuidanceRole(candidate, existingParagraphs)) {
        return candidate;
      }
    }
    return '보관할 자료와 제출할 자료를 나누어 보세요. 어디에 있고 언제 다시 볼지만 정해도 다음 확인이 쉬워져요.';
  }
  const variants = [
    `${withTopicParticle(scope)} 작은 단서부터 실제 상황에 맞게 확인하면 더 편하게 읽을 수 있어요. 바로 할 수 있는 행동 하나를 고르면 부담도 줄어들어요.`,
    `${scope}에서는 바로 떠오르는 장면 하나를 골라 보는 게 좋아요. 그 장면에 맞는 행동 하나를 정하면 해석이 생활과 더 자연스럽게 이어져요.`,
    `${withObjectParticle(scope)} 한 번에 전부 해결하려고 하지 않아도 괜찮아요. 먼저 확인할 작은 행동을 정하면 마음이 훨씬 가벼워질 수 있어요.`,
    `읽고 난 뒤에는 ${scope}에서 바꿀 것과 그대로 둘 것을 나누어 보세요. 지금 바로 쓸 기준 하나만 남겨도 충분해요.`,
    `${withTopicParticle(scope)} 크게 단정하기보다 지금 맞는 부분부터 골라 읽으면 좋아요. 작게 해볼 수 있는 선택 하나가 다음 흐름을 더 분명하게 해 줘요.`,
    `읽고 난 뒤에는 ${scope}에서 다시 볼 기준 하나와 오늘 넘길 부분 하나를 나누어 보세요. 구분이 생기면 조언이 덜 무겁게 남아요.`,
    `${withObjectParticle(scope)} 어렵게 받아들이기보다 생활 점검표처럼 써 보세요. 먼저 줄일 부담 하나를 찾으면 읽은 내용이 더 쓸모 있어져요.`,
    `${scope}에서는 마음에 남은 조언을 그대로 믿기보다 내 생활에 맞게 줄여 보는 편이 좋아요. 오늘 확인할 기준 하나만 고르면 충분해요.`,
    `${withTopicParticle(scope)} 한 번 읽고 끝내는 답이 아니라 다시 확인할 기준으로 두면 좋아요. 지금 맞는 기준과 나중에 볼 기준을 나누면 부담이 줄어요.`,
    `${scope}에서는 먼저 덜어낼 걱정 하나와 그대로 지켜도 되는 습관 하나를 고르세요. 둘이 보이면 해석이 훨씬 현실적인 안내가 돼요.`,
    `${withObjectParticle(scope)} 너무 크게 해석하지 말고 가까운 일정 하나에서 확인해 보세요. 실제 장면이 정해지면 조언도 더 쉽게 이해돼요.`,
    `${scope}에서는 좋은 말보다 바로 확인할 수 있는 기준을 먼저 남기는 편이 좋아요. 생활 속 행동으로 바뀌는 문장 하나가 가장 오래 도움이 돼요.`,
    `${withTopicParticle(scope)} 지금의 나를 몰아붙이기 위한 답이 아니에요. 쉬어 갈 부분과 시도할 부분을 나누면 더 편하게 읽을 수 있어요.`,
    `${scope}에서는 다음에 다시 읽을 때 확인할 표시를 하나 남겨 보세요. 오늘 다 이해하지 않아도 표시가 있으면 흐름을 이어 가기 쉬워요.`,
    `${withObjectParticle(scope)} 큰 결론으로 묶기보다 작은 선택으로 나누어 보세요. 바꿀 수 있는 크기가 보이면 마음도 덜 무거워져요.`,
    `${scope}에서는 새로운 결론보다 반복할 기준 하나가 더 중요할 수 있어요. 다음에 다시 확인할 표시를 남기면 흐름을 따라가기 쉬워요.`,
    `${scope}에서는 지금 바로 달라질 부분과 조금 더 지켜볼 부분을 나누어 보세요. 둘을 나누면 조언이 더 현실적으로 남아요.`,
    `${withTopicParticle(scope)} 한 번 읽고 끝낼 답보다 생활에서 다시 확인할 기준에 가까워요. 오늘 써 볼 한 가지와 나중에 볼 한 가지를 나누면 좋아요.`,
    `${withObjectParticle(scope)} 가까운 약속이나 일정 하나에 붙여 보세요. 실제 장면이 정해지면 막연한 말도 훨씬 쉽게 이해돼요.`,
    `${scope}에서는 먼저 줄일 부담 하나를 고르고, 남길 습관 하나를 따로 적어 보세요. 두 가지만 보여도 다음 행동이 선명해져요.`,
    `${withTopicParticle(scope)} 잘 맞는 말과 아직 애매한 말을 나누어 두면 읽는 부담이 줄어요. 애매한 말은 버리지 말고 다음 점검 때 다시 보면 돼요.`,
    `${scope}에서는 결과를 맞히려 하기보다 내 생활에 붙는 문장 하나를 찾으면 좋아요. 그 한 문장이 다음 선택의 기준이 될 수 있어요.`,
    `${withObjectParticle(scope)} 오늘 바로 바꿀 필요는 없어요. 마음이 가벼워지는 순서대로 작은 선택 하나만 먼저 정해 보세요.`,
    `${scope}에서는 조언을 많이 모으기보다 실행할 순서를 줄이는 편이 도움이 돼요. 가장 쉬운 한 가지가 보이면 충분히 시작할 수 있어요.`,
    `${withTopicParticle(scope)} 처음 읽고 마음에 남은 한 문장을 표시해 두는 것만으로도 충분해요. 그 문장을 생활에 맞게 줄이면 다음 선택이 더 쉬워져요.`,
  ] as const;
  const start = stableVariantIndex(ctx, 'short', variants.length);
  if (!existingParagraphs) return variants[start] ?? variants[0] ?? '';
  for (let offset = 0; offset < variants.length; offset += 1) {
    const candidate = variants[(start + offset) % variants.length] ?? variants[0] ?? '';
    const alreadyUsed = existingParagraphs.some((paragraph) => normalizeRenderedText(paragraph.plainText).includes(candidate));
    if (!alreadyUsed && !conflictsWithExistingGuidanceRole(candidate, existingParagraphs)) {
      return candidate;
    }
  }
  return '마음에 남은 부분을 작게 표시해 두면 다음에 다시 읽을 때 훨씬 편해요. 오늘 전부 정리하지 않아도 괜찮아요.';
}

function dedupeRepeatedGuidance(paragraphs: readonly TaggedParagraph[]): TaggedParagraph[] {
  const seenRoles = new Set<string>();
  const seenParagraphs = new Set<string>();
  const out: TaggedParagraph[] = [];
  for (const paragraph of paragraphs) {
    const normalized = normalizeRenderedText(paragraph.plainText);
    if (normalized && seenParagraphs.has(normalized)) continue;
    if (out.some((existing) => isParagraphCoveredByEarlier(paragraph.plainText, existing.plainText))) continue;

    const matchedRoles = [
      SCORE_PACING_PATTERN.test(paragraph.plainText) ? 'score' : null,
      PERIOD_SCOPE_PATTERN.test(paragraph.plainText) ? 'period' : null,
      SELF_CHECK_PATTERN.test(paragraph.plainText) ? 'self' : null,
    ].filter((role): role is string => role !== null);
    if (matchedRoles.some((role) => seenRoles.has(role))) continue;
    for (const role of matchedRoles) seenRoles.add(role);
    if (normalized) seenParagraphs.add(normalized);
    out.push(paragraph);
  }
  return out;
}

function refillPublicParagraphFloor(
  paragraphs: readonly TaggedParagraph[],
  ctx: StandardDepthEnhancementContext,
  applyAudienceSafety: boolean,
): TaggedParagraph[] {
  let out = dedupeRepeatedGuidance(paragraphs);
  let attempts = 0;
  while (out.length < MIN_PUBLIC_PARAGRAPHS && attempts < MIN_PUBLIC_PARAGRAPHS * 4) {
    const candidate = textParagraph(shortParagraphContinuation(ctx, out));
    const safeCandidate = applyAudienceSafety ? audienceSafeParagraph(candidate, ctx) : candidate;
    const beforeLength = out.length;
    out = dedupeRepeatedGuidance([...out, safeCandidate]);
    attempts = out.length === beforeLength ? attempts + 1 : 0;
  }
  return out;
}

function splitOverpackedQualityOpening(
  paragraphs: readonly TaggedParagraph[],
  ctx: StandardDepthEnhancementContext,
): TaggedParagraph[] {
  if (ctx.category !== 'career' && ctx.category !== 'movement' && ctx.category !== 'academic') return [...paragraphs];
  if (paragraphs.length === 0) return [...paragraphs];
  const opening = paragraphs[0];
  const sentences = splitPublicSentences(opening.plainText);
  if (sentences.length <= MAX_PUBLIC_FIRST_PARAGRAPH_SENTENCES) return [...paragraphs];

  const first = normalizeRenderedText(sentences.slice(0, 2).join(' '));
  const rest = normalizeRenderedText(sentences.slice(2).join(' '));
  if (!first || !rest) return [...paragraphs];
  return [textParagraph(first), textParagraph(rest), ...paragraphs.slice(1)];
}

function youngChildAudienceText(value: string, ctx: StandardDepthEnhancementContext): string {
  if (!isYoungChildReader(ctx)) return value;
  let out = value;
  if (ctx.category === 'wealth') {
    out = out
      .replace(/오늘 용돈을 어떻게 쓸지 천천히 살펴보기 좋은 하루예요\. 큰돈을 다루는 때가 아니라, 작은 결정을 연습하는 시간이에요\./g, '오늘은 갖고 싶은 것을 바로 고르기보다 잠깐 기다려 보는 연습이 잘 맞는 하루예요. 보호자가 옆에서 지금 꼭 필요한지 함께 물어봐 주면 작은 선택이 더 쉬워져요.')
      .replace(/이번 주 용돈은 한꺼번에 쓰기보다, 며칠로 나눠 살펴보기 좋은 한 주예요\. 작은 동전을 차곡차곡 모으는 연습이 어울리는 시기예요\./g, '이번 주는 갖고 싶은 것을 한꺼번에 고르기보다 며칠 동안 천천히 살펴보기 좋은 때예요. 작은 선택을 하나씩 나누어 보면 아이도 기다리는 감각을 편하게 배울 수 있어요.')
      .replace(/이번 달은 한 달 단위의 작은 계획을 세워 보기 좋은 시기예요\. 큰돈을 다루는 때가 아니라, 한 달이라는 호흡으로 용돈의 결을 잡아 가는 흐름이에요\./g, '이번 달은 갖고 싶은 것과 기다릴 수 있는 것을 보호자와 함께 나눠 보기 좋은 시기예요. 큰 계산을 하는 때가 아니라, 작은 선택의 흐름을 천천히 배워 가는 과정이에요.')
      .replace(/이번 달은 한 달 단위의 작은 계획을 세워 보기 좋은 시기예요\. 큰돈을 다루는 때가 아니라, 한 달이라는 호흡으로 용돈의 흐름을 잡아 가는 과정이에요\./g, '이번 달은 갖고 싶은 것과 기다릴 수 있는 것을 보호자와 함께 나눠 보기 좋은 시기예요. 큰 계산을 하는 때가 아니라, 작은 선택의 흐름을 천천히 배워 가는 과정이에요.')
      .replace(/올해는 한 해 동안 어떤 작은 모음을 만들어 갈지 그려 보기 좋은 시기예요\. 큰돈을 다루는 때가 아니라, 한 해의 호흡으로 용돈의 흐름을 살피는 시간이에요\./g, '올해는 갖고 싶은 것과 기다릴 수 있는 것을 계절마다 천천히 배워 보기 좋은 시기예요. 보호자가 옆에서 작은 약속을 함께 정해 주면 선택의 기준이 자연스럽게 자라요.')
      .replace(/어린 시기의 돈 흐름은 큰돈을 다루는 때가 아니라, 작은 결정을 연습해 보는 시간이에요\. 천천히 익히는 호흡이 평생 갈 좋은 습관의 씨앗이 돼요\./g, '어린 시기의 물건 선택은 큰돈을 다루는 일이 아니라, 갖고 싶은 마음을 천천히 살펴보는 연습이에요. 보호자와 함께 기다리고 고르는 경험이 오래 도움이 되는 습관의 씨앗이 돼요.')
      .replace(/이십 대의 재물 흐름은 결을 잡아 가는 시작점이에요\. 큰 자산을 한 번에 만드는 시기가 아니라, 평생 갈 리듬을 다듬는 흐름이에요\./g, '나중에 이십 대가 되면 돈을 쓰고 모으는 리듬을 처음 크게 배우게 돼요. 지금은 그 먼 이야기보다, 작은 선택을 기다리고 기록하는 감각을 천천히 익히면 충분해요.')
      .replace(/오늘 잘 어울리는 흐름은 어디에 썼는지 한 줄로 적어 두는 거예요\. 좋아하는 책 한 권, 친구에게 줄 작은 선물, 다음에 사고 싶은 것 — 이렇게 적어 두면 다음 결정이 한결 또렷해져요\./g, '오늘은 무엇을 골랐고 무엇을 기다리기로 했는지 보호자와 짧게 말해 보는 것이 좋아요. 좋아하는 놀이, 갖고 싶은 작은 물건, 다음에 해 보고 싶은 일을 함께 나누면 다음 선택이 더 쉬워져요.')
      .replace(/이번 주에 잘 어울리는 흐름은 좋아하는 것을 한두 가지만 골라 두는 거예요\. 좋아하는 책 한 권, 좋아하는 간식 하나, 친구에게 줄 작은 선물 — 한두 가지를 정해 두면 다른 데 쓰고 싶은 마음이 자연스럽게 줄어요\./g, '이번 주에는 좋아하는 것을 한두 가지만 말해 보는 흐름이 잘 맞아요. 좋아하는 책, 간식, 친구에게 건넬 작은 마음처럼 쉬운 것부터 나누면 다른 것을 바로 갖고 싶은 마음도 조금 잦아들어요.')
      .replace(/이번 달에 잘 어울리는 흐름은 한 달의 즐거움 목록을 적어 두는 거예요\. 사고 싶은 책, 친구에게 줄 작은 선물, 가족과 함께 쓸 작은 비용 — 이렇게 적어 두면 자기 우선순위가 또렷해져요\./g, '이번 달에는 즐거운 일을 보호자와 함께 짧게 말해 보면 좋아요. 갖고 싶은 책, 친구에게 건넬 작은 마음, 가족과 함께할 즐거운 시간을 나누면 아이의 마음이 더 또렷해져요.')
      .replace(/올해 잘 어울리는 흐름은 한 해의 작은 목표를 한 가지만 정해 두는 거예요\. 좋아하는 책 열 권 사기, 친구 생일에 작은 선물 준비하기, 한 달에 한 번 가족과 함께 작은 외식 — 한 가지가 익숙해지면 다른 것도 자연스럽게 따라와요\./g, '올해 잘 어울리는 흐름은 작은 즐거움 하나를 정해 함께 기다려 보는 거예요. 좋아하는 책을 함께 고르기, 친구에게 마음을 담은 그림 준비하기, 가족과 간식 시간을 정하기처럼 쉬운 약속이면 충분해요.')
      .replace(/잘 어울리는 흐름은 좋아하는 것을 한 가지씩 적어 두는 거예요\. 좋아하는 책 한 권, 좋아하는 간식 하나, 친구에게 줄 작은 선물 — 이렇게 한 가지씩 정해 두면 자기가 무엇을 좋아하는지 또렷해져요\./g, '잘 어울리는 흐름은 좋아하는 것을 한 가지씩 말해 보는 거예요. 좋아하는 책, 간식, 친구에게 건넬 작은 마음처럼 쉬운 것부터 나누면 아이가 무엇을 좋아하는지 더 잘 보여요.')
      .replace(/주의하면 좋은 점은 친구가 사니까 같이 사고 싶어지는 흐름이에요\. 사고 싶은 마음이 들면 한 박자 미루고, 내일 다시 봐도 갖고 싶은지 살피면 좋아요\./g, '주의하면 좋은 점은 친구가 가진 것을 나도 바로 갖고 싶어지는 마음이에요. 그럴 때는 보호자와 함께 잠깐 기다렸다가 나중에도 필요한지 다시 보면 좋아요.')
      .replace(/주의하면 좋은 점은 한 번에 다 써 버리는 흐름이에요\. 가지고 싶은 게 보이면 잠깐 멈추고, 정말 갖고 싶은지 다음 날 다시 봐도 충분해요\./g, '주의하면 좋은 점은 갖고 싶은 것을 한 번에 다 고르고 싶은 마음이에요. 그런 마음이 들면 잠깐 멈추고, 다음 날에도 필요한지 보호자와 다시 이야기해 보면 좋아요.')
      .replace(/주의하면 좋은 점은 즉흥적인 큰 소비예요\. 갑자기 사고 싶은 게 생기면 한 박자 미루고, 적어 둔 목록과 비교해 보면 좋아요\./g, '주의하면 좋은 점은 갑자기 갖고 싶어진 물건을 바로 고르는 일이에요. 갖고 싶은 마음이 생기면 잠깐 기다렸다가 보호자와 다시 이야기해 보면 좋아요.')
      .replace(/살피면 좋은 점은 한 번에 다 쓰고 싶은 마음이에요\. 사고 싶은 게 보이면 잠깐 멈추고, 다음 날에도 갖고 싶은지 다시 봐도 충분해요\./g, '살피면 좋은 점은 갖고 싶은 것을 한 번에 다 고르고 싶은 마음이에요. 사고 싶은 것이 보이면 잠깐 멈추고, 다음 날에도 필요한지 보호자와 다시 보면 충분해요.')
      .replace(/오늘은 한 가지만 적어 두는 것으로 충분해요\. 작은 기록 한 줄이 다음 주, 다음 달의 자기 기준이 돼요\./g, '오늘은 한 가지만 말해 보는 것으로도 충분해요. 작은 대화 한마디가 다음 선택을 도와주는 기준이 될 수 있어요.')
      .replace(/작은 모음의 즐거움이 자라는 한 주예요\. 한 줄 기록과 한두 가지 결정만 곁에 두면 한 주가 가지런해져요\./g, '작은 기다림의 즐거움이 자라는 한 주예요. 한두 가지 선택만 함께 정해도 한 주가 훨씬 편안해져요.')
      .replace(/한 달의 작은 결산은 큰 자산이 돼요\. 마지막 날 어디에 썼는지 한 줄로 정리하면, 다음 달의 결정이 한결 가벼워져요\./g, '한 달 끝에는 무엇을 골랐고 무엇을 기다렸는지 함께 이야기해 보세요. 그 대화가 다음 달의 작은 선택을 가볍게 도와줘요.')
      .replace(/한 해의 작은 모음이 자라요\. 분기마다 한 줄 정리해 두면, 다음 해의 그림이 한층 또렷해져요\./g, '한 해 동안 기다리고 고른 경험이 조금씩 자라요. 계절마다 한 번씩 함께 이야기해 두면 다음 선택도 더 편해져요.')
      .replace(/월말 한 줄 정리, 작은 적금, 작은 도전 — 이런 흐름이 모여 평생 갈 자리가 잡혀요\./g, '나중에는 한 달을 돌아보는 기록과 작은 저축이 도움이 될 수 있어요. 지금은 갖고 싶은 것을 잠깐 기다려 보는 경험부터 충분해요.')
      .replace(/큰 거래·큰 장기적인 준비 권유는 이 시기에 한 번 더 살피면 좋아요\./g, '큰돈이 오가는 약속이나 어려운 권유는 나중에도 한 번 더 살피는 습관이 필요해요.')
      .replace(/자리가 잡히는 시기예요\. 자기 페이스를 지키며 작게 시도해 가는 호흡이 가장 잘 어울려요\./g, '기준이 천천히 자라는 시기예요. 작은 선택을 기다려 보는 호흡이 가장 잘 어울려요.');
  }
  return normalizeRenderedText(out)
    .replace(/이 시기는 부모님을 살피는 손과 가족의 자립을 응원하는 손이 같이 움직이는 자리예요\./g, '나중에 어른이 되면 부모님과 자기 생활을 함께 살피는 시기가 올 수 있어요.')
    .replace(/부모님 세대의 변화는 천천히 들어오기에, 작은 신호를 메모해 두면 리듬을 부드럽게 풀어 갈 수 있어요\./g, '그때에는 가족의 변화를 천천히 살피는 일이 중요해져요.')
    .replace(/가족과의 흐름은 어른 대 어른으로 옮겨 가는 자리라, 한 발 떨어져서 응원하는 흐름이 더 따뜻해요\./g, '가족과의 관계도 서로의 생활을 존중하는 쪽으로 옮겨 가면 더 따뜻해져요.')
    .replace(/자녀가 들어오는 시기라면 자기 어린 시절의 따뜻함을 다른 모양으로 풀어 내는 시기이고, 그렇지 않다면 형제·가까운 친구·이웃이 가족처럼 가까워지는 시기예요\./g, '나중에 가족의 모양이 넓어지는 시기가 오면, 가까운 사람과 따뜻함을 나누는 방식도 조금씩 달라질 수 있어요.');
}

function minorFutureLifeAudienceText(value: string, ctx: StandardDepthEnhancementContext): string {
  if (!isFutureAdultLifeForMinorReader(ctx)) return value;
  const out = normalizeRenderedText(value)
    .replace(/인생 전체로 보면 (진로 감각은|진로 감각이)/g, '먼 훗날을 넓게 보면 일과 책임은')
    .replace(/인생 전체의 진로 감각/g, '먼 훗날의 일과 책임')
    .replace(/인생 전체로 보면 (물건과 작은 선택은|물건과 작은 선택이|용돈과 물건 관리는|용돈과 물건 관리가)/g, '오래 뒤를 넓게 보면 돈을 다루는 기준은')
    .replace(/인생 전체의 (물건과 작은 선택|용돈과 물건 관리)/g, '오래 뒤의 돈 기준')
    .replace(/인생 전체로 보면 (친구 관계는|친구 관계가)/g, '먼 훗날을 넓게 보면 관계와 마음은')
    .replace(/인생 전체의 친구 관계/g, '먼 훗날의 관계와 마음')
    .replace(/긴 흐름에서는 진로 감각은/g, '먼 훗날의 일과 책임은')
    .replace(/긴 흐름에서는 용돈과 물건 관리는/g, '오래 뒤의 돈 기준은')
    .replace(/긴 흐름에서는 물건과 작은 선택은/g, '오래 뒤의 돈 기준은')
    .replace(/긴 흐름에서는 친구 관계는/g, '먼 훗날의 관계와 마음은')
    .replace(/믿을 만한 어른과 아이에게 맞는 속도를 함께 보세요\./g, '지금은 보호자가 아이의 속도를 지켜보고, 이 말은 먼 훗날 스스로 책임을 맡을 때 필요한 기준으로만 넓게 읽어 주세요.')
    .replace(/아이에게 바로 요구하기보다, 보호자가 어떤 환경을 도와주면 좋을지 살피는 방향으로 읽어 주세요\./g, '현재 바로 요구할 내용이 아니라, 먼 훗날 스스로 생활 기준을 세울 때 참고할 말로 읽어 주세요.')
    .replace(/보호자는 예측보다 관찰에 무게를 두고, 아이가 편하게 반복할 수 있는 습관 하나를 먼저 살펴보면 좋아요\./g, '보호자는 현재 아이의 생활 리듬을 관찰하되, 이 조언은 먼 훗날 스스로 반복할 기준을 이해하는 참고로 두면 좋아요.')
    .replace(/믿을 만한 어른과 나에게 맞는 속도를 함께 보세요\./g, '지금은 믿을 만한 어른과 내 속도를 살피고, 먼 훗날의 책임은 참고 방향으로만 넓게 읽어 주세요.')
    .replace(/후반기의 재물운은/g, '오래 뒤의 돈 기준은')
    .replace(/후반기의 이동과 변화는/g, '먼 훗날의 이동과 변화는')
    .replace(/(?:30|40|50|60|70)대 (?:초반|중반|후반) (?:남성|여성|중립)으로 입력된 경우에는/g, '먼 훗날 해당 시기를 넓게 보면')
    .replace(/40대 후반이고 성별을 넓게 본 경우에는/g, '먼 훗날 중년 이후를 넓게 보면')
    .replace(/50대 후반에서 60대의/g, '먼 훗날 중년 이후의')
    .replace(/60대 후반이고 성별을 넓게 본 경우에는/g, '먼 훗날 후반기를 넓게 보면')
    .replace(/70대 이후이고 성별을 넓게 본 경우에는/g, '먼 훗날 노년기를 넓게 보면')
    .replace(/먼 훗날까지 넓게 두고 지금 당장 맞춰야 할 답보다 나중에도 참고할 기준을 나누는 표시예요\./g, '먼 훗날까지 넓게 두고 현재 도울 부분과 나중에 참고할 기준을 나누어 보는 표시예요.')
    .replace(/먼 훗날을 넓게 보면 돈과 물건 관리는/g, '오래 뒤를 넓게 보면 돈을 다루는 기준은')
    .replace(/먼 훗날의 돈과 물건 관리에서/g, '나중에 스스로 돈을 다룰 때')
    .replace(/먼 훗날의 돈과 물건 관리는/g, '오래 뒤의 돈 기준은')
    .replace(/먼 훗날의 돈과 물건 관리/g, '오래 뒤의 돈 기준')
    .replace(/긴 흐름에서는 돈과 물건 관리는/g, '긴 흐름에서는 돈을 다루는 방식은')
    .replace(/긴 흐름에서는 돈과 물건 관리가/g, '긴 흐름에서는 돈을 다루는 방식이')
    .replace(/긴 흐름에서는 돈과 물건 관리를/g, '긴 흐름에서는 돈을 다루는 방식을')
    .replace(/돈과 물건 관리는 한 번/g, '미래의 돈 기준은 한 번')
    .replace(/이 해석은 돈과 물건 관리를/g, '이 해석은 미래의 돈 기준을')
    .replace(/비용과 약속을 확인하는 습관/g, '조건을 차분히 확인하는 습관')
    .replace(/큰 결정을 시키려는 뜻이 아니라/g, '큰 결정을 요구하는 말이 아니라')
    .replace(/먼 훗날까지 넓게 두고 큰 결정을 요구하는 말이 아니라/g, '오래 뒤까지 보더라도 지금 큰 결정을 요구하는 말이 아니라')
    .replace(/돈과 물건 관리에서/g, '미래의 돈 기준에서')
    .replace(/돈과 물건 관리는/g, '미래의 돈 기준은')
    .replace(/돈과 물건 관리를/g, '미래의 돈 기준을')
    .replace(/돈과 물건 관리가/g, '미래의 돈 기준이')
    .replace(/자격·이력서·증명 서류와 본격적으로 마주하는 시기가 인생에 여러 번 들어오는 흐름이에요\. 첫 자격 한 장이 다음 길의 키가 돼요\./g, '나중에 배운 것을 정리해 보여 줄 자료와 자격 준비가 중요해지는 때가 올 수 있어요. 처음부터 거창하게 준비하기보다 어떤 배움을 남겼는지 차근차근 모으는 흐름이에요.')
    .replace(/계약서, 증명서, 자격 갱신처럼 기준을 확인해야 하는 일이 인생 곳곳에서 중요하게 떠올라요\. 서명하기 전 한 번 더 읽는 습관이 생활을 안정적으로 지켜 줘요\./g, '나중에 중요한 약속, 확인 자료, 자격 관련 기록을 차분히 살필 일이 생길 수 있어요. 어려운 말보다 날짜와 조건을 다시 보는 습관이 생활을 안정적으로 지켜 줘요.')
    .replace(/계약서, 자격, 증명 자료를 차분히 챙기는 습관이 관계와 일을 함께 지켜 줘요\./g, '중요한 약속과 자격 관련 자료를 차분히 챙기는 습관이 관계와 일을 함께 지켜 줘요.')
    .replace(/한 번 잘 정리한 계약은 오래 쓰는 지도처럼 남아요\./g, '한 번 잘 정리한 기록은 오래 쓰는 지도처럼 남아요.')
    .replace(/서명하기 전 한 번 더 읽는 습관/g, '중요한 결정을 하기 전 한 번 더 읽는 습관')
    .replace(/서명 한 장을 가볍게 넘기지 않고/g, '중요한 결정을 가볍게 넘기지 않고')
    .replace(/원본, 사진, 확인할 사람/g, '제목, 보관 위치, 확인할 사람')
    .replace(/원본, 사본, 확인받을 사람/g, '보관 위치, 다시 볼 날짜, 확인받을 사람')
    .replace(/원본은 안전한 곳에 두고, 사진본과 확인할 사람/g, '자료는 찾기 쉬운 곳에 두고, 보관 위치와 확인할 사람')
    .replace(/자격증, 계약서, 등기/g, '자격 관련 기록, 중요한 약속, 오래 보관할 자료')
    .replace(/계약서나 자격 서류/g, '중요한 약속이나 자격 관련 기록')
    .replace(/날짜, 금액, 책임 범위/g, '날짜, 조건, 맡을 범위')
    .replace(/날짜, 금액, 역할/g, '날짜, 조건, 역할')
    .replace(/금액이 들어간 자료/g, '중요한 숫자가 들어간 자료')
    .replace(/돈과 관련된 기록/g, '중요한 숫자와 관련된 기록')
    .replace(/지나온 자리의 실마리를/g, '지나온 선택과 약속을')
    .replace(/지나온 자리의 실마리/g, '지나온 선택과 약속')
    .replace(/큰돈을 바로 맡긴다는 뜻이 아니라/g, '지금 큰 결정을 요구하는 말이 아니라')
    .replace(/지금 큰돈을 맡기라는 뜻이 아니라/g, '돈 문제를 아이에게 미리 떠넘기려는 말이 아니라')
    .replace(/자격증·계약서·등기 서류/g, '중요한 기록과 오래 보관할 자료')
    .replace(/자격증, 계약서, 등기/g, '자격 관련 기록, 중요한 약속, 오래 보관할 자료')
    .replace(/계약서나 자격 서류/g, '중요한 약속이나 자격 관련 기록')
    .replace(/종이 원본/g, '종이 자료')
    .replace(/사진본/g, '사진 기록')
    .replace(/원본/g, '보관 자료')
    .replace(/날짜, 금액, 약속, 제출할 것/g, '날짜, 조건, 약속, 제출할 것')
    .replace(/이름, 날짜, 금액, 조건/g, '이름, 날짜, 조건, 확인할 사람')
    .replace(/이름, 날짜, 금액/g, '이름, 날짜, 조건')
    .replace(/날짜, 이름, 금액, 연락처/g, '날짜, 이름, 조건, 연락처')
    .replace(/그다음 금액과 조건/g, '그다음 조건과 맡은 범위')
    .replace(/돈이나 계약이 들어간 내용/g, '중요한 약속이 들어간 내용')
    .replace(/금액과 기간, 내가 감당할 책임/g, '조건과 기간, 맡은 범위')
    .replace(/금액, 기간, 책임/g, '조건, 기간, 맡은 범위')
    .replace(/신청일, 제출처, 금액, 담당자/g, '신청일, 제출처, 확인할 사람')
    .replace(/살짝 주의할 점은, 중요한 서류를 한 군데에 모아 두는 면이에요\. 중요한 기록과 오래 보관할 자료는 한 폴더와 한 사진 기록 정도로 두 곳에 두면 든든해요\./g, '살짝 주의할 점은, 중요한 자료를 한곳에만 모아 두면 나중에 찾기 어려울 수 있다는 점이에요. 보관 위치와 확인할 사람을 함께 적어 두면 훨씬 든든해요.')
    .replace(/정리·증명·전수/g, '정리·확인·나눔')
    .replace(/증명으로 남길 것/g, '확인 자료로 남길 것')
    .replace(/내게 필요한 증빙이 무엇인지/g, '내게 필요한 확인 자료가 무엇인지')
    .replace(/어떤 자격을 먼저 잡느냐/g, '어떤 배움을 먼저 정리하느냐')
    .replace(/첫 자격/g, '첫 기록')
    .replace(/자격이나 보고 자료/g, '배운 것과 보고 자료')
    .replace(/자격 자료/g, '배움 자료')
    .replace(/그동안의 기록과 자격을 정돈/g, '그동안의 배움과 기록을 정돈')
    .replace(/지금 당장 쓸 돈/g, '먼저 확인할 비용')
    .replace(/지금 당장 다 맞추려 하지 않아도 충분해요\./g, '지금 당장 다 맞추려 하지 않고, 보호자가 참고할 방향과 지금 도울 부분을 나누면 충분해요.');
  return softenFutureAdultLifeHorizon(out, ctx);
}

function softenFutureAdultLifeHorizon(value: string, ctx: StandardDepthEnhancementContext): string {
  return normalizeRenderedText(value)
    .replace(/먼 훗날을 넓게 보면/g, futureAdultLifeScopeLead(ctx))
    .replace(/먼 훗날 해당 시기를 넓게 보면/g, futureAdultLifeScopeLead(ctx))
    .replace(/먼 훗날 중년 이후를 넓게 보면/g, futureAdultLifeScopeLead(ctx))
    .replace(/먼 훗날 후반기를 넓게 보면/g, futureAdultLifeScopeLead(ctx))
    .replace(/먼 훗날 노년기를 넓게 보면/g, futureAdultLifeScopeLead(ctx))
    .replace(/먼 훗날까지 넓게 두고/g, '시간을 길게 보고')
    .replace(/먼 훗날의 ([^.!?\n]{2,28})에서/g, '그 시기의 $1에서')
    .replace(/먼 훗날의 ([^.!?\n]{2,28})(은|는|이|가|을|를)/g, '그 시기의 $1$2')
    .replace(/먼 훗날에도/g, '오래')
    .replace(/먼 훗날/g, '시간이 지난 뒤')
    .replace(/나중에 성인이 되었을 때/g, '성인이 된 뒤')
    .replace(/나중에 자기 분야/g, '성장 뒤 자기 분야')
    .replace(/나중에 스스로/g, '성장 뒤 스스로')
    .replace(/나중에 다시/g, '시간이 지나 다시')
    .replace(/나중에도/g, '오래');
}

function polishStandardAudienceText(value: string): string {
  return normalizeRenderedText(value)
    .replace(/가족나/g, '가족이나')
    .replace(/기준가/g, '기준이')
    .replace(/자료은/g, '자료는')
    .replace(/약속를/g, '약속을')
    .replace(/범위을/g, '범위를')
    .replace(/자료이/g, '자료가')
    .replace(/조건, 조건/g, '조건, 확인할 사람')
    .replace(/오늘의 재물(?:운| 흐름)은 큰 무리수 없이 흘러가는 흐름이에요\. 어제까지 이어 오던 페이스를 지키면 자연스럽게 자리 잡는 흐름이에요/g, '오늘의 돈 관리는 큰 무리 없이 이어 가기 좋은 모습이에요. 어제까지의 페이스를 지키면 작은 결정도 차분하게 정리돼요')
    .replace(/권유받은 큰 거래는 하루 자고 정해도 늦지 않아요/g, '권유받은 큰 제안은 하루 지나 다시 봐도 늦지 않아요')
    .replace(/올해의 직업(?:운| 결| 흐름)은 첫 자리의 방향이 또렷해지는 한 해예요\. 한 자리에서 1년이라는 단위는 작은 인정 한두 줄을 만들기 좋은 길이라, 빠른 이동보다 한 자리에서의 마무리에 무게를 두면 중심이 단단해져요/g, '올해의 일과 책임은 첫 역할의 방향을 또렷하게 잡아 가는 한 해예요. 한 역할에서 보내는 1년은 작은 인정과 결과를 만들기 좋은 시간이니, 빠른 이동보다 맡은 일을 마무리하는 데 무게를 두면 중심이 단단해져요')
    .replace(/주 초반에 한 주의 흐름을 짧게 적어 두고, 주말에 다시 한 번 점검해 두면 자리의 중심이 한결 깔끔해져요\. 새 자극이 들어와도 일단 메모해 두고 다음 주로 넘기는 흐름이 잘 맞아요/g, '주 초반에 이번 주의 할 일을 짧게 적고, 주말에 다시 점검하면 중심이 훨씬 깔끔해져요. 새 자극이 들어와도 일단 메모해 두고 다음 주에 판단하는 방식이 잘 맞아요')
    .replace(/월 초반에 한 달의 방향을 짧게 적어 두고, 월말에 다시 점검해 두면 자리의 중심이 한결 깔끔해져요\. 새 자극이 들어와도 일단 메모해 두고 다음 달로 넘기는 흐름이 잘 맞아요/g, '월 초반에 이번 달의 방향을 짧게 적고, 월말에 다시 점검하면 중심이 훨씬 깔끔해져요. 새 자극이 들어와도 일단 메모해 두고 다음 달에 판단하는 방식이 잘 맞아요')
    .replace(/한 해 단위로 보면 강한 체력은 무리한 자리에서 자기 신호를 둔하게 만들기도 해요/g, '한 해 단위로 보면 체력이 좋을수록 무리하는 순간에 몸의 신호를 지나치기 쉬워요')
    .replace(/한 달의 흐름이 한눈에 보이고 무리한 자리를 미리 알아채기 쉬워져요/g, '한 달의 컨디션이 한눈에 보이고 무리하는 순간을 미리 알아차리기 쉬워져요')
    .replace(/아이는 이번 달 잠·식사·놀이 세 박자가 잘 잡혀 가는 흐름이에요/g, '아이는 이번 달 잠, 식사, 가벼운 움직임 세 박자가 잘 잡혀 가는 모습이에요')
    .replace(/쌓아 온 흐름은 이미 충분해요/g, '지금까지 쌓아 온 경험은 이미 충분한 바탕이 돼요')
    .replace(/긴 흐름에서는 돈을 어떻게 벌지와 어떻게 새지 않게 지킬지를 함께 봐야 해요/g, '긴 흐름에서는 돈을 어떻게 벌지, 어떻게 새지 않게 지킬지, 이동이나 새 환경에서 생기는 지출을 어떻게 다룰지 함께 봐야 해요')
    .replace(/큰 결정은 한 박자 늦추고, 익숙한 기준을 다듬는 방식이 잘 어울려요/g, '큰 결정은 한 박자 늦추고, 믿을 만한 사람과 조건을 함께 확인하며 익숙한 기준을 다듬는 방식이 잘 어울려요')
    .replace(/긴 흐름에서는 좋은 인연을 만나는 것만큼 관계를 유지하는 기본기가 중요해요/g, '긴 흐름에서는 좋은 인연을 만나는 것만큼 서로의 속도와 마음의 균형을 맞추는 기본기가 중요해요')
    .replace(/매일 비슷한 시각에 자고 일어나는 자리가 흐름을 단단히 만들어요/g, '매일 비슷한 시각에 자고 일어나고, 바깥 공기나 편한 놀이로 몸을 살짝 움직이면 리듬이 더 단단해져요')
    .replace(/시작의 중심이 한 해 단위로 단단해지는 흐름이에요/g, '올해는 작은 결과를 쌓아 시작의 기준을 단단히 만드는 시기예요')
    .replace(/시작의 중심이 한 달 단위로 단단해져요/g, '이번 달은 작은 결과를 남기며 시작의 기준을 다지는 시기예요')
    .replace(/이번 달의 직업(?:운| 결| 흐름)은 첫 자리에서의 작은 인정이 자라는 흐름이에요/g, '이번 달에는 맡은 역할 안에서 작은 인정을 쌓아 가는 모습이에요')
    .replace(/빠른 이동보다 한 자리에서의 마무리가 자기 (?:결|흐름)의 자산이 된다는 점을 메모해 두면 좋아요/g, '빠른 이동보다 맡은 일을 잘 마무리하는 태도가 내 기준이 된다는 점을 기억하면 좋아요')
    .replace(/그 한 줄이 다음 자리를 고를 때의 또렷한 기준이 되어 줘요/g, '그 한 줄이 다음 선택을 할 때 또렷한 기준이 되어 줘요')
    .replace(/한 해의 시작 자리를 분기로 쪼개/g, '올해의 시작 단계를 분기별로 나누어')
    .replace(/빠른 물살을 한 해 내내 그대로 두면 둑이 닳기도 하니, 분기마다 한 번 작은 둑을 두어 흐름을 잠시 잡아 두면 다음 분기의 물살이 더 또렷하게 자기 기준에 흘러요/g, '빠른 물살을 한 해 내내 그대로 두면 둑이 닳듯 피로도 쌓일 수 있어요. 분기마다 한 번 속도를 늦추면 다음 분기의 페이스를 더 또렷하게 잡을 수 있어요')
    .replace(/방향정/g, '결정')
    .replace(/자기 자리를 가꾸는 일이 가장 큰 인연 자산이 돼요/g, '자기 마음과 생활을 잘 가꾸는 일이 관계를 오래 지키는 기반이 돼요')
    .replace(/가장 단단한 인연 자산/g, '가장 단단한 관계의 기반')
    .replace(/인연 자산/g, '관계의 기반')
    .replace(/아이의 사이는 친구·가족과 함께하는 자리에서 가장 또렷이 살아나요/g, '아이의 관계는 친구와 가족이 함께하는 시간 속에서 가장 또렷이 자라요')
    .replace(/아이의 사이는 친구·가족과 함께하는 자리에서 한 해 내내 자라요/g, '아이의 관계는 친구와 가족이 함께하는 일상 속에서 한 해 내내 자라요')
    .replace(/이번 주 아이의 하루는 친구·가족과의 자리에서 가장 또렷하게 살아나요/g, '이번 주 아이의 관계는 친구와 가족과 함께 보내는 시간 속에서 가장 또렷하게 자라요')
    .replace(/옆에서 따뜻하게 챙겨 주는 자리만으로도 큰 자산이 돼요/g, '옆에서 따뜻하게 챙겨 주는 시간만으로도 큰 힘이 돼요')
    .replace(/단체 활동·학원·가족 모임처럼 함께하는 시간이 늘어나는 시기라/g, '어린이집, 놀이 모임, 가족 모임처럼 함께하는 시간이 늘어나는 시기라')
    .replace(/좋아하는 친구에게 작은 칭찬이나 고마운 마음을 한 줄로 건네면/g, '좋아하는 친구에게 다정한 말이나 작은 양보를 보여 주면')
    .replace(/새 친구를 만나는 자리나 단체 활동이 있으면/g, '새 친구를 만나는 시간이나 단체 활동이 있으면')
    .replace(/단체 활동·놀이 자리에서/g, '단체 활동이나 놀이 시간에')
    .replace(/그 자리에서 사이가 한층 부드러워져요/g, '그 순간 관계가 한층 부드러워져요')
    .replace(/부모·선생님이 옆에서 조용히 흐름을 다듬어 주는 것만으로도/g, '부모·선생님이 옆에서 조용히 관계를 풀어 주는 것만으로도')
    .replace(/작은 안부 자리가 자라나는 흐름의 든든한 뿌리예요/g, '작은 안부와 다정한 말이 자라나는 흐름의 든든한 뿌리예요')
    .replace(/새로운 자리가 생긴다면 보호자가 옆에 함께 있는 자리부터 시작하면 좋아요/g, '새로운 경험이 생긴다면 보호자가 옆에 함께 있는 작은 일부터 시작하면 좋아요')
    .replace(/친구와의 흐름/g, '친구와의 관계')
    .replace(/사람을 만나는 자리가 늘어나는 시기라/g, '사람을 만나는 시간이 늘어나는 시기라')
    .replace(/새 친구를 사귀는 자리가 생기면/g, '새 친구를 사귈 기회가 생기면')
    .replace(/사이의 흐름/g, '관계의 흐름')
    .replace(/사이를 다듬어 주는 것만으로도/g, '관계를 풀어 주는 것만으로도')
    .replace(/곁에서 어른들이 한 박자 천천히 들어 주는 자리만으로도 흐름이 차분해져요/g, '곁에서 어른들이 한 박자 천천히 들어 주기만 해도 마음이 차분해져요')
    .replace(/어떤 씨앗이 자기 흙에 잘 맞을지/g, '어떤 활동이 자기에게 잘 맞을지')
    .replace(/한 줌은 작아 보여도 한 학기가 지나면 그릇이 묵직해지고, 그 무게가 자기 학습의 뼈대가 되어 줘요\./g, '한 줌은 작아 보여도 한 학기가 지나면 내가 해낸 흔적이 눈에 보여요. 그 흔적이 다음 공부를 시작하는 힘이 돼요.')
    .replace(/좋아하는 책 열 권 사기/g, '읽고 싶은 책을 천천히 고르기')
    .replace(/친구 생일에 작은 선물 준비하기/g, '가까운 사람에게 전할 마음 준비하기')
    .replace(/한 달에 한 번 가족과 함께 작은 외식/g, '가족과 함께할 가벼운 시간 정하기')
    .replace(/작은 외식/g, '가벼운 식사 시간')
    .replace(/친구에게 줄 작은 선물/g, '가까운 사람에게 전할 작은 마음')
    .replace(/가족과 함께 쓸 작은 비용/g, '가족과 함께할 즐거운 시간')
    .replace(/가족과 가까운 사람을/g, '가족과 가까운 관계를')
    .replace(/가족과 가까운 관계를 한 번의 사건보다 방향으로 보는/g, '가족과 가까운 관계를 한 번의 사건보다 긴 흐름으로 보는')
    .replace(/작은 비용/g, '작은 부담')
    .replace(/자기 우선순위/g, '내가 먼저 둘 기준')
    .replace(/평생 갈 자리가 잡혀요/g, '오래 가는 습관이 자리 잡아요')
    .replace(/평생 갈 자리가/g, '오래 갈 기준이')
    .replace(/좋아하는 자리를 자주 만나면/g, '좋아하는 놀이를 자주 만나면')
    .replace(/익숙한 자리와 새로운 자리가 균형을 이루는 흐름이 잘 맞아요/g, '익숙한 놀이와 새로운 놀이가 균형을 이루면 좋아요')
    .replace(/일정한 잠자리 자리가 흐름을 부드럽게 잡아 줘요/g, '일정한 잠자리 시간이 하루 리듬을 부드럽게 잡아 줘요')
    .replace(/자기 자리가 단단해져요/g, '자기 기반이 단단해져요')
    .replace(/한 해 끝의 자기 자리가 또렷해져요/g, '한 해 끝에 자기 색이 더 또렷해져요')
    .replace(/한 해 끝의 자기 자리가 또렷한 풍경으로 모여요/g, '한 해 끝에 몸의 신호가 또렷한 기록으로 모여요')
    .replace(/고요한 물가 둘레를 천천히 한 바퀴 도는 자리예요/g, '고요한 물가 둘레를 천천히 한 바퀴 도는 시간이에요')
    .replace(/자기 감정을 가족이나 가까운 어른과 한 줄로 나눠 두는 자리가 큰 도움이 돼요/g, '자기 감정을 가족이나 가까운 어른과 한 줄로 나눠 두면 큰 도움이 돼요')
    .replace(/한 해 동안 좋아하는 활동을 한두 가지 깊게 이어 가는 자리가 평생 갈 자기 색의 토대가 돼요/g, '한 해 동안 좋아하는 활동을 한두 가지 깊게 이어 간 경험이 오래 남을 자기 색의 토대가 돼요')
    .replace(/자기 자리에서 또렷이 보이게 돼요/g, '자기 눈에도 또렷이 보이게 돼요')
    .replace(/분기 끝의 한 줄 메모가 다음 분기의 자리를 또렷하게 잡아 주고/g, '분기 끝의 한 줄 메모가 다음 분기의 방향을 또렷하게 잡아 주고')
    .replace(/한 주 시작에 짧게 적어 두는 자리가 잘 맞아요/g, '한 주 시작에 짧게 적어 두면 좋아요')
    .replace(/좋아하는 활동 한 가지를 한 주 동안 길게 이어 가는 자리가 자기 색을 단단하게 만들어요/g, '좋아하는 활동 한 가지를 한 주 동안 길게 이어 가는 경험이 자기 색을 단단하게 만들어요')
    .replace(/너무 가볍게만 두면 자기 자리가 비어 보이니/g, '너무 가볍게만 두면 내 시간이 비어 보이니')
    .replace(/한 주의 시작 자리에서/g, '한 주를 시작할 때')
    .replace(/매주 같은 자리에 쌓아 두면/g, '매주 같은 곳에 쌓아 두면')
    .replace(/마음이 답답한 자리가 있다면/g, '마음이 답답한 순간이 있다면')
    .replace(/자기를 챙기는 자리가/g, '자기를 챙기는 시간이')
    .replace(/자기 자리가 단단하게 받쳐 줘요/g, '자기 생활을 단단하게 받쳐 줘요')
    .replace(/받은 자리에 책임을/g, '맡은 역할에 책임을')
    .replace(/받은 자리에 책임이/g, '맡은 역할에 책임이')
    .replace(/다음 10년 자리의 폭/g, '다음 10년 기회의 폭')
    .replace(/한 자리에서 뿌리내린 만큼 다음 자리가 한결 단단해져요/g, '한 역할에 꾸준히 뿌리내린 만큼 다음 단계도 한결 단단해져요')
    .replace(/한 자리에서 뿌리내린 만큼 다음 자리도 단단해지는 한 해예요/g, '한 역할에 꾸준히 뿌리내린 만큼 다음 단계도 단단해지는 한 해예요')
    .replace(/다음 세대와의 자리는 그 자체로 소중한 시간이고/g, '다음 세대와 함께 보내는 시간은 그 자체로 소중하고')
    .replace(/다음 세대와의 자리는 그 자체로 따뜻한 표현이라/g, '다음 세대와 함께 보내는 시간은 그 자체로 따뜻한 표현이라')
    .replace(/오늘 하루의 표현은 다음 세대와 함께하는 호흡을 천천히 정돈하는 자리예요/g, '오늘 하루의 표현은 다음 세대와 함께하는 호흡을 천천히 정돈하는 시간이에요')
    .replace(/자녀와의 결도 함께 비치지만/g, '자녀와의 관계도 함께 떠오르지만')
    .replace(/일과 가족의 자리가 함께 자라는 시기라/g, '일과 가족의 역할이 함께 커지는 시기라')
    .replace(/옆 사람과 나누는 자리도 자연스럽게 넓어지고/g, '가까운 사람과 나누는 시간도 자연스럽게 넓어지고')
    .replace(/비유하자면 평생의 자리는/g, '비유하자면 평생의 표현은')
    .replace(/큰 그늘이 곁의 작은 화초들을 자기 자리에서 자라게 받쳐 줘요/g, '큰 그늘이 곁의 작은 화초들을 각자의 속도로 자라게 받쳐 줘요')
    .replace(/누군가의 자리를 함께 또렷하게 만들어 주는 표현이/g, '누군가의 길을 함께 또렷하게 밝혀 주는 표현이')
    .replace(/한 자리를 옮길 때마다/g, '한곳을 옮길 때마다')
    .replace(/새 자리에 닿았을 때/g, '새 환경에 닿았을 때')
    .replace(/다음 자리에서의 시야도/g, '다음 단계의 시야도')
    .replace(/자녀와의 자리는 어른 대 어른의 호흡으로/g, '자녀와는 서로의 생활을 존중하는 어른 대 어른의 대화로')
    .replace(/큰 자산 정리는 한 해 안에 한꺼번에 결정하지 말고, 리듬의 흐름을 한 번 더 살피는 흐름이 잘 맞아요/g, '큰 자산 정리는 한 해 안에 한꺼번에 끝내려 하기보다, 기준과 부담을 나누어 여러 번 확인하는 편이 좋아요')
    .replace(/올해는 다음 세대와의 흐름을 차분히 데우는 시간이에요/g, '올해는 가족과 다음 세대를 차분히 챙기는 시간이에요')
    .replace(/주위에 자리를 만들고/g, '주위에 여유를 만들고')
    .replace(/빛깔이 진해지는 자리예요/g, '빛깔이 진해지는 시간이에요')
    .replace(/잘 풀리는 면은, 모르는 것을 솔직하게 적어 두는 자리예요/g, '잘 풀리는 면은, 모르는 것을 솔직하게 적어 두는 태도예요')
    .replace(/호수처럼 잔잔한 분위기에서 가까운 친구나 가족과 함께하는 짧은 여행이 가장 잘 어울려요/g, '가까운 길을 편안한 속도로 걸으며 친구나 가족과 짧게 쉬어 가는 일정이 잘 어울려요')
    .replace(/무리 없는 짧은 이동이 더 잘 맞아요/g, '멀리 가기보다 가까운 곳을 여유 있게 다녀오는 편이 좋아요')
    .replace(/호수처럼 잔잔한 흐름으로/g, '편안한 속도로')
    .replace(/호수처럼 잔잔한 결로/g, '편안한 속도로')
    .replace(/주 후반에 한 번 더 확인하는 자리를 두면 누락이 줄어요/g, '주 후반에 한 번 더 확인할 시간을 두면 빠뜨리는 일이 줄어요')
    .replace(/가족과의 자리가 한 달 안의 따뜻한 등불 같은 시간이에요/g, '가족과 함께하는 시간이 한 달 안의 따뜻한 등불처럼 느껴질 수 있어요')
    .replace(/학업·친구 자리에서 흔들리는 마음/g, '학업과 친구 관계 사이에서 흔들리는 마음')
    .replace(/같은 자리·같은 한 끼가 한 달 단위로 모이면/g, '같은 시간에 함께한 한 끼가 한 달 단위로 모이면')
    .replace(/가족과의 따뜻한 매듭이 단단하게 잡혀요/g, '가족과 나누는 따뜻한 연결감이 단단해져요')
    .replace(/어디에 두고 무엇을 나눌지 자리를 잡는 시기예요/g, '무엇을 남기고 무엇을 나눌지 차분히 정리하는 시기예요')
    .replace(/자녀·후배·이웃과 함께 쓰는 자리예요/g, '자녀·후배·이웃과 필요한 것을 나누기 좋은 때예요')
    .replace(/함께 쓰는 리듬이 자리를 한층 따뜻하게 만들어 줘요/g, '함께 나누는 방식이 생활을 한층 따뜻하게 만들어 줘요')
    .replace(/권유받은 자리를 한 박자 미루었다고 해서 기회를 놓친 것은 아니에요/g, '권유받은 일을 한 박자 미루었다고 해서 기회를 놓친 것은 아니에요')
    .replace(/자기 자리에서 누리는 일이 가장 자연스러운 호흡이 돼요/g, '내 생활 안에서 편안하게 누리는 일이 가장 자연스러운 호흡이 돼요')
    .replace(/정리와 나눔의 호흡이 가장 자연스러운 자리예요/g, '무엇을 남기고 무엇을 나눌지 차분히 고르면 생활의 기준이 더 또렷해져요')
    .replace(/정리하고 나누는 자리에서 흐름이 빛을 내요/g, '정리하고 나누는 과정에서 흐름이 빛을 내요')
    .replace(/후반기의 재물운은 지나온 자리의 실마리를 차분히 거두는 흐름이에요/g, '후반기의 재물운은 지나온 선택과 약속을 차분히 정리하는 흐름이에요')
    .replace(/자녀·후배·이웃과 함께 쓰는 리듬이 자리를 더 단단하게 만들어요/g, '자녀·후배·이웃과 나누는 방식이 생활의 기반을 더 단단하게 만들어요')
    .replace(/가족·후배·이웃과 함께 쓰는 리듬이 자리를 더 단단하게 만들어요/g, '가족·후배·이웃과 나누는 방식이 생활의 기반을 더 단단하게 만들어요')
    .replace(/오늘은 또래·친구와의 자리가 평소보다 또렷하게 살아나는 하루예요/g, '오늘은 또래나 친구와 함께하는 시간이 평소보다 또렷하게 살아나는 하루예요')
    .replace(/친구와의 일상적인 자리를 즐기는 모양으로/g, '친구와의 평범한 시간을 편하게 즐기는 쪽으로')
    .replace(/다음 달의 출발 자리가 자기에게 맞춰 자연스럽게 잡혀 가고/g, '다음 달을 어떻게 시작하면 좋을지 자연스럽게 보이고')
    .replace(/다음 달의 출발점이 자기에게 맞춰 자연스럽게 잡혀 가고/g, '다음 달을 어떻게 시작하면 좋을지 자연스럽게 보이고')
    .replace(/자기 자리에서 가장 또렷한 건강 지도/g, '자기 몸에 맞는 건강 지도')
    .replace(/자기 자리를 오래 받쳐 줘요/g, '자기 생활을 오래 받쳐 줘요')
    .replace(/좋아하는 놀이·관심사가 한 해 동안 천천히 자리를 잡는 흐름이에요/g, '좋아하는 놀이와 관심사가 한 해 동안 천천히 또렷해지는 흐름이에요')
    .replace(/옆에서 살펴 두는 자리가 자기 색을 키우는 큰 도움이 돼요/g, '옆에서 살펴봐 주는 시간이 아이의 색을 키우는 데 큰 도움이 돼요')
    .replace(/그 변화를 가족이 함께 즐겨 주는 자리가 큰 자산이 돼요/g, '그 변화를 가족이 함께 즐겨 주는 시간이 큰 도움이 돼요')
    .replace(/다음 해의 자리가 한결 단단해져요/g, '다음 해의 방향이 한결 또렷해져요')
    .replace(/받은 자리에 책임이 한 줄 더 쌓이는 흐름이에요/g, '맡은 역할에 책임이 한 줄 더 쌓이는 흐름이에요')
    .replace(/자기 자리의 중심이 한결 단단해져요/g, '자기 역할의 중심이 한결 단단해져요')
    .replace(/다음 자리의 디딤돌/g, '다음 단계의 디딤돌')
    .replace(/점심·저녁 한 끼를 천천히 즐기는 자리가 그대로 회복의 자리가 돼요/g, '점심이나 저녁 한 끼를 천천히 즐기는 시간이 그대로 회복에 도움이 돼요')
    .replace(/작은 흐름을 알아채기 좋은 자리이고/g, '작은 신호를 알아차리기 좋은 날이고')
    .replace(/한 결 가벼워져요/g, '한결 가벼워져요')
    .replace(/가족과의 자리는 따뜻한 화롯불 같은 시간이에요/g, '가족과 함께하는 시간은 따뜻한 화롯불처럼 느껴질 수 있어요')
    .replace(/한 끼·한 안부의 작은 온기가 자기 자리도 따뜻하게 데워 줘요/g, '한 끼와 짧은 안부의 온기가 마음을 따뜻하게 데워 줘요')
    .replace(/같이 차린 한 끼, 함께 본 짧은 영상 한 편 같은 작은 자리 하나가 가족과의 거리를 한 뼘 가깝게 데워 주고, 자기 자리도 자연스럽게 따뜻해져요/g, '같이 차린 한 끼나 함께 본 짧은 영상 하나가 가족과의 거리를 한 뼘 가깝게 만들고, 마음도 자연스럽게 따뜻해져요')
    .replace(/짧은 대화 자리를 정해 두면 좋아요/g, '짧게 이야기할 시간을 정해 두면 좋아요')
    .replace(/길게 보면 청소년기에 마음 신호를 알아차리는 연습이 어른이 된 다음의 단단한 자기 자리를 만들어 줘요/g, '길게 보면 청소년기에 마음 신호를 알아차리는 연습이 어른이 된 다음에도 단단한 마음의 기반이 돼요')
    .replace(/어른과 짧게 나눌 한 마디의 자리도 자기 자리에서 또렷하게 잡혀 가요/g, '어른과 짧게 나눌 한마디도 내 기준 안에서 또렷해져요')
    .replace(/고요한 물가처럼 큰 파도 없이 흐르는 흐름이에요/g, '큰 파도 없이 고요하게 지나가며 자기 페이스를 다듬기 좋은 시기예요')
    .replace(/잔잔한 한 해는 호수의 깊이가 천천히 자라는 시간이에요/g, '변화가 적은 한 해는 생활의 깊이를 천천히 다지는 시간이에요')
    .replace(/큰 파동이 적은 한 해 동안 자기 페이스의 깊이가 한 자리에서 천천히 자라나, 다음 해의 큰 자극에도 자기를 또렷하게 받쳐 줄 토양이 되어요/g, '큰 흔들림이 적은 동안 자기 페이스를 차분히 다져 두면, 다음 해의 큰 자극 앞에서도 나를 받쳐 줄 바탕이 돼요')
    .replace(/자기 컨디션의 흐름을 한 번 가다듬어 두기 좋은 흐름이에요/g, '자기 컨디션을 한 번 가다듬어 두기 좋은 시기예요')
    .replace(/화분에 매일 한 번씩 물을 주는 흐름이에요/g, '화분에 매일 한 번씩 물을 주는 시간이에요')
    .replace(/매일의 작은 챙김이 자라는 흐름을 받쳐 주고/g, '매일의 작은 챙김이 자라는 힘을 받쳐 주고')
    .replace(/자기 컨디션의 흐름을 한 번 살펴 두면 좋은 흐름이에요/g, '자기 컨디션을 한 번 살펴 두면 좋은 시기예요')
    .replace(/관심사를 한 번 더 또렷이 살펴 두기 좋은 흐름이에요/g, '관심사를 한 번 더 또렷이 살펴 두기 좋은 시기예요')
    .replace(/활동성을 살리며 몸을 관리하기 좋은 흐름이에요/g, '활동성을 살리며 몸을 관리하기 좋은 한 해예요')
    .replace(/자격·심화 학습 한 흐름을 매듭짓기 좋은 한 해예요/g, '자격 공부나 심화 학습 한 과정을 매듭짓기 좋은 한 해예요')
    .replace(/평생 컨디션의 흐름이 정리·전환의 색으로 자리 잡아요/g, '평생 컨디션이 정리와 전환의 색을 띠어요')
    .replace(/흐름을 한꺼번에 다 챙기기보다는 매주의 리듬을 차곡차곡 모아 가는 흐름이 잘 맞아요/g, '모든 변화를 한꺼번에 챙기기보다는 매주의 리듬을 차곡차곡 모아 가는 방식이 잘 맞아요')
    .replace(/평생 쌓아 온 흐름을 다음 세대로 천천히 풀어 두는 자리예요/g, '평생 쌓아 온 경험을 다음 사람에게 천천히 나누는 시기예요')
    .replace(/작은 리듬을 한 사람씩 나눠 두는 흐름이 자연스러워요/g, '작은 리듬을 한 사람씩 나누는 방식이 자연스러워요')
    .replace(/친구·가족과 함께 보내는 시간이 흐름을 풍성하게 채워 줘요/g, '친구·가족과 함께 보내는 시간이 하루를 풍성하게 채워 줘요')
    .replace(/평일의 익숙한 호흡, 주말의 짧은 외출 한 번이 흐름을 단단하게 만들어 줘요/g, '평일의 익숙한 호흡과 주말의 짧은 외출 한 번이 한 주를 단단하게 만들어 줘요')
    .replace(/잠들기 전의 다정한 한마디는 한 주 동안 흐름을 곱게 데워 두는 작은 의식이에요/g, '잠들기 전의 다정한 한마디는 한 주의 마음을 곱게 데워 두는 작은 의식이에요')
    .replace(/잔잔한 호수/g, '고요한 물가')
    .replace(/짝과 관련한 큰 결정은 한참 뒤의 이야기로 두고/g, '마음이 가는 친구와의 큰 결론은 서두르지 말고')
    .replace(/사주에 가장 필요한 기운이 물\(水\)인 사람의 (?:인연 자리는|관계 흐름은) 큰 사건의 단정보다, 천천히 스며드는 다정함이 모양을 잡는 (?:흐름|리듬)으로 풀려요/g, '관계에서는 큰 사건보다 천천히 쌓이는 다정함이 더 오래 남을 수 있어요')
    .replace(/사주에 가장 필요한 기운이 쇠\(金\)인 사람의 (?:인연 자리는|관계 흐름은) 한 번에 빠르게 만들어지기보다, 잘 다듬은 도구처럼 천천히 형태를 잡는 모양이에요/g, '관계에서는 한 번에 빠르게 가까워지기보다, 서로의 기준을 천천히 맞추며 신뢰를 쌓는 모습이 잘 어울려요')
    .replace(/여성으로 살아가는 인생 전체의 인연운은 우물처럼 깊은 자리에 마음을 두는 시기가 많아요/g, '인생 전체의 관계 흐름은 깊고 차분한 마음을 오래 품는 시기가 많아요')
    .replace(/남성으로 살아가는 인생 전체의 인연 흐름은 가을바람처럼 담백한 결을 가까이 두는 시기가 많아요/g, '인생 전체의 관계 흐름은 담백하고 분명한 태도가 가까운 관계를 편하게 만드는 시기가 많아요')
    .replace(/인연운/g, '관계 흐름')
    .replace(/인연 흐름/g, '관계 흐름')
    .replace(/인연 자리는/g, '관계는')
    .replace(/빠른 답을 강요받는 자리에서는/g, '빠른 답을 요구받는 상황에서는')
    .replace(/빠른 답을 강요받는 상황에서는/g, '빠른 답을 요구받는 상황에서는')
    .replace(/자기 기준가/g, '자기 기준이')
    .replace(/자기 기준를/g, '자기 기준을')
    .replace(/자기 기준을 가꾸는 일이 가장 큰 좋은 관계의 기억이 돼요/g, '자기 기준을 가꾸는 일이 좋은 관계를 오래 지키는 기반이 돼요')
    .replace(/시간이 자연스럽게 자리를 잡아 줘요/g, '시간이 자연스럽게 맞춰 줄 수 있어요')
    .replace(/친구·가족과 어울리는 자리에서 표정이 밝아져요/g, '친구나 가족과 어울리는 시간에 표정이 밝아져요')
    .replace(/아이는 이번 주 한참 노는 흐름 위에 있어요/g, '아이는 이번 주 놀이와 활동에 깊이 빠지기 쉬워요')
    .replace(/시험·발표 같은 자리에 닿아도/g, '시험이나 발표 같은 순간에도')
    .replace(/정해진 식사 자리/g, '정해진 식사 시간')
    .replace(/사람과 사람 사이의 따뜻한 자리/g, '사람 사이의 따뜻한 관계')
    .replace(/감정과 컨디션이 한 흐름으로 이어진 흐름이라/g, '감정과 컨디션이 서로 이어지는 모습이라')
    .replace(/단정 없이 흐르는 흐름이 가장 좋아요/g, '단정하지 않고 편하게 이어 가는 모습이 가장 좋아요')
    .replace(/단정 없이 흐르는 흐름이 좋아요/g, '단정하지 않고 편하게 이어 가는 모습이 좋아요')
    .replace(/단정 없이 흐르는 게 좋아요/g, '단정하지 않고 편하게 이어 가면 좋아요')
    .replace(/오늘의 한 자리가 길게 남는 흐름이에요/g, '오늘의 한 장면이 오래 기억에 남을 수 있어요')
    .replace(/이번 주의 한 자리가 길게 남는 흐름이에요/g, '이번 주의 한 장면이 오래 기억에 남을 수 있어요')
    .replace(/이번 달의 한 자리가 길게 남는 흐름이에요/g, '이번 달의 한 장면이 오래 기억에 남을 수 있어요')
    .replace(/올해의 한 자리가 길게 남는 흐름이에요/g, '올해의 한 장면이 오래 기억에 남을 수 있어요')
    .replace(/오늘은 다음 세대와의 짧은 자리가 따뜻하게 풀리는 흐름이에요/g, '오늘은 다음 세대와 짧게 마음을 나누기 좋은 날이에요')
    .replace(/올해는 다음 세대로 결을 이어 주는 자리가 깊어지는 한 해예요/g, '올해는 다음 세대에게 경험과 마음을 차분히 전하기 좋은 한 해예요')
    .replace(/그동안의 표현·작업·언어가 다른 사람의 (?:결|흐름)로도 옮아 가기 시작하고, 이끌거나 함께 만드는 자리가 자주 생겨요/g, '그동안의 표현, 작업, 언어가 다른 사람에게도 전해지고, 함께 만드는 기회가 자주 생겨요')
    .replace(/그동안의 표현·작업·언어가 다른 사람의 (?:결|흐름)로도 옮아 가기 시작하고, 이끌어 주거나 함께 만드는 자리가 자연스럽게 자주 생겨요/g, '그동안의 표현, 작업, 언어가 다른 사람에게도 전해지고, 이끌어 주거나 함께 만드는 기회가 자연스럽게 자주 생겨요')
    .replace(/자녀·후배·제자 같은 결과 만나는 자리가 보이지만 어떤 형태인지는 사람마다 다르게 풀어요/g, '자녀, 후배, 제자처럼 이어지는 사람과의 만남이 보일 수 있지만 그 모습은 사람마다 달라요')
    .replace(/자녀·후배·제자 같은 결과 만나는 시기가 보이지만, 어떤 형태인지는 사람마다 다르게 풀어요/g, '자녀, 후배, 제자처럼 이어지는 사람과의 만남이 보일 수 있지만 그 모습은 사람마다 달라요')
    .replace(/무리해서 정리하기보다 자연스러운 만남에 마음을 열어 두면 좋은 자리가 따라와요/g, '무리해서 정리하기보다 자연스러운 만남에 마음을 열어 두면 좋은 장면이 따라와요')
    .replace(/오늘의 한 마디가 다음 분기의 작업으로 이어지는 다리예요/g, '오늘의 한마디가 다음 작업으로 이어지는 다리가 될 수 있어요')
    .replace(/가벼운 관심사 자리를 여러 개 펼쳐 두세요/g, '가벼운 관심사를 몇 가지 열어 두세요')
    .replace(/다음 주의 첫 자리가 자연스럽게 잡혀요/g, '다음 주의 시작점이 자연스럽게 잡혀요')
    .replace(/다음 주의 자리를 또렷하게 잡아 주고/g, '다음 주의 시작점을 또렷하게 잡아 주고')
    .replace(/권유받은 흐름은 한 달 살피면서 리듬을 다시 보면 좋아요/g, '권유받은 일은 한 달 정도 살펴본 뒤 다시 판단해도 좋아요')
    .replace(/권유받은 흐름은 주말까지 살피면서 리듬을 다시 보면 좋아요/g, '권유받은 일은 주말까지 살펴본 뒤 다시 판단해도 좋아요')
    .replace(/인생 전체 흐름에서 흐름이/g, '인생 전체로 보면 흐름이')
    .replace(/새 인연이 들어올 자리도 여전히 열려 있지만/g, '새로운 관계가 생길 가능성도 열려 있지만')
    .replace(/인연 한 줄을 길게 쥔 사람이/g, '사람과의 신뢰를 오래 지킨 사람이')
    .replace(/가족·반려·동료의 자리가 든든하게 자리를 잡고/g, '가족·반려·동료와의 관계가 안정되고')
    .replace(/동료의 자리가 든든하게 자리를 잡고/g, '동료와의 관계가 안정되고')
    .replace(/이번 주의 한 매듭이 다음 분기 작업의 다리예요/g, '이번 주의 작은 마무리가 다음 작업으로 이어지는 다리가 될 수 있어요')
    .replace(/무난한 리듬으로 흐르는 흐름이에요/g, '무난한 리듬으로 이어지는 모습이에요')
    .replace(/흐르는 흐름/g, '이어지는 모습')
    .replace(/오늘 흐름은 활동량이 많아지기 쉬운 흐름이에요\. 여러 일을 한꺼번에 잡고 가는 자리에서 자기 신호를 가볍게 넘기지 않는 게 중요해요/g, '오늘은 활동량이 많아지기 쉬운 하루예요. 여러 일을 한꺼번에 맡을수록 몸의 작은 반응을 가볍게 넘기지 않는 것이 중요해요')
    .replace(/오전엔 조금 빠르게 움직이고, 오후엔 페이스를 한 번 늦추는 자리를 만들어 두는 편이 좋아요\. 식사를 빠르게 넘기지 말고, 따뜻한 한 끼를 천천히 즐기는 자리가 보약이 돼요/g, '오전에는 조금 빠르게 움직여도, 오후에는 일부러 속도를 늦출 시간을 만들어 두면 좋아요. 식사를 빠르게 넘기지 말고 따뜻한 한 끼를 천천히 챙기는 것이 회복에 도움이 돼요')
    .replace(/저녁엔 강한 운동보다 가볍게 풀어 주는 자리가 잘 맞아요/g, '저녁에는 강한 운동보다 가볍게 몸을 풀어 주는 시간이 잘 맞아요')
    .replace(/강한 자극보다 부드러운 풀어 주는 자리가 오늘의 회복 신호예요/g, '강한 자극보다 부드럽게 몸을 풀어 주는 시간이 오늘의 회복에 더 잘 맞아요')
    .replace(/사람과 만나는 자리가 길어지면, 술·과식 자리는 한 번 더 살펴보는 편이 좋아요/g, '사람을 만나는 시간이 길어지면 술이나 과식으로 이어지지 않는지 한 번 더 살피는 편이 좋아요')
    .replace(/같은 자리에 오래 앉아 있는 시간만으로 결정되지 않고, 자기 호흡으로 묶어 두는 한 시간이 더 길게 남아요/g, '오래 앉아 있는 시간만으로 결정되지 않고, 자기 말로 정리한 짧은 시간이 더 길게 남아요')
    .replace(/책상의 자리가 곧 마음의 시간이에요/g, '책상 앞에 앉는 시간은 마음을 정리하는 시간이 될 수 있어요')
    .replace(/자라나는 가지에 햇볕이 잘 드는 자리를(?: 한 번)? 만들어 두는 흐름이에요/g, '자라나는 가지에 햇볕이 잘 들도록 환경을 정리해 주는 모습이에요')
    .replace(/자기 감정을 알아차리고 표현해 보는 자리가 자기 색을 단단하게 만들어요/g, '자기 감정을 알아차리고 표현해 보는 연습이 자기 색을 단단하게 만들어요')
    .replace(/한 박자 쉬어 가는 자리가 잘 맞아요/g, '한 박자 쉬어 가는 시간이 잘 맞아요')
    .replace(/우산 하나가 마음 자리를 부드럽게 만들어 자기 호흡을 따뜻하게 데워 줘요/g, '우산 하나처럼 작은 준비가 마음을 부드럽게 하고 자기 호흡을 따뜻하게 데워 줘요')
    .replace(/그 자리를 챙기는 것 자체가 가장 큰 응원이에요/g, '그 시간을 챙기는 것 자체가 가장 큰 응원이에요')
    .replace(/새 가정의 흐름은 매일의 작은 호흡이 모여 만들어지는 자리라, 한 끼를 함께하고, 안부 한마디를 나누는 흐름이 자연스러워요/g, '새 가정의 관계는 매일의 작은 약속이 모여 만들어져요. 한 끼를 함께하고 안부 한마디를 나누는 방식이 자연스럽게 어울려요')
    .replace(/오늘의 작은 자리가 다음 주의 든든한 흐름으로 이어져요/g, '오늘의 작은 시간이 다음 주의 든든한 리듬으로 이어져요')
    .replace(/든든한 다리가 자연스레 자리를 잡아 줘요/g, '든든한 연결이 자연스럽게 만들어져요')
    .replace(/이번 달의 직업운은 익숙한 페이스로 자리를 키워 가는 흐름이에요/g, '이번 달에는 익숙한 페이스 안에서 기반을 넓혀 가는 모습이에요')
    .replace(/세 달치 메모를 한 자리에 모아 두면 자기 흐름의 강·약 자리가 자연스럽게 드러나고/g, '세 달치 메모를 한곳에 모아 두면 강점과 약점이 자연스럽게 드러나고')
    .replace(/한 해의 작은 자리에서 잠·식사·움직임 한 가지씩 자기 페이스가 잡혀 가는 자취예요/g, '한 해 동안 잠, 식사, 움직임을 하나씩 살피며 자기 페이스를 잡아 가는 모습이에요')
    .replace(/시험 시기·발표 자리에 자기 신호가 빨리 들리는 한 해이니/g, '시험 시기나 발표 순간에 자기 신호가 빨리 들리는 한 해이니')
    .replace(/매일의 작은 자리를 따뜻하게 누리는 흐름이 잘 맞아요/g, '매일의 작은 시간을 따뜻하게 누리는 방식이 잘 맞아요')
    .replace(/감정과 컨디션이 서로 이어지는 모습이라, 평생 마음 자리를 따뜻하게 챙기는 일이 가장 큰 보약이에요/g, '감정과 컨디션은 서로 이어져 있어서, 평생 마음을 따뜻하게 돌보는 일이 몸에도 큰 도움이 돼요')
    .replace(/전체적으로 큰 굴곡 없이, 자리를 단단히 잡아 가는 시기예요\. 한 박자 늦추는 자리만 챙기면 마음·몸 모두 든든히 흘러가요/g, '전체적으로 큰 굴곡 없이 생활의 기준을 단단히 잡아 가는 시기예요. 속도를 한 번 늦출 시간만 챙겨도 몸과 마음이 더 안정적으로 이어져요')
    .replace(/오늘은 일과 사이의 짧은 학습 자리를 챙기기 좋은 흐름이에요/g, '오늘은 일과 사이의 짧은 학습 시간을 챙기기 좋은 날이에요')
    .replace(/이번 주의 학업(?:운| 방향| 결)은 일과 사이의 짧은 학습 자리를 하나로 엮어 두기 좋은 (?:흐름|때)(?:이에요|예요)/g, '이번 주 공부는 일과 사이의 짧은 학습 시간을 하나로 묶어 가기 좋은 때예요')
    .replace(/출퇴근 길의 한 챕터, 점심 후 10분의 정리, 잠들기 전의 한 페이지 같은 자리가 의외로 큰 깊이를 만들어요/g, '출퇴근 길의 한 챕터, 점심 후 10분의 정리, 잠들기 전의 한 페이지처럼 짧은 시간이 공부의 깊이를 만들어 줘요')
    .replace(/출퇴근 길의 한 챕터, 점심 후 10분의 정리, 잠들기 전의 한 페이지 같은 자리가 일주일을 묶어 줘요/g, '출퇴근 길의 한 챕터, 점심 후 10분의 정리, 잠들기 전의 한 페이지처럼 짧은 시간이 일주일의 공부 리듬을 만들어 줘요')
    .replace(/일과 가족 사이의 짧은 자리들이 한 달을 묶어 줘요/g, '일과 가족 사이의 짧은 학습 시간이 한 달의 공부 리듬을 만들어 줘요')
    .replace(/일과 가족 사이의 짧은 자리들이 한 해를 묶어 줘요/g, '일과 가족 사이의 짧은 학습 시간이 한 해의 공부 리듬을 만들어 줘요')
    .replace(/한 달을 닫는 자리에서/g, '한 달을 마무리할 때')
    .replace(/비유하자면 오늘은 도예가가 손에 쥔 흙을 천천히 다듬어 두는 자리예요\. 굳이 큰 모양을 잡지 않아도 손끝의 작은 매만짐이 다음 자리의 단단한 형태를 자연스럽게 만들어 줘요\./g, '비유하자면 오늘은 손에 쥔 흙을 천천히 다듬듯 작은 정리를 해 두는 날이에요. 굳이 큰 모양을 잡지 않아도 작은 매만짐이 다음 단계의 단단한 형태를 만들어 줘요.')
    .replace(/비유하자면 오늘은 큰 다리를 한 번에 짓기보다 한 칸 한 칸 디딤돌을 놓는 자리예요\. 한 장의 마무리, 한 줄의 정리가 다음 디딤돌의 자리를 미리 준비해 주니, 작은 단위가 가장 잘 맞아요\./g, '비유하자면 오늘은 큰 다리를 한 번에 짓기보다 디딤돌을 하나씩 놓는 날이에요. 한 장의 마무리와 한 줄의 정리가 다음 단계를 미리 준비해 주니, 작은 단위가 가장 잘 맞아요.')
    .replace(/매주 같은 시간에 같은 자리에 앉아 한 결씩 정리해 두는 식/g, '매주 같은 시간에 앉아 한 줄씩 정리해 두는 방식')
    .replace(/친구와 함께 풀어 보는 자리가 도움이 될 때도 있고, 혼자 조용히 정리하는 자리가 깊이를 만드는 리듬도 있어요/g, '친구와 함께 풀어 보는 시간이 도움이 될 때도 있고, 혼자 조용히 정리하는 시간이 깊이를 만드는 리듬도 있어요')
    .replace(/한 학기를 닫는 자리에서/g, '한 학기를 마무리할 때')
    .replace(/비유하자면 한 해의 학습은 작은 등불을 한 칸씩 옮겨 켜는 자리예요\. 등불 한 칸이 또렷해지면 다음 칸도 자연스레 밝아지듯, 분기마다 한 줄씩 정리한 노트가 자기 자리의 빛을 한 해 단위로 단단하게 받쳐 줘요\./g, '비유하자면 한 해의 학습은 작은 등불을 한 칸씩 옮겨 켜는 과정이에요. 등불 한 칸이 또렷해지면 다음 칸도 밝아지듯, 분기마다 한 줄씩 정리한 노트가 한 해의 공부를 단단하게 받쳐 줘요.')
    .replace(/자기 자리를 가꾸는 흐름/g, '자기 마음을 가꾸는 시간')
    .replace(/다음 자리/g, '다음 단계')
    .replace(/자기 자리/g, '자기 기준')
    .replace(/좋은 흐름이에요/g, '좋은 때예요')
    .replace(/자리예요/g, '시간이에요');
}

function applyPolishedPublicVariants(value: string, ctx: StandardDepthEnhancementContext): string {
  return value
    .replace(
      /일과 가족의 역할이 함께 커지는 시기라 한쪽으로 무게가 쏠리지 않게 자기 호흡을 두면 좋아요\. 표현력이 단단해지는 만큼 가까운 사람과 나누는 시간도 자연스럽게 넓어지고, 그 흐름이 다음 세대에 닿는 리듬의 토대가 돼요\./g,
      pickVariant(ctx, 'sourceExpressionRoleBalance', [
        '일과 가족의 역할이 함께 커지는 때에는 한쪽으로만 힘을 몰지 않는 기준이 필요해요. 가까운 사람과 나눌 말과 쉬어 갈 시간을 함께 두면 표현도 관계도 더 오래 안정돼요.',
        '표현력이 단단해질수록 곁의 사람과 나누는 시간도 중요해져요. 일의 속도와 가족 안의 역할을 함께 조절하면 내 경험이 다음 사람에게도 편안한 기준으로 남아요.',
        '일과 가족, 자기 표현이 같이 넓어지는 시기에는 모두를 혼자 이끌려 하지 않아도 괜찮아요. 나눌 수 있는 말과 함께 보낼 시간을 작게 정하면 부담이 줄어요.',
        '가까운 사람에게 전해질 말이 많아지는 때예요. 일에만 치우치지 않도록 생활의 호흡을 나누면, 쌓아 온 표현이 관계 안에서도 따뜻하게 살아나요.',
        '역할이 커질수록 자기 호흡을 지키는 일이 더 중요해요. 가까운 사람과 나눌 시간, 내가 계속할 작업, 잠시 쉬어 갈 기준을 따로 보면 균형이 잡혀요.',
        '표현이 깊어지는 만큼 가족이나 가까운 사람에게 닿는 방식도 함께 살펴보세요. 작은 대화와 함께 만든 시간이 나중에는 오래 남는 도움으로 이어질 수 있어요.',
      ]),
    )
    .replace(
      /약속이나 대화를 잡을 때도 상대의 여유 시간을 함께 살피는 태도가 도움이 돼요\./g,
      pickVariant(ctx, 'sourceRomanceClosing', [
        '약속이나 대화를 잡을 때는 내 마음만 보지 말고 상대가 편한 시간도 함께 살펴보세요. 서로의 여유가 맞아야 관계도 덜 급해져요.',
        '대화를 이어 갈 때는 빨리 확인하는 것보다 부담이 적은 시간을 고르는 태도가 더 도움이 돼요. 상대의 여유를 보면 말도 부드럽게 남아요.',
        '약속을 정할 때는 하고 싶은 말보다 서로 편한 시간대를 먼저 보는 편이 좋아요. 여유가 있어야 작은 대화도 관계를 더 편하게 만들어 줘요.',
        '관계에서는 마음이 앞설수록 시간의 여유를 같이 봐야 해요. 무리한 약속보다 편하게 만날 수 있는 순간을 고르면 안정감이 오래 남아요.',
        '상대가 대화할 여유가 있는지 살피는 태도는 관계를 지키는 작은 배려예요. 그 여유가 보이면 마음을 전하는 말도 덜 무겁게 닿아요.',
      ]),
    )    .replace(
      /가을 들판이 한 흐름으로 익듯, 그동안의 시도들이 한꺼번에 익는 시기예요\. 다음 세대에게 무언가를 이어 주고 싶다는 마음도 자연스럽게 깊어지는데, 어떤 모양이 될지는 사람마다 다르게 풀려요\./g,
      pickVariant(ctx, 'sourceExpressionAutumnHarvest', [
        '가을 들판이 천천히 익어 가듯, 그동안 남긴 말과 작업이 뒤늦게 의미를 얻는 때예요. 다음 사람에게 무엇을 전할지는 한 가지 모양으로 정하지 않아도 괜찮아요.',
        '오래 해 온 시도들이 한꺼번에 결과처럼 보일 수 있어요. 중요한 것은 큰 유산을 만들겠다는 부담보다, 필요한 사람에게 편한 크기로 나누는 태도예요.',
        '쌓아 온 표현이 익어 가며 누군가에게 도움이 될 수 있어요. 자녀, 후배, 가까운 사람에게 무엇이 전해질지는 사람마다 다르니 자연스럽게 나누면 좋아요.',
        '이 시기에는 새로 증명하기보다 이미 쌓은 것을 차분히 정리하는 힘이 커져요. 남길 말과 보여 줄 작업을 작게 고르면 부담 없는 도움으로 전해질 수 있어요.',
        '그동안의 시도는 사라지지 않고 경험의 결실로 남아요. 누군가에게 이어 줄 마음이 생긴다면 짧은 조언, 함께한 시간, 정리된 기록부터 시작해도 충분해요.',
      ]),
    )
    .replace(
      /좋은 선생·책·동료를 만나면 그 도움으로 가까운 분야부터 길이 열려요\. 무리하게 끌고 가기보다 휴식과 학습의 리듬을 짜 두는 것이 결국 더 멀리 가는 길이에요\./g,
      pickVariant(ctx, 'sourceMentor', [
        '좋은 선생, 책, 동료를 만나면 배움의 길이 훨씬 덜 외로워져요. 혼자 밀어붙이기보다 물어볼 사람과 쉬어 갈 시간을 함께 두면 더 오래 이어 갈 수 있어요.',
        '도움을 줄 사람이나 자료가 가까이 있으면 배움은 더 현실적인 힘을 얻어요. 바로 큰 결과를 내기보다 질문할 곳과 다시 볼 범위를 정해 두세요.',
        '배움은 혼자 버티는 힘만으로 길어지지 않아요. 좋은 책과 사람을 곁에 두고, 작게 묻고 쉬어 가는 리듬을 만들면 방향이 더 또렷해져요.',
        '믿을 만한 조언과 자료를 만나는 것이 큰 도움이 될 수 있어요. 다만 조언을 그대로 삼키기보다 내 상황에 맞게 줄여 쓰는 편이 오래 남아요.',
        '좋은 사람과 좋은 자료는 배움의 속도를 무리하게 올리기보다 길을 덜 헤매게 해 줘요. 가까운 주제부터 묻고 정리하면 다음 단계가 보이기 쉬워요.',
      ]),
    )    .replace(
      /자기 무대를 처음 만들어 보는 시기예요\. 글·영상·디자인·기획처럼 내 안의 것을 바깥으로 내보내는 결이 본격적으로 시작돼요\./g,
      pickVariant(ctx, 'sourceExpressionSmallWorks', [
        '자기 표현을 처음 본격적으로 밖에 꺼내 보는 시기예요. 글, 영상, 디자인, 기획처럼 마음속에 있던 것을 작은 결과물로 만들어 보는 경험이 중요해져요.',
        '이 시기에는 내 안의 생각을 밖으로 꺼내는 연습이 시작돼요. 글, 영상, 디자인, 기획처럼 편한 도구를 고르면 표현이 막연한 꿈이 아니라 실제 경험으로 남아요.',
        '처음부터 큰 무대를 만들 필요는 없어요. 글 한 편, 짧은 영상, 작은 디자인처럼 손에 잡히는 작업이 자기 표현의 시작점이 돼요.',
        '내가 좋아하는 장면과 생각을 밖으로 보여 주는 힘이 자라기 시작해요. 표현 방식은 하나로 정하지 않아도 되고, 여러 도구를 천천히 만져 봐도 좋아요.',
        '이 시기의 표현은 잘 보이기 위한 결과보다 내 생각을 안전하게 꺼내 보는 경험에 가까워요. 작은 작업을 남기면 다음에 더 다듬을 기준도 생겨요.',
      ]),
    )
    .replace(
      /잘 자란 화분이 처음 바깥 햇볕을 받는 것처럼, 시행착오 끝에 자기 색이 한 단계 또렷해져요\. 작은 결과물이라도 꾸준히 쌓으면 다음 단계로 가는 디딤돌이 돼요\./g,
      pickVariant(ctx, 'sourceExpressionSmallWorks', [
        '작은 화분을 더 넓은 창가로 옮기듯, 이 시기에는 내 표현을 조금씩 밖에 보여 보는 일이 도움이 돼요. 서툰 결과물도 쌓이면 다음 작업을 고르는 기준이 돼요.',
        '처음 만든 결과물은 완벽하지 않아도 괜찮아요. 남겨 둔 글, 그림, 영상, 아이디어가 모이면 내가 어떤 표현에 끌리는지 훨씬 또렷하게 보여요.',
        '시행착오는 표현이 자라는 자연스러운 과정이에요. 한 번에 잘하려 하기보다 작은 결과물을 꾸준히 남기면 자기 색이 천천히 분명해져요.',
        '작은 작업을 반복하면 내 표현의 장점과 부족한 점이 같이 보여요. 그 확인이 쌓여야 다음 단계에서 더 편하게 선택할 수 있어요.',
        '이 시기에는 결과의 크기보다 계속 남기는 힘이 더 중요해요. 짧은 기록 하나라도 꾸준히 모으면 자기 색을 찾는 좋은 자료가 돼요.',
        '표현은 실패 없이 자라지 않아요. 마음에 들지 않는 결과물도 날짜와 함께 남겨 두면, 나중에는 어떻게 달라졌는지 알려 주는 기준이 돼요.',
        '작은 결과물은 당장 크게 보이지 않아도 다음 선택을 돕는 발판이 돼요. 무엇이 편했고 무엇이 어려웠는지 알면 표현의 방향도 덜 흔들려요.',
        '밖에 보여 본 경험이 조금씩 쌓이면 자신감도 현실적으로 자라요. 가까운 사람의 반응과 내 느낌을 함께 기록하면 다음 작업이 더 쉬워져요.',
      ]),
    )
    .replace(
      /너무 큰 무대만 노리기보다 가까운 사람들에게 먼저 보여 보는 흐름이 잘 맞아요\. 이 시기의 시도들이 30대 자기 색의 뼈대가 돼요\./g,
      pickVariant(ctx, 'sourceExpressionSmallWorks', [
        '처음부터 큰 무대를 목표로 삼기보다 가까운 사람에게 먼저 보여 보는 편이 좋아요. 편한 반응을 받아 보며 다듬은 경험이 나중의 자기 색을 받쳐 줘요.',
        '표현은 큰 인정만으로 자라지 않아요. 믿을 만한 사람에게 작게 보여 주고 다시 고쳐 보는 시간이 30대 이후의 기준을 만들어 줘요.',
        '가까운 사람에게 먼저 보여 보면 부담이 줄고, 어떤 부분이 잘 닿는지도 더 쉽게 알 수 있어요. 이런 작은 시도가 나중의 표현 방향을 단단하게 해 줘요.',
        '큰 무대가 아니어도 충분히 배울 수 있어요. 친구, 동료, 가족처럼 안전한 사람 앞에서 꺼내 본 경험이 오래 남는 표현의 뼈대가 돼요.',
        '나중의 자기 색은 갑자기 완성되지 않아요. 지금 작게 보여 주고, 반응을 듣고, 다시 다듬는 과정이 오래 갈 기준을 만들어 줘요.',
        '먼저 가까운 사람에게 보여 주는 것은 작은 시험에 가까워요. 무엇을 계속하고 무엇을 줄일지 알게 되면 표현이 훨씬 현실적인 힘을 얻어요.',
      ]),
    )
    .replace(
      /계약·법률문서·자격 갱신이 인생의 기준을 잡아 주는 흐름이에요\. 서명 한 장의 무게를 잘 느끼는 시기가 자주 찾아와요\./g,
      pickVariant(ctx, 'sourceStudyDocumentBackup', [
        '계약서, 증명서, 자격 갱신처럼 기준을 확인해야 하는 일이 인생 곳곳에서 중요하게 떠올라요. 서명하기 전 한 번 더 읽는 습관이 생활을 안정적으로 지켜 줘요.',
        '기록과 서류가 생활의 방향을 정리해 주는 순간이 자주 찾아올 수 있어요. 계약, 갱신, 증명처럼 이름이 어려운 일도 결국 날짜와 조건을 확인하는 과정이에요.',
        '중요한 결정 앞에서 문서를 차분히 보는 힘이 큰 기준이 돼요. 서명 한 장을 가볍게 넘기지 않고 조건을 확인하는 태도가 후회를 줄여 줘요.',
        '인생의 중간중간에는 말보다 기록이 더 필요한 순간이 생겨요. 계약서, 자격, 증명 자료를 차분히 챙기는 습관이 관계와 일을 함께 지켜 줘요.',
        '서류를 꼼꼼히 다루는 힘은 딱딱한 성격이 아니라 생활을 보호하는 기준이에요. 중요한 약속은 말로만 남기지 않고 확인 가능한 형태로 두는 편이 좋아요.',
      ]),
    )
    .replace(
      /잘 다진 흙 위에 단단한 기둥을 세우는 그림을 떠올려 보면 좋아요\. 한 번 잘 새긴 계약이 몇 년의 흐름을 받쳐 주는 기준이 돼요\./g,
      pickVariant(ctx, 'sourceStudyDocumentBackup', [
        '비유하자면 집을 짓기 전에 기초를 다시 살피는 모습이에요. 한 번 확인한 계약과 기록은 몇 년 뒤에도 판단할 기준이 되어 줘요.',
        '서류는 눈앞의 종이 한 장처럼 보여도 생활의 기준을 오래 받쳐 줄 수 있어요. 처음 확인할 때 날짜와 조건을 분명히 해 두면 나중의 부담이 줄어요.',
        '단단한 기준은 큰 결정보다 작은 확인에서 시작돼요. 이름, 날짜, 금액, 책임 범위를 차분히 보면 문서가 생활을 지켜 주는 도구가 돼요.',
        '한 번 잘 정리한 계약은 오래 쓰는 지도처럼 남아요. 필요한 순간에 다시 꺼내 볼 수 있어야 약속도 관계도 덜 흔들려요.',
        '기록은 쌓아 두기만 하면 힘이 약해져요. 어디에 있고 무엇을 뜻하는지 알아볼 수 있게 정리해 두어야 몇 년 뒤에도 도움이 돼요.',
        '서류의 힘은 어려운 말보다 다시 확인할 수 있다는 데 있어요. 필요한 사람이 같은 내용을 보고 이해할 수 있으면 기준이 더 안정돼요.',
      ]),
    )
    .replace(
      /잘 풀리는 면은, 한 분야의 기준을 또렷이 잡는 일이에요\. 작은 조항도 꼼꼼히 보는 습관이 큰 결정 앞에서 자기 무기가 돼요\./g,
      pickVariant(ctx, 'sourceStudyDocumentBackup', [
        '잘 풀리는 면은 한 분야의 기준을 차분히 세우는 힘이에요. 작은 조건을 놓치지 않는 습관이 큰 결정 앞에서 나를 지켜 주는 기준이 돼요.',
        '좋은 점은 세부 조건을 그냥 넘기지 않는 태도예요. 작은 날짜, 금액, 책임 범위를 확인하는 습관이 큰 약속 앞에서 실수를 줄여 줘요.',
        '한 분야를 오래 다루다 보면 무엇을 꼭 확인해야 하는지 감이 생겨요. 그 감을 체크리스트로 남기면 다음 결정이 훨씬 안전해져요.',
        '잘 맞는 방향은 기준을 말로만 두지 않고 확인 가능한 형태로 남기는 거예요. 작은 조항 하나를 살피는 습관이 큰 선택의 부담을 낮춰 줘요.',
        '강점은 꼼꼼함을 생활의 보호 장치로 쓰는 데 있어요. 귀찮아 보여도 다시 읽는 한 번이 나중의 오해와 비용을 줄여 줄 수 있어요.',
      ]),
    )
    .replace(
      /살짝 주의할 점은, 친한 사이에서 서류를 생략하는 면이에요\. 가까울수록 종이 한 장이 관계를 지켜 주는 힘이에요\./g,
      pickVariant(ctx, 'sourceStudyDocumentBackup', [
        '살짝 주의할 점은 가까운 사이라는 이유로 기록을 생략하는 일이에요. 친할수록 약속을 짧게라도 남겨 두면 관계를 더 편하게 지킬 수 있어요.',
        '가까운 사람과의 약속일수록 말만 믿고 지나가기 쉬워요. 날짜, 금액, 역할을 간단히 적어 두면 나중에 서로 덜 서운해져요.',
        '친한 사이에서 서류를 남기는 일은 의심이 아니라 배려가 될 수 있어요. 서로 기억이 달라질 때 확인할 기준이 있으면 관계가 덜 흔들려요.',
        '주의할 점은 중요한 약속을 분위기에 맡기는 거예요. 짧은 메모나 메시지 하나라도 남겨 두면 오해가 커지기 전에 확인할 수 있어요.',
        '가까운 관계에서는 말이 편한 만큼 기준이 흐려지기 쉬워요. 부담 없는 기록을 남겨 두면 돈, 시간, 책임을 둘러싼 갈등을 줄일 수 있어요.',
      ]),
    )
    .replace(
      /한 번 손에 잡은 자격은 갱신·확장으로 오래 가는 자산이 돼요\./g,
      pickVariant(ctx, 'sourceStudyAsset', [
        '한 번 얻은 자격이나 기록은 갱신하고 보완할수록 오래 쓰는 생활의 자산이 돼요.',
        '자격과 기록은 한 번 받고 끝나는 것이 아니에요. 필요한 때에 갱신하고 정리해 두면 다음 선택에서도 힘이 돼요.',
        '손에 들어온 자격은 잘 보관하고 다시 확인할 때 더 오래 힘을 발휘해요. 갱신일과 활용할 곳을 함께 적어 두면 좋아요.',
        '중요한 기록은 시간이 지나도 다시 꺼내 쓸 수 있어야 가치가 커져요. 갱신할 날짜와 확장할 방향을 남겨 두면 생활의 기준이 돼요.',
        '자격이나 증명 자료는 다음 단계로 넘어갈 때 다시 쓰일 수 있어요. 지금부터 보관, 갱신, 활용 방법을 나누어 두면 훨씬 든든해요.',
      ]),
    )
    .replace(
      /길게 보면 청소년기의 한 번의 표현 시도가 어른이 된 자기 색의 첫 자료가 돼요\. 짧은 영상, 작은 그림, 한 편의 글처럼 남아 있는 자료가 한 해 한 해 자기 기준을 또렷하게 만들어 줘요\./g,
      pickVariant(ctx, 'sourceExpressionSmallWorks', [
        '길게 보면 지금 남긴 작은 표현이 나중의 나를 설명해 주는 자료가 될 수 있어요. 짧은 영상, 그림, 글 한 편을 모아 두면 무엇을 좋아했는지 더 쉽게 알 수 있어요.',
        '청소년기의 작은 작업은 완성도가 높지 않아도 의미가 있어요. 시간이 지난 뒤 다시 보면 그때의 마음과 취향이 보여서 자기 기준을 잡는 데 도움이 돼요.',
        '지금 만든 표현을 지우지 말고 한곳에 모아 두면 좋아요. 짧은 기록들이 쌓이면 어른이 되었을 때 내 색이 어떻게 자라 왔는지 보여 주는 자료가 돼요.',
        '지금의 표현은 완성된 작품보다 나중에 다시 볼 수 있는 흔적이라는 점에서 의미가 있어요. 마음이 움직인 장면을 남겨 두면 시간이 지나 자기 색을 이해하는 데 도움이 돼요.',
        '짧게 만든 결과물도 그냥 지나치지 말고 모아 두면 좋아요. 나중에 보면 어떤 말투, 색, 장면을 좋아했는지 알 수 있어서 자기 기준이 더 또렷해져요.',
        '청소년기의 표현은 잘해야만 가치가 생기는 것이 아니에요. 시도한 흔적 자체가 취향을 알아보는 기록이 되고, 다음 창작을 고르는 작은 기준이 돼요.',
        '작은 작업이 쌓이면 나중에는 자기만의 지도처럼 보일 수 있어요. 그때 무엇에 끌렸고 어떤 방식이 편했는지 알면 표현의 방향도 덜 흔들려요.',
        '한 번의 시도가 작아 보여도 마음이 움직였다는 증거가 될 수 있어요. 그런 증거가 모이면 남과 비교하기보다 내 취향을 믿는 힘이 자라요.',
      ]),
    )
    .replace(
      /책임·약속의 흐름이 강하면 가족·반려·동료와의 관계가 안정되고, 표현·매력의 흐름이 강하면 사람을 끌어당기는 힘이 꾸준히 이어져요\. 어느 쪽이든 무리한 비교나 단정만 피하면, 관계의 리듬이 큰 흠 없이 흘러가요\./g,
      pickVariant(ctx, 'sourceRomanceLifeExpression', [
        '관계를 오래 지키는 힘이 강하면 가족, 반려, 동료와의 약속이 안정적으로 이어져요. 표현하는 힘이 강하면 사람을 끌어당기는 매력도 꾸준히 살아나니, 비교보다 내 관계의 속도를 보는 편이 좋아요.',
        '가까운 관계에서는 책임감과 표현력이 서로 다른 방식으로 힘이 돼요. 약속을 지키는 태도는 안정감을 만들고, 마음을 드러내는 태도는 관계를 더 따뜻하게 이어 줘요.',
        '관계의 바탕이 단단한 사람은 가족이나 동료와의 약속에서 신뢰를 쌓기 쉬워요. 동시에 표현하는 힘이 살아 있으면 새로운 만남에서도 편안한 매력이 자연스럽게 드러나요.',
        '오래 가는 관계는 책임만으로도, 매력만으로도 완성되지 않아요. 약속을 지키는 힘과 마음을 표현하는 힘이 함께 있을 때 관계가 덜 흔들리고 더 편안해져요.',
        '가족, 반려, 동료와의 관계는 작은 약속을 지키는 데서 안정돼요. 사람을 끌어당기는 힘은 말투와 표정, 자주 건네는 표현 속에서 천천히 드러날 수 있어요.',
        '관계에서 중요한 축이 두 가지로 보일 수 있어요. 하나는 약속을 지키는 안정감이고, 다른 하나는 마음을 자연스럽게 보여 주는 표현력이라서 둘을 비교하기보다 균형 있게 쓰는 편이 좋아요.',
        '책임을 다하는 태도가 강하면 가까운 사람에게 믿음을 주기 쉬워요. 표현하는 힘이 강하면 마음을 전하는 장면이 많아지니, 어느 쪽이든 무리하게 증명하려 하지 않아도 괜찮아요.',
        '관계의 안정감은 오래 지킨 약속에서 생기고, 관계의 따뜻함은 작은 표현에서 자라요. 둘 중 하나만 정답으로 보지 말고 내 생활에서 가능한 방식부터 살피면 좋아요.',
      ]),
    )
    .replace(
      /전체적으로 균형을 되찾는 루틴을 자주 만들수록 좋아지는 흐름이에요\. 마음의 짐을 내려놓는 시간을 챙기면 자연스럽게 단단해져요\./g,
      pickVariant(ctx, 'sourceStressOverall', [
        '전체적으로는 마음의 균형을 되찾는 시간을 자주 만들수록 좋아져요. 짐을 한꺼번에 내려놓으려 하기보다 하루에 한 가지씩 덜어 내면 마음이 천천히 단단해져요.',
        '이 흐름은 큰 변화보다 균형을 회복하는 작은 루틴에 힘이 있어요. 쉬는 시간, 편한 대화, 가벼운 움직임을 자주 남겨 두면 마음의 바탕이 안정돼요.',
        '마음의 짐을 오래 들고 있지 않도록 중간중간 내려놓는 시간이 필요해요. 짧게 걷거나 믿을 만한 사람과 말 한마디를 나누는 것만으로도 균형이 돌아올 수 있어요.',
        '전체적으로는 무리해서 버티는 힘보다 다시 균형을 맞추는 힘이 더 중요해요. 부담을 줄일 시간과 회복할 습관을 정해 두면 마음이 덜 흔들려요.',
        '마음이 무거워질 때마다 작게 돌아올 기준을 만들어 두면 좋아요. 잠, 식사, 대화처럼 익숙한 루틴이 회복의 중심을 다시 잡아 줘요.',
      ]),
    )
    .replace(
      /친구 따라 떠난 짧은 여행도, 한 학기 동안의 새 학교 생활도 모두 평생의 자산이 돼요\. 두려운 마음보다 호기심을 앞세우면, 새 환경이 더 빨리 친근해져요\./g,
      pickVariant(ctx, 'sourceMovementNearby', [
        '짧은 여행이나 새 학교 생활은 낯선 곳을 겁내지 않는 연습이 돼요. 처음엔 어색해도 본 풍경, 만난 사람, 새로 해 본 일이 나중에 선택할 길을 넓혀 줘요.',
        '새 환경을 만날 때마다 자기 기준이 조금씩 또렷해질 수 있어요. 친구와의 작은 외출이나 새로운 교실에서의 경험도 시간이 지나면 든든한 기억이 돼요.',
        '이동과 변화는 멀리 떠나는 일만 뜻하지 않아요. 새로운 반, 다른 동네, 짧은 체험처럼 작은 변화도 시야를 넓히고 자신감을 키우는 재료가 돼요.',
        '낯선 환경이 처음부터 편하지 않아도 괜찮아요. 호기심을 조금 남겨 두고 천천히 익숙해지면, 새 장소에서 배운 감각이 오래 남는 자산이 돼요.',
        '친구와 함께한 짧은 외출도 나중에는 중요한 기억이 될 수 있어요. 어디가 좋았고 무엇이 낯설었는지 한 줄만 남겨도 다음 변화가 덜 두려워져요.',
      ]),
    )
    .replace(
      /다만 너무 자주 환경을 바꾸면 한 호흡이 짧아지기 쉬워요\. 익숙해질 시간을 한 번 충분히 가지면, 다음 새 환경이 더 단단해져요\./g,
      pickVariant(ctx, 'sourceMovementReturnBase', [
        '다만 변화를 너무 자주 만들면 마음이 쉴 틈을 잃을 수 있어요. 새 환경에 익숙해질 시간을 충분히 두면 다음 변화도 훨씬 안정적으로 받아들일 수 있어요.',
        '새 장소가 좋아 보여도 머무는 시간이 함께 필요해요. 한곳에서 충분히 배우고 난 뒤 움직이면 변화가 가볍게 흩어지지 않고 자기 경험으로 남아요.',
        '자주 바꾸는 것보다 하나의 환경을 천천히 익히는 시간이 중요할 때가 있어요. 익숙해지는 과정이 있어야 다음 선택도 더 단단해져요.',
        '낯선 곳을 많이 만나는 만큼 돌아와 쉬는 기준도 필요해요. 새 환경에서 배운 것을 정리할 시간이 있어야 변화가 부담보다 자신감으로 남아요.',
      ]),
    )
    .replace(
      /마음을 봄날의 새싹에 비유하면, 자랄 공간이 넓을수록 한 번씩 흔들리는 게 자연스러워요\. 흔들림 자체가 자라는 신호라는 감각이 평생 큰 도움이 돼요\./g,
      pickVariant(ctx, 'sourceTeenHealthSeed', [
        '마음을 새싹에 비유하면, 자라는 동안 흔들리는 날이 있는 게 자연스러워요. 흔들림을 실패로 보지 않고 쉬어 갈 신호로 보면 마음을 더 편하게 돌볼 수 있어요.',
        '마음이 자라는 시기에는 기분이 들쭉날쭉할 수 있어요. 그럴 때 자신을 탓하기보다 잠, 대화, 가벼운 움직임으로 다시 중심을 찾는 연습이 도움이 돼요.',
        '새싹이 바람을 맞으며 단단해지듯 마음도 여러 경험 속에서 조금씩 자라요. 힘든 날이 있어도 가까운 어른에게 말하고 쉬어 가면 회복하는 법을 배울 수 있어요.',
        '마음의 공간이 넓어질수록 새 감정도 많이 들어와요. 낯선 감정을 무서워하기보다 이름을 붙여 보고, 편한 사람과 나누면 흔들림이 덜 커져요.',
      ]),
    )
    .replace(
      /전체적으로 큰 무리수만 피하면 마음이 단단히 자라는 시기예요\. 가까운 어른과 가벼운 대화를 나누는 시간이 길게 보면 큰 자산이 돼요\./g,
      pickVariant(ctx, 'sourceTeenHealthSignal', [
        '전체적으로는 무리한 선택만 피해도 마음이 충분히 단단해질 수 있어요. 가까운 어른과 짧게 이야기하는 습관이 쌓이면 힘든 날에도 혼자 버티지 않게 돼요.',
        '마음이 자라는 시기에는 큰 결심보다 안전하게 말할 수 있는 사람이 중요해요. 답을 바로 찾지 못해도 편하게 말하는 시간이 오래 도움이 돼요.',
        '큰 문제로 키우기 전에 작은 신호를 나누는 연습이 필요해요. 짜증, 답답함, 피곤함을 짧게 말할 수 있으면 마음의 부담이 훨씬 줄어요.',
        '이 시기에는 마음을 혼자만 들고 있지 않는 것이 큰 자산이에요. 가족이나 믿을 만한 어른과 가볍게 나눈 대화가 나중에도 회복의 기준이 될 수 있어요.',
      ]),
    )
    .replace(
      /잘 풀리는 것은 잠과 산책이에요\. 햇빛 아래 짧은 산책이 또렷한 효과를 내요\./g,
      pickVariant(ctx, 'sourceTeenHealthRhythm', [
        '잠과 가벼운 산책은 단순해 보여도 몸과 마음의 리듬을 다시 잡는 데 도움이 돼요. 피곤한 날에는 더 몰아붙이기보다 쉬고 걷는 기본부터 챙겨 보세요.',
        '햇빛을 보며 짧게 걷고 충분히 자는 일은 생각보다 큰 회복 기준이 돼요. 컨디션이 흔들릴 때는 새 계획보다 이 기본을 먼저 살피면 좋아요.',
        '잠과 산책이 잘 맞는다는 말은 거창한 관리를 하라는 뜻이 아니에요. 몸이 편해지는 쉬운 습관을 반복하면 하루의 흔들림이 줄어들어요.',
      ]),
    )
    .replace(
      /잘 풀리는 것은 잠과 산책이에요\. 큰 처방보다 충분한 수면, 햇빛 아래 짧은 산책 같은 기본기가 또래보다 더 뚜렷한 효과를 내요\./g,
      pickVariant(ctx, 'sourceTeenHealthRhythm', [
        '잘 풀리는 쪽은 거창한 관리보다 잠과 가벼운 움직임에 있어요. 충분히 자고 햇빛을 보며 짧게 걸으면 마음의 속도도 조금씩 안정돼요.',
        '몸과 마음은 어려운 방법보다 기본 리듬에 먼저 반응할 때가 많아요. 잠을 챙기고 가볍게 걷는 습관이 쌓이면 하루의 흔들림도 덜 커져요.',
        '특별한 처방을 찾기 전에 잠자는 시간과 움직이는 시간을 먼저 살펴보세요. 햇빛을 조금 쬐고 몸을 움직이는 일만으로도 마음이 더 또렷해질 수 있어요.',
        '잠과 산책은 단순해 보여도 청소년기에는 큰 힘이 돼요. 피곤한 날에는 더 몰아붙이기보다 쉬고 걷는 기본부터 챙기는 편이 좋아요.',
      ]),
    )
    .replace(
      /비유하자면 작은 화분에 새싹을 키우는 그림이에요\. 매일 조금씩 물을 주는 습관이 큰 나무로 자라는 토대가 돼요\./g,
      pickVariant(ctx, 'sourceWealthWell', [
        '비유하자면 작은 씨앗을 매일 돌보는 모습이에요. 용돈을 한 번에 크게 아끼려 하기보다 조금씩 기록하고 기다리는 습관이 나중의 기준을 키워 줘요.',
        minorStageReaderVariant(ctx,
          '돈 습관은 작은 화분을 돌보는 일과 비슷해요. 오늘 고른 것과 기다린 것을 보호자와 이야기하다 보면 선택의 뿌리가 천천히 튼튼해져요.',
          '10대의 돈 습관은 작은 화분을 돌보는 일과 비슷해요. 무엇을 바로 쓰고 무엇을 기다릴지 배운 경험이 나중의 돈 기준을 천천히 튼튼하게 만들어 줘요.',
        ),
        '작은 선택을 매일 돌보면 나중에 큰 기준으로 자라요. 용돈을 썼는지, 기다렸는지, 다음에 다시 볼지 적어 두는 일이 좋은 시작이에요.',
        '비유하자면 물을 조금씩 주며 새싹을 살피는 시간이에요. 갖고 싶은 마음을 잠깐 기다려 보고 이유를 말해 보는 습관이 돈 관리의 바탕이 돼요.',
      ]),
    )
    .replace(
      /잘 풀리는 지점은 작은 모음의 즐거움을 알아갈 때예요\. 용돈을 어디에 썼는지 적어 두는 작은 기록이 오래 도움이 되는 돈 습관이 돼요\./g,
      pickVariant(ctx, 'sourceWealthPace', [
        '잘 풀리는 지점은 작은 기록을 재미있게 느끼는 데 있어요. 용돈을 어디에 썼고 무엇을 기다렸는지 짧게 남기면 다음 선택이 더 쉬워져요.',
        minorStageReaderVariant(ctx,
          '작은 돈 습관은 기록에서 자라요. 오늘 쓴 것, 아낀 것, 다음에 사고 싶은 것을 한 줄로 나누면 아이도 자기 기준을 조금씩 알게 돼요.',
          '작은 돈 습관은 기록에서 자라요. 그 시기에 쓴 것, 아낀 것, 다음에 사고 싶었던 것을 나누어 보던 경험이 나중의 기준을 조금씩 만들어 줘요.',
        ),
        '용돈 관리는 금액을 크게 아는 것보다 선택을 기억하는 데서 시작돼요. 어디에 썼는지 짧게 말해 보면 다음에는 더 편하게 고를 수 있어요.',
        '잘한 선택과 기다린 선택을 함께 적어 두면 돈을 쓰는 감각이 자라요. 작은 기록이 쌓이면 나중에 필요한 것과 갖고 싶은 것을 나누기 쉬워져요.',
      ]),
    )
    .replace(
      /주의할 점은 즉흥적인 큰 소비예요\. 한 번에 다 쓰기보다는, 한 박자 미뤘다 결정하는 습관을 익혀 두면 좋아요\./g,
      pickVariant(ctx, 'sourceWealthPace', [
        '주의할 점은 갖고 싶은 것을 보자마자 바로 고르는 마음이에요. 한 박자 기다렸다가 내일도 필요한지 다시 보면 선택이 훨씬 차분해져요.',
        minorStageReaderVariant(ctx,
          '한 번에 다 쓰고 싶은 마음이 들 때는 잠깐 멈추는 연습이 좋아요. 보호자와 다시 이야기해 보고 필요한 이유를 말해 보면 결정이 더 쉬워져요.',
          '한 번에 다 쓰고 싶은 마음이 들 때 잠깐 멈추는 연습이 중요했어요. 필요한 이유를 말로 정리해 본 경험이 나중의 큰 선택에서도 속도를 늦춰 줘요.',
        ),
        '즉흥적인 소비는 처음엔 즐겁지만 나중에 아쉬움이 남을 수 있어요. 잠깐 기다렸다 고르는 습관이 생기면 용돈을 더 편하게 관리할 수 있어요.',
        '사고 싶은 마음이 크게 올라올수록 바로 고르지 않는 힘이 필요해요. 목록에 적어 두고 하루 뒤 다시 보면 진짜 필요한지 더 잘 보여요.',
      ]),
    )
    .replace(
      /습관이 자라는 시기예요\. 작은 기록이 쌓이는 즐거움을 천천히 알아 가면 충분해요\./g,
      pickVariant(ctx, 'sourceWealthPace', [
        '지금은 좋은 돈 습관이 천천히 자라는 시기예요. 작은 기록과 짧은 기다림을 반복하면 자기 기준이 자연스럽게 생겨요.',
        '습관은 한 번에 만들어지지 않아도 괜찮아요. 오늘 하나 적고, 다음에 한 번 더 기다려 보는 경험이 쌓이면 충분히 좋은 기준이 돼요.',
        minorStageReaderVariant(ctx,
          '작은 기록이 쌓이면 아이도 자기가 무엇을 좋아하고 무엇을 기다릴 수 있는지 알게 돼요. 그 감각이 오래 가는 돈 습관의 바탕이 돼요.',
          '작은 기록이 쌓이면 내가 무엇을 좋아하고 무엇을 기다릴 수 있는지 알게 돼요. 그 감각은 시간이 지나도 돈을 다루는 바탕으로 남아요.',
        ),
        '지금은 돈을 잘 아는 것보다 선택을 천천히 살피는 힘을 기르는 때예요. 기록하고 기다리는 경험이 쌓이면 다음 선택도 더 편안해져요.',
      ]),
    )
    .replace(
      /잘 풀리는 방향은 정리와 나눔이 자연스러울 때예요\. 가족·후배·이웃과 나누는 방식이 생활의 기반을 더 단단하게 만들어요\./g,
      pickVariant(ctx, 'sourceWealthSharing', [
        '정리와 나눔이 잘 맞을 때는 먼저 남길 기준을 작게 정해 보세요. 돈, 물건, 약속을 따로 적어 두면 누구에게 무엇을 전하면 좋을지 훨씬 편하게 보일 수 있어요.',
        '가족이나 후배에게 무언가를 나눌 때는 양보다 기준이 더 중요해요. 왜 남기고, 왜 나누는지 차분히 말해 두면 받는 사람도 부담보다 고마움을 더 크게 느껴요.',
        '나눔은 많이 주는 일이 아니라 서로 편안한 크기를 고르는 일이에요. 지금 내 생활을 지키면서 필요한 사람에게 알맞게 전하면 관계도 돈의 흐름도 더 안정돼요.',
        '오래 쌓아 온 것을 정리할 때는 마음이 앞서기 쉬워요. 먼저 내게 꼭 필요한 것과 다른 사람에게 더 잘 쓰일 것을 나누어 보면 결정이 한결 부드러워져요.',
        '가까운 사람에게 전할 것이 있다면 물건보다 기준을 함께 남겨 보세요. 어떤 마음으로 나누는지 말해 두면 관계도 생활도 더 편안하게 이어져요.',
        '정리와 나눔은 한꺼번에 끝낼 일이 아니에요. 오늘 남길 것 하나와 나눌 것 하나만 정해도 지나온 선택의 가치가 더 선명해져요.',
      ]),
    )
    .replace(
      /올해는 한 분야의 자료, 책, 짧은 시도를 한 줄씩 모아 두면 미래의 선택지가 조금씩 선명해지는 한 해예요\. 한 가지 관심사를 깊이 따라가는 시간이 어른의 직업 이름에 갇히지 않은 자기 방향을 만들어 줘요\./g,
      pickVariant(ctx, 'sourceLifeCareerTeenNotebook', [
        '올해는 관심 있는 분야의 자료와 짧은 시도를 모아 보며 나에게 맞는 균형을 찾기 좋은 한 해예요. 재미있게 오래 집중되는 일과 부담이 커지는 일을 나누어 보면 미래의 선택지도 훨씬 선명해져요.',
        '한 가지 관심사를 깊이 따라가되 생활 리듬이 무너지지 않는지도 함께 살펴보면 좋아요. 자료, 책, 짧은 시도를 한 줄씩 모으면 직업 이름보다 먼저 나에게 맞는 방향이 보여요.',
        '올해 진로 탐색은 관심사를 많이 모으는 것에서 끝나지 않아요. 즐거움, 피로, 주변 도움의 균형을 함께 적어 두면 어른의 직업 이름에 갇히지 않은 자기 방향이 만들어져요.',
        '관심 분야를 따라갈 때는 무엇이 재미있는지와 무엇이 부담스러운지를 같이 보세요. 두 가지를 한 줄씩 남기면 나에게 맞는 속도와 다음 선택이 더 현실적으로 보여요.',
        '올해는 작은 시도들을 모아 내 기준을 찾는 시간이 잘 맞아요. 책, 영상, 짧은 활동을 기록하면서 마음이 편한 리듬과 힘든 리듬을 나누면 진로 감각이 더 단단해져요.',
      ]),
    )
    .replace(
      /잘하는 것보다 좋아하는 활동을 먼저 알아 두면, 어른이 되었을 때 고를 길의 단서가 생겨요\. (?:직업 이름|어른의 직업 단어)에 너무 빨리 자기를 끼워 맞추지 않아도 괜찮아요\./g,
      pickVariant(ctx, 'sourceLifeCareerTeenSpring', [
        '좋아하는 활동을 먼저 알아 두면 나중에 길을 고를 때 훨씬 덜 막막해져요. 직업 이름에 나를 빨리 맞추기보다, 어떤 순간에 오래 집중했는지 천천히 모아 보세요.',
        '지금은 직업 이름을 빨리 정하는 시기라기보다 내 마음이 움직이는 활동을 알아 가는 시기예요. 좋아하는 과목, 편한 역할, 칭찬받은 장면을 적어 두면 나중의 단서가 돼요.',
        '잘하는 일만 찾으려 하면 진로가 좁게 느껴질 수 있어요. 좋아해서 다시 해 보고 싶은 활동과 시간이 잘 가는 순간을 모으면 선택할 길이 더 현실적으로 보여요.',
        '어른이 되었을 때의 길은 지금 당장 한 단어로 정하지 않아도 괜찮아요. 좋아하는 활동을 해 본 경험, 어렵지만 다시 해 보고 싶은 경험이 쌓이면 방향이 천천히 또렷해져요.',
        '진로는 빠른 정답보다 반복해서 마음이 가는 장면을 찾는 과정에 가까워요. 좋아하는 활동을 기록해 두면 나중에 어떤 일을 더 알아볼지 자연스럽게 보여요.',
        '좋아하는 활동을 알아 둔다는 것은 직업을 빨리 정한다는 뜻이 아니에요. 내 마음이 오래 머무는 장면을 모아 두면 나중에 선택할 길이 조금씩 선명해져요.',
        '지금은 어른의 직업 단어보다 내가 편하게 몰입하는 순간을 보는 편이 더 좋아요. 그런 순간을 놓치지 않고 적어 두면 진로 고민이 덜 막막해져요.',
        '좋아하는 일과 잘 맞는 환경을 함께 살피면 나중의 선택이 더 현실적이에요. 오늘은 시간이 빨리 지나간 활동 하나만 기억해 두어도 충분해요.',
        '진로를 한 번에 정하려 하면 부담이 커질 수 있어요. 그래서 먼저 좋아하는 활동, 다시 해 보고 싶은 활동, 조금 힘들었던 활동을 나누어 보는 편이 좋아요.',
        '어른이 된 뒤의 길은 지금의 작은 흥미에서 단서가 생길 수 있어요. 직업 이름보다 반복해서 마음이 가는 행동을 먼저 알아 두면 선택이 부드러워져요.',
      ]),
    )
    .replace(
      /일과 사람 사이의 균형이 큰 자산이 되는 흐름이라, 너무 한쪽으로만 기울지 않으면 좋아요\. 지금 역할에서의 작은 결정이 다음 단계의 폭을 만든다는 점을 기억하면, 한 번씩 들어오는 변화 앞에서 흔들림이 적어요\./g,
      pickVariant(ctx, 'sourceCareerMidlifeTrust', [
        '일과 사람 사이의 균형은 이 시기에 꼭 확인할 기준이에요. 한쪽 책임만 크게 붙잡기보다 내가 맡을 일과 나눌 일을 구분하면 다음 변화 앞에서도 덜 흔들려요.',
        '지금 역할에서 하는 작은 결정들이 다음 단계의 폭을 만들 수 있어요. 그래서 일의 성과뿐 아니라 함께 일하는 사람과의 기준도 차분히 맞춰 두는 편이 좋아요.',
        '일을 잘하는 힘과 사람을 오래 지키는 힘이 함께 필요해지는 시기예요. 무리해서 한쪽으로 기울기보다 역할, 시간, 도움받을 사람을 나누어 두면 안정감이 커져요.',
        '변화가 들어올 때마다 바로 크게 움직이기보다 지금 맡은 책임의 크기부터 확인해 보세요. 함께할 사람과 확인할 기준이 있으면 다음 선택도 훨씬 편해져요.',
        '일과 관계의 균형을 기준으로 삼아야 해요. 성과만 밀어붙이면 주변과의 호흡이 흔들릴 수 있으니, 작은 결정일수록 누구와 나눌지 먼저 생각해 보세요.',
      ]),
    )
    .replace(
      /주의할 점은 큰 한 방을 좇는 권유예요\. 자기 페이스를 지키는 것이 가장 단단한 선택이에요\./g,
      pickVariant(ctx, 'sourceWealthPace', [
        '주의할 점은 높은 수익을 서둘러 약속하는 제안이에요. 조건이 좋아 보여도 바로 움직이지 말고, 금액과 기간, 내가 감당할 책임을 다시 확인해 보세요.',
        '큰 이익을 한 번에 얻자는 말이 들어오면 잠시 멈추는 편이 좋아요. 내 기준과 맞는지 하루 더 살피면 불필요한 부담을 줄일 수 있어요.',
        '돈 문제에서는 빠른 확신보다 확인할 시간이 더 중요해요. 제안이 매력적으로 들릴수록 실제 부담과 조건을 차분히 다시 보는 편이 좋아요.',
        '좋은 기회처럼 보여도 내 생활을 흔들 정도라면 속도를 늦춰야 해요. 크게 벌리기보다 지킬 수 있는 기준 안에서 움직이는 쪽이 더 안전해요.',
        '누군가 빨리 결정하라고 재촉한다면 한 발 물러서서 보는 편이 좋아요. 믿을 만한 사람과 조건을 함께 확인하면 선택이 훨씬 차분해져요.',
      ]),
    )
    .replace(
      /주의할 점은 큰 한 방을 좇는 권유예요\. 큰 권유는 (?:일주일|한 달) 살피(?:면서|며) 기준이 맞는지 다시 확인하면 좋아요\./g,
      pickVariant(ctx, 'sourceWealthPace', [
        '주의할 점은 높은 수익을 서둘러 약속하는 제안이에요. 조건이 좋아 보여도 바로 움직이지 말고, 금액과 기간, 내가 감당할 책임을 다시 확인해 보세요.',
        '큰 이익을 한 번에 얻자는 말이 들어오면 잠시 멈추는 편이 좋아요. 내 기준과 맞는지 며칠 더 살피면 불필요한 부담을 줄일 수 있어요.',
        '돈 문제에서는 빠른 확신보다 확인할 시간이 더 중요해요. 제안이 매력적으로 들릴수록 실제 부담과 조건을 차분히 다시 보는 편이 좋아요.',
        '좋은 기회처럼 보여도 내 생활을 흔들 정도라면 속도를 늦춰야 해요. 크게 벌리기보다 지킬 수 있는 기준 안에서 움직이는 쪽이 더 안전해요.',
        '누군가 빨리 결정하라고 재촉한다면 한 발 물러서서 보는 편이 좋아요. 믿을 만한 사람과 조건을 함께 확인하면 선택이 훨씬 차분해져요.',
      ]),
    )
    .replace(
      /인생 전체의 직업운은 맡은 역할을 단단히 받쳐 가며 깊어지는 모양이에요\. 결정의 무게가 늘어나는 시기라, 결정을 함께 의논할 사람을 일찍 정해 두면 흔들림이 줄어요\./g,
      pickVariant(ctx, 'sourceCareerMidlifeTrust', [
        '인생 전체의 일과 책임은 맡아 온 역할이 경험과 신뢰로 깊어지는 시기예요. 결정의 무게가 커질수록 혼자 빠르게 정하기보다 함께 의논할 사람을 미리 정해 두면 흔들림이 줄어요.',
        '이 시기의 일은 더 많이 벌리는 것보다 이미 맡아 온 역할을 안정적으로 다듬는 쪽에 가까워요. 중요한 결정을 앞둘수록 혼자 판단하지 말고 믿을 만한 사람과 기준을 나누어 보세요.',
        '오래 맡아 온 책임이 실력과 평판으로 이어지는 시기예요. 결정해야 할 일이 무거워질수록 조언을 구할 사람과 확인할 순서를 미리 정해 두면 훨씬 안정적이에요.',
        '인생 전체의 일의 방향은 맡은 역할의 깊이가 신뢰로 바뀌는 모습이에요. 큰 결정을 혼자 떠안기보다 함께 의논할 기준을 만들어 두면 후반의 선택이 더 단단해져요.',
      ]),
    )
    .replace(
      /큰 결정이 다른 사람의 길에 영향 주는 시기라, 결정의 무게를 너무 빠르게 결재하지 말고 하루 한 박자만 늦춰 두면 후회가 줄어요\. 자기 분야 밖의 새 관점을 한 줄씩 더해 두면 후반에 길이 좁아지지 않아요\./g,
      pickVariant(ctx, 'sourceCareerMidlifeTrust', [
        '큰 결정이 다른 사람에게도 영향을 줄 수 있는 시기라면, 혼자 빠르게 끝내려 하지 않는 편이 좋아요. 하루만 더 확인하고 믿을 만한 사람과 기준을 나누면 후회가 줄어요.',
        '결정이 무거울수록 속도를 늦추는 태도가 필요해요. 영향 받을 사람과 확인할 순서를 먼저 떠올리면 책임도 덜 흔들리고, 선택의 폭도 좁아지지 않아요.',
        '중요한 결정 앞에서는 바로 결론을 내리기보다 한 박자 쉬어 가세요. 자기 분야 밖의 관점도 조금씩 더해 두면 후반의 길이 더 넓게 남아요.',
        '큰 선택을 앞둘수록 혼자 감당하려 하기보다 함께 볼 사람을 정해 두면 좋아요. 새 관점을 한 줄씩 더해 두는 습관이 뒤늦은 후회를 줄여 줘요.',
      ]),
    )
    .replace(
      /단단해진 만큼 후배의 길잡이가 되는 자리도 함께 자라요\./g,
      pickVariant(ctx, 'sourceCareerMidlifeTrust', [
        '쌓인 경험을 필요한 사람에게 나누는 역할도 함께 커져요. 조언을 건넬 때는 정답을 대신 정하기보다 확인할 기준을 함께 보여 주면 좋아요.',
        '이제는 성과를 내는 힘뿐 아니라 경험을 나누는 힘도 중요해져요. 후배나 동료가 길을 고를 때, 내가 겪은 기준을 차분히 들려주는 것만으로도 도움이 돼요.',
        '단단해진 경험은 혼자만의 자산으로 끝나지 않아요. 필요한 사람에게 방향을 함께 살펴 주면 그동안 쌓아 온 신뢰가 더 넓게 쓰일 수 있어요.',
        '역할이 깊어진 만큼 누군가에게 기준을 나누는 일도 자연스럽게 늘어요. 가르치려 하기보다 함께 확인해 주는 태도가 더 오래 신뢰를 남겨요.',
      ]),
    )
    .replace(
      /작은 여행·짧은 출장이 자기 리듬을 회복시켜 줘요\. 큰 변화는 한 번에 하지 않고 단계를 나눠 가면, 호흡이 흐트러지지 않아요\./g,
      pickVariant(ctx, 'sourceMovementNearby', [
        '가까운 외출이나 짧은 일정만으로도 생활 리듬이 환기될 수 있어요. 큰 변화를 한 번에 만들기보다 짧은 변화를 나누어 두면 몸과 마음이 덜 흔들려요.',
        '멀리 움직이지 않아도 리듬을 바꿀 방법은 있어요. 짧은 외출, 다른 길로 걷기, 하루짜리 일정처럼 작게 움직이면 변화가 부담보다 회복으로 남아요.',
        '이동은 거창하지 않아도 충분해요. 가까운 곳을 다녀오거나 평소와 다른 길을 걸어 보는 것만으로도 막혀 있던 기분이 조금 풀릴 수 있어요.',
        '짧은 이동도 생활의 공기를 바꾸는 데 충분할 수 있어요. 가까운 길을 다른 시간에 걷거나, 익숙한 장소를 천천히 다녀오는 것만으로도 마음이 환기돼요.',
        '큰 여행이 아니어도 몸을 조금 옮기면 생각의 방향이 달라질 수 있어요. 부담 없는 거리에서 시작하면 변화가 피로보다 회복에 가까워져요.',
        '가까운 외출은 작은 실험처럼 써 볼 수 있어요. 비용과 시간을 크게 쓰지 않아도 어떤 움직임이 나에게 편한지 확인할 수 있어요.',
        '평소의 길을 조금 다르게 걷는 것만으로도 막힌 기분이 풀릴 때가 있어요. 중요한 것은 멀리 가는지보다 돌아와도 무리가 없는 크기예요.',
        '큰 변화를 한 번에 만들 필요는 없어요. 짧은 이동을 몇 번으로 나누면 생활 리듬을 지키면서도 새로운 자극을 편하게 받아들일 수 있어요.',
      ]),
    )
    .replace(/잠자리·식사 자리·움직임 자리 세 가지를 자기 식대로 챙기는 편이 좋아요\./g, '잠, 식사, 움직임 세 가지를 자기 생활에 맞게 챙기는 편이 좋아요.')
    .replace(/잠 자리·식사 자리·움직임 자리 세 가지를 자기 식대로 챙기는 편이 좋아요\./g, '잠, 식사, 움직임 세 가지를 자기 생활에 맞게 챙기는 편이 좋아요.')
    .replace(/주중에는 짧은 산책이나 가벼운 환기 자리를 자주 만들어 두면 좋아요\./g, '주중에는 짧은 산책이나 가볍게 환기하는 시간을 자주 만들어 두면 좋아요.')
    .replace(/잠 자리는 평소보다 한 시간 일찍 잡으면/g, '잠자는 시간은 평소보다 한 시간 일찍 잡으면')
    .replace(/마음 자리를/g, '마음을')
    .replace(/주말엔 큰 강행군 대신 마음 편한 자리에서 보내는 시간이 잘 맞아요\./g, '주말에는 큰 강행군보다 마음이 편한 사람이나 공간에서 쉬는 시간이 잘 맞아요.')
    .replace(/따뜻한 식사와 가까운 사람과의 짧은 자리가 회복의 결을 단단히 잡아 줘요\./g, '따뜻한 식사와 가까운 사람과의 짧은 대화가 회복감을 안정시켜 줘요.')
    .replace(/오후엔 짧은 환기 자리가 컨디션을 단단히 받쳐 줘요\./g, '오후에는 짧게 환기하고 쉬는 시간이 컨디션을 안정시켜 줘요.')
    .replace(/주말엔 충분한 잠과 마음 편한 자리에서 보내는 시간이 보약이에요\./g, '주말에는 충분한 잠과 마음이 편한 시간이 회복에 도움이 돼요.')
    .replace(/(오늘은|이번 주는|이번 달은|올해는) 가까운 사람의 손길이 내 자리를 자주 받쳐 주는 (하루|시기|한 해)예요\./g, '$1 가까운 사람의 도움이 생활을 든든하게 받쳐 줄 수 있는 $2예요.')
    .replace(/오늘은 가까운 사람의 작은 손길이 내 자리를 부드럽게 받쳐 주는 하루예요\./g, '오늘은 가까운 사람의 작은 도움이 생활을 부드럽게 받쳐 줄 수 있는 하루예요.')
    .replace(
      /삼십 대 남성의 재물운은 가족·일·자기 사이에서 흐름을 잡는 시기예요\. 어느 자리에 무게를 둘지 정리하면 자산도 함께 리듬을 잡아요\./g,
      pickVariant(ctx, 'sourceWealthStandard', [
        '30대에는 돈과 생활 관리가 가족, 일, 나 자신 사이의 균형을 정하는 과정에 가까워요. 어디에 더 힘을 둘지 먼저 정리하면 지출과 저축의 기준도 함께 또렷해져요.',
        '이 시기의 돈 관리는 수입만 보는 일이 아니라 시간과 책임을 함께 나누는 일이에요. 가족, 일, 나를 위한 기준을 따로 적어 보면 돈의 흐름도 훨씬 현실적으로 보여요.',
        '30대에는 돈이 어디로 쓰이는지보다 왜 그쪽으로 무게가 실리는지 보는 일이 중요해져요. 생활의 우선순위를 정리하면 자산 관리도 더 차분해져요.',
      ]),
    )
    .replace(
      /비유하자면 자라나는 나무에 가지치기를 더하는 흐름이에요\. 모든 가지를 다 키우려 하면 뿌리가 부족해지지만, 굵은 가지 두세 개에 집중하면 단단한 리듬이 자리 잡아요\./g,
      pickVariant(ctx, 'sourceWealthStandard', [
        '비유하자면 가지가 많이 뻗은 나무를 차분히 정리하는 모습이에요. 모든 일을 다 키우려 하기보다 중요한 두세 가지에 힘을 모으면 생활의 뿌리가 더 단단해져요.',
        '비유하자면 여러 방향으로 뻗는 가지 중 오래 키울 가지를 고르는 시간이에요. 돈, 일, 가족의 부담을 모두 크게 잡기보다 핵심을 정하면 생활 리듬이 안정돼요.',
        '비유하자면 나무가 더 건강하게 자라도록 가지를 고르는 과정이에요. 지금 가장 중요한 책임을 두세 가지로 좁히면 지출과 에너지도 덜 흩어져요.',
      ]),
    )
    .replace(/잘 풀리는 방향은 장기 관점이 등장할 때예요\. 짧은 결과보다 5년 뒤를 그리는 결정이 흐름을 키워요\./g, '잘 풀리는 방향은 눈앞의 이익보다 긴 계획을 함께 볼 때예요. 5년 뒤에도 부담 없이 유지할 선택인지 확인하면 돈의 기준이 더 단단해져요.')
    .replace(/주의할 점은 가족·일 사이에서 무게가 한쪽에 몰릴 때예요\. 한 자리에서 무리하면 다른 자리도 흔들리기 쉬워요\./g, '주의할 점은 가족과 일 중 한쪽으로 부담이 몰릴 때예요. 한쪽에서 무리하면 지출, 시간, 마음의 균형이 함께 흔들릴 수 있어요.')
    .replace(/어깨에 자리가 많은 시기지만, 한 자리씩 차분히 다듬으면 충분히 흐름을 잡아 갈 수 있어요\./g, '책임이 많은 시기지만, 부담을 한꺼번에 정리하려 하지 않아도 괜찮아요. 가장 급한 항목부터 차분히 다듬으면 돈과 생활의 균형을 다시 잡아 갈 수 있어요.')
    .replace(/어깨에 자리가 많은 시기지만, 한 자리씩 차분히 다듬으면 한 해의 흐름이 단단해져요\./g, '책임이 많은 한 해라도 모든 부담을 한꺼번에 정리할 필요는 없어요. 가장 급한 항목부터 차분히 다듬으면 한 해의 돈과 생활 기준이 더 단단해져요.')
    .replace(
      /잘 풀리는 방향은 정리와 나눔이 자연스러울 때예요\. 자녀·후배·이웃과 나누는 방식이 생활의 기반을 더 단단하게 만들어요\./g,
      pickVariant(ctx, 'sourceWealthSharing', [
        '좋은 흐름은 내가 가진 기준을 필요한 사람과 나눌 때 더 또렷해져요. 물건이나 돈보다 먼저 어떤 마음으로 나눌지 정하면 생활의 안정감도 함께 커져요.',
        '남길 것과 나눌 것을 차분히 고르면 그동안의 선택이 더 분명한 가치로 남아요. 가족, 후배, 이웃에게 필요한 만큼만 전해도 충분히 따뜻한 흐름이 만들어져요.',
        '정리한 물건이나 기준을 필요한 곳에 보내는 과정이 이 시기의 장점이에요. 많이 내어 주기보다 서로 부담 없는 크기로 나눌 때 오래 편안하게 이어져요.',
        '정리와 나눔이 잘 맞을 때는 먼저 남길 기준을 작게 정해 보세요. 돈, 물건, 약속을 따로 적어 두면 누구에게 무엇을 전하면 좋을지 훨씬 편하게 보일 수 있어요.',
        '가족이나 후배에게 무언가를 나눌 때는 양보다 기준이 더 중요해요. 왜 남기고, 왜 나누는지 차분히 말해 두면 받는 사람도 부담보다 고마움을 더 크게 느껴요.',
        '나눔은 많이 주는 일이 아니라 서로 편안한 크기를 고르는 일이에요. 지금 내 생활을 지키면서 필요한 사람에게 알맞게 전하면 관계도 돈의 흐름도 더 안정돼요.',
        '오래 쌓아 온 것을 정리할 때는 마음이 앞서기 쉬워요. 먼저 내게 꼭 필요한 것과 다른 사람에게 더 잘 쓰일 것을 나누어 보면 결정이 한결 부드러워져요.',
      ]),
    )
    .replace(
      /가족이나 이웃과 마음에 남은 문장을 나누면 배움이 혼자만의 시간이 아니라 따뜻한 대화가 돼요\. 책 한 권을 빨리 끝내기보다 한 달 동안 천천히 읽고 생각을 나누는 방식이 잘 맞아요\./g,
      pickVariant(ctx, 'sourceAcademicSharing', [
        '가족이나 이웃에게 마음에 남은 문장을 들려주면 배움이 혼자만의 일이 아니라 편안한 대화가 돼요. 많이 읽기보다 한 문장을 오래 나누는 방식도 충분히 좋아요.',
        '오늘 읽은 내용을 가까운 사람과 짧게 나누면 배움이 생활 속 기쁨으로 이어져요. 책 한 권을 서둘러 끝내기보다 마음에 남은 부분을 천천히 이야기해 보세요.',
        '배움은 혼자 쌓아 두는 것보다 나눌 때 더 오래 남아요. 가족, 이웃, 친구에게 한 줄만 설명해도 내가 이해한 내용이 더 또렷해질 수 있어요.',
      ]),
    )
    .replace(
      /같은 책을 읽지 않아도 배움은 나눌 수 있어요\. 마음에 남은 문장 하나를 들려주거나 짧은 생각을 주고받는 것만으로도 생활 속 즐거움이 커져요\./g,
      pickVariant(ctx, 'sourceAcademicSharingDetail', [
        '같은 책을 읽지 않아도 배움은 충분히 나눌 수 있어요. 마음에 남은 한 문장을 들려주고, 왜 좋았는지 짧게 말하면 대화가 자연스럽게 깊어져요.',
        '배움은 함께 같은 속도로 읽어야만 나눌 수 있는 것이 아니에요. 오늘 알게 된 점 하나를 편하게 말해 보면 가까운 사람과의 대화도 더 따뜻해져요.',
        '마음에 남은 문장 하나를 가족이나 친구에게 들려주는 것만으로도 배움이 생활 안으로 들어와요. 긴 설명보다 짧은 감상 한마디가 더 오래 남을 수 있어요.',
        '읽은 것을 전부 설명하려 하지 않아도 괜찮아요. 좋았던 문장, 새로 떠오른 생각, 다시 보고 싶은 부분 중 하나만 나누면 배움이 대화로 이어져요.',
        '배움의 즐거움은 혼자 간직할 때보다 가볍게 나눌 때 더 커질 수 있어요. 오늘 마음에 든 말 한 줄을 전하면 그 자체로 충분한 공부가 돼요.',
        '새로 알게 된 내용을 가족이나 친구에게 짧게 말해 보면 배움이 훨씬 오래 남아요. 완벽하게 설명하지 않아도, 왜 마음에 남았는지만 나누면 충분해요.',
        '배운 것을 생활에 붙이는 가장 쉬운 방법은 한 사람에게 편하게 들려주는 거예요. 한 줄 감상이나 작은 질문만 나눠도 생각이 더 또렷해져요.',
        '혼자 읽은 내용도 누군가와 나누면 다른 각도에서 다시 보일 수 있어요. 오늘 배운 말 하나와 아직 궁금한 점 하나를 짧게 나누어 보세요.',
        '배움은 책상 위에만 머물지 않아도 돼요. 가까운 사람과 짧은 대화를 나누면 기억이 정리되고 다음에 더 보고 싶은 부분도 자연스럽게 보여요.',
        '공부한 내용을 산책길이나 식사 자리에서 한 문장으로 말해 보면 배움이 훨씬 오래 남아요. 길게 설명하지 않아도, 내 말로 바꾸는 순간 이해가 단단해져요.',
        '배움은 조용히 읽는 시간뿐 아니라 누군가와 나누는 말 속에서도 자라요. 오늘 새로 알게 된 것 하나를 쉽게 말해 보면 기억이 더 선명해져요.',
        '책상 밖에서 떠오른 생각도 좋은 배움의 일부예요. 산책, 대화, 짧은 메모 속에서 마음에 남은 내용을 붙잡으면 다음 공부가 더 자연스럽게 이어져요.',
        '가까운 사람에게 오늘 배운 점 하나를 말해 보세요. 설명이 길지 않아도 그 과정에서 내가 이해한 부분과 더 볼 부분이 또렷해져요.',
        '같은 내용을 몰라도 대화는 시작될 수 있어요. 내가 새로 알게 된 점을 쉬운 말로 바꾸어 말하면 배움이 내 생활의 언어로 바뀌어요.',
        '읽고 배운 것을 나눌 때는 길게 설명하기보다 마음에 남은 장면 하나를 고르면 좋아요. 그 장면을 말로 꺼내는 순간 배움이 더 살아나요.',
      ]),
    )
    .replace(
      /잘 익은 가을 햇살처럼 따스한 흐름이에요\. 다음 세대와 함께 보내는 시간은 그 자체로 소중하고, 어떤 모양이든 무리하지 않고 흘러가는 흐름이 가장 좋아요\./g,
      pickVariant(ctx, 'sourceExpressionAutumnLight', [
        '따뜻한 오후처럼 오래 곁에 머무는 힘이 커지는 때예요. 무엇을 증명하려 애쓰기보다 편히 듣고 함께 웃는 시간이 가까운 사람에게 더 오래 남아요.',
        '오래 쌓인 표현은 큰 무대가 없어도 전해질 수 있어요. 함께 웃고, 짧게 이야기하고, 예전 기억을 꺼내는 시간이 가까운 사람에게 따뜻한 흔적으로 남아요.',
        '가을 햇살처럼 차분한 온기가 어울리는 때예요. 무리해서 특별한 결과를 만들기보다, 지금 가진 이야기와 마음을 부담 없는 크기로 나누면 좋아요.',
        '차분히 익어 가는 계절처럼, 지금은 새로 증명하기보다 이미 가진 마음을 편하게 나누는 쪽이 잘 맞아요. 짧은 이야기와 따뜻한 시간이 충분한 표현이 될 수 있어요.',
        '오래 머문 햇빛처럼 부드러운 표현이 힘을 얻는 때예요. 큰 결과를 만들려 하기보다 가까운 사람에게 남길 말과 함께할 시간을 작게 고르면 좋아요.',
        '이 시기의 표현은 화려한 성과보다 편안한 온기에서 더 오래 남아요. 내가 지나온 이야기와 마음을 부담 없는 크기로 나누면 가까운 사람도 편하게 받아들여요.',
        '따뜻하게 익은 오후처럼 말과 마음을 천천히 나누기 좋은 흐름이에요. 특별한 무대를 만들지 않아도 함께 웃고 들어 주는 시간이 좋은 표현이 돼요.',
      ]),
    )
    .replace(
      /잘 익은 나무가 그늘을 넓혀 가는 (?:이미지|그림)예요\. 자녀·후배·제자 같은 결과 만나는 (?:시기가|자리가) 보이지만,? 어떤 형태인지는 사람마다 다르게 풀어요\./g,
      pickVariant(ctx, 'sourceExpressionAutumnLight', [
        '오래 자란 나무가 그늘을 나누듯, 이 시기에는 내가 쌓아 온 표현과 경험이 다른 사람에게 편안한 도움으로 전해질 수 있어요. 꼭 어떤 형태로 남겨야 한다고 정하지 않아도 괜찮아요.',
        '그동안 만든 말, 글, 작업은 시간이 지나며 누군가에게 쉬어 갈 그늘이 될 수 있어요. 자녀, 후배, 제자처럼 이어지는 사람과의 만남은 각자의 방식으로 달라져요.',
        '잘 익은 열매를 나누듯 내가 가진 경험을 필요한 사람에게 조금씩 전하기 좋은 흐름이에요. 중요한 것은 결과의 모양보다 서로 부담 없는 크기로 나누는 태도예요.',
        '이 시기의 표현은 새로 증명하기보다 쌓아 온 것을 편안하게 나누는 쪽에 힘이 있어요. 가까운 사람에게 남길 말, 보여 줄 작업, 함께할 시간을 작게 고르면 충분해요.',
        '오래 가꾼 표현은 한 사람에게만 머물지 않고 주변으로 부드럽게 퍼질 수 있어요. 누군가에게 가르치거나 함께 만드는 기회가 오면 크기보다 편안한 속도를 먼저 보세요.',
      ]),
    )
    .replace(
      /중년의 (?:결|흐름)은 깊이가 빛을 내는 흐름이에요\. 자기 페이스를 지키는 것 자체가 큰 자산이 돼요\./g,
      pickVariant(ctx, 'sourceWealthPace', [
        '중년의 돈과 생활은 깊이보다 균형에서 힘이 나요. 내 속도를 지키되 가족, 일, 건강에 부담이 한쪽으로 몰리지 않는지 함께 살피면 좋아요.',
        '이 시기의 자산은 빠른 확장보다 오래 지킬 기준에서 더 또렷해져요. 자기 페이스를 지키면서도 필요한 대화와 점검을 미루지 않는 태도가 중요해요.',
        '중년에는 이미 쌓은 것을 차분히 다듬는 힘이 커져요. 큰 결정보다 지출, 책임, 회복 시간을 균형 있게 나누면 생활의 바탕이 단단해져요.',
        '깊이가 생기는 시기일수록 무리한 확장보다 내 생활을 지키는 기준이 필요해요. 지금 감당할 수 있는 돈과 책임의 크기를 함께 확인해 보세요.',
        '자기 페이스는 돈을 천천히 보라는 말에 그치지 않아요. 오래 갈 선택인지, 가족과 일의 부담을 함께 낮추는지 살피면 자산의 안정감도 커져요.',
      ]),
    )
    .replace(
      /학교에서 받은 작은 칭찬 한마디, 친구와 함께 풀어 본 한 문제, 모르는 단어를 노트에 적어 둔 한 줄이 큰 자산이 되는 시기예요\. 어른들이 쓰는 어려운 말을 미리 끌어오지 않아도 충분해요\./g,
      pickVariant(ctx, 'sourceStudyPraise', [
        '학교에서 들은 짧은 칭찬, 친구와 같이 풀어 본 문제, 새로 적어 둔 단어 하나가 모두 배움의 자산이 돼요. 어려운 목표보다 오늘 남긴 작은 흔적을 먼저 믿어도 충분해요.',
        '작은 성공을 그냥 지나치지 않는 것이 중요해요. 맞힌 문제 하나, 질문한 내용 하나, 다시 확인한 단어 하나가 쌓이면 공부를 계속해 볼 힘이 생겨요.',
        '오늘의 배움은 큰 자격이나 어려운 이름보다 생활 속 작은 경험으로 충분해요. 칭찬받은 점과 새로 알게 된 점을 짧게 나누면 공부가 더 편안하게 이어져요.',
      ]),
    )
    .replace(
      /가까운 길을 편안한 속도로 걸으며 친구나 가족과 짧게 쉬어 가는 일정이 잘 어울려요\. 익숙한 길에 작은 변화를 주는 것만으로도 좋은 자극이 돼요\./g,
      pickVariant(ctx, 'sourceMovementNearby', [
        '멀리 떠나지 않아도 작은 변화는 충분히 만들 수 있어요. 익숙한 길을 조금 다른 시간에 걷거나 가까운 사람과 짧게 쉬어 가면 좋은 자극이 돼요.',
        '가까운 곳을 편한 속도로 다녀오는 일정이 잘 맞아요. 길보다 중요한 것은 무리하지 않고 돌아올 힘을 남기는 거예요.',
        '짧은 외출이나 익숙한 동선의 작은 변화가 부담 없는 전환점이 될 수 있어요. 함께 걷거나 잠깐 쉬는 시간만으로도 기분이 달라져요.',
        '먼 곳을 크게 계획하지 않아도 괜찮아요. 가까운 길을 천천히 다녀오며 쉬는 시간을 섞으면 몸과 마음이 훨씬 편하게 움직여요.',
        '익숙한 장소라도 시간대나 동행이 달라지면 충분히 새롭게 느껴질 수 있어요. 무리한 계획보다 편하게 다녀오고 잘 쉬는 기준을 먼저 잡아 보세요.',
        '짧은 산책, 가까운 약속, 평소와 다른 길 하나만으로도 생활의 공기가 조금 바뀔 수 있어요. 돌아온 뒤 피곤하지 않을 정도로 작게 잡으면 더 좋아요.',
        '변화가 필요해도 꼭 멀리 가야 하는 것은 아니에요. 가까운 곳에서 가볍게 몸을 움직이고, 다녀온 뒤 쉴 시간을 남기면 마음도 덜 급해져요.',
        '가까운 이동은 새 자극을 시험해 보는 작은 방법이 될 수 있어요. 비용과 시간을 크게 쓰지 않고도 기분 전환의 기준을 확인할 수 있어요.',
      ]),
    )
    .replace(
      /다만 무리한 일정의 먼 여행은 호흡이 가빠지기 쉬워요\. 멀리 가기보다 가까운 곳을 여유 있게 다녀오는 편이 좋아요\./g,
      pickVariant(ctx, 'sourceMovementFarCaution', [
        '먼 이동을 한 번에 밀어붙이면 피로가 먼저 쌓일 수 있어요. 일정은 짧게 나누고, 쉬는 시간과 돌아올 시간을 먼저 확보하는 편이 좋아요.',
        '무리한 장거리 일정은 마음보다 몸이 먼저 지칠 수 있어요. 꼭 가야 한다면 이동 시간, 식사, 휴식을 넉넉하게 잡아 두세요.',
        '멀리 가는 계획은 좋지만 한 번에 너무 빽빽하게 잡으면 부담이 커져요. 가까운 일정부터 확인하고 여유가 남을 때 조금씩 넓혀도 늦지 않아요.',
        '이동이 길수록 중간에 쉬어 갈 시간을 먼저 정해 두는 편이 좋아요. 목적지보다 돌아와서도 무리 없을 리듬을 지키는 것이 더 중요해요.',
        '긴 이동을 계획한다면 일정의 즐거움만큼 돌아온 뒤의 피로도 함께 계산해 보세요. 이동 시간, 식사, 약속 사이의 쉼을 미리 남기면 부담이 훨씬 줄어요.',
        '멀리 움직이는 일은 마음이 먼저 앞서도 몸이 따라오는 속도가 다를 수 있어요. 꼭 필요한 일정이라면 동행, 교통, 쉬는 시간을 먼저 확인하는 편이 안전해요.',
        '장거리 일정은 갈 때보다 돌아온 뒤의 회복까지 봐야 해요. 하루에 너무 많은 약속을 넣지 말고, 중간에 쉬는 칸을 남기면 변화가 덜 무겁게 느껴져요.',
        '낯선 곳으로 움직일 때는 목적지만 보지 말고 내 몸이 쉬어 갈 지점도 함께 봐야 해요. 잠깐 앉을 시간과 식사 시간을 정해 두면 일정이 훨씬 부드러워져요.',
        '먼 이동이 필요하다면 무리하게 한 번에 끝내려 하지 않아도 괜찮아요. 출발과 귀가 시간을 넉넉히 두고, 피로가 커지기 전에 멈출 기준을 만들어 두세요.',
        '여행이나 이동의 크기가 커질수록 사소한 준비가 더 중요해져요. 약속을 줄이고 짐과 비용을 미리 확인하면 몸도 마음도 덜 흔들려요.',
      ]),
    )
    .replace(
      /돌아올 자리를 분명히 두면 새 곳을 향한 움직임도 더 가벼운 발걸음으로 이어져요\./g,
      pickVariant(ctx, 'sourceMovementReturnBase', [
        '돌아올 기준을 정해 두면 새로운 곳을 향한 움직임도 덜 불안해져요.',
        '새로운 곳을 볼 때는 돌아올 시간과 쉬어 갈 곳을 함께 정해 두세요.',
        '변화를 시작하기 전에는 다시 돌아올 생활의 기준을 먼저 확인해 보세요.',
        '낯선 곳으로 움직일 때도 돌아와 쉴 기준이 보이면 마음이 훨씬 가벼워져요.',
      ]),
    )
    .replace(
      /마음을 표현할 때 한 박자 정성스럽게 말을 고르는 습관이 관계 흐름을 가장 부드럽게 만들어 줘요\. 빠르게 결론짓기보다 천천히 신호를 모아 두면, 어울리는 사람이 자연스럽게 곁에 머물러요\. 결혼이나 이별 같은 큰 사건은 미리 단정하지 않아도 돼요\. 모든 관계는 시기마다 다른 얼굴을 보여 주니까요\./g,
      pickVariant(ctx, 'sourceRomanceLifeExpression', [
        '관계에서는 마음을 빨리 증명하려 하기보다 말의 온도를 차분히 고르는 태도가 오래 도움이 돼요. 마음이 가는 사람이 있더라도 큰 결론을 서두르지 말고, 편하게 이어지는 대화와 약속을 먼저 살펴보세요.',
        '좋은 관계는 빠른 단정에서만 만들어지지 않아요. 말투, 기다림, 작은 배려가 쌓이면서 서로에게 맞는 속도가 보이고, 그 속도 안에서 마음도 훨씬 편하게 자라요.',
        '마음을 표현할 때는 큰 약속보다 오늘 나눌 수 있는 진심 어린 말이 더 중요해요. 상대의 반응을 천천히 보며 내 속도도 함께 지키면 관계가 부담보다 안정감으로 남아요.',
        '관계의 흐름은 한 번의 사건으로만 정해지지 않아요. 고마웠던 말, 편했던 시간, 다시 이야기하고 싶은 장면을 차분히 모아 보면 내게 맞는 관계의 모양이 더 선명해져요.',
        '마음이 앞설수록 한 박자 쉬어 가는 태도가 필요해요. 급하게 결론을 내리기보다 서로가 편했던 순간을 자주 만들면 관계가 더 자연스럽고 오래 이어질 수 있어요.',
        '좋은 인연은 마음을 크게 증명하는 순간보다 작은 예의가 반복될 때 더 안정돼요. 편했던 대화, 기다려 준 시간, 부담이 적었던 약속을 함께 보면 관계의 방향이 훨씬 또렷해져요.',
        '관계의 안정감은 큰 고백보다 작은 약속을 지키는 태도에서 자랄 때가 많아요. 편했던 말투와 부담 없던 만남을 살피면 서로에게 맞는 속도가 보여요.',
        '좋은 관계는 마음의 크기를 계속 확인받는 쪽보다 서로 편해지는 장면을 쌓는 쪽에 가까워요. 기다려 준 시간과 고마웠던 말을 기억해 두면 방향이 선명해져요.',
        '마음이 진심이어도 표현이 너무 크면 상대가 부담스러울 수 있어요. 작은 예의와 편안한 약속이 반복될 때 관계는 더 안정적으로 이어져요.',
        '관계에서는 화려한 사건보다 매번 지켜지는 배려가 오래 남아요. 대화가 편했던 순간과 서로 무리하지 않았던 약속을 보면 다음 선택이 쉬워져요.',
        '서로에게 맞는 인연은 자주 반복되는 편안함 속에서 더 잘 드러나요. 늦지 않는 약속, 조심스러운 말투, 기다려 주는 태도가 관계의 바탕을 만들어 줘요.',
        '관계가 잘 흐를수록 상대를 단정하기보다 서로 편해졌던 장면을 더 세심하게 보는 편이 좋아요. 그 장면을 다시 만들 수 있으면 마음도 오래 안정돼요.',
        '마음이 움직이는 시기일수록 속도 조절이 중요해요. 지금 좋은 감정과 생활의 리듬을 함께 지키면 관계가 설렘만이 아니라 신뢰로 이어질 수 있어요.',
        '서로에게 맞는 관계는 큰 약속 하나보다 자주 반복되는 편안함에서 더 잘 보여요. 부담 없는 연락, 지켜진 약속, 고마움을 전하는 말이 좋은 흐름을 단단하게 해 줘요.',
      ]),
    )
    .replace(
      /마음을 표현할 때 한 박자 정성스럽게 말을 고르는 습관이 관계 흐름을 가장 부드럽게 만들어 줘요\. 빠르게 결론짓기보다 천천히 신호를 모아 두면, 어울리는 사람이 자연스럽게 곁에 머물러요\. 가족 약속이나 이별 같은 큰 사건은 미리 단정하지 않아도 돼요\. 모든 관계는 시기마다 다른 얼굴을 보여 주니까요\./g,
      pickVariant(ctx, 'sourceRomanceLifeExpression', [
        '관계에서는 마음을 빨리 증명하려 하기보다 말의 온도를 차분히 고르는 태도가 오래 도움이 돼요. 마음이 가는 사람이 있더라도 큰 결론을 서두르지 말고, 편하게 이어지는 대화와 약속을 먼저 살펴보세요.',
        '좋은 관계는 빠른 단정에서만 만들어지지 않아요. 말투, 기다림, 작은 배려가 쌓이면서 서로에게 맞는 속도가 보이고, 그 속도 안에서 마음도 훨씬 편하게 자라요.',
        '마음을 표현할 때는 큰 약속보다 오늘 나눌 수 있는 진심 어린 말이 더 중요해요. 상대의 반응을 천천히 보며 내 속도도 함께 지키면 관계가 부담보다 안정감으로 남아요.',
        '관계의 흐름은 한 번의 사건으로만 정해지지 않아요. 고마웠던 말, 편했던 시간, 다시 이야기하고 싶은 장면을 차분히 모아 보면 내게 맞는 관계의 모양이 더 선명해져요.',
        '마음이 앞설수록 한 박자 쉬어 가는 태도가 필요해요. 급하게 결론을 내리기보다 서로가 편했던 순간을 자주 만들면 관계가 더 자연스럽고 오래 이어질 수 있어요.',
        '좋은 인연은 마음을 크게 증명하는 순간보다 작은 예의가 반복될 때 더 안정돼요. 편했던 대화, 기다려 준 시간, 부담이 적었던 약속을 함께 보면 관계의 방향이 훨씬 또렷해져요.',
        '관계의 안정감은 큰 고백보다 작은 약속을 지키는 태도에서 자랄 때가 많아요. 편했던 말투와 부담 없던 만남을 살피면 서로에게 맞는 속도가 보여요.',
        '좋은 관계는 마음의 크기를 계속 확인받는 쪽보다 서로 편해지는 장면을 쌓는 쪽에 가까워요. 기다려 준 시간과 고마웠던 말을 기억해 두면 방향이 선명해져요.',
        '마음이 진심이어도 표현이 너무 크면 상대가 부담스러울 수 있어요. 작은 예의와 편안한 약속이 반복될 때 관계는 더 안정적으로 이어져요.',
        '관계에서는 화려한 사건보다 매번 지켜지는 배려가 오래 남아요. 대화가 편했던 순간과 서로 무리하지 않았던 약속을 보면 다음 선택이 쉬워져요.',
        '서로에게 맞는 인연은 자주 반복되는 편안함 속에서 더 잘 드러나요. 늦지 않는 약속, 조심스러운 말투, 기다려 주는 태도가 관계의 바탕을 만들어 줘요.',
        '관계가 잘 흐를수록 상대를 단정하기보다 서로 편해졌던 장면을 더 세심하게 보는 편이 좋아요. 그 장면을 다시 만들 수 있으면 마음도 오래 안정돼요.',
        '마음이 움직이는 시기일수록 속도 조절이 중요해요. 지금 좋은 감정과 생활의 리듬을 함께 지키면 관계가 설렘만이 아니라 신뢰로 이어질 수 있어요.',
        '서로에게 맞는 관계는 큰 약속 하나보다 자주 반복되는 편안함에서 더 잘 보여요. 부담 없는 연락, 지켜진 약속, 고마움을 전하는 말이 좋은 흐름을 단단하게 해 줘요.',
      ]),
    )
    .replace(
      /한 분야에 너무 일찍 자신을 묶어 둘 필요는 없지만, 옮기기 전에는 작은 성과나 인정 하나를 남겨 두는 것이 좋아요\. 빠른 이동보다 맡은 일을 끝까지 마무리해 본 경험이 다음 선택에서도 통하는 힘이 돼요\./g,
      pickVariant(ctx, 'sourceCareer20Finish', [
        '한 분야에 너무 일찍 자신을 묶어 둘 필요는 없어요. 다만 방향을 바꾸기 전에는 끝까지 해 본 일 하나, 인정받은 부분 하나를 남겨 두면 다음 선택에서 자신을 설명하기 쉬워져요.',
        '첫 역할을 오래 붙잡아야만 좋은 것은 아니지만, 마무리한 경험은 꼭 남기는 편이 좋아요. 작은 결과라도 끝까지 정리해 두면 다음 자리에서 내 기준과 책임감을 보여 주는 자료가 돼요.',
        '옮기고 싶은 마음이 생기더라도 바로 끊어 내기보다 배운 점과 남긴 결과를 먼저 정리해 보세요. 그 기록이 있어야 다음 선택이 충동이 아니라 성장의 방향으로 보여요.',
        '20대의 일은 여러 가능성을 시험하는 과정이에요. 빠르게 넓히되, 맡았던 일을 어떻게 마무리했는지 남겨 두면 이후 더 큰 책임을 맡을 때 든든한 바탕이 돼요.',
        '새로운 길을 보는 힘도 중요하지만, 지금 맡은 일을 한 번 정리해 보는 힘도 중요해요. 작은 성과와 배운 점을 남기면 다음 선택이 훨씬 또렷해져요.',
      ]),
    )
    .replace(
      /한꺼번에 큰 학위를 바라보기보다, 한 분기에 한 주제를 정해 마무리하는 식이 잘 어울려요\. 깊게 파고드는 힘이 좋은 시기에는 강의 한 편보다 책 한 권을 천천히 읽는 것이 더 큰 도움이 될 수 있어요\./g,
      pickVariant(ctx, 'sourceAcademic30Scope', [
        '큰 학위나 긴 과정을 한 번에 떠올리면 부담이 커질 수 있어요. 한 분기에 한 주제만 정해 끝까지 확인하면 일과 생활 사이에서도 배움이 현실적으로 이어져요.',
        '이 시기의 공부는 크게 벌리는 것보다 한 가지를 제대로 마무리하는 힘이 더 중요해요. 강의 하나, 책 한 권, 실무 주제 하나를 정해 천천히 파고들면 결과가 더 단단하게 남아요.',
        '한꺼번에 많이 배우려 하기보다 지금 일과 연결되는 주제를 하나 고르는 편이 좋아요. 작게 시작해도 끝까지 정리한 배움은 다음 역할에서 바로 써먹을 수 있어요.',
        '배울 것이 많아 보여도 지금 맡은 일과 가장 가까운 주제부터 고르는 편이 좋아요. 작게 끝낸 배움은 바로 써 볼 수 있어 오래 남아요.',
        '새 공부를 넓게 벌리기보다 지금 생활에서 자주 쓰는 것 하나를 깊게 익혀 보세요. 실제로 써먹는 장면이 있어야 배움도 덜 부담스러워요.',
        '배움은 한꺼번에 많이 담을 때보다 한 가지를 끝까지 정리할 때 힘이 커져요. 지금 역할에 붙는 주제 하나만 골라도 다음 선택이 쉬워져요.',
        '새로운 공부를 시작할 때는 범위를 줄이는 것이 오히려 실속 있어요. 지금 일이나 생활과 이어지는 작은 주제부터 잡으면 오래 이어 가기 좋아요.',
        '배움의 양보다 생활 안에서 이어 갈 수 있는 리듬이 중요해지는 때예요. 이번 계절에 끝낼 주제 하나를 정하면 공부가 부담보다 자기 분야를 키우는 힘으로 남아요.',
      ]),
    )
    .replace(
      /세 달에 한 번씩 책 한 권을 읽기 전의 생각과 읽고 난 뒤의 생각을 한 줄씩 적어 두세요\. 그 시기 동안 그 기록이 모이면, 자기 분야를 이해하는 작은 지도가 되어 다음 공부를 가볍게 시작하게 해 줘요\./g,
      pickVariant(ctx, 'sourceAcademic30Record', [
        '세 달에 한 번쯤 책이나 강의를 하나 정하고, 시작 전 생각과 끝난 뒤 달라진 점을 한 줄씩 남겨 보세요. 그 기록이 쌓이면 내가 오래 관심을 두는 주제가 더 잘 보여요.',
        '한 주제를 끝낸 뒤에는 길게 정리하지 않아도 괜찮아요. 배운 점, 바로 써먹을 점, 나중에 다시 볼 점을 짧게 나누면 다음 공부를 시작하기가 훨씬 쉬워져요.',
        '책 한 권을 다 읽었다면 마음에 남은 문장과 실제 생활에 붙일 행동을 하나씩 적어 보세요. 그렇게 남긴 두 줄이 다음 배움의 좋은 출발점이 돼요.',
        '공부 기록은 많이 쓰는 것보다 다시 볼 수 있게 남기는 것이 중요해요. 시작 전 궁금했던 점과 끝난 뒤 이해한 점을 짧게 적으면 배움의 방향이 또렷해져요.',
      ]),
    )
    .replace(
      /한 분기마다 책 한 권을 읽기 전의 생각과 읽고 난 뒤의 생각을 한 줄씩 적어 두세요\. 그 시기 동안 그 기록이 모이면, 자기 분야를 이해하는 작은 지도가 되어 다음 공부를 가볍게 시작하게 해 줘요\./g,
      pickVariant(ctx, 'sourceAcademic30Record', [
        '분기마다 읽은 책이나 강의에서 시작 전 생각과 끝난 뒤 생각을 한 줄씩 남겨 보세요. 그 기록이 쌓이면 내가 어떤 주제에 오래 마음이 가는지 더 쉽게 보여요.',
        '공부를 끝낸 뒤에는 많이 알게 된 내용을 길게 정리하지 않아도 괜찮아요. 처음 생각과 달라진 점 하나만 남겨도 다음 공부를 시작할 때 훌륭한 길잡이가 돼요.',
        '한 주제를 마친 뒤에는 배운 내용, 바로 써먹을 부분, 나중에 다시 볼 부분을 짧게 나누어 보세요. 작은 기록이 쌓이면 자기 분야의 지도가 조금씩 만들어져요.',
        '책 한 권이나 강의 하나를 끝냈다면 마음에 남은 문장과 실제 생활에 붙일 행동을 하나씩 적어 보세요. 그렇게 남긴 두 줄이 다음 배움을 훨씬 가볍게 열어 줘요.',
      ]),
    )
    .replace(
      /올해의 배움 흐름은 익힌 것을 자기 자산으로 다듬는 한 해예요\. 그동안 쌓은 경험이 단단한 토대가 되어, 새로 배우는 한 가지가 빠르게 자기 일과 이어지는 자리가 자주 생겨요\./g,
      pickVariant(ctx, 'sourceAcademicMidlifeScope', [
        '올해의 공부와 배움은 그동안 익힌 경험을 다시 정리해 자기 일에 붙이는 한 해예요. 새로 배우는 한 가지를 크게 벌리기보다, 지금 하는 일과 생활에 어떻게 쓸지 먼저 생각하면 더 오래 남아요.',
        '올해는 새 지식을 많이 모으는 것보다 이미 쌓은 경험과 새 배움을 연결하는 힘이 중요해요. 한 가지를 배웠다면 바로 쓸 장면을 작게 정해 두면 자기 분야가 더 단단해져요.',
        '올해의 배움은 익숙한 일 위에 새 도구나 관점을 하나 얹는 흐름이에요. 크게 바꾸려 하기보다 지금 맡은 일과 연결되는 부분부터 정리하면 부담이 줄어요.',
        '그동안 해 온 일과 새로 배우는 내용이 서로 이어질 수 있는 해예요. 배운 것을 생활 속 사례와 묶어 보면 공부가 남의 일이 아니라 내 도구처럼 느껴져요.',
      ]),
    )
    .replace(
      /한꺼번에 너무 많이 펼치기보다 6개월에 한 가지씩 마무리해 가는 식이 단단한 결과를 남겨요\. 가르치며 배우는 자리, 후배와 함께 하는 자리도 좋은 흐름으로 작용해요\./g,
      pickVariant(ctx, 'sourceAcademicMidlifePractice', [
        '한꺼번에 많이 배우려 하기보다 6개월에 한 가지 주제를 끝까지 정리하는 편이 좋아요. 후배나 동료에게 짧게 설명해 보면 내가 이해한 부분도 더 또렷해져요.',
        '올해는 배움을 넓히는 양보다 마무리하는 힘이 더 중요해요. 강의 하나, 책 한 권, 실무 도구 하나를 정해 끝까지 다루면 결과가 생활에 더 잘 붙어요.',
        '새로운 도구나 강의를 여러 개 펼치기보다 지금 필요한 한 가지를 고르는 편이 좋아요. 배운 내용을 누군가에게 쉽게 설명해 보는 과정이 좋은 복습이 돼요.',
        '배운 내용을 혼자만 알고 끝내기보다 가까운 사람에게 쉬운 말로 설명해 보세요. 설명하면서 부족한 부분이 보이고, 다음에 무엇을 더 확인할지도 분명해져요.',
      ]),
    )
    .replace(
      /40·50대 학습자에게 올 한 해는 직장과 가족의 리듬 안에서도 자기 분야를 단단하게 다듬는 자리가 자주 열리는 시기예요\. 6개월 단위의 호흡으로 묵혀 두면 한 해 끝의 한 자락이 더 또렷해져요\./g,
      pickVariant(ctx, 'sourceAcademicMidlifePace', [
        '올해는 일과 가족의 리듬 속에서도 자기 분야를 차분히 다듬을 수 있는 해예요. 6개월 단위로 한 주제를 정리하면 연말에는 내가 무엇을 더 잘 다루게 됐는지 분명히 보일 거예요.',
        '바쁜 생활 안에서 공부를 이어 가려면 크게 몰아치기보다 반년 단위의 작은 목표가 잘 맞아요. 한 가지 주제를 정해 조금씩 쌓으면 연말에 바로 써먹을 결과가 남아요.',
        '올해의 배움은 시간을 많이 내는 사람만의 일이 아니에요. 일과 가족 사이에서 지킬 수 있는 작은 목표를 정하면, 바쁜 생활 속에서도 내 분야가 조금씩 정리돼요.',
        '40대와 50대의 배움은 새 출발이라기보다 경험을 더 선명하게 다듬는 과정에 가까워요. 반년마다 한 가지씩 정리하면 연말에는 내 기준과 실력이 함께 또렷해져요.',
      ]),
    )
    .replace(
      /12월에 자기만의 콘텐츠 한 자락이 남아 있다면 한 해의 흐름을 잘 다진 셈이에요\./g,
      pickVariant(ctx, 'sourceAcademicMidlifePractice', [
        '연말에 내가 정리한 글, 자료, 체크리스트 하나가 남아 있다면 한 해의 배움은 충분히 쓸모 있게 쌓인 거예요.',
        '12월에 짧은 정리 노트나 업무에 바로 쓰는 자료가 하나 남아 있다면 올해의 공부는 생활 안으로 잘 들어온 셈이에요.',
        '연말에 남는 결과가 거창하지 않아도 괜찮아요. 내가 다시 볼 수 있는 메모나 설명 자료 하나면 충분히 좋은 결실이에요.',
        '올해의 공부는 큰 증명보다 다시 꺼내 볼 수 있는 결과 하나로 확인해도 충분해요. 작은 자료 하나가 남으면 다음 해의 배움도 훨씬 가볍게 시작돼요.',
      ]),
    )
    .replace(
      /자격, 강의, 새로운 도구를 익히는 흐름이 두려움보다 호기심으로 다가오는 시기예요\. 한꺼번에 너무 많이 펼치기보다 6개월에 한 가지씩 마무리해 가는 식이 단단한 결과를 남겨요\./g,
      pickVariant(ctx, 'sourceAcademicMidlifeScope', [
        '새로운 자격이나 도구를 배우는 일이 낯설어도 호기심이 살아날 수 있는 시기예요. 한꺼번에 많이 펼치기보다 6개월에 하나씩 마무리하면 배움이 실제 일과 생활에 더 잘 붙어요.',
        '새 도구를 익히는 일은 큰 전환보다 경험을 보완하는 한 조각으로 보면 편해요. 지금 생활에 바로 붙는 주제 하나를 고르면 배움도 덜 부담스럽게 이어져요.',
        '새로운 공부를 시작할 때는 범위를 좁히는 것이 실속 있어요. 강의 하나, 자격 하나, 도구 하나처럼 끝낼 수 있는 단위로 잡으면 결과가 더 선명해져요.',
        '이 시기의 배움은 젊을 때처럼 많이 벌리는 경쟁이 아니에요. 이미 쌓은 경험 위에 필요한 기술 하나를 더 얹는 방식이 더 오래 도움이 돼요.',
        '배울 것이 많아 보여도 먼저 생활에 가장 가까운 것 하나만 고르세요. 작게 끝낸 배움이 있어야 다음 공부도 자신 있게 이어져요.',
        '이 시기의 공부는 새로 시작한다는 부담보다 이미 쌓은 경험에 한 가지를 더 얹는 과정에 가까워요. 도구 하나, 강의 하나처럼 범위를 좁히면 결과가 더 분명해져요.',
        '배울 것이 많아 보일수록 선택을 줄이는 편이 좋아요. 지금 생활에 바로 도움이 되는 주제 하나를 고르고 끝까지 다뤄 보면 자신감도 함께 자라요.',
        '새로운 공부가 두렵게 느껴져도 경험이 이미 바탕이 되어 줘요. 그래서 빠르게 여러 가지를 건드리기보다 한 가지를 끝까지 익히는 방식이 더 값지게 남아요.',
      ]),
    )
    .replace(
      /작은 실천으로는 평일 저녁 한 시간을 학습 자리로 잡아 두면 좋아요\. 주말엔 그 주에 익힌 내용을 한두 줄로 정리해 두면, 6개월 뒤에 자기만의 노트가 한 권으로 묶여요\./g,
      pickVariant(ctx, 'sourceAcademicMidlifePractice', [
        '작은 실천으로는 평일 저녁에 짧은 학습 시간을 하나 정해 두면 좋아요. 주말에는 그 주에 익힌 내용을 한두 줄로 정리하면, 몇 달 뒤에 자기만의 노트가 만들어져요.',
        '매일 길게 공부하지 않아도 괜찮아요. 정해 둔 시간에 조금씩 확인하고 주말에 핵심만 적어 두면 배움이 흩어지지 않고 생활 속에 남아요.',
        '평일에는 짧게 배우고 주말에는 배운 내용을 정리하는 리듬이 잘 맞아요. 한두 줄이라도 남겨 두면 나중에 다시 시작할 때 훨씬 덜 막막해요.',
        '학습 시간을 거창하게 잡기보다 반복 가능한 시간대를 하나 정해 보세요. 같은 시간에 조금씩 쌓은 기록이 6개월 뒤에는 충분히 든든한 자료가 돼요.',
      ]),
    )
    .replace(
      /속도가 느려진다고 느낄 때엔 젊을 때 페이스와 비교하지 않아도 괜찮아요\. 한 번에 외우던 자리가 두세 번에 나뉘어도, 경험과 같이 묶인 흐름은 더 깊이 남아요\./g,
      pickVariant(ctx, 'sourceAcademicMidlifePace', [
        '속도가 예전 같지 않다고 느껴져도 그것만으로 배움이 늦어진 것은 아니에요. 한 번에 외우기보다 여러 번 확인하는 방식이 오히려 경험과 잘 묶여 더 오래 남을 수 있어요.',
        '젊을 때의 공부 속도와 비교하지 않아도 괜찮아요. 지금은 빠르게 외우는 힘보다 경험에 연결해 이해하는 힘이 더 크게 작용할 수 있어요.',
        '같은 내용을 두세 번 봐야 해도 그것은 약점이 아니에요. 반복해서 확인하는 동안 이미 가진 경험과 새 지식이 연결되면서 배움이 더 단단해져요.',
        '배움의 속도가 느려진 듯해도 깊이는 오히려 좋아질 수 있어요. 바로 외우지 못한 내용도 생활 속 사례와 묶어 보면 더 오래 기억에 남아요.',
      ]),
    )
    .replace(
      /가르치며 배우는 자리도 좋은 흐름으로 작용해요\./g,
      pickVariant(ctx, 'sourceAcademicMidlifePractice', [
        '배운 내용을 누군가에게 쉬운 말로 설명해 보면 내가 아는 부분과 헷갈리는 부분이 더 잘 보여요. 설명은 남을 가르치는 일이 아니라 내 공부를 다시 정리하는 방법이에요.',
        '혼자 알고 끝내기보다 가족이나 친구에게 짧게 설명해 보세요. 말로 풀어 보는 과정에서 배운 내용이 더 오래 남고, 부족한 부분도 덜 무겁게 보완할 수 있어요.',
        '설명해 보는 과정은 배운 내용을 내 말로 다시 정리하는 좋은 연습이에요. 어려운 말보다 쉬운 예시 하나로 말해 보면 다음 공부의 방향도 더 분명해져요.',
        '배움은 혼자 오래 붙잡는 시간만으로 깊어지지 않아요. 내가 이해한 내용을 짧게 말해 보고, 막히는 부분을 표시해 두면 복습할 지점이 또렷해져요.',
      ]),
    )
    .replace(
      /이번 달 아이의 하루는 좋아하는 활동에 시간을 들이는 자리에서 가장 잘 자라는 흐름이에요\. 한 시리즈의 그림책, 작은 만들기 한 가지, 동네 작은 모임처럼 한 달을 묶어 줄 한 가지를 정해 두면 방향이 또렷해져요\./g,
      pickVariant(ctx, 'sourceChildAcademicMonthIntro', [
        '이번 달 아이의 배움은 좋아하는 활동을 충분히 이어 갈 때 가장 잘 자라요. 그림책 한 시리즈, 작은 만들기, 동네 모임처럼 한 달을 묶어 줄 한 가지를 정해 두면 방향이 또렷해져요.',
        '아이에게는 새로운 활동을 많이 늘리는 것보다 좋아하는 한 가지를 깊게 즐기는 시간이 더 도움이 될 수 있어요. 한 달 동안 반복할 작은 주제가 있으면 집중도 자연스럽게 자라요.',
        '이번 달에는 아이가 오래 붙잡고 싶어 하는 활동을 관찰해 보세요. 그림책, 만들기, 놀이처럼 마음이 가는 주제를 하나 정하면 배움이 훨씬 편하게 이어져요.',
        '한 달의 배움은 거창한 목표보다 꾸준히 즐길 활동 하나에서 시작해도 충분해요. 아이가 좋아하는 주제를 반복해서 만나면 자신감과 집중력이 함께 자라요.',
      ]),
    )
    .replace(
      /어른이 옆에서 함께 보고, 같이 묻고, 같이 답을 찾는 자리가 가장 큰 도움이 되어 줘요\. 새 활동을 한꺼번에 펼치지 않고 좋아하는 한 가지를 깊게 즐기게 두면 자연스레 집중력이 자라요\./g,
      pickVariant(ctx, 'sourceChildAcademicGuided', [
        '어른이 옆에서 함께 보고, 같이 묻고, 같이 답을 찾는 시간이 가장 큰 도움이 돼요. 새 활동을 많이 늘리기보다 좋아하는 한 가지를 깊게 즐기면 집중력이 자연스럽게 자라요.',
        '아이는 혼자 정답을 찾기보다 가까운 어른과 함께 보고 묻는 과정에서 더 편하게 배워요. 좋아하는 활동을 충분히 반복하게 두면 배움의 리듬도 안정돼요.',
        '새 활동을 한꺼번에 펼치지 않아도 괜찮아요. 아이가 좋아하는 것을 옆에서 같이 보고 짧게 물어봐 주면, 놀이가 자연스럽게 배움으로 이어져요.',
        '어른의 역할은 많은 답을 알려 주는 것보다 아이가 궁금해하는 장면에 함께 머무는 거예요. 좋아하는 활동을 충분히 즐기게 두면 집중력도 천천히 자라요.',
      ]),
    )
    .replace(
      /어른이 옆에서 함께 보고, 같이 묻고, 같이 답을 찾는 자리가 가장 큰 도움이 되어 줘요\. 새 활동을 한꺼번에 펼치지 않고 좋아하는 흐름을 깊게 즐기게 두면 그것이 곧 다음 단계의 토양이 되어 줘요\./g,
      pickVariant(ctx, 'sourceChildAcademicGuided', [
        '어른이 옆에서 함께 보고, 같이 묻고, 같이 답을 찾는 시간이 가장 큰 도움이 돼요. 새 활동을 많이 늘리기보다 좋아하는 활동을 깊게 즐기게 두면 다음 배움의 바탕이 만들어져요.',
        '아이는 익숙한 활동을 충분히 즐길 때 다음 단계로 넘어갈 힘을 얻어요. 어른이 곁에서 함께 보고 물어봐 주면 배움이 더 안전하고 편안하게 이어져요.',
        '새로운 것을 많이 보여 주려 하기보다 아이가 좋아하는 활동을 오래 지켜봐 주세요. 그 안에서 생기는 질문과 대답이 다음 배움의 좋은 재료가 돼요.',
        '함께 보고 함께 묻는 시간이 아이에게는 큰 도움으로 남아요. 좋아하는 활동을 충분히 즐긴 경험이 다음 단계로 넘어가는 바탕이 될 수 있어요.',
      ]),
    )
    .replace(
      /중간에 살짝 피곤해 보이면 한 시간만 일찍 재워 주는 자리가 다음 날 흐름을 가볍게 만들어요\. 따뜻한 한 끼가 가장 든든한 챙김이에요\./g,
      pickVariant(ctx, 'sourceChildHealthSleep', [
        '중간에 살짝 피곤해 보이면 한 시간만 일찍 쉬게 해 주세요. 다음 날 몸이 훨씬 가볍게 회복될 수 있고, 따뜻한 한 끼도 든든한 챙김이 돼요.',
        '아이에게 피곤한 신호가 보이면 놀이를 더 늘리기보다 잠을 조금 앞당기는 편이 좋아요. 충분히 쉬고 편하게 먹는 것만으로도 다음 날 리듬이 안정돼요.',
        '살짝 지쳐 보이는 날에는 특별한 관리보다 일찍 자고 따뜻하게 먹는 기본이 가장 도움이 돼요. 작은 휴식 하나가 다음 날 컨디션을 부드럽게 만들어 줘요.',
        '피로가 보이면 한 가지 활동을 줄이고 쉬는 시간을 먼저 잡아 주세요. 아이에게는 큰 계획보다 잠, 식사, 편안한 분위기가 가장 든든한 회복이 돼요.',
      ]),
    )
    .replace(
      /흐르는 강물처럼 자기 페이스를 지키며 옮기는 호흡이 잘 맞아요\. 새 환경은 멀지 않은 곳, 익숙함과 새로움이 같이 있는 자리가 좋아요\./g,
      pickVariant(ctx, 'sourceMovementLaterLifePace', [
        '움직임은 큰 변화보다 자기 페이스를 지키는 쪽이 잘 맞아요. 새 환경을 고를 때도 완전히 낯선 곳보다 익숙한 생활 리듬을 함께 가져갈 수 있는 곳이 더 편안해요.',
        '새로운 곳으로 움직이고 싶다면 거리보다 생활의 안정감을 먼저 보세요. 익숙한 사람, 편한 동선, 쉬어 갈 시간이 함께 있을 때 변화가 덜 부담스럽게 느껴져요.',
        '이동은 빠르게 결론 내리기보다 내 생활이 얼마나 편하게 이어질지 살피는 과정이에요. 익숙함과 새로움이 적당히 섞인 선택이 마음을 더 안정시켜요.',
        '오래 머문 곳에서 벗어나는 결정은 천천히 잡아도 괜찮아요. 새 환경에서도 지킬 수 있는 생활 기준이 보이면 움직임이 훨씬 가볍고 현실적으로 느껴져요.',
      ]),
    )
    .replace(
      /흐르는 강물처럼 자기 페이스를 지키며 옮기는 호흡이 잘 맞아요\. 새 자리는 멀지 않은 곳, 익숙함과 새로움이 같이 있는 자리가 좋아요\./g,
      pickVariant(ctx, 'sourceMovementLaterLifePace', [
        '움직임은 큰 변화보다 자기 페이스를 지키는 쪽이 잘 맞아요. 새 환경을 고를 때도 완전히 낯선 곳보다 익숙한 생활 리듬을 함께 가져갈 수 있는 곳이 더 편안해요.',
        '새로운 곳으로 움직이고 싶다면 거리보다 생활의 안정감을 먼저 보세요. 익숙한 사람, 편한 동선, 쉬어 갈 시간이 함께 있을 때 변화가 덜 부담스럽게 느껴져요.',
        '이동은 빠르게 결론 내리기보다 내 생활이 얼마나 편하게 이어질지 살피는 과정이에요. 익숙함과 새로움이 적당히 섞인 선택이 마음을 더 안정시켜요.',
        '오래 머문 곳에서 벗어나는 결정은 천천히 잡아도 괜찮아요. 새 환경에서도 지킬 수 있는 생활 기준이 보이면 움직임이 훨씬 가볍고 현실적으로 느껴져요.',
      ]),
    )
    .replace(
      /한 가지씩 천천히 정리하고 옮기면, 후반기의 자리가 더 편안해져요\./g,
      pickVariant(ctx, 'sourceMovementLaterLifePace', [
        '한 가지씩 천천히 정리하고 옮기면 후반기의 생활도 더 편안해져요.',
        '바꿀 것과 그대로 둘 것을 나누어 옮기면 변화가 훨씬 덜 부담스러워져요.',
        '한 번에 다 바꾸지 않고 익숙한 기준을 함께 가져가면 새 생활도 더 안정돼요.',
      ]),
    )
    .replace(
      /마음의 흐름을 단단한 흙으로 비유한다면, 받쳐 주는 자리가 많은 만큼 자기 자신을 위한 자리도 명확히 비워 두어야 무너지지 않아요\. '나를 위한 한 시간'이 결국 가족·일 모두를 받쳐 주는 자리가 돼요\./g,
      pickVariant(ctx, 'sourceStressRest', [
        '마음을 단단한 흙에 비유한다면, 잘 버티는 힘이 큰 만큼 쉬어 갈 틈도 함께 필요해요. 나를 위한 한 시간을 비워 두면 가족과 일도 더 안정적으로 돌볼 수 있어요.',
        '버티는 힘이 큰 사람일수록 자기 시간을 일부러 남겨 두는 편이 좋아요. 쉬는 시간이 있어야 가까운 사람과 일도 오래 흔들림 없이 챙길 수 있어요.',
        '많은 일을 받아 낼 수 있어도 내 마음을 위한 여백이 없으면 쉽게 지칠 수 있어요. 하루 중 한 시간만이라도 조용히 쉬는 기준을 두면 생활 전체가 더 단단해져요.',
        '주변을 든든히 받쳐 주는 힘이 있더라도 나를 돌보는 시간이 빠지면 균형이 흐트러져요. 혼자 쉬는 시간, 천천히 먹는 시간, 생각을 정리하는 시간을 미리 남겨 두세요.',
      ]),
    )
    .replace(
      /컨디션이 흐트러졌다고만 보지 말고, 몸을 다듬는 시간을 한 번씩 가지면, 평생 컨디션이 더 길게 이어져요\. 한 가지 운동이나 취미를 부담 없는 크기로 이어 가는 편이 잘 맞아요\./g,
      pickVariant(ctx, 'sourceHealthBalancedPace', [
        '컨디션이 흔들리는 때는 몸이 보내는 조정 신호로 볼 수 있어요. 한 가지 운동이나 취미를 무리 없이 이어 가면 긴 시간의 몸 관리도 훨씬 안정돼요.',
        '몸이 흐트러지는 시기를 실패로 볼 필요는 없어요. 잠시 속도를 낮추고 익숙한 운동이나 취미를 다시 잡으면 컨디션을 오래 이어 갈 힘이 생겨요.',
        '건강 관리는 한 번에 완벽해지는 일이 아니라 때때로 리듬을 다시 맞추는 과정이에요. 내게 맞는 움직임 하나를 꾸준히 이어 가는 편이 가장 현실적이에요.',
        '몸을 다듬는 시간은 특별한 변화가 아니라 오래 갈 습관을 다시 확인하는 시간이에요. 가벼운 운동, 손에 익은 취미, 충분한 휴식을 한 가지씩 남겨 보세요.',
      ]),
    )
    .replace(
      /전체적으로 큰 굴곡 없이 생활의 기준을 단단히 잡아 가는 시기예요\. 속도를 한 번 늦출 시간만 챙겨도 몸과 마음이 더 안정적으로 이어져요\./g,
      pickVariant(ctx, 'sourceHealthBalancedPace', [
        '전체적으로 큰 굴곡 없이 생활의 기준을 단단히 잡아 가는 시기예요. 속도를 한 번 늦출 시간만 챙겨도 몸과 마음이 더 안정적으로 이어져요.',
        '생활의 바탕은 비교적 안정적이지만 중간에 쉬어 갈 틈을 남겨 두는 편이 좋아요. 약속을 조금 줄이고 몸이 편한 시간을 지키면 흐름이 더 부드러워져요.',
        '큰 흔들림보다 반복되는 생활 리듬을 잘 지키는 힘이 돋보여요. 무리해서 더 채우기보다 잠, 식사, 쉬는 시간을 일정하게 두면 안정감이 오래가요.',
        '몸과 마음은 큰 변화보다 익숙한 기준을 지킬 때 더 편안해져요. 바쁜 날에도 한 박자 늦출 시간을 미리 남기면 피로가 한꺼번에 쌓이는 일을 줄일 수 있어요.',
        '특별히 크게 흔들리는 모습보다는 생활을 차분히 다듬는 흐름에 가까워요. 내가 편해지는 시간대와 지치기 쉬운 시간대를 나누면 관리가 훨씬 쉬워져요.',
      ]),
    )
    .replace(
      /비유하자면 평생 컨디션은 가마솥 한 솥의 국물 같아요\. 한 번에 끓여 두는 게 아니라 천천히 우러나는 온기를 곁에서 자주 챙겨 두면 한 번 데워 마실 때마다 든든한 한 사발이 돼요\./g,
      pickVariant(ctx, 'sourceHealthBalancedBasics', [
        '긴 시간의 컨디션은 한 번에 채우는 힘보다 자주 챙기는 기본에 가까워요. 무리한 날 뒤에 쉬는 시간을 남겨 두면 다음 시기의 몸도 더 안정돼요.',
        '컨디션은 큰 보약 한 번보다 자주 챙기는 기본에서 더 안정돼요. 충분한 잠, 편안한 식사, 가벼운 움직임이 쌓이면 긴 시간의 몸도 덜 흔들려요.',
        '몸의 바탕은 매일 조금씩 맞추는 생활 리듬에 가까워요. 너무 세게 밀어붙이기보다 알맞은 속도를 꾸준히 지키는 편이 오래 편안해요.',
        '건강은 한 번에 저장해 두는 힘이 아니에요. 매일 조금씩 회복할 시간을 남겨 둘 때, 필요할 때 다시 꺼내 쓸 여유가 생겨요.',
      ]),
    )
    .replace(
      /다만 '괜찮을 거야' 하고 신호를 가볍게 넘기기 쉬워요\. 체력이 좋게 느껴질수록 무리한 시기엔 갑자기 한 번에 누적이 터지기도 하니, 정기 점검과 휴식 시간을 미리 정해 두는 편이 좋아요\./g,
      pickVariant(ctx, 'sourceHealthBalancedPace', [
        '몸이 괜찮다고 느껴질수록 작은 신호를 그냥 넘기기 쉬워요. 피로가 커지기 전에 쉬는 날과 점검 시간을 미리 정해 두면 긴 시간의 컨디션을 더 안정적으로 지킬 수 있어요.',
        '체력이 받쳐 줄 때도 몸의 작은 신호는 따로 살피는 편이 좋아요. 괜찮다고 계속 미루기보다 정기적으로 쉬고 확인하는 시간을 두면 한꺼번에 무너지는 일을 줄일 수 있어요.',
        '평소에 버틸 힘이 있더라도 누적된 피로는 늦게 드러날 수 있어요. 잠, 식사, 휴식 시간을 미리 일정에 넣어 두면 몸이 보내는 신호를 더 빨리 알아차릴 수 있어요.',
        '컨디션이 좋아 보일 때일수록 관리 기준을 작게 남겨 두세요. 정기 점검과 쉬는 시간을 미리 정하면 무리한 시기를 지나도 회복이 훨씬 수월해져요.',
      ]),
    )
    .replace(
      /무리한 강도·갑작스러운 변화를 한 번씩 누적하면 신호가 늦게 오지만 크게 와요\. 정기 점검과 휴식 시간을 일정에 미리 넣어 두는 편이 좋아요\./g,
      pickVariant(ctx, 'sourceHealthBalancedPace', [
        '강도를 갑자기 올리는 일이 반복되면 몸의 신호가 늦게 보일 수 있어요. 그래서 쉬는 날과 점검 시간을 미리 일정에 넣어 두는 편이 안전해요.',
        '갑자기 무리를 늘리는 날이 이어지면 피로가 뒤늦게 크게 드러날 수 있어요. 일정 안에 쉬는 칸을 먼저 넣어 두면 몸의 부담을 훨씬 줄일 수 있어요.',
        '몸이 버틴다고 해서 계속 속도를 올려도 된다는 뜻은 아니에요. 강한 일정 뒤에는 회복 시간을 붙여 두어야 컨디션이 오래 안정돼요.',
        '운동이나 일이 갑자기 세질수록 중간 점검이 필요해요. 쉬는 날, 가벼운 식사, 일찍 자는 시간을 미리 정하면 몸의 신호를 더 빨리 볼 수 있어요.',
        '강한 변화가 반복될 때는 성과보다 회복 가능성이 먼저예요. 다음 날까지 무리 없이 이어질 크기인지 확인하면 컨디션 관리가 더 안전해져요.',
        '갑작스러운 변화가 이어지면 피로가 천천히 쌓이다가 한 번에 드러날 수 있어요. 무리한 계획 사이에 반드시 쉬는 시간을 넣어 두면 부담을 줄일 수 있어요.',
        '몸이 버틴다고 해서 계속 강도를 올리는 것은 좋은 방식이 아닐 수 있어요. 일정표 안에 점검과 휴식을 먼저 넣어 두면 컨디션을 더 오래 지킬 수 있어요.',
        '큰 변화나 강한 운동을 이어 갈 때는 회복 시간을 같이 잡아야 해요. 쉬는 기준이 있으면 몸의 신호가 커지기 전에 조절하기 쉬워요.',
      ]),
    )
    .replace(
      /자기 회복 신호를 부끄럽지 않게 받아들이는 연습이 평생 큰 자산이 돼요\. 누군가에게 의지하는 시간도 강한 사람의 흐름의 한 부분이에요\./g,
      pickVariant(ctx, 'sourceHealthSeniorSupport', [
        '회복이 필요하다는 신호를 부끄럽게 여기지 않는 태도가 오래 큰 힘이 돼요. 혼자 버티는 것만이 강함은 아니고, 도움을 청하는 시간도 몸을 지키는 중요한 방법이에요.',
        '쉬어야 한다는 신호를 인정하는 것은 약한 모습이 아니에요. 믿을 만한 사람에게 부탁하거나 잠시 기대는 선택도 긴 시간의 건강을 지키는 방법이에요.',
        '회복이 필요할 때 혼자 버티기만 하면 부담이 더 커질 수 있어요. 가까운 사람에게 작은 도움을 청하고 쉬어 갈 시간을 확보하면 몸과 마음이 더 빨리 안정돼요.',
        '도움을 받는 시간도 스스로를 돌보는 중요한 방식이에요. 무리한 책임을 잠시 나누고, 몸이 편해지는 기준을 다시 세우면 회복이 덜 외로워져요.',
        '몸과 마음이 쉬어 가라고 알려 줄 때는 그 신호를 믿어도 괜찮아요. 혼자 해결하려는 마음을 조금 내려놓으면 회복의 길이 더 빨리 보일 수 있어요.',
        '몸과 마음이 쉬어 가라고 알려 줄 때 그 신호를 인정해도 괜찮아요. 믿을 만한 사람에게 기대거나 도움을 부탁하는 일도 긴 시간의 건강을 지키는 기준이 될 수 있어요.',
        '회복 신호를 빨리 받아들이는 사람일수록 오래 무리하지 않을 수 있어요. 가까운 사람과 나누는 짧은 대화나 부탁도 컨디션을 지키는 실제적인 도움으로 남아요.',
        '도움이 필요하다는 사실을 약점으로만 보지 않아도 돼요. 몸이 쉬어 가야 할 때 곁의 사람에게 기대는 기준이 있으면 회복이 훨씬 덜 외로워져요.',
      ]),
    )
    .replace(
      /잘 풀리는 것은 몸을 움직이는 휴식이에요\. 가만히 누워 있는 회복보다, 가벼운 운동·등산·자전거 같은 몸을 움직이는 휴식이 마음의 짐을 더 잘 풀어 주는 흐름이에요\./g,
      pickVariant(ctx, 'sourceStressRest', [
        '이 흐름에서는 완전히 멈춰 있기보다 몸을 가볍게 움직이는 회복이 잘 맞아요. 짧은 산책, 가벼운 운동, 천천히 걷는 시간이 마음의 부담을 풀어 주는 데 도움이 돼요.',
        '쉬는 방식도 몸에 맞게 고르면 좋아요. 누워만 있기보다 가볍게 걷거나 몸을 풀어 주면 마음의 무게가 조금 더 자연스럽게 내려갈 수 있어요.',
        '마음이 무거울 때는 큰 운동보다 작은 움직임부터 시작해 보세요. 가까운 길을 걷거나 가볍게 몸을 움직이는 시간이 생각을 정리하는 데 도움이 돼요.',
        '회복은 꼭 가만히 있는 모습만 뜻하지 않아요. 몸을 무리 없이 움직이며 숨을 고르는 시간이 긴장과 책임감을 풀어 주는 좋은 휴식이 될 수 있어요.',
      ]),
    )
    .replace(
      /조심할 부분은 버티는 힘을 너무 오래 쓰는 거예요\. 쉬는 시간을 미리 정해 두면 피로가 한꺼번에 몰리는 일을 줄일 수 있어요\. 쉬는 것은 멈추는 일이 아니라 다음 선택을 준비하는 과정이에요\./g,
      pickVariant(ctx, 'sourceStressRest', [
        '조심할 부분은 버틸 수 있다는 이유로 쉬는 시간을 계속 미루는 거예요. 피로가 작을 때 멈추는 기준을 정해 두면 한꺼번에 무너지는 일을 줄일 수 있어요. 쉬는 시간은 다음 선택을 위한 준비예요.',
        '버티는 힘이 강할수록 몸과 마음의 신호를 늦게 알아차릴 수 있어요. 그래서 쉬는 시간을 미리 일정에 넣어 두는 편이 좋아요. 잠깐 멈추는 일이 오히려 긴 흐름을 지켜 줘요.',
        '오래 참는 태도만으로는 회복이 충분하지 않을 수 있어요. 피로가 커지기 전에 쉬는 날과 가벼운 정리 시간을 정해 두면 마음의 부담이 덜 쌓여요.',
        '오래 참아 온 일일수록 쉬는 시간을 나중으로 미루기 쉬워요. 피로가 작을 때 멈출 기준을 정하면 다음 책임도 더 차분히 이어져요.',
        '참는 힘이 좋다는 말은 계속 버티라는 뜻이 아니에요. 오늘은 일찍 내려놓을 일과 내일까지 봐도 되는 일을 나누어 보세요.',
        '회복은 긴 휴가만 기다리는 일이 아니에요. 물 한 잔, 짧은 걷기, 알림 줄이기처럼 바로 할 수 있는 멈춤도 긴장을 낮춰 줘요.',
        '회복은 하루를 통째로 비워야만 시작되는 일이 아니에요. 잠깐 눈을 쉬게 하고, 몸을 움직이고, 답장을 늦추는 작은 선택도 마음을 가볍게 해 줘요.',
        '큰 휴식이 어렵다면 작게 멈추는 기준부터 정해 보세요. 물을 마시고 숨을 고르고 화면을 잠깐 덮는 행동만으로도 몸의 긴장이 조금 내려가요.',
        '계속 견디는 방식이 익숙하다면 먼저 내려놓을 작은 일을 하나 정해 보세요. 쉬는 기준이 있어야 다음 책임도 더 차분히 이어 갈 수 있어요.',
        '버티는 힘이 강한 사람일수록 쉬어야 할 때를 늦게 알아차릴 수 있어요. 오늘 줄일 약속 하나와 지켜도 되는 책임 하나를 나누면 회복이 훨씬 현실적이에요.',
        '무조건 참는 방식은 오래가면 마음과 몸을 함께 지치게 해요. 잠시 미룰 일, 부탁할 일, 오늘 꼭 할 일을 나누면 부담이 작아져요.',
        '책임을 다하려는 마음이 커도 회복 시간을 빼면 오래 이어지기 어려워요. 먼저 내려놓을 작은 일 하나를 정하면 다음 선택도 덜 급해져요.',
        '쉬는 일은 책임을 포기하는 것이 아니에요. 다시 해낼 힘을 남기기 위해 오늘 덜어낼 일을 고르는 과정에 가까워요.',
      ]),
    )
    .replace(
      /이 시기에는 가족을 이끄는 말보다 함께 있어 주는 시간이 더 큰 힘이 돼요\. 무언가를 가르치려 애쓰기보다 편안히 듣고 웃어 주는 태도가 가까운 사람의 마음을 부드럽게 해 줘요\./g,
      pickVariant(ctx, 'sourceFamilySmallCare', [
        '이 시기에는 가족에게 답을 알려 주는 말보다 편히 머물러 주는 시간이 더 오래 남아요. 조언을 앞세우기보다 들어 주고 웃어 주는 태도가 가까운 사람의 마음을 안정시켜요.',
        '가까운 사람에게 먼저 필요한 것은 정답보다 편히 이야기할 수 있는 분위기일 때가 많아요. 판단을 서두르지 않고 들어 주면 마음의 문도 부드럽게 열려요.',
        '가까운 사람과 있을 때는 해결책을 빨리 꺼내기보다 먼저 편히 말할 시간을 주는 편이 좋아요. 들어 주는 태도만으로도 관계의 긴장이 많이 낮아져요.',
        '가족에게 힘이 되는 순간은 큰 조언보다 차분히 곁에 있어 주는 시간일 수 있어요. 상대가 자기 말을 끝까지 할 수 있게 기다리면 마음이 더 쉽게 풀려요.',
        '답을 맞혀 주려는 마음이 앞서면 대화가 무거워질 수 있어요. 먼저 안부를 묻고, 필요한 말만 짧게 더하면 가까운 사람도 편하게 다가와요.',
        '오래 함께한 관계일수록 판단보다 분위기가 먼저 필요할 때가 있어요. 웃어 주고 들어 주는 작은 태도가 가족 안의 마음을 부드럽게 열어 줘요.',
        '가족에게 힘이 되는 태도는 큰 해결책보다 안정된 곁일 수 있어요. 묻는 말에는 짧게 답하고, 스스로 고를 시간을 남겨 주면 관계가 덜 무거워져요.',
        '오래 함께한 관계일수록 말을 많이 보태기보다 편하게 머물 시간을 주는 편이 좋아요. 작은 웃음과 안부가 가까운 사람의 긴장을 낮춰 줘요.',
        '내가 대신 정해 주지 않아도 괜찮아요. 가까운 사람이 자기 속도로 생각할 수 있게 기다려 주면 조언보다 더 깊은 신뢰가 남아요.',
        '내가 먼저 정리해 줘야 한다는 마음을 잠시 낮춰도 괜찮아요. 묻는 말에 천천히 답하고 함께 웃는 시간이 가까운 사람에게 더 편한 힘이 될 수 있어요.',
        '가까운 사람에게 필요한 것은 큰 가르침보다 편안한 곁일 수 있어요. 묻는 말에 천천히 답하고, 오래된 이야기를 나누는 시간이 관계를 부드럽게 만들어 줘요.',
        '무언가를 정리해 주려는 마음이 커질수록 상대가 편히 다가올 시간을 남겨 두는 편이 좋아요. 조용한 안부와 작은 웃음이 가족 안의 긴장을 낮춰 줘요.',
        '가족에게 힘이 되는 방식은 생각보다 단순할 때가 많아요. 먼저 판단하지 않고 들어 주고, 익숙한 식사 자리를 함께 만드는 것만으로도 마음이 많이 누그러져요.',
        '이끌어야 한다는 마음을 내려놓으면 오히려 관계가 더 편해질 수 있어요. 필요한 말은 짧게 전하고, 나머지는 함께 머무는 시간으로 채우는 편이 오래 남아요.',
        '가까운 사람과의 시간은 큰 결론을 내는 자리보다 편히 숨 돌리는 자리일수록 좋아요. 안부를 묻고 웃어 주는 반복이 가족 안의 믿음을 천천히 쌓아 줘요.',
      ]),
    )
    .replace(
      /계절이 바뀔 때, 일상이 크게 흔들리는 시기엔 한 박자 천천히 쉴 시간을 만들어 두면 좋아요\. 따뜻한 차, 가벼운 산책, 충분한 수면은 어떤 보약보다 든든한 일상 자산이에요\./g,
      pickVariant(ctx, 'sourceHealthBalancedPace', [
        '계절이 바뀌거나 일상이 크게 달라질 때는 몸이 먼저 신호를 보낼 수 있어요. 그럴수록 일정 하나를 줄이고, 잠과 식사 시간을 편하게 맞추는 쪽이 오래 도움이 돼요.',
        '생활이 흔들리는 시기에는 무언가를 더하기보다 쉬어 갈 틈을 먼저 만들어 보세요. 따뜻한 식사, 짧은 산책, 충분한 잠처럼 기본에 가까운 선택이 몸을 안정시켜 줘요.',
        '컨디션이 흔들리는 때에는 큰 계획보다 작은 회복 기준이 필요해요. 하루 중 덜 지치는 시간대를 찾고, 그 시간에 쉬운 움직임이나 휴식을 붙이면 흐름이 부드러워져요.',
        '몸이 흔들릴 때는 새 계획을 더하기보다 부담을 줄일 기준이 먼저예요. 덜 피곤한 시간대에 가벼운 움직임이나 휴식을 붙이면 회복이 더 현실적으로 느껴져요.',
        '컨디션이 불안정한 시기에는 큰 결심보다 작게 회복하는 순서가 도움이 돼요. 오늘 줄일 약속 하나와 지킬 휴식 하나만 정해도 몸이 덜 무거워져요.',
        '몸의 리듬이 흔들릴 때는 가장 편한 시간대를 먼저 찾아보세요. 그 시간에 산책, 스트레칭, 짧은 낮잠처럼 쉬운 회복을 붙이면 부담이 내려가요.',
        '계절의 변화가 크게 느껴진다면 몸을 몰아붙이지 않는 편이 좋아요. 가벼운 움직임과 일찍 쉬는 날을 먼저 정해 두면 다음 시기를 더 편하게 맞을 수 있어요.',
      ]),
    )
    .replace(
      /주변 사람과 함께 몸과 마음을 챙기면 회복이 더 자연스럽게 이어져요\. 마음 편한 대화와 만남이 회복을 도와 주니, 그런 시간을 자주 두면 후반기에도 컨디션을 가볍게 지키기 쉬워요\./g,
      pickVariant(ctx, 'sourceHealthSeniorSupport', [
        '몸과 마음을 챙기는 일은 혼자만의 숙제가 아니에요. 편하게 안부를 나누고 함께 쉬는 시간이 있으면 회복도 더 자연스럽게 이어져요.',
        '가까운 사람과 연결되는 시간이 컨디션을 받쳐 줄 수 있어요. 짧은 대화나 함께한 식사처럼 부담 없는 만남을 두면 마음의 긴장도 조금씩 풀려요.',
        '회복은 혼자 버티는 힘만으로 만들어지지 않아요. 마음이 편한 사람에게 안부를 묻고, 함께 걸을 시간을 두면 몸의 리듬도 더 안정되기 쉬워요.',
        '회복이 필요할 때는 혼자 조용히 버티는 것만이 답은 아니에요. 편한 사람과 짧게 이야기하거나 함께 걷는 시간이 몸의 긴장을 낮춰 줄 수 있어요.',
        '가까운 사람과 연결되는 시간은 컨디션 관리에도 도움이 돼요. 큰 부탁이 아니어도 안부, 산책, 따뜻한 식사처럼 부담 없는 방식이면 충분해요.',
        '몸과 마음이 지칠 때는 도움을 받는 일을 약한 모습으로 보지 않아도 돼요. 짧은 대화와 함께 쉬는 시간이 회복을 더 부드럽게 만들어 줘요.',
        '주변의 도움을 편하게 받아들이는 태도가 오래 힘이 돼요. 작은 부탁, 짧은 대화, 함께 쉬는 시간이 쌓이면 컨디션 관리도 덜 외롭게 느껴져요.',
      ]),
    )
    .replace(
      /비유하자면 평생의 컨디션은 마당 한쪽 우물처럼 천천히 차오르는 물이에요\. 한 번에 많이 길어 올리지 않아도, 매일 조금씩 챙긴 습관이 오래 든든하게 받쳐 줘요\./g,
      pickVariant(ctx, 'sourceHealthBalancedBasics', [
        '비유하자면 긴 시간의 컨디션은 매일 조금씩 채우는 물잔과 같아요. 한 번에 많이 바꾸지 않아도 잠, 식사, 움직임을 꾸준히 챙기면 몸의 바탕이 든든해져요.',
        '컨디션은 한 번에 저장해 두는 힘이 아니에요. 매일 조금씩 쉬고, 먹고, 움직이는 반복이 쌓일 때 필요할 때 다시 회복할 여유가 생겨요.',
        '몸의 바탕은 천천히 다져지는 생활 리듬에 가까워요. 크게 특별한 관리보다 매일 비슷한 시간에 쉬고 움직이는 습관이 긴 시간을 받쳐 줘요.',
        '몸의 기본은 한 번에 좋아지기보다 반복되는 생활에서 차분히 만들어져요. 잠, 식사, 움직임을 비슷한 시간에 챙기면 긴 흐름도 더 안정돼요.',
        '컨디션의 바탕은 특별한 관리보다 매일 돌아오는 습관에 가까워요. 무리하지 않고 다시 할 수 있는 리듬이 몸과 마음을 오래 받쳐 줘요.',
        '건강은 한 번 크게 챙기는 일보다 작게 반복하는 일에 더 오래 반응해요. 쉬는 시간과 움직이는 시간을 꾸준히 남기면 몸의 기준도 또렷해져요.',
        '비유하자면 건강은 오래 쓰는 그릇을 매일 닦아 두는 일과 비슷해요. 작게 챙긴 잠과 식사, 가벼운 움직임이 쌓이면 나중의 부담을 훨씬 줄여 줘요.',
      ]),
    )
    .replace(
      /환절기 신호 — 콧물이나 가벼운 기침 — 가 보이면 따뜻한 옷과 따뜻한 국물 한 그릇으로 받쳐 주는 자리가 도움이 돼요\./g,
      pickVariant(ctx, 'sourceChildHealthSleep', [
        '환절기에 콧물이나 가벼운 기침이 보이면 따뜻한 옷과 편안한 식사부터 챙겨 주세요.',
        '환절기 신호가 보일 때는 새 활동을 늘리기보다 몸을 따뜻하게 하고 충분히 쉬게 하는 편이 좋아요.',
        '콧물이나 가벼운 기침이 보이면 아이가 덜 지치도록 옷차림, 식사, 잠자는 시간을 먼저 살펴 주세요.',
        '환절기에는 작은 신호를 가볍게 넘기지 않는 것이 좋아요. 따뜻하게 입히고 편하게 먹이고 쉬게 하면 회복에 도움이 돼요.',
      ]),
    )
    .replace(
      /이번 주는 후반기 흐름답게 차분한 흐름이 잘 맞아요\. 무리한 자리 대신, 자리 자리를 정돈하는 페이스가 단단한 회복의 자산이에요\./g,
      pickVariant(ctx, 'sourceHealthWeekAutumnPace', [
        '이번 주는 차분하게 생활 리듬을 다듬는 쪽이 잘 맞아요. 무리한 일정은 줄이고 잠, 식사, 쉬는 시간을 제자리에 놓으면 회복감이 훨씬 단단해져요.',
        '이번 주에는 큰 변화를 만들기보다 몸이 편했던 리듬을 다시 찾는 편이 좋아요. 약속을 줄이고 쉬는 시간을 먼저 정하면 몸과 마음의 부담이 가벼워져요.',
        '차분한 페이스가 어울리는 한 주예요. 해야 할 일을 조금 덜어 내고 생활 공간과 수면 리듬을 정돈하면 다음 주로 넘어가는 힘이 생겨요.',
        '이번 주 건강 흐름은 더 해내는 것보다 덜 지치는 쪽에 무게가 있어요. 무리한 약속 대신 몸이 회복되는 시간을 남겨 두면 컨디션이 부드럽게 안정돼요.',
      ]),
    )
    .replace(
      /무리한 다이어트·과도한 야근·잠 부족 같은 습관만 한 번씩 정리하면, 후반기 흐름이 한결 가벼워져요\. 갈피를 못 잡는 시도가 많은 시기지만, 한 가지를 길게 이어 가는 연습이 가장 큰 약이에요\./g,
      pickVariant(ctx, 'sourceLifeHealth20Habits', [
        '무리한 다이어트, 과한 야근, 잠을 줄이는 습관은 한 번씩 점검해 보는 편이 좋아요. 한꺼번에 완벽해지려 하기보다 하나의 생활 리듬을 오래 지키는 쪽이 몸을 더 편하게 해 줘요.',
        '20대에는 여러 방식을 시험해 볼 수 있지만, 몸을 너무 몰아붙이면 피로가 뒤늦게 쌓일 수 있어요. 식사, 잠, 움직임 중 하나만 안정시켜도 다음 시기의 컨디션이 훨씬 가벼워져요.',
        '새로운 생활을 많이 시도하는 때일수록 기본 리듬을 잃지 않는 것이 중요해요. 잠을 줄이고 식사를 거르는 습관을 조금씩 정리하면 몸의 바탕이 더 단단해져요.',
        '갈피를 못 잡는 시도가 있어도 괜찮아요. 다만 몸을 지치게 하는 반복 하나를 알아차리고 줄이면, 20대 후반의 컨디션이 훨씬 편하게 이어질 수 있어요.',
      ]),
    )
    .replace(
      /새 도전·새 운동을 받아 내는 그릇이 큰 시기예요\. 다만 강한 자극이 곧 효과라는 말에 휘둘리기보다, 자기 페이스를 천천히 찾아가는 편이 잘 맞아요\./g,
      pickVariant(ctx, 'sourceLifeHealth20Challenge', [
        '새 운동이나 새로운 생활 방식을 받아들이는 힘은 충분한 시기예요. 그래도 강한 자극이 늘 좋은 결과로 이어지는 것은 아니니, 몸이 편하게 따라오는 속도를 먼저 확인해 보세요.',
        '도전할 힘이 큰 때지만, 세게 하는 것보다 꾸준히 이어 가는 쪽이 더 오래 남아요. 운동이든 생활 습관이든 다음 날에도 무리 없이 할 수 있는 강도가 가장 현실적이에요.',
        '새로운 운동을 시작하기 좋은 시기라도 처음부터 강도를 높일 필요는 없어요. 몸이 어떻게 반응하는지 며칠 살피며 천천히 올리는 편이 더 안전하고 오래 가요.',
        '몸이 잘 받아 주는 때일수록 자신의 속도를 아는 일이 중요해요. 남들이 좋다고 하는 방식보다 내 몸이 덜 지치고 오래 이어지는 방식을 찾는 편이 좋아요.',
      ]),
    )
    .replace(
      /길게 보면 20대의 작은 잠 부족, 작은 식사 거름이 30대 이후 컨디션의 출발선을 정해요\. 지금 챙긴 한 시간의 잠, 한 그릇의 식사가 평생 단위로 보면 가장 큰 약이 되어 몸의 기반을 받쳐 줘요\./g,
      pickVariant(ctx, 'sourceLifeHealth20LongView', [
        '길게 보면 20대에 챙긴 잠과 식사는 뒤의 컨디션을 받쳐 주는 기본선이 돼요. 오늘 한 시간 더 쉬고 한 끼를 편하게 챙기는 일이 나중의 몸을 덜 흔들리게 해 줘요.',
        '지금은 작은 잠 부족이나 식사 거름이 가볍게 느껴질 수 있어요. 하지만 그런 반복을 조금씩 줄여 두면 30대 이후에도 몸의 회복력이 훨씬 편하게 이어져요.',
        '20대의 몸 관리는 거창한 계획보다 기본을 놓치지 않는 데서 시작돼요. 잠, 식사, 가벼운 움직임을 챙긴 날들이 쌓이면 뒤의 생활을 든든하게 받쳐 줘요.',
        '오늘의 한 끼와 잠 한 시간이 작아 보여도 오래 보면 중요한 기준이 돼요. 지금 몸을 덜 지치게 만드는 선택이 다음 시기의 생활 리듬을 편하게 만들어 줘요.',
      ]),
    )
    .replace(
      /비유하자면 20대의 컨디션은 두꺼운 책의 첫 장 같아요\. 첫 장에 남긴 작은 표시가 책 전체의 길잡이가 되듯, 지금 챙긴 잠 한 시간과 식사 한 끼가 오래 지나도 또렷한 기준으로 남아요\./g,
      pickVariant(ctx, 'sourceLifeHealth20Metaphor', [
        '비유하자면 20대의 컨디션은 긴 여행을 시작하기 전의 짐 정리와 같아요. 필요한 것을 잘 챙겨 두면 뒤의 길이 조금 험해져도 다시 균형을 잡기 쉬워요.',
        '20대의 몸은 새 노트를 여는 첫 장처럼 볼 수 있어요. 오늘 적어 둔 잠, 식사, 움직임의 작은 습관이 시간이 지나도 생활의 길잡이로 남아요.',
        '비유하자면 지금의 컨디션은 집의 바닥을 고르는 시간이에요. 눈에 크게 드러나지 않아도 바닥이 편하면 그 위에 올리는 생활이 훨씬 안정돼요.',
        '20대의 작은 관리 습관은 나중에 다시 꺼내 쓰는 지도 같아요. 어느 속도가 편했는지, 어떤 식사가 맞았는지 남겨 두면 다음 선택이 쉬워져요.',
      ]),
    )
    .replace(
      /멀어지는 게 아니라, 서로에게 맞는 간격을 새로 배우는 흐름이라고 봐 주세요\. 가까운 사람끼리도 말이 엇갈리거나 기대가 흔들릴 수 있으니, 큰 결론을 바로 내기보다 한 박자 쉬고 확인하는 태도가 필요해요\. 인생 전체로 보면 이때 정한 거리감이 30대 이후 가족 관계의 출발점이 돼요\./g,
      pickVariant(ctx, 'sourceLifeFamily20Distance', [
        '가족과 거리가 생기는 것은 멀어진다는 뜻이 아니라 서로의 생활을 새로 맞춰 보는 과정이에요. 다만 기대가 엇갈릴 때는 바로 결론을 내기보다 한 박자 쉬고 확인하면 관계가 덜 흔들려요.',
        '20대의 가족 관계는 붙어 있던 거리를 다시 조정하는 시간에 가까워요. 자주 보지 못해도 안부와 약속의 리듬을 만들면 부담이 한쪽으로 몰리는 일을 줄일 수 있어요.',
        '서로에게 맞는 거리를 배우는 시기예요. 독립된 생활을 존중하면서도 서운한 장면이 생기면 짧게 확인하고 천천히 풀어야 나중의 가족 관계도 편해져요.',
        '멀리 떨어지는 것처럼 보여도 관계가 약해지는 것은 아니에요. 각자의 생활을 인정하되, 말이 어긋나는 날에는 잠시 늦추고 다시 만나는 방식을 정하면 호흡이 부드러워져요.',
        '가족과의 간격을 다시 잡는 시기에는 마음만 앞서면 서로 부담스러울 수 있어요. 연락 주기와 도움의 크기를 작게 확인하면 독립과 가까움이 함께 안정돼요.',
        '이 시기의 거리 조절은 가족을 밀어내는 일이 아니라 서로의 생활을 배우는 과정이에요. 기대가 흔들릴 때는 확인할 말 하나만 남겨도 관계의 불편함이 줄어요.',
      ]),
    )
    .replace(
      /부모님과는 어른 대 어른의 대화가 자라기 시작하고, 형제·가까운 친구는 오래 가는 동반자가 될 수 있어요\. 너무 멀지도 가깝지도 않은 간격을 찾는 일이 이 시기의 핵심이에요\./g,
      pickVariant(ctx, 'sourceLifeFamily20Parents', [
        '부모님과는 보호받는 관계에서 서로의 생활을 존중하는 대화로 조금씩 옮겨 가요. 형제나 가까운 친구와는 자주 기대는 방식보다 오래 편한 거리를 찾는 것이 중요해요.',
        '가족과 이야기할 때도 내 생활의 기준을 부드럽게 말해 보는 연습이 필요해요. 너무 멀어지지 않고 너무 기대지도 않는 간격이 20대의 관계를 안정시켜 줘요.',
        '부모님과는 어른 대 어른으로 말하는 시간이 조금씩 늘어나요. 형제와 가까운 친구는 생활의 큰 배경이 될 수 있으니, 짧은 안부와 작은 약속을 꾸준히 남겨 보세요.',
        '이 시기에는 가족에게 모든 것을 맞추기보다 내 기준을 설명하는 힘이 자라요. 서로의 생활을 인정하면서도 필요한 때 연결되는 방식이 가장 오래 가요.',
      ]),
    )
    .replace(
      /길게 보면 20대의 가족 호흡이 30대 이후 자기 살림의 단단함을 만들어 줘요\. 한 뼘의 적당한 거리와 꾸준한 안부가 평생 가족 관계의 토대가 되어 자기를 받쳐 줘요\./g,
      pickVariant(ctx, 'sourceLifeFamily20LongView', [
        '길게 보면 20대에 만든 가족과의 리듬이 이후 자기 생활의 안정감으로 이어져요. 적당한 거리와 꾸준한 안부가 있으면 가족 관계가 부담보다 바탕이 될 수 있어요.',
        '20대에 가족과 주고받는 방식은 뒤의 생활에도 오래 남아요. 자주 보는 것보다 서로 편하게 연락할 수 있는 기준을 만드는 일이 더 중요할 수 있어요.',
        '지금 정한 가족과의 간격은 나중에 자기 살림을 지킬 때 큰 기준이 돼요. 무리한 책임을 떠안기보다 가능한 안부와 도움의 크기를 정해 두면 좋아요.',
        '꾸준한 안부와 적당한 거리는 가족 관계를 오래 편하게 만드는 힘이에요. 지금부터 그 리듬을 익혀 두면 다음 시기의 선택도 덜 흔들려요.',
      ]),
    )
    .replace(
      /아이가 생기는 경우에는 내가 받았던 따뜻함을 다른 방식으로 건네는 시간이 될 수 있어요\. 그렇지 않더라도 형제, 가까운 친구, 이웃처럼 오래 곁에 있는 사람이 가족처럼 든든해지는 시기예요\./g,
      pickVariant(ctx, 'sourceLifeFamily20Parents', [
        '가족의 폭이 넓어지는 시기에는 새 역할을 한 번에 완벽하게 해내려 하지 않아도 괜찮아요. 아이가 있든 없든 오래 곁에 있는 사람과 따뜻함을 나누는 방식이 조금씩 달라져요.',
        '이 시기에는 가까운 사람을 돌보는 방식이 새로 정리돼요. 아이를 키우는 흐름이 있다면 받은 마음을 다른 모양으로 건네고, 그렇지 않다면 형제나 친구와의 유대가 더 든든해질 수 있어요.',
        '가족이라는 말의 범위가 조금 넓어질 수 있어요. 자녀, 형제, 오래된 친구, 이웃처럼 서로의 생활을 알고 지내는 사람이 중요한 바탕으로 들어와요.',
        '받았던 돌봄을 그대로 반복하기보다 지금 생활에 맞게 바꾸어 나누는 시기예요. 가까운 사람과 어떤 방식으로 시간을 나눌지 정하면 관계가 덜 막연해져요.',
        '돌봄은 한 가지 모양으로만 이어지지 않아요. 지금의 생활, 시간, 체력에 맞게 표현 방식을 바꾸면 가족의 의미도 더 편안하게 넓어져요.',
        '가까운 사람을 챙기는 마음이 커질수록 내가 감당할 수 있는 범위를 함께 정해야 해요. 그래야 따뜻함이 부담으로 바뀌지 않고 오래 이어져요.',
      ]),
    )
    .replace(
      /모두를 한꺼번에 챙기려 하지 말고 한 사람씩 시간을 나누어 두면 좋아요\. 30대에 만든 대화 방식과 역할 기준은 40대 이후의 가족 그림을 훨씬 안정적으로 만들어 줘요\./g,
      pickVariant(ctx, 'sourceLifeFamily20LongView', [
        '모든 사람을 동시에 챙기려 하면 쉽게 지칠 수 있어요. 먼저 자주 만날 사람, 짧게 안부만 전할 사람, 나중에 천천히 볼 사람을 나누면 가족의 부담이 줄어요.',
        '30대에는 관계의 양보다 역할을 나누는 방식이 더 중요해져요. 대화 시간과 도움의 범위를 정해 두면 40대 이후에도 가족 관계가 덜 흔들려요.',
        '이 시기에는 자주 만나는지보다 어떤 책임을 함께 나누는지가 더 중요해질 수 있어요. 연락, 돌봄, 경제적 도움의 범위를 미리 말해 두면 관계가 훨씬 현실적으로 안정돼요.',
        '챙겨야 할 관계가 늘어날수록 모든 기대에 바로 답하기 어렵습니다. 가능한 도움과 기다려야 할 도움을 나누면 가족 안의 부담도 덜 쌓여요.',
        '한 사람씩 시간을 나누어 두는 태도가 오래 도움이 돼요. 지금 만든 연락 방식과 책임의 크기가 뒤의 가족 그림을 안정적으로 받쳐 줄 수 있어요.',
        '챙길 사람이 많아질수록 순서를 정하는 일이 필요해요. 급한 일과 기다려도 되는 일을 나누면 가족 안의 기대도 더 현실적으로 맞춰져요.',
      ]),
    )
    .replace(
      /부모님 세대의 변화는 천천히 나타나기 쉬우니, 건강이나 생활의 작은 신호를 가볍게 기록해 두면 좋아요\. (?:자녀와|가족과)는 어른 대 어른으로 거리를 다시 맞추는 시간이 필요하고, 조언보다 응원이 더 따뜻하게 닿을 때가 많아요\./g,
      pickVariant(ctx, 'sourceLifeFamily20Parents', [
        '부모님 쪽 변화는 갑자기 큰 사건으로만 오지 않을 수 있어요. 생활 습관이나 건강 신호를 가볍게 기록해 두고, 자녀에게는 조언보다 응원을 먼저 건네면 관계가 편해져요.',
        '이 시기에는 위 세대와 아래 세대의 속도가 서로 다를 수 있어요. 부모님의 작은 변화를 살피되, 자녀의 선택은 한 걸음 떨어져 지켜보는 태도가 더 따뜻하게 닿아요.',
        '부모님을 챙길 때는 큰 결론보다 작은 변화를 놓치지 않는 기록이 도움이 돼요. 자녀와는 지시보다 믿고 기다리는 말이 오래 남을 수 있어요.',
        '가족 안에서 돌봄과 응원이 동시에 필요해지는 때예요. 부모님의 생활 신호는 차분히 살피고, 자녀에게는 바로 고쳐 주려 하기보다 스스로 정할 시간을 남겨 주세요.',
      ]),
    )
    .replace(
      /형제나 가까운 친척과도 이 시기에 만든 연락 리듬이 오래 남아요\. 짧은 안부와 필요한 도움의 범위를 미리 나누면 가족 안의 부담이 한쪽으로 몰리지 않아요\./g,
      pickVariant(ctx, 'sourceLifeFamily20LongView', [
        '형제나 가까운 친척과는 자주 보는 것보다 끊기지 않는 연락 기준이 더 오래 도움이 돼요. 안부의 주기와 도울 수 있는 범위를 정해 두면 부담이 덜 쌓여요.',
        '형제나 친척 사이에서는 자주 만나지 못해도 기준이 있으면 관계가 덜 멀어져요. 연락할 때와 도울 수 있는 범위를 미리 말해 두면 서로 기대가 편해져요.',
        '가까운 친척 관계는 마음만으로 오래 버티기보다 실제 가능한 연락과 도움을 나눌 때 안정돼요. 무리하지 않는 기준이 있어야 정이 부담으로 바뀌지 않아요.',
        '형제와 친척에게는 큰 약속보다 끊기지 않는 작은 신호가 더 오래 남을 수 있어요. 안부를 전할 방식과 도움의 크기를 정해 두면 관계가 차분해져요.',
        '가족 안의 부담이 한 사람에게 몰리지 않으려면 역할을 작게 나누어야 해요. 연락, 방문, 도움의 범위를 미리 정하면 서로 덜 지치게 이어 갈 수 있어요.',
        '가까운 친척 관계도 이 시기에 다시 정리될 수 있어요. 서로에게 가능한 도움의 크기를 미리 말해 두면 한 사람에게 책임이 몰리는 일을 줄일 수 있어요.',
        '형제와 친척 사이에서는 마음만 앞세우기보다 실제로 가능한 연락과 도움의 범위를 나누는 편이 좋아요. 그래야 오래 편한 관계로 이어져요.',
        '짧은 안부라도 꾸준히 이어지면 가족의 안전망이 돼요. 다만 도움은 감당할 수 있는 크기로 정해야 서로가 덜 지쳐요.',
      ]),
    )
    .replace(
      /거리감이 생기는 건 멀어지는 게 아니라, 자기 기준을 만들기 위한 자연스러운 호흡이에요\. 가족과 친구의 비중이 어느 시기보다 비슷해지는 시기이기도 해요\./g,
      pickVariant(ctx, 'sourceLifeFamilyTeenDistance', [
        '가족과 조금 떨어져 보고 싶은 마음은 관계가 나빠졌다는 뜻이 아니에요. 자기 생각을 만들고 친구와 가족 사이의 균형을 배워 가는 자연스러운 과정이에요.',
        '이 시기에는 가족보다 친구 이야기가 더 크게 느껴질 수 있어요. 그래도 가족과의 연결이 사라지는 것은 아니고, 내 기준을 만들어 가는 연습에 가까워요.',
        '거리감은 멀어짐이 아니라 숨 쉴 공간을 찾는 과정이에요. 가족과 친구 사이에서 나에게 편한 말투와 거리를 배워 가면 관계가 더 안정돼요.',
        '가족과 생각이 달라지는 순간이 있어도 너무 걱정하지 않아도 돼요. 그 차이를 통해 내가 어떤 사람인지 알아 가는 힘이 자라요.',
      ]),
    )
    .replace(
      /작은 실천으로는 일주일에 한 번 짧게 이야기할 시간을 정해 두면 좋아요\. 길게 이야기하지 않아도 한 끼 식사 동안 그날 있었던 한 가지 일을 가족에게 짧게 들려주는 흐름만으로도 거리감이 부드럽게 풀려요\./g,
      pickVariant(ctx, 'sourceLifeFamilyTeenPractice', [
        '작은 실천으로는 일주일에 한 번 짧게 이야기할 시간을 정해 두면 좋아요. 긴 설명이 아니어도 오늘 있었던 일 하나를 나누면 가족과의 거리가 훨씬 부드러워져요.',
        '하루를 전부 설명하지 않아도 괜찮아요. 식사 시간이나 이동 중에 있었던 일 하나만 짧게 말해도 가족은 내 마음의 변화를 더 편하게 이해할 수 있어요.',
        '가족과 대화가 어색하면 짧은 안부부터 시작해 보세요. 오늘 좋았던 일이나 힘들었던 일 하나를 나누는 것만으로도 마음의 간격이 좁아져요.',
        '대화를 오래 이어 가려 하지 않아도 돼요. 일주일에 한 번, 한 가지 이야기를 나누는 작은 습관이 가족 안에서 내 자리를 편하게 만들어 줘요.',
      ]),
    )
    .replace(
      /인생 전체로 보면 이 시기의 자기 기준을 천천히 인정해 가는 것이, 나중에 가족에게 더 단단하게 다가갈 수 있는 뿌리예요\. 부딪히는 일이 있어도, 그 경험이 관계의 모양을 만들어 가는 과정이에요\./g,
      pickVariant(ctx, 'sourceLifeFamilyTeenRoots', [
        '길게 보면 이때 만든 자기 기준이 나중에 가족과 더 편하게 지내는 바탕이 돼요. 의견이 부딪히는 경험도 결국 서로의 모습을 알아 가는 과정으로 남아요.',
        '지금 내 생각을 천천히 인정받는 경험은 훗날 가족에게 더 단단하게 다가가는 힘이 돼요. 갈등이 생겨도 그것만으로 관계가 끝나는 것은 아니에요.',
        '가족 안에서 자기 기준을 세우는 일은 시간이 걸려요. 부딪히는 장면이 있어도 그 과정을 통해 서로에게 맞는 대화 방식이 조금씩 만들어져요.',
        '이 시기의 작은 갈등은 관계를 망치는 일이 아니라 서로의 선을 배우는 과정일 수 있어요. 내 기준을 부드럽게 말하는 연습이 나중의 관계를 도와줘요.',
      ]),
    )
    .replace(
      /매력과 표현이 강하게 보이는 시기일 수 있어요\. 그 힘은 무대 위 표현, 발표, 창작처럼 사람들이 모이는 곳에서 가장 먼저 빛을 내요\. 마음이 가는 사람이 생기더라도 큰 약속 같은 단정은 한참 뒤의 이야기로 두고, 지금은 좋아하는 사람과 함께 보내는 시간 안에서 서로의 마음을 알아 가면 충분해요\./g,
      pickVariant(ctx, 'sourceLifeRomanceTeenSignal', [
        '표현하고 싶은 마음이 커지는 시기예요. 발표, 활동, 창작처럼 사람들과 함께하는 곳에서 자기 매력이 자연스럽게 드러날 수 있지만, 관계를 큰 결론으로 서두를 필요는 없어요.',
        '좋아하는 사람이 생겨도 지금은 큰 약속보다 서로를 알아 가는 시간이 더 중요해요. 함께 웃고 이야기하는 작은 경험이 마음을 더 안전하게 자라게 해 줘요.',
        '사람들 앞에서 자기 생각을 보여 주는 힘이 커질 수 있어요. 마음이 가는 사람이 있더라도 단정하기보다 편하게 시간을 보내며 서로의 속도를 보는 편이 좋아요.',
        '이 시기의 끌림은 큰 결론보다 다양한 관계 경험 속에서 더 잘 자라요. 표현하고 싶은 마음은 소중하지만, 상대의 속도와 내 마음을 함께 살피면 더 편안해져요.',
      ]),
    )
    .replace(
      /좋아하는 마음을 표현할 땐 한 박자 천천히 골라 보세요\. 짧은 안부, 함께 즐기는 활동, 작은 응원이 관계를 가장 부드럽게 만들어 줘요\. 기다리는 시간이 어색하게 느껴질 수도 있지만, 그 시간 안에서 자기 페이스를 지키는 연습이 다음 시기의 가장 큰 자산이 돼요\./g,
      pickVariant(ctx, 'sourceLifeRomanceTeenExpression', [
        '좋아하는 마음을 전하고 싶을 때는 한 번 숨을 고르고 말해도 늦지 않아요. 짧은 안부나 작은 응원처럼 부담 없는 표현이 관계를 더 편하게 이어 줘요.',
        '마음이 앞설수록 상대가 대답할 시간을 남겨 두는 편이 좋아요. 함께하는 활동, 짧은 칭찬, 편한 인사가 서로의 마음을 천천히 확인하게 해 줘요.',
        '표현은 크지 않아도 충분해요. 오늘 함께 웃은 일이나 고마웠던 순간을 가볍게 말하면 관계가 훨씬 부드럽게 자라요.',
        '기다리는 시간이 어색할 수 있지만 그 시간도 내 마음을 알아 가는 과정이에요. 서두르지 않고 자기 페이스를 지키는 연습이 다음 관계에도 도움이 돼요.',
      ]),
    )
    .replace(
      /어렵게 느껴지는 과목이 있다면 단숨에 정복하기보다 한 단원씩 자기 말로 풀어 보는 식이 잘 맞아요\. 친구와 함께 푸는 시간이 도움이 될 때도 있고, 혼자 조용히 정리하는 시간이 깊이를 만들 때도 있어요\./g,
      pickVariant(ctx, 'sourceLifeAcademicTeenChallenge', [
        '어렵게 느껴지는 과목은 한 번에 끝내려 하지 않아도 괜찮아요. 한 단원씩 자기 말로 설명해 보면 무엇을 아는지, 어디서 막히는지 훨씬 또렷하게 보여요.',
        '막히는 과목이 있을 때는 문제를 많이 푸는 것보다 오늘 이해할 작은 범위를 정하는 편이 좋아요. 친구와 함께 확인하거나 혼자 조용히 정리하는 시간 모두 도움이 될 수 있어요.',
        '어려운 내용은 단숨에 정복하는 것보다 여러 번 다시 보는 쪽이 잘 맞아요. 한 문단, 한 문제, 한 단어처럼 작게 나누면 공부가 훨씬 덜 무겁게 느껴져요.',
        '친구와 같이 풀어 볼 때 힘이 나는 날도 있고 혼자 정리해야 깊어지는 날도 있어요. 중요한 것은 내게 맞는 방식으로 한 단원씩 이해를 쌓는 거예요.',
      ]),
    )
    .replace(
      /비유하자면 매일 한 줌씩 모래를 더하는 그릇과 같아요\. 한 줌은 작아 보여도 한 학기가 지나면 내가 해낸 흔적이 눈에 보여요\. 그 흔적이 다음 공부를 시작하는 힘이 돼요\./g,
      pickVariant(ctx, 'sourceLifeAcademicTeenMetaphor', [
        '비유하자면 공부는 작은 벽돌을 하루에 하나씩 쌓는 일과 같아요. 오늘 한 문제, 내일 한 문장이 쌓이면 어느 순간 내가 만든 길이 눈에 보여요.',
        '매일의 공부는 작은 씨앗을 돌보는 일과 비슷해요. 당장 크게 보이지 않아도 물을 주듯 반복하면 한 학기 뒤에는 분명한 변화가 남아요.',
        '비유하자면 노트 한 장을 천천히 채우는 과정이에요. 한 줄은 작아 보여도 여러 장이 모이면 내가 어디까지 왔는지 보여 주는 기록이 돼요.',
        '공부의 흔적은 하루하루 크게 보이지 않을 수 있어요. 하지만 작은 확인이 쌓이면 다음 단원을 시작할 때 나를 밀어 주는 힘이 돼요.',
      ]),
    )
    .replace(
      /공부가 손에 잡히지 않는 시기가 와도 자책할 필요는 없어요\. 잠을 충분히 자고 가벼운 산책 한 번 다녀온 뒤 다시 책상 앞에 앉아 보면, 막혀 있던 단원이 한결 부드러워져요\./g,
      pickVariant(ctx, 'sourceLifeAcademicTeenRecovery', [
        '공부가 잘 잡히지 않는 날이 있어도 자신을 몰아붙이지 않아도 괜찮아요. 잠깐 쉬고 물을 마시거나 가볍게 걷고 돌아오면 막힌 부분이 조금 다르게 보일 수 있어요.',
        '집중이 흐트러지는 시기는 누구에게나 있어요. 잠을 챙기고 몸을 조금 움직인 뒤 다시 보면 어려웠던 단원도 덜 답답하게 느껴질 수 있어요.',
        '책상 앞에 오래 앉아 있어도 잘 안 풀릴 때는 잠깐 자리를 바꿔 보세요. 짧은 휴식이 공부를 포기하는 일이 아니라 다시 시작할 힘을 만드는 시간이 될 수 있어요.',
        '막히는 날에는 더 세게 밀어붙이기보다 몸과 마음을 먼저 정리하는 편이 좋아요. 쉬고 돌아온 뒤 한 문제만 다시 보는 것으로도 충분히 흐름을 되찾을 수 있어요.',
      ]),
    )
    .replace(
      /학교 밖의 작은 프로젝트, 짧은 글, 발표 한 번이 의외로 다음 길을 열어 주는 경우가 많아요\. 너무 멀리 보고 막막해지기보다, 한 학기 한 학기의 결과물을 차곡차곡 모아 두는 방식이 잘 어울려요\./g,
      pickVariant(ctx, 'sourceLifeAcademic20Project', [
        '수업 밖에서 해 본 작은 프로젝트나 발표 한 번이 나중의 방향을 보여 줄 때가 있어요. 너무 먼 미래를 한 번에 정하려 하기보다 이번 학기에 남길 결과물 하나를 정해 보세요.',
        '짧은 글, 발표, 팀 활동처럼 직접 만들어 본 경험은 생각보다 오래 남아요. 잘한 것만 모으려 하기보다 해 보며 배운 점을 함께 적어 두면 다음 선택의 자료가 돼요.',
        '20대의 배움은 교실 안팎의 경험이 함께 쌓이는 과정이에요. 관심이 가는 주제를 작게 시험해 보고, 결과와 느낌을 남기면 자기 분야를 고르는 감각이 더 또렷해져요.',
        '막연한 진로 고민이 커질 때는 큰 답보다 작은 산출물이 도움이 돼요. 글 한 편, 발표 자료, 짧은 실험 기록처럼 손에 남는 결과가 다음 방향을 보여 줄 수 있어요.',
        '앞길이 넓게 느껴질수록 이번 학기나 이번 달에 끝낼 수 있는 결과물을 하나 정해 보세요. 작은 완성 경험이 쌓이면 관심 분야와 맞는 방식이 더 선명해져요.',
        '진로는 생각만으로 또렷해지기보다 해 본 흔적을 통해 선명해질 때가 많아요. 짧은 글, 자료 정리, 작은 실험처럼 남는 결과를 만들면 다음 선택의 기준이 생겨요.',
        '학교 밖 경험은 거창하지 않아도 괜찮아요. 작은 프로젝트를 끝까지 해 보고 무엇이 재미있었는지 적어 두면 나중에 전공이나 일의 방향을 고를 때 기준이 생겨요.',
      ]),
    )
    .replace(
      /자기만의 노트와 결과물이 나중에 나를 설명해 주는 좋은 자료가 되어 줘요\./g,
      pickVariant(ctx, 'sourceLifeAcademic20Record', [
        '자기만의 노트와 결과물은 나중에 나를 설명해 주는 좋은 자료가 돼요.',
        '배운 내용과 해 본 일을 짧게 모아 두면 나중에 자기 강점을 설명하기 훨씬 쉬워져요.',
        '결과물은 잘한 점만 보여 주는 자료가 아니에요. 고민한 과정과 고친 흔적까지 남겨 두면 내가 어떤 방식으로 배우는지 드러나요.',
        '노트, 파일, 발표 자료를 한곳에 모아 두면 시간이 지나도 내 관심의 흐름을 다시 확인할 수 있어요.',
        '작은 기록들이 쌓이면 나중에 자기소개나 선택의 기준이 돼요. 지금은 완벽한 자료보다 다시 꺼내 볼 수 있는 흔적을 남기는 것이 중요해요.',
      ]),
    )
    .replace(
      /비유하자면 지금은 어떤 활동이 자기에게 잘 맞을지 천천히 살펴보는 봄이에요\. 빠르게 한 길을 정하기보다, 여러 모종 사이를 천천히 거닐어 보는 시간 자체가 평생의 양분이 되어 줘요\./g,
      pickVariant(ctx, 'sourceLifeCareerTeenSpring', [
        '비유하자면 지금은 여러 길을 둘러보며 나에게 맞는 신발을 신어 보는 시간이에요. 한 길을 빨리 정하기보다 다양한 활동을 경험하는 일이 나중의 선택을 더 편하게 만들어 줘요.',
        '지금은 빠르게 직업 이름을 정해야 하는 시기가 아니에요. 어떤 활동을 할 때 시간이 잘 가는지 천천히 살피는 과정 자체가 진로의 좋은 재료가 돼요.',
        '비유하자면 여러 색을 섞어 보며 나에게 맞는 색을 찾는 시간이에요. 한 가지 답을 급하게 고르기보다 활동과 과목을 경험해 보는 일이 자기 색을 보여 줘요.',
        '여러 가능성을 천천히 만져 보는 시간이 필요해요. 좋아하는 활동, 편하게 집중되는 순간, 칭찬받은 경험을 모으면 나중에 선택할 길이 더 또렷해져요.',
      ]),
    )
    .replace(
      /한 학기에 한 번씩 좋아하는 활동·과목·체험을 한 줄로 짧게 적어 두는 노트를 만들어 두면 좋아요\. 노트 한 권이 시간이 지나 펼쳐 보면 자기 색을 또렷하게 보여 주는 작은 지도가 돼요\./g,
      pickVariant(ctx, 'sourceLifeCareerTeenNotebook', [
        '한 학기에 한 번이라도 좋아했던 활동과 기억에 남은 과목을 짧게 적어 두면 좋아요. 시간이 지나 그 기록을 보면 내가 어떤 일에 마음이 움직였는지 더 쉽게 알 수 있어요.',
        '좋았던 체험, 재미있었던 과목, 칭찬받은 순간을 한 줄씩 남겨 보세요. 그 작은 기록들이 나중에는 내 방향을 보여 주는 지도가 돼요.',
        '진로 기록은 거창한 계획표가 아니어도 괜찮아요. 한 학기마다 좋았던 활동 하나만 적어도 시간이 지나 자기 색을 찾는 데 도움이 돼요.',
        '노트 한 권을 완벽하게 채우려 하지 않아도 돼요. 마음이 갔던 활동을 짧게 남겨 두면 나중에 선택할 때 믿을 만한 단서가 돼요.',
      ]),
    )
    .replace(
      /무리해서 정리하기보다 자연스러운 만남에 마음을 열어 두면 좋은 장면이 따라와요\. 자기 색을 가볍게 정리해 가는 것이 가장 큰 선물이에요\./g,
      pickVariant(ctx, 'sourceExpressionClosing', [
        '억지로 정리하려 하기보다 자연스럽게 이어지는 만남을 편하게 받아들이면 좋아요. 지금까지 쌓아 온 이야기와 작업을 부담 없는 크기로 나누는 일이 자기 색을 오래 남겨요.',
        '이 시기에는 모든 결과를 한 번에 정리하려 하지 않아도 괜찮아요. 만나게 되는 사람과 편하게 이야기를 나누며, 오래 쌓인 표현을 생활 속 기억으로 남기면 충분해요.',
        '자기 색은 큰 발표보다 작은 대화 속에서 더 부드럽게 전해질 수 있어요. 자연스러운 만남 안에서 기억, 작업, 마음을 조금씩 나누면 좋은 흔적이 남아요.',
        '무언가를 완성해서 보여 주려는 부담은 줄여도 괜찮아요. 편한 만남과 짧은 대화가 쌓이면 그동안의 표현이 가까운 사람에게 따뜻하게 전해져요.',
        '오래 쌓아 온 표현은 억지로 정리할수록 딱딱해질 수 있어요. 자연스럽게 만나는 사람과 부담 없이 나누면 자기 색이 더 편안하게 남아요.',
        '지금 필요한 것은 큰 결론보다 편한 나눔에 가까워요. 한 사람과 나눈 짧은 이야기, 오래된 기억 하나가 자기 표현을 따뜻한 선물처럼 남겨요.',
      ]),
    )
    .replace(
      /무리해서 정리하기보다 자연스러운 만남에 마음을 열어 두면 좋은 장면이 따라와요\. 올해의 한 장면이 오래 기억에 남을 수 있어요\./g,
      pickVariant(ctx, 'sourceExpressionClosing', [
        '올해는 억지로 결과를 정리하기보다 자연스럽게 이어지는 만남을 편하게 받아들이면 좋아요. 그 안에서 나눈 말과 기억이 한 해의 따뜻한 장면으로 남을 수 있어요.',
        '한 해의 표현은 큰 결론보다 마음이 머문 장면에서 더 오래 남아요. 편한 만남 속에서 이야기와 작업을 조금씩 나누면 올해의 기억이 부드럽게 정리돼요.',
        '올해는 특별한 발표보다 가까운 사람과 나눈 시간이 더 의미 있게 남을 수 있어요. 자연스럽게 열린 만남 안에서 자기 색을 부담 없이 보여 주세요.',
        '무리해서 한 해를 정리하지 않아도 괜찮아요. 만나는 사람, 나눈 말, 남긴 작은 작업이 모이면 올해의 표현이 충분히 따뜻하게 남아요.',
      ]),
    )
    .replace(
      /오래 쌓인 표현은 큰 무대가 없어도 전해질 수 있어요\. 함께 웃고, 짧게 이야기하고, 예전 기억을 꺼내는 시간이 가까운 사람에게 따뜻한 흔적으로 남아요\./g,
      pickVariant(ctx, 'sourceExpressionClosing', [
        '오래 쌓아 온 말과 작업은 큰 무대가 없어도 전해질 수 있어요. 함께 웃고 기억을 나누는 시간이 가까운 사람에게 더 편안한 선물이 돼요.',
        '이 시기의 표현은 새로 증명하기보다 부드럽게 나누는 쪽에 가까워요. 짧은 이야기와 오래된 기억을 꺼내는 시간이 마음을 따뜻하게 이어 줘요.',
        '큰 결과물이 없어도 지나온 표현은 생활 속에서 충분히 빛날 수 있어요. 가까운 사람과 나눈 말 한마디가 오래 남는 흔적이 돼요.',
        '오래 쌓인 표현은 조용한 대화 안에서도 잘 전해져요. 예전 기억과 지금의 마음을 함께 나누면 가까운 사람에게 부담 없는 온기로 남아요.',
        '표현은 반드시 넓은 무대에서만 가치가 생기는 것은 아니에요. 편한 사람과 나눈 웃음, 짧은 이야기, 작은 기록이 자기 색을 오래 보여 줘요.',
        '이제는 보여 주기보다 나누는 방식이 더 잘 맞을 수 있어요. 오래 쌓아 온 이야기와 작업을 가까운 사람에게 조금씩 전하면 표현이 더 따뜻해져요.',
      ]),
    )
    .replace(
      /주변의 어떤 기대와도 거리를 두고, 자기 신호에 귀 기울이는 연습이 평생의 자산이 돼요\. 잠, 식사, 움직임 세 가지를 자기 생활에 맞게 챙기는 편이 좋아요\./g,
      pickVariant(ctx, 'sourceHealthBalancedPace', [
        '주변 기준에 나를 맞추기보다 몸이 편했던 리듬을 먼저 살피면 좋아요. 잠, 식사, 움직임 중 하나만 안정돼도 긴 시간의 컨디션이 훨씬 편해져요.',
        '다른 사람이 좋다고 말하는 방식이 늘 내 몸에 맞는 것은 아니에요. 잠자는 시간, 먹는 속도, 움직이는 양을 내 생활에 맞게 조절하는 연습이 오래 도움이 돼요.',
        '몸을 돌보는 기준은 바깥 기대보다 내 신호에서 시작하는 편이 좋아요. 피곤한 시간대와 편한 습관을 알아두면 다음 시기에도 조절이 쉬워져요.',
        '평생의 컨디션을 지키려면 남의 속도와 내 속도를 구분하는 힘이 필요해요. 잠, 식사, 움직임을 모두 바꾸기보다 지금 가장 편한 한 가지부터 붙잡아 보세요.',
        '주변의 기대가 커질수록 내 몸이 보내는 작은 신호를 더 천천히 보는 편이 좋아요. 쉬는 시간과 먹는 시간, 움직이는 시간을 내 생활 안에서 다시 맞추면 안정감이 생겨요.',
        '자기 신호를 듣는다는 말은 예민해지라는 뜻이 아니에요. 몸이 편했던 조건을 기억하고, 그 조건을 생활 속에 조금씩 남기는 현실적인 관리에 가까워요.',
      ]),
    )
    .replace(
      /무리하지 않는 페이스가 가장 길게 가는 흐름의 핵심이에요\. 작은 챙김이 누적되면, 후반기 흐름까지 든든하게 이어져요\./g,
      pickVariant(ctx, 'sourceHealthBalancedPace', [
        '가장 오래 가는 건강 관리는 무리하지 않는 속도에서 시작돼요. 작은 챙김이 반복되면 다음 시기에도 몸과 마음을 더 편하게 받쳐 줘요.',
        '몸을 오래 지키는 힘은 강하게 밀어붙이는 데서만 나오지 않아요. 조금씩 쉬고, 먹고, 움직이는 반복이 쌓이면 후반기의 컨디션도 더 안정돼요.',
        '좋은 페이스는 빠른 속도보다 다시 돌아올 수 있는 안정감에 가까워요. 매일의 작은 챙김을 놓치지 않으면 시간이 지나 몸의 기준이 더 또렷해져요.',
        '무리하지 않는다는 말은 약하게 가자는 뜻이 아니에요. 오래 이어 갈 수 있는 크기를 고르는 것이고, 그 선택이 다음 시기의 몸을 든든하게 받쳐 줘요.',
        '컨디션은 한 번에 크게 좋아지기보다 작은 관리가 반복될 때 편해져요. 오늘 부담을 조금 줄이는 선택 하나가 후반기의 생활 리듬까지 부드럽게 이어질 수 있어요.',
        '긴 시간으로 보면 꾸준히 챙긴 작은 습관이 가장 믿을 만한 바탕이 돼요. 무리하지 않는 속도를 지키면 몸도 마음도 다음 변화를 더 편하게 받아들여요.',
      ]),
    )
    .replace(
      /해석을 덮기 전에 인생 전체의 관계와 마음에서 편했던 대화와 불편했던 대화를 하나씩 떠올려 보세요\. 두 장면을 비교하면 다음 말투를 고르기 쉬워요\./g,
      pickVariant(ctx, 'sourceRomanceSelfCheckDetail', [
        '해석을 덮기 전에 인생 전체의 관계와 마음에서 마음이 편했던 대화와 조심스러웠던 대화를 나누어 보세요. 두 장면이 보이면 다음에는 어떤 말투를 줄일지 더 분명해져요.',
        '읽고 난 뒤에는 인생 전체의 관계와 마음에서 말이 잘 통했던 순간과 부담이 커졌던 순간을 하나씩 떠올려 보세요. 이유를 나누면 다음 대화가 덜 흔들려요.',
        '다 읽은 뒤에는 인생 전체의 관계와 마음에서 내가 편했던 거리감과 상대가 부담스러웠을 수 있는 거리감을 함께 보세요. 거리감이 보이면 관계를 더 부드럽게 조절할 수 있어요.',
        '해석을 덮기 전에 인생 전체의 관계와 마음에서 고마웠던 말과 조금 아팠던 말을 따로 떠올려 보세요. 둘을 나누면 다음에는 더 안전한 말부터 고를 수 있어요.',
        '읽고 난 뒤에는 인생 전체의 관계와 마음에서 대화가 편해졌던 조건을 하나만 남겨 보세요. 시간, 말투, 기다림 중 하나라도 보이면 관계를 다시 맞추기 쉬워요.',
        '다 읽은 뒤에는 인생 전체의 관계와 마음에서 서로 덜 예민했던 시간대를 떠올려 보세요. 그 시간대를 알면 중요한 말도 더 편한 방식으로 꺼낼 수 있어요.',
      ]),
    );
}

function lifeLongHorizonAudienceText(value: string, ctx: StandardDepthEnhancementContext): string {
  if (ctx.period !== 'life') return value;

  const replacements: Array<[RegExp, string]> = [
    [/오늘 바로 줄일/g, '먼저 줄일'],
    [/오늘 바로 쓸 수 있는/g, '가볍게 참고할 수 있는'],
    [/오늘 바로/g, '지금 가볍게'],
    [/오늘부터/g, '오래 두고'],
    [/오늘은 바로/g, '지금은 가볍게'],
    [/오늘은 먼저/g, '먼저'],
    [/오늘은 덜/g, '먼저 덜'],
    [/오늘은/g, '지금은'],
    [/오늘의 몸/g, '현재 몸'],
    [/오늘의/g, '지금의'],
    [/오늘도/g, '앞으로도'],
    [/오늘 다 이해하지 않아도/g, '한 번에 다 이해하지 않아도'],
    [/오늘 전부/g, '한 번에 전부'],
    [/오늘 써 볼/g, '지금 가볍게 볼'],
    [/오늘 쓸/g, '지금 가볍게 쓸'],
    [/오늘 필요한/g, '지금 필요한'],
    [/오늘 맞는/g, '지금 맞는'],
    [/오늘 확인/g, '지금 확인'],
    [/오늘 꼭/g, '지금 꼭'],
    [/오늘 가장/g, '지금 가장'],
    [/오늘 생활/g, '현재 생활'],
    [/오늘 정리/g, '지금 정리'],
    [/오늘 덜/g, '지금 덜'],
    [/오늘 줄일/g, '먼저 줄일'],
    [/오늘 유지할/g, '계속 유지할'],
    [/오늘 가능한/g, '지금 가능한'],
    [/오늘 다시/g, '다음에 다시'],
    [/오늘 편했던/g, '최근 편했던'],
    [/오늘 한/g, '지금 한'],
    [/오늘 /g, '지금 '],
    [/실제 하루/g, '실제 생활 장면'],
    [/내 하루/g, '내 생활'],
    [/상대의 하루/g, '상대의 생활'],
    [/가까운 일정 하나/g, '가까운 생활 장면 하나'],
    [/가까운 일정/g, '가까운 계획'],
    [/가까운 약속이나 일정 하나/g, '가까운 약속이나 생활 장면 하나'],
    [/가까운 약속이나 일정/g, '가까운 약속이나 생활 장면'],
    [/지금 바로 해결/g, '한 번에 해결'],
    [/지금의 일정이나 대화/g, '현재 생활 장면'],
    [/친구 관계에서는/g, '관계와 마음에서는'],
    [/친구 관계는/g, '관계와 마음은'],
    [/친구 관계를/g, '관계와 마음을'],
    [/바로 결론을 내리기보다/g, '결론을 서두르기보다'],
    [/바로 결론 내리기보다/g, '결론을 서두르기보다'],
    [/바로 결론으로/g, '서둘러 결론으로'],
    [/바로 결론 내리지/g, '결론을 서두르지'],
    [/바로 결론 내리려/g, '결론을 서두르려'],
    [/짧게 물어볼/g, '부담 없이 확인할'],
    [/다음 작업에 작게 붙여/g, '다음 표현에 천천히 반영해'],
    [/작게 붙여 보세요/g, '천천히 반영해 보세요'],
    [/바로 처리할/g, '먼저 처리할'],
    [/바로 처리하지 않아도/g, '한 번에 처리하지 않아도'],
    [/돈으로 바로 처리할/g, '돈으로 해결할'],
    [/돈으로 먼저 처리할/g, '돈으로 해결할'],
    [/지금 한 번에 처리하지 않아도/g, '한 번에 처리하지 않아도'],
    [/바로 써도 되는/g, '지금 가볍게 참고할 수 있는'],
    [/하루 더 기다려도 되는/g, '조금 더 천천히 볼'],
    [/하루 더 생각할/g, '조금 더 생각할'],
    [/하루 더 살펴볼/g, '시간을 두고 살펴볼'],
    [/하루 더/g, '조금 더'],
    [/생활에서 바로/g, '생활에서 가볍게'],
    [/바로 써먹기/g, '가볍게 참고하기'],
    [/가볍게 써먹기/g, '가볍게 참고하기'],
    [/다시 써먹기/g, '다시 참고하기'],
    [/다시 써먹을/g, '다시 참고할'],
    [/바로 써먹을/g, '생활에 적용할'],
    [/써먹을/g, '활용할'],
    [/써먹은/g, '활용해 온'],
    [/써먹는/g, '활용하는'],
    [/써먹/g, '활용'],
    [/생활에 바로/g, '생활에 가볍게'],
    [/바로 붙이고/g, '가볍게 붙이고'],
    [/하루 중/g, '생활 중'],
    [/지금 바로 꺼내 쓸 수 있는 기록/g, '나중에 다시 꺼내 쓸 수 있는 기록'],
    [/지금 바로 적용할 수 있는 말/g, '지금 가볍게 참고할 수 있는 말'],
    [/지금 바로 큰돈을 다루라는 뜻/g, '큰돈을 한 번에 다루라는 뜻'],
    [/지금 바로 맞춰야 할 답/g, '한 번에 맞춰야 할 답'],
    [/지금 바로 실천할 숙제/g, '실천 숙제'],
    [/지금 바로 처리하지 않아도/g, '한 번에 처리하지 않아도'],
    [/지금 바로 달라질 부분/g, '지금 가볍게 살필 부분'],
    [/지금 바로 쓸 기준/g, '지금 가볍게 남길 기준'],
    [/지금 바로 맞는 말/g, '지금 참고할 말'],
    [/지금 바로 도움이 되는 말/g, '지금 도움이 되는 말'],
    [/지금 바로 도움이 되는 문장/g, '지금 도움이 되는 문장'],
    [/지금 바로 쓰기 어려운 말/g, '생활에 바로 붙이기 어려운 말'],
    [/지금 바로 옮길 작은 행동/g, '생활에 붙일 작은 기준'],
    [/지금 바로 해 볼 수 있는/g, '가볍게 살펴볼 수 있는'],
    [/지금 바로 써 볼/g, '지금 가볍게 참고할'],
    [/지금 바로 쓸/g, '지금 가볍게 참고할'],
    [/지금 바로 확인할/g, '천천히 확인할'],
    [/지금 바로 떠오르는/g, '쉽게 떠오르는'],
    [/바로 할 수 있는/g, '가볍게 할 수 있는'],
    [/바로 해 볼/g, '가볍게 해 볼'],
    [/바로 써 볼/g, '가볍게 써 볼'],
    [/바로 쓸/g, '가볍게 쓸'],
    [/바로 확인할/g, '천천히 확인할'],
    [/바로 줄일/g, '먼저 줄일'],
    [/당장 전부/g, '한꺼번에 전부'],
    [/당장 바꿀/g, '먼저 조정할'],
    [/당장 맞지 않는/g, '지금 잘 맞지 않는'],
    [/당장 큰 운동/g, '큰 운동부터'],
    [/당장 크게 바꾸/g, '크게 바꾸'],
    [/당장 크게 보이지/g, '처음에는 크게 보이지'],
    [/당장 이득처럼/g, '처음에는 이득처럼'],
    [/당장 해내라고/g, '한 번에 해내라고'],
    [/당장의/g, '눈앞의'],
    [/당장은/g, '처음에는'],
    [/다음 한 주/g, '앞으로도 반복해서'],
    [/이번 주에 실제로/g, '반복해서'],
    [/하루나 한 주/g, '생활 속 여러 시기'],
    [/지금 당장 다 맞추려/g, '한 번에 다 맞추려'],
    [/지금 당장 해결할/g, '한 번에 해결할'],
    [/지금 당장 바꾸기 어려운/g, '한 번에 바꾸기 어려운'],
    [/지금 당장 한 단어로/g, '지금 한 단어로'],
    [/지금 당장/g, '한 번에'],
    [/당장/g, '한 번에'],
    [/지금 바로/g, '지금 가볍게'],
    [/지금 가볍게 맞는 말/g, '지금 참고할 말'],
    [/지금 가볍게 도움이 되는 말/g, '지금 도움이 되는 말'],
    [/지금 가볍게 도움이 되는 문장/g, '지금 도움이 되는 문장'],
    [/지금 가볍게 참고할/g, '가볍게 참고할'],
    [/지금 참고할/g, '가볍게 참고할'],
    [/지금 필요한/g, '현재 필요한'],
    [/지금 맞는/g, '현재 맞는'],
    [/지금 확인/g, '천천히 확인'],
    [/지금 정리/g, '먼저 정리'],
    [/지금 덜/g, '먼저 덜'],
    [/지금 가장/g, '현재 가장'],
    [/지금 한/g, '현재 한'],
    [/작은 행동/g, '작은 기준'],
  ];

  let out = normalizeRenderedText(value);
  for (const [pattern, replacement] of replacements) {
    out = out.replace(pattern, replacement);
  }
  return normalizeRenderedText(out);
}

function overallLifeHorizonAudienceText(value: string, ctx: StandardDepthEnhancementContext): string {
  if (ctx.period !== 'life' || ctx.category !== 'overall') return normalizeRenderedText(value);

  return normalizeRenderedText(value)
    .replace(/믿을 만한 사람과 일정, 이동, 돌아올 시간을 함께 확인해 보세요/g, '믿을 만한 사람과 오래 지킬 생활 기준을 함께 확인해 보세요')
    .replace(/일정이나 이동처럼 바뀌는 부분은 미리 나누어 보면/g, '생활 리듬이 흔들리는 장면은 오래 반복되는 기준으로 나누어 보면')
    .replace(/일정, 이동, 돌아올 시간/g, '오래 지킬 생활 기준')
    .replace(/잠, 관계, 돈, 공부처럼/g, '몸, 관계, 돈, 배움처럼')
    .replace(/오늘의 나에게/g, '현재의 나에게')
    .replace(/전체 생활을 지금 모습만으로/g, '전체 생활을 한 시기의 모습만으로')
    .replace(/지금의 나에게 필요한 부분만/g, '내게 필요한 부분만')
    .replace(/지금의 생활에 맞게/g, '내 생활에 맞게')
    .replace(/지금의 생활을 돌아보는/g, '내 생활을 돌아보는')
    .replace(/오늘의 생활에 바로 붙일 말/g, '오래 참고할 말')
    .replace(/지금의 하루/g, '내 생활')
    .replace(/지금 오래 가져갈 기준/g, '오래 가져갈 기준')
    .replace(/오늘 바로 확인할 일/g, '천천히 확인할 기준')
    .replace(/오늘 바로/g, '먼저')
    .replace(/오늘 실제로/g, '생활에서')
    .replace(/오늘 줄일/g, '먼저 줄일')
    .replace(/오늘 덜어낼/g, '먼저 덜어낼')
    .replace(/오늘 편해지는/g, '오래 편해지는')
    .replace(/다음 한 주의 작은 행동/g, '오래 반복할 작은 기준')
    .replace(/다음 한 주에 확인할/g, '다음에 다시 읽을 때 확인할')
    .replace(/이번 주에 실제로 지킬 수 있는/g, '여러 번 반복할 수 있는')
    .replace(/바로 적용할/g, '생활에 붙일')
    .replace(/바로 도움이 되는/g, '오래 도움이 되는')
    .replace(/지금 할 수 있는 조정/g, '가볍게 살필 조정')
    .replace(/지금 편해지는/g, '오래 편해지는')
    .replace(/지금 몸 상태와 일정/g, '몸 상태와 생활 리듬')
    .replace(/몸, 관계, 일정/g, '몸, 관계, 일의 리듬')
    .replace(/약속, 휴식, 정리/g, '휴식, 관계, 정리')
    .replace(/작은 행동/g, '작은 기준');
}

function careerLifeWorkAudienceText(value: string, ctx: StandardDepthEnhancementContext): string {
  if (ctx.period !== 'life' || ctx.category !== 'career') return normalizeRenderedText(value);

  return normalizeRenderedText(value)
    .replace(/일과 책임/g, '일의 방향')
    .replace(/인생 전체의 일의 흐름/g, '인생 전체의 일의 방향')
    .replace(/인생 전체의 일 흐름/g, '인생 전체의 일의 방향')
    .replace(/맡을 범위와 도움받을 지점을 함께 확인해 보세요/g, '오래 맡을 일과 함께 나눌 일을 차분히 확인해 보세요')
    .replace(/맡을 일과 넘길 일을/g, '계속 맡을 일과 편히 넘길 일을')
    .replace(/도움받을 지점도 함께 보세요/g, '함께 볼 사람도 떠올려 보세요')
    .replace(/도움받을 지점/g, '함께 볼 부분')
    .replace(/도움받을 곳/g, '함께 볼 사람')
    .replace(/역할의 크기/g, '일의 크기')
    .replace(/책임의 크기/g, '맡을 일의 크기')
    .replace(/책임을 혼자 들지 않는 데/g, '일을 혼자 떠안지 않는 데')
    .replace(/맡을 범위/g, '맡을 일')
    .replace(/회의, 연락, 마감처럼 (?:바로|먼저) 처리할 것 하나를 먼저 정하면 마음이 훨씬 가벼워져요/g, '오래 맡을 일, 함께 나눌 일, 남길 기록 중 하나를 고르면 일의 방향이 덜 흔들려요')
    .replace(/먼저 맡을 일과 덜어낼 부담/g, '계속 맡을 일과 편히 넘길 일')
    .replace(/큰 역할만/g, '큰 이름만')
    .replace(/큰 역할에서/g, '큰 일에서')
    .replace(/결정의 무게/g, '큰 결정의 부담')
    .replace(/결재하지 말고/g, '혼자 끝내지 말고')
    .replace(/후배의 길잡이가 되는 자리/g, '필요한 사람에게 경험을 나누는 일')
    .replace(/전 역할의 무게/g, '예전 일의 무게')
    .replace(/맡은 역할을 단단히 받쳐/g, '맡아 온 일을 차분히 다듬어')
    .replace(/한 역할에 오래 머문/g, '한 흐름을 오래 다듬은')
    .replace(/단단한 어깨/g, '단단한 판단력')
    .replace(/어깨가 단단/g, '판단력이 단단')
    .replace(/어깨를 함께 받쳐 주는 사람들/g, '함께 버팀목이 되어 주는 사람들')
    .replace(/어깨가 무거울 때/g, '부담이 무거울 때')
    .replace(/큰 자리를/g, '큰 일을')
    .replace(/자리가 자연스럽게 깊어져요/g, '신뢰가 자연스럽게 깊어져요')
    .replace(/다음 자리의 디딤돌/g, '다음 선택의 디딤돌')
    .replace(/지금 내가 직접 할 일/g, '내가 직접 맡을 일')
    .replace(/지금의 순서/g, '일의 순서')
    .replace(/오늘의 순서/g, '일의 순서')
    .replace(/오늘 끝낼/g, '끝까지 정리할')
    .replace(/오늘 직접 할/g, '직접 맡을')
    .replace(/마감, 사람, 내 컨디션/g, '일의 조건, 함께 볼 사람, 내 여유')
    .replace(/마감, 역할, 컨디션/g, '일의 조건, 맡을 일, 내 여유')
    .replace(/마감과 사람, 내 컨디션/g, '일의 조건과 함께 볼 사람, 내 여유')
    .replace(/마감, 확인할 사람, 내 컨디션/g, '확인할 조건, 함께 볼 사람, 내 여유')
    .replace(/마감, 협의할 사람, 내 체력/g, '확인할 조건, 함께 볼 사람, 내 여유')
    .replace(/역할의 경계/g, '일의 경계')
    .replace(/책임의 경계/g, '일의 경계')
    .replace(/역할 조율/g, '일의 조율')
    .replace(/내 역할을/g, '내가 맡은 일을')
    .replace(/내 역할이/g, '내가 맡은 일이')
    .replace(/다음 역할/g, '다음 선택')
    .replace(/역할과 환경/g, '일의 모양과 환경')
    .replace(/내 책임과 팀이나 가족이 함께 볼 책임/g, '내가 계속 맡을 일과 함께 볼 일')
    .replace(/계속 맡을 책임과 기준만 남기고 넘길 책임/g, '계속 맡을 일과 함께 볼 기준만 남기고 넘길 일')
    .replace(/책임이 한 사람에게 몰리지 않아요/g, '일이 한 사람에게 몰리지 않아요')
    .replace(/책임이 부담보다/g, '일의 무게가 부담보다')
    .replace(/책임이 덜/g, '일의 무게가 덜')
    .replace(/책임도 관리할 수 있는 일/g, '일의 무게도 관리할 수 있는 크기')
    .replace(/책임을 전부 떠안/g, '일을 전부 떠안')
    .replace(/책임을 정리/g, '일의 무게를 정리')
    .replace(/책임의 양/g, '일의 양')
    .replace(/익숙한 책임/g, '익숙한 일의 무게')
    .replace(/책임의 무게/g, '일의 무게');
}

function careerYearWorkAudienceText(value: string, ctx: StandardDepthEnhancementContext): string {
  if (ctx.period !== 'thisYear' || ctx.category !== 'career') return normalizeRenderedText(value);

  return normalizeRenderedText(value)
    .replace(/일과 책임/g, '일의 방향')
    .replace(/올해의 직업 결/g, '올해 일의 방향')
    .replace(/직업 결/g, '일의 방향')
    .replace(/올해 올해의 일 방향/g, '올해 일의 방향')
    .replace(/올해에는 올해의 일 방향/g, '올해에는 일의 방향')
    .replace(/올해의 일 방향/g, '일의 방향')
    .replace(/올해의 직업운/g, '올해 일의 방향')
    .replace(/올해 직업운/g, '올해 일의 방향')
    .replace(/올해\s*직업운/g, '올해 일의 방향')
    .replace(/직업운에서/g, '일의 방향에서')
    .replace(/직업운은/g, '일의 방향은')
    .replace(/직업운을/g, '일의 방향을')
    .replace(/올해 일의 방향에서 올해 /g, '올해 일의 방향에서 ')
    .replace(/올해 직업운에서 올해 /g, '올해 일의 방향에서 ')
    .replace(/세 달에 한 번씩 한 줄씩/g, '세 달에 한 번씩 한 줄로')
    .replace(/세 달에 한 번씩 적어/g, '세 달마다 적어')
    .replace(/자리·책임/g, '성과와 협업')
    .replace(/큰 결의 매듭/g, '올해 남길 결과')
    .replace(/결의 길/g, '결과의 방향')
    .replace(/결정 결/g, '결정 기록')
    .replace(/한 자리에서/g, '한 흐름 안에서')
    .replace(/다음 자리/g, '다음 선택')
    .replace(/자리 폭/g, '기회의 폭')
    .replace(/굵직한 자리의 문/g, '큰 기회의 문')
    .replace(/어깨가 단단한 자리/g, '판단력이 필요한 흐름')
    .replace(/어깨가 가벼운 결/g, '부담이 가벼운 흐름')
    .replace(/어깨/g, '부담')
    .replace(/큰 역할만/g, '큰 이름만')
    .replace(/큰 역할에서/g, '앞에서 모든 일을 맡는 방식에서')
    .replace(/큰 역할/g, '큰 이름')
    .replace(/한 역할에 오래 머문/g, '한 흐름을 오래 다듬은')
    .replace(/역할의 경계/g, '일의 경계')
    .replace(/역할 조율/g, '일의 조율')
    .replace(/다음 역할/g, '다음 선택')
    .replace(/지금 역할/g, '일의 방향')
    .replace(/후배의 길잡이가 되는 자리/g, '필요한 사람에게 기준을 나누는 일')
    .replace(/후배나 동료/g, '도움이 필요한 사람')
    .replace(/후배·동료/g, '함께 일하는 사람')
    .replace(/후배/g, '함께 일하는 사람')
    .replace(/결정의 무게/g, '큰 선택의 부담')
    .replace(/결재하지 말고/g, '혼자 끝내지 말고')
    .replace(/맡을 일의 크기/g, '올해 남길 결과의 크기')
    .replace(/직접 할 일과 나눌 일을/g, '직접 완성할 결과와 나중에 다시 볼 기준을')
    .replace(/직접 할 일과 나눌 일/g, '직접 완성할 결과와 나중에 다시 볼 기준')
    .replace(/직접 끝낼 결과와 함께 검토할 일을 함께 확인해 보세요/g, '직접 완성할 결과와 나중에 다시 볼 기준을 확인해 보세요')
    .replace(/직접 끝낼 결과와 함께 검토할 일을 확인해 보세요/g, '직접 완성할 결과와 나중에 다시 볼 기준을 확인해 보세요')
    .replace(/직접 끝낼 결과와 함께 검토할 일/g, '직접 완성할 결과와 나중에 다시 볼 기준')
    .replace(/맡을 일과 함께 볼 일을/g, '올해 남길 결과와 나중에 다시 볼 기준을')
    .replace(/맡을 일과 함께 볼 일/g, '올해 남길 결과와 나중에 다시 볼 기준')
    .replace(/올해 남길 결과와 함께 검토할 일을/g, '올해 남길 결과와 나중에 다시 볼 기준을')
    .replace(/올해 남길 결과와 함께 검토할 일/g, '올해 남길 결과와 나중에 다시 볼 기준')
    .replace(/함께 검토할 일을/g, '나중에 다시 볼 기준을')
    .replace(/함께 검토할 일/g, '나중에 다시 볼 기준')
    .replace(/도움을 청할 사람도 함께 보세요/g, '나중에 함께 읽을 사람도 정해 보세요')
    .replace(/일의 크기와 함께 볼 사람/g, '올해 남길 결과와 함께 볼 사람')
    .replace(/일을 혼자 떠안지 않는 데/g, '성과를 혼자 들고 끝내지 않는 데')
    .replace(/지금 만드는 작은 결과/g, '올해 만드는 작은 결과')
    .replace(/지금의 선택/g, '올해의 선택')
    .replace(/지금 바로 보이는 결과/g, '당장 보이는 결과')
    .replace(/지금 필요한 조언과 나중에 참고할 조언/g, '올해 바로 쓸 기준과 나중에 다시 볼 기준')
    .replace(/지금 덜 무거워지는 선택/g, '올해 부담을 줄이는 선택')
    .replace(/잘 맡아 온 일을 계속 붙잡을지, 기준만 남기고 넘길지 나누어 보세요/g, '올해 이어 갈 결과와 기준만 남길 제안을 나누어 보세요')
    .replace(/역할 전환/g, '전환 방향')
    .replace(/이번에 꼭 지킬 약속/g, '올해 꼭 지킬 기준')
    .replace(/다시 조정할 약속/g, '다시 조정할 기준')
    .replace(/약속의 크기/g, '기준의 크기')
    .replace(/먼저 떠오르는 한 가지부터 확인하면 충분해요\. 기준이 작을수록 실제 생활에 옮기기 쉬워요\./g, '연말에 다시 볼 기준 하나만 남겨도 충분해요. 기준이 작아야 다음 제안 앞에서도 흔들림이 줄어요.')
    .replace(/마음에 남는 문장 하나를 실제 행동으로 옮길 때/g, '마음에 남는 기준 하나를 연말에 다시 읽을 수 있게 남길 때')
    .replace(/덧붙이면, 이 해석은 직업운을/g, '덧붙이면, 이 해석은 올해 일의 방향을')
    .replace(/정리하면, 직업운은/g, '정리하면, 올해 일의 방향은')
    .replace(/실제 행동/g, '올해 기준')
    .replace(/가장 쉬운 조정 하나부터 생활에 붙여 보세요/g, '연말에 다시 볼 조정 기준 하나만 남겨 보세요')
    .replace(/지금 가장 쉬운 선택 하나부터 남겨 보세요/g, '올해 가장 분명한 기준 하나부터 남겨 보세요')
    .replace(/먼저 챙길 수 있는 일을 하나/g, '올해 먼저 챙길 결과 하나')
    .replace(/피하고 싶은 일보다 올해 먼저 챙길 결과 하나 떠올려 보세요/g, '가장 먼저 챙길 결과 하나를 떠올려 보세요')
    .replace(/맡을 일, 미룰 일, 확인받을 일/g, '남길 결과, 보류할 제안, 함께 확인할 기록')
    .replace(/급한 일, 맡은 일, 확인할 일/g, '올해 남길 결과, 함께 볼 사람, 다시 확인할 기록')
    .replace(/급한 일과 중요한 일/g, '먼저 남길 결과와 나중에 넓힐 제안')
    .replace(/먼저 끝낼 일과 확인받을 일/g, '먼저 남길 결과와 함께 확인할 기록')
    .replace(/오늘 끝낼 일, 확인받을 일, 잠시 미룰 일/g, '올해 남길 결과, 함께 확인할 기록, 보류할 제안')
    .replace(/오늘 끝낼 것과 도움받을 것/g, '올해 남길 결과와 함께 검토할 부분')
    .replace(/오늘 끝낼 한 가지와 도움을 청할 한 가지/g, '올해 남길 결과와 함께 검토할 부분')
    .replace(/오늘 끝낼/g, '올해 끝까지 정리할')
    .replace(/오늘 직접 할/g, '올해 직접 끝낼')
    .replace(/오늘은 계속할 일 하나와 덜어낼 부담 하나/g, '올해 이어 갈 결과와 보류할 제안 하나')
    .replace(/오늘은 성과를 증명하기보다/g, '올해는 성과를 급히 증명하기보다')
    .replace(/오늘은/g, '이번 흐름에서는')
    .replace(/오늘의 순서/g, '올해의 순서')
    .replace(/지금 내가 직접 할 일/g, '올해 직접 끝낼 결과')
    .replace(/지금 맡은 책임/g, '올해 남길 결과')
    .replace(/지금 맡은 일/g, '올해 남길 결과')
    .replace(/지금 바로 적용할 수 있는 말 하나만 골라도 충분해요/g, '올해 끝에 다시 볼 기준 하나만 남겨도 충분해요')
    .replace(/회의, 연락, 마감처럼 (?:바로|먼저) 처리할 것 하나를 먼저 정하면 마음이 훨씬 가벼워져요/g, '보여 줄 결과 하나를 먼저 고르면 새 제안 앞에서도 방향이 덜 흔들려요')
    .replace(/올해 남길 결과, 함께 볼 사람, 나중에 다시 읽을 기록 중 하나를 정하면 방향이 덜 흔들려요\. 올해 끝에 설명할 결과 하나를 먼저 골라도 충분해요\./g, '보여 줄 결과 하나를 먼저 고르면 새 제안 앞에서도 방향이 덜 흔들려요.')
    .replace(/바로 처리할 것 하나/g, '올해 남길 기준 하나')
    .replace(/먼저 처리할 것 하나/g, '올해 남길 기준 하나')
    .replace(/마감, 역할, 컨디션/g, '올해 남길 결과, 함께 볼 사람, 내 여유')
    .replace(/마감, 사람, 내 컨디션/g, '올해 남길 결과, 함께 볼 사람, 내 여유')
    .replace(/마감과 사람, 내 컨디션/g, '올해 남길 결과와 함께 볼 사람, 내 여유')
    .replace(/마감, 협의할 사람, 내 체력/g, '올해 남길 결과, 함께 볼 사람, 내 여유')
    .replace(/마감, 확인할 사람, 내 컨디션/g, '올해 남길 결과, 함께 볼 사람, 내 여유')
    .replace(/마감, 사람, 몸 상태/g, '올해 남길 결과, 함께 볼 사람, 내 여유')
    .replace(/맡은 일이 많아 보일 때/g, '올해 할 일이 넓어 보일 때')
    .replace(/맡을 일/g, '올해 이어 갈 일')
    .replace(/맡은 일을 줄이고/g, '올해 붙잡을 일을 줄이고')
    .replace(/맡을 일과 넘길 일/g, '남길 결과와 보류할 제안')
    .replace(/올해 이어 갈 일과 넘길 일/g, '남길 결과와 보류할 제안')
    .replace(/내가 해야 할 일과 같이 나눌 일/g, '내가 끝낼 결과와 함께 검토할 일')
    .replace(/내가 맡은 일을/g, '내가 끝낼 결과를')
    .replace(/책임의 무게/g, '일의 무게')
    .replace(/책임의 양/g, '일의 양')
    .replace(/책임의 경계/g, '일의 경계')
    .replace(/책임도 관리할 수 있는 일/g, '일의 무게도 관리할 수 있는 크기')
    .replace(/책임을 전부 떠안/g, '일을 전부 떠안')
    .replace(/책임을 정리/g, '일의 무게를 정리')
    .replace(/책임을 모두 떠안기보다/g, '모든 일을 혼자 떠안기보다')
    .replace(/익숙한 책임/g, '익숙한 일의 무게')
    .replace(/작은 책임/g, '작은 기록')
    .replace(/계속 맡을 일/g, '올해 이어 갈 일')
    .replace(/편히 넘길 일/g, '보류할 일')
    .replace(/오래 맡을 일/g, '올해 이어 갈 일')
    .replace(/책임이 한 사람에게 몰리지 않아요/g, '일이 한 사람에게 몰리지 않아요')
    .replace(/책임이 많을수록/g, '올해 할 일이 많을수록')
    .replace(/책임이 커질수록/g, '일의 폭이 커질수록')
    .replace(/책임이/g, '일의 무게가')
    .replace(/책임을/g, '일의 무게를')
    .replace(/책임/g, '일의 무게');
}

function movementLifeSpecificityAudienceText(value: string, ctx: StandardDepthEnhancementContext): string {
  if (ctx.period !== 'life' || ctx.category !== 'movement') return normalizeRenderedText(value);

  const movementChecks = pickVariant(ctx, 'sourceMovementBaggage', [
    '이동 시간, 필요한 비용, 돌아온 뒤의 피로',
    '출발 시간, 함께 확인할 사람, 회복할 여유',
    '동선의 길이, 들어갈 비용, 몸이 버틸 수 있는 정도',
    '준비물, 이동 뒤 일정, 도움을 청할 사람',
  ]);
  const returnBase = pickVariant(ctx, 'sourceMovementLifeCurrent', [
    '돌아와 쉴 시간과 연락할 사람',
    '다녀온 뒤 정리할 일과 회복 시간',
    '원래 생활로 돌아오는 순서',
    '다녀온 뒤 생활에 다시 붙는 시간',
  ]);
  const smallMove = pickVariant(ctx, 'sourceMovementNearby', [
    '짧은 외출이나 동선 조정',
    '가까운 방문, 출발 시간 조정, 돌아오는 길 확인',
    '부담이 적은 외출과 익숙한 길의 변화',
    '짧게 다녀올 곳과 쉬어 갈 시간',
  ]);

  return normalizeRenderedText(value)
    .replace(/가까운 사람과 시간, 비용, 돌아올 기준을 함께 확인해 보세요/g, '가까운 사람과 함께 새로 바꿀 일, 그대로 둘 리듬, 도움받을 방법을 확인해 보세요')
    .replace(/시간, 비용, 돌아올 기준을 함께 확인해 보세요/g, '움직일 이유와 오래 남겨 둘 기준을 함께 확인해 보세요')
    .replace(/시간, 비용, 돌아올 기준/g, '움직일 이유와 오래 남겨 둘 기준')
    .replace(/시간, 비용, 체력/g, movementChecks)
    .replace(/시간, 체력, 비용/g, movementChecks)
    .replace(/비용, 시간, 체력/g, movementChecks)
    .replace(/출발 시간, 비용, 체력/g, '움직일 이유와 오래 남겨 둘 기준')
    .replace(/지금 갈 일과 기다릴 일/g, '직접 움직일 일과 기다려도 되는 일')
    .replace(/지금 자리에서 정리할 일/g, '자리에서 정리해도 되는 일')
    .replace(/출발 시간이나 돌아올 시간/g, '출발 시간과 마무리 시간')
    .replace(/돌아올 시간과 쉴 자리도 함께 정해 두면 좋아요/g, '다녀온 뒤 회복할 시간도 함께 정해 두면 좋아요')
    .replace(/돌아올 시간을 분명히 두는 것이 중요해요/g, '다녀온 뒤 회복할 시간을 남기는 것이 중요해요')
    .replace(/돌아올 시간/g, '다녀온 뒤 회복할 시간')
    .replace(/쉴 자리/g, '회복할 시간')
    .replace(/새로 가 볼 곳과 돌아올 자리/g, '가 보고 싶은 곳과 오래 지킬 기준')
    .replace(/무리해서 멀리 움직일 일/g, '부담이 큰 이동')
    .replace(/이동 뒤에 쉴 시간/g, '다녀온 뒤 회복할 시간')
    .replace(/가볍게 움직일 일 하나/g, '부담 없이 다녀올 일 하나')
    .replace(/새 길을 고르기 전에 돌아올 시간/g, '새 길을 고르기 전 마무리 시간')
    .replace(/생활을 흔드는 변화와 생활을 가볍게 하는 변화/g, '생활을 흔드는 변화와 생활을 편하게 만드는 변화')
    .replace(/이동이 필요한 일과 제자리에서 정리할 일/g, '직접 움직여야 할 일과 자리에서 정리해도 되는 일')
    .replace(/다음 이동에서 챙길 사람, 시간, 비용/g, '다음 이동에서 도움받을 사람과 마무리 시간')
    .replace(/돌아올 기준을/g, withObjectParticle(returnBase))
    .replace(/돌아올 기준이/g, withSubjectParticle(returnBase))
    .replace(/돌아올 기준은/g, withTopicParticle(returnBase))
    .replace(/돌아올 기준/g, returnBase)
    .replace(/돌아올 자리를/g, withObjectParticle(returnBase))
    .replace(/돌아올 자리가/g, withSubjectParticle(returnBase))
    .replace(/돌아올 자리는/g, withTopicParticle(returnBase))
    .replace(/돌아올 자리/g, returnBase)
    .replace(/원래 생활로 돌아오는 순서을/g, '원래 생활로 돌아오는 순서를')
    .replace(/출발 출발 시간/g, '출발 시간')
    .replace(/쉴 시간/g, '회복할 시간')
    .replace(/쉬는 시간/g, '회복 시간')
    .replace(/새 장소를/g, '낯선 장소나 역할을')
    .replace(/새 장소가/g, '낯선 장소나 역할이')
    .replace(/새 장소는/g, '낯선 장소나 역할은')
    .replace(/새 장소/g, '낯선 장소나 역할')
    .replace(/낯선 장소나 역할를/g, '낯선 장소나 역할을')
    .replace(/작은 이동/g, smallMove)
    .replace(/가까운 곳의 작은 조정/g, smallMove)
    .replace(/준비물과 회복 시간/g, '준비물, 연락할 사람, 회복 시간')
    .replace(/이동의 크기보다 준비의 안전함/g, '이동의 크기보다 새 환경을 감당할 여유');
}

function academicLifeBalanceAudienceText(value: string, ctx: StandardDepthEnhancementContext): string {
  if (ctx.period !== 'life' || ctx.category !== 'academic') return normalizeRenderedText(value);

  return normalizeRenderedText(value)
    .replace(/공부와 배움에서는/g, '읽고 익히는 과정에서는')
    .replace(/공부와 배움에서/g, '배움의 흐름에서')
    .replace(/공부와 배움은/g, '읽고 정리하는 힘은')
    .replace(/공부와 배움이/g, '읽고 정리하는 힘이')
    .replace(/공부와 배움을/g, '읽고 익히는 과정을')
    .replace(/공부와 배움도/g, '새로 알아 가는 일도')
    .replace(/공부와 배움의/g, '배움의')
    .replace(/공부와 배움/g, '읽고 익히는 과정')
    .replace(/학업운/g, '배움 흐름')
    .replace(/학습 시간/g, '배움 시간')
    .replace(/바로 활용할 장면/g, '생활에 적용할 장면')
    .replace(/다음 공부를/g, '다음에 이어 갈 내용을')
    .replace(/다음 공부가/g, '다음에 이어 갈 내용이')
    .replace(/다음 공부의/g, '다음에 이어 갈 내용의')
    .replace(/다음 공부도/g, '다음에 이어 갈 내용도')
    .replace(/다음 공부에/g, '다음에 이어 갈 내용에')
    .replace(/다음 공부에서/g, '다음에 이어 갈 내용에서')
    .replace(/다음 공부/g, '다음에 이어 갈 내용')
    .replace(/오늘의 공부를/g, '지금의 배움을')
    .replace(/오늘의 공부가/g, '지금의 배움이')
    .replace(/오늘의 공부의/g, '지금의 배움의')
    .replace(/오늘의 공부도/g, '지금의 배움도')
    .replace(/오늘의 공부/g, '지금의 배움')
    .replace(/공부 기록/g, '배움 기록')
    .replace(/공부 자산/g, '배움의 자산')
    .replace(/공부 계획/g, '배움 계획')
    .replace(/공부 시간/g, '이어 갈 시간')
    .replace(/공부 단위/g, '이어 갈 크기')
    .replace(/공부법/g, '배움 방식')
    .replace(/공부 방식/g, '배움 방식')
    .replace(/공부 리듬/g, '이어 가는 리듬')
    .replace(/공부량/g, '배움의 양')
    .replace(/새로 시작할 공부를/g, '새로 시작할 배움을')
    .replace(/새로 시작할 공부가/g, '새로 시작할 배움이')
    .replace(/새로 시작할 공부보다/g, '새로 시작할 배움보다')
    .replace(/새로 시작할 공부/g, '새로 시작할 배움')
    .replace(/새 공부를/g, '새 배움을')
    .replace(/새 공부가/g, '새 배움이')
    .replace(/새 공부의/g, '새 배움의')
    .replace(/새 공부도/g, '새 배움도')
    .replace(/새 공부나/g, '새 배움이나')
    .replace(/새 공부/g, '새 배움')
    .replace(/공부보다/g, '배움보다')
    .replace(/공부처럼/g, '배움처럼')
    .replace(/공부량/g, '배움의 양')
    .replace(/공부는/g, '배움은')
    .replace(/공부가/g, '배움이')
    .replace(/공부를/g, '배움을')
    .replace(/공부도/g, '배움도')
    .replace(/공부의/g, '배움의')
    .replace(/공부와/g, '배움과')
    .replace(/책 한 권이나 강의 하나/g, '책 한 권, 강의 하나, 경험을 정리한 메모 하나')
    .replace(/강의 하나, 책 한 권, 실무 주제 하나/g, '강의 하나, 책 한 권, 실무에서 설명해 볼 사례 하나')
    .replace(/책 한 권, 실무 주제 하나/g, '책 한 권, 실무 주제, 누군가에게 설명해 볼 사례 하나')
    .replace(/바로 써먹을 점/g, '생활에 적용해 볼 점')
    .replace(/바로 써먹을 결과/g, '다시 참고할 결과')
    .replace(/바로 써먹을 수 있어/g, '생활에 적용해 볼 수 있어')
    .replace(/써먹는 장면/g, '활용할 장면')
    .replace(/써먹을 수 있어/g, '활용할 수 있어')
    .replace(/써먹은/g, '활용해 온')
    .replace(/써먹는/g, '활용하는')
    .replace(/써먹다/g, '활용하다')
    .replace(/써먹을/g, '활용할')
    .replace(/지금 끝낼 작은 범위와 나중에 물어볼 질문을 나누면 부담이 줄어요\./g, '천천히 다시 볼 자료와 나중에 물어볼 질문을 나누면 부담이 줄어요.')
    .replace(/오늘 끝낼 작은 범위와 나중에 물어볼 질문을 나누면 부담이 줄어요\./g, '천천히 다시 볼 자료와 나중에 물어볼 질문을 나누면 부담이 줄어요.')
    .replace(/배움 시간을 갑자기 늘리기보다/g, '배움을 갑자기 넓히기보다')
    .replace(/쉬운 문제 하나, 짧은 문단 하나/g, '짧은 글 하나, 질문 하나')
    .replace(/배움 단위/g, '이어 갈 크기')
    .replace(/다음에도 할 수 있는 배움 단위/g, '다음에도 이어 갈 크기')
    .replace(/다시 돌아올 기준 하나/g, '다시 확인할 방식 하나')
    .replace(/돌아올 기준 하나/g, '남겨 둘 방식 하나')
    .replace(/돌아올 기준/g, '다시 확인할 방식')
    .replace(/배움과 이해은/g, '배움과 이해는')
    .replace(/배움과 이해이/g, '배움과 이해가')
    .replace(/배움과 이해을/g, '배움과 이해를');
}
function academicRoleAudienceText(value: string, ctx: StandardDepthEnhancementContext): string {
  if (ctx.category !== 'academic') return normalizeRenderedText(value);

  const roleGuidance = pickVariant(ctx, 'sourceAcademicRole', (() => {
    if (isYoungChildReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)) {
      return [
        '공부와 배움에서는 아이가 좋아한 장면 하나와 궁금해한 질문 하나면 충분해요. 보호자가 옆에서 짧게 확인해 주면 배움이 더 편하게 이어져요.',
        '공부와 배움에서는 아이가 재미있어한 순간을 먼저 보세요. 그림책 한 장면이나 물어본 말 하나가 다음 배움의 단서가 돼요.',
        '공부와 배움에서는 아이가 다시 보고 싶어 하는 장면을 붙잡아 주세요. 좋아한 것과 어려운 것이 보이면 도와줄 지점도 분명해져요.',
      ];
    }
    if (isMinorReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)) {
      return [
        '공부와 배움에서는 이해한 문장 하나와 막힌 질문 하나를 나누어 보세요. 다시 설명할 예시가 있으면 이어 갈 질문이 덜 막막해져요.',
        '공부와 배움에서는 다시 설명할 수 있는 한 줄이 먼저예요. 헷갈린 문제와 이해한 내용을 나누면 자기 리듬이 보여요.',
        '공부와 배움에서는 맞힌 것, 어려운 것, 물어볼 것을 세 칸으로 나누어 보세요. 칸이 보이면 다음 순서도 덜 무거워져요.',
      ];
    }
    if (ctx.period === 'life') {
      return [
        '경험을 정리하는 흐름에서는 나중에 다시 설명할 수 있는 단서 하나가 중요해요. 잘 맞았던 시간대나 설명 방식을 남기면 오래 두고 볼 기준도 덜 막막해져요.',
        '지나온 경험과 앞으로 익힐 내용을 연결해 보세요. 어디에서 막히는지만 적어도 오래 이어 갈 질문이 분명해져요.',
        '긴 배움의 흐름에서는 계속 꺼내 볼 방법을 남기는 편이 좋아요. 정리 방식이나 질문 방식 하나면 충분해요.',
      ];
    }
    return [
      '공부와 배움에서는 문제 하나, 요약 한 줄, 다시 볼 자료 하나를 기준으로 잡아 보세요. 질문이 구체적이면 실무나 자격 준비에도 남는 게 분명해져요.',
      '공부와 배움에서는 끝에 남길 결과가 중요해요. 오늘은 풀이, 초안, 다시 볼 자료 중 하나만 정해도 충분해요.',
      '공부와 배움에서는 어떤 자료를 다시 볼지 먼저 정해 보세요. 질문이 좁아질수록 조언도 실천으로 이어져요.',
    ];
  })());

  let out = normalizeRenderedText(value);
  out = out
    .replace(
      /공부와 배움에서는 지금 확인할 작은 범위를 먼저 정해 보세요\. 혼자 막히면 믿을 만한 사람에게 묻고, 들은 조언은 내 말로 짧게 다시 적어 보세요\./g,
      roleGuidance,
    )
    .replace(
      /혼자 막히면 믿을 만한 사람에게 묻고, 들은 조언은 내 말로 짧게 다시 적어 보세요\./g,
      roleGuidance,
    )
    .replace(/지금 확인할 작은 범위/g, ctx.period === 'life' ? '나중에 다시 설명할 수 있는 단서' : '오늘 다시 설명해 볼 작은 단서')
    .replace(/지금 이해할 작은 범위/g, ctx.period === 'life' ? '나중에 다시 설명할 수 있는 단서' : '오늘 다시 설명해 볼 작은 단서')
    .replace(/한 문제 풀기, 한 문단 읽기처럼 쉬운 행동/g, isYoungChildReader(ctx) ? '그림책 한 장면 보기, 궁금한 말 하나 묻기처럼 편한 행동' : '문제 하나 확인하기, 문단 하나 요약하기처럼 손에 잡히는 행동')
    .replace(/모르는 부분을 표시해 두는 것만으로도 다음 공부가 가벼워져요\./g, ctx.period === 'life' ? '헷갈린 지점을 질문으로 남겨 두면 이어 갈 이해가 덜 막막해져요.' : '헷갈린 지점을 질문으로 남겨 두면 다음 공부가 덜 막막해져요.')
    .replace(/시작 전에 지금 확인할 단서 하나를 남기면 다음 공부가 쉬워져요\./g, ctx.period === 'life' ? '시작 전에 오래 두고 다시 설명할 문장 하나를 골라 두면 이어 갈 질문이 쉬워져요.' : '시작 전에 다시 설명해 볼 문장 하나를 골라 두면 다음 공부가 쉬워져요.');

  return normalizeRenderedText(out);
}
function studyDocumentRoleAudienceText(value: string, ctx: StandardDepthEnhancementContext): string {
  if (ctx.category !== 'study_document') return normalizeRenderedText(value);

  let out = normalizeRenderedText(value);
  out = out
    .replace(/작은 역할 나누기/g, '확인할 칸 나누기')
    .replace(/역할이 나뉘면 서류 확인도 덜 막막해져요/g, '확인 순서가 나뉘면 서류 확인도 덜 막막해져요')
    .replace(/역할이 나뉘면 실수도 줄고 마음도 덜 급해져요/g, '확인 범위가 나뉘면 실수도 줄고 마음도 덜 급해져요')
    .replace(/책임의 경계도 더 또렷해져요/g, '확인할 범위도 더 또렷해져요')
    .replace(/책임의 경계가 또렷해져요/g, '확인할 범위가 또렷해져요')
    .replace(/공부·서류 흐름/g, '기록과 자료 흐름')
    .replace(/공부·서류/g, '기록과 자료')
    .replace(/학습 자산/g, '기록 습관')
    .replace(/학습 지도/g, '확인 지도')
    .replace(/자기만의 공부 방식/g, '자기만의 정리 방식')
    .replace(/공부 방식/g, '정리 방식')
    .replace(/시험 한 번의 점수를 두고 다투는/g, '기록 하나로 결과를 단정하는')
    .replace(/책 한 권을 천천히 펼쳐 자기에게 맞는 속도를 익히는/g, '노트와 안내장을 천천히 살피며 다시 찾는 기준을 익히는')
    .replace(/잘 풀리는 면은, 모르는 것을 그냥 넘기지 않는 시간이에요\./g, '잘 풀리는 면은, 헷갈린 자료를 그냥 넘기지 않고 표시해 두는 시간이에요.')
    .replace(/헷갈린 문장이나 못 푼 문제를 작은 노트에 한 줄씩 옮겨 두면 오늘의 공부가 자기만의 자료가 돼요\./g, '어려운 단어, 문제 번호, 물어볼 내용을 작은 노트에 한 줄씩 옮겨 두면 오늘의 기록이 다시 볼 자료가 돼요.')
    .replace(/친구와 함께 풀어 보는 시간이 있으면 더 잘 남아요\./g, '선생님이나 보호자에게 물어볼 질문까지 보이면 더 오래 남아요.')
    .replace(/처음 펼친 노트처럼 이 시기의 배움은 작은 기록에서 시작돼요\. 한 줄을 적고, 다시 읽고, 조금 고쳐 보는 경험이 쌓이면 자기만의 정리 방식이 천천히 만들어져요\./g, '처음 펼친 노트처럼 이 시기의 기록은 작은 표시에서 시작돼요. 날짜와 질문을 남기고, 다시 확인하며 고쳐 보는 경험이 쌓이면 자기만의 정리 방식이 천천히 만들어져요.')
    .replace(/어려운 단어와 헷갈린 문제를 작게 모아 두면 공부가 훨씬 구체적으로 보여요\. 무엇을 모르는지 알게 되는 순간부터 다음 행동이 정해져요\./g, '어려운 단어와 헷갈린 문제 번호를 작게 모아 두면 확인할 자료가 훨씬 구체적으로 보여요. 무엇을 다시 봐야 하는지 알게 되는 순간부터 다음 행동이 정해져요.')
    .replace(/다른 친구가 빨리 푼다고 해서 내 공부가 늦었다는 뜻은 아니에요\. 함께 풀어 볼 문제 하나를 정하고, 내가 이해한 부분을 말로 설명해 보면 비교보다 더 많은 것이 남아요\./g, '다른 친구가 빨리 정리한다고 해서 내 기록이 늦었다는 뜻은 아니에요. 함께 볼 문제 번호나 안내장을 하나 정하면 경쟁보다 확인 습관이 더 오래 남아요.')
    .replace(/친구의 결과는 참고할 수 있지만 내 공부의 전부는 아니에요\. 함께 확인할 문제를 하나 정하면 경쟁보다 배움이 더 오래 남아요\./g, '친구의 결과는 참고할 수 있지만 내 기록 기준의 전부는 아니에요. 함께 볼 문제 번호나 안내장을 하나 정하면 경쟁보다 확인 습관이 더 오래 남아요.')
    .replace(/친구의 결과는 참고할 수 있지만 내 정리의 전부는 아니에요\. 함께 확인할 문제를 하나 정하면 경쟁보다 배움이 더 오래 남아요\./g, '친구의 결과는 참고할 수 있지만 내 정리 기준의 전부는 아니에요. 함께 볼 문제 번호나 안내장을 하나 정하면 경쟁보다 확인 습관이 더 오래 남아요.')
    .replace(/함께 확인할 문제를 하나 정하면 경쟁보다 배움이 더 오래 남아요/g, '함께 볼 문제 번호나 안내장을 하나 정하면 경쟁보다 확인 습관이 더 오래 남아요')
    .replace(/비교가 시작되면 먼저 지금 내 기준을 작게 잡아 보세요\. 끝낼 문제 하나, 다시 읽을 문단 하나가 있으면 남의 속도에 덜 흔들려요\./g, '비교가 시작되면 먼저 지금 확인할 기준을 작게 잡아 보세요. 다시 볼 문제 번호나 안내장 하나가 있으면 남의 속도에 덜 흔들려요.')
    .replace(/거창한 계획이 없어도 배움은 자라요\. 선생님에게 들은 말, 친구와 나눈 풀이, 노트에 남긴 표시가 아이에게는 다음 단계로 가는 든든한 발판이 될 수 있어요\./g, '거창한 계획이 없어도 기록은 자라요. 선생님에게 들은 말, 친구와 나눈 풀이, 노트에 남긴 표시가 아이에게는 다음 확인으로 가는 든든한 발판이 될 수 있어요.')
    .replace(/아이에게는 잘한 결과만큼 다시 물어볼 수 있는 분위기가 중요해요\. 모르는 것을 편하게 꺼내면 배움이 겁나는 일이 아니라 이어지는 일이 돼요\./g, '아이에게는 잘한 결과만큼 다시 물어볼 수 있는 분위기가 중요해요. 헷갈린 자료를 편하게 꺼내면 확인이 겁나는 일이 아니라 이어지는 일이 돼요.')
    .replace(/학습은 한 번의 성과보다 다시 돌아올 수 있는 기준이 있을 때 단단해져요\. 아이가 표시해 둔 부분을 같이 보고 다음에 볼 순서를 정해 주세요\./g, '기록은 한 번의 결과보다 다시 돌아올 수 있는 기준이 있을 때 단단해져요. 아이가 표시해 둔 부분을 같이 보고 다음에 볼 순서를 정해 주세요.')
    .replace(/확인 표시을/g, '확인 표시를')
    .replace(/좋아하는 것을 한 가지씩 알아 가는 시간이에요\./g, '노트와 안내장을 다시 찾는 방법을 익히는 시간이에요.')
    .replace(/모르는 것을 숨기지/g, '헷갈린 자료를 숨기지')
    .replace(/모르는 것을 덮어 두지/g, '헷갈린 자료를 덮어 두지')
    .replace(/무엇을 모르는지/g, '무엇을 다시 봐야 하는지')
    .replace(/친구와 나눈 풀이/g, '친구와 확인한 표시')
    .replace(/지금의 배움은 큰 자격이나 어려운 이름보다 생활 속 작은 경험으로 충분해요\. 칭찬받은 점과 새로 알게 된 점을 짧게 나누면 공부가 더 편안하게 이어져요\./g, '지금의 기록은 어려운 서류 이름보다 생활 속 작은 확인에서 시작돼요. 칭찬받은 점과 새로 확인한 표시를 짧게 나누면 기록을 다시 펼치기가 더 편안해져요.')
    .replace(/이번 달은 도와줄 사람·기관·자료를 떠올려 한 가지 방향을 정리하기 좋은 시기예요\. 혼자 모든 짐을 떠안는 대신, 한 번 도움을 청하는 페이스가 잘 맞아요\./g, '이번 달은 필요한 기관, 제출처, 보관 위치를 나누어 한 가지 기준으로 정리하기 좋은 시기예요. 기억에만 맡기기보다 확인받을 사람을 정해 두는 페이스가 잘 맞아요.')
    .replace(/어깨를 기댈 언덕이 곁에 자리 잡는 그림을 떠올려 보면 좋아요\. 환경의 도움을 잘 골라 받는 시기예요\./g, '자료를 모아 둘 폴더나 보관 위치가 정해지는 그림을 떠올려 보면 좋아요. 찾을 곳이 정해지면 확인 부담이 훨씬 줄어드는 시기예요.')
    .replace(/잘 풀리는 면은, 누군가의 한마디 조언으로 막혔던 부분이 풀려요\. 부끄럼 없이 한 번 청하면 가벼워져요\./g, '잘 풀리는 면은, 문의할 곳이 보이면 빠진 칸이나 기한을 더 쉽게 잡을 수 있다는 점이에요. 혼자 넘기기보다 한 번 확인하면 기록이 가벼워져요.')
    .replace(/살짝 주의할 점은, 조언이 너무 많아 결정을 미루는 면이에요\. 두 명까지만 듣고 결정은 본인이 내리는 페이스가 잘 맞아요\./g, '살짝 주의할 점은, 문의처가 너무 많아 제출이나 보관이 늦어지는 면이에요. 물어볼 곳과 제출할 곳을 줄여 두면 결정이 한결 쉬워져요.')
    .replace(/천천히 깊어지는 힘은 한 달의 한 걸음으로도 충분해요\./g, '천천히 깊어지는 정리 힘은 한 달에 한 번 보관 위치를 확인하는 것만으로도 충분해요.')
    .replace(/어려운 단어와 헷갈린 문제 번호를 작게 모아 두면 확인할 자료가 훨씬 구체적으로 보여요\. 무엇을 다시 봐야 하는지 알게 되는 순간부터 다음 행동이 정해져요\./g, '헷갈린 자료 이름과 표시 위치를 작게 모아 두면 다시 찾을 단서가 훨씬 구체적으로 보여요. 어디를 확인해야 하는지 알게 되는 순간부터 다음 행동이 정해져요.')
    .replace(/헷갈린 문제나 어려운 단어를 한 줄로 남기면, 다음에 무엇부터 보면 좋을지 훨씬 쉽게 알 수 있어요\./g, '헷갈린 자료 이름이나 표시 위치를 한 줄로 남기면, 다음에 어디부터 확인하면 좋을지 훨씬 쉽게 알 수 있어요.')
    .replace(/짧은 질문으로 바꿔 적어 두면 선생님이나 친구에게 물어볼 때도 마음이 덜 부담스러워요\./g, '확인 질문으로 바꿔 적어 두면 보호자나 선생님에게 확인받을 때도 마음이 덜 부담스러워요.')
    .replace(/선생님에게 들은 말, 친구와 확인한 표시, 노트에 남긴 표시/g, '선생님에게 들은 말, 보호자와 확인한 위치, 노트에 남긴 표시')
    .replace(/지금 배운 한 줄을 자기 말로 남기면 그것이 다음 공부의 길잡이가 돼요\./g, '지금 남긴 확인 표시를 짧게 남기면 그것이 다음 확인의 길잡이가 돼요.')
    .replace(/모르는 부분을 적어 두는 일은 부족함을 드러내는 것이 아니라 다음 공부의 순서를 잡는 방법이에요\./g, '헷갈린 자료를 적어 두는 일은 부족함을 드러내는 것이 아니라 다음 확인 순서를 잡는 방법이에요.');
  out = out
    .replace(
      /처음 쓰는 줄이 조금 삐뚤어도 괜찮아요\. 중요한 것은 지금 알게 된 것 하나를 내 말로 남기고, 다음에 다시 펼칠 수 있게 두는 거예요\./g,
      '처음 남기는 표시가 조금 서툴러도 괜찮아요. 중요한 것은 지금 받은 자료의 이름과 날짜를 남기고, 다음에 다시 펼칠 수 있게 두는 거예요.',
    )
    .replace(
      /배움은 모르는 것을 발견하는 순간부터 더 깊어져요\. 색연필로 표시하거나 그림으로 정리해도 좋으니, 어렵게 느낀 부분을 자기 방식으로 남겨 보세요\./g,
      '기록은 헷갈린 자료를 발견하는 순간부터 더 쓸모 있어져요. 색연필로 표시하거나 그림으로 정리해도 좋으니, 다시 봐야 할 부분을 자기 방식으로 남겨 보세요.',
    )
    .replace(
      /모르는 부분을 남겨 두는 일은 틀렸다는 표시가 아니라 다음 공부의 출발점을 만드는 일이에요\. 다시 볼 표시가 있으면 도움을 청하기도 쉬워져요\./g,
      '헷갈린 자료를 남겨 두는 일은 틀렸다는 표시가 아니라 다음 확인의 출발점을 만드는 일이에요. 다시 볼 표시가 있으면 도움을 청하기도 쉬워져요.',
    )
    .replace(
      /마음에 남은 말 하나, 새로 알게 된 것 하나를 꾸준히 적으면 그 기록이 나중에 든든한 공부 자산이 돼요\./g,
      '마음에 남은 말 하나, 다시 찾을 자료 이름 하나를 꾸준히 적으면 그 기록이 시간이 지나 든든한 확인 기준이 돼요.',
    )
    .replace(
      /남보다 빠른지보다 어제보다 덜 막히는지가 더 중요해요\. 내가 이해한 부분을 말로 설명해 보면 비교하던 마음도 차분해져요\./g,
      '남보다 빠른지보다 어제보다 덜 헤매는지가 더 중요해요. 어디에 두었고 누구에게 물어볼지 말로 설명해 보면 정리 부담도 차분해져요.',
    )
    .replace(
      /조심할 점은 친구의 결과와 내 속도를 너무 오래 비교하는 거예요\. 잠깐 참고하는 정도는 괜찮지만, 결국 중요한 것은 어제보다 조금 더 이해한 내 기록이에요\./g,
      '조심할 점은 친구의 정리 방식과 내 속도를 너무 오래 비교하는 거예요. 잠깐 참고하는 정도는 괜찮지만, 결국 중요한 것은 어제보다 자료를 조금 더 쉽게 찾는 내 기준이에요.',
    )
    .replace(
      /그동안의 배움과 기록을 정돈하는 시기예요\. 새로 시작하는 시험보다는 정리·확인·나눔의 자리가 더 또렷해져요\./g,
      '그동안의 기록과 자료를 정돈하는 시기예요. 새로 시작하는 절차보다 정리·확인·나눔의 자리가 더 또렷해져요.',
    )
    .replace(
      /그동안의 기록과 자격을 정돈하는 시기예요\. 새로 시작하는 시험보다는 정리·증명·전수의 자리가 더 또렷해져요\./g,
      '그동안의 기록과 증빙 자료를 정돈하는 시기예요. 새로 시작하는 절차보다 정리·확인·나눔의 흐름이 더 또렷해져요.',
    );
  out = out
    .replace(/이번 달은 서류와 지식의 기반을 정리하기 좋은 시기예요\./g, '이번 달은 서류의 근거 자료와 보관 기준을 정리하기 좋은 시기예요.')
    .replace(/이번 달은 공부 계획이나 서류 목록을 한 번 점검하면 좋아요\./g, '이번 달은 제출할 자료와 보관할 기록 목록을 한 번 점검하면 좋아요.')
    .replace(/이번 달은 새 공부나 문서 프로젝트를 시작하기 좋은 때예요\./g, '이번 달은 새 문서 초안이나 제출 자료를 작게 시작하기 좋은 때예요.')
    .replace(/목표를 크게 잡기보다 매주 결과물을 하나씩 만들면, 한 달 끝에 눈에 보이는 성과가 쌓여요\./g, '목표를 크게 잡기보다 매주 초안, 확인본, 보관본을 하나씩 나누면 한 달 끝에 남는 자료가 또렷해져요.')
    .replace(/매주 작은 점검을 두면 한 달의 마무리가 흔들리지 않아요\./g, '매주 빠진 칸과 마감일을 확인하면 한 달의 제출 흐름이 흔들리지 않아요.')
    .replace(/한 달 분량은 처음에 크게 잡고, 매주 줄여 가는 편이 안정적이에요\./g, '한 달치 자료는 처음에 넓게 모아 두고, 매주 제출할 것과 보관할 것을 줄여 가는 편이 안정적이에요.')
    .replace(/올해는 공부, 자격, 문서 작업을 새롭게 확장하기 좋은 때예요\./g, '올해는 자격 갱신, 계약 초안, 제출 자료처럼 밖으로 드러날 문서를 차근차근 정리하기 좋은 때예요.')
    .replace(/한 번에 크게 바꾸기보다 세 달에 한 번씩 하나씩 결과물을 만들면, 배운 내용이 실제 성과로 이어질 수 있어요\./g, '한 번에 크게 바꾸기보다 세 달에 한 번씩 초안, 검토본, 제출본을 나누면 기록이 실제 결과로 이어질 수 있어요.')
    .replace(/준비가 길어질수록 휴식과 점검을 함께 챙기세요\./g, '검토가 길어질수록 보관 위치와 다시 볼 날짜를 함께 챙기세요.')
    .replace(/올해는 추진력으로 자격·서류 한 트랙을 깔끔히 마무리하기 좋은 때예요\. 한 해 안에 결과물 한 장을 자기 손으로 만들어 내는 시간이에요\./g, '올해는 자격·서류 흐름에서 초안, 검토, 제출 순서를 깔끔히 마무리하기 좋은 때예요. 한 해 안에 다시 찾을 기록 한 묶음을 자기 기준으로 정리하는 시간이에요.')
    .replace(/단단한 흙 위에 기둥을 빠르게 세우는 그림을 떠올려 보면 좋아요\. 속도가 무기인 한 해예요\./g, '단단한 폴더에 기준 문서를 세우는 그림을 떠올려 보면 좋아요. 빠른 처리보다 검토 순서가 무기가 되는 한 해예요.')
    .replace(/잘 풀리는 면은, 한 번 결심한 일이 끝까지 가는 시간이에요\. 외부 도움 없이도 스스로 결과를 만들어 내는 흐름이 강해요\./g, '잘 풀리는 면은, 한 번 정한 검토 순서를 끝까지 가져가는 힘이에요. 초안부터 제출까지 스스로 확인할 기준이 또렷해지는 흐름이에요.')
    .replace(/올해는 도와줄 사람·기관·자료를 떠올려 한 가지 방향을 정리하기 좋은 시기예요\. 혼자 다 짊어지는 흐름이 아니라, 한 해 동안 좋은 멘토 한 명을 골라 두는 페이스가 잘 맞아요\./g, '올해는 제출처, 문의 창구, 보관할 자료를 한 방향으로 정리하기 좋은 시기예요. 혼자 다 짊어지기보다 물어볼 곳과 제출할 곳을 미리 적어 두는 페이스가 잘 맞아요.')
    .replace(/어깨를 기댈 언덕이 곁에 자리 잡는 그림을 떠올려 보면 좋아요\. 환경의 도움을 잘 골라 받는 한 해예요\./g, '자료를 모아 둘 폴더와 문의할 창구가 정해지는 그림을 떠올려 보면 좋아요. 도움받을 곳이 분명하면 한 해의 서류 부담이 줄어들어요.')
    .replace(/잘 풀리는 면은, 누군가의 한마디 조언으로 막혔던 부분이 풀려요\. 부끄럼 없이 한 번 청하면 한 해의 걸음이 가벼워져요\./g, '잘 풀리는 면은, 문의할 곳이 정해지면 막혔던 칸이 풀리는 점이에요. 부끄럼 없이 한 번 확인하면 한 해의 제출 흐름이 가벼워져요.')
    .replace(/천천히 깊어지는 힘은 한 해의 한 걸음으로도 충분해요\./g, '한 해의 정리는 한 번의 큰 정리보다 분기마다 남긴 확인표로도 충분해요.')
    .replace(/올해는 그동안의 자격·서류를 한 자리에 정리하기 좋은 때예요\. 새 시작보다는 정돈·전수의 흐름이 잘 맞아요\./g, '올해는 그동안의 자격·서류를 보관 위치와 확인 순서로 정리하기 좋은 때예요. 새로 벌리기보다 갱신, 백업, 전달할 메모를 차분히 나누는 흐름이 잘 맞아요.')
    .replace(/오래 쓴 책장의 한 칸씩 정리하는 그림을 떠올려 보면 좋아요\. 한 해 동안의 정리가 오랜 기록을 새로운 자산으로 바꿔 줘요\./g, '오래 쓴 파일함의 한 칸씩 정리하는 그림을 떠올려 보면 좋아요. 한 해 동안의 정리가 필요한 문서를 다시 찾을 자료로 바꿔 줘요.')
    .replace(/잘 풀리는 면은, 무엇을 남기고 무엇을 정리할지 또렷하게 보이는 시간이에요\. 결정의 기준이 분명해지는 한 해예요\./g, '잘 풀리는 면은, 남길 문서와 버릴 자료의 기준이 또렷해지는 시간이에요. 보관 기간과 다시 볼 날짜가 분명해지는 한 해예요.')
    .replace(/다음 세대에 한 줄 노하우를 남기는 자리가 결실이 되는 흐름이에요\./g, '다음에 볼 사람이 이해할 수 있게 한 줄 설명을 남기는 일이 결실이 되는 흐름이에요.')
    .replace(/이번 달에는 기록과 서류에서 반복되는 습관을 보는 것이 중요해요\./g, '기록과 서류에서는 반복되는 습관을 보는 것이 중요해요.')
    .replace(/이번 달에는 기록과 서류에서 반복되는 선택을 조용히 모아 보세요\./g, '기록과 서류에서는 반복되는 선택을 조용히 모아 보세요.')
    .replace(/올해 공부와 문서 일은 오래 쓸 수 있는 정리 방식이 중요해요\./g, '올해 문서와 기록 일은 오래 쓸 수 있는 보관 방식이 중요해요.')
    .replace(/큰 시험은 막판 몰아치기보다 매월 작은 점검을 누적하는 편이 좋아요\./g, '큰 문서나 계약은 막판에 몰아보기보다 매월 작은 검토를 누적하는 편이 좋아요.')
    .replace(/이번 달 기록과 서류는 한 번 읽고 끝낼 답보다 생활에서 다시 확인할 기준에 가까워요\./g, '기록과 서류는 한 번 읽고 끝낼 답보다 생활에서 다시 확인할 기준에 가까워요.')
    .replace(/이번 달 기록과 서류에서는 결과를 맞히려 하기보다 내 생활에 붙는 문장 하나를 찾으면 좋아요\./g, '기록과 서류에서는 결과를 맞히려 하기보다 내 생활에 붙는 문장 하나를 찾으면 좋아요.')
    .replace(/이번 달 기록과 서류에서는 먼저 줄일 부담 하나를 고르고, 남길 습관 하나를 따로 적어 보세요\./g, '기록과 서류에서는 먼저 줄일 부담 하나를 고르고, 남길 습관 하나를 따로 적어 보세요.');
  out = out
    .replace(/공부가 눈에 띄게 늘지 않는 날에도 남는 것은 있어요\. 헷갈린 부분을 말해 본 경험과 다시 확인한 표시가 다음 공부의 길을 만들어 줘요\./g, '정리가 눈에 띄게 늘지 않는 날에도 남는 것은 있어요. 헷갈린 부분을 말해 본 경험과 다시 확인한 표시가 다음 확인의 길을 만들어 줘요.')
    .replace(/다음 공부/g, '다음 확인');
  if (isMinorReader(ctx)) {
    out = out
      .replace(/다음 공부/g, '다음 확인')
      .replace(/공부·서류 흐름/g, '기록과 자료 흐름')
      .replace(/공부·서류/g, '기록과 자료')
      .replace(/학습 자산/g, '기록 습관')
      .replace(/학습 지도/g, '확인 지도')
      .replace(/자기만의 공부 방식/g, '자기만의 정리 방식')
      .replace(/공부 방식/g, '정리 방식')
      .replace(/다음 주의 작은 무기/g, '다음 확인의 작은 길잡이')
      .replace(/시험 한 번의 점수를 두고 다투는/g, '기록 하나로 결과를 단정하는')
      .replace(/책 한 권을 천천히 펼쳐 자기에게 맞는 속도를 익히는/g, '노트와 안내장을 천천히 살피며 다시 찾는 기준을 익히는')
      .replace(/책 한 권을 천천히 펼쳐 자기에게 맞는 속도를 익히는 흐름/g, '노트와 안내장을 천천히 살피며 다시 찾는 기준을 익히는 흐름')
      .replace(/공부가 훨씬 구체적으로 보여요/g, '확인할 자료가 훨씬 구체적으로 보여요')
      .replace(/공부가 막연하지 않고 손에 잡히는 계획으로 바뀌어요/g, '확인 순서가 손에 잡히는 계획으로 바뀌어요')
      .replace(/내 공부가 늦었다는 뜻은 아니에요/g, '내 정리가 늦었다는 뜻은 아니에요')
      .replace(/내 공부의 전부는 아니에요/g, '내 정리의 전부는 아니에요')
      .replace(/공부가 무거워질 수 있어요/g, '정리가 무거워질 수 있어요')
      .replace(/다음 시험이나 발표/g, '숙제나 안내장 확인')
      .replace(/다음 시험/g, '다음 확인')
      .replace(/다음 주 시험/g, '다음 확인')
      .replace(/오늘 배운 한 줄/g, '오늘 남긴 확인 표시')
      .replace(/지금 배운 한 줄/g, '지금 남긴 확인 표시')
      .replace(/오늘 배운 것/g, '오늘 받은 자료')
      .replace(/지금 배운 것/g, '지금 받은 자료')
      .replace(
        /처음 쓰는 줄이 조금 삐뚤어도 괜찮아요\. 중요한 것은 지금 알게 된 것 하나를 내 말로 남기고, 다음에 다시 펼칠 수 있게 두는 거예요\./g,
        '처음 남기는 표시가 조금 서툴러도 괜찮아요. 중요한 것은 지금 받은 자료의 이름과 날짜를 남기고, 다음에 다시 펼칠 수 있게 두는 거예요.',
      )
      .replace(
        /배움은 모르는 것을 발견하는 순간부터 더 깊어져요\. 색연필로 표시하거나 그림으로 정리해도 좋으니, 어렵게 느낀 부분을 자기 방식으로 남겨 보세요\./g,
        '기록은 헷갈린 자료를 발견하는 순간부터 더 쓸모 있어져요. 색연필로 표시하거나 그림으로 정리해도 좋으니, 다시 봐야 할 부분을 자기 방식으로 남겨 보세요.',
      )
      .replace(
        /모르는 부분을 남겨 두는 일은 틀렸다는 표시가 아니라 다음 공부의 출발점을 만드는 일이에요\. 다시 볼 표시가 있으면 도움을 청하기도 쉬워져요\./g,
        '헷갈린 자료를 남겨 두는 일은 틀렸다는 표시가 아니라 다음 확인의 출발점을 만드는 일이에요. 다시 볼 표시가 있으면 도움을 청하기도 쉬워져요.',
      )
      .replace(
        /마음에 남은 말 하나, 새로 알게 된 것 하나를 꾸준히 적으면 그 기록이 나중에 든든한 공부 자산이 돼요\./g,
        '마음에 남은 말 하나, 다시 찾을 자료 이름 하나를 꾸준히 적으면 그 기록이 시간이 지나 든든한 확인 기준이 돼요.',
      )
      .replace(
        /남보다 빠른지보다 어제보다 덜 막히는지가 더 중요해요\. 내가 이해한 부분을 말로 설명해 보면 비교하던 마음도 차분해져요\./g,
        '남보다 빠른지보다 어제보다 덜 헤매는지가 더 중요해요. 어디에 두었고 누구에게 물어볼지 말로 설명해 보면 정리 부담도 차분해져요.',
      )
      .replace(
        /조심할 점은 친구의 결과와 내 속도를 너무 오래 비교하는 거예요\. 잠깐 참고하는 정도는 괜찮지만, 결국 중요한 것은 어제보다 조금 더 이해한 내 기록이에요\./g,
        '조심할 점은 친구의 정리 방식과 내 속도를 너무 오래 비교하는 거예요. 잠깐 참고하는 정도는 괜찮지만, 결국 중요한 것은 어제보다 자료를 조금 더 쉽게 찾는 내 기준이에요.',
      )
      .replace(
        /그동안의 배움과 기록을 정돈하는 시기예요\. 새로 시작하는 시험보다는 정리·확인·나눔의 자리가 더 또렷해져요\./g,
        '그동안의 기록과 자료를 정돈하는 시기예요. 새로 시작하는 절차보다 정리·확인·나눔의 자리가 더 또렷해져요.',
      );
  }

  if (isMinorReader(ctx) && !isFutureAdultLifeForMinorReader(ctx)) {
    out = out
      .replace(
        /오늘은 책 한 권을 끝까지 읽기보다, 한 단원만 또렷이 챙기면 충분한 흐름이에요\. 한꺼번에 많은 분량을 잡기보다 한 자리에 깊게 머무는 호흡이 잘 맞아요\./g,
        '오늘은 노트나 안내장 전체를 완벽하게 정리하기보다, 다시 볼 단서 하나를 또렷하게 남기면 충분한 흐름이에요. 많은 자료를 한꺼번에 펼치기보다 숙제, 안내장, 시험 범위 중 하나를 정해 확인하는 호흡이 잘 맞아요.',
      )
      .replace(
        /비유하자면 작은 노트 첫 줄을 또박또박 적는 그림이에요\. 오늘 적은 한 줄이 다음 확인에서 길잡이가 돼요\. 그림으로 정리해도 좋고, 색연필로 표시해도 충분해요\./g,
        '비유하자면 작은 노트에 날짜와 표시를 또박또박 남기는 그림이에요. 오늘 남긴 한 줄이 숙제, 안내장, 시험 범위를 다시 찾는 길잡이가 돼요. 그림이나 색연필로 표시해도 충분해요.',
      )
      .replace(
        /잘 풀리는 면은, 모르는 것을 그냥 넘기지 않는 (?:시간|자리)예요\. 헷갈린 문장이나 못 푼 문제를 작은 노트에 한 줄씩 옮겨 두면 오늘의 공부가 자기만의 자료가 돼요\. 친구와 함께 풀어 보는 시간이 있으면 더 잘 남아요\./g,
        '잘 풀리는 면은, 헷갈린 자료를 그냥 넘기지 않고 표시해 두는 시간이에요. 어려운 단어, 문제 번호, 물어볼 내용을 작은 노트에 한 줄씩 옮겨 두면 오늘의 기록이 다시 볼 자료가 돼요. 선생님이나 보호자에게 물어볼 질문까지 보이면 더 오래 남아요.',
      )
      .replace(
        /살짝 주의할 점은, 오늘 모든 과목을 한꺼번에 잡으려는 마음이에요\. 좋아하는 한 과목부터 차분히 끝내고, 어려운 과목은 한 박자 미뤄 둬도 충분해요\. 짧게 쉬고 다시 시작해도 괜찮아요\./g,
        '살짝 주의할 점은, 오늘 모든 자료를 한꺼번에 정리하려는 마음이에요. 급한 안내장이나 숙제 표시부터 차분히 확인하고, 덜 급한 자료는 다음에 다시 봐도 충분해요. 짧게 쉬고 확인해도 괜찮아요.',
      )
      .replace(
        /학교에서 받은 작은 메모 한 장, 오늘 적어 둔 모르는 단어 한 줄이 다음 확인의 작은 길잡이가 돼요\. 비교는 어제 자기와만 짧게로 충분해요\./g,
        '학교에서 받은 안내장 한 장, 오늘 적어 둔 질문 한 줄이 다음 확인의 작은 길잡이가 돼요. 비교보다 어디에 두었고 누구에게 물어볼지 정하는 일이 더 도움이 돼요.',
      )
      .replace(
        /이번 주 공부와 기록은 새 책을 한꺼번에 끝내기보다 좋아하는 부분을 천천히 펼쳐 보는 쪽이 잘 맞아요\. 분량을 늘리는 것보다 자기 페이스를 또렷하게 잡는 시간이 중요해요\./g,
        '이번 주 기록과 자료는 새로 받은 안내장이나 숙제를 한꺼번에 정리하기보다, 다시 볼 단서 하나를 또렷하게 남기는 쪽이 잘 맞아요. 분량보다 어디에 두었고 누구에게 확인할지가 더 중요해요.',
      )
      .replace(
        /비유하자면 작은 노트에 이번 주 공부 지도를 그리는 과정이에요\. 매일 같은 시간에 볼 한 과목을 정하면 주말에는 무엇을 이어 갈지 더 분명해져요\. 그림이나 색연필로 정리해도 충분해요\./g,
        '비유하자면 이번 주 자료 지도를 작게 그리는 과정이에요. 안내장, 숙제, 시험 범위 중 하나를 같은 자리에 두면 주말에 무엇을 확인할지 더 분명해져요. 그림이나 색연필 표시도 충분해요.',
      )
      .replace(
        /잘 풀리는 점은 모르는 것을 솔직하게 모아 두는 태도예요\. 한 주 동안 헷갈린 문장이나 못 푼 문제를 한 줄씩 옮겨 두면, 주말의 30분이 그 공부를 단단하게 마무리해 줘요\./g,
        '잘 풀리는 점은 헷갈린 자료를 숨기지 않고 표시해 두는 태도예요. 한 주 동안 놓친 안내장, 숙제 표시, 물어볼 질문을 한 줄씩 옮겨 두면 주말 확인이 훨씬 쉬워져요.',
      )
      .replace(
        /주의할 점은 시간표를 너무 빽빽하게 짜는 마음이에요\. 매일 30분의 빈칸, 친구와 한 문제를 같이 풀 시간, 좋아하는 책 한 페이지를 천천히 읽을 시간을 남겨 두면 한 주가 훨씬 가벼워져요\./g,
        '주의할 점은 확인할 자료를 너무 많이 펼쳐 두는 마음이에요. 매일 잠깐 비워 둔 시간에 안내장 한 장, 숙제 단서 하나, 물어볼 질문 하나만 확인해도 한 주가 훨씬 가벼워져요.',
      )
      .replace(
        /이번 달 공부는 약한 부분을 정확히 찾는 것이 핵심이에요\./g,
        '이번 달 기록과 서류는 자주 헷갈리는 자료를 정확히 찾는 것이 핵심이에요.',
      )
      .replace(
        /이번 달은 학교 시험·읽기쓰기에서 한 과목을 또렷이 다져요\. 한꺼번에 모든 과목을 잡기보다 깊게 한 트랙이 잘 맞아요\./g,
        '이번 달은 학교에서 받은 안내장, 숙제, 시험 범위 중 자주 헷갈리는 자료를 또렷이 정리하기 좋아요. 한꺼번에 모두 잡기보다 한 묶음씩 확인하는 흐름이 잘 맞아요.',
      )
      .replace(
        /새 노트의 한 단원을 또박또박 채워 가는 그림을 떠올려 보면 좋아요\. 한 달의 한 단원이 다음 확인을 가볍게 해 줘요\./g,
        '새 노트에 자료 이름과 날짜를 또박또박 남기는 그림을 떠올려 보면 좋아요. 한 달 동안 받은 안내장과 숙제를 한곳에 모으면 다음 확인이 가벼워져요.',
      )
      .replace(
        /잘 풀리는 면은, 좋아하는 한 과목에서 한 단계 더 깊이 들어가는 일이에요\. 모든 과목을 한 번에 잡지 않아도 돼요\./g,
        '잘 풀리는 면은 자주 보는 자료 한 묶음을 더 찾기 쉽게 만드는 일이에요. 모든 안내장과 숙제를 한 번에 정리하지 않아도 돼요.',
      )
      .replace(
        /살짝 주의할 점은, 친구와 비교하다 자기 페이스를 놓치는 면이에요\. 지난달 자기와만 비교해도 충분해요\./g,
        '살짝 주의할 점은 친구의 정리 방식과 비교하다 내 자료 위치를 놓치는 면이에요. 지난달보다 더 쉽게 찾을 수 있는지만 봐도 충분해요.',
      )
      .replace(
        /잘하는 과목만 반복하기보다 어려운 단원을 작게 나눠서 확인하면 성취감이 더 오래 가요\./g,
        '자주 보는 노트만 반복하기보다 안내장, 숙제, 시험 범위를 나누어 확인하면 정리한 보람이 더 오래 가요.',
      )
      .replace(
        /한 달 분량은 처음에 크게 잡고, 매주 줄여 가는 편이 안정적이에요\./g,
        '한 달 동안 받은 자료는 처음에 크게 모아 두고, 매주 필요한 것부터 줄여 가는 편이 안정적이에요.',
      )
      .replace(
        /올해 공부운은 큰 목표를 잘게 나눌수록 좋아져요\./g,
        '올해 기록과 자료 흐름은 큰 정리 목표를 작게 나눌수록 좋아져요.',
      )
      .replace(
        /올해는 학교 시험·읽기쓰기에서 한 분야가 또렷이 자기 색깔을 갖추는 흐름이에요\. 한 해를 두고 살펴보면 키가 한 뼘 더 자라는 그림이에요\./g,
        '올해는 학교에서 받은 기록과 자료를 자기 방식으로 차분히 정리하는 흐름이에요. 한 해를 두고 살펴보면 다시 찾는 힘이 한 뼘 더 자라는 그림이에요.',
      )
      .replace(
        /시험, 과제, 자격 준비처럼 시간이 필요한 일은 매달 확인할 작은 기준을 세워야 끝까지 이어가기 쉬워요\./g,
        '시험 범위, 숙제, 학교 안내처럼 시간이 필요한 자료는 매달 확인할 작은 자리를 정해야 끝까지 이어가기 쉬워요.',
      )
      .replace(
        /새 노트 한 권을 또박또박 채워 가는 그림을 떠올려 보면 좋아요\. 한 해의 한 권이 다음 확인·진로의 든든함을 만들어요\./g,
        '새 노트 한 권에 자료 이름과 날짜를 또박또박 모아 가는 그림을 떠올려 보면 좋아요. 한 해 동안 쌓인 표시가 다음 확인의 든든한 기준이 돼요.',
      )
      .replace(
        /잘 풀리는 면은, 좋아하는 한 분야가 자기 무기로 자리 잡는 시간이에요\. 모든 과목을 한 번에 잡지 않아도 돼요\./g,
        '잘 풀리는 면은 자주 쓰는 자료 정리 방식이 자기 기준으로 자리 잡는 시간이에요. 모든 자료를 한 번에 잡지 않아도 돼요.',
      )
      .replace(
        /살짝 주의할 점은, 친구·또래와의 비교에 페이스를 맡기는 면이에요\. 작년 자기와만 비교해도 충분해요\./g,
        '살짝 주의할 점은 친구·또래의 정리 방식과 비교하다 내 자료 위치를 놓치는 면이에요. 작년보다 더 쉽게 찾을 수 있는지만 봐도 충분해요.',
      )
      .replace(
        /준비가 길어질수록 휴식과 점검을 함께 챙기세요\./g,
        '확인이 길어질수록 쉬는 시간과 다시 볼 순서를 함께 챙기세요.',
      );
  }

  if (ctx.period === 'life' && isMinorReader(ctx)) {
    out = out
      .replace(
        /어린 시기와 학창 시절의 기록과 학습 자료 흐름은 기록 하나로 결과를 단정하는 자리가 아니라, 좋아하는 것을 한 가지씩 알아 가는 시간이에요\./g,
        '어린 시기와 학창 시절의 기록과 자료 흐름은 기록 하나로 결과를 단정하는 자리가 아니라, 노트와 안내장을 다시 찾는 방법을 익히는 시간이에요.',
      )
      .replace(
        /비유하자면 새 공책에 첫 줄을 쓰는 시간이에요\. 처음부터 멋지게 채우지 않아도 괜찮고, 오늘 남긴 확인 표시을 자기 말로 남기면 그것이 다음 확인의 길잡이가 돼요\./g,
        '비유하자면 새 공책에 날짜와 표시를 처음 남기는 시간이에요. 처음부터 멋지게 채우지 않아도 괜찮고, 오늘 남긴 확인 표시가 다음에 다시 찾는 길잡이가 돼요.',
      )
      .replace(
        /처음 펼친 노트처럼 이 시기의 배움은 작은 기록에서 시작돼요\. 한 줄을 적고, 다시 읽고, 조금 고쳐 보는 경험이 쌓이면 자기만의 정리 방식이 천천히 만들어져요\./g,
        '처음 펼친 노트처럼 이 시기의 기록은 작은 표시에서 시작돼요. 날짜와 질문을 남기고, 다시 확인하며 고쳐 보는 경험이 쌓이면 자기만의 정리 방식이 천천히 만들어져요.',
      )
      .replace(
        /배움의 시작은 멋진 결과보다 다시 볼 수 있는 작은 흔적에서 힘이 생겨요\. 한 줄 메모, 단서 하나, 질문 하나가 다음 확인의 문을 열어 줘요\./g,
        '기록의 시작은 멋진 결과보다 다시 볼 수 있는 작은 흔적에서 힘이 생겨요. 한 줄 메모, 단서 하나, 질문 하나가 다음 확인의 문을 열어 줘요.',
      )
      .replace(
        /모르는 부분을 남겨 두는 일은 틀렸다는 표시가 아니라 다음 확인의 출발점을 만드는 일이에요\. 다시 볼 표시가 있으면 도움을 청하기도 쉬워져요\./g,
        '헷갈린 자료를 남겨 두는 일은 틀렸다는 표시가 아니라 다음 확인의 출발점을 만드는 일이에요. 다시 볼 표시가 있으면 도움을 청하기도 쉬워져요.',
      )
      .replace(
        /어려운 단어와 헷갈린 문제를 작게 모아 두면 확인할 자료가 훨씬 구체적으로 보여요\. 무엇을 모르는지 알게 되는 순간부터 다음 행동이 정해져요\./g,
        '어려운 단어와 헷갈린 문제 번호를 작게 모아 두면 확인할 자료가 훨씬 구체적으로 보여요. 무엇을 다시 봐야 하는지 알게 되는 순간부터 다음 행동이 정해져요.',
      )
      .replace(
        /거창한 계획이 없어도 배움은 자라요\. 선생님에게 들은 말, 친구와 나눈 풀이, 노트에 남긴 표시가 아이에게는 다음 단계로 가는 든든한 발판이 될 수 있어요\./g,
        '거창한 계획이 없어도 기록은 자라요. 선생님에게 들은 말, 친구와 나눈 풀이, 노트에 남긴 표시가 아이에게는 다음 확인으로 가는 든든한 발판이 될 수 있어요.',
      )
      .replace(/오늘 남긴 확인 표시을/g, '오늘 남긴 확인 표시를');
  }
  if (isFutureAdultLifeForMinorReader(ctx)) {
    out = out
      .replace(
        /나중에 배운 것을 정리해 보여 줄 자료와 자격 준비가 중요해지는 때가 올 수 있어요\. 처음부터 거창하게 준비하기보다 어떤 배움을 남겼는지 차근차근 모으는 흐름이에요\./g,
        '나중에 중요한 기록, 제출 자료, 자격 관련 확인을 차분히 다룰 일이 생길 수 있어요. 처음부터 거창하게 준비하기보다 어떤 기록을 남기고 어디서 다시 찾을지 차근차근 정하는 흐름이에요.',
      )
      .replace(
        /흙에 첫 기둥을 박는 자리처럼, 어떤 배움을 먼저 정리하느냐가 향후 몇 년의 방향을 정해 주는 그림이에요\./g,
        '흙에 첫 기둥을 박는 자리처럼, 어떤 기록을 먼저 남기고 확인하느냐가 향후 몇 년의 기준을 정해 주는 그림이에요.',
      )
      .replace(
        /잘 풀리는 면은, 한 번 결심하면 끝까지 가는 추진력이에요\. 마음먹은 시점에서 6개월·1년 단위 계획을 세워 두면 결과가 또렷해져요\./g,
        '잘 풀리는 면은, 정한 기준을 꾸준히 확인하는 힘이에요. 보관 위치, 다시 볼 날짜, 확인할 사람을 나누어 두면 다음 선택이 또렷해져요.',
      )
      .replace(
        /살짝 주의할 점은, 너무 많은 길을 동시에 열어 두는 면이에요\. 한 번에 한 트랙을 정하고, 다음 트랙은 그 다음에 더해 가는 페이스가 잘 맞아요\./g,
        '살짝 주의할 점은, 자료와 약속을 너무 많이 동시에 벌려 두는 면이에요. 한 번에 한 묶음만 정리하고, 다음 묶음은 그다음에 더하는 페이스가 잘 맞아요.',
      )
      .replace(
        /첫 기록이 손에 들어오는 순간, 다음 단계가 자연스럽게 보이는 흐름이에요\./g,
        '첫 기록을 찾기 쉬운 곳에 남기는 순간, 다음 확인 단계가 자연스럽게 보이는 흐름이에요.',
      );
  }

  return normalizeRenderedText(out);
}
function audienceSafeText(value: string, ctx: StandardDepthEnhancementContext): string {
  let out = softenPublicTone(value);
  if (isMinorReader(ctx)) {
    out = sanitizeMinorAudienceText(out);
    if (isYoungChildReader(ctx)) out = youngChildAudienceText(out, ctx);
    if (isFutureAdultLifeForMinorReader(ctx)) out = minorFutureLifeAudienceText(out, ctx);
  }
  out = polishStandardAudienceText(out);
  out = applyPolishedPublicVariants(out, ctx);
  out = lifeLongHorizonAudienceText(out, ctx);
  out = overallLifeHorizonAudienceText(out, ctx);
  out = careerLifeWorkAudienceText(out, ctx);
  out = careerYearWorkAudienceText(out, ctx);
  out = movementLifeSpecificityAudienceText(out, ctx);
  out = academicRoleAudienceText(out, ctx);
  out = academicLifeBalanceAudienceText(out, ctx);
  out = studyDocumentRoleAudienceText(out, ctx);
  out = dedupeAudienceSentences(out);
  out = out
    .replace(/올해의 직업운/g, '올해 일의 방향')
    .replace(/올해\s*직업운/g, '올해 일의 방향')
    .replace(/올해에는 직업운을/g, '올해에는 일의 방향을')
    .replace(/올해 끝에 설명할 결과 하나를 먼저 고르면 새 제안 앞에서도 방향이 덜 흔들려요\. 올해 끝에 설명할 결과 하나를 먼저 골라도 충분해요\./g, '보여 줄 결과 하나를 먼저 고르면 새 제안 앞에서도 방향이 덜 흔들려요.');
  return normalizeRenderedText(out);
}


function finalStandardAudienceText(value: string, ctx: StandardDepthEnhancementContext): string {
  let out = audienceSafeText(value, ctx);
  out = out
    .replace(/자기 기준를/g, '자기 기준을')
    .replace(/오늘 다시 설명해 볼 작은 단서/g, ctx.period === 'life' ? '나중에 다시 설명할 수 있는 단서' : '오늘 다시 설명해 볼 작은 단서')
    .replace(/친구의 결과는 참고할 수 있지만 내 공부의 전부는 아니에요\. 함께 확인할 문제를 하나 정하면 경쟁보다 배움이 더 오래 남아요\./g, '친구의 결과는 참고할 수 있지만 내 기록 기준의 전부는 아니에요. 함께 볼 문제 번호나 안내장을 하나 정하면 경쟁보다 확인 습관이 더 오래 남아요.')
    .replace(/함께 확인할 문제를 하나 정하면 경쟁보다 배움이 더 오래 남아요/g, '함께 볼 문제 번호나 안내장을 하나 정하면 경쟁보다 확인 습관이 더 오래 남아요')
    .replace(/생활에서 바로 써먹기/g, '생활에 적용하기')
    .replace(/다음 선택에 바로 써먹을 수 있는/g, '다음 선택에 참고할 수 있는')
    .replace(/바로 써먹을/g, '생활에 적용할')
    .replace(/바로 써먹기/g, '생활에 적용하기')
    .replace(/다시 써먹기/g, '다시 참고하기')
    .replace(/바로 써먹/g, '바로 활용')
    .replace(/써먹을/g, '활용할')
    .replace(/써먹은/g, '활용해 온')
    .replace(/써먹는/g, '활용하는')
    .replace(/써먹/g, '활용')
    .replace(/바로 써 볼 수 있는 말/g, '생활에 옮길 수 있는 말')
    .replace(/바로 써 볼/g, '바로 적용해 볼')
    .replace(/오늘 써 볼/g, '오늘 적용할')
    .replace(/적어보세요/g, '적어 보세요')
    .replace(/지금 바로 적용할 수 있는 말 하나만 골라도 충분해요/g, '내 상황에 맞는 기준 하나만 남겨도 충분해요')
    .replace(/마음에 남는 문장이 있다면 그 문장을 기준으로 다음 선택을 하나만 가볍게 정해 보세요/g, '한 문장만 남겨도 다음 선택의 기준이 될 수 있어요')
    .replace(/잘 맞는 말은 생활에 바로 붙이고, 아직 애매한 말은 다음 점검 때 다시 보면 좋아요/g, '잘 맞는 말은 작은 장면에만 시험해 보고, 아직 애매한 말은 다음 점검 때 다시 보면 좋아요')
    .replace(/오늘은 길게 설득하기보다/g, '길게 설득하기보다')
    .replace(/시작 오늘 가능한 범위/g, '오늘 시작 가능한 범위')
    .replace(/오늘 몸과 마음에서 오늘 몸과 마음을/g, '오늘 몸과 마음에서 몸과 마음을')
    .replace(/에서 덜 무겁게 만들 행동/g, '에서 부담을 덜어 줄 행동')
    .replace(/오늘 긴장과 회복에서 오늘 가장/g, '오늘 긴장과 회복에서 가장')
    .replace(/오늘 가족과 가까운 관계에서 오늘 내가/g, '오늘 가족과 가까운 관계에서 내가')
    .replace(/인생 전체의 가족과 가까운 관계에서 가족 안에서/g, '인생 전체의 가족과 가까운 관계에서')
    .replace(/참고표예요/g, '안내예요')
    .replace(/참고표로/g, '기준으로')
    .replace(/참고표/g, '안내')
    .replace(/보는 말이에요/g, '살펴보세요')
    .replace(/나누는 말이에요/g, '나누어 보세요')
    .replace(/참고하는 말이에요/g, '참고해 보세요')
    .replace(/살피는 말이에요/g, '살펴보세요')
    .replace(/나누는 표시예요/g, '나누어 보세요')
    .replace(/찾는 표시예요/g, '찾아보세요')
    .replace(/정리하는 표시예요/g, '정리해 보세요')
    .replace(/표시로 보면 좋아요/g, '신호로 보면 좋아요')
    .replace(/작은 단서 하나/g, '작은 단서 하나')
    .replace(/단서 하나/g, '단서 하나')
    .replace(/표시예요/g, '신호예요')
    .replace(/반복해서 도움이 될 말을 표시해 두세요/g, '반복해서 도움이 될 기준을 표시해 두세요')
    .replace(/오래 가져갈 조언과 가볍게 참고할 조언/g, '오래 가져갈 기준과 가볍게 참고할 기준')
    .replace(/참고할 조언/g, '참고할 기준')
    .replace(/바로 쓸 말/g, '지금 참고할 기준')
    .replace(/가볍게 쓸 말/g, '가볍게 참고할 기준')
    .replace(/지금 쓸 말/g, '지금 참고할 기준')
    .replace(/천천히 볼 말/g, '천천히 다시 볼 기준')
    .replace(/조금 더 지켜볼 말/g, '조금 더 지켜볼 기준')
    .replace(/나중에 다시 볼 말/g, '나중에 다시 볼 기준')
    .replace(/가볍게 참고할 말/g, '가볍게 참고할 기준')
    .replace(/오래 참고할 말/g, '오래 참고할 기준')
    .replace(/지금 참고할 말/g, '지금 참고할 기준')
    .replace(/지금 필요한 말/g, '지금 필요한 기준')
    .replace(/현재 필요한 말/g, '현재 필요한 기준')
    .replace(/지금 맞는 말/g, '지금 맞는 기준')
    .replace(/오늘 맞는 말/g, '오늘 맞는 기준')
    .replace(/나중에 볼 말/g, '나중에 볼 기준')
    .replace(/먼 훗날 다시 볼 말/g, '먼 훗날 다시 볼 기준')
    .replace(/현재 생활에 맞는 말/g, '현재 생활에 맞는 기준')
    .replace(/내 생활에 맞는 말/g, '내 생활에 맞는 기준')
    .replace(/생활에 붙여 보세요/g, '생활에서 작게 확인해 보세요')
    .replace(/실제 생활에 붙여 볼 때/g, '실제 생활에서 확인할 때')
    .replace(/실제 생활에 붙여 볼/g, '실제 생활에서 확인할')
    .replace(/생활에 바로 붙이고/g, '생활에서 작게 확인하고')
    .replace(/생활에 붙이고/g, '생활에서 작게 확인하고')
    .replace(/생활에 붙일/g, '생활에서 확인할')
    .replace(/생활에 붙이는/g, '생활에서 확인하는')
    .replace(/생활에 붙이기/g, '생활에서 이어 가기')
    .replace(/생활에 붙기/g, '생활에서 이어지기')
    .replace(/생활에 붙는/g, '생활에서 다시 쓸 수 있는')
    .replace(/생활에 붙어요/g, '생활에서 오래 이어져요')
    .replace(/해석이 생활에 더 잘 붙어요/g, '해석이 생활에서 더 잘 이어져요');

  if (ctx.category === 'academic') {
    out = out
      .replace(/공부와 배움에서는/g, '읽고 익히는 과정에서는')
      .replace(/공부와 배움에서/g, '배움 흐름에서')
      .replace(/공부와 배움은/g, '읽고 정리하는 힘은')
      .replace(/공부와 배움이/g, '읽고 정리하는 힘이')
      .replace(/공부와 배움을/g, '읽고 익히는 과정을')
      .replace(/공부와 배움도/g, '새로 알아 가는 일도')
      .replace(/공부와 배움의/g, '배움의')
      .replace(/공부와 배움/g, '읽고 익히는 과정')
      .replace(/다음 공부를/g, '다음에 이어 갈 내용을')
      .replace(/다음 공부가/g, '다음에 이어 갈 내용이')
      .replace(/다음 공부의/g, '다음에 이어 갈 내용의')
      .replace(/다음 공부도/g, '다음에 이어 갈 내용도')
      .replace(/다음 공부에/g, '다음에 이어 갈 내용에')
      .replace(/다음 공부에서/g, '다음에 이어 갈 내용에서')
      .replace(/다음 공부/g, '다음에 이어 갈 내용')
      .replace(/다음 배움이 훨씬 쉬워져요/g, '다음에 배울 때 훨씬 쉬워져요')
      .replace(/다음 배움이 막연하지 않아요/g, '다음에 볼 내용도 덜 막연해져요')
      .replace(/다음 배움의 좋은 출발점/g, '다음에 이어 갈 좋은 출발점')
      .replace(/다음 배움의 출발점/g, '다음에 이어 갈 출발점')
      .replace(/다음 배움의 방향/g, '다음에 이어 갈 방향')
      .replace(/다음 배움을/g, '다음에 이어 갈 내용을')
      .replace(/다음 배움이/g, '다음에 이어 갈 내용이')
      .replace(/다음 배움도/g, '다음에 이어 갈 내용도')
      .replace(/다음 배움에/g, '다음에 이어 갈 내용에')
      .replace(/다음 배움에서/g, '다음에 이어 갈 내용에서')
      .replace(/다음 배움/g, '다음에 이어 갈 내용')
      .replace(/새 공부/g, '새 배움')
      .replace(/오늘 끝낼 작은 범위/g, '오늘 다룰 작은 범위')
      .replace(/지금 끝낼 작은 범위/g, '지금 다룰 작은 범위')
      .replace(/오늘 끝낼 범위/g, '오늘 다룰 범위')
      .replace(/지금 끝낼 범위/g, '지금 다룰 범위');
  }

  if (ctx.category === 'academic' && !isMinorReader(ctx)) {
    out = out
      .replace(/이번 달은 새로운 공부 습관을 만들기 좋은 때예요/g, '이번 달은 읽은 내용과 경험을 다시 정리하기 좋은 때예요')
      .replace(/이번 달은 새로운 공부 습관을 만들기 좋은 흐름이에요/g, '이번 달은 읽은 내용과 경험을 다시 정리하기 좋은 흐름이에요')
      .replace(/낯선 과목이나 어려운 단원도 작게 쪼개면 시작이 쉬워져요/g, '낯선 자료나 오래 미뤄 둔 주제도 작게 나누면 시작이 쉬워져요')
      .replace(/공부가 잘되는 시간대에 가장 어려운 과목을 배치하세요/g, '읽고 정리하기 편한 시간대에 가장 헷갈리는 자료를 배치하세요');
  }

  if (ctx.category === 'academic' && ctx.period === 'life') {
    out = out
      .replace(/오늘 끝낼 작은 범위/g, '오래 두고 정리할 작은 주제')
      .replace(/지금 끝낼 작은 범위/g, '오래 두고 정리할 작은 주제')
      .replace(/오늘 다룰 작은 범위/g, '오래 두고 정리할 작은 주제')
      .replace(/지금 다룰 작은 범위/g, '오래 두고 정리할 작은 주제')
      .replace(/오늘 끝낼 범위/g, '오래 두고 정리할 주제')
      .replace(/지금 끝낼 범위/g, '오래 두고 정리할 주제')
      .replace(/오늘 다룰 범위/g, '오래 두고 정리할 주제')
      .replace(/지금 다룰 범위/g, '오래 두고 정리할 주제');
  }
  if (ctx.category === 'family') {
    out = out
      .replace(/결론을 정해두 서로 원하는 것을/g, '결론을 먼저 정하기보다 서로 원하는 것을')
      .replace(/결론을 정해 두 서로 원하는 것을/g, '결론을 먼저 정하기보다 서로 원하는 것을')
      .replace(/줄어드어요/g, '줄어들어요');
  }

  if (ctx.category === 'study_document') {
    out = out
      .replace(/오늘의 한 가지를 정해요/g, '오늘 확인할 자료 하나를 정해요')
      .replace(/이번 주의 한 가지를 정해요/g, '이번 주 확인할 자료 하나를 정해요')
      .replace(/이번 달의 한 가지를 정해요/g, '이번 달 확인할 자료 묶음을 정해요')
      .replace(/올해의 한 가지를 정해요/g, '올해 정리할 자료 묶음을 정해요')
      .replace(/올해의 한 트랙을 정해요/g, '올해 정리할 자료 묶음을 정해요')
      .replace(/이번 달의 한 트랙을 정해요/g, '이번 달 확인할 자료 묶음을 정해요')
      .replace(/분기마다 한 발씩 새 자리로 나가요/g, '분기마다 보관 위치와 다시 볼 날짜를 확인해요')
      .replace(/익숙함에서 한 발만 더 나가요/g, '익숙한 자료도 날짜와 이름을 다시 확인해요')
      .replace(/미뤄도 되는 일과 섞지 않아요/g, '나중에 볼 자료와 제출할 자료를 섞지 않아요')
      .replace(/어떤 자리든 무리하지 않으면 한 단계 진행되는 날이에요/g, '자료 이름, 날짜, 보관 위치를 차분히 맞춰 보기 좋은 날이에요')
      .replace(/어떤 자리든 무리하지 않으면 한 단계 진행되는 흐름이에요/g, '자료 이름, 보관 위치, 다시 볼 날짜를 차분히 맞춰 보기 좋은 흐름이에요')
      .replace(/익숙한 자리에서 한 발만 더 나가 보면 새로운 모양이 보여요/g, '익숙한 자료도 이름과 날짜를 다시 맞춰 보면 다음 확인이 쉬워져요')
      .replace(/익숙한 자리에서 한 발만 더 나가 보면 새로운 결이 보여요/g, '익숙한 자료도 이름과 날짜를 다시 맞춰 보면 다음 확인이 쉬워져요')
      .replace(/새 트랙/g, '새 기준')
      .replace(/한 트랙만 골라 끝내요/g, '자료 묶음 하나만 골라 끝내요')
      .replace(/한 트랙만/g, '자료 묶음 하나만')
      .replace(/한 트랙씩/g, '자료 묶음 하나씩')
      .replace(/한 트랙을/g, '한 가지 기준을')
      .replace(/한 트랙이/g, '한 가지 기준이')
      .replace(/한 트랙의/g, '한 가지 기준의')
      .replace(/한 트랙/g, '한 가지 기준');
  }

  if (ctx.category === 'expression_children' && !isMinorReader(ctx)) {
    out = out
      .replace(/가족이나 아이와의 일/g, '가족이나 가까운 사람, 후배와 나눌 일')
      .replace(/아이가 보내는 신호를 놓치지 않는 한 해가 되시길 바랍니다\./g, '주변의 반응과 내가 편하게 꺼낼 수 있는 표현을 함께 살피는 한 해가 되시길 바라요.')
      .replace(/아이가 보내는 신호를 놓치지 않는 한 해가 되시길 바라요\./g, '주변의 반응과 내가 편하게 꺼낼 수 있는 표현을 함께 살피는 한 해가 되시길 바라요.')
      .replace(/가족·아이 일정/g, '가까운 사람과 나눌 일정')
      .replace(/가족·아이 약속/g, '가까운 사람과의 약속')
      .replace(/자녀나 후배와의 관계/g, '가까운 사람이나 후배와의 관계');
  }


  if (ctx.period === 'life' && ctx.category === 'academic') {
    out = out
      .replace(/공부와 배움에서는/g, '경험과 이해에서는')
      .replace(/공부와 배움/g, '경험과 이해')
      .replace(/다음 공부/g, '이어 갈 질문')
      .replace(/다음 배움/g, '이어 갈 이해')
      .replace(/이어 갈 이해은/g, '이어 갈 이해는')
      .replace(/이어 갈 이해이/g, '이어 갈 이해가')
      .replace(/이어 갈 이해을/g, '이어 갈 이해를')
      .replace(/새 배움/g, '새로 익힐 내용')
      .replace(/꺼내 쓸 방법/g, '꺼내 볼 방법')
      .replace(/어디에 써 봤는지만/g, '어디에서 막히는지만');
  }

  if (ctx.period === 'thisYear') {
    out = out
      .replace(/지금 바로 적용할 수 있는 말 하나만 골라도 충분해요/g, '올해 가볍게 참고할 기준 하나만 골라도 충분해요')
      .replace(/지금 바로 적용할 수 있는 말/g, '올해 가볍게 참고할 기준')
      .replace(/오늘은 길게 설득하기보다/g, '올해에는 길게 설득하기보다')
      .replace(/오늘은 새 장소보다/g, '올해는 새 장소보다')
      .replace(/오늘 바로 연락할 사람/g, '먼저 연락할 사람')
      .replace(/오늘 내가 맡을 몫/g, '이번에 내가 맡을 몫')
      .replace(/오늘 가능한 크기로/g, '이번에 가능한 크기로')
      .replace(/오늘 가능한 말 한마디/g, '이번에 가능한 말 한마디')
      .replace(/굳이 오늘 말하지 않아도 되는 것/g, '조금 더 시간을 두어도 되는 것');
  }
  if (ctx.period === 'thisYear' && ctx.category === 'career') {
    out = out
      .replace(/올해의 직업운/g, '올해 일의 방향')
      .replace(/올해\s*직업운/g, '올해 일의 방향')
      .replace(/올해에는 직업운을/g, '올해에는 일의 방향을')
      .replace(/직업운에서/g, '일의 방향에서')
      .replace(/직업운은/g, '일의 방향은')
      .replace(/직업운을/g, '일의 방향을')
      .replace(/올해 일의 방향에서 올해 /g, '올해 일의 방향에서 ')
      .replace(/직접 끝낼 결과와 함께 검토할 일을/g, '직접 완성할 결과와 나중에 다시 볼 기준을')
      .replace(/직접 끝낼 결과와 함께 검토할 일/g, '직접 완성할 결과와 나중에 다시 볼 기준')
      .replace(/올해 남길 결과와 함께 검토할 일을/g, '올해 남길 결과와 나중에 다시 볼 기준을')
      .replace(/올해 남길 결과와 함께 검토할 일/g, '올해 남길 결과와 나중에 다시 볼 기준')
      .replace(/함께 검토할 일을/g, '나중에 다시 볼 기준을')
      .replace(/함께 검토할 일/g, '나중에 다시 볼 기준')
      .replace(/피하고 싶은 일보다 올해 먼저 챙길 결과 하나/g, '가장 먼저 챙길 결과 하나');
  }

  out = out
    .replace(/돌아올 기준/g, ctx.category === 'movement' ? '다녀온 뒤 지킬 리듬' : '다시 안정될 기준')
    .replace(/두요(?=[.!?\s]|$)/g, '두세요')
    .replace(/맞춰두세요/g, '맞춰 두세요')
    .replace(/정해두세요/g, '정해 두세요')
    .replace(/비워두세요/g, '비워 두세요')
    .replace(/남겨두세요/g, '남겨 두세요')
    .replace(/적어두세요/g, '적어 두세요')
    .replace(/모아두세요/g, '모아 두세요');

  out = normalizeRenderedText(out);
  if (ctx.period === 'life') {
    out = out
      .replace(/지금의 모습/g, '현재의 모습')
      .replace(/지금 생활을/g, '내 생활을');
  }
  if (ctx.period === 'life' && ctx.category === 'career') {
    out = out
      .replace(/인생 전체의 직업운/g, '인생 전체의 일의 방향')
      .replace(/평생의 직업운/g, '평생의 일의 방향')
      .replace(/일의 방향의 방향/g, '일의 방향')
      .replace(/직업운/g, '일의 방향')
      .replace(/인생 전체의 일의 방향에서 흐름이 낮게 보일 때는/g, '인생 전체의 일의 방향이 낮게 보일 때는')
      .replace(/인생 전체의 일의 방향에서 낮게 보이는 흐름은/g, '인생 전체의 일의 방향이 낮게 보일 때는')
      .replace(/인생 전체의 일의 방향에서 무난하게 보일 때는/g, '인생 전체의 일의 방향이 무난하게 보일 때는')
      .replace(/인생 전체의 일의 방향에서 좋은 흐름이 보이면/g, '인생 전체의 일의 방향이 좋게 보일 때는')
      .replace(/인생 전체의 일의 방향에서 점수가 높게 느껴질 때는/g, '인생 전체의 일의 방향이 좋게 느껴질 때는')
      .replace(/인생 전체의 일의 방향에서 흐름이 보통으로 보인다는 말은/g, '인생 전체의 일의 방향이 보통으로 보인다는 말은')
      .replace(/인생 전체의 일의 방향에서 무난하게 보일 때는/g, '인생 전체의 일의 방향이 무난하게 보일 때는')
      .replace(/인생 전체의 일의 방향에서 흐름이 보통으로 보인다는 말은/g, '인생 전체의 일의 방향이 보통으로 보인다는 말은')
      .replace(/인생 전체의 일의 방향에서 좋은 흐름은/g, '인생 전체의 일의 방향이 좋게 보일 때는')
      .replace(/인생 전체의 일의 방향에서 점수가 높게 느껴질 때는/g, '인생 전체의 일의 방향이 좋게 느껴질 때는')
      .replace(/인생 전체의 일의 방향에서 낮게 보이는 흐름은/g, '인생 전체의 일의 방향이 낮게 보일 때는')
      .replace(/그 시기의 일의 흐름/g, '그 시기의 진로 감각')
      .replace(/먼저 맡을 일과 도움받을 일을/g, '오래 남길 경험과 도움을 청할 사람을')
      .replace(/맡을 책임과 도움받을 범위를/g, '오래 남길 경험과 도움을 청할 사람을')
      .replace(/경험과 책임의 크기/g, '경험과 도움을 청할 사람')
      .replace(/긴 흐름에서는 일의 흐름을 한 장면으로 판단하기보다/g, '긴 흐름에서는 일의 방향을 한 장면으로 판단하기보다')
      .replace(/긴 흐름에서는 일의 흐름을 한 번의 좋고 나쁨으로 정하지 않는 편이 좋아요/g, '긴 흐름에서는 일의 방향을 한 번의 좋고 나쁨으로 정하지 않는 편이 좋아요')
      .replace(/긴 흐름에서는 일의 흐름을 좋다 나쁘다로만 나누지 않는 편이 좋아요/g, '긴 흐름에서는 일의 방향을 좋다 나쁘다로만 나누지 않는 편이 좋아요')
      .replace(/긴 흐름에서는 일의 흐름이 한 시기에만 고정되지 않아요/g, '긴 흐름에서는 일의 방향이 한 시기에만 고정되지 않아요')
      .replace(/긴 흐름에서는 일의 흐름이 빠르게 답을 내기보다/g, '긴 흐름에서는 일의 방향이 빠르게 답을 내기보다')
      .replace(/일의 흐름이 덜 막연해져요/g, '남은 선택이 덜 막연해져요')
      .replace(/계속 맡을 일과 편히 넘길 일을 함께 확인해 보세요/g, '앞으로 전할 판단 기준과 내려놓을 부담을 확인해 보세요')
      .replace(/계속 맡을 일과 편히 넘길 일을 나누는 힘/g, '앞으로 전할 판단 기준과 내려놓을 부담을 가르는 힘')
      .replace(/계속 맡을 일과 편히 넘길 일을 차분히 확인/g, '오래 남길 경험과 도움을 청할 사람을 차분히 확인')
      .replace(/계속 맡을 일과 편히 넘길 일/g, '앞으로 전할 판단 기준과 내려놓을 부담')
      .replace(/계속 맡을 일과 편히 넘길 일을 나누어 보세요/g, '앞으로 전할 판단 기준과 내려놓을 부담을 나누어 보세요')
      .replace(/계속 맡고 싶은 일과 편히 넘겨도 되는 일을/g, '앞으로 전할 판단 기준과 내려놓을 부담을')
      .replace(/오래 맡을 일과 편히 넘길 일을/g, '오래 지킬 기준과 나누어 맡길 범위를')
      .replace(/오래 남길 경험과 나눠도 되는 경험을 가볍게 나누어 보세요/g, '남길 기록과 전할 판단 기준을 가볍게 적어 보세요')
      .replace(/오래 남길 경험과 나눠도 되는 경험을 나누어 보세요/g, '앞으로 전할 판단 기준과 내려놓을 부담을 나누어 보세요')
      .replace(/오래 남길 경험과 나눠도 되는 경험을/g, '앞으로 전할 판단 기준과 내려놓을 부담을')
      .replace(/더 가져갈 경험과 나눠도 되는 경험을/g, '앞으로도 지킬 일의 원칙과 이제 줄여도 되는 부담을')
      .replace(/인생 전체의 일의 방향에서 보통으로 보이는 흐름은/g, '인생 전체의 일의 방향이 보통으로 보인다는 말은')
      .replace(/긴 흐름에서는 일의 흐름이/g, '긴 흐름에서는 일의 방향이')
      .replace(/경력의 무게가 덜 막연해져요/g, '남은 선택이 덜 막연해져요');
  }

  if (ctx.period === 'life' && ctx.category === 'academic') {
    out = out
      .replace(/인생 전체로 보면 배움과 이해는/g, '인생 전체로 보면 읽고 정리하는 힘은')
      .replace(/인생 전체의 배움과 이해에서 흐름이/g, '인생 전체의 배움 흐름이')
      .replace(/인생 전체의 배움과 이해에서 낮게 보이는/g, '인생 전체의 배움 흐름이 낮게 보이는')
      .replace(/인생 전체의 배움과 이해에서/g, '인생 전체의 배움 흐름에서')
      .replace(/그 시기의 배움의 흐름에서 흐름이/g, '그 시기의 배움 흐름이')
      .replace(/그 시기의 배움의 흐름에서 낮게 보이는 흐름은/g, '그 시기의 배움 흐름이 낮게 보일 때는')
      .replace(/그 시기의 배움의 흐름에서/g, '그 시기의 배움 흐름에서')
      .replace(/배움의 흐름에서 흐름이/g, '배움 흐름이')
      .replace(/인생 전체의 배움의 흐름에서 흐름이/g, '인생 전체의 배움 흐름이')
      .replace(/인생 전체의 배움의 흐름에서 낮게 보이는 흐름은/g, '인생 전체의 배움 흐름이 낮게 보일 때는')
      .replace(/인생 전체의 배움의 흐름에서/g, '인생 전체의 배움 흐름에서')
      .replace(/읽고 익히는 과정에서는 다시 확인할 방식 하나가 중요해요\./g, '오래 이어 가려면 다시 확인할 방식 하나가 중요해요.')
      .replace(/긴 흐름에서는 배움과 이해를 좋다 나쁘다로만/g, '긴 흐름에서는 배우는 과정을 좋다 나쁘다로만')
      .replace(/긴 흐름에서는 배움과 이해가 빠르게 답을 내기보다/g, '긴 흐름에서는 알아 가는 과정이 빠르게 답을 내기보다')
      .replace(/긴 흐름에서는 배움과 이해가/g, '긴 흐름에서는 배움의 흐름이')
      .replace(/배움과 이해에서는 다시 확인할 방식 하나가 중요해요\./g, '오래 이어 가려면 다시 확인할 방식 하나가 중요해요.')
      .replace(/배움과 이해에서는/g, '읽고 익히는 과정에서는')
      .replace(/배움과 이해에서/g, '배움의 흐름에서')
      .replace(/배움과 이해는/g, '읽고 정리하는 힘은')
      .replace(/배움과 이해가/g, '읽고 정리하는 힘이')
      .replace(/배움과 이해를/g, '읽고 익히는 과정을')
      .replace(/배움과 이해도/g, '새로 알아 가는 일도')
      .replace(/배움과 이해의/g, '배움의');
  }
  if (ctx.period === 'life' && ctx.category === 'movement') {
    out = out
      .replace(/직접 움직일 일과 자리에서 정리해도 되는 일/g, '직접 움직일 일과 멀리 가지 않아도 정리되는 일')
      .replace(/직접 움직여야 할 일과 자리에서 정리해도 되는 일/g, '직접 움직여야 할 일과 멀리 가지 않아도 정리되는 일')
      .replace(/이 시기의 이동운은/g, '이 시기의 이동과 변화는')
      .replace(/평생의 이동운/g, '평생의 이동과 변화')
      .replace(/이동운/g, '이동과 변화')
      .replace(/이동과 변화은/g, '이동과 변화는')
      .replace(/이동과 변화을/g, '이동과 변화를')
      .replace(/시간, 비용, 회복 기준/g, '새 환경이 남길 부담과 다녀온 뒤 여유')
      .replace(/동선, 비용, 체력/g, '길이 얼마나 버거운지')
      .replace(/준비 부담과 회복 여유/g, '새로 바꿀 것과 오래 지킬 기준')
      .replace(/출발 전 부담과 다녀온 뒤 회복 여유/g, '새로 달라질 생활과 다녀온 뒤 여유')
      .replace(/출발 전 부담과 회복 여유/g, '처음 달라질 생활과 다녀온 뒤 여유')
      .replace(/출발 전 부담과 회복할 여유/g, '처음 달라질 생활과 다녀온 뒤 여유')
      .replace(/출발 전 부담과 다녀온 뒤 회복 시간/g, '새로 바꿀 것과 오래 지킬 기준')
      .replace(/출발 전 부담/g, '처음 달라질 생활')
      .replace(/다녀온 뒤 회복 여유/g, '다녀온 뒤 여유')
      .replace(/돌아온 뒤 회복 여유/g, '다녀온 뒤 이어 갈 기준')
      .replace(/비용, 돌아올 시간/g, '다녀온 뒤 일정')
      .replace(/생활비, 회복 여유/g, '지킬 생활비와 쉬어 갈 시간')
      .replace(/돌아올 기준/g, '다녀온 뒤 이어 갈 기준')
      .replace(/작은 이동/g, '짧은 변화')
      .replace(/가까운 곳의 작은 조정/g, '자주 다니는 길의 작은 변화')
      .replace(/지금 생활 안에서/g, '내 생활 반경 안에서')
      .replace(/지금 떠날 일/g, '바로 움직일 일')
      .replace(/지금의 동선/g, '자주 다니는 길')
      .replace(/돌아온 뒤 몸과 마음을 살필 기준/g, '다녀온 뒤 생활에 다시 붙는 시간')
      .replace(/움직일 곳, 쉴 때, 확인할 사람/g, '움직일 곳, 쉴 시간, 확인할 사람')
      .replace(/이동 시간, 쉴 곳, 동행할 사람을 먼저 확인하면/g, '오가는 시간과 쉴 곳, 함께할 사람을 미리 정하면')
      .replace(/출발 전과 돌아온 뒤의 시간을 함께 잡아 두세요/g, '움직이기 전후의 여유를 함께 잡아 두세요')
      .replace(/준비물 하나, 동선 하나, 회복 시간 하나만 정해도/g, '챙길 것과 다녀온 뒤 쉴 시간을 정해도')
      .replace(/함께 확인할 사람, 들어갈 비용, 회복할 시간을 미리 보면/g, '함께 확인할 사람과 쉬어 갈 시간을 미리 정하면')
      .replace(/이동 뒤의 회복/g, '다녀온 뒤 쉴 시간')
      .replace(/돌아와 쉴 칸/g, '돌아와 쉴 틈')
      .replace(/새로 바꿀 것과 그대로 둘 것을 나누면 직접 움직일 일과 기다려도 되는 일이 더 또렷해져요\. 새로 바꿀 것과 그대로 둘 생활 리듬을 나누어 보세요\./g, '새로 바꿀 것과 오래 지킬 기준을 나누면 직접 움직일 일과 기다려도 되는 일이 더 또렷해져요.')
      .replace(/다녀온 뒤 지킬 생활 리듬/g, '다녀온 뒤 이어 갈 기준')
      .replace(/새로 바꿀 것과 그대로 둘 생활 리듬/g, '새로 바꿀 것과 오래 지킬 기준')
      .replace(/바꿀 것과 지킬 생활 리듬/g, '바꿀 것과 오래 지킬 기준')
      .replace(/먼저 바꿀 동선과 그대로 지킬 생활 리듬/g, '먼저 바꿀 동선과 오래 지킬 기준')
      .replace(/준비와 회복의 안전함/g, '새 환경을 감당할 여유');
  }
  if (ctx.period === 'thisYear' && ctx.category === 'career') {
    out = out
      .replace(/올해의 직업운/g, '올해 일의 방향')
      .replace(/올해\s*직업운/g, '올해 일의 방향')
      .replace(/올해에는 직업운을/g, '올해에는 일의 방향을')
      .replace(/직업운에서/g, '일의 방향에서')
      .replace(/직업운은/g, '일의 방향은')
      .replace(/직업운을/g, '일의 방향을')
      .replace(/올해 일의 방향에서 올해 /g, '올해 일의 방향에서 ')
      .replace(/올해 일의 방향에서 흐름이/g, '올해 일의 방향이')
      .replace(/올해 일의 방향에서 보통으로 보이는 흐름은/g, '올해 일의 방향이 보통으로 보인다는 말은')
      .replace(/올해 일의 방향에서 무난하게 보일 때는/g, '올해 일의 방향이 무난하게 보일 때는')
      .replace(/당장 보이는 결과/g, '눈앞의 결과')
      .replace(/올해 바로 쓸 기준/g, '올해 적용할 기준')
      .replace(/나중에 다시 볼 기준을 함께 확인해 보세요/g, '나중에 다시 볼 기준을 확인해 보세요')
      .replace(/올해는 결과의 쓰임과 과정을 함께 기록해 두세요\. 누가 보고 활용할 수 있는지 남기면 새 제안 앞에서도 기준이 생겨요\. 새 제안이 들어와도 바로 방향을 바꾸지 않아도 괜찮아요\. 올해 남길 결과와 다음에 넓힐 가능성을 따로 적으면 기회가 와도 판단이 쉬워져요\./g, '올해는 결과의 쓰임과 과정을 함께 기록해 두세요. 올해 남길 결과와 다음에 넓힐 가능성을 따로 적으면 새 제안 앞에서도 판단이 쉬워져요.')
      .replace(/모든 제안을 동시에 붙잡기보다 밖에서 보여 줄 결과를 정하는 힘이 중요해요\. 같이 검토할 사람과 잠시 미룰 제안을 나누면 방향이 선명해져요\. 보여 줄 결과 하나를 먼저 고르면 새 제안 앞에서도 방향이 덜 흔들려요\. 새 제안 앞에서 다시 볼 기준 하나만 남겨도 충분해요\./g, '모든 제안을 동시에 붙잡기보다 밖에서 보여 줄 결과 하나를 정해 보세요. 같이 검토할 사람과 잠시 미룰 제안을 나누면 새 제안 앞에서도 방향이 덜 흔들려요.')
      .replace(/연말에 다시 볼 기준 하나만 남겨도 충분해요\. 기준이 작아야 다음 제안 앞에서도 흔들림이 줄어요\. /g, '')
      .replace(/올해 적용할 기준과 나중에 다시 볼 기준을 나누어 두면 읽는 부담이 줄어요\. 올해의 성과를 누가 어떻게 쓸 수 있는지 한 줄로 적어 보세요\./g, '올해의 성과를 누가 어떻게 쓸 수 있는지 한 줄로 적어 보세요.');
  }
  return out;
}

function finalStandardParagraph(paragraph: TaggedParagraph, ctx: StandardDepthEnhancementContext): TaggedParagraph {
  const text = finalStandardAudienceText(paragraph.plainText, ctx).trim();
  return {
    tokens: [{ kind: 'text', value: text }],
    plainText: text,
  };
}

function simpleSelfCheckFallback(ctx: StandardDepthEnhancementContext): string {
  const scope = periodCategoryAreaPhrase(ctx);
  if (ctx.period === 'thisYear' && ctx.category === 'career') {
    return `읽고 난 뒤에는 ${scope} 올해 남길 결과와 나중에 다시 볼 제안을 나누어 보세요. 둘을 나누면 한 해의 방향이 덜 복잡하고, 연말에 다시 읽을 기준도 더 또렷해져요.`;
  }
  if (ctx.period === 'life') {
    return `읽고 난 뒤에는 ${scope} 오늘 생활에 맞는 기준과 시간이 지나 다시 확인할 기준을 나누어 보세요. 둘을 나누면 긴 해석도 덜 무겁고, 생활에서 확인할 부분도 더 또렷해져요.`;
  }
  return `읽고 난 뒤에는 ${scope} 바로 확인할 기준과 조금 더 지켜볼 기준을 나누어 보세요. 둘을 나누면 해석이 덜 복잡하고, 실제 선택도 더 쉬워져요.`;
}

function audienceSafeParagraph(paragraph: TaggedParagraph, ctx: StandardDepthEnhancementContext): TaggedParagraph {
  const tokens = paragraph.tokens.map((token): ParagraphToken => {
    if (token.kind !== 'text') return token;
    return { ...token, value: finalStandardAudienceText(token.value, ctx) };
  });
  return {
    tokens,
    plainText: finalStandardAudienceText(paragraph.plainText, ctx),
  };
}

export function enhanceStandardDepth(
  standard: StandardFortuneText,
  ctx: StandardDepthEnhancementContext,
): StandardFortuneText {
  if (!Array.isArray(standard.paragraphs) || standard.paragraphs.length === 0) return standard;

  const enrichers = enhancementSentences(ctx);
  let paragraphs = standard.paragraphs.map((paragraph) => retoneParagraph(paragraph, ctx));
  const hasScoreBridge = paragraphs.some((paragraph) => {
    SCORE_BRIDGE_PATTERN.lastIndex = 0;
    return SCORE_BRIDGE_PATTERN.test(paragraph.plainText);
  });
  if (!hasScoreBridge) {
    const scoreBridgeText = enrichers[0];
    const firstParagraphLength = publicCharLength(paragraphs[0].plainText);
    const scoreBridgeLength = publicCharLength(scoreBridgeText);
    const combinedSentences = sentenceCount(paragraphs[0].plainText) + sentenceCount(scoreBridgeText);
    const overpackedFirstParagraph = ctx.category === 'career' && combinedSentences > MAX_PUBLIC_FIRST_PARAGRAPH_SENTENCES;
    if (firstParagraphLength + scoreBridgeLength + 1 > MAX_PUBLIC_PARAGRAPH_CHARS || overpackedFirstParagraph) {
      paragraphs = [paragraphs[0], textParagraph(scoreBridgeText), ...paragraphs.slice(1)];
    } else {
      paragraphs[0] = appendSentence(paragraphs[0], scoreBridgeText);
    }
  }

  for (let i = 0; i < Math.min(paragraphs.length, enrichers.length); i += 1) {
    if (sentenceCount(paragraphs[i].plainText) >= MIN_SENTENCES_PER_PUBLIC_PARAGRAPH) continue;
    const guidancePattern = guidancePatternForEnricher(i);
    if (guidancePattern && hasParagraphMatching(paragraphs, guidancePattern)) {
      const continuation = shortParagraphContinuation(ctx, paragraphs);
      const compactContinuation = '작게 확인해도 충분해요.';
      paragraphs[i] = appendSentence(
        paragraphs[i],
        publicCharLength(paragraphs[i].plainText) + publicCharLength(continuation) + 1 > MAX_PUBLIC_PARAGRAPH_CHARS
          ? compactContinuation
          : continuation,
      );
      continue;
    }
    const guidanceText = enrichers[i];
    if (publicCharLength(paragraphs[i].plainText) + publicCharLength(guidanceText) + 1 > MAX_PUBLIC_PARAGRAPH_CHARS) {
      const continuation = shortParagraphContinuation(ctx, paragraphs);
      paragraphs[i] = appendSentence(
        paragraphs[i],
        publicCharLength(paragraphs[i].plainText) + publicCharLength(continuation) + 1 > MAX_PUBLIC_PARAGRAPH_CHARS
          ? '작게 확인해도 충분해요.'
          : continuation,
      );
      paragraphs.push(textParagraph(guidanceText));
      continue;
    }
    paragraphs[i] = appendSentence(paragraphs[i], guidanceText);
  }

  ensureGuidanceParagraph(paragraphs, SCORE_PACING_PATTERN, enrichers[1]);
  ensureGuidanceParagraph(paragraphs, PERIOD_SCOPE_PATTERN, enrichers[2]);
  ensureGuidanceParagraph(paragraphs, CATEGORY_GUIDANCE_PATTERN, enrichers[3]);
  ensureGuidanceParagraph(paragraphs, SELF_CHECK_PATTERN, enrichers[4]);
  paragraphs = dedupeRepeatedGuidance(paragraphs);

  let nextEnricher = 1;
  while (paragraphs.length < MIN_PUBLIC_PARAGRAPHS && nextEnricher < enrichers.length) {
    const guidancePattern = guidancePatternForEnricher(nextEnricher);
    if (guidancePattern && hasParagraphMatching(paragraphs, guidancePattern)) {
      nextEnricher += 1;
      continue;
    }
    paragraphs.push(textParagraph(enrichers[nextEnricher]));
    nextEnricher += 1;
  }
  paragraphs = dedupeRepeatedGuidance(paragraphs);

  while (paragraphs.length < MIN_PUBLIC_PARAGRAPHS) {
    const filler = hasParagraphMatching(paragraphs, CLOSING_GUIDANCE_PATTERN)
      ? shortParagraphContinuation(ctx, paragraphs)
      : enrichers[enrichers.length - 1];
    paragraphs.push(textParagraph(filler));
  }
  paragraphs = dedupeRepeatedGuidance(paragraphs);

  let fillerAttempts = 0;
  while (paragraphs.length < MIN_PUBLIC_PARAGRAPHS && fillerAttempts < MIN_PUBLIC_PARAGRAPHS) {
    const beforeLength = paragraphs.length;
    paragraphs.push(textParagraph(shortParagraphContinuation(ctx, paragraphs)));
    paragraphs = dedupeRepeatedGuidance(paragraphs);
    fillerAttempts = paragraphs.length === beforeLength ? fillerAttempts + 1 : 0;
  }

  paragraphs = splitOverpackedQualityOpening(paragraphs, ctx);

  let safeParagraphs = refillPublicParagraphFloor(
    paragraphs.map((paragraph) => audienceSafeParagraph(paragraph, ctx)),
    ctx,
    true,
  );
  if (!hasParagraphMatching(safeParagraphs, SELF_CHECK_PATTERN)) {
    safeParagraphs = [
      ...safeParagraphs,
      audienceSafeParagraph(textParagraph(simpleSelfCheckFallback(ctx)), ctx),
    ];
  }
  safeParagraphs = safeParagraphs.map((paragraph) => finalStandardParagraph(paragraph, ctx));
  return {
    paragraphs: safeParagraphs,
    ...(standard.livingTips ? { livingTips: standard.livingTips.map((text) => finalStandardAudienceText(text, ctx)) } : {}),
    ...(standard.cautions ? { cautions: standard.cautions.map((text) => finalStandardAudienceText(text, ctx)) } : {}),
  };
}
