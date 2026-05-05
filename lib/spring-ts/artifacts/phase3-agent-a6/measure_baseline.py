"""Phase 3 A6 baseline measurement for career narratives."""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
career_dir = os.path.join(ROOT, 'data', 'narrative', 'career')

results = {
    'fragments': 0,
    'brief_violations': [],
    'word_counts': {'결이': 0, '결을': 0, '결에': 0, '결로': 0, '결은': 0, '결의': 0, '흐름': 0, '한 박자': 0, '페이스': 0, '자리': 0},
    'gating_axes': {},
    'tags_used': {},
    'by_period': {},
    'by_depth': {},
}

for root, dirs, files in os.walk(career_dir):
    for fn in files:
        if fn.endswith('.fragments.json'):
            path = os.path.join(root, fn)
            with open(path, 'r', encoding='utf-8') as f:
                bundle = json.load(f)
            for frag in bundle['fragments']:
                results['fragments'] += 1
                text = ''
                for tok in frag.get('templateTokens', []):
                    if tok['kind'] == 'text':
                        text += tok.get('value', '')
                    elif tok['kind'] == 'tag':
                        text += tok.get('label', '')
                for word in results['word_counts']:
                    results['word_counts'][word] += text.count(word)
                period = frag['axis']['period']
                depth = frag['axis']['depth']
                results['by_period'][period] = results['by_period'].get(period, 0) + 1
                results['by_depth'][depth] = results['by_depth'].get(depth, 0) + 1
                if depth == 'brief':
                    hangul_count = sum(1 for c in text if '가' <= c <= '힣')
                    if hangul_count > 28:
                        results['brief_violations'].append({
                            'id': frag['fragmentId'], 'len': hangul_count, 'text': text
                        })
                gating = frag.get('gating', {})
                gkey = '|'.join(sorted(gating.keys())) if gating else 'wildcard'
                results['gating_axes'][gkey] = results['gating_axes'].get(gkey, 0) + 1
                for t in frag.get('tags', []):
                    results['tags_used'][t] = results['tags_used'].get(t, 0) + 1

total_kyeol = sum(results['word_counts'][k] for k in results['word_counts'] if k.startswith('결'))
print(f'Total fragments: {results["fragments"]}')
print(f'By period: {results["by_period"]}')
print(f'By depth: {results["by_depth"]}')
print(f'\nBrief violations (>28 chars): {len(results["brief_violations"])}')
for v in results['brief_violations']:
    print(f'  {v["id"]} len={v["len"]}: {v["text"]}')
print(f'\nWord counts:')
for w, c in results['word_counts'].items():
    print(f'  {w}: {c}')
print(f'Total "결*" forms: {total_kyeol}')
print(f'\nGating axes ({len(results["gating_axes"])} unique):')
for k, v in sorted(results['gating_axes'].items(), key=lambda x: -x[1]):
    print(f'  {k}: {v}')
print(f'\nTags used ({len(results["tags_used"])}):')
for t, c in sorted(results['tags_used'].items(), key=lambda x: -x[1]):
    print(f'  {t}: {c}')

if '--write' in sys.argv:
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'baseline.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f'\nBaseline written to {out}')
