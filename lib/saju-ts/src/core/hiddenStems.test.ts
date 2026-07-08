import { describe, expect, it } from 'vitest';

import type { BranchIdx } from './cycle.js';
import { hiddenStemsOfBranch, type HiddenStemRole } from './hiddenStems.js';

/**
 * 지장간 12지지 조견표 전수 단정 (감사 PR-4 — 정답표 테스트 공백 해소).
 *
 * 목적은 재정정이 아니라 회귀 핀 — 현 기본 표의 이설 채택을 포함해 그대로 고정한다:
 * - 子/卯/酉: 단일 본기(여기 壬/甲/庚 배제 — 이설 채택)
 * - 午: 丁己 2장간형(丙 여기 배제)
 * - 亥: 壬甲 2장간형(戊 여기 배제 — 감사 부록 B에 명시된 이설 채택)
 * weight는 normalize()의 부동소수점(0.6+0.3+0.1=0.9999…) 때문에 closeTo 단정.
 */
type Expected = ReadonlyArray<readonly [number, HiddenStemRole, number]>;

const EXPECTED_HIDDEN: readonly Expected[] = [
  /* 子 */ [[9, 'MAIN', 1]],
  /* 丑 */ [[5, 'MAIN', 0.6], [9, 'MIDDLE', 0.3], [7, 'RESIDUAL', 0.1]],
  /* 寅 */ [[0, 'MAIN', 0.6], [2, 'MIDDLE', 0.3], [4, 'RESIDUAL', 0.1]],
  /* 卯 */ [[1, 'MAIN', 1]],
  /* 辰 */ [[4, 'MAIN', 0.6], [1, 'MIDDLE', 0.3], [9, 'RESIDUAL', 0.1]],
  /* 巳 */ [[2, 'MAIN', 0.6], [6, 'MIDDLE', 0.3], [4, 'RESIDUAL', 0.1]],
  /* 午 */ [[3, 'MAIN', 0.7], [5, 'RESIDUAL', 0.3]],
  /* 未 */ [[5, 'MAIN', 0.6], [3, 'MIDDLE', 0.3], [1, 'RESIDUAL', 0.1]],
  /* 申 */ [[6, 'MAIN', 0.6], [8, 'MIDDLE', 0.3], [4, 'RESIDUAL', 0.1]],
  /* 酉 */ [[7, 'MAIN', 1]],
  /* 戌 */ [[4, 'MAIN', 0.6], [7, 'MIDDLE', 0.3], [3, 'RESIDUAL', 0.1]],
  /* 亥 */ [[8, 'MAIN', 0.7], [0, 'RESIDUAL', 0.3]],
];

const BRANCH_LABEL = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

describe('지장간 12지지 조견표 (감사 PR-4)', () => {
  it('12지지 전수: stem·role 순서 포함 일치, weight는 closeTo', () => {
    for (let b = 0; b < 12; b++) {
      const got = hiddenStemsOfBranch(b as BranchIdx);
      const exp = EXPECTED_HIDDEN[b]!;
      expect(got.length, `${BRANCH_LABEL[b]} 장간 수`).toBe(exp.length);
      for (let i = 0; i < exp.length; i++) {
        const [stem, role, weight] = exp[i]!;
        expect(got[i]!.stem, `${BRANCH_LABEL[b]}[${i}].stem`).toBe(stem);
        expect(got[i]!.role, `${BRANCH_LABEL[b]}[${i}].role`).toBe(role);
        expect(got[i]!.weight, `${BRANCH_LABEL[b]}[${i}].weight`).toBeCloseTo(weight, 12);
      }
      const sum = got.reduce((s, h) => s + h.weight, 0);
      expect(sum, `${BRANCH_LABEL[b]} weight 합`).toBeCloseTo(1, 12);
    }
  });

  it('MAIN이 항상 첫 요소다 (본기 우선 순서 계약 — palace 본기 선택의 전제)', () => {
    for (let b = 0; b < 12; b++) {
      expect(hiddenStemsOfBranch(b as BranchIdx)[0]!.role, BRANCH_LABEL[b]).toBe('MAIN');
    }
  });

  it("scheme 'equal'은 균등 가중(1/n)이다", () => {
    for (let b = 0; b < 12; b++) {
      const got = hiddenStemsOfBranch(b as BranchIdx, { scheme: 'equal' });
      for (const h of got) {
        expect(h.weight, `${BRANCH_LABEL[b]}`).toBeCloseTo(1 / got.length, 12);
      }
    }
  });
});
