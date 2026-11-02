// AssetCache: shared GPU resources with reference counting (M1, audit 7a "Memory disposal").
//
//   const geo = R.Assets.acquire('bullHead:n:#c8321c', () => bullHead(...));   // build once, count +1
//   R.Assets.release('bullHead:n:#c8321c');                                     // count -1, dispose at 0
//
// A value may be a geometry, material, texture, render target, or an array/object of them.
// Disposal frees GPU memory; the JS objects are dropped from the cache so they can be collected.

const R = (window.R = window.R || {});

function disposeValue(v, seen = new Set()) {
  if (!v || typeof v !== 'object' || seen.has(v)) return;
  seen.add(v);
  if (typeof v.dispose === 'function' && (v.isBufferGeometry || v.isMaterial || v.isTexture || v.isWebGLRenderTarget || v.isRenderTarget)) {
    if (v.isMaterial) for (const k of Object.keys(v)) { const t = v[k]; if (t && t.isTexture && t.userData && t.userData.ownedBy === v) disposeValue(t, seen); }
    v.dispose();
    return;
  }
  if (Array.isArray(v)) { v.forEach(x => disposeValue(x, seen)); return; }
  if (v.isObject3D) {
    v.traverse(o => { if (o.geometry) disposeValue(o.geometry, seen); if (o.material) disposeValue(o.material, seen); });
    return;
  }
  for (const x of Object.values(v)) disposeValue(x, seen);
}

const entries = new Map(); // key -> { value, refs }

const Assets = {
  acquire(key, factory) {
    let e = entries.get(key);
    if (!e) { e = { value: factory(), refs: 0 }; entries.set(key, e); }
    e.refs++;
    return e.value;
  },
  release(key) {
    const e = entries.get(key);
    if (!e) throw new Error(`AssetCache: release of unknown key "${key}"`);
    e.refs--;
    if (e.refs < 0) throw new Error(`AssetCache: "${key}" released more times than acquired`);
    if (e.refs === 0) { disposeValue(e.value); entries.delete(key); }
  },
  refs(key) { const e = entries.get(key); return e ? e.refs : 0; },
  stats() { return { entries: entries.size, refs: [...entries.values()].reduce((a, e) => a + e.refs, 0) }; },
  keys() { return [...entries.keys()]; },
  // Dispose resources owned by one object that are not shared through the cache.
  disposeOwned: disposeValue,
};

R.Assets = Assets;
export default Assets;
