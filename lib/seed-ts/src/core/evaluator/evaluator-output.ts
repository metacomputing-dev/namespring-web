import type { Frame, SeedResponse } from "../types.js";

const INTERPRETATION_FRAMES: Frame[] = [
  "SAGYEOK_SURI", "SAJU_JAWON_BALANCE", "HOEKSU_EUMYANG",
  "BALEUM_OHAENG", "BALEUM_EUMYANG", "SAGYEOK_OHAENG",
];

export function buildInterpretationText(response: SeedResponse): string {
  const c = response.categoryMap;
  return INTERPRETATION_FRAMES
    .map((frame) => `${frame}:${c[frame].score}/${c[frame].isPassed ? "Y" : "N"}`)
    .join(" | ");
}

export function sortResponsesByScore(items: SeedResponse[]): SeedResponse[] {
  return items.sort((a, b) => b.interpretation.score - a.interpretation.score);
}
