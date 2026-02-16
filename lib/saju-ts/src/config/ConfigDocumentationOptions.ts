import { DayCutMode } from '../calendar/time/DayCutMode.js';
import { HiddenStemVariant, HiddenStemDayAllocation } from '../domain/HiddenStem.js';
import {
  SaryeongMode,
  EarthLifeStageRule,
  HiddenStemScope,
  YongshinPriority,
  JonggyeokYongshinMode,
  HapHwaStrictness,
  GwiiinTableVariant,
  ShinsalReferenceBranch,
  JeolgiPrecision,
} from './CalculationConfig.js';
import type { ConfigOption } from './ConfigDocumentation.js';


type ConfigOptionRow = readonly [
  key: string,
  koreanName: string,
  description: string,
  defaultValue: string,
  possibleValues: readonly string[],
  affectedCalculation: string,
];

const CONFIG_OPTION_ROWS: readonly ConfigOptionRow[] = [
  ['dayCutMode', '야자시 처리', '자시(子時, 23:00-01:00) 구간의 일주 전환 방식. ' +
    '자정을 기준으로 할지, 23시(또는 23:30)부터 다음날로 할지, 조자시 분리를 할지 결정.', DayCutMode.YAZA_23_TO_01_NEXTDAY, Object.values(DayCutMode), '일주(Day Pillar) 결정 -- P0 최우선 영향'],
  ['applyDstHistory', '서머타임 보정', '한국 역사적 서머타임(1948-1951, 1955-1960) 기간의 시계 시간을 표준시로 보정.', 'true', ['true', 'false'], '시간 보정 -- 시주 및 일주에 영향'],
  ['includeEquationOfTime', '균시차 보정', '지구 공전 궤도 이심률과 자전축 경사에 의한 진태양시 보정 적용 여부. 최대 약 16분 차이.', 'false', ['true', 'false'], '진태양시 계산 -- 시주에 영향'],
  ['lmtBaselineLongitude', 'LMT 기준 경도', '지방평균태양시(LMT) 보정의 기준 자오선 경도. ' +
    '135.0 = 현대 KST(UTC+9), 120.0 = 중국 CST(UTC+8), 127.5 = 역사적 JST/KST.', '135.0', ['135.0', '120.0', '127.5'], '경도 기반 시간 보정 -- 시주에 영향'],
  ['jeolgiPrecision', '절기 계산 정밀도', '절기(24 Solar Terms) 경계 시각의 계산 정밀도. 년주/월주 전환 시점에 영향.', JeolgiPrecision.APPROXIMATE, Object.values(JeolgiPrecision), '년주/월주 결정 -- 절기 경계 근처 생년월일에 영향'],
  ['hiddenStemVariant', '지장간 여기 무토', '생지(寅申巳亥)의 여기에 무토(戊土)를 포함할지 여부.', HiddenStemVariant.STANDARD, Object.values(HiddenStemVariant), '지장간 구성 -- 통근, 득지 계산에 영향'],
  ['hiddenStemDayAllocation', '지장간 일수 배분', '각 지지의 지장간에 배분되는 일수 방식. 연해자평식(표준) vs 삼명통회식.', HiddenStemDayAllocation.YEONHAE_JAPYEONG, Object.values(HiddenStemDayAllocation), '득지 비례 점수 계산 -- 신강/신약 판단에 영향'],
  ['saryeongMode', '사령 판별', '월지의 사령(司令) 천간 결정 방식. 항상 정기 사용 vs 절입 후 일수 기반 판별.', SaryeongMode.ALWAYS_JEONGGI, Object.values(SaryeongMode), '격국 결정, 득령 판단 -- P1 높은 영향'],
  ['earthLifeStageRule', '토 장생위 규칙', '토(土) 오행의 십이운성 장생 시작 위치 결정. 화토동법(화를 따름) vs 수토동법(수를 따름).', EarthLifeStageRule.FOLLOW_FIRE, Object.values(EarthLifeStageRule), '무(戊)/기(己) 천간의 십이운성 -- 十二運星 해석에 영향'],
  ['yinReversalEnabled', '양순음역 적용', '음간(乙丁己辛癸)의 십이운성 역행 적용 여부. true = 양순음역(전통), false = 모두 순행(개혁).', 'true', ['true', 'false'], '음간 5개의 십이운성 방향 -- 十二運星 해석에 영향'],
  ['deukryeongWeight', '득령 비중', '득령(得令) 시 부여되는 최대 점수. 월지 정기가 일간을 부조할 때 이 점수를 부여. 범위: 30~50.', '40.0', ['30.0', '35.0', '40.0', '45.0', '50.0'], '신강/신약 판단 -- 전체 분석의 기초'],
  ['strengthThreshold', '신강 판정 임계값', '총 부조 점수가 이 값 이상이면 신강(身强)으로 판정. 기본 50.', '50.0', ['45.0', '50.0', '55.0'], '신강/신약 판단 -- 용신 결정의 기초'],
  ['hiddenStemScopeForStrength', '득지 지장간 범위', '득지(得地) 계산 시 각 지지의 지장간 중 어디까지 포함할지. ' +
    '여기+중기+정기 모두, 정기만, 또는 사령 천간만.', HiddenStemScope.ALL_THREE, Object.values(HiddenStemScope), '득지 점수 -- 신강/신약 세밀도에 영향'],
  ['proportionalDeukryeong', '득령 비례 점수', '득령 점수를 이진(사령 천간 일치 시 만점) vs 비례(지장간 일수 비례 배분)로 계산하는 방식. ' +
    '비례 모드는 지장간 일수에 따라 세밀한 점수를 부여.', 'false', ['true', 'false'], '득령 점수 산출 -- 신강/신약 판단의 세밀도에 영향'],
  ['yongshinPriority', '용신 우선순위', '억부용신과 조후용신이 충돌할 때의 우선순위. 조후 우선, 억부 우선, 또는 동등 비중.', YongshinPriority.JOHU_FIRST, Object.values(YongshinPriority), '최종 용신 결정 -- P0 최우선 영향'],
  ['jonggyeokYongshinMode', '종격 용신', '종격(從格) 판정 시 용신을 강한 오행을 따를지(순종) 거스를지(역종) 결정.', JonggyeokYongshinMode.FOLLOW_DOMINANT, Object.values(JonggyeokYongshinMode), '종격 차트의 용신 결정'],
  ['jonggyeokWeakThreshold', '종약격 임계값', '총 부조 점수가 이 값 이하이면 종약격(從弱格) 후보로 판정. ' +
    '낮을수록 보수적(진짜 극약만 종격), 높을수록 관대(약간 약해도 종격 인정).', '15.0', ['10.0', '15.0', '20.0', '25.0'], '종격 판정 -- 종아/종재/종살/종세격 진입 기준'],
  ['jonggyeokStrongThreshold', '종강격 임계값', '총 부조 점수가 이 값 이상이면 종강격(從强格) 후보로 판정. ' +
    '높을수록 보수적(진짜 극강만 종격), 낮을수록 관대(약간 강해도 종격 인정).', '62.4', ['55.0', '58.0', '62.4', '65.0'], '종격 판정 -- 종강격 진입 기준'],
  ['hapHwaStrictness', '합화 엄격도', '천간합(天干合)이 합화(合化)로 성립하기 위한 조건의 엄격도. ' +
    '엄격 5조건, 중간(인접+월령), 또는 관대(인접만).', HapHwaStrictness.STRICT_FIVE_CONDITIONS, Object.values(HapHwaStrictness), '천간 합화 판정 -- 오행 변환 여부 결정'],
  ['allowBanhap', '반합 인정', '삼합(三合)의 3지 중 2지만 있을 때 반합(半合)으로 인정할지 여부.', 'true', ['true', 'false'], '지지 삼합/반합 판정'],
  ['dayMasterNeverHapGeo', '일간 합거 불가', '일간(日干)이 천간합으로 합거(合去)되는 것을 금지할지 여부. ' +
    '한국 주류는 일간은 자아이므로 합거 불가.', 'true', ['true', 'false'], '천간합 판정 시 일간 처리'],
  ['gwiiinTable', '천을귀인 표', '천을귀인(天乙貴人) 조견표 변형. 한국 주류(경->축미, 신->인오) vs ' +
    '중국 전통(신->인자).', GwiiinTableVariant.KOREAN_MAINSTREAM, Object.values(GwiiinTableVariant), '천을귀인 신살 판정'],
  ['shinsalReferenceBranch', '신살 참조 지지', '역마/도화/화개 등 삼합 기반 신살의 참조 지지. 일지만, 년지만, 또는 일지+년지 모두.', ShinsalReferenceBranch.DAY_AND_YEAR, Object.values(ShinsalReferenceBranch), '삼합 기반 신살 판정'],
];

function toConfigOption(row: ConfigOptionRow): ConfigOption {
  const [key, koreanName, description, defaultValue, possibleValues, affectedCalculation] = row;
  return { key, koreanName, description, defaultValue, possibleValues, affectedCalculation };
}

export const ALL_OPTIONS: readonly ConfigOption[] = CONFIG_OPTION_ROWS.map(toConfigOption);

