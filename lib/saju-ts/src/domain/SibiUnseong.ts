export enum SibiUnseong {
  JANG_SAENG = 'JANG_SAENG',
  MOK_YOK    = 'MOK_YOK',
  GWAN_DAE   = 'GWAN_DAE',
  GEON_ROK   = 'GEON_ROK',
  JE_WANG    = 'JE_WANG',
  SWOE       = 'SWOE',
  BYEONG     = 'BYEONG',
  SA         = 'SA',
  MYO        = 'MYO',
  JEOL       = 'JEOL',
  TAE        = 'TAE',
  YANG       = 'YANG',
}

export interface SibiUnseongInfo {
  readonly koreanName: string;
  readonly hanja: string;
  readonly stage: number;
}

export const SIBI_UNSEONG_INFO: Record<SibiUnseong, SibiUnseongInfo> = {
  [SibiUnseong.JANG_SAENG]: { koreanName: '장생', hanja: '長生', stage: 1  },
  [SibiUnseong.MOK_YOK]:    { koreanName: '목욕', hanja: '沐浴', stage: 2  },
  [SibiUnseong.GWAN_DAE]:   { koreanName: '관대', hanja: '冠帶', stage: 3  },
  [SibiUnseong.GEON_ROK]:   { koreanName: '건록', hanja: '建祿', stage: 4  },
  [SibiUnseong.JE_WANG]:    { koreanName: '제왕', hanja: '帝旺', stage: 5  },
  [SibiUnseong.SWOE]:       { koreanName: '쇠',   hanja: '衰',   stage: 6  },
  [SibiUnseong.BYEONG]:     { koreanName: '병',   hanja: '病',   stage: 7  },
  [SibiUnseong.SA]:         { koreanName: '사',   hanja: '死',   stage: 8  },
  [SibiUnseong.MYO]:        { koreanName: '묘',   hanja: '墓',   stage: 9  },
  [SibiUnseong.JEOL]:       { koreanName: '절',   hanja: '絕',   stage: 10 },
  [SibiUnseong.TAE]:        { koreanName: '태',   hanja: '胎',   stage: 11 },
  [SibiUnseong.YANG]:       { koreanName: '양',   hanja: '養',   stage: 12 },
};

export const SIBI_UNSEONG_VALUES: readonly SibiUnseong[] = [
  SibiUnseong.JANG_SAENG, SibiUnseong.MOK_YOK, SibiUnseong.GWAN_DAE,
  SibiUnseong.GEON_ROK, SibiUnseong.JE_WANG, SibiUnseong.SWOE,
  SibiUnseong.BYEONG, SibiUnseong.SA, SibiUnseong.MYO,
  SibiUnseong.JEOL, SibiUnseong.TAE, SibiUnseong.YANG,
] as const;

