# Ashen Veil — Phase 1

A playable desktop browser ARPG foundation. All scenery and characters are procedural Three.js meshes; the only network dependency is Three.js **0.170.0**, pinned in the import map. No asset downloads, package installation, bundler, or build step is required to play.

## Run

Upload `index.html`, `styles.css`, and `src/` together to any static HTTP(S) host (GitHub Pages, Netlify, or an itch.io HTML5 upload). Open the hosted URL in a current desktop Chrome, Edge, or Firefox with WebGL enabled. An internet connection is needed for the Three.js CDN.

For optional local testing, if Python is already installed, run `python -m http.server 8080` in this folder and visit `http://localhost:8080`. Opening `index.html` through `file://` does not work reliably with ES modules. No server-side game logic is used.

## Controls and test checklist

1. Click **Enter the graveyard**. Nine undead appear around the hero.
2. Click the floor to move to that location; hold the left mouse button and move the pointer to steer continuously. Headstones and trees block movement; the hero slides along their edges. Movement is direct steering, not route finding around whole clusters.
3. Approach an undead. The hero automatically attacks the nearest enemy within sword range. Undead raise their weapon before impact; step out of range to evade.
4. Watch health bars and impact rings. Kills increase the Slain counter and award 24 XP. Three kills reach level 2, restore health, add 18 maximum life and add 4 attack power. XP overflow carries over.
5. Press **Esc** or click pause. Combat and movement freeze. Resume using Esc or the dialog button. Switching away also pauses the game.
6. Let enemies defeat you. **Rise again** resets the hero, XP, kills, enemies, and effects for a fresh session.
7. Resize the browser. The camera projection and HUD adapt without stretching the scene. Recommended viewport: at least 1024 × 700.
8. Play several minutes: new enemies spawn every 3.4 seconds, capped at 16. No new character geometry is allocated during respawning or restarting.

## Source tree

```text
index.html          Page, pinned import map, HUD and menu markup
styles.css          Gothic HUD, health globe, dialogs, responsive layout
src/
  main.js           Composition, session states, spawning, movement
  data.js           Hero/enemy balance and XP curve
  engine.js         Renderer, fixed-step loop and GPU cleanup
  camera.js         Fixed 56.9° orthographic follow camera and resize
  input.js          Mouse raycasting, held input, Escape, listener cleanup
  world.js          Procedural graveyard, instanced path, spatial collisions
  entities.js       Procedural models, actor state and animation
  ai.js             Undead chase, windup, impact and crowd separation
  combat.js         Auto-targeting, damage, pooled rings and XP
  ui.js             Cached DOM updates, announcements and modal states
```

## Engineering notes

Simulation runs at 60 fixed updates per second; rendering uses `setAnimationLoop` and frame-rate-independent camera smoothing. Stalls are capped at 100 ms, and hidden tabs do not advance the game. Pixel ratio is capped at 1.5. The graveyard path uses an instanced mesh. Enemy models and effects are bounded pools. Static obstacles use a spatial hash; the 16-enemy crowd uses bounded pair separation. Shared GPU resources are disposed once on teardown.

Enemy attacks commit to a 0.42-second windup and re-check range at impact. The hero auto-attacks while moving. Health regeneration is intentionally limited to level-up restoration in this phase. The session is an endless survival encounter, with no win condition yet. The camera follows the hero inside a bounded clearing. Props and layout are generated in code with a repeatable seed; spawn locations vary each run.

Open the browser console and call `arpg.snapshot()` for a read-only report of state, position, health, XP, kills, active enemies, draw calls, triangles, and geometry count. It does not expose mutable game objects.

## Phase boundaries

Phase 1 includes the complete playable movement/combat foundation, one warrior-style hero, one enemy archetype, health/XP HUD, level growth, pause, and restart. Class selection/manual skills and damage numbers belong to Phase 2; equipment/loot to Phase 3; additional maps/bosses to Phase 4; audio, persistence and full settings to Phase 5. Those systems are not represented by nonfunctional buttons or empty modules.

Future modules can consume the actor state and balance tables without changing the renderer. This phase uses one small composition module instead of introducing unused managers for systems that do not exist yet.
