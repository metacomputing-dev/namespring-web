import { Cheongan } from '../../domain/Cheongan.js';
import { Ohaeng } from '../../domain/Ohaeng.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { CheonganRelationHit, CheonganRelationType } from '../../domain/Relations.js';

export class CheonganRelationAnalyzer {
    analyze(pillars: PillarSet): CheonganRelationHit[] {
    const stems: Cheongan[] = [
      pillars.year.cheongan,
      pillars.month.cheongan,
      pillars.day.cheongan,
      pillars.hour.cheongan,
    ];

    const hits: CheonganRelationHit[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < stems.length; i++) {
      for (let j = i + 1; j < stems.length; j++) {
        const a = stems[i]!;
        const b = stems[j]!;
        if (a === b) continue;

        const pairKey = [a, b].sort().join('-');

        const hapEntry = hapTableLookup(a, b);
        if (hapEntry !== undefined) {
          const key = `HAP|${pairKey}`;
          if (!seen.has(key)) {
            seen.add(key);
            hits.push({
              type: CheonganRelationType.HAP,
              members: new Set([a, b]),
              resultOhaeng: hapEntry.resultOhaeng,
              note: hapEntry.note,
            });
          }
        }

        const chungNote = chungTableLookup(a, b);
        if (chungNote !== undefined) {
          const key = `CHUNG|${pairKey}`;
          if (!seen.has(key)) {
            seen.add(key);
            hits.push({
              type: CheonganRelationType.CHUNG,
              members: new Set([a, b]),
              resultOhaeng: null,
              note: chungNote,
            });
          }
        }
      }
    }

    return hits;
  }
}


interface HapEntry {
  readonly resultOhaeng: Ohaeng;
  readonly note: string;
}

const HAP_TABLE: ReadonlyMap<string, HapEntry> = new Map<string, HapEntry>([
  [pairKey(Cheongan.GAP, Cheongan.GI),     { resultOhaeng: Ohaeng.EARTH, note: '갑기합화토' }],
  [pairKey(Cheongan.EUL, Cheongan.GYEONG), { resultOhaeng: Ohaeng.METAL, note: '을경합화금' }],
  [pairKey(Cheongan.BYEONG, Cheongan.SIN), { resultOhaeng: Ohaeng.WATER, note: '병신합화수' }],
  [pairKey(Cheongan.JEONG, Cheongan.IM),   { resultOhaeng: Ohaeng.WOOD,  note: '정임합화목' }],
  [pairKey(Cheongan.MU, Cheongan.GYE),     { resultOhaeng: Ohaeng.FIRE,  note: '무계합화화' }],
]);

const CHUNG_TABLE: ReadonlyMap<string, string> = new Map<string, string>([
  [pairKey(Cheongan.GAP, Cheongan.GYEONG), '갑경충'],
  [pairKey(Cheongan.EUL, Cheongan.SIN),    '을신충'],
  [pairKey(Cheongan.BYEONG, Cheongan.IM),  '병임충'],
  [pairKey(Cheongan.JEONG, Cheongan.GYE),  '정계충'],
]);

function pairKey(a: Cheongan, b: Cheongan): string {
  return [a, b].sort().join('-');
}

function hapTableLookup(a: Cheongan, b: Cheongan): HapEntry | undefined {
  return HAP_TABLE.get(pairKey(a, b));
}

function chungTableLookup(a: Cheongan, b: Cheongan): string | undefined {
  return CHUNG_TABLE.get(pairKey(a, b));
}

