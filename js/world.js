/* Rekla Race · world: terrain, road, distant mountains (Phase 2) */
(function () {
  'use strict';
  const R = window.R, T = R.T;
  const { clamp, lerp, smooth, fbm, noise2, col } = R;
  const W = R.World = {};

  // ---------- terrain heightfield ----------
  W.buildTerrain = function (scene, detailTex) {
    const { X, Z, N } = R.track;
    let minX = 1e9, maxX = -1e9;
    for (let i = 0; i < N; i++) { if (X[i] < minX) minX = X[i]; if (X[i] > maxX) maxX = X[i]; }
    const cell = R.Q.terrainCell;
    const x0 = Math.floor((minX - 440) / cell) * cell, x1 = Math.ceil((maxX + 440) / cell) * cell;
    const zTop = Math.ceil((Z[0] + 140) / cell) * cell, zBot = Math.floor((Z[N - 1] - 140) / cell) * cell;
    const nx = Math.round((x1 - x0) / cell), nz = Math.round((zTop - zBot) / cell);
    const vc = (nx + 1) * (nz + 1);
    const pos = new Float32Array(vc * 3), cl = new Float32Array(vc * 3), uv = new Float32Array(vc * 2);
    const hs = new Float32Array(vc), meta = new Float32Array(vc * 4);
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const k = j * (nx + 1) + i, x = x0 + i * cell, z = zTop - j * cell;
      const t = R.terrain(x, z);
      pos[k * 3] = x; pos[k * 3 + 1] = t.h; pos[k * 3 + 2] = z; hs[k] = t.h;
      uv[k * 2] = x / 7; uv[k * 2 + 1] = z / 7;
      meta[k * 4] = t.d; meta[k * 4 + 1] = t.s; meta[k * 4 + 2] = t.n;
    }
    const C = {
      dry: col('#9a9452'), green: col('#628a35'), lush: col('#466f27'), dust: col('#b98256'), maidan: col('#b88f60'),
      grove: col('#6d6a3a'), scrub: col('#82804a'), rock: col('#93806b'), laterite: col('#a05a34'), hill: col('#4f7034'),
    };
    const c = new T.Color(), tmp = new T.Color();
    const mix = (to, w) => { if (w > 0) c.lerp(to, clamp(w, 0, 1)); };
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const k = j * (nx + 1) + i, x = pos[k * 3], z = pos[k * 3 + 2];
      const d = meta[k * 4], s = meta[k * 4 + 1], ad = Math.abs(d);
      const zw = R.zoneW;
      const wS = zw('start', s) + zw('finish', s), wP = zw('paddy', s), wG = zw('grove', s), wC = zw('cane', s), wH = zw('hills', s);
      const hl = hs[k - (i > 0 ? 1 : 0)], hr = hs[k + (i < nx ? 1 : 0)], hu = hs[k - (j > 0 ? nx + 1 : 0)], hd = hs[k + (j < nz ? nx + 1 : 0)];
      const slope = Math.hypot(hr - hl, hd - hu) / (2 * cell);
      const patch = fbm(x * 0.012, z * 0.012, 3);
      c.copy(C.dry).lerp(C.green, smooth(0.38, 0.62, patch));
      mix(C.maidan, wS * (1 - smooth(45, 95, ad)));
      mix(C.lush, wP * (1 - smooth(140, 220, ad)) * 0.8);
      mix(C.grove, wG * 0.65);
      mix(C.green, wC * 0.5);
      mix(C.scrub, wH * 0.65);
      mix(C.dust, (1 - smooth(R.EDGE + 0.5, R.EDGE + 5, ad)) * 0.85);
      mix(C.hill, smooth(150, 360, ad) * 0.75);
      mix(tmp.copy(C.laterite).lerp(C.rock, noise2(x * 0.05, z * 0.05)), smooth(0.28, 0.65, slope) * (0.9 - 0.4 * smooth(150, 300, ad)));
      const b = (0.86 + 0.28 * noise2(x * 0.11, z * 0.11)) * 1.28;
      cl[k * 3] = c.r * b; cl[k * 3 + 1] = c.g * b; cl[k * 3 + 2] = c.b * b;
    }
    const idx = new Uint32Array(nx * nz * 6);
    let o = 0;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, cc = a + nx + 1, d = cc + 1;
      idx[o++] = a; idx[o++] = b; idx[o++] = cc; idx[o++] = b; idx[o++] = d; idx[o++] = cc;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('color', new T.BufferAttribute(cl, 3));
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    g.setIndex(new T.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    const mat = new T.MeshStandardMaterial({ vertexColors: true, map: detailTex, roughness: 0.96, metalness: 0 });
    const mesh = new T.Mesh(g, mat);
    mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    R.Sky.groundMats.push(mat);
    W.terrainBounds = { x0, x1, zTop, zBot };
    return mesh;
  };

  // ---------- road ribbon ----------
  W.buildRoad = function (scene, maps, grain) {
    const { S0, S1 } = R.track, E = R.EDGE, RH = R.ROAD_HALF;
    const lats = [-(E + 1.6), -E, -(RH + 0.9), -RH, -2.4, -1.2, 0, 1.2, 2.4, RH, RH + 0.9, E, E + 1.6];
    const dys = [-0.55, -0.1, -0.035, -0.004, 0.015, 0.03, 0.04, 0.03, 0.015, -0.004, -0.035, -0.1, -0.55];
    const WT = 2 * (E + 1.6), cols = lats.length, rows = S1 - S0 + 1;
    const pos = new Float32Array(rows * cols * 3), uv = new Float32Array(rows * cols * 2), cl = new Float32Array(rows * cols * 3), surf = new Float32Array(rows * cols);
    const F = {};
    const tint = { start: [1.02, 1, 0.98], village: [1, 1, 1], paddy: [0.8, 0.74, 0.7], grove: [1.04, 0.98, 0.92], cane: [1, 0.97, 0.95], hills: [0.95, 0.84, 0.78], finish: [1.02, 1, 0.98] };
    for (let r = 0; r < rows; r++) {
      const s = S0 + r; R.frame(s, F);
      const ct = Math.cos(F.th), st = Math.sin(F.th);
      let tr = 0, tg = 0, tb = 0, ws = 0;
      for (const z of R.zones) { const w = R.zoneW(z.id, s); if (w > 0) { const t = tint[z.id]; tr += t[0] * w; tg += t[1] * w; tb += t[2] * w; ws += w; } }
      tr /= ws; tg /= ws; tb /= ws;
      const asph = R.zoneW('cane', s, 6);
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c;
        let lat = lats[c];
        if (c <= 1 || c >= cols - 2) lat += (noise2(s * 0.13, c * 7.1) - 0.5) * (c === 0 || c === cols - 1 ? 1.2 : 0.7);
        pos[k * 3] = F.x + ct * lat; pos[k * 3 + 1] = F.y + dys[c]; pos[k * 3 + 2] = F.z + st * lat;
        uv[k * 2] = (lat + WT / 2) / WT; uv[k * 2 + 1] = s / 24;
        cl[k * 3] = tr; cl[k * 3 + 1] = tg; cl[k * 3 + 2] = tb;
        surf[k] = asph;
      }
    }
    const idx = new Uint32Array((rows - 1) * (cols - 1) * 6);
    let o = 0;
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      // rows advance along the road (−z at heading 0); columns go left → right
      idx[o++] = a; idx[o++] = b; idx[o++] = d; idx[o++] = b; idx[o++] = e; idx[o++] = d;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    g.setAttribute('color', new T.BufferAttribute(cl, 3));
    g.setAttribute('aSurf', new T.BufferAttribute(surf, 1));
    g.setIndex(new T.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    const mat = new T.MeshStandardMaterial({ map: maps.color, normalMap: maps.normal, normalScale: new T.Vector2(0.6, 0.6), roughness: 0.93, metalness: 0, vertexColors: true });
    mat.onBeforeCompile = sh => {
      sh.uniforms.uAsph = { value: maps.asphalt }; sh.uniforms.uGrain = { value: grain }; sh.uniforms.uWet = R.U.wet;
      sh.vertexShader = 'attribute float aSurf; varying float vSurf;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSurf = aSurf;');
      sh.fragmentShader = 'uniform sampler2D uAsph; uniform sampler2D uGrain; uniform float uWet; varying float vSurf;\n' +
        'vec3 rkSRGBToLinear(vec3 c){ return mix(c * 0.0773993808, pow(c * 0.9478672986 + 0.0521327014, vec3(2.4)), step(0.04045, c)); }\n' + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec4 asp = texture2D(uAsph, vMapUv);
          float am = vSurf * asp.a;
          diffuseColor.rgb = mix(diffuseColor.rgb, rkSRGBToLinear(asp.rgb), am);
          vec4 grn = texture2D(uGrain, vMapUv * vec2(9.0, 7.0));
          vec4 mac = texture2D(uGrain, vMapUv * vec2(0.6, 0.11));
          diffuseColor.rgb *= (0.88 + 0.24 * grn.r) * (0.84 + 0.32 * mac.g);
          float hgt = texture2D(normalMap, vNormalMapUv).a;
          float edgeU = abs(vMapUv.x - 0.5) * 2.0;
          float pud = uWet * smoothstep(0.44, 0.34, hgt) * (1.0 - smoothstep(0.52, 0.6, edgeU)) * smoothstep(0.3, 0.55, mac.b + uWet * 0.2);
          diffuseColor.rgb *= mix(vec3(1.0), vec3(0.56, 0.5, 0.47), uWet * 0.85);
          diffuseColor.rgb *= mix(1.0, 0.62, pud);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.55, am);
          roughnessFactor = mix(roughnessFactor, 0.66, uWet * 0.8);
          roughnessFactor = mix(roughnessFactor, 0.03, pud);`)
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n vec3 geoNormal = normal;')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n normal = normalize(mix(normal, geoNormal, clamp(pud * 1.2 + am * 0.5 + uWet * 0.45, 0.0, 1.0)));');
    };
    mat.customProgramCacheKey = () => 'road';
    const mesh = new T.Mesh(g, mat);
    mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    return mesh;
  };

  // ---------- Western Ghats: three ridge layers fading into haze ----------
  W.buildMountains = function (scene) {
    const { X, Z, N } = R.track;
    let cx = 0, cz = 0; for (let i = 0; i < N; i++) { cx += X[i]; cz += Z[i]; } cx /= N; cz /= N;
    const layers = [{ r: 820, lo: 30, hi: 120, seed: 1 }, { r: 1080, lo: 70, hi: 230, seed: 7 }, { r: 1380, lo: 120, hi: 360, seed: 13 }];
    layers.forEach((L, li) => {
      const seg = 256, rows = 6;
      const pos = [], cl = [], idx = [];
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        let ridge = fbm(ca * 2.2 + L.seed, sa * 2.2 + L.seed * 2, 5);
        ridge = Math.pow(clamp(ridge * 1.35 - 0.12, 0, 1), 1.5);
        const west = 0.45 + 0.55 * smooth(-0.3, 0.7, -ca);   // the Ghats rise to the west (left of the course)
        const h = L.lo + (L.hi - L.lo) * ridge * west;
        for (let r = 0; r <= rows; r++) {
          const t = r / rows;
          const rr = L.r * (1 - t * (0.16 + 0.1 * ridge));
          pos.push(cx + ca * rr, lerp(-40, h, Math.pow(t, 0.9)), cz + sa * rr);
          const nb = fbm(Math.cos(a + 0.02) * 2.2 + L.seed, Math.sin(a + 0.02) * 2.2 + L.seed * 2, 5);
          const facing = clamp(0.5 + (nb - fbm(ca * 2.2 + L.seed, sa * 2.2 + L.seed * 2, 5)) * 18, 0, 1);
          const shade = lerp(0.6, 1.0, t) * (0.82 + 0.3 * facing) * (0.94 + 0.12 * noise2(i * 0.5, r + li * 10));
          cl.push(shade, shade, shade);
        }
      }
      for (let i = 0; i < seg; i++) for (let r = 0; r < rows; r++) {
        const a = i * (rows + 1) + r, b = a + 1, c = a + rows + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(cl, 3));
      g.setIndex(idx);
      const m = new T.MeshBasicMaterial({ vertexColors: true, fog: false, side: T.DoubleSide });
      const mesh = new T.Mesh(g, m); mesh.renderOrder = -5 + li; mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      R.Sky.mountainMats[li] = m;
    });
  };
})();
