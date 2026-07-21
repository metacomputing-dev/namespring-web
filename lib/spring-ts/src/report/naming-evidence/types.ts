import type { SpringReport } from '../../types.js';
import type { NamingScoreBand } from '../../naming-score-axis-policy.js';

export const NAMING_EVIDENCE_SCHEMA_VERSION = 'namespring.naming-evidence/v1' as const;
export const NAMING_EVIDENCE_CATALOG_SCHEMA_VERSION = 'namespring.naming-evidence-catalog/v1' as const;

export type NamingEvidenceSectionId = 'sajuFit' | 'namingStructure' | 'pronunciation';
export type NamingEvidenceAvailability = 'ready' | 'limited' | 'content_missing' | 'not_applicable';
export type NamingEvidenceSlot = 'state' | 'summary' | 'detail' | 'conclusion';
export type NamingEvidenceRelation = 'supports' | 'limits' | 'counterbalances' | 'neutral';
export type NamingEvidenceRole = 'summary' | 'detail';
export type NamingEvidenceConclusionTone =
  | 'allPositive'
  | 'mostlyPositive'
  | 'mixedButUsable'
  | 'needsCaution'
  | 'insufficientEvidence';

export type NamingEvidenceElement = 'WOOD' | 'FIRE' | 'EARTH' | 'METAL' | 'WATER';
export type NamingEvidenceStrength = 'weak' | 'balanced' | 'strong';
export type NamingEvidenceGyeokgukFamily =
  | 'inseong'
  | 'siksang'
  | 'jaeseong'
  | 'gwanseong'
  | 'bigeop'
  | 'special';

export interface NamingEvidenceSajuAxes {
  readonly dayMasterElement: NamingEvidenceElement;
  readonly strength: NamingEvidenceStrength;
  readonly yongshinElement: NamingEvidenceElement;
  readonly gyeokgukFamily: NamingEvidenceGyeokgukFamily;
}

/**
 * The four saju axes are already normalized by the engine integration layer.
 * Text planning never guesses or substitutes an UNKNOWN axis.
 */
export interface NamingEvidenceReportInput {
  readonly springReport: Pick<SpringReport, 'scoreVector' | 'namingReport'>;
  readonly sajuAxes: NamingEvidenceSajuAxes;
}

export type NamingEvidenceScoreAxis =
  | 'sajuFit'
  | 'yongshinFit'
  | 'elementBalance'
  | 'namingStructure'
  | 'hangulStructure'
  | 'hanjaStructure'
  | 'fourFrameLuck'
  | 'fourFrameElement'
  | 'phonetic'
  | 'familyFit';

export type NamingEvidenceSajuScoreAxis = 'sajuFit' | 'yongshinFit' | 'elementBalance';

export interface NamingEvidenceSampleCase extends NamingEvidenceSajuAxes {
  readonly caseId: string;
  readonly name: string;
  readonly sajuFit: number;
  readonly yongshinFit: number;
  readonly elementBalance: number;
}

export interface NamingEvidenceMetric {
  readonly sourcePath: string;
  readonly value: number;
}

export interface NamingEvidenceScoreFact {
  readonly kind: 'score';
  readonly axis: NamingEvidenceScoreAxis;
  readonly role: NamingEvidenceRole;
  readonly sourcePath: string;
  readonly value: number;
  readonly band: NamingScoreBand;
  readonly metrics: readonly NamingEvidenceMetric[];
}

export interface NamingEvidenceSajuFact {
  readonly kind: 'sajuAxes';
  readonly sourcePath: 'sajuAxes';
  readonly value: NamingEvidenceSajuAxes;
}

export type NamingEvidenceFact = NamingEvidenceScoreFact | NamingEvidenceSajuFact;

export interface NamingEvidenceFragmentRef {
  readonly key: string;
  readonly slot: NamingEvidenceSlot;
  readonly relation: NamingEvidenceRelation | null;
  readonly facts: readonly NamingEvidenceFact[];
}

export interface NamingEvidenceSectionPlan {
  readonly id: NamingEvidenceSectionId;
  readonly title: string;
  readonly availability: 'planned' | 'not_applicable';
  readonly verdict: NamingScoreBand | null;
  readonly conclusionTone: NamingEvidenceConclusionTone | null;
  readonly fragments: readonly NamingEvidenceFragmentRef[];
  readonly facts: readonly NamingEvidenceFact[];
}

export interface NamingEvidencePlan {
  readonly schemaVersion: typeof NAMING_EVIDENCE_SCHEMA_VERSION;
  readonly name: string;
  readonly sections: readonly NamingEvidenceSectionPlan[];
}

export interface NamingEvidenceFragment {
  readonly key: string;
  readonly sectionId: NamingEvidenceSectionId;
  readonly slot: NamingEvidenceSlot;
  readonly plain: string;
  readonly detail: string;
}

export interface NamingEvidenceCatalog {
  readonly schemaVersion: typeof NAMING_EVIDENCE_CATALOG_SCHEMA_VERSION;
  readonly contentVersion: string;
  readonly fragments: Readonly<Record<string, NamingEvidenceFragment>>;
  readonly connectors: Partial<Record<NamingEvidenceRelation, readonly string[]>>;
}

export interface NamingEvidenceTextBlock {
  readonly id: NamingEvidenceSectionId;
  readonly title: string;
  readonly plain: string;
  readonly detail: string;
  readonly availability: NamingEvidenceAvailability;
  readonly verdict: NamingScoreBand | null;
  readonly conclusionTone: NamingEvidenceConclusionTone | null;
  readonly facts: readonly NamingEvidenceFact[];
  readonly fragmentKeys: readonly string[];
  readonly renderedFragmentKeys: readonly string[];
  readonly missingFragmentKeys: readonly string[];
}

export interface NamingEvidenceReport {
  readonly schemaVersion: typeof NAMING_EVIDENCE_SCHEMA_VERSION;
  readonly contentVersion: string;
  readonly name: string;
  readonly sections: readonly NamingEvidenceTextBlock[];
}

export const NAMING_EVIDENCE_CONTRACT_INVALID = 'NAMING_EVIDENCE_CONTRACT_INVALID' as const;

export class NamingEvidenceContractError extends TypeError {
  readonly code = NAMING_EVIDENCE_CONTRACT_INVALID;

  constructor(readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'NamingEvidenceContractError';
  }
}
