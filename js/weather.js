/* Rekla Race · weather and ambient life (Phase 4)
   Monsoon rain streaks, drifting ground mist, and kites circling over the fields. */
(function () {
  'use strict';
  const R = window.R, T = R.T;
  const W = R.Weather = {};

  const rainVS = `attribute float aEnd; uniform float uTime; uniform vec3 uCam; uniform float uLen;
    varying float vA;
    void main(){
      vec3 p = position;
      vec2 xz = mod(p.xz - uCam.xz, 46.0) + uCam.xz - 23.0;
      float y = mod(p.y - uTime * 15.0, 24.0) + uCam.y - 9.0;
      vec3 w = vec3(xz.x, y, xz.y) + aEnd * vec3(0.12, uLen, 0.05);
      vA = 1.0 - aEnd * 0.8;
      gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
    }`;
  const rainFS = `uniform float uAlpha; varying float vA; void main(){ gl_FragColor = vec4(0.78, 0.82, 0.86, uAlpha * vA); }`;

  W.build = function (scene) {
    // rain
    const n = R.Q.mobile ? 1400 : 2600, pos = new Float32Array(n * 6), end = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 46, y = Math.random() * 24, z = Math.random() * 46;
      pos.set([x, y, z, x, y, z], i * 6); end[i * 2] = 0; end[i * 2 + 1] = 1;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aEnd', new T.BufferAttribute(end, 1));
    this.rainU = { uTime: R.U.time, uCam: { value: new T.Vector3() }, uLen: { value: 0.8 }, uAlpha: { value: 0.35 } };
    this.rain = new T.LineSegments(g, new T.ShaderMaterial({ uniforms: this.rainU, vertexShader: rainVS, fragmentShader: rainFS, transparent: true, depthWrite: false }));
    this.rain.frustumCulled = false; this.rain.visible = false; scene.add(this.rain);

    // ground mist
    this.mist = [];
    for (let i = 0; i < 34; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: R.dotTex, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0, fog: true }));
      s.userData = { s: Math.random() * 300 - 40, d: (Math.random() - 0.5) * 160, h: 1.5 + Math.random() * 4, sc: 30 + Math.random() * 40, ph: Math.random() * 6 };
      s.visible = false; scene.add(s); this.mist.push(s);
    }

    // kites circling over the fields (one draw call, updated on the CPU)
    this.birdN = 12;
    const bp = new Float32Array(this.birdN * 9 * 2);
    const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(bp, 3));
    this.birds = new T.Mesh(bg, new T.MeshBasicMaterial({ color: 0x2a2420, side: T.DoubleSide }));
    this.birds.frustumCulled = false; scene.add(this.birds);
    this.birdData = Array.from({ length: this.birdN }, (_, i) => ({ c: 80 + i * 60 + Math.random() * 30, d: (Math.random() - 0.5) * 120, r: 18 + Math.random() * 30, h: 28 + Math.random() * 25, ph: Math.random() * 6, sp: 0.15 + Math.random() * 0.12, fl: Math.random() * 6 }));
    this.p = { rain: 0, mist: 0 };
  };

  W.apply = function (p) {
    this.p = p;
    this.rain.visible = p.rain > 0;
    this.rainU.uAlpha.value = 0.55 * p.rain;
    const fc = R.col(p.fog.color);
    this.mist.forEach(s => { s.material.color.copy(fc).lerp(new T.Color(1, 1, 1), 0.35); s.visible = p.mist > 0; });
    this.birds.material.color.set(p.rain ? '#3a3a38' : '#2a2420');
  };

  const F = {}, v = new T.Vector3();
  W.update = function (dt, camera, P, t) {
    if (!this.rain) return;
    this.rainU.uCam.value.copy(camera.position);
    const base = P ? P.dist : 0;
    if (this.p.mist > 0) {
      for (const s of this.mist) {
        const u = s.userData;
        if (u.s < base - 60) { u.s += 330; u.d = (Math.random() - 0.5) * 160; }
        if (Math.abs(u.d) < 9) u.d = Math.sign(u.d || 1) * (9 + Math.random() * 10);
        R.frame(u.s, F);
        const x = F.x + Math.cos(F.th) * u.d, z = F.z + Math.sin(F.th) * u.d;
        s.position.set(x + Math.sin(t * 0.05 + u.ph) * 4, R.groundAt(x, z) + u.h, z);
        s.scale.set(u.sc, u.sc * 0.32, 1);
        s.material.opacity = this.p.mist * 0.32 * (0.7 + 0.3 * Math.sin(t * 0.2 + u.ph));
      }
    }
    // birds
    const pa = this.birds.geometry.attributes.position, a = pa.array;
    let o = 0;
    for (const b of this.birdData) {
      R.frame(b.c, F);
      const ang = t * b.sp + b.ph;
      const cx = F.x + Math.cos(F.th) * b.d + Math.cos(ang) * b.r, cz = F.z + Math.sin(F.th) * b.d + Math.sin(ang) * b.r, cy = F.y + b.h + Math.sin(ang * 2) * 2;
      const hx = -Math.sin(ang), hz = Math.cos(ang);          // heading (tangent of the circle)
      const sx = -hz, sz = hx;                                 // wing direction
      const flap = Math.sin(t * 5 + b.fl) * 0.35 + (Math.sin(ang * 3) > 0.6 ? 0 : 0.1);
      for (const side of [-1, 1]) {
        const tipx = cx + sx * side * 0.9, tipz = cz + sz * side * 0.9, tipy = cy + flap;
        a.set([cx + hx * 0.25, cy, cz + hz * 0.25, cx - hx * 0.2, cy, cz - hz * 0.2, tipx - hx * 0.15, tipy, tipz - hz * 0.15], o); o += 9;
      }
    }
    pa.needsUpdate = true;
  };
})();
