import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

import { normalizeText } from "./utils.js";

export function resolveSeedDataRoot(customRoot?: string): string {
  if (customRoot) {
    return customRoot;
  }

  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const candidates = [
    path.resolve(currentDir, "../main/resources/seed/data"),
    path.resolve(currentDir, "../../src/main/resources/seed/data"),
    path.resolve(process.cwd(), "lib/seed-ts/src/main/resources/seed/data"),
    path.resolve(process.cwd(), "src/main/resources/seed/data"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("seed data root not found");
}

export function readJsonSync<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export function readGzipTextSync(filePath: string): string {
  const compressed = fs.readFileSync(filePath);
  return zlib.gunzipSync(compressed).toString("utf8");
}

export function readGzipLinesSync(filePath: string): string[] {
  const text = readGzipTextSync(filePath);
  const lines = text.split(/\r?\n/);
  const result: string[] = [];
  for (const line of lines) {
    const normalized = normalizeText(line);
    if (normalized.length > 0) {
      result.push(normalized);
    }
  }
  return result;
}

export function readGzipJsonSync<T>(filePath: string): T {
  const text = readGzipTextSync(filePath);
  return JSON.parse(text) as T;
}

