// Resource leak test (M1 gate 7): 20 cycles of change breeds -> race -> finish -> back to menu.
// After a warm-up cycle, GPU geometry/texture/program counts and AssetCache entries must not grow.
// Usage: node tests/leak.cjs [url] [cycles=20]
const { launch, openGame } = require('./lib/page.cjs');

async function main() {
  const url = process.argv[2] || 'http://localhost:4173/';
  const cycles = Number(process.argv[3] || 20);
  const browser = await launch();
  const { page, errors } = await openGame(browser, url + (url.includes('?') ? '&' : '?') + 'seed=99&tier=3', { width: 320, height: 180 });
  const rows = [];
  for (let i = 0; i < cycles; i++) {
    const row = await page.evaluate((i) => {
      const breeds = ['kangayam', 'bargur', 'umblachery', 'ongole'];
      const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change')); };
      set('bullL', breeds[i % 4]); set('bullR', breeds[(i + 1) % 4]);
      R.debug.setMode(i % 2 ? 'trial' : 'pack');
      R.debug.startRace(); R.debug.skip();
      window.__frames(2);
      R.debug.sim(150, 'perfect');            // runs to the finish and the end card
      window.__frames(2);
      document.getElementById('menuBtn').click(); // back to the menu: reset() rebuilds obstacles
      window.__frames(3);                      // render so new resources are uploaded and counted
      const info = R.debug.renderer.info;
      return { cycle: i + 1, state: R.debug.state, geometries: info.memory.geometries, textures: info.memory.textures,
        programs: info.programs ? info.programs.length : null, assets: R.Assets ? R.Assets.stats().entries : 0,
        heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null };
    }, i);
    rows.push(row);
    process.stdout.write(`${row.cycle}:${row.geometries}/${row.textures} `);
  }
  await browser.close();
  console.log('');
  console.table(rows);
  // warm-up: the first 4 cycles build every breed pair and both modes once; after that nothing may grow
  const keys = ['geometries', 'textures', 'programs', 'assets'];
  const base = {}; for (const k of keys) base[k] = Math.max(...rows.slice(0, 4).map(r => r[k] || 0));
  const grew = keys.filter(k => rows.slice(4).some(r => (r[k] || 0) > base[k]));
  const last = rows[rows.length - 1], first = rows[Math.min(4, rows.length - 1)];
  console.log(`growth after warm-up: geometries ${last.geometries - first.geometries}, textures ${last.textures - first.textures} over ${rows.length - 5} cycles`);
  const real = errors.filter(e => !/ERR_FAILED|GPU stall/.test(e));
  if (real.length) console.log('errors:', real.slice(0, 5));
  if (grew.length || real.length) { console.error('LEAK FAIL: growing ' + grew.join(', ')); process.exit(1); }
  console.log(`leak OK: counts stable over ${cycles} cycles (geometries ${base.geometries}, textures ${base.textures})`);
}
main().catch(e => { console.error(e); process.exit(1); });
