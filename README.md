# Ashen Veil — Phase 2: Classes & Loot

A playable desktop browser ARPG foundation. All scenery and characters are procedural Three.js meshes; the only network dependency is Three.js **0.170.0**, pinned in the import map. No asset downloads, package installation, bundler, or build step is required to play.

## Run

Upload `index.html`, `styles.css`, and `src/` together to any static HTTP(S) host (GitHub Pages, Netlify, or an itch.io HTML5 upload). Open the hosted URL in a current desktop Chrome, Edge, or Firefox with WebGL enabled. An internet connection is needed for the Three.js CDN.

For optional local testing, if Python is already installed, run `python -m http.server 8080` in this folder and visit `http://localhost:8080`. Opening `index.html` through `file://` does not work reliably with ES modules. No server-side game logic is used.

## Controls and test checklist

1. Choose **Warrior**, **Mage**, or **Archer**, then click **Enter the graveyard**. Warrior cleaves a second nearby target; Mage casts splash bolts; Archer fires fast single-target arrows. Nine undead appear around the hero.
2. Click the floor to move to that location; hold the left mouse button and move the pointer to steer continuously. Headstones and trees block movement; the hero slides along their edges. Movement is direct steering, not route finding around whole clusters.
3. Approach an undead. The hero automatically attacks within class range. Undead raise their weapon before impact; step out of range to evade. Larger blue-bar champions and gold-bar elites are tougher and favor better equipment drops.
4. Kills award XP and one weighted ground drop: gold, gems, diamonds, potions, or class-appropriate gear. Click a loot label to walk toward it and collect within reach. Obstacles may require manually steering around them. Level-ups restore life and add 2 vitality and 2 primary attribute; XP overflow carries over.
5. Press **C** for Character or **I** for Inventory. Combat freezes while browsing. Equip/unequip weapon and armor cards; comparisons show modifier differences. Equipment changes never heal. The pack holds 24 items; swaps work even when full. Close with C, I, Escape, the close button, or a click outside.
6. Press **Q** or click the potion button to restore 45% maximum life. Full-health use consumes nothing. Gold, gems and diamonds are collectible counters in this phase; spending comes later.
7. Press **Esc** or click pause. Combat and movement freeze. Resume using Esc or the dialog button. Switching away also pauses the game.
8. Let enemies defeat you. **Rise again** resets the hero, XP, kills, enemies, and effects for a fresh session.
9. Resize the browser. The camera projection and HUD adapt without stretching the scene. Recommended viewport: at least 1024 × 700.
10. Play several minutes: new enemies spawn every 3.4 seconds, capped at 16. No new character geometry is allocated during respawning or restarting.

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
  ui.js             Class selection, cached HUD, character/inventory panels
  progression.js    Pure classes, items, derived stats, equipment and potions
  loot.js           32 pooled ground drops, labels and click collection
```

## Engineering notes

Simulation runs at 60 fixed updates per second; rendering uses `setAnimationLoop` and frame-rate-independent camera smoothing. Stalls are capped at 100 ms, and hidden tabs do not advance the game. Pixel ratio is capped at 1.5. The graveyard path uses an instanced mesh. Enemy models and effects are bounded pools. Static obstacles use a spatial hash; the 16-enemy crowd uses bounded pair separation. Shared GPU resources are disposed once on teardown.

Enemy attacks commit to a 0.42-second windup and re-check range at impact. The hero auto-attacks while moving. Healing comes from level-ups, potions and legendary life-on-hit equipment. Armor uses damage × 100 / (100 + armor); critical hits deal 1.75× damage. Equipment recalculates from base attributes and never heals. Ground drops cap at 32; overflow converts to gold. There is no selling or discarding yet, so a full pack can swap gear but cannot collect additional gear. The session is an endless survival encounter, with no win condition yet. The camera follows the hero inside a bounded clearing. Props and layout are generated in code with a repeatable seed; spawn locations vary each run.

Open the browser console and call `arpg.snapshot()` for a read-only report of state, position, health, XP, kills, active enemies, draw calls, triangles, and geometry count. It does not expose mutable game objects.

## Phase boundaries

Phase 2 brings the approved class/equipment/loot slice forward: three classes, distinct auto-attacks, attributes, two equipment slots, four gear rarities, collectible currencies and potions, tougher undead, and a paused character/inventory overlay. Currencies cannot be spent yet. There is no save/load: refreshing or restarting starts a new run. Active skills, vendors, salvage, drag-and-drop inventory, more maps/bosses, audio and persistence remain outside this slice.

## Developer verification

`node tests/progression_check.mjs` validates pure progression rules. `python tests/phase2_browser.py` uses optional local Playwright tools to check every class, ground loot collection, equip/unequip, pause and restart. Its deterministic route overrides exist only in the test browser, never in shipped game code. Runtime deployment excludes developer tooling.

For GitHub Pages upload the **extracted contents** of `ashen-veil-phase-2.zip` to the repository root, preserving `src/`. GitHub's web UI does not extract ZIP uploads. Set Pages to deploy the main branch root. This package updates local source only; it does not publish to GitHub automatically.
