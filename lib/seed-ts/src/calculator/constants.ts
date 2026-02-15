// ── Saju Balance Scoring ──
export const SAJU_BALANCE_MOVE_PENALTY = 20;
export const SAJU_BALANCE_ZERO_PENALTY = 10;
export const SAJU_BALANCE_SPREAD_PENALTY = 5;
export const SAJU_BALANCE_PASS_THRESHOLD = 70;

// ── Yongshin Affinity Weights ──
export const SAJU_GUSIN_AFFINITY = -1;
export const SAJU_GISIN_AFFINITY = -0.65;
export const SAJU_YONGSHIN_AFFINITY = 1;
export const SAJU_HEESIN_AFFINITY = 0.65;

// ── Yongshin Composite Score ──
export const SAJU_AFFINITY_WEIGHT = 0.55;
export const SAJU_RECOMMENDATION_WEIGHT = 0.45;
export const SAJU_CONFIDENCE_BASE = 0.55;
export const SAJU_CONFIDENCE_MULTIPLIER = 0.45;
export const SAJU_DEFAULT_CONFIDENCE = 0.65;
export const SAJU_DEFAULT_RECOMMENDATION_CONFIDENCE = 0.6;
export const SAJU_SECONDARY_ELEMENT_WEIGHT = 0.6;

// ── Penalty ──
export const SAJU_GISIN_PENALTY_MULTIPLIER = 7;
export const SAJU_GUSIN_PENALTY_MULTIPLIER = 14;
export const SAJU_PENALTY_BASE_FACTOR = 0.4;
export const SAJU_PENALTY_CONFIDENCE_FACTOR = 0.6;

// ── Adaptive Weights ──
export const SAJU_WEIGHT_BALANCE_DEFAULT = 0.6;
export const SAJU_WEIGHT_YONGSHIN_DEFAULT = 0.23;
export const SAJU_WEIGHT_STRENGTH = 0.12;
export const SAJU_WEIGHT_TEN_GOD = 0.05;
export const SAJU_WEIGHT_SHIFT_CONTRAST = 0.22;
export const SAJU_WEIGHT_SHIFT_CONFIDENCE_BASE = 0.6;
export const SAJU_WEIGHT_SHIFT_CONFIDENCE_MULT = 0.4;
export const SAJU_WEIGHT_SHIFT_CONTEXT = 0.08;
export const SAJU_WEIGHT_BALANCE_MIN = 0.35;
export const SAJU_WEIGHT_BALANCE_MAX = 0.6;
export const SAJU_WEIGHT_YONGSHIN_MIN = 0.23;
export const SAJU_WEIGHT_YONGSHIN_MAX = 0.48;
export const SAJU_WEIGHT_CONTRAST_DIVISOR = 70;

// ── Pass Criteria ──
export const SAJU_PASS_MIN_SCORE = 62;
export const SAJU_PASS_MIN_BALANCE = 45;
export const SAJU_PASS_MIN_YONGSHIN = 35;
export const SAJU_SEVERE_CONFLICT_GUSIN_RATIO = 0.75;

// ── Strength / Ten God ──
export const SAJU_STRENGTH_DEFAULT_INTENSITY = 0.35;
export const SAJU_STRENGTH_SCALE_BASE = 0.45;
export const SAJU_STRENGTH_SCALE_INTENSITY = 0.55;
export const SAJU_TEN_GOD_OVERREPRESENTED_MULT = 0.35;
export const SAJU_TEN_GOD_SCORE_MULTIPLIER = 45;

// ── Element Array Scoring ──
export const ELEMENT_ARRAY_BASE_SCORE = 70;
export const ELEMENT_ARRAY_SANG_SAENG_BONUS = 15;
export const ELEMENT_ARRAY_SANG_GEUK_PENALTY = 20;
export const ELEMENT_ARRAY_SAME_PENALTY = 5;
export const ELEMENT_BALANCE_BRACKETS: readonly [number, number][] = [
  [2, 100],
  [4, 85],
  [6, 70],
  [8, 55],
  [10, 40],
];
export const ELEMENT_BALANCE_FLOOR = 25;
export const ELEMENT_SANG_SAENG_MIN_RATIO = 0.6;
export const ELEMENT_MAX_CONSECUTIVE_SAME = 3;

// ── Fortune Buckets ──
export const FORTUNE_BUCKET_TOP = 25;
export const FORTUNE_BUCKET_HIGH = 20;
export const FORTUNE_BUCKET_GOOD = 15;
export const FORTUNE_BUCKET_WORST = 0;
export const FORTUNE_BUCKET_BAD = 5;
export const FORTUNE_BUCKET_DEFAULT = 10;

// ── Polarity Scoring ──
export const POLARITY_RATIO_BRACKETS: readonly [number, number][] = [
  [0.4, 50],
  [0.3, 35],
  [0.2, 20],
];
export const POLARITY_RATIO_FLOOR = 10;
export const POLARITY_BASE_SCORE = 40;

// ── Node Pass Criteria ──
export const NODE_FORTUNE_BUCKET_PASS = 15;
export const NODE_STROKE_ELEMENT_PASS = 60;
export const NODE_ADJACENCY_THRESHOLD_TWO_CHAR = 65;
export const NODE_ADJACENCY_THRESHOLD_SINGLE_CHAR = 60;
export const NODE_FOUR_FRAME_ELEMENT_PASS = 65;
export const NODE_PRONUNCIATION_ELEMENT_PASS = 70;
export const NODE_ADAPTIVE_MODE_THRESHOLD = 0.55;
export const NODE_ADAPTIVE_TWO_FAILURES_THRESHOLD = 0.78;
export const NODE_STRICT_PASS_THRESHOLD = 60;
export const NODE_ADAPTIVE_THRESHOLD_REDUCTION = 8;
export const NODE_SEVERE_FAILURE_THRESHOLD = 45;
export const NODE_MANDATORY_GATE_SCORE = 35;
export const NODE_SAJU_WEIGHT_BOOST = 0.45;
export const NODE_RELAXABLE_WEIGHT_REDUCTION = 0.3;
export const NODE_PRIORITY_SIGNAL_BASE = 0.55;
export const NODE_PRIORITY_SIGNAL_CONFIDENCE = 0.45;
export const NODE_PRIORITY_PENALTY_DIVISOR = 20;
export const NODE_PRIORITY_PENALTY_WEIGHT = 0.25;
export const NODE_STATS_BASE_SCORE = 60;

// ── Yongshin Type Weights ──
export const YONGSHIN_TYPE_WEIGHT: Record<string, number> = {
  EOKBU: 1,
  JOHU: 0.95,
  TONGGWAN: 0.9,
  GYEOKGUK: 0.85,
  BYEONGYAK: 0.8,
  JEONWANG: 0.75,
  HAPWHA_YONGSHIN: 0.7,
  ILHAENG_YONGSHIN: 0.7,
};
export const YONGSHIN_TYPE_WEIGHT_DEFAULT = 0.75;
export const CONTEXTUAL_YONGSHIN_TYPES = new Set([
  'JOHU',
  'TONGGWAN',
  'BYEONGYAK',
  'GYEOKGUK',
  'HAPWHA_YONGSHIN',
]);

// ── Four Frame ──
export const FOUR_FRAME_MODULO = 81;
export const MAX_STROKE_COUNT_PER_CHAR = 30;
