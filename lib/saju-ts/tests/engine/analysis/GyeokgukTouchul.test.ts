import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import {
  GyeokgukType,
  GyeokgukCategory,
} from '../../../src/domain/Gyeokguk.js';
import { GyeokgukDeterminer } from '../../../src/engine/analysis/GyeokgukDeterminer.js';

/**
 * Ported from GyeokgukTouchulTest.kt (6 tests)
 *
 * Tests for touchul (透出) priority logic in naegyeok determination.
 *
 * Touchul: A hidden stem of the month branch is "revealed" when the same
 * cheongan appears in the year, month, or hour heavenly stems. When revealed,
 * that stem's sipseong determines the gyeokguk (priority: jeonggi -> junggi -> yeogi).
 */

describe('GyeokgukTouchul', () => {

  // ===================================================================
  // jeonggi touchul -- same result as default, highest confidence
  // ===================================================================

  it('jeonggi revealed yields same type as default with touchul reasoning', () => {
    // IN's jeonggi = GAP. Place GAP in year stem -> touchul.
    // GAP day master + IN month + GAP as year stem (= jeonggi revealed)
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.JEONG, Jiji.IN),
      new Pillar(Cheongan.GAP, Jiji.O),
      new Pillar(Cheongan.JEONG, Jiji.SIN),
    );
    const result = GyeokgukDeterminer.determine(pillars);

    // jeonggi GAP revealed -> GAP vs GAP = bigyeon -> geonrok (same as without touchul)
    expect(result.type).toBe(GyeokgukType.GEONROK);
    expect(result.category).toBe(GyeokgukCategory.NAEGYEOK);
    expect(result.confidence).toBe(1.0); // jeonggi touchul = highest confidence
    expect(result.reasoning).toContain('투출');
  });

  // ===================================================================
  // junggi touchul -- different from default jeonggi
  // ===================================================================

  it('junggi revealed overrides jeonggi when jeonggi not revealed', () => {
    // IN's jijanggan: MU(yeogi), BYEONG(junggi), GAP(jeonggi)
    // Day master = GYEONG. Month stem = BYEONG -> junggi touchul
    // Non-day stems: {JEONG, BYEONG, JEONG} -- jeonggi GAP not in set, junggi BYEONG in set
    const pillars = new PillarSet(
      new Pillar(Cheongan.JEONG, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.IN),
      new Pillar(Cheongan.GYEONG, Jiji.O),
      new Pillar(Cheongan.JEONG, Jiji.SIN),
    );
    const result = GyeokgukDeterminer.determine(pillars);

    // jeonggi GAP not in {JEONG, BYEONG, JEONG} -> not revealed
    // junggi BYEONG in {JEONG, BYEONG, JEONG} -> revealed!
    // GYEONG vs BYEONG: metal vs fire(yang) -> pyeongwan
    expect(result.type).toBe(GyeokgukType.PYEONGWAN);
    expect(result.confidence).toBe(0.90); // non-jeonggi touchul = 0.90
    expect(result.reasoning).toContain('중기');
    expect(result.reasoning).toContain('투출');
  });

  // ===================================================================
  // yeogi touchul -- lowest priority but still valid
  // ===================================================================

  it('yeogi revealed overrides jeonggi when neither jeonggi nor junggi revealed', () => {
    // IN's jijanggan: MU(yeogi), BYEONG(junggi), GAP(jeonggi)
    // Day master = GAP. Hour stem = MU -> yeogi touchul
    // Non-day stems: {JEONG, JEONG, MU} -- jeonggi GAP not in set, junggi BYEONG not in set, yeogi MU in set
    const pillars = new PillarSet(
      new Pillar(Cheongan.JEONG, Jiji.JA),
      new Pillar(Cheongan.JEONG, Jiji.IN),
      new Pillar(Cheongan.GAP, Jiji.O),
      new Pillar(Cheongan.MU, Jiji.SIN),
    );
    const result = GyeokgukDeterminer.determine(pillars);

    // jeonggi GAP not revealed, junggi BYEONG not revealed
    // yeogi MU in {JEONG, JEONG, MU} -> revealed!
    // GAP vs MU: wood geuk earth, same yang -> pyeonjae
    expect(result.type).toBe(GyeokgukType.PYEONJAE);
    expect(result.confidence).toBe(0.90);
    expect(result.reasoning).toContain('여기');
    expect(result.reasoning).toContain('투출');
  });

  // ===================================================================
  // touchul priority: jeonggi > junggi > yeogi
  // ===================================================================

  it('jeonggi revealed takes priority over junggi revealed', () => {
    // IN's jijanggan: MU(yeogi), BYEONG(junggi), GAP(jeonggi)
    // year=GAP(jeonggi), month=BYEONG(junggi) -- both touchul
    // Day master = GYEONG
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.BYEONG, Jiji.IN),
      new Pillar(Cheongan.GYEONG, Jiji.O),
      new Pillar(Cheongan.JEONG, Jiji.SIN),
    );
    const result = GyeokgukDeterminer.determine(pillars);

    // jeonggi GAP is in {GAP, BYEONG, JEONG} -> jeonggi revealed first!
    // GYEONG vs GAP: metal geuk wood, same yang -> pyeonjae
    expect(result.type).toBe(GyeokgukType.PYEONJAE);
    expect(result.confidence).toBe(1.0); // jeonggi touchul = 1.0
    expect(result.reasoning).toContain('정기');
  });

  // ===================================================================
  // No touchul -> jeonggi fallback (existing behavior)
  // ===================================================================

  it('no revealed stem falls back to jeonggi', () => {
    // IN's jijanggan: MU(yeogi), BYEONG(junggi), GAP(jeonggi)
    // Non-day stems: {JEONG, JEONG, JEONG} -- none match any hidden stem
    // Day master = GYEONG
    const pillars = new PillarSet(
      new Pillar(Cheongan.JEONG, Jiji.JA),
      new Pillar(Cheongan.JEONG, Jiji.IN),
      new Pillar(Cheongan.GYEONG, Jiji.O),
      new Pillar(Cheongan.JEONG, Jiji.SIN),
    );
    const result = GyeokgukDeterminer.determine(pillars);

    // No hidden stem of IN revealed -> fallback to jeonggi GAP
    // GYEONG vs GAP: metal geuk wood, same yang -> pyeonjae
    expect(result.type).toBe(GyeokgukType.PYEONJAE);
    expect(result.confidence).toBe(1.0);
    // Reasoning should NOT mention touchul
    expect(result.reasoning).not.toContain('투출');
  });

  // ===================================================================
  // wangji (旺支) -- only 2 hidden stems (yeogi + jeonggi, no junggi)
  // ===================================================================

  it('wangji branch with yeogi revealed skips missing junggi', () => {
    // MYO's jijanggan: GAP(yeogi), EUL(jeonggi) -- no junggi
    // year=GAP(yeogi touchul), jeonggi EUL not touchul
    // Day master = EUL
    const pillars = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.JEONG, Jiji.MYO),
      new Pillar(Cheongan.EUL, Jiji.O),
      new Pillar(Cheongan.JEONG, Jiji.SIN),
    );
    const result = GyeokgukDeterminer.determine(pillars);

    // jeonggi EUL not in {GAP, JEONG, JEONG} -> not revealed
    // junggi -> doesn't exist for MYO
    // yeogi GAP in {GAP, JEONG, JEONG} -> revealed!
    // EUL(yin wood) vs GAP(yang wood): same element, different polarity -> GYEOB_JAE -> yangin
    expect(result.type).toBe(GyeokgukType.YANGIN);
    expect(result.confidence).toBe(0.90);
  });
});
