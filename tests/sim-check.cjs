// Balance check v2 (approved 3 Nov 2026): 30 runs per case compared with the r128 distribution.
// Fails (exit 1) if any run does not finish, a mean finish time moves by more than meanTol seconds,
// or the win count moves by more than winTol. Usage: node tests/sim-check.cjs <url>
const fs = require('fs');
const path = require('path');
const { runSim } = require('./lib/sim.cjs');

const B = JSON.parse(fs.readFileSync(path.join(__dirname, 'sim-bounds.json'), 'utf8'));
runSim(process.argv[2] || 'http://localhost:4173/', B.runs).then(r => {
  const fails = [];
  for (const [k, base] of Object.entries(B.r128)) {
    const list = r.results[k], fins = list.map(x => x.fin).filter(x => x != null);
    const mean = fins.reduce((a, b) => a + b, 0) / fins.length, wins = list.filter(x => x.rank === 1).length;
    console.log(`${k.padEnd(14)} finished ${fins.length}/${list.length}  mean ${mean.toFixed(2)} s (r128 ${base.mean})  wins ${wins} (r128 ${base.wins})`);
    if (fins.length !== list.length) fails.push(`${k}: ${list.length - fins.length} runs did not finish`);
    if (Math.abs(mean - base.mean) > B.meanTol) fails.push(`${k}: mean ${mean.toFixed(2)} s vs r128 ${base.mean} s`);
    if (Math.abs(wins - base.wins) > B.winTol) fails.push(`${k}: ${wins} wins vs r128 ${base.wins}`);
    if (list.some(x => x.dq)) fails.push(`${k}: a disqualification`);
  }
  if (fails.length) { console.error('BALANCE FAIL\n - ' + fails.join('\n - ')); process.exit(1); }
  console.log('balance OK');
}).catch(e => { console.error(e); process.exit(1); });
