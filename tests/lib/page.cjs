// Shared Playwright helpers: open a build deterministically and drive it through R.debug.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const HARNESS = fs.readFileSync(path.join(ROOT, 'tests/harness/deterministic.js'), 'utf8');
const R128 = process.env.THREE_R128 || path.join(ROOT, 'tests/vendor/three-r128.min.js');

async function launch() {
  return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}

// Opens url with the deterministic harness. Network: the r128 CDN script is served from a local copy
// (the same file), and web fonts are blocked so text renders the same on every run.
async function openGame(browser, url, viewport, { harness = true } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.route('**/three.js/r128/three.min.js', r => r.fulfill({ path: R128, contentType: 'text/javascript' }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  if (harness) await page.addInitScript(HARNESS);
  await page.goto(url);
  await page.addStyleTag({ content: '#toasts,#hint{visibility:hidden!important}' });
  if (harness) await pumpUntilReady(page);
  return { ctx, page, errors };
}

async function pumpUntilReady(page, timeoutMs = 600000) {
  const t0 = Date.now();
  for (;;) {
    const st = await page.evaluate(() => { window.__frame(); return window.R && R.debug ? R.debug.state : 'none'; });
    if (st === 'ready') break;
    if (Date.now() - t0 > timeoutMs) throw new Error('game did not reach ready, state=' + st);
    await new Promise(r => setTimeout(r, 15));
  }
  await page.evaluate(() => window.__frames(5));
}

// Finds the track position with the sharpest heading change between 60 m and 760 m.
async function bendApex(page) {
  return page.evaluate(() => {
    let best = 0, at = 0;
    for (let s = 60; s <= 760; s++) {
      const a = R.frame(s - 2, {}).th, b = R.frame(s + 2, {}).th;
      let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      if (Math.abs(d) > best) { best = Math.abs(d); at = s; }
    }
    return at;
  });
}

async function renderInfo(page) {
  return page.evaluate(() => {
    const i = R.debug.renderer.info;
    return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures };
  });
}

module.exports = { ROOT, launch, openGame, pumpUntilReady, bendApex, renderInfo };
