import { Cheongan } from '../../domain/Cheongan.js';
import { Jiji } from '../../domain/Jiji.js';
import {
  type HiddenStemEntry,
  HiddenStemDayAllocation,
  HiddenStemTable,
  HiddenStemVariant,
} from '../../domain/HiddenStem.js';

const DEFAULT_HIDDEN_STEM_VARIANT = HiddenStemVariant.STANDARD;
const DEFAULT_HIDDEN_STEM_ALLOCATION = HiddenStemDayAllocation.YEONHAE_JAPYEONG;

export interface HiddenStemResolver {
  resolve(
    branch: Jiji,
    variant?: HiddenStemVariant,
    allocation?: HiddenStemDayAllocation,
  ): readonly HiddenStemEntry[];

  principalStem(
    branch: Jiji,
    variant?: HiddenStemVariant,
    allocation?: HiddenStemDayAllocation,
  ): Cheongan;
}

export class DefaultHiddenStemResolver implements HiddenStemResolver {
  resolve(
    branch: Jiji,
    variant: HiddenStemVariant = DEFAULT_HIDDEN_STEM_VARIANT,
    allocation: HiddenStemDayAllocation = DEFAULT_HIDDEN_STEM_ALLOCATION,
  ): readonly HiddenStemEntry[] {
    return HiddenStemTable.getHiddenStems(branch, variant, allocation);
  }

  principalStem(
    branch: Jiji,
    variant: HiddenStemVariant = DEFAULT_HIDDEN_STEM_VARIANT,
    allocation: HiddenStemDayAllocation = DEFAULT_HIDDEN_STEM_ALLOCATION,
  ): Cheongan {
    return HiddenStemTable.getPrincipalStem(branch, variant, allocation);
  }
}

