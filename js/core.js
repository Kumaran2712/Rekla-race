/* Rekla Race · core
   Shared namespace R, math + noise, quality tier, the curved/hilly track path,
   race zones, terrain height function, and geometry utilities (merge, batching, instancing). */
(function () {
  'use strict';
  const T = THREE;
  const R = (window.R = window.R || {});
  R.T = T;

  // ---------- math ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(14012027);           // seeded: the village is laid out the same way every time
  const rand = (a, b) => a + rng() * (b - a);
  const pick = arr => arr[(rng() * arr.length) | 0];

  // ---------- value noise (optionally periodic, for tiling textures) ----------
  function hash2(x, y) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function noise2(x, y, px, py) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    let x0 = xi, x1 = xi + 1, y0 = yi, y1 = yi + 1;
    if (px) { x0 = ((x0 % px) + px) % px; x1 = ((x1 % px) + px) % px; }
    if (py) { y0 = ((y0 % py) + py) % py; y1 = ((y1 % py) + py) % py; }
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(x0, y0), b = hash2(x1, y0), c = hash2(x0, y1), d = hash2(x1, y1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct, px, py) {
    let s = 0, a = 0.5, n = 0, f = 1;
    for (let i = 0; i < oct; i++) {
      s += a * noise2(x * f, y * f, px ? px * f : 0, py ? py * f : 0);
      n += a; a *= 0.5; f *= 2;
    }
    return s / n;
  }
  const col = h => new T.Color(h).convertSRGBToLinear();

  Object.assign(R, { clamp, lerp, smooth, rng, rand, pick, mulberry32, hash2, noise2, fbm, col });

  // ---------- quality tier ----------
  const mobile = /[?&]mobile/.test(location.search) || Math.min(screen.width, screen.height) < 760 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  R.Q = { mobile, shadow: mobile ? 1024 : 2048, dprMax: mobile ? 1.5 : 2, density: mobile ? 0.6 : 1, terrainCell: mobile ? 6 : 5 };

  // shared animated uniforms (wind, time) used by foliage, flags, crowd, water
  R.U = { time: { value: 0 }, wind: { value: 1 } };

  // ---------- track geometry ----------
  const TRACK = 800, LANES = 4, LANE_W = 2.4, ROAD_HALF = LANE_W * LANES / 2, SHOULDER = 2.6, EDGE = ROAD_HALF + SHOULDER;
  Object.assign(R, { TRACK, LANES, LANE_W, ROAD_HALF, SHOULDER, EDGE });

  const S0 = -220, S1 = 1100, N = S1 - S0 + 1;
  const bump = (s, c, w) => { const x = (s - c) / w; return Math.abs(x) < 1 ? 0.5 + 0.5 * Math.cos(Math.PI * x) : 0; };
  const win = (s, a, b, r) => smooth(a - r, a + r, s) * (1 - smooth(b - r, b + r, s));
  R.bump = bump; R.win = win;

  // curvature (rad / m). Each bump turns the road by amplitude × width radians.
  function curv(s) {
    return 0.0042 * bump(s, 140, 60)    // village: sweeping right
      - 0.0036 * bump(s, 268, 70)       // paddy: long left
      + 0.0030 * bump(s, 352, 40)
      + 0.0034 * bump(s, 430, 55)       // grove: right
      - 0.0020 * bump(s, 528, 40)
      - 0.0047 * bump(s, 612, 45)       // foothills: S-bend
      + 0.0056 * bump(s, 672, 40)
      - 0.0062 * bump(s, 742, 32);      // straighten into the temple ground
  }
  // elevation (m)
  function elev(s) {
    return 0.45 * Math.sin(s / 31) * win(s, 85, 205, 15)
      + 1.1 * bump(s, 425, 60)
      + 6.2 * bump(s, 645, 85)
      + 0.35 * Math.sin(s / 19) * win(s, 585, 715, 20);
  }

  const X = new Float32Array(N), Y = new Float32Array(N), Z = new Float32Array(N), TH = new Float32Array(N);
  const i0 = -S0;
  for (let i = i0 + 1; i < N; i++) {
    const s = S0 + i, tp = TH[i - 1], tn = tp + curv(s - 0.5), tm = (tp + tn) / 2;
    X[i] = X[i - 1] + Math.sin(tm); Z[i] = Z[i - 1] - Math.cos(tm); TH[i] = tn;
  }
  for (let i = i0 - 1; i >= 0; i--) {
    const s = S0 + i, tn = TH[i + 1], tp = tn - curv(s + 0.5), tm = (tp + tn) / 2;
    X[i] = X[i + 1] - Math.sin(tm); Z[i] = Z[i + 1] + Math.cos(tm); TH[i] = tp;
  }
  for (let i = 0; i < N; i++) Y[i] = elev(S0 + i);
  R.track = { S0, S1, N, X, Y, Z, TH };

  // frame at distance s: centre position, heading, pitch
  function frame(s, out) {
    out = out || {};
    let f = s - S0; if (f < 0) f = 0; if (f > N - 1.001) f = N - 1.001;
    const i = f | 0, t = f - i;
    out.x = X[i] + (X[i + 1] - X[i]) * t;
    out.y = Y[i] + (Y[i + 1] - Y[i]) * t;
    out.z = Z[i] + (Z[i + 1] - Z[i]) * t;
    out.th = TH[i] + (TH[i + 1] - TH[i]) * t;
    out.pitch = Math.atan(Y[i + 1] - Y[i]);
    return out;
  }
  const _F = {};
  const crown = lat => 0.04 * (1 - Math.min(1, Math.abs(lat) / ROAD_HALF));
  // world position for (distance along track, lateral offset from centre)
  function world(s, lat, v, dy) {
    const f = frame(s, _F);
    v.set(f.x + Math.cos(f.th) * lat, f.y + (dy || 0) + crown(lat), f.z + Math.sin(f.th) * lat);
    return v;
  }
  const _NR = { s: 0, d: 0 };
  // nearest track point to world (x, z): returns { s, d } (d = signed lateral, + is right)
  function nearest(x, z, out) {
    out = out || _NR;
    let lo = 0, hi = N - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (Z[m] > z) lo = m; else hi = m; }
    let best = 1e18, bi = lo;
    const a = Math.max(0, lo - 120), b = Math.min(N - 1, lo + 120);
    for (let i = a; i <= b; i += 4) { const dx = x - X[i], dz = z - Z[i], d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
    const a2 = Math.max(0, bi - 4), b2 = Math.min(N - 1, bi + 4);
    for (let i = a2; i <= b2; i++) { const dx = x - X[i], dz = z - Z[i], d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
    const th = TH[bi], dx = x - X[bi], dz = z - Z[bi];
    out.s = S0 + bi + clamp(dx * Math.sin(th) - dz * Math.cos(th), -1, 1);
    out.d = dx * Math.cos(th) + dz * Math.sin(th);
    return out;
  }
  Object.assign(R, { frame, world, nearest, elev, crown });

  // ---------- zones ----------
  R.zones = [
    { id: 'start',   en: 'Festival ground',  ta: 'திருவிழா மைதானம்', s0: -1e9, s1: 70 },
    { id: 'village', en: 'Village street',   ta: 'ஊர்த் தெரு',        s0: 70,   s1: 210 },
    { id: 'paddy',   en: 'Paddy fields',     ta: 'நெல் வயல்',         s0: 210,  s1: 365 },
    { id: 'grove',   en: 'Coconut grove',    ta: 'தென்னந்தோப்பு',     s0: 365,  s1: 490 },
    { id: 'cane',    en: 'Sugarcane road',   ta: 'கரும்புத் தோட்டம்', s0: 490,  s1: 575 },
    { id: 'hills',   en: 'Ghat foothills',   ta: 'மலையடிவாரம்',       s0: 575,  s1: 725 },
    { id: 'finish',  en: 'Temple ground',    ta: 'கோயில் மைதானம்',    s0: 725,  s1: 1e9 },
  ];
  const ZI = {}; R.zones.forEach((z, i) => { ZI[z.id] = z; });
  R.zoneW = (id, s, r = 12) => { const z = ZI[id]; return smooth(z.s0 - r, z.s0 + r, s) * (1 - smooth(z.s1 - r, z.s1 + r, s)); };
  R.zoneAt = s => { for (let i = 0; i < R.zones.length; i++) if (s < R.zones[i].s1) return i; return R.zones.length - 1; };

  // ---------- terrain height ----------
  const _TS = { h: 0, s: 0, d: 0 };
  function terrain(x, z, out) {
    out = out || _TS;
    const nr = nearest(x, z);
    const s = nr.s, d = nr.d, ad = Math.abs(d);
    const yr = elev(clamp(s, S0, S1));
    const zw = R.zoneW;
    const wS = zw('start', s) + zw('finish', s), wV = zw('village', s), wP = zw('paddy', s),
      wG = zw('grove', s), wC = zw('cane', s), wH = zw('hills', s);
    const n = fbm(x * 0.02, z * 0.02, 3) - 0.5;
    let field = wS * -0.08 + wV * (-0.15 + n * 0.3) + wP * -0.62 + wG * (-0.25 + n * 0.35) + wC * (-0.35 + n * 0.12) + wH * (-0.3 + n * 0.3);
    // foothills: ground climbs away from the road, broken into rocky knolls
    field += wH * (Math.max(0, ad - 12) * 0.3 * (0.7 + n) + (fbm(x * 0.012 + 5, z * 0.012, 4) - 0.3) * 12 * smooth(12, 40, ad));
    // festival grounds and fields rise into distant rolling country
    const far = smooth(120, 340, ad);
    field += far * (fbm(x * 0.0045 + 1, z * 0.0045 + 3, 4) * 42 + 3) * (0.6 + 0.9 * wH);
    const t = smooth(EDGE + 0.4, EDGE + 2.2, ad);
    out.h = yr + lerp(-0.3, field, t);
    out.s = s; out.d = d;
    out.wS = wS; out.wV = wV; out.wP = wP; out.wG = wG; out.wC = wC; out.wH = wH; out.n = n;
    return out;
  }
  R.terrain = terrain;
  R.groundAt = (x, z) => terrain(x, z).h;

  // ---------- geometry utilities ----------
  const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3();
  // matrix from position / rotation (YXZ) / scale
  function mat(px, py, pz, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx, out) {
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _p.set(px, py, pz); _s.set(sx, sy, sz);
    return (out || new T.Matrix4()).compose(_p, _q, _s);
  }
  // clone + transform (pos [x,y,z], rot [x,y,z] in XYZ order, scale [x,y,z])
  function xf(geo, p, r, s) {
    const g = geo.clone();
    if (s) g.scale(s[0], s[1], s[2]);
    if (r) { if (r[0]) g.rotateX(r[0]); if (r[1]) g.rotateY(r[1]); if (r[2]) g.rotateZ(r[2]); }
    if (p) g.translate(p[0], p[1], p[2]);
    return g;
  }
  // set a vertex colour (linear) on the whole geometry, or via fn(x,y,z,i) -> Color
  function paint(geo, c, fn) {
    const p = geo.attributes.position, n = p.count, a = new Float32Array(n * 3);
    const cc = typeof c === 'string' ? col(c) : c;
    for (let i = 0; i < n; i++) {
      const k = fn ? fn(p.getX(i), p.getY(i), p.getZ(i), i) : cc;
      a[i * 3] = k.r; a[i * 3 + 1] = k.g; a[i * 3 + 2] = k.b;
    }
    geo.setAttribute('color', new T.BufferAttribute(a, 3));
    return geo;
  }
  function mergeGeos(list) {
    let count = 0, hasColor = false, hasUV = false;
    const parts = list.map(g0 => {
      const g = g0.index ? g0.toNonIndexed() : g0;
      if (!g.attributes.normal) g.computeVertexNormals();
      count += g.attributes.position.count;
      if (g.attributes.color) hasColor = true;
      if (g.attributes.uv) hasUV = true;
      return g;
    });
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
    const uv = hasUV ? new Float32Array(count * 2) : null, cl = hasColor ? new Float32Array(count * 3) : null;
    let o = 0;
    for (const g of parts) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      if (uv && g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      if (cl) { if (g.attributes.color) cl.set(g.attributes.color.array, o * 3); else cl.fill(1, o * 3, (o + n) * 3); }
      o += n;
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.BufferAttribute(nor, 3));
    if (uv) out.setAttribute('uv', new T.BufferAttribute(uv, 2));
    if (cl) out.setAttribute('color', new T.BufferAttribute(cl, 3));
    out.computeBoundingSphere();
    return out;
  }
  Object.assign(R, { mat, xf, paint, mergeGeos });

  // Static batcher: merges every static piece per material, chunked along the track for culling.
  class Batch {
    constructor(chunk = 160) { this.chunk = chunk; this.map = new Map(); }
    add(geo, material, matrix, s = 0) {
      const g = matrix ? geo.clone().applyMatrix4(matrix) : geo;
      const key = material.uuid + '|' + Math.floor(s / this.chunk);
      let e = this.map.get(key);
      if (!e) { e = { material, list: [] }; this.map.set(key, e); }
      e.list.push(g);
    }
    flush(scene, cast = true, receive = true) {
      const out = [];
      for (const e of this.map.values()) {
        const m = new T.Mesh(mergeGeos(e.list), e.material);
        m.castShadow = cast; m.receiveShadow = receive; m.matrixAutoUpdate = false;
        scene.add(m); out.push(m);
      }
      this.map.clear();
      return out;
    }
  }
  R.Batch = Batch;

  // Instanced scatter, chunked along the track: frustum culling per chunk, distance culling, and an optional low-detail LOD.
  const scatters = [];
  class Scatter {
    // layers: [{ geo, mat, cast, lo }]   lo = low-detail geometry (optional)
    constructor(layers, { chunk = 100, far = 900, lod = 0 } = {}) {
      this.layers = layers; this.chunk = chunk; this.far = far; this.lod = lod;
      this.chunks = new Map(); this.built = []; scatters.push(this);
    }
    add(matrix, s, color) {
      const k = Math.floor(s / this.chunk);
      let c = this.chunks.get(k);
      if (!c) { c = { k, m: [], c: [], minS: 1e9, maxS: -1e9 }; this.chunks.set(k, c); }
      for (let i = 0; i < 16; i++) c.m.push(matrix.elements[i]);
      if (color) c.c.push(color.r, color.g, color.b);
      c.minS = Math.min(c.minS, s); c.maxS = Math.max(c.maxS, s);
    }
    build(scene) {
      for (const c of this.chunks.values()) {
        const n = c.m.length / 16;
        if (!n) continue;
        // bounding sphere of instance origins
        let cx = 0, cy = 0, cz = 0;
        for (let i = 0; i < n; i++) { cx += c.m[i * 16 + 12]; cy += c.m[i * 16 + 13]; cz += c.m[i * 16 + 14]; }
        cx /= n; cy /= n; cz /= n;
        let r2 = 0, smax = 1;
        for (let i = 0; i < n; i++) {
          const dx = c.m[i * 16 + 12] - cx, dy = c.m[i * 16 + 13] - cy, dz = c.m[i * 16 + 14] - cz;
          r2 = Math.max(r2, dx * dx + dy * dy + dz * dz);
          smax = Math.max(smax, Math.hypot(c.m[i * 16], c.m[i * 16 + 1], c.m[i * 16 + 2]), Math.hypot(c.m[i * 16 + 4], c.m[i * 16 + 5], c.m[i * 16 + 6]));
        }
        const entry = { s: (c.minS + c.maxS) / 2, half: (c.maxS - c.minS) / 2, hi: [], lo: [] };
        const center = new T.Vector3(cx, cy, cz);
        const mk = (geo, layer) => {
          if (!geo.boundingSphere) geo.computeBoundingSphere();
          const bs = geo.boundingSphere;
          const g = new T.BufferGeometry();
          for (const a in geo.attributes) g.setAttribute(a, geo.attributes[a]);
          if (geo.index) g.setIndex(geo.index);
          g.boundingSphere = new T.Sphere(center, Math.sqrt(r2) + (bs.radius + bs.center.length()) * smax);
          const im = new T.InstancedMesh(g, layer.mat, n);
          im.instanceMatrix.array.set(c.m);
          if (c.c.length) im.instanceColor = new T.InstancedBufferAttribute(new Float32Array(c.c), 3);
          im.castShadow = !!layer.cast; im.receiveShadow = layer.receive !== false;
          im.matrixAutoUpdate = false;
          scene.add(im);
          return im;
        };
        for (const L of this.layers) {
          entry.hi.push(mk(L.geo, L));
          if (L.lo) entry.lo.push(mk(L.lo, L));
        }
        this.built.push(entry);
      }
      this.chunks.clear();
      this.update(0);
    }
    update(camS) {
      for (const e of this.built) {
        const dist = Math.max(0, Math.abs(camS - e.s) - e.half);
        const vis = dist < this.far;
        const useLo = this.lod && e.lo.length && dist > this.lod;
        for (const m of e.hi) m.visible = vis && !useLo;
        for (const m of e.lo) m.visible = vis && useLo;
      }
    }
  }
  R.Scatter = Scatter;
  R.updateScatters = camS => { for (const s of scatters) s.update(camS); };
  R.scatterStats = () => scatters.reduce((a, s) => a + s.built.length, 0);

  // foliage / flag material with wind sway in the vertex shader
  R.windify = function (material, amp, heightScale, key) {
    material.onBeforeCompile = sh => {
      sh.uniforms.uTime = R.U.time; sh.uniforms.uWind = R.U.wind;
      sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
        #endif
        float wph = uTime * 1.7 + ip.x * 0.31 + ip.z * 0.23;
        float wk = uWind * ${amp.toFixed(3)} * pow(max(position.y, 0.0) * ${heightScale.toFixed(3)}, 1.5);
        transformed.x += (sin(wph) + 0.4 * sin(wph * 2.3 + 1.0)) * wk;
        transformed.z += cos(wph * 0.8) * wk * 0.6;`);
      // keep alpha-tested foliage full at distance (mipmapping thins it out otherwise)
      sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>',
        '#ifdef ALPHATEST\n if ( diffuseColor.a < ALPHATEST * mix(1.0, 0.38, smoothstep(20.0, 200.0, length(vViewPosition))) ) discard;\n#endif');
    };
    material.customProgramCacheKey = () => 'wind' + key;
    return material;
  };
})();
