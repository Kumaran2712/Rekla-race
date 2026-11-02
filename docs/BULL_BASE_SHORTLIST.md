# Kangayam hero bull: licensed base-model shortlist

Status: research only. **Nothing has been bought.** All figures were read from the listing pages on 2 November 2026; prices change, so recheck before purchase.
Authority for the target look: `VISUAL_DESIGN_BIBLE.md` section 5.1.

## Scoring

Two gates come first: the licence and the anatomy. The anatomy gate requires a zebu (humped) body. For the licence to pass, it must allow commercial game use (including web and mobile), modification, and delivery inside a downloadable game build. Every other criterion is scored 1–5 and weighted.

| Criterion | Weight |
| --- | --- |
| Body proportions (compact, moderate size, firm hump) | 3 |
| Shoulder and hump musculature | 2 |
| Head and muzzle | 2 |
| Horns (expected to be remodelled anyway) | 1 |
| Legs and hooves | 2 |
| UV and texture quality (the coat will be repainted grey) | 1 |
| Topology and rig | 3 |
| Animation set (gallop or run) | 2 |
| Triangle count and how well it reduces for phones | 2 |
| Formats and price | 1 |

The maximum is 95. Scores marked *est.* come from listing text only. They need preview images, wireframes and the animation list confirmed by the seller before any purchase.

## Candidates

| # | Model | Price | Licence (verdict) | Key facts | Score (est.) |
| --- | --- | --- | --- | --- | --- |
| 1 | **Asian Zebu Cattle** by nyilonelycompany — [RenderHub](https://www.renderhub.com/nyilonelycompany/asian-zebu-cattle), also on [Superhive](https://superhivemarket.com/products/asian-zebu-cattle) | $30 (RenderHub sale, list $50); $50 on Superhive | **Pass on RenderHub.** The Extended Use License lists "Computer games and software" (computer, web and mobile games) and allows modification. It forbids redistributing the asset itself. Source: [RenderHub licensing](https://renderhub.com/info/3d-content-licensing). The Superhive royalty-free licence says nothing explicit about game builds, so it is **unclear** there. Buy on RenderHub if chosen. | Humped zebu, rigged, 15 in-place clips at 30 fps, about 43k triangles (subdivided low-poly), 4K PBR (5 maps), GLB/FBX/blend included | 59 / 95 |
| 2 | **Noggin's Brahman Cow and Bull** — [Daz 3D](https://hpclscruffy.daz3d.com/noggins-brahman-cow-and-bull) | $14.95 + $10 Interactive License | **Pass, but only with the $10 Interactive License add-on** (to be confirmed on Daz's licence page before purchase) | Brahman bull, plus "Ox" variant, ox-cart and yoking poses. Poser CR2 and OBJ only: no game rig, no clips, older Poser-era mesh. Brahman ears and dewlap are larger than Kangayam's. | 42 / 95 |
| 3 | **Ultimate Bull** — [RenderHub](https://www.renderhub.com/virtual-creator/ultimate-bull) | $79.99 | Pass (Extended Use) | A Spanish bull (taurine, no zebu hump), CAT rig, walk and run, about 39k polys, FBX with basic rig only | 47 / 95 — **reject: no zebu hump** |
| 4 | **White Bull Cattle** — [RenderHub](https://www.renderhub.com/nyilonelycompany/white-bull-cattle) | $21 sale (list $35) | Pass (Extended Use) | Labelled *Bos taurus* (no hump), 5.8k triangles, rigged, 12 clips, GLB included | 53 / 95 — **reject: no zebu hump** |
| 5 | Brahman bull on Sketchfab, and the "zebu bull highpoly sculpture" on CGTrader | — | **Unverified.** The pages could not be read from here. | — | Not scored |
| — | Kag3d "Cow & Bull" ([itch.io](https://kag3d.itch.io/cow-bull-3d-animated-animals)) | $9+ | **Fail: no licence stated** | — | Excluded |

### Why candidate 1 leads

It is the only verified option that is a humped zebu, rigged and animated, delivered as GLB, and sold under a licence that names web and mobile games.

What it will still need, all planned in Blender:
- Kangayam horns (spread, nearly straight with a slight backward curve) and a firmer, smaller hump.
- A finer head and muzzle, and the eye rings.
- A grey coat with darker head, neck, hump and quarters, and a black tail switch.
- A gallop clip phase-locked to the stride (the listing doesn't say whether the 15 clips include a gallop).
- Retopology or decimation from about 43k to a 12–18k triangle LOD0, plus 5k and 1.5k LODs.

## Before any purchase (needs your approval)

1. Ask the seller, at no cost, for wireframe renders, the names of the 15 clips (is there a gallop?), the bone list and the triangle count of the unsubdivided mesh.
2. Re-read the RenderHub Extended Use terms on the day of purchase and save a PDF copy in the private asset store.
3. Buy on RenderHub (not Superhive) for the explicit games clause.

## Temporary, legally usable stand-in (greybox and pipeline proving only)

- **Quaternius "LowPoly Animated Farm Animal Pack"** is **CC0**, but it contains a cow, not a bull, and is supplied as Blend, OBJ and FBX ([OpenGameArt](https://opengameart.org/content/lowpoly-animated-farm-animal-pack)). It is good enough to prove GLB loading, `AnimationMixer` and stride-phase locking. It is not a look reference.
- This sandbox cannot download from asset sites. To use it, attach the file. Until then, the existing procedural bull stays in place.

## Blender adaptation, rigging and animation pipeline (plan only)

This is the plan once a base model is approved and bought. Every step that can be scripted runs headless through Blender's Python module (`bpy`), so the pipeline is reproducible from the repo. The steps that need an artist's eye are marked **(artist)**.

| Step | What happens | Tool | Output | Checked by |
| --- | --- | --- | --- | --- |
| 1. Intake | Open the source file. Record the triangle count, bones, clip names and texture sizes in `assets/src/bull/INTAKE.md`. Store the licence PDF privately. | Blender (scripted) | Intake report | Gate 1 evidence |
| 2. Proportion pass **(artist)** | Overlay side, front and 3/4 reference photos on matching cameras. Adjust body mass, hump (firm, moderate), dewlap and leg length to Kangayam proportions as shape keys, so the base stays recoverable. | Blender sculpt and shape keys | `bull_greybox.blend` | Gate 1: overlay renders, plus the greybox in the game at V1 and V5 |
| 3. Horns and head **(artist)** | Remodel the horns: spread apart, nearly straight with a slight backward curve (smaller variety first). Refine the muzzle and add the eye rings. | Blender sculpt | High-poly head | Gate 2 |
| 4. Retopology and LODs | Reduce about 43k triangles to an LOD0 of 12–18k, keeping edge loops at the shoulder, elbow, hip, stifle and neck. LOD1 is 5k and LOD2 1.5k (decimate). | Blender (manual loops plus scripted decimate) | LOD meshes | Gate 2: wireframe renders |
| 5. Bakes | Bake normal and AO from high to low. Pack ORM. | Blender Cycles bake (scripted) | 2048 maps | Gate 2–3 |
| 6. Coat repaint **(artist)** | Grey coat with darker head, neck, hump and quarters, black tail switch, and painted horns with brass tips, following bible section 5.1. | Blender texture paint or Krita | Albedo 2048 | Gate 3, in our renderer under noon, golden and rain |
| 7. Rig check and correctives | Keep about 30 bones; add a scapula slide, corrective shapes and spring bones for the hump, dewlap and tail. Limit to 4 weights per vertex. | Blender | Rigged mesh | Gate 4: range-of-motion clip |
| 8. Clips | Inspect the 15 clips. Retime or re-key the gallop to the reference footfall order, in place. Set the beat at phase 0 = leading forehoof plant. Write hoof-contact times to `bull.events.json`, because glTF does not export Blender markers. | Blender NLA | Clips + events JSON | Gate 5: side by side with reference video |
| 9. Export | glTF 2.0 export (+Y up, transforms applied, normalised weights), then `gltfpack -cc -tc` (meshopt + KTX2) and `gltf-transform validate`. | Scripted (`blender -b -P tools/export_bull.py`, then the npm script) | `public/assets/bull/*.glb` | CI: validator, size budget |
| 10. Integration | Load through `AssetCache` into `R.Models.cart` behind `?bull=glb`. Drive the clip from `c.step` (audit 5b). | Game code | — | Gates 6–7 |

**Equipment note:** steps 2, 3 and 6 need either an artist with Blender or a computer for you. The scripted steps (1, 4, 5, 9) can run here in the cloud sandbox.
