import { configFromPreset, SchoolPreset } from './CalculationConfig.js';
import { ALL_OPTIONS } from './ConfigDocumentationOptions.js';


export interface ConfigOption {
  readonly key: string;
  readonly koreanName: string;
  readonly description: string;
  readonly defaultValue: string;
  readonly possibleValues: readonly string[];
  readonly affectedCalculation: string;
}

export interface ConfigDifference {
  readonly key: string;
  readonly koreanMainstreamValue: string;
  readonly presetValue: string;
  readonly reasoning: string;
}


export const ConfigDocumentation = {
  allOptions(): readonly ConfigOption[] {
    return ALL_OPTIONS;
  },

  presetDifferences(preset: SchoolPreset): readonly ConfigDifference[] {
    const korean = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);
    const target = configFromPreset(preset);

    if (preset === SchoolPreset.KOREAN_MAINSTREAM) return [];

    const diffs: ConfigDifference[] = [];

    function check<T>(key: string, koreanVal: T, targetVal: T, reasoning: string): void {
      if (koreanVal !== targetVal) {
        diffs.push({
          key,
          koreanMainstreamValue: String(koreanVal),
          presetValue: String(targetVal),
          reasoning,
        });
      }
    }

    function checkKey(key: keyof typeof korean, reasoning: string): void {
      check(key, korean[key], target[key], reasoning);
    }

    checkKey(
      'dayCutMode',
      preset === SchoolPreset.TRADITIONAL_CHINESE
        ? '중국 전통에서도 야자시 23:30 기준을 사용하지만 일부 세부 해석이 다를 수 있음'
        : preset === SchoolPreset.MODERN_INTEGRATED
          ? '현대 통합파는 야자시/조자시 분리(JOJA_SPLIT)를 사용하여 현대 시간 관념에 부합'
          : '',
    );
    checkKey(
      'applyDstHistory',
      '중국 전통 기준으로 한국 역사적 서머타임 보정을 적용하지 않음',
    );
    checkKey(
      'includeEquationOfTime',
      '현대 통합파는 균시차 보정을 적용하여 더 정밀한 진태양시 계산',
    );
    checkKey(
      'lmtBaselineLongitude',
      preset === SchoolPreset.TRADITIONAL_CHINESE
        ? '중국 표준시 기준 120도 (UTC+8) 자오선 사용'
        : '기본 KST 135도와 동일',
    );
    checkKey(
      'jeolgiPrecision',
      '현대 통합파는 VSOP87D 기반 정밀 절기 계산을 선호',
    );

    checkKey(
      'hiddenStemVariant',
      '지장간 여기 무토 처리의 차이',
    );
    checkKey(
      'hiddenStemDayAllocation',
      '지장간 일수 배분 테이블의 차이',
    );
    checkKey(
      'saryeongMode',
      preset === SchoolPreset.TRADITIONAL_CHINESE
        ? '중국 전통에서는 절입 후 일수에 따라 사령 천간을 결정하는 엄밀한 방식 사용'
        : preset === SchoolPreset.MODERN_INTEGRATED
          ? '현대 통합파도 절입 후 일수 기반의 정밀한 사령 판별 사용'
          : '',
    );

    checkKey(
      'earthLifeStageRule',
      '토 오행 장생위 규칙의 차이 (화토동법 vs 수토동법)',
    );
    checkKey(
      'yinReversalEnabled',
      '음간 역행 적용 여부의 차이',
    );

    checkKey(
      'deukryeongWeight',
      preset === SchoolPreset.TRADITIONAL_CHINESE
        ? '자평진전파에서 월령의 비중을 더 높게 봄 (40 -> 50)'
        : '득령 비중의 차이',
    );
    checkKey(
      'strengthThreshold',
      '신강/신약 판정 임계값의 차이',
    );
    checkKey(
      'hiddenStemScopeForStrength',
      preset === SchoolPreset.TRADITIONAL_CHINESE
        ? '보수적 전통파는 정기만 통근으로 인정 (여기/중기는 너무 약하다는 입장)'
        : '득지 계산에서 포함하는 지장간 범위의 차이',
    );

    checkKey(
      'proportionalDeukryeong',
      preset === SchoolPreset.TRADITIONAL_CHINESE
        ? '중국 전통파는 지장간 일수 비례로 득령 점수를 세밀하게 산출'
        : preset === SchoolPreset.MODERN_INTEGRATED
          ? '현대 통합파는 지장간 일수 비례로 득령 점수를 세밀하게 산출'
          : '득령 점수 산출 방식의 차이',
    );

    checkKey(
      'jonggyeokWeakThreshold',
      '종약격 판정 임계값의 차이 (높을수록 관대, 더 많은 차트가 종격 진입)',
    );
    checkKey(
      'jonggyeokStrongThreshold',
      '종강격 판정 임계값의 차이 (낮을수록 관대, 더 많은 차트가 종격 진입)',
    );

    checkKey(
      'yongshinPriority',
      preset === SchoolPreset.TRADITIONAL_CHINESE
        ? '자평진전 계열은 격국용신 우선이나, 현 엔진에서 억부용신으로 대체하여 억부 우선'
        : preset === SchoolPreset.MODERN_INTEGRATED
          ? '현대 통합파는 조후/억부/격국 세 방식을 동등하게 종합'
          : '',
    );
    checkKey(
      'jonggyeokYongshinMode',
      '종격 용신 결정 방식의 차이 (순종 vs 역종)',
    );

    checkKey(
      'hapHwaStrictness',
      preset === SchoolPreset.MODERN_INTEGRATED
        ? '현대 통합파는 인접+월령 조건이면 합화를 인정하는 중간 수준의 엄격도'
        : '합화 성립 엄격도의 차이',
    );
    checkKey(
      'allowBanhap',
      '중국 전통 엄격파는 삼합의 3지 모두 있어야만 인정하므로 반합 불인정',
    );
    checkKey(
      'dayMasterNeverHapGeo',
      '일부 중국 학파에서는 일간도 합거될 수 있다고 봄 (한국 주류는 불가)',
    );

    checkKey(
      'gwiiinTable',
      '중국 전통 천을귀인 테이블은 신(辛) 매핑이 다름: 인오 -> 인자',
    );
    checkKey(
      'shinsalReferenceBranch',
      preset === SchoolPreset.TRADITIONAL_CHINESE
        ? '중국 전통에서는 신살 판별시 일지만 기준으로 사용'
        : '신살 참조 지지의 차이',
    );

    return diffs;
  },
} as const;


