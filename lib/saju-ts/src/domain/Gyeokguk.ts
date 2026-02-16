import { Ohaeng } from './Ohaeng.js';
import { Sipseong } from './Sipseong.js';

export enum GyeokgukType {
  GEONROK = 'GEONROK',
  YANGIN = 'YANGIN',
  SIKSIN = 'SIKSIN',
  SANGGWAN = 'SANGGWAN',
  PYEONJAE = 'PYEONJAE',
  JEONGJAE = 'JEONGJAE',
  PYEONGWAN = 'PYEONGWAN',
  JEONGGWAN = 'JEONGGWAN',
  PYEONIN = 'PYEONIN',
  JEONGIN = 'JEONGIN',
  JONGGANG = 'JONGGANG',
  JONGA = 'JONGA',
  JONGJAE = 'JONGJAE',
  JONGSAL = 'JONGSAL',
  JONGSE = 'JONGSE',
  HAPWHA_EARTH = 'HAPWHA_EARTH',
  HAPWHA_METAL = 'HAPWHA_METAL',
  HAPWHA_WATER = 'HAPWHA_WATER',
  HAPWHA_WOOD = 'HAPWHA_WOOD',
  HAPWHA_FIRE = 'HAPWHA_FIRE',
  GOKJIK = 'GOKJIK',
  YEOMSANG = 'YEOMSANG',
  GASAEK = 'GASAEK',
  JONGHYEOK = 'JONGHYEOK',
  YUNHA = 'YUNHA',
}

export interface GyeokgukTypeInfo {
  readonly koreanName: string;
  readonly hanja: string;
}

export const GYEOKGUK_TYPE_INFO: Record<GyeokgukType, GyeokgukTypeInfo> = {
  [GyeokgukType.GEONROK]:      { koreanName: '건록격', hanja: '建祿格' },
  [GyeokgukType.YANGIN]:       { koreanName: '양인격', hanja: '羊刃格' },
  [GyeokgukType.SIKSIN]:       { koreanName: '식신격', hanja: '食神格' },
  [GyeokgukType.SANGGWAN]:     { koreanName: '상관격', hanja: '傷官格' },
  [GyeokgukType.PYEONJAE]:     { koreanName: '편재격', hanja: '偏財格' },
  [GyeokgukType.JEONGJAE]:     { koreanName: '정재격', hanja: '正財格' },
  [GyeokgukType.PYEONGWAN]:    { koreanName: '편관격', hanja: '偏官格' },
  [GyeokgukType.JEONGGWAN]:    { koreanName: '정관격', hanja: '正官格' },
  [GyeokgukType.PYEONIN]:      { koreanName: '편인격', hanja: '偏印格' },
  [GyeokgukType.JEONGIN]:      { koreanName: '정인격', hanja: '正印格' },
  [GyeokgukType.JONGGANG]:     { koreanName: '종강격', hanja: '從強格' },
  [GyeokgukType.JONGA]:        { koreanName: '종아격', hanja: '從兒格' },
  [GyeokgukType.JONGJAE]:      { koreanName: '종재격', hanja: '從財格' },
  [GyeokgukType.JONGSAL]:      { koreanName: '종살격', hanja: '從殺格' },
  [GyeokgukType.JONGSE]:       { koreanName: '종세격', hanja: '從勢格' },
  [GyeokgukType.HAPWHA_EARTH]: { koreanName: '합화토격', hanja: '合化土格' },
  [GyeokgukType.HAPWHA_METAL]: { koreanName: '합화금격', hanja: '合化金格' },
  [GyeokgukType.HAPWHA_WATER]: { koreanName: '합화수격', hanja: '合化水格' },
  [GyeokgukType.HAPWHA_WOOD]:  { koreanName: '합화목격', hanja: '合化木格' },
  [GyeokgukType.HAPWHA_FIRE]:  { koreanName: '합화화격', hanja: '合化火格' },
  [GyeokgukType.GOKJIK]:       { koreanName: '곡직격', hanja: '曲直格' },
  [GyeokgukType.YEOMSANG]:     { koreanName: '염상격', hanja: '炎上格' },
  [GyeokgukType.GASAEK]:       { koreanName: '가색격', hanja: '稼穡格' },
  [GyeokgukType.JONGHYEOK]:    { koreanName: '종혁격', hanja: '從革格' },
  [GyeokgukType.YUNHA]:        { koreanName: '윤하격', hanja: '潤下格' },
};

const SIPSEONG_TO_NAEGYEOK: Record<Sipseong, GyeokgukType> = {
  [Sipseong.BI_GYEON]:   GyeokgukType.GEONROK,
  [Sipseong.GYEOB_JAE]:  GyeokgukType.YANGIN,
  [Sipseong.SIK_SIN]:    GyeokgukType.SIKSIN,
  [Sipseong.SANG_GWAN]:  GyeokgukType.SANGGWAN,
  [Sipseong.PYEON_JAE]:  GyeokgukType.PYEONJAE,
  [Sipseong.JEONG_JAE]:  GyeokgukType.JEONGJAE,
  [Sipseong.PYEON_GWAN]: GyeokgukType.PYEONGWAN,
  [Sipseong.JEONG_GWAN]: GyeokgukType.JEONGGWAN,
  [Sipseong.PYEON_IN]:   GyeokgukType.PYEONIN,
  [Sipseong.JEONG_IN]:   GyeokgukType.JEONGIN,
};

const OHAENG_TO_ILHAENG: Record<Ohaeng, GyeokgukType> = {
  [Ohaeng.WOOD]:  GyeokgukType.GOKJIK,
  [Ohaeng.FIRE]:  GyeokgukType.YEOMSANG,
  [Ohaeng.EARTH]: GyeokgukType.GASAEK,
  [Ohaeng.METAL]: GyeokgukType.JONGHYEOK,
  [Ohaeng.WATER]: GyeokgukType.YUNHA,
};

export function gyeokgukFromSipseong(sipseong: Sipseong): GyeokgukType {
  return SIPSEONG_TO_NAEGYEOK[sipseong];
}

export function ilhaengFromOhaeng(ohaeng: Ohaeng): GyeokgukType {
  return OHAENG_TO_ILHAENG[ohaeng];
}

export enum GyeokgukCategory {
  NAEGYEOK = 'NAEGYEOK',
  JONGGYEOK = 'JONGGYEOK',
  HWAGYEOK = 'HWAGYEOK',
  ILHAENG = 'ILHAENG',
}

export enum GyeokgukQuality {
  WELL_FORMED = 'WELL_FORMED',
  BROKEN = 'BROKEN',
  RESCUED = 'RESCUED',
  NOT_ASSESSED = 'NOT_ASSESSED',
}

export const GYEOKGUK_QUALITY_INFO: Record<GyeokgukQuality, { koreanName: string }> = {
  [GyeokgukQuality.WELL_FORMED]:  { koreanName: '성격(成格)' },
  [GyeokgukQuality.BROKEN]:       { koreanName: '파격(破格)' },
  [GyeokgukQuality.RESCUED]:      { koreanName: '파격 구원(救應)' },
  [GyeokgukQuality.NOT_ASSESSED]: { koreanName: '미평가' },
};

export interface GyeokgukFormation {
  readonly quality: GyeokgukQuality;
  readonly breakingFactors: readonly string[];
  readonly rescueFactors: readonly string[];
  readonly reasoning: string;
}

export interface GyeokgukResult {
  readonly type: GyeokgukType;
  readonly category: GyeokgukCategory;
  readonly baseSipseong: Sipseong | null;
  readonly confidence: number;
  readonly reasoning: string;
  readonly formation: GyeokgukFormation | null;
}

