import assert from 'node:assert/strict';
import type { HanjaEntry } from '../../../seed-ts/src/database/hanja-repository.js';
import {
  candidateMeaningDescriptors,
  computeRecommendationMeaningConfidence,
  hasOpaqueHanjaMeaning,
  hasUnsafeHanjaMeaning,
  hasWeakRecommendationHanjaMeaning,
} from '../../src/candidate-meaning-policy.js';

function entry(hanja: string, hangul: string, meaning: string): HanjaEntry {
  return { hanja, hangul, meaning } as HanjaEntry;
}

const falsePositiveFixtures = [
  entry('讖', '참', '뉘우칠 참, 비결 참'),
  entry('壬', '임', '아홉째천간 임, 짊어질 임'),
  entry('朶', '타', '늘어질 타'),
  entry('囑', '촉', '부탁할 촉, 맡길 촉'),
  entry('鑂', '훈', '금빛투색할 훈'),
];
for (const fixture of falsePositiveFixtures) {
  assert.equal(hasWeakRecommendationHanjaMeaning(fixture), true);
  assert.equal(
    computeRecommendationMeaningConfidence([fixture]),
    35,
    `${fixture.hanja} must not receive a positive score from its reading or an internal verb ending`,
  );
}

// A semantic token must not be rejected merely because an unrelated word
// contains a dangerous-looking syllable. These are legal name glyphs whose
// glosses describe an ornament or imitation, not a weapon or bad fortune.
const unsafeSubstringFalsePositiveFixtures = [
  entry('珌', '필', '칼장식옥 필'),
  entry('琫', '봉', '칼집장식옥 봉'),
  entry('擬', '의', '헤아릴 의, 흉내낼 의'),
];
for (const fixture of unsafeSubstringFalsePositiveFixtures) {
  assert.equal(hasUnsafeHanjaMeaning(fixture), false);
  assert.equal(hasWeakRecommendationHanjaMeaning(fixture), true);
  assert.equal(computeRecommendationMeaningConfidence([fixture]), 35);
}

const benevolent = entry('仁', '인', '어질 인');
const auspicious = entry('利', '리', '길할 리(이)');
assert.deepEqual(candidateMeaningDescriptors(benevolent), ['어질']);
assert.deepEqual(candidateMeaningDescriptors(auspicious), ['길할']);
assert.equal(computeRecommendationMeaningConfidence([benevolent]), 100);
assert.equal(computeRecommendationMeaningConfidence([auspicious]), 100);

const unsafe = entry('亡', '망', '죽을 망');
assert.equal(hasUnsafeHanjaMeaning(unsafe), true);
assert.equal(computeRecommendationMeaningConfidence([unsafe]), 0);

const opaque = entry('民', '민', '민');
assert.deepEqual(candidateMeaningDescriptors(opaque), []);
assert.equal(hasOpaqueHanjaMeaning(opaque), true);
assert.equal(computeRecommendationMeaningConfidence([opaque]), 0);

// 伯·仲·叔·季 have historical sibling-order usages, especially in a
// post-coming-of-age courtesy name (字). Modern commercial birth-order lists
// are not a legal or canonical naming filter, so these neutral order-only
// glosses remain legal but soft-deferred rather than hard included/excluded.
const historicalSiblingOrderFixtures = [
  entry('伯', '백', '맏 백'),
  entry('仲', '중', '버금 중, 둘째 중'),
  entry('叔', '숙', '아저씨 숙, 셋째 숙'),
  entry('季', '계', '막내 계'),
];
for (const fixture of historicalSiblingOrderFixtures) {
  assert.equal(hasUnsafeHanjaMeaning(fixture), false);
  assert.equal(hasWeakRecommendationHanjaMeaning(fixture), true);
  assert.equal(computeRecommendationMeaningConfidence([fixture]), 35);
}

console.log('Candidate meaning policy: PASS');
