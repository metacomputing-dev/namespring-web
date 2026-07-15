# 진리값 패널·판결·채굴 도시에 (2026-07-10)

> **지위**: NO_AI_POLICY v2(커밋 9c8da13b7)의 "완전 공개 패널-판결 기록"이 요구하는 **in-repo 도시에(증거 층)**.
> 이 문서는 다중 모델 AI 교차검증의 증거이며, **외부 인간 전문가 인증이 아니다**. authority truth로의
> 승격에는 이 도시에 경로 + `sourceType: ai_panel_adjudicated_interpretation` + `aiGenerated: true` +
> 2개 이상 패널 모델 + `adversarialVerification: true` + **소유자 authorityReview 승인**이 동시에 필요하다
> (`tools/check_no_ai_policy.mjs`가 기계 검증).

## 1. 무엇을 만들었나

17개 baseline 픽스처(fix-01~fix-17)의 **권위 진리값**(강약·용신·격국 + 서술 클레임)을 엔진과 독립적으로
도출하고, 10개 픽스처에서 확인된 11개 필드 불일치를 판결했으며, 종격(從格) 권위 코퍼스 후보 채굴 2차분을 적대 검증했다.

### 패널 구조 (105 에이전트, 전원 완료)
- **블라인드 3렌즈 분석** (17×3): 억부/조후/격국 렌즈. 입력은 `truth-panel-blind.json`(출생정보+KASI 검증
  4주 간지만 — 엔진 판정 미제공)이라 엔진 출력에 오염되지 않은 독립 판정.
- **화해자** (17×1): 3렌즈를 필드별 2+ 일치로 합의. 실패 필드는 빈 문자열 + 이설 기록. D2용
  narrativeClaims(mustIncludeAny/mustNotMatch) 병행 제안.
- **적대 검증 2렌즈** (17×2): 교리 반증(자평진전·궁통보감·적천수) + 실전 관행 반증.
- **假從 정책 패널** (3): 아래 §4.
- 모델: Claude Fable 5 (claude-fable-5). 교차 모델: Codex gpt-5.5 high (§3).

### 산출 파일
| 파일 | 내용 |
|---|---|
| `truth-panel-blind.json` | 패널 입력(블라인드): 17픽스처 출생정보+4주 간지 |
| `truth-panel-input.json` | 판결용 입력: 픽스처별 birth/pillars + 엔진 판정값 |
| `truth-panel-output-final.json` | **패널 진리값 최종본**: fixtures[17](analysts 3·rec·verifiers 2) + policyVotes[3] |
| `mismatch-verdicts-final.json` | **불일치 판결 11필드/10픽스처 + 종합(synthesis)**: 엔진 트레이스 실측 기반 분류 |
| `codex-truth-input.json` / `codex-truth-verdicts.json` | Codex 교차검증 입력/판정 (17픽스처 × 3필드) |
| `mining-output-final.json` | 종격 채굴 2차 최종: ACCEPT 46 / HOLD 5 / REJECT 0 (후보별 적대검증 결과 포함) |
| `corpus-intake-draft.json` | 신규 후보 N-01~N-15 intake 초안(양력 환산·suggestedEnum 포함) |
| `verify-mining-r2.ts` | N-01~N-15 달력 정합 검증 스크립트 — 실측 **14/15 MATCH** (§5) |

## 2. 판결 결과 (mismatch-verdicts-final.json)

분포: **ENGINE_BUG 3 / CALIBRATION 6 / DOCTRINE_AMBIGUITY 2 / PANEL_ERROR 0**. 판결자는 실제로
`analyzeSaju` 트레이스를 열어 성분값을 확인한 후 분류했다(프롬프트 강제).

| 픽스처 | 필드 | 판결 | 요지 |
|---|---|---|---|
| fix-02 | 격국 | DOCTRINE_AMBIGUITY | 정관격 vs 편관격 — 진리 필드 드랍 또는 양쪽 허용 권고 |
| fix-03 | 강약 | CALIBRATION | 囚<休 서열 역전 + 월령 과소가중 |
| fix-04 | 강약 | ENGINE_BUG | **일간 자기 셈입**(비견 +1.0) — 제거만으로 판정 반전 |
| fix-05 | 강약 | DOCTRINE_AMBIGUITY | band 일치, hedge 방향만 분쟁 — hedge 비게이팅 권고 |
| fix-05 | 용신 | CALIBRATION | 조후 가중 수학적 열세(위급 게이트 발화해도 억부 못 이김) |
| fix-07 | 격국 | ENGINE_BUG | 월겁격 오배속(寅은 丁의 겁재 아님 — 정인) |
| fix-09/10 | 용신 | CALIBRATION | flat strongPref(강약 원인 무조건화) — 관성 용신 구조적 패배 |
| fix-11 | 격국 | ENGINE_BUG | 건록격 오발화(戊 록은 巳, 申 아님) + 일간 투간 자기판정 |
| fix-15/16 | 강약 | CALIBRATION | 일간 자기 셈입 + 월령 과소가중 복합 |

**종합(synthesis) 핵심**: 오류는 원시 테이블이 아니라 **집계·중재 층**에 있다.
1. **1층 — 일간 자기 셈입** (`saju-ts/src/core/scoring.ts:106-113` → `rules/facts.ts:2384`):
   support에만 +1.0 상수가 붙는 **단방향 강측 편향**. 반사실 실측: 제거만으로 fix-04 +0.035→−0.097(반전),
   fix-16 +0.119→−0.009(사실상 반전), fix-15 0.227→0.117.
2. **2층 — deLingDiShi 월령 과소가중**: 실령 페널티 support측 −14.4%(lingScale 0.18)에 그치고 압력측
   계절 가중 전무. 부수: 囚(−0.3)<休(−0.6) 왕상휴수 서열 역전, 무근 천간 만점+득세 이중 가산.
3. **용신 3기제**: 조후 구조적 열세(`rules/yongshin.ts:317` climate 0.25 + `:327-332` maxBoost 1.0 —
   극한에서도 0.5 vs 1.5), flat strongPref(`:701-707` — 비겁 주도/인다 신강 무구분), deficiency 항의
   억부 대체. 엔진 내부 johu축은 4건 전부 정답(FIRE)을 이미 계산하고 있었음.
4. 같은 "일간 자기 증거 셈입" 결함이 강약과 격국(fix-11 투간 판정)에서 **독립 반복** — stem 리스트
   소비처 전수 감사 필요.

## 3. 교차검증 (2번째 모델 — Codex gpt-5.5, reasoning high)

> **증거 한계 정정**: Codex 입력에는 패널의 `expected`와 `reasoningSummary`가 포함되어 있었다.
> 따라서 아래 결과는 독립 블라인드 재도출이 아니라 **앵커링된 적대 검토**다. 수정 가설의
> 교차 점검에는 쓸 수 있지만, 이 결과 단독으로는 외부 명리 전문가 인증이나 authority truth 승격 근거가
> 아니다. 전체 패널 기록·도시에·소유자 승인과 결합될 때만 정책상 패널 판결 증거의 일부로 사용할 수 있다.

패널 합의(expected)를 Codex가 대조한 17픽스처 × 3필드 = 51판정 중
**CONFIRM 46 / WEAKEN 2 / REJECT 1 / SKIP 2**.
- REJECT 1: fix-02 격국(패널 편관격을 정관격으로 반박) — §2의 fix-02 DOCTRINE_AMBIGUITY 판결과 **방향 일치**,
  드랍/양쪽허용 처리를 이중으로 지지.
- WEAKEN 2: fix-01 격국(정관격 이설), fix-06 용신(조후 水 이설·양인격 지적).
- 내부 adversarialVerification 메타는 패널 자체 적대 2렌즈(교리·관행) + Codex 대조를 뜻한다.
  서로 독립된 외부 전문가 2인의 검토를 뜻하지 않는다.

### 3.1 fix-04 메타데이터 정정

원 입력의 `丙火 / yang-fire / summer` 표기는 실제 출생 계산과 모순이다. 실제 명식은
`乙巳 甲申 甲午 癸酉`, 일간은 **甲木**, 월지는 **申(가을)**이다. 패널 판결은 실제 pillars와
트레이스를 사용했으므로 자기 셈입 결론에는 영향이 없지만, 원 입력 JSON은 감사 이력 보존을 위해
수정하지 않는다. 정본 픽스처 메타는 `strength-direction / yang-wood / autumn`으로 바로잡았다.

## 4. 假從 정책 패널 (D6 선행 결정 — 소유자 승인 대기)

질문: 저자가 假從(가종)으로 판정한 사례를 종격 게이트 분모에 산입할 수 있는가.
**3표 만장일치 `INCLUDE_WITH_FRAMEQUALITY`** (고전 원전주의 / 실전 관행 / 측정 방법론 관점 각 1표).
공통 조건(전문은 `truth-panel-output-final.json` policyVotes):
1. frameQuality(TRUE_FOLLOW/PSEUDO_FOLLOW/UNSPECIFIED)는 **저자 원문의 명시 어휘로만** 기록(추론 금지).
2. frameQuality는 당분간 **비게이팅 진단 전용** — 엔진에 眞/假 출력 필드가 없으므로 매치 기준은
   CONG_* 타입 일치 단일 축 유지.
3. **正格 음성 대조군** 병행(가종 편중 코퍼스의 임계 하향 편향 상계).
4. 從勢 혼합·假從化(HUA_QI 계열)는 enum 매핑 확정 전 분모 제외.
5. 단일 저자 분모 상한 50%(현 魏多亮 편중 완화), 眞從 최소 쿼터 검토.
6. 게이트는 적천수 계열 프리셋(jonggyeok.calibrated)에만 적용 — 엄격론 프리셋의 비승격은 정당한 학파 거동.

고전 근거: 『적천수』 假從章 「真從之象有幾人 假從亦可發其身」 — 假從은 종격 담론 내부의 장(하위 유형).
반대 전거(자평진전 엄격론)는 학파 축 문제로, 코퍼스 저자들과 calibrated 프리셋이 모두 적천수 계열이므로
분모 기준으로 끌어오지 않는 것이 타당하다는 논증.

## 5. 채굴 2차 + 달력 정합 (mining-output-final.json)

5채널(魏多亮 아카이브/张平易经/중국어 기타/한국어/고전·현대서) 채굴 → 후보별 적대 재검증
(인용 실재 자구 대조·오호둔/오서둔 정합·음양력 환산 개연성·종격 판정 여부·중복).
최종 **ACCEPT 46 / HOLD 5 / REJECT 0** (기존 9건 제외 신규). 주요 광맥: 魏多亮 실전명례 확장분,
**이재승 KCI 논문 2편**(인문사회21 9(1)·9(2), 2018 — 한국어 T3 학술 소스, 종강/종세/가종재/화격 등 9건).

달력 정합(clock-time fidelity): 신규 N-01~N-15 중 **14/15 MATCH**. 유일 불일치 N-15는 야자시
시두법(일주 유지+익일 시간두) 사례로 정자시설 엔진과의 **예상된** 차이 — JOJA_SPLIT(aac1b8309) 옵션
경로로 별도 프로브 예정. 입춘 경계일(N-09)·음력 환산(N-12)·23시 환일(N-06) 전부 일치.

## 6. 진리값 소비 지침 (다음 세션용)

- **authority truth 파일 저작** (`test/baseline/authority/<fixture-id>.json`): `expected`는
  `truth-panel-output-final.json`의 fixtures[].rec.expected에서, narrativeClaims는 rec.narrativeClaims에서.
  단 **fix-02 격국은 드랍 또는 {정관격,편관격} 양쪽 허용**, **fix-05 강약은 band(중화)만 단언**(hedge
  방향 비게이팅) — §2 DOCTRINE_AMBIGUITY 판결과 §3 Codex REJECT에 따름. 합의 실패로 빈 문자열인
  필드는 그대로 비워 N/A 유지(fail-closed).
- 레코드 필수 메타(NO_AI_POLICY v2): `sourceTier.sourceType: ai_panel_adjudicated_interpretation`,
  `sourceTier.aiGenerated: true`, `sourceTier.authorityTruthEligible: true`,
  `sourceTier.panelAdjudication.models: ["claude-fable-5", "gpt-5.5"]`,
  `sourceTier.panelAdjudication.adversarialVerification: true`,
  `sourceTier.panelAdjudication.dossier: "docs/dossiers/truth-panel-2026-07-10/README.md"`,
  소유자 `sourceTier.authorityReview` 승인 — 하나라도 빠지면
  `check_no_ai_policy`가 차단(의도된 fail-closed).
- **엔진 수정 우선순위**: §2 종합의 1층(일간 자기 셈입)부터. 판정 파급이 크므로 GUIDE §1 계측 절차
  (measure_default_change) 필수. DOCTRINE_AMBIGUITY 2건은 **수정 금지**(이설 보존).

## 7. 재현성·한계

- 생성 세션: 2026-07-10 (Claude Code 워크플로 wf_9559e849/wf_ebb50f05/wf_f5827769 + 재개 wf_34369ed6).
  중도 디스크 풀(C: 0GB)로 1차 실행이 부분 실패했고, 같은 프롬프트 자구 재실행으로 완결 — 프롬프트는
  워크플로 저널에 보존.
- 한계: ① 패널·판결·교차검증 모두 AI — 소유자 서명 전까지 authority truth 아님 ② 채굴 코퍼스의
  단일 저자(魏多亮) 편중 — §4 조건 5로 완화 예정 ③ Sina 블로그 소멸 리스크 — intake 시
  web.archive.org 아카이브 선행 필요 ④ HOLD 5건은 근거 부족이 아니라 접근 실패/경계 사례로,
  재시도 가치 있음.
