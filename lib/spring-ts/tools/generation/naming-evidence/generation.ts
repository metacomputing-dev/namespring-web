import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { namingEvidenceWeightPolicyForPrompt } from '../../../src/naming-evidence-weight-policy.js';

export const ELEMENTS = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'] as const;
export const STRENGTHS = ['weak', 'balanced', 'strong'] as const;
export const GYEOKGUK_FAMILIES = [
  'inseong', 'siksang', 'jaeseong', 'gwanseong', 'bigeop', 'special',
] as const;
export const CONCLUSION_TONES = [
  'allPositive', 'mostlyPositive', 'mixedButUsable', 'needsCaution', 'insufficientEvidence',
] as const;

export type EvidenceElement = typeof ELEMENTS[number];
export type EvidenceStrength = typeof STRENGTHS[number];
export type EvidenceGyeokguk = typeof GYEOKGUK_FAMILIES[number];
export type EvidenceConclusionTone = typeof CONCLUSION_TONES[number];
export type EvidenceGenerationTaskKind = 'saju-axis' | 'source-evidence' | 'conclusion';

const SOURCE_PLACEHOLDER_CONTRACT: Readonly<Record<string, readonly string[]>> = {
  'source/balance/improves': ['{{filledElements}}'],
  'source/balance/holds': [],
  'source/balance/worsens': ['{{excessiveElements}}'],
  'source/yongshin/yongshin': ['{{matchedElements}}'],
  'source/yongshin/heesin': ['{{matchedElements}}'],
  'source/yongshin/neutral': [],
  'source/strength/supportsNeededDirection': ['{{alignedElements}}'],
  'source/strength/mixed': ['{{alignedElements}}', '{{opposedElements}}'],
  'source/strength/opposesNeededDirection': ['{{opposedElements}}'],
  'source/tenGod/fillsDeficit': ['{{supportiveElements}}'],
  'source/tenGod/neutral': [],
  'source/tenGod/reinforcesExcess': ['{{limitingElements}}'],
  'source/deficiency/yongshinDeficiencyFilled': ['{{matchedElements}}'],
  'source/deficiency/heesinDeficiencyFilled': ['{{matchedElements}}'],
  'source/harmfulElement/gisinPresent': ['{{harmfulElements}}'],
  'source/harmfulElement/gusinPresent': ['{{harmfulElements}}'],
  'source/gyeokgukProtection/protected': [],
  'source/gyeokgukProtection/broken': [],
};

const SOURCE_PLAIN_FUNCTION_PLACEHOLDER_CONTRACT: Readonly<Record<string, readonly string[]>> = {
  'source/balance/improves': ['{{filledElementFunctions}}'],
  'source/balance/holds': [],
  'source/balance/worsens': ['{{excessiveElementFunctions}}'],
  'source/yongshin/yongshin': ['{{matchedElementFunctions}}'],
  'source/yongshin/heesin': ['{{matchedElementFunctions}}'],
  'source/yongshin/neutral': [],
  'source/strength/supportsNeededDirection': ['{{alignedElementFunctions}}'],
  'source/strength/mixed': ['{{alignedElementFunctions}}', '{{opposedElementFunctions}}'],
  'source/strength/opposesNeededDirection': ['{{opposedElementFunctions}}'],
  'source/tenGod/fillsDeficit': ['{{supportiveElementFunctions}}'],
  'source/tenGod/neutral': [],
  'source/tenGod/reinforcesExcess': ['{{limitingElementFunctions}}'],
  'source/deficiency/yongshinDeficiencyFilled': ['{{matchedElementFunctions}}'],
  'source/deficiency/heesinDeficiencyFilled': ['{{matchedElementFunctions}}'],
  'source/harmfulElement/gisinPresent': ['{{harmfulElementFunctions}}'],
  'source/harmfulElement/gusinPresent': ['{{harmfulElementFunctions}}'],
  'source/gyeokgukProtection/protected': [],
  'source/gyeokgukProtection/broken': [],
};

const SOURCE_VALUE_PLACEHOLDERS = [
  '{{filledElements}}', '{{excessiveElements}}', '{{matchedElements}}', '{{harmfulElements}}',
  '{{alignedElements}}', '{{opposedElements}}', '{{supportiveElements}}', '{{limitingElements}}',
  '{{filledElementFunctions}}', '{{excessiveElementFunctions}}', '{{matchedElementFunctions}}',
  '{{harmfulElementFunctions}}', '{{alignedElementFunctions}}', '{{opposedElementFunctions}}',
  '{{supportiveElementFunctions}}', '{{limitingElementFunctions}}',
] as const;

export interface EvidenceGenerationItemSpec {
  readonly key: string;
  readonly values: Readonly<Record<string, string>>;
}

export interface EvidenceGenerationTask {
  readonly taskId: string;
  readonly kind: EvidenceGenerationTaskKind;
  readonly context: Readonly<Record<string, unknown>>;
  readonly items: readonly EvidenceGenerationItemSpec[];
}

export interface GeneratedEvidenceItem {
  readonly key: string;
  readonly plain: string;
  readonly detail: string;
}

export interface GeneratedEvidenceTaskResult {
  readonly taskId: string;
  readonly items: readonly GeneratedEvidenceItem[];
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_DIR = path.join(HERE, 'prompt');

const ELEMENT_LABELS: Readonly<Record<EvidenceElement, string>> = {
  WOOD: '목', FIRE: '화', EARTH: '토', METAL: '금', WATER: '수',
};
const STRENGTH_LABELS: Readonly<Record<EvidenceStrength, string>> = {
  weak: '신약', balanced: '중화', strong: '신강',
};
const GYEOKGUK_LABELS: Readonly<Record<EvidenceGyeokguk, string>> = {
  inseong: '인성', siksang: '식상', jaeseong: '재성',
  gwanseong: '관성', bigeop: '비겁', special: '특수격',
};
function axisTask(
  dayMasterElement: EvidenceElement,
  strength: EvidenceStrength,
  yongshinElement: EvidenceElement,
): EvidenceGenerationTask {
  return {
    taskId: `axis-${dayMasterElement}-${strength}-${yongshinElement}`,
    kind: 'saju-axis',
    context: {
      dayMasterElement: { code: dayMasterElement, label: ELEMENT_LABELS[dayMasterElement] },
      strength: { code: strength, label: STRENGTH_LABELS[strength] },
      yongshinElement: { code: yongshinElement, label: ELEMENT_LABELS[yongshinElement] },
      comparisonRule: '격국 계열에 따라 작명 방향이 어떻게 달라지는지 여섯 항목을 비교하여 작성',
    },
    items: GYEOKGUK_FAMILIES.map((gyeokgukFamily) => ({
      key: `saju-axis/${dayMasterElement}/${strength}/${yongshinElement}/${gyeokgukFamily}`,
      values: {
        dayMasterElement,
        dayMasterLabel: ELEMENT_LABELS[dayMasterElement],
        strength,
        strengthLabel: STRENGTH_LABELS[strength],
        yongshinElement,
        yongshinLabel: ELEMENT_LABELS[yongshinElement],
        gyeokgukFamily,
        gyeokgukLabel: GYEOKGUK_LABELS[gyeokgukFamily],
      },
    })),
  };
}

function valueAtPath(source: Readonly<Record<string, unknown>>, pathValue: string): unknown {
  return pathValue.split('.').reduce<unknown>((value, key) => (
    value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined
  ), source);
}

function sourceEvidenceTasks(): EvidenceGenerationTask[] {
  const policy = namingEvidenceWeightPolicyForPrompt();
  const sources = policy.narrativeEvidence as Readonly<Record<string, {
    readonly label: string;
    readonly calculationKind: 'weightedRatio' | 'bonusPointCap' | 'penaltyPointCap';
    readonly calculationValueRef: string;
    readonly calculationValueRangeRef?: readonly string[];
    readonly maxScoreImpact: number;
    readonly maxScoreImpactRange?: readonly number[];
    readonly states: readonly string[];
  }>>;
  const weightTable = Object.fromEntries(Object.entries(sources).map(([sourceId, source]) => [sourceId, {
    label: source.label,
    calculationKind: source.calculationKind,
    calculationValue: valueAtPath(policy, source.calculationValueRef),
    ...(source.calculationValueRangeRef
      ? { calculationValueRange: source.calculationValueRangeRef.map((ref) => valueAtPath(policy, ref)) }
      : {}),
    maxScoreImpact: source.maxScoreImpact,
    ...(source.maxScoreImpactRange ? { maxScoreImpactRange: source.maxScoreImpactRange } : {}),
  }]));
  return Object.entries(sources).map(([sourceId, source]) => ({
    taskId: `source-${sourceId}`,
    kind: 'source-evidence' as const,
    context: {
      modelVersion: policy.modelVersion,
      sourceId,
      sourceLabel: source.label,
      weight: source.maxScoreImpact,
      calculationKind: source.calculationKind,
      calculationValue: valueAtPath(policy, source.calculationValueRef),
      ...(source.calculationValueRangeRef
        ? { calculationValueRange: source.calculationValueRangeRef.map((ref) => valueAtPath(policy, ref)) }
        : {}),
      maxScoreImpact: source.maxScoreImpact,
      ...(source.maxScoreImpactRange ? { maxScoreImpactRange: source.maxScoreImpactRange } : {}),
      weightTable,
      yongshinMethodWeights: policy.yongshinTypeWeights,
      presetOverrides: policy.presetOverrides,
      rule: '점수 등급을 말하지 말고 계산에서 관찰된 원천 사실과 추천 판단의 인과만 작성',
    },
    items: source.states.map((state) => ({
      key: `source/${sourceId}/${state}`,
      values: {
        sourceId,
        sourceLabel: source.label,
        state,
        weight: String(source.maxScoreImpact),
      },
    })),
  }));
}

function conclusionTask(): EvidenceGenerationTask {
  return {
    taskId: 'conclusions',
    kind: 'conclusion',
    context: { section: 'sajuFit', responsibility: '앞선 근거를 추천 판단으로 정리' },
    items: CONCLUSION_TONES.map((tone) => ({
      key: `conclusion/sajuFit/${tone}`,
      values: { tone },
    })),
  };
}

export function buildEvidenceGenerationTasks(): EvidenceGenerationTask[] {
  const tasks: EvidenceGenerationTask[] = [];
  for (const dayMasterElement of ELEMENTS) {
    for (const strength of STRENGTHS) {
      for (const yongshinElement of ELEMENTS) {
        tasks.push(axisTask(dayMasterElement, strength, yongshinElement));
      }
    }
  }
  tasks.push(...sourceEvidenceTasks(), conclusionTask());
  return tasks;
}

export function selectPilotTasks(
  tasks: readonly EvidenceGenerationTask[],
  axisBundleCount: number,
): EvidenceGenerationTask[] {
  if (!Number.isSafeInteger(axisBundleCount) || axisBundleCount < 1) {
    throw new Error('axisBundleCount must be a positive integer');
  }
  const axisTasks = tasks.filter(({ kind }) => kind === 'saju-axis');
  if (axisBundleCount >= axisTasks.length) return [...tasks];
  const selected = new Set<number>();
  for (let index = 0; index < axisBundleCount; index += 1) {
    selected.add(Math.floor(index * axisTasks.length / axisBundleCount));
  }
  return [
    ...axisTasks.filter((_, index) => selected.has(index)),
    ...tasks.filter(({ kind }) => kind !== 'saju-axis'),
  ];
}

function readPrompt(name: string): string {
  return fs.readFileSync(path.join(PROMPT_DIR, name), 'utf8').trim();
}

export function buildEvidenceGenerationPrompt(task: EvidenceGenerationTask): string {
  const common = readPrompt('common-writing-contract.md');
  const domain = task.kind === 'saju-axis'
    ? `\n\n${readPrompt('domain-guide.md')}`
    : task.kind === 'source-evidence'
      ? `\n\n${readPrompt('source-evidence-domain-guide.md')}`
      : '';
  const templateName = task.kind === 'saju-axis'
    ? 'saju-axis-task.md'
    : task.kind === 'source-evidence'
      ? 'source-evidence-task.md'
      : 'conclusion-task.md';
  const taskJson = JSON.stringify({
    taskId: task.taskId,
    kind: task.kind,
    context: task.context,
    items: task.items,
  }, null, 2);
  const taskPrompt = readPrompt(templateName).replace('{{TASK_JSON}}', taskJson);
  return `${common}${domain}\n\n${taskPrompt}\n`;
}

function compactLength(value: string): number {
  return [...value.replace(/\s+/gu, '')].length;
}

function assertTextShape(task: EvidenceGenerationTask, item: GeneratedEvidenceItem): void {
  for (const field of ['plain', 'detail'] as const) {
    const text = item[field];
    if (typeof text !== 'string' || text.trim() !== text || text.length === 0) {
      throw new Error(`${task.taskId}/${item.key}.${field}: non-empty trimmed text required`);
    }
    if (/\r|\n/u.test(text)) throw new Error(`${task.taskId}/${item.key}.${field}: line breaks are not allowed`);
    if (/^\s*(하지만|또한|따라서|반면|그리고|다만|이러한|이처럼|그 결과|이 경우)\b/u.test(text)) {
      throw new Error(`${task.taskId}/${item.key}.${field}: fragment starts with a dependent connector`);
    }
    if (/(고른 결|낮은 흐름|기운의 그릇|삶의 리듬|운명을|반드시|무조건)/u.test(text)) {
      throw new Error(`${task.taskId}/${item.key}.${field}: banned or over-deterministic wording`);
    }
    if (field === 'plain' && /(현재 작명 판단|추천 판단|추천 근거|제한 요인|중심 보완|핵심 보완|종합 적합성|사용 가능한 후보|주요 판단|전체 설명|중간 성격의 요소|조절 효과|세부 성향|추천에는 제한적으로 보)/u.test(text)) {
      throw new Error(`${task.taskId}/${item.key}.plain: internal evaluation wording is not allowed`);
    }
    if (field === 'plain' && /(기능(?:이|을)?\s*(?:반영|작용)|(?:성분|기운)(?:이|은|는)?\s*확인|성분(?:이|은|는)?\s*작용|근거(?:가|는)?\s*확인)/u.test(text)) {
      throw new Error(`${task.taskId}/${item.key}.plain: mechanical scoring wording is not allowed`);
    }
    if (task.kind === 'source-evidence' && /(앞서 본|앞선 내용|앞의 주요 판단)/u.test(text)) {
      throw new Error(`${task.taskId}/${item.key}.${field}: repeated cross-fragment reference is not allowed`);
    }
    if (/\b(?:WOOD|FIRE|EARTH|METAL|WATER|sajuFit|yongshinFit|elementBalance|excellent|good|mixed|caution)\b/u.test(text)) {
      throw new Error(`${task.taskId}/${item.key}.${field}: internal identifier leaked into prose`);
    }
    const proseWithoutPlaceholders = text.replace(/\{\{[^}]+\}\}/gu, '');
    if (/(?:balance|yongshin|strength|tenGod|deficiency|harmfulElement|gyeokgukProtection)/u.test(proseWithoutPlaceholders)) {
      throw new Error(`${task.taskId}/${item.key}.${field}: source identifier leaked into prose`);
    }
    const unknownPlaceholders = [...text.matchAll(/\{\{[^}]+\}\}/gu)]
      .map(([placeholder]) => placeholder)
      .filter((placeholder) => ![
        '{{name}}', '{{name:topic}}', '{{filledElements}}', '{{excessiveElements}}',
        '{{matchedElements}}', '{{harmfulElements}}', '{{alignedElements}}',
        '{{opposedElements}}', '{{supportiveElements}}', '{{limitingElements}}',
        '{{filledElementFunctions}}', '{{excessiveElementFunctions}}', '{{matchedElementFunctions}}',
        '{{harmfulElementFunctions}}', '{{alignedElementFunctions}}', '{{opposedElementFunctions}}',
        '{{supportiveElementFunctions}}', '{{limitingElementFunctions}}',
      ].includes(placeholder));
    if (unknownPlaceholders.length > 0) {
      throw new Error(`${task.taskId}/${item.key}.${field}: unsupported placeholder ${unknownPlaceholders[0]}`);
    }
    if (/\{\{name:topic\}\}(?:은|는|이|가|을|를|에|에서|으로|로|와|과)/u.test(text)) {
      throw new Error(`${task.taskId}/${item.key}.${field}: {{name:topic}} already contains the topic particle`);
    }
  }

  if (/(일간|신강|신약|중화|용신|격국|인성|식상|재성|관성|비겁|특수격)/u.test(item.plain)) {
    throw new Error(`${task.taskId}/${item.key}.plain: professional saju vocabulary is not allowed`);
  }

  if (task.kind === 'source-evidence') {
    const expected = SOURCE_PLACEHOLDER_CONTRACT[item.key];
    const expectedPlainFunctions = SOURCE_PLAIN_FUNCTION_PLACEHOLDER_CONTRACT[item.key];
    if (!expected) throw new Error(`${task.taskId}/${item.key}: missing source placeholder contract`);
    if (!expectedPlainFunctions) throw new Error(`${task.taskId}/${item.key}: missing source function placeholder contract`);
    if (/\{\{name(?::topic)?\}\}/u.test(`${item.plain} ${item.detail}`)) {
      throw new Error(`${task.taskId}/${item.key}: source fragments must not repeat the name placeholder`);
    }
    if (/^이 이름(?:은|는|이|가|을|를|에|에는|에서|의|\s)/u.test(item.plain)) {
      throw new Error(`${task.taskId}/${item.key}.plain: source fragment must not begin with a repeated name subject`);
    }
    for (const field of ['plain', 'detail'] as const) {
      const required = field === 'plain' ? [...expected, ...expectedPlainFunctions] : expected;
      for (const placeholder of required) {
        if (!item[field].includes(placeholder)) {
          throw new Error(`${task.taskId}/${item.key}.${field}: required placeholder ${placeholder} is missing`);
        }
      }
      const unexpected = SOURCE_VALUE_PLACEHOLDERS.find(
        (placeholder) => item[field].includes(placeholder) && !required.includes(placeholder),
      );
      if (unexpected) {
        throw new Error(`${task.taskId}/${item.key}.${field}: placeholder ${unexpected} is not available for this state`);
      }
    }
  }

  const lengths = task.kind === 'saju-axis'
    ? { plain: [60, 230], detail: [65, 280] }
    : task.kind === 'source-evidence'
      ? { plain: [40, 180], detail: [35, 190] }
      : { plain: [25, 130], detail: [35, 160] };
  for (const field of ['plain', 'detail'] as const) {
    const length = compactLength(item[field]);
    const [minimum, maximum] = lengths[field];
    if (length < minimum || length > maximum) {
      throw new Error(`${task.taskId}/${item.key}.${field}: length ${length} outside ${minimum}..${maximum}`);
    }
  }
}

function assertTaskSemantics(task: EvidenceGenerationTask, item: GeneratedEvidenceItem): void {
  const spec = task.items.find(({ key }) => key === item.key)!;
  if (task.kind === 'saju-axis') {
    const required = [
      `${spec.values.dayMasterLabel} 일간`,
      spec.values.strengthLabel,
      spec.values.gyeokgukLabel,
    ];
    for (const term of required) {
      if (!item.detail.includes(term)) {
        throw new Error(`${task.taskId}/${item.key}.detail: required domain term missing: ${term}`);
      }
    }
    const yongshinPattern = new RegExp(
      `(?:${spec.values.yongshinLabel}\\s*용신|용신(?:은|이|도|으로|에는|이면서)?\\s*${spec.values.yongshinLabel})`,
      'u',
    );
    if (!yongshinPattern.test(item.detail)) {
      throw new Error(`${task.taskId}/${item.key}.detail: yongshin element is not stated naturally and explicitly`);
    }
  }
  if (task.kind === 'source-evidence' && /(이름의 인상|이름의 느낌|발음|한자 뜻|점수|등급)/u.test(`${item.plain} ${item.detail}`)) {
    throw new Error(`${task.taskId}/${item.key}: unsupported name evidence was invented`);
  }
  if (task.kind === 'conclusion') {
    const tone = spec.values.tone;
    if ((tone === 'mixedButUsable' || tone === 'needsCaution')
      && /(좋은 이름|추천할 만한 이름|충분한 후보|추천 후보로 충분|추천하기 충분|잘 맞는 이름)/u.test(`${item.plain} ${item.detail}`)) {
      throw new Error(`${task.taskId}/${item.key}: conclusion is more positive than its tone`);
    }
    if (tone === 'mixedButUsable' && !/(비교|장점|아쉬운|함께 살펴)/u.test(item.plain)) {
      throw new Error(`${task.taskId}/${item.key}.plain: mixed conclusion must communicate comparison or trade-offs`);
    }
    if (tone === 'needsCaution' && !/(다른 후보|우선 추천|비교)/u.test(item.plain)) {
      throw new Error(`${task.taskId}/${item.key}.plain: caution conclusion must clearly recommend another comparison`);
    }
  }
}

export function validateGeneratedTaskResult(
  task: EvidenceGenerationTask,
  value: unknown,
): GeneratedEvidenceTaskResult {
  if (!value || typeof value !== 'object') throw new Error(`${task.taskId}: object result required`);
  const candidate = value as { taskId?: unknown; items?: unknown };
  if (candidate.taskId !== task.taskId) throw new Error(`${task.taskId}: returned taskId does not match`);
  if (!Array.isArray(candidate.items)) throw new Error(`${task.taskId}: items array required`);
  const items = candidate.items as GeneratedEvidenceItem[];
  const expectedKeys = new Set(task.items.map(({ key }) => key));
  const actualKeys = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== 'object' || typeof item.key !== 'string') {
      throw new Error(`${task.taskId}: every item requires a string key`);
    }
    if (!expectedKeys.has(item.key)) throw new Error(`${task.taskId}: unexpected key ${item.key}`);
    if (actualKeys.has(item.key)) throw new Error(`${task.taskId}: duplicate key ${item.key}`);
    actualKeys.add(item.key);
    assertTextShape(task, item);
    assertTaskSemantics(task, item);
  }
  for (const key of expectedKeys) {
    if (!actualKeys.has(key)) throw new Error(`${task.taskId}: missing key ${key}`);
  }
  if (actualKeys.size !== expectedKeys.size) throw new Error(`${task.taskId}: item count mismatch`);
  return { taskId: task.taskId, items };
}

export interface NamingEvidenceGeneratedDraft {
  readonly schemaVersion: 'namespring.naming-evidence-generated-draft/v2';
  readonly contentVersion: string;
  readonly scope: 'pilot' | 'full';
  readonly taskCount: number;
  readonly rowCount: number;
  readonly sajuAxisExplanations: readonly Record<string, string>[];
  readonly sourceEvidenceExplanations: readonly Record<string, string>[];
  readonly conclusionExplanations: readonly Record<string, string>[];
  readonly connectors: readonly never[];
}

export function assembleGeneratedDraft(
  tasks: readonly EvidenceGenerationTask[],
  results: readonly GeneratedEvidenceTaskResult[],
  contentVersion: string,
): NamingEvidenceGeneratedDraft {
  const resultMap = new Map(results.map((result) => [result.taskId, result]));
  const missing = tasks.filter(({ taskId }) => !resultMap.has(taskId));
  if (missing.length > 0) throw new Error(`missing task results: ${missing.map(({ taskId }) => taskId).join(', ')}`);
  const sajuAxisExplanations: Record<string, string>[] = [];
  const sourceEvidenceExplanations: Record<string, string>[] = [];
  const conclusionExplanations: Record<string, string>[] = [];
  const seenText = new Map<string, string>();

  for (const task of tasks) {
    const result = validateGeneratedTaskResult(task, resultMap.get(task.taskId));
    const itemMap = new Map(result.items.map((item) => [item.key, item]));
    for (const spec of task.items) {
      const item = itemMap.get(spec.key)!;
      for (const field of ['plain', 'detail'] as const) {
        const fingerprint = item[field].replace(/\{\{name(?::topic)?\}\}/gu, '{{name}}').replace(/\s+/gu, '');
        const previous = seenText.get(fingerprint);
        if (previous) throw new Error(`duplicate ${field} text: ${previous} and ${spec.key}`);
        seenText.set(fingerprint, spec.key);
      }
      if (task.kind === 'saju-axis') {
        sajuAxisExplanations.push({ ...spec.values, plain: item.plain, detail: item.detail });
      } else if (task.kind === 'source-evidence') {
        sourceEvidenceExplanations.push({
          sourceId: spec.values.sourceId,
          state: spec.values.state,
          weight: spec.values.weight,
          plain: item.plain,
          detail: item.detail,
        });
      } else {
        conclusionExplanations.push({ tone: spec.values.tone, plain: item.plain, detail: item.detail });
      }
    }
  }
  const rowCount = sajuAxisExplanations.length + sourceEvidenceExplanations.length + conclusionExplanations.length;
  return {
    schemaVersion: 'namespring.naming-evidence-generated-draft/v2',
    contentVersion,
    scope: sajuAxisExplanations.length === 450 ? 'full' : 'pilot',
    taskCount: tasks.length,
    rowCount,
    sajuAxisExplanations,
    sourceEvidenceExplanations,
    conclusionExplanations,
    connectors: [],
  };
}
