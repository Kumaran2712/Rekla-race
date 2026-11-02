/* Rekla Race · scenery (Phase 3)
   Tamil Nadu countryside laid out zone by zone along the course: paddy with canals and egrets,
   coconut groves, palmyra lines on field bunds, banana and sugarcane, village houses with tiled
   roofs and kolams, a tea shop, an Ayyanar shrine, a temple gopuram, power lines, parked vehicles. */
(function () {
  'use strict';
  const R = window.R, T = R.T;
  const { clamp, lerp, smooth, rand, pick, rng, noise2, fbm, col, mat, xf, paint, mergeGeos } = R;
  const RH = R.ROAD_HALF, E = R.EDGE;
  const S = R.Scenery = { mats: {}, tex: {} };
  const V3 = (x, y, z) => new T.Vector3(x, y, z);

  // ======================================================= textures
  function makeTextures() {
    const tx = S.tex;
    const strokeLeaf = (g, x0, y0, x1, y1, cx, cy, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke(); };
    tx.frond = R.canvasTex(512, 128, (g, w, h) => {
      g.lineCap = 'round';
      const cols = ['#4c7a24', '#5d8c2b', '#3f6b1e', '#6f9a33', '#557f26', '#7f9a3a'];
      for (let i = 0; i < 96; i++) {
        const t = i / 78, x = 12 + t * (w - 22);
        const L = h * 0.49 * (0.3 + 0.7 * Math.sin(Math.PI * (0.1 + 0.9 * t))) * (t > 0.92 ? (1 - t) * 12 : 1);
        for (const sd of [-1, 1]) {
          const a = 0.95 + Math.random() * 0.3, ex = x + L * 0.62 * Math.cos(a) + 5, ey = h / 2 + sd * L * Math.sin(a);
          strokeLeaf(g, x, h / 2, ex, ey, x + L * 0.3 * Math.cos(a), h / 2 + sd * L * 0.55 * Math.sin(a), 4.6 + Math.random() * 2.2, cols[(Math.random() * cols.length) | 0]);
        }
      }
      g.strokeStyle = '#9a8a45'; g.lineWidth = 4; g.beginPath(); g.moveTo(2, h / 2); g.lineTo(w - 6, h / 2); g.stroke();
    }, { bleed: [72, 110, 38] });
    tx.fan = R.canvasTex(256, 256, (g, w, h) => {
      const bx = w / 2, by = h - 6;
      for (let k = 0; k < 46; k++) {
        const a = Math.PI * (1.04 + 0.92 * k / 45), r0 = 18, r1 = 104 + Math.random() * 16;
        const ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
        g.fillStyle = ['#5b7a3a', '#4f6d33', '#68873f', '#566f36'][k % 4];
        g.beginPath();
        g.moveTo(bx + ca * r0, by + sa * r0);
        g.lineTo(bx + ca * r1 * 0.88 + px * 5, by + sa * r1 * 0.88 + py * 5);
        g.lineTo(bx + ca * r1, by + sa * r1);
        g.lineTo(bx + ca * r1 * 0.88 - px * 5, by + sa * r1 * 0.88 - py * 5);
        g.closePath(); g.fill();
      }
      g.fillStyle = '#6a7a3c'; g.beginPath(); g.arc(bx, by, 22, Math.PI, 0); g.fill();
    }, { bleed: [86, 112, 54] });
    tx.banana = R.canvasTex(128, 512, (g, w, h) => {
      const top = 8, base = 504, mid = w / 2;
      const grd = g.createLinearGradient(0, 0, w, 0);
      grd.addColorStop(0, '#4f8f28'); grd.addColorStop(0.5, '#6fae36'); grd.addColorStop(1, '#4a8826');
      g.fillStyle = grd; g.beginPath(); g.moveTo(mid, top);
      for (let y = top; y <= base; y += 4) { const t = (base - y) / (base - top); g.lineTo(mid + 58 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.04)), 0.55), y); }
      for (let y = base; y >= top; y -= 4) { const t = (base - y) / (base - top); g.lineTo(mid - 58 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.04)), 0.55), y); }
      g.fill();
      g.strokeStyle = 'rgba(40,80,20,.35)'; g.lineWidth = 1;
      for (let y = top + 10; y < base; y += 7) { g.beginPath(); g.moveTo(mid, y); g.lineTo(4, y - 18); g.moveTo(mid, y); g.lineTo(w - 4, y - 18); g.stroke(); }
      g.globalCompositeOperation = 'destination-out'; g.lineWidth = 2.2;
      for (let k = 0; k < 16; k++) { const y = top + 40 + Math.random() * (base - top - 80), sd = Math.random() < 0.5 ? -1 : 1; g.beginPath(); g.moveTo(mid + sd * 70, y - 16); g.lineTo(mid + sd * (6 + Math.random() * 20), y); g.stroke(); }
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = '#c9d78a'; g.lineWidth = 4; g.beginPath(); g.moveTo(mid, top); g.lineTo(mid, base); g.stroke();
      g.strokeStyle = 'rgba(140,110,50,.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(mid + 40, top + 30); g.lineTo(mid + 54, top + 120); g.stroke();
    }, { bleed: [90, 150, 50] });
    tx.leaves = R.canvasTex(256, 256, (g, w, h) => {
      const cols = ['#3d6b22', '#4f7d2a', '#2f5a1a', '#5b8a33', '#46752a'];
      for (let k = 0; k < 22; k++) {
        let x = 30 + Math.random() * (w - 60), y = 30 + Math.random() * (h - 60); const a = Math.random() * Math.PI * 2;
        for (let j = 0; j < 9; j++) {
          x += Math.cos(a) * 8; y += Math.sin(a) * 8;
          for (const sd of [-1, 1]) {
            g.save(); g.translate(x, y); g.rotate(a + sd * 0.9); g.fillStyle = cols[(Math.random() * cols.length) | 0];
            g.beginPath(); g.ellipse(9, 0, 10, 3.6, 0, 0, 7); g.fill(); g.restore();
          }
        }
      }
    }, { bleed: [62, 104, 36] });
    tx.grass = R.canvasTex(128, 128, (g, w, h) => {
      g.lineCap = 'round';
      const cols = ['#8f9a4a', '#6f8a35', '#a3a058', '#5f7f2f', '#7d903f'];
      for (let k = 0; k < 38; k++) {
        const x = 18 + Math.random() * 92, hh = 40 + Math.random() * 82, lean = (Math.random() - 0.5) * 60;
        strokeLeaf(g, x, h, x + lean, h - hh, x + lean * 0.2, h - hh * 0.6, 3 + Math.random() * 2, cols[(Math.random() * cols.length) | 0]);
      }
    }, { bleed: [120, 132, 64] });
    tx.paddy = R.canvasTex(128, 128, (g, w, h) => {
      g.lineCap = 'round';
      const cols = ['#6aa333', '#7fb83c', '#4f8a28', '#8cc04a', '#5d9a2e'];
      for (let k = 0; k < 46; k++) {
        const x = 52 + Math.random() * 24, hh = 70 + Math.random() * 55, lean = (Math.random() - 0.5) * 90;
        strokeLeaf(g, x, h, x + lean, h - hh, x + lean * 0.15, h - hh * 0.55, 3 + Math.random() * 1.5, cols[(Math.random() * cols.length) | 0]);
      }
    }, { bleed: [104, 160, 56] });
    tx.caneLeaf = R.canvasTex(64, 256, (g, w, h) => {
      const grd = g.createLinearGradient(0, h, 0, 0); grd.addColorStop(0, '#4f7d2a'); grd.addColorStop(0.8, '#6c9436'); grd.addColorStop(1, '#a3a04a');
      g.fillStyle = grd; g.beginPath(); g.moveTo(w / 2 - 9, h); g.quadraticCurveTo(w / 2 - 11, h * 0.4, w / 2, 2); g.quadraticCurveTo(w / 2 + 11, h * 0.4, w / 2 + 9, h); g.fill();
      g.strokeStyle = '#d4dca0'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, 6); g.stroke();
    }, { bleed: [86, 128, 48] });
    tx.caneWall = R.canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#2b3a17'; g.fillRect(0, h * 0.28, w, h);
      for (let k = 0; k < 46; k++) { const x = Math.random() * w; g.fillStyle = Math.random() < 0.5 ? '#5a3050' : '#6c7a34'; g.fillRect(x, h * 0.3, 3, h); for (let y = h * 0.35; y < h; y += 18) { g.fillStyle = '#3a2030'; g.fillRect(x - 1, y, 5, 2); } }
      g.lineCap = 'round';
      for (let k = 0; k < 160; k++) { const x = Math.random() * w, y = h * 0.15 + Math.random() * h * 0.7, a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, L = 30 + Math.random() * 50;
        strokeLeaf(g, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L + 20, x + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.6, 3, ['#4f7d2a', '#6c9436', '#3f6b20', '#8a9a40'][k % 4]); }
    }, { bleed: [60, 90, 36] });
    tx.caneTop = R.canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#3e6420'; g.fillRect(0, 0, w, h); g.lineCap = 'round';
      for (let k = 0; k < 420; k++) { const x = Math.random() * w, y = Math.random() * h, a = Math.random() * 6.3, L = 14 + Math.random() * 30;
        strokeLeaf(g, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, x + Math.cos(a + 0.4) * L * 0.5, y + Math.sin(a + 0.4) * L * 0.5, 3, ['#4f7d2a', '#6c9436', '#38601c', '#7d9a3a', '#9aa24c'][k % 5]); }
    }, { opaque: true });
    tx.tile = R.canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#4a2416'; g.fillRect(0, 0, w, h);
      const cw = w / 4, rh = h / 5;
      for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
        const x = c * cw + 2, y = r * rh + 2;
        const grd = g.createLinearGradient(x, 0, x + cw, 0);
        const base = ['#b8552f', '#c4643a', '#a94c2a', '#bf5e33'][(r * 4 + c) % 4];
        grd.addColorStop(0, '#7a3018'); grd.addColorStop(0.25, base); grd.addColorStop(0.6, base); grd.addColorStop(1, '#6f2a16');
        g.fillStyle = grd; g.beginPath(); g.roundRect ? g.roundRect(x, y, cw - 4, rh - 3, 5) : g.rect(x, y, cw - 4, rh - 3); g.fill();
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y + rh - 9, cw - 4, 6);
      }
      for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(${30 + Math.random() * 30},${30 + Math.random() * 20},20,${0.15 + Math.random() * 0.25})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 12, 0, 7); g.fill(); }
    }, { opaque: true });
    tx.plaster = (() => {
      const W = 256, d = new Uint8Array(W * W * 4);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
        const v = 0.86 + 0.1 * (fbm(x / 32, y / 32, 4, 8, 8) - 0.5) + 0.05 * (noise2(x / 2, y / 2, 128, 128) - 0.5) - 0.18 * Math.pow(1 - y / W, 6) * fbm(x / 10, 3, 2, 26, 0);
        const i = (y * W + x) * 4; d[i] = d[i + 1] = d[i + 2] = clamp(v, 0, 1) * 255; d[i + 3] = 255;
      }
      return R.dataTex(d, W, W, false);
    })();
    tx.stripe = R.canvasTex(64, 32, (g, w, h) => { g.fillStyle = '#efe8da'; g.fillRect(0, 0, w, h); g.fillStyle = '#b3301f'; g.fillRect(0, 0, w / 2, h); }, { opaque: true });
    tx.kolam = R.canvasTex(256, 256, (g, w, h) => {
      g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineWidth = 4; g.lineCap = 'round';
      const n = 5, sp = 40, o = (w - (n - 1) * sp) / 2;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const cx = o + i * sp, cy = o + j * sp; if (Math.abs(i - 2) + Math.abs(j - 2) > 3) continue; g.beginPath(); g.arc(cx, cy, 4, 0, 7); g.fill(); }
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const cx = o + i * sp, cy = o + j * sp; if (Math.abs(i - 2) + Math.abs(j - 2) > 3) continue;
        g.beginPath(); g.moveTo(cx - sp / 2, cy); g.quadraticCurveTo(cx, cy - sp * 0.75, cx + sp / 2, cy); g.quadraticCurveTo(cx, cy + sp * 0.75, cx - sp / 2, cy); g.stroke();
      }
      g.beginPath(); g.arc(w / 2, h / 2, 118, 0, 7); g.stroke();
    }, { bleed: [255, 255, 255] });
    // paddy field: seedlings in rows standing in muddy water
    tx.paddyField = (() => {
      const W = 512, d = new Uint8Array(W * W * 4), rg = new Uint8Array(W * W * 4);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const n = fbm(x / 64, y / 64, 4, 8, 8), hi = noise2(x / 3, y / 3, 171, 171);
        let r = 0.27 + 0.06 * n, g = 0.27 + 0.05 * n, b = 0.21 + 0.03 * n, rough = 0.1 + 0.08 * hi;
        // rows along v every 12 px, clumps every 10 px
        const rx = x % 12, ry = (y + ((x / 12) | 0) * 3) % 10;
        const dx = rx - 6 + (noise2(x / 12 | 0, y / 10 | 0) - 0.5) * 3, dy = ry - 5;
        const rr = 3.6 + 2.6 * fbm(x / 90, y / 90, 3, 5, 5);
        const dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < rr) {
          const k = 1 - dd / rr, gn = 0.75 + 0.5 * hi;
          r = lerp(r, 0.3 * gn, 0.9); g = lerp(g, 0.52 * gn, 0.9); b = lerp(b, 0.16 * gn, 0.9); rough = lerp(rough, 0.8, 0.95);
          r *= 0.8 + 0.3 * k; g *= 0.8 + 0.3 * k;
        }
        d[i] = clamp(r, 0, 1) * 255; d[i + 1] = clamp(g, 0, 1) * 255; d[i + 2] = clamp(b, 0, 1) * 255; d[i + 3] = 255;
        rg[i] = 0; rg[i + 1] = clamp(rough, 0, 1) * 255; rg[i + 2] = 0; rg[i + 3] = 255;
      }
      return { color: R.dataTex(d, W, W, true), rough: R.dataTex(rg, W, W, false) };
    })();
    // farm track: two ruts and a grassy hump
    tx.path = (() => {
      const W = 128, H = 512, d = new Uint8Array(W * H * 4);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const u = x / W, i = (y * W + x) * 4;
        const n = fbm(x / 16, y / 16, 4, 8, 32), hi = noise2(x / 2, y / 2, 64, 256);
        let r = 0.6 + 0.12 * n, g = 0.36 + 0.1 * n, b = 0.22 + 0.06 * n;
        const rut = Math.exp(-Math.pow((u - 0.3) / 0.06, 2)) + Math.exp(-Math.pow((u - 0.7) / 0.06, 2));
        r *= 1 - 0.15 * rut; g *= 1 - 0.15 * rut;
        const grass = smooth(0.06, 0.0, Math.abs(u - 0.5) - 0.06 + (n - 0.5) * 0.08) + smooth(0.14, 0.02, Math.min(u, 1 - u) + (n - 0.5) * 0.1);
        r = lerp(r, 0.42 * (0.8 + 0.4 * hi), clamp(grass, 0, 1)); g = lerp(g, 0.5 * (0.8 + 0.4 * hi), clamp(grass, 0, 1)); b = lerp(b, 0.22, clamp(grass, 0, 1));
        const k = 0.85 + 0.3 * hi;
        d[i] = clamp(r * k, 0, 1) * 255; d[i + 1] = clamp(g * k, 0, 1) * 255; d[i + 2] = clamp(b * k, 0, 1) * 255; d[i + 3] = 255;
      }
      return R.dataTex(d, W, H, true);
    })();
    tx.water = (() => {
      const W = 128, d = new Uint8Array(W * W * 4), h = new Float32Array(W * W);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) h[y * W + x] = fbm(x / 16, y / 8, 4, 8, 16);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
        const xl = (x + W - 1) % W, xr = (x + 1) % W, yd = (y + W - 1) % W, yu = (y + 1) % W;
        const dx = (h[y * W + xl] - h[y * W + xr]) * 3, dy = (h[yd * W + x] - h[yu * W + x]) * 3, l = Math.hypot(dx, dy, 1), i = (y * W + x) * 4;
        d[i] = (dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
      }
      return R.dataTex(d, W, W, false);
    })();
    const textTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = R.maxAniso; const p = () => { draw(c.getContext('2d'), w, h); t.needsUpdate = true; }; p(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(p); return t; };
    S.textTex = textTex;
    tx.teaSign = textTex(512, 160, (g, w, h) => {
      g.fillStyle = '#f2c230'; g.fillRect(0, 0, w, h); g.fillStyle = '#b3261e'; g.fillRect(0, h - 14, w, 14);
      g.fillStyle = '#7a1414'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = "800 74px 'Baloo Thambi 2', sans-serif"; g.fillText('டீ கடை', w / 2, h * 0.4);
      g.fillStyle = '#2b1a10'; g.font = "600 26px 'Mukta Malar', sans-serif"; g.fillText('சுக்கு காபி · வடை · பஜ்ஜி', w / 2, h * 0.78);
    });
    tx.busBoard = textTex(256, 64, (g, w, h) => { g.fillStyle = '#111'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd34a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = "700 38px 'Mukta Malar', sans-serif"; g.fillText('பழனி  ·  21', w / 2, h / 2 + 2); });
    tx.finish = textTex(1024, 128, (g, w, h) => {
      g.fillStyle = '#c8321c'; g.fillRect(0, 0, w, h); g.fillStyle = '#f3a312'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
      g.fillStyle = '#f7e9cc'; g.font = "800 72px 'Baloo Thambi 2', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('முடிவு  ·  FINISH', w / 2, h / 2 + 6);
    });
    tx.start = textTex(1024, 160, (g, w, h) => {
      g.fillStyle = '#1f4f8a'; g.fillRect(0, 0, w, h); g.fillStyle = '#f3a312'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
      g.fillStyle = '#fff3d6'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = "800 70px 'Baloo Thambi 2', sans-serif"; g.fillText('பொங்கல் ரேக்ளா பந்தயம்', w / 2, h * 0.42);
      g.font = "600 30px 'Mukta Malar', sans-serif"; g.fillStyle = '#ffd98a'; g.fillText('ஊர் பொதுமக்கள் சார்பாக  ·  தை 2027', w / 2, h * 0.8);
    });
  }

  // ======================================================= materials
  function makeMaterials() {
    const tx = S.tex, m = S.mats;
    const stdm = (o) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.9, metalness: 0 }, o));
    m.trunk = stdm({ vertexColors: true, roughness: 0.95 });
    m.frond = R.windify(stdm({ map: tx.frond, alphaTest: 0.5, side: T.DoubleSide, vertexColors: true, roughness: 0.75 }), 0.035, 0.11, 'frond');
    m.fan = R.windify(stdm({ map: tx.fan, alphaTest: 0.5, side: T.DoubleSide, vertexColors: true, roughness: 0.75 }), 0.02, 0.1, 'fan');
    m.banana = R.windify(stdm({ map: tx.banana, alphaTest: 0.5, side: T.DoubleSide, vertexColors: true, roughness: 0.6 }), 0.07, 0.45, 'banana');
    m.leaves = R.windify(stdm({ map: tx.leaves, alphaTest: 0.5, side: T.DoubleSide, vertexColors: true, roughness: 0.8 }), 0.03, 0.2, 'leaves');
    m.grass = R.windify(stdm({ map: tx.grass, alphaTest: 0.45, side: T.DoubleSide, vertexColors: true, roughness: 0.9 }), 0.12, 2.0, 'grass');
    m.paddy = R.windify(stdm({ map: tx.paddy, alphaTest: 0.45, side: T.DoubleSide, vertexColors: true, roughness: 0.8 }), 0.1, 1.8, 'paddy');
    m.caneLeaf = R.windify(stdm({ map: tx.caneLeaf, alphaTest: 0.5, side: T.DoubleSide, vertexColors: true, roughness: 0.75 }), 0.06, 0.4, 'cane');
    m.caneWall = stdm({ map: tx.caneWall, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.85 });
    m.caneTop = stdm({ map: tx.caneTop, roughness: 0.85 });
    m.paddyField = stdm({ map: tx.paddyField.color, roughnessMap: tx.paddyField.rough, roughness: 1, vertexColors: true });
    m.wall = stdm({ map: tx.plaster, vertexColors: true, roughness: 0.92 });
    m.roof = stdm({ map: tx.tile, vertexColors: true, roughness: 0.8, side: T.DoubleSide });
    m.stripe = stdm({ map: tx.stripe, roughness: 0.9 });
    m.brass = stdm({ color: col('#c9a03a'), roughness: 0.32, metalness: 0.9 });
    m.paint = stdm({ vertexColors: true, roughness: 0.5, metalness: 0.1 });
    m.rock = stdm({ vertexColors: true, roughness: 0.92, flatShading: true });
    m.kolam = stdm({ map: tx.kolam, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.9 });
    m.path = stdm({ map: tx.path, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 });
    m.water = stdm({ color: col('#3a524c'), roughness: 0.06, metalness: 0.0, normalMap: tx.water, normalScale: new T.Vector2(0.35, 0.35) });
    m.chalk = stdm({ color: col('#f4efe2'), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3 });
    m.wire = new T.LineBasicMaterial({ color: col('#2a2724') });
    m.sign = tex => stdm({ map: tex, roughness: 0.8, side: T.DoubleSide });
  }

  // ======================================================= geometry helpers
  function quad(a, b, c, d, uvs) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
    const u = uvs || [[0, 0], [1, 0], [1, 1], [0, 1]];
    g.setAttribute('uv', new T.Float32BufferAttribute([...u[0], ...u[1], ...u[2], ...u[0], ...u[2], ...u[3]], 2));
    g.computeVertexNormals();
    return g;
  }
  const box = (w, h, d, x, y, z, c, ry) => { const g = new T.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); return paint(g, c); };
  const cyl = (rt, rb, h, x, y, z, c, seg = 8) => { const g = new T.CylinderGeometry(rt, rb, h, seg); g.translate(x, y, z); return paint(g, c); };
  // vertical gradient tint for foliage (darker near the base = cheap ambient occlusion)
  const shadeY = (geo, y0, y1, lo = 0.55, hi = 1.0, tint) => paint(geo, null, (x, y) => { const k = lerp(lo, hi, clamp((y - y0) / (y1 - y0), 0, 1)); const c = tint ? tint.clone() : new T.Color(1, 1, 1); return c.multiplyScalar(k); });
  function bentStrip(L, Wd, segs, shape) { // a plane strip along +x, bent by shape(t, v) -> [x, y, z]
    const g = new T.PlaneGeometry(1, 1, segs, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = p.getX(i) + 0.5, v = p.getY(i);
      const q = shape(t, v, L, Wd); p.setXYZ(i, q[0], q[1], q[2]);
    }
    g.computeVertexNormals();
    return g;
  }

  // ======================================================= vegetation models
  function coconut(H, bend, fr, seed, cheap) {
    const r = R.mulberry32(seed);
    const segs = cheap ? 3 : 6, rad = cheap ? 5 : 7;
    const tr = new T.CylinderGeometry(1, 1, 1, rad, segs, true); tr.translate(0, 0.5, 0);
    const p = tr.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i));
      const rr = lerp(0.2, 0.13, t) + 0.1 * Math.pow(1 - t, 5);
      const off = Math.sin(t * Math.PI * 0.5) * bend;
      p.setXYZ(i, Math.cos(a) * rr + off, t * H, Math.sin(a) * rr);
    }
    tr.computeVertexNormals();
    paint(tr, null, (x, y) => { const ring = (y * 3.2) % 1 > 0.82 ? 0.78 : 1; const k = lerp(0.5, 0.95, Math.min(1, y / 3)) * ring; return col('#8c8172').multiplyScalar(k); });
    const top = V3(bend, H, 0);
    const parts = [tr];
    // nuts
    if (!cheap) { const n = new T.IcosahedronGeometry(0.36, 0); n.scale(1, 0.7, 1); n.translate(top.x, top.y - 0.35, top.z); parts.push(paint(n, '#6e7a2a')); }
    const trunk = mergeGeos(parts);
    const fronds = [];
    for (let k = 0; k < fr; k++) {
      const az = k / fr * Math.PI * 2 + r() * 0.4, up = k < 3 ? 0.9 + r() * 0.4 : -0.05 + r() * 0.55, L = 4.2 + r() * 0.9;
      const f = bentStrip(L, 1.4, cheap ? 3 : 8, (t, v) => { const droop = up > 0.8 ? 0.4 * t * t : 2.1 * t * t; return [t * L, (0.9 * t - droop) + Math.sin(up) * t * L * 0.5, v * 1.4 * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.15)))]; });
      const pf = f.attributes.position;
      for (let i = 0; i < pf.count; i++) { pf.setY(i, pf.getY(i) - Math.abs(pf.getZ(i)) * 0.4); }
      f.rotateY(-az); f.translate(top.x, top.y - 0.1, top.z);
      fronds.push(shadeY(f, top.y - 2.5, top.y + 1, 0.7, 1.05, col(k % 4 === 3 ? '#e4dc9a' : '#ffffff')));
    }
    return { trunk, crown: mergeGeos(fronds) };
  }
  function palmyra(H, seed, cheap) {
    const r = R.mulberry32(seed);
    const tr = new T.CylinderGeometry(1, 1, 1, cheap ? 5 : 8, cheap ? 3 : 8, true); tr.translate(0, 0.5, 0);
    const p = tr.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i)); const rr = 0.27 - 0.06 * t + 0.07 * Math.exp(-Math.pow((t - 0.9) / 0.06, 2)) + 0.08 * Math.pow(1 - t, 6); p.setXYZ(i, Math.cos(a) * rr, t * H, Math.sin(a) * rr); }
    tr.computeVertexNormals();
    paint(tr, null, (x, y) => col('#3e3a36').multiplyScalar(0.7 + 0.3 * noise2(y * 2, x * 4)));
    const parts = [tr], leaves = [];
    const top = V3(0, H, 0);
    for (let k = 0; k < (cheap ? 11 : 20); k++) {
      const dead = cheap ? k >= 9 : k >= 15;
      const az = r() * Math.PI * 2, el = dead ? -1.1 - r() * 0.3 : -0.4 + r() * 1.5, len = 1.0 + r() * 0.4;
      const dir = V3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
      const tip = top.clone().addScaledVector(dir, len);
      const st = new T.CylinderGeometry(0.03, 0.04, len, 4); st.translate(0, len / 2, 0);
      st.applyMatrix4(new T.Matrix4().lookAt(V3(0, 0, 0), dir, V3(0, 1, 0)).multiply(new T.Matrix4().makeRotationX(Math.PI / 2)));
      st.translate(top.x, top.y, top.z); if (!cheap) parts.push(paint(st, dead ? '#6a5a3a' : '#5d6a38'));
      const fan = new T.PlaneGeometry(1.9, 1.9, 2, 2); fan.translate(0, 0.9, 0);
      const fp = fan.attributes.position; for (let i = 0; i < fp.count; i++) fp.setZ(i, -Math.abs(fp.getX(i)) * 0.25);
      fan.computeVertexNormals();
      const m4 = new T.Matrix4().lookAt(V3(0, 0, 0), dir.clone().negate(), V3(0, 1, 0));
      fan.applyMatrix4(new T.Matrix4().makeRotationX(-Math.PI / 2 + (dead ? 0 : 0.4)));
      fan.applyMatrix4(m4);
      fan.translate(tip.x, tip.y, tip.z);
      leaves.push(paint(fan, dead ? '#9a7a4a' : '#ffffff'));
    }
    return { trunk: mergeGeos(parts), crown: mergeGeos(leaves) };
  }
  function banana(seed, bunch, cheap) {
    const r = R.mulberry32(seed);
    const H = 1.8 + r() * 0.8;
    const st = new T.CylinderGeometry(0.09, 0.14, H, cheap ? 4 : 7); st.translate(0, H / 2, 0);
    paint(st, null, (x, y) => col(y < 0.6 ? '#6b5a32' : '#6d8a3a').multiplyScalar(0.8 + 0.2 * noise2(y * 3, x * 9)));
    const parts = [st];
    if (bunch) {
      for (let k = 0; k < (cheap ? 0 : 7); k++) { const a = k * 2.4, y = H - 0.2 - k * 0.07; const b = new T.CylinderGeometry(0.05, 0.04, 0.24, 4); b.rotateZ(0.6); b.rotateY(a); b.translate(0.26 + Math.cos(a) * 0.12, y, Math.sin(a) * 0.12); parts.push(paint(b, '#7fa83a')); }
      const bud = new T.ConeGeometry(0.09, 0.3, 7); bud.rotateX(Math.PI); bud.translate(0.28, H - 0.95, 0); parts.push(paint(bud, '#6a1f3a'));
    }
    const leaves = [];
    const n = cheap ? 5 : 7 + ((r() * 3) | 0);
    for (let k = 0; k < n; k++) {
      const az = k / n * Math.PI * 2 + r() * 0.5, L = 2.1 + r() * 0.7, rise = 0.9 + r() * 0.6;
      const f = bentStrip(L, 0.7, cheap ? 3 : 6, (t, v) => [t * L * 0.9, H - 0.2 + rise * t - (rise + 0.6) * t * t * 1.2, v * 0.7 - Math.abs(v) * 0]);
      const fp = f.attributes.position; for (let i = 0; i < fp.count; i++) fp.setY(i, fp.getY(i) - Math.abs(fp.getZ(i)) * 0.35);
      f.computeVertexNormals();
      // UV: canvas is portrait (length along v) → swap
      const uv = f.attributes.uv; for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, v, u); }
      f.rotateY(-az);
      leaves.push(shadeY(f, H - 0.6, H + 1.2, 0.72, 1.05, col(k === n - 1 ? '#b8a560' : '#ffffff')));
    }
    return { stem: mergeGeos(parts), leaves: mergeGeos(leaves) };
  }
  function neem(seed, cards, cheap) {
    const r = R.mulberry32(seed);
    const parts = [];
    const H = 2.6 + r();
    const tr = new T.CylinderGeometry(0.22, 0.34, H, 7); tr.translate(0, H / 2, 0); parts.push(paint(tr, '#4f4033'));
    for (let k = 0; k < (cheap ? 0 : 4); k++) { const a = k * 1.7 + r(), L = 2 + r(); const b = new T.CylinderGeometry(0.08, 0.15, L, 5); b.translate(0, L / 2, 0); b.rotateZ(0.7); b.rotateY(a); b.translate(0, H - 0.2, 0); parts.push(paint(b, '#4a3c30')); }
    const cy = H + 2.0, rx = 3.3 + r() * 0.8, ry = 2.2 + r() * 0.5;
    const core = new T.IcosahedronGeometry(1, cheap ? 0 : 1); core.scale(rx * 0.78, ry * 0.75, rx * 0.78); core.translate(0, cy, 0);
    parts.push(paint(core, null, (x, y) => col('#2f4f1c').multiplyScalar(lerp(0.55, 1.0, clamp((y - cy + ry) / (2 * ry), 0, 1)))));
    const cl = [];
    for (let k = 0; k < cards; k++) {
      const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const n = V3(s * Math.cos(a), u * 0.9 + 0.1, s * Math.sin(a)).normalize();
      const pos = V3(n.x * rx * 0.85, cy + n.y * ry * 0.85, n.z * rx * 0.85);
      const q = new T.PlaneGeometry(2.2, 2.2);
      q.applyMatrix4(new T.Matrix4().makeRotationZ(r() * 6.28));
      q.applyMatrix4(new T.Matrix4().lookAt(V3(0, 0, 0), n.clone().negate(), V3(0, 1, 0)));
      q.translate(pos.x, pos.y, pos.z);
      const k2 = lerp(0.6, 1.08, clamp((pos.y - cy + ry) / (2 * ry), 0, 1));
      cl.push(paint(q, col('#ffffff').multiplyScalar(k2)));
    }
    return { wood: mergeGeos(parts), canopy: mergeGeos(cl) };
  }
  function tuft(w, h, n) {
    const parts = [];
    for (let k = 0; k < n; k++) { const q = new T.PlaneGeometry(w, h); q.translate(0, h / 2, 0); q.rotateY(k / n * Math.PI); parts.push(q); }
    return shadeY(mergeGeos(parts), 0, h, 0.68, 1.05);
  }
  function paddyPatch() {
    const parts = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (let k = 0; k < 2; k++) { const q = new T.PlaneGeometry(0.34, 0.62); q.translate(0, 0.31, 0); q.rotateY(k * Math.PI / 2 + i * 0.3); q.translate(i * 0.3 + j * 0.05, 0, j * 0.3); parts.push(q); }
    }
    return shadeY(mergeGeos(parts), 0, 0.62, 0.62, 1.1);
  }
  function caneClump(seed, cheap) {
    const r = R.mulberry32(seed);
    const st = [], lv = [];
    for (let k = 0; k < (cheap ? 3 : 5); k++) {
      const H = 2.5 + r() * 0.7, x = (r() - 0.5) * 0.4, z = (r() - 0.5) * 0.4, lean = (r() - 0.5) * 0.15;
      const c = new T.CylinderGeometry(0.022, 0.028, H, 5); c.translate(0, H / 2, 0); c.rotateZ(lean); c.translate(x, 0, z);
      st.push(paint(c, null, (xx, y) => col(y < 1.6 ? '#6a2e4c' : '#6f8a34').multiplyScalar((y * 4) % 1 > 0.9 ? 0.6 : 1)));
      for (let j = 0; j < (cheap ? 1 : 2); j++) {
        const a = r() * 6.28, y0 = H - 0.9 + j * 0.45, L = 1.5 + r() * 0.6;
        const f = bentStrip(L, 0.18, 4, (t, v) => [t * L * 0.75, y0 + 0.9 * t - 1.3 * t * t, v * 0.16]);
        const uv = f.attributes.uv; for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), vv = uv.getY(i); uv.setXY(i, vv, u); }
        f.rotateY(-a); f.translate(x, 0, z);
        lv.push(shadeY(f, 1.4, 3.2, 0.7, 1.05));
      }
    }
    return { stalks: mergeGeos(st), leaves: mergeGeos(lv) };
  }
  function rock(seed, sc, det = 1) {
    const r = R.mulberry32(seed);
    const g = new T.IcosahedronGeometry(1, det), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = V3(p.getX(i), p.getY(i), p.getZ(i)); const k = 0.75 + 0.5 * noise2(v.x * 1.7 + seed, v.z * 1.7 + v.y); p.setXYZ(i, v.x * k * sc[0], Math.max(v.y * k * sc[1], -0.3), v.z * k * sc[2]); }
    g.computeVertexNormals();
    return paint(g, null, (x, y) => col(r() < 0.15 ? '#7d8250' : '#9a948a').multiplyScalar(0.75 + 0.3 * noise2(x * 2, y * 2 + seed)));
  }
  function egret() {
    const p = [];
    const b = new T.SphereGeometry(0.16, 8, 6); b.scale(1, 0.9, 1.7); b.translate(0, 0.55, 0); p.push(paint(b, '#f4f2ec'));
    const n = new T.CylinderGeometry(0.035, 0.05, 0.32, 5); n.rotateX(0.4); n.translate(0, 0.78, -0.18); p.push(paint(n, '#f4f2ec'));
    const h = new T.SphereGeometry(0.06, 6, 5); h.translate(0, 0.94, -0.26); p.push(paint(h, '#f4f2ec'));
    const bk = new T.ConeGeometry(0.018, 0.14, 4); bk.rotateX(-Math.PI / 2); bk.translate(0, 0.93, -0.36); p.push(paint(bk, '#e2b034'));
    for (const s of [-1, 1]) { const l = new T.CylinderGeometry(0.01, 0.01, 0.42, 3); l.translate(s * 0.05, 0.22, 0.02); p.push(paint(l, '#2a2a20')); }
    return mergeGeos(p);
  }

  // ======================================================= structures (local: front faces +z, origin at front-centre on ground)
  const WALLS = ['#ece6d6', '#a9c7d8', '#e3a9a6', '#e8cf86', '#a8d1b5', '#b9acd0', '#e9e1cc', '#d8b07a'];
  const BANDS = ['#8f3b2b', '#c8752e', '#3e6f8a', '#4b7a4a', '#7a2e2e'];
  const DOORS = ['#3b2414', '#2b5d86', '#2c6a4a', '#5a2a1a'];
  function gableRoof(w, dp, y0, rh, o, zf) {
    const zc = zf - dp / 2, yt = y0 + rh, k = rh / (dp / 2), sl = Math.hypot(dp / 2 + o, rh + o * k);
    const L = -w / 2 - o, Rr = w / 2 + o;
    const front = quad([L, y0 - o * k, zf + o], [Rr, y0 - o * k, zf + o], [Rr, yt, zc], [L, yt, zc], [[L, 0], [Rr, 0], [Rr, sl], [L, sl]]);
    const back = quad([Rr, y0 - o * k, zf - dp - o], [L, y0 - o * k, zf - dp - o], [L, yt, zc], [Rr, yt, zc], [[Rr, 0], [L, 0], [L, sl], [Rr, sl]]);
    const ridge = new T.BoxGeometry(w + 2 * o, 0.12, 0.2); ridge.translate(0, yt + 0.04, zc);
    return { roof: [front, back], ridge, gable: [
      quad([-w / 2, y0, zf - dp], [-w / 2, y0, zf], [-w / 2, yt, zc], [-w / 2, yt, zc]),
      quad([w / 2, y0, zf], [w / 2, y0, zf - dp], [w / 2, yt, zc], [w / 2, yt, zc]),
    ] };
  }
  function tileHouse(r) {
    const w = 6 + r() * 3, dp = 5 + r() * 2, hgt = 2.7 + r() * 0.4, wc = WALLS[(r() * WALLS.length) | 0], band = BANDS[(r() * BANDS.length) | 0];
    const wall = [], roof = [];
    const pl = 0.55;
    wall.push(box(w + 0.8, pl, dp + 2.4, 0, pl / 2, -dp / 2 + 1.0, '#a69c8a'));
    wall.push(box(w + 0.82, 0.08, 2.0, 0, pl + 0.04, 1.2, '#7d2e22'));                  // red-oxide thinnai floor
    wall.push(box(w, hgt, dp, 0, pl + hgt / 2, -dp / 2, wc));
    wall.push(box(w + 0.02, 0.7, dp + 0.02, 0, pl + 0.35, -dp / 2, band));
    wall.push(box(1.0, 2.05, 0.08, 0, pl + 1.03, 0.02, DOORS[(r() * DOORS.length) | 0]));
    wall.push(box(1.25, 0.12, 0.12, 0, pl + 2.15, 0.06, '#e8e2d0'));
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 1.3);
      wall.push(box(0.95, 0.95, 0.06, x, pl + 1.45, 0.03, '#2f6f9a'));
      wall.push(box(0.75, 0.75, 0.07, x, pl + 1.45, 0.035, '#1b2226'));
      for (let b = -1; b <= 1; b++) wall.push(box(0.03, 0.75, 0.04, x + b * 0.2, pl + 1.45, 0.08, '#3a3a3a'));
    }
    const nP = 4;
    for (let i = 0; i < nP; i++) { const x = lerp(-w / 2 - 0.2, w / 2 + 0.2, i / (nP - 1)); wall.push(cyl(0.09, 0.11, 2.3, x, pl + 1.15, 2.0, r() < 0.5 ? '#4e3420' : '#2a6f7a', 8)); }
    // verandah lean-to (tiles)
    const vy0 = pl + hgt - 0.15, vy1 = pl + 2.35, vo = 2.4, sl = Math.hypot(vo, vy0 - vy1);
    roof.push(quad([-w / 2 - 0.5, vy1, vo], [w / 2 + 0.5, vy1, vo], [w / 2 + 0.5, vy0, 0], [-w / 2 - 0.5, vy0, 0], [[0, 0], [w + 1, 0], [w + 1, sl], [0, sl]]));
    const gr = gableRoof(w, dp, pl + hgt, 1.5 + r() * 0.4, 0.45, 0);
    roof.push(...gr.roof); wall.push(paint(gr.ridge, '#7a3a22')); gr.gable.forEach(g => wall.push(paint(g, wc)));
    roof.forEach(g => paint(g, col('#ffffff').multiplyScalar(0.85 + r() * 0.2)));
    return { wall, roof, w, kolam: 3.6 };
  }
  function flatHouse(r) {
    const w = 6 + r() * 3, dp = 6 + r() * 2, hgt = 3.1, wc = ['#e58fb0', '#7cc0d8', '#f1d36b', '#9ad18f', '#f4f0e6', '#c49be0'][(r() * 6) | 0];
    const wall = [];
    wall.push(box(w + 0.4, 0.45, dp + 0.4, 0, 0.22, -dp / 2, '#9a9284'));
    wall.push(box(w, hgt, dp, 0, 0.45 + hgt / 2, -dp / 2, wc));
    wall.push(box(w + 0.5, 0.18, dp + 0.5, 0, 0.45 + hgt + 0.09, -dp / 2, '#d8d2c4'));
    wall.push(box(w + 0.5, 0.6, 0.12, 0, 0.45 + hgt + 0.45, 0.19, wc));
    wall.push(box(0.12, 0.6, dp + 0.5, -w / 2 - 0.19, 0.45 + hgt + 0.45, -dp / 2, wc));
    wall.push(box(0.12, 0.6, dp + 0.5, w / 2 + 0.19, 0.45 + hgt + 0.45, -dp / 2, wc));
    wall.push(box(1.0, 2.1, 0.08, -w / 4, 0.45 + 1.05, 0.02, DOORS[(r() * 4) | 0]));
    wall.push(box(1.3, 1.0, 0.07, w / 4, 1.95, 0.03, '#1b2226'));
    wall.push(box(1.6, 0.06, 0.55, w / 4, 2.55, 0.27, '#d8d2c4'));               // chajja sunshade
    wall.push(box(1.4, 0.06, 0.5, -w / 4, 2.65, 0.25, '#d8d2c4'));
    const tank = cyl(0.55, 0.55, 1.1, w / 2 - 1.2, 0.45 + hgt + 0.18 + 0.55, -dp + 1.2, '#1e1e1e', 12); wall.push(tank);
    return { wall, roof: [], w, kolam: 2.2 };
  }
  function hut(r) {
    const wall = [], roof = [];
    const w = 4 + r() * 1.5, dp = 3.5 + r();
    wall.push(box(w, 2.0, dp, 0, 1.0, -dp / 2, '#b08a62'));
    wall.push(box(0.8, 1.6, 0.06, 0, 0.8, 0.02, '#3b2a1a'));
    const gr = gableRoof(w, dp, 2.0, 1.6, 0.6, 0);
    gr.roof.forEach(g => roof.push(paint(g, '#a08a58')));
    gr.gable.forEach(g => wall.push(paint(g, '#b08a62')));
    wall.push(paint(gr.ridge, '#6a5a3a'));
    return { wall, roof, w, thatch: true, kolam: 2.0 };
  }
  function teaShop() {
    const wall = [], extra = [];
    wall.push(box(4.2, 2.9, 3.2, 0, 1.45, -1.6, '#2f7fa5'));
    wall.push(box(4.21, 0.5, 3.21, 0, 0.25, -1.6, '#7a2e2e'));
    wall.push(box(1.0, 2.0, 0.06, 1.2, 1.0, 0.02, '#1b2226'));
    // tin awning on poles
    for (const x of [-2.2, 2.2]) wall.push(cyl(0.05, 0.05, 2.3, x, 1.15, 2.6, '#4a4a4a', 6));
    const aw = quad([-2.5, 2.3, 2.8], [2.5, 2.3, 2.8], [2.5, 2.85, 0], [-2.5, 2.85, 0]); wall.push(paint(aw, '#8a9aa0'));
    for (let k = 0; k < 8; k++) wall.push(box(0.04, 0.03, 2.85, -2.2 + k * 0.63, 2.6, 1.4, '#6a7a80'));
    wall.push(box(2.3, 0.95, 0.7, -0.8, 0.475, 1.0, '#6b4426'));                         // counter
    wall.push(box(2.4, 0.05, 0.8, -0.8, 0.97, 1.0, '#c9b38e'));
    for (let k = 0; k < 5; k++) wall.push(cyl(0.11, 0.11, 0.32, -1.7 + k * 0.32, 1.16, 0.85, ['#e6a23c', '#f1d36b', '#c8752e', '#e9e1cc', '#d9572e'][k], 10));
    for (let k = 0; k < 12; k++) { const a = k * 0.9; const b = new T.CylinderGeometry(0.035, 0.03, 0.2, 5); b.rotateZ(0.5 + (k % 3) * 0.2); b.rotateY(a); b.translate(1.6 + Math.cos(a) * 0.12, 2.05 - (k % 4) * 0.08, 1.6 + Math.sin(a) * 0.12); wall.push(paint(b, '#e8c84a')); }
    wall.push(cyl(0.01, 0.01, 0.4, 1.6, 2.4, 1.6, '#3a3a3a', 3));
    wall.push(box(2.6, 0.08, 0.45, 0.2, 0.48, 3.7, '#6b4426'));                          // bench
    for (const x of [-0.9, 1.3]) wall.push(box(0.08, 0.45, 0.4, x, 0.22, 3.7, '#4e3420'));
    for (let k = 0; k < 6; k++) wall.push(box(0.16, 0.24, 0.02, -2.0 + k * 0.28, 2.15, 2.72, ['#e94f37', '#3e8ed0', '#f6c90e', '#58b368', '#e94f37', '#9b5de5'][k]));
    const boiler = []; boiler.push(new T.CylinderGeometry(0.22, 0.24, 0.5, 14).translate(-0.4, 1.25, 1.05)); boiler.push(new T.ConeGeometry(0.22, 0.22, 14).translate(-0.4, 1.61, 1.05)); boiler.push(new T.CylinderGeometry(0.04, 0.04, 0.35, 8).translate(-0.4, 1.85, 1.05));
    extra.push({ geo: mergeGeos(boiler), mat: 'brass' });
    return { wall, roof: [], extra, sign: { w: 3.2, h: 1.0, y: 3.35, z: 0.05, tex: 'teaSign' } };
  }
  function shrine() {
    const wall = [], stripe = [], extra = [];
    wall.push(box(3.6, 0.5, 3.6, 0, 0.25, -1.8, '#9a9488'));
    const cella = new T.BoxGeometry(2.0, 1.9, 2.0); cella.translate(0, 0.5 + 0.95, -1.8);
    const uv = cella.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 4);
    stripe.push(cella);
    wall.push(box(0.7, 1.2, 0.05, 0, 1.1, -0.78, '#1d1410'));
    let y = 2.4;
    for (let k = 0; k < 3; k++) { const s = 2.2 - k * 0.5; wall.push(box(s, 0.5, s, 0, y + 0.25, -1.8, ['#e7d3a4', '#efe8da', '#e9b44c'][k])); y += 0.5; }
    const dome = new T.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2); dome.translate(0, y, -1.8); wall.push(paint(dome, '#efe8da'));
    extra.push({ geo: mergeGeos([new T.SphereGeometry(0.12, 8, 6).translate(0, y + 0.6, -1.8), new T.ConeGeometry(0.08, 0.3, 8).translate(0, y + 0.82, -1.8)]), mat: 'brass' });
    // trident
    wall.push(box(0.05, 1.8, 0.05, 1.3, 0.9 + 0.5, -0.3, '#4a4a4a'));
    wall.push(box(0.5, 0.05, 0.05, 1.3, 2.25, -0.3, '#4a4a4a'));
    for (const x of [-0.24, 0, 0.24]) wall.push(box(0.04, 0.3, 0.04, 1.3 + x, 2.4, -0.3, '#4a4a4a'));
    return { wall, stripe, extra };
  }
  function ayyanarHorse(r) {
    const p = [];
    const white = '#f1ece2', red = '#b3261e', yel = '#e9b42c', grn = '#2f7a4a';
    const body = new T.SphereGeometry(1, 14, 10); body.scale(0.55, 0.62, 1.25); body.translate(0, 2.0, 0); p.push(paint(body, white));
    const neck = new T.CylinderGeometry(0.32, 0.45, 1.3, 10); neck.rotateX(-0.6); neck.translate(0, 2.8, -0.95); p.push(paint(neck, white));
    const head = new T.BoxGeometry(0.42, 0.5, 0.9); head.rotateX(0.5); head.translate(0, 3.4, -1.45); p.push(paint(head, white));
    for (const s of [-1, 1]) { const ear = new T.ConeGeometry(0.08, 0.3, 5); ear.translate(s * 0.14, 3.75, -1.25); p.push(paint(ear, white)); const eye = new T.SphereGeometry(0.07, 6, 5); eye.translate(s * 0.22, 3.48, -1.55); p.push(paint(eye, '#141414')); }
    const mane = new T.BoxGeometry(0.12, 0.25, 1.2); mane.rotateX(-0.6); mane.translate(0, 3.05, -0.85); p.push(paint(mane, '#202020'));
    for (const [x, z] of [[-0.3, -0.75], [0.3, -0.75], [-0.3, 0.8], [0.3, 0.8]]) { const l = new T.CylinderGeometry(0.13, 0.11, 1.6, 8); l.translate(x, 0.8 + 0.4, z); p.push(paint(l, white)); const h = new T.CylinderGeometry(0.14, 0.15, 0.2, 8); h.translate(x, 0.5, z); p.push(paint(h, '#202020')); }
    const cloth = new T.BoxGeometry(1.2, 0.7, 1.3); cloth.translate(0, 2.25, 0.05); p.push(paint(cloth, red));
    const trim = new T.BoxGeometry(1.22, 0.12, 1.32); trim.translate(0, 1.92, 0.05); p.push(paint(trim, yel));
    const saddle = new T.BoxGeometry(0.7, 0.2, 0.8); saddle.translate(0, 2.68, 0.05); p.push(paint(saddle, grn));
    const band = new T.TorusGeometry(0.42, 0.06, 6, 14); band.rotateX(-0.6 + Math.PI / 2); band.translate(0, 2.7, -0.75); p.push(paint(band, yel));
    const tail = new T.CylinderGeometry(0.06, 0.1, 1.2, 6); tail.rotateX(0.5); tail.translate(0, 1.7, 1.3); p.push(paint(tail, '#202020'));
    const ped = new T.BoxGeometry(1.4, 0.4, 2.6); ped.translate(0, 0.2, 0); p.push(paint(ped, '#a69c8a'));
    return mergeGeos(p);
  }
  function gopuram() {
    const wall = [], extra = [];
    wall.push(box(13, 6.5, 7, 0, 3.25, -3.5, '#a39b8c'));
    for (let k = 0; k < 4; k++) wall.push(box(13.3, 0.18, 7.3, 0, 1.2 + k * 1.6, -3.5, '#8d8576'));
    wall.push(box(2.6, 4.8, 0.2, 0, 2.4, 0.02, '#2a1c14'));
    wall.push(box(3.2, 0.4, 0.3, 0, 5.0, 0.05, '#a39b8c'));
    const pal = ['#e7c46a', '#e98c7a', '#7fb3d8', '#9ccf8a', '#f0e2c0', '#d77a3a', '#c58fd0'];
    let y = 6.5;
    for (let i = 0; i < 7; i++) {
      const t = i / 6, wi = lerp(12, 5.0, t), di = lerp(6.2, 2.7, t), hi = 2.2;
      wall.push(box(wi, hi, di, 0, y + hi / 2, -3.5, pal[i % pal.length]));
      wall.push(box(wi + 0.6, 0.28, di + 0.6, 0, y + 0.14, -3.5, '#eee3c8'));
      const nf = Math.max(3, Math.floor(wi / 1.05));
      for (let f = 0; f < nf; f++) {
        const x = lerp(-wi / 2 + 0.55, wi / 2 - 0.55, f / (nf - 1)), c = pick(['#4a8fd0', '#e0525a', '#f2c94c', '#4fb06a', '#f4f0e6', '#d9772e', '#9a5fd0']);
        for (const zf of [-3.5 + di / 2 + 0.12, -3.5 - di / 2 - 0.12]) {
          wall.push(box(0.42, 1.1, 0.24, x, y + 0.95, zf, c));
          wall.push(box(0.55, 0.16, 0.3, x, y + 1.62, zf, '#f4ead2'));
        }
      }
      y += hi + 0.1;
    }
    const vault = new T.CylinderGeometry(1.25, 1.25, 6.0, 14); vault.rotateZ(Math.PI / 2); vault.translate(0, y + 0.1, -3.5); wall.push(paint(vault, '#e9a63c'));
    for (const s of [-1, 1]) { const end = new T.SphereGeometry(1.3, 10, 8, 0, Math.PI); end.rotateY(s * Math.PI / 2); end.translate(s * 3.0, y + 0.1, -3.5); wall.push(paint(end, '#e9a63c')); }
    const kal = [];
    for (let k = 0; k < 5; k++) { const x = -2.4 + k * 1.2; kal.push(new T.SphereGeometry(0.28, 10, 8).translate(x, y + 1.6, -3.5)); kal.push(new T.ConeGeometry(0.16, 0.6, 8).translate(x, y + 2.1, -3.5)); kal.push(new T.CylinderGeometry(0.2, 0.12, 0.25, 8).translate(x, y + 1.32, -3.5)); }
    extra.push({ geo: mergeGeos(kal), mat: 'brass' });
    return { wall, extra, top: y + 2.4 };
  }
  function bus() {
    const p = [];
    p.push(box(2.55, 1.0, 10.5, 0, 1.25, 0, '#7a1f2b'));
    p.push(box(2.56, 0.95, 10.5, 0, 2.22, 0, '#1b2a30'));
    p.push(box(2.55, 0.45, 10.5, 0, 2.92, 0, '#e8dcc2'));
    p.push(box(2.45, 0.12, 10.3, 0, 3.2, 0, '#d0c4aa'));
    for (let k = 0; k < 12; k++) p.push(box(2.6, 0.95, 0.08, 0, 2.22, -4.9 + k * 0.85, '#e8dcc2'));
    p.push(box(2.3, 1.0, 0.06, 0, 2.2, -5.27, '#22343c'));
    p.push(box(2.56, 0.3, 0.1, 0, 0.9, -5.27, '#c8b48a'));
    for (const z of [-3.7, 3.0, 4.1]) for (const s of [-1, 1]) { const w = new T.CylinderGeometry(0.5, 0.5, 0.32, 14); w.rotateZ(Math.PI / 2); w.translate(s * 1.12, 0.5, z); p.push(paint(w, '#1a1a1a')); }
    p.push(box(0.9, 1.9, 0.06, 1.28, 1.7, -4.2, '#2a1a12'));
    return mergeGeos(p);
  }
  function tractor() {
    const p = [];
    p.push(box(0.9, 0.8, 2.0, 0, 1.15, -0.9, '#b3261e'));
    p.push(box(1.1, 0.5, 0.9, 0, 1.0, 0.5, '#2a2a2a'));
    p.push(box(0.5, 0.12, 0.45, 0, 1.55, 0.6, '#1a1a1a'));
    p.push(cyl(0.04, 0.04, 0.9, 0.3, 1.9, -1.4, '#2a2a2a', 6));
    p.push(cyl(0.02, 0.02, 0.6, 0, 1.75, 0.0, '#2a2a2a', 4));
    for (const s of [-1, 1]) {
      const rw = new T.CylinderGeometry(0.75, 0.75, 0.42, 16); rw.rotateZ(Math.PI / 2); rw.translate(s * 0.85, 0.75, 0.55); p.push(paint(rw, '#1c1c1c'));
      const hub = new T.CylinderGeometry(0.35, 0.35, 0.44, 10); hub.rotateZ(Math.PI / 2); hub.translate(s * 0.86, 0.75, 0.55); p.push(paint(hub, '#e9b42c'));
      const fw = new T.CylinderGeometry(0.38, 0.38, 0.2, 12); fw.rotateZ(Math.PI / 2); fw.translate(s * 0.6, 0.38, -1.6); p.push(paint(fw, '#1c1c1c'));
    }
    // trailer of cut sugarcane
    p.push(box(1.9, 0.5, 3.6, 0, 0.95, 3.4, '#2f5d7a'));
    for (const s of [-1, 1]) { const w = new T.CylinderGeometry(0.42, 0.42, 0.25, 12); w.rotateZ(Math.PI / 2); w.translate(s * 1.0, 0.42, 3.4); p.push(paint(w, '#1c1c1c')); }
    for (let k = 0; k < 40; k++) { const c = new T.CylinderGeometry(0.03, 0.03, 4.0, 4); c.rotateX(Math.PI / 2 + (Math.random() - 0.5) * 0.1); c.translate(-0.8 + (k % 10) * 0.18, 1.3 + Math.floor(k / 10) * 0.07, 3.4); p.push(paint(c, k % 3 ? '#6a2e4c' : '#7a8a3a')); }
    return mergeGeos(p);
  }
  function pole() {
    const p = [];
    const sh = new T.CylinderGeometry(0.09, 0.15, 8.5, 6); sh.translate(0, 4.25, 0); p.push(paint(sh, '#a9a59c'));
    p.push(box(1.7, 0.1, 0.1, 0, 8.0, 0, '#5a5a5a'));
    for (const x of [-0.7, 0, 0.7]) p.push(cyl(0.04, 0.05, 0.16, x, 8.13, 0, '#e8e4dc', 6));
    return mergeGeos(p);
  }
  function pumpShed() {
    const p = [];
    p.push(box(2.6, 2.3, 2.4, 0, 1.15, -1.2, '#b9583a'));
    p.push(box(3.0, 0.08, 2.8, 0, 2.38, -1.2, '#8a9aa0'));
    p.push(box(0.8, 1.7, 0.06, -0.6, 0.85, 0.02, '#2b5d86'));
    const pipe = new T.CylinderGeometry(0.1, 0.1, 2.4, 8); pipe.rotateX(Math.PI / 2); pipe.translate(0.7, 0.8, 1.2); p.push(paint(pipe, '#3a3a3a'));
    p.push(box(1.4, 0.5, 1.2, 0.7, 0.25, 2.6, '#b8b2a4'));
    return mergeGeos(p);
  }
  function busShelter() {
    const p = [];
    p.push(box(4.4, 0.2, 2.4, 0, 0.1, -1.2, '#a69c8a'));
    p.push(box(4.4, 2.6, 0.15, 0, 1.4, -2.3, '#e8dcc2'));
    for (const x of [-2.1, 2.1]) p.push(box(0.15, 2.6, 2.3, x, 1.4, -1.2, '#e8dcc2'));
    p.push(box(4.8, 0.15, 2.8, 0, 2.75, -1.1, '#cfc7b4'));
    p.push(box(3.6, 0.08, 0.45, 0, 0.5, -1.9, '#6b4426'));
    p.push(box(4.4, 0.35, 0.05, 0, 2.5, 0.25, '#2f6b4a'));
    return mergeGeos(p);
  }
  function motorbike(c) {
    const p = [];
    for (const z of [-0.65, 0.65]) { const w = new T.TorusGeometry(0.3, 0.07, 6, 14); w.rotateY(Math.PI / 2); w.translate(0, 0.32, z); p.push(paint(w, '#141414')); }
    p.push(box(0.26, 0.32, 1.0, 0, 0.62, 0, c));
    p.push(box(0.28, 0.1, 0.6, 0, 0.84, 0.2, '#1a1a1a'));
    p.push(box(0.7, 0.04, 0.04, 0, 1.0, -0.55, '#3a3a3a'));
    p.push(cyl(0.025, 0.025, 0.5, 0, 0.75, -0.55, '#3a3a3a', 4));
    return mergeGeos(p);
  }

  // ======================================================= placement helpers
  const F = {};
  const _v = new T.Vector3();
  // world point at (s, d) with height on the terrain
  function at(s, d, dy = 0) {
    R.frame(s, F);
    const x = F.x + Math.cos(F.th) * d, z = F.z + Math.sin(F.th) * d;
    return { x, y: R.groundAt(x, z) + dy, z, th: F.th };
  }
  const faceRoad = (th, d) => d < 0 ? Math.PI / 2 - th : -Math.PI / 2 - th;
  const blocked = [];   // {x, z, r} keep-out circles (houses, paths)
  const isBlocked = (x, z, pad = 0) => blocked.some(b => (b.x - x) * (b.x - x) + (b.z - z) * (b.z - z) < (b.r + pad) * (b.r + pad));
  const block = (x, z, r) => blocked.push({ x, z, r });

  // ======================================================= build everything
  R.World.buildScenery = async function (scene, step) {
    const D = R.Q.density;
    await step('Painting leaves and tiles…', () => { makeTextures(); makeMaterials(); });
    const M = S.mats;
    const batch = new R.Batch(160);

    // ---------- scatter definitions ----------
    const LOD = R.Q.mobile ? 85 : 120;
    const coco = [1].map(v => { const a = coconut(10.5 + v * 2.5, 0.7 + v * 0.6, 13, 11 + v); const lo = coconut(10.5 + v * 2.5, 0.7 + v * 0.6, 7, 11 + v, true); return new R.Scatter([{ geo: a.trunk, mat: M.trunk, cast: true, lo: lo.trunk }, { geo: a.crown, mat: M.frond, cast: true, lo: lo.crown }], { chunk: 80, far: 1100, lod: LOD }); });
    const palm = [0].map(v => { const a = palmyra(12 + v * 3, 21 + v), lo = palmyra(12 + v * 3, 21 + v, true); return new R.Scatter([{ geo: a.trunk, mat: M.trunk, cast: true, lo: lo.trunk }, { geo: a.crown, mat: M.fan, cast: true, lo: lo.crown }], { chunk: 100, far: 1100, lod: LOD }); });
    const ban = [1].map(v => { const a = banana(31 + v, v === 1), lo = banana(31 + v, false, true); return new R.Scatter([{ geo: a.stem, mat: M.trunk, cast: true, lo: lo.stem }, { geo: a.leaves, mat: M.banana, cast: true, lo: lo.leaves }], { chunk: 40, far: 300, lod: 60 }); });
    const nm = [0].map(v => { const a = neem(41 + v, 46); const lo = neem(41 + v, 16, true); return new R.Scatter([{ geo: a.wood, mat: M.trunk, cast: true, lo: lo.wood }, { geo: a.canopy, mat: M.leaves, cast: true, lo: lo.canopy }], { chunk: 160, far: 1100, lod: LOD }); });
    const grass = new R.Scatter([{ geo: tuft(0.7, 0.55, 3), mat: M.grass }], { chunk: 60, far: R.Q.mobile ? 70 : 105 });
    const tall = new R.Scatter([{ geo: tuft(1.1, 1.0, 3), mat: M.grass, cast: true }], { chunk: 80, far: 180 });
    const pad = new R.Scatter([{ geo: paddyPatch(), mat: M.paddy }], { chunk: 50, far: R.Q.mobile ? 70 : 100 });
    const caneC = [0].map(v => { const a = caneClump(51 + v), lo = caneClump(51 + v, true); return new R.Scatter([{ geo: a.stalks, mat: M.trunk, lo: lo.stalks }, { geo: a.leaves, mat: M.caneLeaf, cast: true, lo: lo.leaves }], { chunk: 30, far: 170, lod: 45 }); });
    const rocks = [0, 1, 2].map(v => new R.Scatter([{ geo: rock(61 + v, v === 2 ? [1.6, 1.0, 1.3] : [1, 0.7, 0.9]), mat: M.rock, cast: true }], { chunk: 150, far: 900 }));
    const pebble = new R.Scatter([{ geo: rock(71, [0.12, 0.08, 0.1], 0), mat: M.rock }], { chunk: 40, far: R.Q.mobile ? 45 : 70 });
    const egrets = new R.Scatter([{ geo: egret(), mat: M.paint, cast: true }], { chunk: 100, far: 260 });

    const put = (sc, s, d, opts = {}) => {
      const p = at(s, d, opts.dy || 0);
      const yaw = opts.yaw !== undefined ? opts.yaw : rng() * 6.283;
      const sc0 = opts.scale || 1;
      sc.add(mat(p.x, p.y, p.z, yaw, opts.rx || 0, opts.rz || 0, sc0, sc0 * (opts.sy || 1), sc0), s, opts.color);
      return p;
    };
    const tint = (base, v) => col(base).multiplyScalar(1 - v / 2 + rng() * v);

    // ---------- farm paths (keep-out for crops) ----------
    const paths = [
      { s: 118, side: -1, ang: 0.35, len: 95, bend: 0.3 },
      { s: 252, side: 1, ang: 0.15, len: 120, bend: -0.25 },
      { s: 522, side: -1, ang: 0.4, len: 90, bend: 0.2 },
      { s: 612, side: 1, ang: 0.3, len: 80, bend: 0.4 },
      { s: 405, side: 1, ang: 0.0, len: 110, bend: 0.15 },
    ];
    await step('Cutting farm tracks…', () => {
      const pathGeos = [];
      for (const P of paths) {
        R.frame(P.s, F);
        const fwd = V3(Math.sin(F.th), 0, -Math.cos(F.th)), right = V3(Math.cos(F.th), 0, Math.sin(F.th));
        let dirv = right.clone().multiplyScalar(P.side).addScaledVector(fwd, P.ang).normalize();
        let pt = V3(F.x, 0, F.z).addScaledVector(right, P.side * (E - 0.6));
        const pts = [];
        for (let k = 0; k <= P.len / 2; k++) {
          pts.push(pt.clone());
          block(pt.x, pt.z, 2.6);
          dirv.applyAxisAngle(V3(0, 1, 0), P.bend * 0.02 * Math.sin(k * 0.08));
          pt.addScaledVector(dirv, 2);
        }
        const pos = [], uv = [], idx = [];
        let vAcc = 0;
        pts.forEach((q, i) => {
          const nx = i < pts.length - 1 ? pts[i + 1].clone().sub(q) : q.clone().sub(pts[i - 1]);
          nx.normalize();
          const side = V3(-nx.z, 0, nx.x);
          for (const k of [-1, 1]) {
            const x = q.x + side.x * 1.7 * k, z = q.z + side.z * 1.7 * k;
            pos.push(x, R.groundAt(x, z) + 0.06 + (i < 3 ? 0.04 : 0), z);
            uv.push(k < 0 ? 0 : 1, vAcc / 8);
          }
          vAcc += 2;
          if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        });
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
        // make sure normals point up (winding may flip with path direction)
        const n = g.attributes.normal; let up = 0; for (let i = 0; i < n.count; i++) up += n.getY(i);
        if (up < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
        pathGeos.push(g.toNonIndexed());
      }
      const m = new T.Mesh(mergeGeos(pathGeos), M.path); m.receiveShadow = true; scene.add(m);
    });

    // ---------- structures ----------
    const houses = [];
    const addHouse = (kind, s, d, seed) => {
      const r = R.mulberry32(seed);
      const h = kind === 'tile' ? tileHouse(r) : kind === 'flat' ? flatHouse(r) : hut(r);
      const p = at(s, d), yaw = faceRoad(p.th, d) + (r() - 0.5) * 0.12;
      const m4 = mat(p.x, p.y - 0.05, p.z, yaw);
      h.wall.forEach(g => batch.add(g, M.wall, m4, s));
      h.roof.forEach(g => batch.add(g, M.roof, m4, s));
      block(p.x, p.z, (h.w || 6) * 0.8 + 2);
      if (h.kolam && r() < 0.8) {
        const k = new T.PlaneGeometry(2.4, 2.4); k.rotateX(-Math.PI / 2); k.translate(0, 0.08, h.kolam + 0.8);
        batch.add(k, M.kolam, m4, s);
      }
      houses.push({ s, d });
    };
    const addPiece = (geo, material, s, d, yawOff = 0, dy = 0, scale = 1) => {
      const p = at(s, d, dy), m4 = mat(p.x, p.y, p.z, faceRoad(p.th, d) + yawOff, 0, 0, scale);
      batch.add(geo, material, m4, s); return { p, m4 };
    };
    const addBuilt = (b, s, d, yawOff = 0) => {
      const p = at(s, d), m4 = mat(p.x, p.y - 0.05, p.z, faceRoad(p.th, d) + yawOff);
      (b.wall || []).forEach(g => batch.add(g, M.wall, m4, s));
      (b.roof || []).forEach(g => batch.add(g, M.roof, m4, s));
      (b.stripe || []).forEach(g => batch.add(g, M.stripe, m4, s));
      (b.extra || []).forEach(e => batch.add(e.geo, M[e.mat], m4, s));
      if (b.sign) {
        const sm = new T.Mesh(new T.PlaneGeometry(b.sign.w, b.sign.h), M.sign(S.tex[b.sign.tex]));
        sm.position.set(0, b.sign.y, b.sign.z + 0.1); const g = new T.Group(); g.add(sm); g.applyMatrix4(m4); scene.add(g); sm.castShadow = true;
      }
      block(p.x, p.z, 6);
      return { p, m4 };
    };

    await step('Building the village…', () => {
      // festival ground at the start: houses ring the maidan
      let seed = 100;
      for (const side of [-1, 1]) for (let s = -150; s < 40; s += 17 + rng() * 8) addHouse(rng() < 0.6 ? 'tile' : 'flat', s, side * (40 + rng() * 14), seed++);
      // village street: frontage on both sides
      for (const side of [-1, 1]) for (let s = 74; s < 206; s += 13 + rng() * 6) {
        if (side < 0 && Math.abs(s - 112) < 9) continue;          // tea shop plot
        if (side > 0 && (Math.abs(s - 172) < 14 || Math.abs(s - 198) < 9)) continue; // shrine, bus stop
        if (side < 0 && Math.abs(s - 118) < 5) continue;          // farm path
        addHouse(rng() < 0.62 ? 'tile' : 'flat', s, side * (12.2 + rng() * 2.2), seed++);
        if (rng() < 0.55) addHouse(rng() < 0.5 ? 'tile' : 'hut', s + rng() * 6, side * (30 + rng() * 12), seed++);
      }
      addBuilt(teaShop(), 111, -11.6);
      addBuilt(shrine(), 168, 15.5);
      const horse = ayyanarHorse(rng);
      addPiece(horse, M.paint, 177, 16.5, 0.35); addPiece(horse, M.paint, 181, 15.2, 0.15, 0, 0.85);
      block(at(179, 16).x, at(179, 16).z, 5);
      const bsP = at(199, 12.2); batch.add(busShelter(), M.paint, mat(bsP.x, bsP.y, bsP.z, faceRoad(bsP.th, 12.2)), 199); block(bsP.x, bsP.z, 4);
      const busP = at(190, 9.4, 0); batch.add(bus(), M.paint, mat(busP.x, busP.y, busP.z, -busP.th), 190);
      // farmhouses scattered in the fields and foothills
      for (const [s, d] of [[240, -95], [300, 105], [330, -70], [420, 120], [470, -110], [560, 95], [650, -85], [700, 70]]) addHouse('hut', s, d, seed++);
      // temple ground at the finish
      for (const side of [-1, 1]) for (let s = 760; s < 1000; s += 18 + rng() * 8) addHouse(rng() < 0.6 ? 'tile' : 'flat', s, side * (44 + rng() * 14), seed++);
      const gp = gopuram();
      const gpos = at(915, -4);
      const gm = mat(gpos.x, gpos.y - 0.1, gpos.z, -gpos.th);
      gp.wall.forEach(g => batch.add(g, M.wall, gm, 915));
      gp.extra.forEach(e => batch.add(e.geo, M[e.mat], gm, 915));
      for (const sx of [-1, 1]) {
        const w = new T.BoxGeometry(34, 3.6, 0.9); const uv = w.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 34 / 0.9);
        w.translate(sx * (6.5 + 17), 1.8, -3.5); batch.add(w, M.stripe, gm, 915);
        batch.add(box(34.2, 0.25, 1.1, sx * 23.5, 3.72, -3.5, '#efe8da'), M.wall, gm, 915);
      }
      block(gpos.x, gpos.z, 14);
      // golden flag mast before the gopuram
      const fm = at(895, -4);
      batch.add(mergeGeos([new T.CylinderGeometry(0.16, 0.24, 10, 10).translate(0, 5.6, 0), new T.BoxGeometry(1.2, 0.12, 0.12).translate(0, 9.6, 0), new T.BoxGeometry(1.2, 0.12, 0.12).translate(0, 9.9, 0)]), M.brass, mat(fm.x, fm.y, fm.z, -fm.th), 895);
      batch.add(box(1.6, 0.7, 1.6, 0, 0.35, 0, '#a39b8c'), M.wall, mat(fm.x, fm.y, fm.z, -fm.th), 895);
      // a small hillock shrine in the foothills
      addBuilt(shrine(), 690, -34, 0.3);
      // pump shed beside the canal
      const ps = at(288, 17.5); batch.add(pumpShed(), M.wall, mat(ps.x, ps.y, ps.z, faceRoad(ps.th, 17.5)), 288); block(ps.x, ps.z, 4);
      // tractor with a load of cut cane, parked on the farm track
      const tp = at(530, -15); batch.add(tractor(), M.paint, mat(tp.x, tp.y, tp.z, -tp.th + 1.2), 530);
      const tp2 = at(96, -9.8); batch.add(tractor(), M.paint, mat(tp2.x, tp2.y, tp2.z, -tp2.th + 0.15), 96);
      // motorbikes parked at the festival ground
      const bikeCols = ['#1f3f8a', '#b3261e', '#1a1a1a', '#c0c0c0', '#2f6b4a'];
      for (let k = 0; k < 7; k++) { const s = -30 + k * 4.5, d = -(R.EDGE + 5 + rng() * 2); const p = at(s, d); batch.add(motorbike(bikeCols[k % 5]), M.paint, mat(p.x, p.y, p.z, -p.th + 1.3 + rng() * 0.3), s); }
    });

    // ---------- power line along the right side ----------
    await step('Stringing the power line…', () => {
      const pg = pole(), tops = [];
      for (let s = -60; s < 900; s += 36) {
        const d = (s > 60 && s < 740) ? 10.6 : 17;
        if (isBlocked(at(s, d).x, at(s, d).z, -1)) continue;
        const p = at(s, d), yaw = -p.th;
        batch.add(pg, M.wall, mat(p.x, p.y, p.z, yaw), s);
        const right = V3(Math.cos(p.th), 0, Math.sin(p.th));
        tops.push([-0.7, 0, 0.7].map(o => V3(p.x + right.x * o, p.y + 8.2, p.z + right.z * o)));
      }
      const seg = [];
      for (let i = 0; i < tops.length - 1; i++) for (let w = 0; w < 3; w++) {
        const a = tops[i][w], b = tops[i + 1][w];
        for (let k = 0; k < 10; k++) {
          const t0 = k / 10, t1 = (k + 1) / 10;
          const p0 = a.clone().lerp(b, t0), p1 = a.clone().lerp(b, t1);
          p0.y -= Math.sin(Math.PI * t0) * 0.7; p1.y -= Math.sin(Math.PI * t1) * 0.7;
          seg.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
        }
      }
      const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(seg, 3));
      scene.add(new T.LineSegments(lg, M.wire));
      // transformer on the village pole
      const tpz = at(144, 10.6);
      batch.add(mergeGeos([box(0.9, 1.0, 0.7, 0, 5.2, 0.4, '#8a8f88'), box(1.8, 0.12, 0.9, 0, 4.6, 0.3, '#5a5a5a'), cyl(0.05, 0.05, 0.5, -0.25, 5.9, 0.4, '#d8d4cc', 6), cyl(0.05, 0.05, 0.5, 0.25, 5.9, 0.4, '#d8d4cc', 6)]), M.paint, mat(tpz.x, tpz.y, tpz.z, -tpz.th), 144);
    });

    // ---------- fields ----------
    await step('Planting paddy and cane…', () => {
      const fieldGeo = (s0, s1, d0, d1, dy, colr) => {
        const ns = Math.max(2, Math.ceil((s1 - s0) / 5)), nd = Math.max(2, Math.ceil(Math.abs(d1 - d0) / 5));
        const pos = [], uv = [], cl = [], idx = [];
        for (let i = 0; i <= ns; i++) for (let j = 0; j <= nd; j++) {
          const s = lerp(s0, s1, i / ns), d = lerp(d0, d1, j / nd);
          R.frame(s, F); const x = F.x + Math.cos(F.th) * d, z = F.z + Math.sin(F.th) * d;
          pos.push(x, R.groundAt(x, z) + dy, z); uv.push(d / 6, s / 6); cl.push(colr.r, colr.g, colr.b);
        }
        for (let i = 0; i < ns; i++) for (let j = 0; j < nd; j++) { const a = i * (nd + 1) + j, b = a + 1, c = a + nd + 1, e = c + 1; idx.push(a, b, c, b, e, c); }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(cl, 3));
        g.setIndex(idx); g.computeVertexNormals();
        const n = g.attributes.normal; if (n.getY(0) < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
        return g;
      };
      const bundGeos = [];
      const bund = (s0, s1, d0, d1) => {  // outline ridge of a parcel
        const edges = [[s0, d0, s1, d0], [s1, d0, s1, d1], [s1, d1, s0, d1], [s0, d1, s0, d0]];
        for (const [sa, da, sb, db] of edges) {
          const n = Math.max(2, Math.ceil(Math.hypot(sb - sa, db - da) / 4));
          for (let k = 0; k < n; k++) {
            const a = at(lerp(sa, sb, k / n), lerp(da, db, k / n)), b = at(lerp(sa, sb, (k + 1) / n), lerp(da, db, (k + 1) / n));
            const L = Math.hypot(b.x - a.x, b.z - a.z), g = new T.BoxGeometry(0.55, 0.35, L + 0.3);
            g.rotateY(Math.atan2(b.x - a.x, b.z - a.z)); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.05, (a.z + b.z) / 2);
            bundGeos.push(paint(g, null, (x, y) => col(y > (a.y + 0.15) ? '#6f7a3a' : '#7a5a3a')));
          }
        }
      };
      // paddy: both sides, parcels separated by bunds; near-road rows get real 3D seedlings
      const paddyCols = [col('#ffffff'), col('#e8f0d8'), col('#d8e8c0'), col('#f0e8d8')];
      for (const side of [-1, 1]) {
        let s = 214;
        while (s < 362) {
          const len = 26 + rng() * 18, s1 = Math.min(362, s + len);
          let d = side > 0 ? 12.2 : 11.0;
          while (d < 125) {
            const dep = 22 + rng() * 16, d1 = Math.min(125, d + dep);
            const dd0 = side * d, dd1 = side * d1;
            const g = fieldGeo(s + 0.35, s1 - 0.35, dd0 + side * 0.35, dd1 - side * 0.35, 0.03, pick(paddyCols));
            batch.add(g, M.paddyField, null, (s + s1) / 2);
            bund(s, s1, dd0, dd1);
            if (d < 15) {
              for (let ss = s + 0.9; ss < s1 - 0.9; ss += 0.95 / Math.sqrt(D)) for (let k = 0; k < 7; k++) {
                const dl = side * (d + 0.9 + k * 0.95);
                put(pad, ss + rand(-0.15, 0.15), dl, { yaw: rand(-0.3, 0.3), scale: 0.85 + rng() * 0.35, color: tint('#f2ffd8', 0.2) });
              }
            }
            // egrets wading
            if (rng() < 0.55) for (let k = 0; k < 2 + rng() * 4; k++) put(egrets, rand(s + 2, s1 - 2), side * rand(d + 3, d1 - 3), { dy: 0.02, scale: 0.9 + rng() * 0.2 });
            d = d1;
          }
          s = s1;
        }
      }
      // palmyra lines along chosen bunds, and a distant coconut belt framing the horizon
      for (const [d, s0, s1] of [[-48, 214, 362], [62, 214, 340], [-100, 230, 360], [96, 260, 360]]) for (let s = s0; s < s1; s += 9 + rng() * 5) put(palm[0], s, d + rand(-1, 1), { scale: 0.9 + rng() * 0.25 });
      for (const side of [-1, 1]) for (let s = 200; s < 375; s += 7 + rng() * 6) put(coco[0], s, side * rand(128, 175), { scale: 0.9 + rng() * 0.3 });
      // concrete-lined irrigation canal on the right, with flowing water
      {
        const wl = [], wtr = [];
        let prev = null;
        for (let s = 212; s <= 362; s += 2) {
          const a = at(s, 9.6), b = at(s, 11.4);
          if (prev) {
            const ya = Math.min(a.y, b.y, prev.a.y, prev.b.y);
            wtr.push(quad([prev.a.x, ya + 0.05, prev.a.z], [a.x, ya + 0.05, a.z], [b.x, ya + 0.05, b.z], [prev.b.x, ya + 0.05, prev.b.z], [[0, (s - 2) / 6], [0, s / 6], [0.3, s / 6], [0.3, (s - 2) / 6]]));
            for (const [p0, p1] of [[prev.a, a], [prev.b, b]]) {
              const L = Math.hypot(p1.x - p0.x, p1.z - p0.z), g = new T.BoxGeometry(0.22, 0.55, L + 0.02);
              g.rotateY(Math.atan2(p1.x - p0.x, p1.z - p0.z)); g.translate((p0.x + p1.x) / 2, ya + 0.12, (p0.z + p1.z) / 2);
              wl.push(paint(g, '#aaa497'));
            }
          }
          prev = { a, b };
        }
        batch.add(mergeGeos(wl), M.wall, null, 290);
        const wm = new T.Mesh(mergeGeos(wtr), M.water); wm.receiveShadow = true; scene.add(wm);
        S.waterMat = M.water;
        // make sure water faces up
        const nn = wm.geometry.attributes.normal; if (nn.getY(0) < 0) M.water.side = T.DoubleSide;
      }
      // sugarcane: dense blocks with 3D clumps along the road edge
      for (const side of [-1, 1]) {
        let s = 494;
        while (s < 572) {
          const s1 = Math.min(572, s + 24 + rng() * 14);
          const d0 = side * 10.2, d1 = side * (60 + rng() * 25);
          const pathNear = paths.some(p => Math.abs(p.s - (s + s1) / 2) < 16 && p.side === side);
          if (!pathNear) {
            // block: canopy top + side walls
            const top = fieldGeo(s + 0.6, s1 - 0.6, d0 + side * 4.2, d1, 2.75, col('#ffffff'));
            batch.add(top, M.caneTop, null, (s + s1) / 2);
            const wallG = [];
            for (const [sa, da, sb, db] of [[s + 0.6, d0 + side * 4.2, s1 - 0.6, d0 + side * 4.2], [s + 0.6, d0 + side * 4.2, s + 0.6, d1], [s1 - 0.6, d0 + side * 4.2, s1 - 0.6, d1]]) {
              const n = Math.max(1, Math.ceil(Math.hypot(sb - sa, db - da) / 5));
              for (let k = 0; k < n; k++) {
                const a = at(lerp(sa, sb, k / n), lerp(da, db, k / n)), b = at(lerp(sa, sb, (k + 1) / n), lerp(da, db, (k + 1) / n));
                const L = Math.hypot(b.x - a.x, b.z - a.z);
                wallG.push(quad([a.x, a.y - 0.1, a.z], [b.x, b.y - 0.1, b.z], [b.x, b.y + 3.1, b.z], [a.x, a.y + 3.1, a.z], [[0, 0], [L / 3, 0], [L / 3, 1], [0, 1]]));
              }
            }
            batch.add(mergeGeos(wallG), M.caneWall, null, (s + s1) / 2);
            for (let ss = s + 0.8; ss < s1 - 0.6; ss += 0.85 / Math.sqrt(D)) for (let k = 0; k < 4; k++) put(caneC[0], ss + rand(-0.2, 0.2), d0 + side * (0.4 + k * 0.95), { scale: 0.85 + rng() * 0.3 });
            bund(s, s1, d0, d1);
          }
          s = s1 + 1.2;
        }
        for (let s = 490; s < 580; s += 8 + rng() * 5) put(coco[0], s, side * rand(95, 140), { scale: 0.9 + rng() * 0.3 });
      }
      // banana plantations in grid rows
      const bananaPlot = (s0, s1, d0, d1) => { for (let s = s0; s < s1; s += 2.7) for (let d = d0; d < d1; d += 2.7) { const p = at(s, d); if (isBlocked(p.x, p.z)) continue; put(ban[0], s + rand(-0.4, 0.4), d + rand(-0.4, 0.4), { scale: 0.85 + rng() * 0.35 }); } };
      bananaPlot(460, 492, -48, -11.5);
      bananaPlot(600, 650, 20, 52);
      bananaPlot(150, 165, -38, -26);
    });

    // ---------- groves, trees, rocks, verges ----------
    await step('Growing the coconut groves…', () => {
      // coconut plantation in rows
      for (const side of [-1, 1]) for (let s = 368; s < 490; s += 8.2) for (let d = 10.5; d < 130; d += 8.2) {
        const ss = s + rand(-0.9, 0.9), dd = side * (d + rand(-0.9, 0.9));
        if (side < 0 && ss > 456 && d < 52) continue;            // banana plot
        const p = at(ss, dd); if (isBlocked(p.x, p.z, 1)) continue;
        put(coco[0], ss, dd, { scale: 0.88 + rng() * 0.3, color: tint('#ffffff', 0.2) });
      }
      // village: coconut clusters behind the houses, neem shade trees between them
      for (const side of [-1, 1]) for (let s = -150; s < 210; s += 5 + rng() * 6) {
        const d = side * (s < 70 ? rand(62, 110) : rand(22, 60)); const p = at(s, d);
        if (isBlocked(p.x, p.z, 1.5)) continue;
        put(coco[0], s, d, { scale: 0.85 + rng() * 0.35 });
      }
      for (const side of [-1, 1]) for (let s = -120; s < 210; s += 16 + rng() * 14) {
        const d = side * (s < 70 ? rand(30, 40) : rand(16, 22)); const p = at(s, d);
        if (isBlocked(p.x, p.z, 1)) continue;
        put(nm[0], s, d, { scale: 0.8 + rng() * 0.35 });
      }
      put(nm[0], 163, 20, { scale: 1.15 });                        // the shrine's neem
      // temple ground
      for (const side of [-1, 1]) for (let s = 740; s < 1000; s += 6 + rng() * 6) { const d = side * rand(64, 120); const p = at(s, d); if (!isBlocked(p.x, p.z, 1.5)) put(coco[0], s, d, { scale: 0.85 + rng() * 0.35 }); }
      for (const side of [-1, 1]) for (let s = 735; s < 900; s += 22 + rng() * 10) { const d = side * rand(26, 36); const p = at(s, d); if (!isBlocked(p.x, p.z, 1)) put(nm[0], s, d, { scale: 0.9 + rng() * 0.3 }); }
      // foothills: palmyra, tamarind, granite boulders, scrub
      for (let k = 0; k < 60; k++) { const s = rand(575, 728), d = (rng() < 0.5 ? -1 : 1) * rand(11, 150); const p = at(s, d); if (isBlocked(p.x, p.z, 1)) continue; put(palm[0], s, d, { scale: 0.85 + rng() * 0.3 }); }
      for (let k = 0; k < 40; k++) { const s = rand(575, 728), d = (rng() < 0.5 ? -1 : 1) * rand(14, 140); const p = at(s, d); if (isBlocked(p.x, p.z, 1)) continue; put(nm[0], s, d, { scale: 0.75 + rng() * 0.45 }); }
      for (let k = 0; k < 70; k++) {
        const s = rand(570, 735), d = (rng() < 0.5 ? -1 : 1) * rand(10, 120), sc = 0.6 + Math.pow(rng(), 2) * 3.2;
        const p = at(s, d); if (isBlocked(p.x, p.z, sc)) continue;
        put(rocks[(rng() * 3) | 0], s, d, { scale: sc, dy: -0.2 * sc });
        for (let j = 0; j < 3; j++) put(tall, s + rand(-sc - 1, sc + 1), d + rand(-sc - 1, sc + 1), { scale: 0.8 + rng() * 0.6 });
      }
      for (let k = 0; k < 26; k++) { const s = rand(-200, 1050), d = (rng() < 0.5 ? -1 : 1) * rand(60, 200); const sc = 1 + rng() * 2.5; const p = at(s, d); if (!isBlocked(p.x, p.z, sc)) put(rocks[(rng() * 3) | 0], s, d, { scale: sc, dy: -0.3 * sc }); }
      // distant tree lines everywhere for depth
      for (let s = -200; s < 1080; s += 6) for (const side of [-1, 1]) {
        if (rng() > 0.55) continue;
        const d = side * rand(180, 330), p = at(s, d);
        if (isBlocked(p.x, p.z)) continue;
        const r = rng(); put(r < 0.6 ? coco[0] : r < 0.8 ? palm[0] : nm[0], s, d, { scale: 0.9 + rng() * 0.4 });
      }
      // verges: grass tufts, taller weeds, pebbles
      const vd = D;
      for (let s = -200; s < 1060; s += 0.26 / vd) {
        const fest = R.zoneW('start', s) + R.zoneW('finish', s);
        if (rng() < fest * 0.75) continue;
        const side = rng() < 0.5 ? -1 : 1, d = side * (E - 0.6 + Math.pow(rng(), 1.6) * 5.5);
        put(grass, s, d, { scale: 0.7 + rng() * 0.7, color: tint(R.zoneW('paddy', s) > 0.5 ? '#c8e0a0' : '#ffffff', 0.3) });
        if (rng() < 0.08) put(tall, s, side * (E + 1 + rng() * 4), { scale: 0.8 + rng() * 0.6, color: tint('#ffffff', 0.25) });
      }
      for (let k = 0; k < 1800 * vd; k++) { const s = rand(-200, 1060), side = rng() < 0.5 ? -1 : 1; put(pebble, s, side * rand(RH + 0.3, E + 1.5), { scale: 0.6 + rng() * 1.8, dy: -0.03 }); }
      // grass on open ground in the hills and groves
      for (let k = 0; k < 2600 * vd; k++) { const s = rand(365, 740), d = (rng() < 0.5 ? -1 : 1) * rand(E + 4, 45); const p = at(s, d); if (isBlocked(p.x, p.z)) continue; put(grass, s, d, { scale: 0.7 + rng() * 0.8, color: tint('#ffffff', 0.3) }); }
    });

    // ---------- start and finish lines ----------
    await step('Chalking the start line…', () => {
      const line = (s, w) => {
        const g = [];
        const n = 12;
        for (let k = 0; k < n; k++) {
          const l0 = lerp(-RH, RH, k / n), l1 = lerp(-RH, RH, (k + 1) / n);
          const a = R.world(s - w / 2, l0, V3()), b = R.world(s - w / 2, l1, V3()), c = R.world(s + w / 2, l1, V3()), d = R.world(s + w / 2, l0, V3());
          g.push(quad([a.x, a.y + 0.045, a.z], [b.x, b.y + 0.045, b.z], [c.x, c.y + 0.045, c.z], [d.x, d.y + 0.045, d.z]));
        }
        const m = new T.Mesh(mergeGeos(g), M.chalk); m.receiveShadow = true; M.chalk.side = T.DoubleSide; scene.add(m);
      };
      line(0, 0.3); line(R.TRACK, 0.35);
      const arch = (s, tex, ww, hh, y) => {
        R.frame(s, F);
        const g = new T.Group(); g.position.set(F.x, F.y, F.z); g.rotation.y = -F.th;
        for (const sx of [-1, 1]) { const p = new T.Mesh(new T.CylinderGeometry(0.12, 0.15, y + hh / 2 + 0.6, 8), new T.MeshStandardMaterial({ color: col('#5a3418'), roughness: 0.9 })); p.position.set(sx * (RH + 0.7), (y + hh / 2 + 0.6) / 2, 0); p.castShadow = true; g.add(p); }
        const ban2 = new T.Mesh(new T.PlaneGeometry(ww, hh), M.sign(tex)); ban2.position.y = y; ban2.castShadow = true; g.add(ban2);
        scene.add(g);
        for (const sx of [-1, 1]) put(ban[0], s + 0.3, sx * (RH + 1.2), { yaw: 0, scale: 1.1 });   // banana trees tied at the posts
        return g;
      };
      arch(R.TRACK, S.tex.finish, RH * 2 + 1, 1.2, 4.4);
      arch(-6, S.tex.start, RH * 2 + 1, 1.5, 4.8);
    });

    // ---------- finalise ----------
    await step('Finishing touches…', () => {
      batch.flush(scene, true, true);
      [...coco, ...palm, ...ban, ...nm, grass, tall, pad, ...caneC, ...rocks, pebble, egrets].forEach(sc => sc.build(scene));
    });
    S.ready = true;
  };

  // animate canal water
  R.World.update = function (dt) {
    if (S.waterMat && S.waterMat.normalMap) { S.waterMat.normalMap.offset.y -= dt * 0.12; }
  };
})();
