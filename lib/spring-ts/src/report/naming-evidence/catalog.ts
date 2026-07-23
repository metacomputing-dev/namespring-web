import {
  NAMING_EVIDENCE_CATALOG_SCHEMA_VERSION,
  type NamingEvidenceCatalog,
} from './types.js';

/**
 * Deliberately empty until the reviewed evidence-text database is generated.
 * Planning remains usable and rendering reports content_missing instead of
 * silently inventing fallback copy.
 */
export const EMPTY_NAMING_EVIDENCE_CATALOG: NamingEvidenceCatalog = Object.freeze({
  schemaVersion: NAMING_EVIDENCE_CATALOG_SCHEMA_VERSION,
  contentVersion: 'unpopulated',
  fragments: Object.freeze({}),
  connectors: Object.freeze({}),
});
