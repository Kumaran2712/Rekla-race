// Shader-anchor validation (audit 7a). Every `#include <chunk>` the game injects next to must exist in
// the loaded three.js, and no shader may fail to compile in any preset.
// Usage: node tests/shader-anchors.cjs [url]
const fs = require('fs');
const path = require('path');
const { ROOT, launch, openGame } = require('./lib/page.cjs');

const anchors = new Set();
for (const dir of ['js', 'src']) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d).filter(f => f.endsWith('.js'))) {
    for (const m of fs.readFileSync(path.join(d, f), 'utf8').matchAll(/#include <([a-z_]+)>/g)) anchors.add(m[1]);
  }
}

async function main() {
  const url = process.argv[2] || 'http://localhost:4173/';
  const browser = await launch();
  const { page, errors } = await openGame(browser, url, { width: 640, height: 360 });
  const missing = await page.evaluate(list => list.filter(a => !(a in THREE.ShaderChunk)), [...anchors]);
  // Render every preset in menu and race so every patched material compiles.
  await page.evaluate(() => {
    for (const p of ['noon', 'golden', 'monsoon', 'rain', 'mist']) { R.debug.setAtmo(p); window.__frames(2); }
    R.debug.startRace(); R.debug.skip(); window.__frames(3);
  });
  await browser.close();
  const shaderErrors = errors.filter(e => /shader|WebGLProgram|GLSL/i.test(e));
  console.log(`anchors checked: ${[...anchors].sort().join(', ')}`);
  if (missing.length || shaderErrors.length) {
    if (missing.length) console.error('MISSING CHUNKS: ' + missing.join(', '));
    shaderErrors.forEach(e => console.error('SHADER ERROR: ' + e.slice(0, 400)));
    process.exit(1);
  }
  console.log('shader anchors OK');
}
main().catch(e => { console.error(e); process.exit(1); });
