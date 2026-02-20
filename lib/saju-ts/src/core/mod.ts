export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
