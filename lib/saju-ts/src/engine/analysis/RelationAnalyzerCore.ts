import { Jiji } from '../../domain/Jiji.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { JijiRelationHit, JijiRelationType } from '../../domain/Relations.js';
import {
  addPairHits as addPairRelationHits,
  addTripleHits as addTripleRelationHits,
} from './RelationHitHelpers.js';
import type { AddHit } from './RelationHitHelpers.js';
import {
  BANHAP_DEFS,
  BANGHAP_TRIPLES,
  CHUNG_PAIRS,
  HAE_PAIRS,
  HYEONG_PAIRS,
  HYEONG_TRIPLES,
  PA_PAIRS,
  SAMHAP_TRIPLES,
  SELF_HYEONG_BRANCHES,
  WONJIN_PAIRS,
  YUKHAP_PAIRS,
} from './RelationCatalog.js';

type AddJijiHit = AddHit<JijiRelationType, Jiji>;

const SELF_PENALTY_NOTE = '\uC790\uD615';

interface BranchPresence {
  readonly counts: Map<Jiji, number>;
  readonly present: Set<Jiji>;
}

export function analyzeBranchRelations(pillars: PillarSet): JijiRelationHit[] {
  const { counts, present } = buildBranchPresence(pillars);

  const hits: JijiRelationHit[] = [];
  const addHit = createHitCollector(hits);

  addPairRelationHits(JijiRelationType.YUKHAP, YUKHAP_PAIRS, present, addHit);
  addTripleRelationHits(JijiRelationType.SAMHAP, SAMHAP_TRIPLES, present, addHit);

  for (const banhap of BANHAP_DEFS) {
    if (present.has(banhap.a) && present.has(banhap.b) && !present.has(banhap.missing)) {
      addHit(JijiRelationType.BANHAP, new Set([banhap.a, banhap.b]), banhap.note);
    }
  }

  addTripleRelationHits(JijiRelationType.BANGHAP, BANGHAP_TRIPLES, present, addHit);
  addPairRelationHits(JijiRelationType.CHUNG, CHUNG_PAIRS, present, addHit);
  addTripleRelationHits(JijiRelationType.HYEONG, HYEONG_TRIPLES, present, addHit);
  addPairRelationHits(JijiRelationType.HYEONG, HYEONG_PAIRS, present, addHit);

  for (const self of SELF_HYEONG_BRANCHES) {
    if ((counts.get(self) ?? 0) >= 2) {
      addHit(JijiRelationType.HYEONG, new Set([self]), SELF_PENALTY_NOTE);
    }
  }

  addPairRelationHits(JijiRelationType.PA, PA_PAIRS, present, addHit);
  addPairRelationHits(JijiRelationType.HAE, HAE_PAIRS, present, addHit);
  addPairRelationHits(JijiRelationType.WONJIN, WONJIN_PAIRS, present, addHit);

  return hits;
}

export class RelationAnalyzer {
  analyze(pillars: PillarSet): JijiRelationHit[] {
    return analyzeBranchRelations(pillars);
  }
}

function buildBranchPresence(pillars: PillarSet): BranchPresence {
  const counts = new Map<Jiji, number>();
  const branches = [pillars.year.jiji, pillars.month.jiji, pillars.day.jiji, pillars.hour.jiji];
  for (const branch of branches) {
    counts.set(branch, (counts.get(branch) ?? 0) + 1);
  }
  return { counts, present: new Set(counts.keys()) };
}

function createHitCollector(hits: JijiRelationHit[]): AddJijiHit {
  const seen = new Set<string>();
  return (type, members, note = '') => {
    const key = `${type}|${[...members].map((member) => member).sort().join('-')}|${note}`;
    if (!seen.has(key)) {
      seen.add(key);
      hits.push({ type, members, note });
    }
  };
}

