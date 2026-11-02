// Test options for the build, read once at load.
//
// Normal URLs use a query string: ?stats=1&tier=2&autoplay=1&seed=7&cam=v2
// The private Claude preview page passes only a plain #name to the game (no query, no '=' or '&'),
// so the same options can also be written as hyphen-separated words in the hash:
//   #stats-autoplay  #stats-tier2  #stats-leaktest  #stats-losecontext  #camv2-seed7
// Words: stats, autoplay, leaktest, losecontext, camv2, tier0..tier5, seedN.

const R = (window.R = window.R || {});
const p = new URLSearchParams(location.search);
const hash = (location.hash || '').replace(/^#/, '');
if (/^[a-z0-9-]+$/i.test(hash)) {
  for (const w of hash.toLowerCase().split('-')) {
    if (['stats', 'autoplay', 'leaktest', 'losecontext'].includes(w)) p.set(w, '1');
    else if (w === 'camv2') p.set('cam', 'v2');
    else if (/^tier[0-5]$/.test(w)) p.set('tier', w.slice(4));
    else if (/^seed\d+$/.test(w)) p.set('seed', w.slice(4));
  }
}
R.params = p;
export default p;
