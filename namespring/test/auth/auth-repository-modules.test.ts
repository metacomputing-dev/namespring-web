import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const LIB = fileURLToPath(new URL("../../api/_lib/", import.meta.url));
const MODULES = [
  "auth-accounts-contract",
  "auth-accounts-lifecycle",
  "auth-accounts-in-memory",
  "auth-accounts-firestore-codec",
  "auth-accounts-firestore",
  "auth-accounts-repository",
] as const;

function source(module: (typeof MODULES)[number]): string {
  return readFileSync(`${LIB}${module}.ts`, "utf8");
}

test("auth account repository keeps its stable compatibility barrel", () => {
  const barrel = source("auth-accounts-repository");
  assert.match(barrel, /export \* from "\.\/auth-accounts-contract\.js"/u);
  assert.match(barrel, /authJobBackoffMsForAttemptV1/u);
  assert.match(barrel, /toPublicProviderSummaries/u);
  assert.match(barrel, /InMemoryAuthAccountRepository/u);
  assert.match(barrel, /FirestoreAuthAccountRepository/u);
  assert.match(barrel, /getAuthAccountRepository/u);
  assert.match(barrel, /setAuthAccountRepositoryForTests/u);
  assert.doesNotMatch(barrel, /runTransaction|decodeAccountDeletionJobV1|class InMemoryAuthAccountRepository/u);
});

test("auth account modules form an acyclic dependency graph with isolated implementations", () => {
  const graph = new Map<string, string[]>();
  for (const module of MODULES) {
    const dependencies = [...source(module).matchAll(/from "\.\/(auth-accounts-[^"]+)\.js"/gu)]
      .map((match) => match[1]);
    graph.set(module, dependencies);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (module: string): void => {
    if (visiting.has(module)) assert.fail(`auth account module cycle reaches ${module}`);
    if (visited.has(module)) return;
    visiting.add(module);
    for (const dependency of graph.get(module) ?? []) visit(dependency);
    visiting.delete(module);
    visited.add(module);
  };
  for (const module of MODULES) visit(module);

  assert.deepEqual(graph.get("auth-accounts-contract"), []);
  assert.deepEqual(graph.get("auth-accounts-lifecycle"), ["auth-accounts-contract"]);
  assert.deepEqual(
    new Set(graph.get("auth-accounts-in-memory")),
    new Set(["auth-accounts-contract", "auth-accounts-lifecycle"]),
  );
  assert.equal(source("auth-accounts-in-memory").includes("firebase-admin/firestore"), false);
  assert.equal(source("auth-accounts-firestore").includes("auth-accounts-repository.js"), false);
  assert.equal(source("auth-accounts-firestore-codec").includes("getFirestoreDb"), false);

  for (const module of MODULES) {
    const lineCount = source(module).split(/\r?\n/u).length;
    assert.ok(lineCount <= 900, `${module} unexpectedly grew to ${lineCount} lines`);
  }
});
