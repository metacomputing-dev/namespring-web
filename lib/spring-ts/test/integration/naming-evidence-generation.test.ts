import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assembleGeneratedDraft,
  buildEvidenceGenerationPrompt,
  buildEvidenceGenerationTasks,
  selectPilotTasks,
  validateGeneratedTaskResult,
  type EvidenceGenerationTask,
  type GeneratedEvidenceItem,
  type GeneratedEvidenceTaskResult,
} from '../../tools/generation/naming-evidence/generation.js';

function axisResult(task: EvidenceGenerationTask): GeneratedEvidenceTaskResult {
  const items: GeneratedEvidenceItem[] = task.items.map((item, index) => ({
    key: item.key,
    plain: `스스로 방향을 정하는 힘과 주변 상황을 받아들이는 속도 사이에 차이가 생기기 쉬워요. 이름에는 ${index + 1}번째 기준으로 무리하게 힘을 더하기보다 필요한 역할을 꾸준히 이어 주는 성분이 필요해요.`,
    detail: `${item.values.dayMasterLabel} 일간과 ${item.values.strengthLabel}의 결합은 기본 성향이 힘을 쓰는 방식과 외부 조건을 받아들이는 정도를 함께 보여 줘요. ${item.values.yongshinLabel} 용신이 요구하는 기능을 ${item.values.gyeokgukLabel}의 작동 방식으로 연결해야 이름이 담당할 보완 방향과 판단 기준이 분명해져요.`,
  }));
  return { taskId: task.taskId, items };
}

function sharedResult(task: EvidenceGenerationTask): GeneratedEvidenceTaskResult {
  const taskMarker = [...task.taskId]
    .reduce((hash, character) => Math.imul(hash, 31) + character.codePointAt(0)!, 7) >>> 0;
  return {
    taskId: task.taskId,
    items: task.items.map((item, index) => ({
      key: item.key,
      plain: task.kind === 'source-evidence'
        ? `계산에서 확인된 ${taskMarker}-${index + 1} 원천 사실은 이름이 필요한 방향을 돕는지 구체적으로 판단할 수 있게 해요.`
        : `최종 판단의 ${index + 1}번째 유형은 앞서 확인한 원천 사실의 장점과 제한을 함께 비교해 추천 여부를 정리해요.`,
      detail: task.kind === 'source-evidence'
        ? `${item.values.sourceLabel}의 ${index + 1}번째 상태는 실제 계산에 반영된 사실을 설명하며, 다른 평가를 되풀이하지 않고 해당 근거의 작용만 구분해서 보여 줘요.`
        : `최종 결론의 ${index + 1}번째 유형은 앞선 원천 근거의 상대적 영향과 제한을 종합하되 새로운 분석을 덧붙이지 않아요.`,
    })),
  };
}

const TEST_SOURCE_PLACEHOLDERS: Readonly<Record<string, string>> = {
  'source/balance/improves': '{{filledElements}} {{filledElementFunctions}}',
  'source/balance/worsens': '{{excessiveElements}} {{excessiveElementFunctions}}',
  'source/yongshin/yongshin': '{{matchedElements}} {{matchedElementFunctions}}',
  'source/yongshin/heesin': '{{matchedElements}} {{matchedElementFunctions}}',
  'source/strength/supportsNeededDirection': '{{alignedElements}} {{alignedElementFunctions}}',
  'source/strength/mixed': '{{alignedElements}} {{opposedElements}} {{alignedElementFunctions}} {{opposedElementFunctions}}',
  'source/strength/opposesNeededDirection': '{{opposedElements}} {{opposedElementFunctions}}',
  'source/tenGod/fillsDeficit': '{{supportiveElements}} {{supportiveElementFunctions}}',
  'source/tenGod/reinforcesExcess': '{{limitingElements}} {{limitingElementFunctions}}',
  'source/deficiency/yongshinDeficiencyFilled': '{{matchedElements}} {{matchedElementFunctions}}',
  'source/deficiency/heesinDeficiencyFilled': '{{matchedElements}} {{matchedElementFunctions}}',
  'source/harmfulElement/gisinPresent': '{{harmfulElements}} {{harmfulElementFunctions}}',
  'source/harmfulElement/gusinPresent': '{{harmfulElements}} {{harmfulElementFunctions}}',
};

function satisfySourcePlaceholderContract(
  task: EvidenceGenerationTask,
  result: GeneratedEvidenceTaskResult,
): GeneratedEvidenceTaskResult {
  if (task.kind !== 'source-evidence') return result;
  return {
    ...result,
    items: result.items.map((item) => {
      const placeholders = TEST_SOURCE_PLACEHOLDERS[item.key];
      if (!placeholders) return item;
      const valuePlaceholders = placeholders.split(' ').filter((placeholder) => !placeholder.includes('Functions'));
      return valuePlaceholders.length > 0
        ? { ...item, plain: `${item.plain} ${placeholders}`, detail: `${item.detail} ${valuePlaceholders.join(' ')}` }
        : item;
    }),
  };
}

test('plans the complete 473-row production corpus without cartesian score expansion', () => {
  const tasks = buildEvidenceGenerationTasks();
  assert.equal(tasks.length, 83);
  assert.equal(tasks.filter(({ kind }) => kind === 'saju-axis').length, 75);
  assert.equal(tasks.reduce((count, task) => count + task.items.length, 0), 473);
  const keys = tasks.flatMap((task) => task.items.map(({ key }) => key));
  assert.equal(new Set(keys).size, 473);
});

test('keeps every axis production task as a six-gyeokguk comparison bundle', () => {
  const task = buildEvidenceGenerationTasks()[0];
  assert.equal(task.kind, 'saju-axis');
  assert.equal(task.items.length, 6);
  assert.deepEqual(
    task.items.map(({ values }) => values.gyeokgukFamily),
    ['inseong', 'siksang', 'jaeseong', 'gwanseong', 'bigeop', 'special'],
  );
});

test('selects a representative pilot while retaining shared production fragments', () => {
  const pilot = selectPilotTasks(buildEvidenceGenerationTasks(), 2);
  assert.equal(pilot.length, 10);
  assert.equal(pilot.reduce((count, task) => count + task.items.length, 0), 35);
  assert.deepEqual(pilot.slice(-2).map(({ taskId }) => taskId), ['source-gyeokgukProtection', 'conclusions']);
});

test('assembles the Korean contracts and exact task payload into each prompt', () => {
  const task = buildEvidenceGenerationTasks()[0];
  const prompt = buildEvidenceGenerationPrompt(task);
  assert.match(prompt, /이름봄은 사주 풀이 서비스가 아니라 이름을 제안하는 작명 서비스다/u);
  assert.match(prompt, /여섯 격국 결과의 첫 문장 구조와 종결 표현을 반복하지 않는다/u);
  assert.match(prompt, new RegExp(task.taskId, 'u'));
  assert.doesNotMatch(prompt, /\{\{TASK_JSON\}\}/u);
  const sourcePrompt = buildEvidenceGenerationPrompt(buildEvidenceGenerationTasks().find(({ taskId }) => taskId === 'source-balance')!);
  assert.match(sourcePrompt, /실제 점수 계산 모델과 동일한 설정/u);
  assert.match(sourcePrompt, /"calculationKind": "weightedRatio"/u);
  assert.match(sourcePrompt, /"calculationValue": 0\.6/u);
  assert.match(sourcePrompt, /"maxScoreImpact": 60/u);
  assert.match(sourcePrompt, /원천 근거에서는 이름 자리표시자를 아예 사용하지 않는다/u);
  assert.match(sourcePrompt, /\{\{filledElementFunctions\}\}/u);
});

test('rejects repeated name subjects in source evidence fragments', () => {
  const task = buildEvidenceGenerationTasks().find(({ taskId }) => taskId === 'source-balance')!;
  const result = satisfySourcePlaceholderContract(task, sharedResult(task));
  const invalid = {
    ...result,
    items: result.items.map((item, index) => index === 0
      ? { ...item, plain: `{{name}}에는 ${item.plain}` }
      : item),
  };
  assert.throws(() => validateGeneratedTaskResult(task, invalid), /must not repeat the name placeholder/u);
});

test('rejects a repeated cross-fragment reference from independently generated source evidence', () => {
  const task = buildEvidenceGenerationTasks().find(({ taskId }) => taskId === 'source-balance')!;
  const result = satisfySourcePlaceholderContract(task, sharedResult(task));
  const invalid = {
    ...result,
    items: result.items.map((item, index) => index === 0
      ? { ...item, plain: `앞서 본 방향을 기준으로 ${item.plain}` }
      : item),
  };
  assert.throws(() => validateGeneratedTaskResult(task, invalid), /cross-fragment reference/u);
});

test('rejects internal evaluation language from user-facing prose', () => {
  const task = buildEvidenceGenerationTasks().find(({ taskId }) => taskId === 'source-balance')!;
  const result = satisfySourcePlaceholderContract(task, sharedResult(task));
  const invalid = {
    ...result,
    items: result.items.map((item, index) => index === 0
      ? { ...item, plain: `현재 작명 판단의 중심 보완으로 ${item.plain}` }
      : item),
  };
  assert.throws(() => validateGeneratedTaskResult(task, invalid), /internal evaluation wording/u);
});

test('rejects an overly positive conclusion for mixed or caution tones', () => {
  const task = buildEvidenceGenerationTasks().find(({ taskId }) => taskId === 'conclusions')!;
  const result = sharedResult(task);
  const invalid = {
    ...result,
    items: result.items.map((item) => item.key.endsWith('/mixedButUsable')
      ? { ...item, plain: '장단점을 함께 살펴도 추천할 만한 좋은 이름이므로 이 후보를 선택해도 충분해요.' }
      : item.key.endsWith('/needsCaution')
        ? { ...item, plain: '다른 후보와 비교해 보더라도 충분한 후보이므로 그대로 결정해도 좋아요.' }
        : item),
  };
  assert.throws(() => validateGeneratedTaskResult(task, invalid), /more positive than its tone/u);
});

test('validates and assembles a pilot generated through the production task shapes', () => {
  const tasks = selectPilotTasks(buildEvidenceGenerationTasks(), 1);
  const results = tasks.map((task) => satisfySourcePlaceholderContract(
    task,
    task.kind === 'saju-axis' ? axisResult(task) : sharedResult(task),
  ));
  for (let index = 0; index < tasks.length; index += 1) {
    validateGeneratedTaskResult(tasks[index], results[index]);
  }
  const draft = assembleGeneratedDraft(tasks, results, 'test-v1');
  assert.equal(draft.scope, 'pilot');
  assert.equal(draft.sajuAxisExplanations.length, 6);
  assert.equal(draft.sourceEvidenceExplanations.length, 18);
  assert.equal(draft.conclusionExplanations.length, 5);
});

test('rejects professional vocabulary leaked into a plain axis explanation', () => {
  const task = buildEvidenceGenerationTasks()[0];
  const result = axisResult(task);
  const invalid = {
    ...result,
    items: result.items.map((item, index) => index === 0
      ? { ...item, plain: `용신을 직접 설명하는 문장은 기본 화면에 노출하면 안 돼요. 이름에 필요한 방향을 쉽게 이해하도록 풀어 써야 하며 충분한 길이도 갖춰야 해요.` }
      : item),
  };
  assert.throws(() => validateGeneratedTaskResult(task, invalid), /professional saju vocabulary/u);
});
