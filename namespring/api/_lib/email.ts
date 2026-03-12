import { ApiHttpError } from "./http";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeOptionalEmail(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ApiHttpError(400, "INVALID_EMAIL", "Email must be a string.");
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    throw new ApiHttpError(400, "INVALID_EMAIL", "Email format is invalid.");
  }

  return trimmed;
}
