import { buildInterpretationText } from "../../core/evaluator.js";
import type { SeedOptions } from "../../core/types.js";
import type { SeedTsResult, SeedTsUserInfo } from "../domain/naming.js";
import { SeedEngine } from "./seed-engine.js";
import { buildSeedTsQuery, toSeedTsBirth, toSeedTsFallbackNameInput, toSeedTsGender } from "./seedts-query.js";

export class SeedTsAnalyzer {
  private readonly seed: SeedEngine;

  constructor(options: SeedOptions = {}) {
    this.seed = new SeedEngine(options);
  }

  analyze(userInfo: SeedTsUserInfo): SeedTsResult {
    const result = this.seed.search({
      query: buildSeedTsQuery(userInfo.lastName, userInfo.firstName),
      limit: 1,
      offset: 0,
      includeSaju: false,
      gender: toSeedTsGender(userInfo.gender),
      birth: toSeedTsBirth(userInfo),
    });

    const top = result.responses[0];
    if (top) {
      return {
        candidates: [
          {
            lastName: top.name.lastNameHangul,
            firstName: top.name.firstNameHangul,
            totalScore: top.interpretation.score,
            interpretation: buildInterpretationText(top),
            raw: top,
          },
        ],
        totalCount: result.totalCount,
        gender: userInfo.gender,
      };
    }

    const fallback = this.seed.evaluate({
      name: toSeedTsFallbackNameInput(userInfo),
      includeSaju: false,
    });

    return {
      candidates: [
        {
          lastName: fallback.name.lastNameHangul,
          firstName: fallback.name.firstNameHangul,
          totalScore: fallback.interpretation.score,
          interpretation: buildInterpretationText(fallback),
          raw: fallback,
        },
      ],
      totalCount: 1,
      gender: userInfo.gender,
    };
  }
}

