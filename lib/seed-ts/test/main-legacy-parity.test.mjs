import assert from "node:assert/strict";
import test from "node:test";

import { Seed } from "../dist/index.js";

const seed = new Seed();

const queries = [
  "[최/崔][성/成][수/秀]",
  "[최/崔][_/_][_/_]",
  "[최/崔][ㅈ/_][_/_]",
  "[최/崔][_/_][ㅣ/_]",
  "[최/崔][_/_]",
  "[남궁/南宮][석/石]",
  "[남궁/南宮][_/_]",
  "[남궁/南宮][_/_][_/_]",
  "[제갈/諸葛][_/_]",
  "[제갈/諸葛][_/_][_/_]",
  "[선우/鮮于][재/在][덕/德]",
  "[선우/鮮于][_/_][_/_]",
  "[박/朴][일/日]",
  "[박/朴][마/馬][리/利][아/妸]",
];

const expectedLines = new Map(
  Object.entries({
    "[최/崔][성/成][수/秀]": [
      "EVAL: 최성수 (崔成秀) TOT=58 PASS=N",
      "CAT: 사격수리=60/N | 사주이름오행=40/N | 획수음양=50/N | 발음오행=65/N | 발음음양=75/Y | 사격수리오행=65/N",
      "ARR: 획수오행=木-金-金 발음오행=金-金-金",
    ],
    "[최/崔][_/_][_/_]": [
      "COUNT: 25",
      "TOP3: 1) 최천명 (崔天銘) TOT=77 PASS=Y | 2) 최지빈 (崔之賓) TOT=77 PASS=Y | 3) 최지빈 (崔支賓) TOT=77 PASS=Y",
    ],
    "[최/崔][ㅈ/_][_/_]": [
      "COUNT: 10",
      "TOP3: 1) 최지빈 (崔之賓) TOT=77 PASS=Y | 2) 최지빈 (崔支賓) TOT=77 PASS=Y | 3) 최지빈 (崔止賓) TOT=77 PASS=Y",
    ],
    "[최/崔][_/_][ㅣ/_]": [
      "COUNT: 10",
      "TOP3: 1) 최지빈 (崔之賓) TOT=77 PASS=Y | 2) 최지빈 (崔支賓) TOT=77 PASS=Y | 3) 최지빈 (崔止賓) TOT=77 PASS=Y",
    ],
    "[최/崔][_/_]": [
      "COUNT: 5",
      "TOP3: 1) 최벽 (崔璧) TOT=81 PASS=Y | 2) 최적 (崔謫) TOT=79 PASS=Y | 3) 최지 (崔贄) TOT=79 PASS=Y",
    ],
    "[남궁/南宮][석/石]": [
      "EVAL: 남궁석 (南宮石) TOT=77 PASS=N",
      "CAT: 사격수리=60/Y | 사주이름오행=100/Y | 획수음양=75/Y | 발음오행=67/N | 발음음양=75/Y | 사격수리오행=85/N",
      "ARR: 획수오행=水-水-土 발음오행=火-木-金",
    ],
    "[남궁/南宮][_/_]": [
      "COUNT: 28",
      "TOP3: 1) 남궁령 (南宮鈴) TOT=81 PASS=Y | 2) 남궁록 (南宮碌) TOT=81 PASS=Y | 3) 남궁뢰 (南宮賂) TOT=81 PASS=Y",
    ],
    "[남궁/南宮][_/_][_/_]": [
      "COUNT: 521",
      "TOP3: 1) 남궁담희 (南宮譚曦) TOT=83 PASS=Y | 2) 남궁도의 (南宮韜議) TOT=83 PASS=Y | 3) 남궁담헌 (南宮譚獻) TOT=83 PASS=Y",
    ],
    "[제갈/諸葛][_/_]": [
      "COUNT: 9",
      "TOP3: 1) 제갈도 (諸葛到) TOT=77 PASS=Y | 2) 제갈간 (諸葛玕) TOT=76 PASS=Y | 3) 제갈구 (諸葛具) TOT=76 PASS=Y",
    ],
    "[제갈/諸葛][_/_][_/_]": [
      "COUNT: 34",
      "TOP3: 1) 제갈내운 (諸葛乃云) TOT=81 PASS=Y | 2) 제갈도윤 (諸葛刀允) TOT=81 PASS=Y | 3) 제갈내인 (諸葛乃仁) TOT=81 PASS=Y",
    ],
    "[선우/鮮于][재/在][덕/德]": [
      "EVAL: 선우재덕 (鮮于在德) TOT=62 PASS=N",
      "CAT: 사격수리=70/N | 사주이름오행=45/N | 획수음양=60/Y | 발음오행=75/N | 발음음양=60/Y | 사격수리오행=67/N",
      "ARR: 획수오행=金-火-土-土 발음오행=金-土-金-火",
    ],
    "[선우/鮮于][_/_][_/_]": [
      "COUNT: 665",
      "TOP3: 1) 선우찬보 (鮮于贊報) TOT=81 PASS=Y | 2) 선우사발 (鮮于辭發) TOT=81 PASS=Y | 3) 선우찬보 (鮮于贊普) TOT=81 PASS=Y",
    ],
    "[박/朴][일/日]": [
      "EVAL: 박일 (朴日) TOT=53 PASS=N",
      "CAT: 사격수리=5/N | 사주이름오행=65/N | 획수음양=50/N | 발음오행=67/N | 발음음양=90/Y | 사격수리오행=57/N",
      "ARR: 획수오행=土-火 발음오행=水-土",
    ],
    "[박/朴][마/馬][리/利][아/妸]": [
      "EVAL: 박마리아 (朴馬利妸) TOT=71 PASS=N",
      "CAT: 사격수리=90/Y | 사주이름오행=75/N | 획수음양=60/N | 발음오행=72/N | 발음음양=60/N | 사격수리오행=65/N",
      "ARR: 획수오행=土-水-金-金 발음오행=水-水-火-土",
    ],
  }),
);

function yn(value) {
  return value ? "Y" : "N";
}

function isCompleteQuery(query) {
  const opens = [...query].filter((c) => c === "[").length;
  const closes = [...query].filter((c) => c === "]").length;
  return opens === closes && !query.includes("_");
}

function formatEvalLines(response) {
  const fullName = `${response.name.lastNameHangul}${response.name.firstNameHangul}`;
  const fullNameHanja = `${response.name.lastNameHanja}${response.name.firstNameHanja}`;
  const line1 = `EVAL: ${fullName} (${fullNameHanja}) TOT=${response.interpretation.score} PASS=${yn(response.interpretation.isPassed)}`;

  const sagyeok = response.categoryMap.SAGYEOK_SURI;
  const saju = response.categoryMap.SAJU_JAWON_BALANCE;
  const hoeksuEumyang = response.categoryMap.HOEKSU_EUMYANG ?? response.categoryMap.EUMYANG;
  const baleumOhaeng = response.categoryMap.BALEUM_OHAENG;
  const baleumEumyang = response.categoryMap.BALEUM_EUMYANG ?? hoeksuEumyang;
  const baleumEumyangScore = baleumEumyang.score;
  const baleumEumyangPassed = baleumEumyang.isPassed;
  const sagyeokOhaeng = response.categoryMap.SAGYEOK_OHAENG;

  const line2 =
    `CAT: 사격수리=${sagyeok.score}/${yn(sagyeok.isPassed)} | ` +
    `사주이름오행=${saju.score}/${yn(saju.isPassed)} | ` +
    `획수음양=${hoeksuEumyang.score}/${yn(hoeksuEumyang.isPassed)} | ` +
    `발음오행=${baleumOhaeng.score}/${yn(baleumOhaeng.isPassed)} | ` +
    `발음음양=${baleumEumyangScore}/${yn(baleumEumyangPassed)} | ` +
    `사격수리오행=${sagyeokOhaeng.score}/${yn(sagyeokOhaeng.isPassed)}`;

  const line3 = `ARR: 획수오행=${(response.categoryMap.HOEKSU_OHAENG ?? response.categoryMap.JAWON_OHAENG).arrangement} 발음오행=${baleumOhaeng.arrangement}`;
  return [line1, line2, line3];
}

function formatSearchLines(result) {
  const count = `COUNT: ${result.totalCount}`;
  const top = result.responses.slice(0, 3).map((response, i) => {
    const fullName = `${response.name.lastNameHangul}${response.name.firstNameHangul}`;
    const fullNameHanja = `${response.name.lastNameHanja}${response.name.firstNameHanja}`;
    return `${i + 1}) ${fullName} (${fullNameHanja}) TOT=${response.interpretation.score} PASS=${yn(response.interpretation.isPassed)}`;
  });
  return [count, `TOP3: ${top.join(" | ")}`];
}

test("legacy Main.kt parity", () => {
  for (const query of queries) {
    const actual = isCompleteQuery(query)
      ? formatEvalLines(seed.evaluate({ query, includeSaju: false }))
      : formatSearchLines(
          seed.search({
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
          }),
        );
    assert.deepEqual(actual, expectedLines.get(query));
  }
});
