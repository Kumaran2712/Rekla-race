// Compares two shot folders with SSIM (computed in the browser, no image libraries needed)
// and writes a diff heat-map per shot plus report.json / report.md.
// Usage: node tests/compare.cjs <goldenDir> <candidateDir> <outDir> [threshold=0.98]
const fs = require('fs');
const path = require('path');
const { launch } = require('./lib/page.cjs');

const dataUrl = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

async function main() {
  const [goldDir, candDir, outDir, thArg] = process.argv.slice(2);
  const threshold = Number(thArg || 0.98);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await launch();
  const page = await (await browser.newContext()).newPage();
  await page.setContent('<canvas id=a></canvas>');
  const rows = [];
  for (const f of fs.readdirSync(goldDir).filter(f => f.endsWith('.png')).sort()) {
    const cand = path.join(candDir, f);
    if (!fs.existsSync(cand)) { rows.push({ shot: f, ssim: null, pass: false, note: 'missing' }); continue; }
    const r = await page.evaluate(async ([a, b]) => {
      const load = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = src; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { error: 'size mismatch' };
      const w = ia.width, h = ia.height;
      const px = img => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
      const da = px(ia), db = px(ib);
      const lum = d => { const o = new Float32Array(w * h); for (let i = 0; i < w * h; i++) o[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; return o; };
      const la = lum(da), lb = lum(db);
      // mean SSIM over 8x8 windows (stride 4), standard constants for 8-bit images
      const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2, B = 8;
      let sum = 0, n = 0;
      for (let y = 0; y + B <= h; y += 4) for (let x = 0; x + B <= w; x += 4) {
        let ma = 0, mb = 0;
        for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) { const k = (y + j) * w + x + i; ma += la[k]; mb += lb[k]; }
        ma /= 64; mb /= 64;
        let va = 0, vb = 0, cov = 0;
        for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) { const k = (y + j) * w + x + i; const p = la[k] - ma, q = lb[k] - mb; va += p * p; vb += q * q; cov += p * q; }
        va /= 63; vb /= 63; cov /= 63;
        sum += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2)); n++;
      }
      // heat-map: per-pixel colour difference, amplified 4x, red over a dimmed greyscale of the golden
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
      const out = g.createImageData(w, h); let changed = 0;
      for (let i = 0; i < w * h; i++) {
        const d = (Math.abs(da[i * 4] - db[i * 4]) + Math.abs(da[i * 4 + 1] - db[i * 4 + 1]) + Math.abs(da[i * 4 + 2] - db[i * 4 + 2])) / 3;
        if (d > 8) changed++;
        const base = la[i] * 0.35;
        out.data[i * 4] = Math.min(255, base + d * 4); out.data[i * 4 + 1] = base; out.data[i * 4 + 2] = base; out.data[i * 4 + 3] = 255;
      }
      g.putImageData(out, 0, 0);
      return { ssim: sum / n, changedPct: (100 * changed) / (w * h), heat: c.toDataURL('image/png') };
    }, [dataUrl(path.join(goldDir, f)), dataUrl(cand)]);
    if (r.error) { rows.push({ shot: f, ssim: null, pass: false, note: r.error }); continue; }
    fs.writeFileSync(path.join(outDir, f.replace('.png', '-diff.png')), Buffer.from(r.heat.split(',')[1], 'base64'));
    rows.push({ shot: f, ssim: +r.ssim.toFixed(4), changedPct: +r.changedPct.toFixed(2), pass: r.ssim >= threshold });
    process.stdout.write(r.ssim >= threshold ? '.' : 'x');
  }
  await browser.close();
  const failed = rows.filter(r => !r.pass);
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ threshold, rows }, null, 2));
  const md = ['| Shot | SSIM | Pixels changed % | Pass |', '| --- | --- | --- | --- |', ...rows.map(r => `| ${r.shot} | ${r.ssim ?? '—'} | ${r.changedPct ?? '—'} | ${r.pass ? 'yes' : '**no**'} ${r.note || ''} |`)];
  fs.writeFileSync(path.join(outDir, 'report.md'), md.join('\n') + '\n');
  console.log(`\n${rows.length - failed.length}/${rows.length} at SSIM >= ${threshold}`);
  if (failed.length) console.log('below threshold:', failed.map(r => `${r.shot}=${r.ssim}`).join(', '));
}
main().catch(e => { console.error(e); process.exit(1); });
