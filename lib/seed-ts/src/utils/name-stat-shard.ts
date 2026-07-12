/**
 * Canonical choseong contract for the NameStat dataset.
 *
 * The database stores the raw 19-way choseong for row identity. Shard routing
 * is a separate concern and folds the five tense choseong into 14 base shards.
 */
const NAME_STAT_CHOSEONG_SPECS = [
  { rawChoseong: 'ㄱ', shardKey: 'ㄱ' },
  { rawChoseong: 'ㄲ', shardKey: 'ㄱ' },
  { rawChoseong: 'ㄴ', shardKey: 'ㄴ' },
  { rawChoseong: 'ㄷ', shardKey: 'ㄷ' },
  { rawChoseong: 'ㄸ', shardKey: 'ㄷ' },
  { rawChoseong: 'ㄹ', shardKey: 'ㄹ' },
  { rawChoseong: 'ㅁ', shardKey: 'ㅁ' },
  { rawChoseong: 'ㅂ', shardKey: 'ㅂ' },
  { rawChoseong: 'ㅃ', shardKey: 'ㅂ' },
  { rawChoseong: 'ㅅ', shardKey: 'ㅅ' },
  { rawChoseong: 'ㅆ', shardKey: 'ㅅ' },
  { rawChoseong: 'ㅇ', shardKey: 'ㅇ' },
  { rawChoseong: 'ㅈ', shardKey: 'ㅈ' },
  { rawChoseong: 'ㅉ', shardKey: 'ㅈ' },
  { rawChoseong: 'ㅊ', shardKey: 'ㅊ' },
  { rawChoseong: 'ㅋ', shardKey: 'ㅋ' },
  { rawChoseong: 'ㅌ', shardKey: 'ㅌ' },
  { rawChoseong: 'ㅍ', shardKey: 'ㅍ' },
  { rawChoseong: 'ㅎ', shardKey: 'ㅎ' },
] as const;

export type NameStatRawChoseong =
  (typeof NAME_STAT_CHOSEONG_SPECS)[number]['rawChoseong'];
export type NameStatShardKey =
  (typeof NAME_STAT_CHOSEONG_SPECS)[number]['shardKey'];

export const NAME_STAT_SHARD_KEYS: readonly NameStatShardKey[] = Object.freeze(
  [...new Set(NAME_STAT_CHOSEONG_SPECS.map(({ shardKey }) => shardKey))],
);

/** Extracts the raw choseong from the first Unicode code point in a value. */
export function extractRawNameStatChoseong(value: string): NameStatRawChoseong | null {
  const codePoint = value.codePointAt(0);
  if (codePoint === undefined || codePoint < 0xac00 || codePoint > 0xd7a3) {
    return null;
  }

  const choseongIndex = Math.floor((codePoint - 0xac00) / 588);
  return NAME_STAT_CHOSEONG_SPECS[choseongIndex]?.rawChoseong ?? null;
}

export function foldNameStatChoseong(
  rawChoseong: NameStatRawChoseong,
): NameStatShardKey {
  const spec = NAME_STAT_CHOSEONG_SPECS.find(
    (candidate) => candidate.rawChoseong === rawChoseong,
  );
  if (!spec) {
    throw new Error(`Unsupported NameStat choseong: ${String(rawChoseong)}`);
  }
  return spec.shardKey;
}

/** Resolves the shard for the first Unicode code point in a name or syllable. */
export function resolveNameStatShardKey(value: string): NameStatShardKey | null {
  const rawChoseong = extractRawNameStatChoseong(value);
  return rawChoseong === null ? null : foldNameStatChoseong(rawChoseong);
}

export function nameStatShardFilename(shardKey: NameStatShardKey): string {
  const shardIndex = NAME_STAT_SHARD_KEYS.indexOf(shardKey);
  if (shardIndex < 0) {
    throw new Error(`Unsupported NameStat shard key: ${String(shardKey)}`);
  }
  return `${String(shardIndex + 1).padStart(2, '0')}.db`;
}
