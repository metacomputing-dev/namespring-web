export enum Sipseong {
  BI_GYEON   = 'BI_GYEON',
  GYEOB_JAE  = 'GYEOB_JAE',
  SIK_SIN    = 'SIK_SIN',
  SANG_GWAN  = 'SANG_GWAN',
  PYEON_JAE  = 'PYEON_JAE',
  JEONG_JAE  = 'JEONG_JAE',
  PYEON_GWAN = 'PYEON_GWAN',
  JEONG_GWAN = 'JEONG_GWAN',
  PYEON_IN   = 'PYEON_IN',
  JEONG_IN   = 'JEONG_IN',
}

export interface SipseongInfo {
  readonly koreanName: string;
  readonly hanja: string;
}

export const SIPSEONG_INFO: Record<Sipseong, SipseongInfo> = {
  [Sipseong.BI_GYEON]:   { koreanName: '비견', hanja: '比肩' },
  [Sipseong.GYEOB_JAE]:  { koreanName: '겁재', hanja: '劫財' },
  [Sipseong.SIK_SIN]:    { koreanName: '식신', hanja: '食神' },
  [Sipseong.SANG_GWAN]:  { koreanName: '상관', hanja: '傷官' },
  [Sipseong.PYEON_JAE]:  { koreanName: '편재', hanja: '偏財' },
  [Sipseong.JEONG_JAE]:  { koreanName: '정재', hanja: '正財' },
  [Sipseong.PYEON_GWAN]: { koreanName: '편관', hanja: '偏官' },
  [Sipseong.JEONG_GWAN]: { koreanName: '정관', hanja: '正官' },
  [Sipseong.PYEON_IN]:   { koreanName: '편인', hanja: '偏印' },
  [Sipseong.JEONG_IN]:   { koreanName: '정인', hanja: '正印' },
};

export const SIPSEONG_VALUES: readonly Sipseong[] = [
  Sipseong.BI_GYEON, Sipseong.GYEOB_JAE, Sipseong.SIK_SIN, Sipseong.SANG_GWAN,
  Sipseong.PYEON_JAE, Sipseong.JEONG_JAE, Sipseong.PYEON_GWAN, Sipseong.JEONG_GWAN,
  Sipseong.PYEON_IN, Sipseong.JEONG_IN,
] as const;

