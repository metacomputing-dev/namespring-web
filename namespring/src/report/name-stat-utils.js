// Shared helpers for reading the name-stat DB payloads. Used by the
// standalone naming report and the combined report's statistics section.

/** Total rows in the name-stat DB — the denominator for rank context. */
export const TOTAL_NAME_STATS_COUNT = 50194;

export function mergeYearlyBirthBuckets(yearlyBirth) {
  const source = yearlyBirth || {};
  const totalBucket = source?.전체;
  if (totalBucket && typeof totalBucket === 'object' && !Array.isArray(totalBucket)) {
    return Object.entries(totalBucket)
      .map(([year, value]) => ({ year: Number(year), value: Number(value) }))
      .filter((item) => !Number.isNaN(item.year) && !Number.isNaN(item.value))
      .sort((a, b) => a.year - b.year);
  }

  const byYear = {};
  for (const [key, bucket] of Object.entries(source)) {
    const flatYear = Number(key);
    const flatValue = Number(bucket);
    if (!Number.isNaN(flatYear) && !Number.isNaN(flatValue)) {
      byYear[flatYear] = (byYear[flatYear] || 0) + flatValue;
      continue;
    }
    if (!bucket || typeof bucket !== 'object') continue;
    for (const [year, value] of Object.entries(bucket)) {
      const y = Number(year);
      const v = Number(value);
      if (Number.isNaN(y) || Number.isNaN(v)) continue;
      byYear[y] = (byYear[y] || 0) + v;
    }
  }
  return Object.entries(byYear)
    .map(([year, value]) => ({ year: Number(year), value: Number(value) }))
    .sort((a, b) => a.year - b.year);
}

export function mergeYearlyRankBuckets(yearlyRank) {
  const source = yearlyRank || {};
  const totalBucket = source?.전체;
  if (totalBucket && typeof totalBucket === 'object' && !Array.isArray(totalBucket)) {
    return Object.entries(totalBucket)
      .map(([year, rank]) => ({ year: Number(year), rank: Number(rank) }))
      .filter((item) => !Number.isNaN(item.year) && !Number.isNaN(item.rank))
      .sort((a, b) => a.year - b.year);
  }

  const byYear = {};
  for (const [key, bucket] of Object.entries(source)) {
    const flatYear = Number(key);
    const flatValue = Number(bucket);
    if (!Number.isNaN(flatYear) && !Number.isNaN(flatValue)) {
      byYear[flatYear] = byYear[flatYear] || [];
      byYear[flatYear].push(flatValue);
      continue;
    }
    if (!bucket || typeof bucket !== 'object') continue;
    for (const [year, value] of Object.entries(bucket)) {
      const y = Number(year);
      const v = Number(value);
      if (Number.isNaN(y) || Number.isNaN(v)) continue;
      byYear[y] = byYear[y] || [];
      byYear[y].push(v);
    }
  }
  return Object.entries(byYear)
    .map(([year, arr]) => {
      const values = Array.isArray(arr) ? arr : [];
      const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
      return { year: Number(year), rank: avg };
    })
    .sort((a, b) => a.year - b.year);
}

export function getPopularityTrendLabel(rankSeries) {
  if (!rankSeries.length) return '';
  const recent = rankSeries.slice(-10);
  if (recent.length < 2) return '';
  const first = recent[0].rank;
  const last = recent[recent.length - 1].rank;
  if (last < first) return '상승중';
  if (last > first) return '하락중';
  return '유지';
}
