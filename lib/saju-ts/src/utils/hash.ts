export function sha256Hex(input: string): string {
  // Browser-safe deterministic hash (non-cryptographic).
  // We keep a 64-hex output to preserve downstream digest shape.
  let h1 = 0x6a09e667 ^ input.length;
  let h2 = 0xbb67ae85 ^ input.length;
  let h3 = 0x3c6ef372 ^ input.length;
  let h4 = 0xa54ff53a ^ input.length;

  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x85ebca6b);
    h2 = Math.imul(h2 ^ ch, 0xc2b2ae35);
    h3 = Math.imul(h3 ^ ch, 0x27d4eb2f);
    h4 = Math.imul(h4 ^ ch, 0x165667b1);
  }

  h1 ^= h2 >>> 16; h2 ^= h3 >>> 13; h3 ^= h4 >>> 11; h4 ^= h1 >>> 9;
  h1 = Math.imul(h1, 0x9e3779b1); h2 = Math.imul(h2, 0x85ebca6b);
  h3 = Math.imul(h3, 0xc2b2ae35); h4 = Math.imul(h4, 0x27d4eb2f);

  const words = [
    h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0,
    (h1 ^ h3) >>> 0, (h2 ^ h4) >>> 0, (h1 + h2) >>> 0, (h3 + h4) >>> 0,
  ];
  return words.map((w) => w.toString(16).padStart(8, '0')).join('');
}
