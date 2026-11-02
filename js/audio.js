/* Rekla Race · sound
   Every sound is synthesised in code (no audio files): galloping hooves and neck bells, the driver's
   "ஹை!" shout, whip cracks, a crowd that roars as you pass, parai drums at the festival grounds,
   crows and birdsong in the village, rain, wind and thunder. Positional: louder and panned by where
   it happens relative to the camera. */
(function () {
  'use strict';
  const R = window.R;
  const A = R.Audio = { ready: false, on: true };
  try { A.on = localStorage.getItem('rekla-sound') !== 'off'; } catch (e) {}
  const SR = 22050;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------- offline DSP helpers ----------
  function biquad(type, f, q) {
    let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const set = (freq, Q) => {
      const w = TAU * Math.min(freq, SR * 0.45) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * Q);
      let n0, n1, n2; const d0 = 1 + al;
      if (type === 'lp') { n0 = (1 - c) / 2; n1 = 1 - c; n2 = (1 - c) / 2; }
      else if (type === 'hp') { n0 = (1 + c) / 2; n1 = -(1 + c); n2 = (1 + c) / 2; }
      else { n0 = al; n1 = 0; n2 = -al; }
      b0 = n0 / d0; b1 = n1 / d0; b2 = n2 / d0; a1 = -2 * c / d0; a2 = (1 - al) / d0;
    };
    set(f, q);
    return { set, run(x) { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; } };
  }
  function norm(d, peak = 0.9) { let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / m; return d; }
  function gen(dur, fn, peak) { const n = Math.floor(dur * SR), d = new Float32Array(n); fn(d, n); return norm(d, peak); }
  function loop(dur, fn) {   // seamless loop by cross-fading the tail into the head
    const fade = Math.floor(0.25 * SR), n = Math.floor(dur * SR), d = new Float32Array(n + fade); fn(d, n + fade);
    for (let i = 0; i < fade; i++) { const t = i / fade; d[i] = d[i] * t + d[n + i] * (1 - t); }
    return norm(d.subarray(0, n), 0.8);
  }
  // voiced source through three formants with a vowel glide
  function voice(d, start, len, f0a, f0b, va, vb, amp, breath = 0.05) {
    const F = [biquad('bp', va[0], 6), biquad('bp', va[1], 8), biquad('bp', va[2], 10)];
    let ph = 0;
    for (let i = 0; i < len && start + i < d.length; i++) {
      const t = i / len;
      if (i % 32 === 0) { for (let k = 0; k < 3; k++) F[k].set(va[k] + (vb[k] - va[k]) * Math.min(1, t * 1.6), 6 + k * 2); }
      const f0 = f0a + (f0b - f0a) * t + Math.sin(i / SR * TAU * 5.5) * f0a * 0.015;
      ph += f0 / SR; ph -= Math.floor(ph);
      const src = (ph * 2 - 1) * 0.6 + (Math.random() * 2 - 1) * breath;
      const env = Math.min(1, t * 14) * Math.min(1, (1 - t) * 5);
      d[start + i] += (F[0].run(src) * 1.0 + F[1].run(src) * 0.7 + F[2].run(src) * 0.35) * env * amp;
    }
  }
  const V = { a: [800, 1250, 2600], i: [300, 2250, 3000], e: [480, 1850, 2600], o: [500, 900, 2400], u: [330, 850, 2300], ai: [720, 1300, 2600] };

  // ---------- original score ----------
  // An original melody (written for this game) in raga Mohanam (S R2 G3 P D2), played by a synthesised
  // nadaswaram-style reed over a sruti drone. 64 eighth-notes at 152 bpm, the same tempo as the parai,
  // so the drums and the tune stay locked together.
  const EIGHTH = 60 / 152 / 2;
  const TUNE = [
    [7, 1], [9, 1], [12, 2], [14, 1], [12, 1], [9, 2], [7, 2], [4, 1], [7, 1], [9, 4],
    [12, 1], [14, 1], [16, 2], [14, 1], [12, 1], [9, 2], [7, 1], [9, 1], [7, 1], [4, 1], [2, 4],
    [4, 1], [7, 1], [9, 2], [12, 2], [9, 1], [7, 1], [4, 2], [2, 1], [4, 1], [0, 4],
    [2, 1], [4, 1], [7, 2], [9, 1], [7, 1], [4, 2], [2, 2], [0, 1], [2, 1], [0, 4],
  ];
  function makeScore() {
    const tonic = 293.66, n = Math.round(64 * EIGHTH * SR), d = new Float32Array(n);
    const f1 = biquad('bp', 1150, 2.2), f2 = biquad('bp', 2600, 3.5), lp = biquad('lp', 4200, 0.7), dl = biquad('lp', 520, 0.7), br = biquad('bp', 1800, 1.2);
    let ph = 0, dp1 = 0, dp2 = 0, f = tonic * Math.pow(2, 7 / 12), idx = 0, noteStart = 0;
    const starts = []; let acc = 0; for (const [deg, len] of TUNE) { starts.push([acc, deg, len]); acc += len; }
    for (let i = 0; i < n; i++) {
      const t = i / SR, e8 = t / EIGHTH;
      while (idx < starts.length - 1 && e8 >= starts[idx + 1][0]) { idx++; noteStart = t; }
      const [, deg, len] = starts[idx], tn = t - noteStart, dur = len * EIGHTH;
      let target = tonic * Math.pow(2, deg / 12);
      if (len >= 2 && tn > dur * 0.45) target *= Math.pow(2, Math.sin((tn - dur * 0.45) * TAU * 6.5) * 0.55 / 12);   // kampita oscillation
      target *= 1 + Math.sin(t * TAU * 5.3) * 0.004;
      f += (target - f) * Math.min(1, 1 / (0.03 * SR));                                                          // gamaka glide
      ph += f / SR; ph -= Math.floor(ph);
      const reed = (ph * 2 - 1) * 0.6 + (ph < 0.32 ? 0.4 : -0.4);
      const env = (0.72 + 0.28 * Math.min(1, tn / 0.03)) * Math.min(1, (dur - tn) / 0.02 + 0.6);
      const breath = br.run(Math.random() * 2 - 1) * 0.05;
      const lead = lp.run(f1.run(reed) * 1.0 + f2.run(reed) * 0.55 + reed * 0.12 + breath) * env;
      dp1 += 146.83 / SR; dp2 += 220.0 / SR;
      const drone = dl.run(((dp1 % 1) * 2 - 1) * 0.5 + ((dp2 % 1) * 2 - 1) * 0.35) * (0.85 + 0.15 * Math.sin(t * TAU * 0.25));
      d[i] = lead * 0.9 + drone * 0.5;
    }
    const fade = Math.floor(0.01 * SR); for (let i = 0; i < fade; i++) { d[i] *= i / fade; d[n - 1 - i] *= i / fade; }
    return norm(d, 0.8);
  }

  // ---------- the sound bank ----------
  const S = {};
  A.prepare = function () {
    if (S.thud) return;
    S.thud = [0, 1, 2].map(v => gen(0.2, (d, n) => {
      const lp = biquad('lp', 380 + v * 60, 0.8); let ph = 0;
      for (let i = 0; i < n; i++) { const t = i / SR; const f = 48 + 46 * Math.exp(-t * 30); ph += f / SR;
        d[i] = Math.sin(ph * TAU) * Math.exp(-t * 26) + lp.run(Math.random() * 2 - 1) * Math.exp(-t * 48) * 0.7 + (i < 40 ? (Math.random() - 0.5) * 0.4 : 0); }
    }));
    S.crack = gen(0.32, (d, n) => {
      const hp = biquad('hp', 1800, 0.7);
      for (let i = 0; i < n; i++) { const t = i / SR; const e = Math.exp(-t * 160) + 0.35 * Math.exp(-Math.max(0, t - 0.055) * 120) * (t > 0.055 ? 1 : 0) + 0.12 * Math.exp(-Math.max(0, t - 0.13) * 60) * (t > 0.13 ? 1 : 0); d[i] = hp.run(Math.random() * 2 - 1) * e; }
    });
    S.hai = [1, 1.13].map(k => gen(0.62, (d, n) => {
      const hn = biquad('bp', 1400, 1.2);   // breathy "h"
      for (let i = 0; i < 0.07 * SR; i++) d[i] += hn.run(Math.random() * 2 - 1) * Math.min(1, i / 200) * 0.5;
      voice(d, Math.floor(0.05 * SR), Math.floor(0.5 * SR), 255 * k, 205 * k, V.a, V.i, 1.0, 0.08);
    }));
    S.rivalHai = gen(0.5, (d) => voice(d, 0, Math.floor(0.45 * SR), 210, 175, V.o, V.i, 1, 0.1));
    S.splash = gen(0.7, (d, n) => {
      const bp = biquad('bp', 1700, 0.9), lp = biquad('lp', 3000, 0.7);
      for (let i = 0; i < n; i++) { const t = i / SR; const bub = 0.7 + 0.3 * Math.sin(t * TAU * (30 + 60 * t)); d[i] = lp.run(bp.run(Math.random() * 2 - 1)) * Math.min(1, t * 200) * Math.exp(-t * 6.5) * bub; }
    });
    S.pothole = gen(0.5, (d, n) => {
      let ph = 0; const bp = biquad('bp', 900, 4);
      for (let i = 0; i < n; i++) { const t = i / SR; ph += (40 + 50 * Math.exp(-t * 20)) / SR; d[i] = Math.sin(ph * TAU) * Math.exp(-t * 12) * 1.2; }
      for (let k = 0; k < 6; k++) { const s0 = Math.floor((0.03 + k * 0.045 + Math.random() * 0.02) * SR); for (let i = 0; i < 260; i++) if (s0 + i < n) d[s0 + i] += bp.run(Math.random() * 2 - 1) * Math.exp(-i / 50) * (0.5 - k * 0.06); }
    });
    S.goat = gen(0.7, (d) => { voice(d, 0, Math.floor(0.22 * SR), 430, 400, V.e, V.e, 1, 0.15); voice(d, Math.floor(0.24 * SR), Math.floor(0.42 * SR), 470, 380, V.e, V.a, 1.1, 0.18);
      for (let i = 0; i < d.length; i++) d[i] *= 0.75 + 0.25 * Math.sin(i / SR * TAU * 11); });
    S.chime = gen(0.9, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.sin(t * TAU * 1047) * Math.exp(-t * 5) + 0.6 * Math.sin(t * TAU * 1568) * Math.exp(-Math.max(0, t - 0.09) * 5) * (t > 0.09 ? 1 : 0) + 0.4 * Math.sin(t * TAU * 2093) * Math.exp(-Math.max(0, t - 0.18) * 5) * (t > 0.18 ? 1 : 0)); } });
    S.bell = gen(0.45, (d, n) => { const P = [2340, 3130, 4470, 5210]; for (let i = 0; i < n; i++) { const t = i / SR; let s = 0; P.forEach((f, k) => { s += Math.sin(t * TAU * f * (1 + 0.003 * k)) * Math.exp(-t * (9 + k * 3)) / (k + 1); }); d[i] = s; } });
    S.beep = gen(0.2, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = Math.sin(t * TAU * 880) * Math.min(1, t * 300) * Math.min(1, (0.2 - t) * 40); } });
    S.go = gen(0.6, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.sin(t * TAU * 1320) + 0.5 * Math.sin(t * TAU * 660)) * Math.min(1, t * 300) * Math.exp(-t * 3.5); } });
    S.drumLo = gen(0.4, (d, n) => { let ph = 0; const bp = biquad('bp', 1300, 1.5); for (let i = 0; i < n; i++) { const t = i / SR; ph += (68 + 80 * Math.exp(-t * 25)) / SR; d[i] = Math.sin(ph * TAU) * Math.exp(-t * 11) + bp.run(Math.random() * 2 - 1) * Math.exp(-t * 70) * 1.4; } });
    S.drumHi = gen(0.18, (d, n) => { let ph = 0; const bp = biquad('bp', 2300, 1.8); for (let i = 0; i < n; i++) { const t = i / SR; ph += 330 / SR; d[i] = bp.run(Math.random() * 2 - 1) * Math.exp(-t * 55) * 1.6 + Math.sin(ph * TAU) * Math.exp(-t * 30) * 0.35; } });
    S.crow = gen(0.75, (d) => { for (let k = 0; k < 2; k++) voice(d, Math.floor(k * 0.36 * SR), Math.floor(0.26 * SR), 560, 470, V.a, V.o, 1, 0.35);
      for (let i = 0; i < d.length; i++) d[i] *= 0.6 + 0.4 * Math.sign(Math.sin(i / SR * TAU * 68)); });
    S.chirp = [0, 1, 2].map(v => gen(0.5, (d, n) => { const notes = 2 + v; for (let k = 0; k < notes; k++) { const s0 = Math.floor(k * 0.11 * SR), L = Math.floor(0.07 * SR), f0 = 3600 + v * 400 + Math.random() * 500; let ph = 0;
      for (let i = 0; i < L && s0 + i < n; i++) { const t = i / L; ph += (f0 + 900 * Math.sin(t * Math.PI)) / SR; d[s0 + i] += Math.sin(ph * TAU) * Math.sin(t * Math.PI); } } }));
    S.templeBell = gen(3.2, (d, n) => { const P = [[523, 1], [1251, 0.6], [1722, 0.45], [2330, 0.3], [2977, 0.2]]; for (let i = 0; i < n; i++) { const t = i / SR; let s = 0; P.forEach(([f, a], k) => { s += Math.sin(t * TAU * f) * a * Math.exp(-t * (0.9 + k * 0.6)); }); d[i] = s * Math.min(1, t * 400) * (1 + 0.1 * Math.sin(t * TAU * 3.5)); } });
    S.snort = gen(0.55, (d, n) => { const lp = biquad('lp', 650, 1.2); for (let i = 0; i < n; i++) { const t = i / SR; d[i] = lp.run(Math.random() * 2 - 1) * Math.min(1, t * 40) * Math.exp(-t * 6) * (0.7 + 0.3 * Math.sin(t * TAU * 22)); } });
    S.thunder = gen(5, (d, n) => { const lp = biquad('lp', 140, 0.7), lp2 = biquad('lp', 90, 0.7); let b = 0; for (let i = 0; i < n; i++) { const t = i / SR; b = (b + 0.04 * (Math.random() * 2 - 1)) / 1.04; d[i] = lp2.run(lp.run(b)) * Math.min(1, t * 6) * Math.exp(-t * 0.8) * (1 + 0.6 * Math.sin(t * 7) * Math.sin(t * 2.3)); } });
    S.whistle = gen(0.7, (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (2900 + 120 * Math.sin(t * TAU * 28)) / SR; d[i] = Math.sin(ph * TAU) * Math.min(1, t * 80) * Math.min(1, (0.7 - t) * 12) * (0.75 + 0.25 * Math.sign(Math.sin(t * TAU * 28))); } });
    S.score = makeScore();
    S.knock = gen(0.15, (d, n) => { const bp = biquad('bp', 700, 3); for (let i = 0; i < n; i++) { const t = i / SR; d[i] = bp.run(Math.random() * 2 - 1) * Math.exp(-t * 60); } });
    // loops
    S.rumble = loop(2.5, (d, n) => { const lp = biquad('lp', 230, 0.8); let b = 0; for (let i = 0; i < n; i++) { b = (b + 0.03 * (Math.random() * 2 - 1)) / 1.03; d[i] = lp.run(b) + (Math.random() < 0.0015 ? (Math.random() - 0.5) * 0.4 : 0); } });
    S.babble = loop(6, (d, n) => {
      const keys = ['a', 'e', 'o', 'i', 'u'];
      for (let g = 0; g < 110; g++) { const s0 = Math.floor(Math.random() * (n - 0.6 * SR)), L = Math.floor(rnd(0.12, 0.45) * SR), f0 = rnd(120, 300), v1 = V[keys[(Math.random() * 5) | 0]], v2 = V[keys[(Math.random() * 5) | 0]]; voice(d, s0, L, f0, f0 * rnd(0.85, 1.1), v1, v2, rnd(0.2, 0.6), 0.2); }
      const bp = biquad('bp', 900, 0.5); for (let i = 0; i < n; i++) d[i] += bp.run(Math.random() * 2 - 1) * 0.15;
    });
    S.cheer = loop(5, (d, n) => {
      for (let g = 0; g < 120; g++) { const s0 = Math.floor(Math.random() * (n - 0.8 * SR)), L = Math.floor(rnd(0.25, 0.7) * SR), f0 = rnd(180, 420); voice(d, s0, L, f0, f0 * rnd(1.0, 1.35), Math.random() < 0.5 ? V.e : V.o, V.e, rnd(0.3, 0.8), 0.3); }
      for (let w = 0; w < 6; w++) { const s0 = Math.floor(Math.random() * (n - 0.6 * SR)), L = Math.floor(0.45 * SR); let ph = 0; for (let i = 0; i < L; i++) { const t = i / L; ph += (2200 + 900 * Math.sin(t * Math.PI) + (t > 0.6 ? -800 * (t - 0.6) : 0)) / SR; d[s0 + i] += Math.sin(ph * TAU) * Math.sin(t * Math.PI) * 0.25; } }
      const bp = biquad('bp', 1200, 0.4); for (let i = 0; i < n; i++) d[i] += bp.run(Math.random() * 2 - 1) * 0.25;
    });
    S.rain = loop(3, (d, n) => { const hp = biquad('hp', 1400, 0.6), lp = biquad('lp', 7000, 0.6); for (let i = 0; i < n; i++) d[i] = lp.run(hp.run(Math.random() * 2 - 1)) * 0.6 + (Math.random() < 0.004 ? (Math.random() - 0.5) * 1.5 : 0); });
    S.wind = loop(5, (d, n) => { const bp = biquad('bp', 420, 0.8); let b = 0; for (let i = 0; i < n; i++) { const t = i / SR; b = (b + 0.05 * (Math.random() * 2 - 1)) / 1.05; d[i] = bp.run(b) * (0.6 + 0.4 * Math.sin(t * TAU * 0.4) * Math.sin(t * TAU * 0.17 + 1)); } });
  };

  // ---------- runtime ----------
  const B = {};
  let ctx = null, master, sfx, amb, comp;
  const loops = {};
  function toBuffer(arr) { const b = ctx.createBuffer(1, arr.length, SR); b.getChannelData(0).set(arr); return b; }
  // A tiny silent WAV: playing it through an <audio> element moves iOS into the "playback" audio
  // session, so the game is audible even with the ringer/silent switch on.
  function silentWav() {
    const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) b[o + i] = str.charCodeAt(i); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
    b.fill(128, 44);
    let bin = ''; for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
    return 'data:audio/wav;base64,' + btoa(bin);
  }
  let silentEl = null;
  function playbackSession() {
    try { if (navigator.audioSession) { navigator.audioSession.type = 'playback'; return; } } catch (e) {}
    try {
      if (!silentEl) { silentEl = document.createElement('audio'); silentEl.src = silentWav(); silentEl.loop = true; silentEl.setAttribute('playsinline', ''); silentEl.preload = 'auto'; }
      const p = silentEl.play(); if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }
  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { A.error = 'This browser has no Web Audio support.'; return false; }
    ctx = new AC();
    A.prepare();
    for (const k in S) B[k] = Array.isArray(S[k]) ? S[k].map(toBuffer) : toBuffer(S[k]);
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = A.on ? 0.9 : 0;
    sfx = ctx.createGain(); amb = ctx.createGain(); amb.gain.value = 0.8;
    sfx.connect(master); amb.connect(master); master.connect(comp); comp.connect(ctx.destination);
    for (const k of ['rumble', 'babble', 'cheer', 'rain', 'wind']) {
      const src = ctx.createBufferSource(); src.buffer = B[k]; src.loop = true;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(k === 'rumble' ? sfx : amb);
      src.start(0, Math.random() * 2); loops[k] = g;
    }
    A.ready = true; nextDrum = ctx.currentTime + 0.3;
    return true;
  }
  // Must run inside a real tap/click/key handler: browsers only let audio start from a user gesture.
  A.unlock = function () {
    if (!A.on) return;
    try {
      if (!ctx && !build()) return;
      playbackSession();
      if (ctx.state !== 'running') { const r = ctx.resume(); if (r && r.catch) r.catch(e => { A.error = String(e); }); }
      // the classic iOS unlock: start a one-sample buffer straight to the output during the gesture
      const one = ctx.createBufferSource(); one.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); one.connect(ctx.destination); one.start(0);
    } catch (e) { A.error = String(e && e.message || e); console.error('Rekla audio:', e); }
  };
  A.state = () => (ctx ? ctx.state : 'none');
  A.setOn = function (on) {
    A.on = on; try { localStorage.setItem('rekla-sound', on ? 'on' : 'off'); } catch (e) {}
    if (master) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.05);
    if (on) A.unlock(); else if (silentEl) silentEl.pause();
  };
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) { ctx.suspend(); if (silentEl) silentEl.pause(); } else if (A.on) ctx.resume(); });

  function play(name, o = {}) {
    if (!A.ready || !A.on) return;
    const buf = Array.isArray(B[name]) ? B[name][(Math.random() * B[name].length) | 0] : B[name];
    if (!buf) return;
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = o.rate || 1;
    const g = ctx.createGain(); g.gain.value = o.vol === undefined ? 1 : o.vol;
    src.connect(g);
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); g.connect(p); p.connect(o.amb ? amb : sfx); }
    else g.connect(o.amb ? amb : sfx);
    src.start(o.when || 0);
  }
  // loudness and stereo position of a world point as heard from the camera
  const T = R.T, _d = new T.Vector3(), _r = new T.Vector3();
  function spatial(pos, ref = 9) {
    const cam = R.camera; _d.copy(pos).sub(cam.position); const dist = _d.length();
    _r.set(1, 0, 0).applyQuaternion(cam.quaternion);
    return { vol: 1 / (1 + Math.pow(dist / ref, 1.4)), pan: dist > 0.01 ? _r.dot(_d) / dist * 0.85 : 0, dist };
  }

  // ---------- one-shot events from the game ----------
  A.event = function (type, c) {
    if (!A.ready) return;
    const sp = c && c.m ? spatial(c.m.grp.position) : { vol: 1, pan: 0 };
    switch (type) {
      case 'hai': play('hai', { vol: 0.95, rate: rnd(0.96, 1.04) }); break;
      case 'perfect': play('bell', { vol: 0.24, rate: 1.25 }); break;
      case 'off': play('knock', { vol: 0.18, rate: 0.8 }); break;
      case 'brace': play('beep', { vol: 0.35, rate: 1.35 }); break;
      case 'braced': play('knock', { vol: 0.4 }); play('snort', { vol: 0.3 }); break;
      case 'thrown': play('pothole', { vol: 0.95 }); play('snort', { vol: 0.5 }); swell = Math.max(swell, 0.9); break;
      case 'catch': play('chime', { vol: 0.5 }); swell = 1.7; break;
      case 'stumble': play('knock', { vol: 0.35, rate: 0.7 }); break;
      case 'bump': play('pothole', { vol: 0.7 * sp.vol + 0.2, rate: 1.3, pan: sp.pan }); play('knock', { vol: 0.6 * sp.vol + 0.2, pan: sp.pan }); break;
      case 'rivalThrown': if (sp.vol > 0.06) { play('pothole', { vol: 0.6 * sp.vol, pan: sp.pan }); swell = Math.max(swell, 0.7); } break;
      case 'foul': play('whistle', { vol: 0.5 }); break;
      case 'doordie': for (let k = 0; k < 12; k++) play(k % 3 ? 'drumHi' : 'drumLo', { vol: 0.45, amb: true, when: ctx.currentTime + k * 0.06 }); swell = Math.max(swell, 1); break;
      case 'rivalHai': if (sp.vol > 0.08) play('rivalHai', { vol: 0.55 * sp.vol, pan: sp.pan, rate: rnd(0.85, 1.2) }); break;
      case 'pothole': play('pothole', { vol: 0.9 * sp.vol + 0.1, pan: sp.pan }); break;
      case 'puddle': play('splash', { vol: 0.8 * sp.vol + 0.1, pan: sp.pan, rate: rnd(0.9, 1.1) }); break;
      case 'goat': play('goat', { vol: 0.7, rate: rnd(0.95, 1.1) }); play('pothole', { vol: 0.4 }); break;
      case 'goatNear': play('goat', { vol: 0.35 * sp.vol, pan: sp.pan, rate: rnd(0.9, 1.15) }); break;
      case 'cane': play('chime', { vol: 0.5 }); break;
      case 'blocked': play('knock', { vol: 0.4 }); break;
      case 'tired': play('snort', { vol: 0.6, rate: rnd(0.9, 1.05) }); break;
      case 'count': play('beep', { vol: 0.45 }); break;
      case 'go': play('go', { vol: 0.55 }); play('drumLo', { vol: 0.7 }); swell = 1.2; break;
      case 'finish':
        swell = 2.2; play('templeBell', { vol: 0.6, amb: true });
        for (let k = 0; k < 24; k++) play(k % 4 ? 'drumHi' : 'drumLo', { vol: 0.5, amb: true, when: ctx.currentTime + k * 0.07 });
        break;
    }
  };

  // ---------- continuous: hooves, bells, rumble, crowd, drums, weather, wildlife ----------
  let musicG = null, swell = 0, nextDrum = 0, drumStep = 0, nextBird = 2, nextCrow = 4, nextThunder = 15, nextTemple = 6, tAcc = 0;
  const prevStride = new Map();
  const PAT = [2, 0, 1, 1, 2, 0, 1, 0, 2, 1, 1, 0, 2, 0, 1, 1];   // parai: 2 = low stroke, 1 = slap
  A.update = function (dt, o) {
    if (!A.ready || !A.on) return;
    tAcc += dt;
    const now = ctx.currentTime, P = o.P, preset = R.Sky.p || {};
    const racing = o.state === 'race' || o.state === 'done' || o.state === 'count';
    // hooves: a three-beat gallop per bull, plus neck bells once a stride
    for (const c of o.carts) {
      if (!c.m || c.v < 0.8) { prevStride.set(c, c.step / Math.PI); continue; }
      const sp = spatial(c.m.grp.position);
      const near = c.player ? 1 : sp.vol;
      if (near < 0.05) { prevStride.set(c, c.step / Math.PI); continue; }
      const cur = c.step / Math.PI, prev = prevStride.has(c) ? prevStride.get(c) : cur;
      const offs = c.player ? [0, 0.13, 0.29, 0.5, 0.62, 0.79] : [0, 0.15, 0.32];
      const wet = R.U.wet.value;
      for (const off of offs) if (Math.floor(cur - off) > Math.floor(prev - off)) {
        play('thud', { vol: (c.player ? (off === 0 ? 0.6 : 0.36) : 0.5 * near) * (0.8 + Math.random() * 0.4), pan: c.player ? (off < 0.45 ? -0.15 : 0.15) : sp.pan, rate: rnd(0.88, 1.08) * (1 - wet * 0.12) });
        if (wet > 0.55 && Math.random() < 0.25) play('splash', { vol: 0.06 * near, rate: rnd(1.4, 1.8), pan: sp.pan });
      }
      if (Math.floor(cur) > Math.floor(prev) && near > 0.15) play('bell', { vol: c.player ? 0.15 : 0.09 * near, pan: sp.pan, rate: c.player ? 1 : rnd(0.95, 1.05) });
      prevStride.set(c, cur);
    }
    // wheel rumble on the player's cart
    const spd = P ? Math.min(1, P.v / 19) : 0;
    loops.rumble.gain.setTargetAtTime(racing ? spd * 0.32 * (1 - R.U.wet.value * 0.3) : 0, now, 0.15);
    // crowd: festival grounds and roadside knots; they roar as the carts go by
    const s = P ? P.dist : 0;
    const gap = (a, b) => Math.max(0, a - s, s - b);
    const fest = Math.max(1 / (1 + gap(-40, 64) / 35), 1 / (1 + gap(730, 842) / 35));
    swell = Math.max(0, swell - dt * 0.6);
    const roar = Math.min(1.3, fest * (racing ? 0.35 + spd * 0.9 : 0.12) + swell * 0.5);
    loops.babble.gain.setTargetAtTime(0.06 + fest * 0.32, now, 0.4);
    loops.cheer.gain.setTargetAtTime(roar * 0.42, now, 0.25);
    // parai drums at the festival grounds (scheduled slightly ahead for tight timing)
    const drumVol = fest * (racing ? 0.42 : 0.55);
    while (nextDrum < now + 0.15) {
      const step = PAT[drumStep % 16];
      if (step && drumVol > 0.03) play(step === 2 ? 'drumLo' : 'drumHi', { vol: drumVol * (drumStep % 4 === 0 ? 1 : 0.75), when: nextDrum, amb: true, rate: rnd(0.97, 1.03), pan: -0.25 });
      drumStep++; nextDrum += 60 / 152 / 2;
      if (nextDrum < now) nextDrum = now + 0.05;
    }
    // the score: start on a drum-pattern boundary so tune and parai stay in step
    if (!musicG && B.score) {
      musicG = ctx.createGain(); musicG.gain.value = 0; musicG.connect(amb);
      const stepDur = 60 / 152 / 2, k = (16 - (drumStep % 16)) % 16;
      const src = ctx.createBufferSource(); src.buffer = B.score; src.loop = true; src.connect(musicG); src.start(nextDrum + k * stepDur);
    }
    if (musicG) { const menu = o.state === 'ready' || o.state === 'end'; musicG.gain.setTargetAtTime(menu ? 0.3 : 0.1 + fest * 0.16, now, 0.8); }
    // weather
    loops.rain.gain.setTargetAtTime((preset.rain || 0) * 0.32, now, 0.6);
    loops.wind.gain.setTargetAtTime(0.03 + (preset.wind || 0.5) * 0.05 + (preset.rain || 0) * 0.08, now, 0.8);
    if (preset.rain && tAcc > nextThunder) { play('thunder', { vol: rnd(0.4, 0.8), amb: true, pan: rnd(-0.6, 0.6) }); nextThunder = tAcc + rnd(14, 30); }
    // wildlife and the village: birdsong, crows on the village street, the temple bell near the finish
    const calm = preset.rain ? 0 : 1;
    if (tAcc > nextBird) { if (calm) play('chirp', { vol: rnd(0.05, 0.12) * (preset === R.PRESETS.mist ? 1.6 : 1), amb: true, pan: rnd(-0.9, 0.9), rate: rnd(0.9, 1.15) }); nextBird = tAcc + rnd(1.5, 5) / (preset === R.PRESETS.mist ? 2 : 1); }
    if (tAcc > nextCrow) { const village = (s > 60 && s < 220) || s < 40; if (village || Math.random() < 0.3) play('crow', { vol: rnd(0.08, 0.16), amb: true, pan: rnd(-0.9, 0.9), rate: rnd(0.92, 1.08) }); nextCrow = tAcc + rnd(5, 11); }
    if (s > 690 && tAcc > nextTemple) { play('templeBell', { vol: 0.12 + 0.2 * Math.min(1, (s - 690) / 150), amb: true, pan: -0.3 }); nextTemple = tAcc + rnd(7, 12); }
  };
})();
