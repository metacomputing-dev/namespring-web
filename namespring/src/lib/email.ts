const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeOptionalEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}
