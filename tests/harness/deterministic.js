// Injected by Playwright before any page script runs (page.addInitScript).
// Makes a build reproducible without changing its source:
//  - Math.random is a fixed-seed generator
//  - performance.now() is a virtual clock that only moves when the test steps a frame
//  - requestAnimationFrame callbacks are queued and run only by window.__frame()
// Real setTimeout is left alone so async loading still progresses between frames.
(() => {
  const seed = Number(new URLSearchParams(location.search).get('seed') || 12345);
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Re-seed mid-run (used right before a race starts, so race content does not depend on how many
  // random numbers the engine itself consumed while loading).
  window.__reseed = s => { a = s >>> 0; };

  let now = 1000;
  performance.now = () => now;

  let queue = [];
  let id = 0;
  window.requestAnimationFrame = cb => { queue.push(cb); return ++id; };
  window.cancelAnimationFrame = () => {};

  // Advance the virtual clock by dtMs and run every queued frame callback once.
  window.__frame = (dtMs = 1000 / 60) => {
    now += dtMs;
    const run = queue;
    queue = [];
    for (const cb of run) cb(now);
    return run.length;
  };
  window.__frames = (n, dtMs) => { for (let i = 0; i < n; i++) window.__frame(dtMs); };
  window.__harness = { seed };
})();
