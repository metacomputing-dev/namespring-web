import { Ohaeng } from './Ohaeng.js';

export enum YongshinType {
  EOKBU = 'EOKBU',
  JOHU = 'JOHU',
  TONGGWAN = 'TONGGWAN',
  GYEOKGUK = 'GYEOKGUK',
  BYEONGYAK = 'BYEONGYAK',
  JEONWANG = 'JEONWANG',
  HAPWHA_YONGSHIN = 'HAPWHA_YONGSHIN',
  ILHAENG_YONGSHIN = 'ILHAENG_YONGSHIN',
}

export const YONGSHIN_TYPE_INFO: Record<YongshinType, { koreanName: string }> = {
  [YongshinType.EOKBU]:            { koreanName: '억부용신' },
  [YongshinType.JOHU]:             { koreanName: '조후용신' },
  [YongshinType.TONGGWAN]:         { koreanName: '통관용신' },
  [YongshinType.GYEOKGUK]:         { koreanName: '격국용신' },
  [YongshinType.BYEONGYAK]:        { koreanName: '병약용신' },
  [YongshinType.JEONWANG]:         { koreanName: '전왕용신' },
  [YongshinType.HAPWHA_YONGSHIN]:  { koreanName: '합화용신' },
  [YongshinType.ILHAENG_YONGSHIN]: { koreanName: '일행득기용신' },
};

export interface YongshinRecommendation {
  readonly type: YongshinType;
  readonly primaryElement: Ohaeng;
  readonly secondaryElement: Ohaeng | null;
  readonly confidence: number;
  readonly reasoning: string;
}

export enum YongshinAgreement {
  FULL_AGREE = 'FULL_AGREE',
  PARTIAL_AGREE = 'PARTIAL_AGREE',
  DISAGREE = 'DISAGREE',
}

export const YONGSHIN_AGREEMENT_INFO: Record<YongshinAgreement, { confidence: number; label: string }> = {
  [YongshinAgreement.FULL_AGREE]:    { confidence: 0.95, label: '완전 일치' },
  [YongshinAgreement.PARTIAL_AGREE]: { confidence: 0.75, label: '부분 일치' },
  [YongshinAgreement.DISAGREE]:      { confidence: 0.55, label: '불일치' },
};

export interface YongshinResult {
  readonly recommendations: readonly YongshinRecommendation[];
  readonly finalYongshin: Ohaeng;
  readonly finalHeesin: Ohaeng | null;
  readonly gisin: Ohaeng | null;
  readonly gusin: Ohaeng | null;
  readonly agreement: YongshinAgreement;
  readonly finalConfidence: number;
}

