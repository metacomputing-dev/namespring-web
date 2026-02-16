export function createEnumValueParser<T extends string>(
  enumName: string,
  sourceName: string,
  enumObject: Record<string, T>,
): (raw: string) => T {
  return createValueParser(enumName, sourceName, Object.values(enumObject));
}

export function createValueParser<T extends string>(
  valueName: string,
  sourceName: string,
  values: readonly T[],
): (raw: string) => T {
  const allowedValues: ReadonlySet<T> = new Set(values);
  return (raw: string): T => {
    if (allowedValues.has(raw as T)) return raw as T;
    throw new Error(`Invalid ${valueName} in ${sourceName}: ${raw}`);
  };
}
