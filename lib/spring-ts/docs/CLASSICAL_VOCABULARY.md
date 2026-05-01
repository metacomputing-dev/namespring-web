# Classical Vocabulary Dictionary

## Purpose

Phase 7.2 starts with terminology mapping, not translation. The dictionary links
classical myeongri terms to existing `spring-ts` and `saju-ts` code surfaces so
later rule fixtures can reference stable feature IDs.

Machine-readable data:

- `data/classical-vocabulary/classical-myeongri-vocabulary.json`
- `test/baseline/schema/classicalVocabulary.schema.json`

Lookup helper:

- `src/classical-vocabulary.ts`

## Scope

The first dictionary covers:

- Ten-god terms (`正官`, `七殺`, `食神`, `劫財`, ...)
- Normal and special gyeokguk terms (`正官格`, `化氣格`, `從財格`, ...)
- Stem/branch relation terms (`天干合`, `地支沖`, `三合`, `破`, ...)
- Useful-god method terms (`用神`, `喜神`, `調候`, `通關`, `病藥`)
- Disease/remedy and compound idioms (`病`, `藥`, `傷官見官`, ...)

Each entry carries a `mapsTo` object:

- `surface`: existing report, rule, or evidence surface.
- `fieldPath`: stable path or rule-spec anchor.
- `code`: internal code when one exists; compound idioms may use `null`.
- `axis`: high-level scoring or evidence axis.

## Source Linkage

The dictionary references Phase 7.1 source IDs from
`data/sources/classical-myeongri.sources.json`:

- `yuanhai_ziping`
- `ditian_sui_chanwei`
- `sanming_tonghui`

It stores no source prose. `sourceRefs[].quoteShort` is currently `null` and
must remain at or below 80 Unicode code points if later phases add short
supporting quotes.

## Lookup Policy

The dictionary is `T3_AUTHORED_INTERPRETATION` and
`authorityTruthEligible: false`. It may support deterministic lookup and source
traceability, but it is not a pass/fail authority baseline by itself.

Use:

```ts
import { lookupClassicalVocabularyTerm } from './src/classical-vocabulary.js';

const entry = lookupClassicalVocabularyTerm('七殺');
// entry?.mapsTo.code === 'PYEON_GWAN'
```

## Guardrails

Regression coverage is in `npm run test:classical-vocabulary`. It checks:

- Schema version and source registry linkage.
- Stable unique term IDs and lookup aliases.
- Source IDs against the Phase 7.1 registry.
- No risky copied-text fields such as `rawText`, `ocrText`, or `fullText`.
- Short quote limits for every `quoteShort` field.
- Lookup behavior for representative ten-god, frame, relation, useful-god, and
  compound terms.
