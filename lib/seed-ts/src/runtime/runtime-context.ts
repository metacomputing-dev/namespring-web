import type { RuntimeContextFactory } from "../engine/ports/runtime-factory.js";
import type { RuntimeContext } from "../engine/ports/runtime-ports.js";
import type { SeedClientOptions } from "./options.js";
import { createBrowserWasmRuntimeContext } from "./sqlite-browser-runtime.js";
import { createSqliteNodeRuntimeContext } from "./sqlite-node-runtime.js";

export function createRuntimeContext(options: SeedClientOptions): RuntimeContext {
  const strategy = options.runtime?.strategy ?? "sqlite-node";
  if (strategy === "browser-wasm") {
    return createBrowserWasmRuntimeContext(options);
  }
  return createSqliteNodeRuntimeContext(options);
}

export const DEFAULT_RUNTIME_CONTEXT_FACTORY: RuntimeContextFactory = {
  create: createRuntimeContext,
};
