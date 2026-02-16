import { type DayBranchCompatibility } from '../domain/Compatibility.js';
import { Jiji } from '../domain/Jiji.js';
import { type SajuAnalysis } from '../domain/SajuAnalysis.js';
import { branchKr } from './CompatibilityShared.js';

const YUKHAP_PAIRS: ReadonlyMap<Jiji, Jiji> = new Map([
  [Jiji.JA, Jiji.CHUK], [Jiji.CHUK, Jiji.JA],
  [Jiji.IN, Jiji.HAE], [Jiji.HAE, Jiji.IN],
  [Jiji.MYO, Jiji.SUL], [Jiji.SUL, Jiji.MYO],
  [Jiji.JIN, Jiji.YU], [Jiji.YU, Jiji.JIN],
  [Jiji.SA, Jiji.SIN], [Jiji.SIN, Jiji.SA],
  [Jiji.O, Jiji.MI], [Jiji.MI, Jiji.O],
]);

const SAMHAP_TRIANGLES: ReadonlyArray<ReadonlySet<Jiji>> = [
  new Set([Jiji.SIN, Jiji.JA, Jiji.JIN]),   // 수(水) 삼합
  new Set([Jiji.HAE, Jiji.MYO, Jiji.MI]),   // 목(木) 삼합
  new Set([Jiji.IN, Jiji.O, Jiji.SUL]),     // 화(火) 삼합
  new Set([Jiji.SA, Jiji.YU, Jiji.CHUK]),   // 금(金) 삼합
];

const JIJI_CHUNG_MAP: ReadonlyMap<Jiji, Jiji> = new Map([
  [Jiji.JA, Jiji.O], [Jiji.O, Jiji.JA],
  [Jiji.CHUK, Jiji.MI], [Jiji.MI, Jiji.CHUK],
  [Jiji.IN, Jiji.SIN], [Jiji.SIN, Jiji.IN],
  [Jiji.MYO, Jiji.YU], [Jiji.YU, Jiji.MYO],
  [Jiji.JIN, Jiji.SUL], [Jiji.SUL, Jiji.JIN],
  [Jiji.SA, Jiji.HAE], [Jiji.HAE, Jiji.SA],
]);

const JIJI_HYEONG_PAIRS: ReadonlyArray<[Jiji, Jiji]> = [
  [Jiji.IN, Jiji.SA], [Jiji.SA, Jiji.SIN], [Jiji.SIN, Jiji.IN],     // 무은지형
  [Jiji.CHUK, Jiji.SUL], [Jiji.SUL, Jiji.MI], [Jiji.MI, Jiji.CHUK], // 지세지형
  [Jiji.JA, Jiji.MYO], [Jiji.MYO, Jiji.JA],                         // 무례지형
];

export function analyzeDayBranchRelation(p1: SajuAnalysis, p2: SajuAnalysis): DayBranchCompatibility {
  const db1 = p1.pillars.day.jiji;
  const db2 = p2.pillars.day.jiji;

  const yukHapPartner = YUKHAP_PAIRS.get(db1);
  const isYukHap = yukHapPartner === db2;

  const isSamhap = SAMHAP_TRIANGLES.some(t => t.has(db1) && t.has(db2));

  const chungPartner = JIJI_CHUNG_MAP.get(db1);
  const isChung = chungPartner === db2;

  const isHyeong = JIJI_HYEONG_PAIRS.some(
    ([a, b]) => (a === db1 && b === db2) || (a === db2 && b === db1),
  );

  const isSame = db1 === db2;

  let score: number;
  let interpretation: string;

  if (isYukHap) {
    score = 90;
    interpretation = `${branchKr(db1)}과 ${branchKr(db2)}는 육합(六合) — 배우자궁끼리 합하여 깊은 친밀감과 자연스러운 결합이 있습니다. 가장 좋은 배우자 궁합입니다.`;
  } else if (isSamhap) {
    score = 80;
    interpretation = `${branchKr(db1)}과 ${branchKr(db2)}는 삼합(三合) 관계로, 함께 큰 힘을 만들어낼 수 있는 동반자 관계입니다.`;
  } else if (isSame) {
    score = 55;
    interpretation = `같은 ${branchKr(db1)}끼리로, 자형(自刑) 가능성이 있습니다. 동질감은 높으나 서로의 단점이 증폭될 수 있어 주의가 필요합니다.`;
  } else if (isChung) {
    score = 25;
    interpretation = `${branchKr(db1)}과 ${branchKr(db2)}는 충(沖) — 배우자궁끼리 부딪쳐 갈등이 잦을 수 있습니다. 상호 존중과 양보가 매우 중요합니다.`;
  } else if (isHyeong) {
    score = 35;
    interpretation = `${branchKr(db1)}과 ${branchKr(db2)}는 형(刑) 관계로, 서로에게 상처를 줄 수 있으나 성숙하면 성장의 계기가 됩니다.`;
  } else {
    score = 60;
    interpretation = `${branchKr(db1)}과 ${branchKr(db2)}는 직접적 합충 관계가 없어 무난한 배우자궁 궁합입니다.`;
  }

  let relationType: string;
  if (isYukHap) relationType = '육합(六合)';
  else if (isSamhap) relationType = '삼합(三合)';
  else if (isSame) relationType = '자형(自刑)';
  else if (isChung) relationType = '충(沖)';
  else if (isHyeong) relationType = '형(刑)';
  else relationType = '중립(中立)';

  return { branch1: db1, branch2: db2, relationType, score, interpretation };
}

