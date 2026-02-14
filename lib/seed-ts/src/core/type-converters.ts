export function toText(value: unknown): string {
  return String(value ?? "").trim();
}

export function toInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function toBit(value: unknown): 0 | 1 {
  return toInt(value, 0) === 0 ? 0 : 1;
}
