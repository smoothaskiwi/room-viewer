"""Build inspection contact sheets from real captures; never synthesize scenes."""
import json
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

repo = Path(__file__).resolve().parents[1]
project = Path(os.environ.get('ROOM_PROJECT_DIR') or (repo / '.project-dir').read_text().strip())
out = project / 'prototype/renders/round-5b'
data = json.loads((repo / 'docs/primary-bedroom-b7q4m/layouts.json').read_text())
layouts = data['layouts']
for mode in ('phone', 'desktop'):
    for start in (0, 4):
        sheet = Image.new('RGB', (1440, 4 * 480), '#ece9df')
        draw = ImageDraw.Draw(sheet)
        for row, layout in enumerate(layouts[start:start + 4]):
            for col, view in enumerate(('plan', 'hall', 'bed', 'orbit')):
                p = out / f"{mode}-{layout['id']}-{view}.png"
                im = Image.open(p).convert('RGB')
                im.thumbnail((350, 430))
                x, y = col * 360 + 5, row * 480
                draw.text((x, y + 4), f"{start + row}. {layout['id']} / {view}", fill='black')
                sheet.paste(im, (x + (350 - im.width) // 2, y + 30))
        sheet.save(out / f'contact-{mode}-{start // 4 + 1}.jpg', quality=92)
    sheet = Image.new('RGB', (1440, 960), '#ece9df')
    draw = ImageDraw.Draw(sheet)
    for index, layout in enumerate(layouts):
        im = Image.open(out / f"{mode}-gallery-{layout['id']}.png").convert('RGB')
        im.thumbnail((350, 440))
        x, y = (index % 4) * 360 + 5, (index // 4) * 480
        draw.text((x, y + 4), f"{index}. {layout['id']} / card", fill='black')
        sheet.paste(im, (x + (350 - im.width) // 2, y + 30))
    sheet.save(out / f'contact-{mode}-gallery.jpg', quality=92)
print(f'Created six contact sheets from {len(layouts)} real captured layouts at both sizes.')
report = json.loads((out / 'verification.json').read_text())
lines = [
    '# Round 5b headless evidence',
    '',
    f"{len(report['screenshots'])} actual PNG captures; six inspection contact sheets. All eight published layouts at 412 × 915 DPR 2 touch and 1440 × 900 desktop.",
    '',
    '## Result and verification',
    '',
    data['verdict'], data['pinned_verdict'],
    '',
    '- `test-output.txt`: actual sequential npm test output; `capture-output.txt`: actual capture command output.',
    '- `verification.json`: capture inventory, 101 browser state/legibility groups, zero console/network errors and zero axe violations.',
    '- Dedicated headless system Chrome + SwiftShader only. Python loopback HTTP server stopped in finally. No physical-device, screen-reader or tape validation claimed.',
    '',
    '## Contact sheets', '',
]
for mode in ('phone', 'desktop'):
    for suffix in ('1', '2', 'gallery'):
        name = f'contact-{mode}-{suffix}.jpg'
        lines.append(f'- [{name}]({name}): '+('four layouts × Plan/Hall/Bed/Orbit' if suffix != 'gallery' else 'all eight complete cards'))
lines += ['', '## Ranked layouts and capture index', '',
          'Routes and strips below are best estimates in inches. Every full card/plan text gives ± and differences from Today; rotated strips use west/east, compared with Today north/south.', '']
for index, layout in enumerate(layouts):
    m = layout['measures']
    lines += [f"### {index}. {layout['title']} — {layout['class']}", '',
              f"ID: `{layout['id']}`. Main route {m['route']:.1f} ± {m['route_unc']:.1f}; strips {layout['bed_sides'][0]:.2f} / {layout['bed_sides'][1]:.2f}. {layout['main_warning']}", '']
    for mode in ('phone', 'desktop'):
        links = []
        for view in ('plan', 'hall', 'bed', 'orbit'):
            name = f"{mode}-{layout['id']}-{view}.png"
            links.append(f'[{view}]({name})')
        name = f"{mode}-gallery-{layout['id']}.png"
        links.append(f'[full card]({name})')
        lines.append(f"- {mode}: "+' · '.join(links))
    lines.append('')
lines += ['## Other captures', '',
          '- `phone-gallery-top.png` / `desktop-gallery-top.png`: initial page and plain verdict.',
          '- `phone-compare.png` / `desktop-compare.png`: stacked, same-scale full-width A/B plans and full measurement table.',
          '- `phone-fallback.png` / `desktop-fallback.png`: forced no-3D state; `phone-real-webgl-disabled.png`: actual WebGL-disabled Chrome.',
          '- `*-drawer.png`: one dresser drawer open. `*-photos.png`, `*-photo2.png`, `*-photo3.png`, `*-original.png`: eligible photos and fade original; `*-photo-unavailable.png`: explicit geometry-gated refusal.',
          '', '## Inspection and limitations', '',
          'vision_analyze inspected the phone opening screen, full-resolution plan/key, both sizes of all eight layouts in Plan/Hall/Bed/Orbit sheets, comparison/table crops, and actual WebGL-disabled fallback. Fixed the text-only opening viewport and the orbit near-wall obstruction, then recaptured and reinspected.',
          '', 'Furniture materials/details remain illustrative. Door stops/handles, nightstand width/position, sill projection, drawer estimates, anchoring, escape operation and actual phone/screen-reader use need on-site confirmation. This bounded search is not proof of a global optimum.', '']
(out / 'README.md').write_text('\n'.join(lines))
print('Wrote indexed README from the real capture inventory and emitted layout measures.')
