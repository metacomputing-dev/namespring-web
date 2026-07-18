/**
 * Mobile/browser home-shell entry.
 *
 * New frontends should import this file for LCP-time birth preview and menu
 * metadata. It deliberately excludes SpringEngine, saju adapters, SQL/WASM,
 * and every repository. Load `local-menu` or `SpringEngine` only after the user
 * enters an analysis/search flow, preferably inside a long-lived Worker.
 */
export {
  assertLocalBirthInputV1,
  assertLocalBirthPreviewV1,
  buildLocalBirthPreviewV1,
} from './local-birth-preview.js';
export { LOCAL_HOME_CAPABILITIES_V1 } from './local-home-capabilities.js';
export {
  LOCAL_BIRTH_PREVIEW_SCHEMA_V1,
  type LocalBirthInputV1,
  type LocalBirthPreviewV1,
  type LocalHomeCapabilityV1,
} from './local-menu-types.js';
