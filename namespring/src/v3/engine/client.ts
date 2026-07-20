/**
 * v3 엔진 클라이언트.
 *
 * SpringEngine.getReportDelivery()가 공개 계약(ReportDeliveryV1)의 단일
 * 진입점이다. 여기서는 엔진 싱글턴과 표면(surface)별 캐시만 관리한다.
 * 모든 계산은 이 기기 안에서 끝나며 서버 요청은 없다.
 */
import { SpringEngine } from '@spring/spring-engine';
import type {
  ReportDeliveryRequestV1,
  ReportDeliveryV1,
  ReportSurfaceSelectionV1,
} from '@spring/report/delivery/types';
import type { V3Profile } from '../model/profile';

let engineInstance: SpringEngine | null = null;

export function getEngine(): SpringEngine {
  if (!engineInstance) engineInstance = new SpringEngine();
  return engineInstance;
}

function birthFromProfile(profile: V3Profile) {
  const { birth } = profile;
  return {
    year: birth.year,
    month: birth.month,
    day: birth.day,
    hour: birth.hour,
    minute: birth.minute,
    gender: birth.gender,
    calendarType: birth.calendarType,
    isLeapMonth: birth.calendarType === 'lunar' ? birth.isLeapMonth : undefined,
    region: birth.region ?? undefined,
  };
}

function nameCharsFromProfile(chars: { hangul: string; hanja?: string }[]) {
  return chars.map(c => (c.hanja ? { hangul: c.hangul, hanja: c.hanja } : { hangul: c.hangul }));
}

export function buildDeliveryRequest(
  profile: V3Profile,
  surfaces: ReportSurfaceSelectionV1[],
): ReportDeliveryRequestV1 {
  return {
    birth: birthFromProfile(profile),
    surname: nameCharsFromProfile(profile.surname),
    givenName: nameCharsFromProfile(profile.givenName),
    options: {
      sajuTimePolicy: {
        trueSolarTime: profile.birth.trueSolarTime ? 'on' : 'off',
        longitudeCorrection: profile.birth.region != null ? 'on' : 'off',
        yaza: profile.birth.yaza ? 'on' : 'off',
      },
      precisionConfig: {
        surfaceNameTrend: true,
        surfacePhoneticEvidence: true,
      },
    },
    delivery: {
      schemaVersion: 'spring-ts.report-delivery-request.v1',
      surfaces: surfaces as ReportDeliveryRequestV1['delivery']['surfaces'],
    },
  } as ReportDeliveryRequestV1;
}

const deliveryCache = new Map<string, Promise<ReportDeliveryV1>>();

function cacheKey(profile: V3Profile, surfaces: ReportSurfaceSelectionV1[]): string {
  return JSON.stringify([profile, surfaces]);
}

export function fetchDelivery(
  profile: V3Profile,
  surfaces: ReportSurfaceSelectionV1[],
): Promise<ReportDeliveryV1> {
  const key = cacheKey(profile, surfaces);
  const cached = deliveryCache.get(key);
  if (cached) return cached;
  const request = buildDeliveryRequest(profile, surfaces);
  const promise = getEngine()
    .getReportDelivery(request)
    .catch(error => {
      deliveryCache.delete(key);
      throw error;
    });
  deliveryCache.set(key, promise);
  return promise;
}

export function clearDeliveryCache() {
  deliveryCache.clear();
}
