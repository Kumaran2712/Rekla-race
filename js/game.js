/* Rekla Race · game: renderer, build sequence, race simulation (unchanged from v2), camera, HUD, loop */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const R = window.R, T = R.T;
  const { TRACK, LANES, LANE_W } = R;
  const CART_LEN = 5.2, VMAX = 19;
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = R.clamp, rand = (a, b) => a + Math.random() * (b - a);
  const latOf = lx => (lx - (LANES - 1) / 2) * LANE_W;

  const DEFS = [
    { name: 'You',   body: '#c8321c', turban: '#f3a312', num: '7', player: true, lane: 1 },
    { name: 'Kaali', body: '#2f3f7a', turban: '#ece4d2', num: '3', lane: 0, base: 12.6 },
    { name: 'Raja',  body: '#d39a17', turban: '#a2281a', num: '5', lane: 2, base: 13.1 },
    { name: 'Vel',   body: '#2f6b4a', turban: '#f2c94c', num: '9', lane: 3, base: 13.6 },
  ];

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
  const camera = new T.PerspectiveCamera(60, 1, 0.15, 2600);
  R.camera = camera;
  let baseFov = 60;

  // ---------- dust pool ----------
  let dotTex = null;
  const POOL = [];
  function makePool() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    dotTex = new T.CanvasTexture(c); R.dotTex = dotTex;
    for (let i = 0; i < 180; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: dotTex, color: 0xd8a676, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false; scene.add(s); POOL.push({ s, life: 0 });
    }
  }
  let poolI = 0;
  const dustCol = new T.Color();
  function emit(x, y, z, vx, vy, vz, life, size, hex) {
    const p = POOL[poolI = (poolI + 1) % POOL.length];
    Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, size });
    p.s.material.color.copy(R.col(hex)); p.s.visible = true;
  }
  R.emit = emit;

  // ---------- state ----------
  let state = 'loading', carts = [], P = null, obs = [], models = [];
  let t = 0, raceT = 0, shake = 0, countT = 0, finishRank = null, doneT = 0, lastTired = -9, lastBlock = -9;
  let best = null;
  try { const b = parseFloat(localStorage.getItem('rekla-best')); if (b > 0) best = b; } catch (e) {}
  const bar = $('bar');
  const dots = DEFS.map(d => { const el = document.createElement('div'); el.className = 'dot' + (d.player ? ' me' : ''); el.style.background = d.body; bar.appendChild(el); return el; });

  function clearObs() { for (const o of obs) scene.remove(o.m.g); obs = []; }
  function genObs() {
    clearObs();
    const types = ['pothole', 'puddle', 'pothole', 'puddle', 'goat', 'cane'];
    const add = (type, d, lane) => {
      const m = type === 'goat' ? R.Models.goat(scene) : type === 'cane' ? R.Models.cane(scene) : R.Models.hole(type, scene);
      obs.push({ type, d, lx: lane, dir: Math.random() < 0.5 ? -1 : 1, hit: new Set(), gone: false, scared: false, m });
    };
    let d = 55;
    while (d < TRACK - 30) {
      const type = types[(Math.random() * types.length) | 0];
      const lane = (Math.random() * LANES) | 0;
      add(type, d, lane);
      if (type !== 'goat' && Math.random() < 0.35) add(Math.random() < 0.5 ? 'pothole' : 'puddle', d + rand(-2, 2), (lane + 1 + ((Math.random() * (LANES - 1)) | 0)) % LANES);
      d += rand(22, 42);
    }
  }
  function reset() {
    carts = DEFS.map((d, i) => ({ ...d, lx: d.lane, dist: 0, v: 0, ph: Math.random() * 6, stam: 100, fin: null, whip: 0,
      step: Math.random() * 6, dodge: new Set(), base: d.base ? d.base + rand(-0.25, 0.25) : 0, m: models[i], jolt: 0 }));
    P = carts[0];
    genObs();
    for (const p of POOL) { p.life = 0; p.s.visible = false; }
    t = 0; raceT = 0; shake = 0; countT = 3.2; finishRank = null; doneT = 0; lastZone = -1;
  }

  const toasts = $('toasts');
  function say(text, color) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = text;
    if (color) el.style.setProperty('--c', color);
    toasts.appendChild(el); while (toasts.children.length > 3) toasts.firstChild.remove();
    setTimeout(() => el.remove(), 1350);
  }
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
  function laneFree(l, cart) {
    return !carts.some(c => c !== cart && (Math.abs(c.lane - l) < 0.5 || Math.abs(c.lx - l) < 0.6) && Math.abs(c.dist - cart.dist) < CART_LEN + 0.5);
  }
  function obsNear(l, d) {
    return obs.some(o => !o.gone && o.type !== 'cane' && Math.abs(o.lx - l) < 0.6 && o.d - d > -2 && o.d - d < 16);
  }

  // ---------- controls (unchanged) ----------
  function steer(dir) {
    if (state !== 'race' || P.fin !== null) return;
    const nl = P.lane + dir;
    if (nl < 0 || nl >= LANES) return;
    if (!laneFree(nl, P)) { shake = 0.2; if (t - lastBlock > 1) { say('Lane blocked'); lastBlock = t; if (R.Audio) R.Audio.event('blocked', P); } return; }
    P.lane = nl;
  }
  const haiBtn = $('hai');
  function hai() {
    haiBtn.classList.add('press'); setTimeout(() => haiBtn.classList.remove('press'), 90);
    if (state !== 'race' || P.fin !== null) return;
    const k = P.stam / 100;
    P.v = Math.min(VMAX, P.v + 2.4 * (0.3 + 0.7 * k));
    P.stam = Math.max(0, P.stam - 5);
    P.whip = 0.3;
    if (R.Audio) R.Audio.event('hai', P);
    if (P.stam < 12 && t - lastTired > 2.5) { say('Bulls are tired. Ease off.', '#ffd9a0'); lastTired = t; if (R.Audio) R.Audio.event('tired', P); }
  }
  // sound: unlock on the first touch or key, toggle with the speaker button
  const sndBtn = $('snd');
  const paintSnd = () => { sndBtn.setAttribute('aria-pressed', String(R.Audio.on)); sndBtn.setAttribute('aria-label', R.Audio.on ? 'Mute sound' : 'Turn sound on'); sndBtn.querySelector('.wave').style.display = R.Audio.on ? '' : 'none'; sndBtn.querySelector('.x').style.display = R.Audio.on ? 'none' : ''; };
  if (R.Audio) {
    const wake = () => { if (R.Audio.on && state !== 'loading') R.Audio.unlock(); };
    document.addEventListener('pointerdown', wake, true); document.addEventListener('keydown', wake, true);
    sndBtn.addEventListener('click', e => { e.stopPropagation(); R.Audio.setOn(!R.Audio.on); paintSnd(); });
    paintSnd();
  } else sndBtn.hidden = true;
  const press = (el, fn) => el.addEventListener('pointerdown', e => { e.preventDefault(); fn(); });
  press($('bl'), () => steer(-1)); press($('br'), () => steer(1)); press(haiBtn, hai);
  let sx = null, sy = null;
  C.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
  C.addEventListener('pointerup', e => {
    if (sx === null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 1 : -1);
    else if (Math.abs(dx) < 18 && Math.abs(dy) < 18) hai();
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') { steer(-1); e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === 'd') { steer(1); e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { if (!e.repeat) hai(); e.preventDefault(); }
    else if (e.key === 'Enter' && (state === 'ready' || state === 'end')) startRace();
  });
  function startRace() {
    if (R.Audio) R.Audio.unlock();
    reset(); state = 'count'; lastN = 99;
    $('startOv').hidden = true; $('endOv').hidden = true; $('hint').hidden = false;
    setTimeout(() => { $('hint').hidden = true; }, 6000);
  }
  $('startBtn').addEventListener('click', startRace);
  $('againBtn').addEventListener('click', startRace);
  $('menuBtn').addEventListener('click', () => { $('endOv').hidden = true; $('startOv').hidden = false; state = 'ready'; reset(); });

  // ---------- simulation (unchanged) ----------
  const _v = new T.Vector3();
  function rivalSteer(r) {
    for (const o of obs) {
      if (o.gone || o.type === 'cane' || r.dodge.has(o)) continue;
      const ahead = o.d - r.dist;
      if (ahead > 2 && ahead < 15 && Math.abs(o.lx - r.lane) < 0.6) {
        r.dodge.add(o);
        if (Math.random() < 0.8) {
          const opts = [r.lane - 1, r.lane + 1].filter(l => l >= 0 && l < LANES && laneFree(l, r) && !obsNear(l, r.dist));
          if (opts.length) r.lane = opts[(Math.random() * opts.length) | 0];
        }
      }
    }
  }
  function applyHit(c, o) {
    const me = c.player;
    if (R.Audio) R.Audio.event(o.type === 'goat' && !me ? 'goatNear' : o.type, c);
    R.world(c.dist, latOf(c.lx), _v);
    const x = _v.x, y = _v.y, z = _v.z;
    if (o.type === 'pothole') {
      c.v *= 0.55; c.jolt = 0.5;
      for (let i = 0; i < 10; i++) emit(x + rand(-1, 1), y + 0.3, z + rand(-1, 1), rand(-1.5, 1.5), rand(1, 2.5), rand(-1, 1), 0.9, rand(0.6, 1.1), '#a4643a');
      if (me) { shake = reduceMotion ? 0 : 0.45; buzz(60); say('Pothole!', '#ffb08a'); }
    } else if (o.type === 'puddle') {
      c.v *= 0.75;
      for (let i = 0; i < 18; i++) emit(x + rand(-1.1, 1.1), y + 0.2, z + rand(-1.5, 1.5), rand(-3, 3), rand(2, 4.5), rand(-1, 1), 0.7, rand(0.3, 0.6), '#8fa3a4');
      if (me) { buzz(30); say('Splash!', '#cfeef2'); }
    } else if (o.type === 'goat') {
      c.v *= 0.45; c.stam = Math.max(0, c.stam - 12); c.jolt = 0.4;
      if (me) { shake = reduceMotion ? 0 : 0.35; buzz(80); say('Goat on the road!', '#ffd27a'); }
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
        if (back.player && state === 'race' && t - lastBlock > 1.6) { say('Stuck behind ' + front.name); lastBlock = t; }
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
          if (c.player) { c.stam = Math.min(100, c.stam + 35); o.gone = true; o.m.g.visible = false; buzz(20); say('Sugarcane! +35 stamina', '#c4f08c'); if (R.Audio) R.Audio.event('cane', c); }
          continue;
        }
        applyHit(c, o);
        if (o.type === 'goat') { o.scared = true; o.dir = o.lx < c.lx ? -1 : 1; break; }
      }
    }
  }
  const ord = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
  function onFinish() {
    finishRank = 1 + carts.filter(c => !c.player && c.fin !== null && c.fin < P.fin).length;
    state = 'done'; doneT = 2.2;
    if (R.Audio) R.Audio.event('finish', P);
    say(finishRank === 1 ? 'வெற்றி!' : 'Finished ' + ord(finishRank), '#f3a312');
    if (best === null || P.fin < best) { best = P.fin; try { localStorage.setItem('rekla-best', String(best)); } catch (e) {} }
  }
  function showEnd() {
    state = 'end';
    const lines = {
      1: ['வெற்றி!', 'Your bulls crossed the rope first. The village is yours till next Pongal.'],
      2: ['ஒரு அடி தான்', 'One stride short. Save a little stamina for the last 100 metres.'],
      3: ['பரவாயில்லை', 'A podium finish. Dodge cleaner and pace your shouts.'],
      4: ['மீண்டும் முயற்சி', 'Last across the line. Grab the sugarcane and stay off the potholes.'],
    };
    const [ta, line] = lines[finishRank];
    $('endTa').textContent = ta; $('endRank').textContent = ord(finishRank); $('endLine').textContent = line;
    $('endTime').textContent = P.fin.toFixed(1) + ' s';
    $('endBest').textContent = best ? best.toFixed(1) + ' s' : '—';
    $('endOv').hidden = false;
  }

  let lastZone = -1, zoneTimer = 0, snap = false, lastN = 99;
  function update(dt) {
    t += dt;
    const cnt = $('count');
    if (state === 'count') {
      countT -= dt;
      const n = Math.ceil(countT - 0.2);
      cnt.hidden = false; cnt.textContent = n > 0 ? String(n) : 'போ!';
      if (n !== lastN) { lastN = n; if (R.Audio) R.Audio.event(n > 0 ? 'count' : 'go'); }
      if (countT <= 0) { state = 'race'; cnt.hidden = true; }
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
      const cruise = 7.5 + 2.5 * P.stam / 100;
      P.v += ((P.fin !== null ? 3 : cruise) - P.v) * 0.5 * dt;
      P.stam = Math.min(100, P.stam + 9 * dt);
      for (const r of carts) {
        if (r.player) continue;
        const gap = clamp((P.dist - r.dist) * 0.04, -1.8, 2.2);
        const target = r.fin !== null ? 4 : r.base + Math.sin(t * 0.45 + r.ph) * 1.5 + gap;
        r.v += (target - r.v) * 0.8 * dt;
        if (!r.whip || r.whip <= 0) { if (r.v < target - 0.3 && Math.random() < dt * 2) { r.whip = 0.3; if (R.Audio && Math.random() < 0.6) R.Audio.event('rivalHai', r); } }
        rivalSteer(r);
      }
      for (const c of carts) {
        c.lx += clamp(c.lane - c.lx, -5 * dt, 5 * dt);
        c.dist += c.v * dt;
        if (c.whip > 0) c.whip -= dt;
      }
      collisions(); hazards();
      for (const c of carts) if (c.fin === null && c.dist >= TRACK) { c.fin = raceT; if (c.player) onFinish(); }
      if (state === 'done') { doneT -= dt; if (doneT <= 0) showEnd(); }
    }
    if (shake > 0) shake = Math.max(0, shake - dt);

    // location label as you enter each stretch
    if (state === 'race') {
      const zi = R.zoneAt(P.dist);
      if (zi !== lastZone) { lastZone = zi; const z = R.zones[zi]; $('zoneTa').textContent = z.ta; $('zoneEn').textContent = z.en; $('zone').classList.add('show'); zoneTimer = 3.2; }
    }
    if (zoneTimer > 0) { zoneTimer -= dt; if (zoneTimer <= 0) $('zone').classList.remove('show'); }
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
      if (c.jolt > 0) { c.jolt -= dt; m.grp.rotation.z = Math.sin(c.jolt * 30) * 0.04 * c.jolt; } else m.grp.rotation.z = 0;
      const sn = clamp(c.v / 15, 0, 1.2);
      c.step += dt * (c.v > 0.2 ? 4 + c.v * 0.55 : 0);
      m.bulls.forEach((b, i) => R.animBull(b, c.step * 2 + i * 0.7, sn));
      m.wheels.forEach(w => { w.rotation.x -= c.v * dt / R.WHEEL_R; });
      m.rArm.rotation.x = c.whip > 0 ? -0.6 - Math.sin(c.whip * 30) * 0.9 : -0.6;
      if (m.upd) m.upd(c, dt, t);
      // dust from hooves and wheels
      if (c.v > 8 && Math.random() < c.v * dt * 1.6) {
        R.world(c.dist - rand(0.4, 2.4), lat + rand(-1, 1), _v);
        const wetK = R.U.wet.value;
        emit(_v.x, _v.y + 0.25, _v.z, rand(-0.6, 0.6), rand(0.4, 1.2), rand(-0.5, 0.5), rand(1, 1.6) * (1 - wetK * 0.6), rand(0.8, 1.6) * (1 - wetK * 0.5), wetK > 0.5 ? '#7a5a40' : '#d6a272');
      }
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
  function updateCamera(dt) {
    const lat = latOf(P.lx), spd = clamp(P.v / VMAX, 0, 1);
    if (state === 'ready' || state === 'loading') {
      // cinematic: slow orbit with a gentle crane move
      const a = t * 0.11;
      R.world(P.dist - 1.8, lat, tmpL); tmpL.y += 1.2;
      const rad = 9.5 + Math.sin(t * 0.21) * 1.8;
      tmp.set(tmpL.x + Math.sin(a) * rad, tmpL.y + 1.2 + Math.sin(t * 0.17) * 0.7, tmpL.z + Math.cos(a) * rad);
    } else if (state === 'end') {
      const a = t * 0.18 + 1.5;
      R.world(P.dist - 1.6, lat, tmpL); tmpL.y += 1.2;
      tmp.set(tmpL.x + Math.sin(a) * 7.5, tmpL.y + 1.6, tmpL.z + Math.cos(a) * 7.5);
    } else {
      // read the bend ahead: swing wide of it and look into it
      R.frame(P.dist, F); const th0 = F.th; R.frame(P.dist + 25, F);
      turn += (F.th - th0 - turn) * Math.min(1, dt * 2);
      const back = 8.3 - spd * 0.9, up = 3.75 - spd * 0.45;
      R.world(P.dist - back, lat * 0.62 - turn * 12, tmp); tmp.y += up;
      R.world(P.dist + 10, lat * 0.5 + turn * 18, tmpL); tmpL.y += 1.15;
    }
    const race = state === 'race' || state === 'count' || state === 'done';
    const kp = snap ? 1 : 1 - Math.exp(-dt * (race ? 4.5 : 1.6)), kl = snap ? 1 : 1 - Math.exp(-dt * (race ? 6 : 1.6)); snap = false;
    camPos.lerp(tmp, kp); camLook.lerp(tmpL, kl);
    camera.position.copy(camPos);
    if (shake > 0) camera.position.add(tmp.set(rand(-1, 1), rand(-1, 1), 0).multiplyScalar(shake * 0.35));
    if (race && !reduceMotion) {   // road rumble at speed
      const r = Math.max(0, spd - 0.45) * 0.07;
      camera.position.x += Math.sin(t * 37) * Math.sin(t * 13) * r; camera.position.y += Math.sin(t * 29 + 1) * Math.sin(t * 7) * r;
    }
    camera.lookAt(camLook);
    if (race && !reduceMotion) camera.rotateZ(-turn * 0.6);
    if (R.debug.camOverride) { const o = R.debug.camOverride; const g = P.m.grp; camera.position.copy(g.localToWorld(tmp.set(o[0], o[1], o[2]))); camera.lookAt(g.localToWorld(tmpL.set(o[3], o[4], o[5]))); }
    const fov = baseFov + spd * 9;
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
    R.world(P.dist + 6, lat * 0.5, focus);
  }

  // ---------- HUD ----------
  const elPos = $('pos'), elDist = $('dist'), elTime = $('time'), elKmh = $('kmh'), elStam = $('stam');
  function hud() {
    const rank = finishRank || 1 + carts.filter(c => c !== P && c.dist > P.dist).length;
    elPos.textContent = state === 'ready' || state === 'loading' ? '—' : ord(rank);
    elDist.textContent = Math.min(TRACK, Math.floor(P.dist));
    elTime.textContent = (P.fin !== null ? P.fin : raceT).toFixed(1);
    elKmh.textContent = Math.round(P.v * 3.6);
    elStam.style.width = P.stam.toFixed(0) + '%';
    elStam.style.background = P.stam > 55 ? '#7fa83a' : P.stam > 25 ? '#f3a312' : '#d63a1f';
    carts.forEach((c, i) => { dots[i].style.left = (clamp(c.dist / TRACK, 0, 1) * 100).toFixed(2) + '%'; });
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

  // ---------- atmosphere picker ----------
  let atmo = 'noon';
  try { const a = localStorage.getItem('rekla-atmo'); if (a && (R.PRESETS[a] || a === 'random')) atmo = a; } catch (e) {}
  function buildChips() {
    const wrap = $('atmo'); if (!wrap) return;
    const ids = [...R.PRESET_ORDER, 'random'];
    wrap.innerHTML = '';
    ids.forEach(id => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.id = id;
      b.textContent = id === 'random' ? 'Surprise me' : R.PRESETS[id].en;
      b.setAttribute('aria-pressed', String(id === atmo));
      b.addEventListener('click', () => {
        atmo = id; try { localStorage.setItem('rekla-atmo', id); } catch (e) {}
        wrap.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.id === id)));
        applyAtmo();
      });
      wrap.appendChild(b);
    });
  }
  function applyAtmo() {
    const id = atmo === 'random' ? R.PRESET_ORDER[(Math.random() * R.PRESET_ORDER.length) | 0] : atmo;
    R.Sky.apply(id);
    if (R.Weather) R.Weather.apply(R.PRESETS[id], id);
    if (R.Post) R.Post.apply(R.PRESETS[id]);
  }

  // ---------- frame loop ----------
  let last = performance.now(), frames = 0, acc = 0, slow = 0, fast = 0;
  R.stats = { fps: 0 };
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    R.U.time.value += dt;
    renderer.info.reset();
    update(dt);
    placeActors(dt);
    updateCamera(dt);
    R.Sky.update(camera, focus);
    R.updateScatters(P.dist);
    if (R.Weather) R.Weather.update(dt, camera, P, t);
    if (R.Crowd) R.Crowd.update(dt, carts, t);
    if (R.Audio) R.Audio.update(dt, { state, carts, P });
    if (R.World.update) R.World.update(dt, camera, t);
    if (R.Post && R.Post.enabled) R.Post.render(renderer, scene, camera, { speed: clamp(P.v / VMAX, 0, 1), dt });
    else renderer.render(scene, camera);
    hud();
    // adaptive resolution: hold a steady frame rate on phones
    frames++; acc += dt;
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
  async function build(data) {
    if (data && data.best > 0 && (best === null || data.best < best)) best = data.best;
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
      models = DEFS.map(d => R.Models.cart(d, scene));
      if (R.Crowd) R.Crowd.build(scene);
      if (R.Weather) R.Weather.build(scene, camera);
      if (R.Post) R.Post.init(renderer);
    });
    if (R.Audio) await step('Tuning the parai drums…', () => R.Audio.prepare());
    reset();
    buildChips(); applyAtmo();
    resize();
    new ResizeObserver(resize).observe(stage);
    state = 'ready';
    btn.disabled = false; btn.textContent = 'Start race';
    label.textContent = best ? 'Your best: ' + best.toFixed(1) + ' s · Keyboard: ← → steer, Space shout' : 'Keyboard: ← → to steer, Space to shout';
    requestAnimationFrame(t0 => { last = t0; requestAnimationFrame(frame); });
  }
  R.debug = { get state() { return state; }, get P() { return P; }, renderer, scene, camera, startRace, setAtmo: id => { atmo = id; applyAtmo(); }, jump: s => { if (P) { P.dist = s; snap = true; } }, skip: () => { countT = 0.01; }, get cam() { return camera.position; }, get cart() { return P && P.m.grp.position; } };
  try { if (window.claude && window.claude.hot && typeof window.claude.hot.snapshot === 'function') window.claude.hot.snapshot(() => ({ best })); } catch (e) {}
  window.claude?.hot?.ready ? window.claude.hot.ready(build) : build(window.claude?.hot?.data ?? {});
})();
