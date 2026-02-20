import { describe, expect, it } from 'vitest';

import { parseIsoInstant } from './iso.js';

describe('calendar/calTimeAdapter', () => {
  it('does not crash module loading when ./cal is not built (best-effort import)', async () => {
    const mod = await import('./calTimeAdapter.js');
    expect(typeof mod.adjustInstantWithCal).toBe('function');

    const req = { birth: { instant: '2024-01-01T00:00:00+09:00' }, sex: 'M' as const };
    const parsed = parseIsoInstant(req.birth.instant);

    expect(() => mod.adjustInstantWithCal(req, parsed)).toThrow(/optional \.\/cal package/i);
  });
});
