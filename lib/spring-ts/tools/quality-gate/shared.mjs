export function resolveNarrativeEntry(narratives, fixtureId, snapshotTargetDate) {
  if (!narratives || !Array.isArray(narratives.results)) {
    return { entry: null, reason: 'narrative golden unavailable — run `npm run narrative:capture`' };
  }
  if (snapshotTargetDate && narratives.targetDate !== snapshotTargetDate) {
    return {
      entry: null,
      reason: `narrative golden stale (targetDate ${narratives.targetDate} != snapshot ${snapshotTargetDate}) — run \`npm run narrative:capture\``,
    };
  }
  const entry = narratives.results.find((result) => result?.id === fixtureId) ?? null;
  if (!entry || !entry.cards) {
    return { entry: null, reason: `narrative golden has no entry for ${fixtureId} — run \`npm run narrative:capture\`` };
  }
  return { entry, reason: null };
}

export function isAllowedField(allowedDiff, fieldPath) {
  if (!Array.isArray(allowedDiff)) return false;
  return allowedDiff.some((diff) => typeof diff === 'string' && diff === fieldPath);
}

export const STRENGTH_BAND = {
  신약: 'weak',
  '중화(신약 경향)': 'weak',
  신강: 'strong',
  '중화(신강 경향)': 'strong',
  중화: 'middle',
  '중화 또는 약중강': 'middle',
  극신약: 'weak',
  극신강: 'strong',
};

export function strengthBand(label) {
  if (!label || typeof label !== 'string') return null;
  return STRENGTH_BAND[label] || null;
}

export function strengthLevelMatches(actual, expected) {
  if (actual === expected) return true;
  const actualBand = strengthBand(actual);
  const expectedBand = strengthBand(expected);
  if (!actualBand || !expectedBand) return false;
  return actualBand === expectedBand;
}

export const GYEOKGUK_EQUIV = {
  비견격: new Set(['비견격', '건록격']),
  겁재격: new Set(['겁재격', '양인격', '월겁격']),
};

export function gyeokgukTypeMatches(actual, expected) {
  if (actual === expected) return true;
  const equivalents = GYEOKGUK_EQUIV[expected];
  return equivalents ? equivalents.has(actual) : false;
}

export const NARRATIVE_ELEMENT_TOKENS = {
  WOOD: ['나무(목)', '목(木)'],
  FIRE: ['불(화)', '화(火)'],
  EARTH: ['흙(토)', '토(土)'],
  METAL: ['쇠(금)', '금(金)'],
  WATER: ['물(수)', '수(水)'],
};

const ELEMENT_CODE_BY_KOREAN_CHAR = {
  목: 'WOOD', 화: 'FIRE', 토: 'EARTH', 금: 'METAL', 수: 'WATER',
  木: 'WOOD', 火: 'FIRE', 土: 'EARTH', 金: 'METAL', 水: 'WATER',
};

export function normalizeElementCode(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  const upper = value.toUpperCase();
  if (NARRATIVE_ELEMENT_TOKENS[upper]) return upper;
  return ELEMENT_CODE_BY_KOREAN_CHAR[value.charAt(0)] ?? null;
}

const STRENGTH_LABELS_LONGEST_FIRST = Object.keys(STRENGTH_BAND)
  .sort((a, b) => b.length - a.length);

export function extractStrengthBands(text) {
  const bands = new Set();
  let rest = String(text ?? '');
  for (const label of STRENGTH_LABELS_LONGEST_FIRST) {
    if (rest.includes(label)) {
      bands.add(STRENGTH_BAND[label]);
      rest = rest.split(label).join('\u0000');
    }
  }
  return bands;
}

export function narrativeEvidenceCorpus(overviewSummary) {
  const parts = [];
  for (const row of overviewSummary?.evidence ?? []) {
    if (row?.claim) parts.push(String(row.claim));
    for (const feature of row?.supportingFeatures ?? []) parts.push(String(feature));
    if (row?.weakness) parts.push(String(row.weakness));
  }
  return parts.join('\n');
}

export function fullNarrativeCorpus(cards) {
  return JSON.stringify(cards ?? {});
}
