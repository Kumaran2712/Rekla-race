// Camera spring rig and preset table (M1, audit section 3 H).
//
// Behind a flag: ?cam=v2 (or localStorage 'rekla-cam-v2' = '1'). Without it the game uses the original
// exponential-smoothing camera unchanged, so the two can be compared shot for shot.
//
// A critically damped spring per axis follows the target without overshoot. `freq` (rad/s) sets how
// tightly it follows; higher is stiffer.

const R = (window.R = window.R || {});
const T = () => window.THREE;

const params = R.params;
let flag = params.get('cam') === 'v2';
try { if (!params.has('cam') && localStorage.getItem('rekla-cam-v2') === '1') flag = true; } catch (e) { /* not stored */ }

// Chase presets: distances in metres, relative to the player cart along the track.
// v1 mirrors the original chase (game.js updateCamera) for reference; v2 is the lower, closer camera.
export const CHASE = {
  v1: { back: 8.3, backAtSpeed: -0.9, up: 3.75, upAtSpeed: -0.45, lookAhead: 10, lookUp: 1.15, latFollow: 0.62, latLook: 0.5, posFreq: 4.5, lookFreq: 6, rollIntoBends: 0.6, fovAtSpeed: 9 },
  v2: { back: 6.0, backAtSpeed: -0.5, up: 2.45, upAtSpeed: -0.25, lookAhead: 9, lookUp: 1.25, latFollow: 0.75, latLook: 0.55, posFreq: 6.5, lookFreq: 9, rollIntoBends: 0.45, fovAtSpeed: 11 },
};

export class Spring3 {
  constructor() { this.x = null; this.v = null; }
  reset(target) { this.x = target.clone(); this.v = new (T().Vector3)(); }
  update(target, freq, dt) {
    if (!this.x) { this.reset(target); return this.x; }
    // critically damped: x'' = -2w x' - w^2 (x - target), integrated in small sub-steps for stability
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n, w = freq;
    for (let i = 0; i < n; i++) {
      const ax = -2 * w * this.v.x - w * w * (this.x.x - target.x);
      const ay = -2 * w * this.v.y - w * w * (this.x.y - target.y);
      const az = -2 * w * this.v.z - w * w * (this.x.z - target.z);
      this.v.x += ax * h; this.v.y += ay * h; this.v.z += az * h;
      this.x.x += this.v.x * h; this.x.y += this.v.y * h; this.x.z += this.v.z * h;
    }
    return this.x;
  }
}

R.CameraRig = {
  get v2() { return flag; },
  set v2(on) { flag = !!on; try { localStorage.setItem('rekla-cam-v2', on ? '1' : '0'); } catch (e) { /* not stored */ } },
  CHASE,
  Spring3,
};
