"""P17-A4 audit script — categoryFortunes advice.text only.

P10-A3 covered advice.reason; this Phase 17 task targets advice.text — the
NameSpring user-visible top line of each advice item.

Owned scope (text-only):
- src/report/cards/category-fortune-card.ts -- categoryFortunes advice[].text
- src/report/cards/category-fortune-subdomain-data.ts -- SUB_DOMAIN_NARRATIVES
  (subDomains[].narrative — the only user-visible prose this file feeds).

Audit targets:
- 단정 어구 (~합니다, ~한다, ~합니다 endings)
- 단조 반복 (시기예요, 흐름이에요, 결이)
- 카테고리 voice 위반 (만남 운, 결혼·의학 단정)
- 종결어 ~해요/~에요/~이에요 일관 (style guide §1)
"""
import json
import os
import sys
import re
from collections import Counter, defaultdict

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

if '--after' in sys.argv:
    SAMPLE_DIR = os.path.join(BASE_DIR, 'after-samples')
else:
    # Baseline = P10-A3 after-samples (latest snapshot in the repo of
    # categoryFortunes advice content; P10-A3 only edited reason fields).
    SAMPLE_DIR = os.path.normpath(
        os.path.join(BASE_DIR, '..', 'phase10-agent-a3', 'after-samples')
    )

# P17-A4 patterns to flag in advice.text
PATTERNS = [
    # ~합니다 / ~한다 단정 어구 (style guide §1)
    ('합니다', '합니다'),
    ('습니다', '습니다'),
    ('됩니다', '됩니다'),
    ('입니다', '입니다'),
    ('한다', '한다 단정'),
    # 단조 반복 (task 명시)
    ('흐름이에요', '흐름이에요'),
    ('시기예요', '시기예요'),
    ('결이', '결이'),
    # 카테고리 voice 위반
    ('만남 운', '만남 운 (romance category-voice)'),
    ('인연운이 높아', '인연운 단정'),
    ('대인 매력', '대인 매력 단정'),
    ('결혼', '결혼 단정 (romance)'),
    ('면역력', '면역력 단정 (health)'),
    ('진단', '진단 단정 (health)'),
    ('검진', '검진 단정 (health)'),
    ('투자가', '투자 단정 (wealth)'),
]


def collect_advice_text(obj, accum, path=''):
    """Walk JSON and capture every categoryFortunes/<cat>/advice/<i>/text."""
    if isinstance(obj, dict):
        # Detect categoryFortunes container
        if 'categoryFortunes' in obj and isinstance(obj['categoryFortunes'], dict):
            for cat, info in obj['categoryFortunes'].items():
                if not isinstance(info, dict):
                    continue
                advice_list = info.get('advice') or []
                if isinstance(advice_list, list):
                    for i, adv in enumerate(advice_list):
                        if isinstance(adv, dict) and isinstance(adv.get('text'), str):
                            accum.append({
                                'category': cat,
                                'index': i,
                                'text': adv['text'],
                                'path': f'{path}/categoryFortunes/{cat}/advice/{i}/text',
                            })
                # Sub-domain narrative (subDomains[].narrative) -- subdomain-data file output
                subs = info.get('subDomains') or []
                if isinstance(subs, list):
                    for j, sub in enumerate(subs):
                        if isinstance(sub, dict) and isinstance(sub.get('narrative'), str):
                            accum.append({
                                'category': cat,
                                'subdomain': sub.get('name', ''),
                                'index': j,
                                'text': sub['narrative'],
                                'path': f'{path}/categoryFortunes/{cat}/subDomains/{j}/narrative',
                                'is_subdomain': True,
                            })
        for k, v in obj.items():
            if k != 'categoryFortunes':  # avoid double-walk
                collect_advice_text(v, accum, f'{path}/{k}')
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            collect_advice_text(v, accum, f'{path}/{i}')


def main():
    files = sorted(f for f in os.listdir(SAMPLE_DIR) if f.endswith('.json'))
    all_items = []
    per_file_count = 0
    for fname in files:
        fpath = os.path.join(SAMPLE_DIR, fname)
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue
        before_n = len(all_items)
        collect_advice_text(data, all_items, fname)
        if len(all_items) > before_n:
            per_file_count += 1

    print(f'Source dir: {SAMPLE_DIR}')
    print(f'Files scanned: {len(files)} ({per_file_count} contained categoryFortunes)')
    print(f'Total advice.text + subDomain narrative captured: {len(all_items)}')
    print()

    # Per-pattern counts
    print('=== Pattern counts (advice.text + subDomain narrative) ===')
    for pat, label in PATTERNS:
        hits = [it for it in all_items if pat in it['text']]
        print(f'  {label:35s} : {len(hits):4d}')
    print()

    # Repetition analysis -- text strings appearing many times across fixtures
    text_counter = Counter(it['text'] for it in all_items)
    print('=== Top 25 repeated advice.text strings ===')
    for text, n in text_counter.most_common(25):
        marker = ' <-- monotone' if n >= 8 else ''
        print(f'  {n:3d} | {text}{marker}')
    print()

    # Per-category text distribution -- catches category-voice issues
    by_cat = defaultdict(Counter)
    for it in all_items:
        if not it.get('is_subdomain'):
            by_cat[it['category']][it['text']] += 1
    print('=== Per-category top texts ===')
    for cat in sorted(by_cat):
        print(f'-- {cat} --')
        for text, n in by_cat[cat].most_common(8):
            print(f'  {n:3d} | {text}')
        print()


if __name__ == '__main__':
    main()
