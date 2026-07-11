/** Deeply freezes an object graph without traversing prototypes. */
export function deepFreeze<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return value;
  }

  const objectValue = value as object;
  if (seen.has(objectValue)) return value;
  seen.add(objectValue);

  for (const key of Reflect.ownKeys(objectValue)) {
    const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
    if (descriptor && 'value' in descriptor) {
      deepFreeze(descriptor.value, seen);
    }
  }

  return Object.freeze(value);
}
