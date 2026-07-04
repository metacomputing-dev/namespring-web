# 생성 파이프라인 — no-sharing 케이스별 페어링 완결글

> 각 "분기된 최종 단일 경우"마다 **한 편의 완결글**(요약 ↔ 세부 3~4문단 ↔ 전문가 근거/태그)을
> 병렬 OPUS 사주명리+성명학 전문가가 생성한다. 평문 tier와 전문가 tier는 **괴리 0의 짝**이다.
> 아키텍처 배경: [PLAN_PERSONALIZATION_PLAIN.md](./PLAN_PERSONALIZATION_PLAIN.md).

## 1. 경우의 수 (열거 완료)

- **총 13,365 케이스** = 330 기본 셀 × 개인 분기.
  - 성인 셀(band high/mid/low): **강약(5) × 용신오행(5) × 이름보완(3) = 75/셀** → 165셀 × 75 = 12,375
  - 미성년/생애 셀(band any): **강약(3) × 이름보완(2) = 6/셀**(용신=슬롯) → 165셀 × 6 = 990
- 각 케이스 = `data/generation/manifest/<category>.manifest.jsonl`의 한 줄. 좌표 + 생성 스펙(강약·용신·이름보완·조언방향·안전·권장태그).

> 분기 축은 조정 가능하다(generate-manifest.ts 상단 상수). 더 촘촘히(격국19·부족오행·사격 추가) 하면
> 케이스 수가 커지고, 성긴 축(용신을 슬롯화)이면 작아진다. **no-sharing 원칙**: 각 최종 경우 = 자기 완결글.

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

## 4. 실행 (전체 13,365 = 배치 ~17회)

```bash
# 1) 매니페스트(1회)
npx tsx tools/generation/generate-manifest.ts

# 2) 카테고리별 배치 준비 (예: wealth 0~800)
npx tsx tools/generation/prepare-batch.ts wealth 0 800
#    또는 특정 케이스: --ids=<caseId>,<caseId>

# 3) 생성 (Workflow, args = 배치 JSON). 에이전트 상한 1000/워크플로 → 배치 ≤ ~800.
#    Workflow({ scriptPath: "tools/generation/run-batch.wf.js", args: <batch.json 내용> })
#    반환 { generated:[{caseId, article}] } 를 results.json 으로 저장.

# 4) 수집·검증→저장
npx tsx tools/generation/ingest-batch.ts <results.json>
#    리젝된 케이스는 재생성(3으로).
```

## 5. 런타임 배관 (후속)

`data/generated/<category>/<caseId>.json`을 `article-registry`가 로드하고, `article-selector`가
사람의 실측 (강약·용신·이름보완) 버킷으로 caseId를 조립해 픽하도록 확장한다(현재 selector는
(category,period,audience,band)까지만 픽 — `caseAxes` 3축 추가가 다음 배관 작업).

## 6. 불변 가드 (매 배치)

- 검증기 통과분만 저장(괴리0·분량·평문·태그·미성년·의료어).
- 런타임 재작성 없음(WYSIWYG) — 생성은 오프라인, 저장은 완결글 그대로.
- NO_AI_POLICY: `aiGenerated:true` 마킹.
