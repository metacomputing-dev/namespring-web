import sajuScoringConfig from '../../config/saju-scoring.json';
import { emptyDistribution, type ElementKey } from '../core/scoring.js';
import { isScorableSajuSummary } from '../saju-analysis-contract.js';
import type {
  SajuAxisStrengthMap,
  SajuJudgmentStrength,
  SajuOutputSummary,
  SajuPillarPosition,
  SajuSummary,
  SajuTenGodPositionGroup,
} from '../types.js';
import {
  elementFromSajuCode,
  normalizeElementCode,
  normalizeElementCodeList,
} from './element-code.js';
import {
  normalizeGyeokgukCategoryCode,
  normalizeGyeokgukTypeCode,
  normalizeTenGodCode,
  normalizeYongshinTypeCode,
} from './legacy-codec.js';
import {
  clampRatio,
  pointsToRatio,
} from './confidence-units.js';

const TEN_GOD_GROUP: Readonly<Record<string, string>> = sajuScoringConfig.tenGodGroups;

export interface SajuContextBuildOptions {
  readonly includeTenGodByPosition?: boolean;
}

export interface SajuContextBuildResult {
  dist: Record<ElementKey, number>;
  output: SajuOutputSummary | null;
}

/**
 * Build the condensed, score-facing view of an already normalized SajuSummary.
 * Runtime loading, calendar policy, and legacy output extraction intentionally
 * remain outside this pure boundary transformation.
 */
export function buildSajuContext(
  sajuSummary: SajuSummary,
  options: SajuContextBuildOptions = {},
): SajuContextBuildResult {
  const dist = emptyDistribution();
  if (!isScorableSajuSummary(sajuSummary)) return { dist, output: null };

  for (const [code, count] of Object.entries(sajuSummary.elementDistribution)) {
    const key = elementFromSajuCode(code);
    if (key) dist[key] += count;
  }

  const dayMasterKey = elementFromSajuCode(sajuSummary.dayMaster.element);
  const yongshinData = sajuSummary.yongshin;
  const yongshinConsensus = sajuSummary.yongshinConsensus ?? yongshinData.consensus;
  const finalYongshin = normalizeElementCode(yongshinData.element);
  const finalHeesin = normalizeElementCode(yongshinData.heeshin);
  const gisin = normalizeElementCode(yongshinData.gishin);
  const gusin = normalizeElementCode(yongshinData.gushin);

  let tenGod: SajuOutputSummary['tenGod'];
  if (sajuSummary.tenGodAnalysis?.byPosition) {
    const groupCounts: Record<string, number> = {
      friend: 0,
      output: 0,
      wealth: 0,
      authority: 0,
      resource: 0,
    };
    const byPosition: Partial<Record<SajuPillarPosition, SajuTenGodPositionGroup>> = {};

    // Preserve the aggregate pass independently from the canonical-position
    // detail pass so non-canonical legacy entries keep contributing exactly as
    // they did before this boundary was extracted.
    for (const positionInfo of Object.values(sajuSummary.tenGodAnalysis.byPosition)) {
      const stemGroup = TEN_GOD_GROUP[normalizeTenGodCode(positionInfo.cheonganTenGod)];
      const branchGroup = TEN_GOD_GROUP[normalizeTenGodCode(positionInfo.jijiPrincipalTenGod)];
      if (stemGroup) groupCounts[stemGroup]++;
      if (branchGroup) groupCounts[branchGroup]++;
    }

    const canonicalPositions: ReadonlyArray<{
      readonly out: SajuPillarPosition;
      readonly aliases: readonly string[];
    }> = [
      { out: 'year', aliases: ['year', 'YEAR'] },
      { out: 'month', aliases: ['month', 'MONTH'] },
      { out: 'day', aliases: ['day', 'DAY'] },
      { out: 'hour', aliases: ['hour', 'HOUR'] },
    ];
    for (const { out, aliases } of canonicalPositions) {
      const allowedAliases = options.includeTenGodByPosition ? aliases : [out];
      const positionInfo = allowedAliases
        .map((alias) => sajuSummary.tenGodAnalysis?.byPosition[alias])
        .find(Boolean);
      if (!positionInfo) continue;

      const cheonganGroup = TEN_GOD_GROUP[normalizeTenGodCode(positionInfo.cheonganTenGod)];
      const jijiPrincipalGroup = TEN_GOD_GROUP[normalizeTenGodCode(positionInfo.jijiPrincipalTenGod)];

      const hiddenStemTenGodMap = new Map<string, string>();
      for (const hiddenStem of positionInfo.hiddenStemTenGod ?? []) {
        if (hiddenStem.stem) hiddenStemTenGodMap.set(hiddenStem.stem, hiddenStem.tenGod);
      }
      const hiddenStems = (positionInfo.hiddenStems ?? []).map((hiddenStem) => ({
        stem: hiddenStem.stem,
        element: elementFromSajuCode(hiddenStem.element) ?? null,
        ratio: Number(hiddenStem.ratio) || 0,
        group: TEN_GOD_GROUP[normalizeTenGodCode(hiddenStemTenGodMap.get(hiddenStem.stem) ?? '')],
      }));

      byPosition[out] = {
        cheonganGroup,
        jijiPrincipalGroup,
        hiddenStems: hiddenStems.length > 0 ? hiddenStems : undefined,
      };
    }

    tenGod = {
      groupCounts,
      byPosition: Object.keys(byPosition).length > 0
        ? byPosition as Record<SajuPillarPosition, SajuTenGodPositionGroup>
        : undefined,
    };
  }

  return {
    dist,
    output: {
      dayMaster: dayMasterKey ? { element: dayMasterKey } : undefined,
      strength: {
        isStrong: sajuSummary.strength.isStrong,
        totalSupport: sajuSummary.strength.totalSupport,
        totalOppose: sajuSummary.strength.totalOppose,
      },
      yongshin: {
        finalYongshin: finalYongshin ?? String(yongshinData.element ?? ''),
        finalHeesin: finalHeesin ?? null,
        gisin: gisin ?? null,
        gusin: gusin ?? null,
        finalConfidence: pointsToRatio(yongshinData.confidence),
        consensus: yongshinConsensus,
        methodBreakdown: yongshinData.methodBreakdown,
        recommendations: yongshinData.recommendations.map(
          ({ type, primaryElement, secondaryElement, confidence, reasoning }) => ({
            type: normalizeYongshinTypeCode(type),
            primaryElement: normalizeElementCode(primaryElement) ?? String(primaryElement ?? ''),
            secondaryElement: normalizeElementCode(secondaryElement),
            confidence: pointsToRatio(confidence),
            reasoning,
          }),
        ),
      },
      yongshinConsensus,
      tenGod,
      gyeokguk: sajuSummary.gyeokguk?.type ? {
        category: normalizeGyeokgukCategoryCode(sajuSummary.gyeokguk.category ?? ''),
        type: normalizeGyeokgukTypeCode(sajuSummary.gyeokguk.type ?? ''),
        confidence: clampRatio(sajuSummary.gyeokguk.confidence),
        basis: sajuSummary.gyeokguk.basis,
        scores: sajuSummary.gyeokguk.scores,
      } : undefined,
      deficientElements: sajuSummary.deficientElements?.length
        ? normalizeElementCodeList(sajuSummary.deficientElements)
        : undefined,
      excessiveElements: sajuSummary.excessiveElements?.length
        ? normalizeElementCodeList(sajuSummary.excessiveElements)
        : undefined,
      axisStrength: sajuSummary.axisStrength ?? deriveAxisStrength(sajuSummary),
      inputUncertainty: sajuSummary.inputUncertainty,
      jieProximity: sajuSummary.jieProximity,
      cheonganRelations: sajuSummary.cheonganRelations?.length
        ? sajuSummary.cheonganRelations
        : undefined,
      jijiRelations: sajuSummary.jijiRelations?.length
        ? sajuSummary.jijiRelations
        : undefined,
      shinsalHits: sajuSummary.shinsalHits?.length
        ? sajuSummary.shinsalHits
        : undefined,
      gongmang: sajuSummary.gongmang ?? undefined,
      daeunInfo: sajuSummary.daeunInfo ?? undefined,
      saeunPillars: sajuSummary.saeunPillars?.length
        ? sajuSummary.saeunPillars
        : undefined,
      wolunPillars: sajuSummary.wolunPillars?.length
        ? sajuSummary.wolunPillars
        : undefined,
      palace: sajuSummary.palace ?? undefined,
      naeum: sajuSummary.naeum ?? undefined,
    },
  };
}

/** Derive rhetoric-strength tiers from already surfaced engine confidence. */
export function deriveAxisStrength(sajuSummary: SajuSummary): SajuAxisStrengthMap | undefined {
  const out: { -readonly [K in keyof SajuAxisStrengthMap]?: SajuJudgmentStrength } = {};

  const yongshinConfidence = sajuSummary.yongshin?.confidence;
  if (typeof yongshinConfidence === 'number' && Number.isFinite(yongshinConfidence)) {
    out.yongshin = toJudgmentStrength(pointsToRatio(yongshinConfidence));
  }

  const gyeokgukConfidence = sajuSummary.gyeokguk?.confidence;
  if (typeof gyeokgukConfidence === 'number' && Number.isFinite(gyeokgukConfidence)) {
    out.gyeokguk = toJudgmentStrength(clampRatio(gyeokgukConfidence));
  }

  const support = Number(sajuSummary.strength?.totalSupport) || 0;
  const oppose = Number(sajuSummary.strength?.totalOppose) || 0;
  const total = Math.abs(support) + Math.abs(oppose);
  if (total > 0) {
    const lopsidedness = Math.abs(Math.abs(support) - Math.abs(oppose)) / total;
    out.strength = toJudgmentStrength(lopsidedness);
  }

  return Object.keys(out).length > 0 ? (out as SajuAxisStrengthMap) : undefined;
}

function toJudgmentStrength(confidence: number): SajuJudgmentStrength {
  if (confidence >= 0.85) return 'definite';
  if (confidence >= 0.65) return 'practical';
  if (confidence >= 0.45) return 'candidate';
  return 'deferred';
}
