# Ashen Veil — The Last Embers

A single-player desktop browser ARPG with three classes, a three-region campaign and repeatable expeditions. Characters, scenery and effects are procedural Three.js meshes; sound effects use WebAudio synthesis. No account, multiplayer service, build step or package installation is required to play. Three.js **0.170.0** loads from a pinned CDN, so this is not an offline distribution.

## Run

Upload `index.html`, `styles.css` and the entire `src/` directory to a static HTTP(S) host. Preserve that directory structure. GitHub Pages can deploy the repository root; upload extracted files, since GitHub's web UI does not extract ZIP files.

For local play, run `python -m http.server 8080` in this directory if Python is installed, then open `http://localhost:8080`. Do not open through `file://`. Use a current WebGL-capable desktop browser. Mouse and keyboard are required; mobile touch controls are not implemented.

## Your journey

Choose Warrior, Mage or Archer and begin in Ember Refuge. Press **C** and travel to the Forgotten Graveyard. Travel closes the panel and begins a three-second countdown. Each combat region has three objectives: defeat 12 enemies, reach the chest marked C on the map, and defeat its guardian. Claim the kill and chest quests before claiming the guardian reward. That reward opens the next region: Cinder Marsh, then Hollow Citadel. Claim the final quest to unlock expeditions.

Return to Ember Refuge to restore life and resource and use the merchant, forge and personal stash. Death retains equipment and progress, deducts 10% of carried gold (maximum 500), and offers recovery at the refuge. Travel regenerates encounters and clears ground drops and temporary blessings. Leaving an expedition abandons its unclaimed rewards.

## Controls

| Input | Action |
| --- | --- |
| Automation / Manual switch | Change control mode; clears previous movement and held attack input |
| Click / hold left mouse | Move / steer in Manual mode |
| Hold right mouse | Basic attack nearby enemies in Manual mode; does not chase them |
| Click a ground label | Walk to and collect that drop |
| 1 / 2 / 3 | Class abilities, aimed toward the mouse pointer where applicable |
| Space | Dodge toward the mouse pointer |
| E | Open a nearby chest or activate a nearby shrine in Manual mode |
| Q | Healing potion: restores 45% maximum life; no consumption at full health |
| C | Character, travel, quests, talents and equipment |
| I | Inventory, filtering, merchant, forge and stash |
| Escape | Close a panel or pause/resume |

Manual is the default: movement, basic attacks and loot collection require your input. Automation seeks enemies, attacks in range and walks to collectible ground drops. Skills and potions remain available on their keys. XP is awarded for kills in both modes; it is not a ground pickup. Switch modes at any time during play using the HUD control.

Travel and expedition entry take three seconds. During the countdown the character stays idle, movement and combat are locked, and additional travel requests are ignored. Arrival clears held input. Starting or recovering a character at Ember Refuge is immediate.

Panels pause combat, regeneration, buffs, cooldowns and consumable use. Switching tabs/windows pauses the game. Settings on the title/pause menu control volume, mute, shadows/resolution and reduced motion. Reduced motion removes body bobbing and decorative CSS animation while preserving combat cues.

## Builds and loot

- Three classes with distinct basic attacks and three abilities each; resource regenerates during play. Archer volley pierces a corridor, while barrage lands three timed area pulses.
- Six talent nodes per class, three ranks each; level-ups award one talent point and two attribute points. Level cap: **30**. Excess XP at the cap is discarded.
- Six equipment slots: weapon, armor, helm, gloves, boots and ring. Four rarities, eight attribute/affix types and six legendary properties.
- Inventory holds 24 items; each class has a 48-item stash. Favoriting protects items from sale and salvage. Equip comparisons, sorting and filtering help manage gear.
- Sell gear for gold, salvage it for gems, purchase potions or magic equipment, and upgrade items up to five times using gold, gems and later diamonds. Refund talent ranks at the refuge for gold.
- Armor reduces damage by `100 / (100 + armor)`. Equipment changes never heal. Legendary properties affect basic-hit healing, skill damage, slowing, damage reduction, resource regeneration or attack speed.
- Shrines grant 30 seconds of doubled base resource regeneration, once per visit. Their duration pauses with gameplay.

Expeditions unlock after the campaign. Defeat 20 enemies and a guardian, then claim the completion reward before leaving. Clear a tier to unlock the next (up to 100). Six modifier types rotate in pairs; three bounty types offer additional claimable currency rewards. Highest cleared tier persists; the active encounter does not.

## Saving

Characters save separately by class in browser local storage. Autosave runs during play and after important transactions, quests and death. Continue returns to the refuge. New Game asks before replacing an existing class save. Export a JSON backup from the title screen before clearing browser data or moving to another device/host. Import validates the selected class and asks before replacing its save; it does not merge items or rewards.

Saves belong to the browser profile and website origin. Private browsing or blocked/full storage can prevent persistence; errors are displayed in-game. A previous valid save is retained as a fallback. Settings use a separate key. Ground loot, temporary buffs and unfinished expedition progress are not saved.

## Source layout

`src/main.js` composes the game and session states. Rendering and movement live in `engine.js`, `camera.js`, `input.js`, `world.js` and `entities.js`. Combat uses `combat.js`, `ai.js`, `enemy-attacks.js`, `telegraphs.js`, `skills.js` and `recovery.js`. Progression uses `progression.js`, `items.js`, `talents.js`, `economy.js` and `loot.js`. Campaign systems are `regions.js`, `quests.js`, `expeditions.js`, `shrines.js` and `region-map.js`. `save.js`, `settings.js`, `audio.js` and `ui.js` handle persistence and presentation. `data.js` holds shared balance constants.

The simulation uses a fixed 60 Hz step, 16 pooled enemies, 32 pooled ground drops and pooled combat effects. Region scenery is prebuilt and switched on travel. Manual movement slides along obstacles; Automation uses bounded pathfinding around props. `window.arpg.snapshot()` exposes read-only diagnostic values.

## Verification and limitations

Optional developer tests require Node and Python Playwright; those tools are not part of the playable distribution. Run `node tests/<name>_check.mjs` for each pure suite. Browser scripts run from the project root and use port 8087, so run them sequentially. Their Chromium executable and optional local tooling paths may need adjusting on another machine.

Run `python tests/phase3_browser.py` for the current browser acceptance suite, including the Automation/Manual and teleport regression checks. Current checks cover skills, timed barrage damage, economy, persistence, recovery, shrines, settings/audio, enemy telegraphs, travel, layout bounds, and campaign/expedition completion. `tests/completion_browser.py` accelerates damage through test-only browser injection: it verifies reward and unlock wiring, not difficulty or playtime. `tests/performance_browser.py` runs a five-minute stress fixture and writes resource counts. Historical Phase 1/2 browser scripts describe older flows and need migration before being treated as current acceptance tests.

Measured layout bounds pass at 1280×720, 1920×1080, 2560×1080 and 720×720. Screenshot-based visual review and a full normal-speed campaign balance playtest remain outstanding. No campaign-duration, universal frame-rate, audio loudness or production-quality claim is made. Changes are local until explicitly published.
