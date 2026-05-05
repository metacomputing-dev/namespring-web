"""Audit a specific section pattern across fixtures."""
import json
import os
import sys
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')

base_dir = os.path.dirname(os.path.abspath(__file__))
fixture_dir = os.path.normpath(os.path.join(base_dir, '..', 'sample-outputs-2026-05-05-phase3'))

target_sections = sys.argv[1].split(',') if len(sys.argv) > 1 else ['personality', 'strengthsWeaknesses', 'overviewSummary', 'nameCompatibility']

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

files = sorted([f for f in os.listdir(fixture_dir) if f.endswith('.json') and f[0:2].isdigit()])
ending_counter = Counter()
all_strings = []

for fname in files:
    fpath = os.path.join(fixture_dir, fname)
    with open(fpath, encoding='utf-8') as f:
        full = json.load(f)
    data = full.get('payload', full) if isinstance(full, dict) else full
    if not isinstance(data, dict):
        continue
    for section in target_sections:
        sec = data.get(section)
        if sec is None:
            continue
        for path, text in collect_strings(sec, [fname, section]):
            all_strings.append((path, text))
            # Detect ending
            for end in ['시기예요', '한 해예요', '흐름이에요', '수 있어요', '이에요', '예요', '돼요', '해요', '좋아요']:
                if text.rstrip('.').endswith(end):
                    ending_counter[end] += 1
                    break

print(f"Section: {target_sections}")
print(f"Total strings: {len(all_strings)}")
print(f"\n=== Ending counter ===")
for k, v in sorted(ending_counter.items(), key=lambda kv: -kv[1]):
    print(f"  {k}: {v}")

# Detailed grep
print(f'\n=== Cherry-pick: 결이 / 위험 / 시기예요 / 흐름이에요 / 한 해예요 ===')
for label in ['결이', '위험', '시기예요', '흐름이에요', '한 해예요']:
    hits = [(p, t) for p, t in all_strings if label in t]
    if hits:
        print(f'\n--- {label} ({len(hits)}) ---')
        for p, t in hits[:8]:
            print(f'  {p}\n    => {t[:140]}')
