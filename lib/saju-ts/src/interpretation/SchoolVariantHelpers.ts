import {
  type CalculationConfig,
  SchoolPreset,
  configFromPreset,
  HiddenStemScope,
  SaryeongMode,
  YongshinPriority,
  HapHwaStrictness,
  GwiiinTableVariant,
  ShinsalReferenceBranch,
} from '../config/CalculationConfig.js';

export const PRESET_LABELS: Record<SchoolPreset, string> = {
  [SchoolPreset.KOREAN_MAINSTREAM]: '한국 주류',
  [SchoolPreset.TRADITIONAL_CHINESE]: '중국 전통',
  [SchoolPreset.MODERN_INTEGRATED]: '현대 통합',
};

export function schoolLabelFor(config: CalculationConfig): string {
  const korean = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);
  const chinese = configFromPreset(SchoolPreset.TRADITIONAL_CHINESE);
  const modern = configFromPreset(SchoolPreset.MODERN_INTEGRATED);
  if (JSON.stringify(config) === JSON.stringify(korean)) return '한국 주류(적천수+궁통보감)';
  if (JSON.stringify(config) === JSON.stringify(chinese)) return '중국 전통(자평진전)';
  if (JSON.stringify(config) === JSON.stringify(modern)) return '현대 통합(정밀 분석)';
  return '사용자 설정';
}

export function strengthVariantNote(config: CalculationConfig): string {
  const diffs: string[] = [];
  for (const preset of [SchoolPreset.KOREAN_MAINSTREAM, SchoolPreset.TRADITIONAL_CHINESE, SchoolPreset.MODERN_INTEGRATED]) {
    const other = configFromPreset(preset);
    if (JSON.stringify(other) === JSON.stringify(config)) continue;
    const label = PRESET_LABELS[preset];
    const changes: string[] = [];
    if (other.deukryeongWeight !== config.deukryeongWeight) changes.push(`득령 ${Math.floor(other.deukryeongWeight)}점`);
    if (other.proportionalDeukryeong !== config.proportionalDeukryeong) changes.push(other.proportionalDeukryeong ? '비례 득령' : '이진 득령');
    if (other.hiddenStemScopeForStrength !== config.hiddenStemScopeForStrength) {
      const scopeDesc = other.hiddenStemScopeForStrength === HiddenStemScope.ALL_THREE ? '3층 포함'
        : other.hiddenStemScopeForStrength === HiddenStemScope.JEONGGI_ONLY ? '정기만'
          : '사령 기준';
      changes.push(`득지=${scopeDesc}`);
    }
    if (other.saryeongMode !== config.saryeongMode) {
      changes.push(`사령=${other.saryeongMode === SaryeongMode.ALWAYS_JEONGGI ? '항상 정기' : '일수 기반'}`);
    }
    if (changes.length > 0) diffs.push(`${label}: ${changes.join(', ')}`);
  }
  if (diffs.length > 0) return `  ※ 유파 비교: ${diffs.join(' / ')} → 신강/신약 판정이 달라질 수 있습니다.`;
  return '';
}

export function yongshinVariantNote(config: CalculationConfig): string {
  const diffs: string[] = [];
  for (const preset of [SchoolPreset.KOREAN_MAINSTREAM, SchoolPreset.TRADITIONAL_CHINESE, SchoolPreset.MODERN_INTEGRATED]) {
    const other = configFromPreset(preset);
    if (JSON.stringify(other) === JSON.stringify(config)) continue;
    if (other.yongshinPriority !== config.yongshinPriority) {
      const label = PRESET_LABELS[preset];
      const priDesc = other.yongshinPriority === YongshinPriority.JOHU_FIRST ? '조후 우선'
        : other.yongshinPriority === YongshinPriority.EOKBU_FIRST ? '억부 우선'
          : '동등 비중';
      diffs.push(`${label}(${priDesc})`);
    }
  }
  return diffs.length > 0 ? `  ※ 유파 비교: ${diffs.join(', ')}에서는 용신이 달라질 수 있습니다.` : '';
}

export function combinationVariantNote(config: CalculationConfig): string {
  const diffs: string[] = [];
  for (const preset of [SchoolPreset.KOREAN_MAINSTREAM, SchoolPreset.TRADITIONAL_CHINESE, SchoolPreset.MODERN_INTEGRATED]) {
    const other = configFromPreset(preset);
    if (JSON.stringify(other) === JSON.stringify(config)) continue;
    const label = PRESET_LABELS[preset];
    const changes: string[] = [];
    if (other.allowBanhap !== config.allowBanhap) changes.push(`반합 ${other.allowBanhap ? '인정' : '불인정'}`);
    if (other.hapHwaStrictness !== config.hapHwaStrictness) {
      const strictDesc = other.hapHwaStrictness === HapHwaStrictness.STRICT_FIVE_CONDITIONS ? '엄격'
        : other.hapHwaStrictness === HapHwaStrictness.MODERATE ? '중간'
          : '관대';
      changes.push(`합화=${strictDesc}`);
    }
    if (other.dayMasterNeverHapGeo !== config.dayMasterNeverHapGeo) changes.push(`일간합거 ${other.dayMasterNeverHapGeo ? '불가' : '가능'}`);
    if (other.gwiiinTable !== config.gwiiinTable) {
      const tableDesc = other.gwiiinTable === GwiiinTableVariant.KOREAN_MAINSTREAM ? '한국(신→인오)' : '중국(신→인자)';
      changes.push(`천을귀인=${tableDesc}`);
    }
    if (other.shinsalReferenceBranch !== config.shinsalReferenceBranch) {
      const refDesc = other.shinsalReferenceBranch === ShinsalReferenceBranch.DAY_ONLY ? '일지만'
        : other.shinsalReferenceBranch === ShinsalReferenceBranch.YEAR_ONLY ? '년지만'
          : '일지+년지';
      changes.push(`신살참조=${refDesc}`);
    }
    if (changes.length > 0) diffs.push(`${label}: ${changes.join(', ')}`);
  }
  return diffs.length > 0 ? `  ※ 유파 비교: ${diffs.join(' / ')}` : '';
}

