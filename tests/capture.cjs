// Captures the fixed gate shots (tests/cameras.json) from a running build.
// Usage: node tests/capture.cjs <url> <outDir> [land|port] [presets,comma,separated|all] [extra query, e.g. tier=3]
const fs = require('fs');
const path = require('path');
const { ROOT, launch, openGame, bendApex, renderInfo } = require('./lib/page.cjs');

const cams = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/cameras.json'), 'utf8'));

async function main() {
  const [baseUrl, outDir, vpName = 'land', presetArg, query] = process.argv.slice(2);
  const presets = presetArg && presetArg !== 'all' ? presetArg.split(',') : cams.presets;
  const url = query ? baseUrl + (baseUrl.includes('?') ? '&' : '?') + query : baseUrl;
  const viewport = cams.viewports[vpName];
  const dir = path.join(outDir, vpName);
  fs.mkdirSync(dir, { recursive: true });
  const browser = await launch();
  const t0 = Date.now();
  const { page, errors } = await openGame(browser, url, viewport);
  const loadMs = Date.now() - t0;
  const apex = await bendApex(page);
  const manifest = { url, viewport: vpName, bendApex: apex, loadMsHeadless: loadMs, shots: {} };
  const shoot = async (name) => {
    await page.evaluate(() => window.__frames(4));
    await page.screenshot({ path: path.join(dir, name + '.png'), timeout: 240000 });
    manifest.shots[name] = await renderInfo(page);
    process.stdout.write('.');
  };

  // Menu shots: the start card hidden for V1, shown for U1.
  for (const p of presets) {
    await page.evaluate(([p, o]) => {
      R.debug.setAtmo(p); R.debug.camOverride = o;
      document.getElementById('startOv').style.visibility = 'hidden';
    }, [p, cams.shots.find(s => s.id === 'V1').override]);
    await shoot('V1-' + p);
  }
  await page.evaluate(() => { R.debug.camOverride = null; document.getElementById('startOv').style.visibility = ''; R.debug.setAtmo('noon'); R.debug.snapCam && R.debug.snapCam(); });
  await shoot('U1-noon');

  // Race shots: start, skip the countdown, run the perfect bot to racing speed, then place each shot.
  await page.evaluate(() => { window.__reseed(777); R.debug.startRace(); R.debug.skip(); window.__frames(2); R.debug.sim(8, 'perfect'); });
  for (const p of presets) {
    await page.evaluate(p => R.debug.setAtmo(p), p);
    for (const shot of cams.shots.filter(s => s.phase === 'race')) {
      const s = shot.s;
      await page.evaluate(([s, cam, o]) => {
        R.debug.jump(s);
        if (o) R.debug.camOverride = o; else { R.debug.camOverride = null; R.debug.setCam(cam); }
      }, [s, shot.cam ?? 0, shot.override]);
      await shoot(shot.id + '-' + p);
    }
  }
  manifest.errors = errors;
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await browser.close();
  console.log('\nshots:', Object.keys(manifest.shots).length, 'apex:', apex, 'errors:', errors.length);
}
main().catch(e => { console.error(e); process.exit(1); });
