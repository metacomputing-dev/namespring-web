import { Cheongan } from '../../domain/Cheongan.js';
import { Gender } from '../../domain/Gender.js';
import {
  FamilyRelation,
  PalaceAnalysis,
  PalaceInfo,
  PalaceInterpretation,
} from '../../domain/Palace.js';
import { PillarPosition, PILLAR_POSITION_VALUES } from '../../domain/PillarPosition.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { Sipseong } from '../../domain/Sipseong.js';
import { TenGodCalculator } from './TenGodCalculator.js';
import {
  familyMember as catalogFamilyMember,
  familyRelation as catalogFamilyRelation,
  interpretation as catalogInterpretation,
  palaceInfo as catalogPalaceInfo,
} from './PalaceCatalogData.js';




export const PalaceAnalyzer = {
    palaceInfo: catalogPalaceInfo as (position: PillarPosition) => PalaceInfo,

    familyRelation: catalogFamilyRelation as (sipseong: Sipseong, gender: Gender) => FamilyRelation,

    familyMember: catalogFamilyMember as (sipseong: Sipseong, gender: Gender) => string,

    interpret: catalogInterpretation as (sipseong: Sipseong, position: PillarPosition) => PalaceInterpretation | null,

    analyze(
    pillars: PillarSet,
    dayMaster: Cheongan,
    gender: Gender,
  ): Record<PillarPosition, PalaceAnalysis> {
    const pillarByPosition = {
      [PillarPosition.YEAR]: pillars.year,
      [PillarPosition.MONTH]: pillars.month,
      [PillarPosition.DAY]: pillars.day,
      [PillarPosition.HOUR]: pillars.hour,
    };

    const result = {} as Record<PillarPosition, PalaceAnalysis>;

    for (const position of PILLAR_POSITION_VALUES) {
      const palace = catalogPalaceInfo(position);
      const pillar = pillarByPosition[position];

      if (position === PillarPosition.DAY) {
        result[position] = {
          palaceInfo: palace,
          sipseong: null,
          familyRelation: null,
          interpretation: null,
        };
      } else {
        const sipseong = TenGodCalculator.calculate(dayMaster, pillar.cheongan);
        result[position] = {
          palaceInfo: palace,
          sipseong,
          familyRelation: catalogFamilyRelation(sipseong, gender),
          interpretation: catalogInterpretation(sipseong, position),
        };
      }
    }

    return result;
  },
} as const;

