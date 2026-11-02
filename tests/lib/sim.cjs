// Runs the built-in bots (R.debug.sim) for both race modes and summarises the results.
const { launch, openGame } = require('./page.cjs');

async function runSim(url, runs = 5) {
  const browser = await launch();
  try {
    const { page, errors } = await openGame(browser, url, { width: 640, height: 360 });
    const results = await page.evaluate((runs) => {
      const res = {};
      for (const mode of ['pack', 'trial']) for (const bot of ['perfect', 'sloppy']) {
        const list = [];
        for (let i = 0; i < runs; i++) {
          R.debug.setMode(mode); R.debug.startRace(); R.debug.skip();
          list.push(R.debug.sim(150, bot));
        }
        res[mode + '-' + bot] = list;
      }
      return res;
    }, runs);
    const summary = {};
    for (const [k, list] of Object.entries(results)) {
      const fins = list.map(r => r.fin).filter(x => x != null);
      summary[k] = {
        finished: fins.length + '/' + list.length,
        finMin: Math.min(...fins), finMax: Math.max(...fins),
        ranks: list.map(r => r.rank), dq: list.filter(r => r.dq).length,
      };
    }
    return { url, runs, summary, results, errors };
  } finally {
    await browser.close();
  }
}

// Returns a list of human-readable failures against tests/sim-bounds.json.
function checkBounds(summary, bounds) {
  const fails = [];
  for (const [k, b] of Object.entries(bounds)) {
    if (k.startsWith('_')) continue;
    const s = summary[k];
    if (!s) { fails.push(`${k}: no results`); continue; }
    const [done, total] = s.finished.split('/').map(Number);
    if (done !== total) fails.push(`${k}: only ${s.finished} finished`);
    if (s.finMin < b.finMin) fails.push(`${k}: fastest ${s.finMin}s < ${b.finMin}s`);
    if (s.finMax > b.finMax) fails.push(`${k}: slowest ${s.finMax}s > ${b.finMax}s`);
    if (b.maxRank && s.ranks.some(r => r > b.maxRank)) fails.push(`${k}: ranks ${s.ranks} (must all be <= ${b.maxRank})`);
    if (b.minWorstRank && Math.max(...s.ranks) < b.minWorstRank) fails.push(`${k}: ranks ${s.ranks} (sloppy bot never dropped to ${b.minWorstRank}th)`);
    if (s.dq) fails.push(`${k}: ${s.dq} disqualified`);
  }
  return fails;
}

module.exports = { runSim, checkBounds };
