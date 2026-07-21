import { describe, expect, it } from 'vitest';

import { deepClone, deepFreeze, deepMerge } from './deepMerge.js';

describe('deepMerge ownership', () => {
  it('detaches both untouched base branches and overlay replacements', () => {
    const base = {
      keep: { nested: { value: 1 } },
      replace: [{ value: 2 }],
    };
    const overlay = {
      replace: [{ value: 3 }],
      added: { nested: { value: 4 } },
    };

    const merged = deepMerge(base, overlay) as typeof base & typeof overlay;

    expect(merged.keep).not.toBe(base.keep);
    expect(merged.keep.nested).not.toBe(base.keep.nested);
    expect(merged.replace).not.toBe(overlay.replace);
    expect(merged.replace[0]).not.toBe(overlay.replace[0]);
    expect(merged.added).not.toBe(overlay.added);

    merged.keep.nested.value = 10;
    merged.replace[0]!.value = 30;
    merged.added.nested.value = 40;

    expect(base.keep.nested.value).toBe(1);
    expect(overlay.replace[0]!.value).toBe(3);
    expect(overlay.added.nested.value).toBe(4);
  });

  it('creates a writable clone even when the source snapshot is frozen', () => {
    const source = deepFreeze({ nested: { value: 1 }, items: [{ value: 2 }] });
    const clone = deepClone(source);

    expect(clone).not.toBe(source);
    expect(clone.nested).not.toBe(source.nested);
    expect(Object.isFrozen(clone)).toBe(false);
    expect(Object.isFrozen(clone.nested)).toBe(false);

    clone.nested.value = 10;
    clone.items[0]!.value = 20;

    expect(source.nested.value).toBe(1);
    expect(source.items[0]!.value).toBe(2);
  });
});

describe('deepFreeze', () => {
  it('recursively freezes JSON-shaped snapshots', () => {
    const snapshot = deepFreeze({ nested: { items: [{ value: 1 }] } });

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.nested)).toBe(true);
    expect(Object.isFrozen(snapshot.nested.items)).toBe(true);
    expect(Object.isFrozen(snapshot.nested.items[0])).toBe(true);
    expect(() => {
      (snapshot.nested.items[0] as { value: number }).value = 9;
    }).toThrow(TypeError);
  });

  it.each([
    new Date(0),
    new Map([['key', 'value']]),
    new Set(['value']),
    () => 'not-data',
  ])('rejects mutable non-data values instead of pretending to freeze them', (value) => {
    expect(() => deepFreeze({ value })).toThrow('unsupported value');
    expect(() => deepClone({ value })).toThrow('unsupported value');
  });
});
