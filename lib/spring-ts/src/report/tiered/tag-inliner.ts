/**
 * tag-inliner.ts -- Collect every TagId referenced by the matrix
 *
 * Walks every TaggedParagraph in every cell, accumulates the set of
 * tagIds actually used, then validates each against the loaded glossary.
 * The result powers `TagGlossary.usedInThisReport` so a UI can pre-render
 * only the tags that appear in this report.
 */

import type {
  FortuneTieredMatrix,
  GlossaryEntry,
  TagGlossary,
  TagId,
  TaggedParagraph,
  TieredFortune,
} from '../types.js';

function collectFromParagraphs(paragraphs: readonly TaggedParagraph[], out: Set<TagId>): void {
  for (const para of paragraphs) {
    for (const tok of para.tokens) {
      if (tok.kind === 'tag' && tok.tagId) out.add(tok.tagId);
    }
  }
}

function collectFromCell(cell: TieredFortune, out: Set<TagId>): void {
  collectFromParagraphs(cell.standard.paragraphs, out);
  collectFromParagraphs(cell.expert.paragraphs, out);
}

/** Build the report-scoped glossary view. Only entries actually referenced
 *  in the matrix are returned, so minors and narrow reports do not carry
 *  unrelated adult or expert definitions in their payload. */
export function buildTagGlossary(
  matrix: Pick<FortuneTieredMatrix, 'periods'>,
  allEntries: Readonly<Record<TagId, GlossaryEntry>>,
): TagGlossary {
  const used = new Set<TagId>();
  for (const periodKind of Object.keys(matrix.periods) as Array<keyof typeof matrix.periods>) {
    const period = matrix.periods[periodKind];
    if (!period) continue;
    collectFromCell(period.overall, used);
    for (const cat of Object.keys(period.byCategory) as Array<keyof typeof period.byCategory>) {
      const cell = period.byCategory[cat];
      if (cell) collectFromCell(cell, used);
    }
    for (const ageBand of Object.keys(period.byAgeBand ?? {}) as Array<keyof NonNullable<typeof period.byAgeBand>>) {
      const scoped = period.byAgeBand?.[ageBand];
      if (!scoped) continue;
      collectFromCell(scoped.overall, used);
      for (const cat of Object.keys(scoped.byCategory) as Array<keyof typeof scoped.byCategory>) {
        const cell = scoped.byCategory[cat];
        if (cell) collectFromCell(cell, used);
      }
    }
  }
  // Sort for deterministic output.
  const usedInThisReport = [...used].sort();
  const entries: Record<TagId, GlossaryEntry> = {};
  for (const tagId of usedInThisReport) {
    const entry = allEntries[tagId];
    if (entry) entries[tagId] = entry;
  }
  return {
    entries,
    usedInThisReport,
  };
}
