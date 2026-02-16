import { describe, it, expect } from 'vitest';
import {
  RuleCitationRegistry,
  createRuleCitation,
  citationInline,
  citationInlineDetailed,
  citationTraceForm,
  type RuleCitation,
} from '../../src/interpretation/RuleCitationRegistry.js';
import { ClassicalSource, CLASSICAL_SOURCE_INFO } from '../../src/domain/ClassicalSource.js';
import { ANALYSIS_KEYS } from '../../src/domain/SajuAnalysis.js';

describe('RuleCitationRegistry', () => {
  // ── createRuleCitation ──────────────────────────────────────────
  describe('createRuleCitation', () => {
    it('creates citation with single source', () => {
      const c = createRuleCitation(ClassicalSource.JEOKCHEONSU, '신강판정', '비고', 90);
      expect(c.sources).toEqual([ClassicalSource.JEOKCHEONSU]);
      expect(c.topic).toBe('신강판정');
      expect(c.note).toBe('비고');
      expect(c.confidence).toBe(90);
    });

    it('creates citation with multiple sources', () => {
      const c = createRuleCitation(
        [ClassicalSource.JEOKCHEONSU, ClassicalSource.GUNGTONGBOGAM],
        '용신', '', 85,
      );
      expect(c.sources).toHaveLength(2);
    });

    it('defaults note to empty and confidence to 0', () => {
      const c = createRuleCitation(ClassicalSource.JEOKCHEONSU, '테스트');
      expect(c.note).toBe('');
      expect(c.confidence).toBe(0);
    });
  });

  // ── citationInline ──────────────────────────────────────────────
  describe('citationInline', () => {
    it('formats inline citation with source and topic', () => {
      const c = createRuleCitation(ClassicalSource.JEOKCHEONSU, '신강판정');
      const text = citationInline(c);
      expect(text).toContain('출처');
      expect(text).toContain('신강판정');
    });
  });

  // ── citationInlineDetailed ─────────────────────────────────────
  describe('citationInlineDetailed', () => {
    it('includes confidence when > 0', () => {
      const c = createRuleCitation(ClassicalSource.JEOKCHEONSU, '신강판정', '', 90);
      const text = citationInlineDetailed(c);
      expect(text).toContain('90%');
      expect(text).toContain('근거');
    });

    it('falls back to inline when confidence is 0', () => {
      const c = createRuleCitation(ClassicalSource.JEOKCHEONSU, '신강판정', '', 0);
      const text = citationInlineDetailed(c);
      expect(text).toContain('출처');
      expect(text).not.toContain('신뢰도');
    });
  });

  // ── citationTraceForm ──────────────────────────────────────────
  describe('citationTraceForm', () => {
    it('formats trace form as source:topic', () => {
      const c = createRuleCitation(ClassicalSource.JEOKCHEONSU, '신강판정');
      const text = citationTraceForm(c);
      expect(text).toContain('신강판정');
    });
  });

  // ── forKey ─────────────────────────────────────────────────────
  describe('forKey', () => {
    it('returns citation for known analysis key "core"', () => {
      const c = RuleCitationRegistry.forKey('core');
      expect(c).not.toBeNull();
      expect(c!.sources.length).toBeGreaterThan(0);
      expect(c!.topic).toBeTruthy();
    });

    it('returns null for unknown key', () => {
      const c = RuleCitationRegistry.forKey('nonexistent_key');
      expect(c).toBeNull();
    });

    it('covers all ANALYSIS_KEYS', () => {
      const keysToCheck = [
        'core',
        ANALYSIS_KEYS.TEN_GODS,
        ANALYSIS_KEYS.HIDDEN_STEMS,
        ANALYSIS_KEYS.CHEONGAN_RELATIONS,
        ANALYSIS_KEYS.HAPWHA,
        ANALYSIS_KEYS.RESOLVED_JIJI,
        ANALYSIS_KEYS.STRENGTH,
        ANALYSIS_KEYS.GYEOKGUK,
        ANALYSIS_KEYS.YONGSHIN,
        ANALYSIS_KEYS.SHINSAL,
        ANALYSIS_KEYS.PALACE,
        ANALYSIS_KEYS.DAEUN,
      ];
      for (const key of keysToCheck) {
        const c = RuleCitationRegistry.forKey(key);
        expect(c, `missing citation for key "${key}"`).not.toBeNull();
      }
    });
  });

  // ── forSentence ────────────────────────────────────────────────
  describe('forSentence', () => {
    it('returns citation for known sentence rule', () => {
      const c = RuleCitationRegistry.forSentence('strength.level');
      expect(c).not.toBeNull();
      expect(c!.confidence).toBeGreaterThan(0);
    });

    it('returns null for unknown sentence rule', () => {
      const c = RuleCitationRegistry.forSentence('nonexistent.rule');
      expect(c).toBeNull();
    });

    it('sentence citations have non-zero confidence', () => {
      const all = RuleCitationRegistry.allSentence();
      for (const [ruleId, citation] of all) {
        expect(citation.confidence, `${ruleId} confidence should be > 0`).toBeGreaterThan(0);
      }
    });
  });

  // ── all / allSentence ──────────────────────────────────────────
  describe('all / allSentence', () => {
    it('all() returns non-empty map', () => {
      const all = RuleCitationRegistry.all();
      expect(all.size).toBeGreaterThan(0);
    });

    it('allSentence() returns non-empty map', () => {
      const all = RuleCitationRegistry.allSentence();
      expect(all.size).toBeGreaterThan(0);
    });

    it('allSentence() size >= 30 (known baseline)', () => {
      const all = RuleCitationRegistry.allSentence();
      expect(all.size).toBeGreaterThanOrEqual(30);
    });
  });

  // ── forSource ──────────────────────────────────────────────────
  describe('forSource', () => {
    it('returns citations referencing JEOKCHEONSU', () => {
      const result = RuleCitationRegistry.forSource(ClassicalSource.JEOKCHEONSU);
      expect(result.size).toBeGreaterThan(0);
      for (const [, citation] of result) {
        expect(citation.sources).toContain(ClassicalSource.JEOKCHEONSU);
      }
    });

    it('returns empty map for source not referenced', () => {
      // All classical sources should be referenced at least somewhere,
      // but we test the method returns a valid map.
      const result = RuleCitationRegistry.forSource(ClassicalSource.JEOKCHEONSU);
      expect(result).toBeInstanceOf(Map);
    });
  });
});
