# Rekla Race · ரேக்ளா ரேஸ்

A 3D Rekla (Tamil Nadu bullock-cart) racing game that runs in the browser. Four pairs of Kangayam bulls race 800 m on Pongal day, from the village festival ground, through the village street, paddy fields, a coconut grove, a sugarcane asphalt stretch and the Western Ghat foothills, to the temple ground.

**Play:** open the GitHub Pages link for this repo. It works on phones and desktop.

## Controls
- **ஹை! (Hai)**: shout to drive the bulls on. Each shout costs stamina.
- **◀ ▶ / swipe**: switch lanes to dodge potholes, puddles and the goat.
- **Sugarcane**: run over it to refill stamina.
- Keyboard: ← → to steer, Space to shout.

There are five race atmospheres: summer afternoon, golden hour, monsoon clouds, after the rain, and morning mist.

## How it's built
This is a static site with no build step. It uses [three.js r128](https://threejs.org) (WebGL) from cdnjs, and everything else is generated in code: models, textures, sky and sound. There are no asset files.

| File | What it does |
|---|---|
| `js/core.js` | Shared math and noise, the curved and hilly track path, race zones, terrain height, batching and instancing with LOD |
| `js/textures.js` | Procedural road textures (ruts, hoofprints, stones, dust, asphalt), normal maps |
| `js/sky.js` | Shader sky with clouds, sun and shadows, image-based lighting, the five atmospheres |
| `js/world.js` | Terrain, road ribbon, Western Ghat ridgelines |
| `js/scenery.js` | Paddy, canal, coconut, palmyra, banana, sugarcane, houses, tea shop, shrine, gopuram, power lines, vehicles |
| `js/models.js` | Kangayam bulls, racing cart, driver, obstacles |
| `js/crowd.js` | GPU-animated crowd, barricades, bunting, banners, pandal |
| `js/weather.js` | Rain, ground mist, circling kites |
| `js/post.js` | Sun shafts, speed blur, colour grade |
| `js/audio.js` | Synthesised sound: hooves, bells, shouts, crowd, parai drums, weather |
| `js/game.js` | Race simulation, controls, camera, HUD, adaptive resolution |

To run it locally, serve the folder with any static server, for example `python3 -m http.server`, then open `http://localhost:8000`.
