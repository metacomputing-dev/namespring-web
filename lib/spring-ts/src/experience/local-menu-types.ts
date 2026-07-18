import type { HanjaEntry } from '../../../seed-ts/src/database/hanja-repository.js';
import type { NameCharInput } from '../types.js';
import type { NatalEvidenceReasonCodeV1 } from '../natal-evidence.js';
import type { LocalReportOptionsV1 } from '../report/delivery/types.js';

export const LOCAL_ANALYSIS_CONTEXT_SCHEMA_V1 =
  'spring-ts.local-analysis-context.v1' as const;
export const LOCAL_BIRTH_PREVIEW_SCHEMA_V1 =
  'spring-ts.local-birth-preview.v1' as const;
export const LOCAL_HOME_SUMMARY_SCHEMA_V1 =
  'spring-ts.local-home-summary.v1' as const;
export const LOCAL_HANJA_LOOKUP_REQUEST_SCHEMA_V1 =
  'spring-ts.local-hanja-lookup-request.v1' as const;
export const LOCAL_HANJA_LOOKUP_SCHEMA_V1 =
  'spring-ts.local-hanja-lookup.v1' as const;
export const LOCAL_SHARE_EXPORT_SCHEMA_V1 =
  'spring-ts.local-share-export.v1' as const;

export const LOCAL_CONTEXT_ID_PATTERN_V1 = /^local_context_v1_[0-9a-f]{32}$/u;
export const LOCAL_SHARE_EXPORT_ID_PATTERN_V1 = /^local_export_v1_[0-9a-f]{32}$/u;
export const MAX_LOCAL_HANJA_PAGE_SIZE_V1 = 50;

/** Closed birth input for local product surfaces. Calendar, leap-month state,
 * time precision, and gender are all explicit; no product default is implied. */
export interface LocalBirthInputV1 {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number | null;
  readonly minute: number | null;
  readonly gender: 'male' | 'female' | 'neutral';
  readonly calendarType: 'solar' | 'lunar';
  readonly isLeapMonth: boolean;
  readonly region?: string;
  readonly city?: string;
  readonly birthPlace?: string;
  readonly timezone?: string;
  readonly latitude?: number;
  readonly longitude?: number;
}

export type LocalAnalysisNameCharacterV1 = Pick<NameCharInput, 'hangul' | 'hanja'>;
export type LocalAnalysisOptionsV1 = LocalReportOptionsV1;

export interface LocalAnalysisContextInputV1 {
  readonly birth: LocalBirthInputV1;
  readonly surname: readonly LocalAnalysisNameCharacterV1[];
  readonly givenName?: readonly LocalAnalysisNameCharacterV1[];
  readonly options?: LocalAnalysisOptionsV1;
}

/** Caller-owned personal data stays inside this device-session object. The
 * opaque context ID is random and is not derived from name or birth input. */
export interface LocalAnalysisContextV1 {
  readonly schemaVersion: typeof LOCAL_ANALYSIS_CONTEXT_SCHEMA_V1;
  readonly contextId: string;
  readonly scope: 'device_session';
  readonly computation: 'local_only';
  readonly birth: LocalBirthInputV1;
  readonly name: {
    readonly surname: readonly LocalAnalysisNameCharacterV1[];
    readonly givenName?: readonly LocalAnalysisNameCharacterV1[];
  };
  readonly options?: LocalAnalysisOptionsV1;
  readonly privacy: {
    readonly containsPersonalData: true;
    readonly urlEmbedding: 'forbidden';
    readonly serverTransfer: 'premium_registration_only';
  };
}

export interface LocalBirthPreviewV1 {
  readonly schemaVersion: typeof LOCAL_BIRTH_PREVIEW_SCHEMA_V1;
  readonly computation: 'local_only';
  readonly calendar: {
    readonly inputType: 'solar' | 'lunar';
    readonly inputDate: string;
    readonly isLeapMonth: boolean;
    readonly solarEquivalent?: string;
    readonly conversion: 'not_required' | 'builtin_korean_lunar_calendar';
  };
  readonly time: {
    readonly precision: 'exact' | 'unknown';
    readonly hour?: number;
    readonly minute?: number;
  };
  readonly gender: LocalBirthInputV1['gender'];
  readonly location:
    | { readonly status: 'not_provided' }
    | {
        readonly status: 'provided';
        readonly region?: string;
        readonly city?: string;
        readonly birthPlace?: string;
        readonly timezone?: string;
        readonly latitude?: number;
        readonly longitude?: number;
      };
  readonly constraints: {
    readonly timeSensitiveAnalysis: 'available' | 'limited_unknown_time';
    readonly genderDependentFortune:
      | 'available'
      | 'unavailable_without_explicit_gender_basis';
  };
  readonly provenance: {
    readonly input: 'user_supplied';
    readonly lunarConversion: 'builtin_only';
    readonly remoteLookup: 'forbidden';
  };
}

export type LocalHomeAvailabilityReasonV1 =
  | NatalEvidenceReasonCodeV1
  | 'CORE_NATAL_FACTS_UNAVAILABLE';

export interface LocalHomeAvailabilityV1 {
  readonly status: 'ready' | 'limited' | 'unavailable';
  readonly reasonCodes: readonly LocalHomeAvailabilityReasonV1[];
}

export type LocalFiveElementIdV1 = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

export interface LocalHomeCoreFactsV1 {
  readonly pillars: readonly {
    readonly position: 'year' | 'month' | 'day' | 'hour';
    readonly stem: { readonly code: string; readonly hangul: string; readonly hanja: string };
    readonly branch: { readonly code: string; readonly hangul: string; readonly hanja: string };
  }[];
  readonly dayMaster: {
    readonly stem: string;
    readonly element: LocalFiveElementIdV1;
    readonly polarity: 'yin' | 'yang';
  };
  readonly elementDistribution: readonly {
    readonly element: LocalFiveElementIdV1;
    readonly sharePercent: number;
  }[];
}

export type LocalHomeCapabilityIdV1 =
  | 'birth_preview'
  | 'integrated_report'
  | 'saju_report'
  | 'naming_report'
  | 'candidate_search'
  | 'hanja_lookup'
  | 'share_export'
  | 'premium_story_entry';

export type LocalHomeUtilityCapabilityV1 =
  | {
      readonly id: 'birth_preview';
      readonly execution: 'local_device';
      readonly contract: typeof LOCAL_BIRTH_PREVIEW_SCHEMA_V1;
    }
  | {
      readonly id: 'candidate_search';
      readonly execution: 'local_device';
      readonly contract: 'spring-ts.candidate-search.v1';
    }
  | {
      readonly id: 'hanja_lookup';
      readonly execution: 'local_device';
      readonly contract: typeof LOCAL_HANJA_LOOKUP_SCHEMA_V1;
    }
  | {
      readonly id: 'share_export';
      readonly execution: 'local_device';
      readonly contract: typeof LOCAL_SHARE_EXPORT_SCHEMA_V1;
    };

export type LocalHomeReportCapabilityV1 =
  | {
      readonly id: 'integrated_report';
      readonly execution: 'local_device';
      readonly contract: 'spring-ts.report-delivery.v1';
      readonly requestHint: { readonly surface: 'integrated'; readonly depth: 'standard' };
    }
  | {
      readonly id: 'saju_report';
      readonly execution: 'local_device';
      readonly contract: 'spring-ts.report-delivery.v1';
      readonly requestHint: { readonly surface: 'saju'; readonly depth: 'expert' };
    }
  | {
      readonly id: 'naming_report';
      readonly execution: 'local_device';
      readonly contract: 'spring-ts.report-delivery.v1';
      readonly requestHint: { readonly surface: 'naming'; readonly depth: 'expert' };
    };

export interface LocalHomePremiumStoryCapabilityV1 {
  readonly id: 'premium_story_entry';
  readonly execution: 'server_after_explicit_intent';
  readonly contract: 'namespring.service-catalog.v1';
  readonly catalog: 'not_prefetched';
  readonly productId: 'report.story-completion.v1';
}

export type LocalHomeCapabilityV1 =
  | LocalHomeUtilityCapabilityV1
  | LocalHomeReportCapabilityV1
  | LocalHomePremiumStoryCapabilityV1;

/** Small home projection from a natal SajuSummary. Capability hints may name a
 * report surface, but the DTO contains no report payload, narrative bundle,
 * price, catalog result, or entitlement state. */
export interface LocalHomeSummaryV1 {
  readonly schemaVersion: typeof LOCAL_HOME_SUMMARY_SCHEMA_V1;
  readonly contextId: string;
  readonly computation: {
    readonly execution: 'local_only';
    readonly source: 'SpringEngine.getSajuReport';
    readonly scope: 'natal_preview';
    readonly fullReportComputed: false;
    readonly remoteLookup: 'forbidden';
    readonly natalSaju: 'birth_derived_invariant';
  };
  readonly birthPreview: LocalBirthPreviewV1;
  readonly availability: LocalHomeAvailabilityV1;
  readonly facts: LocalHomeCoreFactsV1 | null;
  readonly capabilities: readonly LocalHomeCapabilityV1[];
}

export interface LocalHanjaLookupRequestV1 {
  readonly schemaVersion: typeof LOCAL_HANJA_LOOKUP_REQUEST_SCHEMA_V1;
  readonly reading: string;
  readonly role: 'surname' | 'given_name';
  readonly offset?: number;
  readonly limit?: number;
}

export interface LocalHanjaLookupItemV1 {
  readonly hangul: string;
  readonly hanja: string;
  readonly meaning: string;
  readonly strokes: number;
  readonly strokeElement: string;
  readonly resourceElement: string;
  readonly radical: string;
  readonly isSurname: boolean;
  readonly legal: {
    readonly status: 'registrable';
    readonly exactGlyphReadingPair: true;
  };
}

export interface LocalHanjaLookupV1 {
  readonly schemaVersion: typeof LOCAL_HANJA_LOOKUP_SCHEMA_V1;
  readonly computation: 'local_only';
  readonly request: {
    readonly reading: string;
    readonly role: LocalHanjaLookupRequestV1['role'];
  };
  readonly ordering: {
    readonly policy: 'strokes_codepoint_id.v1';
    readonly authority: 'spring-ts';
    readonly clientInstruction: 'preserve_order';
  };
  readonly pagination: {
    readonly offset: number;
    readonly requestedLimit: number;
    readonly returnedCount: number;
    readonly totalAvailable: number;
    readonly hasMore: boolean;
  };
  readonly provenance: {
    readonly metadataSource: 'seed-ts.HanjaRepository';
    readonly databaseSha256: string;
    readonly schemaContractSha256: string;
    readonly legalAuthority: 'pinned_korean_court_lookup_snapshot';
    readonly legalValidation: 'exact_glyph_reading_pair';
    readonly expectedLegalGlyphCount: number;
    readonly expectedLegalReadingPairCount: number;
    readonly remoteLookup: 'forbidden';
  };
  readonly items: readonly LocalHanjaLookupItemV1[];
}

export interface LocalShareExportV1 {
  readonly schemaVersion: typeof LOCAL_SHARE_EXPORT_SCHEMA_V1;
  readonly exportId: string;
  readonly createdAt: string;
  readonly transport: 'native_share_or_file';
  readonly privacy: {
    readonly directIdentifiers: 'omitted';
    readonly birthInput: 'omitted';
    readonly sourceContextId: 'omitted';
    readonly urlEmbedding: 'forbidden';
  };
  readonly source: {
    readonly schemaVersion: typeof LOCAL_HOME_SUMMARY_SCHEMA_V1;
    readonly computation: 'local_only';
  };
  readonly summary: {
    readonly availability: LocalHomeAvailabilityV1;
    readonly dayMaster?: LocalHomeCoreFactsV1['dayMaster'];
    readonly elementDistribution?: LocalHomeCoreFactsV1['elementDistribution'];
  };
}

export type LocalMenuContractReasonV1 =
  | 'INVALID_SHAPE'
  | 'UNKNOWN_FIELD'
  | 'INVALID_BIRTH'
  | 'INVALID_NAME'
  | 'INVALID_OPTIONS'
  | 'REMOTE_COMPUTATION_FORBIDDEN'
  | 'SECURE_RANDOM_UNAVAILABLE'
  | 'SPRING_ENGINE_REQUIRED'
  | 'CORE_NATAL_FACTS_INVALID'
  | 'INVALID_HANJA_REQUEST'
  | 'HANJA_REPOSITORY_REQUIRED'
  | 'HANJA_REPOSITORY_UNAVAILABLE'
  | 'HANJA_SOURCE_LIMIT_EXCEEDED'
  | 'HANJA_SOURCE_ROW_INVALID'
  | 'HANJA_LEGAL_AUTHORITY_MISMATCH'
  | 'DUPLICATE_HANJA_ENTRY'
  | 'PAGINATION_OUT_OF_RANGE'
  | 'CONTRACT_INVALID';

export class LocalMenuContractErrorV1 extends Error {
  readonly code = 'LOCAL_MENU_CONTRACT_INVALID' as const;

  constructor(
    readonly reason: LocalMenuContractReasonV1,
    options?: ErrorOptions,
  ) {
    super(`Invalid local menu contract: ${reason}.`, options);
    this.name = 'LocalMenuContractErrorV1';
  }
}

/** Input alias used by the builder; rows must originate from an initialized,
 * integrity-checked local HanjaRepository. */
export type LocalHanjaRepositoryEntryV1 = HanjaEntry;
