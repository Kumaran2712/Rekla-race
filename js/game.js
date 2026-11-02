/* Rekla Race · game: renderer, build sequence, race rules, camera, HUD, loop
   v3 prototype: rhythm shouting on the hoofbeat, brace / thrown / run-and-catch, bumping in pack races,
   two race formats (Kongu time trial, Southern pack race), breed choice, five cameras + cinematic shots. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const R = window.R, T = R.T;
  const { LANES, LANE_W } = R;
  const CART_LEN = 5.2, VMAX = 19;
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = R.clamp, rand = (a, b) => a + Math.random() * (b - a);
  const latOf = lx => (lx - (LANES - 1) / 2) * LANE_W;

  const PLAYER = { name: 'You', body: '#c8321c', turban: '#f3a312', num: '7', player: true };
  const RIVALS = [
    { name: 'Kaali',   body: '#2f3f7a', turban: '#ece4d2', num: '3', base: 14.7, breeds: ['kangayam', 'kangayam'],   aggro: 0.25, skill: 0.75 },
    { name: 'Raja',    body: '#d39a17', turban: '#a2281a', num: '5', base: 15.1, breeds: ['bargur', 'kangayam'],     aggro: 0.6,  skill: 0.6 },
    { name: 'Vel',     body: '#2f6b4a', turban: '#f2c94c', num: '9', base: 15.3, breeds: ['ongole', 'ongole'],       aggro: 0.45, skill: 0.8 },
    { name: 'Muthu',   body: '#6a2c7a', turban: '#f5f5f5', num: '2', base: 14.9, breeds: ['umblachery', 'kangayam'], aggro: 0.2,  skill: 0.85 },
    { name: 'Sudalai', body: '#3b3b3b', turban: '#e94f37', num: '8', base: 15.2, breeds: ['bargur', 'bargur'],       aggro: 0.75, skill: 0.55 },
  ];
  const MODES = {
    trial: { en: 'Kongu time trial', ta: 'கொங்கு ரேக்ளா', len: 300, rivals: 0, dod: 60, medals: [20.5, 22.5, 25] },
    pack:  { en: 'Southern pack race', ta: 'தென் பந்தயம்', len: 800, rivals: 5, dod: 110 },
  };
  const PRIZES = { 1: '₹25,000 and a lamb', 2: '₹15,000', 3: '₹8,000 and a steel trophy', 4: 'A shield for the thinnai' };
  const CAMS = [['chase', 'Chase'], ['eye', "Saarathi's eye"], ['low', 'Low dust'], ['tv', 'TV broadcast'], ['drone', 'Drone']];

  // ---------- settings ----------
  const setup = { mode: 'pack', breeds: ['kangayam', 'kangayam'], cam: 0 };
  try { Object.assign(setup, JSON.parse(localStorage.getItem('rekla-setup') || '{}')); } catch (e) {}
  if (!MODES[setup.mode]) setup.mode = 'pack';
  const saveSetup = () => { try { localStorage.setItem('rekla-setup', JSON.stringify(setup)); } catch (e) {} };
  const bestKey = () => 'rekla-best-' + setup.mode;
  const getBest = () => { try { const b = parseFloat(localStorage.getItem(bestKey())); return b > 0 ? b : null; } catch (e) { return null; } };

  // ---------- renderer ----------
  const C = $('c'), stage = $('stage');
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas: C, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { $('bestStart').textContent = 'This device could not start 3D graphics (WebGL).'; $('startBtn').disabled = true; return; }
  R.renderer = renderer;
  let dpr = Math.min(window.devicePixelRatio || 1, R.Q.dprMax);
  renderer.setPixelRatio(dpr);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  R.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  renderer.info.autoReset = false;

  const scene = new T.Scene();
  R.scene = scene;
  const camera = new T.PerspectiveCamera(60, 1, 0.12, 2600);
  R.camera = camera;
  let baseFov = 60;

  // ---------- dust pool ----------
  const POOL = [];
  function makePool() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    R.dotTex = new T.CanvasTexture(c);
    for (let i = 0; i < 180; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: R.dotTex, color: 0xd8a676, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false; scene.add(s); POOL.push({ s, life: 0 });
    }
  }
  let poolI = 0;
  function emit(x, y, z, vx, vy, vz, life, size, hex) {
    const p = POOL[poolI = (poolI + 1) % POOL.length];
    Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, size });
    p.s.material.color.copy(R.col(hex)); p.s.visible = true;
  }
  R.emit = emit;

  // ---------- state ----------
  let state = 'loading', carts = [], P = null, obs = [];
  let playerModel = null, rivalModels = [], runner = null, trialGate = null;
  let t = 0, raceT = 0, shake = 0, countT = 0, finishRank = null, doneT = 0, lastTired = -9, lastBlock = -9, timeScale = 1, slowT = 0;
  let mode = MODES[setup.mode], autoCam = null, autoCamT = 0;
  const audio = (e, c) => { if (R.Audio) R.Audio.event(e, c); };
  const bar = $('bar');
  let dots = [];

  function clearObs() { for (const o of obs) scene.remove(o.m.g); obs = []; }
  function genObs() {
    clearObs();
    const types = mode.rivals ? ['pothole', 'puddle', 'pothole', 'puddle', 'goat', 'cane'] : ['pothole', 'puddle', 'pothole', 'goat'];
    const add = (type, d, lane) => {
      const m = type === 'goat' ? R.Models.goat(scene) : type === 'cane' ? R.Models.cane(scene) : R.Models.hole(type, scene);
      obs.push({ type, d, lx: lane, dir: Math.random() < 0.5 ? -1 : 1, hit: new Set(), gone: false, scared: false, m });
    };
    let d = mode.rivals ? 55 : 45;
    while (d < mode.len - 25) {
      const type = types[(Math.random() * types.length) | 0];
      const lane = (Math.random() * LANES) | 0;
      add(type, d, lane);
      if (type !== 'goat' && Math.random() < 0.35) add(Math.random() < 0.5 ? 'pothole' : 'puddle', d + rand(-2, 2), (lane + 1 + ((Math.random() * (LANES - 1)) | 0)) % LANES);
      d += rand(22, 42);
    }
  }
  function buildPlayerModel() {
    if (playerModel) playerModel.dispose();
    playerModel = R.Models.cart(PLAYER, scene, setup.breeds);
  }
  function newCart(def, m, lane, dist) {
    const stats = R.pairStats((def.breeds || setup.breeds)[0], (def.breeds || setup.breeds)[1]);
    return { ...def, stats, lx: lane, lane, dist, v: 0, ph: Math.random() * 6, stam: 100, fin: null, whip: 0, step: Math.random() * 6,
      dodge: new Set(), base: def.base ? def.base + rand(-0.25, 0.25) : 0, m, jolt: 0, fallen: false, runT: 0, bumpCD: 2, fouls: 0, penalty: 0, dq: false,
      combo: 0, unsettle: 0, lastShout: -9, brace: null, pull: null, pullT: rand(5, 9), dod: false };
  }
  function reset() {
    mode = MODES[setup.mode];
    P = newCart(PLAYER, playerModel, 1, 0);
    carts = [P];
    const grid = [[0, 0], [2, 0], [3, 0], [1, -6.5], [2, -6.5]];
    rivalModels.forEach((m, i) => {
      const on = i < mode.rivals;
      m.grp.visible = on; m.ropes.visible = on;
      if (on) carts.push(newCart(RIVALS[i], m, grid[i][0], grid[i][1]));
    });
    if (trialGate) trialGate.visible = !mode.rivals;
    P.m.drv.visible = true; if (runner) runner.g.visible = false;
    genObs();
    for (const p of POOL) { p.life = 0; p.s.visible = false; }
    t = 0; raceT = 0; shake = 0; countT = 3.2; finishRank = null; doneT = 0; lastZone = -1; timeScale = 1; slowT = 0; autoCam = null;
    hidePrompt();
    // progress bar: one dot per cart
    dots.forEach(d => d.remove());
    dots = carts.map(c => { const el = document.createElement('div'); el.className = 'dot' + (c.player ? ' me' : ''); el.style.background = c.body; bar.appendChild(el); return el; });
    $('posOf').textContent = mode.rivals ? 'of ' + carts.length : 'time trial';
    $('lenLbl').textContent = mode.len;
  }

  // ---------- feedback ----------
  const toasts = $('toasts');
  function say(text, color) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = text;
    if (color) el.style.setProperty('--c', color);
    toasts.appendChild(el); while (toasts.children.length > 3) toasts.firstChild.remove();
    setTimeout(() => el.remove(), 1350);
  }
  const judgeEl = $('judge');
  function judge(text, cls) {
    judgeEl.textContent = text; judgeEl.className = 'judge ' + cls;
    void judgeEl.offsetWidth; judgeEl.classList.add('pop');
  }
  const promptEl = $('prompt');
  function showPrompt(big, small, cls) { $('promptBig').textContent = big; $('promptSmall').textContent = small; promptEl.className = 'prompt ' + (cls || ''); promptEl.hidden = false; }
  function hidePrompt() { promptEl.hidden = true; }
  const haiBtn = $('hai'), haiTa = $('haiTa'), haiEn = $('haiEn');
  function haiLabel(ta, en) { if (haiTa.textContent !== ta) { haiTa.textContent = ta; haiEn.textContent = en; } }
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
  function laneFree(l, cart) {
    return !carts.some(c => c !== cart && (Math.abs(c.lane - l) < 0.5 || Math.abs(c.lx - l) < 0.6) && Math.abs(c.dist - cart.dist) < CART_LEN + 0.5);
  }
  function obsNear(l, d) {
    return obs.some(o => !o.gone && o.type !== 'cane' && Math.abs(o.lx - l) < 0.6 && o.d - d > -2 && o.d - d < 16);
  }

  // ---------- brace, thrown, run and catch ----------
  function startBrace(c, cause, strength = 1) {
    if (c.fallen || c.fin !== null) return;
    if (!c.player) { if (Math.random() < clamp((1 - c.skill) * 0.55 * strength, 0.03, 0.7)) throwOff(c); return; }
    if (P.brace) return;
    const win = clamp(0.5 + 0.35 * (P.stats.calm - 0.7), 0.42, 0.68) / strength;
    P.brace = { t: win, max: win, cause };
    timeScale = 0.45; slowT = 1;
    showPrompt('பிடி! BRACE', 'Tap now', 'brace');
    haiLabel('பிடி!', 'Brace');
    audio('brace', P); buzz(40);
  }
  function braced() {
    P.brace = null; timeScale = 1; hidePrompt();
    P.v *= 0.94; judge('Steady!', 'good'); audio('braced', P); buzz(20);
  }
  function throwOff(c) {
    c.fallen = true; c.combo = 0; c.brace = null;
    c.m.drv.visible = false;
    if (c.player) {
      R.world(c.dist, latOf(c.lx), _v);
      runner.st = { dist: c.dist - 0.8, lat: latOf(c.lx), v: Math.max(2, c.v * 0.35), side: 0, ph: 0, down: 0.75 };
      runner.g.visible = true;
      timeScale = 0.35; slowT = 0.9; autoCam = 'runner';
      showPrompt('Thrown off!', 'Tap ◀ ▶ in turn to run', 'thrown');
      haiLabel('குதி!', 'Jump');
      shake = reduceMotion ? 0 : 0.5; buzz(120); audio('thrown', c);
      for (let i = 0; i < 14; i++) emit(_v.x + rand(-1, 1), _v.y + 0.3, _v.z + rand(-1, 1), rand(-2, 2), rand(1, 3), rand(-1, 1), 1.1, rand(0.7, 1.3), '#b07a4e');
    } else {
      c.runT = rand(2.6, 5.2);
      audio('rivalThrown', c);
      if (Math.abs(c.dist - P.dist) < 40) say(c.name + ' is thrown!', '#ffd27a');
    }
  }
  function backOn(c) {
    c.fallen = false; c.m.drv.visible = !(c.player && camKey() === 'eye');
    if (c.player) {
      runner.g.visible = false; autoCam = null; hidePrompt(); haiLabel('ஹை!', 'Hai');
      c.v = Math.max(c.v, runner.st.v * 0.8); c.unsettle = 0;
      judge('Back on!', 'perfect'); audio('catch', c); buzz(60);
    }
  }
  function runStep(dir) {
    const st = runner.st; if (!st || st.down > 0) return;
    if (dir !== st.side) { st.v = Math.min(9.6, st.v + 1.15); st.side = dir; }
    else { st.v = Math.max(1.5, st.v - 0.5); }
  }
  function tryCatch() {
    const st = runner.st; if (!st || st.down > 0) return;
    const gap = (P.dist - 0.9) - st.dist;
    if (Math.abs(gap) < 2.3) backOn(P);
    else { st.v *= 0.7; judge(gap > 0 ? 'Too far!' : 'Missed!', 'off'); audio('stumble', P); }
  }

  // ---------- bumping (pack races) ----------
  function doBump(a, b, dir) {
    a.bumpCD = 4;
    const ratio = clamp(a.stats.power / b.stats.power * (b.whip > 0 ? 1.3 : 1), 0.5, 2);
    b.v *= clamp(0.9 - 0.06 * (ratio - 1), 0.75, 0.95); a.v *= 0.94;
    a.stam = Math.max(0, a.stam - 8); a.jolt = 0.3; b.jolt = 0.55;
    const pushTo = b.lane + dir;
    const foul = pushTo < 0 || pushTo >= LANES || b.fallen;
    if (!foul && laneFree(pushTo, b)) b.lane = pushTo;
    R.world((a.dist + b.dist) / 2, (latOf(a.lx) + latOf(b.lx)) / 2, _v);
    for (let i = 0; i < 10; i++) emit(_v.x, _v.y + 0.6, _v.z, rand(-2, 2), rand(1, 3), rand(-1, 1), 0.8, rand(0.5, 1), '#c9905e');
    audio('bump', a.player ? b : a);
    if (a.player || b.player) { shake = reduceMotion ? 0 : 0.35; buzz(70); }
    if (foul) {
      a.fouls++; a.penalty += 2;
      if (a.player) { say('Foul! +2 s', '#ff9a8a'); audio('foul', a); }
      if (a.fouls >= 3) { a.dq = true; if (a.player) say('Three fouls: disqualified', '#ff9a8a'); }
    }
    if (a.player) judge('BUMP!', 'perfect');
    if (b.player) { say(a.name + ' bumps you!', '#ffd27a'); startBrace(P, 'bump', clamp(ratio, 0.8, 1.5)); }
    else startBrace(b, 'bump', ratio);
  }

  // ---------- controls ----------
  function anyBraceInput() { if (state === 'race' && P.brace) { braced(); return true; } return false; }
  function steer(dir) {
    if (anyBraceInput()) return;
    if (state !== 'race' || P.fin !== null) return;
    if (P.fallen) { runStep(dir); return; }
    if (P.pull && dir === -P.pull.dir) { P.pull = null; hidePrompt(); judge('Steadied', 'good'); return; }
    const nl = P.lane + dir;
    if (nl < 0 || nl >= LANES) return;
    if (mode.rivals) {
      const side = carts.find(c => c !== P && Math.abs(c.lx - nl) < 0.7 && Math.abs(c.dist - P.dist) < CART_LEN * 0.75);
      if (side) { if (P.bumpCD <= 0) doBump(P, side, dir); else if (t - lastBlock > 0.8) { say('Wait to bump again'); lastBlock = t; } return; }
    }
    if (!laneFree(nl, P)) { shake = 0.2; if (t - lastBlock > 1) { say('Lane blocked'); lastBlock = t; audio('blocked', P); } return; }
    P.lane = nl;
  }
  // stride rate and beat position, shared with the audio (bell rings on each whole stride)
  const strideRate = c => (4 + c.v * 0.55) / Math.PI;
  const strideFrac = c => { const s = c.step / Math.PI; return s - Math.floor(s); };
  function hai() {
    haiBtn.classList.add('press'); setTimeout(() => haiBtn.classList.remove('press'), 90);
    if (anyBraceInput()) return;
    if (state !== 'race' || P.fin !== null) return;
    if (P.fallen) { tryCatch(); return; }
    const frac = strideFrac(P), err = Math.min(frac, 1 - frac) / strideRate(P);
    const since = t - P.lastShout; P.lastShout = t;
    let grade = err < 0.042 ? 'perfect' : err < 0.085 ? 'good' : 'off';
    if (since < 0.13) grade = 'off';
    const k = P.stam / 100, st = P.stats, dod = P.dod ? 1.35 : 1, cost = (P.dod ? 1.8 : 1) / st.stamina;
    if (grade === 'perfect') { P.combo++; P.v += 2.9 * st.accel * (0.4 + 0.6 * k) * dod * (1 + Math.min(P.combo, 8) * 0.025); P.stam -= 3 * cost; }
    else if (grade === 'good') { P.v += 2.2 * st.accel * (0.3 + 0.7 * k) * dod; P.stam -= 5 * cost; }
    else { P.combo = 0; P.v += 1.0 * st.accel * (0.3 + 0.7 * k) * dod; P.stam -= 7 * cost; P.unsettle += 1; }
    P.stam = Math.max(0, P.stam);
    P.v = Math.min(VMAX * st.speed * (P.dod ? 1.06 : 1), P.v);
    P.whip = 0.3;
    judge(grade === 'perfect' ? (P.combo >= 3 ? 'Perfect ×' + P.combo : 'Perfect!') : grade === 'good' ? 'Good' : 'Off-beat', grade);
    audio('hai', P); if (grade === 'perfect') audio('perfect', P); if (grade === 'off') audio('off', P);
    if (grade === 'off' && P.unsettle >= 3 && Math.random() < 0.55 * (1.25 - st.calm)) { P.unsettle = 0; say('The bulls lurch!', '#ffb08a'); startBrace(P, 'lurch'); }
    if (P.stam < 12 && t - lastTired > 2.5) { say('Bulls are tired. Ease off.', '#ffd9a0'); lastTired = t; audio('tired', P); }
  }
  function cycleCam() {
    setup.cam = (setup.cam + 1) % CAMS.length; saveSetup();
    say(CAMS[setup.cam][1]); $('camBtn').setAttribute('aria-label', 'Camera: ' + CAMS[setup.cam][1] + '. Change camera');
    snap = true;
  }
  const camKey = () => CAMS[setup.cam][0];

  // sound: unlock on the first touch or key, toggle with the speaker button
  const sndBtn = $('snd');
  const paintSnd = () => { sndBtn.setAttribute('aria-pressed', String(R.Audio.on)); sndBtn.setAttribute('aria-label', R.Audio.on ? 'Mute sound' : 'Turn sound on'); sndBtn.querySelector('.wave').style.display = R.Audio.on ? '' : 'none'; sndBtn.querySelector('.x').style.display = R.Audio.on ? 'none' : ''; };
  if (R.Audio) {
    const wake = () => { if (R.Audio.on && state !== 'loading') R.Audio.unlock(); };
    for (const ev of ['touchend', 'click', 'keydown', 'pointerup']) document.addEventListener(ev, wake, true);
    sndBtn.addEventListener('click', e => { e.stopPropagation(); R.Audio.setOn(!R.Audio.on); paintSnd(); });
    paintSnd();
  } else sndBtn.hidden = true;
  $('camBtn').addEventListener('click', e => { e.stopPropagation(); cycleCam(); });
  const press = (el, fn) => el.addEventListener('pointerdown', e => { e.preventDefault(); fn(); });
  press($('bl'), () => steer(-1)); press($('br'), () => steer(1)); press(haiBtn, hai);
  let sx = null, sy = null;
  C.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
  C.addEventListener('pointerup', e => {
    if (sx === null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 1 : -1);
    else if (dy < -40 && Math.abs(dy) > Math.abs(dx) && P && P.fallen) tryCatch();
    else if (Math.abs(dx) < 18 && Math.abs(dy) < 18) hai();
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') { steer(-1); e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === 'd') { steer(1); e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { if (!e.repeat) hai(); e.preventDefault(); }
    else if (e.key === 'b' || e.key === 'B') { anyBraceInput(); }
    else if (e.key === 'c' || e.key === 'C') { if (state !== 'loading') cycleCam(); }
    else if (e.key === 'Enter' && (state === 'ready' || state === 'end')) startRace();
  });
  function startRace() {
    if (R.Audio) R.Audio.unlock();
    reset(); state = 'count'; lastN = 99; autoCam = 'start'; autoCamT = 0; snap = true;
    $('startOv').hidden = true; $('endOv').hidden = true; $('hint').hidden = false;
    setTimeout(() => { $('hint').hidden = true; }, 6500);
  }
  $('startBtn').addEventListener('click', startRace);
  $('againBtn').addEventListener('click', startRace);
  $('menuBtn').addEventListener('click', () => { $('endOv').hidden = true; $('startOv').hidden = false; state = 'ready'; reset(); });

  // ---------- simulation ----------
  const _v = new T.Vector3();
  function rivalSteer(r) {
    for (const o of obs) {
      if (o.gone || o.type === 'cane' || r.dodge.has(o)) continue;
      const ahead = o.d - r.dist;
      if (ahead > 2 && ahead < 15 && Math.abs(o.lx - r.lane) < 0.6) {
        r.dodge.add(o);
        if (Math.random() < 0.55 + r.skill * 0.35) {
          const opts = [r.lane - 1, r.lane + 1].filter(l => l >= 0 && l < LANES && laneFree(l, r) && !obsNear(l, r.dist));
          if (opts.length) r.lane = opts[(Math.random() * opts.length) | 0];
        }
      }
    }
  }
  function applyHit(c, o) {
    const me = c.player;
    audio(o.type === 'goat' && !me ? 'goatNear' : o.type, c);
    R.world(c.dist, latOf(c.lx), _v);
    const x = _v.x, y = _v.y, z = _v.z, wet = R.U.wet.value;
    if (o.type === 'pothole') {
      c.v *= 0.6; c.jolt = 0.5;
      for (let i = 0; i < 10; i++) emit(x + rand(-1, 1), y + 0.3, z + rand(-1, 1), rand(-1.5, 1.5), rand(1, 2.5), rand(-1, 1), 0.9, rand(0.6, 1.1), '#a4643a');
      if (me) { shake = reduceMotion ? 0 : 0.45; buzz(60); say('Pothole!', '#ffb08a'); }
      if (c.v > 6 || !me) startBrace(c, 'pothole', me ? 1 : 0.7);
    } else if (o.type === 'puddle') {
      c.v *= 0.78;
      for (let i = 0; i < 18; i++) emit(x + rand(-1.1, 1.1), y + 0.2, z + rand(-1.5, 1.5), rand(-3, 3), rand(2, 4.5), rand(-1, 1), 0.7, rand(0.3, 0.6), '#8fa3a4');
      if (me) { buzz(30); say('Splash!', '#cfeef2'); }
      if (wet > 0.4 && c.v > 9 && Math.random() < (1.25 - c.stats.wet) * wet) { if (me) say('Slipping!', '#cfeef2'); startBrace(c, 'slip', 0.9); }
    } else if (o.type === 'goat') {
      c.v *= 0.5; c.stam = Math.max(0, c.stam - 12); c.jolt = 0.4;
      if (me) { shake = reduceMotion ? 0 : 0.35; buzz(80); say('Goat on the road!', '#ffd27a'); }
      startBrace(c, 'goat', me ? 1.1 : 1);
    }
  }
  function collisions() {
    for (let i = 0; i < carts.length; i++) for (let j = i + 1; j < carts.length; j++) {
      const a = carts[i], b = carts[j];
      if (Math.abs(a.lx - b.lx) >= 0.7) continue;
      const front = a.dist >= b.dist ? a : b, back = front === a ? b : a;
      if (front.dist - back.dist < CART_LEN) {
        back.dist = front.dist - CART_LEN;
        if (back.v > front.v) back.v = front.v * 0.97;
        if (back.player && state === 'race' && !back.fallen && t - lastBlock > 1.6) { say('Stuck behind ' + front.name); lastBlock = t; }
      }
    }
  }
  function hazards() {
    for (const o of obs) {
      if (o.gone || o.scared) continue;
      for (const c of carts) {
        if (o.hit.has(c)) continue;
        if (o.d < c.dist - CART_LEN * 0.5 || o.d > c.dist + CART_LEN * 0.5) continue;
        if (Math.abs(c.lx - o.lx) > 0.55) continue;
        o.hit.add(c);
        if (o.type === 'cane') {
          if (c.player && !c.fallen) { c.stam = Math.min(100, c.stam + 35); o.gone = true; o.m.g.visible = false; buzz(20); say('Sugarcane! +35 stamina', '#c4f08c'); audio('cane', c); }
          continue;
        }
        applyHit(c, o);
        if (o.type === 'goat') { o.scared = true; o.dir = o.lx < c.lx ? -1 : 1; break; }
      }
    }
  }
  const ord = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
  function onFinish() {
    state = 'done'; doneT = 2.4; timeScale = 1;
    hidePrompt(); haiLabel('ஹை!', 'Hai');
    const total = P.fin;
    if (P.dq) { finishRank = 0; say('Disqualified', '#ff9a8a'); }
    else if (mode.rivals) {
      finishRank = 1 + carts.filter(c => !c.player && c.fin !== null && !c.dq && c.fin < total).length;
      say(finishRank === 1 ? 'வெற்றி!' : 'Finished ' + ord(finishRank), '#f3a312');
    } else { finishRank = 1; say(total.toFixed(2) + ' s', '#f3a312'); }
    audio('finish', P);
    const best = getBest();
    if (!P.dq && (best === null || total < best)) { try { localStorage.setItem(bestKey(), String(total)); } catch (e) {} P.newBest = true; }
  }
  function showEnd() {
    state = 'end';
    const total = P.fin, best = getBest();
    let ta, rank, line, prize = '';
    if (P.dq) {
      ta = 'தகுதி நீக்கம்'; rank = 'DQ';
      line = P.fallen ? 'Your bulls crossed the line without you. The cart must finish with its saarathi.' : 'Three fouls. Bump clean or bump less.';
    } else if (!mode.rivals) {
      const [g, s, b] = mode.medals, medal = total <= g ? 'Gold' : total <= s ? 'Silver' : total <= b ? 'Bronze' : null;
      ta = medal ? { Gold: 'தங்கம்!', Silver: 'வெள்ளி', Bronze: 'வெண்கலம்' }[medal] : 'மீண்டும் முயற்சி';
      rank = total.toFixed(2) + ' s';
      line = medal ? medal + ' medal over 300 m. ' + (medal === 'Gold' ? 'The axle timer agrees: your bulls are fast.' : 'Gold is under ' + g + ' s. Shout on the bell.')
        : 'No medal yet. Bronze is under ' + b + ' s. Shout on the bell for Perfects.';
    } else {
      const lines = {
        1: ['வெற்றி!', 'Your bulls crossed the line first. The village is yours till next Pongal.'],
        2: ['ஒரு அடி தான்', 'One stride short. Save stamina for Do or Die.'],
        3: ['பரவாயில்லை', 'On the podium. Cleaner braces will win it.'],
      };
      [ta, line] = lines[finishRank] || ['மீண்டும் முயற்சி', 'Off the podium. Catch your rhythm and keep your seat.'];
      rank = ord(finishRank);
      prize = PRIZES[finishRank] ? 'Prize: ' + PRIZES[finishRank] : '';
    }
    $('endTa').textContent = ta; $('endRank').textContent = rank; $('endLine').textContent = line;
    $('endPrize').textContent = prize; $('endPrize').hidden = !prize;
    $('endTime').textContent = P.dq ? '—' : total.toFixed(2) + ' s' + (P.penalty ? ' (incl. ' + P.penalty + ' s fouls)' : '');
    $('endBest').textContent = best ? best.toFixed(2) + ' s' + (P.newBest ? ' · new!' : '') : '—';
    $('endOv').hidden = false;
  }

  let lastZone = -1, zoneTimer = 0, snap = false, lastN = 99;
  function update(rdt) {
    if (slowT > 0) { slowT -= rdt; if (slowT <= 0 && !P.brace) timeScale = 1; }
    const dt = rdt * timeScale;
    t += dt;
    const cnt = $('count');
    if (state === 'count') {
      countT -= rdt;
      const n = Math.ceil(countT - 0.2);
      cnt.hidden = false; cnt.textContent = n > 0 ? String(n) : 'போ!';
      if (n !== lastN) { lastN = n; audio(n > 0 ? 'count' : 'go'); }
      if (countT <= 0) { state = 'race'; cnt.hidden = true; autoCam = null; }
    } else cnt.hidden = true;

    for (const o of obs) {
      if (o.type !== 'goat' || o.gone) continue;
      if (o.scared) { o.lx += o.dir * 3.2 * dt; if (o.lx < -2.5 || o.lx > LANES + 1.5) { o.gone = true; o.m.g.visible = false; } }
      else if (Math.abs(o.d - P.dist) < 50) {
        o.lx += o.dir * 0.55 * dt;
        if (o.lx < 0) { o.lx = 0; o.dir = 1; } if (o.lx > LANES - 1) { o.lx = LANES - 1; o.dir = -1; }
      }
    }

    if (state === 'race' || state === 'done' || state === 'end') {
      if (state === 'race') raceT += dt;
      const wet = R.U.wet.value;
      // the player's cart
      const st = P.stats, grip = 1 - wet * 0.1 * Math.max(0, 1.15 - st.wet);
      if (!P.fallen) {
        const cruise = (7.5 + 2.5 * P.stam / 100) * st.speed * grip;
        P.v += ((P.fin !== null ? 3 : cruise) - P.v) * 0.5 * dt;
        P.stam = Math.min(100, P.stam + (P.dod ? 0 : 9 * st.stamina) * dt);
      } else {
        const waits = st.calm >= 1;     // calm, settled bulls slow down and wait for their saarathi
        P.v += ((waits ? 1.4 : 5.5) - P.v) * (waits ? 1.3 : 0.4) * dt;
        if (!waits && Math.random() < dt * 0.4) { const nl = P.lane + (Math.random() < 0.5 ? -1 : 1); if (nl >= 0 && nl < LANES && laneFree(nl, P)) P.lane = nl; }
      }
      P.unsettle = Math.max(0, P.unsettle - 0.5 * dt);
      if (P.bumpCD > 0) P.bumpCD -= dt;
      // brace window
      if (P.brace) { P.brace.t -= rdt; if (P.brace.t <= 0) { P.brace = null; timeScale = 1; hidePrompt(); throwOff(P); } }
      // two bulls, two minds: an uneven pair pulls the cart when tired
      if (state === 'race' && !P.fallen && !P.brace) {
        if (P.pull) { P.pull.t -= dt; if (P.pull.t <= 0) { const nl = P.lane + P.pull.dir; if (nl >= 0 && nl < LANES && laneFree(nl, P)) P.lane = nl; P.pull = null; hidePrompt(); } }
        else if (Math.abs(st.pull) > 0.03 && P.stam < 40) {
          P.pullT -= dt;
          if (P.pullT <= 0) { P.pullT = rand(5, 8); const dir = st.pull > 0 ? -1 : 1; P.pull = { dir, t: 0.9 }; showPrompt(dir < 0 ? '◀ Pulling left' : 'Pulling right ▶', 'Steer the other way', 'pull'); }
        }
      }
      // Do or Die: the last stretch
      if (state === 'race' && !P.dod && P.dist > mode.len - mode.dod) { P.dod = true; say('DO OR DIE!', '#f3a312'); audio('doordie', P); buzz(90); }
      // runner on foot
      if (P.fallen && runner.st) {
        const rs = runner.st;
        if (rs.down > 0) rs.down -= dt; else rs.v += (2.6 - rs.v) * 0.7 * dt;
        rs.dist += (rs.down > 0 ? 0.5 : rs.v) * dt;
        rs.lat += clamp(latOf(P.lx) - rs.lat, -2 * dt, 2 * dt);
        rs.ph += rs.v * dt * 2.4;
        const gap = (P.dist - 0.9) - rs.dist;
        if (rs.down <= 0) {
          if (Math.abs(gap) < 2.3) { showPrompt('குதி! JUMP', 'Tap ஹை! or swipe up', 'jump'); }
          else showPrompt('Run! ' + Math.max(0, gap).toFixed(0) + ' m', 'Tap ◀ ▶ in turn', 'thrown');
        }
      }
      // rivals
      for (const r of carts) {
        if (r.player) continue;
        if (r.bumpCD > 0) r.bumpCD -= dt;
        if (r.fallen) {
          r.v += (2 - r.v) * 1.2 * dt; r.runT -= dt;
          if (r.runT <= 0) backOn(r);
          continue;
        }
        const gap = clamp((P.dist - r.dist) * 0.04, -1.8, 2.2);
        const target = r.fin !== null ? 4 : (r.base + Math.sin(t * 0.45 + r.ph) * 1.5 + gap) * (0.94 + 0.06 * r.stats.speed) * (1 - wet * 0.08 * Math.max(0, 1.15 - r.stats.wet));
        r.v += (target - r.v) * 0.8 * dt;
        if (!r.whip || r.whip <= 0) { if (r.v < target - 0.3 && Math.random() < dt * 2) { r.whip = 0.3; if (Math.random() < 0.6) audio('rivalHai', r); } }
        rivalSteer(r);
        // reckless rivals bump the player when alongside
        if (state === 'race' && mode.rivals && r.bumpCD <= 0 && !P.fallen && P.fin === null && Math.abs(r.dist - P.dist) < 3 && Math.abs(Math.abs(r.lx - P.lx) - 1) < 0.25 && Math.random() < r.aggro * dt * 0.9) {
          doBump(r, P, Math.sign(P.lane - r.lane));
        }
      }
      for (const c of carts) {
        c.lx += clamp(c.lane - c.lx, -5 * dt, 5 * dt);
        c.dist += c.v * dt;
        c.step += dt * (c.v > 0.2 ? 4 + c.v * 0.55 : 0);
        if (c.whip > 0) c.whip -= dt;
      }
      collisions(); hazards();
      for (const c of carts) if (c.fin === null && c.dist >= mode.len) {
        if (c.fallen) c.dq = true;
        c.fin = raceT + c.penalty;
        if (c.player) onFinish();
      }
      // photo finish: a rival within a cart length near the line
      if (state === 'race' && mode.rivals && mode.len - P.dist < 18 && carts.some(c => c !== P && c.fin === null && Math.abs(c.dist - P.dist) < 3.5)) { if (autoCam !== 'photo') { autoCam = 'photo'; snap = true; timeScale = 0.5; slowT = 2; } }
      if (state === 'done') { doneT -= rdt; if (autoCam === 'photo' && doneT < 1.6) { autoCam = null; timeScale = 1; } if (doneT <= 0) showEnd(); }
    }
    if (shake > 0) shake = Math.max(0, shake - rdt);

    if (state === 'race') {
      const zi = R.zoneAt(P.dist);
      if (zi !== lastZone) { lastZone = zi; const z = R.zones[zi]; $('zoneTa').textContent = z.ta; $('zoneEn').textContent = z.en; $('zone').classList.add('show'); zoneTimer = 3.2; }
    }
    if (zoneTimer > 0) { zoneTimer -= rdt; if (zoneTimer <= 0) $('zone').classList.remove('show'); }
    return dt;
  }

  // ---------- render ----------
  const camPos = new T.Vector3(8, 4, 8), camLook = new T.Vector3(), tmp = new T.Vector3(), tmpL = new T.Vector3(), focus = new T.Vector3();
  const F = {};
  function placeActors(dt) {
    for (const c of carts) {
      const m = c.m, lat = latOf(c.lx);
      R.world(c.dist, lat, m.grp.position);
      R.frame(c.dist, F);
      m.grp.rotation.y = -F.th + clamp((c.lane - c.lx) * -0.25, -0.25, 0.25);
      m.grp.rotation.x = F.pitch;
      if (c.jolt > 0) { c.jolt -= dt; m.grp.rotation.z = Math.sin(c.jolt * 30) * 0.05 * c.jolt; } else m.grp.rotation.z = 0;
      const sn = clamp(c.v / 15, 0, 1.2);
      m.bulls.forEach((b, i) => R.animBull(b, c.step * 2 + i * 0.7, sn));
      m.wheels.forEach(w => { w.rotation.x -= c.v * dt / R.WHEEL_R; });
      if (m.upd) m.upd(c, dt, t);
      if (c.v > 8 && Math.random() < c.v * dt * 1.6) {
        R.world(c.dist - rand(0.4, 2.4), lat + rand(-1, 1), _v);
        const wetK = R.U.wet.value;
        emit(_v.x, _v.y + 0.25, _v.z, rand(-0.6, 0.6), rand(0.4, 1.2), rand(-0.5, 0.5), rand(1, 1.6) * (1 - wetK * 0.6), rand(0.8, 1.6) * (1 - wetK * 0.5), wetK > 0.5 ? '#7a5a40' : '#d6a272');
      }
    }
    if (P.fallen && runner.st) {
      const rs = runner.st;
      R.world(rs.dist, rs.lat, runner.g.position); R.frame(rs.dist, F);
      runner.g.rotation.y = -F.th;
      if (rs.down > 0) { runner.g.rotation.x = -1.2 * (rs.down / 0.75); runner.anim(0, 0, 0); }
      else { runner.g.rotation.x = 0; runner.anim(rs.ph, clamp(rs.v / 7, 0.3, 1.1), clamp(rs.v / 20, 0.05, 0.4)); }
    }
    for (const o of obs) {
      if (o.gone) continue;
      const g = o.m.g;
      g.visible = Math.abs(o.d - P.dist) < 140;
      if (!g.visible) continue;
      R.world(o.d, latOf(o.lx), g.position);
      R.frame(o.d, F);
      if (o.type === 'goat') {
        g.rotation.y = -F.th - o.dir * Math.PI / 2;
        const k = Math.sin(t * (o.scared ? 22 : 12)) * 0.5;
        o.m.legs.forEach((l, i) => { l.rotation.x = (i % 3 === 0 ? k : -k); });
      } else if (o.type === 'cane') {
        const s = 1 + Math.sin(t * 5) * 0.08; o.m.ring.scale.set(s, s, s); g.rotation.y += dt * 0.6;
      } else { g.rotation.y = -F.th; g.rotation.x = F.pitch; }
    }
    for (const p of POOL) {
      if (p.life <= 0) { if (p.s.visible) p.s.visible = false; continue; }
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 0.6 * dt;
      const a = Math.max(0, p.life / p.max);
      p.s.position.set(p.x, p.y, p.z);
      const s = p.size * (1.8 - a);
      p.s.scale.set(s, s, 1);
      p.s.material.opacity = a * 0.45;
    }
  }

  let turn = 0;
  const local = (x, y, z, out) => P.m.grp.localToWorld(out.set(x, y, z));
  function updateCamera(rdt) {
    const lat = latOf(P.lx), spd = clamp(P.v / VMAX, 0, 1);
    const race = state === 'race' || state === 'count' || state === 'done';
    let key = race ? (autoCam || camKey()) : state === 'end' ? 'end' : 'menu', kp = 4.5, kl = 6, fovAdd = 0;
    P.m.grp.updateMatrixWorld();
    if (key === 'menu') {
      const a = t * 0.11;
      R.world(P.dist - 1.8, lat, tmpL); tmpL.y += 1.2;
      const rad = 9.5 + Math.sin(t * 0.21) * 1.8;
      tmp.set(tmpL.x + Math.sin(a) * rad, tmpL.y + 1.2 + Math.sin(t * 0.17) * 0.7, tmpL.z + Math.cos(a) * rad); kp = kl = 1.6;
    } else if (key === 'end') {
      const a = t * 0.18 + 1.5;
      R.world(P.dist - 1.6, lat, tmpL); tmpL.y += 1.2;
      tmp.set(tmpL.x + Math.sin(a) * 7.5, tmpL.y + 1.6, tmpL.z + Math.cos(a) * 7.5); kp = kl = 1.6;
    } else if (key === 'start') {      // countdown: close on the bulls' faces, then pull back
      autoCamT += rdt;
      const k = clamp(autoCamT / 3, 0, 1);
      local(-2.4 - k * 1.5, 1.2 + k * 1.6, -5.8 + k * 7, tmp); local(0, 1.4, -3 + k * 1.5, tmpL); kp = kl = 3;
    } else if (key === 'runner' && runner.st) {
      const rs = runner.st;
      R.world(rs.dist - 5.5, rs.lat * 0.8, tmp); tmp.y += 3.2;
      R.world(P.dist + 1, latOf(P.lx), tmpL); tmpL.y += 1.1; kp = 5; kl = 7;
    } else if (key === 'photo') {
      R.world(mode.len + 0.5, R.EDGE + 2.2, tmp); tmp.y += 1.5;
      R.world(mode.len, 0, tmpL); tmpL.y += 1.1; kp = kl = 20;
    } else if (key === 'eye') {
      local(0, 2.25, -0.1, tmp); local(0, 1.55, -9, tmpL); kp = kl = 30; fovAdd = 8;
    } else if (key === 'low') {
      local(1.15, 0.42, 3.2, tmp); local(0.1, 0.9, -10, tmpL); kp = kl = 25; fovAdd = 4;
    } else if (key === 'tv') {
      const side = lat > 0 ? -1 : 1;
      R.world(P.dist + 3, side * (R.EDGE + 3.2), tmp); tmp.y += 4.6;
      R.world(P.dist - 1, lat, tmpL); tmpL.y += 1.1; kp = 3; kl = 8; fovAdd = -14;
    } else if (key === 'drone') {
      R.world(P.dist - 7, lat * 0.5, tmp); tmp.y += 20;
      R.world(P.dist + 9, lat * 0.5, tmpL); kp = 3; kl = 5;
    } else {                           // chase: swing wide of the bend ahead and look into it
      R.frame(P.dist, F); const th0 = F.th; R.frame(P.dist + 25, F);
      turn += (F.th - th0 - turn) * Math.min(1, rdt * 2);
      const back = 8.3 - spd * 0.9, up = 3.75 - spd * 0.45;
      R.world(P.dist - back, lat * 0.62 - turn * 12, tmp); tmp.y += up;
      R.world(P.dist + 10, lat * 0.5 + turn * 18, tmpL); tmpL.y += 1.15;
    }
    const a = snap ? 1 : 1 - Math.exp(-rdt * kp), b = snap ? 1 : 1 - Math.exp(-rdt * kl); snap = false;
    camPos.lerp(tmp, a); camLook.lerp(tmpL, b);
    camera.position.copy(camPos);
    if (shake > 0) camera.position.add(tmp.set(rand(-1, 1), rand(-1, 1), 0).multiplyScalar(shake * 0.35));
    if (race && !reduceMotion && key !== 'photo') {
      const r = Math.max(0, spd - 0.45) * (key === 'eye' ? 0.03 : 0.07);
      camera.position.x += Math.sin(t * 37) * Math.sin(t * 13) * r; camera.position.y += Math.sin(t * 29 + 1) * Math.sin(t * 7) * r;
    }
    camera.lookAt(camLook);
    if (race && !reduceMotion && key === 'chase') camera.rotateZ(-turn * 0.6);
    if (R.debug.camOverride) { const o = R.debug.camOverride; camera.position.copy(local(o[0], o[1], o[2], tmp)); camera.lookAt(local(o[3], o[4], o[5], tmpL)); }
    const fov = baseFov + fovAdd + spd * 9;
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, rdt * 3); camera.updateProjectionMatrix(); }
    P.m.drv.visible = !P.fallen && !(key === 'eye' && race);
    R.world(P.dist + 6, lat * 0.5, focus);
  }

  // ---------- HUD ----------
  const elPos = $('pos'), elDist = $('dist'), elTime = $('time'), elKmh = $('kmh'), elStam = $('stam'), beatEl = $('beat');
  function hud() {
    if (mode.rivals) {
      const rank = finishRank || 1 + carts.filter(c => c !== P && c.dist > P.dist).length;
      elPos.textContent = state === 'ready' || state === 'loading' ? '—' : finishRank === 0 ? 'DQ' : ord(rank);
    } else elPos.textContent = state === 'ready' || state === 'loading' ? '—' : (P.dod ? 'DoD' : 'TT');
    elDist.textContent = Math.min(mode.len, Math.floor(P.dist));
    elTime.textContent = (P.fin !== null ? P.fin : raceT).toFixed(1);
    elKmh.textContent = Math.round(P.v * 3.6);
    elStam.style.width = P.stam.toFixed(0) + '%';
    elStam.style.background = P.dod ? '#f3a312' : P.stam > 55 ? '#7fa83a' : P.stam > 25 ? '#f3a312' : '#d63a1f';
    carts.forEach((c, i) => { if (dots[i]) dots[i].style.left = (clamp(c.dist / mode.len, 0, 1) * 100).toFixed(2) + '%'; });
    // beat ring: closes in on the button and flashes on each stride (the bell)
    if (state === 'race' && !P.fallen && !P.brace && P.fin === null) {
      const f = strideFrac(P), near = Math.min(f, 1 - f);
      beatEl.style.transform = 'scale(' + (1 + 0.16 * (1 - f)).toFixed(3) + ')';
      beatEl.style.opacity = (0.25 + 0.75 * (1 - near * 2)).toFixed(2);
      beatEl.classList.toggle('on', near < 0.09);
    } else { beatEl.style.opacity = '0'; }
    if (state === 'race' && !P.fallen && !P.brace) haiLabel('ஹை!', 'Hai');
  }

  function resize() {
    const r = stage.getBoundingClientRect();
    const w = Math.max(200, r.width), h = Math.max(200, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    baseFov = camera.aspect < 0.8 ? 70 : camera.aspect < 1.2 ? 62 : 54;
    camera.fov = baseFov; camera.updateProjectionMatrix();
    if (R.Post) R.Post.resize(w, h, renderer.getPixelRatio());
  }

  // ---------- start screen: mode, bulls, atmosphere ----------
  let atmo = 'noon';
  try { const a = localStorage.getItem('rekla-atmo'); if (a && (R.PRESETS[a] || a === 'random')) atmo = a; } catch (e) {}
  function chipGroup(wrap, items, current, onPick) {
    wrap.innerHTML = '';
    items.forEach(([id, label]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.id = id; b.textContent = label;
      b.setAttribute('aria-pressed', String(id === current));
      b.addEventListener('click', () => { wrap.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.id === id))); onPick(id); });
      wrap.appendChild(b);
    });
  }
  function buildMenu() {
    chipGroup($('atmo'), [...R.PRESET_ORDER.map(id => [id, R.PRESETS[id].en]), ['random', 'Surprise me']], atmo, id => { atmo = id; try { localStorage.setItem('rekla-atmo', id); } catch (e) {} applyAtmo(); });
    chipGroup($('modeChips'), Object.keys(MODES).map(id => [id, MODES[id].en]), setup.mode, id => { setup.mode = id; saveSetup(); reset(); paintMenu(); });
    for (const [i, el] of [[0, $('bullL')], [1, $('bullR')]]) {
      el.innerHTML = R.BREED_ORDER.map(k => `<option value="${k}">${R.BREEDS[k].en}</option>`).join('');
      el.value = setup.breeds[i];
      el.addEventListener('change', () => { setup.breeds[i] = el.value; saveSetup(); buildPlayerModel(); reset(); paintMenu(); snap = true; });
    }
    paintMenu();
  }
  function paintMenu() {
    const s = R.pairStats(setup.breeds[0], setup.breeds[1]);
    const rows = [['Speed', s.speed], ['Stamina', s.stamina], ['Start', s.accel], ['Power', s.power], ['Calm', s.calm], ['Wet grip', s.wet]];
    $('stats').innerHTML = rows.map(([k, v]) => `<div class="stat-row"><span>${k}</span><i><b style="width:${clamp((v - 0.7) / 0.65, 0.05, 1) * 100}%"></b></i></div>`).join('');
    const a = R.BREEDS[setup.breeds[0]], b = R.BREEDS[setup.breeds[1]];
    $('pairNote').textContent = a === b ? a.note + '.' : a.note + ' · ' + b.note + '. An uneven pair pulls when tired.';
    const best = getBest();
    $('modeNote').textContent = setup.mode === 'trial' ? 'Solo against the axle timer over 300 m. Gold under ' + MODES.trial.medals[0] + ' s.' : 'Six carts, 800 m, mass start. Bump rivals by steering into them.';
    $('bestStart').textContent = best ? 'Your best here: ' + best.toFixed(2) + ' s' : 'Keyboard: ← → steer, Space shout, C camera';
  }
  function applyAtmo() {
    const id = atmo === 'random' ? R.PRESET_ORDER[(Math.random() * R.PRESET_ORDER.length) | 0] : atmo;
    R.Sky.apply(id);
    if (R.Weather) R.Weather.apply(R.PRESETS[id], id);
    if (R.Post) R.Post.apply(R.PRESETS[id]);
  }
  // a small finish gate for the 300 m time trial
  function makeTrialGate() {
    const g = new T.Group(), Fr = R.frame(MODES.trial.len, {});
    g.position.set(Fr.x, Fr.y, Fr.z); g.rotation.y = -Fr.th;
    const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
    const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding;
    const paint = () => { const x = c.getContext('2d'); x.fillStyle = '#1f6b3a'; x.fillRect(0, 0, 1024, 128); x.fillStyle = '#f3a312'; x.fillRect(0, 0, 1024, 10); x.fillRect(0, 118, 1024, 10); x.fillStyle = '#fff3d6'; x.font = "800 70px 'Baloo Thambi 2', sans-serif"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('முடிவு  ·  300 m', 512, 70); tex.needsUpdate = true; };
    paint(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint);
    const pole = new T.MeshStandardMaterial({ color: R.col('#5a3418'), roughness: 0.9 });
    for (const sx of [-1, 1]) { const p = new T.Mesh(new T.CylinderGeometry(0.12, 0.15, 5.4, 8), pole); p.position.set(sx * (R.ROAD_HALF + 0.7), 2.7, 0); p.castShadow = true; g.add(p); }
    const ban = new T.Mesh(new T.PlaneGeometry(R.ROAD_HALF * 2 + 1, 1.2), new T.MeshStandardMaterial({ map: tex, side: T.DoubleSide, roughness: 0.8 })); ban.position.y = 4.4; g.add(ban);
    const line = new T.Mesh(new T.PlaneGeometry(R.ROAD_HALF * 2, 0.35), new T.MeshStandardMaterial({ color: R.col('#f4efe2'), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3 }));
    line.rotation.x = -Math.PI / 2; line.position.y = 0.06; g.add(line);
    scene.add(g); return g;
  }

  // ---------- frame loop ----------
  let last = performance.now(), frames = 0, acc = 0, slow = 0, fast = 0;
  R.stats = { fps: 0 };
  function frame(now) {
    const rdt = Math.min(0.05, (now - last) / 1000); last = now;
    renderer.info.reset();
    const dt = update(rdt);
    R.U.time.value += dt;
    placeActors(dt);
    updateCamera(rdt);
    R.Sky.update(camera, focus);
    R.updateScatters(P.dist);
    if (R.Weather) R.Weather.update(dt, camera, P, t);
    if (R.Crowd) R.Crowd.update(dt, carts, t);
    if (R.Audio) R.Audio.update(dt, { state, carts, P });
    if (R.World.update) R.World.update(dt, camera, t);
    if (R.Post && R.Post.enabled) R.Post.render(renderer, scene, camera, { speed: clamp(P.v / VMAX, 0, 1), dt });
    else renderer.render(scene, camera);
    hud();
    frames++; acc += rdt;
    if (acc > 1.5) {
      const fps = frames / acc; R.stats.fps = fps; frames = 0; acc = 0;
      if (fps < 40) { slow++; fast = 0; } else if (fps > 57) { fast++; slow = 0; } else { slow = fast = 0; }
      if (slow >= 2 && dpr > 0.75) { dpr = Math.max(0.75, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); slow = 0; }
      else if (slow >= 2 && R.Post && R.Post.enabled) { R.Post.enabled = false; slow = 0; }
      else if (slow >= 3 && renderer.shadowMap.enabled && R.Sky.sun.shadow.mapSize.x > 512) { R.Sky.sun.shadow.mapSize.set(512, 512); R.Sky.sun.shadow.map && R.Sky.sun.shadow.map.dispose(); R.Sky.sun.shadow.map = null; slow = 0; }
      if (fast >= 4 && dpr < Math.min(window.devicePixelRatio || 1, R.Q.dprMax)) { dpr = Math.min(R.Q.dprMax, dpr + 0.25); renderer.setPixelRatio(dpr); resize(); fast = 0; }
    }
    requestAnimationFrame(frame);
  }

  // ---------- build the world in steps, keeping the page responsive ----------
  const tick = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  async function build() {
    const label = $('bestStart'), btn = $('startBtn');
    btn.disabled = true;
    const step = async (msg, fn) => { label.textContent = msg; btn.textContent = 'Loading…'; await tick(); fn(); };
    R.Models.init();
    R.Sky.init(renderer, scene);
    let maps, grain, detail;
    await step('Laying the red-earth road…', () => { maps = R.makeRoadMaps(); grain = R.makeGrain(); detail = R.makeGroundDetail(); R.tex = { maps, grain, detail }; });
    await step('Shaping the land…', () => { R.World.buildTerrain(scene, detail); R.World.buildRoad(scene, maps, grain); R.World.buildMountains(scene); });
    if (R.World.buildScenery) await R.World.buildScenery(scene, step);
    await step('Yoking the bulls…', () => {
      makePool();
      buildPlayerModel();
      rivalModels = RIVALS.map(d => R.Models.cart(d, scene, d.breeds));
      runner = R.Models.runner(scene, PLAYER.turban);
      trialGate = makeTrialGate();
      if (R.Crowd) R.Crowd.build(scene);
      if (R.Weather) R.Weather.build(scene, camera);
      if (R.Post) R.Post.init(renderer);
    });
    if (R.Audio) await step('Tuning the nadaswaram…', () => R.Audio.prepare());
    reset();
    buildMenu(); applyAtmo();
    resize();
    new ResizeObserver(resize).observe(stage);
    state = 'ready';
    btn.disabled = false; btn.textContent = 'Start race';
    paintMenu();
    requestAnimationFrame(t0 => { last = t0; requestAnimationFrame(frame); });
  }
  R.debug = {
    get state() { return state; }, get P() { return P; }, get carts() { return carts; }, renderer, scene, camera, startRace,
    setAtmo: id => { atmo = id; applyAtmo(); }, setMode: m => { setup.mode = m; reset(); }, setCam: i => { setup.cam = i; snap = true; },
    jump: s => { if (P) { P.dist = s; snap = true; } }, skip: () => { countT = 0.01; },
    throwMe: () => throwOff(P), brace: () => startBrace(P, 'test'), hai, steer,
    // fast headless play-testing: advance the simulation without rendering; bot = 'perfect' | 'sloppy' | null
    sim: (secs, bot, fps = 60) => { const dt = 1 / fps; let n = Math.round(secs * fps), log = { perfect: 0, good: 0, off: 0, thrown: 0, braces: 0, caught: 0, bumps: 0 };
      const origJudge = judgeEl.textContent;
      for (let i = 0; i < n && state !== 'end'; i++) {
        if (bot && state === 'race' && P.fin === null) {
          if (P.brace) { if (bot === 'perfect' || Math.random() < 0.5) { log.braces++; braced(); } }
          else if (P.fallen) { if (runner.st && runner.st.down <= 0) { if (Math.abs((P.dist - 0.9) - runner.st.dist) < 2.3) { tryCatch(); if (!P.fallen) log.caught++; } else if (i % 7 === 0) runStep(runner.st.side === 1 ? -1 : 1); } }
          else { const f = strideFrac(P), want = bot === 'perfect' ? (f < 0.02 || f > 0.985) : Math.random() < 0.04;
            if (want && t - P.lastShout > 0.22 && (P.stam > 18 || P.dod)) { hai(); const j = judgeEl.className; if (j.includes('perfect')) log.perfect++; else if (j.includes('good')) log.good++; else log.off++; } }
        }
        const wasFallen = P.fallen; update(dt); placeActors(dt); if (!wasFallen && P.fallen) log.thrown++;
      }
      return { state, dist: +P.dist.toFixed(1), v: +P.v.toFixed(1), stam: +P.stam.toFixed(0), fin: P.fin && +P.fin.toFixed(2), dq: P.dq, rank: finishRank, fouls: P.fouls, ...log };
    },
    get cam() { return camera.position; }, get cart() { return P && P.m.grp.position; },
  };
  build();
})();
