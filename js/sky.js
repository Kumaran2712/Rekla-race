/* Rekla Race · sky, sun, atmospheres
   A shader sky with drifting clouds, a shadow-casting sun that follows the action, image-based lighting
   baked from the sky (PMREM), and five race atmospheres that retune light, fog, wetness and haze. */
(function () {
  'use strict';
  const R = window.R, T = R.T, col = R.col;
  R.U.wet = { value: 0 };

  const deg = Math.PI / 180;
  const dir = (az, el) => new T.Vector3(Math.sin(az * deg) * Math.cos(el * deg), Math.sin(el * deg), -Math.cos(az * deg) * Math.cos(el * deg)).normalize();

  // az: degrees clockwise from straight ahead (−z); el: elevation
  R.PRESETS = {
    noon: {
      en: 'Summer afternoon', ta: 'கோடை மதியம்', sun: dir(-35, 56), sunCol: '#fff1dc', sunI: 3.1,
      zenith: '#4a82c4', horizon: '#cbd9e4', ground: '#857f5c', hemiSky: '#cfe0f5', hemiGround: '#7a6040', hemiI: 0.3, envI: 0.85,
      fog: { color: '#cdd8de', near: 140, far: 1150 }, cloud: 0.34, cloudCol: '#ffffff', cloudShade: '#b3bfcc', haze: 0.5, sunSize: 0.00045,
      exposure: 1.0, wet: 0, rain: 0, mist: 0, rays: 0.12, mtn: ['#4e6a4c', '#6a8099', '#8ea2b8'], mtnHaze: [0.28, 0.5, 0.68],
      grade: { sat: 1.06, warm: 0.02, contrast: 1.06, vig: 0.28 }, wind: 0.8,
    },
    golden: {
      en: 'Golden hour', ta: 'பொன் மாலை', sun: dir(38, 8.5), sunCol: '#ffae62', sunI: 2.7,
      zenith: '#3b5b8f', horizon: '#f0ad6a', ground: '#6a5640', hemiSky: '#ffcf9c', hemiGround: '#5a3e2c', hemiI: 0.26, envI: 0.75,
      fog: { color: '#e4a874', near: 90, far: 950 }, cloud: 0.3, cloudCol: '#ffd3a2', cloudShade: '#7a5f78', haze: 1.5, sunSize: 0.0009,
      exposure: 1.1, wet: 0, rain: 0, mist: 0.12, rays: 0.6, mtn: ['#5a4f55', '#7a6a78', '#a8888a'], mtnHaze: [0.3, 0.55, 0.72],
      grade: { sat: 1.1, warm: 0.07, contrast: 1.08, vig: 0.34 }, wind: 0.6,
    },
    monsoon: {
      en: 'Monsoon clouds', ta: 'மழை மேகம்', sun: dir(-20, 48), sunCol: '#dfe4e6', sunI: 0.75,
      zenith: '#59626c', horizon: '#98a1a4', ground: '#4c5345', hemiSky: '#b6c0c6', hemiGround: '#4a4a3a', hemiI: 0.55, envI: 1.05,
      fog: { color: '#9aa2a3', near: 25, far: 430 }, cloud: 0.97, cloudCol: '#a3abb0', cloudShade: '#58606a', haze: 0.15, sunSize: 0.0002,
      exposure: 1.18, wet: 0.65, rain: 1, mist: 0.3, rays: 0, mtn: ['#4e5a52', '#68737c', '#838d95'], mtnHaze: [0.6, 0.82, 0.92],
      grade: { sat: 0.92, warm: -0.03, contrast: 1.04, vig: 0.38 }, wind: 1.7,
    },
    rain: {
      en: 'After the rain', ta: 'மழைக்குப் பின்', sun: dir(-28, 33), sunCol: '#fff0d4', sunI: 2.5,
      zenith: '#4479bd', horizon: '#dbe5e8', ground: '#68765a', hemiSky: '#d2e2ef', hemiGround: '#55603e', hemiI: 0.35, envI: 1.0,
      fog: { color: '#d4dfe2', near: 90, far: 980 }, cloud: 0.58, cloudCol: '#ffffff', cloudShade: '#8d99a8', haze: 0.7, sunSize: 0.00055,
      exposure: 1.02, wet: 1, rain: 0, mist: 0.4, rays: 0.35, mtn: ['#3f5f40', '#587592', '#7f97b2'], mtnHaze: [0.22, 0.45, 0.62],
      grade: { sat: 1.16, warm: 0.0, contrast: 1.08, vig: 0.3 }, wind: 1.0,
    },
    mist: {
      en: 'Morning mist', ta: 'காலைப் பனி', sun: dir(-42, 13), sunCol: '#ffdcae', sunI: 1.7,
      zenith: '#98aec2', horizon: '#e6e1d6', ground: '#8a8a78', hemiSky: '#e6e4dc', hemiGround: '#6e6650', hemiI: 0.5, envI: 0.9,
      fog: { color: '#e0ddd2', density: 0.0102 }, cloud: 0.18, cloudCol: '#fff6ea', cloudShade: '#c8c2bc', haze: 1.2, sunSize: 0.0008,
      exposure: 1.04, wet: 0.3, rain: 0, mist: 1, rays: 0.85, mtn: ['#8f9690', '#a8aca8', '#c2c2bc'], mtnHaze: [0.9, 0.96, 0.99],
      grade: { sat: 0.95, warm: 0.04, contrast: 0.98, vig: 0.3 }, wind: 0.4,
    },
  };
  R.PRESET_ORDER = ['noon', 'golden', 'monsoon', 'rain', 'mist'];

  const skyVS = `varying vec3 vDir;
    void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
  const skyFS = `uniform vec3 uZenith, uHorizon, uGround, uSunDir, uSunCol, uCloudCol, uCloudShade;
    uniform float uCloud, uTime, uSunSize, uHaze;
    varying vec3 vDir;
    float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
    float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
    void main(){
      vec3 d = normalize(vDir); float y = d.y;
      vec3 c = mix(uHorizon, uZenith, pow(clamp(y, 0.0, 1.0), 0.42));
      c = mix(c, uGround, smoothstep(0.0, -0.1, y));
      float sd = max(dot(d, uSunDir), 0.0);
      c += uSunCol * (pow(sd, 5.0) * 0.22 * uHaze + pow(sd, 48.0) * 0.5 * (0.4 + uHaze));
      float disc = smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.5, sd);
      if (y > -0.02 && uCloud > 0.001) {
        vec2 uv = d.xz / (y + 0.1) * 1.4 + vec2(uTime * 0.006, uTime * 0.0025);
        float n = fbm(uv);
        float cov = smoothstep(1.0 - uCloud * 0.95, 1.0 - uCloud * 0.95 + 0.32, n);
        float n2 = fbm(uv * 1.7 + 3.1 - uSunDir.xz * 0.35);
        vec3 cc = mix(uCloudCol, uCloudShade, clamp(n2 * 1.5 - 0.35, 0.0, 1.0));
        cc += uSunCol * pow(sd, 10.0) * 0.7 * (1.0 - cov * 0.6);
        float fade = smoothstep(-0.02, 0.2, y);
        c = mix(c, cc, cov * fade);
        disc *= 1.0 - cov * fade * 0.97;
      }
      c += uSunCol * disc * 9.0;
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`;

  const Sky = R.Sky = {};
  Sky.init = function (renderer, scene) {
    this.renderer = renderer; this.scene = scene;
    this.uni = {
      uZenith: { value: new T.Color() }, uHorizon: { value: new T.Color() }, uGround: { value: new T.Color() },
      uSunDir: { value: new T.Vector3(0, 1, 0) }, uSunCol: { value: new T.Color() }, uCloudCol: { value: new T.Color() },
      uCloudShade: { value: new T.Color() }, uCloud: { value: 0.3 }, uTime: R.U.time, uSunSize: { value: 0.0005 }, uHaze: { value: 0.5 },
    };
    const mat = new T.ShaderMaterial({ uniforms: this.uni, vertexShader: skyVS, fragmentShader: skyFS, side: T.BackSide, depthWrite: false, fog: false });
    const geo = new T.SphereGeometry(1, 48, 24);
    this.mesh = new T.Mesh(geo, mat); this.mesh.scale.setScalar(1500); this.mesh.renderOrder = -10; this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    // separate small copy for baking the environment map
    this.envScene = new T.Scene();
    const envSky = new T.Mesh(geo, mat); envSky.scale.setScalar(40); this.envScene.add(envSky);
    this.pmrem = new T.PMREMGenerator(renderer);

    this.sun = new T.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const sm = R.Q.shadow;
    this.sun.shadow.mapSize.set(sm, sm);
    Object.assign(this.sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 260 });
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 2;
    scene.add(this.sun, this.sun.target);
    this.hemi = new T.HemisphereLight(0xffffff, 0x444444, 0.3);
    scene.add(this.hemi);
    this.mountainMats = [];
    this.groundMats = [];
    this.listeners = [];
  };

  Sky.apply = function (id) {
    const p = R.PRESETS[id] || R.PRESETS.noon;
    this.id = id; this.p = p;
    const u = this.uni;
    u.uZenith.value.copy(col(p.zenith)); u.uHorizon.value.copy(col(p.horizon)); u.uGround.value.copy(col(p.ground));
    u.uSunDir.value.copy(p.sun); u.uSunCol.value.copy(col(p.sunCol)); u.uCloudCol.value.copy(col(p.cloudCol));
    u.uCloudShade.value.copy(col(p.cloudShade)); u.uCloud.value = p.cloud; u.uSunSize.value = p.sunSize; u.uHaze.value = p.haze;
    this.sun.color.copy(col(p.sunCol)); this.sun.intensity = p.sunI;
    this.hemi.color.copy(col(p.hemiSky)); this.hemi.groundColor.copy(col(p.hemiGround)); this.hemi.intensity = p.hemiI;
    const fc = col(p.fog.color);
    this.scene.fog = p.fog.density ? new T.FogExp2(fc, p.fog.density) : new T.Fog(fc, p.fog.near, p.fog.far);
    this.scene.background = fc;
    this.renderer.toneMappingExposure = p.exposure;
    R.U.wet.value = p.wet; R.U.wind.value = p.wind;
    // mountains: blend each ridge layer toward the horizon colour for aerial perspective
    const hz = col(p.horizon), fogC = col(p.fog.color);
    this.mountainMats.forEach((m, i) => {
      const base = col(p.mtn[i] || p.mtn[p.mtn.length - 1]);
      m.color.copy(base).lerp(hz.clone().lerp(fogC, 0.5), p.mtnHaze[i] || 0.7);
    });
    // wet ground is darker
    this.groundMats.forEach(m => { m.color.setScalar(1 - p.wet * 0.22); });
    // re-bake image-based lighting from this sky
    const prevFog = this.scene.fog;
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(this.envScene, 0.03);
    this.scene.environment = this.envRT.texture;
    this.scene.fog = prevFog;
    this.envI = p.envI;
    this.scene.traverse(o => { if (o.material && o.material.isMeshStandardMaterial && !o.material.userData.fixedEnv) o.material.envMapIntensity = p.envI; });
    this.listeners.forEach(fn => fn(p, id));
  };

  // keep the sky centred on the camera and the shadow frustum on the action
  Sky.update = function (camera, focus) {
    this.mesh.position.copy(camera.position);
    const d = this.p.sun;
    this.sun.position.set(focus.x + d.x * 120, focus.y + d.y * 120, focus.z + d.z * 120);
    this.sun.target.position.copy(focus);
    this.sun.target.updateMatrixWorld();
  };
})();
