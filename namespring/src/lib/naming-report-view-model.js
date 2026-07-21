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
    excellent: '매우 좋음',
    good: '좋음',
    mixed: '비교 필요',
    caution: '신중히 검토',
  };
  const safeBand = Object.hasOwn(labels, band) ? band : 'mixed';
  return { band: safeBand, label: labels[safeBand] };
}

export function buildStructureNarrative(namingEvidence) {
  const score = Number(namingEvidence?.fourFrameScore);
  const { band } = scorePresentation(score);
  const lead = band === 'excellent' || band === 'good'
    ? '초년부터 총운까지 이어지는 수리 구조가 전반적으로 안정적이에요.'
    : band === 'mixed'
      ? '좋은 흐름과 살펴볼 부분이 함께 있어, 각 시기의 장단점을 같이 보는 편이 좋아요.'
      : '수리 구조에서 주의 신호가 확인돼, 같은 발음의 다른 한자 조합과 비교해 보는 편이 좋아요.';
  const frames = Array.isArray(namingEvidence?.frames) ? namingEvidence.frames : [];
  const positiveCount = frames.filter((frame) => Number(frame?.luckyLevel) >= 10).length;
  const follow = frames.length
    ? `네 가지 격 중 ${positiveCount}개에서 긍정적인 흐름이 확인돼요. 수리오행과 음양 배치도 함께 반영한 결과예요.`
    : '수리오행과 음양 배치를 함께 보는 성명학 분석이에요.';
  return [lead, follow];
}

export function buildSoundNarrative(candidate) {
  const phonetic = Number(candidate?.scoreVector?.phonetic);
  const familyFit = Number(candidate?.scoreVector?.familyFit);
  const available = [phonetic, familyFit].filter(Number.isFinite);
  const average = available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
  const { band } = scorePresentation(average);
  if (band === 'excellent' || band === 'good') {
    return '성과 이름이 이어지는 리듬이 부드럽고, 소리 구조에서도 불편한 충돌이 적어 자연스럽게 부르기 좋아요.';
  }
  if (band === 'mixed') {
    return '전반적으로 부르기에 무리는 없지만, 성과 붙였을 때의 리듬은 직접 여러 번 불러 비교해 보는 편이 좋아요.';
  }
  return '발음이 이어지는 과정에서 조금 걸리는 부분이 있어, 같은 뜻의 다른 음절 조합과 함께 비교해 보는 것을 권해요.';
}

export function metricValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number)}점` : '분석 중';
}
