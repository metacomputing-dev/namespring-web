#!/usr/bin/env python3
"""Add a 3rd paragraph (주의·격려) to standard fragments under Phase 14 A2.

Strategy:
- Read owned fragments with paragraph count < 3 (from baseline-paragraphs.json).
- For each, append a 3rd paragraph drawn from a (category, period) bank.
- Token-shape rules:
  - Single text token: append "\n\n<P3>" to its value.
  - Multi text-only tokens: append "\n\n<P3>" to last token value.
  - Last token is text: append "\n\n<P3>" to its value.
  - Last token is tag: append a new {kind: text, value: "\n\n<P3>"} token.
- Preserve original file formatting via string-replace surgery on JSON values.
- Apply only to owned-scope files (Phase 14 A2):
  - min14-*-floor / min15-*-floor
  - *-season-context.fragments.json
  - current-season files OR fragmentIds containing "currentseason"
  - age-band-* files filtered to fragmentIds with .501 suffix
- Standard depth only.
- The 3rd paragraph adds 의미 (encouragement/caution/practical micro-tip).

Usage:
  python add_third_paragraph.py preview
  python add_third_paragraph.py apply [files-glob]
"""
from __future__ import annotations
import json
import os
import sys
import glob
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COVERAGE = ROOT / 'data' / 'narrative' / '_coverage'

BASELINE = ROOT / 'artifacts' / 'phase14-agent-a2' / 'baseline-paragraphs.json'

# Forbidden plain terms — must NOT appear in the new 3rd paragraph
PLAIN_TERMS_FORBIDDEN = [
    '극신강', '극신약', '신강', '신약', '천을귀인', '천덕귀인', '월덕귀인', '공망',
    '용신', '희신', '기신', '구신', '일간', '격국', '십성', '식상', '재성', '관성',
    '인성', '비겁', '천간', '오행', '음양', '신살', '대운', '세운', '정관', '편관',
    '정인', '편인', '상관', '식신', '비견', '겁재',
]
# Avoid orphan-tag risk: <label>의 <stem> patterns
ORPHAN_STEMS = ['결이', '결과', '자리', '흐름', '신호', '기운', '균형', '평균']
# Truncated noun stems
TRUNCATED_NOUNS = [
    '컨디션', '상태', '관계', '약속', '회복', '친구', '가족', '책임', '감정',
    '일정', '결정', '운동', '식사', '동료', '이슈', '경험', '능력', '수입',
    '지출', '분야', '환경', '일과', '음식', '역할', '시간', '관점', '생각',
    '기준', '노력', '조심', '중심', '성장', '시점', '모습', '반복', '학교',
    '회사', '습관', '관리', '건강', '평소', '기억', '단계', '기회', '선택',
    '판단',
]
TRUNCATED_VERB_STEMS = [
    '정', '쉬', '좋', '읽', '듣', '먹', '많', '적', '크', '작', '빠', '늦',
    '넓', '좁', '짧', '길', '밝', '어둡', '약', '강', '무겁', '가볍', '뜨겁',
    '차갑',
]


_GLOSSARY_LABELS_CACHE: set[str] | None = None


def _load_glossary_labels() -> set[str]:
    global _GLOSSARY_LABELS_CACHE
    if _GLOSSARY_LABELS_CACHE is not None:
        return _GLOSSARY_LABELS_CACHE
    labels: set[str] = set()
    glossary_dir = ROOT / 'data' / 'narrative' / '_glossary'
    if glossary_dir.exists():
        for fp in glossary_dir.iterdir():
            if not fp.is_file() or fp.suffix != '.json':
                continue
            try:
                with open(fp, encoding='utf-8') as f:
                    d = json.load(f)
            except Exception:
                continue
            buckets = []
            if isinstance(d, list):
                buckets.append(d)
            if isinstance(d, dict):
                if isinstance(d.get('entries'), list):
                    buckets.append(d['entries'])
                if isinstance(d.get('terms'), list):
                    buckets.append(d['terms'])
            for bucket in buckets:
                for item in bucket:
                    label = item.get('label') if isinstance(item, dict) else None
                    if isinstance(label, str) and len(label) >= 2:
                        labels.add(label)
    _GLOSSARY_LABELS_CACHE = labels
    return labels


def validate_p3(text: str) -> str | None:
    """Return error message if text violates a known gate, else None."""
    for term in PLAIN_TERMS_FORBIDDEN:
        if term in text:
            return f'plain-term forbidden: {term}'
    # Orphan-tag risk: <glossary-label>의 <stem> patterns where stem is in ORPHAN_STEMS
    import re
    labels = _load_glossary_labels()
    for stem in ORPHAN_STEMS:
        for m in re.finditer(rf'([가-힣]+)의\s{stem}', text):
            label_candidate = m.group(1)
            # Check substrings of label candidate that match a glossary label
            for label in labels:
                if label in label_candidate:
                    return f'glossary orphan-tag risk: {label}의 {stem}'
    # Truncated 요. patterns
    for noun in TRUNCATED_NOUNS:
        if re.search(rf'{noun}요\.', text):
            return f'truncated noun-yo: {noun}'
    for vs in TRUNCATED_VERB_STEMS:
        if re.search(rf'(?<![가-힣]){vs}요\.', text):
            return f'truncated verb-stem-yo: {vs}'
    return None


# === 3rd paragraph bank ===
# Indexed by (category, period). Multiple variants may rotate via index hash for diversity.
P3_BANK: dict[tuple[str, str], list[str]] = {
    # academic
    ('academic', 'today'): [
        '속도가 잘 붙지 않는 날에는 짧은 휴식을 두고 다시 시작해도 괜찮습니다.',
        '한 번에 모든 답을 찾으려 하기보다 막히는 부분은 다음 시간으로 미뤄도 됩니다.',
        '오늘 끝낸 만큼만 기록해 두면 부담이 덜합니다.',
    ],
    ('academic', 'thisWeek'): [
        '결과물을 작게라도 남기면 다음 단계가 선명해져요.',
        '한 주를 마칠 때 짧게 점검하는 시간을 두면 다음 주의 출발이 가벼워집니다.',
        '속도보다 정확도를 우선하세요.',
    ],
    ('academic', 'thisMonth'): [
        '매주 한 가지 결과물을 남기고, 마지막 주에는 부족한 부분을 다시 정리하면 안정됩니다.',
        '정리한 자료를 반복해서 보면 시험이나 제출물 앞에서 흔들림이 줄어듭니다.',
        '한 달의 끝에 무엇이 남았는지 정리하면 다음 달의 시작이 가벼워집니다.',
    ],
    ('academic', 'thisYear'): [
        '큰 그림과 작은 단계가 함께 보일 때 학습의 깊이가 자랍니다.',
        '한 해를 길게 보고 무리하지 않는 페이스를 유지하세요.',
        '꾸준함이 결과로 이어지는 시기예요.',
    ],
    ('academic', 'life'): [
        '큰 그림을 먼저 잡은 뒤 작은 단원으로 쪼개면 안정됩니다.',
        '오래 갈 학습일수록 회복과 점검을 같이 챙기세요.',
        '꾸준함이 실력의 가장 큰 재료가 됩니다.',
    ],

    # career
    ('career', 'today'): [
        '대신 말로만 끝나지 않게 다음 행동, 담당자, 마감 시간을 짧게 남겨 두세요.',
        '새 일을 늘리기보다 이미 맡은 일의 빈틈을 줄이는 데 집중하세요.',
        '오늘 마무리한 일은 짧게 기록해 두면 내일 출발이 쉬워집니다.',
    ],
    ('career', 'thisWeek'): [
        '목표와 기준을 짧게 공유한 뒤 중간 점검 시간을 두면 추진력이 살아납니다.',
        '주 후반에 한 번 더 확인하는 자리를 두면 누락이 줄어듭니다.',
        '맡은 일과 함께 갈 사람을 분명히 하면 협업이 안정됩니다.',
    ],
    ('career', 'thisMonth'): [
        '시작할 일과 끝까지 키울 일을 구분하면 성장의 힘이 더 분명해집니다.',
        '한 달의 끝에 결과를 짧게 남겨 두면 다음 달의 출발이 쉬워집니다.',
        '확장과 정리의 균형을 맞추는 데 시간을 들이세요.',
    ],
    ('career', 'thisYear'): [
        '한 해 동안 쌓인 경험을 정리해 두면 다음 해의 선택지가 넓어집니다.',
        '큰 변화보다 꾸준한 자기 관리가 신뢰를 만듭니다.',
        '올해는 결과만큼 과정을 기록해 두세요.',
    ],
    ('career', 'life'): [
        '자기 페이스를 지키면서 사람과의 관계를 안정시키세요.',
        '오래 갈 일일수록 회복과 점검의 시간이 필요합니다.',
        '결과보다 방향성에 시간을 들이는 시기예요.',
    ],

    # family
    ('family', 'today'): [
        '말을 너무 빠르게 정리하기보다 상대의 표정과 말투를 함께 살펴 주세요.',
        '오늘 듣는 시간을 조금 더 두면 마음이 부드럽게 풀립니다.',
        '작은 안부 한마디가 분위기를 따뜻하게 바꿉니다.',
    ],
    ('family', 'thisWeek'): [
        '약속과 일정은 미리 공유해 두면 서로의 부담이 줄어듭니다.',
        '한 주 동안의 작은 변화도 짧게 나눠 두면 거리감이 줄어요.',
        '바쁠수록 가족과 식사하는 시간을 따로 챙겨 보세요.',
    ],
    ('family', 'thisMonth'): [
        '한 달의 큰 일정은 미리 함께 정리하면 갈등이 줄어듭니다.',
        '돌봄이나 비용처럼 부담이 큰 부분은 역할을 미리 나누어 두세요.',
        '서로의 일정과 마음을 정기적으로 확인하는 자리를 두면 안정됩니다.',
    ],
    ('family', 'thisYear'): [
        '큰 결정은 한 번에 내리기보다 충분히 의논한 뒤 진행하세요.',
        '한 해 동안의 변화는 작게라도 함께 기록해 두면 좋습니다.',
        '돌봄과 책임을 한 사람에게 몰지 않도록 미리 나누어 두세요.',
    ],
    ('family', 'life'): [
        '관계의 신뢰는 큰 사건보다 일상의 작은 약속에서 자랍니다.',
        '오래 함께할 관계일수록 서로의 페이스를 존중하세요.',
        '말로 다 표현하기 어려울 때는 함께 보내는 시간을 늘려 보세요.',
    ],

    # health
    ('health', 'today'): [
        '몸이 빨리 달아오르면 강도를 낮추는 것이 좋습니다.',
        '작은 피로 신호를 빨리 알아차리면 컨디션을 안정적으로 유지할 수 있습니다.',
        '오늘은 무리하지 않는 페이스가 회복에 도움이 됩니다.',
    ],
    ('health', 'thisWeek'): [
        '운동과 휴식을 같은 비중으로 챙기면 흐름이 안정됩니다.',
        '바쁜 주에도 잠과 식사는 미루지 말고 먼저 잡아 두세요.',
        '몸이 보내는 신호를 늦지 않게 살피세요.',
    ],
    ('health', 'thisMonth'): [
        '같은 루틴 안에 가벼운 움직임을 꾸준히 넣으면 안정감이 좋아집니다.',
        '한 달의 변화는 단숨이 아니라 매주 작게 쌓는 쪽이 좋습니다.',
        '몸이 무거운 주에는 일정도 가볍게 조절해 보세요.',
    ],
    ('health', 'thisYear'): [
        '큰 변화보다 매일 지킬 수 있는 작은 루틴이 한 해의 컨디션을 만듭니다.',
        '몸의 회복 신호를 한 해 동안 꾸준히 살피세요.',
        '체력은 한 번에 쓰지 말고 나누어 쓰는 편이 좋습니다.',
    ],
    ('health', 'life'): [
        '오래 갈 컨디션은 무리한 결과보다 꾸준한 습관에서 만들어집니다.',
        '작은 휴식과 회복의 시간을 미리 정해 두세요.',
        '몸이 보내는 신호를 자주 무시하지 않는 태도가 가장 중요합니다.',
    ],

    # health_stress
    ('health_stress', 'today'): [
        '몸을 움직이는 가벼운 활동은 긴장을 풀어 주는 데 도움이 됩니다.',
        '늦은 시간의 무거운 대화는 피하는 편이 좋습니다.',
        '스스로에게 너무 엄격해지지 않는 하루가 도움이 됩니다.',
    ],
    ('health_stress', 'thisWeek'): [
        '몸을 움직이는 활동과 충분한 수면을 같이 챙기면 긴장이 오래 남지 않습니다.',
        '한 주 동안 짧게라도 혼자 있는 시간을 미리 잡아 두세요.',
        '감정이 무거워지면 일정의 양보다 우선순위를 점검해 보세요.',
    ],
    ('health_stress', 'thisMonth'): [
        '감정이 무거워질 때는 큰 결정보다 작은 루틴을 지키는 편이 안정적입니다.',
        '한 달 안에 회복할 수 있는 작은 휴식 일정을 미리 잡아 두세요.',
        '주변에 도움을 청하는 일도 회복의 한 방법입니다.',
    ],
    ('health_stress', 'thisYear'): [
        '운동, 휴식, 수면을 같은 계획 안에 넣으면 부담이 덜 쌓입니다.',
        '한 해 동안 자기 회복을 위한 작은 약속을 정해 두세요.',
        '도움이 필요한 시기에는 혼자 견디지 않는 선택이 좋습니다.',
    ],
    ('health_stress', 'life'): [
        '평소에는 운동, 물, 수면처럼 단순한 회복 루틴을 고정해 두는 것이 좋습니다.',
        '오래 갈 회복은 한 번의 결심보다 꾸준한 작은 습관에서 만들어집니다.',
        '도움을 청하는 태도가 자기 보호의 중요한 한 부분입니다.',
    ],

    # romance
    ('romance', 'today'): [
        '답을 재촉하기보다 편한 대화 주제를 열어두면 흐름이 자연스러워집니다.',
        '작은 확인이 오해를 줄이고 안정감을 만듭니다.',
        '오늘은 한 번의 반응으로 관계를 다 판단하지 말아 주세요.',
    ],
    ('romance', 'thisWeek'): [
        '따뜻하게 다가가되 상대의 반응을 확인하면 좋은 분위기가 오래 이어집니다.',
        '약속은 작아도 지키는 편이 신뢰를 만듭니다.',
        '편한 대화를 자주 나누면 작은 오해가 빨리 풀립니다.',
    ],
    ('romance', 'thisMonth'): [
        '빠르게 가까워지는 만큼 서로의 기대가 다른지 확인해야 오래 편안합니다.',
        '한 달 안에 한 번은 서로의 페이스를 점검하는 자리를 두세요.',
        '작은 약속을 지키는 일이 큰 신뢰가 됩니다.',
    ],
    ('romance', 'thisYear'): [
        '관계의 깊이는 빠르게 만들기보다 함께 보낸 시간 안에서 자랍니다.',
        '한 해의 큰 결정은 충분한 대화 뒤에 내리는 편이 좋습니다.',
        '서로의 일상과 미래에 대한 생각을 자주 나누세요.',
    ],
    ('romance', 'life'): [
        '말이 잘 통하는지, 약속을 지키는지를 천천히 보세요.',
        '오래 갈 관계일수록 서로의 페이스를 존중하세요.',
        '안정적인 관계는 작은 일상에서 자랍니다.',
    ],

    # study_document (학습 문서/자격증 등)
    ('study_document', 'today'): [
        '오늘 끝낸 만큼만 기록해 두면 다음 시작이 가벼워집니다.',
        '한 번에 모든 분량을 보려 하지 말고 단원을 나눠 진행하세요.',
        '집중이 떨어지면 짧게 쉬고 다시 시작해도 괜찮습니다.',
    ],
    ('study_document', 'thisWeek'): [
        '주 단위로 결과물을 정리해 두면 시험 준비가 흔들리지 않습니다.',
        '틀린 문제는 이유까지 적어 두면 같은 실수를 줄일 수 있습니다.',
        '한 주 동안 끝낼 단원의 양을 미리 정해 두세요.',
    ],
    ('study_document', 'thisMonth'): [
        '매주 작은 점검을 두면 한 달의 마무리가 흔들리지 않습니다.',
        '시험이나 제출물이 가까운 주에는 새 내용보다 정리에 시간을 더 두세요.',
        '한 달 분량은 처음에 크게 잡고, 매주 줄여 가는 편이 안정적입니다.',
    ],
    ('study_document', 'thisYear'): [
        '한 해 동안 쌓는 자격과 결과물은 작게 자주 기록해 두세요.',
        '큰 시험은 막판 몰아치기보다 매월 작은 점검을 누적하는 편이 좋습니다.',
        '준비가 길어질수록 휴식과 점검을 함께 챙기세요.',
    ],
    ('study_document', 'life'): [
        '오래 갈 학습일수록 매일의 작은 약속이 결과를 만듭니다.',
        '자기 페이스를 지키는 사람이 마지막에 가장 멀리 갑니다.',
        '쌓아 둔 기록이 다음 단계의 자료가 됩니다.',
    ],

    # expression_children (표현·아이 — 표현하기·돌봄)
    ('expression_children', 'today'): [
        '아이의 말을 끝까지 듣는 시간을 두면 분위기가 부드러워집니다.',
        '오늘은 가르치기보다 같이 시간을 보내는 데 의미를 두세요.',
        '작은 칭찬 한마디가 하루의 분위기를 따뜻하게 바꿉니다.',
    ],
    ('expression_children', 'thisWeek'): [
        '한 주 동안 함께할 작은 활동을 미리 정해 두세요.',
        '바쁠수록 짧은 대화 시간을 일부러라도 만들어 보세요.',
        '아이의 변화는 매주 짧게 메모해 두면 흐름이 보입니다.',
    ],
    ('expression_children', 'thisMonth'): [
        '한 달의 일정을 미리 공유하면 아이도 마음의 준비가 쉬워집니다.',
        '돌봄과 활동의 균형을 한 달 단위로 살펴보세요.',
        '아이의 페이스에 맞춰 일정의 양을 조절하세요.',
    ],
    ('expression_children', 'thisYear'): [
        '한 해 동안의 작은 성장은 자주 기록해 두면 의미가 더 커집니다.',
        '큰 변화보다 함께한 시간의 질이 더 오래 남습니다.',
        '아이가 보내는 신호를 놓치지 않는 한 해가 되시길 바랍니다.',
    ],
    ('expression_children', 'life'): [
        '오래 갈 관계일수록 작은 일상의 따뜻함이 큰 힘이 됩니다.',
        '아이의 페이스에 맞추는 시간이 가장 큰 선물입니다.',
        '자주 함께 웃는 시간이 관계의 가장 단단한 기반이 됩니다.',
    ],

    # movement (이동·환경)
    ('movement', 'today'): [
        '계획에 없던 변경이 생기면 일정을 강행하기보다 안전을 먼저 확인하세요.',
        '오늘은 짐이나 일정보다 자기 컨디션을 먼저 챙기는 편이 좋습니다.',
        '낯선 길은 미리 정보를 확인해 두면 부담이 줄어듭니다.',
    ],
    ('movement', 'thisWeek'): [
        '큰 이동 일정 사이에는 회복 시간을 미리 잡아 두세요.',
        '한 주의 동선을 미리 정리해 두면 피로가 쌓이지 않습니다.',
        '예상치 못한 변경은 대안을 하나 더 두면 마음이 가벼워집니다.',
    ],
    ('movement', 'thisMonth'): [
        '한 달의 이동과 일정은 미리 흐름을 그려 두면 부담이 줄어듭니다.',
        '큰 이동 후에는 짧은 휴식을 일정 안에 같이 넣어 두세요.',
        '계획 변경은 일찍 알수록 손실이 적습니다.',
    ],
    ('movement', 'thisYear'): [
        '한 해의 큰 이동은 충분히 검토하고 결정하는 편이 좋습니다.',
        '환경 변화에 맞춰 일정을 단계적으로 조정하세요.',
        '큰 변화 뒤에는 회복과 적응의 시간이 함께 필요합니다.',
    ],
    ('movement', 'life'): [
        '큰 이동일수록 천천히 결정하고 일찍 준비하세요.',
        '환경 변화는 한 번에 끝나지 않으니 적응 시간을 충분히 두세요.',
        '자기 페이스를 잃지 않는 이동이 가장 안전한 변화입니다.',
    ],

    # wealth
    ('wealth', 'today'): [
        '작은 확인이 불필요한 손실을 줄입니다.',
        '오늘은 큰 결정보다 작은 점검에 시간을 쓰세요.',
        '결제 전 한 번 더 검토하는 습관이 부담을 줄여 줍니다.',
    ],
    ('wealth', 'thisWeek'): [
        '계획 없이 쓰는 돈을 줄이면 다음 선택지가 넓어집니다.',
        '한 주 동안의 지출을 작게라도 기록해 두세요.',
        '큰 결정은 주 후반보다 주 초반에 내리는 편이 안정적입니다.',
    ],
    ('wealth', 'thisMonth'): [
        '실험 예산을 작게 정하고 결과를 확인하면 흐름을 안정적으로 살릴 수 있습니다.',
        '한 달의 지출을 한 번 점검하면 다음 달 계획이 분명해집니다.',
        '필요한 지출과 보여주기 위한 지출을 구분하세요.',
    ],
    ('wealth', 'thisYear'): [
        '한 해의 큰 흐름은 매달의 작은 기록이 모여 만들어집니다.',
        '큰 결정 전에는 충분히 검토하고 의논하세요.',
        '벌이만큼 지키는 일에도 같은 비중을 두세요.',
    ],
    ('wealth', 'life'): [
        '오래 갈 재정은 큰 한 번보다 작은 꾸준함에서 만들어집니다.',
        '돈의 흐름을 자주 점검하는 사람이 흔들림이 적습니다.',
        '계획이 분명할수록 작은 변화에도 흔들리지 않습니다.',
    ],

    # overall
    ('overall', 'today'): [
        '오늘은 모든 것을 결정하기보다 큰 방향만 정해도 충분합니다.',
        '하루의 마무리에는 짧은 정리 시간을 남겨 두세요.',
        '계획이 흔들릴 때는 가장 중요한 한 가지만 챙기세요.',
    ],
    ('overall', 'thisWeek'): [
        '한 주의 흐름은 첫날의 정리에서 만들어집니다.',
        '주 중간 점검을 두면 늦은 변경의 부담이 줄어듭니다.',
        '주말에는 회복 시간을 일부러라도 챙기세요.',
    ],
    ('overall', 'thisMonth'): [
        '한 달의 끝에 짧게 돌아보는 시간이 다음 달의 시작을 안정시킵니다.',
        '큰 결정은 한 달 안에 한두 번으로 줄이는 편이 좋습니다.',
        '확장과 정리의 균형을 챙기세요.',
    ],
    ('overall', 'thisYear'): [
        '한 해의 흐름은 매달의 작은 점검에서 만들어집니다.',
        '큰 변화는 한 번에 끝나지 않으니 적응의 시간을 같이 두세요.',
        '꾸준함이 결과를 만들어 주는 시기예요.',
    ],
    ('overall', 'life'): [
        '오래 갈 흐름은 한 번의 큰 결정보다 매일의 작은 약속에서 만들어집니다.',
        '자기 페이스를 지키는 사람이 가장 멀리 갑니다.',
        '회복과 점검의 시간을 미리 정해 두세요.',
    ],
}


def get_owned_fragment_ids() -> dict[str, int]:
    """Return owned fragmentIds with cell counts (filter to owned scope)."""
    with open(BASELINE, encoding='utf-8') as f:
        data = json.load(f)
    items = data['fragmentLowParagraphCounts']
    # Find which file each fid lives in
    fid_to_file = {}
    for fp in COVERAGE.glob('*.fragments.json'):
        with open(fp, encoding='utf-8') as f:
            b = json.load(f)
        for fr in b.get('fragments', []):
            fid = fr.get('fragmentId')
            if fid:
                fid_to_file[fid] = fp.name

    owned = {}
    for fid, count in items.items():
        fname = fid_to_file.get(fid)
        if not fname:
            continue
        if fname.startswith('min14-') or fname.startswith('min15-'):
            owned[fid] = count
            continue
        if fname.endswith('-season-context.fragments.json'):
            owned[fid] = count
            continue
        if 'current-season' in fname:
            owned[fid] = count
            continue
        if 'currentseason' in fid:
            owned[fid] = count
            continue
        if fname.startswith('age-band-') and ('.501' in fid):
            owned[fid] = count
            continue
    return owned


def get_p3_for_fragment(fid: str) -> str | None:
    """Pick a 3rd paragraph from the bank for this fragment."""
    parts = fid.split('.')
    if len(parts) < 2:
        return None
    cat = parts[0]
    period = parts[1]
    bank = P3_BANK.get((cat, period))
    if not bank:
        return None
    # Deterministic pick based on the suffix portion of fid (rotate variants)
    suffix_seed = '.'.join(parts[2:])
    h = sum(ord(c) for c in suffix_seed)
    return bank[h % len(bank)]


def append_p3_to_fragment(fragment: dict, p3: str) -> tuple[list[tuple[str, str]], str]:
    """Compute string-replacement pairs to add p3 to fragment.

    Returns:
        (replacements, error_message_or_empty)
        replacements: list of (old_quoted, new_quoted) for str.replace.
    """
    if fragment.get('axis', {}).get('depth') != 'standard':
        return [], 'not standard depth'
    tokens = fragment.get('templateTokens', [])
    if not tokens:
        return [], 'no tokens'
    # Compute current paragraph count
    full_text = ''.join(t['value'] if t.get('kind') == 'text' else f'<<{t.get("label", "")}>>'
                         for t in tokens)
    paragraphs = [p for p in full_text.split('\n\n') if p.strip()]
    if len(paragraphs) >= 3:
        return [], 'already >= 3 paragraphs'

    last_token = tokens[-1]
    addition = '\n\n' + p3
    if last_token.get('kind') == 'text':
        old_value = last_token['value']
        new_value = old_value + addition
        old_q = json.dumps(old_value, ensure_ascii=False)
        new_q = json.dumps(new_value, ensure_ascii=False)
        return [(old_q, new_q)], ''
    elif last_token.get('kind') == 'tag':
        # Need to insert a new text token after last tag.
        # Locate the closing of the last token in JSON via the tag's signature.
        # Simpler approach: insert after the last token's closing brace.
        # We do this by detecting the trailing `      }\n    ],\n` pattern and
        # putting a new text token before it.
        return [], 'tag-last not yet implemented'
    return [], 'unknown last token kind'


def process_file(filepath: Path, dry_run: bool, owned_fids: set[str]) -> dict:
    """Process one file, returning stats."""
    with open(filepath, encoding='utf-8') as f:
        source = f.read()
    try:
        data = json.loads(source)
    except json.JSONDecodeError as e:
        return {'changed': 0, 'skipped': 0, 'errors': [str(e)]}

    new_source = source
    changed = 0
    skipped = 0
    errors = []
    skipped_fids = []
    for fragment in data.get('fragments', []):
        fid = fragment.get('fragmentId')
        if not fid or fid not in owned_fids:
            continue
        if fragment.get('axis', {}).get('depth') != 'standard':
            continue
        p3 = get_p3_for_fragment(fid)
        if not p3:
            errors.append(f'no P3 bank for {fid}')
            skipped += 1
            skipped_fids.append((fid, 'no-bank'))
            continue
        err = validate_p3(p3)
        if err:
            errors.append(f'{fid}: P3 validation failed: {err}')
            skipped += 1
            skipped_fids.append((fid, f'validate-{err}'))
            continue
        replacements, msg = append_p3_to_fragment(fragment, p3)
        if not replacements:
            if msg:
                errors.append(f'{fid}: {msg}')
            skipped += 1
            skipped_fids.append((fid, msg))
            continue
        # Apply replacements
        for old_q, new_q in replacements:
            if old_q not in new_source:
                errors.append(f'{fid}: old_q not found in source')
                continue
            new_source = new_source.replace(old_q, new_q, 1)
            changed += 1

    if not dry_run and new_source != source:
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            f.write(new_source)
    return {
        'changed': changed,
        'skipped': skipped,
        'errors': errors,
        'skipped_fids': skipped_fids,
    }


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    action = sys.argv[1]
    dry_run = action != 'apply'

    owned_map = get_owned_fragment_ids()
    print(f'Owned fragments needing P3: {len(owned_map)}')

    file_filter = None
    if len(sys.argv) > 2:
        file_filter = sys.argv[2]

    files = sorted(COVERAGE.glob('*.fragments.json'))
    if file_filter:
        # glob filter
        import fnmatch
        files = [f for f in files if fnmatch.fnmatch(f.name, file_filter)]
    print(f'Processing {len(files)} files')
    print()

    total_changed = 0
    total_skipped = 0
    total_errors = []
    files_changed = 0
    for fp in files:
        owned_fids_in_file = set()
        try:
            with open(fp, encoding='utf-8') as f:
                data = json.load(f)
            for fr in data.get('fragments', []):
                fid = fr.get('fragmentId')
                if fid and fid in owned_map:
                    owned_fids_in_file.add(fid)
        except Exception as e:
            print(f'  ERROR loading {fp.name}: {e}')
            continue
        if not owned_fids_in_file:
            continue
        result = process_file(fp, dry_run, owned_fids_in_file)
        if result['changed'] > 0 or result['skipped'] > 0:
            print(f"{fp.name}: changed={result['changed']} skipped={result['skipped']}")
            for err in result['errors']:
                print(f'   ! {err}')
            if result['changed'] > 0:
                files_changed += 1
        total_changed += result['changed']
        total_skipped += result['skipped']
        total_errors.extend(result['errors'])

    print()
    print(f'Total changes: {total_changed}, skipped: {total_skipped}, files modified: {files_changed if not dry_run else 0}')
    if total_errors:
        print(f'Errors/warnings: {len(total_errors)}')


if __name__ == '__main__':
    main()
