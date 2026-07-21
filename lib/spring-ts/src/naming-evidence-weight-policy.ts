import rawPolicy from '../config/naming-evidence-weights.json';
import { deepFreeze } from '../../seed-ts/src/utils/deep-freeze.js';

export type NamingEvidenceSourceId = keyof typeof rawPolicy.narrativeEvidence;
export type NamingEvidenceWeightPresetName = keyof typeof rawPolicy.presetOverrides;

export interface ResolvedNamingEvidenceScoringWeights {
  readonly adaptiveWeights: Readonly<Record<string, number>>;
  readonly yongshinTypeWeights: Readonly<Record<string, number>>;
}

function requireFinite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${path} must be a finite number`);
  }
  return value;
}

function validatePolicy(): void {
  const weights = rawPolicy.adaptiveWeights;
  const baseTotal = weights.balanceBase + weights.yongshinBase
    + weights.strengthFixed + weights.tenGodFixed;
  if (Math.abs(baseTotal - 1) > 1e-9) {
    throw new TypeError(`naming evidence base weights must sum to 1; received ${baseTotal}`);
  }
  for (const [key, value] of Object.entries(weights)) {
    requireFinite(value, `adaptiveWeights.${key}`);
  }
  for (const [key, value] of Object.entries(rawPolicy.yongshinTypeWeights)) {
    requireFinite(value, `yongshinTypeWeights.${key}`);
  }
  for (const presetName of Object.keys(rawPolicy.presetOverrides) as NamingEvidenceWeightPresetName[]) {
    const resolved = resolveWeights(presetName);
    const presetTotal = resolved.adaptiveWeights.balanceBase
      + resolved.adaptiveWeights.yongshinBase
      + resolved.adaptiveWeights.strengthFixed
      + resolved.adaptiveWeights.tenGodFixed;
    if (Math.abs(presetTotal - 1) > 1e-9) {
      throw new TypeError(`presetOverrides.${presetName} base weights must sum to 1; received ${presetTotal}`);
    }
  }
  const expectedMaximums: Readonly<Record<NamingEvidenceSourceId, number>> = {
    balance: weights.balanceMax * 100,
    yongshin: weights.yongshinMax * 100,
    strength: weights.strengthFixed * 100,
    tenGod: weights.tenGodFixed * 100,
    deficiency: rawPolicy.bonuses.deficiencyMaximum,
    harmfulElement: rawPolicy.yongshinScoring.penalties.gusinMultiplier,
    gyeokgukProtection: rawPolicy.penalties.gyeokgukMaximum,
  };
  for (const [sourceId, source] of Object.entries(rawPolicy.narrativeEvidence)) {
    if (!source.label.trim() || source.states.length === 0) {
      throw new TypeError(`narrativeEvidence.${sourceId} requires a label and states`);
    }
    const expected = expectedMaximums[sourceId as NamingEvidenceSourceId];
    if (Math.abs(source.maxScoreImpact - expected) > 1e-9) {
      throw new TypeError(`narrativeEvidence.${sourceId}.maxScoreImpact must equal ${expected}`);
    }
  }
}

function resolveWeights(presetName?: NamingEvidenceWeightPresetName): ResolvedNamingEvidenceScoringWeights {
  const override = presetName ? rawPolicy.presetOverrides[presetName] : null;
  return {
    adaptiveWeights: { ...rawPolicy.adaptiveWeights, ...override?.adaptiveWeights },
    yongshinTypeWeights: { ...rawPolicy.yongshinTypeWeights, ...override?.yongshinTypeWeights },
  };
}

validatePolicy();

export const NAMING_EVIDENCE_WEIGHT_POLICY = deepFreeze(rawPolicy);

export function resolveNamingEvidenceScoringWeights(
  presetName?: NamingEvidenceWeightPresetName,
): ResolvedNamingEvidenceScoringWeights {
  return deepFreeze(resolveWeights(presetName));
}

export function namingEvidenceWeightPolicyForPrompt(): Readonly<Record<string, unknown>> {
  return NAMING_EVIDENCE_WEIGHT_POLICY;
}
