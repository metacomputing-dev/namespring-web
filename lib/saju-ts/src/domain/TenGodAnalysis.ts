import { Cheongan } from './Cheongan.js';
import { HiddenStemEntry } from './HiddenStem.js';
import { PillarPosition } from './PillarPosition.js';
import { Sipseong } from './Sipseong.js';

export interface HiddenStemSipseong {
  readonly entry: HiddenStemEntry;
  readonly sipseong: Sipseong;
}

export interface PillarTenGodAnalysis {
  readonly cheonganSipseong: Sipseong;
  readonly jijiPrincipalSipseong: Sipseong;
  readonly hiddenStems: readonly HiddenStemEntry[];
  readonly hiddenStemSipseong: readonly HiddenStemSipseong[];
}

export interface TenGodAnalysis {
  readonly dayMaster: Cheongan;
  readonly byPosition: Partial<Record<PillarPosition, PillarTenGodAnalysis>>;
}

