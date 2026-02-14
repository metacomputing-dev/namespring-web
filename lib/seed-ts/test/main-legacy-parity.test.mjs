import assert from "node:assert/strict";
import test from "node:test";

import { Seed } from "../dist/index.js";

const seed = new Seed();

const queries = [
  "[理?若?[????[??燁]",
  "[理?若?[_/_][_/_]",
  "[理?若?[??_][_/_]",
  "[理?若?[_/_][??_]",
  "[理?若?[_/_]",
  "[?④턿/?쀥?][????",
  "[?④턿/?쀥?][_/_]",
  "[?④턿/?쀥?][_/_][_/_]",
  "[?쒓컝/獄멱몳][_/_]",
  "[?쒓컝/獄멱몳][_/_][_/_]",
  "[?좎슦/饒?틢][????[??孃?",
  "[?좎슦/饒?틢][_/_][_/_]",
  "[諛???[????",
  "[諛???[留?腰?[由???[??倻?",
];

function isCompleteQuery(query) {
  const opens = [...query].filter((c) => c === "[").length;
  const closes = [...query].filter((c) => c === "]").length;
  return opens === closes && !query.includes("_");
}

test("legacy Main compatibility smoke", () => {
  for (const query of queries) {
    if (isCompleteQuery(query)) {
      const response = seed.evaluate({ query, includeSaju: false });
      assert.ok(response.name.lastNameHangul.length > 0);
      assert.ok(response.name.firstNameHangul.length > 0);
      assert.ok(response.interpretation.score >= 0 && response.interpretation.score <= 100);
      assert.equal(typeof response.interpretation.isPassed, "boolean");
      assert.ok(response.categoryMap.SAGYEOK_SURI);
      assert.ok(response.categoryMap.SAGYEOK_OHAENG);
      assert.ok(response.categoryMap.BALEUM_OHAENG);
      assert.ok(response.categoryMap.BALEUM_EUMYANG);
      assert.ok(response.categoryMap.SAJU_JAWON_BALANCE);
      continue;
    }

    const result = seed.search({
      query,
      year: 1986,
      month: 4,
      day: 19,
      hour: 5,
      minute: 45,
      latitude: 37.5665,
      longitude: 126.978,
      gender: "NONE",
      limit: 10000,
      offset: 0,
      includeSaju: false,
    });

    assert.ok(result.totalCount >= 0);
    assert.ok(result.responses.length <= 10000);
    for (let i = 0; i < result.responses.length - 1; i += 1) {
      const current = result.responses[i];
      const next = result.responses[i + 1];
      assert.ok(current.interpretation.score >= next.interpretation.score);
      assert.ok(current.categoryMap.SAJU_JAWON_BALANCE);
    }
  }
});
