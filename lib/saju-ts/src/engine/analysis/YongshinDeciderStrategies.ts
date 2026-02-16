import { Cheongan, CHEONGAN_INFO } from '../../domain/Cheongan.js';
import { Jiji, JIJI_INFO } from '../../domain/Jiji.js';
import { Ohaeng, OhaengRelations } from '../../domain/Ohaeng.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { GyeokgukType, GYEOKGUK_TYPE_INFO } from '../../domain/Gyeokguk.js';
import type { GyeokgukResult } from '../../domain/Gyeokguk.js';
import { YongshinType } from '../../domain/YongshinResult.js';
import type { YongshinRecommendation } from '../../domain/YongshinResult.js';
import { JonggyeokYongshinMode } from '../../config/CalculationConfig.js';
import type { CalculationConfig } from '../../config/CalculationConfig.js';
import { HapState } from '../../domain/Relations.js';
import type { HapHwaEvaluation } from '../../domain/Relations.js';
import { JohuTable } from './JohuTable.js';
import {
  GYEOKGUK_YONGSHIN_TABLE,
  ILHAENG_TYPE_TO_OHAENG,
} from './YongshinRuleCatalog.js';
import {
  categoryToOhaeng,
  countChartElements,
  ohaengKorean,
} from './YongshinDecisionSupport.js';

const PRIMARY_TONGGWAN_CONFLICT_THRESHOLD = 3;
const SECONDARY_TONGGWAN_CONFLICT_THRESHOLD = 4;

function buildRecommendation(
  type: YongshinType,
  primaryElement: Ohaeng,
  secondaryElement: Ohaeng | null,
  confidence: number,
  reasoning: string,
): YongshinRecommendation {
  return { type, primaryElement, secondaryElement, confidence, reasoning };
}

interface TonggwanElements {
  readonly self: Ohaeng;
  readonly controller: Ohaeng;
  readonly siksang: Ohaeng;
  readonly inseong: Ohaeng;
  readonly jaeseong: Ohaeng;
}

type TonggwanKey = keyof TonggwanElements;
type TonggwanCounts = Readonly<Record<TonggwanKey, number>>;

interface TonggwanPattern {
  readonly leftCount: TonggwanKey;
  readonly rightCount: TonggwanKey;
  readonly left: TonggwanKey;
  readonly right: TonggwanKey;
  readonly mediator: TonggwanKey;
  readonly threshold: number;
  readonly confidence: number;
  readonly withMediatorRole?: boolean;
}

const TONGGWAN_ROLE_LABELS: Readonly<Record<TonggwanKey, string>> = {
  self: '비겁', controller: '관성', siksang: '식상', inseong: '인성', jaeseong: '재성',
};

const TONGGWAN_PATTERNS: readonly TonggwanPattern[] = [
  { leftCount: 'controller', rightCount: 'self', left: 'controller', right: 'self', mediator: 'inseong', threshold: PRIMARY_TONGGWAN_CONFLICT_THRESHOLD, confidence: 0.6 },
  { leftCount: 'siksang', rightCount: 'inseong', left: 'inseong', right: 'siksang', mediator: 'self', threshold: PRIMARY_TONGGWAN_CONFLICT_THRESHOLD, confidence: 0.5 },
  { leftCount: 'self', rightCount: 'jaeseong', left: 'self', right: 'jaeseong', mediator: 'siksang', threshold: SECONDARY_TONGGWAN_CONFLICT_THRESHOLD, confidence: 0.45, withMediatorRole: true },
  { leftCount: 'siksang', rightCount: 'controller', left: 'siksang', right: 'controller', mediator: 'jaeseong', threshold: SECONDARY_TONGGWAN_CONFLICT_THRESHOLD, confidence: 0.45, withMediatorRole: true },
  { leftCount: 'jaeseong', rightCount: 'inseong', left: 'jaeseong', right: 'inseong', mediator: 'controller', threshold: SECONDARY_TONGGWAN_CONFLICT_THRESHOLD, confidence: 0.45, withMediatorRole: true },
];

function buildTonggwanReasoning(pattern: TonggwanPattern, elements: TonggwanElements): string {
  const left = elements[pattern.left];
  const right = elements[pattern.right];
  const mediator = elements[pattern.mediator];
  return `통관(通關): ${ohaengKorean(left)}(${TONGGWAN_ROLE_LABELS[pattern.left]})과 ` +
    `${ohaengKorean(right)}(${TONGGWAN_ROLE_LABELS[pattern.right]})의 상극이 강하여 ` +
    `${ohaengKorean(mediator)}${pattern.withMediatorRole ? `(${TONGGWAN_ROLE_LABELS[pattern.mediator]})` : ''}이(가) 통관 역할로 필요`;
}

export function eokbuYongshin(dayMasterOhaeng: Ohaeng, isStrong: boolean): YongshinRecommendation {
  const [primary, secondary, reasoning] = isStrong
    ? [
        OhaengRelations.generates(dayMasterOhaeng),
        OhaengRelations.controls(dayMasterOhaeng),
        '신강(身强): 일간 {dm} 과강하여 식상({primary})으로 설기, 재성({secondary})으로 소모 필요',
      ]
    : [
        OhaengRelations.generatedBy(dayMasterOhaeng),
        dayMasterOhaeng,
        '신약(身弱): 일간 {dm} 약하여 인성({primary})으로 생조, 비겁({secondary})으로 부조 필요',
      ];
  return buildRecommendation(
    YongshinType.EOKBU,
    primary,
    secondary,
    0.7,
    reasoning
      .replace('{dm}', `${dayMasterOhaeng}`)
      .replace('{primary}', `${primary}`)
      .replace('{secondary}', `${secondary}`),
  );
}

export function johuYongshin(dayMaster: Cheongan, monthBranch: Jiji): YongshinRecommendation {
  const entry = JohuTable.lookup(dayMaster, monthBranch);
  const ci = CHEONGAN_INFO[dayMaster];
  const ji = JIJI_INFO[monthBranch];
  return buildRecommendation(
    YongshinType.JOHU,
    entry.primary,
    entry.secondary,
    0.8,
    `조후(調候): ${ci.hangul}(${ci.hanja}) 일간 ` +
    `${ji.hangul}(${ji.hanja})월생, ` +
    `궁통보감 기준 ${entry.primary} 필요` +
    (entry.secondary != null ? `, 보조 ${entry.secondary}` : ''),
  );
}

export function tongwanYongshin(
  pillars: PillarSet,
  dayMasterOhaeng: Ohaeng,
  hapHwaEvaluations: readonly HapHwaEvaluation[] = [],
): YongshinRecommendation | null {
  const elementCounts = countChartElements(pillars, hapHwaEvaluations);
  const elements: TonggwanElements = {
    self: dayMasterOhaeng,
    controller: OhaengRelations.controlledBy(dayMasterOhaeng),
    siksang: OhaengRelations.generates(dayMasterOhaeng),
    inseong: OhaengRelations.generatedBy(dayMasterOhaeng),
    jaeseong: OhaengRelations.controls(dayMasterOhaeng),
  };
  const counts: TonggwanCounts = {
    controller: elementCounts.get(elements.controller) ?? 0,
    self: elementCounts.get(elements.self) ?? 0,
    siksang: elementCounts.get(elements.siksang) ?? 0,
    inseong: elementCounts.get(elements.inseong) ?? 0,
    jaeseong: elementCounts.get(elements.jaeseong) ?? 0,
  };
  for (const pattern of TONGGWAN_PATTERNS) {
    if (counts[pattern.leftCount] < pattern.threshold || counts[pattern.rightCount] < pattern.threshold) {
      continue;
    }
    return buildRecommendation(
      YongshinType.TONGGWAN,
      elements[pattern.mediator],
      null,
      pattern.confidence,
      buildTonggwanReasoning(pattern, elements),
    );
  }
  return null;
}

type OhaengTransform = (dayMaster: Ohaeng) => Ohaeng;

type JeonwangModeRule = Readonly<{
  transforms: readonly [primary: OhaengTransform, secondary: OhaengTransform];
  reasoningTemplate: string;
}>;
type JeonwangRuleByMode = Readonly<Record<JonggyeokYongshinMode, JeonwangModeRule>>;
type JeonwangRuleCatalog = Readonly<Partial<Record<GyeokgukType, JeonwangRuleByMode>>>;
type JeonwangResolution = Readonly<{ primary: Ohaeng; secondary: Ohaeng; reasoning: string }>;

const identityOhaeng: OhaengTransform = value => value;

function buildJeonwangModeRule(
  counterTransforms: readonly [OhaengTransform, OhaengTransform],
  counterTemplate: string,
  followTransforms: readonly [OhaengTransform, OhaengTransform],
  followTemplate: string,
): JeonwangRuleByMode {
  return {
    [JonggyeokYongshinMode.COUNTER_DOMINANT]: { transforms: counterTransforms, reasoningTemplate: counterTemplate },
    [JonggyeokYongshinMode.FOLLOW_DOMINANT]: { transforms: followTransforms, reasoningTemplate: followTemplate },
  };
}

const JEONWANG_RULES: JeonwangRuleCatalog = {
  [GyeokgukType.JONGGANG]: buildJeonwangModeRule([OhaengRelations.controlledBy, OhaengRelations.generates], '종강격(역종): 비겁이 극강하나 관성({primary})으로 억제', [identityOhaeng, OhaengRelations.generatedBy], '종강격: 비겁({primary})이 극강하므로 순종하여 부조'),
  [GyeokgukType.JONGA]: buildJeonwangModeRule([OhaengRelations.generatedBy, identityOhaeng], '종아격(역종): 식상이 지배적이나 인성({primary})으로 억제', [OhaengRelations.generates, OhaengRelations.controls], '종아격: 식상({primary})이 지배적이므로 순종'),
  [GyeokgukType.JONGJAE]: buildJeonwangModeRule([identityOhaeng, OhaengRelations.generatedBy], '종재격(역종): 재성이 지배적이나 비겁({primary})으로 대항', [OhaengRelations.controls, OhaengRelations.generates], '종재격: 재성({primary})이 지배적이므로 순종'),
  [GyeokgukType.JONGSAL]: buildJeonwangModeRule([OhaengRelations.generates, OhaengRelations.generatedBy], '종살격(역종): 관성이 지배적이나 식상({primary})으로 설기', [OhaengRelations.controlledBy, OhaengRelations.generates], '종살격: 관성({primary})이 지배적이므로 순종'),
  [GyeokgukType.JONGSE]: buildJeonwangModeRule([OhaengRelations.generatedBy, identityOhaeng], '종세격(역종): 식상/재/관이 강하나 인성({primary})으로 일간 부조', [OhaengRelations.generates, OhaengRelations.controls], '종세격: 식상/재/관이 고루 강하므로 식상({primary})으로 순종'),
};

function resolveJeonwang(
  type: GyeokgukType,
  dayMasterOhaeng: Ohaeng,
  mode: JonggyeokYongshinMode,
): JeonwangResolution | null {
  const modeRule = JEONWANG_RULES[type]?.[mode];
  if (modeRule == null) return null;
  const [primaryTransform, secondaryTransform] = modeRule.transforms;
  const primary = primaryTransform(dayMasterOhaeng);
  return {
    primary,
    secondary: secondaryTransform(dayMasterOhaeng),
    reasoning: modeRule.reasoningTemplate.replace('{primary}', ohaengKorean(primary)),
  };
}

export function jeonwangYongshin(
  _pillars: PillarSet,
  dayMasterOhaeng: Ohaeng,
  gyeokgukResult: GyeokgukResult,
  config: CalculationConfig,
): YongshinRecommendation | null {
  const mode = config.jonggyeokYongshinMode;
  const resolution = resolveJeonwang(gyeokgukResult.type, dayMasterOhaeng, mode);
  if (resolution == null) return null;
  return buildRecommendation(
    YongshinType.JEONWANG,
    resolution.primary,
    resolution.secondary,
    0.75,
    `전왕(專旺): ${resolution.reasoning}`,
  );
}

export function gyeokgukYongshin(
  dayMasterOhaeng: Ohaeng,
  gyeokgukResult: GyeokgukResult,
): YongshinRecommendation | null {
  const rule = GYEOKGUK_YONGSHIN_TABLE.get(gyeokgukResult.type);
  if (!rule) return null;

  const primary = categoryToOhaeng(rule.primaryCategory, dayMasterOhaeng);
  const secondary = rule.secondaryCategory != null
    ? categoryToOhaeng(rule.secondaryCategory, dayMasterOhaeng)
    : null;

  const typeInfo = GYEOKGUK_TYPE_INFO[gyeokgukResult.type];
  return buildRecommendation(
    YongshinType.GYEOKGUK,
    primary,
    secondary,
    0.65,
    `격국용신(格局用神): ${typeInfo.koreanName} — ${rule.reasoning}`,
  );
}

export function byeongyakYongshin(
  pillars: PillarSet,
  dayMasterOhaeng: Ohaeng,
  isStrong: boolean,
  hapHwaEvaluations: readonly HapHwaEvaluation[] = [],
): YongshinRecommendation | null {
  const elementCounts = countChartElements(pillars, hapHwaEvaluations);

  let diseaseElement: Ohaeng | null = null;
  let diseaseCount = 0;
  for (const [element, count] of elementCounts) {
    if (count >= 4 && count > diseaseCount) {
      diseaseElement = element;
      diseaseCount = count;
    }
  }
  if (diseaseElement == null) return null;

  const medicine = OhaengRelations.controlledBy(diseaseElement);

  if (medicine === dayMasterOhaeng && !isStrong) return null;
  if (medicine === diseaseElement) return null;

  return buildRecommendation(
    YongshinType.BYEONGYAK,
    medicine,
    OhaengRelations.generates(medicine),
    0.55,
    `병약(病藥): ${ohaengKorean(diseaseElement)}이(가) ${diseaseCount}개로 과다(병), ` +
    `${ohaengKorean(medicine)}이(가) 이를 제어(약). ` +
    `유병방귀(有病方貴), 무약불귀(無藥不貴).`,
  );
}

export function hapwhaYongshin(
  gyeokgukResult: GyeokgukResult,
  hapHwaEvaluations: readonly HapHwaEvaluation[],
): YongshinRecommendation | null {
  const hapwha = hapHwaEvaluations.find(e => e.state === HapState.HAPWHA);
  if (!hapwha) return null;

  const transformedOhaeng = hapwha.resultOhaeng;
  const primary = OhaengRelations.generatedBy(transformedOhaeng);
  const secondary = transformedOhaeng;

  const typeInfo = GYEOKGUK_TYPE_INFO[gyeokgukResult.type];
  const s1Info = CHEONGAN_INFO[hapwha.stem1];
  const s2Info = CHEONGAN_INFO[hapwha.stem2];

  return buildRecommendation(
    YongshinType.HAPWHA_YONGSHIN,
    primary,
    secondary,
    0.75,
    `합화용신(合化用神): ${typeInfo.koreanName}(${typeInfo.hanja}) — ` +
    `${s1Info.hangul}${s2Info.hangul}합화 결과 ` +
    `${ohaengKorean(transformedOhaeng)}. ` +
    `합화를 유지·강화하는 ${ohaengKorean(primary)}이(가) 용신, ` +
    `${ohaengKorean(secondary)}이(가) 희신.`,
  );
}

export function ilhaengYongshin(
  _pillars: PillarSet,
  gyeokgukResult: GyeokgukResult,
): YongshinRecommendation | null {
  const dominantOhaeng = ILHAENG_TYPE_TO_OHAENG.get(gyeokgukResult.type);
  if (dominantOhaeng == null) return null;

  const primary = OhaengRelations.generates(dominantOhaeng);
  const secondary = dominantOhaeng;

  const typeInfo = GYEOKGUK_TYPE_INFO[gyeokgukResult.type];
  return buildRecommendation(
    YongshinType.ILHAENG_YONGSHIN,
    primary,
    secondary,
    0.7,
    `일행득기용신(一行得氣): ${typeInfo.koreanName}(${typeInfo.hanja}) — ` +
    `${ohaengKorean(dominantOhaeng)}이(가) 원국을 지배. ` +
    `설기(洩氣)로 순화하는 ${ohaengKorean(primary)}이(가) 용신, ` +
    `${ohaengKorean(dominantOhaeng)}이(가) 희신.`,
  );
}
