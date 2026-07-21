import { REPORT_DELIVERY_SCHEMA_V1 } from '../report/delivery/types.js';
import {
  SERVICE_CATALOG_SCHEMA_V1,
  STORY_COMPLETION_PRODUCT_ID_V1,
} from '../report/premium/types.js';
import {
  LOCAL_BIRTH_PREVIEW_SCHEMA_V1,
  LOCAL_HANJA_LOOKUP_SCHEMA_V1,
  LOCAL_SHARE_EXPORT_SCHEMA_V1,
  type LocalHomeCapabilityV1,
} from './local-menu-types.js';

/**
 * Static navigation contract for the pre-engine home shell.
 *
 * This module intentionally imports no engine, database, repository, or saju
 * implementation. Prices and entitlement state remain server-owned and are
 * fetched only after explicit premium intent.
 */
export const LOCAL_HOME_CAPABILITIES_V1 = Object.freeze([
  Object.freeze({
    id: 'birth_preview',
    execution: 'local_device',
    contract: LOCAL_BIRTH_PREVIEW_SCHEMA_V1,
  }),
  Object.freeze({
    id: 'integrated_report',
    execution: 'local_device',
    contract: REPORT_DELIVERY_SCHEMA_V1,
    requestHint: Object.freeze({ surface: 'integrated', depth: 'standard' }),
  }),
  Object.freeze({
    id: 'saju_report',
    execution: 'local_device',
    contract: REPORT_DELIVERY_SCHEMA_V1,
    requestHint: Object.freeze({ surface: 'saju', depth: 'expert' }),
  }),
  Object.freeze({
    id: 'naming_report',
    execution: 'local_device',
    contract: REPORT_DELIVERY_SCHEMA_V1,
    requestHint: Object.freeze({ surface: 'naming', depth: 'expert' }),
  }),
  Object.freeze({
    id: 'candidate_search',
    execution: 'local_device',
    contract: 'spring-ts.candidate-search.v1',
  }),
  Object.freeze({
    id: 'hanja_lookup',
    execution: 'local_device',
    contract: LOCAL_HANJA_LOOKUP_SCHEMA_V1,
  }),
  Object.freeze({
    id: 'share_export',
    execution: 'local_device',
    contract: LOCAL_SHARE_EXPORT_SCHEMA_V1,
  }),
  Object.freeze({
    id: 'premium_story_entry',
    execution: 'server_after_explicit_intent',
    contract: SERVICE_CATALOG_SCHEMA_V1,
    catalog: 'not_prefetched',
    productId: STORY_COMPLETION_PRODUCT_ID_V1,
  }),
] as const satisfies readonly LocalHomeCapabilityV1[]);
