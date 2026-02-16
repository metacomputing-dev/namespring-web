export enum Eumyang {
  YANG = 'YANG',
  YIN = 'YIN',
}

export const EUMYANG_INFO: Record<Eumyang, { hangul: string; hanja: string }> = {
  [Eumyang.YANG]: { hangul: '양', hanja: '陽' },
  [Eumyang.YIN]:  { hangul: '음', hanja: '陰' },
};

export const EUMYANG_VALUES: readonly Eumyang[] = [Eumyang.YANG, Eumyang.YIN] as const;

