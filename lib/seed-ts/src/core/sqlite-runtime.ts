import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

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

interface NodeSqliteModule {
  DatabaseSync: new (path: string) => SqliteDatabase;
}

function loadNodeSqlite(): NodeSqliteModule {
  try {
    return require("node:sqlite") as NodeSqliteModule;
  } catch (error) {
    throw new Error("`node:sqlite` is not available in this Node runtime.", {
      cause: error as Error,
    });
  }
}

export function openSqliteDatabase(dbPath: string): SqliteDatabase {
  const normalized = (dbPath ?? "").trim();
  if (!normalized) {
    throw new Error("SQLite database path is required.");
  }
  const sqlite = loadNodeSqlite();
  return new sqlite.DatabaseSync(normalized);
}

