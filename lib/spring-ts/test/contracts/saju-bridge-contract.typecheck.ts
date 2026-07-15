import type { LegacySajuOutputV1 as UpstreamLegacySajuOutputV1 } from '../../../saju-ts/src/compat/springLegacyContract.js';
import type { LegacySajuOutputV1Contract as DownstreamLegacySajuOutputV1 } from '../../src/saju-bridge-contract.js';

type Assert<T extends true> = T;
type IsAssignable<From, To> = [From] extends [To] ? true : false;

// An upstream rename, removal, or incompatible narrowing must fail this
// dedicated noEmit compilation before the runtime adapter can be released.
type UpstreamSatisfiesDownstream = Assert<
  IsAssignable<UpstreamLegacySajuOutputV1, DownstreamLegacySajuOutputV1>
>;

export type { UpstreamSatisfiesDownstream };
