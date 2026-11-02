// Fixed-timestep clock with render interpolation (M1, audit 7a).
//
// The simulation always advances in 1/60 s steps, whatever the display does. Each rendered frame runs
// as many steps as wall time requires, capped at MAX_STEPS; beyond the cap the backlog is dropped, so a
// slow device slows the game down instead of spiralling. `alpha` (0..1) says how far wall time is between
// the last two steps, for interpolating what is drawn.
//
// Times are DOMHighResTimeStamp milliseconds: the requestAnimationFrame timestamp and event.timeStamp
// share this clock, which is what makes timestamped input judgement possible.

const R = (window.R = window.R || {});

export const STEP_S = 1 / 60;
export const STEP_MS = 1000 / 60;
export const MAX_STEPS = 4;

export class FixedStepClock {
  constructor() {
    this.simWall = null;   // wall time (ms) the simulation has caught up to
    this.alpha = 0;
    this.droppedMs = 0;    // backlog thrown away by the cap (diagnostics)
    this.capHits = 0;
  }
  // Re-anchor to now: used on start, after a pause, a hidden tab or a lost graphics context.
  resync(now) { this.simWall = now; this.alpha = 0; }
  // Runs step(stepWallMs) as many times as needed for `now`. Returns the number of steps run.
  advance(now, step) {
    if (this.simWall === null) this.simWall = now;
    let n = 0;
    // tiny tolerance so 60 Hz frames land on exactly one step despite float rounding
    while (now - this.simWall >= STEP_MS - 1e-6 && n < MAX_STEPS) {
      this.simWall += STEP_MS;
      step(this.simWall);
      n++;
    }
    if (n === MAX_STEPS && now - this.simWall >= STEP_MS) {
      this.droppedMs += now - this.simWall;
      this.capHits++;
      this.simWall = now;
    }
    this.alpha = Math.min(1, Math.max(0, (now - this.simWall) / STEP_MS));
    return n;
  }
}

// Seeded random numbers for the simulation (mulberry32). A race gets its own seed, so a run can be
// replayed exactly in tests (?seed=N) while normal play still varies race to race.
export function seeded(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.seed = seed >>> 0;
  return next;
}

R.SimClock = { FixedStepClock, seeded, STEP_S, STEP_MS, MAX_STEPS };
