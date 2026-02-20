import type { EngineConfig, SajuRequest } from '../api/types.js';
import type { ParsedInstant } from '../calendar/iso.js';

export interface Context {
  request: SajuRequest;
  parsed: ParsedInstant;
  config: EngineConfig;
}

export interface NodeSpec<T> {
  id: string;
  deps: string[];
  formula?: string;
  explain?: string;
  compute: (ctx: Context, get: <U>(id: string) => U) => T;
}

export type Graph = Map<string, NodeSpec<any>>;
