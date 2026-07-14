export interface TransitShinsalForReport {
  readonly twelveSal?: string;
  readonly samjae?: {
    readonly active?: boolean;
    readonly phase?: string | null;
  };
  readonly sangmun?: boolean;
  readonly jogaek?: boolean;
}

export interface LuckPillarAnnotationsForReport {
  readonly tenGod?: string;
  readonly lifeStage?: string;
  readonly lifeStageKo?: string;
  readonly transitShinsal?: TransitShinsalForReport;
}

const TEN_GOD_KO: Record<string, string> = {
  BI_GYEON: '비견',
  GYEOB_JAE: '겁재',
  SIK_SIN: '식신',
  SANG_GWAN: '상관',
  PYEON_JAE: '편재',
  JEONG_JAE: '정재',
  PYEON_GWAN: '편관',
  JEONG_GWAN: '정관',
  PYEON_IN: '편인',
  JEONG_IN: '정인',
};

const TWELVE_SAL_KO: Record<string, string> = {
  JI_SAL: '지살',
  YEON_SAL: '연살',
  DOHWA: '도화살',
  WOL_SAL: '월살',
  MANG_SHIN_SAL: '망신살',
  JANG_SEONG_SAL: '장성살',
  JANGSEONG: '장성살',
  BAN_AN_SAL: '반안살',
  YEOK_MA_SAL: '역마살',
  YEOKMA: '역마살',
  YUK_HAE_SAL: '육해살',
  HWA_GAE_SAL: '화개살',
  HUAGAI: '화개살',
  GEOB_SAL: '겁살',
  JAE_SAL: '재살',
  JAESAL: '재살',
  CHEON_SAL: '천살',
};

const SAMJAE_PHASE_KO: Record<string, string> = {
  DEUL: '들삼재',
  NUL: '눌삼재',
  NAL: '날삼재',
};

function labelFromMap(value: unknown, map: Record<string, string>): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toUpperCase();
  if (!key) return null;
  return map[key] ?? value;
}

export function tenGodKo(value: unknown): string | null {
  return labelFromMap(value, TEN_GOD_KO);
}

export function twelveSalKo(value: unknown): string | null {
  return labelFromMap(value, TWELVE_SAL_KO);
}

export function samjaePhaseKo(value: unknown): string | null {
  return labelFromMap(value, SAMJAE_PHASE_KO);
}

export function luckAnnotationFeatures(row: LuckPillarAnnotationsForReport | null | undefined): string[] {
  if (!row) return [];

  const features: string[] = [];
  const tg = tenGodKo(row.tenGod);
  if (tg) features.push(`운 십성: ${tg}`);

  const lifeStage = typeof row.lifeStageKo === 'string' && row.lifeStageKo.trim()
    ? row.lifeStageKo.trim()
    : row.lifeStage;
  if (typeof lifeStage === 'string' && lifeStage.trim()) {
    features.push(`12운성: ${lifeStage.trim()}`);
  }

  const shinsal = row.transitShinsal;
  const twelveSal = twelveSalKo(shinsal?.twelveSal);
  if (twelveSal) features.push(`12신살: ${twelveSal}`);

  if (shinsal?.samjae?.active) {
    const phase = samjaePhaseKo(shinsal.samjae.phase);
    features.push(phase ? `삼재 구간: ${phase}` : '삼재 구간');
  }
  if (shinsal?.sangmun) features.push('보조 신살: 상문');
  if (shinsal?.jogaek) features.push('보조 신살: 조객');

  return features;
}

export function luckAnnotationHighlights(row: LuckPillarAnnotationsForReport | null | undefined): string[] {
  if (!row) return [];

  const lines: string[] = [];
  const tg = tenGodKo(row.tenGod);
  if (tg) lines.push(`이 운의 십성은 ${tg}이라 해당 시기의 행동 방식과 관계 맺는 톤을 함께 봐요.`);

  const lifeStage = typeof row.lifeStageKo === 'string' && row.lifeStageKo.trim()
    ? row.lifeStageKo.trim()
    : row.lifeStage;
  if (typeof lifeStage === 'string' && lifeStage.trim()) {
    lines.push(`12운성은 ${lifeStage.trim()} 흐름이라 시작과 확장, 정리의 강약을 보조 근거로 참고해요.`);
  }

  if (row.transitShinsal?.samjae?.active) {
    lines.push('삼재 표시는 단정적 길흉보다 일정, 컨디션, 관계 점검을 촘촘히 하라는 보조 신호로 봐요.');
  }

  return lines;
}
