## 출력 형식과 분량

정확히 [[ARTICLE_COUNT]]개의 article을 반환하세요. 요청된 caseId는 빠짐없이 한 번씩, 철자 그대로 포함해야 합니다.

- summary: 자연스러운 해요체 한 문장, 렌더링 기준 60자 이하.
- body: 6-9문단. body[0]~body[3]은 첫 번째 완결 글, body[4]~body[7]은 두 번째 완결 글입니다. body[8]은 선택적 종합 마무리입니다. 각 문단은 렌더링 기준 80-240자, 2-5문장. body 전체는 700-1800자.
- expert: 1-2문단. 각 문단은 렌더링 기준 100-380자. expert 전체에서 유효한 #{tag}를 2-6개 포함하고, 태그는 문장 속에 자연스럽게 녹이세요.
- livingTips: 2-3개. 각 항목은 30자 이하.
- cautions: 1-2개. 각 항목은 44자 이하, 해요체.
- 슬롯은 꼭 필요할 때만 사용하세요: {{periodLabel}}, {{currentSeasonName}}, {{yongshinName}}, {{dayMasterName}}, {{dayMasterCount}}, {{yongshinCount}}.
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
