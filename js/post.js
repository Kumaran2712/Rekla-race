/* Rekla Race · post-processing (Phase 4)
   One full-screen pass: sun shafts (screen-space light scattering), speed blur toward the edges,
   per-atmosphere colour grade and vignette. Scene renders into a multisampled target on WebGL2. */
(function () {
  'use strict';
  const R = window.R, T = R.T;
  const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const fs = `uniform sampler2D tDiffuse; uniform vec2 uRes, uSun; uniform vec3 uRayCol;
    uniform float uSunVis, uRays, uSpeed, uSat, uWarm, uContrast, uVig, uSamples;
    varying vec2 vUv;
    void main(){
      vec2 uv = vUv;
      vec3 c = texture2D(tDiffuse, uv).rgb;
      if (uSpeed > 0.02) {
        vec2 dir = uv - vec2(0.5, 0.56);
        float k = uSpeed * 0.016 * smoothstep(0.18, 0.75, length(dir));
        vec3 acc = c;
        for (int i = 1; i < 6; i++) acc += texture2D(tDiffuse, uv - dir * k * float(i)).rgb;
        c = acc / 6.0;
      }
      if (uRays > 0.01 && uSunVis > 0.01) {
        vec2 d = (uv - uSun) * (0.85 / 16.0);
        vec2 p = uv; float illum = 0.0, decay = 1.0;
        for (int i = 0; i < 16; i++) {
          p -= d;
          float inside = step(abs(p.x - 0.5), 0.5) * step(abs(p.y - 0.5), 0.5);
          vec3 s = texture2D(tDiffuse, clamp(p, 0.0, 1.0)).rgb;
          illum += max(dot(s, vec3(0.333)) - 0.7, 0.0) * decay * inside;
          decay *= 0.93;
        }
        float fall = 1.0 - smoothstep(0.0, 0.9, length((uv - uSun) * vec2(uRes.x / uRes.y, 1.0)));
        c += uRayCol * illum * uRays * uSunVis * (0.35 + 0.65 * fall) * 0.5;
      }
      c = (c - 0.5) * uContrast + 0.5;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, uSat);
      c *= vec3(1.0 + uWarm, 1.0 + uWarm * 0.25, 1.0 - uWarm);
      float v = length((uv - 0.5) * vec2(uRes.x / uRes.y, 1.0));
      c *= 1.0 - uVig * smoothstep(0.32, 1.1, v);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`;

  const Post = R.Post = { enabled: true };
  Post.init = function (renderer) {
    const gl2 = renderer.capabilities.isWebGL2;
    const opts = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, depthBuffer: true, stencilBuffer: false };
    this.rt = gl2 ? new T.WebGLMultisampleRenderTarget(4, 4, opts) : new T.WebGLRenderTarget(4, 4, opts);
    if (gl2) this.rt.samples = R.Q.mobile ? 2 : 4;
    this.rt.texture.encoding = T.sRGBEncoding;
    this.u = {
      tDiffuse: { value: this.rt.texture }, uRes: { value: new T.Vector2(1, 1) }, uSun: { value: new T.Vector2(0.5, 0.5) },
      uRayCol: { value: new T.Color(1, 0.9, 0.7) }, uSunVis: { value: 0 }, uRays: { value: 0 }, uSpeed: { value: 0 },
      uSat: { value: 1 }, uWarm: { value: 0 }, uContrast: { value: 1 }, uVig: { value: 0.3 }, uSamples: { value: 16 },
    };
    this.mat = new T.ShaderMaterial({ uniforms: this.u, vertexShader: vs, fragmentShader: fs, depthTest: false, depthWrite: false });
    this.quad = new T.Mesh(new T.PlaneGeometry(2, 2), this.mat); this.quad.frustumCulled = false;
    this.qs = new T.Scene(); this.qs.add(this.quad);
    this.qc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.tmp = new T.Vector3(); this.fwd = new T.Vector3();
  };
  Post.resize = function (w, h, dpr) {
    if (!this.rt) return;
    this.rt.setSize(Math.round(w * dpr), Math.round(h * dpr));
    this.u.uRes.value.set(w, h);
  };
  Post.apply = function (p) {
    if (!this.u) return;
    this.u.uSat.value = p.grade.sat; this.u.uWarm.value = p.grade.warm; this.u.uContrast.value = p.grade.contrast; this.u.uVig.value = p.grade.vig;
    this.u.uRays.value = p.rays; this.u.uRayCol.value.set(p.sunCol);
  };
  Post.render = function (renderer, scene, camera, o) {
    // where is the sun on screen, and is it in front of us?
    const sd = R.Sky.p.sun;
    this.tmp.copy(camera.position).addScaledVector(sd, 1000).project(camera);
    camera.getWorldDirection(this.fwd);
    const facing = this.fwd.dot(sd);
    const off = Math.max(Math.abs(this.tmp.x), Math.abs(this.tmp.y));
    this.u.uSun.value.set(this.tmp.x * 0.5 + 0.5, this.tmp.y * 0.5 + 0.5);
    this.u.uSunVis.value = facing > 0 ? R.smooth(0.0, 0.35, facing) * (1 - R.smooth(1.1, 1.8, off)) : 0;
    this.u.uSpeed.value = o.speed > 0.55 ? (o.speed - 0.55) / 0.45 : 0;
    renderer.setRenderTarget(this.rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.qs, this.qc);
  };
})();
