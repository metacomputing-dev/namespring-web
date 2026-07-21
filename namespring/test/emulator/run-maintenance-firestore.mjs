import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const MAX_RUNTIME_MS = 180_000;
const projectId = `demo-ns-maint-${Date.now().toString(36).slice(-8)}-${randomBytes(3).toString("hex")}`;
const firebaseCli = resolve("node_modules/firebase-tools/lib/bin/firebase.js");
const testCommand = [
  "node --import tsx --test --test-concurrency=1",
  "test/emulator/sync-maintenance-firestore.test.ts",
  "test/emulator/auth-maintenance-firestore.test.ts",
  "test/emulator/auth-session-boundary.test.ts",
  "test/emulator/premium-maintenance-firestore.test.ts",
  "test/emulator/content-export-firestore.test.ts",
].join(" ");
const startedAt = Date.now();
const environment = { ...process.env };

if (Number(process.versions.node.split(".")[0]) !== 22) {
  throw new Error(`The Firestore emulator suite requires project-pinned Node 22, got ${process.version}.`);
}
const javaVersion = spawnSync("java", ["-version"], {
  encoding: "utf8",
  windowsHide: true,
});
const javaVersionText = `${javaVersion.stdout ?? ""}\n${javaVersion.stderr ?? ""}`;
if (javaVersion.status !== 0 || !/\bversion "21\./u.test(javaVersionText)) {
  throw new Error("The Firestore emulator suite requires project-pinned Java 21.");
}

for (const name of [
  "FIREBASE_CONFIG",
  "FIREBASE_TOKEN",
  "FIREBASE_AUTH_EMULATOR_HOST",
  "FIRESTORE_EMULATOR_HOST",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_APPLICATION_CREDENTIALS_JSON",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "FIREBASE_SERVICE_ACCOUNT_BASE64",
]) {
  delete environment[name];
}
environment.CI = "1";
environment.GCLOUD_PROJECT = projectId;
environment.GOOGLE_CLOUD_PROJECT = projectId;
environment.NAMESPRING_EMULATOR_PROJECT_ID = projectId;

const child = spawn(process.execPath, [
  firebaseCli,
  "emulators:exec",
  "--only",
  "auth,firestore",
  "--project",
  projectId,
  testCommand,
], {
  cwd: process.cwd(),
  env: environment,
  stdio: "inherit",
  windowsHide: true,
});

let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  if (process.platform === "win32" && child.pid !== undefined) {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    child.kill("SIGTERM");
  }
}, MAX_RUNTIME_MS);
timer.unref();

const exitCode = await new Promise((resolveExit, reject) => {
  child.once("error", reject);
  child.once("exit", (code, signal) => resolveExit(code ?? (signal ? 1 : 0)));
}).finally(() => clearTimeout(timer));
await rm(resolve("firestore-debug.log"), { force: true }).catch(() => undefined);

const elapsedMs = Date.now() - startedAt;
if (timedOut) {
  console.error(`[maintenance-emulator] timed out after ${elapsedMs}ms`);
  process.exitCode = 124;
} else {
  console.log(`[maintenance-emulator] project=${projectId} elapsedMs=${elapsedMs}`);
  process.exitCode = exitCode;
}
