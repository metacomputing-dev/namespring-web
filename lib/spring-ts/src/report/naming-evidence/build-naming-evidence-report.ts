import {
  classifyHigherIsBetterScoreBand,
  classifyNamingScoreBand,
  type NamingScoreBand,
} from '../../naming-score-axis-policy.js';
import type { ElementKey } from '../../core/scoring.js';
import type { NamingReport, NamingScoreVector, SajuNameSourceEvidence } from '../../types.js';
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
  type NamingEvidenceSourceFact,
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

const ELEMENT_LABELS: Readonly<Record<ElementKey, string>> = {
  Wood: '목 기운', Fire: '화 기운', Earth: '토 기운', Metal: '금 기운', Water: '수 기운',
};
const ELEMENT_FUNCTIONS: Readonly<Record<ElementKey, string>> = {
  Wood: '새로운 일을 시작하고 꾸준히 성장하는 힘',
  Fire: '생각을 표현하고 행동으로 옮기는 힘',
  Earth: '중심을 잡고 일을 안정적으로 이어 가는 힘',
  Metal: '기준을 세우고 필요한 것을 선택해 정리하는 힘',
  Water: '상황을 살피고 변화에 유연하게 대응하는 힘',
};

interface SourceCandidate {
  readonly fact: NamingEvidenceSourceFact;
  readonly key: string;
}

function elementText(elements: readonly ElementKey[]): string {
  return [...new Set(elements)].map((element) => ELEMENT_LABELS[element]).join('과 ');
}

function elementFunctionText(elements: readonly ElementKey[]): string {
  return [...new Set(elements)].map((element) => ELEMENT_FUNCTIONS[element]).join('과 ');
}

function sourceCandidate(
  sourceId: string,
  state: string,
  sourcePath: string,
  direction: NamingEvidenceSourceFact['direction'],
  weight: number,
  variables: Readonly<Record<string, string>> = {},
): SourceCandidate {
  return {
    key: `source/${sourceId}/${state}`,
    fact: { kind: 'sourceEvidence', sourceId, state, sourcePath, direction, weight, variables },
  };
}

function sourceCandidates(evidence: SajuNameSourceEvidence): SourceCandidate[] {
  const candidates: SourceCandidate[] = [];
  const balanceState = evidence.balance.direction === 'supports'
    ? 'improves' : evidence.balance.direction === 'limits' ? 'worsens' : 'holds';
  candidates.push(sourceCandidate(
    'balance', balanceState, 'springReport.sajuCompatibility.sourceEvidence.balance',
    evidence.balance.direction, evidence.decisionImpacts.balance,
    {
      filledElements: elementText(evidence.balance.filledDeficientElements),
      excessiveElements: elementText(evidence.balance.reinforcedExcessiveElements),
      filledElementFunctions: elementFunctionText(evidence.balance.filledDeficientElements),
      excessiveElementFunctions: elementFunctionText(evidence.balance.reinforcedExcessiveElements),
    },
  ));

  const helpful = evidence.yongshin.matches.yongshin + evidence.yongshin.matches.heesin;
  const harmful = evidence.yongshin.matches.gisin + evidence.yongshin.matches.gusin;
  if (evidence.yongshin.matches.yongshin > 0 && evidence.yongshin.elements.yongshin) {
    candidates.push(sourceCandidate(
      'yongshin', 'yongshin', 'springReport.sajuCompatibility.sourceEvidence.yongshin.matches.yongshin',
      'supports', evidence.decisionImpacts.yongshin,
      {
        matchedElements: elementText([evidence.yongshin.elements.yongshin]),
        matchedElementFunctions: elementFunctionText([evidence.yongshin.elements.yongshin]),
      },
    ));
  }
  if (evidence.yongshin.matches.heesin > 0 && evidence.yongshin.elements.heesin) {
    candidates.push(sourceCandidate(
      'yongshin', 'heesin', 'springReport.sajuCompatibility.sourceEvidence.yongshin.matches.heesin',
      'supports', evidence.decisionImpacts.yongshin * 0.65,
      {
        matchedElements: elementText([evidence.yongshin.elements.heesin]),
        matchedElementFunctions: elementFunctionText([evidence.yongshin.elements.heesin]),
      },
    ));
  }
  if (helpful === 0 && harmful === 0) {
    candidates.push(sourceCandidate(
      'yongshin', 'neutral', 'springReport.sajuCompatibility.sourceEvidence.yongshin.matches',
      'mixed', evidence.decisionImpacts.yongshin,
    ));
  }

  const strengthState = evidence.strength.direction === 'supports'
    ? 'supportsNeededDirection'
    : evidence.strength.direction === 'limits' ? 'opposesNeededDirection' : 'mixed';
  candidates.push(sourceCandidate(
    'strength', strengthState, 'springReport.sajuCompatibility.sourceEvidence.strength',
    evidence.strength.direction, evidence.decisionImpacts.strength,
    {
      alignedElements: elementText(evidence.strength.alignedElements),
      opposedElements: elementText(evidence.strength.opposedElements),
      alignedElementFunctions: elementFunctionText(evidence.strength.alignedElements),
      opposedElementFunctions: elementFunctionText(evidence.strength.opposedElements),
    },
  ));

  const tenGodState = evidence.tenGod.direction === 'supports'
    ? 'fillsDeficit' : evidence.tenGod.direction === 'limits' ? 'reinforcesExcess' : 'neutral';
  candidates.push(sourceCandidate(
    'tenGod', tenGodState, 'springReport.sajuCompatibility.sourceEvidence.tenGod',
    evidence.tenGod.direction, evidence.decisionImpacts.tenGod,
    {
      supportiveElements: elementText(evidence.tenGod.supportiveElements),
      limitingElements: elementText(evidence.tenGod.limitingElements),
      supportiveElementFunctions: elementFunctionText(evidence.tenGod.supportiveElements),
      limitingElementFunctions: elementFunctionText(evidence.tenGod.limitingElements),
    },
  ));

  if (evidence.deficiency.bonus > 0) {
    const primary = evidence.yongshin.elements.yongshin;
    const state = primary && evidence.deficiency.matchedElements.includes(primary)
      ? 'yongshinDeficiencyFilled' : 'heesinDeficiencyFilled';
    candidates.push(sourceCandidate(
      'deficiency', state, 'springReport.sajuCompatibility.sourceEvidence.deficiency',
      'supports', evidence.deficiency.bonus,
      {
        matchedElements: elementText(evidence.deficiency.matchedElements),
        matchedElementFunctions: elementFunctionText(evidence.deficiency.matchedElements),
      },
    ));
  }
  if (evidence.penalties.gisin > 0 && evidence.yongshin.elements.gisin) {
    candidates.push(sourceCandidate(
      'harmfulElement', 'gisinPresent', 'springReport.sajuCompatibility.sourceEvidence.penalties.gisin',
      'limits', evidence.penalties.gisin,
      {
        harmfulElements: elementText([evidence.yongshin.elements.gisin]),
        harmfulElementFunctions: elementFunctionText([evidence.yongshin.elements.gisin]),
      },
    ));
  }
  if (evidence.penalties.gusin > 0 && evidence.yongshin.elements.gusin) {
    candidates.push(sourceCandidate(
      'harmfulElement', 'gusinPresent', 'springReport.sajuCompatibility.sourceEvidence.penalties.gusin',
      'limits', evidence.penalties.gusin,
      {
        harmfulElements: elementText([evidence.yongshin.elements.gusin]),
        harmfulElementFunctions: elementFunctionText([evidence.yongshin.elements.gusin]),
      },
    ));
  }
  if (evidence.gyeokgukProtection.applicable) {
    candidates.push(sourceCandidate(
      'gyeokgukProtection', evidence.gyeokgukProtection.broken ? 'broken' : 'protected',
      'springReport.sajuCompatibility.sourceEvidence.gyeokgukProtection',
      evidence.gyeokgukProtection.broken ? 'limits' : 'supports',
      evidence.gyeokgukProtection.broken ? evidence.penalties.gyeokguk : 0,
    ));
  }
  return candidates;
}

function conclusionToneOf(candidates: readonly SourceCandidate[]): NamingEvidenceConclusionTone {
  if (candidates.length === 0) return 'insufficientEvidence';
  const supporting = candidates.filter(({ fact }) => fact.direction === 'supports')
    .reduce((sum, { fact }) => sum + fact.weight, 0);
  const limiting = candidates.filter(({ fact }) => fact.direction === 'limits')
    .reduce((sum, { fact }) => sum + fact.weight, 0);
  if (limiting === 0 && supporting >= 50) return 'allPositive';
  if (supporting > limiting * 1.5) return 'mostlyPositive';
  if (limiting >= supporting) return 'needsCaution';
  return 'mixedButUsable';
}

function buildSajuFitSection(input: NamingEvidenceReportInput): NamingEvidenceSectionPlan {
  const candidates = input.springReport.sajuCompatibility?.sourceEvidence
    ? sourceCandidates(input.springReport.sajuCompatibility.sourceEvidence)
    : [];
  const tone = conclusionToneOf(candidates);
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

  const ordered = candidates
    .filter(({ fact }) => fact.weight > 0)
    .sort((left, right) => right.fact.weight - left.fact.weight);
  const selected: SourceCandidate[] = [];
  const strongestSupport = ordered.find(({ fact }) => fact.direction === 'supports');
  const strongestLimit = ordered.find(({ fact }) => fact.direction === 'limits');
  if (strongestSupport) selected.push(strongestSupport);
  if (strongestLimit) selected.push(strongestLimit);
  for (const candidate of ordered) {
    if (selected.length >= 3) break;
    if (!selected.includes(candidate)) selected.push(candidate);
  }
  for (const { fact, key } of selected) {
    fragments.push({
      key,
      slot: 'detail',
      relation: fact.direction === 'supports' ? 'supports' : fact.direction === 'limits' ? 'limits' : 'neutral',
      facts: [fact],
      variables: fact.variables,
    });
  }
  fragments.push({
    key: `conclusion/sajuFit/${tone}`,
    slot: 'conclusion',
    relation: null,
    facts: candidates.map(({ fact }) => fact),
  });

  return {
    id: 'sajuFit',
    title: SECTION_TITLES.sajuFit,
    availability: 'planned',
    verdict: null,
    conclusionTone: tone,
    fragments,
    facts: [axisFact, ...candidates.map(({ fact }) => fact)],
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

function interpolate(
  text: string,
  name: string,
  variables: Readonly<Record<string, string>> = {},
): string {
  const finalCodePoint = name.codePointAt(name.length - 1);
  const hasBatchim = finalCodePoint !== undefined
    && finalCodePoint >= 0xac00
    && finalCodePoint <= 0xd7a3
    && (finalCodePoint - 0xac00) % 28 !== 0;
  let rendered = text
    .replaceAll('{{name:topic}}', `${name}${hasBatchim ? '은' : '는'}`)
    .replaceAll('{{name}}', name);
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replaceAll(`{{${key}}}`, value);
  }
  const unresolved = rendered.match(/\{\{[^}]+\}\}/u)?.[0];
  if (unresolved) {
    throw new NamingEvidenceContractError('catalog.fragment.placeholder', `unresolved placeholder ${unresolved}`);
  }
  return rendered;
}

function renderParts(
  plan: NamingEvidencePlan,
  section: NamingEvidenceSectionPlan,
  catalog: NamingEvidenceCatalog,
  field: 'plain' | 'detail',
): { text: string; parts: string[]; rendered: string[]; missing: string[] } {
  const parts: string[] = [];
  const rendered: string[] = [];
  const missing: string[] = [];
  let connectorIndex = 0;
  for (const reference of section.fragments) {
    const fragment = catalog.fragments[reference.key];
    if (!fragment) {
      missing.push(reference.key);
      continue;
    }
    if (fragment.key !== reference.key || fragment.sectionId !== section.id || fragment.slot !== reference.slot) {
      throw new NamingEvidenceContractError(`catalog.fragments.${reference.key}`, 'fragment identity does not match its plan slot');
    }
    const connectorOptions = reference.relation ? catalog.connectors[reference.relation] : undefined;
    const connector = connectorOptions && connectorOptions.length > 0
      ? connectorOptions[connectorIndex % connectorOptions.length]
      : undefined;
    if (reference.relation) connectorIndex += 1;
    const renderedFragment = interpolate(fragment[field], plan.name, reference.variables);
    const renderedPart = parts.length > 0 && connector
      ? `${interpolate(connector, plan.name)} ${renderedFragment}`
      : renderedFragment;
    parts.push(renderedPart);
    rendered.push(reference.key);
  }
  return { text: parts.join(' ').trim(), parts, rendered, missing };
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
          plainParts: [],
          detailParts: [],
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
        plainParts: plain.parts,
        detailParts: detail.parts,
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
