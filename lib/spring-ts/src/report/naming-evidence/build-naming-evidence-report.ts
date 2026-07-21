import {
  classifyHigherIsBetterScoreBand,
  classifyNamingScoreBand,
  type NamingScoreBand,
} from '../../naming-score-axis-policy.js';
import type { NamingReport, NamingScoreVector } from '../../types.js';
import { deepFreeze } from '../../../../seed-ts/src/utils/deep-freeze.js';
import { EMPTY_NAMING_EVIDENCE_CATALOG } from './catalog.js';
import {
  NAMING_EVIDENCE_CATALOG_SCHEMA_VERSION,
  NAMING_EVIDENCE_SCHEMA_VERSION,
  NamingEvidenceContractError,
  type NamingEvidenceCatalog,
  type NamingEvidenceConclusionTone,
  type NamingEvidenceFact,
  type NamingEvidenceFragmentRef,
  type NamingEvidenceGyeokgukFamily,
  type NamingEvidencePlan,
  type NamingEvidenceRelation,
  type NamingEvidenceReport,
  type NamingEvidenceReportInput,
  type NamingEvidenceScoreAxis,
  type NamingEvidenceScoreFact,
  type NamingEvidenceSectionPlan,
} from './types.js';

const ELEMENTS = new Set(['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER']);
const STRENGTHS = new Set(['weak', 'balanced', 'strong']);
const GYEOKGUK_FAMILIES: ReadonlySet<NamingEvidenceGyeokgukFamily> = new Set([
  'inseong',
  'siksang',
  'jaeseong',
  'gwanseong',
  'bigeop',
  'special',
]);

const SECTION_TITLES = Object.freeze({
  sajuFit: '사주에 필요한 방향과 맞는가',
  namingStructure: '이름의 성명학 구조가 안정적인가',
  pronunciation: '부르기 좋은 이름인가',
});

interface StructureCandidate {
  readonly fact: NamingEvidenceScoreFact;
  readonly order: number;
}

interface ScoreVectorRef {
  readonly value: NamingScoreVector;
  readonly sourcePath: 'springReport.scoreVector' | 'springReport.namingReport.scoreVector';
}

function assertScore(path: string, value: number | null | undefined): void {
  if (value === null || value === undefined) return;
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new NamingEvidenceContractError(path, 'expected a finite score from 0 to 100');
  }
}

function assertInput(input: NamingEvidenceReportInput): void {
  const name = input.springReport?.namingReport?.name?.fullHangul;
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new NamingEvidenceContractError('springReport.namingReport.name.fullHangul', 'expected a non-empty name');
  }

  const axes = input.sajuAxes;
  if (!axes || !ELEMENTS.has(axes.dayMasterElement)) {
    throw new NamingEvidenceContractError('sajuAxes.dayMasterElement', 'expected a resolved five-element code');
  }
  if (!STRENGTHS.has(axes.strength)) {
    throw new NamingEvidenceContractError('sajuAxes.strength', 'expected weak, balanced, or strong');
  }
  if (!ELEMENTS.has(axes.yongshinElement)) {
    throw new NamingEvidenceContractError('sajuAxes.yongshinElement', 'expected a resolved five-element code');
  }
  if (!GYEOKGUK_FAMILIES.has(axes.gyeokgukFamily)) {
    throw new NamingEvidenceContractError('sajuAxes.gyeokgukFamily', 'expected a resolved gyeokguk family');
  }

  const report = input.springReport.namingReport;
  assertScore('springReport.namingReport.totalScore', report.totalScore);
  assertScore('springReport.namingReport.scores.hangul', report.scores.hangul);
  assertScore('springReport.namingReport.scores.hanja', report.scores.hanja);
  assertScore('springReport.namingReport.scores.fourFrame', report.scores.fourFrame);
  assertScore('springReport.namingReport.analysis.hangul.elementScore', report.analysis.hangul.elementScore);
  assertScore('springReport.namingReport.analysis.hangul.polarityScore', report.analysis.hangul.polarityScore);
  assertScore('springReport.namingReport.analysis.hanja.elementScore', report.analysis.hanja.elementScore);
  assertScore('springReport.namingReport.analysis.hanja.polarityScore', report.analysis.hanja.polarityScore);
  assertScore('springReport.namingReport.analysis.fourFrame.elementScore', report.analysis.fourFrame.elementScore);
  assertScore('springReport.namingReport.analysis.fourFrame.luckScore', report.analysis.fourFrame.luckScore);

  const vector = input.springReport.scoreVector ?? report.scoreVector;
  if (vector) {
    for (const axis of ['sajuFit', 'yongshinFit', 'elementBalance', 'phonetic', 'familyFit'] as const) {
      assertScore(`springReport.scoreVector.${axis}`, vector[axis]);
    }
  }
}

function scoreFact(
  axis: NamingEvidenceScoreAxis,
  role: NamingEvidenceScoreFact['role'],
  sourcePath: string,
  value: number | null | undefined,
  classifier: (value: number | null | undefined) => NamingScoreBand | null,
  metrics: NamingEvidenceScoreFact['metrics'] = [],
): NamingEvidenceScoreFact | null {
  const band = classifier(value);
  if (band === null || value === null || value === undefined) return null;
  return { kind: 'score', axis, role, sourcePath, value, band, metrics };
}

function scoreVectorOf(report: NamingEvidenceReportInput['springReport']): ScoreVectorRef | null {
  if (report.scoreVector) return { value: report.scoreVector, sourcePath: 'springReport.scoreVector' };
  if (report.namingReport.scoreVector) {
    return { value: report.namingReport.scoreVector, sourcePath: 'springReport.namingReport.scoreVector' };
  }
  return null;
}

function relationToSummary(summary: NamingScoreBand, detail: NamingScoreBand): NamingEvidenceRelation {
  const positive = (band: NamingScoreBand): boolean => band === 'excellent' || band === 'good';
  if (positive(summary) && positive(detail)) return 'supports';
  if (positive(summary) && detail === 'caution') return 'limits';
  if (!positive(summary) && positive(detail)) return 'counterbalances';
  return 'neutral';
}

function conclusionToneOf(facts: readonly NamingEvidenceScoreFact[]): NamingEvidenceConclusionTone {
  const summary = facts.find((fact) => fact.axis === 'sajuFit');
  if (!summary) return 'insufficientEvidence';
  const positive = (band: NamingScoreBand): boolean => band === 'excellent' || band === 'good';
  const cautionCount = facts.filter((fact) => fact.band === 'caution').length;
  if (facts.length === 3 && facts.every((fact) => positive(fact.band))) return 'allPositive';
  if (positive(summary.band) && facts.every((fact) => positive(fact.band))) return 'mostlyPositive';
  if (summary.band === 'caution' || cautionCount >= 2) return 'needsCaution';
  return 'mixedButUsable';
}

function buildSajuFitSection(input: NamingEvidenceReportInput): NamingEvidenceSectionPlan {
  const vector = scoreVectorOf(input.springReport);
  const facts = [
    scoreFact('sajuFit', 'summary', `${vector?.sourcePath ?? 'springReport.scoreVector'}.sajuFit`, vector?.value.sajuFit, (value) => classifyNamingScoreBand('sajuFit', value)),
    scoreFact('yongshinFit', 'detail', `${vector?.sourcePath ?? 'springReport.scoreVector'}.yongshinFit`, vector?.value.yongshinFit, (value) => classifyNamingScoreBand('yongshinFit', value)),
    scoreFact('elementBalance', 'detail', `${vector?.sourcePath ?? 'springReport.scoreVector'}.elementBalance`, vector?.value.elementBalance, (value) => classifyNamingScoreBand('elementBalance', value)),
  ].filter((fact): fact is NamingEvidenceScoreFact => fact !== null);
  const summary = facts.find((fact) => fact.axis === 'sajuFit') ?? null;
  const tone = conclusionToneOf(facts);
  const axisFact: NamingEvidenceFact = {
    kind: 'sajuAxes',
    sourcePath: 'sajuAxes',
    value: { ...input.sajuAxes },
  };
  const fragments: NamingEvidenceFragmentRef[] = [{
    key: `saju-axis/${input.sajuAxes.dayMasterElement}/${input.sajuAxes.strength}/${input.sajuAxes.yongshinElement}/${input.sajuAxes.gyeokgukFamily}`,
    slot: 'state',
    relation: null,
    facts: [axisFact],
  }];

  for (const fact of facts) {
    fragments.push({
      key: `score/${fact.axis}/${fact.band}`,
      slot: fact.role === 'summary' ? 'summary' : 'detail',
      relation: summary && fact.axis !== 'sajuFit' ? relationToSummary(summary.band, fact.band) : 'neutral',
      facts: [fact],
    });
  }
  fragments.push({
    key: `conclusion/sajuFit/${tone}`,
    slot: 'conclusion',
    relation: 'neutral',
    facts,
  });

  return {
    id: 'sajuFit',
    title: SECTION_TITLES.sajuFit,
    availability: 'planned',
    verdict: summary?.band ?? null,
    conclusionTone: tone,
    fragments,
    facts: [axisFact, ...facts],
  };
}

function structureCandidates(report: NamingReport): StructureCandidate[] {
  const candidates: Array<StructureCandidate | null> = [{
    fact: scoreFact(
      'hangulStructure',
      'detail',
      'springReport.namingReport.scores.hangul',
      report.scores.hangul,
      classifyHigherIsBetterScoreBand,
      [
        { sourcePath: 'springReport.namingReport.analysis.hangul.elementScore', value: report.analysis.hangul.elementScore },
        { sourcePath: 'springReport.namingReport.analysis.hangul.polarityScore', value: report.analysis.hangul.polarityScore },
      ],
    )!,
    order: 0,
  },
    report.analysis.hanja.blocks.length > 0 ? {
      fact: scoreFact(
        'hanjaStructure',
        'detail',
        'springReport.namingReport.scores.hanja',
        report.scores.hanja,
        classifyHigherIsBetterScoreBand,
        [
          { sourcePath: 'springReport.namingReport.analysis.hanja.elementScore', value: report.analysis.hanja.elementScore },
          { sourcePath: 'springReport.namingReport.analysis.hanja.polarityScore', value: report.analysis.hanja.polarityScore },
        ],
      )!,
      order: 1,
    } : null,
    {
      fact: scoreFact(
        'fourFrameLuck',
        'detail',
        'springReport.namingReport.analysis.fourFrame.luckScore',
        report.analysis.fourFrame.luckScore,
        classifyHigherIsBetterScoreBand,
      )!,
      order: 2,
    },
    {
      fact: scoreFact(
        'fourFrameElement',
        'detail',
        'springReport.namingReport.analysis.fourFrame.elementScore',
        report.analysis.fourFrame.elementScore,
        classifyHigherIsBetterScoreBand,
      )!,
      order: 3,
    },
  ];
  return candidates.filter((candidate): candidate is StructureCandidate => candidate !== null && candidate.fact !== null);
}

function representativeStructureFacts(report: NamingReport): NamingEvidenceScoreFact[] {
  const sorted = structureCandidates(report).sort((left, right) => left.fact.value - right.fact.value || left.order - right.order);
  if (sorted.length <= 2) return sorted.map(({ fact }) => fact);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];
  return weakest.order === strongest.order ? [weakest.fact] : [weakest.fact, strongest.fact];
}

function buildNamingStructureSection(report: NamingReport): NamingEvidenceSectionPlan {
  const summary = scoreFact(
    'namingStructure',
    'summary',
    'springReport.namingReport.totalScore',
    report.totalScore,
    classifyHigherIsBetterScoreBand,
  )!;
  const details = representativeStructureFacts(report);
  const fragments: NamingEvidenceFragmentRef[] = [{
    key: `score/namingStructure/${summary.band}`,
    slot: 'summary',
    relation: null,
    facts: [summary],
  }, ...details.map((fact): NamingEvidenceFragmentRef => ({
    key: `score/${fact.axis}/${fact.band}`,
    slot: 'detail',
    relation: relationToSummary(summary.band, fact.band),
    facts: [fact],
  }))];
  return {
    id: 'namingStructure',
    title: SECTION_TITLES.namingStructure,
    availability: 'planned',
    verdict: summary.band,
    conclusionTone: null,
    fragments,
    facts: [summary, ...details],
  };
}

function buildPronunciationSection(input: NamingEvidenceReportInput): NamingEvidenceSectionPlan {
  const vector = scoreVectorOf(input.springReport);
  const phonetic = scoreFact('phonetic', 'summary', `${vector?.sourcePath ?? 'springReport.scoreVector'}.phonetic`, vector?.value.phonetic, (value) => classifyNamingScoreBand('phonetic', value));
  const familyFit = scoreFact('familyFit', 'detail', `${vector?.sourcePath ?? 'springReport.scoreVector'}.familyFit`, vector?.value.familyFit, (value) => classifyNamingScoreBand('familyFit', value));
  const facts = [phonetic, familyFit].filter((fact): fact is NamingEvidenceScoreFact => fact !== null);
  if (facts.length === 0) {
    return {
      id: 'pronunciation',
      title: SECTION_TITLES.pronunciation,
      availability: 'not_applicable',
      verdict: null,
      conclusionTone: null,
      fragments: [],
      facts: [],
    };
  }

  const verdict = phonetic?.band ?? familyFit!.band;
  const key = phonetic && familyFit
    ? `pronunciation/${phonetic.band}/${familyFit.band}`
    : `score/${phonetic ? 'phonetic' : 'familyFit'}/${(phonetic ?? familyFit)!.band}`;
  return {
    id: 'pronunciation',
    title: SECTION_TITLES.pronunciation,
    availability: 'planned',
    verdict,
    conclusionTone: null,
    fragments: [{ key, slot: 'summary', relation: null, facts }],
    facts,
  };
}

export function buildNamingEvidencePlan(input: NamingEvidenceReportInput): NamingEvidencePlan {
  assertInput(input);
  return deepFreeze({
    schemaVersion: NAMING_EVIDENCE_SCHEMA_VERSION,
    name: input.springReport.namingReport.name.fullHangul,
    sections: [
      buildSajuFitSection(input),
      buildNamingStructureSection(input.springReport.namingReport),
      buildPronunciationSection(input),
    ],
  });
}

function interpolate(text: string, name: string): string {
  return text.replaceAll('{{name}}', name);
}

function renderParts(
  plan: NamingEvidencePlan,
  section: NamingEvidenceSectionPlan,
  catalog: NamingEvidenceCatalog,
  field: 'plain' | 'detail',
): { text: string; rendered: string[]; missing: string[] } {
  const parts: string[] = [];
  const rendered: string[] = [];
  const missing: string[] = [];
  for (const reference of section.fragments) {
    const fragment = catalog.fragments[reference.key];
    if (!fragment) {
      missing.push(reference.key);
      continue;
    }
    if (fragment.key !== reference.key || fragment.sectionId !== section.id || fragment.slot !== reference.slot) {
      throw new NamingEvidenceContractError(`catalog.fragments.${reference.key}`, 'fragment identity does not match its plan slot');
    }
    const connector = reference.relation ? catalog.connectors[reference.relation]?.[0] : undefined;
    if (parts.length > 0 && connector) parts.push(interpolate(connector, plan.name));
    parts.push(interpolate(fragment[field], plan.name));
    rendered.push(reference.key);
  }
  return { text: parts.join(' ').trim(), rendered, missing };
}

export function renderNamingEvidenceReport(
  plan: NamingEvidencePlan,
  catalog: NamingEvidenceCatalog = EMPTY_NAMING_EVIDENCE_CATALOG,
): NamingEvidenceReport {
  if (catalog.schemaVersion !== NAMING_EVIDENCE_CATALOG_SCHEMA_VERSION) {
    throw new NamingEvidenceContractError('catalog.schemaVersion', 'unsupported evidence catalog schema');
  }
  return deepFreeze({
    schemaVersion: NAMING_EVIDENCE_SCHEMA_VERSION,
    contentVersion: catalog.contentVersion,
    name: plan.name,
    sections: plan.sections.map((section) => {
      if (section.availability === 'not_applicable') {
        return {
          id: section.id,
          title: section.title,
          plain: '',
          detail: '',
          availability: 'not_applicable' as const,
          verdict: section.verdict,
          conclusionTone: section.conclusionTone,
          facts: section.facts,
          fragmentKeys: [],
          renderedFragmentKeys: [],
          missingFragmentKeys: [],
        };
      }
      const plain = renderParts(plan, section, catalog, 'plain');
      const detail = renderParts(plan, section, catalog, 'detail');
      const missing = [...new Set([...plain.missing, ...detail.missing])];
      const rendered = [...new Set([...plain.rendered, ...detail.rendered])];
      const availability = rendered.length === 0
        ? 'content_missing' as const
        : missing.length > 0
          ? 'limited' as const
          : 'ready' as const;
      return {
        id: section.id,
        title: section.title,
        plain: plain.text,
        detail: detail.text,
        availability,
        verdict: section.verdict,
        conclusionTone: section.conclusionTone,
        facts: section.facts,
        fragmentKeys: section.fragments.map(({ key }) => key),
        renderedFragmentKeys: rendered,
        missingFragmentKeys: missing,
      };
    }),
  });
}

export function buildNamingEvidenceReport(
  input: NamingEvidenceReportInput,
  catalog: NamingEvidenceCatalog = EMPTY_NAMING_EVIDENCE_CATALOG,
): NamingEvidenceReport {
  return renderNamingEvidenceReport(buildNamingEvidencePlan(input), catalog);
}
