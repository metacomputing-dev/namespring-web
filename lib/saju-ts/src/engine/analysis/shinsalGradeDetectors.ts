import { PillarSet } from '../../domain/PillarSet.js';
import { ShinsalGrade, ShinsalHit, ShinsalType } from '../../domain/Shinsal.js';
import { GwiiinTableVariant, ShinsalReferenceBranch } from '../../config/CalculationConfig.js';
import { type SamhapGroup } from './ShinsalCatalog.js';
import {
  MUNCHANG_TABLE,
  YANGIN_TABLE,
  HAKDANG_TABLE,
  GEUMYEO_TABLE,
  BAEKHO_TABLE,
  HONGYEOM_TABLE,
  AMNOK_TABLE,
  CHEONGWAN_TABLE,
  MUNGOK_TABLE,
  GUGIN_TABLE,
  CHEONBOK_GWIIN_TABLE,
  HYEOLINSAL_TABLE,
  CHEONJU_GWIIN_TABLE,
  CHEONDEOK_TABLE,
  WOLDEOK_TABLE,
  CHEONDEOK_HAP_TABLE,
  WOLDEOK_HAP_TABLE,
} from './ShinsalCatalog.js';
import {
  detectByStemTable,
  detectSamhapShinsal,
  detectByMonthMixed,
  detectByYearBranchOffset,
} from './shinsalHelpers.js';
import {
  detectCheonulGwiin,
  detectTaegukGwiin,
  detectWonjin,
  detectGoegang,
  detectGosin,
  detectGwasuk,
  detectBokseong,
  detectCheonui,
  detectCheollaJimang,
  detectGyeokgak,
  detectYukhaesal,
  detectGoransal,
} from './shinsalSpecificDetectors.js';

export type DetectorFn = (pillars: PillarSet, hits: ShinsalHit[]) => void;

type StemTable = Parameters<typeof detectByStemTable>[3];
type MonthMixedTable = Parameters<typeof detectByMonthMixed>[3];
type SamhapTargetSelector = (group: SamhapGroup) => ReturnType<Parameters<typeof detectSamhapShinsal>[3]>;

type DetectorSpec =
  | { kind: 'cheonulGwiin' }
  | { kind: 'direct'; detector: DetectorFn }
  | { kind: 'stem'; type: ShinsalType; table: StemTable }
  | { kind: 'monthMixed'; type: ShinsalType; table: MonthMixedTable }
  | { kind: 'samhap'; type: ShinsalType; target: SamhapTargetSelector }
  | { kind: 'yearOffset'; type: ShinsalType; offset: number };

function detectorFromSpec(
  spec: DetectorSpec,
  gwiiinVariant: GwiiinTableVariant,
  refBranch: ShinsalReferenceBranch,
): DetectorFn {
  switch (spec.kind) {
    case 'cheonulGwiin':
      return (pillars, hits) => detectCheonulGwiin(pillars, hits, gwiiinVariant);
    case 'direct':
      return spec.detector;
    case 'stem':
      return (pillars, hits) => detectByStemTable(pillars, hits, spec.type, spec.table);
    case 'monthMixed':
      return (pillars, hits) => detectByMonthMixed(pillars, hits, spec.type, spec.table);
    case 'samhap':
      return (pillars, hits) => detectSamhapShinsal(pillars, hits, spec.type, spec.target, refBranch);
    case 'yearOffset':
      return (pillars, hits) => detectByYearBranchOffset(pillars, hits, spec.type, spec.offset);
  }
}

const GRADE_SPECS = {
  [ShinsalGrade.A]: [
    { kind: 'cheonulGwiin' },
    { kind: 'samhap', type: ShinsalType.YEOKMA, target: (group) => group.yeokma },
    { kind: 'samhap', type: ShinsalType.DOHWA, target: (group) => group.dohwa },
    { kind: 'samhap', type: ShinsalType.HWAGAE, target: (group) => group.hwagae },
    { kind: 'direct', detector: detectTaegukGwiin },
    { kind: 'samhap', type: ShinsalType.JANGSEONG, target: (group) => group.jangseong },
    { kind: 'direct', detector: detectWonjin },
    { kind: 'monthMixed', type: ShinsalType.CHEONDEOK_GWIIN, table: CHEONDEOK_TABLE },
    { kind: 'monthMixed', type: ShinsalType.WOLDEOK_GWIIN, table: WOLDEOK_TABLE },
  ],
  [ShinsalGrade.B]: [
    { kind: 'stem', type: ShinsalType.MUNCHANG, table: MUNCHANG_TABLE },
    { kind: 'stem', type: ShinsalType.YANGIN, table: YANGIN_TABLE },
    { kind: 'direct', detector: detectGoegang },
    { kind: 'stem', type: ShinsalType.HAKDANG, table: HAKDANG_TABLE },
    { kind: 'stem', type: ShinsalType.GEUMYEO, table: GEUMYEO_TABLE },
    { kind: 'samhap', type: ShinsalType.GEOPSAL, target: (group) => group.geopsal },
    { kind: 'direct', detector: detectGosin },
    { kind: 'direct', detector: detectGwasuk },
    { kind: 'monthMixed', type: ShinsalType.CHEONDEOK_HAP, table: CHEONDEOK_HAP_TABLE },
    { kind: 'monthMixed', type: ShinsalType.WOLDEOK_HAP, table: WOLDEOK_HAP_TABLE },
    { kind: 'stem', type: ShinsalType.CHEONGWAN_GWIIN, table: CHEONGWAN_TABLE },
    { kind: 'direct', detector: detectBokseong },
    { kind: 'stem', type: ShinsalType.MUNGOK_GWIIN, table: MUNGOK_TABLE },
    { kind: 'stem', type: ShinsalType.GUGIN_GWIIN, table: GUGIN_TABLE },
  ],
  [ShinsalGrade.C]: [
    { kind: 'stem', type: ShinsalType.BAEKHO, table: BAEKHO_TABLE },
    { kind: 'stem', type: ShinsalType.HONGYEOM, table: HONGYEOM_TABLE },
    { kind: 'stem', type: ShinsalType.AMNOK, table: AMNOK_TABLE },
    { kind: 'direct', detector: detectCheonui },
    { kind: 'direct', detector: detectCheollaJimang },
    { kind: 'samhap', type: ShinsalType.JAESAL, target: (group) => group.jaesal },
    { kind: 'direct', detector: detectGyeokgak },
    { kind: 'stem', type: ShinsalType.CHEONBOK_GWIIN, table: CHEONBOK_GWIIN_TABLE },
    { kind: 'direct', detector: detectYukhaesal },
    { kind: 'stem', type: ShinsalType.HYEOLINSAL, table: HYEOLINSAL_TABLE },
    { kind: 'yearOffset', type: ShinsalType.GWANBUSAL, offset: 5 },
    { kind: 'yearOffset', type: ShinsalType.SANGMUNSAL, offset: 2 },
    { kind: 'samhap', type: ShinsalType.CHEONSAL, target: (group) => group.cheonsal },
    { kind: 'samhap', type: ShinsalType.JISAL, target: (group) => group.jisal },
    { kind: 'samhap', type: ShinsalType.MANGSINSAL, target: (group) => group.mangsin },
    { kind: 'samhap', type: ShinsalType.BANANSAL, target: (group) => group.banan },
    { kind: 'stem', type: ShinsalType.CHEONJU_GWIIN, table: CHEONJU_GWIIN_TABLE },
    { kind: 'direct', detector: detectGoransal },
  ],
} as const satisfies Readonly<Record<ShinsalGrade, readonly DetectorSpec[]>>;

const ALL_GRADES: readonly ShinsalGrade[] = [
  ShinsalGrade.A,
  ShinsalGrade.B,
  ShinsalGrade.C,
];

export function detectorsForGrade(
  grade: ShinsalGrade,
  gwiiinVariant: GwiiinTableVariant,
  refBranch: ShinsalReferenceBranch,
): DetectorFn[] {
  return GRADE_SPECS[grade].map((spec) => detectorFromSpec(spec, gwiiinVariant, refBranch));
}

export function detectorsForScope(
  grade: ShinsalGrade | null,
  gwiiinVariant: GwiiinTableVariant,
  refBranch: ShinsalReferenceBranch,
): DetectorFn[] {
  if (grade !== null) return detectorsForGrade(grade, gwiiinVariant, refBranch);
  return ALL_GRADES.flatMap((gradeValue) => detectorsForGrade(gradeValue, gwiiinVariant, refBranch));
}
