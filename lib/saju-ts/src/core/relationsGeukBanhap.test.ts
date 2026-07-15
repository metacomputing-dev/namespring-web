import { describe, expect, it } from 'vitest';
import { detectStemRelations, isStemGeuk } from './stemRelations.js';
import {
  detectBranchRelations,
  gwimunPartner,
  isWangji,
  relationMatchesTarget,
  relationResolutionUnits,
} from './branchRelations.js';

// 천간 인덱스: 0갑 1을 2병 3정 4무 5기 6경 7신 8임 9계
// 지지 인덱스: 0子 1丑 2寅 3卯 4辰 5巳 6午 7未 8申 9酉 10戌 11亥

describe('천간 극(GEUK) 탐지 (감사 B2)', () => {
  it('극 6쌍 전부: 갑무·을기·병경·정신·무임·기계', () => {
    const pairs: Array<[number, number]> = [[0, 4], [1, 5], [2, 6], [3, 7], [4, 8], [5, 9]];
    for (const [a, b] of pairs) {
      expect(isStemGeuk(a, b), `${a}-${b}`).toBe(true);
    }
  });

  it('충 4쌍(갑경·을신·병임·정계)과 합 5쌍은 극이 아니다', () => {
    for (const [a, b] of [[0, 6], [1, 7], [2, 8], [3, 9]]) expect(isStemGeuk(a!, b!), `충 ${a}-${b}`).toBe(false);
    for (const [a, b] of [[0, 5], [1, 6], [2, 7], [3, 8], [4, 9]]) expect(isStemGeuk(a!, b!), `합 ${a}-${b}`).toBe(false);
  });

  it('detectStemRelations가 극을 방출한다 (갑·무 → GEUK)', () => {
    const rels = detectStemRelations([0, 4, 3, 7]); // 갑 무 정 신
    const geuk = rels.filter((r) => r.type === 'GEUK').map((r) => r.members.join('-'));
    expect(geuk).toContain('0-4'); // 갑극무
    expect(geuk).toContain('3-7'); // 정극신
  });
});

describe('지지 반합(BANHAP) 탐지 (감사 B3)', () => {
  it('왕지 목록: 子卯午酉', () => {
    expect([0, 3, 6, 9].every((b) => isWangji(b))).toBe(true);
    expect([1, 2, 4, 5, 7, 8, 10, 11].some((b) => isWangji(b))).toBe(false);
  });

  it('생지반합(申子)·묘지반합(子辰)은 성립한다', () => {
    // 신자진 삼합군에서 2자씩 — 왕지 子 포함
    const r1 = detectBranchRelations([8, 0, 2, 5]); // 申子寅巳
    expect(r1.some((r) => r.type === 'BANHAP' && r.members.join('-') === '0-8')).toBe(true);
    const r2 = detectBranchRelations([0, 4, 2, 5]); // 子辰寅巳
    expect(r2.some((r) => r.type === 'BANHAP' && r.members.join('-') === '0-4')).toBe(true);
  });

  it('왕지 없는 생지+고지(가합: 申辰)는 불인정', () => {
    const rels = detectBranchRelations([8, 4, 2, 5]); // 申辰寅巳
    expect(rels.some((r) => r.type === 'BANHAP')).toBe(false);
  });

  it('귀문 6조합 파트너 맵이 대합적이고(子酉·丑午·寅未·卯申·辰亥·巳戌) 탐지된다', () => {
    const pairs: Array<[number, number]> = [[0, 9], [1, 6], [2, 7], [3, 8], [4, 11], [5, 10]];
    for (const [a, b] of pairs) {
      expect(gwimunPartner(a), `${a}→${b}`).toBe(b);
      expect(gwimunPartner(b), `${b}→${a}`).toBe(a);
    }
    // 子酉는 원진이 아닌 귀문 전용 조합 — GWIMUN으로만 잡혀야 한다
    const rels = detectBranchRelations([0, 9, 2, 5]); // 子酉寅巳
    expect(rels.some((r) => r.type === 'GWIMUN' && r.members.join('-') === '0-9')).toBe(true);
    expect(rels.some((r) => r.type === 'WONJIN' && r.members.join('-') === '0-9')).toBe(false);
  });

  it('삼합 3자 완전체가 있으면 SAMHAP만 보고하고 반합은 억제한다', () => {
    const rels = detectBranchRelations([8, 0, 4, 6]); // 申子辰 + 午
    expect(rels.some((r) => r.type === 'SAMHAP' && r.members.join('-') === '0-4-8')).toBe(true);
    // 申子辰 부분집합 반합은 없어야 함 (다른 군의 반합은 무관)
    const banhap = rels.filter((r) => r.type === 'BANHAP');
    for (const b of banhap) {
      expect(['0-4', '0-8', '4-8']).not.toContain(b.members.join('-'));
    }
  });
});

describe('삼형(SAMHYEONG) 중복 억제', () => {
  it('HYEONG 정책은 canonical SAMHYEONG family를 포함하되 역방향은 포함하지 않는다', () => {
    expect(relationMatchesTarget('SAMHYEONG', 'HYEONG')).toBe(true);
    expect(relationMatchesTarget('HYEONG', 'SAMHYEONG')).toBe(false);
    expect(relationMatchesTarget('JA_HYEONG', 'HYEONG')).toBe(false);
  });

  it('canonical SAMHYEONG을 세 구성쌍으로 안정적으로 분해하고 malformed triple은 거부한다', () => {
    expect(relationResolutionUnits({ type: 'SAMHYEONG', members: [10, 1, 7] }))
      .toEqual([[1, 7], [1, 10], [7, 10]]);
    expect(relationResolutionUnits({ type: 'HYEONG', members: [2, 5] }))
      .toEqual([[2, 5]]);
    expect(() => relationResolutionUnits({ type: 'SAMHYEONG', members: [1, 1, 7] }))
      .toThrow(/three unique branches/);
    expect(() => relationResolutionUnits({ type: 'SAMHYEONG', members: [1, 7, 22] as any }))
      .toThrow(/0 through 11/);
    expect(() => relationResolutionUnits({ type: 'SAMHYEONG', members: [0, 1, 2] }))
      .toThrow(/canonical three-punishment set/);
  });

  it.each([
    [[2, 5, 8, 0], '2-5-8'],
    [[1, 7, 10, 0], '1-7-10'],
  ])('완전체 %j는 SAMHYEONG만 방출하고 HYEONG 부분쌍은 억제한다', (branches, key) => {
    const relations = detectBranchRelations(branches);
    expect(
      relations.some(
        (relation) => relation.type === 'SAMHYEONG' && relation.members.join('-') === key,
      ),
    ).toBe(true);
    expect(relations.some((relation) => relation.type === 'HYEONG')).toBe(false);
  });

  it('삼형 2자만 있으면 HYEONG 쌍을 유지한다', () => {
    const relations = detectBranchRelations([2, 5, 0, 4]);
    expect(
      relations.some(
        (relation) => relation.type === 'HYEONG' && relation.members.join('-') === '2-5',
      ),
    ).toBe(true);
    expect(relations.some((relation) => relation.type === 'SAMHYEONG')).toBe(false);
  });
});
