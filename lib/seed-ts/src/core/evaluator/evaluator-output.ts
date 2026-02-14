import type { SeedResponse } from "../types.js";

export function buildInterpretationText(response: SeedResponse): string {
  const c = response.categoryMap;
  return [
    `SAGYEOK_SURI:${c.SAGYEOK_SURI.score}/${c.SAGYEOK_SURI.isPassed ? "Y" : "N"}`,
    `SAJU_JAWON_BALANCE:${c.SAJU_JAWON_BALANCE.score}/${c.SAJU_JAWON_BALANCE.isPassed ? "Y" : "N"}`,
    `HOEKSU_EUMYANG:${c.HOEKSU_EUMYANG.score}/${c.HOEKSU_EUMYANG.isPassed ? "Y" : "N"}`,
    `BALEUM_OHAENG:${c.BALEUM_OHAENG.score}/${c.BALEUM_OHAENG.isPassed ? "Y" : "N"}`,
    `BALEUM_EUMYANG:${c.BALEUM_EUMYANG.score}/${c.BALEUM_EUMYANG.isPassed ? "Y" : "N"}`,
    `SAGYEOK_OHAENG:${c.SAGYEOK_OHAENG.score}/${c.SAGYEOK_OHAENG.isPassed ? "Y" : "N"}`,
  ].join(" | ");
}

export function sortResponsesByScore(items: SeedResponse[]): SeedResponse[] {
  return items.sort((a, b) => b.interpretation.score - a.interpretation.score);
}
