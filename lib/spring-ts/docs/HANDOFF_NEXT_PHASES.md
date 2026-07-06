# 인계 문서: PR #649 이후 남은 작업 전부 — 실행 절차·완료 판정·투입 프롬프트

> 2026-07-05 작성. **어떤 모델(GPT/Opus/Fable/하위)이든 이 문서만으로 이어받을 수 있게** 쓴 마스터 인계 문서.
> 각 작업의 §끝에 "투입 프롬프트"가 있다 — 새 세션에 그대로 붙여넣으면 된다.
> 브랜치: PR #649(`codex/pr1-text-quality`) 머지 후에는 main에서 새 브랜치를 따서 작업.
> 이 문서가 `EMERGENCY_RESUME.md`(S2 시절)를 대체한다.

---

## A. 먼저 읽기: 최근 대규모 변경 요약 (특히 Codex/GPT는 모르는 것들)

S3 romance 생성 중이던 세션 이후 다음이 랜딩됐다. **이 사실들을 모르면 잘못된 판단을 한다:**

| 변경 | 파일 | 이어받는 자가 알아야 할 것 |
|---|---|---|
| **Provenance 게이트** | `src/report/tiered/generated-registry.ts` | 런타임은 sourceNote가 `regen-` 접두인 생성물만 채택. 스탬핑 구코퍼스는 절대 노출 안 됨. **ingest를 거치지 않고 data/generated에 직접 쓴 파일은 화면에 안 나온다** |
| **classId 후보 체인** | `src/report/tiered/class-axes.ts` | 미성년형(child/teen/stage-*)은 축 축소 미러링(gender→x, balanced/adverse는 클래스 없음→베이스). **생애단계 high/low 구간은 등급 중립(any)으로 폴백 금지** — 등급-텍스트 정합 불변식 |
| **나이대별 = 대운 축** | `build-tiered-matrix.ts`(byDaeun), `cards/life-curve-card.ts` | 선택 칩=개인 대운 구간(폐구간 표기 "25세~34세"), 커브=0~100세(대운0.6+세운0.4, 세운은 saeunPillars=입춘 반영) |
| **전문 인사이트** | `cards/insight-facts-card.ts`, `tiered/insight-registry.ts`, `data/articles/insights/*.insights.json` | 신살·공망·합충형파해·지장간 해석 126건 충전. 하이라이트 6개(가중치)+칩 클라우드(농도=salience). 해석 파일에 factId 추가만 하면 자동 반영 |
| **베이스 stages 15엔트리화** | `data/articles/*/stages.articles.json` (노출 6분야) | any 5 + high 5 + low 5. **⚠ 매니페스트 재생성 시 여기서 셀이 유도돼 21,060→23,220으로 늘어난다** — S4 윈도우 전에는 generate-manifest 재실행 금지 |
| **생성 파이프라인 확장** | `tools/generation/{bundle-prompt,generate-manifest,prepare-bundles}.ts` | stage 프롬프트에 BAND_TONE(band≠any만 활성 — 기존 any 생성 무영향), 성인 stage의 미성년 금지어 분리, `--missing-only`(완성분 보호) |
| **S4 스켈레톤** | `data/generation/staging/stage-bands/` (2,160) + `docs/S4_STAGE_BANDS_FILL_PLAN.md` | 채울 classId 체크리스트. 런타임 밖(무해) |
| **프론트 수정** | `namespring/src/CombiedNamingReport.jsx`, `styles/report-ui.css`, `App.jsx` | 나이대별 칩/커브, 인사이트 섹션. 원칙상 프론트 무접촉이었으나 필요 범위로 승인받음 |

**설계 근거 문서**: `docs/DESIGN_LIFEFLOW_INSIGHTS.md` (왜 이렇게 됐는지)
**생성 절차 문서**: `docs/S3_CONTINUATION_PLAYBOOK.md` (모드 A/B/C — 실행 주체별)
**진행 이력**: `docs/PLAN_PR1_GENERATED_TEXT_QUALITY.md` §9

## B. 불변 원칙 (모든 작업 공통 — 위반 금지)

1. **게이트 우회 금지.** 모든 생성물은 `tools/generation/ingest-bundles.ts`로만 저장 (`--source=regen-*` 필수). 템플릿 스탬핑 절대 금지.
2. **등급-텍스트 정합.** 별점(계산)과 글 톤이 어긋나는 경로를 만들지 말 것. 의심되면 `npx tsx tools/dev/dump-report-trace.ts`로 정합✓ 확인.
3. **이름효과 정직성.** adverse를 다른 축으로 대체하지 말 것 (베이스 폴백이 정답).
4. **매니페스트 재생성은 S4 윈도우에서만** (모든 생성 세션 정지 후). rmSync 전체 재생성이라 진행 중 세션과 레이스.
5. 커밋: `git add <경로 명시>`만, `.env` 절대 금지, 스타일=일상 밀착형(격조 상향 금지).
6. 완료 시마다: 관련 테스트 + `dump-report-trace` + (화면 변경 시) 프리뷰 확인.

## C. 검증 도구 모음

```bash
cd lib/spring-ts
npx tsc --noEmit                              # 타입
npm run test:namespring-compat                # 호환 202 (핵심)
npm run test:tiered-shape                     # 매트릭스 1392
npm run test:tiered-class-axes                # κ 축
npm run test:service-visible-output           # 미성년 안전
npm run test:article-gate                     # 베이스 저작 게이트
npm run test:generated-quality                # 생성 게이트 단위
npx tsx tools/dev/dump-report-trace.ts        # ★셀 출처·정합 실측 (인자로 다른 사주 가능)
npm run audit:generated                       # 코퍼스 다양성 감사
```
프리뷰: `namespring`에서 `npm run dev` → 최성수/崔成秀/1986.04.19 05:45/남 입력 → 통합 보고서.
캡처 자동화: `node namespring/tools/capture-report-screens.mjs <출력dir>` (전제: puppeteer-core 임시 설치 + Chrome).

---

## D. 남은 작업 (우선순위 순) — 절차·완료 판정·프롬프트

### 작업 1 — romance 재생성 완결 (진행 중인 것 이어받기)

- **현황 확인**: `node -e` 로 `data/generated/romance`에서 sourceNote `regen-` 비율 측정 (마지막 실측 ~33%, 이후 진행분 있을 수 있음).
- **절차**: `docs/S3_CONTINUATION_PLAYBOOK.md` 모드 C-1(배치 API 오케스트레이션) 또는 C-2(자체 생성). 명령 시퀀스는 플레이북 §2 그대로: `prepare-bundles romance` → 생성 → `ingest-bundles --source=regen-s3-*` → 리젝 `--keys` 재생성 루프.
- **완료 판정**: romance 2,700파일 전부 regen- + `audit:generated` romance 고유율 95%+ + 표본 3번들 정독(톤 앵커=플레이북 §3) + 커밋.
- **주의**: gender 민감 분야(male/female 축) — 번들 수가 2배.

> **투입 프롬프트**
> ```
> namespring-web 레포에서 유료 리포트 romance 분야 재생성을 완결해줘.
> 반드시 먼저 lib/spring-ts/docs/HANDOFF_NEXT_PHASES.md 의 A·B절을 읽고,
> 작업 절차는 docs/S3_CONTINUATION_PLAYBOOK.md 를 따라. 게이트(ingest-bundles)
> 통과분만 저장하고, 스타일은 톤 앵커 3편과 어긋나지 않게. 완료 판정: romance
> 전 파일 sourceNote regen- + audit 고유율 95%+ + 표본 3번들 정독 기록.
> 커밋은 data/generated/romance 경로 명시로만.
> ```

### 작업 2 — family·academic 재생성 (romance와 동일 절차)

- family(2,700, gender 민감) → academic(1,980) 순. 나머지는 작업 1과 동일.
- **완료 판정**: 두 분야 전 파일 regen- → **이 시점에 노출 6분야 전부 100%** → `pack-generated.ts` 재실행 후 프리뷰에서 기간별 카드가 재생성 텍스트인지 dump-report-trace로 확인.

> **투입 프롬프트**: 작업 1 프롬프트에서 분야명만 family/academic으로 교체.

### 작업 3 — S4: 생애단계 등급 콘텐츠 2,160편 충전

- **전제**: 작업 1·2 완료 + **모든 생성 세션 정지** (매니페스트 윈도우).
- **절차**: `docs/S4_STAGE_BANDS_FILL_PLAN.md` 를 순서대로 (매니페스트 재생성 21,060→23,220 → `prepare-bundles --missing-only`로 신규 10편/번들만 → 생성 → ingest → 스켈레톤 삭제 → pack 재실행 → totalClasses 문서 동기화).
- **완료 판정**: staging 스켈레톤 0개 잔존 + dump-report-trace에서 나이대별 high/low 구간의 fragmentId가 **8토큰 재생성 classId**로 바뀜(현재는 베이스 `.a`) + 정합✓ 유지.
- **효과**: 나이대별 카드가 "등급 일치 + 개인화" 동시 달성 (현재는 등급 일치만 보장, 개인화는 베이스 수준).

> **투입 프롬프트**
> ```
> namespring-web에서 S4(생애단계 등급 콘텐츠 2,160편 충전)를 실행해줘.
> 먼저 lib/spring-ts/docs/HANDOFF_NEXT_PHASES.md A·B절 → docs/S4_STAGE_BANDS_FILL_PLAN.md
> 순서로 읽고 그대로 실행해. 반드시 확인: (1) romance/family/academic 재생성이
> 끝났는지 (2) 다른 생성 세션이 없는지 — 둘 중 하나라도 아니면 중단하고 보고.
> 완료 후 npx tsx tools/dev/dump-report-trace.ts 로 나이대별 high/low 구간
> fragmentId가 8토큰 재생성 classId이고 전부 정합✓인지 증빙해줘.
> ```

### 작업 4 — 대운 구간별 본문 차별화 (60갑자 리드 문장) ✅ 완료 (2026-07-06, PR #649에 포함)

> **완료됨.** 60건 전량 저작(`data/articles/insights/daeun-leads.insights.json`) + 엔진 훅
> (`buildLifeByDaeun` → `daeunLead`, 申=SIN→SIN_BRANCH 정규화) + 프론트 렌더.
> 완료 판정 충족 실측: 본문 동일한 15~24(갑오) vs 25~34(을미)가 서로 다른 리드로 시작,
> compat 202 ✓ tiered-shape 1392 ✓ visible-output 13 ✓. 아래는 이력 보존용 원문.

- **문제**: 같은 (생애단계 버킷×등급)인 인접 대운은 본문이 동일 (PR §2 '알려진 한계'). S4로도 안 풀림 — 구간 고유 차이는 간지.
- **설계 (확정)**:
  1. 데이터: `lib/spring-ts/data/articles/insights/daeun-leads.insights.json` — `entries: [{factId: "daeunLead.GAP-JA", text: "..."}]` ×60 (간지 코드는 STEM/BRANCH 코드 조합, 기존 insights 스키마 재사용 → 로더 무수정).
  2. 엔진: `build-tiered-matrix.ts` `buildLifeByDaeun`에서 각 구간에 `daeunLead?: string` 부여 — `getInsightInterpretation(\`daeunLead.${pillar.stem}-${pillar.branch}\`)?.text`. 타입: `DaeunScopedFortunes`에 옵셔널 필드 추가 (`src/report/types.ts`).
  3. 프론트: `CombiedNamingReport.jsx` 선택 나이대 블록에서 summary 위에 `daeunLead`를 한 줄로 렌더 (없으면 생략 — 무회귀).
- **저작 규칙**: 각 1~2문장, 해요체, 그 간지(천간+지지 오행 조합)의 결을 일상 비유로. 등급 단정 금지(등급은 본문 몫), 소각 상투구 금지, 60문장 문형 전부 상이.
- **완료 판정**: 60건 전부 존재 + 프리뷰에서 인접 동일본문 구간(예: 15~24 vs 25~34)이 서로 다른 리드로 시작 + compat 202 통과.

> **투입 프롬프트**
> ```
> namespring-web에서 '대운 구간별 본문 차별화(60갑자 리드 문장)'를 구현해줘.
> lib/spring-ts/docs/HANDOFF_NEXT_PHASES.md 의 작업 4 설계(데이터 스키마·엔진 훅·
> 프론트 렌더 위치가 확정돼 있음)를 그대로 따라. 60문장은 저작 규칙(해요체,
> 간지의 오행 결, 등급 단정 금지, 문형 전부 상이)을 지켜서 직접 써줘.
> 완료 판정: 프리뷰에서 인접 동일본문 대운(15~24세 vs 25~34세)이 서로 다른
> 리드 문장으로 시작함을 캡처로 증빙 + npm run test:namespring-compat 통과.
> ```

### 작업 5 — 인사이트 해석 고도화 (선택적, 소규모 반복 가능) 🔄 부분 선반영 (2026-07-06, PR #649)

- 구조는 완성 — **해석 파일에 entries만 추가하면 자동 반영** (`insight-registry` 조회 체인: 정확 factId → 타입 레벨 → 신살 백과).
- 후보: 신살×기둥 위치별 세분화(factId에 위치 포함하려면 카드 방출 확장 필요 — 현재는 `shinsal.<이름>`), 미해석 잔여(daeunPillar는 작업 4가 대체), 극(stemRelation.극) 조합별.
- **완료 판정**: dump-report-trace의 "해석 부착" 수 증가 + 프리뷰 확인.
- **부분 선반영됨 (커밋 `e8c81e95d`)**: 위치 세분 조회 레이어를 랜딩했다 — `withInterpretation`에 `preferredIds`(factId보다 먼저 시도) + 신살 루프가 **단일 히트일 때만** `shinsal.<이름>.<기둥>` 조회(다중 기둥 히트는 프론트가 factId 병합·위치 합산 → 위치 특정 문장이 오독이라 타입 레벨 유지). 데이터 `shinsal-positions.insights.json`에 위치 민감 신살 8종(도화·역마·화개살·천을귀인·문창귀인·양인·장성살·반안살) × 4기둥 = 32건 저작. 실측: 도화 단일 히트(년주) → `shinsal.도화.년주` 채택, 프리뷰 확인.
- **잔여(머지 후 반복)**: 나머지 ~35개 신살 위치 세분(대부분 귀인·관계살이라 위치 의존 낮음), 극(stemRelation.극) 조합별. **인프라·조회 체인 완비 — 파일 추가만.**
- ⚠ **dev 서버 검증 시**: 새 `*.insights.json` 추가 후 프리뷰가 안 바뀌면 Vite `import.meta.glob` 스테일 — 서버 재시작(preview_stop→start) 필요. 프로덕션 `vite build`는 빌드 시점 glob 재평가라 무관.

### 작업 6 — F1: 별점 요약 문구 프론트 조립 반복 해소 ✅ 완료 (2026-07-06, PR #649에 포함)

- 기간 카드 상단의 별점·요약 강조 문구가 프론트에서 고정 조립되는 부분의 다양화. 진단은 플랜 문서 F1 항목 참조. (엔진 콘텐츠가 아니라 프론트 표현 계층.)
- **완료됨.** `nameCompatibility.summary` 3곳 재사용 해소 — 히어로 정본 1회, 총평은 N1 평문, 이름 평가는 상세 근거 1행 승격. 프리뷰 실측: 별점 문구 3회 → 1회. (F1b 분야 간 audit 시뮬레이션은 미착수 — 작업 7 후보.)

### 작업 7 — 마무리 일괄 패스 (전 작업 후)

1. `npx tsx tools/generation/pack-generated.ts` (최종 팩)
2. `npm run audit:generated` before/after 기록
3. byAgeBand 레거시 경로 제거 검토 (byDaeun 안정화 확인 후 — 프론트 폴백 의존 제거)
4. 미성년 기간 표면 등급 콘텐츠 (백로그 — 현재 비모순 확인됨, 낮은 우선)
5. 전체 테스트 스위트 + 프리뷰 스모크 + PR

> **투입 프롬프트 (작업 5~7 공통)**
> ```
> namespring-web에서 lib/spring-ts/docs/HANDOFF_NEXT_PHASES.md 의 작업 N을 실행해줘.
> A·B절(최근 변경·불변 원칙)을 먼저 읽고, 완료 판정 기준을 그대로 증빙해줘.
> ```

---

## E. 세션 시작용 캐치업 프롬프트 (특히 Codex/GPT — 최근 변경을 모르는 세션)

> ```
> namespring-web 레포의 유료 리포트 품질 프로젝트를 이어받는다. 너의 마지막
> 기억(romance 생성) 이후 큰 변화가 있었다 — 추측하지 말고 다음 순서로 읽어라:
> 1. lib/spring-ts/docs/HANDOFF_NEXT_PHASES.md (A절=바뀐 것, B절=불변 원칙, D절=남은 작업)
> 2. 네가 맡을 작업의 해당 절차 문서 (S3_CONTINUATION_PLAYBOOK.md 또는 S4_STAGE_BANDS_FILL_PLAN.md)
> 3. 착수 전 상태 실측: cd lib/spring-ts && npx tsx tools/dev/dump-report-trace.ts
>    와 git log --oneline -15 로 현재 지점을 확인하고, 계획을 한 단락으로 보고한 뒤 시작해라.
> 특히: 게이트 우회 금지 / regen- sourceNote 없는 파일은 화면에 안 나옴 /
> 매니페스트 재생성은 S4 윈도우 전 금지 / adverse 이름효과를 다른 축으로 뭉개지 말 것.
> ```
