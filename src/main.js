// Entry point. Imports the original modules in the same order index.html loaded them before Vite.
// ES modules evaluate imports in order, so three-global.js runs first.
import './three-global.js';
import '../js/core.js';
import '../js/textures.js';
import '../js/sky.js';
import '../js/world.js';
import '../js/scenery.js';
import '../js/models.js';
import '../js/crowd.js';
import '../js/weather.js';
import '../js/post.js';
import '../js/audio.js';
import './sim-clock.js';
import '../js/game.js';
