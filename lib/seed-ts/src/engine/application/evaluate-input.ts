import { parseCompleteName } from "../../core/query.js";
import type { BirthInfo, EvaluateRequest, NameInput } from "../../core/types.js";

export interface EvaluateInput {
  name: NameInput;
  birth?: BirthInfo;
  includeSaju: boolean;
}

function isNameInput(value: unknown): value is NameInput {
  if (!value || typeof value !== "object") {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.lastNameHangul === "string" &&
    typeof v.lastNameHanja === "string" &&
    typeof v.firstNameHangul === "string" &&
    typeof v.firstNameHanja === "string"
  );
}

export function toEvaluateInput(source: EvaluateRequest | NameInput | string, defaultIncludeSaju: boolean): EvaluateInput {
  if (typeof source === "string") {
    const parsed = parseCompleteName(source);
    if (!parsed) {
      throw new Error("invalid evaluate query");
    }
    return { name: parsed, includeSaju: defaultIncludeSaju };
  }

  if (isNameInput(source)) {
    return { name: source, includeSaju: defaultIncludeSaju };
  }

  if (source.name) {
    return {
      name: source.name,
      birth: source.birth,
      includeSaju: source.includeSaju ?? defaultIncludeSaju,
    };
  }

  if (source.query) {
    const parsed = parseCompleteName(source.query);
    if (!parsed) {
      throw new Error("query is not complete evaluate input");
    }
    return {
      name: parsed,
      birth: source.birth,
      includeSaju: source.includeSaju ?? defaultIncludeSaju,
    };
  }

  throw new Error("evaluate input requires name or query");
}
