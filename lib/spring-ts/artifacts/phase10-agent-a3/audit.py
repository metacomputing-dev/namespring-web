"""P10-A3 audit script. Reads 22 fixtures and counts P10-A3 task-specific patterns.

Owned scope (text-only):
- name-compatibility-card.ts (full)
- period-fortune-card.ts (P9-A2 외 영역)
- category-fortune-card.ts -- advice[].reason 영역만

Audit targets: 단정 어구 (~합니다, 단정형), 단조 반복, 카테고리 voice (의학/결혼 단정).
"""
import json
import os
import sys
import re
from collections import Counter, defaultdict

sys.stdout.reconfigure(encoding='utf-8')

# Use the supplied --after CLI flag, or default to P9-A2 after-samples (baseline).
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

if '--after' in sys.argv:
    SAMPLE_DIR = os.path.join(BASE_DIR, 'after-samples')
else:
    SAMPLE_DIR = os.path.normpath(
        os.path.join(BASE_DIR, '..', 'phase9-agent-a2', 'after-samples')
    )

# Sections P10-A3 owns:
#   nameCompatibility -- full audit (P9-A2 left this untouched)
#   dailyFortune / weeklyFortune / monthlyFortune / yearlyFortune -- audit
#     all visible prose (summary, goodActions, badActions, warning, evidence)
#   categoryFortunes -- ONLY advice[].reason
SECTION_AUDITS = {
    'nameCompatibility': {'kind': 'full'},
    'dailyFortune': {'kind': 'period_full'},
    'weeklyFortune': {'kind': 'period_full'},
    'monthlyFortune': {'kind': 'period_full'},
    'yearlyFortune': {'kind': 'period_full'},
    'categoryFortunes': {'kind': 'category_advice_reason_only'},
}

# Patterns to flag
PATTERNS = [
    # 단정 어구 (assertive endings) -- should be ~해요 / ~에요 voice
    ('합니다', '합니다'),
    ('습니다', '습니다'),
    ('됩니다', '됩니다'),
    ('입니다', '입니다'),
    # 단정형 결혼/연애 (risky in romance category)
    ('결혼', '결혼'),
    ('인연운이 높아져', '인연운이 높아져'),
    ('대인 매력', '대인 매력'),
    ('만남 운', '만남 운'),
    # 단정형 의학 (medical claims)
    ('면역력', '면역력'),
    ('장기는', '장기는'),
    ('관련 장기', '관련 장기'),
    ('검진', '검진'),
    ('진단', '진단'),
    ('발병', '발병'),
    ('약을', '약을'),
    ('병이', '병이'),
    ('장기로', '장기로'),
    # 단정형 wealth (financial advice)
    ('투자', '투자'),
    ('보증', '보증'),
    ('대출', '대출'),
    # 강한 단정
    ('확률이 높아요', '확률이 높아요'),
    ('가능성이 높아져', '가능성이 높아져'),
    ('가능성이 높아요', '가능성이 높아요'),
    # 단조 반복 (P9-A2 외 영역에 남았을 단조)
    ('흐름이에요', '흐름이에요'),
    ('시기예요', '시기예요'),
    ('한 해예요', '한 해예요'),
    ('결이', '결이'),
    ('한 해예', '한 해예'),
    ('잘 어울려요', '잘 어울려요'),
    ('도움이 돼요', '도움이 돼요'),
    ('줘요', '줘요'),
    # 강한 verb-final 어조 (단조 회피 후보)
    ('우수해요', '우수해요'),
    ('어울려요', '어울려요'),
    ('아주 잘 어울려요', '아주 잘 어울려요'),
    ('매우 잘 어울려요', '매우 잘 어울려요'),
    ('잘 흐르고 있어서', '잘 흐르고 있어서'),
    # P10-A3 task 명시 단조 후보
    ('지키는 힘', '지키는 힘'),
    ('자연스럽게 좋아져요', '자연스럽게 좋아져요'),
    ('매력이 자연스럽게 올라', '매력이 자연스럽게 올라'),
]


def collect_with_path(obj, path, accum):
    if isinstance(obj, dict):
        for k, v in obj.items():
            collect_with_path(v, path + [k], accum)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            collect_with_path(v, path + [str(i)], accum)
    elif isinstance(obj, str):
        accum.append(('/'.join(path), obj))


def collect_strings_for_section(section_name, section_obj, audit_kind, fname):
    """Collect strings for audit per the section's audit kind."""
    out = []
    if section_obj is None:
        return out
    if audit_kind == 'full':
        collect_with_path(section_obj, [fname, section_name], out)
    elif audit_kind == 'period_full':
        # All prose for period fortune cards
        collect_with_path(section_obj, [fname, section_name], out)
    elif audit_kind == 'category_advice_reason_only':
        # categoryFortunes is a dict: { wealth: {...}, health: {...}, ... }
        if isinstance(section_obj, dict):
            for cat_name, cat_obj in section_obj.items():
                advice = cat_obj.get('advice') if isinstance(cat_obj, dict) else None
                if isinstance(advice, list):
                    for i, adv in enumerate(advice):
                        if isinstance(adv, dict):
                            reason = adv.get('reason')
                            if isinstance(reason, str):
                                out.append((
                                    f'{fname}/{section_name}/{cat_name}/advice/{i}/reason',
                                    reason,
                                ))
    return out


def main():
    files = sorted([
        f for f in os.listdir(SAMPLE_DIR)
        if f.endswith('.json') and f[0:2].isdigit()
    ])
    count = Counter()
    detail = defaultdict(list)
    all_strings = []
    section_string_counts = Counter()
    period_summaries = []

    for fname in files:
        fpath = os.path.join(SAMPLE_DIR, fname)
        try:
            with open(fpath, encoding='utf-8') as f:
                full = json.load(f)
        except Exception as e:
            print(f"FAIL load {fname}: {e}")
            continue
        data = full.get('payload', full) if isinstance(full, dict) else full
        if not isinstance(data, dict):
            continue
        for section_name, audit_cfg in SECTION_AUDITS.items():
            section = data.get(section_name)
            strs = collect_strings_for_section(
                section_name, section, audit_cfg['kind'], fname,
            )
            section_string_counts[section_name] += len(strs)
            for path, text in strs:
                all_strings.append((path, text))
                # Capture period summaries for monotony audit
                if section_name in ('dailyFortune', 'weeklyFortune', 'monthlyFortune', 'yearlyFortune'):
                    if path.endswith(f'{section_name}/summary'):
                        period_summaries.append((fname, section_name, text))
                for label, pat in PATTERNS:
                    if pat in text:
                        n = text.count(pat)
                        count[label] += n
                        if len(detail[label]) < 12:
                            detail[label].append((path, text[:200]))

    print(f"Files: {len(files)}")
    print(f"Total strings collected: {len(all_strings)}")
    print()
    print("=== Section string counts ===")
    for k, v in section_string_counts.items():
        print(f'  {k}: {v}')

    print('\n=== Pattern hit counts ===')
    for label, _ in PATTERNS:
        if count[label] > 0:
            print(f'  {label}: {count[label]}')

    print('\n=== Detail ===')
    for label, _ in PATTERNS:
        if not detail[label]:
            continue
        print(f'\n--- {label} ({count[label]} hits) ---')
        for d in detail[label][:6]:
            print(f'  {d[0]}\n    => {d[1]}')

    # Period summary monotony audit
    print('\n=== Period summary distinct endings audit ===')
    summary_endings = Counter()
    for _, _, text in period_summaries:
        # Capture last clause ending pattern
        m = re.search(r'([가-힣]+(?:이에요|예요|에요|좋아요|돼요|해요|어요)\.?)\s*$', text.strip())
        if m:
            summary_endings[m.group(1)] += 1
    for k, v in sorted(summary_endings.items(), key=lambda x: -x[1])[:10]:
        print(f'  {k}: {v}')

    # nameCompatibility detail audit
    print('\n=== nameCompatibility specific term audit ===')
    nc_count = Counter()
    nc_examples = defaultdict(list)
    nc_terms = ['우수해요', '훌륭하게', '매우 잘 어울려요', '아주 잘 어울려요',
                '아주 훌륭하게', '아주 좋은', '최고로', '최고 수준', '단단해요',
                '맞아요', '나쁜', '없어요', '있어요']
    for path, text in all_strings:
        if '/nameCompatibility/' in path:
            for term in nc_terms:
                if term in text:
                    nc_count[term] += 1
                    if len(nc_examples[term]) < 3:
                        nc_examples[term].append((path, text[:200]))
    for term, n in sorted(nc_count.items(), key=lambda x: -x[1]):
        print(f'  {term}: {n}')
        for d in nc_examples[term][:2]:
            print(f'      {d[0]}\n        => {d[1]}')

    # categoryFortunes advice.reason monotone audit
    print('\n=== categoryFortunes advice.reason monotone audit ===')
    cat_reasons = defaultdict(list)
    for path, text in all_strings:
        m = re.match(r'^[^/]+/categoryFortunes/([^/]+)/advice/\d+/reason$', path)
        if m:
            cat = m.group(1)
            cat_reasons[cat].append(text)
    for cat in ['wealth', 'health', 'academic', 'romance', 'family']:
        rs = cat_reasons.get(cat, [])
        cnt = Counter(rs)
        print(f'\n  {cat} ({len(rs)} reasons, {len(cnt)} unique):')
        for txt, n in sorted(cnt.items(), key=lambda x: -x[1])[:6]:
            print(f'    [{n}x] {txt[:160]}')

    # Period bad-action reason monotone (P9-A2 split adultText, but reason was uniform)
    print('\n=== Period bad-action reason monotone audit ===')
    period_bad_reasons = defaultdict(list)
    for path, text in all_strings:
        m = re.match(r'^[^/]+/(dailyFortune|weeklyFortune|monthlyFortune|yearlyFortune)/badActions/\d+/reason$', path)
        if m:
            period_bad_reasons[m.group(1)].append(text)
    for pk in ['dailyFortune', 'weeklyFortune', 'monthlyFortune', 'yearlyFortune']:
        rs = period_bad_reasons.get(pk, [])
        cnt = Counter(rs)
        print(f'\n  {pk} ({len(rs)} reasons, {len(cnt)} unique):')
        for txt, n in sorted(cnt.items(), key=lambda x: -x[1])[:6]:
            print(f'    [{n}x] {txt[:160]}')

    # Period good-action reason monotone
    print('\n=== Period good-action reason monotone audit ===')
    period_good_reasons = defaultdict(list)
    for path, text in all_strings:
        m = re.match(r'^[^/]+/(dailyFortune|weeklyFortune|monthlyFortune|yearlyFortune)/goodActions/\d+/reason$', path)
        if m:
            period_good_reasons[m.group(1)].append(text)
    for pk in ['dailyFortune', 'weeklyFortune', 'monthlyFortune', 'yearlyFortune']:
        rs = period_good_reasons.get(pk, [])
        cnt = Counter(rs)
        print(f'\n  {pk} ({len(rs)} reasons, {len(cnt)} unique):')
        for txt, n in sorted(cnt.items(), key=lambda x: -x[1])[:6]:
            print(f'    [{n}x] {txt[:160]}')

    # Warning monotone (warning fields)
    print('\n=== Period warning monotone audit ===')
    warn_signals = defaultdict(list)
    warn_responses = defaultdict(list)
    warn_reasons = defaultdict(list)
    for path, text in all_strings:
        m = re.match(r'^[^/]+/(dailyFortune|weeklyFortune|monthlyFortune|yearlyFortune)/warning/(signal|response|reason)$', path)
        if m:
            pk, field = m.group(1), m.group(2)
            target = warn_signals if field == 'signal' else warn_responses if field == 'response' else warn_reasons
            target[pk].append(text)
    for pk in ['dailyFortune', 'weeklyFortune', 'monthlyFortune', 'yearlyFortune']:
        for label, dct in [('signal', warn_signals), ('response', warn_responses), ('reason', warn_reasons)]:
            rs = dct.get(pk, [])
            cnt = Counter(rs)
            if rs:
                print(f'\n  {pk}/{label} ({len(rs)} hits, {len(cnt)} unique):')
                for txt, n in sorted(cnt.items(), key=lambda x: -x[1])[:4]:
                    print(f'    [{n}x] {txt[:160]}')

    suffix = '_after' if '--after' in sys.argv else '_baseline'
    # Save full detail
    with open(os.path.join(BASE_DIR, f'audit_detail{suffix}.json'), 'w', encoding='utf-8') as f:
        json.dump({
            'count': dict(count),
            'detail': {
                k: [{'path': d[0], 'text': d[1]} for d in v]
                for k, v in detail.items() if v
            },
            'cat_reasons_unique': {
                cat: dict(Counter(rs)) for cat, rs in cat_reasons.items()
            },
            'period_bad_reasons_unique': {
                pk: dict(Counter(rs)) for pk, rs in period_bad_reasons.items()
            },
            'period_good_reasons_unique': {
                pk: dict(Counter(rs)) for pk, rs in period_good_reasons.items()
            },
            'name_compat_term_count': dict(nc_count),
        }, f, ensure_ascii=False, indent=2)
    print(f'\nWritten audit_detail{suffix}.json')


if __name__ == '__main__':
    main()
