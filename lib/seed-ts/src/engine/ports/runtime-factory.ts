import type { SeedClientOptions } from "../../runtime/options.js";
import type { RuntimeContext } from "./runtime-ports.js";

export interface RuntimeContextFactory {
  create(options: SeedClientOptions): RuntimeContext;
}
