// Frame-rate independence (M1 gate 5): the same timestamped shouts, played at 60, 30 and 20 FPS,
// must give identical grades, identical race state and no catch-up drops. 10 FPS is also run to show
// the 4-step cap engaging (the game slows rather than spirals); it is reported, not required to match.
// Usage: node tests/timing.cjs [url]
const { launch, openGame } = require('./lib/page.cjs');

// Shout times (ms after the race starts): roughly one per stride, jittered so grades vary.
function tapPlan(seconds) {
  let a = 987654321, t = 400;
  const r = () => { a = (a + 0x6d2b79f5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const taps = [];
  while (t < seconds * 1000) { taps.push(+t.toFixed(3)); t += 230 + r() * 140; }
  return taps;
}

async function runAt(browser, url, fps, taps, seconds) {
  const { page, errors } = await openGame(browser, url + (url.includes('?') ? '&' : '?') + 'seed=4242', { width: 200, height: 120 });
  const res = await page.evaluate(([fps, taps, seconds]) => {
    R.debug.setMode('pack');
    const t0 = performance.now();
    R.debug.startRace(); R.debug.skip();
    const dt = 1000 / fps;
    let now = t0, i = 0;
    while (now - t0 < seconds * 1000) {
      const next = now + dt;
      // events that happened before this frame arrive with their own timestamps
      while (i < taps.length && t0 + taps[i] <= next) R.debug.tapAt(t0 + taps[i++]);
      window.__frame(dt);
      now = next;
    }
    const P = R.debug.P;
    return {
      grades: R.debug.judgeLog.map(j => j.grade),
      dist: P.dist, v: P.v, stam: P.stam, step: P.step,
      rivals: R.debug.carts.filter(c => !c.player).map(c => +c.dist.toFixed(6)),
      clock: R.debug.clock, seed: R.debug.raceSeed,
    };
  }, [fps, taps, seconds]);
  await page.context().close();
  return { fps, ...res, errors: errors.filter(e => !/ERR_FAILED/.test(e)) };
}

async function main() {
  const url = process.argv[2] || 'http://localhost:4173/';
  const seconds = 8, taps = tapPlan(seconds);
  const browser = await launch();
  const runs = [];
  for (const fps of [60, 30, 20, 10]) { runs.push(await runAt(browser, url, fps, taps, seconds)); process.stdout.write(fps + ' '); }
  await browser.close();
  const ref = runs[0];
  const count = g => ({ perfect: g.filter(x => x === 'perfect').length, good: g.filter(x => x === 'good').length, off: g.filter(x => x === 'off').length });
  let fail = false;
  console.log('\nFPS | grades (perfect/good/off) | player dist m | cap hits | identical to 60 FPS');
  for (const r of runs) {
    const same = JSON.stringify(r.grades) === JSON.stringify(ref.grades) && Math.abs(r.dist - ref.dist) < 1e-6 && JSON.stringify(r.rivals) === JSON.stringify(ref.rivals);
    const c = count(r.grades);
    console.log(`${r.fps} | ${c.perfect}/${c.good}/${c.off} of ${r.grades.length} | ${r.dist.toFixed(4)} | ${r.clock.capHits} | ${same ? 'yes' : 'NO'}`);
    if (r.fps >= 20 && (!same || r.clock.capHits > 0)) fail = true;
    if (r.errors.length) { console.log('  errors:', r.errors.slice(0, 3).join(' | ')); fail = true; }
  }
  if (ref.grades.length < taps.length * 0.8) { console.log(`only ${ref.grades.length} of ${taps.length} taps judged`); fail = true; }
  if (fail) { console.error('TIMING FAIL'); process.exit(1); }
  console.log('timing OK: identical grades and race state at 60, 30 and 20 FPS');
}
main().catch(e => { console.error(e); process.exit(1); });
