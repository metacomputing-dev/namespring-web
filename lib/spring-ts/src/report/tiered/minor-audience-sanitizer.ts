/**
 * minor-audience-sanitizer.ts -- final pass for minor-visible tiered output.
 *
 * Fragment selection may render future life-stage cells with adult age-band
 * features. For a minor reader, the whole matrix still travels to the UI, so
 * expert/glossary text also needs to avoid adult relationship and finance terms.
 */

import type {
  AgeBandScopedFortunes,
  BriefFortuneText,
  ExpertFortuneText,
  FortuneTieredMatrix,
  GlossaryEntry,
  NumericalEvidenceRow,
  ParagraphToken,
  PeriodScopedFortunes,
  StandardFortuneText,
  TaggedParagraph,
  TagGlossary,
  TieredCategoryId,
  TieredFortune,
  TieredLifeStageBand,
  TieredNameFrameEvidence,
  TieredNamingEvidence,
} from '../types.js';
import { sanitizeMinorAudienceText } from './standard-depth-enhancer.js';

function sanitizeToken(token: ParagraphToken): ParagraphToken {
  if (token.kind === 'text') return { ...token, value: sanitizeMinorAudienceText(token.value) };
  return { ...token, label: sanitizeMinorAudienceText(token.label) };
}

function sanitizeParagraph(paragraph: TaggedParagraph): TaggedParagraph {
  const tokens = paragraph.tokens.map((token) => sanitizeToken(token));
  return {
    tokens,
    plainText: sanitizeMinorAudienceText(paragraph.plainText),
  };
}

function sanitizeBrief(brief: BriefFortuneText): BriefFortuneText {
  return {
    headline: sanitizeMinorAudienceText(brief.headline),
    ...(brief.hook ? { hook: sanitizeMinorAudienceText(brief.hook) } : {}),
  };
}

function sanitizeStandard(standard: StandardFortuneText): StandardFortuneText {
  return {
    paragraphs: standard.paragraphs.map((paragraph) => sanitizeParagraph(paragraph)),
    ...(standard.livingTips ? { livingTips: standard.livingTips.map((text) => sanitizeMinorAudienceText(text)) } : {}),
    ...(standard.cautions ? { cautions: standard.cautions.map((text) => sanitizeMinorAudienceText(text)) } : {}),
  };
}

function sanitizeOptionalText<T extends string | null | undefined>(value: T): T {
  return typeof value === 'string' ? sanitizeMinorAudienceText(value) as T : value;
}

function sanitizeNumericalEvidence(row: NumericalEvidenceRow): NumericalEvidenceRow {
  return {
    ...row,
    label: sanitizeMinorAudienceText(row.label),
    sourceTier: {
      ...row.sourceTier,
      quoteShort: sanitizeOptionalText(row.sourceTier.quoteShort),
      humanInterpretation: sanitizeMinorAudienceText(row.sourceTier.humanInterpretation),
      copyrightNote: sanitizeMinorAudienceText(row.sourceTier.copyrightNote),
    },
  };
}

function sanitizeExpert(expert: ExpertFortuneText): ExpertFortuneText {
  return {
    paragraphs: expert.paragraphs.map((paragraph) => sanitizeParagraph(paragraph)),
    ...(expert.numericalEvidence
      ? { numericalEvidence: expert.numericalEvidence.map((row) => sanitizeNumericalEvidence(row)) }
      : {}),
  };
}

function sanitizeCell(cell: TieredFortune): TieredFortune {
  return {
    ...cell,
    brief: sanitizeBrief(cell.brief),
    standard: sanitizeStandard(cell.standard),
    expert: sanitizeExpert(cell.expert),
  };
}

function sanitizeCategoryCells(
  byCategory: Readonly<Record<TieredCategoryId, TieredFortune>>,
): Readonly<Record<TieredCategoryId, TieredFortune>> {
  return Object.fromEntries(
    Object.entries(byCategory).map(([key, cell]) => [key, sanitizeCell(cell)]),
  ) as Readonly<Record<TieredCategoryId, TieredFortune>>;
}

function sanitizeAgeBandScoped(scoped: AgeBandScopedFortunes): AgeBandScopedFortunes {
  return {
    ...scoped,
    overall: sanitizeCell(scoped.overall),
    byCategory: sanitizeCategoryCells(scoped.byCategory),
  };
}

function sanitizePeriodScoped(period: PeriodScopedFortunes): PeriodScopedFortunes {
  const byAgeBand = period.byAgeBand
    ? Object.fromEntries(
      Object.entries(period.byAgeBand).map(([key, scoped]) => [key, sanitizeAgeBandScoped(scoped)]),
    ) as Readonly<Record<TieredLifeStageBand, AgeBandScopedFortunes>>
    : undefined;
  return {
    ...period,
    overall: sanitizeCell(period.overall),
    byCategory: sanitizeCategoryCells(period.byCategory),
    ...(byAgeBand ? { byAgeBand } : {}),
  };
}

function sanitizeGlossaryEntry(entry: GlossaryEntry): GlossaryEntry {
  const label = sanitizeMinorAudienceText(entry.label);
  const hashLabel = entry.hashLabel.startsWith('#')
    ? `#${sanitizeMinorAudienceText(entry.hashLabel.slice(1)).replace(/\s+/g, '')}`
    : sanitizeMinorAudienceText(entry.hashLabel);
  return {
    ...entry,
    label,
    hashLabel,
    brief: sanitizeMinorAudienceText(entry.brief),
    detailed: sanitizeMinorAudienceText(entry.detailed),
  };
}

function sanitizeGlossary(glossary: TagGlossary): TagGlossary {
  return {
    ...glossary,
    entries: Object.fromEntries(
      Object.entries(glossary.entries).map(([key, entry]) => [key, sanitizeGlossaryEntry(entry)]),
    ),
  };
}

function sanitizeNameFrameEvidence(frame: TieredNameFrameEvidence): TieredNameFrameEvidence {
  return {
    ...frame,
    label: sanitizeMinorAudienceText(frame.label),
    ...(frame.elementLabel ? { elementLabel: sanitizeMinorAudienceText(frame.elementLabel) } : {}),
    ...(frame.title ? { title: sanitizeMinorAudienceText(frame.title) } : {}),
    ...(frame.summary ? { summary: sanitizeMinorAudienceText(frame.summary) } : {}),
    ...(frame.lifePeriodInfluence ? { lifePeriodInfluence: sanitizeMinorAudienceText(frame.lifePeriodInfluence) } : {}),
  };
}

function sanitizeNamingEvidence(evidence: TieredNamingEvidence | undefined): TieredNamingEvidence | undefined {
  if (!evidence) return undefined;
  return {
    ...evidence,
    frames: evidence.frames.map((frame) => sanitizeNameFrameEvidence(frame)),
  };
}

export function sanitizeTieredMatrixForMinorAudience(matrix: FortuneTieredMatrix): FortuneTieredMatrix {
  return {
    ...matrix,
    periods: Object.fromEntries(
      Object.entries(matrix.periods).map(([key, period]) => [key, sanitizePeriodScoped(period)]),
    ) as FortuneTieredMatrix['periods'],
    glossary: sanitizeGlossary(matrix.glossary),
    ...(matrix.namingEvidence ? { namingEvidence: sanitizeNamingEvidence(matrix.namingEvidence) } : {}),
  };
}