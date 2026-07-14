import { describe, expect, it } from 'vitest';

import { createEngine } from './engine.js';

/**
 * PR-12-4 (감사 C6) — 음양 균형 additive 표면.
 * 1986-04-19 05:45 KST: 丙寅년 壬辰월 癸巳일 乙卯시.
 * 천간 丙(양)壬(양)癸(음)乙(음) = 2/2, 지지(체 기준) 寅(양)辰(양)巳(음)卯(음) = 2/2 → 4:4 EVEN.
 */
describe('음양 균형 (additive)', () => {
  it('8글자 체 기준 개수와 dominant가 노출된다', () => {
    const bundle = createEngine({}).analyze({ birth: { instant: '1986-04-19T05:45:00+09:00', calendar: 'gregorian' }, sex: 'M' } as any);
    const yy: any = (bundle.summary as any).yinYangBalance;
    expect(yy).toBeTruthy();
    expect(yy.stems).toEqual({ yang: 2, yin: 2 });
    expect(yy.branches).toEqual({ yang: 2, yin: 2 });
    expect(yy.yang).toBe(4);
    expect(yy.yin).toBe(4);
    expect(yy.dominant).toBe('EVEN');
  });

  it('합계는 항상 8', () => {
    for (const instant of ['1992-09-15T10:00:00+09:00', '2005-12-25T06:00:00+09:00']) {
      const bundle = createEngine({}).analyze({ birth: { instant, calendar: 'gregorian' }, sex: 'F' } as any);
      const yy: any = (bundle.summary as any).yinYangBalance;
      expect(yy.yang + yy.yin).toBe(8);
      expect(yy.stems.yang + yy.stems.yin).toBe(4);
      expect(yy.branches.yang + yy.branches.yin).toBe(4);
    }
  });
});
