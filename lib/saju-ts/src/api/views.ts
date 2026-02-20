import type {
  BranchView,
  HiddenStemTenGodView,
  HiddenStemView,
  PillarView,
  StemRelationView,
  StemView,
  TenGod,
} from './types.js';
import type { BranchIdx, PillarIdx, StemIdx } from '../core/cycle.js';
import type { HiddenStemRole } from '../core/hiddenStems.js';
import type { StemRelation } from '../core/stemRelations.js';
import {
  branchElement,
  branchHanja,
  branchYinYang,
  stemElement,
  stemHanja,
  stemYinYang,
} from '../core/cycle.js';

export function toStemView(idx: StemIdx): StemView {
  return {
    idx,
    text: stemHanja(idx),
    element: stemElement(idx),
    yinYang: stemYinYang(idx),
  };
}

export function toBranchView(idx: BranchIdx): BranchView {
  return {
    idx,
    text: branchHanja(idx),
    element: branchElement(idx),
    yinYang: branchYinYang(idx),
  };
}

export function toPillarView(pillar: PillarIdx): PillarView {
  return {
    stem: toStemView(pillar.stem),
    branch: toBranchView(pillar.branch),
  };
}

export function toHiddenStemView(h: { stem: StemIdx; role: HiddenStemRole; weight: number }): HiddenStemView {
  return {
    stem: toStemView(h.stem),
    role: h.role,
    weight: h.weight,
  };
}

export function toHiddenStemTenGodView(h: {
  stem: StemIdx;
  role: HiddenStemRole;
  weight: number;
  tenGod: TenGod;
}): HiddenStemTenGodView {
  return {
    stem: toStemView(h.stem),
    role: h.role,
    weight: h.weight,
    tenGod: h.tenGod,
  };
}

export function toStemRelationView(rel: StemRelation): StemRelationView {
  return {
    type: rel.type,
    members: rel.members.map(toStemView),
    resultElement: rel.resultElement,
  };
}
