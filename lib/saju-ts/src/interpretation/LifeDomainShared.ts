import { Ohaeng, ohaengKoreanLabel } from '../domain/Ohaeng.js';
import { PillarPosition, PILLAR_POSITION_VALUES } from '../domain/PillarPosition.js';
import { Sipseong } from '../domain/Sipseong.js';
import { ShinsalType } from '../domain/Shinsal.js';
import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import type { WeightedShinsalHit } from '../domain/Relations.js';

export interface DomainReading {
  readonly domain: string;
  readonly icon: string;
  readonly overview: string;
  readonly details: readonly string[];
  readonly advice: string;
}

export const WEALTH_STARS = new Set([Sipseong.PYEON_JAE, Sipseong.JEONG_JAE]);
export const OFFICIAL_STARS = new Set([Sipseong.PYEON_GWAN, Sipseong.JEONG_GWAN]);
export const EXPRESSION_STARS = new Set([Sipseong.SIK_SIN, Sipseong.SANG_GWAN]);

export function ohaengKr(oh: Ohaeng): string {
  return ohaengKoreanLabel(oh);
}

export function collectSipseongHits(
  analysis: SajuAnalysis,
  targetSet: ReadonlySet<Sipseong>,
): Array<{ position: PillarPosition; sipseong: Sipseong }> {
  const tga = analysis.tenGodAnalysis;
  if (!tga) return [];
  const hits: Array<{ position: PillarPosition; sipseong: Sipseong }> = [];
  for (const pos of PILLAR_POSITION_VALUES) {
    const pg = tga.byPosition[pos];
    if (!pg) continue;
    if (targetSet.has(pg.cheonganSipseong)) {
      hits.push({ position: pos, sipseong: pg.cheonganSipseong });
    }
    if (targetSet.has(pg.jijiPrincipalSipseong)) {
      hits.push({ position: pos, sipseong: pg.jijiPrincipalSipseong });
    }
  }
  return hits;
}

export function deduplicateByType(
  hits: readonly WeightedShinsalHit[],
  types: ReadonlySet<ShinsalType>,
): WeightedShinsalHit[] {
  const seen = new Set<ShinsalType>();
  return hits.filter(h => {
    if (!types.has(h.hit.type)) return false;
    if (seen.has(h.hit.type)) return false;
    seen.add(h.hit.type);
    return true;
  });
}

type ShinsalNoteTemplate = string | ((hit: WeightedShinsalHit) => string);

export function appendShinsalNotes(
  details: string[],
  hits: readonly WeightedShinsalHit[],
  noteByType: Readonly<Partial<Record<ShinsalType, ShinsalNoteTemplate>>>,
): void {
  for (const hit of hits) {
    const noteTemplate = noteByType[hit.hit.type];
    if (!noteTemplate) continue;
    details.push(typeof noteTemplate === 'function' ? noteTemplate(hit) : noteTemplate);
  }
}
