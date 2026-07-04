# 생성 파이프라인 — no-sharing 케이스별 페어링 완결글

> 각 "분기된 최종 단일 경우"마다 **한 편의 완결글**(요약 ↔ 세부 3~4문단 ↔ 전문가 근거/태그)을
> 병렬 OPUS 사주명리+성명학 전문가가 생성한다. 평문 tier와 전문가 tier는 **괴리 0의 짝**이다.
> 아키텍처 배경: [PLAN_PERSONALIZATION_PLAIN.md](./PLAN_PERSONALIZATION_PLAIN.md).

## 1. 경우의 수 (v2 — 축소 수식 반영, 열거 완료)

축소 전략 수식: [REDUCTION_FORMULA.md](./REDUCTION_FORMULA.md). 모든 차원은 **매핑**에서 고려하되
**저작은 등가 클래스만**. 클래스 축 = 기본셀(category·period·audience·band) × 강약coarse(3) ×
격국family(6) × nameEffect(4, 자원오행 통합의 부호 포함) × 성별(romance·family·career만 ×2).

- **총 21,060 클래스** (v2). 카테고리당 1,620 / 성별민감 3분야는 2,700.
- 각 클래스 = `data/generation/manifest/<category>.manifest.jsonl` 한 줄: 좌표 + 스펙(강약·격국·nameEffect·성별·조언방향·안전·태그).
- **nameEffect**가 감사 핵심 반영: `boost_strong/boost_mild/neutral/adverse` — 자원오행이 용신을 채우는지(좋은 이름) vs 기신을 키우는지(**해로운 이름**)를 구분. adverse면 "채워 준다" 금지(정직성).

> 슬롯(런타임): 용신오행명·일간·계절·성별대명사. 콜아웃: 신살·사격·12운성(후속).

## 2. 데이터 구조 (durable)

```
data/generation/manifest/<category>.manifest.jsonl   # 케이스 열거(입력)
data/generation/manifest/index.json                  # 카운트·축 정의
data/generation/batches/<name>.batch.json            # {schema, items:[{caseId, prompt}]} (transient)
data/generated/<category>/<caseId>.json              # 검증 통과 완결글(출력)
```

## 3. 파이프라인 (파일)

| 단계 | 파일 | 역할 |
|---|---|---|
| 열거 | `tools/generation/generate-manifest.ts` | 매니페스트 생성 |
| 스키마 | `tools/generation/case-schema.ts` | Case / GenerationSpec 타입 |
| 계약 | `tools/generation/pairing-contract.md` | 평문↔전문가 괴리0 규칙 |
| 프롬프트 | `tools/generation/expert-prompt.ts` | 케이스→OPUS 전문가 프롬프트 + 출력 스키마 |
| 배치 | `tools/generation/prepare-batch.ts` | 매니페스트 범위→프롬프트 배치 |
| 생성 | `tools/generation/run-batch.wf.js` | Workflow: 병렬 OPUS 전문가 fan-out(schema 강제) |
| 수집·검증 | `tools/generation/ingest-batch.ts` | 케이스 정합 검증→통과분 저장 |
| 검증기 | `tools/generation/validate-generated.ts` | 분량·해요체·평문·태그 + 강약/용신/이름보완 방향 정합 |

## 4. 실행 (전체 21,060 = 배치 ~30회, 배치당 ≤800)

```bash
# 1) 매니페스트 v2(1회)
npx tsx tools/generation/generate-manifest.ts

# 2) 카테고리별 배치 준비 (프롬프트까지 빌드)
npx tsx tools/generation/prepare-batch.ts romance 0 800   # 또는 --ids=a,b,c

# 3) 생성 (Workflow, 파일-read 하네스). 에이전트가 배치 파일을 직접 읽으므로 args는 작음.
#    Workflow({ scriptPath: ".../run-fileread.wf.js",
#      args: { batchFile:"lib/spring-ts/data/generation/batches/<name>.batch.json",
#              caseIds:[...], schema:<ARTICLE_OUTPUT_SCHEMA> } })
#    ⚠ args는 문자열로 전달됨 → 하네스가 JSON.parse 처리(내장). 상한 1000/워크플로 → 배치 ≤ ~800.
#    반환 { generated:[{caseId, article}] } 를 results.json 으로 저장.

# 4) 수집·검증→저장 (페어링·nameEffect 부호 정합 검사)
npx tsx tools/generation/ingest-batch.ts <results.json>
#    리젝된 케이스는 재생성(3으로).
```

> 하네스 2종: `run-fileread.wf.js`(권장, args 작음·대량) / `run-batch.wf.js`(args에 프롬프트 인라인).

## 5. 런타임 배관 (후속)

`data/generated/<category>/<caseId>.json`을 `article-registry`가 로드하고, `article-selector`가
사람의 실측 (강약·용신·이름보완) 버킷으로 caseId를 조립해 픽하도록 확장한다(현재 selector는
(category,period,audience,band)까지만 픽 — `caseAxes` 3축 추가가 다음 배관 작업).

## 6. 불변 가드 (매 배치)

- 검증기 통과분만 저장(괴리0·분량·평문·태그·미성년·의료어).
- 런타임 재작성 없음(WYSIWYG) — 생성은 오프라인, 저장은 완결글 그대로.
- NO_AI_POLICY: `aiGenerated:true` 마킹.
