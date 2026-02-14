import type { SqliteDatabase, SqliteStatement } from "../core/sqlite-runtime.js";

export interface SqlJsStatement {
  bind?: (params: unknown[] | Record<string, unknown>) => boolean | void;
  step: () => boolean;
  getAsObject: (params?: unknown[] | Record<string, unknown>) => Record<string, unknown>;
  free: () => void;
}

export interface SqlJsDatabase {
  prepare: (sql: string) => SqlJsStatement;
  run: (sql: string, params?: unknown[] | Record<string, unknown>) => unknown;
  exec?: (sql: string) => unknown;
  close?: () => void;
}

export interface SqlJsModule {
  Database: new (data?: Uint8Array) => SqlJsDatabase;
}

export type SqlJsBinary = Uint8Array | ArrayBuffer;

function toBindParams(params: readonly unknown[]): unknown[] | undefined {
  if (params.length === 0) {
    return undefined;
  }
  return Array.from(params);
}

function bindIfNeeded(statement: SqlJsStatement, params: unknown[] | undefined): void {
  if (!params || params.length === 0) {
    return;
  }
  statement.bind?.(params);
}

function consumeStatement(statement: SqlJsStatement): void {
  while (statement.step()) {
    // Consume all rows to execute the prepared statement fully.
  }
}

function toUint8Array(binary?: SqlJsBinary): Uint8Array | undefined {
  if (!binary) {
    return undefined;
  }
  if (binary instanceof Uint8Array) {
    return binary;
  }
  return new Uint8Array(binary);
}

function createStatementAdapter(create: () => SqlJsStatement): SqliteStatement {
  return {
    get(...params: unknown[]): unknown {
      const statement = create();
      try {
        bindIfNeeded(statement, toBindParams(params));
        if (!statement.step()) {
          return undefined;
        }
        return statement.getAsObject();
      } finally {
        statement.free();
      }
    },

    all(...params: unknown[]): unknown[] {
      const statement = create();
      try {
        bindIfNeeded(statement, toBindParams(params));
        const rows: unknown[] = [];
        while (statement.step()) {
          rows.push(statement.getAsObject());
        }
        return rows;
      } finally {
        statement.free();
      }
    },

    run(...params: unknown[]): unknown {
      const statement = create();
      try {
        bindIfNeeded(statement, toBindParams(params));
        consumeStatement(statement);
        return undefined;
      } finally {
        statement.free();
      }
    },
  };
}

export function createSqlJsDatabaseAdapter(sqlJsDatabase: SqlJsDatabase): SqliteDatabase {
  return {
    prepare(sql: string): SqliteStatement {
      return createStatementAdapter(() => sqlJsDatabase.prepare(sql));
    },

    exec(sql: string): void {
      if (typeof sqlJsDatabase.exec === "function") {
        sqlJsDatabase.exec(sql);
        return;
      }
      sqlJsDatabase.run(sql);
    },

    close(): void {
      sqlJsDatabase.close?.();
    },
  };
}

export function createSqlJsDatabase(module: SqlJsModule, binary?: SqlJsBinary): SqlJsDatabase {
  const bytes = toUint8Array(binary);
  if (bytes) {
    return new module.Database(bytes);
  }
  return new module.Database();
}

export function openSqlJsDatabase(module: SqlJsModule, binary?: SqlJsBinary): SqliteDatabase {
  return createSqlJsDatabaseAdapter(createSqlJsDatabase(module, binary));
}
