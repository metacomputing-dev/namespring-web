"""P9-A2 audit script. Reads 22 fixtures and counts forbidden patterns in legacy fields."""
import json
import os
import sys

# UTF-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

legacy_keys = [
    'overviewSummary',
    'lifeFortuneOverview',
    'personality',
    'strengthsWeaknesses',
    'dailyFortune',
    'weeklyFortune',
    'monthlyFortune',
    'yearlyFortune',
    'lifeStageFortune',
    'nameCompatibility',
]

# Forbidden / monitored patterns (label, korean_pattern)
patterns = [
    ('위험', '위험'),
    ('결이', '결이'),
    ('시기예요', '시기예요'),
    ('할 수 있어요', '할 수 있어요'),
    ('수 있어요', '수 있어요'),
    ('흐름이에요', '흐름이에요'),
    ('한 해예요', '한 해예요'),
    ('전성기', '전성기'),
    ('큰 계약', '큰 계약'),
    ('투자', '투자'),
    ('연애', '연애'),
    ('결혼', '결혼'),
    ('만남', '만남'),
    ('의학', '의학'),
    ('진단', '진단'),
    ('검진', '검진'),
    ('장기는', '장기는'),
    ('면역력', '면역력'),
    ('발병', '발병'),
    ('이에요', '이에요'),
    ('예요', '예요'),
    ('해요', '해요'),
    ('좋아요', '좋아요'),
]

def collect_strings(obj, key_path):
    out = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            out += collect_strings(v, key_path + [k])
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            out += collect_strings(v, key_path + [str(i)])
    elif isinstance(obj, str):
        out.append(('/'.join(key_path), obj))
    return out

base_dir = os.path.dirname(os.path.abspath(__file__))
fixture_dir = os.path.normpath(os.path.join(base_dir, '..', 'sample-outputs-2026-05-05-phase3'))

count = {p[0]: 0 for p in patterns}
detail = {p[0]: [] for p in patterns}
files = sorted([f for f in os.listdir(fixture_dir) if f.endswith('.json') and f[0:2].isdigit()])
total_strings = 0
all_strings = []  # to dump all unique strings for later analysis

for fname in files:
    fpath = os.path.join(fixture_dir, fname)
    try:
        with open(fpath, encoding='utf-8') as f:
            full = json.load(f)
    except Exception as e:
        print(f"FAIL load {fname}: {e}")
        continue
    # Fixtures wrap payload under 'payload'
    data = full.get('payload', full) if isinstance(full, dict) else full
    if not isinstance(data, dict):
        continue
    for legacy_key in legacy_keys:
        section = data.get(legacy_key)
        if section is None:
            continue
        strs = collect_strings(section, [fname, legacy_key])
        total_strings += len(strs)
        for path, text in strs:
            all_strings.append((path, text))
            for label, pat in patterns:
                if pat in text:
                    count[label] += text.count(pat)
                    if len(detail[label]) < 8:
                        detail[label].append((path, text[:140]))

print(f"Total strings: {total_strings}")
print(f"Total files: {len(files)}")
print('\n=== Counts ===')
for label, c in count.items():
    print(f'  {label}: {c}')

print('\n=== Detail (sample) ===')
for label in ['위험', '결이', '시기예요', '할 수 있어요', '전성기', '큰 계약', '투자', '연애', '결혼', '의학', '진단', '면역력', '발병']:
    if not detail[label]:
        continue
    print(f'\n--- {label} ({count[label]} hits) ---')
    for d in detail[label]:
        print(f'  {d[0]}\n    => {d[1]}')

# Dump every detail for monotonous endings
for label in ['시기예요', '한 해예요', '흐름이에요', '수 있어요']:
    if not detail[label]:
        continue
    print(f'\n--- {label} ({count[label]} hits) all_examples ---')
    # collect more than 8
    seen = []
    for path, text in all_strings:
        if patterns_dict := dict(patterns):
            if label in patterns_dict and patterns_dict[label] in text:
                seen.append((path, text[:150]))
                if len(seen) >= 20:
                    break
    for s in seen:
        print(f'  {s[0]}\n    => {s[1]}')

# Also write detail JSON
with open(os.path.join(base_dir, 'audit_baseline_detail.json'), 'w', encoding='utf-8') as f:
    json.dump({
        'count': count,
        'detail': {k: [{'path': d[0], 'text': d[1]} for d in v] for k, v in detail.items()},
    }, f, ensure_ascii=False, indent=2)
print('\nWritten: audit_baseline_detail.json')
