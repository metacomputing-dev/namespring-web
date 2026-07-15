import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AUTHORITY_SCOPES,
  isAuthorityTruthEligible as isAuthorityTruthEligibleByPolicy,
} from '../source_tier_policy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');

export { AUTHORITY_SCOPES };

function isAuthorityTruthEligible(record, requiredScope) {
  return isAuthorityTruthEligibleByPolicy(record, {
    root: SPRING_TS_ROOT,
    requiredScope,
  });
}

export function authorityTruthForScope(record, requiredScope, options = {}) {
  const resolver = options.authorityEligibility ?? isAuthorityTruthEligible;
  return resolver(record, requiredScope) ? record : null;
}
