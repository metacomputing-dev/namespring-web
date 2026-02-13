import assert from "node:assert/strict";
import test from "node:test";

import { Seed } from "../dist/index.js";

const seed = new Seed();

test("compatibility hanja should not be normalized into canonical hanja", () => {
  const compat = "\uF903"; // 賈
  const canonical = "\u8CC8"; // 賈
  const compatEval = seed.evaluate({
    query: `[\uB0A8\uAD81/\u5357\u5BAE][\uACE0/${compat}]`,
    includeSaju: false,
  });
  const canonicalEval = seed.evaluate({
    query: `[\uB0A8\uAD81/\u5357\u5BAE][\uACE0/${canonical}]`,
    includeSaju: false,
  });

  assert.equal(compatEval.name.firstNameHanja, compat);
  assert.equal(canonicalEval.name.firstNameHanja, canonical);
  assert.notEqual(
    compatEval.categoryMap.HOEKSU_OHAENG.arrangement,
    canonicalEval.categoryMap.HOEKSU_OHAENG.arrangement,
  );
  assert.ok(compatEval.interpretation.score < canonicalEval.interpretation.score);

});
