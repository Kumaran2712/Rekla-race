// Adaptive graphics quality (M1, audit sections 6 and 7a).
//
// Six tiers, 0 (lowest) to 5 (highest). Tier 5 reproduces the r128 desktop settings and tier 3 the r128
// "mobile" settings, so golden images stay comparable. A tier is chosen once by a short warm-up benchmark
// (or ?tier=N, or the tier remembered from the last session), then adjusted while playing from the p95
// frame time with hysteresis: drop fast, climb slowly, at most one change per 10 s.
//
// The six-step ladder (what changes between neighbouring tiers, in order of the audit):
// resolution -> post-processing -> shadow-map size -> particle cap -> scatter density -> crowd distance.

const R = (window.R = window.R || {});

export const TIERS = [
  // 0: locked 30 FPS, the lightest settings
  { name: 'Low (30 FPS)', fps30: true, dprMax: 0.85, post: 'off', msaa: 0, shafts: 0, shadow: 512, particles: 0.4, density: 0.5, terrainCell: 6, crowdFar: 120, lite: true },
  { name: 'Low', fps30: false, dprMax: 1.0, post: 'off', msaa: 0, shafts: 0, shadow: 1024, particles: 0.6, density: 0.6, terrainCell: 6, crowdFar: 150, lite: true },
  { name: 'Medium', fps30: false, dprMax: 1.0, post: 'lite', msaa: 2, shafts: 8, shadow: 1024, particles: 0.6, density: 0.6, terrainCell: 6, crowdFar: 190, lite: true },
  // 3: equals the r128 build on phones (R.Q.mobile === true)
  { name: 'Medium-high', fps30: false, dprMax: 1.5, post: 'full', msaa: 2, shafts: 16, shadow: 1024, particles: 1, density: 0.6, terrainCell: 6, crowdFar: 230, lite: true },
  { name: 'High', fps30: false, dprMax: 1.75, post: 'full', msaa: 4, shafts: 16, shadow: 2048, particles: 1, density: 0.8, terrainCell: 5, crowdFar: 230, lite: false },
  // 5: equals the r128 build on desktop (R.Q.mobile === false)
  { name: 'Ultra', fps30: false, dprMax: 2.0, post: 'full', msaa: 4, shafts: 16, shadow: 2048, particles: 1, density: 1, terrainCell: 5, crowdFar: 230, lite: false },
];

const KEY = 'rekla-quality';
const params = R.params;
const forced = params.has('tier') ? Math.max(0, Math.min(5, Number(params.get('tier')) | 0)) : null;

function readStored() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && s.v === 1 ? s : null; } catch (e) { return null; }
}
function store(tier, source) {
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, tier, source, at: Date.now() })); } catch (e) { /* private mode: not remembered */ }
}

const stored = readStored();
const Q = {
  TIERS,
  tier: forced ?? (stored ? stored.tier : 3),
  source: forced != null ? 'url' : stored ? 'remembered' : 'default (benchmark pending)',
  forced: forced != null,
  benchmarkMs: null,
  log: [],
  listeners: [],
};
R.Quality = Q;

// R.Q keeps its old shape for the existing modules; `mobile` is gone (it was a user-agent guess).
R.Q = Object.assign({}, TIERS[Q.tier], { tier: Q.tier });
function applySettings() { Object.assign(R.Q, TIERS[Q.tier], { tier: Q.tier }); }

// Warm-up benchmark: renders a fixed stress scene (many lit, shadowed meshes) and times each frame with a
// 1-pixel readback, which waits for the GPU. Runs only when no tier is forced or remembered.
// Thresholds are first estimates, to be calibrated on the device matrix.
const THRESHOLDS_MS = [26, 18, 12, 8, 5]; // slower than [i] => tier i; faster than all => tier 5
Q.benchmark = function (renderer) {
  if (Q.forced || stored) return Q.tier;
  const T = window.THREE;
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(60, 1, 0.1, 200); cam.position.set(0, 6, 14); cam.lookAt(0, 0, 0);
  const sun = new T.DirectionalLight(0xffffff, 3); sun.position.set(5, 10, 4); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun, new T.HemisphereLight(0xffffff, 0x404040, 1));
  const geo = new T.SphereGeometry(0.35, 24, 16), mat = new T.MeshStandardMaterial({ color: 0xb0603a, roughness: 0.7 });
  for (let i = 0; i < 400; i++) { const m = new T.Mesh(geo, mat); m.position.set((i % 20) - 10, 0.4, ((i / 20) | 0) - 10); m.castShadow = m.receiveShadow = true; scene.add(m); }
  const ground = new T.Mesh(new T.PlaneGeometry(40, 40), mat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const gl = renderer.getContext(), px = new Uint8Array(4);
  const shadowWas = renderer.shadowMap.enabled; renderer.shadowMap.enabled = true;
  const times = [];
  for (let i = 0; i < 14; i++) {
    const t0 = performance.now();
    renderer.render(scene, cam);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    if (i >= 4) times.push(performance.now() - t0); // first frames compile shaders
  }
  renderer.shadowMap.enabled = shadowWas;
  geo.dispose(); mat.dispose(); ground.geometry.dispose(); sun.shadow.map && sun.shadow.map.dispose();
  times.sort((a, b) => a - b);
  const median = times[times.length >> 1];
  Q.benchmarkMs = +median.toFixed(2);
  let tier = 5;
  for (let i = 0; i < THRESHOLDS_MS.length; i++) if (median > THRESHOLDS_MS[i]) { tier = i; break; }
  Q.set(tier, 'benchmark');
  return tier;
};

Q.set = function (tier, why) {
  tier = Math.max(0, Math.min(5, tier));
  const from = Q.tier;
  Q.tier = tier; Q.source = why;
  applySettings();
  if (!Q.forced) store(tier, why);
  if (from !== tier) {
    Q.log.push({ t: +(performance.now() / 1000).toFixed(1), from, to: tier, why });
    Q.listeners.forEach(fn => fn(TIERS[tier], tier, from));
  }
};
Q.onChange = fn => Q.listeners.push(fn);

// Runtime adjustment from frame times (milliseconds between rendered frames).
const WINDOW_MS = 5000, DOWN_P95 = 22, UP_P95 = 18, UP_STABLE_MS = 30000, MIN_GAP_MS = 10000;
let win = [], winStart = null, lastChange = -1e9, goodSince = null;
Q.p95 = null;
Q.frame = function (frameMs, now) {
  if (winStart === null) winStart = now;
  win.push(frameMs);
  if (now - winStart < WINDOW_MS) return;
  const sorted = win.slice().sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  Q.p95 = +p95.toFixed(1);
  win = []; winStart = now;
  if (Q.forced) return;
  // a locked-30 tier is judged against a 33 ms budget
  const budget = TIERS[Q.tier].fps30 ? 2 : 1;
  if (p95 > DOWN_P95 * budget) {
    goodSince = null;
    if (now - lastChange >= MIN_GAP_MS && Q.tier > 0) { lastChange = now; Q.set(Q.tier - 1, `p95 ${Q.p95} ms`); }
  } else if (p95 < UP_P95 * budget) {
    if (goodSince === null) goodSince = now;
    if (now - goodSince >= UP_STABLE_MS && now - lastChange >= MIN_GAP_MS && Q.tier < 5) { lastChange = now; goodSince = null; Q.set(Q.tier + 1, `stable p95 ${Q.p95} ms`); }
  } else goodSince = null;
};
