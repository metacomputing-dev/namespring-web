export const HANJA_SELECT_COLUMNS = [
  "id",
  "hangul",
  "hanja",
  "hoeksu",
  "hoeksu_ohaeng",
  "jawon_ohaeng",
  "pronunciation_ohaeng",
  "pronunciation_eumyang",
  "hoeksu_eumyang",
  "meaning",
  "boosoo",
  "is_surname",
  "hangul_chosung",
  "hangul_jungsung",
].join(", ");

function baseSelect(whereClause: string, orderClause: string, suffix = ""): string {
  return [
    `SELECT ${HANJA_SELECT_COLUMNS}`,
    "  FROM hanja_entries",
    ` WHERE ${whereClause}`,
    ` ORDER BY ${orderClause}`,
    suffix,
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

export function sqlFindByHanja(): string {
  return baseSelect("hanja = ?", "is_surname ASC, rowid ASC", " LIMIT 1");
}

export function sqlFindByHangul(): string {
  return baseSelect("hangul = ?", "hoeksu ASC, rowid ASC");
}

export function sqlFindSurnameByHangul(): string {
  return baseSelect("hangul = ? AND is_surname = 1", "hoeksu ASC, rowid ASC");
}

export function sqlFindByResourceElement(withHangul: boolean): string {
  if (withHangul) {
    return baseSelect("jawon_ohaeng = ? AND hangul = ?", "hoeksu ASC, rowid ASC");
  }
  return baseSelect("jawon_ohaeng = ?", "hoeksu ASC, rowid ASC");
}

export function sqlFindByStrokeRange(): string {
  return baseSelect("hoeksu BETWEEN ? AND ?", "hoeksu ASC, rowid ASC");
}

export function sqlFindByOnset(): string {
  return baseSelect("hangul_chosung = ?", "rowid ASC", " LIMIT 200");
}
