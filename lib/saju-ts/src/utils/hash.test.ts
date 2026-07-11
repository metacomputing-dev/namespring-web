import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { sha256Hex } from './hash.js';

function nodeSha256(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}

describe('sha256Hex', () => {
  it('matches the empty-string and abc standard vectors', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb924' +
      '27ae41e4649b934ca495991b7852b855',
    );
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223' +
      'b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('hashes Unicode strings as UTF-8 bytes', () => {
    for (const value of ['��', '{P', 'four-pillars��B']) {
      expect(sha256Hex(value)).toBe(nodeSha256(value));
    }
  });

  it('hashes exact bytes without text transcoding', () => {
    const bytes = Uint8Array.from([0x00, 0xff, 0x80, 0x01, 0x7f]);
    expect(sha256Hex(bytes)).toBe(nodeSha256(bytes));
  });
});
