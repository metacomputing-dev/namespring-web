import { describe, it, expect } from 'vitest';
import { Eumyang, EUMYANG_INFO, EUMYANG_VALUES } from '../../src/domain/Eumyang.js';
import { Ohaeng, OhaengRelations, OHAENG_VALUES } from '../../src/domain/Ohaeng.js';
import { Cheongan, CHEONGAN_INFO, CHEONGAN_VALUES } from '../../src/domain/Cheongan.js';
import { Jiji, JIJI_INFO, JIJI_VALUES } from '../../src/domain/Jiji.js';
import { SibiUnseong, SIBI_UNSEONG_INFO, SIBI_UNSEONG_VALUES } from '../../src/domain/SibiUnseong.js';

/**
 * D-02: Domain enum exhaustive property verification.
 * Ported from DomainEnumPropertiesTest.kt
 */

// =========================================================================
// Cheongan (천간 - 10 Heavenly Stems)
// =========================================================================
describe('Cheongan', () => {
  it('should have exactly 10 entries', () => {
    expect(CHEONGAN_VALUES).toHaveLength(10);
  });

  it('should be in canonical order', () => {
    const expected = ['GAP', 'EUL', 'BYEONG', 'JEONG', 'MU', 'GI', 'GYEONG', 'SIN', 'IM', 'GYE'];
    expect(CHEONGAN_VALUES).toEqual(expected);
  });

  it('should alternate YANG and YIN', () => {
    for (let i = 0; i < CHEONGAN_VALUES.length; i++) {
      const stem = CHEONGAN_VALUES[i]!;
      const expected = i % 2 === 0 ? Eumyang.YANG : Eumyang.YIN;
      expect(CHEONGAN_INFO[stem].eumyang).toBe(expected);
    }
  });

  it('should pair consecutive stems with the same ohaeng', () => {
    const expectedOhaeng = [
      Ohaeng.WOOD, Ohaeng.WOOD,
      Ohaeng.FIRE, Ohaeng.FIRE,
      Ohaeng.EARTH, Ohaeng.EARTH,
      Ohaeng.METAL, Ohaeng.METAL,
      Ohaeng.WATER, Ohaeng.WATER,
    ];
    for (let i = 0; i < CHEONGAN_VALUES.length; i++) {
      const stem = CHEONGAN_VALUES[i]!;
      expect(CHEONGAN_INFO[stem].ohaeng).toBe(expectedOhaeng[i]);
    }
  });

  it('should have correct hangul values', () => {
    const expected = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
    const actual = CHEONGAN_VALUES.map(s => CHEONGAN_INFO[s].hangul);
    expect(actual).toEqual(expected);
  });

  it('should have correct hanja values', () => {
    const expected = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    const actual = CHEONGAN_VALUES.map(s => CHEONGAN_INFO[s].hanja);
    expect(actual).toEqual(expected);
  });

  it('should have unique hangul and hanja values', () => {
    const hanguls = new Set(CHEONGAN_VALUES.map(s => CHEONGAN_INFO[s].hangul));
    const hanjas = new Set(CHEONGAN_VALUES.map(s => CHEONGAN_INFO[s].hanja));
    expect(hanguls.size).toBe(10);
    expect(hanjas.size).toBe(10);
  });
});

// =========================================================================
// Jiji (지지 - 12 Earthly Branches)
// =========================================================================
describe('Jiji', () => {
  it('should have exactly 12 entries', () => {
    expect(JIJI_VALUES).toHaveLength(12);
  });

  it('should be in canonical order', () => {
    const expected = ['JA', 'CHUK', 'IN', 'MYO', 'JIN', 'SA', 'O', 'MI', 'SIN', 'YU', 'SUL', 'HAE'];
    expect(JIJI_VALUES).toEqual(expected);
  });

  it('should alternate YANG and YIN', () => {
    for (let i = 0; i < JIJI_VALUES.length; i++) {
      const branch = JIJI_VALUES[i]!;
      const expected = i % 2 === 0 ? Eumyang.YANG : Eumyang.YIN;
      expect(JIJI_INFO[branch].eumyang).toBe(expected);
    }
  });

  it('should have correct ohaeng assignment', () => {
    const expectedOhaeng = [
      Ohaeng.WATER, Ohaeng.EARTH, Ohaeng.WOOD, Ohaeng.WOOD,
      Ohaeng.EARTH, Ohaeng.FIRE, Ohaeng.FIRE, Ohaeng.EARTH,
      Ohaeng.METAL, Ohaeng.METAL, Ohaeng.EARTH, Ohaeng.WATER,
    ];
    for (let i = 0; i < JIJI_VALUES.length; i++) {
      const branch = JIJI_VALUES[i]!;
      expect(JIJI_INFO[branch].ohaeng).toBe(expectedOhaeng[i]);
    }
  });

  it('should have correct hangul values', () => {
    const expected = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
    const actual = JIJI_VALUES.map(b => JIJI_INFO[b].hangul);
    expect(actual).toEqual(expected);
  });

  it('should have correct hanja values', () => {
    const expected = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const actual = JIJI_VALUES.map(b => JIJI_INFO[b].hanja);
    expect(actual).toEqual(expected);
  });

  it('should have unique hangul and hanja values', () => {
    const hanguls = new Set(JIJI_VALUES.map(b => JIJI_INFO[b].hangul));
    const hanjas = new Set(JIJI_VALUES.map(b => JIJI_INFO[b].hanja));
    expect(hanguls.size).toBe(12);
    expect(hanjas.size).toBe(12);
  });

  it('should have correct ohaeng distribution', () => {
    const dist = new Map<Ohaeng, number>();
    for (const branch of JIJI_VALUES) {
      const oh = JIJI_INFO[branch].ohaeng;
      dist.set(oh, (dist.get(oh) ?? 0) + 1);
    }
    expect(dist.get(Ohaeng.WATER)).toBe(2);
    expect(dist.get(Ohaeng.WOOD)).toBe(2);
    expect(dist.get(Ohaeng.FIRE)).toBe(2);
    expect(dist.get(Ohaeng.METAL)).toBe(2);
    expect(dist.get(Ohaeng.EARTH)).toBe(4);
  });

  it('should have CHUK, JIN, MI, SUL as the four EARTH branches', () => {
    const earthBranches = JIJI_VALUES.filter(b => JIJI_INFO[b].ohaeng === Ohaeng.EARTH);
    expect(new Set(earthBranches)).toEqual(new Set([Jiji.CHUK, Jiji.JIN, Jiji.MI, Jiji.SUL]));
  });

  it('should have JA and HAE as the two WATER branches', () => {
    const waterBranches = JIJI_VALUES.filter(b => JIJI_INFO[b].ohaeng === Ohaeng.WATER);
    expect(new Set(waterBranches)).toEqual(new Set([Jiji.JA, Jiji.HAE]));
  });
});

// =========================================================================
// Ohaeng (오행 - Five Elements)
// =========================================================================
describe('Ohaeng', () => {
  it('should have exactly 5 entries', () => {
    expect(OHAENG_VALUES).toHaveLength(5);
  });

  it('should be in canonical order', () => {
    const expected = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];
    expect(OHAENG_VALUES).toEqual(expected);
  });

  it('should follow sangsaeng cycle via OhaengRelations', () => {
    for (let i = 0; i < OHAENG_VALUES.length; i++) {
      const element = OHAENG_VALUES[i]!;
      const generated = OhaengRelations.generates(element);
      const expectedIdx = (i + 1) % 5;
      expect(generated).toBe(OHAENG_VALUES[expectedIdx]);
    }
  });

  it('should follow sanggeuk cycle via OhaengRelations', () => {
    for (let i = 0; i < OHAENG_VALUES.length; i++) {
      const element = OHAENG_VALUES[i]!;
      const controlled = OhaengRelations.controls(element);
      const expectedIdx = (i + 2) % 5;
      expect(controlled).toBe(OHAENG_VALUES[expectedIdx]);
    }
  });

  it('should have sangsaeng cycle with period 5', () => {
    let current: Ohaeng = Ohaeng.WOOD;
    const visited = new Set<Ohaeng>();
    for (let i = 0; i < 5; i++) {
      visited.add(current);
      current = OhaengRelations.generates(current);
    }
    expect(visited.size).toBe(5);
    expect(current).toBe(Ohaeng.WOOD);
  });

  it('should have sanggeuk cycle with period 5', () => {
    let current: Ohaeng = Ohaeng.WOOD;
    const visited = new Set<Ohaeng>();
    for (let i = 0; i < 5; i++) {
      visited.add(current);
      current = OhaengRelations.controls(current);
    }
    expect(visited.size).toBe(5);
    expect(current).toBe(Ohaeng.WOOD);
  });

  it('should have consistent inverse relations', () => {
    for (const element of OHAENG_VALUES) {
      expect(OhaengRelations.generatedBy(OhaengRelations.generates(element))).toBe(element);
      expect(OhaengRelations.controlledBy(OhaengRelations.controls(element))).toBe(element);
    }
  });

  it('should have boolean predicates matching cycle helpers', () => {
    for (const a of OHAENG_VALUES) {
      for (const b of OHAENG_VALUES) {
        expect(OhaengRelations.isSangsaeng(a, b)).toBe(OhaengRelations.generates(a) === b);
        expect(OhaengRelations.isSanggeuk(a, b)).toBe(OhaengRelations.controls(a) === b);
      }
    }
  });
});

// =========================================================================
// SibiUnseong (십이운성 - Twelve Life Stages)
// =========================================================================
describe('SibiUnseong', () => {
  it('should have exactly 12 entries', () => {
    expect(SIBI_UNSEONG_VALUES).toHaveLength(12);
  });

  it('should have stage equal to index + 1 (1-based)', () => {
    for (let i = 0; i < SIBI_UNSEONG_VALUES.length; i++) {
      const stage = SIBI_UNSEONG_VALUES[i]!;
      expect(SIBI_UNSEONG_INFO[stage].stage).toBe(i + 1);
    }
  });

  it('should have correct Korean names', () => {
    const expected = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'];
    const actual = SIBI_UNSEONG_VALUES.map(s => SIBI_UNSEONG_INFO[s].koreanName);
    expect(actual).toEqual(expected);
  });

  it('should have correct hanja', () => {
    const expected = ['長生', '沐浴', '冠帶', '建祿', '帝旺', '衰', '病', '死', '墓', '絕', '胎', '養'];
    const actual = SIBI_UNSEONG_VALUES.map(s => SIBI_UNSEONG_INFO[s].hanja);
    expect(actual).toEqual(expected);
  });

  it('should be in canonical order', () => {
    const expected = [
      'JANG_SAENG', 'MOK_YOK', 'GWAN_DAE', 'GEON_ROK', 'JE_WANG', 'SWOE',
      'BYEONG', 'SA', 'MYO', 'JEOL', 'TAE', 'YANG',
    ];
    expect(SIBI_UNSEONG_VALUES).toEqual(expected);
  });

  it('should have stages 1-12 with no gaps or duplicates', () => {
    const stages = new Set(SIBI_UNSEONG_VALUES.map(s => SIBI_UNSEONG_INFO[s].stage));
    const expectedSet = new Set(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(stages).toEqual(expectedSet);
  });

  it('should have unique Korean names and hanja', () => {
    const names = new Set(SIBI_UNSEONG_VALUES.map(s => SIBI_UNSEONG_INFO[s].koreanName));
    const hanjas = new Set(SIBI_UNSEONG_VALUES.map(s => SIBI_UNSEONG_INFO[s].hanja));
    expect(names.size).toBe(12);
    expect(hanjas.size).toBe(12);
  });
});

// =========================================================================
// Eumyang (음양 - Yin-Yang)
// =========================================================================
describe('Eumyang', () => {
  it('should have exactly 2 entries', () => {
    expect(EUMYANG_VALUES).toHaveLength(2);
  });

  it('should have YANG first and YIN second', () => {
    expect(EUMYANG_VALUES[0]).toBe(Eumyang.YANG);
    expect(EUMYANG_VALUES[1]).toBe(Eumyang.YIN);
  });

  it('should have correct hangul values', () => {
    expect(EUMYANG_INFO[Eumyang.YANG].hangul).toBe('양');
    expect(EUMYANG_INFO[Eumyang.YIN].hangul).toBe('음');
  });

  it('should have correct hanja values', () => {
    expect(EUMYANG_INFO[Eumyang.YANG].hanja).toBe('陽');
    expect(EUMYANG_INFO[Eumyang.YIN].hanja).toBe('陰');
  });

  it('should be in canonical order', () => {
    expect(EUMYANG_VALUES).toEqual(['YANG', 'YIN']);
  });
});

// =========================================================================
// Cross-consistency: Cheongan <-> Eumyang, Ohaeng
// =========================================================================
describe('Cheongan cross-consistency', () => {
  it('should have all eumyang values be valid Eumyang members', () => {
    const validEumyang = new Set(EUMYANG_VALUES);
    for (const stem of CHEONGAN_VALUES) {
      expect(validEumyang.has(CHEONGAN_INFO[stem].eumyang)).toBe(true);
    }
  });

  it('should have all ohaeng values be valid Ohaeng members', () => {
    const validOhaeng = new Set(OHAENG_VALUES);
    for (const stem of CHEONGAN_VALUES) {
      expect(validOhaeng.has(CHEONGAN_INFO[stem].ohaeng)).toBe(true);
    }
  });

  it('should have exactly 2 stems per ohaeng', () => {
    const groups = new Map<Ohaeng, Cheongan[]>();
    for (const stem of CHEONGAN_VALUES) {
      const oh = CHEONGAN_INFO[stem].ohaeng;
      if (!groups.has(oh)) groups.set(oh, []);
      groups.get(oh)!.push(stem);
    }
    expect(groups.size).toBe(5);
    for (const [, stems] of groups) {
      expect(stems).toHaveLength(2);
    }
  });

  it('should have one YANG and one YIN per ohaeng pair', () => {
    const groups = new Map<Ohaeng, Set<Eumyang>>();
    for (const stem of CHEONGAN_VALUES) {
      const oh = CHEONGAN_INFO[stem].ohaeng;
      if (!groups.has(oh)) groups.set(oh, new Set());
      groups.get(oh)!.add(CHEONGAN_INFO[stem].eumyang);
    }
    for (const [, eumyangs] of groups) {
      expect(eumyangs).toEqual(new Set([Eumyang.YANG, Eumyang.YIN]));
    }
  });
});

// =========================================================================
// Cross-consistency: Jiji <-> Eumyang, Ohaeng
// =========================================================================
describe('Jiji cross-consistency', () => {
  it('should have all eumyang values be valid Eumyang members', () => {
    const validEumyang = new Set(EUMYANG_VALUES);
    for (const branch of JIJI_VALUES) {
      expect(validEumyang.has(JIJI_INFO[branch].eumyang)).toBe(true);
    }
  });

  it('should have all ohaeng values be valid Ohaeng members', () => {
    const validOhaeng = new Set(OHAENG_VALUES);
    for (const branch of JIJI_VALUES) {
      expect(validOhaeng.has(JIJI_INFO[branch].ohaeng)).toBe(true);
    }
  });

  it('should have all 12 branches assigned an ohaeng', () => {
    let total = 0;
    const groups = new Map<Ohaeng, number>();
    for (const branch of JIJI_VALUES) {
      const oh = JIJI_INFO[branch].ohaeng;
      groups.set(oh, (groups.get(oh) ?? 0) + 1);
      total++;
    }
    expect(total).toBe(12);
  });
});

// =========================================================================
// Cross-consistency: Cheongan-Jiji parity rule
// =========================================================================
describe('Parity rule', () => {
  it('should have 5 YANG stems and 6 YANG branches', () => {
    const yangStems = CHEONGAN_VALUES.filter(s => CHEONGAN_INFO[s].eumyang === Eumyang.YANG);
    const yangBranches = JIJI_VALUES.filter(b => JIJI_INFO[b].eumyang === Eumyang.YANG);
    expect(yangStems).toHaveLength(5);
    expect(yangBranches).toHaveLength(6);
    expect(yangStems.length * yangBranches.length).toBe(30);
  });

  it('should have 5 YIN stems and 6 YIN branches', () => {
    const yinStems = CHEONGAN_VALUES.filter(s => CHEONGAN_INFO[s].eumyang === Eumyang.YIN);
    const yinBranches = JIJI_VALUES.filter(b => JIJI_INFO[b].eumyang === Eumyang.YIN);
    expect(yinStems).toHaveLength(5);
    expect(yinBranches).toHaveLength(6);
    expect(yinStems.length * yinBranches.length).toBe(30);
  });

  it('should have total valid pairs equal to 60', () => {
    const yangPairs = CHEONGAN_VALUES.filter(s => CHEONGAN_INFO[s].eumyang === Eumyang.YANG).length *
      JIJI_VALUES.filter(b => JIJI_INFO[b].eumyang === Eumyang.YANG).length;
    const yinPairs = CHEONGAN_VALUES.filter(s => CHEONGAN_INFO[s].eumyang === Eumyang.YIN).length *
      JIJI_VALUES.filter(b => JIJI_INFO[b].eumyang === Eumyang.YIN).length;
    expect(yangPairs + yinPairs).toBe(60);
  });
});
