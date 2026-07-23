# 원천 근거 fragment 생성 과제

사주 4축 설명 뒤에 이어질 이름 평가 근거를 작성하라. 입력의 `sourceId`, `state`, `weight`, `weightRange`, `weightTable`은 실제 점수 계산 모델과 동일한 설정에서 가져왔다.

## 가장 중요한 원칙

- 점수나 등급을 번역해서 `잘 맞는다`, `아쉽다`고만 쓰지 않는다.
- 관찰된 원천 사실이 무엇이고, 그 사실이 작명 판단에 왜 유리하거나 제한적인지를 인과관계로 설명한다.
- `weight`는 해당 근거의 상대적 영향도다. 가중치가 큰 근거는 판단의 중심으로, 작은 근거는 보조 설명으로 표현한다.
- 가중치 숫자를 사용자 문장에 노출하지 않는다.
- `balance`, `yongshin`, `strength`, `tenGod`, `deficiency`, `harmfulElement`, `gyeokgukProtection` 같은 내부 `sourceId`를 문장에 노출하지 않고 자연스러운 한국어 개념으로 풀어 쓴다.
- 위 영문 sourceId는 plain뿐 아니라 detail에도 절대 쓰지 않는다. 예를 들어 `balance 근거`가 아니라 `이름을 더한 뒤의 오행 분포 변화`라고 쓴다.
- 가중치가 낮다는 이유로 사실을 무시하거나, 가중치가 높다는 이유로 이름 전체를 단정하지 않는다.
- 이 fragment들은 한 화면에서 2~3개가 연이어 사용된다. 각 항목을 독립적인 이름 소개처럼 쓰지 말고, 앞의 사주 4축 설명을 구체적인 이름 근거로 이어 가는 중간 문단으로 쓴다.
- `{{name}}에는`, `{{name}}은`, `이 이름에는`, `이 이름은`으로 문장을 시작하지 않는다. 원천 근거에서는 이름 자리표시자를 아예 사용하지 않는다. 다만 오행 분포의 전후 변화를 설명하는 `이름을 더한 뒤` 같은 계산 문맥은 사용할 수 있다.
- 각 작업이 따로 생성되므로 `앞서 본`, `앞에서 설명한`, `위의 내용` 같은 임의의 앞 문장 참조를 쓰지 않는다. 문단 간 연결은 최종 조립기가 담당한다.

## 원천 근거별 의미

- `balance`: 이름을 더한 뒤 부족 오행을 채우는지, 이미 과한 오행을 더하는지를 설명한다.
- `yongshin`: 이름 오행이 용신·희신·중립·기신·구신 중 어느 역할과 만나는지 설명한다. 용신과 희신은 긍정 근거이고, 기신과 구신은 제한 근거이며 구신의 감점이 더 크다.
- `strength`: 이름 오행이 신강약에 필요한 조절 방향을 돕는지 설명한다.
- `tenGod`: 이름 오행이 부족한 십신 계열을 보완하는지, 이미 과한 계열을 더하는지 설명한다. 전체 판단에서는 보조 근거다.
- `deficiency`: 사주에서 부족한 오행이면서 용신 또는 희신인 성분을 이름이 직접 포함한 경우의 추가 근거다.
- `harmfulElement`: 기신 또는 구신 성분이 실제 이름에 포함되어 발생한 감점 근거다. 구신의 제한을 기신보다 강하게 쓴다.
- `gyeokgukProtection`: 종격 구조를 이름이 지키는지 또는 해치는지를 설명한다.

## 자리표시자

실제 원천값이 들어가야 자연스러운 항목에는 다음 자리표시자만 사용할 수 있다.

- `{{filledElements}}`, `{{excessiveElements}}`
- `{{matchedElements}}`, `{{harmfulElements}}`
- `{{alignedElements}}`, `{{opposedElements}}`
- `{{supportiveElements}}`, `{{limitingElements}}`
- `{{filledElementFunctions}}`, `{{excessiveElementFunctions}}`
- `{{matchedElementFunctions}}`, `{{harmfulElementFunctions}}`
- `{{alignedElementFunctions}}`, `{{opposedElementFunctions}}`
- `{{supportiveElementFunctions}}`, `{{limitingElementFunctions}}`

자리표시자가 비어 있을 가능성이 있는 상태에서는 사용하지 않는다. 코드값이나 존재하지 않는 개인 상황을 새로 만들지 않는다.

## plain과 detail

- `plain`: 전문용어 없이 관찰된 성분, 그 성분이 뜻하는 사용자 관점의 기능, 추천에 미치는 영향을 2문장 안팎으로 설명한다. 단순히 `성분이 들어 있어 좋다`에서 끝내지 않는다.
- `detail`: 원천 근거의 전문 명칭과 계산상 역할을 밝힌다. 점수 범위를 말하지 말고 용신·희신·기신·구신, 신강약, 십신, 격국 등 해당 근거에 필요한 용어만 사용한다.
- 두 문장 모두 다른 원천 근거의 역할을 선점하지 않는다.
- plain은 사용자가 그대로 읽는 문장이다. `현재 작명 판단`, `추천 판단`, `추천 근거`, `제한 요인`, `중심 보완`처럼 분석자의 메모로 들리는 말을 쓰지 않는다.
- `{{...ElementFunctions}}`의 내용을 그대로 명사처럼 붙이지 말고, 앞 문장과 자연스럽게 이어지는 동사형 설명으로 사용한다.
- `확인돼요`, `요소예요`, `효과예요`로 평가 결과를 보고하지 않는다. 이름이 무엇을 보태거나 더하는지 직접 말한다.
- `추천에는 제한적으로 보아요`처럼 조사가 어색한 판정문을 쓰지 않는다. 아쉬운 상태는 `다른 후보와 비교하는 편이 좋아요`처럼 자연스럽게 안내한다.
- 다른 fragment를 가리키는 `앞의 주요 판단`, `전체 설명`, `앞선 내용`을 쓰지 않는다.
- 중립 상태도 시스템 판정처럼 쓰지 않는다. 도움이 크지는 않지만 현재의 균형을 해치지 않는다는 뜻을 평범한 말로 설명한다.
- `gyeokgukProtection/protected`는 이름이 이미 모인 기운을 흐트러뜨리지 않아 기존 장점을 살린다고 설명한다. `전체 설명과 이어진다`고 쓰지 않는다.

## 전체 글에서의 시작 방식

sourceId에 따라 다음 관점에서 시작하되 아래 표현을 문장 템플릿처럼 그대로 반복하지 않는다.

- `balance`: 부족했던 성분이 채워졌는지, 이미 많은 성분이 더해졌는지부터 말한다.
- `yongshin`: 확인된 성분이 현재 가장 필요하거나 그 방향을 돕는 역할인지부터 말한다.
- `strength`: 지금 필요한 힘의 조절 방향과 실제 이름 성분의 관계부터 말한다.
- `tenGod`: 핵심 판단 뒤에 살펴볼 세부 성향의 보완 또는 과다부터 말한다.
- `deficiency`: 부족한 성분을 직접 포함한 데서 생기는 추가 장점부터 말한다.
- `harmfulElement`: 긍정 근거와 별개로 함께 살펴야 할 제한 요인부터 말한다.
- `gyeokgukProtection`: 집중된 구조를 유지하는지 흔드는지부터 말한다.

같은 최종 글에 포함될 가능성이 높은 `balance`, `yongshin`, `strength`의 첫 문장 구조가 서로 겹치지 않게 작성한다.

## 작업 데이터

### 가중치 해석 규칙

- `calculationKind`가 `weightedRatio`이면 `calculationValue`와 범위는 실제 점수 혼합 비율이다.
- `calculationKind`가 `bonusPointCap` 또는 `penaltyPointCap`이면 `calculationValue`는 실제 가감점 상한이다.
- `maxScoreImpact`와 `maxScoreImpactRange`는 모든 근거를 같은 단위로 비교하기 위해 환산한 최대 점수 영향도다.
- 문안의 강조 순서는 `maxScoreImpact`를 기준으로 판단하되, 숫자 자체를 결과 문장에 노출하지 않는다.
- `yongshinMethodWeights`와 `presetOverrides`는 용신 판단 방법 및 학파 설정에 따라 강조가 달라질 수 있음을 이해하는 용도로만 사용한다.
- 가중치가 높아도 실제 입력에서 해당 사실이 관찰되지 않았다면 그 근거를 만들어 내지 않는다.

### 상태별 자리표시자 계약

원천 근거 fragment에서는 `{{name}}`과 `{{name:topic}}`을 모두 사용하지 않는다. 최종 결론 fragment가 사용자 이름을 한 번 언급한다.

아래 자리표시자는 해당 상태의 `plain`과 `detail`에 각각 반드시 한 번 이상 사용한다. 목록에 없는 상태에는 원천값 자리표시자를 사용하지 않는다.

- `balance/improves`: `{{filledElements}}`, plain에는 `{{filledElementFunctions}}`도 사용
- `balance/worsens`: `{{excessiveElements}}`, plain에는 `{{excessiveElementFunctions}}`도 사용
- `yongshin/yongshin`, `yongshin/heesin`: `{{matchedElements}}`, plain에는 `{{matchedElementFunctions}}`도 사용
- `strength/supportsNeededDirection`: `{{alignedElements}}`, plain에는 `{{alignedElementFunctions}}`도 사용
- `strength/mixed`: `{{alignedElements}}`, `{{opposedElements}}`, plain에는 `{{alignedElementFunctions}}`, `{{opposedElementFunctions}}`도 사용
- `strength/opposesNeededDirection`: `{{opposedElements}}`, plain에는 `{{opposedElementFunctions}}`도 사용
- `tenGod/fillsDeficit`: `{{supportiveElements}}`, plain에는 `{{supportiveElementFunctions}}`도 사용
- `tenGod/reinforcesExcess`: `{{limitingElements}}`, plain에는 `{{limitingElementFunctions}}`도 사용
- `deficiency/*`: `{{matchedElements}}`, plain에는 `{{matchedElementFunctions}}`도 사용
- `harmfulElement/*`: `{{harmfulElements}}`, plain에는 `{{harmfulElementFunctions}}`도 사용

{{TASK_JSON}}

## 출력

설명이나 Markdown 없이 지정된 JSON 스키마만 반환하라. `taskId`는 입력값을 그대로 쓰고, `items`에는 요청된 key를 각각 정확히 한 번 포함하라.
