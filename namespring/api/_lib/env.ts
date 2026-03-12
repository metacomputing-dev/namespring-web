import { ApiHttpError } from "./http";

export function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function getRequiredEnv(name: string): string {
  const value = getOptionalEnv(name);
  if (!value) {
    throw new ApiHttpError(500, "MISSING_ENV", `Missing required environment variable: ${name}`);
  }
  return value;
}
