import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export function dataPath(callerMetaUrl: string, ...segments: string[]): string {
  const dir = path.dirname(fileURLToPath(callerMetaUrl));
  return path.resolve(dir, '../data', ...segments);
}

export function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function openDb(dbPath: string): sqlite3.Database {
  ensureDir(dbPath);
  return new (sqlite3.verbose()).Database(dbPath);
}

export function runSql(db: sqlite3.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) =>
    db.run(sql, (err: Error | null) => (err ? reject(err) : resolve())),
  );
}

export function getSql<T>(db: sqlite3.Database, sql: string): Promise<T | undefined> {
  return new Promise((resolve, reject) =>
    db.get(sql, (err: Error | null, row: T | undefined) => (err ? reject(err) : resolve(row))),
  );
}

export function closeDb(db: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) =>
    db.close((err: Error | null) => (err ? reject(err) : resolve())),
  );
}
