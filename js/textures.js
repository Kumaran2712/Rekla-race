/* Rekla Race · procedural textures
   Everything is generated at load time: no image downloads. Road maps carry real detail
   (wheel ruts, hoofprints, stones, dust) in colour + a normal map whose alpha holds height. */
(function () {
  'use strict';
  const R = window.R, T = R.T;
  const { clamp, lerp, smooth, noise2, fbm, mulberry32 } = R;

  function dataTex(data, w, h, srgb = true, repeat = true) {
    const tx = new T.DataTexture(data, w, h, T.RGBAFormat);
    tx.wrapS = tx.wrapT = repeat ? T.RepeatWrapping : T.ClampToEdgeWrapping;
    tx.generateMipmaps = true; tx.minFilter = T.LinearMipmapLinearFilter; tx.magFilter = T.LinearFilter;
    tx.anisotropy = R.maxAniso || 4;
    tx.encoding = srgb ? T.sRGBEncoding : T.LinearEncoding;
    tx.needsUpdate = true;
    return tx;
  }
  R.dataTex = dataTex;

  // canvas -> DataTexture, with transparent pixels "bled" to a colour so mipmaps don't get dark fringes
  function canvasTex(w, h, draw, opts = {}) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); draw(g, w, h);
    const src = g.getImageData(0, 0, w, h).data, out = new Uint8Array(w * h * 4);
    const bl = opts.bleed;
    for (let y = 0; y < h; y++) {
      const sy = h - 1 - y; // flip so canvas top = v 1
      for (let x = 0; x < w; x++) {
        const si = (sy * w + x) * 4, di = (y * w + x) * 4;
        const a = src[si + 3];
        if (bl && a < 60) { out[di] = bl[0]; out[di + 1] = bl[1]; out[di + 2] = bl[2]; }
        else { out[di] = src[si]; out[di + 1] = src[si + 1]; out[di + 2] = src[si + 2]; }
        out[di + 3] = opts.opaque ? 255 : a;
      }
    }
    return dataTex(out, w, h, opts.srgb !== false, opts.repeat !== false);
  }
  R.canvasTex = canvasTex;

  function toBytes(r, g, b, a, n) {
    const out = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) {
      out[i * 4] = clamp(r[i], 0, 1) * 255; out[i * 4 + 1] = clamp(g[i], 0, 1) * 255;
      out[i * 4 + 2] = clamp(b[i], 0, 1) * 255; out[i * 4 + 3] = a ? clamp(a[i], 0, 1) * 255 : 255;
    }
    return out;
  }
  function normalFromHeight(h, W, H, strength) {
    const out = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const xl = (x - 1 + W) % W, xr = (x + 1) % W, yd = (y - 1 + H) % H, yu = (y + 1) % H;
      const dx = (h[y * W + xl] - h[y * W + xr]) * strength, dy = (h[yd * W + x] - h[yu * W + x]) * strength;
      const l = Math.hypot(dx, dy, 1), i = (y * W + x) * 4;
      out[i] = (dx / l * 0.5 + 0.5) * 255; out[i + 1] = (dy / l * 0.5 + 0.5) * 255; out[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      out[i + 3] = clamp(h[y * W + x], 0, 1) * 255;
    }
    return out;
  }

  // ---------- road: red earth with ruts, hoofprints, stones, dust; plus rural asphalt ----------
  // u spans the full ribbon width (18 m, shoulders included), v repeats every 24 m.
  R.makeRoadMaps = function () {
    const W = 512, H = 1024, WM = 18, HM = 24, ppm = W / WM, vpm = H / HM;
    const RH = R.ROAD_HALF, n = W * H;
    const h = new Float32Array(n), cr = new Float32Array(n), cg = new Float32Array(n), cb = new Float32Array(n);
    const rnd = mulberry32(77);
    const um = x => (x + 0.5) / ppm - WM / 2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, u = um(x), au = Math.abs(u);
      const n1 = fbm(x / W * 6, y / H * 8, 4, 6, 8);
      const n2 = noise2(x / W * 110, y / H * 146, 110, 146);
      const n3 = noise2(x / W * 30, y / H * 40, 30, 40);
      let hh = 0.5 + (n1 - 0.5) * 0.32 + (n2 - 0.5) * 0.14 + (n3 - 0.5) * 0.1;
      // laterite red earth
      let r = lerp(0.55, 0.77, n1), g = lerp(0.26, 0.45, n1), b = lerp(0.13, 0.25, n1);
      const k = 0.88 + 0.24 * n3; r *= k; g *= k; b *= k;
      // dust: piles up toward the edges and in the lane middles
      const dust = 0.6 * smooth(3.0, 4.4, au) * (1 - smooth(5.0, 5.9, au)) + 0.25 * smooth(0.55, 0.75, n1) * (1 - smooth(4.6, 5.4, au));
      r = lerp(r, 0.85, dust * 0.6); g = lerp(g, 0.63, dust * 0.6); b = lerp(b, 0.44, dust * 0.6);
      hh = lerp(hh, 0.52 + (n1 - 0.5) * 0.12, dust * 0.7);
      // verge: dry grass and weeds creeping in from the edges
      const veg = smooth(RH + 0.3, RH + 1.7, au + (n3 - 0.5) * 1.6);
      if (veg > 0) {
        const green = smooth(0.4, 0.7, n2 * 0.4 + n1 * 0.6);
        const vr = lerp(0.56, 0.36, green), vg = lerp(0.52, 0.5, green), vb = lerp(0.27, 0.19, green);
        const soil = smooth(0.62, 0.8, n3);
        const m = veg * (1 - soil * 0.6);
        r = lerp(r, vr * (0.8 + 0.4 * n2), m); g = lerp(g, vg * (0.8 + 0.4 * n2), m); b = lerp(b, vb * (0.8 + 0.4 * n2), m);
        hh += veg * (n2 - 0.5) * 0.45;
      }
      h[i] = hh; cr[i] = r; cg[i] = g; cb[i] = b;
    }
    const stamp = (cx, cy, rx, ry, fn) => { // cx,cy in px; fn(i, d) with d = normalised distance 0..1
      const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx), y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        if (xx < 0 || xx >= W) continue;
        const dx = (xx - cx) / rx, dy = (yy - cy) / ry, d = dx * dx + dy * dy;
        if (d > 1) continue;
        fn(((yy % H) + H) % H * W + xx, Math.sqrt(d));
      }
    };
    // wheel ruts: two per lane, gently wandering, compacted and darker
    const lanes = [-3.6, -1.2, 1.2, 3.6];
    for (const c of lanes) for (const o of [-0.56, 0.56]) {
      const ph = rnd() * 6, depth0 = 0.1 + rnd() * 0.04, sig = 0.11 * ppm;
      for (let y = 0; y < H; y++) {
        const t = y / H * Math.PI * 2;
        const uc = c + o + 0.07 * Math.sin(t * 2 + ph) + 0.03 * Math.sin(t * 5 + ph * 2);
        const cx = (uc + WM / 2) * ppm, depth = depth0 * (0.55 + 0.45 * noise2(y / H * 14, c * 3 + o * 5 + 9, 14, 0));
        for (let x = Math.floor(cx - sig * 3); x <= Math.ceil(cx + sig * 3); x++) {
          const i = y * W + x, dd = (x - cx) / sig, gk = Math.exp(-dd * dd);
          h[i] -= depth * gk;
          h[i] += depth * 0.35 * Math.exp(-Math.pow((Math.abs(x - cx) - sig * 1.9) / (sig * 0.6), 2));
          const dk = 1 - 0.2 * gk; cr[i] *= dk; cg[i] *= dk * 0.98; cb[i] *= dk * 0.97;
        }
      }
    }
    // hoofprints: cloven pairs in the lane middles
    for (const c of lanes) for (let k = 0; k < 85; k++) {
      const cy = rnd() * H, u0 = c + (rnd() - 0.5) * 0.6, ang = (rnd() - 0.5) * 0.4;
      for (const side of [-1, 1]) {
        const cx = (u0 + side * 0.035 + WM / 2) * ppm;
        stamp(cx + Math.sin(ang) * 2, cy, 0.04 * ppm, 0.068 * vpm, (i, d) => {
          const f = 1 - d * d; h[i] -= 0.09 * f; const dk = 1 - 0.22 * f; cr[i] *= dk; cg[i] *= dk; cb[i] *= dk;
        });
      }
    }
    // small stones and pebbles, denser toward the edges
    for (let k = 0; k < 2600; k++) {
      const u = (rnd() - 0.5) * WM, au = Math.abs(u);
      if (rnd() > 0.3 + 0.7 * smooth(3.4, 5.6, au)) continue;
      const rad = (0.014 + rnd() * rnd() * 0.05), cx = (u + WM / 2) * ppm, cy = rnd() * H;
      const t = rnd(), sr = t < 0.5 ? [0.62, 0.58, 0.54] : t < 0.85 ? [0.7, 0.42, 0.26] : [0.86, 0.84, 0.8];
      stamp(cx, cy, rad * ppm, rad * vpm * 0.9, (i, d) => {
        const f = Math.sqrt(1 - d * d); h[i] = Math.max(h[i], 0.5 + 0.22 * f);
        const m = clamp(f * 1.6, 0, 1); cr[i] = lerp(cr[i], sr[0] * (0.75 + 0.3 * f), m); cg[i] = lerp(cg[i], sr[1] * (0.75 + 0.3 * f), m); cb[i] = lerp(cb[i], sr[2] * (0.75 + 0.3 * f), m);
      });
    }
    // baked cavity shading
    for (let i = 0; i < n; i++) { const k = 0.78 + 0.44 * clamp(h[i], 0, 1); cr[i] *= k; cg[i] *= k; cb[i] *= k; }
    const color = dataTex(toBytes(cr, cg, cb, null, n), W, H, true);
    const normal = dataTex(normalFromHeight(h, W, H, 7), W, H, false);

    // rural asphalt (alpha = ragged tar edge)
    const ar = new Float32Array(n), ag = new Float32Array(n), ab = new Float32Array(n), aa = new Float32Array(n);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, u = um(x), au = Math.abs(u);
      const n1 = fbm(x / W * 5, y / H * 7, 4, 5, 7), n2 = noise2(x / W * 220, y / H * 290, 220, 290), n3 = noise2(x / W * 28, y / H * 38, 28, 38);
      let v = 0.215 + 0.06 * (n1 - 0.5);
      if (n2 > 0.74) v += 0.12 * (n2 - 0.74) / 0.26; else if (n2 < 0.22) v -= 0.05;
      // polished wheel tracks
      for (const c of lanes) for (const o of [-0.56, 0.56]) { const d = (u - c - o) / 0.22; v += 0.035 * Math.exp(-d * d); }
      let r = v, g = v * 0.985, b = v * 0.96;
      // red dust carried onto the tar
      const dm = clamp(smooth(0.55, 0.85, n1) * 0.55 + smooth(3.7, 4.9, au) * 0.75, 0, 0.9);
      r = lerp(r, 0.62, dm * 0.7); g = lerp(g, 0.37, dm * 0.7); b = lerp(b, 0.23, dm * 0.7);
      ar[i] = r; ag[i] = g; ab[i] = b;
      aa[i] = au < RH + 0.2 + (n3 - 0.5) * 0.7 ? 1 : 0;
    }
    // cracks and patch repairs
    for (let k = 0; k < 46; k++) {
      let x = rnd() * W, y = rnd() * H, a = rnd() * 6.28; const L = 40 + rnd() * 180;
      for (let s = 0; s < L; s++) {
        a += (rnd() - 0.5) * 0.7; x += Math.cos(a); y += Math.sin(a);
        const xi = Math.round(x), yi = ((Math.round(y) % H) + H) % H;
        if (xi < 1 || xi >= W - 1) break;
        const i = yi * W + xi; ar[i] *= 0.55; ag[i] *= 0.55; ab[i] *= 0.55;
      }
    }
    for (let k = 0; k < 7; k++) {
      const x0 = rnd() * (W - 160) + 40, y0 = rnd() * H, w = Math.min(40 + rnd() * 90, W - 2 - x0), hh = 40 + rnd() * 120;
      for (let yy = y0; yy < y0 + hh; yy++) for (let xx = x0; xx < x0 + w; xx++) {
        const i = ((Math.floor(yy) % H) * W) + Math.floor(xx); const edge = (xx - x0 < 2 || x0 + w - xx < 2 || yy - y0 < 2 || y0 + hh - yy < 2);
        const kk = edge ? 0.7 : 0.82; ar[i] *= kk; ag[i] *= kk; ab[i] *= kk;
      }
    }
    const asphalt = dataTex(toBytes(ar, ag, ab, aa, n), W, H, true);
    return { color, normal, asphalt };
  };

  // r: fine grain, g: macro blotches, b: mid noise  (linear)
  R.makeGrain = function () {
    const W = 256, n = W * W, r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      r[i] = noise2(x / 4, y / 4, 64, 64);
      g[i] = fbm(x / W * 4, y / W * 4, 5, 4, 4);
      b[i] = fbm(x / W * 16, y / W * 16, 3, 16, 16);
    }
    return dataTex(toBytes(r, g, b, null, n), W, W, false);
  };

  // terrain micro detail (multiplies vertex colour)
  R.makeGroundDetail = function () {
    const W = 256, n = W * W, r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const hi = noise2(x / 2.2, y / 2.2, 116, 116), mid = fbm(x / W * 8, y / W * 8, 3, 8, 8), blade = noise2(x / 1.3, y / 6, 197, 43);
      const v = 0.72 + 0.28 * hi * 0.7 + 0.18 * (mid - 0.5) + 0.12 * (blade - 0.5);
      r[i] = v * 0.98; g[i] = v; b[i] = v * 0.94;
    }
    return dataTex(toBytes(r, g, b, null, n), W, W, false);
  };
})();
