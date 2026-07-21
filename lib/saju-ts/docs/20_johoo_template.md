# 20. 조후용신표(窮通寶鑑 120셀)와 조후 정책

> **문서 지위**: 학파 프리셋 출처 정본(in-repo compilation).
> **검토 상태**: 편찬 초안 — 독립 전문가 검토 대기 (검토 완료 전 이 문서는 교리 '해설'이며 외부 권위 인증이 아님).
> **편찬일**: 2026-07-10 (사주 엔진 무결성 감사 PR #653, P0-4)
> **관련 프리셋**: `johoo`, `johoo.strict`, `ditiansui`, `qiongTongBaoJian` (src/schools/packs/builtin.pack.json)

## 1. 교리 요약

조후(調候)는 사주 원국을 "계절 환경 속의 생명"으로 보고, 월지(月支)가 규정하는 한난조습(寒暖燥濕)의
불균형을 먼저 진단하여 그 결핍을 채우는 오행·천간을 용신(用神)으로 삼는 방법론이다. 핵심 명제는:

1. **월령 환경 우선**: 겨울생은 따뜻함(火)이, 여름생은 적심(水)이 먼저 필요하다는 취지 —
   한난이 중화를 얻어야 만물이 발육한다는 논술(『滴天髓闡微』 寒暖·燥濕 절)에 근거한다.
2. **주용신(主用)과 보좌(佐)의 위계**: 조후 전통은 오행이 아니라 **천간 단위**로 답을 준다.
   같은 火라도 丙(태양)과 丁(등촉)을 구분하며, 각 일간×월지 조합마다 제1후보(주용신)와
   차순위 후보(보좌)를 명시한다. 『窮通寶鑑』의 월별 희용 제요(喜用提要) 형식이 그 정형이다.
3. **조후 위급(調候為急)**: 기후 결핍이 극단이면 억부(抑扶)·격국(格局) 등 다른 판단축보다
   조후를 앞세운다. 「調候為急」은 조후 학파에서 널리 전승되는 관용 문구다.

## 2. 고전 근거

- **『窮通寶鑑(궁통보감)』** — 이 문서와 엔진 표의 1차 전거. 원류는 『欄江網(난강망)』이라는
  제목으로 전승된 실전(實戰) 초본 계열로, 청대 余春台(여춘태)가 정리·간행하면서 『窮通寶鑑』으로
  개제되었다는 전승이 통용된다. 근대 徐樂吾(서락오, 1886–1949)의 평주본(『窮通寶鑑評註』,
  같은 원문의 별계 평주 『造化元鑰』)이 현대 통용본이며, 일간 10간 × 월 12지 = **120 조합**
  각각에 주용신/보좌 천간을 요약한 "조후용신표"는 이 평주본 계열에서 정리된 형태다.
  예: 乙木이 巳월에 나면 癸水를 전용(專用)한다는 취지의 「專用癸水 調候爲急」(희용제요, 乙巳 조).
- **『滴天髓(적천수)』** — 조후를 독립 표가 아니라 원리(한난조습의 중화)로 논한다. 원문 전승에
  이설이 있어(京圖 찬 전승·劉伯溫 주 전승) 저자 단정을 피하며, 任鐵樵(임철초) 增註
  『滴天髓闡微』가 통용본이다. `ditiansui` 프리셋이 조후를 여러 축 중 하나로 켜는 근거.
- **『子平真詮(자평진전)』**(沈孝瞻, 淸) — 「用神專求月令」(원문 「八字用神，專求月令」의 축약 통용형). 월령 중심성이라는 전제를 조후와
  공유하지만, 월령에서 십성 격국을 읽는 노선이므로 조후표와는 **별개 판단축**이다(문서 19 참조).
- 보조 관용구: "夏不離水, 冬不離火"(여름은 水를, 겨울은 火를 떠나지 못한다), "冬生要丙, 夏生要癸"
  류의 격언은 궁통보감 계열 교습에서 전승되는 **현대 요약 격언**으로, 특정 고전의 축자
  원문으로 단정하지 않는다. 엔진의 간이 경로(3절)는 이 격언 수준의 축약이다.

저작권: 위 고전 원문은 모두 저작권이 소멸한 공용 도메인(public domain)이다. 단, 徐樂吾 평주·
임철초 증주 등 근·현대 평주본의 **평주 텍스트와 편집물 자체의 저작권은 별개**이므로, 본 저장소는
평주문을 전재하지 않고 표의 결론(주용신/보좌 천간)만 채록하며 원문 인용은 단문에 한정한다.

## 3. 엔진 구현 대응

### 3.1 표 데이터 (120셀)

- 파일: `src/rules/packs/johooQiongTongBaoJianTable.ts`, 상수 `QIONG_TONG_BAO_JIAN_TABLE`.
- 徐樂吾 평주본 계열 통용 조후용신표를 채록. `Record<StemHanja, Record<BranchHanja, JohooMonthCell>>`
  타입이라 셀 누락은 컴파일 에러가 된다. 셀 형태는 `{ primary: 천간 1자, secondary: 천간 0..4자
  (원문 우선순위 순), note?: 판본 이설 메모 }` — `note`는 설명용이며 산출에 관여하지 않는다.
- 채록 방식: **독립 이중 저작 + 대조**(감사 B12, PR-4). 두 저작본 대조에서 불일치는 2셀
  (甲巳·甲午의 보좌 **순서**)뿐이었고, 희용제요 원문 인용으로 확정했다(해당 셀 note에 기록).

### 3.2 조회 경로와 간이 경로 (src/rules/johooTemplate.ts)

`computeJohooTemplate(config, { dayStem, monthBranch, climateScores })`가 조후 템플릿을 계산한다.
정책 키는 `strategies.yongshin.johooTemplate.*`:

| 키 | 의미 | 기본값 |
|---|---|---|
| `enabled` | 템플릿 경로 활성화 | `false` |
| `monthTable` | `'qiongTongBaoJian'`(내장 120셀) 또는 인라인 부분 테이블 | `null` |
| `monthTablePrimaryBoost` | 주용신 오행 가산 | `0.5` |
| `monthTableSecondaryBoost` | 보좌 오행 가산(원소별 1회) | `0.25` |
| `seasonMandatoryBoost` | 간이 경로: 冬→火/夏→水 가산 | `0.35` |
| `stemPreferenceBoost` | 간이 경로: 천간 선호 가산 | `0.25` |
| `enforceSummerWinter` | 간이 경로: 冬丙/夏癸 힌트 주입 | `true` |
| `monthTableOverride` | 내장 표 위 셀 단위 패치 | — |
| `stemPreferencesOverride` | 간이 경로 선호표 교체 | — |

- **셀 적중 시 완전 대체**: 120셀이 적중하면 간이 경로의 세 힌트(계절 필수 오행,
  互不離 천간 선호, 冬丙/夏癸)를 통째로 대체한다. 겨울 셀은 이미 火 계열 천간을 수록하므로
  힌트를 중첩하면 FIRE가 과대 가산된다 — **이중 가산 금지**가 설계 원칙이다.
- **보좌의 원소별 1회 가산**: 같은 오행의 보좌 천간이 여러 개라도 오행 점수에는 한 번만
  반영한다. 보좌 개수로 주용신 오행이 역전되면 `monthTable.primaryStem`과 최상위 `primary`가
  모순되기 때문이다.
- 간이 경로의 `DEFAULT_STEM_PREFERENCES`(甲→庚, 乙→癸, 丙→壬, 丁→甲, 戊→甲, 己→丙, 庚→丁,
  辛→壬, 壬→戊, 癸→辛)는 "互不離"류 관용 짝짓기의 **엔진측 축약본**이며 고전의 축자 목록이
  아니다(5절 검토 항목). 표 미지정·셀 부재 시의 폴백으로만 쓰인다(`monthTableMiss` 사유 기록).
- 결과는 `reasons`에 관측 가능한 사유 문자열(`monthTable:甲寅:丙(癸)`, `seasonMandatory:WINTER`,
  `stemPreference:甲`, `seasonStemHelper:WINTER:丙` 등)을 남긴다.

### 3.3 template-only 근거 분리 (일반 climate 보정과의 이중 적용 제거)

- 일반 기후 보정은 별도 모듈이다: `src/rules/climate.ts`의 `DEFAULT_CLIMATE_MODEL`이 월지별
  환경 벡터(temp/moist 2축)와 오행 효과 벡터를 정의하고, `computeClimateScores`가
  need(=−env)와의 내적으로 오행 점수를 낸다. 이는 고전 표가 아니라 **현대적 공학 모델**이다.
- `computeJohooTemplate`의 반환값은 두 층을 분리해 노출한다: `bonus`(표/힌트 **순수** 가산 벡터,
  기후 내적 미포함)와 `combinedScores`(bonus+climate, 설명용), 그리고 각각의 순위
  `templatePrimary/templateSecondary` vs `primary/secondary`.
- 용신 합산(`src/rules/yongshin.ts`)에서 템플릿 항은 순수 벡터만 쓴다:
  `templateBonus = tpl?.bonus`(849행) → `templateTerm = effectiveWeights.johooTemplate *
  templateBonus[e]`(1230행). 기후 내적은 `climateTerm = effectiveWeights.climate *
  climateFacts.scores[e]`(1226행)로 **별도 가중·별도 항**이다. 두 항의 합이 방법군 기여
  `methodTerms[e].JOHU`(1238행)로 집계되어 `primaryMethod` 판정(감사 A2·B6)에 쓰인다.
- 배선: `src/rules/facts.ts` 3935–3941행에서 `computeClimateFacts` → `computeJohooTemplate`
  순으로 계산해 `facts.climate.template`에 부착한다.

### 3.4 조후 위급(調候為急) — urgency 정책

- 기후 결핍 크기 `climateMagnitude = ‖need‖`(yongshin.ts 723행)가 임계 초과 시
  `factor = clamp01((magnitude − threshold) / (1 − threshold))`로 연속 승압한다:
  climate 가중 ×(1 + maxBoost·factor), 여타 방법 가중 ×(1 − reduceOthers·factor).
  레거시 경로 `strategies.yongshin.climateUrgency`(1184–1207행)와 meta-selector 경로
  `strategies.yongshin.methodSelector.climate`(892행~)가 같은 수식을 공유한다.
- `methodSelector.johooTemplate.scaleBy`(1002–1015행): `'climate'`면 템플릿 항을 위급
  factor에 **연동**(위급하지 않으면 표 가산도 0으로 수렴), `'always'`면 상시 적용.

### 3.5 프리셋별 수치 (src/schools/packs/builtin.pack.json)

| 프리셋 | climate/johooTemplate 가중 | urgency(thr/boost/reduce) | scaleBy | monthTable |
|---|---|---|---|---|
| `johoo` | 1.2 / 0.55 | 0.55 / 1.25 / 0.2 | `climate` | 없음(간이 경로) |
| `johoo.strict` | 1.45 / 0.85 | 0.5 / 1.35 / 0.35 | `always` | 없음(간이 경로) |
| `ditiansui` | 0.7 / 0.35 | 0.55 / 1.1 / 0.2 | `climate` | 없음(간이 경로) |
| `qiongTongBaoJian` | (johoo.strict 상속) | (상속) | (상속) | `'qiongTongBaoJian'` + 0.5/0.25 |

기본 프로필은 `weights.johooTemplate=0` + `johooTemplate.enabled=false` 이중 가드로 무파급이다.

## 4. 학파 이설과 프리셋 선택지

- **조후를 어느 강도로 쓸 것인가**: `johoo`(조후 우세, 억부 잔존) ↔ `johoo.strict`(조후 최우선,
  「調候為急」 강경 해석) ↔ `ditiansui`(조후를 扶抑·通關·從勢와 병렬하는 종합 노선 — 적천수
  계열이 조후를 원리로만 다루는 성격의 반영) ↔ `qiongTongBaoJian`(표 조회까지 켠 정통 노선).
- **표 판본 이설**: 통용표는 전재본마다 소차가 있다. 채록된 대표 사례 — 甲巳·甲午 보좌 순서
  (庚丁 vs 丁庚), 乙巳 보좌(원문 癸 전용 vs 한국 아부태산(阿部泰山) 계열의 庚辛 추가),
  辛丑(丙 누락 전재본), 辛子(甲 생략 전재본), 甲卯 보좌 구성. 모두 셀 `note`에 기록했고,
  이설을 따르려면 `monthTableOverride`로 셀 단위 패치하면 된다.
- **월내 시간 분해 이설**: 원문이 상반월/하반월로 우선순위를 바꾸는 조합(乙酉, 壬丑)이 있으나
  현재 셀은 단일 우선순위만 수록한다(note로만 보존). 지지 대신 절기 심도 기반 분기는 미구현.
- **간이 경로 대 표 경로**: 간이 경로(冬火/夏水 + 천간 선호)는 표의 경향을 2~3개 규칙으로
  압축한 근사이며, `qiongTongBaoJian` 프리셋은 이를 셀 단위 정본 조회로 대체한다.

## 5. 한계와 검토 항목

**현재 검증 상태**: (a) 독립 이중 저작 + 대조로 120셀 채록(불일치 2셀은 원문 인용으로 확정,
감사 B12/PR-4). (b) `src/rules/johooTemplate.test.ts`가 120셀 완전성·천간 유효성·주용신 오행
정합·간이 힌트 대체·오버라이드 병합을 회귀 고정. (c) 본 문서는 release 게이트
`npm run validate:school-sources`(tools/validate_school_sources.mjs)의 대상 파일이다.

독립 검토자 체크리스트:

- [ ] 120셀 전수를 徐樂吾 평주본 인쇄본(또는 신뢰 가능한 영인본)과 축자 대조 — 현재 채록은
      웹 전재본 교차 확인 기반이며(표 파일 헤더의 참조 소스 목록), 인쇄 판본 대조가 남아 있다.
- [ ] `note`에 기록된 이설 셀(甲巳, 甲午, 乙巳, 甲卯, 丁辰, 戊亥, 辛酉, 辛亥, 辛子, 辛丑, 癸巳,
      癸申 등)의 판본 계보 확정 및 기본값 선택의 타당성 심사.
- [ ] 상반월/하반월 분기(乙酉, 壬丑)의 구현 여부 결정 — 구현 시 절기 심도 파라미터 설계 필요.
- [ ] 간이 경로 `DEFAULT_STEM_PREFERENCES`의 짝짓기 근거 심사 — 고전 축자 목록이 아닌 엔진
      축약임을 확인했고, 표 경로가 켜지면 폴백으로만 쓰이나 `johoo`/`johoo.strict`의 기본
      경로에서는 여전히 활성이므로 교리 적합성 검토가 필요하다.
- [ ] `climate.ts`의 temp/moist 수치는 현대적 추정치로 고전 전거가 없다 — 조후 '환경 진단'을
      이 모델에 위임하는 것의 타당성과, `scaleBy: 'climate'`가 표 가산을 위급 신호에 연동하는
      정책이 「調候為急」 해석으로 적절한지 심사.
- [ ] 가중치 수치(1.2/0.55, 1.45/0.85, 0.5/0.25 등)는 교리가 아니라 엔진 캘리브레이션 값임을
      사용자 노출 문구에서 혼동하지 않도록 표기 검토.

**정직성 고지**: 이 문서는 saju-ts 저장소 내부에서 편찬한 해설이며, 외부 학회·감정가 단체의
승인이나 인증을 받은 바 없다. 위 체크리스트 완료 전까지 상용 문구에서 "고전 원문 검증 완료"
류의 표현을 사용해서는 안 된다.
