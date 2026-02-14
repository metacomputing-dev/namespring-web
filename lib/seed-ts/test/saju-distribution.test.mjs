import assert from "node:assert/strict";
import test from "node:test";

import { Seed } from "../dist/index.js";

const seed = new Seed();
const query = "[남궁/南宮][고/高]";
const birth = {
  year: 1995,
  month: 9,
  day: 21,
  hour: 9,
  minute: 30,
};

test("saju distribution should come from birth when birth info exists", () => {
  const withBirth = seed.evaluate({ query, birth, gender: "FEMALE", includeSaju: false });
  const withoutBirth = seed.evaluate({ query, includeSaju: false });

  const withBirthDetails = withBirth.categoryMap.SAJU_JAWON_BALANCE.details;
  const withoutBirthDetails = withoutBirth.categoryMap.SAJU_JAWON_BALANCE.details;

  assert.equal(withBirthDetails.sajuDistributionSource, "birth");
  assert.equal(withoutBirthDetails.sajuDistributionSource, "fallback");
  assert.notDeepEqual(withBirthDetails.sajuDistribution, withoutBirthDetails.sajuDistribution);
});

test("saju should be always included regardless of includeSaju flag", () => {
  const disabled = seed.evaluate({ query, birth, gender: "FEMALE", includeSaju: false });
  const enabled = seed.evaluate({ query, birth, gender: "FEMALE", includeSaju: true });

  assert.equal(
    disabled.categoryMap.SAJU_JAWON_BALANCE.score,
    enabled.categoryMap.SAJU_JAWON_BALANCE.score,
  );
  assert.deepEqual(
    disabled.categoryMap.SAJU_JAWON_BALANCE.details,
    enabled.categoryMap.SAJU_JAWON_BALANCE.details,
  );
});
