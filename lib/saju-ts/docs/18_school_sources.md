# 18. 학파 프리셋 고전 서지 총람

> **문서 지위**: 학파 프리셋 출처 정본(in-repo compilation).
> **검토 상태**: 편찬 초안 — 독립 전문가 검토 대기 (검토 완료 전 이 문서는 교리 '해설'이며 외부 권위 인증이 아님).
> **편찬일**: 2026-07-10 (사주 엔진 무결성 감사 PR #653, P0-4)
> **관련 프리셋**: `johoo`, `sanmingtonghui`, `qiongTongBaoJian`, `zipingzhenquan`, `yuhaiziping`, `shenfengTongkao` (src/schools/packs/builtin.pack.json)

## 1. 교리 요약

사주명리학의 학파 구분은 근본적으로 "용신(用神)을 무엇으로, 어떤 우선순위로 잡는가"의 차이다. 본 엔진의 학파
프리셋 6종은 다음 고전 6서를 교리적 준거로 선언한다.

- **조후(調候) 축**: 『窮通寶鑑(궁통보감)』 — 일간×월지 조합의 한난조습(寒暖燥濕)을 먼저 교정한다. 「調候為急」
  이라는 관용 표현이 이 태도를 압축한다. → `johoo`, `qiongTongBaoJian`
- **격국(格局)/월령 축**: 『子平真詮(자평진전)』 — 용신은 월령에서 먼저 구하고(「用神專求月令」), 격의 순용(順用)·
  역용(逆用)과 상신(相神)으로 성패를 판정한다. → `zipingzhenquan`
- **집대성/병행 축**: 『三命通會(삼명통회)』 — 신살(神煞)·납음(納音) 고법과 일간 중심 자평법을 병록(倂錄)한다.
  → `sanmingtonghui`
- **자평 원류·종합 축**: 『淵海子平(연해자평)』(자평법의 초기 집성), 『神峰通考(신봉통고)』(병약설 중심 교정) —
  현 엔진에서는 통합 3축 프리셋에 매핑된 상태다(3절의 '확장 여지' 표기 참조). → `yuhaiziping`, `shenfengTongkao`
- 『滴天髓(적천수)』는 별도 프리셋 `ditiansui`의 준거이나, 자평 계열 전체의 이기(理氣)·세력 순응 논리의 배경
  문헌이므로 서지 총람(2절)에 포함한다.

## 2. 고전 근거 (서지 총람)

각 서적의 시대·저자·판본 계보와 핵심 교리를 요약한다. 원문 직접 인용은 전승이 확실한 관용 문구로 한정하고,
그 외는 패러프레이즈로 서술한다.

### 2.1 淵海子平 (연해자평)
전승상 오대(五代)~북송(北宋)의 徐子平(서자평)이 연 일간(日干) 중심 간명법을, 남송(南宋)의 徐大升(서대승)이
정리·편찬했다고 전한다. 통행본은 명대(明代)에 『淵海』와 『淵源』 두 계열 텍스트를 합본·간행한 계열이다.
격국론의 초기 형태, 신살론, 「繼善篇」 등 시결(詩訣)이 혼재하며, 연주(年柱) 중심 고법에서 일간 중심 자평법으로의
전환을 확정한 최초기 집성이라는 점이 핵심 의의다. 체계가 후대 서적만큼 정합적이지 않아 "종합적 관점"으로
분류된다.

### 2.2 三命通會 (삼명통회)
萬民英(만민영, 자 汝豫, 호 育吾, 명 嘉靖 연간 진사) 찬, 명(明)대 성립, 전 12권. 『四庫全書』 자부(子部) 술수류(術數類)에
수록되어 서지적 전거가 비교적 안정적이다. 납음·신살 등 고법과 일간 중심 자평법을 함께 수록한 백과전서적
집대성으로, 특정 단일 판정법을 강제하기보다 신살과 격국·십성을 병행 참조하는 태도가 특징이다.

### 2.3 神峰通考 (신봉통고)
張楠(장남, 호 神峰, 명) 찬. 통행 서명은 『神峰通考命理正宗』(약칭 『命理正宗』). 사주에 병(病)이 있으면 그것을
치료하는 약(藥)이 되는 글자가 귀해진다는 취지의 병약설(病藥說)을 체계화하고, 개두설(蓋頭說)·동정설(動靜說)
등으로 기존 명서(특히 연해자평 계열 시결)의 오류를 비판·교정한 것이 핵심이다(『神峰通考』 병약 관련 편).

### 2.4 滴天髓 (적천수) / 滴天髓闡微 (적천수천미)
원문 저자는 전승 이설이 병존한다 — 송(宋) 京圖(경도) 찬 전승과 명(明) 劉伯溫(유백온, 劉基) 찬(또는 주) 전승.
청(淸) 任鐵樵(임철초)의 증주본이 사실상의 통용 판본이며, 1933년 袁樹珊(원수산) 교정·간행 『滴天髓闡微』로
널리 유통된다(그 외 陳素庵 집요 계열, 徐樂吾 보주 계열 존재). 천도(天道)·지도(地道)에서 출발하는 자연론적
이기(理氣) 강약론과, 세력이 극단으로 기울면 억지로 거스르지 않고 그 기세를 따른다는 취지의 종화(從化) 논리
(종격·화격)가 핵심이다.

### 2.5 子平真詮 (자평진전)
沈孝瞻(심효첨, 청 乾隆 연간 진사) 찬. 건륭 41년(1776) 胡焜倬(호곤탁)이 심효첨의 수록(手錄) 39편을 얻어
간행했다는 서문 기록이 전하며, 근대에는 徐樂吾(서락오) 평주본 『子平真詮評註』가 통용된다. 「用神專求月令」
(「論用神」 첫머리 「八字用神，專求月令」의 축약 통용형) — 용신은 월령(월지)에서 먼저 구한다 — 이 제1강령이며, 월지 십성으로 격(格)을 세우고 선한 격은 순용, 불선한
격은 역용하며 상신(相神)의 유무로 성격(成格)·패격(敗格)을 판정한다(『子平真詮』 論用神 등). 특수격(외격)의
남용을 경계하는 정격(正格) 중심 태도가 뚜렷하다.

### 2.6 窮通寶鑑 (궁통보감)
원형은 작자 미상의 『欄江網(난강망)』(명대 성립 추정, 강호 초본으로 유통)이며, 청대 余春台(여춘태)가 정리·
간행하며 『窮通寶鑑』으로 명명했다고 전한다. 근대에는 徐樂吾 평주본(『窮通寶鑑評註』, 별계열 『造化元鑰』)이
통용된다. 십간(十干)×십이월(十二月) 120조합마다 기후 조정을 위한 희용 천간을 제시하는 조후용신표가 본체이며,
한난조습의 교정이 급선무라는 「調候為急」의 태도(예: 乙木 巳月에 癸水 전용을 논하며 '調候爲急'이라 명기하는
류의 논술)가 핵심 교리다.

### 2.7 공용 도메인 상태와 현대 평주본 저작권 주의
위 6서의 **고전 원문**은 모두 저자 사후 장기간이 경과해 저작권이 소멸한 공용 도메인(public domain)이다
(가장 늦은 자평진전도 1776년 간행, 임철초 증주도 19세기 성립). 단, **현대 평주·교정·번역본은 별개의 저작물**
이다: 徐樂吾 평주문, 袁樹珊 교정 편집, 각국 현대어 번역서 등은 국가별 보호기간 산정에 따라 아직 보호 중이거나
소멸 시점이 다를 수 있다. 따라서 엔진과 문서는 (a) 고전 원문·관용 문구 수준의 인용, (b) 독립 저작한 데이터
표(2.6의 조후표는 독립 이중 저작 후 공용 도메인 원문과 대조 — src/rules/packs/johooQiongTongBaoJianTable.ts
파일 헤더 참조)만 사용하고, 현대 평주문의 전재(轉載)는 하지 않는다.

## 3. 엔진 구현 대응

프리셋 정의는 모두 `src/schools/packs/builtin.pack.json`에 있으며, `src/schools/packLoader.ts`의
`resolvePreset()`이 `extends` 부모 체인을 재귀 해석해 `overlay`를 deep-merge하고, `include.ruleSpecBlocks`를
`overlay.extensions.ruleSpecs.{target}`으로 부착한다(materialize). 이 문서 자체는 release 게이트
`validate:school-sources`(tools/validate_school_sources.mjs — 프리셋 `sources` 경로의 실재 파일 검증)의 대상이다.

| 프리셋 id | extends | 핵심 overlay/include (builtin.pack.json 실측) | 대응 고전 | 매핑 상태 |
|---|---|---|---|---|
| `johoo` | (없음) | `yongshin.weights.climate=1.2`, `johooTemplate=0.55`, `climateUrgency{threshold:0.55}`, `johooTemplate{enforceSummerWinter:true}`, `methodSelector` | 窮通寶鑑 (조후론) | 교리 축 직접 구현 |
| `qiongTongBaoJian` | `johoo.strict` | `yongshin.johooTemplate.monthTable="qiongTongBaoJian"`, `monthTablePrimaryBoost=0.5`, `monthTableSecondaryBoost=0.25` | 窮通寶鑑 조후용신표 (徐樂吾 평주 계열 120셀) | 표 조회 직접 구현 [감사 B12] |
| `sanmingtonghui` | (없음) | `toggles.fortune=true`, `strategies.shinsal.conditions.enabled=false`(신살 감쇠 완화), ruleSpecBlocks `yongshin.ziping.roleBoost`+`gyeokguk.ziping.monthGyeokTenGod`, `gyeokguk.competition` | 三命通會 (신살/격국 병행) | 부분 근사 — 신살 노출 완화+격국 병행 수준 |
| `zipingzhenquan` | `ziping.strict` | 상속: `yongshin.weights.role=1.05`, `gyeokguk.competition{power:2.3}`(특수격 억제), 월지 투간/회지 격 스코어링 | 子平真詮 | ziping.strict 매핑 (확장 여지) |
| `yuhaiziping` | `integrated.3d` | 상속: 구조(格局)+균형(扶抑)+조후(調候) 3축 가중 | 淵海子平 | integrated.3d 매핑 (확장 여지) |
| `shenfengTongkao` | `integrated.3d` | 상속: 3축 + `yongshin.weights.medicine=0.25`(병약 축 소폭) | 神峰通考 | integrated.3d 매핑 (확장 여지) |

교리별 산출 경로의 코드 정박점:

- **조후(johoo/qiongTongBaoJian)**: `src/rules/yongshin.ts`의 `weights.climate`·`climateUrgency`
  (「調候為急」 대응 부스트; 코드 주석에 '调候为急' 명기)와 `src/rules/johooTemplate.ts`.
  `monthTable='qiongTongBaoJian'` 지정 시 `src/rules/packs/johooQiongTongBaoJianTable.ts`의
  `QIONG_TONG_BAO_JIAN_TABLE`(일간 10×월지 12 = 120셀 완전 수록, Record 타입으로 셀 누락을 컴파일 에러화)을
  dayStem×monthBranch로 조회해 주용신 오행에 `monthTablePrimaryBoost`, 보좌 오행에
  `monthTableSecondaryBoost`를 가산한다.
- **격국/월령(zipingzhenquan)**: ruleSpec 매크로 `monthTenGodRoleBias`(src/rules/spec/compileYongshinSpec.ts)가
  월지 본기 십성→역할 편향을, `monthGyeokTenGod`(src/rules/spec/compileGyeokgukSpec.ts)가 월지 투간/회지 격
  스코어링을 구현한다. `src/rules/gyeokguk.ts`의 `strategies.gyeokguk.competition`(power 2.3)이 특수 프레임
  (종격/화격/전왕) 후보를 상대 억제해 자평진전의 정격 중심 태도를 근사한다.
- **신살 병행(sanmingtonghui)**: `src/rules/shinsal.ts`의 `readQualityModelFromConfig()`가
  `config.strategies.shinsal.conditions.enabled`를 읽고, detection 단위 해석은
  `resolveQualityModelForDetection()`이 수행한다(감사 A7에서 미호출 결함 수정 — 코드 주석에 sanmingtonghui 팩
  언급). `enabled=false`면 충/해/파/원진/형/공망에 의한 신살 감쇠를 끄고 신살을 원형대로 노출한다.

## 4. 학파 이설과 프리셋 선택지

- **조후표 판본 소차**: 궁통보감 조후용신표는 전재 계보에 따라 셀 단위 이설이 있다(예: 甲巳·甲午월 보좌 천간
  순서, 乙巳월 보좌 유무). 엔진 표는 이설을 셀 `note`에 기록하고 산출에는 확정값만 쓴다
  (johooQiongTongBaoJianTable.ts). 사용자는 `johooTemplate.monthTableOverride`로 셀 단위 패치가 가능하다.
- **월령 전구 대 억부 일원론**: 자평진전의 「用神專求月令」은 격국용신(체계 유지의 축)을 말하며, 억부용신
  일원론(균형 회복의 축)과는 층위가 다르다는 것이 통설적 정리다. 엔진은 이를 가중치 프로파일 차이로 표현한다
  (`ziping.strict`는 role 1.05/balance 0.55, `balance` 프리셋은 balance 1.0/role 0.75).
- **신살 취사 논쟁**: 삼명통회는 신살을 광범위하게 병록하지만, 근대 평주가(서락오 등)들은 신살 축소·격국 중심을
  주장했다. `sanmingtonghui` 프리셋의 `conditions.enabled=false`는 전자(병록·원형 노출) 쪽 선택지이고, 기본
  설정(감쇠 활성)은 후자에 가깝다.
- **종화(從化) 논리의 강도**: 적천수 계열의 종격·화격 승격 강도는 `follow`/`hwagyeok`/`zhuanwang`/`ditiansui`
  프리셋이 별도로 다루며(본 문서 범위 외), `zipingzhenquan`은 competition power 2.3으로 이를 의도적으로 억제한다.

## 5. 한계와 검토 항목

이 문서는 엔진 저장소 내부에서 편찬된 초안이며, 외부 학회·독립 전문가의 인증을 받지 않았다. 독립 검토자
체크리스트:

- [ ] **서지 사실 검증**: 2절의 저자·시대·간행 연도(특히 자평진전 1776 간행 기록, 난강망→궁통보감 정리 계보,
      적천수 저자 이설 서술)를 명리 문헌학 전거로 확인.
- [ ] **인용 문구 검증**: 원문 직접 인용 2건 — 「用神專求月令」(자평진전 論用神), 「調候為急」(궁통보감 계열
      관용구) — 의 판본·편 위치 확인. 그 외 서술은 패러프레이즈이므로 취지 왜곡 여부만 점검.
- [ ] **조후표 120셀 원문 대조**: johooQiongTongBaoJianTable.ts를 徐樂吾 평주본 계열 원문과 셀 단위 대조.
      note에 이설이 기록된 셀(甲卯·甲巳·甲午·乙巳 등)을 우선 확인.
- [ ] **매핑 타당성 — yuhaiziping/shenfengTongkao**: integrated.3d 재사용이 임시 매핑임을 감안해, 연해자평
      전용(신살+시결 반영) 및 신봉통고 전용(병약설 중심 — `weights.medicine` 강화 또는 전용 ruleSpec) 프리셋
      분화 필요 여부 판정.
- [ ] **매핑 타당성 — sanmingtonghui**: '신살 감쇠 비활성'이 삼명통회의 병록 태도를 대표하는 근사인지, 납음
      등 미구현 축의 부재를 프리셋 설명에 추가 고지해야 하는지 판정.
- [ ] **저작권 검토**: 徐樂吾(1949 몰)·袁樹珊 등 근대 평주가 저작물의 국가별 보호기간을 법무 확인하고, 엔진
      데이터 표의 '독립 저작+공용 도메인 원문 대조' 방식이 이를 침해하지 않음을 재확인.
- [ ] **게이트 무결성**: validate:school-sources는 파일 실재만 검증하므로, 문서 내용-프리셋 정합(3절 표의
      overlay 값과 builtin.pack.json 실값 일치)은 릴리스마다 수동 혹은 별도 테스트로 재확인.
