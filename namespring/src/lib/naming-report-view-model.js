const SCORE_BANDS = {
  excellent: 80,
  good: 65,
  mixed: 46,
};

function compact(value) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim();
}

function scoreBand(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 'mixed';
  if (value >= SCORE_BANDS.excellent) return 'excellent';
  if (value >= SCORE_BANDS.good) return 'good';
  if (value >= SCORE_BANDS.mixed) return 'mixed';
  return 'caution';
}

export function buildNameParts(candidate, shareUserInfo) {
  const join = (items, key) => (Array.isArray(items) ? items : [])
    .map((item) => compact(item?.[key]))
    .join('');
  return {
    hangul: compact(candidate?.fullHangul)
      || `${join(shareUserInfo?.lastName, 'hangul')}${join(shareUserInfo?.firstName, 'hangul')}`
      || '이름 미정',
    hanja: compact(candidate?.fullHanja)
      || `${join(shareUserInfo?.lastName, 'hanja')}${join(shareUserInfo?.firstName, 'hanja')}`,
  };
}

export function scorePresentation(score) {
  const band = scoreBand(score);
  return bandPresentation(band);
}

export function bandPresentation(band) {
  const labels = {
    excellent: '아주 잘 어울려요',
    good: '잘 어울려요',
    mixed: '장단점이 함께 있어요',
    caution: '다른 후보와 비교해 보세요',
  };
  const safeBand = Object.hasOwn(labels, band) ? band : 'mixed';
  return { band: safeBand, label: labels[safeBand] };
}

export function buildStructureNarrative(namingEvidence) {
  const score = Number(namingEvidence?.fourFrameScore);
  const { band } = scorePresentation(score);
  const lead = band === 'excellent' || band === 'good'
    ? '획수로 살펴본 네 시기의 흐름과 오행 배치가 대체로 안정적이에요.'
    : band === 'mixed'
      ? '좋게 읽히는 시기와 아쉬운 시기가 함께 있어, 한자 조합의 장단점을 같이 볼 필요가 있어요.'
      : '획수의 짜임에서 아쉬운 부분이 보여, 같은 소리의 다른 한자 조합과 비교하는 편이 좋아요.';
  const frames = Array.isArray(namingEvidence?.frames) ? namingEvidence.frames : [];
  const positiveCount = frames.filter((frame) => Number(frame?.luckyLevel) >= 10).length;
  const follow = frames.length
    ? `초년운·중년운·말년운·총운 가운데 ${positiveCount}가지가 긍정적으로 풀이돼요. 획수의 오행과 음양 배치도 함께 살폈어요.`
    : '획수의 오행과 음양 배치를 함께 살폈어요.';
  return [lead, follow];
}

export function buildSoundNarrative({ phonetic, familyFit }) {
  phonetic = phonetic === null || phonetic === undefined ? Number.NaN : Number(phonetic);
  familyFit = familyFit === null || familyFit === undefined ? Number.NaN : Number(familyFit);
  const available = [phonetic, familyFit].filter(Number.isFinite);
  const average = available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
  const { band } = scorePresentation(average);
  if (band === 'excellent' || band === 'good') {
    return '성과 이름을 이어 불렀을 때 소리가 자연스럽고, 음절 사이에 걸리는 부분도 적어요.';
  }
  if (band === 'mixed') {
    return '부르기 어렵지는 않지만 성과 이어지는 느낌에는 호불호가 있을 수 있어요. 소리 내어 여러 번 불러 보세요.';
  }
  return '음절이 이어질 때 조금 걸리는 부분이 있어요. 비슷한 뜻을 가진 다른 이름과 소리도 함께 비교해 보세요.';
}

export function metricValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number)}점` : null;
}

function recommendationBand(score, criticalScores) {
  const base = scorePresentation(score).band;
  const criticalBands = criticalScores
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => scorePresentation(value).band);
  const cautionCount = criticalBands.filter((band) => band === 'caution').length;
  const mixedOrCautionCount = criticalBands.filter((band) => band === 'mixed' || band === 'caution').length;
  if (cautionCount >= 2) return 'caution';
  if (cautionCount >= 1 || mixedOrCautionCount >= 2) return 'mixed';
  return base;
}

export function reportVerdict(score, criticalScores = []) {
  const band = recommendationBand(score, criticalScores);
  const { label } = bandPresentation(band);
  const copy = {
    excellent: {
      headline: '우선 추천 이름으로 손색이 없어요.',
      summary: '사주와의 어울림, 이름의 짜임, 부르는 느낌이 고르게 좋은 편이에요.',
      closing: '여러 후보 가운데 먼저 마음에 담아 두어도 좋은 이름이에요.',
    },
    good: {
      headline: '추천 후보로 충분히 살펴볼 만해요.',
      summary: '분명한 장점이 있고, 확인할 부분도 크지 않은 이름이에요.',
      closing: '장점이 또렷한 이름이니 가족과 함께 소리 내어 불러 보고 결정해 보세요.',
    },
    mixed: {
      headline: '좋은 점과 아쉬운 점을 함께 봐야 해요.',
      summary: '한 가지 기준만으로 결정하기보다 다른 후보와 나란히 비교하는 편이 좋아요.',
      closing: '마음에 든다면 장점을 살리되, 비슷한 소리의 다른 한자 조합도 함께 살펴보세요.',
    },
    caution: {
      headline: '이 이름은 우선 추천에서 한 걸음 뒤에 두는 편이 좋아요.',
      summary: '현재 필요한 방향과 어긋나는 부분이 있어 다른 후보를 먼저 살펴보길 권해요.',
      closing: '같은 느낌을 살리면서 부족한 부분을 덜어 낸 다른 후보와 비교해 보세요.',
    },
  };
  return { band, label, ...copy[band] };
}
