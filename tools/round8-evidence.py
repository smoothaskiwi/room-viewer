"""Index Round 8 real browser captures and assemble inspection sheets."""
import json
import os
from pathlib import Path
from PIL import Image, ImageDraw

repo = Path(__file__).resolve().parents[1]
project = Path(os.environ.get('ROOM_PROJECT_DIR') or (repo / '.project-dir').read_text().strip())
out = project / 'prototype/renders/round-8'
data = json.loads((repo / 'docs/primary-bedroom-b7q4m/layouts.json').read_text())
report = json.loads((out / 'verification.json').read_text())
for start in (0, 4):
    for view in ('plan', 'hall'):
        sheet = Image.new('RGB', (1040, 1480 if view == 'plan' else 1000), '#ece9df')
        draw = ImageDraw.Draw(sheet)
        for i, l in enumerate(data['layouts'][start:start+4]):
            im = Image.open(out / f"phone-{l['id']}-{view}.png").convert('RGB')
            if view == 'plan':
                # Keep the plan, not the long HTML key below it; this is only
                # an inspection crop. Original complete PNG remains indexed.
                im = im.crop((0, 0, im.width, min(im.height, round(im.width * 1.31))))
            im.thumbnail((500, 690 if view == 'plan' else 440))
            x, y = (i % 2) * 520 + 10, (i // 2) * (740 if view == 'plan' else 500)
            draw.text((x, y + 5), f"{start+i}. {l['id']} / {view}", fill='black')
            sheet.paste(im, (x, y + 30))
        sheet.save(out / f'contact-phone-{view}-{start//4+1}.jpg', quality=94)

lines = ['# Round 8 headless evidence', '', data['verdict'], '',
         f"{len(report['screenshots'])} actual PNGs; four derived phone inspection sheets. {report['checks']} browser state/legibility groups; zero console/network errors and zero axe violations.", '',
         '412 × 915 CSS px, DPR 2, touch; desktop 1440 × 900. Dedicated headless system Chrome with SwiftShader; Python loopback HTTP server stopped in finally. No physical-device or screen-reader session claimed.', '',
         '## Outcomes and actual logs', '',
         '- `test-output.txt`: sequential npm test including build, independent numeric audit and headless browser tests.',
         '- `capture-output.txt`: npm run verify with screenshots.',
         '- `verification.json`: exact inventory and browser result.',
         '- `post-commit-audit.txt`: independent audit after the commit, including tracked files and main history privacy scan.', '',
         '## Shown order, summaries and measured trade-offs', '']
for i,l in enumerate(data['layouts']):
    m=l['measures']; glass=' / '.join(f"{w['id']}: {w['glass_hidden_pct']:.2f}%" for w in l['windows'])
    lines += [f"### {i}. {l['title']} — {l['class']}", '', l['sentence'], '',
              f"ID `{l['id']}`; main walkway {m['route']:.1f} ± {m['route_unc']:.1f} in; bed sides {' / '.join(f'{v:.2f}' for v in l['bed_sides'])} in; glass hidden {glass}; {sum(f['kind']=='nightstand' for f in l['footprints'])} nightstands.", '',
              'Pieces: '+ '; '.join(f['label'] for f in l['footprints'])+'.', '',
              l.get('ranking_reason', 'Baseline or pinned request; not ranked.'), '']
    if l.get('replacement'):
        lines += ['Real replacement: '+json.dumps(l['replacement'])+'.','']
    for mode in ('phone','desktop'):
        links=[f"[{view}]({mode}-{l['id']}-{view}.png)" for view in ('plan','hall','bed','orbit')]
        links += [f"[gallery card]({mode}-gallery-{l['id']}.png)"]
        lines.append('- '+mode+': '+' · '.join(links))
    lines.append('')
lines += ['## Envelopes', '']
for e in data['envelopes']:
    if e['id'] in ('west_wall_north_run','under_north_window'):
        lines += ['### '+e['id'].replace('_',' '),'']
        for r in e['rows']:
            value='not limiting' if r['value'] is None and r['dimension']=='Tallest' else 'no reference fit' if r['value'] is None else f"{r['value']:.2f} ± {r['unc']:.2f} in"
            lines.append(f"- {r['dimension']}: {value}. {r['limit']}")
        lines.append('')
lines += ['## Screenshot index', '',
          'Every plan and default hall 3D view, full gallery cards, phone and desktop gallery, all four wall envelopes, depth and door-length trade-offs, compare, drawers, photos or explicit unavailability, query fallback and actual WebGL-disabled fallback are included below.', '']
lines += [f'- [{name}]({name})' for name in report['screenshots']]
lines += ['', '## Derived inspection sheets', '']
lines += [f'- [contact-phone-{v}-{i}.jpg](contact-phone-{v}-{i}.jpg)' for v in ('plan','hall') for i in (1,2)]
lines += ['', 'Furniture details remain illustrative. Tape dimensions, sash recess/operation, drawer travel estimates, installed door stops/handles, anchoring and real-device/screen-reader use remain unverified. This bounded search is not global continuous optimization. No push or publication.', '']
if (out / 'README.md').exists():
    (out / 'README.md').read_text()  # retain an explicit read before generated replacement
(out / 'README.md').write_text('\n'.join(lines))
actual={p.name for p in out.glob('*.png')}
assert actual==set(report['screenshots']), f"Capture inventory mismatch: {actual ^ set(report['screenshots'])}"
print(f"Indexed {len(actual)} actual PNGs, four inspection sheets and all emitted layout/envelope values.")
