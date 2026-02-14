# SAJU-Driven Name Optimization (Research + Implementation Notes)

## 1. Problem Definition
- 목표는 `오행 표준편차 최소화` 하나가 아니라, 사주 해석(용신/희신/기신, 신강약, 격국, 십성 불균형)을 포함해 이름 후보를 종합 최적화하는 것이다.
- 성명학 규칙(사격수리, 발음오행, 발음음양, 획수음양)은 여전히 중요하지만, 사주 신호가 강할 때는 규칙의 상대 가중치를 조정할 필요가 있다.

## 2. Practical Principles Collected
- 작명 실무에서는 사주(부족/과다 오행)와 성명학 요소를 함께 본다.
- 용신 산정은 단일 방식이 아니라 억부/조후/통관/병약/격국 등 다중 접근이 병행된다.
- 법적으로 사용 가능한 인명용 한자 범위가 선행 제약이다.

## 2-1. Counterintuitive Cases (Important)
- `부족 오행 보충`은 필요조건이 아닌 경우가 많다.
- 예: 특정 오행이 통계상 많아도 조후(기후 조절), 통관(막힌 기운 소통), 병약(질병/한열 조절) 관점에서 같은 오행을 추가하는 선택이 실무에서 발생한다.
- 따라서 모델은 `단순 분포 균형`보다 `용신 추천의 맥락(추천 방식 타입+신뢰도)`을 더 강하게 반영해야 한다.

## 3. System Design Adopted in This Repo
- `seed-ts`에서 SAJU 프레임을 다요소 합성 점수로 변경:
  - `분포 균형` + `용신(최종+방법별 추천)` + `신강약 정합` + `십성 균형`
- 루트(`SEONGMYEONGHAK`)에서 `사주 우선 적응형 모드` 도입:
  - 사주 신호가 강하면 SAJU 가중치를 올리고 일부 전통 프레임(사격/발음)의 실패 허용치를 제한적으로 부여
  - 완전 무시가 아니라, 하한 점수/실패 개수/심각 실패를 함께 관리
- 검색 단계는 하드 필터 일변도에서 개선:
  - 우선 `종합 pass` 후보를 반환
  - pass가 부족/0이면 종합 점수 상위 후보를 fallback으로 제공

## 4. Data Used from `saju-ts`
- 일간(day master) 오행
- 용신 결과:
  - 최종 용신/희신/기신/구신
  - 방법별 추천 목록(`EOKBU`, `JOHU`, `TONGGWAN`, `GYEOKGUK`, `BYEONGYAK` 등)
- 신강약
- 격국
- 십성 그룹 분포(friend/output/wealth/authority/resource)

## 5. Why This is Better Than Single-Metric Balance
- 동일한 오행 분포라도 사주 구조(예: 강약/용신 타입)에 따라 선호 이름이 달라진다.
- 분포 균형 단일 지표는 설명력이 낮고, 실제 작명 실무의 다요소 판단을 반영하지 못한다.
- 현재 구조는 사주 근거를 detail로 남겨 UI에서 해석/근거 추적이 가능하다.

## 6. Sources (Research Links)
- Four Pillars background (Day Master / favorable elements context):  
  https://en.wikipedia.org/wiki/Four_Pillars_of_Destiny
- 용신 다중 방법(억부/조후/통관/병약/격국) 관련 연구 메타데이터:  
  https://dl.nanet.go.kr/search/searchInnerDetail.do?searchType=INNER_SEARCH&resultType=INNER_SEARCH_DETAIL&searchMehtod=I&searchClass=SUBJECT&controlNo=KINX2013076494
- 용신법(억부/조후/병약) 비교 연구 요약(실무 적용 논의 포함):  
  https://www.happycampus.com/paper-doc/22705157/
- 작명 실무 요소(사주 보완 + 음양 + 수리 + 발음 등) 사례:  
  https://www.miso.co.kr/blog/%EC%9D%B4%EB%A6%84%EC%A7%93%EA%B8%B0-%EA%B3%A0%EB%AF%BC-%EC%A0%84%EB%AC%B8%EA%B0%80%EC%97%90%EA%B2%8C-%EB%AC%BC%EC%96%B4%EB%B3%B4%EC%84%B8%EC%9A%94
- 작명에서 용신/희신 활용 사례(실무 설명):  
  https://guritown.modoo.at/?link=4mev9maw
- 용신법 분류 설명(실무 관점):  
  https://m.sajuforum.com/consult/36917
- 용신 선정 단계에서 중화/조후 우선순위를 설명한 실무 글:  
  https://iguanja.tistory.com/34
- 인명용 한자 제약(공식 안내):  
  https://www.efamily.scourt.go.kr/efamilyplus/common/com_ebz_0002.jsp?dispBizNo=9&menu=5&pageNo=1

## 7. Caveat
- 위 자료 중 일부는 실무/상업 사이트로 학술 엄밀성과 관점 차이가 있다.
- 따라서 구현은 단일 학파를 고정하지 않고, `가중치/허용치 조정 가능한 적응형 구조`로 두어 운영 중 교정 가능하게 설계했다.
