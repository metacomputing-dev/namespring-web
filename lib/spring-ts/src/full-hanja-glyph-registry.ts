import inmyeongyongGlyphRegistry from '../data/inmyeongyong_9389_glyphs.generated.json';

interface FullGlyphRegistryDocument {
  readonly schemaVersion: '1.0.0-glyph-registry';
  readonly sourceSchemaVersion: '1.0.0-full';
  readonly sourceDocumentSha256: string;
  readonly glyphsSha256: string;
  readonly count: number;
  readonly glyphs: string;
}

export const EXPECTED_FULL_HANJA_GLYPH_COUNT = 9_495;

function parseFullGlyphRegistry(value: unknown): {
  readonly glyphs: readonly string[];
  readonly glyphSet: ReadonlySet<string>;
} {
  const registry = value as Partial<FullGlyphRegistryDocument> | null;
  if (registry?.schemaVersion !== '1.0.0-glyph-registry'
    || registry.sourceSchemaVersion !== '1.0.0-full'
    || !/^[0-9a-f]{64}$/.test(registry.sourceDocumentSha256 ?? '')
    || !/^[0-9a-f]{64}$/.test(registry.glyphsSha256 ?? '')
    || registry.count !== EXPECTED_FULL_HANJA_GLYPH_COUNT
    || typeof registry.glyphs !== 'string') {
    throw new Error('Local full-pool Hanja glyph registry failed its integrity check.');
  }

  // String iteration is intentionally code-point aware. split('') would split
  // supplementary court-mirror and PUA glyphs into UTF-16 surrogate halves.
  const glyphs = Array.from(registry.glyphs);
  const glyphSet = new Set(glyphs);
  if (glyphs.length !== EXPECTED_FULL_HANJA_GLYPH_COUNT
    || glyphSet.size !== EXPECTED_FULL_HANJA_GLYPH_COUNT) {
    throw new Error('Local full-pool Hanja glyph registry failed its integrity check.');
  }
  return Object.freeze({
    glyphs: Object.freeze(glyphs),
    glyphSet,
  });
}

const FULL_HANJA_GLYPH_REGISTRY = parseFullGlyphRegistry(inmyeongyongGlyphRegistry);
export const FULL_HANJA_GLYPHS = FULL_HANJA_GLYPH_REGISTRY.glyphs;

export function isLocalFullPoolHanjaGlyph(glyph: string): boolean {
  return FULL_HANJA_GLYPH_REGISTRY.glyphSet.has(glyph);
}
