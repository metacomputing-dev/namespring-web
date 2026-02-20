import type { SajuRequest } from '../api/types.js';
import { parseIsoInstant, type ParsedInstant } from './iso.js';

export interface NormalizedRequestInternal {
  request: SajuRequest;
  parsed: ParsedInstant;
}

export function normalizeRequest(input: SajuRequest): NormalizedRequestInternal {
  if (!input?.birth?.instant) {
    throw new Error('SajuRequest.birth.instant is required');
  }

  // Do not mutate/shift the caller-provided instant here.
  // Time corrections (e.g., true solar time) are handled in the graph layer via config.calendar.trueSolarTime.
  const parsed = parseIsoInstant(input.birth.instant);

  // Shallow-copy to ensure we don't mutate caller object.
  const request: SajuRequest = {
    birth: {
      instant: input.birth.instant,
      calendar: input.birth.calendar ?? 'gregorian',
    },
    sex: input.sex,
    location: input.location,
    meta: input.meta,
    overrides: input.overrides,
  };

  return { request, parsed };
}
