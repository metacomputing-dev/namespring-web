// Pure derivation layer for the combined report v2. Every value here is
// either engine output passed through, or a deterministic rendering of
// computed values — no invented narrative (기획안 05 guardrail).

import {
  ELEMENT_KO,
  ELEMENT_NOUN,
  STEM_HANJA,
  normalizeElement,
  relationBetween,
  relationToTarget,
} from './element-relations.js';

const FRAME_LABELS = { won: '원격', hyung: '형격', lee: '이격', jung: '정격' };
const FRAME_PERIODS = { won: '초년', hyung: '청장년', lee: '중년', jung: '전생애' };

const FAVORABLE_LUCKY_LEVELS = new Set(['최상운수', '상운수', '양운수']);
const ADVERSE_LUCKY_LEVELS = new Set(['흉운수', '최흉운수']);

function textOf(value) {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function entriesOf(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

function listOf(value) {
  return Array.isArray(value)
    ? value.map((item) => textOf(item)).filter(Boolean)
    : [];
}

function finiteScore(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num * 10) / 10 : null;
}

/** Engine polarity values arrive as Positive/Negative or 양/음. */
export function polarityKo(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'positive' || raw === '양') return '양';
  if (raw === 'negative' || raw === '음') return '음';
  return null;
}

/** Same grade thresholds as the standalone naming report. */
export function nameScoreGrade(score) {
  if (score >= 85) return '매우 균형이 좋은 이름';
  if (score >= 70) return '안정적인 균형의 이름';
  if (score >= 55) return '무난한 흐름의 이름';
  return '보완이 필요한 이름';
}

export function deriveSoundTrack(hangulAnalysis) {
  const blocks = entriesOf(hangulAnalysis?.blocks);
  if (blocks.length < 2) {
    return { state: 'mixed', edges: [], reason: null };
  }
  const edges = [];
  for (let i = 0; i < blocks.length - 1; i += 1) {
    const relation = relationBetween(blocks[i].element, blocks[i + 1].element);
    if (relation) edges.push(relation);
  }
  if (!edges.length) return { state: 'mixed', edges, reason: null };
  const adverse = edges.filter((edge) => !edge.favorable);
  const state = adverse.length === 0 ? 'good' : adverse.length === edges.length ? 'bad' : 'mixed';
  return { state, edges, reason: edges.map((edge) => edge.label).join(' · ') };
}

export function deriveFramesTrack(fourFrame) {
  const frames = entriesOf(fourFrame?.frames);
  if (!frames.length) return { state: 'mixed', grades: [] };
  const grades = frames.map((frame) => frameGrade(frame));
  const known = grades.filter((grade) => grade !== null);
  if (!known.length) return { state: 'mixed', grades };
  const adverse = known.filter((grade) => grade === 'adverse');
  const state = adverse.length === 0 ? 'good' : adverse.length === known.length ? 'bad' : 'mixed';
  return { state, grades };
}

export function frameGrade(frame) {
  const level = textOf(frame?.meaning?.lucky_level);
  if (!level) return null;
  if (FAVORABLE_LUCKY_LEVELS.has(level)) return 'favorable';
  if (ADVERSE_LUCKY_LEVELS.has(level)) return 'adverse';
  // The meaning DB carries label variants beyond the canonical five
  // (e.g. "주의가 필요한 수리") — classify by cue word before giving up.
  if (level.includes('흉') || level.includes('주의')) return 'adverse';
  if (level.includes('상운수') || level.includes('양운수') || level.includes('길')) return 'favorable';
  return null;
}

export function deriveHarmonyTrack(sajuCompatibility) {
  if (!sajuCompatibility) return { state: 'mixed' };
  const yongshinMatches = Number(sajuCompatibility.yongshinMatchCount) || 0;
  const gishinMatches = Number(sajuCompatibility.gishinMatchCount) || 0;
  if (gishinMatches > 0) return { state: 'bad' };
  if (yongshinMatches > 0) return { state: 'good' };
  return { state: 'mixed' };
}

// Short state vocabulary in the prototype's voice — deterministic labels,
// not narrative claims.
const TRACK_STATE_LABELS = {
  sound: { good: '순한 흐름', mixed: '대체로 순함', bad: '부딪히는 흐름' },
  frames: { good: '밝은 수리', mixed: '대체로 밝음', bad: '무거운 수리' },
  harmony: { good: '정면 보강', mixed: '간접 연결', bad: '주의 필요' },
};

function buildTracks(springReport) {
  const analysis = springReport?.namingReport?.analysis;
  const sound = deriveSoundTrack(analysis?.hangul);
  const frames = deriveFramesTrack(analysis?.fourFrame);
  const harmony = deriveHarmonyTrack(springReport?.sajuCompatibility);
  return [
    { key: 'sound', label: '발음', state: sound.state, target: 'sec-sound' },
    { key: 'frames', label: '획수', state: frames.state, target: 'sec-frames' },
    { key: 'harmony', label: '사주 궁합', state: harmony.state, target: 'sec-harmony' },
  ].map((track) => ({
    ...track,
    stateLabel: TRACK_STATE_LABELS[track.key]?.[track.state] || null,
  }));
}

function buildIdentity(entryUserInfo) {
  const birth = entryUserInfo?.birthDateTime;
  const year = Number(birth?.year);
  if (!Number.isFinite(year) || year <= 0) return null;
  const pad = (value) => String(Number(value) || 0).padStart(2, '0');
  const date = `${year}.${pad(birth.month)}.${pad(birth.day)}`;
  const calendar = entryUserInfo.isSolarCalendar === false ? '음력' : '양력';
  const timeUnknown = Boolean(entryUserInfo.isBirthTimeUnknown) || !Number.isFinite(Number(birth.hour));
  const time = timeUnknown ? '(시각 미상)' : `${pad(birth.hour)}:${pad(birth.minute)}`;
  const gender = entryUserInfo.gender === 'female' ? '여'
    : entryUserInfo.gender === 'male' ? '남' : null;
  return { text: `${date} ${time} ${calendar}`, gender };
}

function buildHero(springReport, fortuneReport, entryUserInfo) {
  // namingReport.name is the authoritative evaluated name — the combined
  // report may be opened for a recommendation candidate whose given name
  // differs from the entry input.
  const name = springReport?.namingReport?.name;
  let baseChars = [...entriesOf(name?.surname), ...entriesOf(name?.givenName)];
  if (!baseChars.length) {
    baseChars = [...entriesOf(entryUserInfo?.lastName), ...entriesOf(entryUserInfo?.firstName)];
  }
  const hangulBlocks = entriesOf(springReport?.namingReport?.analysis?.hangul?.blocks);
  const chars = baseChars.map((char, index) => ({
    hangul: textOf(char.hangul) || '',
    hanja: textOf(char.hanja),
    meaning: textOf(char.meaning),
    // Phonetic element first (matches section ①'s reading); fall back to
    // the char detail's own element for pure-hanja contexts.
    element: (hangulBlocks.length === baseChars.length
      ? normalizeElement(hangulBlocks[index]?.element)
      : null) || normalizeElement(char.element),
  }));
  const compatibility = fortuneReport?.nameCompatibility || null;
  const verdictSentence = textOf(fortuneReport?.tieredMatrix?.nameSajuReading?.sentence)
    || textOf(compatibility?.summary);
  return {
    chars,
    fullHangul: textOf(name?.fullHangul) || chars.map((char) => char.hangul).join(''),
    fullHanja: textOf(name?.fullHanja)
      || (chars.every((char) => char.hanja) ? chars.map((char) => char.hanja).join('') : null),
    score: Number.isFinite(compatibility?.overallScore)
      ? Math.round(compatibility.overallScore)
      : Number.isFinite(springReport?.finalScore) ? Math.round(springReport.finalScore) : null,
    stars: compatibility?.overallStars ?? null,
    verdictSentence,
    subline: verdictSentence === textOf(compatibility?.summary) ? null : textOf(compatibility?.summary),
    identity: buildIdentity(entryUserInfo),
    tracks: buildTracks(springReport),
  };
}

/**
 * Element-landscape scene data: resource-element counts (자원오행) drive the
 * landscape sprites, hangul polarity counts pick the sky (day/night/dusk).
 * Same sources as the legacy naming-report illustration.
 */
function buildScene(springReport) {
  const hanjaBlocks = entriesOf(springReport?.namingReport?.analysis?.hanja?.blocks);
  const hangulBlocks = entriesOf(springReport?.namingReport?.analysis?.hangul?.blocks);
  if (!hanjaBlocks.length && !hangulBlocks.length) return null;
  const elements = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const block of hanjaBlocks) {
    const key = normalizeElement(block.resourceElement);
    if (key) elements[key] += 1;
  }
  let positive = 0;
  let negative = 0;
  for (const block of hangulBlocks) {
    const p = polarityKo(block.polarity);
    if (p === '양') positive += 1;
    if (p === '음') negative += 1;
  }
  // Saju side of the picture: the natal element distribution plus the
  // needed/avoided elements, so the hero can show what the name fills.
  const sajuReport = springReport?.sajuReport;
  let saju = null;
  if (sajuReport && sajuReport.sajuEnabled !== false && sajuReport.elementDistribution) {
    const counts = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
    for (const [name, value] of Object.entries(sajuReport.elementDistribution)) {
      const key = normalizeElement(name);
      if (key) counts[key] += Number(value) || 0;
    }
    if (Object.values(counts).some((count) => count > 0)) saju = counts;
  }
  const yongshin = normalizeElement(sajuReport?.yongshin?.element)
    || normalizeElement(springReport?.sajuCompatibility?.yongshinElement);
  const gishin = normalizeElement(sajuReport?.yongshin?.gishin)
    || normalizeElement(springReport?.sajuCompatibility?.gishinElement);
  return { elements, positive, negative, saju, yongshin, gishin };
}

/** Pure-naming score block (성명학 점수) — separate from the saju-blended hero score. */
function buildNameScores(springReport) {
  const naming = springReport?.namingReport;
  const total = finiteScore(naming?.totalScore);
  if (total === null) return null;
  const analysis = naming.analysis || {};
  const partScores = naming.scores || {};
  const parts = [];
  if (analysis.hangul) {
    parts.push({
      key: 'hangul',
      label: '발음 (한글)',
      polarity: finiteScore(analysis.hangul.polarityScore),
      element: finiteScore(analysis.hangul.elementScore),
      final: finiteScore(partScores.hangul),
    });
  }
  if (analysis.hanja) {
    parts.push({
      key: 'hanja',
      label: '자원 (한자)',
      polarity: finiteScore(analysis.hanja.polarityScore),
      element: finiteScore(analysis.hanja.elementScore),
      final: finiteScore(partScores.hanja),
    });
  }
  if (analysis.fourFrame) {
    parts.push({
      key: 'frames',
      label: '수리 (사격)',
      element: finiteScore(analysis.fourFrame.elementScore),
      luck: finiteScore(analysis.fourFrame.luckScore),
      final: finiteScore(partScores.fourFrame),
    });
  }
  return { total, grade: nameScoreGrade(total), parts };
}

function buildFlow(springReport) {
  const hangul = springReport?.namingReport?.analysis?.hangul;
  const blocks = entriesOf(hangul?.blocks);
  if (!blocks.length) return null;
  const surnameLength = entriesOf(springReport?.namingReport?.name?.surname).length || 1;
  const nodes = blocks.map((block) => {
    const element = normalizeElement(block.element);
    return {
      hangul: textOf(block.hangul) || '',
      onset: textOf(block.onset),
      element,
      elementKo: ELEMENT_KO[element] || null,
      elementNoun: ELEMENT_NOUN[element] || null,
      polarity: textOf(block.polarity),
      polarityKo: polarityKo(block.polarity),
    };
  });
  const edges = [];
  for (let i = 0; i < blocks.length - 1; i += 1) {
    const relation = relationBetween(blocks[i].element, blocks[i + 1].element);
    edges.push(relation
      ? {
        ...relation,
        plainLabel: relation.favorable ? '살려 줌' : '부딪힘',
        zone: i < surnameLength ? '성-이름 경계' : '이름 안쪽',
      }
      : null);
  }
  return {
    nodes,
    edges,
    polarityScore: Number.isFinite(hangul?.polarityScore) ? hangul.polarityScore : null,
    elementScore: Number.isFinite(hangul?.elementScore) ? hangul.elementScore : null,
    finalScore: finiteScore(springReport?.namingReport?.scores?.hangul),
    state: deriveSoundTrack(hangul).state,
  };
}

function buildFrames(springReport) {
  const fourFrame = springReport?.namingReport?.analysis?.fourFrame;
  const frames = entriesOf(fourFrame?.frames);
  if (!frames.length) return null;
  const charStrokes = entriesOf(springReport?.namingReport?.analysis?.hanja?.blocks)
    .filter((block) => textOf(block.hanja) && Number.isFinite(block.strokes))
    .map((block) => ({ hanja: block.hanja, strokes: block.strokes }));
  // Meaning DB texts carry a [성함] placeholder — substitute the evaluated name.
  const name = springReport?.namingReport?.name;
  const fullHangul = textOf(name?.fullHangul)
    || [...entriesOf(name?.surname), ...entriesOf(name?.givenName)]
      .map((char) => textOf(char.hangul) || '')
      .join('');
  const withName = (value) => {
    const text = textOf(value);
    if (!text) return null;
    return fullHangul ? text.replace(/\[성함\]/g, fullHangul) : text;
  };
  return {
    charStrokes: charStrokes.length ? charStrokes : null,
    frames: frames.map((frame) => {
      const element = normalizeElement(frame.element);
      const detail = frame.meaning
        ? {
          explanation: withName(frame.meaning.detailed_explanation),
          positives: withName(frame.meaning.positive_aspects),
          cautions: withName(frame.meaning.caution_points),
          personality: listOf(frame.meaning.personality_traits),
          careers: listOf(frame.meaning.suitable_career),
          opportunity: withName(frame.meaning.opportunity_area),
          challenge: withName(frame.meaning.challenge_period),
          special: withName(frame.meaning.special_characteristics),
        }
        : null;
      const hasDetail = Boolean(detail && (
        detail.explanation || detail.positives || detail.cautions
        || detail.personality.length || detail.careers.length
        || detail.opportunity || detail.challenge || detail.special
      ));
      return {
        type: frame.type,
        label: FRAME_LABELS[frame.type] || frame.type,
        period: FRAME_PERIODS[frame.type] || null,
        strokeSum: Number.isFinite(frame.strokeSum) ? frame.strokeSum : null,
        element,
        elementKo: ELEMENT_KO[element] || null,
        polarityKo: polarityKo(frame.polarity),
        grade: frameGrade(frame),
        luckyLevelText: textOf(frame.meaning?.lucky_level),
        title: withName(frame.meaning?.title),
        summary: withName(frame.meaning?.summary),
        lifePeriodInfluence: withName(frame.meaning?.life_period_influence),
        cautionPoints: withName(frame.meaning?.caution_points),
        detail: hasDetail ? detail : null,
      };
    }),
    scores: {
      element: finiteScore(fourFrame.elementScore),
      luck: finiteScore(fourFrame.luckScore),
      final: finiteScore(springReport?.namingReport?.scores?.fourFrame),
    },
    state: deriveFramesTrack(fourFrame).state,
  };
}

export function strengthMeterPosition(strength) {
  const support = Number(strength?.totalSupport);
  const oppose = Number(strength?.totalOppose);
  if (!Number.isFinite(support) || !Number.isFinite(oppose) || support + oppose <= 0) {
    return strength?.isStrong ? 0.7 : 0.3;
  }
  return Math.min(0.95, Math.max(0.05, support / (support + oppose)));
}

function buildPillarColumns(overview) {
  const pillars = entriesOf(overview?.pillars).slice(0, 4);
  if (!pillars.length) return null;
  const labels = ['년주', '월주', '일주', '시주'];
  return pillars.map((pillar, index) => {
    // Keep the raw element labels — SajuPillarTable normalizes tolerant
    // Korean/English forms itself, so passing them through preserves
    // formats the strict normalizer here would drop.
    const [stemElement, branchElement] = String(pillar.element ?? '')
      .split('/')
      .map((part) => part.trim());
    return {
      key: `pillar-${index}`,
      label: textOf(pillar.position) || labels[index],
      stem: textOf(pillar.stem) || '-',
      branch: textOf(pillar.branch) || '-',
      stemElement: stemElement || null,
      branchElement: branchElement || null,
    };
  });
}

function buildSaju(springReport, fortuneReport) {
  const saju = springReport?.sajuReport;
  if (!saju || saju.sajuEnabled === false) return null;
  const overview = fortuneReport?.overviewSummary || {};
  return {
    analysisStatus: saju.analysisStatus ?? null,
    pillars: saju.pillars || null,
    pillarColumns: buildPillarColumns(overview),
    dayMaster: saju.dayMaster
      ? {
        stem: textOf(saju.dayMaster.stem),
        hanja: STEM_HANJA[textOf(saju.dayMaster.stem)] || null,
        element: normalizeElement(saju.dayMaster.element),
        elementKo: ELEMENT_KO[normalizeElement(saju.dayMaster.element)] || null,
        elementNoun: ELEMENT_NOUN[normalizeElement(saju.dayMaster.element)] || null,
        polarity: textOf(saju.dayMaster.polarity),
      }
      : null,
    strength: saju.strength
      ? {
        level: textOf(saju.strength.level),
        isStrong: Boolean(saju.strength.isStrong),
        meterPosition: strengthMeterPosition(saju.strength),
        deukryeong: saju.strength.deukryeong,
        deukji: saju.strength.deukji,
        deukse: saju.strength.deukse,
        details: Array.isArray(saju.strength.details) ? saju.strength.details : [],
      }
      : null,
    yongshin: saju.yongshin
      ? {
        element: normalizeElement(saju.yongshin.element),
        elementKo: ELEMENT_KO[normalizeElement(saju.yongshin.element)] || null,
        heeshin: normalizeElement(saju.yongshin.heeshin),
        gishin: normalizeElement(saju.yongshin.gishin),
        confidence: Number.isFinite(saju.yongshin.confidence) ? saju.yongshin.confidence : null,
      }
      : null,
    gyeokguk: saju.gyeokguk
      ? {
        type: textOf(saju.gyeokguk.type),
        category: textOf(saju.gyeokguk.category),
        confidence: Number.isFinite(saju.gyeokguk.confidence) ? saju.gyeokguk.confidence : null,
        reasoning: textOf(saju.gyeokguk.reasoning),
      }
      : null,
    elementDistribution: saju.elementDistribution || null,
    elementBars: (() => {
      const distribution = saju.elementDistribution;
      if (!distribution || typeof distribution !== 'object') return null;
      const bars = ['wood', 'fire', 'earth', 'metal', 'water'].map((key) => {
        const raw = Object.entries(distribution)
          .find(([name]) => normalizeElement(name) === key);
        return { element: key, ko: ELEMENT_KO[key], count: Number(raw?.[1]) || 0 };
      });
      const max = Math.max(...bars.map((bar) => bar.count));
      if (max <= 0) return null;
      return bars.map((bar) => ({ ...bar, ratio: bar.count / max }));
    })(),
    yinYangBalance: saju.yinYangBalance || null,
    uncertaintyMessage: textOf(saju.inputUncertainty?.unknownHour?.message),
    texts: {
      dayMaster: textOf(overview.dayMasterDescription),
      strength: textOf(overview.strengthDescription),
      yongshin: textOf(overview.yongshinDescription),
      elementBalance: textOf(overview.elementBalance),
      plain: textOf(overview.plainText),
      expert: textOf(overview.expertText),
    },
  };
}

function buildHarmony(springReport, fortuneReport) {
  const compat = springReport?.sajuCompatibility;
  if (!compat) return null;
  const yongshin = compat.yongshinElement;
  // Given-name characters only, like the prototype — the surname is fixed,
  // the given name is what carries the choice.
  const surnameLength = entriesOf(springReport?.namingReport?.name?.surname).length;
  const givenDetails = entriesOf(springReport?.namingReport?.name?.givenName);
  const hanjaBlocks = entriesOf(springReport?.namingReport?.analysis?.hanja?.blocks)
    .slice(surnameLength);
  const hangulBlocks = entriesOf(springReport?.namingReport?.analysis?.hangul?.blocks)
    .slice(surnameLength);
  const source = givenDetails.length ? givenDetails : hanjaBlocks;
  const chars = source.map((detail, index) => {
    const hanjaBlock = hanjaBlocks[index] || {};
    const resourceElement = normalizeElement(hanjaBlock.resourceElement)
      || normalizeElement(detail.element);
    const soundElement = normalizeElement(hangulBlocks[index]?.element);
    return {
      hanja: textOf(detail.hanja) || textOf(hanjaBlock.hanja),
      hangul: textOf(detail.hangul) || textOf(hanjaBlock.hangul),
      meaning: textOf(detail.meaning),
      strokes: Number.isFinite(detail.strokes)
        ? detail.strokes
        : Number.isFinite(hanjaBlock.strokes) ? hanjaBlock.strokes : null,
      element: resourceElement,
      elementKo: ELEMENT_KO[resourceElement] || null,
      elementNoun: ELEMENT_NOUN[resourceElement] || null,
      soundElement,
      soundElementNoun: ELEMENT_NOUN[soundElement] || null,
      polarityKo: polarityKo(hanjaBlock.polarity),
      relation: relationToTarget(resourceElement, yongshin),
    };
  });
  const details = Array.isArray(fortuneReport?.nameCompatibility?.details)
    ? fortuneReport.nameCompatibility.details.filter((line) => /용신|기신|희신/.test(String(line)))
    : [];
  return {
    yongshinElement: normalizeElement(yongshin),
    yongshinKo: ELEMENT_KO[normalizeElement(yongshin)] || null,
    heeshinElement: normalizeElement(compat.heeshinElement),
    gishinElement: normalizeElement(compat.gishinElement),
    yongshinMatchCount: Number(compat.yongshinMatchCount) || 0,
    gishinMatchCount: Number(compat.gishinMatchCount) || 0,
    affinityScore: Number.isFinite(compat.affinityScore) ? compat.affinityScore : null,
    chars,
    sentence: textOf(fortuneReport?.tieredMatrix?.nameSajuReading?.sentence),
    details,
    state: deriveHarmonyTrack(compat).state,
  };
}

const TRACK_RECAP_SENTENCES = {
  sound: {
    good: '발음 오행이 순방향으로 이어집니다.',
    mixed: '발음 오행에 순방향과 어긋나는 구간이 섞여 있습니다.',
    bad: '발음 오행이 서로 부딪히는 흐름입니다.',
  },
  frames: {
    good: '획수 사격이 유리한 수리로 구성되어 있습니다.',
    mixed: '획수 사격에 유리한 수리와 무거운 수리가 함께 있습니다.',
    bad: '획수 사격이 무거운 수리로 기울어 있습니다.',
  },
  harmony: {
    good: '이름의 기운이 사주가 필요로 하는 오행을 채워 줍니다.',
    mixed: '이름의 기운이 사주의 필요 오행과 직접 닿지는 않습니다.',
    bad: '이름의 기운에 사주가 피하려는 오행이 포함되어 있습니다.',
  },
};

function buildFinal(springReport, fortuneReport, hero) {
  const overview = fortuneReport?.overviewSummary || {};
  const strengths = entriesOf(fortuneReport?.strengthsWeaknesses?.strengths)
    .map((item) => ({ text: textOf(item.text), reason: textOf(item.reason) }))
    .filter((item) => item.text);
  const cautions = entriesOf(fortuneReport?.cautions?.cautions)
    .map((item) => ({ signal: textOf(item.signal), response: textOf(item.response), reason: textOf(item.reason) }))
    .filter((item) => item.signal);
  const harmonyState = hero.tracks.find((track) => track.key === 'harmony')?.state || 'mixed';
  return {
    recap: hero.tracks.map((track) => ({
      ...track,
      sentence: TRACK_RECAP_SENTENCES[track.key]?.[track.state] || null,
    })),
    closing: {
      summary: textOf(overview.overallSummary),
      plain: textOf(overview.plainText),
      expert: textOf(overview.expertText),
    },
    guide: { strengths, cautions },
    cta: harmonyState === 'good' ? 'share' : 'recommend',
  };
}

function buildStats(springReport) {
  const popularityRank = Number.isFinite(springReport?.popularityRank) ? springReport.popularityRank : null;
  const maleRatio = Number.isFinite(springReport?.maleRatio) ? springReport.maleRatio : null;
  const nameGender = springReport?.nameGender && springReport.nameGender !== 'unknown'
    ? springReport.nameGender
    : null;
  const nameTrend = springReport?.nameTrend || null;
  // The section queries the name-stat DB itself for the deep series
  // (yearly births/ranks, similar names, gender split) — it needs the
  // evaluated given name as the lookup key.
  const givenHangul = entriesOf(springReport?.namingReport?.name?.givenName)
    .map((char) => textOf(char.hangul) || '')
    .join('') || null;
  if (popularityRank === null && maleRatio === null && !nameGender && !nameTrend && !givenHangul) return null;
  return { popularityRank, maleRatio, nameGender, nameTrend, givenHangul };
}

function buildBasis(springReport, fortuneReport, vm) {
  const meta = fortuneReport?.meta || {};
  const rows = [];
  if (vm.flow?.edges?.length) {
    rows.push({ term: '발음 오행 흐름', value: vm.flow.edges.map((edge) => edge?.label).filter(Boolean).join(' · ') });
  }
  if (vm.frames?.frames?.length) {
    rows.push({
      term: '사격 수리',
      value: vm.frames.frames
        .map((frame) => `${frame.label} ${frame.strokeSum ?? '—'}${frame.luckyLevelText ? ` (${frame.luckyLevelText})` : ''}`)
        .join(' · '),
    });
  }
  if (vm.nameScores) {
    rows.push({
      term: '이름 점수 구성',
      value: `${vm.nameScores.parts
        .map((part) => `${part.label} ${part.final ?? '—'}`)
        .join(' · ')} — 종합 ${vm.nameScores.total}점`,
    });
  }
  if (vm.saju?.dayMaster) {
    rows.push({ term: '일간', value: `${vm.saju.dayMaster.stem ?? ''} ${ELEMENT_KO[vm.saju.dayMaster.element] ?? ''}`.trim() });
  }
  if (vm.saju?.strength?.level) {
    rows.push({ term: '신강약', value: vm.saju.strength.level });
  }
  if (vm.saju?.yongshin?.elementKo) {
    const confidence = vm.saju.yongshin.confidence;
    rows.push({
      term: '용신',
      value: `${vm.saju.yongshin.elementKo}${Number.isFinite(confidence) ? ` (신뢰도 ${Math.round(confidence)}점)` : ''}`,
    });
  }
  if (vm.saju?.gyeokguk?.type) {
    rows.push({ term: '격국', value: vm.saju.gyeokguk.type });
  }
  return {
    rows,
    gyeokgukReasoning: vm.saju?.gyeokguk?.reasoning ?? null,
    engineVersion: textOf(meta.engineVersion) || textOf(meta.version),
    generatedAt: textOf(meta.generatedAt),
    schoolPreset: textOf(meta.schoolPreset?.name) || textOf(meta.schoolPreset?.id),
    uncertainties: Array.isArray(meta.uncertainties) ? meta.uncertainties : [],
  };
}

export function buildCombinedViewModel({ springReport, fortuneReport, entryUserInfo }) {
  const hero = buildHero(springReport, fortuneReport, entryUserInfo);
  const vm = {
    hero,
    scene: buildScene(springReport),
    nameScores: buildNameScores(springReport),
    flow: buildFlow(springReport),
    frames: buildFrames(springReport),
    saju: buildSaju(springReport, fortuneReport),
    harmony: buildHarmony(springReport, fortuneReport),
    stats: buildStats(springReport),
  };
  vm.final = buildFinal(springReport, fortuneReport, hero);
  vm.basis = buildBasis(springReport, fortuneReport, vm);
  return vm;
}
