import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  assembleGeneratedDraft,
  buildEvidenceGenerationPrompt,
  buildEvidenceGenerationTasks,
  selectPilotTasks,
  validateGeneratedTaskResult,
  type EvidenceGenerationTask,
  type GeneratedEvidenceTaskResult,
} from './naming-evidence/generation.js';

const SPRING_TS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GENERATION_ROOT = path.join(SPRING_TS_ROOT, 'data/naming-report/evidence/generation');
const OUTPUT_SCHEMA = path.join(
  SPRING_TS_ROOT,
  'tools/generation/naming-evidence/output.schema.json',
);

function option(argv: readonly string[], name: string): string | undefined {
  const inline = argv.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function integerOption(argv: readonly string[], name: string, fallback: number): number {
  const value = Number(option(argv, name) ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

function selectedTasks(argv: readonly string[]): EvidenceGenerationTask[] {
  const all = buildEvidenceGenerationTasks();
  const pilot = option(argv, '--sample-axis-bundles');
  let tasks = pilot === undefined ? all : selectPilotTasks(all, Number(pilot));
  const taskIds = option(argv, '--tasks')?.split(',').map((value) => value.trim()).filter(Boolean);
  if (taskIds && taskIds.length > 0) {
    const wanted = new Set(taskIds);
    tasks = tasks.filter(({ taskId }) => wanted.has(taskId));
    const found = new Set(tasks.map(({ taskId }) => taskId));
    const missing = taskIds.filter((taskId) => !found.has(taskId));
    if (missing.length > 0) throw new Error(`unknown task ids: ${missing.join(', ')}`);
  }
  return tasks;
}

function runName(argv: readonly string[], tasks: readonly EvidenceGenerationTask[]): string {
  const explicit = option(argv, '--run');
  if (explicit && /^[a-zA-Z0-9._-]+$/u.test(explicit)) return explicit;
  if (explicit) throw new Error('--run accepts only letters, numbers, dot, underscore and hyphen');
  const axisCount = tasks.filter(({ kind }) => kind === 'saju-axis').length;
  return axisCount === 75 ? 'full-v3' : `pilot-axis-${axisCount}`;
}

function writePlan(runDir: string, tasks: readonly EvidenceGenerationTask[]): void {
  fs.mkdirSync(runDir, { recursive: true });
  const promptsDir = path.join(runDir, 'prompts');
  fs.mkdirSync(promptsDir, { recursive: true });
  const plannedTasks = tasks.map((task) => {
    const prompt = buildEvidenceGenerationPrompt(task);
    fs.writeFileSync(path.join(promptsDir, `${task.taskId}.md`), prompt, 'utf8');
    return {
      ...task,
      promptSha256: createHash('sha256').update(prompt, 'utf8').digest('hex'),
    };
  });
  fs.writeFileSync(path.join(runDir, 'plan.json'), `${JSON.stringify({
    schemaVersion: 'namespring.naming-evidence-generation-plan/v1',
    taskCount: tasks.length,
    rowCount: tasks.reduce((count, task) => count + task.items.length, 0),
    tasks: plannedTasks,
  }, null, 2)}\n`, 'utf8');
}

function resultPath(runDir: string, task: EvidenceGenerationTask): string {
  return path.join(runDir, 'results', `${task.taskId}.json`);
}

function readValidatedResult(
  runDir: string,
  task: EvidenceGenerationTask,
  invalidAsMissing = false,
): GeneratedEvidenceTaskResult | null {
  const file = resultPath(runDir, task);
  if (!fs.existsSync(file)) return null;
  try {
    return validateGeneratedTaskResult(task, JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (error) {
    if (!invalidAsMissing) throw error;
    console.warn(`[retry] ${task.taskId}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function codexInvocation(): { command: string; prefixArgs: string[]; shell: boolean } {
  if (process.platform !== 'win32') return { command: 'codex', prefixArgs: [], shell: false };
  const appData = process.env.APPDATA;
  const cli = appData
    ? path.join(appData, 'npm/node_modules/@openai/codex/bin/codex.js')
    : '';
  if (cli && fs.existsSync(cli)) {
    return { command: process.execPath, prefixArgs: [cli], shell: false };
  }
  return { command: 'codex', prefixArgs: [], shell: true };
}

async function generateTask(
  runDir: string,
  task: EvidenceGenerationTask,
  model: string | undefined,
  maxAttempts: number,
): Promise<GeneratedEvidenceTaskResult> {
  const basePrompt = buildEvidenceGenerationPrompt(task);
  const promptsDir = path.join(runDir, 'prompts');
  const rawDir = path.join(runDir, 'raw');
  const resultsDir = path.join(runDir, 'results');
  fs.mkdirSync(promptsDir, { recursive: true });
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(path.join(promptsDir, `${task.taskId}.md`), basePrompt, 'utf8');
  const rawPath = path.join(rawDir, `${task.taskId}.json`);
  let previousError = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const prompt = attempt === 1
      ? basePrompt
      : `${basePrompt}\n\n## 자동 검증 재생성 지시\n이전 응답은 다음 이유로 거절되었습니다: ${previousError}\n해당 문제를 모든 항목에서 제거한 뒤 전체 JSON을 처음부터 다시 작성하세요.\n`;
    const args = [
      'exec', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only',
      '--output-schema', OUTPUT_SCHEMA,
      '--output-last-message', rawPath,
      '--color', 'never',
      '-C', SPRING_TS_ROOT,
    ];
    if (model) args.push('--model', model);
    args.push('-');

    try {
      fs.rmSync(rawPath, { force: true });
      await new Promise<void>((resolve, reject) => {
        const invocation = codexInvocation();
        const child = spawn(invocation.command, [...invocation.prefixArgs, ...args], {
          cwd: SPRING_TS_ROOT,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
          shell: invocation.shell,
        });
        let stderr = '';
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (chunk: string) => { stderr += chunk; });
        child.stdout.resume();
        child.on('error', reject);
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`${task.taskId}: codex exited ${code}\n${stderr.slice(-2000)}`));
        });
        child.stdin.end(prompt);
      });

      if (!fs.existsSync(rawPath)) throw new Error(`${task.taskId}: Codex did not write a final response`);
      const parsed = JSON.parse(fs.readFileSync(rawPath, 'utf8')) as unknown;
      const result = validateGeneratedTaskResult(task, parsed);
      fs.writeFileSync(resultPath(runDir, task), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
      return result;
    } catch (error) {
      previousError = (error instanceof Error ? error.message : String(error))
        .replace(/\s+/gu, ' ')
        .slice(0, 700);
      if (attempt >= maxAttempts) throw error;
      process.stdout.write(`[retry ${attempt + 1}/${maxAttempts}] ${task.taskId}: ${previousError}\n`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw new Error(`${task.taskId}: exhausted generation attempts`);
}

async function runWithConcurrency<T>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const failures: unknown[] = [];
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      try {
        await worker(values[index], index);
      } catch (error) {
        failures.push(error);
      }
    }
  });
  await Promise.all(workers);
  if (failures.length > 0) {
    throw new AggregateError(failures, `${failures.length} generation task(s) failed`);
  }
}

function assemble(runDir: string, tasks: readonly EvidenceGenerationTask[]): string {
  const results = tasks.map((task) => {
    const result = readValidatedResult(runDir, task);
    if (!result) throw new Error(`missing result ${task.taskId}`);
    return result;
  });
  const date = new Date().toISOString().slice(0, 10);
  const draft = assembleGeneratedDraft(tasks, results, `generated-${date}`);
  const output = path.join(runDir, 'naming-evidence.generated-draft.json');
  fs.writeFileSync(output, `${JSON.stringify(draft, null, 2)}\n`, 'utf8');
  const axisTasks = tasks.filter(({ kind }) => kind === 'saju-axis');
  if (axisTasks.length > 0 && axisTasks.length < 75) {
    const resultByTask = new Map(results.map((result) => [result.taskId, result]));
    const sharedItems = tasks
      .filter(({ kind }) => kind !== 'saju-axis')
      .flatMap((task) => resultByTask.get(task.taskId)?.items ?? []);
    const samplesDir = path.join(runDir, 'samples');
    fs.mkdirSync(samplesDir, { recursive: true });
    axisTasks.forEach((task, index) => {
      const sample = {
        schemaVersion: 'namespring.naming-evidence-pilot-sample/v1',
        sampleNumber: index + 1,
        taskId: task.taskId,
        context: task.context,
        axisVariants: resultByTask.get(task.taskId)?.items ?? [],
        sharedEvidenceAndConclusions: sharedItems,
      };
      const number = String(index + 1).padStart(2, '0');
      fs.writeFileSync(
        path.join(samplesDir, `sample-${number}-${task.taskId}.json`),
        `${JSON.stringify(sample, null, 2)}\n`,
        'utf8',
      );
    });
  }
  return output;
}

function printUsage(): void {
  console.log(`Usage:
  npx tsx tools/generation/generate-naming-evidence.ts plan [--sample-axis-bundles N] [--run NAME]
  npx tsx tools/generation/generate-naming-evidence.ts run [--sample-axis-bundles N] [--concurrency N] [--max-attempts N] [--model MODEL] [--run NAME] [--force]
  npx tsx tools/generation/generate-naming-evidence.ts check [--sample-axis-bundles N] [--run NAME]
  npx tsx tools/generation/generate-naming-evidence.ts assemble [--sample-axis-bundles N] [--run NAME]

Full production plan: 75 axis comparison tasks + 7 source-evidence tasks + conclusions = 83 tasks / 473 rows.
Pilot example: --sample-axis-bundles 2 runs the same production prompts for 12 axis rows + 23 shared rows.`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];
  if (!command || command === '--help' || command === '-h') {
    printUsage();
    return;
  }
  const tasks = selectedTasks(argv);
  const name = runName(argv, tasks);
  const runDir = path.join(GENERATION_ROOT, 'runs', name);
  writePlan(runDir, tasks);

  if (command === 'plan') {
    console.log(`plan: ${tasks.length} tasks / ${tasks.reduce((n, task) => n + task.items.length, 0)} rows`);
    console.log(path.relative(SPRING_TS_ROOT, path.join(runDir, 'plan.json')));
    return;
  }
  if (command === 'run') {
    const force = argv.includes('--force');
    const pending = tasks.filter((task) => force || readValidatedResult(runDir, task, true) === null);
    const concurrency = integerOption(argv, '--concurrency', 2);
    const maxAttempts = integerOption(argv, '--max-attempts', 3);
    const model = option(argv, '--model');
    if (model && !/^[a-zA-Z0-9._-]+$/u.test(model)) {
      throw new Error('--model accepts only letters, numbers, dot, underscore and hyphen');
    }
    fs.writeFileSync(path.join(runDir, 'run-metadata.json'), `${JSON.stringify({
      schemaVersion: 'namespring.naming-evidence-generation-run/v1',
      run: name,
      startedAt: new Date().toISOString(),
      model: model ?? 'configured-default',
      concurrency,
      maxAttempts,
      force,
      taskCount: tasks.length,
    }, null, 2)}\n`, 'utf8');
    console.log(`run ${name}: ${pending.length}/${tasks.length} pending, concurrency=${concurrency}, attempts=${maxAttempts}, model=${model ?? 'configured default'}`);
    await runWithConcurrency(pending, concurrency, async (task) => {
      process.stdout.write(`[start] ${task.taskId}\n`);
      await generateTask(runDir, task, model, maxAttempts);
      process.stdout.write(`[done]  ${task.taskId}\n`);
    });
    const output = assemble(runDir, tasks);
    console.log(`draft: ${path.relative(SPRING_TS_ROOT, output)}`);
    return;
  }
  if (command === 'check') {
    for (const task of tasks) {
      if (!readValidatedResult(runDir, task)) throw new Error(`missing result ${task.taskId}`);
    }
    console.log(`valid: ${tasks.length} tasks`);
    return;
  }
  if (command === 'assemble') {
    console.log(`draft: ${path.relative(SPRING_TS_ROOT, assemble(runDir, tasks))}`);
    return;
  }
  throw new Error(`unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
