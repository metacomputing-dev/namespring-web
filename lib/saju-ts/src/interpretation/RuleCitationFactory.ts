import { ClassicalSource } from '../domain/ClassicalSource.js';

import type { RuleCitation } from './RuleCitationRegistry.js';

export function createRegistryCitation(
  sources: ClassicalSource | readonly ClassicalSource[],
  topic: string,
  note: string = '',
  confidence: number = 0,
): RuleCitation {
  return {
    sources: Array.isArray(sources) ? sources : [sources],
    topic,
    note,
    confidence,
  };
}

