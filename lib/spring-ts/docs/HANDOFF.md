# HANDOFF — 새 세션(Claude Code / Codex GPT-5.5) 재개 안내

> 이 문서 하나 + 아래 "먼저 읽기" 파일들로 어느 에이전트든 정확히 이어서 시작할 수 있게 자기완결로 씀.
> repo 내부 문서다(Claude의 `~/.claude` 메모리는 Codex가 못 봄 — 그래서 여기 다 적음). 2026-07-04.

## 0. TL;DR

- 제품: 한국 **사주명리 + 성명학** 유료 운세 리포트(namespring). branch `claude/tiered-article-rewrite`(PR #648).
- 지금 하는 일: 사람마다 다른 **완결글 한 편**을, "근접중복 군집화(등가 클래스)"로 축소한 **21,060 클래스**로 미리
  생성해 두고, 런타임 κ 매핑으로 프론트 무변경으로 서비스한다. 평문(사용자)↔전문가(근거) **괴리 0 페어링**.
- **현재 상태: 48 / 21,060 클래스 생성 완료**(romance 카테고리의 life/adult/high/weak 셀 슬라이스). **21,012 남음.**
- 남은 일 = 나머지 클래스 생성(카테고리 단위 병렬 가능) + 소수 인프라 후속(§8).

## 1. 먼저 읽기 (이 순서)

1. `docs/HANDOFF.md` (이 문서)
2. `docs/REDUCTION_FORMULA.md` — 축소 수식(F→K, role(x)∈{class,slot,callout}, |K|).
3. `docs/GENERATION_PIPELINE.md` — 생성 파이프라인 실행법.
4. `tools/generation/pairing-contract.md` — 평문↔전문가 괴리 0 규칙(생성 품질의 계약).
5. `docs/ARTICLE_STYLE_CONTRACT.md` + `docs/PLAN_PERSONALIZATION_PLAIN.md` — 문체·평문 원칙.
6. 골든 샘플 1편: `data/generated/romance/romance.life.adult.high.weak.inseong.boost_strong.male.json` — 목표 품질.

## 2. 아키텍처 60초

- **축소 수식**: 전체 케이스공간 F(모든 사주/성명학 축) → 등가 클래스 K(저작 단위). 각 축 x는
  `role`: 조언 방향/구조가 바뀌면 **class**, 단어(오행명·대명사)만 바뀌면 **slot**, 희소·유무형이면 **callout**.
- **클래스 축**(K): 기본셀(category·period·audience·band) × 강약coarse(3) × 격국family(6) × nameEffect(4) ×
  성별(romance/family/career만 ×2). `nameEffect ∈ {boost_strong, boost_mild, neutral, adverse}` — 자원오행이
  사주에 합산된 combinedDistribution의 **부호**(용신 채움=좋은 이름 vs 기신 역효과=**해로운 이름**). adverse면 "채워준다" 금지.
- **런타임 κ**: `src/report/tiered/class-axes.ts:computeClassId(cell, feature, sajuCompat)` → classId. 없으면 null→base 폴백.
  `build-tiered-matrix.ts` buildCell이 **생성 클래스 글 우선 → 없으면 base**. 출력 shape 동일 → 프론트(`namespring/src/CombiedNamingReport.jsx`) 무변경.

## 3. 현재 상태 (사실)

| 항목 | 값 |
|---|---|
| 매니페스트 | `data/generation/manifest/*.jsonl` = **21,060 클래스** (index.json). 11카테고리(8×1620 + romance/family/career 2700). |
| 생성 완료 | **48** (romance/…/high/weak 슬라이스). `data/generated/romance/`. |
| 남은 | **21,012** (11카테고리, romance 잔여 2652 포함). |
| 테스트 | `test:tiered-*` + `bench:tiered` 그린. 신규 `test:tiered-class-axes`. |
| 파이프라인 도구 | `tools/generation/` 전부 커밋됨(§4). |

## 4. 파이프라인 (모델 무관 도구 + 생성 스텝만 모델별)

| 파일 | 역할 | 모델 무관? |
|---|---|---|
| `tools/generation/generate-manifest.ts` | 클래스 열거→매니페스트 | ✅ (이미 실행됨) |
| `tools/generation/prepare-batch.ts` | 매니페스트→프롬프트 배치 | ✅ |
| `tools/generation/expert-prompt.ts` | 케이스→OPUS/GPT 프롬프트 + 출력 스키마 | ✅ (프롬프트 텍스트) |
| `tools/generation/validate-generated.ts` | 페어링·분량·정직성 검증 | ✅ |
| `tools/generation/ingest-batch.ts` | 검증→`data/generated/<cat>/<classId>.json` 저장 | ✅ |
| `tools/generation/run-fileread.wf.js` | **Claude Workflow 전용** fan-out 하네스 | ❌ Claude만 |

**핵심**: 생성(케이스 프롬프트 → 아티클 JSON)만 모델이 하고, 나머지(prepare/validate/ingest)는 순수 Node라 공용.

### 4.1 Claude Code 생성 루프 (Workflow)
```bash
npx tsx tools/generation/prepare-batch.ts <category> <start> <count>   # ≤800/배치
# Workflow({ scriptPath:".../run-fileread.wf.js",
#   args:{ batchFile:"lib/spring-ts/data/generation/batches/<name>.batch.json",
#          caseIds:[...], schema:<ARTICLE_OUTPUT_SCHEMA from batch> } })
# 반환 result.generated → results.json 저장 후:
npx tsx tools/generation/ingest-batch.ts <results.json>
```

### 4.2 Codex / GPT-5.5 생성 루프 (Workflow 없이)
Codex는 `run-fileread.wf.js`를 못 쓴다. 대신:
```
1) npx tsx tools/generation/prepare-batch.ts <category> <start> <count>
2) 배치 파일 items[].prompt 각각을 GPT-5.5에 넣어 아티클 JSON을 받는다
   (StructuredOutput/JSON 모드로 { summary, hook?, body[], expert[], livingTips[], cautions[] }).
   반드시 pairing-contract.md 규칙 준수(평문 용어 금지, nameEffect 정직성, 해요체, hook ≤24).
3) 결과를 { "generated":[ {"caseId":..., "article":{...}}, ... ] } 로 모아 results.json 작성
4) npx tsx tools/generation/ingest-batch.ts <results.json>   # 검증·저장, 리젝은 재생성
```
검증기가 품질을 동일하게 게이팅하므로 두 모델 산출이 정합적으로 수렴한다.

## 5. Claude ↔ Codex 분업 (겹침 0)

**원리: 카테고리는 서로 다른 `data/generated/<category>/` 에만 쓴다 → 파일 충돌 물리적으로 불가.**
공유 도구(`tools/generation/*`, `src/report/tiered/*`)는 **동결**. 변경은 Claude만(한 소유자), Codex는 필요 시 플래그.

### 소유권 표 (클래스 수 균형, 조정 가능)
| 소유 | 카테고리 | 클래스 |
|---|---|---|
| **Claude** | romance(2700, 48완료→2652), family(2700), career(2700), overall(1620) | ~9,672 |
| **Codex(GPT-5.5)** | wealth, health, academic, study_document, expression_children, health_stress, movement | 7×1620 = 11,340 |

> 성별민감 3분야(romance/family/career)는 Claude가 소유(romance 골든 샘플 있어 문체 일관성 유리).

### git 전략 (동시 push 경쟁 회피)
- 각자 **자기 브랜치**: `gen/claude-<cat>`, `gen/codex-<cat>`. 산출 경로가 disjoint라 PR 브랜치로 **머지 시 충돌 0**(자동).
- 공유 도구 변경은 PR 브랜치에서 Claude가 하고, Codex는 시작 전 `git pull` 로 최신 도구 확보.
- 정기적으로(카테고리 끝날 때마다) PR 브랜치로 머지.

### 내 의견 (분업 타당성)
- **타당하다.** 생성은 카테고리 단위로 완전 병렬 + disjoint 출력이라 GPT 유휴자원 활용에 이상적. 검증기가 품질을
  공통 게이팅해 문체 divergence를 억제한다.
- 주의 2가지: ① **공유 도구 동결**(둘이 동시에 expert-prompt/validate 고치면 산출 정합 깨짐). ② Codex는 골든
  샘플(§1.6)과 pairing-contract를 **반드시 먼저 정독**해야 품질이 romance 수준으로 수렴한다.
- 인프라 후속(§8)은 Codex가 한 레인으로 맡아도 좋다(생성과 파일 겹침 없음).

## 6. 시작 전 자기검증 (fresh 에이전트 필수)
```bash
cd lib/spring-ts
npm run typecheck && npm run test:tiered-class-axes && npm run test:tiered-shape && npm run bench:tiered  # 전부 그린?
npx tsx tools/generation/prepare-batch.ts wealth 0 2      # 배치 2건 생성되나?
# 위 2건을 생성→ingest 해보고 data/generated/wealth/ 에 파일 2개 뜨면 파이프라인 OK.
```

## 7. 함정(Gotchas) — 새 세션이 재발견하지 말 것
- **Workflow args는 문자열로 전달됨** → 하네스에서 `JSON.parse`. (run-fileread.wf.js에 반영됨.)
- **expert-prompt.ts는 템플릿 리터럴** → 프롬프트 텍스트에 백틱(`) 넣지 말 것(빌드 깨짐).
- **정직성 검증은 관대하게 설계**: nameEffect neutral/adverse의 "채워주지 않는다"류 부정문을 위반으로 오탐하지
  않도록 문장단위+넓은 부정마커. 에이전트는 대개 정직하게 씀(오탐이 진짜 위반보다 많았음).
- hook은 **선택·≤24자**(넘으면 생략). 모든 문장 **해요체**. 슬롯 조사는 `{{yongshinName:을를}}`(조사만 슬롯 금지).
- ingest 전 `git checkout`으로 metrics/*.json 부작용 되돌리기(일부 test side-effect).

## 8. 인프라 후속 (생성과 별개, 겹침 없음 — Codex 레인 후보)
- 브라우저용 생성물 lazy-load(현재 `generated-registry.ts`는 node만; 브라우저는 null→폴백).
- 실제 갭(감사): **12운성 라벨**(일간×12지지 고정표, 트리비얼), 왕상휴수사 5분류, 삼재. `data/generated`와 무관.
- κ 튜닝: 용신을 건강·재물에선 slot→class 승격 검토(발산/온기 등 오행별 이미지 중요 시).

## 9. 불변 가드레일 (누구도 깨지 말 것)
- 런타임 재작성 없음(WYSIWYG) · 런타임 LLM 없음(생성은 오프라인, `aiGenerated:true`) · 평문 tier 사주용어 금지 ·
  절대 사주상태 단정 금지 · 요약↔본문↔전문가 pairing · nameEffect 정직성(adverse/neutral은 "채워준다" 금지) · 미성년 안전 · 의료어 금지.
- 매 배치 `ingest-batch` 검증 통과분만 저장. 리젝은 재생성.
