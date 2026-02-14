import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function resolveSqlitePath(dataRoot: string, configuredPath?: string): string {
  const configured = configuredPath?.trim();
  if (configured && configured.length > 0) {
    return configured;
  }

  const root = dataRoot.trim();
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const candidates = [
    path.join(root, "sqlite", "seed.db"),
    path.resolve(currentDir, "../../../../main/resources/seed/data/sqlite/seed.db"),
    path.resolve(currentDir, "../../../../../src/main/resources/seed/data/sqlite/seed.db"),
    path.resolve(process.cwd(), "lib/seed-ts/src/main/resources/seed/data/sqlite/seed.db"),
    path.resolve(process.cwd(), "src/main/resources/seed/data/sqlite/seed.db"),
    path.resolve(process.cwd(), "lib/seed-ts/data/sqlite/seed.db"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0] as string;
}

export function ensureSqliteFileExists(sqlitePath: string): void {
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(
      `SQLite database not found: ${sqlitePath}. Run \`npm run sqlite:build\` in \`lib/seed-ts\` first.`,
    );
  }
}
