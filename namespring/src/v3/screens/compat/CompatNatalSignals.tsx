/**
 * 궁합 사주 상세의 '각자의 원국에서 눈에 띄는 신호' — 사람마다 delivery를 받아
 * 사주 보고서와 같은 NatalSignals를 접힌 모드로 렌더한다. 궁합 점수에는 넣지 않고,
 * 각 사람을 이해하는 참고로만 둔다(펼치면 신호별 개별 풀이가 열림).
 * 궁합 계산이 이미 사람별 delivery를 캐시해 두므로 추가 계산 비용은 없다.
 */
import { useEffect, useState } from 'react';
import { fetchDelivery } from '../../engine/client';
import { COMPAT_SURFACES } from '../../engine/compatibility';
import type { CompatSlot } from '../../model/compat';
import { indexDelivery, type DeliveryIndex } from '../../model/facts';
import { fullHangulName } from '../../model/profile';
import { Section } from '../../ui/primitives';
import { NatalSignals, hasNatalSignals } from '../natal-signals';

function PersonNatalSignals({ slot, title }: { slot: CompatSlot; title: string }) {
  const [index, setIndex] = useState<DeliveryIndex | null>(null);
  useEffect(() => {
    let cancelled = false;
    setIndex(null);
    fetchDelivery(slot.profile, COMPAT_SURFACES)
      .then(delivery => {
        if (!cancelled) setIndex(indexDelivery(delivery));
      })
      .catch(() => {
        /* 참고 섹션이라 실패하면 조용히 비워 둔다. */
      });
    return () => {
      cancelled = true;
    };
  }, [slot.profile]);

  if (!index || !hasNatalSignals(index)) return null;
  return <NatalSignals index={index} collapsed title={title} />;
}

export function CompatNatalSignalsSection({
  slotA,
  slotB,
}: {
  slotA: CompatSlot;
  slotB: CompatSlot;
}) {
  return (
    <Section
      title="각자의 원국에서 눈에 띄는 신호"
      lede="두 분 각자의 사주에서 계산으로 잡힌 신호예요. 궁합 점수에는 넣지 않고, 각자를 이해하는 참고로 접어 두었어요 — 펼치면 신호별 풀이를 볼 수 있어요."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        <PersonNatalSignals slot={slotA} title={`${fullHangulName(slotA.profile)}님의 원국 신호`} />
        <PersonNatalSignals slot={slotB} title={`${fullHangulName(slotB.profile)}님의 원국 신호`} />
      </div>
    </Section>
  );
}
