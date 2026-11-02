// Records gameplay balance results to a JSON file.
// Usage: node tests/sim.cjs <url> <out.json> [runsPerCase=5]
const fs = require('fs');
const { runSim } = require('./lib/sim.cjs');

runSim(process.argv[2], Number(process.argv[4] || 5)).then(r => {
  fs.writeFileSync(process.argv[3], JSON.stringify(r, null, 2));
  console.log(JSON.stringify(r.summary));
}).catch(e => { console.error(e); process.exit(1); });
