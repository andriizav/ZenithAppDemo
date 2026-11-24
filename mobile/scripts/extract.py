src = open('mobile.css', encoding='utf-8').read()
lines = src.split('\n')
light_ranges = []
i = 0
n = len(lines)
while i < n:
    if ':root[data-theme="light"]' in lines[i]:
        start = i
        j = i
        while j < n:
            if lines[j].startswith(':root[data-theme="light"]'):
                j += 1
            elif lines[j].strip() == '' and j+1 < n and lines[j+1].startswith(':root[data-theme="light"]'):
                j += 1
            else:
                break
        end = j-1
        light_ranges.append((start, end))
        i = j
    else:
        i += 1

extracted = ['\n'.join(lines[s:e+1]) for (s,e) in light_ranges]
for (s,e) in reversed(light_ranges):
    del lines[s:e+1]

def collapse(seq):
    out=[]; blank=0
    for ln in seq:
        if ln.strip()=='':
            blank+=1
            if blank<=2: out.append(ln)
        else:
            blank=0; out.append(ln)
    return out

lines = collapse(lines)
open('mobile.css','w',encoding='utf-8').write('\n'.join(lines))

with open('theme-light.css','a',encoding='utf-8') as f:
    f.write('\n\n/* ============================================================\n   EXTRACTED FROM mobile.css \u2014 LIGHT THEME RULES\n   ============================================================ */\n\n')
    f.write('\n\n'.join(extracted))

with open('extract.log','w',encoding='utf-8') as log:
    log.write("Extracted blocks: %d\n" % len(light_ranges))
    log.write("Total extracted lines: %d\n" % sum(e-s+1 for s,e in light_ranges))
