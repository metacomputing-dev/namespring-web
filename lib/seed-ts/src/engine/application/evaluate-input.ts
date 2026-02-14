import { parseCompleteName } from "../../core/query.js";
import type { BirthInfo, EvaluateRequest, Gender, NameInput } from "../../core/types.js";

export interface EvaluateInput {
  name: NameInput;
  birth?: BirthInfo;
  gender?: Gender;
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

export function toEvaluateInput(
  source: EvaluateRequest | NameInput | string,
  _defaultIncludeSaju: boolean,
  birth?: BirthInfo,
  gender?: Gender,
): EvaluateInput {
  if (typeof source === "string") {
    const parsed = parseCompleteName(source);
    if (!parsed) {
      throw new Error("invalid evaluate query");
    }
    return { name: parsed, birth, gender, includeSaju: true };
  }

  if (isNameInput(source)) {
    return { name: source, birth, gender, includeSaju: true };
  }

  if (source.name) {
    return {
      name: source.name,
      birth: source.birth ?? birth,
      gender: source.gender ?? gender,
      includeSaju: true,
    };
  }

  if (source.query) {
    const parsed = parseCompleteName(source.query);
    if (!parsed) {
      throw new Error("query is not complete evaluate input");
    }
    return {
      name: parsed,
      birth: source.birth ?? birth,
      gender: source.gender ?? gender,
      includeSaju: true,
    };
  }

  throw new Error("evaluate input requires name or query");
}
