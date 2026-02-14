import type {
  HanjaRepository,
  NameCombination,
  NameInput,
  NameQuery,
  ResolvedName,
} from "../types.js";

export interface SurnameCandidate {
  korean: string;
  hanja: string;
}

export function findSurnameCandidates(repository: HanjaRepository, query: NameQuery): SurnameCandidate[] {
  const blocks = query.surnameBlocks;
  if (blocks.length === 0) {
    return [];
  }
  if (blocks.length === 1) {
    const block = blocks[0];
    if (block && block.korean !== "_" && block.hanja !== "_" && repository.isSurname(block.korean, block.hanja)) {
      return [{ korean: block.korean, hanja: block.hanja }];
    }
    return [];
  }

  const first = blocks[0];
  const second = blocks[1];
  if (!first || !second) {
    return [];
  }
  const combinedKorean = first.korean + second.korean;
  const combinedHanja = first.hanja + second.hanja;
  if (
    first.korean.length === 1 &&
    second.korean.length === 1 &&
    repository.isSurname(combinedKorean, combinedHanja)
  ) {
    return [{ korean: combinedKorean, hanja: combinedHanja }];
  }
  return [];
}

export function toResolvedName(repository: HanjaRepository, name: NameInput): ResolvedName {
  const surnamePairs = repository.getSurnamePairs(name.lastNameHangul, name.lastNameHanja);
  const surname = surnamePairs.map((pair) => repository.getHanjaInfo(pair.korean, pair.hanja, true));
  const firstHangul = Array.from(name.firstNameHangul);
  const firstHanja = Array.from(name.firstNameHanja);
  const given = firstHangul.map((korean, index) => repository.getHanjaInfo(korean, firstHanja[index] ?? "", false));
  return { surname, given };
}

export function makeNameInput(surname: SurnameCandidate, combination: NameCombination): NameInput {
  return {
    lastNameHangul: surname.korean,
    lastNameHanja: surname.hanja,
    firstNameHangul: combination.korean,
    firstNameHanja: combination.hanja,
  };
}
