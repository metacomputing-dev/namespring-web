export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total / values.length;
}

export function toRoundedInt(value: number): number {
  return Math.round(value);
}

export function normalizeText(text: string): string {
  return (text ?? "").trim();
}

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
}

export function mapPush<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const prev = map.get(key);
  if (prev) {
    prev.push(value);
    return;
  }
  map.set(key, [value]);
}
