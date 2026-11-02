/* Rekla Race · race-day atmosphere (Phase 5)
   Animated villagers (GPU-instanced: they wave, jump and cheer as the carts pass), casuarina barricades,
   bunting that flutters in the wind, flex banners, the judges' pandal, horn loudspeakers and Pongal pots. */
(function () {
  'use strict';
  const R = window.R, T = R.T;
  const { clamp, lerp, rand, rng, col, mat, paint, mergeGeos } = R;
  const RH = R.ROAD_HALF, E = R.EDGE;
  const C = R.Crowd = {};
  const F = {};

  // ---------- person: one low-poly mesh, parts tagged for colour and arm animation ----------
  function personGeo() {
    const parts = [];
    const tag = (g, part, arm) => {
      const n = g.attributes.position.count;
      g.setAttribute('aPart', new T.BufferAttribute(new Float32Array(n).fill(part), 1));
      g.setAttribute('aArm', new T.BufferAttribute(new Float32Array(n).fill(arm), 1));
      return g;
    };
    const legs = new T.CylinderGeometry(0.16, 0.2, 0.86, 6, 1, true); legs.translate(0, 0.43, 0); parts.push(tag(legs, 1, 0));
    const torso = new T.CylinderGeometry(0.2, 0.16, 0.62, 6, 1, true); torso.translate(0, 1.17, 0); parts.push(tag(torso, 0, 0));
    const head = new T.SphereGeometry(0.12, 6, 4); head.translate(0, 1.6, 0); parts.push(tag(head, 2, 0));
    for (const s of [-1, 1]) {
      const arm = new T.CylinderGeometry(0.045, 0.04, 0.6, 4, 1, true); arm.translate(s * 0.25, 1.42 - 0.3, 0); parts.push(tag(arm, 0, s));
    }
    // merge, keeping the custom attributes
    const g = mergeGeos(parts);
    let o = 0; const ap = new Float32Array(g.attributes.position.count), aa = new Float32Array(g.attributes.position.count);
    for (const p of parts) { const q = p.index ? p.toNonIndexed() : p; const n = q.attributes.position.count; ap.set(q.attributes.aPart.array, o); aa.set(q.attributes.aArm.array, o); o += n; }
    g.setAttribute('aPart', new T.BufferAttribute(ap, 1)); g.setAttribute('aArm', new T.BufferAttribute(aa, 1));
    return g;
  }

  function crowdMaterial() {
    const m = new T.MeshStandardMaterial({ roughness: 0.85 });
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = R.U.time; sh.uniforms.uFocus = C.focus; sh.uniforms.uFocus2 = C.focus2;
      sh.vertexShader = `attribute float aPart; attribute float aArm; attribute vec3 iTop; attribute vec3 iBot; attribute vec3 iSkin; attribute float iPh;
        uniform float uTime; uniform vec3 uFocus; uniform vec3 uFocus2; varying vec3 vCrowd;\n` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float dF = min(distance(ip, uFocus), distance(ip, uFocus2));
        float ex = smoothstep(42.0, 6.0, dF);
        float ph = iPh * 6.2831;
        float keen = step(0.55, fract(iPh * 7.13));
        if (aArm != 0.0) {
          float raise = ex * (0.7 + 0.3 * sin(uTime * 9.0 + ph)) * (0.6 + 0.4 * keen) + keen * 0.22 * (0.5 + 0.5 * sin(uTime * 1.6 + ph));
          raise = clamp(raise, 0.0, 1.0);
          float ang = raise * 2.7 * aArm;
          vec2 q = transformed.xy - vec2(0.24 * aArm, 1.42);
          float c = cos(ang), s = sin(ang);
          transformed.xy = vec2(q.x * c - q.y * s, q.x * s + q.y * c) + vec2(0.24 * aArm, 1.42);
        }
        float jump = ex * max(0.0, sin(uTime * 7.5 + ph)) * 0.2 * step(0.45, fract(iPh * 3.7));
        transformed.y += jump;
        transformed.x += sin(uTime * 1.2 + ph) * 0.03 * transformed.y;
        vCrowd = aPart < 0.5 ? iTop : aPart < 1.5 ? iBot : (position.y > 1.63 ? vec3(0.02, 0.018, 0.016) : iSkin);`);
      sh.fragmentShader = 'varying vec3 vCrowd;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= vCrowd;');
    };
    m.customProgramCacheKey = () => 'crowd';
    return m;
  }

  const SHIRTS = ['#f4f1ea', '#f4f1ea', '#cfe3f2', '#2f5d9a', '#e9d8a6', '#8fb3d9', '#b84a3a', '#6a8f5a', '#f2c94c', '#ffffff'];
  const SAREES = ['#c2185b', '#e65100', '#2e7d32', '#f9a825', '#6a1b9a', '#d81b60', '#00897b', '#b71c1c', '#1565c0', '#ff8f00'];
  const VESHTI = ['#f2ede0', '#f2ede0', '#efe6cf', '#2f4f7a', '#3d6b4a'];
  const SKIN = ['#6b4026', '#7d4c2c', '#8d5a34', '#5a341f', '#9a6a44'];

  C.focus = { value: new T.Vector3(0, -100, 0) };
  C.focus2 = { value: new T.Vector3(0, -100, 0) };

  function addPeople(scene, spots) {
    if (!spots.length) return;
    const geo = C.geo, n = spots.length;
    const g = new T.BufferGeometry();
    for (const a in geo.attributes) g.setAttribute(a, geo.attributes[a]);
    const top = new Float32Array(n * 3), bot = new Float32Array(n * 3), skin = new Float32Array(n * 3), ph = new Float32Array(n);
    const im = new T.InstancedMesh(g, C.mat, n);
    let cx = 0, cz = 0, cy = 0;
    spots.forEach((s, i) => {
      const woman = rng() < 0.45, kid = rng() < 0.14;
      const sc = (kid ? 0.62 : 0.92 + rng() * 0.16);
      im.setMatrixAt(i, mat(s.x, s.y, s.z, s.yaw + rand(-0.4, 0.4), 0, 0, sc));
      const t = col(woman ? R.pick(SAREES) : R.pick(SHIRTS)), b = woman ? t.clone().multiplyScalar(0.85) : col(R.pick(VESHTI));
      if (woman && rng() < 0.4) t.copy(col(R.pick(SAREES)));
      top.set([t.r, t.g, t.b], i * 3); bot.set([b.r, b.g, b.b], i * 3);
      const k = col(R.pick(SKIN)); skin.set([k.r, k.g, k.b], i * 3);
      ph[i] = rng();
      cx += s.x; cy += s.y; cz += s.z;
    });
    g.setAttribute('iTop', new T.InstancedBufferAttribute(top, 3));
    g.setAttribute('iBot', new T.InstancedBufferAttribute(bot, 3));
    g.setAttribute('iSkin', new T.InstancedBufferAttribute(skin, 3));
    g.setAttribute('iPh', new T.InstancedBufferAttribute(ph, 1));
    const c = new T.Vector3(cx / n, cy / n, cz / n);
    let r = 0; spots.forEach(s => { r = Math.max(r, Math.hypot(s.x - c.x, s.y - c.y, s.z - c.z)); });
    g.boundingSphere = new T.Sphere(c, r + 2);
    im.castShadow = false; im.receiveShadow = true;
    scene.add(im);
    C.meshes.push(im);
  }

  const at = (s, d) => { R.frame(s, F); const x = F.x + Math.cos(F.th) * d, z = F.z + Math.sin(F.th) * d; return { x, y: R.groundAt(x, z), z, th: F.th }; };
  const faceRoad = (th, d) => d < 0 ? Math.PI / 2 - th : -Math.PI / 2 - th;

  // ---------- festival props ----------
  function flagMaterial() {
    const m = new T.MeshStandardMaterial({ vertexColors: true, side: T.DoubleSide, roughness: 0.8 });
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = R.U.time; sh.uniforms.uWind = R.U.wind;
      sh.vertexShader = 'attribute float aFlap; uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float fp = uTime * 4.0 + position.x * 0.9 + position.z * 0.7;
        transformed.x += sin(fp) * 0.07 * aFlap * uWind; transformed.z += cos(fp * 1.3) * 0.07 * aFlap * uWind; transformed.y += sin(fp * 0.7) * 0.02 * aFlap;`);
    };
    m.customProgramCacheKey = () => 'flag';
    return m;
  }
  function textTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = R.maxAniso;
    const p = () => { draw(c.getContext('2d'), w, h); t.needsUpdate = true; }; p();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(p);
    return t;
  }
  function banner(bg, lines, accent) {
    return textTex(768, 256, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, bg[0]); grd.addColorStop(1, bg[1]);
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.fillStyle = accent; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      lines.forEach(([txt, size, color, y]) => { g.fillStyle = color; g.font = `800 ${size}px 'Baloo Thambi 2', 'Mukta Malar', sans-serif`; g.fillText(txt, w / 2, h * y); });
    });
  }

  C.build = function (scene) {
    C.meshes = [];
    C.geo = personGeo();
    C.mat = crowdMaterial();
    const D = R.Q.density;
    const batch = new R.Batch(200);
    const paintM = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
    const brass = new T.MeshStandardMaterial({ color: col('#c9a03a'), roughness: 0.35, metalness: 0.85 });
    const flagM = flagMaterial();

    // barricades + spectators at both festival grounds
    const crowdStart = [], crowdFinish = [], crowdRoad = [];
    const rails = [];
    const barricade = (s0, s1, list) => {
      for (const side of [-1, 1]) {
        const d = side * (RH + 1.15);
        let prev = null;
        for (let s = s0; s <= s1; s += 2.4) {
          const p = at(s, d);
          const post = new T.CylinderGeometry(0.04, 0.05, 1.25, 5); post.translate(p.x, p.y + 0.62, p.z); rails.push(paint(post, '#8a6a44'));
          if (prev) for (const h of [0.55, 1.05]) {
            const L = Math.hypot(p.x - prev.x, p.z - prev.z), r = new T.CylinderGeometry(0.03, 0.03, L, 4);
            r.rotateX(Math.PI / 2); r.rotateY(Math.atan2(p.x - prev.x, p.z - prev.z)); r.translate((p.x + prev.x) / 2, (p.y + prev.y) / 2 + h, (p.z + prev.z) / 2);
            rails.push(paint(r, h > 1 ? '#9a7a50' : '#7a5a38'));
          }
          prev = p;
        }
        // spectators packed two to four deep behind the rail
        for (let s = s0; s <= s1; s += 0.62 / Math.sqrt(D)) {
          const rows = 2 + ((rng() * 3) | 0);
          for (let k = 0; k < rows; k++) {
            if (rng() < 0.12) continue;
            const dd = side * (RH + 1.7 + k * 0.72 + rand(-0.15, 0.15)), p = at(s + rand(-0.2, 0.2), dd);
            list.push({ x: p.x, y: p.y, z: p.z, yaw: faceRoad(p.th, dd) });
          }
        }
      }
    };
    barricade(-40, 64, crowdStart);
    barricade(730, 842, crowdFinish);
    // clusters along the course: under trees, on house verandahs, at the bus stop and tea shop
    const cluster = (s, d, n, list) => { for (let k = 0; k < n; k++) { const dd = d + rand(-1.5, 1.5) * Math.sign(d), p = at(s + rand(-2.5, 2.5), dd); list.push({ x: p.x, y: p.y, z: p.z, yaw: faceRoad(p.th, dd) }); } };
    for (let s = 85; s < 720; s += 34 + rng() * 30) cluster(s, (rng() < 0.5 ? -1 : 1) * (E + 1.6 + rng() * 2), 4 + ((rng() * 6) | 0), crowdRoad);
    cluster(199, 11.4, 6, crowdRoad); cluster(111, -14.3, 4, crowdRoad);
    batch.add(mergeGeos(rails), paintM, null, 0);
    addPeople(scene, crowdStart); addPeople(scene, crowdFinish); addPeople(scene, crowdRoad);

    // bunting strung across the road on tall bamboo poles, and along the barricades
    const flags = [];
    const FC = ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#fb8c00', '#d81b60', '#ffffff', '#8e24aa'].map(col);
    const string = (a, b, sag) => {
      const L = a.distanceTo(b), n = Math.floor(L / 0.42);
      const dir = b.clone().sub(a).normalize();
      for (let k = 0; k < n; k++) {
        const t0 = (k + 0.1) / n, t1 = (k + 0.9) / n, tm = (k + 0.5) / n;
        const p0 = a.clone().lerp(b, t0), p1 = a.clone().lerp(b, t1), pm = a.clone().lerp(b, tm);
        p0.y -= Math.sin(Math.PI * t0) * sag; p1.y -= Math.sin(Math.PI * t1) * sag; pm.y -= Math.sin(Math.PI * tm) * sag + 0.34;
        pm.addScaledVector(dir.clone().cross(new T.Vector3(0, 1, 0)), 0.01);
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute([...p0.toArray(), ...p1.toArray(), ...pm.toArray()], 3));
        g.setAttribute('aFlap', new T.Float32BufferAttribute([0, 0, 1], 1));
        g.computeVertexNormals();
        const c = FC[k % FC.length]; paint(g, c);
        flags.push(g);
      }
    };
    const poleG = [];
    for (const s of [6, 24, 44, 62, 742, 766, 790, 812, 834]) {
      const a = at(s, -(RH + 1.5)), b = at(s, RH + 1.5);
      for (const p of [a, b]) { const pl = new T.CylinderGeometry(0.06, 0.08, 6.8, 6); pl.translate(p.x, p.y + 3.4, p.z); poleG.push(paint(pl, '#a88a58')); }
      string(new T.Vector3(a.x, a.y + 6.5, a.z), new T.Vector3(b.x, b.y + 6.5, b.z), 0.9);
      string(new T.Vector3(a.x, a.y + 6.0, a.z), new T.Vector3(b.x, b.y + 6.0, b.z), 1.3);
    }
    for (const [s0, s1] of [[-40, 64], [730, 842]]) for (const side of [-1, 1]) {
      for (let s = s0; s < s1; s += 12) { const a = at(s, side * (RH + 1.15)), b = at(s + 12, side * (RH + 1.15)); string(new T.Vector3(a.x, a.y + 1.2, a.z), new T.Vector3(b.x, b.y + 1.2, b.z), 0.25); }
    }
    const flagGeo = (() => { // keep aFlap through the merge
      const merged = mergeGeos(flags);
      const af = new Float32Array(merged.attributes.position.count); let o = 0;
      for (const f of flags) { af.set(f.attributes.aFlap.array, o); o += 3; }
      merged.setAttribute('aFlap', new T.BufferAttribute(af, 1));
      return merged;
    })();
    const fm = new T.Mesh(flagGeo, flagM); fm.castShadow = true; scene.add(fm);
    batch.add(mergeGeos(poleG), paintM, null, 0);

    // flex banners on bamboo frames facing the road
    const bannerTex = [
      banner(['#7a1414', '#c62828'], [['வருக! வருக!', 92, '#ffe08a', 0.4], ['பொங்கல் ரேக்ளா பந்தயம்', 46, '#ffffff', 0.76]], '#f3a312'),
      banner(['#0d3c6e', '#1f6fb2'], [['முதல் பரிசு ₹25,000', 70, '#ffe08a', 0.42], ['இரண்டாம் பரிசு ₹15,000', 40, '#ffffff', 0.76]], '#fdd835'),
      banner(['#1b5e20', '#43a047'], [['காங்கேயம் காளைகள்', 76, '#ffffff', 0.42], ['ஊர் பொதுமக்கள் சார்பாக', 40, '#ffe08a', 0.76]], '#f3a312'),
      banner(['#4a148c', '#8e24aa'], [['ஸ்ரீ அய்யனார் துணை', 74, '#ffe08a', 0.44], ['தை திருவிழா', 44, '#ffffff', 0.78]], '#fdd835'),
    ];
    const bannerAt = (s, d, ti) => {
      const p = at(s, d), yaw = faceRoad(p.th, d) + (d < 0 ? 0.35 : -0.35);
      const g = new T.Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = yaw;
      const m = new T.Mesh(new T.PlaneGeometry(4.2, 1.4), new T.MeshStandardMaterial({ map: bannerTex[ti], roughness: 0.7, side: T.DoubleSide }));
      m.position.y = 2.6; m.castShadow = true; g.add(m);
      for (const x of [-2.15, 2.15]) { const pl = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 3.4, 5), paintM); pl.geometry = paint(pl.geometry, '#a88a58'); pl.position.set(x, 1.7, -0.05); g.add(pl); }
      scene.add(g);
    };
    bannerAt(-25, -(E + 4.5), 0); bannerAt(30, E + 4.5, 1); bannerAt(52, -(E + 4.5), 2);
    bannerAt(748, E + 4.5, 3); bannerAt(780, -(E + 4.5), 1); bannerAt(822, E + 4.5, 0);

    // judges' pandal: striped shamiana on four poles, table, chairs, mic
    const shamiana = textTex(256, 64, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = ['#c62828', '#fdd835'][i % 2]; g.fillRect(i * w / 8, 0, w / 8, h); } g.fillStyle = '#ffffff'; for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(i * 16 + 8, h, 8, Math.PI, 0); g.fill(); } });
    shamiana.wrapS = T.RepeatWrapping;
    const pandal = (s, d) => {
      const p = at(s, d), g = new T.Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = faceRoad(p.th, d);
      const parts = [];
      for (const [x, z] of [[-3.2, -2.4], [3.2, -2.4], [-3.2, 2.4], [3.2, 2.4]]) parts.push(paint(new T.CylinderGeometry(0.06, 0.07, 3.2, 6).translate(x, 1.6, z), '#cfc7b4'));
      parts.push(paint(new T.BoxGeometry(3.2, 0.78, 0.9).translate(0, 0.39, 0.6), '#f4f1ea'));
      for (let k = 0; k < 4; k++) parts.push(paint(new T.BoxGeometry(0.45, 0.9, 0.45).translate(-1.2 + k * 0.8, 0.45, -0.2), '#1e5bb8'));
      parts.push(paint(new T.CylinderGeometry(0.012, 0.012, 1.4, 4).translate(0.4, 1.0, 0.9), '#222'));
      const sg = mergeGeos(parts); const sm = new T.Mesh(sg, paintM); sm.castShadow = true; g.add(sm);
      const roofG = new T.ConeGeometry(4.7, 1.2, 4, 1, true); roofG.rotateY(Math.PI / 4); roofG.scale(1, 1, 0.75); roofG.translate(0, 3.8, 0);
      const roof = new T.Mesh(roofG, new T.MeshStandardMaterial({ map: shamiana, side: T.DoubleSide, roughness: 0.85 })); roof.castShadow = true; g.add(roof);
      scene.add(g);
    };
    pandal(18, -(E + 7.5)); pandal(812, E + 7.5);
    // horn loudspeakers on a tall pole
    const horns = (s, d) => {
      const p = at(s, d), yaw = faceRoad(p.th, d);
      const parts = [paint(new T.CylinderGeometry(0.06, 0.08, 7.5, 6).translate(0, 3.75, 0), '#9a9a92')];
      for (const a of [-0.7, 0.7]) { const h = new T.CylinderGeometry(0.32, 0.06, 0.7, 10, 1, true); h.rotateX(Math.PI / 2); h.rotateY(a); h.translate(Math.sin(a) * 0.3, 7.1, Math.cos(a) * 0.3); parts.push(paint(h, '#d8d4c8')); }
      batch.add(mergeGeos(parts), paintM, mat(p.x, p.y, p.z, yaw), s);
    };
    horns(10, -(E + 3.5)); horns(56, E + 3.5); horns(760, -(E + 3.5)); horns(828, E + 3.5);
    // Pongal pots boiling over on three-stone hearths, sugarcane leaning beside
    const pot = (s, d) => {
      const p = at(s, d), parts = [];
      const body = new T.SphereGeometry(0.32, 14, 10); body.scale(1, 0.9, 1); body.translate(0, 0.62, 0); parts.push(paint(body, '#a8552e'));
      parts.push(paint(new T.CylinderGeometry(0.2, 0.24, 0.16, 12).translate(0, 0.96, 0), '#a8552e'));
      parts.push(paint(new T.TorusGeometry(0.23, 0.03, 6, 16).rotateX(Math.PI / 2).translate(0, 0.9, 0), '#e9b42c'));
      for (let k = 0; k < 8; k++) { const l = new T.ConeGeometry(0.05, 0.3, 4); l.rotateZ(Math.PI); l.translate(0, 0.82, 0.24); l.rotateY(k / 8 * Math.PI * 2); parts.push(paint(l, '#5a8f2a')); }
      const foam = new T.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); foam.translate(0, 1.04, 0); parts.push(paint(foam, '#f6f1e4'));
      for (let k = 0; k < 3; k++) parts.push(paint(new T.BoxGeometry(0.22, 0.32, 0.18).translate(Math.cos(k * 2.1) * 0.32, 0.16, Math.sin(k * 2.1) * 0.32), '#8a4a2a'));
      for (let k = 0; k < 4; k++) { const c = new T.CylinderGeometry(0.03, 0.035, 2.2, 6); c.translate(0, 1.1, 0); c.rotateZ(0.2 * (k < 2 ? 1 : -1)); c.translate((k < 2 ? -0.75 : 0.75) + (k % 2) * 0.1, 0, -0.2); parts.push(paint(c, k % 2 ? '#6a2e4c' : '#7a8a3a')); }
      batch.add(mergeGeos(parts), paintM, mat(p.x, p.y, p.z, faceRoad(p.th, d)), s);
    };
    pot(8, -(E + 3.2)); pot(12, -(E + 3.6)); pot(806, E + 3.4);
    // a big coloured kolam on the start ground
    const kolTex = textTex(512, 512, (g, w, h) => {
      g.translate(w / 2, h / 2);
      const ring = (r, n, c, size) => { g.fillStyle = c; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g.beginPath(); g.ellipse(Math.cos(a) * r, Math.sin(a) * r, size, size * 0.45, a, 0, 7); g.fill(); } };
      g.fillStyle = '#f6efe2'; g.beginPath(); g.arc(0, 0, 240, 0, 7); g.fill();
      ring(200, 16, '#d81b60', 40); ring(150, 12, '#fdd835', 34); ring(100, 10, '#1e88e5', 28); ring(55, 8, '#43a047', 22);
      g.fillStyle = '#e65100'; g.beginPath(); g.arc(0, 0, 26, 0, 7); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 236, 0, 7); g.stroke();
    });
    const km = new T.Mesh(new T.CircleGeometry(2.2, 40), new T.MeshStandardMaterial({ map: kolTex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -4 }));
    const kp = at(-8, -(E + 5)); km.rotation.x = -Math.PI / 2; km.position.set(kp.x, kp.y + 0.06, kp.z); km.receiveShadow = true; scene.add(km);

    batch.flush(scene, true, true);
  };

  // excitement follows the player's cart and the race leader
  C.update = function (dt, carts) {
    if (!carts || !carts.length) return;
    const cp = R.camera.position;
    for (const m of C.meshes) { const b = m.geometry.boundingSphere; m.visible = cp.distanceTo(b.center) - b.radius < 230; }
    const p = carts.find(c => c.player), lead = carts.reduce((a, c) => (c.dist > a.dist ? c : a), carts[0]);
    if (p && p.m) C.focus.value.copy(p.m.grp.position);
    if (lead && lead.m) C.focus2.value.copy(lead.m.grp.position);
  };
})();
