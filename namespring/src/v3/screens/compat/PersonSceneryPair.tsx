/**
 * 궁합 화면의 사람별 풍경 그림 — 통합 보고서의 SceneryCard와 같은 재료
 * (pillars fact → 렌더 메트릭 → NamingResultRenderer)를 사람별로 재현한다.
 * 궁합 계산이 이미 사람별 delivery를 캐시해 두므로 추가 계산 비용은 없다.
 * 각 사람 카드(PersonEchoCard) '안'에 들어가는 컴팩트 아트라서,
 * 아직 계산 중이거나 실패하면 조용히 아무것도 그리지 않는다 —
 * 카드의 나머지(이름·기운 목록)는 즉시 렌더되고 그림만 나중에 채워진다.
 */
import { useEffect, useMemo, useState } from 'react';
import NamingResultRenderer from '../../../NamingResultRenderer';
import { buildRenderMetricsFromSajuReport } from '../../../naming-result-render-metrics';
import { fetchDelivery } from '../../engine/client';
import { COMPAT_SURFACES } from '../../engine/compatibility';
import type { CompatSlot } from '../../model/compat';
import { factOfKind, indexDelivery, type DeliveryIndex } from '../../model/facts';
import { fullHangulName, fullHanjaName } from '../../model/profile';

/** 반 폭 카드 안에서도 그림이 읽히도록 4/3 비율의 미니 프레임으로 그린다. */
export function PersonSceneryArt({ slot }: { slot: CompatSlot }) {
  const { profile } = slot;
  const [index, setIndex] = useState<DeliveryIndex | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIndex(null);
    fetchDelivery(profile, COMPAT_SURFACES)
      .then(delivery => {
        if (!cancelled) setIndex(indexDelivery(delivery));
      })
      .catch(() => {
        /* 풍경은 곁들임이라, 실패하면 조용히 비워 둔다. */
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const pillars = index ? factOfKind(index, 'pillars') : null;
  const metrics = useMemo(() => {
    if (!pillars) return null;
    const byPosition: Record<string, { stem: { code: string }; branch: { code: string } }> = {};
    for (const value of pillars.values) {
      byPosition[value.position] = {
        stem: { code: value.stem.code },
        branch: { code: value.branch.code },
      };
    }
    return buildRenderMetricsFromSajuReport(
      { pillars: byPosition },
      {
        displayHangul: fullHangulName(profile),
        displayHanja: fullHanjaName(profile) ?? '',
      },
    );
  }, [pillars, profile]);

  if (!metrics) return null;
  return (
    <div className="v3-scenery-mini">
      <NamingResultRenderer
        renderMetrics={metrics}
        birthDateTime={{
          year: profile.birth.year,
          month: profile.birth.month,
          day: profile.birth.day,
          hour: profile.birth.hour ?? undefined,
          minute: profile.birth.minute ?? undefined,
        }}
        gender={profile.birth.gender}
        isSolarCalendar={profile.birth.calendarType === 'solar'}
        isBirthTimeUnknown={profile.birth.hour === null}
      />
    </div>
  );
}
