import path from "node:path";

import { readGzipJsonSync } from "../resource.js";
import type { RawStatsFile } from "./stats-parsers.js";

export class StatsResourceLoader {
  private readonly statsRoot: string;
  private readonly fileCache = new Map<string, RawStatsFile>();

  constructor(statsRoot: string) {
    this.statsRoot = statsRoot;
  }

  load(fileId: string): RawStatsFile {
    const cached = this.fileCache.get(fileId);
    if (cached) {
      return cached;
    }
    const parsed = readGzipJsonSync<RawStatsFile>(path.join(this.statsRoot, `stat_${fileId}.gz`));
    this.fileCache.set(fileId, parsed);
    return parsed;
  }
}
