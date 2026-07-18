import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const namespringRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("deployment runbook fails closed on sub-daily Vercel cron plan support", () => {
  const runbook = readFileSync(join(namespringRoot, "DEPLOYMENT_BACKEND.md"), "utf8");
  assert.match(runbook, /Sub-daily cron requires Vercel Pro or Enterprise/u);
  assert.match(runbook, /Hobby deployment[\s\S]*rejected[\s\S]*launch blocker/u);
  assert.match(runbook, /Do not silently remove or weaken the workers/u);
  assert.ok(runbook.includes("https://vercel.com/docs/cron-jobs/manage-cron-jobs"));
});

test("deployment runbook blocks launch without billed Firestore TTL policies", () => {
  const runbook = readFileSync(join(namespringRoot, "DEPLOYMENT_BACKEND.md"), "utf8");
  assert.match(runbook, /Firestore TTL deletes require a Firebase project with billing enabled/u);
  assert.match(runbook, /not covered by free usage/u);
  assert.match(runbook, /undeployed TTL policy[\s\S]*production launch blocker/u);
  assert.match(runbook, /budget alerts/u);
  assert.ok(runbook.includes("https://firebase.google.com/docs/firestore/pricing"));
});
