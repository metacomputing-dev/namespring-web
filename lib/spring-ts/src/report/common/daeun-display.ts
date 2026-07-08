/**
 * 대운수 이원 표기(감사 B11) — 소비 카드 공용 표기 오프셋.
 *
 * 엔진은 첫 대운에만 표기용 정수(daeunInfo.firstDaeunStartAgeDisplay —
 * 반올림 유파 round1down2up + minStartAge 1)를 주므로,
 * (표기값 - floor(연속값)) ∈ {0, +1} 오프셋을 전 대운 기둥의 floor 나이에 더해
 * '대운수 + 10k' 관행을 재현한다. 시간 로직(구간 매칭·곡선·채점 나이)은
 * 연속값을 유지해야 하며 이 오프셋을 적용하면 안 된다.
 *
 * display 부재(구 payload·stale dist) 시 0 → 종전 floor 표기 유지(안전 폴백).
 * 전제: 대운 주기 10년(decadeLengthYears 기본) — 비-10년 정책 도입 시 재검토.
 */
export function daeunDisplayOffset(daeunInfoRaw: unknown): number {
  if (!daeunInfoRaw || typeof daeunInfoRaw !== 'object') return 0;
  const info = daeunInfoRaw as Record<string, unknown>;
  const first = info['firstDaeunStartAge'];
  const display = info['firstDaeunStartAgeDisplay'];
  if (typeof first !== 'number' || !Number.isFinite(first)) return 0;
  if (typeof display !== 'number' || !Number.isFinite(display)) return 0;
  return Math.max(0, Math.min(1, Math.trunc(display - Math.max(0, Math.floor(first)))));
}
