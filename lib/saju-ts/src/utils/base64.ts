/**
 * Minimal base64 helpers for both Node and browser-ish runtimes.
 *
 * - In Node: uses Buffer.
 * - In browsers: falls back to btoa/atob with chunking.
 */

export function toBase64(bytes: Uint8Array): string {
  // Node (and many bundlers) provide Buffer.
  const B: any = (globalThis as any).Buffer;
  if (typeof B?.from === 'function') return B.from(bytes).toString('base64');

  // Browser fallback.
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...sub);
  }
  // eslint-disable-next-line no-undef
  return btoa(binary);
}

export function fromBase64(b64: string): Uint8Array {
  const B: any = (globalThis as any).Buffer;
  if (typeof B?.from === 'function') return new Uint8Array(B.from(b64, 'base64'));

  // eslint-disable-next-line no-undef
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i) & 0xff;
  return out;
}
