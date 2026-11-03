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
| 2026-11-02 | Race shots are captured after re-seeding `Math.random` at race start (`__reseed(777)`). | three.js consumes random numbers while loading (object IDs), and r187 consumes a different number than r128. Without re-seeding, race content (obstacles, rival moves) differed between builds and hid real rendering differences. |
| 2026-11-02 | From Phase 4 on, gameplay randomness uses its own seeded stream per race (`?seed=N`). | Required for reproducible tests. It means race content after Phase 4 can never match r128 shot for shot, so race-shot goldens are re-baselined from the reviewed Phase 3/4 builds; menu shots (V1, U1) stay comparable to r128. |
| 2026-11-02 | Canvas taps are judged at **pointerdown** time; before they were judged when the finger lifted (pointerup). | The shout belongs to the moment of touch. Buttons already used pointerdown. |
| 2026-11-02 | Interpolation draws the state between the last two simulation steps, so what is shown lags by at most one step (16.7 ms). | Standard fixed-step practice; it removes judder when display and simulation rates differ. |
| 2026-11-02 | The tier thresholds in `src/quality.js` (benchmark 26/18/12/8/5 ms; p95 22/18 ms) are first estimates. | They can only be calibrated on the real devices (protocol scenario 1 and 5). |
| 2026-11-02 | Chrome logs "GPU stall due to ReadPixels" once during the first-visit benchmark. | The 1-pixel readback is how the benchmark waits for the GPU; it is a driver performance note, not an error, and does not repeat once a tier is remembered. |
| 2026-11-02 | Leaks fixed: carts freed their geometry only from the scene, not the GPU (`models.js` `dispose`), and every race re-created pothole, puddle and cane-ring geometry without freeing the old ones. | Found by inspection; confirmed by the 20-cycle test. |

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

## Sign-off (3 November 2026)

- You approved M0 + M1 and reported that the build works fine on the iPhone 16 and Pixel 9. **No device JSON reports were pasted**, so phone FPS, p95 frame time, thermal drift and memory are user-reported as working, not measured. They can be captured later from the preview link (`#stats-autoplay`).
- Balance check v2 approved: 30 runs per case compared with the r128 distribution (mean within 0.5 s, wins within 5). Result on the final build: all four cases pass.
- Visual review: approved, with the known differences accepted (shadow-edge pixels, slightly lighter dust, one portrait shot's stride phase).
- Road and format stay as the design bible says: red-earth village track, point to point.
