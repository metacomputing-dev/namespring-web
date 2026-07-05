# S3+ 연속 실행 플레이북 — 누가 이어받아도 같은 품질로

> 2026-07-05 작성. **S3부터는 API 크레딧 대신 Claude Code 세션 에이전트로 생성한다**(사용자 결정).
> 이 문서는 실행 주체가 바뀌어도(Fable 5 → Opus 4.8 → Codex) 톤앤매너와 평문↔전문가 페어링이
> 끊기지 않게 하기 위한 단독 실행 가능 지침이다. 전체 맥락·진행 상태는
> [PLAN_PR1_GENERATED_TEXT_QUALITY.md](./PLAN_PR1_GENERATED_TEXT_QUALITY.md) §9가 진실 소스.

## 0. 불변 원칙 (모든 실행 주체 공통 — 위반 금지)

1. **생성 주체가 누구든 게이트는 같다.** 모든 산출물은 `ingest-bundles.ts`를 통과해야만 저장된다.
   게이트를 우회하거나 완화하지 말 것. 템플릿 스탬핑으로 채우는 것은 절대 금지(게이트가 막지만
   시도 자체 금지 — 2026-07-04 corpus 전체가 그렇게 오염됐던 전례).
2. **프롬프트가 곧 톤앤매너 계약이다.** `bundle-prompt.ts`가 생성하는 번들 프롬프트에 문체·분량·
   페어링·다양성 규칙 전부가 리터럴하게 들어 있다. **프롬프트를 수정하지 말고 그대로 쓸 것**
   (5회 반복 개선으로 통과율 80.6→94.9%까지 끌어올린 결과물이다).
3. **스타일 기준 = 일상 밀착형** (사용자 확정): 구체 생활 장면("뭐 먹었는지 묻기", "영수증 훑기"),
   신선한 비유("배가 흔들릴 땐 돛을 접고"), 해요체. 격조를 높이는 방향 수정 금지.
4. **정독 의무**: 카테고리당 최소 3번들을 사람(모델)이 직접 읽고 판정 기록. 테스트 통과 ≠ 승인.
5. 커밋은 `git add lib/spring-ts/data/generated/` 경로 명시로만 (`git add -A` 금지).

## 1. 남은 작업 (S3, 우선순위 순서 고정)

**romance(252번들) → family(252번들) → academic(178번들)** — 사용자 지정 순서.
각 카테고리 = prepare → 생성 → ingest → 리젝 재생성 1~2회 → 정독 → 커밋.
(career 등 미노출 5분야는 보류 확정 — 착수 금지.)

## 2. 실행 모드 (우선순위 체인)

### 모드 A — Claude Code 세션 + Fable 5 에이전트 (기본)

```bash
cd lib/spring-ts
# 1) 번들 준비 + 에이전트별 개별 파일로 분할 (대형 배치 파일은 Read 한도 초과!)
npx tsx tools/generation/prepare-bundles.ts romance --offset 0 --count 24
node tools/generation/split-batch.mjs data/generation/batches/bundles-romance-0-24.batch.json
#    → itemsDir 경로 + bundleKeys 출력됨

# 2) Workflow 도구 호출 (Claude Code 세션 안에서):
#    Workflow({ scriptPath: "<abs>/lib/spring-ts/tools/generation/run-bundles.wf.js",
#      args: { itemsDir: "<위 출력 절대경로>", bundleKeys: [...24개],
#              schema: <배치파일의 .schema>, model: undefined } })
#    model 미지정 = 세션 모델(Fable 5) 상속. 동시 실행 상한 ~16 → 배치당 16~24번들 권장.
#    ⚠ Workflow는 fs 접근 불가 → 결과는 <session-temp>/tasks/<taskId>.output 의 .result
node tools/generation/extract-workflow-result.mjs <output파일> data/generation/batches/results-<이름>.json

# 3) 게이트 통과분만 저장 (모드 무관 동일)
npx tsx tools/generation/ingest-bundles.ts data/generation/batches/results-<이름>.json --source=regen-s3-<주체>
#    리젝 → prepare-bundles --keys=<출력된 목록> 으로 재생성 루프
```

- 세션 에이전트 실측(2026-07-04 Opus 워크플로): 16병렬 배치당 ~35분. Fable도 유사 예상.
- 과거 관찰: 유난히 빨리 끝난 에이전트(툴콜 <30)는 분량 미달 경향 — 게이트가 걸러주니 걱정 말고
  리젝 재생성 루프를 돌리면 된다.

### 모드 B — 세션 Fable 한도 소진 → Opus 4.8 에이전트

같은 절차에서 Workflow args에 `model: "opus"`만 추가. 나머지 전부 동일.
(주의: Opus는 배치 API 일회성에서 0.7%였지만 그건 프롬프트 강화 **이전**이고, 세션 에이전트
모드에서는 파일 읽기·자가 점검이 가능해 84~100%를 기록했던 환경이다.)

### 모드 C — Claude Code 사용한도 전체 소진 → Codex 인계

Codex가 이어받을 때의 두 가지 하위 모드:

**C-1 (권장): Codex = 오케스트레이터, 생성은 Anthropic 배치 API.**
API 크레딧이 충전돼 있다면 Codex는 코드를 한 줄도 바꿀 필요 없이 §2의 배치 파이프라인을
그대로 돌리면 된다 (플랜 §6의 submit/fetch/ingest 명령 시퀀스). 생성 품질은 Fable이 담당하므로
톤 괴리 위험이 0에 가깝다. **크레딧이 있으면 반드시 이 모드를 선택할 것.**

**C-2 (최후): Codex 자체 모델로 생성.**
크레딧도 없을 때만. 반드시 지킬 것:
- 번들 프롬프트(`split-batch.mjs` 산출 .md 파일)를 **그대로** 생성 모델에 입력으로 사용.
- 출력을 results.json 형태(`{results:[{bundleKey, articles:[...]}]}`)로 만들어 ingest 통과.
- **few-shot 앵커**: 아래 §3의 예시 글 3편을 시스템 컨텍스트에 포함해 톤을 고정할 것.
- 첫 24번들을 생성하면 **전량 정독**하고, 게이트 통과율 <80%면 진행 중단 후 사용자 보고.
- GPT 계열은 특히 ①해요체 종결 일관성 ②#{태그}를 문장 안에 녹이기 ③강약 형용사 리터럴
  포함에서 미끄러지기 쉬움 — 프롬프트에 이미 명시돼 있으니 요약하지 말고 전문을 쓸 것.

## 3. 톤 앵커 (few-shot 기준 예시 — 이 수준이 합격선)

재생성 corpus에서 정독 합격 판정을 받은 대표 예시(경로는 `data/generated/` 기준):
1. `wealth/wealth.thisYear.adult.high.weak.jaeseong.adverse.x.json` — 재다신약 정통 논리 페어링의 모범
   ("상반기에 힘을 모으고 하반기에 굴리는" ↔ 專門 "일간을 보하고 재를 취하는 순서").
2. `romance/romance.today.adult.high.balanced.bigeop.adverse.female.json` — 구체 생활 장면의 모범
   ("오늘 뭐 먹었는지 묻고" 스몰토크 조언, adverse 이름 정직성).
3. `overall/overall.life.stage-senior.any.strong.special.boost_strong.x.json` — 연령 정합의 모범
   (텃밭·물려주기, special격 '넘겨주기' 논리).

판정 기준 요약: 문형 다양(같은 번들 내 summary 골격 중복 ≤2), 소각 상투구 0, 조사·어미 정확,
expert는 근거 서술(저자 시점 금지·태그 직조), 평문은 expert의 충실한 번역(모순 0), 절대 단정 회피.

## 4. 완료 후 처리 (모든 모드 공통)

1. `npm run audit:generated` — 카테고리 고유율 95%+ 및 page simulation 위반 감소 확인.
2. `npx tsx tools/generation/pack-generated.ts` — 브라우저 팩 재생성.
3. 정독 기록을 플랜 §9에 추가, 커밋, `git push origin codex/pr1-text-quality`.
4. 전체 종료 시: 플랜 §9 S5 절차(최종 audit before/after, 단일 PR)로.

## 5. 예산·한도 신호등

- API 크레딧 잔액은 콘솔에서만 확인 가능 — 배치 제출 전 추정치가 찍히니 잔액과 대조.
- 세션 사용한도 도달 신호: Workflow/agent 호출이 한도 오류로 실패 → 모드 B, 그 다음 C로.
- 사용자 방침: S3~는 세션 에이전트 우선(추가 결제 최소화), 품질 향상 재작업은 추후 예산으로.
