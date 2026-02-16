import type { PillarSet } from '../domain/PillarSet.js';
import type { ShinsalHit } from '../domain/Shinsal.js';
import { ShinsalType } from '../domain/Shinsal.js';
import { branchKorean, positionKorean, stemKorean } from './NarrativeFormatting.js';

export function shinsalDetectionPrinciple(hit: ShinsalHit, pillars: PillarSet): string {
  const dm = pillars.day.cheongan;
  const dayBranch = pillars.day.jiji;
  const yearBranch = pillars.year.jiji;
  const matchBranch = hit.referenceBranch;

  const PRINCIPLES: Partial<Record<ShinsalType, () => string>> = {
    [ShinsalType.CHEONUL_GWIIN]: () => `일간 ${stemKorean(dm)} → 귀인 테이블 → ${branchKorean(matchBranch)}이 ${positionKorean(hit.position)}에 위치`,
    [ShinsalType.MUNCHANG]: () => `일간 ${stemKorean(dm)} → 문창 테이블 → ${branchKorean(matchBranch)}이 ${positionKorean(hit.position)}에 위치`,
    [ShinsalType.YANGIN]: () => `일간 ${stemKorean(dm)} → 건록(建祿)의 다음 지지가 양인 → ${branchKorean(matchBranch)}이 ${positionKorean(hit.position)}에 위치`,
    [ShinsalType.BAEKHO]: () => `일간 ${stemKorean(dm)} → 백호 테이블 → ${branchKorean(matchBranch)}이 ${positionKorean(hit.position)}에 위치`,
    [ShinsalType.HONGYEOM]: () => `일간 ${stemKorean(dm)} → 홍염 테이블 → ${branchKorean(matchBranch)}이 ${positionKorean(hit.position)}에 위치`,
    [ShinsalType.TAEGUK_GWIIN]: () => `일간 ${stemKorean(dm)} → 태극귀인 테이블 → ${branchKorean(matchBranch)}이 ${positionKorean(hit.position)}에 위치`,
    [ShinsalType.HAKDANG]: () => `일간 ${stemKorean(dm)} → 장생위(長生位) 기준 → ${branchKorean(matchBranch)}이 ${positionKorean(hit.position)}에 위치`,
    [ShinsalType.GEUMYEO]: () => `일간 ${stemKorean(dm)} → 금여 테이블 → ${branchKorean(matchBranch)}이 ${positionKorean(hit.position)}에 위치`,
    [ShinsalType.YEOKMA]: () => `기준지 ${branchKorean(dayBranch)} 삼합 그룹 → 역마 위치 ${branchKorean(matchBranch)}이 ${positionKorean(hit.position)}에 위치`,
    [ShinsalType.DOHWA]: () => `기준지 ${branchKorean(dayBranch)} 삼합 그룹 → 도화 위치 ${branchKorean(matchBranch)}이 ${positionKorean(hit.position)}에 위치`,
    [ShinsalType.HWAGAE]: () => `기준지 ${branchKorean(dayBranch)} 삼합 그룹 → 화개 위치 ${branchKorean(matchBranch)}이 ${positionKorean(hit.position)}에 위치`,
    [ShinsalType.JANGSEONG]: () => `기준지 ${branchKorean(dayBranch)} 삼합 그룹 → 왕지(旺支) ${branchKorean(matchBranch)}이 ${positionKorean(hit.position)}에 위치`,
    [ShinsalType.GEOPSAL]: () => `기준지 ${branchKorean(dayBranch)} 삼합 왕지의 전(前) → ${branchKorean(matchBranch)}이 ${positionKorean(hit.position)}에 위치`,
    [ShinsalType.GOEGANG]: () => `일주 ${stemKorean(dm)}${branchKorean(dayBranch)}가 괴강 조합(庚辰/庚戌/壬辰/壬戌)에 해당`,
    [ShinsalType.CHEONUI]: () => `월지 ${branchKorean(pillars.month.jiji)} → 역행 1칸 → ${branchKorean(matchBranch)}이 ${positionKorean(hit.position)}에 위치`,
    [ShinsalType.WONJIN]: () => `일지 ${branchKorean(dayBranch)}와 ${branchKorean(matchBranch)}이 원진 관계 (서로 미워하는 지지 쌍)`,
    [ShinsalType.GOSIN]: () => `년지 ${branchKorean(yearBranch)} 방합 그룹 기준 → 고신 위치 ${branchKorean(matchBranch)}`,
    [ShinsalType.GWASUK]: () => `년지 ${branchKorean(yearBranch)} 방합 그룹 기준 → 과숙 위치 ${branchKorean(matchBranch)}`,
    [ShinsalType.CHEOLLA_JIMANG]: () => '辰巳/戌亥 조합이 원국에 존재 → 천라지망 성립',
    [ShinsalType.GYEOKGAK]: () => '인접 기둥 지지가 2칸 차이 → 격각 성립',
  };

  const fn = PRINCIPLES[hit.type];
  return fn ? fn() : '';
}

