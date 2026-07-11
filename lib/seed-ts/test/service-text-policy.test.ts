import assert from 'node:assert/strict';
import test from 'node:test';

import { FourFrameCalculator } from '../src/calculator/frame-calculator.js';
import {
  FOURFRAME_MEANING_CATALOG,
  getFourframeMeaningByNumber,
} from '../src/fourframe-catalog.js';
import {
  SERVICE_TEXT_REPLACEMENTS,
  ServiceTextPolicyError,
  assertServiceTextPolicy,
  auditServiceTextPolicy,
  sanitizeImmutableServiceValue,
} from '../src/service-text-policy.js';

function countByRule(findings: ReturnType<typeof auditServiceTextPolicy>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const finding of findings) {
    counts[finding.ruleId] = (counts[finding.ruleId] ?? 0) + 1;
  }
  return counts;
}

test('immutable sanitizer keeps the established service rewrite behavior', () => {
  assert.ok(Object.isFrozen(SERVICE_TEXT_REPLACEMENTS));
  assert.ok(SERVICE_TEXT_REPLACEMENTS.every((replacement) => Object.isFrozen(replacement)));
  const source = {
    line: '[성함]님께서는 정기적인 건강검진과 병원 경영자, 깊은 우울로 이어지는 표현을 살펴봐요.',
    nested: ['성과와 인정를', '강철 같은 심장'],
  };

  const display = sanitizeImmutableServiceValue(source, '김민준');

  assert.deepEqual(display, {
    line: '김민준님은 정기적인 컨디션 점검과 전문 기관 운영자, 깊은 무기력으로 이어지는 표현을 살펴봐요.',
    nested: ['성과와 인정을', '강철 같은 마음'],
  });
  assert.deepEqual(source, {
    line: '[성함]님께서는 정기적인 건강검진과 병원 경영자, 깊은 우울로 이어지는 표현을 살펴봐요.',
    nested: ['성과와 인정를', '강철 같은 심장'],
  });
  assert.notStrictEqual(display, source);
  assert.notStrictEqual(display.nested, source.nested);
  assert.ok(Object.isFrozen(display));
  assert.ok(Object.isFrozen(display.nested));
  assert.doesNotThrow(() => assertServiceTextPolicy(display));
});

test('all 81 display rows pass blocking policy while review debt stays explicit', () => {
  const rawBefore = JSON.stringify(FOURFRAME_MEANING_CATALOG);
  const displayCatalog = sanitizeImmutableServiceValue(
    FOURFRAME_MEANING_CATALOG,
    '김민준',
  );

  assert.equal(displayCatalog.length, 81);
  assert.notStrictEqual(displayCatalog, FOURFRAME_MEANING_CATALOG);
  assert.equal(JSON.stringify(FOURFRAME_MEANING_CATALOG), rawBefore);
  assert.ok(rawBefore.includes('[성함]'));
  assert.equal(JSON.stringify(displayCatalog).includes('[성함]'), false);
  assert.ok(JSON.stringify(displayCatalog).includes('김민준'));
  assert.ok(Object.isFrozen(displayCatalog));
  assert.ok(displayCatalog.every((entry) =>
    Object.isFrozen(entry)
    && Object.isFrozen(entry.personality_traits)
    && Object.isFrozen(entry.suitable_career)));

  const findings = auditServiceTextPolicy(displayCatalog, 'fourframeCatalog');
  const blocking = findings.filter((finding) => finding.severity === 'block');
  const review = findings.filter((finding) => finding.severity === 'review');

  assert.deepEqual(blocking, []);
  assert.equal(review.length, 389);
  assert.deepEqual(countByRule(review), {
    'absolute-language': 138,
    'catastrophe-language': 15,
    'certainty-language': 77,
    'lifetime-destiny': 90,
    'longevity-language': 24,
    'medical-career': 45,
  });
  assert.ok(Object.isFrozen(findings));
  assert.ok(findings.every((finding) =>
    Object.isFrozen(finding)
    && finding.path.startsWith('fourframeCatalog[')));
  assert.doesNotThrow(() => assertServiceTextPolicy(displayCatalog));
  assert.throws(
    () => assertServiceTextPolicy(displayCatalog, { includeReview: true }),
    (error: unknown) => {
      assert.ok(error instanceof ServiceTextPolicyError);
      assert.equal(error.violations.length, 389);
      assert.ok(Object.isFrozen(error.violations));
      return true;
    },
  );
});

test('Frame.entry is a fullHangul-specific immutable display DTO, not the raw row', () => {
  const rawEntry = getFourframeMeaningByNumber(5);
  const rawBefore = JSON.stringify(rawEntry);
  const frame = new FourFrameCalculator.Frame('won', 5, '김민준');

  assert.notStrictEqual(frame.entry, rawEntry);
  assert.equal(JSON.stringify(rawEntry), rawBefore);
  assert.ok(rawBefore.includes('[성함]'));
  assert.equal(JSON.stringify(frame.entry).includes('[성함]'), false);
  assert.ok(JSON.stringify(frame.entry).includes('김민준'));
  assert.ok(Object.isFrozen(frame.entry));
  assert.ok(Object.isFrozen(frame.entry.personality_traits));
  assert.ok(Object.isFrozen(frame.entry.suitable_career));
  assert.doesNotThrow(() => assertServiceTextPolicy(frame.entry));
});
