import type { HanjaRepository, NameBlock, NameInput, NameQuery } from "./types.js";
import { normalizeText } from "./utils.js";

const BLOCK_PATTERN = /\[([^/\]]*)\/([^/\]]*)\]/g;

function hasHanjaFilled(block: NameBlock): boolean {
  return block.hanja.length > 0 && block.hanja !== "_";
}

function isSingleFilled(block: NameBlock): boolean {
  return block.korean.length === 1 && block.hanja.length === 1;
}

function isValidDoubleSurname(repository: HanjaRepository, first: NameBlock, second: NameBlock): boolean {
  if (!hasHanjaFilled(first) || !hasHanjaFilled(second)) {
    return false;
  }
  if (!isSingleFilled(first) || !isSingleFilled(second)) {
    return false;
  }
  return repository.isSurname(first.korean + second.korean, first.hanja + second.hanja);
}

function processFirstBlock(repository: HanjaRepository, block: NameBlock): NameBlock[] {
  if (
    block.korean !== "_" &&
    hasHanjaFilled(block) &&
    block.korean.length === 2 &&
    block.hanja.length === 2 &&
    repository.isSurname(block.korean, block.hanja)
  ) {
    return [
      { korean: block.korean[0] ?? "", hanja: block.hanja[0] ?? "" },
      { korean: block.korean[1] ?? "", hanja: block.hanja[1] ?? "" },
    ];
  }
  return [block];
}

export function parseBlocks(input: string): NameBlock[] {
  const source = normalizeText(input);
  const out: NameBlock[] = [];
  BLOCK_PATTERN.lastIndex = 0;
  let m = BLOCK_PATTERN.exec(source);
  while (m) {
    out.push({
      korean: normalizeText(m[1] ?? "") || "_",
      hanja: normalizeText(m[2] ?? "") || "_",
    });
    m = BLOCK_PATTERN.exec(source);
  }
  return out;
}

export function parseNameQuery(repository: HanjaRepository, input: string): NameQuery {
  const blocks = parseBlocks(input);
  if (blocks.length === 0) {
    return { surnameBlocks: [], nameBlocks: [] };
  }
  if (blocks.length === 1) {
    return { surnameBlocks: processFirstBlock(repository, blocks[0] as NameBlock), nameBlocks: [] };
  }

  const firstProcessed = processFirstBlock(repository, blocks[0] as NameBlock);
  if (firstProcessed.length === 2) {
    return {
      surnameBlocks: firstProcessed,
      nameBlocks: blocks.slice(1),
    };
  }

  if (isValidDoubleSurname(repository, blocks[0] as NameBlock, blocks[1] as NameBlock)) {
    return {
      surnameBlocks: blocks.slice(0, 2),
      nameBlocks: blocks.slice(2),
    };
  }

  return {
    surnameBlocks: [blocks[0] as NameBlock],
    nameBlocks: blocks.slice(1),
  };
}

export function parseCompleteName(input: string): NameInput | null {
  const blocks = parseBlocks(input);
  const openCount = (input.match(/\[/g) ?? []).length;
  const closeCount = (input.match(/\]/g) ?? []).length;
  if (openCount !== closeCount) {
    return null;
  }
  if (input.includes("_")) {
    return null;
  }
  if (blocks.length < 2) {
    return null;
  }
  const last = blocks[0] as NameBlock;
  const given = blocks.slice(1);
  return {
    lastNameHangul: given.length > 0 ? normalizeText(last.korean) : "",
    lastNameHanja: given.length > 0 ? normalizeText(last.hanja) : "",
    firstNameHangul: normalizeText(given.map((block) => block.korean).join("")),
    firstNameHanja: normalizeText(given.map((block) => block.hanja).join("")),
  };
}

