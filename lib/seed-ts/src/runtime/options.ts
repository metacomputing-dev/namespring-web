import type { SqliteDatabase } from "../core/sqlite-runtime.js";
import type { SeedOptions } from "../core/types.js";
import type { SqlJsDatabase } from "./sqlite-browser-driver.js";

export type RuntimeStrategy = "sqlite-node" | "browser-wasm";

export interface SqliteNodeRuntimeOption {
  strategy?: "sqlite-node";
}

export interface BrowserWasmRuntimeOption {
  strategy: "browser-wasm";
  database?: SqliteDatabase;
  sqlJsDatabase?: SqlJsDatabase;
}

export type RuntimeOption = SqliteNodeRuntimeOption | BrowserWasmRuntimeOption;

export type SeedClientOptions = SeedOptions & {
  runtime?: RuntimeOption;
};
