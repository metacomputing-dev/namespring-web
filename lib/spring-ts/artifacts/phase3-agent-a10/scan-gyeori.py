import json, glob, re, os, sys
import io
sys.stdout.reconfigure(encoding='utf-8')

files = sorted(glob.glob('data/narrative/movement/**/*.fragments.json', recursive=True))
all_phrases = []
for f in files:
    with open(f, encoding='utf-8') as fh:
        text = fh.read()
    for m in re.finditer('결이', text):
        start = max(0, m.start()-30)
        end = min(len(text), m.end()+30)
        ctx = text[start:end]
        ctx = re.sub(r'\s+', ' ', ctx)
        f_short = f.replace(os.sep, '/').split('movement/')[-1]
        all_phrases.append((f_short, ctx[:120]))
print('Total:', len(all_phrases))
for f, c in all_phrases:
    print('  ' + f + '  ::  ' + c)
