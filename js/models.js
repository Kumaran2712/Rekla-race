/* Rekla Race · actor models (Phase 5)
   Kangayam bulls with a sculpted hump and dewlap, painted horns with brass caps, jointed legs;
   a light racing cart with spoked wheels, yoke, nose ropes to the driver's hands, contact shadows. */
(function () {
  'use strict';
  const R = window.R, T = R.T, col = R.col;
  const { clamp, lerp, smooth, paint, mergeGeos } = R;
  const std = (h, r = 0.85, m = 0, extra = {}) => new T.MeshStandardMaterial({ color: col(h), roughness: r, metalness: m, ...extra });
  const M = R.M = {};
  R.Models = {};
  const V3 = (x, y, z) => new T.Vector3(x, y, z);

  function mk(geo, mat, pos, scale, rot, parent, shadow = true) {
    const m = new T.Mesh(geo, mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = shadow; parent.add(m); return m;
  }
  R.mk = mk;

  const G = {};   // shared geometries
  // native breeds: stat multipliers are game design; looks follow TNAU breed notes
  R.BREEDS = {
    kangayam:   { en: 'Kangayam',   ta: 'காங்கேயம்',   tint: '#ffffff', scale: 1.0,  hornless: false, speed: 1.0,  stamina: 1.0,  accel: 1.0,  wet: 0.95, calm: 1.0,  power: 1.0,  note: 'The all-rounder' },
    bargur:     { en: 'Bargur',     ta: 'பர்கூர்',      tint: '#b8835a', scale: 0.95, hornless: false, speed: 1.06, stamina: 1.08, accel: 1.02, wet: 0.9,  calm: 0.72, power: 0.85, note: 'Fast and tireless, nervous near crowds' },
    umblachery: { en: 'Umblachery', ta: 'உம்பளச்சேரி', tint: '#c07a55', scale: 0.97, hornless: true,  speed: 0.96, stamina: 1.02, accel: 1.0,  wet: 1.18, calm: 1.05, power: 1.02, note: 'Sure-footed on wet ground' },
    ongole:     { en: 'Ongole',     ta: 'ஓங்கோல்',      tint: '#fbfaf6', scale: 1.13, hornless: false, speed: 0.97, stamina: 1.05, accel: 0.84, wet: 0.95, calm: 1.12, power: 1.32, note: 'Huge and strong, slow to start' },
  };
  R.BREED_ORDER = ['kangayam', 'bargur', 'umblachery', 'ongole'];
  // stats of a pair: averages, plus how unevenly the two pull
  R.pairStats = (a, b) => { const A = R.BREEDS[a], B = R.BREEDS[b], avg = k => (A[k] + B[k]) / 2;
    return { speed: avg('speed'), stamina: avg('stamina'), accel: avg('accel'), wet: avg('wet'), power: avg('power'), calm: Math.min(A.calm, B.calm), pull: B.speed - A.speed }; };
  R.Models.init = function () {
    Object.assign(M, {
      bull: std('#ffffff', 0.72, 0, { vertexColors: true }),
      cart: std('#ffffff', 0.6, 0.05, { vertexColors: true }),
      brass: std('#d1a640', 0.3, 0.9),
      rope: new T.LineBasicMaterial({ color: col('#3a2a1c') }),
      shadow: new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6 }),
      goat: std('#2a2320', 0.85), goatW: std('#efe8dc', 0.85), horn: std('#3a2c22', 0.55),
      cane: std('#5a2350', 0.6), leaf: std('#5f9a2e', 0.8, 0, { side: T.DoubleSide }),
    });
    M.breed = {}; for (const k in R.BREEDS) M.breed[k] = std(R.BREEDS[k].tint, 0.72, 0, { vertexColors: true });
    buildShared();
  };

  // ---------- bull ----------
  function bullBody() {
    const g = new T.SphereGeometry(1, 24, 16), p = g.attributes.position;
    const hide = col('#e8e3d9'), grey = col('#a7a29a'), dark = col('#6f6a64');
    const cl = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      let X = x * 0.37, Y = y * 0.43, Z = z * 0.96;
      X *= 1 - 0.14 * smooth(-0.2, 1, z);
      if (y < 0) Y *= 1 - 0.14 * smooth(-0.4, 1, z);
      const hw = Math.exp(-Math.pow((z + 0.5) / 0.22, 2)) * Math.max(0, y);
      Y += 0.32 * hw * hw; X *= 1 - 0.3 * hw * Math.max(0, y);
      const dw = Math.exp(-Math.pow((z + 0.78) / 0.2, 2)) * Math.max(0, -y);
      Y -= 0.24 * dw; X *= 1 - 0.55 * dw;
      p.setXYZ(i, X, Y + 1.12, Z);
      // Kangayam colouring: grey hump and shoulders, paler barrel, shadowed belly
      const c = hide.clone().lerp(grey, clamp(hw * 1.6 + smooth(-0.2, -0.9, z) * 0.55 * Math.max(0, y + 0.3), 0, 0.85));
      c.multiplyScalar(lerp(0.66, 1.03, smooth(-0.9, 0.5, y)));
      if (dw > 0.1) c.lerp(dark, 0.15);
      cl[i * 3] = c.r; cl[i * 3 + 1] = c.g; cl[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new T.BufferAttribute(cl, 3));
    g.computeVertexNormals();
    // neck
    const neck = new T.CylinderGeometry(0.18, 0.25, 0.5, 14, 2, true);
    neck.rotateX(-1.0); neck.translate(0, 1.36, -1.02);
    paint(neck, null, (x, y) => grey.clone().lerp(hide, 0.35).multiplyScalar(lerp(0.75, 1, smooth(1.15, 1.5, y))));
    return mergeGeos([g, neck]);
  }
  function bullHead(hornHex, hornless) {
    const parts = [];
    const hide = col('#ddd7cc'), muzzle = col('#3a332e'), horn = col(hornHex), white = col('#f2ede4'), brass = col('#d8ad44');
    const h = new T.SphereGeometry(1, 14, 10), p = h.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const t = smooth(-1, 1, -z); p.setXYZ(i, x * 0.14 * (1 - 0.25 * t), y * 0.16 * (1 - 0.15 * t), z * 0.3); }
    h.computeVertexNormals();
    paint(h, null, (x, y, z) => hide.clone().lerp(muzzle, smooth(-0.14, -0.26, z)).multiplyScalar(lerp(0.75, 1.05, smooth(-0.16, 0.12, y))));
    h.rotateX(-0.55); h.translate(0, -0.08, -0.2);
    parts.push(h);
    for (const s of [-1, 1]) {
      const ear = new T.SphereGeometry(1, 8, 6); ear.scale(0.04, 0.07, 0.11); ear.rotateZ(s * 1.2); ear.translate(s * 0.17, 0.02, -0.05); parts.push(paint(ear, '#cfc8bc'));
      const eye = new T.SphereGeometry(0.028, 8, 6); eye.translate(s * 0.115, 0.0, -0.2); parts.push(paint(eye, '#0d0b0a'));
      // horn: out, up and slightly forward; painted bands, brass cap
      const curve = new T.CatmullRomCurve3([V3(s * 0.06, 0.12, -0.02), V3(s * 0.22, 0.24, 0.0), V3(s * 0.3, 0.46, 0.06), V3(s * 0.24, 0.7, 0.14)]);
      const tube = new T.TubeGeometry(curve, 16, 0.045, 7);
      const tp = tube.attributes.position, uv = tube.attributes.uv;
      for (let i = 0; i < tp.count; i++) {   // taper
        const t = uv.getX(i), q = curve.getPoint(t), v = V3(tp.getX(i), tp.getY(i), tp.getZ(i)).sub(q).multiplyScalar(lerp(1.15, 0.35, t));
        tp.setXYZ(i, q.x + v.x, q.y + v.y, q.z + v.z);
      }
      tube.computeVertexNormals();
      paint(tube, null, (x, y, z, i) => { const t = uv.getX(i); if (t < 0.14) return hide.clone().multiplyScalar(0.8); if (t > 0.88) return brass; return ((t * 9) | 0) % 2 ? horn : white; });
      if (!hornless) { parts.push(tube); const tassel = new T.ConeGeometry(0.05, 0.16, 6); tassel.rotateX(Math.PI); tassel.translate(s * 0.24, 0.62, 0.14); parts.push(paint(tassel, '#e23b2a')); }
    }
    // forelock tuft between horns
    const tuft = new T.SphereGeometry(0.07, 8, 6); tuft.scale(1.4, 0.7, 1); tuft.translate(0, 0.13, -0.04); parts.push(paint(tuft, '#c9c2b6'));
    return mergeGeos(parts);
  }
  function leg(upper, len, r0, r1, hexTop, hexBot) {
    const g = new T.CylinderGeometry(r1, r0, len, 9, 2, true); g.translate(0, -len / 2, 0);
    paint(g, null, (x, y) => col(hexTop).lerp(col(hexBot), smooth(0, -len, y)));
    const parts = [g];
    if (upper) { const m = new T.SphereGeometry(1, 10, 8); m.scale(r0 * 1.15, len * 0.5, r0 * 1.45); m.translate(0, -len * 0.12, 0); parts.push(paint(m, null, (x, y) => col(hexTop).multiplyScalar(lerp(0.8, 1, smooth(-len * 0.5, 0, y))))); }
    else { const hoof = new T.CylinderGeometry(r1 * 1.05, r1 * 1.3, 0.09, 8); hoof.translate(0, -len - 0.02, 0); parts.push(paint(hoof, '#1d1814')); }
    return mergeGeos(parts);
  }
  function buildShared() {
    G.body = bullBody();
    G.fUp = leg(true, 0.46, 0.085, 0.06, '#d9d3c8', '#b8b2a8');
    G.fLo = leg(false, 0.47, 0.055, 0.042, '#b8b2a8', '#7d7770');
    G.hUp = leg(true, 0.5, 0.11, 0.065, '#d9d3c8', '#b8b2a8');
    G.hLo = leg(false, 0.45, 0.055, 0.042, '#b8b2a8', '#7d7770');
    const tail = new T.CylinderGeometry(0.018, 0.03, 0.78, 5); tail.translate(0, -0.39, 0);
    const tuft = new T.SphereGeometry(1, 7, 6); tuft.scale(0.05, 0.12, 0.05); tuft.translate(0, -0.82, 0);
    G.tail = mergeGeos([paint(tail, '#bdb6aa'), paint(tuft, '#262220')]);
    // racing cart wheel: 12 spokes, felloes, iron tyre, brass hub
    const W = R.WHEEL_R = 0.68;
    const w = [];
    const tyre = new T.TorusGeometry(W, 0.035, 6, 36); tyre.rotateY(Math.PI / 2); w.push(paint(tyre, '#2c2c2e'));
    const fel = new T.TorusGeometry(W - 0.06, 0.05, 6, 36); fel.rotateY(Math.PI / 2); w.push(paint(fel, '#6b3f1f'));
    const hub = new T.CylinderGeometry(0.1, 0.12, 0.26, 12); hub.rotateZ(Math.PI / 2); w.push(paint(hub, '#4e2e16'));
    for (let i = 0; i < 12; i++) { const sp = new T.CylinderGeometry(0.018, 0.026, W - 0.1, 5); sp.translate(0, (W - 0.1) / 2 + 0.06, 0); sp.rotateX(i / 12 * Math.PI * 2); w.push(paint(sp, '#7a4a24')); }
    G.wheel = mergeGeos(w);
    const cap = new T.CylinderGeometry(0.075, 0.075, 0.3, 10); cap.rotateZ(Math.PI / 2); G.cap = cap;
    // motion-blur disc for fast-spinning spokes
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 8, 64, 64, 62); grd.addColorStop(0, 'rgba(90,55,30,.85)'); grd.addColorStop(0.85, 'rgba(110,70,40,.55)'); grd.addColorStop(1, 'rgba(110,70,40,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
    G.blurTex = new T.CanvasTexture(c);
    G.blur = new T.CircleGeometry(W - 0.07, 24); G.blur.rotateY(Math.PI / 2);
  }

  function makeBull(headGeo, mat) {
    mat = mat || M.bull;
    const g = new T.Group(), torso = new T.Group(); g.add(torso);
    mk(G.body, mat, null, null, null, torso);
    const head = new T.Group(); head.position.set(0, 1.5, -1.2); torso.add(head);
    mk(headGeo, mat, null, null, null, head);
    const legs = [];
    for (const [x, y, z, front] of [[-0.17, 0.95, -0.56, 1], [0.17, 0.95, -0.56, 1], [-0.17, 0.97, 0.62, 0], [0.17, 0.97, 0.62, 0]]) {
      const up = new T.Group(); up.position.set(x, y, z); g.add(up);
      mk(front ? G.fUp : G.hUp, mat, null, null, null, up);
      const lo = new T.Group(); lo.position.set(0, front ? -0.46 : -0.5, 0); up.add(lo);
      mk(front ? G.fLo : G.hLo, mat, null, null, null, lo, false);
      legs.push({ up, lo, front });
    }
    const tail = new T.Group(); tail.position.set(0, 1.3, 0.95); torso.add(tail);
    mk(G.tail, mat, null, null, null, tail, false);
    return { g, torso, head, legs, tail };
  }
  // gallop: diagonal pairs, knees fold on the swing
  R.animBull = function (b, ph, sn) {
    const amp = 0.1 + 0.55 * sn, off = [0, 0.5, Math.PI + 0.2, Math.PI + 0.7];
    b.legs.forEach((l, i) => {
      const a = ph + off[i];
      l.up.rotation.x = Math.sin(a) * amp;
      const lift = Math.max(0, Math.cos(a)) * amp * 1.6;
      l.lo.rotation.x = l.front ? lift : -lift * 0.8;
    });
    b.torso.position.y = Math.abs(Math.sin(ph)) * 0.08 * sn;
    b.torso.rotation.x = Math.sin(ph) * 0.04 * sn;
    b.head.rotation.x = Math.sin(ph + 1) * 0.16 * sn - 0.05;
    b.tail.rotation.x = 0.3 + sn * 0.7 + Math.sin(ph * 0.5) * 0.2;
    b.tail.rotation.z = Math.sin(ph * 0.7) * 0.15;
  };

  // ---------- cart ----------
  function cartStatic(d) {
    const p = [], brass = [];
    const body = col(d.body), trim = col('#f4ead2'), wood = col('#6b3f1f'), woodD = col('#4a2a14'), gold = col('#e8b84a');
    const box = (w, h, dd, x, y, z, c) => { const g = new T.BoxGeometry(w, h, dd); g.translate(x, y, z); p.push(paint(g, c)); };
    box(1.18, 0.07, 1.55, 0, 1.0, -0.1, body);                       // platform
    box(1.2, 0.025, 1.57, 0, 1.045, -0.1, trim);
    for (const s of [-1, 1]) {
      box(0.05, 0.2, 1.55, s * 0.6, 1.14, -0.1, body);               // side rails
      box(0.055, 0.04, 1.56, s * 0.6, 1.2, -0.1, gold);
      box(0.06, 0.03, 1.56, s * 0.6, 1.08, -0.1, trim);
      box(0.08, 0.55, 0.08, s * 0.5, 0.75, 0.05, woodD);             // axle blocks
    }
    box(1.2, 0.2, 0.05, 0, 1.14, 0.66, body);
    box(1.21, 0.035, 0.06, 0, 1.2, 0.66, gold);
    box(0.62, 0.1, 0.5, 0, 1.1, -0.42, col('#8e1f2b'));               // seat cushion
    const ax = new T.CylinderGeometry(0.04, 0.04, 2.05, 8); ax.rotateZ(Math.PI / 2); ax.translate(0, R.WHEEL_R, 0.05); p.push(paint(ax, '#2c2c2e'));
    // central pole to the yoke
    const a = V3(0, 1.0, -0.85), b = V3(0, 1.42, -3.62);
    const pole = new T.CylinderGeometry(0.045, 0.065, a.distanceTo(b), 8); pole.rotateX(Math.PI / 2);
    pole.lookAt(b.clone().sub(a)); pole.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    p.push(paint(pole, wood));
    for (let k = 0; k < 5; k++) { const r = new T.TorusGeometry(0.07, 0.012, 5, 10); r.translate(0, lerp(a.y, b.y, 0.25 + k * 0.12), lerp(a.z, b.z, 0.25 + k * 0.12)); p.push(paint(r, k % 2 ? body : trim)); }
    box(1.8, 0.1, 0.14, 0, 1.47, -3.62, woodD);                       // yoke
    for (const s of [-1, 1]) {
      box(0.04, 0.42, 0.04, s * 0.32, 1.32, -3.62, woodD);            // neck pegs
      box(0.04, 0.42, 0.04, s * 0.8, 1.32, -3.62, woodD);
      const tie = new T.TorusGeometry(0.27, 0.03, 6, 16); tie.rotateX(Math.PI / 2 - 0.45); tie.translate(s * 0.56, 1.34, -3.58); p.push(paint(tie, '#8a6a3a'));
      const belt = new T.TorusGeometry(0.25, 0.035, 6, 16); belt.rotateX(Math.PI / 2 - 0.9); belt.translate(s * 0.56, 1.24, -3.72); p.push(paint(belt, d.turban));
      brass.push(new T.SphereGeometry(0.07, 8, 6).translate(s * 0.56, 1.0, -3.88));          // neck bell
      brass.push(new T.SphereGeometry(0.035, 6, 5).translate(s * 0.9, 1.47, -3.62));        // yoke knobs
    }
    for (const [x, z] of [[-0.6, -0.86], [0.6, -0.86], [-0.6, 0.66], [0.6, 0.66]]) brass.push(new T.SphereGeometry(0.045, 8, 6).translate(x, 1.24, z));
    // pennant on a cane pole at the back
    const fp = new T.CylinderGeometry(0.012, 0.016, 1.3, 5); fp.translate(0.52, 1.85, 0.6); p.push(paint(fp, '#c9b38e'));
    const flag = new T.BufferGeometry(); flag.setAttribute('position', new T.Float32BufferAttribute([0.52, 2.48, 0.6, 0.52, 2.2, 0.6, 0.52, 2.34, 1.12], 3)); flag.computeVertexNormals();
    p.push(paint(flag, d.turban));
    return { geo: mergeGeos(p), brass: mergeGeos(brass) };
  }
  function driverGeo(d) {
    const p = [];
    const shirt = col('#f4efe6'), veshti = col('#efe9dc'), skin = col('#7a4a2a'), towel = col(d.turban);
    const torso = new T.CylinderGeometry(0.15, 0.2, 0.55, 10); torso.rotateX(-0.35); torso.translate(0, 0.42, 0.02); p.push(paint(torso, shirt));
    const hips = new T.SphereGeometry(1, 10, 8); hips.scale(0.22, 0.13, 0.24); hips.translate(0, 0.1, 0.05); p.push(paint(hips, veshti));
    for (const s of [-1, 1]) { const th = new T.CylinderGeometry(0.075, 0.07, 0.42, 7); th.rotateX(Math.PI / 2 - 0.15); th.translate(s * 0.11, 0.08, -0.17); p.push(paint(th, veshti)); const sh = new T.CylinderGeometry(0.055, 0.045, 0.38, 6); sh.translate(s * 0.11, -0.1, -0.38); p.push(paint(sh, skin)); }
    const head = new T.SphereGeometry(0.115, 12, 10); head.translate(0, 0.83, -0.1); p.push(paint(head, skin));
    const tur = new T.TorusGeometry(0.1, 0.05, 8, 14); tur.rotateX(Math.PI / 2); tur.translate(0, 0.91, -0.1); p.push(paint(tur, towel));
    const tt = new T.SphereGeometry(0.1, 10, 6); tt.scale(1, 0.55, 1); tt.translate(0, 0.95, -0.1); p.push(paint(tt, towel));
    const tail = new T.ConeGeometry(0.05, 0.22, 6); tail.rotateX(-2.2); tail.translate(0.07, 0.9, 0.04); p.push(paint(tail, towel));
    // left arm reaching forward with the nose ropes
    const la = new T.CylinderGeometry(0.045, 0.04, 0.52, 6); la.translate(0, -0.26, 0); la.rotateX(1.25); la.translate(-0.19, 0.62, -0.05); p.push(paint(la, shirt));
    const lh = new T.SphereGeometry(0.045, 6, 5); lh.translate(-0.19, 0.46, -0.54); p.push(paint(lh, skin));
    return mergeGeos(p);
  }
  function whipArmGeo() {
    const p = [];
    const a = new T.CylinderGeometry(0.045, 0.04, 0.5, 6); a.translate(0, -0.25, 0); p.push(paint(a, '#f4efe6'));
    const h = new T.SphereGeometry(0.045, 6, 5); h.translate(0, -0.5, 0); p.push(paint(h, '#7a4a2a'));
    return mergeGeos(p);
  }

  R.Models.cart = function (d, scene, breeds) {
    breeds = breeds || d.breeds || ['kangayam', 'kangayam'];
    const grp = new T.Group(); grp.rotation.order = 'YXZ'; grp.userData.tag = 'cart';
    // Resources this cart owns are disposed with it; bull heads are shared through the AssetCache
    // (keyed by horn paint and horn type) and released when the last cart using them goes.
    const heads = {}, owned = [], assetKeys = [];
    const bulls = [-0.56, 0.56].map((x, i) => {
      const br = R.BREEDS[breeds[i]] || R.BREEDS.kangayam;
      const key = br.hornless ? 'h' : 'n';
      if (!heads[key]) { const ak = `bullHead:${key}:${d.body}`; heads[key] = R.Assets.acquire(ak, () => bullHead(d.body, br.hornless)); assetKeys.push(ak); }
      const b = makeBull(heads[key], M.breed[breeds[i]] || M.bull);
      b.g.position.set(x, 0, -2.6); b.g.scale.setScalar(br.scale); b.g.position.y = 0;
      grp.add(b.g); return b;
    });
    const st = cartStatic(d);
    owned.push(st.geo, st.brass);
    mk(st.geo, M.cart, null, null, null, grp);
    mk(st.brass, M.brass, null, null, null, grp, false);
    const blurMat = new T.MeshBasicMaterial({ map: G.blurTex, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide });
    owned.push(blurMat);
    const wheels = [-1, 1].map(s => {
      const w = new T.Group(); w.position.set(s * 0.95, R.WHEEL_R, 0.05); grp.add(w);
      mk(G.wheel, M.cart, null, null, null, w);
      mk(G.cap, M.brass, null, null, null, w, false);
      const bl = mk(G.blur, blurMat, [s * 0.02, 0, 0], null, null, grp, false); bl.position.set(s * 0.97, R.WHEEL_R, 0.05);
      return w;
    });
    const drv = new T.Group(); drv.position.set(0, 1.12, -0.38); grp.add(drv);
    const dGeo = driverGeo(d); owned.push(dGeo);
    mk(dGeo, M.cart, null, null, null, drv);
    const rArm = new T.Group(); rArm.position.set(0.2, 0.62, 0.0); drv.add(rArm);
    const aGeo = whipArmGeo(); owned.push(aGeo);
    mk(aGeo, M.cart, null, null, null, rArm, false);
    // soft contact shadow under the team
    const sh = new T.Mesh(new T.PlaneGeometry(2.6, 6.2), M.shadow); owned.push(sh.geometry); sh.rotation.x = -Math.PI / 2; sh.position.set(0, 0.04, -1.5); grp.add(sh);
    // nose ropes from each bull's muzzle to the driver's hand
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(new Float32Array(2 * 9 * 2 * 3), 3));
    const ropes = new T.LineSegments(rg, M.rope); ropes.frustumCulled = false; scene.add(ropes); owned.push(rg);
    scene.add(grp);
    const hand = V3(-0.19, 0.46, -0.56), muzzle = V3(0, -0.2, -0.48);
    const A = V3(), B = V3(), Q = V3();
    const upd = (c, dt) => {
      rArm.rotation.x = c.whip > 0 ? 1.1 + Math.sin(c.whip * 30) * 0.9 : 0.9;
      if (!M.shadow.map && R.dotTex) { M.shadow.map = R.dotTex; M.shadow.needsUpdate = true; }
      blurMat.opacity = clamp((c.v - 5) / 9, 0, 0.8);
      drv.localToWorld(A.copy(hand));
      const arr = rg.attributes.position.array; let o = 0;
      for (const b of bulls) {
        b.head.localToWorld(B.copy(muzzle));
        for (let k = 0; k < 9; k++) {
          for (const t of [k / 9, (k + 1) / 9]) {
            Q.copy(A).lerp(B, t); Q.y -= Math.sin(Math.PI * t) * 0.12;
            arr[o++] = Q.x; arr[o++] = Q.y; arr[o++] = Q.z;
          }
        }
      }
      rg.attributes.position.needsUpdate = true;
    };
    const dispose = () => {
      scene.remove(grp); scene.remove(ropes);
      owned.forEach(o => o.dispose()); owned.length = 0;
      assetKeys.forEach(k => R.Assets.release(k)); assetKeys.length = 0;
    };
    return { grp, bulls, wheels, rArm, upd, ropes, drv, breeds, dispose };
  };

  // ---------- the saarathi on foot (thrown off, chasing his cart) ----------
  R.Models.runner = function (scene, turbanHex) {
    const g = new T.Group(); g.rotation.order = 'YXZ';
    const body = new T.Group(); g.add(body);
    const P = [];
    P.push(paint(new T.CylinderGeometry(0.15, 0.17, 0.55, 8).translate(0, 1.18, 0), '#f4efe6'));
    P.push(paint(new T.SphereGeometry(0.12, 10, 8).translate(0, 1.58, 0), '#7a4a2a'));
    P.push(paint(new T.TorusGeometry(0.1, 0.05, 6, 12).rotateX(Math.PI / 2).translate(0, 1.66, 0), turbanHex));
    P.push(paint(new T.SphereGeometry(0.2, 8, 6).scale(1, 0.6, 1).translate(0, 0.9, 0), '#efe9dc'));
    mk(mergeGeos(P), M.cart, null, null, null, body);
    const limb = (len, r, hex) => paint(new T.CylinderGeometry(r, r * 0.85, len, 6).translate(0, -len / 2, 0), hex);
    const legG = limb(0.85, 0.07, '#efe9dc'), armG = limb(0.55, 0.045, '#7a4a2a');
    const legs = [-0.09, 0.09].map(x => { const pv = new T.Group(); pv.position.set(x, 0.88, 0); body.add(pv); mk(legG, M.cart, null, null, null, pv); return pv; });
    const arms = [-0.2, 0.2].map(x => { const pv = new T.Group(); pv.position.set(x, 1.4, 0); body.add(pv); mk(armG, M.cart, null, null, null, pv); return pv; });
    g.visible = false; scene.add(g);
    const anim = (ph, amp, lean) => {
      legs[0].rotation.x = Math.sin(ph) * amp; legs[1].rotation.x = -Math.sin(ph) * amp;
      arms[0].rotation.x = -Math.sin(ph) * amp * 0.9; arms[1].rotation.x = Math.sin(ph) * amp * 0.9;
      body.rotation.x = -lean; body.position.y = Math.abs(Math.sin(ph)) * 0.06 * amp;
    };
    return { g, anim };
  };

  // ---------- obstacles ----------
  const SPH = new T.SphereGeometry(1, 16, 12);
  R.Models.goat = function (scene) {
    const g = new T.Group();
    if (!G.goat) {
      const e = (sx, sy, sz, x, y, z, c, rx = 0, rz = 0) => { const q = new T.SphereGeometry(1, 12, 9); q.scale(sx, sy, sz); q.rotateX(rx); q.rotateZ(rz); q.translate(x, y, z); return paint(q, c); };
      const parts = [e(0.18, 0.2, 0.38, 0, 0.55, 0, '#2a2320'), e(0.15, 0.15, 0.18, 0, 0.52, 0.15, '#efe8dc'), e(0.1, 0.12, 0.16, 0, 0.72, -0.42, '#2a2320', 0.3)];
      for (const s of [-1, 1]) { parts.push(e(0.03, 0.06, 0.09, s * 0.1, 0.74, -0.38, '#efe8dc', 0, s * 1.1)); const h = new T.ConeGeometry(0.025, 0.16, 5); h.rotateX(-0.5); h.translate(s * 0.05, 0.86, -0.36); parts.push(paint(h, '#3a2c22')); }
      G.goat = mergeGeos(parts);
      G.goatLeg = paint(new T.CylinderGeometry(0.03, 0.022, 0.44, 5).translate(0, -0.22, 0), '#2a2320');
    }
    mk(G.goat, M.cart, null, null, null, g);
    const legs = [];
    for (const [x, z] of [[-0.1, -0.22], [0.1, -0.22], [-0.1, 0.24], [0.1, 0.24]]) { const pv = new T.Group(); pv.position.set(x, 0.44, z); g.add(pv); mk(G.goatLeg, M.cart, null, null, null, pv, false); legs.push(pv); }
    g.rotation.order = 'YXZ'; g.userData.tag = 'goat'; scene.add(g);
    return { g, legs, dispose: () => {} };   // goat geometry is shared for the whole session
  };
  R.Models.cane = function (scene) {
    const g = new T.Group();
    if (!G.caneBundle) {
      const parts = [];
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2, m4 = new T.Matrix4().compose(V3(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08), new T.Quaternion().setFromEuler(new T.Euler(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12)), V3(1, 1, 1));
        parts.push(paint(new T.CylinderGeometry(0.035, 0.04, 1.7, 6).translate(0, 0.85, 0), null, (x, y) => col(y > 0.4 && (y * 5) % 1 < 0.1 ? '#3a1630' : '#5a2350')).applyMatrix4(m4));
        parts.push(paint(new T.ConeGeometry(0.12, 0.5, 5).translate(0, 1.85, 0), '#5f9a2e').applyMatrix4(m4));
      }
      G.caneBundle = mergeGeos(parts);
    }
    mk(G.caneBundle, M.cart, null, null, null, g);
    const rr = R.Assets.acquire('caneRing', () => ({ geo: new T.TorusGeometry(0.85, 0.035, 6, 32), mat: new T.MeshBasicMaterial({ color: col('#ffb21a') }) }));
    const ring = mk(rr.geo, rr.mat, [0, 0.05, 0], null, [Math.PI / 2, 0, 0], g, false);
    g.rotation.order = 'YXZ'; g.userData.tag = 'cane'; scene.add(g);
    return { g, ring, dispose: () => R.Assets.release('caneRing') };
  };
  let holeMats = null;
  R.Models.hole = function (type, scene) {
    if (!holeMats) holeMats = {
      pot: std('#3a1808', 0.95, 0, { polygonOffset: true, polygonOffsetFactor: -3 }),
      potRim: std('#8a4422', 0.95, 0, { polygonOffset: true, polygonOffsetFactor: -2 }),
      pud: std('#5d6c68', 0.04, 0.2, { polygonOffset: true, polygonOffsetFactor: -3 }),
      pudRim: std('#6e4526', 0.9, 0, { polygonOffset: true, polygonOffsetFactor: -2 }),
    };
    const g = new T.Group(), wet = type === 'puddle', key = 'holeGeo:' + type;
    const hg = R.Assets.acquire(key, () => [new T.CircleGeometry(wet ? 1.05 : 0.95, 24), new T.CircleGeometry(wet ? 0.9 : 0.7, 24)]);
    const rim = new T.Mesh(hg[0], wet ? holeMats.pudRim : holeMats.potRim);
    const core = new T.Mesh(hg[1], wet ? holeMats.pud : holeMats.pot);
    for (const m of [rim, core]) { m.rotation.x = -Math.PI / 2; m.receiveShadow = true; g.add(m); }
    rim.position.y = 0.012; core.position.y = 0.018;
    g.scale.set(1, 1, wet ? 0.7 : 0.62);
    g.rotation.order = 'YXZ'; g.userData.tag = 'hole'; scene.add(g);
    return { g, dispose: () => R.Assets.release(key) };
  };
})();
