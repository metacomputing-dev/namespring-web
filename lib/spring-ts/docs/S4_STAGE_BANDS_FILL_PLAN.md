# S4 — 스테이지×밴드(high/low) 2,160 클래스 채움 실행 계획

> 2026-07-05 작성. **다른 세션/모델이 이 문서만 읽고 단독 실행 가능**하도록 쓴다.
> 톤앤매너·게이트 불변 원칙은 [S3_CONTINUATION_PLAYBOOK.md](./S3_CONTINUATION_PLAYBOOK.md) §0을
> 그대로 따른다(게이트 우회 금지, 정독 의무, `git add` 경로 명시, 템플릿 스탬핑 절대 금지).

## 0. 무엇을 채우나

생애 단계(stages) 탭의 **high/low 밴드** 클래스. any 밴드 1,080개(6분야×180)는 S1b에서 이미
regen 완료(`sourceNote: regen-s1b-*`)이므로 **이번 대상은 high/low만 2,160개**다.

classId = `<cat>.life.<stageAud>.<band>.<gangyak>.<family>.<nameEffect>.x`

| 축 | 값 | 수 |
| --- | --- | --- |
| cat | overall, wealth, health, academic, romance, family | 6 |
| stageAud | stage-teen, stage-early, stage-mid, stage-senior, stage-elder | 5 |
| band | high, low (any 제외) | 2 |
| gangyak | weak, strong | 2 |
| family | bigeop, siksang, jaeseong, gwanseong, inseong, special | 6 |
| nameEffect | boost_strong, boost_mild, neutral | 3 |

**6×5×2×2×6×3 = 2,160.** 축이 성인(3강약×4효과×성별)보다 좁은 이유: `generate-manifest.ts`에서
stage-* audience는 collapsed axes(강약 2 · nameEffect 3 · gender `x`)로 열거되기 때문.
총 클래스 수는 **21,060 → 23,220**(+2,160), baseCells **330 → 390**(+60)이 된다.

### 스켈레톤 = 작업 체크리스트

`data/generation/staging/stage-bands/<category>/<classId>.json`에 스켈레톤 2,160개가 있다
(`node tools/generation/gen-stage-skeletons.mjs`로 언제든 재생성 가능, 멱등).
**이 파일 목록이 곧 채움 작업 체크리스트다** — 남은 작업 = 스켈레톤 목록 중 아직
`data/generated/<cat>/<classId>.json`이 `regen-s4-*`로 존재하지 않는 것.

⚠ 이 디렉터리는 **스테이징 전용**이다. 런타임·pack-generated·prepare-bundles 어느 것도 읽지
않는다. 스켈레톤을 `data/generated/`로 옮기지 말 것 — 옮기면 pack이 빈 글을 번들에 실어 나른다.

## 1. 시작 전제 (모두 충족돼야 착수)

1. **S3 완료**: romance / family / academic 카테고리 regen 완료
   ([PLAN_PR1_GENERATED_TEXT_QUALITY.md](./PLAN_PR1_GENERATED_TEXT_QUALITY.md) §9에서 확인).
2. **Codex 정지 윈도우**: Step 2의 `generate-manifest.ts`가 `rmSync`로 매니페스트 디렉터리를
   **전체 삭제 후 재생성**한다. Codex(또는 다른 생성 세션)가 매니페스트를 읽는 중이면 절대 금지.
   정지 확인 후에만 Step 2 진행.
3. **Step 0의 코드 2건 랜딩 확인** (아래).

## Step 0. 코드 전제 확인 — 없으면 먼저 랜딩

실행 전 반드시 확인(2026-07-05 `codex/pr1-text-quality` 기준 **둘 다 미랜딩** — 어느 브랜치에도
없음을 `git log --all -S`로 확인했다. 실행 시점에 이미 랜딩돼 있으면 이 단계는 건너뛴다):

```bash
grep -n "missing-only" lib/spring-ts/tools/generation/prepare-bundles.ts   # (a)
grep -n "BAND_TONE" lib/spring-ts/tools/generation/bundle-prompt.ts        # (b) stages 분기에 있어야 함
```

### (a) `prepare-bundles.ts --missing-only` — 기존 regen 5편 보호

배경: 번들 키(`bundleKeyOfCase`)는 stage-* 5단계를 `stages` 하나로 병합한다
(`<cat>.stages.<gangyak>.<family>.<nameEffect>.x`). 매니페스트 재생성 후 각 스테이지 번들은
**15케이스**(any 5편 = 이미 regen 완료 + high/low 10편 = 신규)가 되는데, 번들의 done 판정이
`cases.every(isRegenerated)`라서 이 216개 번들은 전부 "미완"으로 다시 잡힌다. 플래그 없이
돌리면 **이미 완료된 any 5편까지 프롬프트에 포함**되어 재생성·ingest 시 덮어써진다.

스펙: `--missing-only` 플래그가 있으면, 선택된 각 번들에서 `isRegenerated(c) === true`인
케이스를 **프롬프트와 caseIds에서 제외**하고 남은 케이스만으로 `buildBundlePrompt`를 만든다.
구현 위치는 `main()`의 bundles 매핑부 — `cases`를 `cases.filter((c) => !isRegenerated(c))`로
좁히면 된다(빈 번들은 스킵). 번들당 신규 10편이라 `BUNDLE_OUTPUT_SCHEMA`의 maxItems 24 안에 든다.

### (b) `bundle-prompt.ts` stage×BAND_TONE 분기 — band ≠ any일 때만 활성

현재 stages 셀 렌즈는 `생애 단계: ${STAGE_LABEL[...]}`만 쓰고 band를 무시한다
(`buildBundlePrompt`의 cellLines, 127~131행 부근). high/low 셀이 같은 번들에 섞이므로
**케이스 단위로** band ≠ `'any'`일 때만 BAND_TONE을 덧붙인다:

```ts
const lens = isStages
  ? `생애 단계: ${STAGE_LABEL[c.audience] ?? c.audience}${
      c.band !== 'any' ? ` / 등급 ${c.band}: ${BAND_TONE[c.band] ?? ''}` : ''}`
  : `${PERIOD_LENS[c.period] ?? c.period} / 등급 ${c.band}: ${BAND_TONE[c.band] ?? ''}`;
```

band === `'any'`일 때 기존 문자열이 **바이트 단위로 동일**해야 한다(기존 any 재생성 경로의
재현성 보존). 그 외 프롬프트 본문은 수정 금지(S3 플레이북 불변 원칙 §0-2).

## Step 1. 매니페스트 재생성 (Codex 정지 후)

셀은 베이스 아티클에서 **100% 유도**된다. `data/articles/<cat>/stages.articles.json`에는
high/low 엔트리가 **이미 들어 있다**(6분야 각 15개 band 엔트리 = 5스테이지 × any/high/low —
확인 완료. 미노출 5분야는 any뿐이라 영향 없음). 따라서 재실행만으로 신규 셀이 나온다:

```bash
cd lib/spring-ts
npx tsx tools/generation/generate-manifest.ts
```

검증(하나라도 틀리면 중단하고 원인 파악):

| 항목 | 기대값 |
| --- | --- |
| `manifest/index.json` totalClasses | **23,220** |
| baseCells | **390** |
| overall / wealth / health / academic | 각 **1,980** (+360) |
| romance / family | 각 **3,060** (+360) |
| career / study_document / expression_children / health_stress / movement | **불변** (2,700 / 1,620×4) |
| `grep -c "stage-teen\.high" manifest/overall.manifest.jsonl` | 36 |

## Step 2. 문서 동기화 21,060 → 23,220

```bash
grep -rn "21,060\|21060" lib/spring-ts/docs/
```

최소 [REDUCTION_FORMULA.md](./REDUCTION_FORMULA.md)(권위값 문구),
[HANDOFF.md](./HANDOFF.md)(현황·매니페스트 표), [GENERATION_PIPELINE.md](./GENERATION_PIPELINE.md)
(총량·배치 산식)의 해당 수치를 23,220으로 갱신하고, 증가분 근거(stage high/low +2,160)를
한 줄 남긴다. 진행 카운트(`n / 21,060` 꼴)도 분모를 함께 갱신.

## Step 3. 번들 준비 + 생성 — 216번들 × 10편 = 2,160

카테고리별(6개 전부):

```bash
npx tsx tools/generation/prepare-bundles.ts <category> --missing-only --count 36
```

- 기대: 카테고리당 **36번들**(2강약×6격국×3효과), 번들당 **신규 10편**(5스테이지×high/low).
  6카테고리 합계 216번들·2,160편. `--count` 기본값이 20이므로 **36을 명시**할 것.
- prepare 출력의 번들·편수 합이 기대와 다르면 중단(Step 0(a) 미적용이면 편수가 15로 나온다).
- 생성 경로 (둘 중 하나):
  - **세션 에이전트(권장, S3와 동일)**: `run-bundles.wf.js` + `extract-workflow-result.mjs` →
    results.json. 운영 방식은 [S3_CONTINUATION_PLAYBOOK.md](./S3_CONTINUATION_PLAYBOOK.md) 그대로.
  - **API 배치**: 비용 추정 ~$120–180. (S2c에서 API 지출 종료 선언이 있었으므로 사용자 승인 필요.)

## Step 4. ingest — `--source=regen-s4-*`

```bash
npx tsx tools/generation/ingest-bundles.ts <results.json> --source=regen-s4-<runTag>
# 예: --source=regen-s4-f5
```

- `--source`는 `regen-` 접두 필수(재개 감지가 sourceNote 접두에 의존). **s4 식별자를 꼭 포함**
  — Step 5의 완료 검증과 감사가 `regen-s4-` 접두로 이번 작업분을 구분한다.
- **게이트는 기존 3층 그대로, 수정 금지**:
  1. per-article `validateGenerated`(스키마·문체·전문용어·페어링 + text-quality-rules),
  2. 번들 다양성 — 디스크의 regen 형제가 우선권(기존 any 5편이 보호 형제로 참여해
     신규 글이 그들과 겹치면 신규 쪽이 리젝된다),
  3. cross-bundle 문단 중복 인덱스.
- 리젝된 caseId는 번들 단위로 재생성: `prepare-bundles.ts --keys=<bundleKey>` (+`--missing-only`
  유지 — 부분 번들 재작성 시에도 완료분 보호).

## Step 5. 완료 검증 → 스켈레톤 삭제

스켈레톤 목록 전체가 `regen-s4-*`로 채워졌는지 검증(체크리스트 소진 확인):

```bash
cd lib/spring-ts
node -e "
const fs=require('fs'),p=require('path');
const root='data/generation/staging/stage-bands';let miss=0,tot=0;
for(const cat of fs.readdirSync(root))for(const f of fs.readdirSync(p.join(root,cat))){
  if(!f.endsWith('.json'))continue;tot++;
  const g=p.join('data/generated',cat,f);
  let ok=false;
  try{ok=JSON.parse(fs.readFileSync(g,'utf-8')).sourceNote?.startsWith('regen-s4')}catch{}
  if(!ok){miss++;console.log('MISSING '+f)}
}
console.log(\`missing \${miss} / \${tot}\`);process.exit(miss?1:0);"
```

- 진행 중에는 이 스크립트가 곧 진행률 계산기다(missing = 남은 작업).
- **missing 0이 된 뒤에만** 스켈레톤 디렉터리를 삭제한다:
  `rm -rf data/generation/staging/stage-bands` (커밋돼 있으면 `git rm -r`).

## Step 6. pack 재실행 + 마무리

```bash
npx tsx tools/generation/pack-generated.ts
```

이후 S3 플레이북 §0 그대로: 카테고리당 최소 3번들 정독 판정 기록, 커밋은
`git add lib/spring-ts/data/generated/ lib/spring-ts/data/packed/` 식으로 경로 명시.

## 부록 — 중단·재개

- **Step 1 이후 어디서 끊겨도 안전**: prepare-bundles는 sourceNote 기반 resumable이라 Step 3
  명령을 그대로 재실행하면 남은 번들만 잡는다. Step 5 스크립트로 잔여량을 언제든 확인.
- Step 1 자체는 멱등이지만 재실행에도 Codex 정지 윈도우가 필요하다(rmSync).
- 스켈레톤이 지워졌거나 손상됐으면 `node tools/generation/gen-stage-skeletons.mjs` 재실행(멱등).
