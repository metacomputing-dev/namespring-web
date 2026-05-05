# Phase 3 Agent A9 baseline word-count measurement.
# Run: python artifacts/phase3-agent-a9/measure-baseline.py
import json
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
target = os.path.join(ROOT, 'data', 'narrative', 'health_stress')
files = sorted(glob.glob(os.path.join(target, '**', '*.fragments.json'), recursive=True))

total = {
    'fragments': 0,
    '결이': 0,
    '흐름': 0,
    '한 박자': 0,
    '페이스': 0,
    '결[은이가을를에로의]': 0,
    'brief.headline_violations': 0,
}
per_file = {}
violations = []

for fp in files:
    with open(fp, 'r', encoding='utf-8') as f:
        data = json.load(f)
    fc = {
        'fragments': 0,
        '결이': 0,
        '흐름': 0,
        '한 박자': 0,
        '페이스': 0,
        '결[은이가을를에로의]': 0,
        'brief.headline_violations': 0,
    }
    for frag in data.get('fragments', []):
        fc['fragments'] += 1
        tokens = frag.get('templateTokens', [])
        text = ''.join(t.get('value', '') for t in tokens if t.get('kind') == 'text')
        fc['결이'] += len(re.findall(r'결이', text))
        fc['흐름'] += len(re.findall(r'흐름', text))
        fc['한 박자'] += len(re.findall(r'한 박자', text))
        fc['페이스'] += len(re.findall(r'페이스', text))
        fc['결[은이가을를에로의]'] += len(re.findall(r'결[은이가을를에로의]', text))
        if frag.get('axis', {}).get('depth') == 'brief':
            first = ''
            for t in tokens:
                if t.get('kind') == 'text':
                    first = t.get('value', '')
                    break
            korean = re.findall(r'[가-힣]', first)
            if len(korean) > 28:
                fc['brief.headline_violations'] += 1
                violations.append({
                    'fragmentId': frag.get('fragmentId'),
                    'count': len(korean),
                    'text': first.strip(),
                })
    rel = os.path.relpath(fp, target).replace(os.sep, '/')
    per_file[rel] = fc
    for k in total:
        total[k] += fc[k]

result = {
    'measuredAt': '2026-05-05',
    'scope': 'data/narrative/health_stress/**/*.fragments.json',
    'total': total,
    'perFile': per_file,
    'violations': violations,
}

out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'baseline-word-count.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print('Wrote', out_path)
for k, v in total.items():
    print(f'  {k}: {v}')
