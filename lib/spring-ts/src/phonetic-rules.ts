import type { NameCharInput } from './types.js';

export type PhoneticRiskLevel = 'low' | 'medium' | 'high';
export type PhoneticStatus = 'smooth' | 'watch' | 'awkward' | 'unknown';
export type PhoneticBoundaryKind = 'surname_given' | 'given_internal';

export interface PhoneticSyllable {
  readonly char: string;
  readonly onset: string;
  readonly nucleus: string;
  readonly coda: string;
  readonly codaRepresentative: string | null;
}

export interface PhoneticSignal {
  readonly code: string;
  readonly severity: PhoneticRiskLevel;
  readonly penalty: number;
  readonly message: string;
}

export interface PhoneticTransition {
  readonly from: string;
  readonly to: string;
  readonly boundary: PhoneticBoundaryKind;
  readonly score: number;
  readonly risk: PhoneticRiskLevel;
  readonly signals: readonly PhoneticSignal[];
}

export interface PhoneticAnalysis {
  readonly fullHangul: string;
  readonly surnameHangul: string;
  readonly givenHangul: string;
  readonly phoneticScore: number | null;
  readonly transitionScore: number | null;
  readonly familyNameFitScore: number | null;
  readonly status: PhoneticStatus;
  readonly transitions: readonly PhoneticTransition[];
  readonly warnings: readonly PhoneticSignal[];
  readonly evidence: readonly string[];
  readonly sourceTier: 'T3_AUTHORED_INTERPRETATION';
  readonly authorityTruthEligible: false;
}

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const SYLLABLES_PER_ONSET = 588;
const SYLLABLES_PER_NUCLEUS = 28;

const CHOSEONG = [
  '\u3131', '\u3132', '\u3134', '\u3137', '\u3138', '\u3139', '\u3141',
  '\u3142', '\u3143', '\u3145', '\u3146', '\u3147', '\u3148', '\u3149',
  '\u314a', '\u314b', '\u314c', '\u314d', '\u314e',
] as const;

const JUNGSEONG = [
  '\u314f', '\u3150', '\u3151', '\u3152', '\u3153', '\u3154', '\u3155',
  '\u3156', '\u3157', '\u3158', '\u3159', '\u315a', '\u315b', '\u315c',
  '\u315d', '\u315e', '\u315f', '\u3160', '\u3161', '\u3162', '\u3163',
] as const;

const JONGSEONG = [
  '', '\u3131', '\u3132', '\u3133', '\u3134', '\u3135', '\u3136',
  '\u3137', '\u3139', '\u313a', '\u313b', '\u313c', '\u313d', '\u313e',
  '\u313f', '\u3140', '\u3141', '\u3142', '\u3144', '\u3145', '\u3146',
  '\u3147', '\u3148', '\u314a', '\u314b', '\u314c', '\u314d', '\u314e',
] as const;

const OBSTRUENT_REP = new Set(['\u3131', '\u3137', '\u3142']);
const NASAL_ONSETS = new Set(['\u3134', '\u3141']);
const TENSE_TRIGGER_ONSETS = new Set(['\u3131', '\u3137', '\u3142', '\u3145', '\u3148']);
const SONORANTS = new Set(['\u3134', '\u3139', '\u3141', '\u3147']);
const COMPLEX_CODAS = new Set([
  '\u3133', '\u3135', '\u3136', '\u313a', '\u313b', '\u313c', '\u313d',
  '\u313e', '\u313f', '\u3140', '\u3144',
]);
const CODA_REPRESENTATIVE: Readonly<Record<string, string>> = {
  '\u3131': '\u3131',
  '\u3132': '\u3131',
  '\u3133': '\u3131',
  '\u314b': '\u3131',
  '\u313a': '\u3131',
  '\u3134': '\u3134',
  '\u3135': '\u3134',
  '\u3136': '\u3134',
  '\u3137': '\u3137',
  '\u3145': '\u3137',
  '\u3146': '\u3137',
  '\u3148': '\u3137',
  '\u314a': '\u3137',
  '\u314c': '\u3137',
  '\u314e': '\u3137',
  '\u3139': '\u3139',
  '\u313b': '\u3139',
  '\u313c': '\u3139',
  '\u313d': '\u3139',
  '\u313e': '\u3139',
  '\u313f': '\u3139',
  '\u3140': '\u3139',
  '\u3141': '\u3141',
  '\u3142': '\u3142',
  '\u3144': '\u3142',
  '\u314d': '\u3142',
  '\u3147': '\u3147',
};

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, roundScore(value)));
}

function scoreRisk(score: number): PhoneticRiskLevel {
  if (score < 72) return 'high';
  if (score < 86) return 'medium';
  return 'low';
}

function statusForScore(score: number | null, warnings: readonly PhoneticSignal[]): PhoneticStatus {
  if (score === null) return 'unknown';
  if (warnings.some((warning) => warning.severity === 'high')) return score < 78 ? 'awkward' : 'watch';
  if (warnings.filter((warning) => warning.severity === 'medium').length >= 2) return 'watch';
  if (score < 72) return 'awkward';
  if (score < 86) return 'watch';
  return 'smooth';
}

function toHangulKey(chars: readonly NameCharInput[] | undefined): string {
  return (chars ?? []).map((char) => char.hangul ?? '').join('').trim();
}

function decomposeSyllable(char: string): PhoneticSyllable | null {
  const code = char.charCodeAt(0);
  if (code < HANGUL_BASE || code > HANGUL_END) return null;

  const offset = code - HANGUL_BASE;
  const onset = CHOSEONG[Math.floor(offset / SYLLABLES_PER_ONSET)] ?? '\u3147';
  const nucleus = JUNGSEONG[Math.floor((offset % SYLLABLES_PER_ONSET) / SYLLABLES_PER_NUCLEUS)] ?? '\u314f';
  const coda = JONGSEONG[offset % SYLLABLES_PER_NUCLEUS] ?? '';
  return {
    char,
    onset,
    nucleus,
    coda,
    codaRepresentative: coda ? CODA_REPRESENTATIVE[coda] ?? coda : null,
  };
}

function syllablesFor(text: string): PhoneticSyllable[] {
  return Array.from(text).flatMap((char) => {
    const syllable = decomposeSyllable(char);
    return syllable ? [syllable] : [];
  });
}

function signal(
  code: string,
  severity: PhoneticRiskLevel,
  penalty: number,
  message: string,
): PhoneticSignal {
  return { code, severity, penalty, message };
}

function transitionSignals(from: PhoneticSyllable, to: PhoneticSyllable, boundary: PhoneticBoundaryKind): PhoneticSignal[] {
  const signals: PhoneticSignal[] = [];
  const rep = from.codaRepresentative;

  if (from.coda && COMPLEX_CODAS.has(from.coda)) {
    signals.push(signal(
      'complex_batchim_boundary',
      to.onset === '\u3147' ? 'medium' : 'high',
      to.onset === '\u3147' ? 10 : 14,
      `${from.char}${to.char} contains a complex batchim boundary; the naming heuristic flags it for pronunciation review without deciding the realized sound.`,
    ));
  }

  if (rep && OBSTRUENT_REP.has(rep) && NASAL_ONSETS.has(to.onset)) {
    signals.push(signal(
      'nasal_assimilation_boundary',
      'high',
      boundary === 'surname_given' ? 18 : 15,
      `${from.char}${to.char} crosses an obstruent batchim into a nasal onset; pronunciation may shift by nasal assimilation.`,
    ));
  }

  if (rep && OBSTRUENT_REP.has(rep) && to.onset !== '\u3147' && !NASAL_ONSETS.has(to.onset) && !TENSE_TRIGGER_ONSETS.has(to.onset)) {
    signals.push(signal(
      'batchim_consonant_cluster',
      boundary === 'surname_given' ? 'high' : 'medium',
      boundary === 'surname_given' ? 16 : 11,
      `${from.char}${to.char} closes one syllable with an obstruent batchim and starts the next with a consonant, which can make the name feel clipped.`,
    ));
  }

  if (rep && OBSTRUENT_REP.has(rep) && TENSE_TRIGGER_ONSETS.has(to.onset)) {
    signals.push(signal(
      'tensing_boundary',
      'medium',
      boundary === 'surname_given' ? 13 : 10,
      `${from.char}${to.char} can sound harder because an obstruent batchim is followed by a plain consonant onset.`,
    ));
  }

  if (rep && to.onset === '\u3139' && ['\u3131', '\u3141', '\u3142', '\u3147'].includes(rep)) {
    signals.push(signal(
      'rieul_nasalization_boundary',
      'medium',
      boundary === 'surname_given' ? 13 : 11,
      `${from.char}${to.char} places batchim ${rep} before initial rieul; this can create a changed connected sound.`,
    ));
  }

  if ((rep === '\u3134' && to.onset === '\u3139') || (rep === '\u3139' && to.onset === '\u3134')) {
    signals.push(signal(
      'nieun_rieul_liquid_boundary',
      'medium',
      boundary === 'surname_given' ? 12 : 10,
      `${from.char}${to.char} has an adjacent nieun/rieul boundary that often fuses in pronunciation.`,
    ));
  }

  if (from.coda && to.onset === from.coda) {
    signals.push(signal(
      'same_coda_onset_repeat',
      'medium',
      boundary === 'surname_given' ? 9 : 7,
      `${from.char}${to.char} repeats the same consonant across the syllable boundary.`,
    ));
  }

  if (from.onset === to.onset && from.onset !== '\u3147') {
    signals.push(signal(
      'same_initial_repeat',
      'low',
      boundary === 'surname_given' ? 8 : 6,
      `${from.char}${to.char} repeats the same initial consonant.`,
    ));
  }

  if (from.nucleus === to.nucleus && from.onset === to.onset) {
    signals.push(signal(
      'same_onset_vowel_repeat',
      'low',
      5,
      `${from.char}${to.char} repeats both initial consonant and vowel shape.`,
    ));
  } else if (from.nucleus === to.nucleus && boundary === 'given_internal') {
    signals.push(signal(
      'same_vowel_repeat',
      'low',
      3,
      `${from.char}${to.char} repeats the same medial vowel, which can sound monotonous in short given names.`,
    ));
  }

  if (rep && SONORANTS.has(rep) && SONORANTS.has(to.onset) && rep !== to.onset) {
    signals.push(signal(
      'sonorant_cluster',
      'low',
      boundary === 'surname_given' ? 5 : 4,
      `${from.char}${to.char} clusters sonorant sounds across the boundary.`,
    ));
  }

  return signals;
}

function buildTransitions(surname: readonly PhoneticSyllable[], given: readonly PhoneticSyllable[]): PhoneticTransition[] {
  const transitions: PhoneticTransition[] = [];
  const lastSurname = surname[surname.length - 1];
  const firstGiven = given[0];

  if (lastSurname && firstGiven) {
    const signals = transitionSignals(lastSurname, firstGiven, 'surname_given');
    const score = clampScore(100 - signals.reduce((sum, item) => sum + item.penalty, 0));
    transitions.push({
      from: lastSurname.char,
      to: firstGiven.char,
      boundary: 'surname_given',
      score,
      risk: scoreRisk(score),
      signals,
    });
  }

  for (let index = 0; index < given.length - 1; index += 1) {
    const from = given[index];
    const to = given[index + 1];
    if (!from || !to) continue;
    const signals = transitionSignals(from, to, 'given_internal');
    const score = clampScore(100 - signals.reduce((sum, item) => sum + item.penalty, 0));
    transitions.push({
      from: from.char,
      to: to.char,
      boundary: 'given_internal',
      score,
      risk: scoreRisk(score),
      signals,
    });
  }

  return transitions;
}

function topWarnings(transitions: readonly PhoneticTransition[]): PhoneticSignal[] {
  const severityRank: Record<PhoneticRiskLevel, number> = { high: 3, medium: 2, low: 1 };
  return transitions
    .flatMap((transition) => transition.signals)
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || b.penalty - a.penalty)
    .slice(0, 6);
}

export function getPhoneticAnalysis(
  surname: readonly NameCharInput[] | undefined,
  givenName: readonly NameCharInput[] | undefined,
): PhoneticAnalysis {
  const surnameHangul = toHangulKey(surname);
  const givenHangul = toHangulKey(givenName);
  const fullHangul = `${surnameHangul}${givenHangul}`;
  const surnameSyllables = syllablesFor(surnameHangul);
  const givenSyllables = syllablesFor(givenHangul);

  if (!surnameSyllables.length || !givenSyllables.length) {
    return {
      fullHangul,
      surnameHangul,
      givenHangul,
      phoneticScore: null,
      transitionScore: null,
      familyNameFitScore: null,
      status: 'unknown',
      transitions: [],
      warnings: [],
      evidence: ['Hangul surname and given-name syllables are required for phonetic transition analysis.'],
      sourceTier: 'T3_AUTHORED_INTERPRETATION',
      authorityTruthEligible: false,
    };
  }

  const transitions = buildTransitions(surnameSyllables, givenSyllables);
  const transitionScore = transitions.length
    ? roundScore(transitions.reduce((sum, item) => sum + item.score, 0) / transitions.length)
    : null;
  const familyNameFitScore = transitions.find((transition) => transition.boundary === 'surname_given')?.score ?? null;
  const phoneticScore = transitionScore === null && familyNameFitScore === null
    ? null
    : roundScore(((transitionScore ?? 100) * 0.6) + ((familyNameFitScore ?? 100) * 0.4));
  const warnings = topWarnings(transitions);
  const status = statusForScore(phoneticScore, warnings);
  const evidence = [
    phoneticScore === null
      ? 'No score was computed because no analyzable Hangul transitions were found.'
      : `Phonetic score ${phoneticScore}/100 (${status}); display-only and not included in total score or ranking.`,
    familyNameFitScore === null
      ? 'No surname-to-given boundary was available.'
      : `Surname-to-given fit ${familyNameFitScore}/100 from ${surnameSyllables[surnameSyllables.length - 1]?.char}${givenSyllables[0]?.char}.`,
    warnings.length
      ? warnings[0].message
      : 'No deterministic batchim collision or repeated-phoneme warning was detected.',
  ];

  return {
    fullHangul,
    surnameHangul,
    givenHangul,
    phoneticScore,
    transitionScore,
    familyNameFitScore,
    status,
    transitions,
    warnings,
    evidence,
    sourceTier: 'T3_AUTHORED_INTERPRETATION',
    authorityTruthEligible: false,
  };
}
