import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReportSurfaceSelectionV1 } from '@spring/report/delivery/types';
import { fetchDelivery } from './client';
import { indexDelivery, type DeliveryIndex } from '../model/facts';
import { loadProfile, type V3Profile } from '../model/profile';

export type DeliveryState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; index: DeliveryIndex; profile: V3Profile }
  | { status: 'error'; message: string };

/**
 * 프로필이 없으면 기본으로는 입력 화면으로 돌려보내고, 있으면 요청한 표면의
 * ReportDeliveryV1을 가져와 인덱싱한다. redirectWhenMissing을 끄면 돌려보내는
 * 대신 'missing' 상태를 돌려줘, 화면이 입력 폼을 직접 품을 수 있다.
 * reloadKey가 바뀌면 프로필을 다시 읽는다 (인라인 폼 저장 직후 갱신용).
 */
export function useDelivery(
  surfaces: ReportSurfaceSelectionV1[],
  options?: { redirectWhenMissing?: boolean; reloadKey?: unknown },
): DeliveryState {
  const navigate = useNavigate();
  const redirectWhenMissing = options?.redirectWhenMissing ?? true;
  const reloadKey = options?.reloadKey;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const profile = useMemo(loadProfile, [reloadKey]);
  const [state, setState] = useState<DeliveryState>({ status: 'loading' });
  const surfacesKey = JSON.stringify(surfaces);

  useEffect(() => {
    if (!profile) {
      if (redirectWhenMissing) {
        navigate('/', { replace: true });
      } else {
        setState({ status: 'missing' });
      }
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
  }, [profile, surfacesKey, navigate, redirectWhenMissing]);

  return state;
}
