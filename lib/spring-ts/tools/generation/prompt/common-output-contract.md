## 출력 형식과 분량

정확히 [[ARTICLE_COUNT]]개의 article을 반환하세요. 요청된 caseId는 빠짐없이 한 번씩, 철자 그대로 포함해야 합니다.

- summary: 자연스러운 해요체 한 문장, 렌더링 기준 60자 이하.
- hook: 선택 항목. 렌더링 기준 24자 이하. body 전체에서 제안한 행동 기준을 압축한 한 문장으로 쓰세요. 사용자가 바로 기억할 주의점이나 권고사항이어야 하며, 분위기 문구나 새 소재가 아니어야 합니다.
- body: 8-9문단. body[0]~body[3]은 첫 번째 완결 글, body[4]~body[7]은 두 번째 완결 글입니다. body[8]은 원칙적으로 작성하는 종합 마무리입니다. 단, summary 반복, 행동 목록, 새 소재 추가가 될 때만 생략하세요. 각 문단은 렌더링 기준 220자 이하, 1-4문장. body 전체는 480-1500자. 길이를 채우기 위해 설명을 늘리지 말고, 문단이 이미 분명하면 짧게 끝내세요.
- expert: 1-2문단. expert 전체에서 유효한 #{tag}를 2-6개 포함하고, 태그는 문장 속에 자연스럽게 녹이세요. 길이보다 근거의 선명함을 우선하되, 같은 bundle 안에서 같은 도입부와 같은 설명 뼈대가 반복되지 않게 쓰세요.
- livingTips: 2-3개. 각 항목은 30자 이하.
- cautions: 1-2개. 각 항목은 44자 이하, 해요체.
- 슬롯은 꼭 필요할 때만 사용하세요: {{periodLabel}}, {{currentSeasonName}}, {{yongshinName}}, {{dayMasterName}}, {{dayMasterCount}}, {{yongshinCount}}.
- {{dayMasterName}}은 사용자 이름이 아니라 `나무`, `불`, `흙`, `쇠`, `물` 중 하나로 치환되는 일간 오행명입니다. 평문에서는 `{{dayMasterName}}의 성분은 ...`, `{{dayMasterName}}의 기질은 ...`, `{{dayMasterName}}의 성향은 ...`, `{{dayMasterName}}의 흐름은 ...`처럼 맥락에 맞게 다양하게 이어 쓰고, `{{dayMasterName}}은`, `{{dayMasterName}}이`처럼 바로 조사에 붙이지 마세요.
- 조사 결합형은 허용된 조사만 사용하세요: {{yongshinName:이가}}, {{yongshinName:은는}}, {{yongshinName:을를}}, {{yongshinName:과와}}, {{yongshinName:으로로}}, {{yongshinName:이라라}}.

JSON만 반환하세요. 설명, markdown, 주석, 체크리스트를 JSON 밖에 쓰지 마세요.

반환 형식:

{
  "articles": [
    {
      "caseId": "...",
      "summary": "...",
      "hook": "...",
      "body": ["..."],
      "expert": ["..."],
      "livingTips": ["..."],
      "cautions": ["..."]
    }
  ]
}
