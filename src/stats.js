// ?stats=1 diagnostics overlay and the copyable JSON device report (M1, audit 7a).
// Every number is labelled: "measured" values come from this device during this session;
// "estimate" values are calculated (e.g. texture memory from texture sizes) and can be off.

const R = (window.R = window.R || {});
const enabled = new URLSearchParams(location.search).has('stats');

const S = {
  enabled,
  frames: [],            // frame intervals (ms) for the current second
  history: [],           // one summary per 5 s: { t, fps, p50, p95, spikes, tier }
  spikes: 0,             // frames longer than 50 ms, whole session
  gpuMs: null,
  loadMs: null,
  scenario: '',
};
R.Stats = S;

const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0; };

// ---- GPU timer (only where EXT_disjoint_timer_query_webgl2 exists; not on iOS Safari) ----
let gl = null, ext = null, query = null, pending = [];
S.attach = function (renderer) {
  gl = renderer.getContext();
  ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  S.renderer = renderer;
  S.loadMs = Math.round(performance.now());
};
// After a lost and restored graphics context the old extension and queries are invalid.
S.contextRestored = function () {
  if (!S.renderer) return;
  gl = S.renderer.getContext(); ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  query = null; pending = []; S.gpuMs = null;
};
S.contextLost = function () { query = null; pending = []; };
S.gpuBegin = function () {
  if (!ext || query) return;
  query = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
};
S.gpuEnd = function () {
  if (!ext || !query) return;
  gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(query); query = null;
  while (pending.length) {
    const q = pending[0];
    if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
    if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) S.gpuMs = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
    gl.deleteQuery(q); pending.shift();
  }
};

// ---- texture memory estimate: unique textures reachable from the scene + known render targets ----
const MAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'envMap', 'lightMap', 'bumpMap'];
function textureBytes(tex) {
  const img = tex.image || {};
  const w = img.width || (img.data && img.data.width) || 0, h = img.height || (img.data && img.data.height) || 0;
  if (!w || !h) return 0;
  const bpp = tex.type === 1016 /* HalfFloatType */ ? 8 : tex.type === 1015 /* FloatType */ ? 16 : 4;
  return w * h * bpp * (tex.generateMipmaps !== false ? 4 / 3 : 1);
}
S.textureEstimate = function (scene) {
  const seen = new Set(); let bytes = 0;
  const add = t => { if (t && t.isTexture && !seen.has(t)) { seen.add(t); bytes += textureBytes(t); } };
  scene.traverse(o => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) { MAPS.forEach(k => add(m[k])); if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u && u.value && u.value.isTexture) add(u.value); }
  });
  add(scene.environment);
  return { textures: seen.size, mb: +(bytes / 1048576).toFixed(1) };
};

// ---- device information ----
S.device = function () {
  const r = S.renderer, glc = r && r.getContext();
  let gpu = 'unknown';
  try { const dbg = glc.getExtension('WEBGL_debug_renderer_info'); gpu = dbg ? glc.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : glc.getParameter(glc.RENDERER); } catch (e) { gpu = 'unavailable'; }
  let model = '';
  try { model = localStorage.getItem('rekla-device-model') || ''; } catch (e) { /* not stored */ }
  return {
    modelEnteredByTester: model,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screen: `${screen.width}x${screen.height} CSS px`,
    devicePixelRatio: window.devicePixelRatio,
    viewport: `${innerWidth}x${innerHeight} CSS px`,
    gpu,
    maxTextureSize: glc ? glc.getParameter(glc.MAX_TEXTURE_SIZE) : null,
    gpuTimerAvailable: !!ext,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    deviceMemoryGB: navigator.deviceMemory || null,
  };
};

// Called once per rendered frame with the interval since the previous rendered frame.
let lastSummary = null;
S.frame = function (frameMs, now) {
  S.frames.push(frameMs);
  if (frameMs > 50) S.spikes++;
  if (lastSummary === null) lastSummary = now;
  if (now - lastSummary >= 5000) {
    const f = S.frames;
    S.history.push({
      t: +(now / 1000).toFixed(0), fps: +(1000 / (f.reduce((a, b) => a + b, 0) / f.length)).toFixed(1),
      p50: +median(f).toFixed(1), p95: +pct(f, 0.95).toFixed(1), spikes: f.filter(x => x > 50).length,
      tier: R.Quality ? R.Quality.tier : null,
    });
    if (S.history.length > 360) S.history.shift(); // 30 minutes
    S.frames = []; lastSummary = now;
  }
  if (enabled) paint(now);
};

S.report = function () {
  const r = S.renderer, info = r ? r.info : null, scene = R.scene;
  const all = S.history;
  const first = all.slice(0, 12), last = all.slice(-12); // first and last minute, for heat drift
  const avg = (a, k) => a.length ? +(a.reduce((s, x) => s + x[k], 0) / a.length).toFixed(1) : null;
  let heap = null;
  try { if (performance.memory) heap = { usedMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), limitMB: +(performance.memory.jsHeapSizeLimit / 1048576).toFixed(0) }; } catch (e) { heap = null; }
  return {
    report: 'rekla-race device report v1',
    build: R.BUILD || 'dev',
    createdAt: new Date().toISOString(),
    scenario: S.scenario,
    device: S.device(),
    measured: {
      loadToReadyMs: S.loadMs,
      sessionSeconds: Math.round(performance.now() / 1000),
      avgFps: avg(all, 'fps'),
      p95FrameMs: all.length ? Math.max(...all.map(h => h.p95)) : null,
      spikesOver50ms: S.spikes,
      firstMinute: { fps: avg(first, 'fps'), p95: avg(first, 'p95') },
      lastMinute: { fps: avg(last, 'fps'), p95: avg(last, 'p95') },
      gpuFrameMs: S.gpuMs != null ? +S.gpuMs.toFixed(2) : 'not available on this browser',
      drawCalls: info ? info.render.calls : null,
      triangles: info ? info.render.triangles : null,
      geometriesInGpu: info ? info.memory.geometries : null,
      texturesInGpu: info ? info.memory.textures : null,
      jsHeap: heap || 'not exposed by this browser',
      history5s: all,
    },
    estimate: { textureMemory: scene ? S.textureEstimate(scene) : null },
    leakTest: S.leak || null,
    simulationClock: R.debug ? R.debug.clock : null,
    quality: R.Quality ? { tier: R.Quality.tier, name: R.Quality.TIERS[R.Quality.tier].name, source: R.Quality.source, benchmarkMs: R.Quality.benchmarkMs, changes: R.Quality.log } : null,
  };
};

// ---- overlay ----
let el = null, body = null, lastPaint = 0;
function build() {
  el = document.createElement('div');
  el.id = 'statsOv';
  el.setAttribute('style', 'position:fixed;left:6px;top:calc(env(safe-area-inset-top) + 6px);z-index:99;max-width:min(92vw,340px);' +
    'background:rgba(10,8,6,.82);color:#f5ead6;font:11px/1.35 ui-monospace,Menlo,monospace;padding:7px 8px;border-radius:8px;pointer-events:auto');
  el.innerHTML = '<div id="statsBody"></div>' +
    '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">' +
    '<input id="statsModel" placeholder="Device model (e.g. iPhone 16)" style="flex:1 1 140px;font:inherit;padding:3px;border-radius:4px;border:0">' +
    '<button id="statsCopy" style="font:inherit;padding:3px 6px">Copy report</button></div>' +
    '<textarea id="statsOut" readonly style="display:none;width:100%;height:90px;margin-top:6px;font:10px monospace"></textarea>';
  document.body.appendChild(el);
  body = el.querySelector('#statsBody');
  const model = el.querySelector('#statsModel');
  try { model.value = localStorage.getItem('rekla-device-model') || ''; } catch (e) { /* not stored */ }
  model.addEventListener('change', () => { try { localStorage.setItem('rekla-device-model', model.value.trim()); } catch (e) { /* not stored */ } });
  el.querySelector('#statsCopy').addEventListener('click', async () => {
    const txt = JSON.stringify(S.report(), null, 1);
    const out = el.querySelector('#statsOut');
    out.value = txt; out.style.display = 'block'; out.select();
    try { await navigator.clipboard.writeText(txt); el.querySelector('#statsCopy').textContent = 'Copied'; }
    catch (e) { el.querySelector('#statsCopy').textContent = 'Select the text and copy'; }
  });
  ['pointerdown', 'pointerup', 'touchend', 'click'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation()));
}
function paint(now) {
  if (now - lastPaint < 500) return;
  lastPaint = now;
  if (!el) build();
  const f = S.frames.length ? S.frames : [16.7];
  const info = S.renderer ? S.renderer.info : null;
  const q = R.Quality;
  const tex = R.scene && (now % 5000 < 600) ? (S.texCache = S.textureEstimate(R.scene)) : S.texCache;
  body.textContent = [
    `measured  FPS ${(1000 / (f.reduce((a, b) => a + b, 0) / f.length)).toFixed(0)}  p50 ${median(f).toFixed(1)} ms  p95 ${pct(f, 0.95).toFixed(1)} ms`,
    `measured  GPU ${S.gpuMs != null ? S.gpuMs.toFixed(2) + ' ms' : 'n/a on this browser'}  spikes>50ms ${S.spikes}`,
    `measured  draws ${info ? info.render.calls : '-'}  tris ${info ? (info.render.triangles / 1000).toFixed(0) + 'k' : '-'}  geo ${info ? info.memory.geometries : '-'}  tex ${info ? info.memory.textures : '-'}`,
    `estimate  texture memory ~${tex ? tex.mb : '?'} MB (${tex ? tex.textures : '?'} textures)`,
    `tier ${q ? q.tier + ' ' + q.TIERS[q.tier].name : '-'} (${q ? q.source : '-'})${q && q.p95 != null ? '  window p95 ' + q.p95 : ''}`,
    `${screen.width}x${screen.height} @${devicePixelRatio}x  ${navigator.userAgent.replace(/^Mozilla\/5.0 /, '').slice(0, 70)}`,
  ].join('\n');
  body.style.whiteSpace = 'pre-wrap';
}
