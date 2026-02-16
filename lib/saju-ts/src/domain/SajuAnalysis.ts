import { type SajuPillarResult } from '../engine/SajuCalculator.js';
import { type AnalysisTraceStep, type BirthInput } from './types.js';
import {
  type CheonganRelationHit,
  type HapHwaEvaluation,
  type JijiRelationHit,
  type ResolvedRelation,
  type ScoredCheonganRelation,
  type ShinsalComposite,
  type WeightedShinsalHit,
} from './Relations.js';
import { type GyeokgukResult } from './Gyeokguk.js';
import { type Jiji } from './Jiji.js';
import { type Ohaeng } from './Ohaeng.js';
import { type PillarPosition } from './PillarPosition.js';
import { type PillarSet } from './PillarSet.js';
import { type ShinsalHit } from './Shinsal.js';
import { type SibiUnseong } from './SibiUnseong.js';
import { type StrengthResult } from './StrengthResult.js';
import { type TenGodAnalysis } from './TenGodAnalysis.js';
import { type YongshinResult } from './YongshinResult.js';
import { type DaeunInfo } from './DaeunInfo.js';
import { type PalaceAnalysis } from './Palace.js';
import { type SaeunPillar } from './SaeunInfo.js';

export type { SaeunPillar } from './SaeunInfo.js';

export interface SajuAnalysis {
  readonly coreResult: SajuPillarResult;


  readonly cheonganRelations: readonly CheonganRelationHit[];
  readonly hapHwaEvaluations: readonly HapHwaEvaluation[];
  readonly resolvedJijiRelations: readonly ResolvedRelation[];
  readonly scoredCheonganRelations: readonly ScoredCheonganRelation[];
  readonly sibiUnseong: Map<PillarPosition, SibiUnseong> | null;
  readonly gongmangVoidBranches: readonly [Jiji, Jiji] | null;
  readonly strengthResult: StrengthResult | null;
  readonly yongshinResult: YongshinResult | null;
  readonly gyeokgukResult: GyeokgukResult | null;
  readonly shinsalHits: readonly ShinsalHit[];
  readonly weightedShinsalHits: readonly WeightedShinsalHit[];
  readonly shinsalComposites: readonly ShinsalComposite[];
  readonly palaceAnalysis: Record<PillarPosition, PalaceAnalysis> | null;
  readonly daeunInfo: DaeunInfo | null;
  readonly saeunPillars: readonly SaeunPillar[];
  readonly ohaengDistribution: Map<Ohaeng, number> | null;
  readonly trace: readonly AnalysisTraceStep[];
  readonly tenGodAnalysis: TenGodAnalysis | null;

  readonly analysisResults: ReadonlyMap<string, unknown>;

  readonly pillars: PillarSet;
  readonly input: BirthInput;
  readonly jijiRelations: readonly JijiRelationHit[];
}

export const ANALYSIS_KEYS = {
  STRENGTH: 'strength',
  YONGSHIN: 'yongshin',
  GYEOKGUK: 'gyeokguk',
  SIBI_UNSEONG: 'sibiUnseong',
  GONGMANG: 'gongmang',
  SHINSAL: 'shinsal',
  DAEUN: 'daeun',
  SAEUN: 'saeun',
  CHEONGAN_RELATIONS: 'cheonganRelations',
  HAPWHA: 'hapHwa',
  RESOLVED_JIJI: 'resolvedJijiRelations',
  SCORED_CHEONGAN: 'scoredCheonganRelations',
  WEIGHTED_SHINSAL: 'weightedShinsal',
  SHINSAL_COMPOSITES: 'shinsalComposites',
  PALACE: 'palace',
  TRACE: 'trace',
  OHAENG_DISTRIBUTION: 'ohaengDistribution',
  TEN_GODS: 'tenGods',
  HIDDEN_STEMS: 'hiddenStems',
} as const;

export type AnalysisResultKey = typeof ANALYSIS_KEYS[keyof typeof ANALYSIS_KEYS];

