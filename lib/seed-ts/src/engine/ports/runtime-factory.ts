import type { SeedOptions } from "../../core/types.js";
import type { RuntimeContext } from "./runtime-ports.js";

export interface RuntimeContextFactory {
  create(options: SeedOptions): RuntimeContext;
}
