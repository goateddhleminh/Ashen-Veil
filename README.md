# Ashen Veil — The Last Embers

A single-player desktop browser ARPG with three classes, a three-region campaign and repeatable expeditions. Characters, scenery and effects are procedural Three.js meshes; sound effects use locally hosted CC0 recordings with WebAudio playback and synthesized fallback cues. No account, multiplayer service, build step or package installation is required to play. Three.js **0.170.0** loads from a pinned CDN, so this is not an offline distribution.

## Run

Upload `index.html`, `styles.css`, `AUDIO-CREDITS.md`, and the entire `src/` and `assets/` directories to a static HTTP(S) host. Preserve that directory structure. GitHub Pages can deploy the repository root; upload extracted files, since GitHub's web UI does not extract ZIP files.

For local play, run `python -m http.server 8080` in this directory if Python is installed, then open `http://localhost:8080`. Do not open through `file://`. Use a current WebGL-capable desktop browser. Mouse and keyboard are required; mobile touch controls are not implemented.

## Your journey

Choose Warrior, Mage or Archer and begin in Ember Refuge. Press **C** and travel to the Forgotten Graveyard. Travel closes the panel and begins a three-second countdown. Each combat region has three stages: defeat eight enemies and activate a shrine, use the portal to defeat three enemies including two champions and open the chest, then use the next portal to enter the guardian arena. The HUD tracks current-run objectives; persistent quests still reward 12 kills, the chest and the guardian. Claim the kill and chest quests before claiming the guardian reward. That reward opens the next region: Cinder Marsh, then Hollow Citadel. Claim the final quest to unlock expeditions.

Return to Ember Refuge to restore life and resource and use the merchant, forge and personal stash. Death retains equipment and progress, deducts 10% of carried gold (maximum 500), and offers recovery at the refuge. Travel regenerates encounters and clears ground drops and temporary blessings. Leaving an expedition abandons its unclaimed rewards.

## Controls

| Input | Action |
| --- | --- |
| Automation / Manual switch | Change control mode; clears previous movement and held attack input |
| Click / hold left mouse | Move / steer in Manual mode |
| Hold right mouse | Basic attack nearby enemies in Manual mode; does not chase them |
| Click a ground label | Walk to and collect that drop |
| 1 / 2 / 3 / 4 | Class abilities, aimed toward the mouse pointer where applicable |
| Space | Dodge toward the mouse pointer |
| E | Open a nearby chest, activate a shrine or enter an unlocked stage portal in Manual mode |
| Q | Healing potion: restores 45% maximum life; four-second cooldown; no consumption at full health |
| C | Character, travel, quests, talents and equipment |
| I | Inventory, filtering, merchant, forge and stash |
| J | Events, reward claims, Tower controls, supplies and appearance |
| Escape | Close a panel or pause/resume |

Manual is the default: movement, basic attacks and loot collection require your input. Automation seeks enemies, attacks in range, casts ready abilities when resources and targets allow, and walks to collectible ground drops. It attempts to evade enemy and boss attack warnings; dodge cooldowns, obstacles and overlapping attacks can still leave it vulnerable. When an ultimate is ready and a target is in reach, Automation reserves enough resource to cast it before resuming other abilities. Skills and potions remain available on their keys. XP is awarded for kills in both modes; it is not a ground pickup. Switch modes at any time during play using the HUD control.

Travel and expedition entry take three seconds. During the countdown the character stays idle, movement and combat are locked, and additional travel requests are ignored. Arrival clears held input. Starting or recovering a character at Ember Refuge is immediate.

Panels pause combat, regeneration, buffs and cooldowns; event supplies have explicit Use buttons in the Events panel. Switching tabs/windows normally pauses the game. **Run while hidden** is an opt-in for the current session and requires Automation mode; manual pause and open panels still pause simulation. Browsers may throttle or suspend hidden pages, so this is not guaranteed uninterrupted background play and provides no offline catch-up after closing the page. Hidden pages remain silent. Settings on the title/pause menu control volume, mute, shadows/resolution, reduced motion, auto-equip and auto-salvage. Reduced motion removes body bobbing and decorative CSS animation while preserving combat cues.

## Builds and loot

- Three classes with distinct basic attacks and four abilities each; resource regenerates during play. Warrior Cataclysm, Mage Starfall and Archer Arrowstorm are high-cost ultimates. Archer volley pierces a corridor, while barrage lands three timed area pulses.
- Nine talent nodes per class, including three skill modifiers, with three ranks each; level-ups award one talent point and two attribute points. Level cap: **30**. Excess XP at the cap is discarded.
- Six equipment slots: weapon, armor, helm, gloves, boots and ring. Four rarities, ten attribute/affix types (including attack speed and cooldown reduction) and six legendary properties. Bonus affixes are unique per item and roll within ±15%.
- Inventory starts at 24 items and expands at the refuge merchant in four-slot purchases up to **500**. The first expansion costs 100 gold, then 200, 300 and so on. Each class has a separate 48-item stash. Favoriting protects items from sale and salvage. Equip comparisons, sorting and filtering help manage gear.
- Sell gear for gold, salvage it for gems, purchase potions or magic equipment, and upgrade items up to five times using gold, gems and later diamonds. Refund talent ranks at the refuge for gold.
- Armor reduces damage by `100 / (100 + armor)`; combined mitigation is capped at 80%. Equipment changes never heal. Legendary properties affect basic-hit healing, skill damage, slowing, damage reduction, resource regeneration or attack speed.
- Graveyard Ember shrines grant 30 seconds of doubled resource regeneration; Marsh Renewal shrines heal 50% maximum life; Citadel Ward shrines grant ten seconds of protection. Each activates once per visit.
- Choose Normal, Nightmare or Hell at the refuge. Campaign encounters are capped to Normal levels 1–12, Nightmare 13–22 and Hell 23–30; higher tiers increase health and damage. Expedition scaling remains independent of these caps. Stage progress resets on travel.
- Auto-salvage converts eligible pickups directly into gems. The threshold option includes lower rarities; selecting an exact Common, Magic or Rare option overrides that threshold and salvages only that rarity. Favorites and Legendary gear remain protected from automatic and bulk salvage. Bulk salvage and affix rerolls are available at the refuge.
- Auto-equip is enabled by default in settings and runs only during Automation. It compares compatible inventory equipment using a stat score; it is a convenience heuristic, not a guarantee of the best build.

Expeditions unlock after the campaign. Defeat 20 enemies and a guardian, then claim the completion reward before leaving. Clear a tier to unlock the next (up to 100). Six modifier types rotate in pairs; three bounty types offer additional claimable currency rewards. Equipment drops scale with character level plus expedition tier, capped at item level 100; enemy XP scales with reward level. Highest cleared tier persists; the active encounter does not.

## Events

Press **J** to open five events. **E** remains the nearby world interaction key for chests, shrines and stage portals; event rewards are claimed in the panel. Reward choices must be selected before claiming, and gear rewards remain unclaimed if the pack has insufficient space.

- **First Steps:** nine introductory missions, followed by the Rookie title and a choice of rare class weapon after claiming all nine rewards.
- **Rookie 7-Day Trial:** days unlock by elapsed calendar time from character creation; missed unlocked rewards remain available. Objectives include room clears, gear, levels, elites, chests and a guardian. Day seven also requires a visit and mission completion; its reward includes the Veteran cape.
- **Zone Conquest:** uses the existing Forgotten Graveyard (`graveyard`), Cinder Marsh (`marsh`) and Hollow Citadel (`citadel`) regions, not additional maps. Medal requirements combine 80% of encounter enemies, three elite packs, a hidden chest and the guardian. Normal, Nightmare and Hell award Bronze, Silver and Gold respectively; each zone's Gold cape has its own color (Graveyard jade, Marsh copper, Citadel violet), and all three Gold medals unlock five Legendary armor/accessory pieces. The Conqueror cape retains its gold color.
- **Infernal Tower:** enter and advance cleared floors from Events. Every fifth floor records a checkpoint, a run permits five healing potions, and milestone rewards include the Infernal weapon skin at floor 50. Weekly best floor/time records are local to the save, not an online leaderboard. Continue returns to the refuge and ends an interrupted run rather than resuming its arena.
- **Blood Moon:** every 30 minutes of simulated play offers a 35% chance of a five-minute event. Outside the Tower, affected combat regions have stronger enemies, doubled gold and improved rare drops. Collect 100 kill fragments during the event to bring in the Reaper; its reward includes the Blood Moon cape. This timer does not award offline progress.

The Events supplies wallet displays dust, shards and Ruby/Sapphire/Emerald counts. Mana potions restore class resource, portal scrolls return to the refuge, and reset tokens refund allocated talent ranks. Dust, shards and colored gems are stored rewards; the wallet does not provide a socketing or crafting system. Unlocked titles, capes, the Graveyard crown and the Infernal weapon skin can be selected in the same panel. Cape, crown and weapon selections change the hero's visible meshes; new characters restore default appearance.

## Saving

Characters save separately by class in browser local storage. Autosave runs during play and after important transactions, quests and death. Continue returns to the refuge. New Game asks before replacing an existing class save. Export a JSON backup from the title screen before clearing browser data or moving to another device/host. Import detects and validates the saved class and asks before replacing its save; it does not merge items or rewards.

Save format **v2** preserves expanded inventory capacity, event progress and claims, event supplies, cosmetic unlocks and selected appearance. Valid v1 saves migrate with the original 24-slot pack capacity; older saves without events receive initial event state.

Saves belong to the browser profile and website origin. Private browsing or blocked/full storage can prevent persistence; errors are displayed in-game. A previous valid save is retained as a fallback. Settings use a separate key. Ground loot, temporary buffs and unfinished expedition progress are not saved.

## Source layout

`src/main.js` composes the game and session states. Rendering and movement live in `engine.js`, `camera.js`, `input.js`, `world.js` and `entities.js`. Combat uses `combat.js`, `ai.js`, `enemy-attacks.js`, `telegraphs.js`, `skills.js` and `recovery.js`. Progression uses `progression.js`, `items.js`, `talents.js`, `economy.js` and `loot.js`. Campaign systems are `regions.js`, `quests.js`, `expeditions.js`, `shrines.js` and `region-map.js`. `save.js`, `settings.js`, `audio.js` and `ui.js` handle persistence and presentation. `data.js` holds shared balance constants.

The simulation uses a fixed 60 Hz step, 16 pooled enemies, 32 pooled ground drops and pooled combat effects. Region scenery is prebuilt and switched on travel. Manual movement slides along obstacles; Automation uses bounded pathfinding around props. `window.arpg.snapshot()` exposes read-only diagnostic values.

## Verification and limitations

Optional developer tests require Node and Python Playwright; those tools are not part of the playable distribution. Run `node tests/<name>_check.mjs` for each pure suite. Browser scripts run from the project root and use port 8087, so run them sequentially. Their Chromium executable and optional local tooling paths may need adjusting on another machine.

Run `python tests/phase3_browser.py` for the current browser acceptance suite, including the Automation/Manual and teleport regression checks. Current checks cover skills, timed barrage damage, economy, persistence, recovery, shrines, settings/audio, enemy telegraphs, travel, layout bounds, and campaign/expedition completion. `tests/completion_browser.py` accelerates damage through test-only browser injection: it verifies reward and unlock wiring, not difficulty or playtime. `tests/performance_browser.py` runs a five-minute stress fixture and writes resource counts. Historical Phase 1/2 browser scripts describe older flows and need migration before being treated as current acceptance tests.

Measured layout bounds pass at 1280×720, 1920×1080, 2560×1080 and 720×720. Screenshot-based visual review and a full normal-speed campaign balance playtest remain outstanding. No campaign-duration, universal frame-rate, audio loudness or production-quality claim is made. Changes are local until explicitly published.
