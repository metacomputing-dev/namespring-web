#!/usr/bin/env python3
"""Split single-paragraph standard fragment text into 3+ paragraphs.

Strategy:
- For each text token in templateTokens of a standard fragment,
  if it has no \\n\\n already, split sentences and distribute into 3 paragraphs.
- Preserve other tokens (slot, tag) unchanged.
- Only modify standard depth fragments.
- Use STRING-REPLACE SURGERY to preserve original JSON formatting (no full reformat).

Usage:
  python split_paragraphs.py <category> <action>
    category: career, academic, family, etc., or "all" or single file path
    action: "preview" (print stats only) or "apply" (modify files)
"""
import json
import re
import sys
import os
import glob

# Sentence-end pattern: ending hangul followed by period and space (or directly Korean/Chinese-dot char)
# Requires preceding hangul char to avoid splitting on abbreviations like e.g. or numerals
SENT_END = re.compile(r'(?<=[가-힣])\.(?:\s+|(?=[가-힣·]))')

BASE = r'C:\Projects\metaintelligence\namespring-web\.claude\worktrees\agent-a7d668ba46ea8ecde\lib\spring-ts\data\narrative'


def split_sentences(text):
    """Split text into sentences. Returns list of sentences (each preserves trailing period)."""
    parts = []
    last = 0
    for m in SENT_END.finditer(text):
        parts.append(text[last:m.end()].strip())
        last = m.end()
    if last < len(text):
        parts.append(text[last:].strip())
    return [p for p in parts if p]


def split_into_paragraphs(text, target=3):
    """Split text into target paragraphs by distributing sentences."""
    if '\n\n' in text:
        return text
    sents = split_sentences(text)
    n = len(sents)
    if n < 2:
        return text
    if n <= target:
        return '\n\n'.join(sents)
    # Distribute: bias to earlier paragraphs being slightly fuller
    if n == 4:
        sizes = [2, 1, 1]
    elif n == 5:
        sizes = [2, 2, 1]
    elif n == 6:
        sizes = [2, 2, 2]
    elif n == 7:
        sizes = [3, 2, 2]
    elif n == 8:
        sizes = [3, 3, 2]
    elif n == 9:
        sizes = [3, 3, 3]
    elif n == 10:
        sizes = [4, 3, 3]
    elif n == 11:
        sizes = [4, 4, 3]
    elif n == 12:
        sizes = [4, 4, 4]
    elif n == 13:
        sizes = [5, 4, 4]
    elif n == 14:
        sizes = [5, 5, 4]
    else:
        per = n // target
        rem = n % target
        sizes = [per + (1 if i < rem else 0) for i in range(target)]
    paragraphs = []
    idx = 0
    for size in sizes:
        chunk = sents[idx:idx + size]
        paragraphs.append(' '.join(chunk))
        idx += size
    return '\n\n'.join(paragraphs)


def json_escape_value(s):
    """Encode a string as a JSON string literal (without the surrounding quotes)."""
    # json.dumps gives us proper escaping; strip outer quotes
    return json.dumps(s, ensure_ascii=False)[1:-1]


def find_text_value_in_source(source, value):
    """Find the exact JSON-encoded representation of `value` in `source`.
    Returns the matched substring (within quotes), or None.
    """
    encoded = json_escape_value(value)
    # Look for the JSON-quoted version in source
    quoted = '"' + encoded + '"'
    if quoted in source:
        return quoted
    return None


def compute_replacements(file_path):
    """Read fragments JSON, identify needed value rewrites.
    Returns list of (old_quoted, new_quoted) string pairs to apply via str.replace,
    plus stats (changed_count, before_after, new_3plus).
    """
    with open(file_path, encoding='utf-8') as f:
        source = f.read()
    try:
        data = json.loads(source)
    except json.JSONDecodeError as e:
        print(f"  WARNING: cannot parse {file_path}: {e}")
        return [], 0, 0, 0

    replacements = []  # (old_quoted, new_quoted, fragmentId)
    changed_count = 0
    new_3plus = 0
    skipped_count = 0
    for fr in data.get('fragments', []):
        if fr.get('axis', {}).get('depth') != 'standard':
            continue
        tokens = fr.get('templateTokens', [])
        text_tokens = [t for t in tokens if t.get('kind') == 'text']
        if not text_tokens:
            continue
        full_text = ''.join(t['value'] for t in text_tokens)
        before = len([p for p in full_text.split('\n\n') if p.strip()])
        if before >= 3:
            continue

        # Strategy A: Single text-only token
        if len(tokens) == 1 and tokens[0].get('kind') == 'text':
            old_value = tokens[0]['value']
            new_value = split_into_paragraphs(old_value, target=3)
            if new_value == old_value:
                skipped_count += 1
                continue
            old_q = json.dumps(old_value, ensure_ascii=False)
            new_q = json.dumps(new_value, ensure_ascii=False)
            if old_q not in source:
                print(f"  WARNING: cannot find {fr['fragmentId']} value in source")
                skipped_count += 1
                continue
            replacements.append((old_q, new_q, fr['fragmentId']))
            changed_count += 1
            after = len([p for p in new_value.split('\n\n') if p.strip()])
            if before < 3 <= after:
                new_3plus += 1
            continue

        # Strategy B: Multiple text tokens, no other types
        if all(t.get('kind') == 'text' for t in tokens) and len(tokens) >= 2:
            n_tokens = len(tokens)
            if n_tokens >= 3:
                # Add \n\n suffix to all but the last
                added = 0
                for i in range(n_tokens - 1):
                    v = tokens[i]['value']
                    if v.endswith('\n\n'):
                        continue
                    new_v = v.rstrip() + '\n\n'
                    old_q = json.dumps(v, ensure_ascii=False)
                    new_q = json.dumps(new_v, ensure_ascii=False)
                    if old_q not in source:
                        print(f"  WARNING: cannot find {fr['fragmentId']} token[{i}] in source")
                        continue
                    replacements.append((old_q, new_q, f"{fr['fragmentId']}.t{i}"))
                    added += 1
                if added > 0:
                    changed_count += 1
                    new_3plus += 1
            else:
                # 2 text tokens — split first one with \n\n + add \n\n at boundary
                t0_text = tokens[0]['value']
                t1_text = tokens[1]['value']
                t0_split = split_into_paragraphs(t0_text, target=2)
                if t0_split == t0_text:
                    # try splitting t1 instead
                    t1_split = split_into_paragraphs(t1_text, target=2)
                    if t1_split == t1_text:
                        skipped_count += 1
                        continue
                    new_t0 = t0_text.rstrip() + '\n\n'
                    old_q = json.dumps(t0_text, ensure_ascii=False)
                    new_q = json.dumps(new_t0, ensure_ascii=False)
                    if old_q in source:
                        replacements.append((old_q, new_q, f"{fr['fragmentId']}.t0"))
                    old_q1 = json.dumps(t1_text, ensure_ascii=False)
                    new_q1 = json.dumps(t1_split, ensure_ascii=False)
                    if old_q1 in source:
                        replacements.append((old_q1, new_q1, f"{fr['fragmentId']}.t1"))
                    changed_count += 1
                    after = 1 + len([p for p in t1_split.split('\n\n') if p.strip()])
                    if before < 3 <= after:
                        new_3plus += 1
                    continue
                # t0 has been split — modify
                new_t0 = t0_split.rstrip() + '\n\n'
                old_q = json.dumps(t0_text, ensure_ascii=False)
                new_q = json.dumps(new_t0, ensure_ascii=False)
                if old_q not in source:
                    print(f"  WARNING: cannot find {fr['fragmentId']} t0 in source")
                    skipped_count += 1
                    continue
                replacements.append((old_q, new_q, f"{fr['fragmentId']}.t0"))
                changed_count += 1
                after = len([p for p in t0_split.split('\n\n') if p.strip()]) + 1
                if before < 3 <= after:
                    new_3plus += 1
            continue

        # Tag-mixed tokens — skip for safety
        skipped_count += 1
    return replacements, changed_count, skipped_count, new_3plus


def apply_replacements(file_path, replacements):
    """Apply replacements via string substitution. Returns True if file changed."""
    if not replacements:
        return False
    with open(file_path, encoding='utf-8') as f:
        source = f.read()
    new_source = source
    for old_q, new_q, fragment_id in replacements:
        if old_q not in new_source:
            print(f"  WARNING: skipping {fragment_id} (already applied?)")
            continue
        # Replace only the first occurrence to avoid accidental dupes
        new_source = new_source.replace(old_q, new_q, 1)
    if new_source == source:
        return False
    with open(file_path, 'w', encoding='utf-8', newline='') as f:
        f.write(new_source)
    return True


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    target = sys.argv[1]
    action = sys.argv[2] if len(sys.argv) > 2 else 'preview'
    modify = action == 'apply'

    if target == 'all':
        files = sorted(glob.glob(os.path.join(BASE, '*', '*', 'standard.fragments.json')))
        files += sorted(glob.glob(os.path.join(BASE, '_coverage', '*.fragments.json')))
    elif target == '_coverage':
        files = sorted(glob.glob(os.path.join(BASE, '_coverage', '*.fragments.json')))
    elif target == 'main':
        files = sorted(glob.glob(os.path.join(BASE, '*', '*', 'standard.fragments.json')))
    elif os.path.exists(target):
        files = [target]
    else:
        files = sorted(glob.glob(os.path.join(BASE, target, '*', 'standard.fragments.json')))

    total_changed = 0
    total_skipped = 0
    total_3plus = 0
    files_changed = 0
    for fp in files:
        rel = os.path.relpath(fp, BASE)
        replacements, changed, skipped, three_plus = compute_replacements(fp)
        if changed > 0 or skipped > 0:
            print(f"{rel}: changed={changed} skipped={skipped} new_3plus={three_plus}")
        if modify and replacements:
            applied = apply_replacements(fp, replacements)
            if applied:
                files_changed += 1
        total_changed += changed
        total_skipped += skipped
        total_3plus += three_plus
    print(f"\nTotal: files={len(files)} changed={total_changed} skipped={total_skipped} new_3plus={total_3plus}")
    if modify:
        print(f"Files modified: {files_changed}")


if __name__ == '__main__':
    main()
