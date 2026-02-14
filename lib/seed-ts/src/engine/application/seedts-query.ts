import type { BirthInfo, Gender, NameInput } from "../../core/types.js";
import type { SeedTsUserInfo } from "../domain/naming.js";

function underscoreByLength(value: string): string {
  return "_".repeat(Array.from(value).length);
}

export function buildSeedTsQuery(lastName: string, firstName: string): string {
  let out = `[${lastName}/${underscoreByLength(lastName)}]`;
  for (const c of Array.from(firstName)) {
    out += `[${c}/_]`;
  }
  return out;
}

export function toSeedTsBirth(userInfo: SeedTsUserInfo): BirthInfo | undefined {
  const b = userInfo.birthDateTime;
  if (
    !b ||
    typeof b.year !== "number" ||
    typeof b.month !== "number" ||
    typeof b.day !== "number" ||
    typeof b.hour !== "number" ||
    typeof b.minute !== "number"
  ) {
    return undefined;
  }
  return {
    year: b.year,
    month: b.month,
    day: b.day,
    hour: b.hour,
    minute: b.minute,
  };
}

export function toSeedTsFallbackNameInput(userInfo: SeedTsUserInfo): NameInput {
  return {
    lastNameHangul: userInfo.lastName,
    lastNameHanja: underscoreByLength(userInfo.lastName),
    firstNameHangul: userInfo.firstName,
    firstNameHanja: underscoreByLength(userInfo.firstName),
  };
}

export function toSeedTsGender(value: SeedTsUserInfo["gender"]): Gender {
  return (value as Gender) ?? "NONE";
}
