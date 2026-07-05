# 설계: 대운-정통 라이프플로우 + 인사이트 확장 레이어 (v1 확정안)

> 2026-07-05. 11-에이전트 검증 워크플로(8 서브시스템 정독 + 3렌즈 적대 검증)를 거친 확정 설계.
> 원안의 치명 결함 4건(축 불일치·스탬핑 재노출·재과금 churn·입춘 오차)을 교정한 버전.
> 근거 감사 결과: 세션 로그 `wrq7v7d71.output` (verdicts: V1/V2/V3 모두 needs-changes → 반영됨).

## 0. 문제 정의 (실측 확정)

1. **나이대별 흐름의 3층 어긋남**: 그래프 별점은 정통 대운 계산(三日一歲·순역·용신 대비,
   `saju-ts/fortune/compute.ts`)인데, 선택 UI는 달력 10년 구간 하드코딩, 콘텐츠는 등급 무시
   (stage 전부 band=`any`) + classId 축 불일치로 **재생성 콘텐츠가 화면에 0% 도달**
   (베이스 "N세 구간은…" 템플릿 폴백 — 6분야 공유 골격이라 반복 노출).
2. **미사용 엔진 출력**: 신살·공망·합충형파해·지장간·대운 정체가 계산되지만 유료 서사에 미사용.
   추후 해석을 유연하게 충전할 배관이 없음.

## 1. 확정 방향 (3-Phase)

### Phase 1 — 즉시 배선 수정 (코드만, 생성 비용 0)

**1-A. 라이프 커브 카드** (`lifeCurve`, 신규 엔진 카드)
- age 0..100 각 나이: `score = round((W_DAEUN*대운등급 + W_SEUN*세운등급) * 20)` (0~100).
  - `W_DAEUN=0.6, W_SEUN=0.4` — **제품 휴리스틱임을 주석 명시, 상수 분리** (고전 근거 없음).
  - 대운등급: 기존 `getFortuneGrade`(천간) + `adjustGradeForBranch`(지지) 재사용.
  - **세운 소스 = `saju.saeunPillars`** (입춘 경계 반영, 120년치 기계산 — `policy.ts:11`).
    `getYearlyFortune` 달력연도 fallback 사용 금지 (1/1~입춘 구간 1년 오차).
  - **세운도 천간+지지 등급** (대운과 동일 산식) — 천간 10년 주기가 대운 길이와 공진해
    생기는 동일-리플 인공물 제거 (지지 포함 시 60년 주기).
  - **기운(起運) 이전 나이** (0~firstDaeunStartAge): 대운 성분 제외, 세운 단독(가중 재정규화).
    `lifeFortuneElementForAge`의 미개시 1대운 소급 fallback 사용 금지.
  - 대운 경계는 소수 나이 그대로 커브 전환점에 사용, **표시용 나이는 floor로 통일**
    (기존 `life-stage-fortune-card` 표시 규약과 일치).
- 반환: `{points: [{age, calendarYear, score, daeunIndex, seunGanzhi}], daeunSegments: [...]}`.
- 전제 공용화: `adjustGradeForBranch`/`gradeToStars`를 `fortuneCalculator.ts`로 추출·export
  (현재 카드 2곳에 프라이빗 중복 — 3중 복제 방지).
- **점수 정본 규칙**: 별점(칩·분야 카드)=기존 산식이 정본. 커브는 시각화용 파생 참고선.
  같은 화면 3점수 체계(칩 stars/카드 stars/커브)의 서열을 문서·주석으로 명시.

**1-B. 선택 축 = 개인별 대운 구간** (UI 변경 허용됨)
- 칩: 하드코딩 10구간 → `lifeStageFortune.stages`(개인 대운, 가변 개수). **양 경로 모두**
  (매트릭스 경로 + 레거시 경로 `CombiedNamingReport.jsx:448-454`).
- 분야 카드 바인딩: **`byDaeun` 스코프 셀 신설** (byAgeBand는 호환용 병존·점진 폐기):
  - 대운 구간별로 `buildAgeBandScoped` 상당을 호출하되 `periodLabel = 대운 라벨("N세~M세")`
    (칩 '27~36세' vs 본문 '30~39세' 불일치 해소 — 베이스 문안이 {{periodLabel}} 직조하므로).
  - `representativeAge = floor((startAge+endAge)/2)` (중점 — 채점 나이가 항상 구간 내).
  - repAge<10 → stage 매핑 '10-19'로 클램프. 0세~기운 전 클릭 → 첫 대운으로 스냅.
- 커브 렌더 (`LifeFlowChart` 개정): ~100점 입력, 라벨은 10년 단위만 조건부, 원은
  대운 경계+선택점만, 키보드 탭 스톱은 대운 단위, y도메인 0-100 고정(min-max 증폭 제거),
  `slice(0,10)`·`${startAge}대` 라벨 제거. 클릭 = 해당 나이의 대운으로 스냅.

**1-C. stage 콘텐츠 런타임 도달 수정** (핵심 버그픽스)
- 원안 "band→any 재시도"는 **불충분** (검증에서 기각): stage 클래스는 매니페스트 축소축
  (강약 {weak,strong}만 · nameEffect adverse 없음 · gender 항상 'x')로만 존재하는데
  런타임 classId는 사람 실측 축 사용 → romance/family 성인 전원(성별 토큰), balanced 전원,
  adverse 전원이 미스.
- **확정안: stage-* 오디언스 전용 classId 코어스닝** (`class-axes.ts`):
  - gender → 'x' 강제, band → 'any'. (매니페스트 규칙 미러링)
  - balanced 강약 / adverse 이름효과는 **클래스 자체가 없음** → 베이스 폴백 수용
    (adverse를 neutral로 뭉개는 매핑은 이름효과 정직성 위반이라 금지).
- **provenance 게이트**: `getGeneratedArticle`에서 `sourceNote`가 `regen-` 접두인 것만 채택
  (팩에 sourceNote 보존됨 — `pack-generated.ts:44-46`). 스탬핑 코퍼스(academic 등 미재생성
  분야) 재노출 방지. 효과: 전 리포트에서 스탬핑 문구가 즉시 사라지고 베이스로 폴백,
  S3 진행에 따라 재생성분이 자동 승격. ※ 미재생성 분야의 개인화가 일시 감소(베이스 품질) —
  의도된 트레이드오프.
- **브라우저 preload 보강**: 성별 민감 분야(romance/family)에서 사람 packKey 외에
  gender→'x' 팩 추가 fetch (gangyak∈{weak,strong} && nameEffect≠adverse일 때만).
  Node(fs 직독)와 브라우저의 동작 비대칭 해소. 조회 memoise.

**1-D. 베이스 stages 문안 골격 탈피** (F2 해소, 30개 재작성)
- 6분야 × 5생애단계 `stages.articles.json`의 "{{periodLabel}} 구간은 …때예요" 공유 골격을
  분야별 상이 문형으로 재작성 (기존 게이트·검증 통과 필수). high/low 변형은 Phase 3에서.

**1-E. 테스트 편입**
- compat 12섹션 고정 테스트에 새 카드(lifeCurve/insightFacts) 반영,
- 미성년 안전 스캔(`service-visible-output.test.ts` minorServicePayload 열거)에 새 섹션 편입,
- `tiered-class-axes.test.ts`에 stage 코어스닝 픽스처 추가,
- 결정성 픽스처 갱신.

### Phase 2 — 확장 구조 준비 (생성 비용 0, 빈 구조 랜딩)

**2-A. insightFacts 카드** (미사용 출력의 정규화 방출)
- `buildFortuneReport`에 safeCall 카드 추가: SajuSummary에 **이미 존재하는 계산값만** 방출
  (신살 히트·공망·천간/지지 관계(합충형파해)·지장간·대운 정체). 신규 계산 없음(E 원칙).
- v1 게이팅: **expert tier 전용 + 미성년 페이로드 제외** (성인성 신살 필터 규칙은 충전 시 정의).
- 해석 레지스트리: `data/articles/insights/<domain>.insights.json` **빈 배열로 생성**
  (신살/관계/공망/지장간 4파일). 로딩은 **신규 glob** (`*.insights.json` — 기존
  `*.articles.json` glob 밖임을 확인함). 렌더 훅: factId 매칭 해석이 있으면 expert 문단 뒤에
  직조, 없으면 무표시(무회귀).
- 해석 충전은 **기존 3층 게이트 재사용 불가** (caseId/번들 구동이라) — 전용 검증기
  (스키마+개별 글 품질 규칙 재사용)를 Phase 3 공수로 계상.

**2-B. 생성 파이프라인 선행조건** (Phase 3 매니페스트 확장 전 필수 랜딩)
1. `bundle-prompt.ts` stage 분기에 BAND_TONE 결합 — **band≠'any'일 때만 활성**
   (Codex의 현행 any-band S3 번들에 무영향).
2. 성인 stage(stage-early~elder)의 audienceSafety를 minor에서 분리 (romance 40~70대
   등급 글에서 연애·결혼 금지어 자기모순 해소). stage-teen은 minor 유지.
3. `prepare-bundles`/`ingest`에 **부분 생성 지원** (번들 내 미완 caseId만 프롬프트,
   기존 regen 파일 보호) — 완성 540편 재과금(~$80 churn)과 Codex in-flight 번들
   rerun 오탐 방지.

### Phase 3 — 충전 (S3 완료 후, 별도 승인·예산)

- 매니페스트 확장: stage×{high,low} 신규 +2,160 클래스 (6분야×5단계×2밴드×36).
  부분 생성 지원 하에 신규분만 생성 ≈ 2,160편, 예상 **$120~180** (API 50% 할인 기준)
  또는 세션 에이전트. **Codex 정지 윈도우에서만** `generate-manifest` 재실행
  (rmSync 전체 재생성 + Codex가 실시간 읽는 디렉터리), totalClasses 21,060 고정 문서
  (REDUCTION_FORMULA/HANDOFF/GENERATION_PIPELINE) 동기화.
- (선택) 베이스 stages high/low 문안 30×2 추가 — 베이스 폴백도 등급 인지.
- 인사이트 해석 충전: 전용 검증기 + 생성 파이프라인 신설 후 도메인별 점진 생성.
- (선택) stage 클래스에 balanced 강약 축 추가 여부 재검토.

## 2. 명시적 비변경 (스코프 밖)

- 대운/세운/신살 계산 엔진 (`saju-ts`) — 정통 확인됨, 무수정.
- 기간별(오늘~올해) 파이프라인 — 정상 동작 레퍼런스.
- Codex S3 진행 중인 `data/generated/romance|family|academic` — 무접촉.
- 매니페스트/클래스 총수 — Phase 3까지 21,060 유지.

## 3. 리스크·트레이드오프 (승인 시 인지 필요)

1. provenance 게이트로 미재생성 분야(academic 등)의 생성 콘텐츠가 일시적으로 베이스 폴백됨
   (스탬핑 제거의 대가 — S3 완료 시 자동 회복).
2. balanced/adverse 사용자의 stage 카드는 Phase 3까지 베이스 문안 (재작성된 1-D 문안이
   그 품질을 받침).
3. 커브 블렌드 가중(0.6/0.4)은 제품 결정 — 상수화로 조정 용이하게.
4. `bundle-prompt.ts` 수정(2-B)은 Codex 편집 파일과 같은 파일 — 커밋 타이밍 조율 필요.
