import assert from "node:assert/strict";
import test from "node:test";

import { Seed, SeedTs } from "../dist/index.js";

const seed = new Seed();

const evaluateQueries = [
  "[최/崔][성/成][수/秀]",
  "[남궁/南宮][석/石]",
  "[선우/鮮于][재/在][덕/德]",
];

const searchQueries = [
  "[최/崔][_/_][_/_]",
  "[남궁/南宮][_/_]",
  "[제갈/諸葛][_/_]",
  "[선우/鮮于][_/_][_/_]",
];

test("evaluate parity smoke: complete query should produce scored response", () => {
  for (const query of evaluateQueries) {
    const response = seed.evaluate({ query, includeSaju: false });
    assert.ok(response.name.lastNameHangul.length > 0);
    assert.ok(response.name.firstNameHangul.length > 0);
    assert.ok(response.interpretation.score >= 0 && response.interpretation.score <= 100);
    assert.equal(typeof response.interpretation.isPassed, "boolean");
    assert.ok(response.categoryMap.SAGYEOK_SURI);
    assert.ok(response.categoryMap.SAGYEOK_OHAENG);
    assert.ok(response.categoryMap.BALEUM_OHAENG);
    assert.ok(response.categoryMap.JAWON_OHAENG);
    assert.ok(response.categoryMap.EUMYANG);
    assert.ok(response.categoryMap.SAJU_JAWON_BALANCE);
  }
});

test("search parity smoke: wildcard query should return sorted pass candidates", () => {
  for (const query of searchQueries) {
    const result = seed.search({
      query,
      includeSaju: false,
      limit: 50,
      offset: 0,
      gender: "NONE",
      latitude: 37.5665,
      longitude: 126.978,
    });
    assert.ok(result.totalCount >= 0);
    assert.ok(result.responses.length <= 50);
    for (let i = 0; i < result.responses.length - 1; i += 1) {
      const current = result.responses[i];
      const next = result.responses[i + 1];
      assert.ok(current.interpretation.score >= next.interpretation.score);
      assert.equal(current.interpretation.isPassed, true);
    }
  }
});

test("SeedTs compatibility: analyze should provide legacy candidate shape", () => {
  const engine = new SeedTs();
  const result = engine.analyze({
    lastName: "최",
    firstName: "성수",
    gender: "NONE",
  });

  assert.ok(result.totalCount >= 1);
  assert.ok(result.candidates.length >= 1);
  assert.equal(typeof result.candidates[0].totalScore, "number");
  assert.equal(typeof result.candidates[0].interpretation, "string");
});

