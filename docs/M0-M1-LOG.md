# M0 + M1 progress log

Branch `feat/m0-m1-foundation`. Live site and known-good build: `main` at `99f8b79`, tagged `r128-baseline`.
Plan and acceptance gates: Technical Audit Revision 2 and the approval brief of 2 November 2026.

## Decisions

| Date | Decision | Why |
| --- | --- | --- |
| 2026-11-02 | Golden images are captured from the **unmodified** r128 build by injecting `tests/harness/deterministic.js` (seeded `Math.random`, virtual clock, hand-stepped `requestAnimationFrame`). | The baseline must be the live build, not a build changed to be testable. |
| 2026-11-02 | The r128 CDN script is served to tests from `tests/vendor/three-r128.min.js` (byte-identical to npm `three@0.128.0`), and web fonts are blocked in tests. | The test sandbox cannot rely on CDNs; blocking fonts makes HUD text render identically every run. The expected `net::ERR_FAILED` font errors are ignored. |
| 2026-11-02 | V3 uses the sharpest bend on the track, found once from `R.frame` headings and stored as `s = 742`. | "First bend" was ambiguous; a stored number keeps every before/after pair identical. |

| 2026-11-02 | Versions re-checked on npm at the start of implementation: three 0.187.0, vite 8.3.5 (Node ≥ 22.12), all pinned exactly. Playwright is pinned to **1.63.0**, not the newest 1.64.1, because 1.63.0 matches the browsers installed in the build sandbox. CI installs its own browsers. | Requirement "verify exact versions when implementation begins"; avoids a second browser download here. |
| 2026-11-02 | Vite step done on **three 0.128.0 from npm** first, then r187 as a separate commit. | Isolates "bundling changed" from "engine changed" so each can be checked against the golden images. |
| 2026-11-02 | The Pages deploy workflow is manual-only and also needs Settings › Pages › Source = GitHub Actions, which stays off. | Two independent locks against an accidental live deploy. |
| 2026-11-02 | r187 colour pipeline: `col()` no longer converts (three does it). The few hex numbers r128 treated as raw linear values (kites `0x2a2420`, rain kites colour) keep their old values via `LinearSRGBColorSpace`. | Visual parity with r128. |
| 2026-11-02 | r187 post pass: the scene renders to a half-float target in linear HDR (r153+ no longer tone-maps render targets). The pass tone-maps and sRGB-encodes each sample itself, then grades as before. | Keeps the grade, speed blur and sun-shaft thresholds working on the same display values as r128. |
| 2026-11-02 | `PCFSoftShadowMap` was removed in r180+ (three now falls back to `PCFShadowMap` with a warning). We set `PCFShadowMap` explicitly; softness comes from `shadow.radius = 2`, which r128 ignored. | No console warnings; shadow edges will differ slightly. |
| 2026-11-02 | Light intensities × π (sun and hemisphere). | r128's legacy light mode multiplied punctual and hemisphere irradiance by π internally; r155+ removed legacy mode. |

## Baseline (r128, headless SwiftShader — relative numbers only, not device performance)

- Golden images: `tests/golden/r128/land` (V1–V8 × 5 presets + U1) and `tests/golden/r128/port` (noon).
- Draw calls per frame at noon (1280×720): 313–594; triangles 0.59–0.84 M. These count every render call in the frame, shadow pass included.
- Balance (`tests/baseline/sim-r128.json`, 5 runs each):

| Case | Finished | Time range (s) | Ranks |
| --- | --- | --- | --- |
| Pack, perfect bot | 5/5 | 49.45–51.35 | 1,1,1,1,1 |
| Pack, sloppy bot | 5/5 | 58.98–65.55 | 3,5,6,6,6 |
| Trial, perfect bot | 5/5 | 18.87–20.20 | — |
| Trial, sloppy bot | 5/5 | 22.48–25.71 | — |

## Known limitations and open risks

- Headless captures use SwiftShader (CPU rendering). They are deterministic and good for regression, but say nothing about phone performance or exact GPU output.
