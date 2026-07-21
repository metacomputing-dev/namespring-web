import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const namespringRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function source(path: string): string {
  return readFileSync(join(namespringRoot, path), "utf8");
}

function filesRecursively(path: string): string[] {
  const absolute = join(namespringRoot, path);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = join(absolute, entry.name);
    if (entry.isDirectory()) return filesRecursively(relative(namespringRoot, child));
    return /\.(?:js|jsx|ts|tsx)$/u.test(entry.name)
      ? [relative(namespringRoot, child).replaceAll("\\", "/")]
      : [];
  });
}

function interfaceBody(contract: string, name: string): string {
  const match = new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`, "u").exec(contract);
  assert.ok(match, `${name} must remain an explicit public DTO`);
  return match[1];
}

const routineBrowserRoutes = [
  "api/auth/current.ts",
  "api/auth/session.ts",
  "api/auth/link.ts",
  "api/auth/unlink.ts",
  "api/auth/delete.ts",
  "api/auth/revoke.ts",
  "api/auth/admin/retry-deletion.ts",
  "api/auth/admin/retry-unlink.ts",
] as const;

test("routine browser auth DTOs never expose internal account or session identifiers", () => {
  const contract = source("shared/types/auth.ts");
  for (const typeName of [
    "AccountSessionView",
    "UnlinkIdentityResponse",
    "AccountMutationResponse",
    "DeleteAccountResponse",
    "RevokeSessionsResponse",
  ]) {
    const body = interfaceBody(contract, typeName);
    assert.doesNotMatch(body, /\buserId\s*:/u, `${typeName} leaks the internal account ID`);
    assert.doesNotMatch(body, /\bsessionId\s*:/u, `${typeName} leaks the internal session ID`);
  }

  for (const routeFile of routineBrowserRoutes) {
    const route = source(routeFile);
    assert.doesNotMatch(route, /\b(?:userId|sessionId)\s*:/u, `${routeFile} serializes an internal identifier`);
    assert.doesNotMatch(
      route,
      /[,\{]\s*(?:userId|sessionId)\s*(?:,|\})/u,
      `${routeFile} serializes an internal identifier via shorthand`,
    );
  }
  assert.match(source("api/auth/current.ts"), /roles:\s*toBrowserVisibleAccountRoles\(context\.roles\)/u);
  assert.match(source("api/auth/session.ts"), /const roles = toBrowserVisibleAccountRoles/u);
});

test("account portability is the only public auth contract that deliberately carries its own userId", () => {
  const contract = source("shared/types/auth.ts");
  const occurrences = [...contract.matchAll(/\b(?:readonly\s+)?userId\s*:/gu)].map((match) => match.index);
  assert.equal(occurrences.length, 2, "only legacy and portable account exports may carry userId");
  assert.match(interfaceBody(contract, "AccountExportResponse"), /\buserId\s*:/u);
  assert.match(interfaceBody(contract, "AccountPortableExportManifestV1"), /\buserId\s*:/u);
});

test("the current frontend does not consume the new auth lifecycle or session APIs", () => {
  const frontend = filesRecursively("src").map((path) => source(path)).join("\n");
  assert.doesNotMatch(frontend, /\/api\/auth\//u);
  assert.doesNotMatch(
    frontend,
    /\b(?:CurrentSessionResponse|CreateSessionResponse|AccountMutationResponse|UnlinkIdentityResponse|DeleteAccountResponse|RevokeSessionsResponse)\b/u,
  );
});
