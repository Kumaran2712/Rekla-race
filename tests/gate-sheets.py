"""Builds gate-pack contact sheets: per preset, each fixed shot as before | after | diff heat-map.
Usage: python3 tests/gate-sheets.py <goldenDir> <candidateDir> <diffDir> <outDir> [land|port]
JPEG output keeps a pack small enough to open on a phone."""
import json, os, sys
from PIL import Image, ImageDraw

gold, cand, diff, out = sys.argv[1:5]
vp = sys.argv[5] if len(sys.argv) > 5 else 'land'
os.makedirs(out, exist_ok=True)
rows = {r['shot']: r for r in json.load(open(os.path.join(diff, 'report.json')))['rows']}
crop = (240, 60, 1040, 620) if vp == 'land' else (0, 0, 390, 844)
cw, ch = (400, 280) if vp == 'land' else (180, 390)
presets = ['noon', 'golden', 'monsoon', 'rain', 'mist'] if vp == 'land' else ['noon']
shots = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8']
for p in presets:
    names = [f'{s}-{p}' for s in shots] + ([f'U1-{p}'] if os.path.exists(os.path.join(gold, f'U1-{p}.png')) else [])
    sheet = Image.new('RGB', (cw * 3 + 40, (ch + 34) * len(names)), (24, 18, 14))
    d = ImageDraw.Draw(sheet)
    for i, n in enumerate(names):
        y = i * (ch + 34)
        r = rows.get(n + '.png', {})
        d.text((8, y + 8), f"{n}   SSIM {r.get('ssim', '-')}   pixels changed {r.get('changedPct', '-')}%", fill=(245, 234, 214))
        for j, src in enumerate([os.path.join(gold, n + '.png'), os.path.join(cand, n + '.png'), os.path.join(diff, n + '-diff.png')]):
            if os.path.exists(src):
                sheet.paste(Image.open(src).convert('RGB').crop(crop).resize((cw, ch)), (10 + j * (cw + 10), y + 28))
    sheet.save(os.path.join(out, f'{vp}-{p}.jpg'), quality=80, optimize=True)
    print('wrote', f'{vp}-{p}.jpg')
