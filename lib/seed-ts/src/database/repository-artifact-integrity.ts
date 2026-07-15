export interface Sha256VerificationErrors {
  readonly cryptoUnavailable: () => Error;
  readonly mismatch: (expectedSha256: string, actualSha256: string) => Error;
}

export function normalizeSha256Digest(
  value: string,
  invalid: () => Error,
): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(normalized)) throw invalid();
  return normalized;
}

export async function sha256Hex(
  bytes: Uint8Array,
  cryptoUnavailable: () => Error,
): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw cryptoUnavailable();
  const digestInput = bytes.slice().buffer;
  const digest = await subtle.digest('SHA-256', digestInput);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifySha256Digest(
  bytes: Uint8Array,
  expectedSha256: string,
  errors: Sha256VerificationErrors,
): Promise<string> {
  const actualSha256 = await sha256Hex(bytes, errors.cryptoUnavailable);
  if (actualSha256 !== expectedSha256) {
    throw errors.mismatch(expectedSha256, actualSha256);
  }
  return actualSha256;
}
