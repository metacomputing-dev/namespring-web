> ⚠ **이 문서는 구식입니다 (S2 소탕 시절).** S2·라이프플로우·인사이트가 모두 완료된 현재의
> 인계·잔여 작업·투입 프롬프트는 **HANDOFF_NEXT_PHASES.md** 를 보세요.

# 긴급 재개 노트 — S2/S3 병행 체제 (2026-07-05 갱신)

> **현 체제 (사용자 지시)**: S3 전체(romance→family→academic)는 **Codex(GPT)가 진행 중**.
> Claude 세션은 **S2 잔여 소탕만** 담당. **커밋 금지**(사용자 지시 — 커밋은 사용자/Codex 조율 후).
> 파일 영역 분담 — Claude: `data/generated/{health,wealth,overall}` + `results-s2d*.json` + 이 문서.
> Codex: `data/generated/romance` 등 S3 + `PLAN_PR1_GENERATED_TEXT_QUALITY.md`. **서로 침범 금지.**

## S2 잔여 소탕(S2d) 진행 상태 (13:40 갱신)
- 1차(`wf_709f9b26-80f`): 한도로 1번들만 생존 → 15편 ingest ✅.
- 2차(resume, task `wflwbvq8s`): 한도 재도달 전 16번들 완성 → **239/240 ingest ✅** (리젝 1편은
  기존 regen 콘텐츠 유지로 종결 불요 판정).
- **현재 잔여 = 11파일/7번들뿐** (sourceNote non-regen 기준 실측): health 6번들 + wealth 1번들.
- 3차(`wf_bd4cfa14-502`): 6/7번들 성공 → **90편 ingest ✅ (리젝 0)**.
- **최종 잔여 = 2파일/1번들**: `health.adult.weak.gwanseong.boost_mild.x` (today.high/low stale).
- **17:40경 Fable 세션 한도 완전 소진 → 모드 B(Opus 4.8)로 전환**(사용자가 /model opus-4-8).
  Fable resume(`w2oryr85u`) TaskStop 후, `args.model:"opus"` 명시 + `resumeFromRunId:"wf_bd4cfa14-502"`로
  재발사(task `wnv34zam4`) — 캐시 6 즉시 복원 + 1번들만 Opus 집필. 완료 시 extract(w4)→ingest→stale 0 = **S2 종결**.
- 이후 재개 규칙: 세션 모델이 Opus인 한 args.model 생략해도 Opus 상속. 명시하면 확실.
- **w4(Opus 1번들) 결과: 15편 전량 리젝** — bundle-ngram-stamp(번들 내 다양성). Opus가 expert
  도입부 "신약한 일간이 관성으로 격을 이루…"를 15편 중 10편에서 반복. 게이트 정상 작동.
  → fresh 재생성(`wf_fc71d95d-4da`, task `wsvpjaij5`): 스키마 description에 "expert 도입 구조 매 편
  상이" 넛지 추가(오케스트레이션 파라미터 — bundle-prompt.ts 불변). 또 리젝 시 재-fresh 반복.
  ★교훈: Opus는 번들 내 expert 도입부를 템플릿화하는 경향 — S3에서 Opus 쓸 때 이 넛지 상시 적용 권장.
- 입력 상주: `items-bundles-keys-7/` (45키 세트는 폐기 — 실패 29번들 중 22개는 이미 전 파일 regen).
- 오늘 세션 에이전트 누계: 23번들 344편 ingest, 리젝 1 (99.7%).
- 참고: Codex가 게이트·프롬프트를 다양성 허용 방향으로 보완함(예: '고른' 반복 완화). 남은 1번들은
  기존 프롬프트(.md 상주)로 생성되지만 채점은 최신 게이트 — 완화 방향이므로 충돌 없음.
- **S2 종결 판정 기준**: health/wealth/overall 4,860파일 전수에서 sourceNote non-regen = 0.

## 재개 루프 (한도로 또 끊길 때마다 반복)
1. `<session-temp>/tasks/<taskId>.output` → `node tools/generation/extract-workflow-result.mjs <output> data/generation/batches/results-s2d-w<N>.json`
2. 빈 articles 번들 제거 후 `npx tsx tools/generation/ingest-bundles.ts <results> --source=regen-s2d-f5`
3. 미완료분: `Workflow({scriptPath: tools/generation/run-bundles.wf.js, resumeFromRunId: "wf_709f9b26-80f", args: 동일})` — 완료분 캐시, 죽은 것만 재실행.
4. 44번들 회수 후 리젝 잔여가 남으면: `prepare-bundles --keys=<ingest가 출력한 목록>` → split-batch → 새 Workflow → ingest 반복.
5. S2 종결 판정: health·wealth·overall 3분야 전 파일 sourceNote `regen-` = 100%.
   확인: `npm run audit:generated` (읽기 전용 — romance는 Codex 중간 상태이므로 그 수치는 무시).

## 커밋 정책 (현 시점)
- **git add/commit/push 금지.** 워킹트리에는 Codex의 S3 변경과 Claude의 S2 변경이 섞여 있음.
  커밋 시점·범위는 사용자가 Codex 작업과 조율해 결정. Claude 몫을 커밋하게 될 때는
  `git add lib/spring-ts/data/generated/health lib/spring-ts/data/generated/wealth lib/spring-ts/data/generated/overall` 경로 명시로만.

## 불변
- 게이트(ingest-bundles) 통과 없이는 저장 금지. 프롬프트 수정 금지. 스탬핑 금지.
- Codex용 S3 지침: `S3_CONTINUATION_PLAYBOOK.md` (톤 앵커·모드 C·80% 중단 규칙).
