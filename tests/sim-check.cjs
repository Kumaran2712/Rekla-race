// Fails (exit 1) if gameplay balance leaves the bounds recorded from the r128 baseline.
// Usage: node tests/sim-check.cjs <url>
const fs = require('fs');
const path = require('path');
const { runSim, checkBounds } = require('./lib/sim.cjs');

const bounds = JSON.parse(fs.readFileSync(path.join(__dirname, 'sim-bounds.json'), 'utf8'));
runSim(process.argv[2] || 'http://localhost:4173/', 5).then(r => {
  for (const [k, s] of Object.entries(r.summary)) console.log(k.padEnd(14), s.finished, `${s.finMin}-${s.finMax}s`, 'ranks', s.ranks.join(','));
  const fails = checkBounds(r.summary, bounds);
  if (fails.length) { console.error('BALANCE FAIL\n - ' + fails.join('\n - ')); process.exit(1); }
  console.log('balance OK');
}).catch(e => { console.error(e); process.exit(1); });
