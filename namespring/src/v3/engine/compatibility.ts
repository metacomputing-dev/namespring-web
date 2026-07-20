/**
 * 궁합 계산 글루: 사람별 delivery(이미 캐시되어 있으면 재사용)를 받아
 * 순수 빌더 buildCoupleCompatibilityV1로 궁합을 만든다.
 * 사람마다 통합 계산을 한 번씩 돌리는 구조라, 같은 사람을 다시 쓰면
 * fetchDelivery의 캐시가 그대로 재사용된다.
 */
import type { ReportSurfaceSelectionV1 } from '@spring/report/delivery/types';
import { buildCoupleCompatibilityV1 } from '@spring/report/compatibility/index';
import type { CoupleCompatibilityV1 } from '@spring/report/compatibility/index';
import { fetchDelivery } from './client';
import { fullHangulName, type V3Profile } from '../model/profile';
import type { CompatRelationshipSelection, CompatSlot } from '../model/compat';

/**
 * 궁합에 필요한 fact를 전부 받도록 세 표면을 함께 요청한다.
 * saju 표면은 life: 'summary'를 함께 요청해 사람별 life_flow 블록
 * (대운 별점 daeunRatings)까지 delivery에 실리게 한다 — 대운 겹쳐 보기가 쓴다.
 */
export const COMPAT_SURFACES: ReportSurfaceSelectionV1[] = [
  { id: 'integrated', depth: 'standard' },
  { id: 'saju', depth: 'standard', life: 'summary' },
  { id: 'naming', depth: 'standard' },
];

function personInput(slot: CompatSlot) {
  const name = fullHangulName(slot.profile);
  const { year, month, day } = slot.profile.birth;
  return {
    // 표시 이름은 항상 본명이다. 호칭(label)은 화면에서 보조 표기로만 쓰고,
    // "손녀님의 일간이…"처럼 호칭이 이름 행세를 하지 않게 한다.
    displayName: name,
    fullHangulName: name,
    gender: slot.profile.birth.gender,
    birth: { year, month, day },
  };
}

const compatCache = new Map<string, Promise<CoupleCompatibilityV1>>();

function slotKeyOf(slot: CompatSlot): string {
  return JSON.stringify([slot.profile, slot.label ?? '']);
}

export function computeCompatibility(
  a: CompatSlot,
  b: CompatSlot,
  selection: CompatRelationshipSelection = { category: 'unspecified' },
): Promise<CoupleCompatibilityV1> {
  const key = JSON.stringify([
    slotKeyOf(a),
    slotKeyOf(b),
    selection.category,
    selection.label ?? '',
    selection.tone ?? '',
  ]);
  const cached = compatCache.get(key);
  if (cached) return cached;
  const promise = Promise.all([
    fetchDelivery(a.profile, COMPAT_SURFACES),
    fetchDelivery(b.profile, COMPAT_SURFACES),
  ]).then(([deliveryA, deliveryB]) =>
    buildCoupleCompatibilityV1({
      a: { delivery: deliveryA, ...personInput(a) },
      b: { delivery: deliveryB, ...personInput(b) },
      relationship: selection.category,
      relationshipLabel: selection.label,
      relationshipTone: selection.tone,
    }),
  ).catch(error => {
    compatCache.delete(key);
    throw error;
  });
  compatCache.set(key, promise);
  return promise;
}

export function isSamePerson(a: V3Profile, b: V3Profile): boolean {
  const key = (profile: V3Profile) =>
    JSON.stringify([
      [...profile.surname, ...profile.givenName].map(c => [c.hangul, c.hanja ?? '']),
      profile.birth.year,
      profile.birth.month,
      profile.birth.day,
      profile.birth.hour,
      profile.birth.minute,
      profile.birth.calendarType,
      profile.birth.isLeapMonth,
      profile.birth.gender,
    ]);
  return key(a) === key(b);
}
