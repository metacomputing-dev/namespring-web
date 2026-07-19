import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReportSurfaceSelectionV1 } from '@spring/report/delivery/types';
import { fetchDelivery } from './client';
import { indexDelivery, type DeliveryIndex } from '../model/facts';
import { loadProfile, type V3Profile } from '../model/profile';

export type DeliveryState =
  | { status: 'loading' }
  | { status: 'ready'; index: DeliveryIndex; profile: V3Profile }
  | { status: 'error'; message: string };

/**
 * 프로필이 없으면 입력 화면으로 돌려보내고, 있으면 요청한 표면의
 * ReportDeliveryV1을 가져와 인덱싱한다.
 */
export function useDelivery(surfaces: ReportSurfaceSelectionV1[]): DeliveryState {
  const navigate = useNavigate();
  const profile = useMemo(loadProfile, []);
  const [state, setState] = useState<DeliveryState>({ status: 'loading' });
  const surfacesKey = JSON.stringify(surfaces);

  useEffect(() => {
    if (!profile) {
      navigate('/', { replace: true });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    fetchDelivery(profile, JSON.parse(surfacesKey))
      .then(delivery => {
        if (!cancelled) {
          setState({ status: 'ready', index: indexDelivery(delivery), profile });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const code = error instanceof Error ? error.message : String(error);
          setState({ status: 'error', message: code });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [profile, surfacesKey, navigate]);

  return state;
}
