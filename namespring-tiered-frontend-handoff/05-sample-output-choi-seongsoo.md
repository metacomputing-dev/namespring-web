# 1986-04-19 최성수 샘플 출력

## 입력

```txt
성별: 남성
생년월일: 1986년 4월 19일
출생시각: 새벽 5시 45분
성명: 높을 최(崔), 이룰 성(成), 빼어날 수(秀)
달력: 양력
지역: 서울
야자시: on
진태양시: on
경도 보정: on
targetDate: 2026-05-02
```

로컬에 저장된 원본:

```txt
lib/spring-ts/artifacts/namespring-current-vs-tiered-output-1986-04-19-choi-seongsoo.json
lib/spring-ts/artifacts/namespring-current-vs-tiered-output-1986-04-19-choi-seongsoo.summary.json
```

원본 JSON은 개인 입력값과 전체 리포트 payload를 포함하므로 이 문서 브랜치에는 커밋하지 않았다. 이 파일에는 프론트 구현 판단에 필요한 요약만 남긴다.

## 현재 NameSpring 방식

현재 NameSpring 요청에는 `precisionConfig.surfaceTieredMatrix`가 없다.

결과:

```txt
currentHasTieredMatrix=false
```

현재 전달되는 top-level key:

```txt
nameCompatibility
overviewSummary
lifeFortuneOverview
personality
strengthsWeaknesses
cautions
dailyFortune
weeklyFortune
monthlyFortune
yearlyFortune
lifeStageFortune
categoryFortunes
meta
```

## opt-in 방식

요청에 아래 옵션을 추가하면:

```js
precisionConfig: {
  surfaceTieredMatrix: true
}
```

결과:

```txt
optInHasTieredMatrix=true
schemaVersion=spring-ts.tiered-matrix.v1
contentSource=authored
fragmentCount=1837
aiGeneratedFragmentCount=1837
```

## 보정 결과

시간 보정:

```txt
표준 입력 시각: 1986-04-19 05:45
보정 후 시각: 1986-04-19 04:43
경도 보정: -32.088분
균시차: +0.682분
```

사주 기둥:

```txt
년주: 병인
월주: 임진
일주: 계사
시주: 갑인
```

이 값은 사용자가 붙여준 현재 UI 출력과 같은 큰 구조다. 즉 계산 자체가 새 PR 때문에 달라진 것이 아니라, NameSpring이 아직 새 matrix를 요청하지 않는 것이 핵심이다.

## sample: 오늘 총운

`tieredMatrix.periods.today.overall.brief`

```txt
느린 결이라, 휴식 한 박자가 큰 자산이 돼요.
```

`tieredMatrix.periods.today.overall.standard`

```txt
오늘 하루의 큰 그림을 보면, 잔잔한 호수처럼 큰 파도 없이 흐르는 결이에요. 익숙한 페이스를 지키면 자연스럽게 결과가 따라오고, 작은 신호도 흘려 듣지 않으면 결정의 질이 한 단계 올라가요. 한 가지에 마음을 두고 끝까지 보면, 하루가 단단하게 마무리돼요.
```

생활 팁:

```txt
오늘 가장 중요한 한 가지를 정해요
마무리 시간에 짧게 점검해요
```

주의:

```txt
급한 결정만 한 박자 늦추면 충분해요
```

## sample: 올해 연애운

`tieredMatrix.periods.thisYear.byCategory.romance`

```txt
stars=1
meaningfulness=meaningful
```

brief:

```txt
올해는 사람과의 결이 한 단계 깊어지는 흐름이에요.
```

standard:

```txt
올해는 곁의 사람과의 결을 한 해라는 길이로 단단히 가꾸기 좋은 시기예요. 한 해 안에서 일상의 작은 다정함이 자산으로 쌓이는 결이라, 평소보다 표현을 한 박자 정성스럽게 두면 큰 자산이 돼요. 가족·반려·가까운 동료와 함께하는 자리가 한 해 동안 늘어나면, 그 시간 안에서 신뢰의 결이 자연스럽게 단단해져요. 일과 관계 사이의 균형이 잠깐 흔들릴 수 있지만, 한 해의 흐름 안에서 관계 쪽에 작은 정성을 놓치지 않으면 충분해요. 갈등의 신호가 한두 번 보일 수 있어요. 그때 큰 단정을 멀리 두고 서로의 입장을 천천히 들으면, 한 해 안에서 자연스럽게 풀리는 결이에요. 큰 결정보다 일상의 결을 챙기는 자리로 한 해를 보내면, 다음 해의 결이 한층 부드러워져요.
```

생활 팁:

```txt
함께하는 식사 자리를 만들어요
한 박자 정성스럽게 표현해요
```

주의:

```txt
갈등에 큰 단정만 멀리 두면 충분해요
```

expert 첫 문단은 `#배우자궁`, `#식신`, `#도화`, `#홍염`, `#정관`, `#편관` 같은 tag를 포함한다. 이 문단은 기본 화면이나 일반 상세에는 노출하지 않고, `전문가 근거` 버튼을 눌렀을 때만 표시한다.
