# 실행 계획 — fingerprint를 "평문"으로 녹이기 (사주·성명학 → 일반 문장)

> 2026-07-04, branch `claude/tiered-article-rewrite` (PR #648 보완).
> 관련: [PAID_QUALITY_AND_PERSONALIZATION.md](./PAID_QUALITY_AND_PERSONALIZATION.md)(ROI 로드맵),
> [ARTICLE_STYLE_CONTRACT.md](./ARTICLE_STYLE_CONTRACT.md)(문체·게이트), [CONTENT_ENGINE_CONSISTENCY.md](./CONTENT_ENGINE_CONSISTENCY.md).

## 0. 목표 (가장 중요)

`spring-ts`/`saju-ts`가 **이미 계산해 둔 개인별 fingerprint**(사주 + 성명학)를, 사용자가 처음
보는 **일반 tier(요약·본문·팁·주의)에 평문으로 녹여** 서비스한다. **일반인이 "용신·천간·천덕귀인"
같은 날것 용어를 그대로 보고 스스로 찾아보게 두지 않는다.** 용어는 전문가 tier에만 두고, 일반
tier에는 그 **뜻을 평문으로 번역**해 담는다.

- 오행 **이름**(나무·불·흙·쇠·물)은 평문이라 일반 tier 허용. 개념 **용어**(용신·격국·신살·득령…)는 금지.
  게이트 `jargon-in-general`이 강제(SAJU_JARGON_GENERAL 목록).
- 예: `신강` → "타고난 기운이 **단단한** 편", `용신 물` → "당신에게 **채움이 필요한 물 기운**",
  `천덕귀인` → (전문가 tier에서만 용어; 일반 tier에선 "귀인의 도움을 받기 쉬운 자리" 같은 평문).

## 1. 불변 원칙 (재작성 아키텍처 승계)

- **결정적**: 런타임 LLM 없음. 값은 `FeatureVector`/`SajuCompatibility` 실측에서만.
- **WYSIWYG**: 저자가 리뷰한 문장 = 사용자가 읽는 문장. 문장 골격은 **저작**하고, 개인값은
  **슬롯 주입**으로만 채운다(정규식 사후수리 없음).
- **절대 사주상태 단정 금지**: 슬롯도 조건절/서술로. (`CONTENT_ENGINE_CONSISTENCY §3.2`)
- **게이트 그린 유지**: 분량·해요체·상한어휘·조사·중복·미성년안전·의료어·`jargon-in-general`.
- **녹색 기준선**: `typecheck` + 8 tiered/article 스위트 + `bench:tiered`(cold<5s/warm<300ms). 매 커밋 유지.

## 2. 쓸 수 있는 fingerprint 신호 → 평문 번역

| 신호(엔진 계산 위치) | 일반 tier 평문 | 전문가 tier 용어 |
|---|---|---|
| `dayMasterElement`(일간 오행) | "타고난 중심 기운은 **물**" | 일간, 오행 |
| `dayMasterStrength`(신강/신약) | "기운이 **단단한/여린/고른** 편" | 신강·신약 |
| `yongshinElement`(용신) | "당신에게 **채움이 필요한 불 기운**" | 용신 |
| `deficientElements`(부족 오행 *정체*) | "사주에 **부족한 물·나무 기운**" | 부족 오행 |
| `excessiveElements`(과다 오행) | "이미 **넉넉한 흙 기운**" | 과다 오행 |
| 오행별 개수(`woodCount`…) | "물 기운이 **{n}개뿐**이라" | — |
| 165 셀 실측 grade 분포 (A1) | "재물·건강은 낮게, 학업은 높게 짜인 배치" | — |
| `SajuCompatibility.yongshinMatchCount`(이름↔사주 보강) | "이름이 부족한 물 기운을 **{k}글자** 담고 있어" | 용신 보강 |

## 3. 순차 단계 (커밋 단위)

- **S1 · 평문 fingerprint 슬롯** (infra) — `FeatureVector`에 부족/과다 오행 *정체* 노출(개수→정체).
  `article-renderer` 슬롯 확장: `deficientElementName(s)`, `excessElementName`, `strengthPlain`(짧은 형용사),
  개수 슬롯. 게이트 `SLOT_NAMES`·`approximateRendered` 동기화 + 테스트. **아티클은 미변경(슬롯 opt-in)** → 기준선 그린.
- **S2 · A1 교차-셀 종합 리딩** (infra) — 카테고리별 실측 grade에서 high/low를 뽑아 **평문 프로필 문장**을
  저작 템플릿+슬롯으로 조립. 매트릭스 출력에 필드 추가 + 결정성/무용어 테스트.
- **S3 · N1 이름↔사주 보강 문장** (infra) — `buildFortuneReport`→`buildTieredMatrix`에 `sajuCompatibility` 전달.
  `yongshinMatchCount`·부족오행으로 **실측 조건부 평문**(0이면 다른 표현). 작명 카드와 중복·과장 금지.
- **S4 · 코퍼스 적용** (content) — 신규 슬롯을 아티클 본문에 평문으로 녹임. `overall`·`wealth`·`health`부터
  카테고리별. 게이트+pairing+bench 그린. 나머지 롤아웃은 표로 추적.
- **S5 · 다양성 증폭**(선택) — variant `%n`(현재 놀고 있음) 활성/`texture` rib. [article-diversity-strategy] 참조.
  단, texture 단일 자리·후보 ≤3·조합 전수 정독·강약은 expert 조건절만.

## 4. 회귀 방어 (매 단계)

`npm run typecheck && npm run test:article-gate && npm run test:article-renderer && npm run test:tiered-shape
&& npm run test:tiered-feature-vector && npm run test:tiered-personal-reading && npm run test:tiered-name-saju-reading
&& npm run test:tiered-determinism && npm run test:tiered-isolation && npm run bench:tiered` — 전부 그린이어야 커밋.

## 5. 진행 현황 (PR #648 보완 커밋)

| 단계 | 상태 | 커밋 | 내용 |
|---|---|---|---|
| S1 슬롯 | ✅ | `feat(tiered): plain-language fingerprint slots` | `{{strengthPlain}}`·`{{dayMasterCount}}`·`{{yongshinCount}}` + FeatureVector 부족/과다 오행 정체 |
| S2 A1 | ✅ | `feat(tiered): A1 cross-cell personal reading` | 165 grade→평문 프로필(`personalReading`), 강약+강/약 카테고리 한 문장 |
| S3 N1 | ✅ | `feat(tiered): N1 name↔saju reinforcement` | `sajuCompatibility` 배관 + 이름↔사주 실측 조건부 평문(`nameSajuReading`) |
| S4 콘텐츠 | 🟡 시연 | `content(overall): weave plain fingerprint slots` | overall/thisYear 성인 3밴드에 강약 평문+용신 개수. 5개 강약값 렌더 검증 |
| 프론트 배선 | ✅ | `feat(web): surface A1/N1 plain readings` | "당신의 사주 프로필" 블록으로 A1/N1 실제 서비스 노출 |

### S4 코퍼스 롤아웃 (남은 작업 — 동일 패턴·검증 반복)

강약 평문은 **서술적 색채**로만(조언이 강약 방향에 의존 X → 5개 값 전부 참). 용신 개수는
**중립 사실 문장**("힘이 되는 {{yongshinName}} 기운은 {{yongshinCount}}개라…", 0개에서도 일관).
카테고리별로 게이트+pairing+bench 그린 확인하며 확장:

- [x] overall/thisYear (성인 3밴드) — 시연
- [ ] overall/{today,thisWeek,thisMonth,life,stages}
- [ ] wealth·health·career·romance·family·academic·study_document·expression_children·health_stress·movement
- [ ] teen/child/stage-* 밴드 (미성년 안전어휘 게이트 동시 준수)

> A1 `personalReading`이 이미 매 리포트에 강약 평문을 중앙에서 전달하므로, 본문 강약 weave는
> **중복이 아니라 문맥별 풍미**다. 급하지 않게 사람 리뷰와 함께 점진 확장한다.
