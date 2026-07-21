import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const API_ROOT = fileURLToPath(new URL("../../api/", import.meta.url));
const REGISTER_ROUTE = "v1/premium/reports/register.ts";
const SERVER_ADAPTER = "_lib/server-spring-engine.ts";

async function source(path: string): Promise<string> {
  return readFile(join(API_ROOT, path), "utf8");
}

async function typescriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) return typescriptFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".ts")
      ? [relative(API_ROOT, absolute).replaceAll("\\", "/")]
      : [];
  }));
  return nested.flat().sort();
}

function withoutTypeOnlyImports(text: string): string {
  return text.replace(/import\s+type\s+[\s\S]*?\s+from\s+["'][^"']+["'];?/gu, "");
}

function coldImportEnvironment(): NodeJS.ProcessEnv {
  const allowed = [
    "PATH",
    "Path",
    "PATHEXT",
    "SYSTEMROOT",
    "SystemRoot",
    "WINDIR",
    "TEMP",
    "TMP",
    "TMPDIR",
    "HOME",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "COMSPEC",
  ] as const;
  const environment: NodeJS.ProcessEnv = { NODE_ENV: "test", CI: "true" };
  for (const name of allowed) {
    if (process.env[name] !== undefined) environment[name] = process.env[name];
  }
  return environment;
}

async function runColdImport(routeUrls: readonly string[]): Promise<{ readonly stdout: string; readonly stderr: string }> {
  const script = `for (const route of ${JSON.stringify(routeUrls)}) await import(route);`;
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", script],
      {
        cwd: fileURLToPath(new URL("../../", import.meta.url)),
        env: coldImportEnvironment(),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("API route cold import exceeded 20 seconds"));
    }, 20_000);
    timeout.unref();
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`API route cold import failed (${signal ?? code})\n${stderr}\n${stdout}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

test("only premium registration dynamically imports the filesystem SpringEngine adapter", async () => {
  const files = await typescriptFiles(API_ROOT);
  const sources = new Map(await Promise.all(files.map(async (path) => [path, await source(path)] as const)));
  const adapterReferences = [...sources]
    .filter(([path, text]) => path !== SERVER_ADAPTER && text.includes("server-spring-engine"))
    .map(([path]) => path);
  assert.deepEqual(adapterReferences, [REGISTER_ROUTE]);

  const register = sources.get(REGISTER_ROUTE);
  assert.ok(register);
  assert.match(register, /await import\("\.\.\/\.\.\/\.\.\/_lib\/server-spring-engine\.js"\)/u);
  assert.doesNotMatch(register, /import\s+(?!type\b)[^;]*server-spring-engine/gu);

  for (const [path, text] of sources) {
    if (path === SERVER_ADAPTER) continue;
    const runtimeImports = withoutTypeOnlyImports(text);
    assert.doesNotMatch(
      runtimeImports,
      /lib\/(?:spring|seed)-ts\/src\/(?:spring-engine|name-stat-summary-repository|database\/)/u,
      `${path} eagerly imports a heavy SpringEngine dependency`,
    );
    assert.doesNotMatch(
      runtimeImports,
      /from\s+["'][^"']*lib\/spring-ts\/src\/index(?:\.js)?["']/u,
      `${path} imports the broad spring-ts barrel`,
    );
  }

  const service = sources.get("_lib/premium-service.ts");
  assert.ok(service);
  assert.match(service, /import type \{ SpringEngine \}/u);
  assert.match(service, /from "\.\/premium-repository-contract\.js"/u);

  const repositoryContract = sources.get("_lib/premium-repository-contract.ts");
  assert.ok(repositoryContract);
  assert.doesNotMatch(
    withoutTypeOnlyImports(repositoryContract),
    /firebase|firestore|premium-(?:repository|crypto|toss)/u,
    "the repository port must remain storage- and provider-neutral",
  );

  const contentPolicy = sources.get("_lib/premium-content-policy.ts");
  assert.ok(contentPolicy);
  assert.match(contentPolicy, /import type \{ SpringEngine \}/u);
  assert.doesNotMatch(
    withoutTypeOnlyImports(contentPolicy),
    /firebase|firestore|premium-repository|premium-toss/u,
    "content policy must not acquire storage or payment-provider dependencies",
  );

  const domainEquality = sources.get("_lib/premium-domain-equality.ts");
  assert.ok(domainEquality);
  assert.doesNotMatch(
    withoutTypeOnlyImports(domainEquality),
    /firebase|firestore|premium-(?:repository|crypto|toss|service)/u,
    "authorization equality must remain a pure domain boundary",
  );
});

test("every API route cold-imports in a secret-free subprocess without starting engine or storage work", async () => {
  const files = (await typescriptFiles(API_ROOT)).filter((path) => !path.startsWith("_lib/"));
  assert.ok(files.length >= 40, "route discovery unexpectedly omitted API modules");
  const routeUrls = files.map((path) => pathToFileURL(join(API_ROOT, path)).href);
  const result = await runColdImport(routeUrls);
  assert.equal(result.stdout, "", "cold imports must not emit startup output");
  assert.equal(result.stderr, "", "cold imports must not emit startup warnings");
});
