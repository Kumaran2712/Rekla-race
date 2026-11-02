// The game's original modules (js/*.js) are scripts that read a global THREE.
// This must be the first import in main.js so the global exists before any of them run.
// Removed once every module imports three directly (gradual migration, audit section 7).
import * as THREE from 'three';

window.THREE = THREE;
