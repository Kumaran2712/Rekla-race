// Balance as a distribution (proposed replacement for the 5-run min/max bounds, pending sign-off).
// Runs every case N times on a candidate and on the r128 baseline and compares mean and p90 finish
// times and the rank mix. Usage: node tests/sim-dist.cjs <candidateUrl> [baselineUrl] [runs=30]
const fs = require('fs');
const path = require('path');
const { launch, openGame } = require('./lib/page.cjs');

const CASES = [['pack', 'perfect'], ['pack', 'sloppy'], ['trial', 'perfect'], ['trial', 'sloppy']];
const stats = list => {
  const f = list.map(r => r.fin).filter(x => x != null).sort((a, b) => a - b);
  const q = p => f[Math.min(f.length - 1, Math.floor(f.length * p))];
  return { n: list.length, finished: f.length, mean: +(f.reduce((a, b) => a + b, 0) / f.length).toFixed(2), median: q(0.5), p90: q(0.9), max: f[f.length - 1],
    wins: list.filter(r => r.rank === 1).length, falls: list.filter(r => r.thrown > 0).length };
};

async function run(browser, url, runs) {
  const { page } = await openGame(browser, url, { width: 200, height: 120 });
  const out = {};
  for (const [mode, bot] of CASES) {
    out[`${mode}-${bot}`] = stats(await page.evaluate(([mode, bot, runs]) => {
      const list = [];
      for (let i = 0; i < runs; i++) { R.debug.setMode(mode); R.debug.startRace(); R.debug.skip(); list.push(R.debug.sim(150, bot)); }
      return list;
    }, [mode, bot, runs]));
  }
  await page.context().close();
  return out;
}

async function main() {
  const [cand, base = 'http://localhost:8128/index.html', runsArg] = process.argv.slice(2);
  const runs = Number(runsArg || 30);
  const browser = await launch();
  const b = await run(browser, base, runs), c = await run(browser, cand, runs);
  await browser.close();
  const rows = [];
  let fail = false;
  for (const k of Object.keys(b)) {
    const dMean = +(c[k].mean - b[k].mean).toFixed(2), dP90 = +(c[k].p90 - b[k].p90).toFixed(2);
    const ok = Math.abs(dMean) <= 0.5 && Math.abs(dP90) <= 1.0 && Math.abs(c[k].wins - b[k].wins) <= Math.max(3, runs * 0.15) && c[k].finished === c[k].n;
    if (!ok) fail = true;
    rows.push({ case: k, baseMean: b[k].mean, newMean: c[k].mean, dMean, baseP90: b[k].p90, newP90: c[k].p90, dP90, baseWins: b[k].wins, newWins: c[k].wins, baseMax: b[k].max, newMax: c[k].max, ok });
  }
  console.table(rows);
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'out', 'sim-dist.json'), JSON.stringify({ runs, base: b, candidate: c, rows }, null, 2));
  if (fail) { console.error('DISTRIBUTION DIFFERS'); process.exit(1); }
  console.log(`balance distribution OK over ${runs} runs per case (mean within 0.5 s, p90 within 1.0 s, wins within 15%)`);
}
main().catch(e => { console.error(e); process.exit(1); });
