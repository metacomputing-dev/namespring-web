export interface SqliteStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): unknown;
}

export interface SqliteDatabase {
  prepare(sql: string): SqliteStatement;
  exec(sql: string): void;
  close?: () => void;
}

export type SqliteDatabaseOpener = (dbPath: string) => SqliteDatabase;

let defaultSqliteDatabaseOpener: SqliteDatabaseOpener | null = null;

interface NodeSqliteModule {
  DatabaseSync: new (path: string) => SqliteDatabase;
}

interface NodeProcessLike {
  getBuiltinModule?: (id: string) => unknown;
}

function openNodeSqliteDatabase(dbPath: string): SqliteDatabase | null {
  const processObject = (globalThis as { process?: NodeProcessLike }).process;
  const loader = processObject?.getBuiltinModule;
  if (typeof loader !== "function") {
    return null;
  }

  const loaded = loader("node:sqlite") ?? loader("sqlite");
  if (!loaded) {
    return null;
  }

  const module = loaded as NodeSqliteModule;
  if (typeof module.DatabaseSync !== "function") {
    return null;
  }

  return new module.DatabaseSync(dbPath);
}

export function configureSqliteDatabaseOpener(opener: SqliteDatabaseOpener | null): void {
  defaultSqliteDatabaseOpener = opener;
}

export function openSqliteDatabase(
  dbPath: string,
  opener: SqliteDatabaseOpener | null = defaultSqliteDatabaseOpener,
): SqliteDatabase {
  const normalized = (dbPath ?? "").trim();
  if (!normalized) {
    throw new Error("SQLite database path is required.");
  }

  if (!opener) {
    const nodeDatabase = openNodeSqliteDatabase(normalized);
    if (nodeDatabase) {
      return nodeDatabase;
    }
    throw new Error("SQLite opener is not configured. Use sqlite-node runtime or pass a SqliteDatabase instance.");
  }

  return opener(normalized);
}

