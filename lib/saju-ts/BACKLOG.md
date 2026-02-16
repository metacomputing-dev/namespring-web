# Saju-TS Refactor Backlog

Updated: 2026-02-16
Scope: `src/` only (tests excluded from refactor scope)

## Current Snapshot

- `src` files: `183`
- `src` lines: `14,230` (from prior `14,264`, `-34` in this batch)
- Batch focus:
  - Flattened score-branching scaffolding in:
    - `src/engine/analysis/StrengthScoringHelpers.ts`
  - Reduced branching/duplication in narrative synthesis builders:
    - `src/interpretation/NarrativeOverallSynthesisHelpers.ts`
  - Further compacted rule catalog declarations and eokbu branching flow in:
    - `src/engine/analysis/YongshinDeciderStrategies.ts`
  - Compressed rule-heavy decision matrices while preserving behavior:
    - `src/engine/analysis/YongshinDeciderStrategies.ts`
    - `src/engine/analysis/RelationInteractionRules.ts`
  - Consolidated declarative formation-rule DSL into shared utilities and removed standalone DSL module:
    - `src/engine/analysis/GyeokgukFormationShared.ts`
  - Converted both 격국 형성 판단 modules to rule-spec catalogs + shared evaluator:
    - `src/engine/analysis/GyeokgukFormationNaegyeokAssessors.ts`
    - `src/engine/analysis/GyeokgukFormationOegyeokAssessors.ts`
  - Simplified `FormationProfile` construction by replacing repeated filter scans with reusable count-map utilities:
    - `src/engine/analysis/GyeokgukFormationProfile.ts`
  - Removed now-redundant grade-specific shinsal detector wrapper exports:
    - `src/engine/analysis/shinsalGradeDetectors.ts`
  - Externalized life-domain narrative note dictionaries into data catalog and removed in-module text-map duplication:
    - `src/interpretation/data/lifeDomainNoteCatalog.json`
    - `src/interpretation/LifeDomainNoteCatalog.ts`
    - `src/interpretation/LifeDomainCareerSection.ts`
    - `src/interpretation/LifeDomainHealthSection.ts`
    - `src/interpretation/LifeDomainLoveSection.ts`
    - `src/interpretation/LifeDomainWealthSection.ts`
  - Consolidated repeated recommendation object construction and jeonwang rule wiring in:
    - `src/engine/analysis/YongshinDeciderStrategies.ts`
  - Externalized interpretation-heavy static catalogs into JSON and replaced imperative table construction with typed loaders:
    - `src/interpretation/data/strengthInterpretations.json`
    - `src/interpretation/data/ohaengPracticalGuides.json`
    - `src/interpretation/data/sibiUnseongInterpretations.json`
    - `src/interpretation/data/relationSignificanceCatalog.json`
    - `src/interpretation/data/cheonganSignificanceCatalog.json`
  - Simplified runtime interpreters to data-driven loaders:
    - `src/interpretation/StrengthInterpreter.ts`
    - `src/interpretation/OhaengPracticalGuide.ts`
    - `src/interpretation/SibiUnseongInterpreter.ts`
    - `src/interpretation/RelationSignificanceData.ts`
    - `src/interpretation/RelationSignificanceInterpreter.ts`
    - `src/interpretation/CheonganSignificanceInterpreter.ts`
  - Added shared position-pair inference utility and removed duplicate pair-order logic:
    - `src/interpretation/PositionPairResolver.ts`
  - Externalized shinsal-gyeokguk synergy rules into precomputed data:
    - `src/interpretation/shinsalGyeokgukSynergy/data.json`
    - simplified runtime lookup in `src/interpretation/shinsalGyeokgukSynergy/rules.ts`
    - removed obsolete matcher helper `src/interpretation/shinsalGyeokgukSynergy/helpers.ts`
  - Simplified `src/interpretation/ShinsalGyeokgukSynergyMatrix.ts` by deriving `SHINSAL_TYPES_WITH_SYNERGY` / `SHINSAL_TYPES_WITHOUT_SYNERGY` from data-backed rule coverage instead of hard-coded sets.
  - Split shinsal catalog payload from code into JSON resources:
    - `src/engine/analysis/data/shinsalStemTables.json`
    - `src/engine/analysis/data/shinsalBranchTables.json`
    - `src/engine/analysis/data/shinsalWeightTable.json`
  - Rebuilt `ShinsalCatalogStemTables` and `ShinsalCatalogBranchTables` as typed JSON loaders with enum validation and preserved runtime maps/API surface.
  - Refactored `ShinsalWeightModel` to load base weights from data resource while preserving weighting semantics.
  - Centralized repeated narrative sentence citation into `src/interpretation/NarrativeSentenceCite.ts` and removed duplicated local helpers across narrative section modules.
  - Reduced `src/interpretation/NarrativeEngine.ts` import surface to only actually used symbols after section-level split, removing large dead dependency scaffolding.
  - Unified `PositionPair` source in `src/interpretation/CheonganSignificanceInterpreter.ts` via `RelationSignificanceData` and preserved legacy cheongan-specific position labels through compatibility mapping.
  - Cleaned strict-unused noise in:
    - `src/calendar/solar/Vsop87dFallback.ts`
    - `src/engine/analysis/GongmangCalculator.ts`
    - `src/engine/analysis/RelationInteractionResolver.ts`
    - `src/engine/analysis/SibiUnseongCalculator.ts`
    - `src/interpretation/NarrativeOverviewSection.ts`
- Verification:
  - `pnpm lint` pass
  - targeted synergy/narrative/yongshin regression suites pass
  - targeted shinsal regression tests pass (`55/55`)
  - `pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters false` pass
  - full `pnpm test` pass (`8794/8794`)

## Baseline Snapshot

- `src` files: `174`
- `src` lines: `24,243`
- Area split:
  - `src/engine`: `10,205`
  - `src/interpretation`: `6,459`
  - `src/calendar`: `5,430`
  - `src/domain`: `1,298`
  - `src/config`: `702`
  - `src/index.ts`: `149`
- Data-like files (table/catalog/registry heavy): `17 files`, `6,649 lines` (`27.43%`)
- Concentration:
  - top 2 files = `3,950 lines` (`16.29%`)
  - top 30 files = `11,421 lines` (`47.11%`)
  - files >= 200 lines = `39 files`, `13,272 lines` (`54.75%`)
- Encoding blocker:
  - non-UTF8 file detected: `src/engine/SajuAnalysisPipeline.ts`

## Strict Assessment

- Current size is not strictly required for behavior.
- Without architecture changes, realistic reduction range is `10% ~ 20%` (`~2.4k to ~4.8k` lines).
- With architecture changes (data externalization/codegen), realistic reduction range is `30% ~ 45%` (`~7k to ~11k` lines).
- The largest leverage is reducing TS-embedded data, then splitting high-responsibility orchestrators/strategy modules.
- 2026-02-15 6-lane rescan estimate (current `18,479` lines):
  - high-confidence additional reduction: `~1.3k to ~2.2k` (`~7.0% to ~11.9%`)
  - architecture-driven additional reduction: `~2.9k to ~4.8k` (`~15.7% to ~26.0%`)
  - no single low-risk lane currently yields `1k+` reduction alone; large drops require coordinated multi-lane architecture tracks.

## Prioritized Backlog

| ID | Priority | Status | Item | Expected Impact |
|---|---|---|---|---|
| P0-01 | P0 | TODO | Normalize `src/engine/SajuAnalysisPipeline.ts` to UTF-8 and protect encoding in CI/tooling | Unblocks safe large refactors |
| P1-01 | P1 | IN_PROGRESS | Externalize `src/calendar/solar/Vsop87dTerms.ts` data into versioned JSON/TSV + typed loader | Very high LOC drop |
| P1-02 | P1 | IN_PROGRESS | Externalize `src/calendar/solar/JeolBoundaryData.ts` into compact data artifact + checksum test | Very high LOC drop |
| P1-03 | P1 | IN_PROGRESS | Externalize `src/calendar/lunar/KoreanLunarYearData.ts` into generated artifact | High LOC drop |
| P1-07 | P1 | IN_PROGRESS | Introduce a narrative section DSL/composer across `NarrativeEngine`, `NarrativeOverallSynthesisHelpers`, `NarrativeStrengthAndYongshinSection`, and related narrative section modules | Very high LOC drop with better narrative consistency |
| P1-08 | P1 | DONE | Convert `GyeokgukFormationNaegyeokAssessors` + `GyeokgukFormationOegyeokAssessors` from imperative condition blocks into declarative rule catalogs + evaluator | High LOC drop and rule auditability |
| P1-09 | P1 | TODO | Table-drive `shinsalSpecificDetectors` and adjacent detector modules through a shared detector registry + note formatter | High LOC drop with lower detector duplication |
| P2-01 | P2 | IN_PROGRESS | Externalize interpretation catalogs/registry data (`IljuInterpretationCatalog`, `SipseongInterpretationCatalog`, `RuleCitation*Data`) | High LOC drop, clearer ownership |
| P2-02 | P2 | TODO | Keep loaders pure and add schema validation + fixture integrity tests | Safety for data-driven architecture |
| P2-05 | P2 | IN_PROGRESS | Consolidate branch-heavy matrices in `YongshinDeciderStrategies` and `RelationInteractionRules` into typed rule tables | Medium-high LOC drop, reduced branching complexity |
| P2-06 | P2 | TODO | Refactor `LuckInteractionAnalyzerHelpers` and `LuckTraceReasoningBuilders` into template-driven reason builders | Medium LOC drop and lower narrative duplication |
| P2-07 | P2 | TODO | Externalize remaining narrative-heavy catalogs (`JohuTable`, `JohuCatalog`, selected interpretation theme maps) into packed data modules with loader validation | Medium LOC drop with clearer content ownership |
| P3-01 | P3 | IN_PROGRESS | Split long strategy/orchestrator files into decision units (`YongshinDeciderStrategies`, `NarrativeEngine`, `SajuAnalysisPipeline`) | Medium LOC drop, high maintainability gain |
| P3-02 | P3 | TODO | Introduce module boundaries by concern (pipeline orchestration vs calculators vs trace builders) | Medium maintainability gain |
| P3-03 | P3 | TODO | Split `src/interpretation/NarrativeOverallSynthesisHelpers.ts` into causal-chain/life-path modules and formatter helpers | High readability gain |
| P3-04 | P3 | TODO | Decompose `src/engine/luck/LuckInteractionAnalyzerHelpers.ts` into scoring policy vs narrative helper modules | Medium maintainability gain |
| P3-05 | P3 | TODO | Introduce a pipeline step registry for `SajuAnalysisPipeline` trace assembly to reduce repetitive hand-wired step blocks | Medium LOC drop and lower orchestration coupling |
| P4-01 | P4 | IN_PROGRESS | Consolidate duplicated helper patterns (set/map traversal, adjacency checks, trace evidence builders) | Low-moderate LOC drop, reduced cognitive load |
| P4-02 | P4 | DONE | Remove dead/legacy compatibility wrappers after migration proof | Incremental cleanup |
| P4-03 | P4 | DONE | Refactor `tongwanYongshin` in `YongshinDeciderStrategies` into declarative conflict-pattern evaluation | Low-moderate LOC drop, reduced branching complexity |
| P4-04 | P4 | DONE | Clean up pass-through comments/wrappers in decider modules after helper migration | Incremental cleanup |
| P4-05 | P4 | DONE | Introduce shared pair/triple hit collector between `RelationAnalyzer` and `DefaultRelationAnalyzer` | Reduced duplicate traversal logic |
| P4-06 | P4 | TODO | Extract reusable conflict-pattern evaluator utility for decider strategies (tongwan/jeonwang candidates) | Reduced branching duplication |
| P4-07 | P4 | DONE | Merge duplicated relation lookup tables between `RelationAnalyzer` and `DefaultRelationAnalyzer` into shared catalog module | Meaningful LOC drop + single source of truth |
| P4-08 | P4 | DONE | Unify duplicated relation-analyzer scaffolding (`buildBranchPresence`/hit collector lifecycle) into shared utility | Incremental duplication reduction |
| P4-09 | P4 | DONE | Collapse `RelationAnalyzer` and `DefaultRelationAnalyzer` into thin compatibility wrappers around a single shared core implementation | Reduce maintenance surface for branch-relation analysis |
| P4-10 | P4 | IN_PROGRESS | Reuse extracted conflict-pattern evaluator style in remaining Yongshin decider branches (`jeonwang`, edge-policy branches) | Reduce branching complexity in decision strategies |
| P4-11 | P4 | TODO | Complete decider pattern extraction for remaining edge-policy branches after `jeonwang` element-resolution split | Additional branching simplification with low behavior risk |
| P4-12 | P4 | IN_PROGRESS | Continue facade simplification by replacing trivial forwarding modules with direct aliases/re-exports where API-safe | Shrink compatibility surface |
| P4-13 | P4 | IN_PROGRESS | Replace additional in-module forwarding helpers with direct function references (where signatures are already identical) | Incremental readability and LOC cleanup |
| P4-14 | P4 | IN_PROGRESS | Continue removing zero-logic adapter methods in analysis modules where direct symbol export/reference is API-compatible | Incremental cleanup without behavior change |
| P4-15 | P4 | IN_PROGRESS | Audit remaining adapter methods and replace only those with exact signature parity + existing behavioral coverage | Safer iterative cleanup |
| P4-16 | P4 | DONE | Final pass on adapter cleanup list from static scan; skip items with semantic/default-arg risk and document rationale | Controlled closure of wrapper-reduction phase |
| P4-17 | P4 | DONE | Close wrapper-reduction phase with a curated "do not simplify" list for risky adapters (defaults/semantic coupling) | Prevent unsafe over-refactors |
| P4-18 | P4 | IN_PROGRESS | Continue facade flattening by converting class wrappers to direct core re-exports where import paths remain stable | Incremental API-surface reduction |
| P4-19 | P4 | IN_PROGRESS | Extend facade flattening to namespace-style interpreter objects by extracting core logic into named functions plus compatibility aliases | Incremental readability cleanup |
| P4-20 | P4 | DONE | Continue interpreter facade flattening for remaining single-method namespace objects and document excluded cases with rationale | Controlled completion of interpreter wrapper pass |
| P4-21 | P4 | IN_PROGRESS | Flatten remaining low-risk interpreter namespace wrappers (`CheonganSignificance`, `RelationSignificance`, `OhaengPracticalGuide`) while preserving compatibility objects | Incremental cleanup with high test coverage |
| P4-22 | P4 | TODO | Complete interpreter wrapper pass by finishing `RelationSignificanceInterpreter` flattening and reassessing `OhaengPracticalGuide` refactor safety | Finish current cleanup lane |
| P4-23 | P4 | IN_PROGRESS | Continue analysis-facade cleanup by exposing direct alias symbols and reducing in-module self-references while keeping object APIs stable | Lower intra-module coupling |
| P4-24 | P4 | DONE | Expand direct alias exports to additional analysis modules (`GyeokgukDeterminer`, `HapHwaEvaluator`) after compatibility verification | Continue low-risk API flattening |
| P4-25 | P4 | IN_PROGRESS | Add direct alias exports for remaining safe evaluators and confirm no naming collisions in external imports | Incremental API flattening closure |
| P4-26 | P4 | DONE | Continue alias-export cleanup for trace/scorer modules and document exclusions where object grouping is semantically valuable | Extend low-risk cleanup lane |
| P4-27 | P4 | IN_PROGRESS | Add direct alias exports for remaining score/weight helpers and verify downstream import compatibility via targeted tests | Continue closure toward facade-minimized APIs |
| P4-28 | P4 | IN_PROGRESS | Continue direct alias exports in non-risky trace calculators and scorer helpers, then close current alias-export lane with exclusion notes | Controlled lane closure |
| P4-29 | P4 | TODO | Finalize alias-export lane by cataloging remaining intentional object-only modules and closing completed subtracks | Explicit closure for wrapper-minimization phase |
| P4-30 | P4 | DONE | Consolidate luck relation tables/flags by reusing shared catalogs and extracted `computeRelationFlags` policy in luck analyzers | Reduced duplication with behavior parity |
| P4-31 | P4 | DONE | Remove redundant engine-internal JSDoc boilerplate after helper/module extraction to keep implementation dense and navigable | Large LOC drop with no behavior change |

## Curated "Do Not Simplify" List (P4-17)

- `src/engine/SajuAnalysisPipeline.ts` `SajuAnalysisPipeline.analyze(...)`
  - Why: Encodes legacy entrypoint defaults and instance-bound config semantics; flattening can silently change constructor-time behavior.
- `src/engine/analysis/HiddenStemResolver.ts` `DefaultHiddenStemResolver.resolve/principalStem`
  - Why: Centralizes default `HiddenStemVariant`/`HiddenStemDayAllocation`; removing wrapper can leak defaults across call sites.
- `src/engine/analysis/ShinsalDetector.ts` `detectAllShinsal(...)`
  - Why: Uses explicit `null` sentinel grade semantics; collapsing into direct aliases obscures "all grades" intent.
- `src/interpretation/RuleConfidencePolicy.ts` `baselineAudit/strictCalculationAudit`
  - Why: Names encode policy-level intent (`baseline` vs `strict`) beyond boolean wiring; keep explicit policy surface.

## Completed Batches (2026-02-15 ~ 2026-02-16)

- DONE: Reduced LOC in `src/engine/analysis/StrengthScoringHelpers.ts` by collapsing duplicated scope/score branching (득지/득세/오행부조) into denser expression-based logic without changing scoring semantics.
- DONE: Reduced line/branch overhead in `src/interpretation/NarrativeOverallSynthesisHelpers.ts` by collapsing repeated method/category switch scaffolding into compact expression-based builders while preserving narrative output behavior.
- DONE: Further compacted `src/engine/analysis/YongshinDeciderStrategies.ts` by tightening `eokbuYongshin` branch construction and compressing JEONWANG rule catalog declarations while preserving outputs/tests.
- DONE: Reduced branching footprint in `src/engine/analysis/YongshinDeciderStrategies.ts` by compacting 통관 pattern definitions into key-driven rule tables and simplifying JEONWANG mode rule scaffolding without behavior changes.
- DONE: Reduced repetitive static-rule scaffolding in `src/engine/analysis/RelationInteractionRules.ts` by compacting interaction rule declarations into dense table entries while preserving existing interaction semantics.
- DONE: Externalized life-domain note dictionaries into `lifeDomainNoteCatalog.json` with a typed catalog accessor (`LifeDomainNoteCatalog.ts`) and removed repeated in-module note maps across career/health/love/wealth sections.
- DONE: Consolidated repeated recommendation object assembly and jeonwang mode-rule wiring in `src/engine/analysis/YongshinDeciderStrategies.ts` while preserving strategy outputs.
- DONE: Externalized interpretation static catalogs for 강약/오행 가이드/12운성/지지·천간 유의미성 into JSON data files and migrated six interpreters to typed data loaders, plus shared `PositionPairResolver` extraction to remove duplicate position-pair inference logic.
- DONE: Replaced `src/interpretation/shinsalGyeokgukSynergy/rules.ts` matcher-heavy rule logic with data-backed precomputed lookup table (`data.json`) and removed obsolete helper module; simplified synergy type coverage sets in `ShinsalGyeokgukSynergyMatrix.ts`.
- DONE: Externalized shinsal catalog payloads (`stem/branch/weight`) into JSON data resources and replaced in-code table literals with typed loader construction in `ShinsalCatalogStemTables`, `ShinsalCatalogBranchTables`, and `ShinsalWeightModel`.
- DONE: Centralized repeated narrative sentence-citation helper into `src/interpretation/NarrativeSentenceCite.ts` and removed duplicated `sentenceCite` implementations across narrative sections.
- DONE: Pruned `src/interpretation/NarrativeEngine.ts` to a minimal import set aligned with current section-based architecture, removing large dead dependency scaffolding.
- DONE: Normalized strict-unused baseline by removing unused imports/constants in solar/calendar and core analysis helpers (`Vsop87dFallback`, `GongmangCalculator`, `RelationInteractionResolver`, `SibiUnseongCalculator`, `NarrativeOverviewSection`), with full test pass.
- DONE: Consolidated Ohaeng label rendering into domain-level helper (`src/domain/Ohaeng.ts`) and removed duplicated per-file label switches across analysis/interpretation/pipeline modules.
- DONE: Refactored Gyeokguk formation routing to map-based assessor dispatch (`assessNaegyeok` + oegyeok assessor map) and centralized NOT_ASSESSED formation builder in shared utilities.
- DONE: Added shared luck-quality narrative maps (`src/interpretation/LuckQualityNarrative.ts`) and replaced repetitive quality switch branches in yearly/luck narrative builders.
- DONE: Added shared life-domain shinsal-note appender (`appendShinsalNotes`) and replaced repeated shinsal switch blocks in career/health/love/wealth sections.
- DONE: Flattened function-first APIs (with compatibility objects preserved) in `src/engine/GanjiCycle.ts`, `src/engine/luck/DaeunCalculator.ts`, `src/calendar/solar/JeolBoundaryTable.ts`, `src/engine/analysis/StrengthAnalyzer.ts`, and `src/engine/analysis/YongshinDecider.ts`.
- DONE: Executed safe `src/**/*.ts` comment de-noising pass that strips comment-only lines while preserving mixed comment+code lines; validated with full test suite.
- DONE: Extracted relation-analysis helper units in `src/engine/analysis/DefaultRelationAnalyzer.ts`.
- DONE: Extracted overlap/citation support helpers in `src/engine/analysis/RelationInteractionResolver.ts` and `src/engine/pipeline/TraceHelpers.ts`.
- DONE: Extracted boundary-day and warning helpers into `src/engine/pipeline/JeolBoundaryHelpers.ts` and `src/engine/luck/DaeunBoundaryHelpers.ts`.
- DONE: Isolated trace-confidence fallback logic in `src/engine/pipeline/TraceHelpers.ts`.
- DONE: Consolidated recommendation assembly in `src/engine/analysis/YongshinDecider.ts` via `pushRecommendation` and `resolveCategoryRecommendation`.
- DONE: Consolidated repeated pair/triple hit traversal in `src/engine/analysis/RelationAnalyzer.ts`.
- DONE: Converted `tongwanYongshin` in `src/engine/analysis/YongshinDeciderStrategies.ts` to declarative conflict-pattern evaluation.
- DONE: Introduced shared relation hit helpers in `src/engine/analysis/RelationHitHelpers.ts` and reused them from both relation analyzers.
- DONE: Merged relation lookup constants into `src/engine/analysis/RelationCatalog.ts` and reused them from both relation analyzers.
- DONE: Extracted shared relation-analysis core execution into `src/engine/analysis/RelationAnalyzerCore.ts` and delegated both analyzers to it.
- DONE: Reduced `src/engine/analysis/DefaultRelationAnalyzer.ts` to a compatibility wrapper extending `RelationAnalyzer`.
- DONE: Removed pass-through wrapper methods in `src/engine/analysis/YongshinDecider.ts` and exposed strategy functions directly.
- DONE: Replaced pass-through facade wrappers in `src/interpretation/NarrativeOverallSynthesis.ts` with direct re-exports from helpers.
- DONE: Split `jeonwangYongshin` element-resolution logic into `resolveJeonwangElements` to decouple element selection from reasoning text branches.
- DONE: Replaced `resolveJeonwangElements` switch duplication with table-driven transform rules (`JEONWANG_ELEMENT_RULES`) in `src/engine/analysis/YongshinDeciderStrategies.ts`.
- DONE: Replaced empty `DefaultRelationAnalyzer` inheritance wrapper with direct alias re-export to `RelationAnalyzer`.
- DONE: Simplified `src/engine/analysis/PalaceAnalyzer.ts` forwarding methods into direct function references and removed internal self-forwarding calls.
- DONE: Simplified forwarding methods in `src/engine/analysis/StrengthAnalyzer.ts` by exposing imported helper references directly.
- DONE: Replaced `LuckInteractionAnalyzer.determineLuckQuality` adapter with direct reference to `determineLuckQualityInternal`.
- DONE: Refactored `ShinsalDetector` to internal function references (`detectShinsal`/`detectAllShinsal`) instead of object self-forwarding.
- DONE: Simplified `RuleConfidencePolicy` baseline/strict audit adapters into direct function references.
- DONE: Reduced `src/engine/analysis/RelationAnalyzer.ts` to a direct re-export and moved class ownership to `src/engine/analysis/RelationAnalyzerCore.ts`.
- DONE: Flattened `src/interpretation/CompatibilityInterpreter.ts` by extracting `analyzeCompatibility` and keeping `CompatibilityInterpreter.analyze` as a direct alias.
- DONE: Flattened interpreter facades in `src/interpretation/IljuInterpreter.ts`, `src/interpretation/SipseongInterpreter.ts`, and `src/interpretation/SibiUnseongInterpreter.ts` by extracting named interpret functions and keeping compatibility aliases.
- DONE: Flattened `src/interpretation/StrengthInterpreter.ts` by extracting `interpretStrength` and keeping `StrengthInterpreter.interpret` as a direct alias.
- DONE: Added curated "do not simplify" list for risky adapters/default-coupled facades (P4-17 closure).
- DONE: Flattened `src/interpretation/CheonganSignificanceInterpreter.ts` by extracting `interpretCheonganSignificance` and keeping `CheonganSignificanceInterpreter.interpret` as a direct alias.
- DONE: Reduced self-referential calls in `src/engine/analysis/TenGodCalculator.ts` by introducing direct alias exports (`calculateTenGod*`) and reusing them internally.
- DONE: Exposed direct alias export `assessGyeokgukFormation` from `src/engine/analysis/GyeokgukFormationAssessor.ts` while preserving existing object API.
- DONE: Exposed direct alias exports `determineGyeokguk` and `monthBranchSipseong` from `src/engine/analysis/GyeokgukDeterminer.ts`.
- DONE: Exposed direct alias exports in `src/engine/analysis/HapHwaEvaluator.ts` and switched internal calls to alias symbols (`evaluateHapHwaPair`, adjacency/season helpers).
- DONE: Exposed direct alias exports in `src/engine/analysis/ShinsalWeightModel.ts` and reduced in-module self-references in weighting flow.
- DONE: Exposed direct alias exports in `src/engine/analysis/InteractionScoreModel.ts` for both jiji/cheongan scorers and reduced `scoreAll` self-reference usage.
- DONE: Exposed direct alias exports for all trace entrypoints in `src/engine/trace/TraceAwarePillarCalculator.ts`.
- DONE: Added parallel 6-lane reduction survey artifacts in `docs/refactor/PARALLEL_REDUCTION_SURVEY.md` and `docs/refactor/lanes/` for pre-refactor planning.
- DONE: Added full tracked-file 6-lane analysis artifacts in `docs/refactor/PARALLEL_FULLSCAN_6LANE.md` and `docs/refactor/lanes/fullscan-lane*.md` to quantify reducible-LOC targets before next refactor batches.
- DONE: Added 6-lane rescan artifacts in `docs/refactor/PARALLEL_REDUCTION_RESCAN_6LANE.md` and `docs/refactor/lanes/rescan-lane*.md` with updated post-refactor reduction estimates and prioritized next tracks.
- DONE: Re-ran 6-lane parallel reduction scan on the current tree (`18,479` lines) and updated `docs/refactor/PARALLEL_REDUCTION_RESCAN_6LANE.md` with refreshed lane estimates and "no single 1k+ low-risk lane" verdict.
- DONE: Compacted `src/calendar/solar/JeolBoundaryData.ts` into packed per-year representation and reconstructed deterministic month metadata at load-time (behavior preserved, full test pass).
- DONE: Split packed jeol boundary payload into `src/calendar/solar/JeolBoundaryPackedData.ts` and kept `src/calendar/solar/JeolBoundaryData.ts` logic-only expansion/validation.
- DONE: Compacted `src/calendar/lunar/KoreanLunarYearData.ts` data layout to a dense array format with identical values (behavior preserved, full test pass).
- DONE: Compacted `src/calendar/solar/Vsop87dTerms.ts` to packed flat series with validated runtime expansion while preserving exact term order/values.
- DONE: Split `src/calendar/solar/Vsop87dTerms.ts` into logic-only expansion and data-only packed table module `src/calendar/solar/Vsop87dTermsData.ts`.
- DONE: Compacted `src/interpretation/RuleCitationSentenceRegistryData.ts` entries into helper-based single-line data rows.
- DONE: Compacted `src/interpretation/RuleCitationTraceRegistryData.ts` entries into helper-based single-line data rows.
- DONE: Reduced `src` total lines from `24,243` baseline to `22,177` (`-2,066`) while keeping all tests passing.
- DONE: Reduced `src` total lines further to `20,377` (`-3,866` vs baseline) while keeping all tests passing.
- DONE: Recomputed tracked `src` LOC with git-object + working-tree diff accounting: `19,904` (`-4,339` vs baseline `24,243`).
- DONE: Reduced tracked `src` LOC further to `19,757` (`-4,486` vs baseline `24,243`) after jeol payload module split/compaction.
- DONE: Simplified `src/config/CalculationConfig.ts` by collapsing sectioned default-merge scaffolding into a single canonical `DEFAULT_CONFIG` object with direct override spread.
- DONE: Reduced tracked `src` LOC further to `19,716` (`-4,527` vs baseline `24,243`) after config-default simplification.
- DONE: Refactored `src/interpretation/IljuInterpretationCatalog.ts` from repeated `add(...)` calls into typed tuple-table registration (`ILJU_ENTRIES` + loop) while preserving catalog content.
- DONE: Refactored `src/interpretation/SipseongInterpretationCatalog.ts` from repeated `put(...)` calls into typed tuple-table registration (`SIPSEONG_ENTRIES` + loop) while preserving catalog content.
- DONE: Reduced tracked `src` LOC further to `19,106` (`-5,137` vs baseline `24,243`) after interpretation-catalog compaction.
- DONE: Refactored `src/engine/analysis/PalaceCatalogData.ts` interpretation map literals into typed tuple rows (`PALACE_INTERPRETATION_ROWS`) with generated map construction while preserving all entries.
- DONE: Reduced tracked `src` LOC further to `18,989` (`-5,254` vs baseline `24,243`) after palace-catalog table compaction.
- DONE: Reduced duplicate comparison scaffolding in `src/config/ConfigDocumentation.ts` by introducing key-based `checkKey(...)` and collapsing 23 repetitive `check(...)` call sites.
- DONE: Reduced tracked `src` LOC further to `18,946` (`-5,297` vs baseline `24,243`) after config-diff scaffolding compaction.
- DONE: Refactored `src/config/ConfigDocumentationOptions.ts` from repeated object literals to typed tuple rows (`CONFIG_OPTION_ROWS`) plus mapper construction while preserving all option values and descriptions.
- DONE: Reduced tracked `src` LOC further to `18,774` (`-5,469` vs baseline `24,243`) after config-option catalogue compaction.
- DONE: Refactored `src/interpretation/CheonganSignificanceInterpreter.ts` meaning registration from repeated `TABLE.set(...)` blocks to typed row-driven map construction (`MEANING_ROWS`) with identical domain/meaning payloads.
- DONE: Reduced tracked `src` LOC further to `18,735` (`-5,508` vs baseline `24,243`) after cheongan-significance table compaction.
- DONE: Refactored `src/interpretation/RelationSignificanceData.ts` relation-significance map literals into typed tuple rows (`RELATION_MEANING_ROWS`) with generated map construction while preserving all entries.
- DONE: Reduced tracked `src` LOC further to `18,599` (`-5,644` vs baseline `24,243`) after relation-significance table compaction.
- DONE: Refactored `src/interpretation/shinsalGyeokgukSynergy/rules.ts` from a large `switch`/`if` chain into matcher-driven rule tables (`SHINSAL_GYEOKGUK_SYNERGY_RULES`) with shared condition builders while preserving all 68 narratives.
- DONE: Reduced tracked `src` LOC further to `18,557` (`-5,686` vs baseline `24,243`) after shinsal-gyeokguk synergy rule-table compaction.
- DONE: Refactored repeated recommendation lookups in `src/engine/analysis/YongshinDecisionSupport.ts` by indexing `recommendations` once and applying tier-1 override rules via declarative tuple mapping while preserving tie-break behavior.
- DONE: Reduced tracked `src` LOC further to `18,556` (`-5,687` vs baseline `24,243`) after yongshin decision-lookup cleanup.
- DONE: Further compacted `src/engine/analysis/YongshinDecisionSupport.ts` by simplifying secondary-candidate resolution (`resolveHeesin`) and tightening map population/override flow while preserving semantics.
- DONE: Reduced tracked `src` LOC further to `18,550` (`-5,693` vs baseline `24,243`) after yongshin decision-support cleanup pass.
- DONE: Recomputed tracked `src` snapshot at `18,479` lines (`-5,764` vs baseline `24,243`) before next architecture-scale reductions.
- DONE: Converted imperative push-chain checks in `src/engine/analysis/GyeokgukFormationNaegyeokAssessors.ts` to shared `collectMessages(...)` rule evaluation pattern.
- DONE: Consolidated duplicated stem/branch relation collection paths in `src/engine/luck/LuckInteractionAnalyzerHelpers.ts` via shared helpers (`natalStems`/`natalBranches`, `appendUniqueNote`, `cheonganPairNotes`) and reused them in both detection and daeun-merge flows.
- DONE: Simplified `src/engine/pipeline/SajuAnalysisAssembler.ts` by removing indirection-heavy selector registry and switching to direct context mapping for both `analysisResults` mappers and final `SajuAnalysis` assembly.
- DONE: Refactored `src/engine/luck/LuckInteractionAnalyzerHelpers.ts` to reuse shared relation catalogs (`RelationCatalog`) and extracted relation-flag policy (`computeRelationFlags`) instead of duplicated in-file tables/branch scans.
- DONE: Refactored `src/engine/luck/LuckInteractionAnalyzer.ts` to function-based core entrypoints with shared relation-flag computation and reduced adapter indirection.
- DONE: Removed redundant engine-internal JSDoc boilerplate across `src/engine` (`37` files), preserving runtime behavior while reducing maintenance noise.
- DONE: Reduced `src` LOC to `17,130` (from prior `18,443`, `-1,313` in current batch; `pnpm lint` + full test suite green).
- DONE: Completed declarative rule-catalog migration for `GyeokgukFormationNaegyeokAssessors`/`GyeokgukFormationOegyeokAssessors` via shared evaluator DSL, simplified `GyeokgukFormationProfile` counting logic, and removed redundant grade-specific shinsal wrapper exports.
- DONE: All completed batches verified by `pnpm lint`, targeted tests, and full `pnpm test` pass.

## Execution Rules

- For every batch:
  - run `pnpm lint`
  - run targeted tests for touched domain
  - run full `pnpm test`
- Keep behavior identical unless explicitly marked as intentional change.
- Prefer smaller commits with reversible, test-verified steps.
