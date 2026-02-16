export enum ClassicalSource {
  JEOKCHEONSU = 'JEOKCHEONSU',
  GUNGTONGBOGAM = 'GUNGTONGBOGAM',
  JAPYEONGJINJEON = 'JAPYEONGJINJEON',
  SAMMYEONGTTONGHOE = 'SAMMYEONGTTONGHOE',
  YEONHAEJAYPYEONG = 'YEONHAEJAYPYEONG',
  MYEONGLIJEONGJON = 'MYEONGLIJEONGJON',
  KOREAN_MODERN_PRACTICE = 'KOREAN_MODERN_PRACTICE',
}

export interface ClassicalSourceInfo {
  readonly koreanName: string;
  readonly hanja: string;
  readonly shortLabel: string;
  readonly era: string;
  readonly description: string;
}

export const CLASSICAL_SOURCE_INFO: Record<ClassicalSource, ClassicalSourceInfo> = {
  [ClassicalSource.JEOKCHEONSU]: {
    koreanName: '적천수(滴天髓)',
    hanja: '滴天髓',
    shortLabel: '적천수',
    era: '元代(원대) ~14세기, 임철초(任鐵樵) 주해',
    description: '천간의 본성과 강약 판단, 일간 역학의 핵심 원전',
  },
  [ClassicalSource.GUNGTONGBOGAM]: {
    koreanName: '궁통보감(窮通寶鑑)',
    hanja: '窮通寶鑑',
    shortLabel: '궁통보감',
    era: '清代(청대) ~18세기, 여춘태(余春台) 편찬',
    description: '계절(한난조습)에 따른 조후용신 처방의 유일한 원전',
  },
  [ClassicalSource.JAPYEONGJINJEON]: {
    koreanName: '자평진전(子平眞詮)',
    hanja: '子平眞詮',
    shortLabel: '자평진전',
    era: '清代(청대) ~18세기, 심효첨(沈孝瞻) 저',
    description: '격국 분류와 용신 결정 체계의 핵심 원전',
  },
  [ClassicalSource.SAMMYEONGTTONGHOE]: {
    koreanName: '삼명통회(三命通會)',
    hanja: '三命通會',
    shortLabel: '삼명통회',
    era: '明代(명대) ~16세기, 만민영(萬民英) 저',
    description: '지장간, 신살, 60갑자 일주 해석의 종합 원전',
  },
  [ClassicalSource.YEONHAEJAYPYEONG]: {
    koreanName: '연해자평(淵海子平)',
    hanja: '淵海子平',
    shortLabel: '연해자평',
    era: '宋代(송대) ~13세기, 서대승(徐大升) 편찬',
    description: '합충형파해와 십이운성, 사주 체계의 원조 원전',
  },
  [ClassicalSource.MYEONGLIJEONGJON]: {
    koreanName: '명리정종(命理正宗)',
    hanja: '命理正宗',
    shortLabel: '명리정종',
    era: '明代(명대) ~16세기, 장남(張楠) 저',
    description: '내격 분류의 세분화와 정격 체계 정리',
  },
  [ClassicalSource.KOREAN_MODERN_PRACTICE]: {
    koreanName: '한국 현대 실전 명리',
    hanja: '韓國現代實踐命理',
    shortLabel: '현대실전',
    era: '20-21세기',
    description: '한국 현대 명리사들의 실전 경험과 통합 연구',
  },
};

export function inlineCitation(source: ClassicalSource): string {
  return `[출처: ${CLASSICAL_SOURCE_INFO[source].shortLabel}]`;
}

