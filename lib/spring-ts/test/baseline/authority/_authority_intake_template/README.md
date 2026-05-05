# Reference A Authority Intake Template

> 작성: 2026-05-05 (Phase 3 A18 default path)
> 목적: 책 자료 (사주첩경 / 적천수 / 박재완 명리실관·요강 / 명리존험) 입수 시 즉시 ingestion 시작할 수 있는 schema-conformant template + 운영 절차.

## 1. 입수 우선순위 (NEXT_STEPS_ROADMAP §K 인용)

1. **이석영 사주첩경 6권** — L-1/L-6 verification + 추가 case
2. **적천수 천미 (임철초 註)** — 종격 doctrine cross-reference
3. **박재완 명리실관/요강** — 한국 modern 권위 case
4. **강헌 명리 심화편** — 추가 사례 (paid 자료)
5. **명리존험** — classical 종합 분석 (현재 1/6 PASS)

## 2. Ingestion 절차 (책 한 권 기준)

### Step 1. case 추출
- 책의 chart sample을 발췌 — 8글자 (4 pillar)
- 책이 명시하는 expected (yongshin / strength / gyeokguk / commentary)
- chart 샘플을 spring-ts의 `getSajuReport()` 입력으로 변환

### Step 2. paraphrase + metadata 작성
- 본 디렉토리의 `template.flat-case.json` 복사 → `<author>_<book>_<case-id>.json`
- 다음 필드 채우기:
  - `case_id`: e.g., `yi_seokyoung_chumyeongga_v6_p123_case01`
  - `source.text`: book title (e.g., `사주첩경 6권`)
  - `source.author`: 저자 (e.g., `이석영`)
  - `source.page`: 정확한 페이지 (e.g., `123`)
  - `source.category`: `chart_sample` / `theory_chapter` / `case_study`
  - `expected.yongshinElement`: WOOD/FIRE/EARTH/METAL/WATER
  - `expected.strengthLevel`: 신강/신약/중화/극신강/극신약
  - `expected.summary50char`: 책의 결론 paraphrase (≤50 한글)
  - `narrative.charsPerClaim`, `narrative.evidenceRowsPerClaim`, `narrative.counterexampleCountPerCard`
  - `hedge.shouldHedge` + `hedge.reason`
  - `sourceTier.tier`: `T3_AUTHORED_INTERPRETATION` (modern 책 — 사주첩경/박재완 등) 또는 `T4_PRIMARY_TEXT` (public-domain classical — 명리존험 등 직접 발췌). **T2/T1/T0 는 authority truth 자격 없음** (ci:no-ai-policy 가 차단)
  - `sourceTier.sourceType`: `book` (NOT `training_derived`)
  - `sourceTier.authorityTruthEligible`: `true` (책 인용이라면)
  - `sourceTier.quoteShort`: ≤80 한글 paraphrase (verbatim 금지)
  - `copyrightNote`: 저작권 안내 array (≥1 entry)

### Step 3. validation
```bash
npm run validate:reference-authority
```
모든 violation 0이면 통과. violation 있으면 schema 위반 — 수정.

### Step 4. quality_gate 통합
- 책 case 1개 이상 들어오면 `service:readiness:paid-gate` blocker 일부 해소
- D2/D4 quality dimension 자동 활성화

## 3. 저작권 안전 정책

- **verbatim quote 절대 금지** — `validate_reference_authority_cases.mjs`의 `PROHIBITED_PROSE_KEYS` 검사
- `sourceTier.quoteShort` 는 **paraphrase**, ≤80 한글 (현재 기본 제한 없으나 안전선)
- `expected.summary50char` ≤50 한글
- 책 원문 텍스트는 어디에도 저장 금지 (`originaltext`, `verbatim`, `fulltext`, `sourceprose` 등 키 차단)
- `copyrightNote` 에 항상 인용 fair-use 명시

## 4. paid_gate 해소까지의 path

현재 (2026-05-05):
- `flatCaseCount`: 0
- `authorityTruthEligibleCaseCount`: 0
- `service:readiness commercialReadiness`: blocked

목표:
- 책 case 6+ 입수 → `authorityTruthEligibleCaseCount` ≥ 6
- `paid-gate` 의 `--max-zero-authority-cells=0` 통과 위해선 165 cell 모두 authority backing 필요 (장기)
- 단기 목표: 165 중 P0_EXPERT_INTERNAL_EVIDENCE_REVIEW 5개 cell 부터 cover

## 5. 본 디렉토리의 파일

- `README.md` (this file)
- `template.flat-case.json` — schema-conformant template (validate:reference-authority validator가 기대하는 모든 field 포함)
- `EXAMPLE_yi_seokyoung_chumyeongga_p001_template.json` — 가상 사례 (실제 책 자료 없이 schema 시연용)

## 6. 본 디렉토리의 위치

`test/baseline/authority/_authority_intake_template/` — `_` prefix 는 검증 대상에서 제외 (validator가 flat JSON만 검사하며 subdirectory는 무시).

## 7. 책 자료 입수 시 첫 PR 가이드

```bash
# 1. 새 case 파일 생성
cp test/baseline/authority/_authority_intake_template/template.flat-case.json \
   test/baseline/authority/yi_seokyoung_chumyeongga_p123_case01.json
# 2. 필드 채우기 (위 §2 참조)
# 3. 검증
npm run validate:reference-authority
# 4. service readiness 확인
npm run service:readiness
npm run service:readiness:paid-gate
# 5. PR 발행
git checkout -b phase4/authority-intake-yi-seokyoung-001
git add test/baseline/authority/yi_seokyoung_chumyeongga_p123_case01.json
git commit -m "auth: ingest 사주첩경 case (이석영, p123)"
gh pr create
```
