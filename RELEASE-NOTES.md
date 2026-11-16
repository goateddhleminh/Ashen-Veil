# The Last Embers — expansion notes

This release expands the original arena into a single-player campaign with Ember Refuge, the Forgotten Graveyard, Cinder Marsh and Hollow Citadel. Nine quests and three guardians lead to repeatable tiered expeditions.

## Events, inventory and automation update

- Added the **J** Events panel with First Steps, Rookie 7-Day Trial, Zone Conquest, Infernal Tower and Blood Moon. **E** remains the nearby world interaction key. Claims require completed objectives and enough pack space for gear; choice rewards require a selection.
- First Steps tracks nine introductory missions. Rookie days unlock over seven calendar days and keep missed unlocked rewards available. Zone Conquest uses existing region IDs `graveyard`, `marsh` and `citadel` (Forgotten Graveyard, Cinder Marsh and Hollow Citadel), with Bronze/Silver/Gold medals for Normal/Nightmare/Hell objectives; these are not new maps.
- Tower encounters advance floor by floor from the panel, record checkpoints every five floors and allow five healing potions per run. Milestones award gear and supplies, with the Infernal weapon skin at floor 50. Weekly best floor/time records are local. Continue ends an interrupted run and returns to the refuge.
- Blood Moon has a 35% trigger chance every 30 minutes of simulated play and lasts five minutes. It empowers enemies outside the Tower, doubles gold and improves rare drops. Reaching 100 kill fragments brings in the Reaper. Neither closed-page time nor suspended-browser time guarantees event progress.
- Added a supplies wallet for dust, shards and colored gems, plus usable mana potions, portal scrolls and talent-reset tokens. Colored gems, dust and shards are stored rewards; no socketing/crafting feature is implied. Unlockable titles and visible capes, a crown and the Infernal weapon skin are selectable in Events.
- Expanded the pack from 24 slots to a purchasable maximum of 500, in increments of four at the refuge merchant. Costs begin at 100 gold and rise by 100 per purchase; the class stash remains 48 items.
- Added exact-rarity auto-salvage for Common, Magic or Rare. An exact choice overrides the existing threshold; favorites and Legendary items remain protected from automatic/bulk salvage. Auto-equip is on by default in settings, runs in Automation only and uses a compatible-item stat score.
- Added session-only **Run while hidden** opt-in for Automation. Default behavior still pauses on focus loss; explicit pause and panels remain paused. Hidden pages are silent. Browser throttling or suspension can interrupt simulation, and closing the page provides no offline catch-up guarantee.
- Save format v2 persists inventory capacity, event progress/claims, supplies and appearance. Valid v1 saves migrate with 24-slot capacity. Existing saves without events initialize event state.

Validation for this update: all 30 pure logic suites and source syntax checks passed, followed by all 26 browser acceptance scripts. Coverage includes v1/v2 save migration, once-only event claims, Tower and Reaper encounters, hidden-tab simulation, exact-rarity filtering, upgrade-before-salvage, and a scrollable 500-item inventory at 1280×720. The browser runner completed successfully; its PowerShell log wrapper reported a nonzero status because unittest writes progress to stderr. The individual unittest result was OK and the runner reported no failed checks. A separate 310.1-second combat/travel stress run completed 1,269 cycles and 15 measured region transitions with zero page errors. Warmed counts stayed at 13 geometries, 1 texture, 7 shader programs, 195 scene children, 32 loot labels and 32 damage labels. This checks allocation stability in the exercised paths, not FPS or every cosmetic unlock. Older verification sections below describe their respective releases.

## Audit improvement update

- Added fallback renderer initialization, class detection for save imports, unique randomized affixes, and level-scaled XP and expedition equipment through item level 100.
- Replaced repeat-visit guardian shortcuts with three explicit dungeon stages: eight kills and a shrine, three kills including two champions and a chest, then the guardian. Stage portals work through E or Automation. Added a live objective tracker and accurate regional map markers.
- Added capped Normal (1-12), Nightmare (13-22) and Hell (23-30) encounters with selection at the refuge, distinct enemy silhouettes and stats, and vampiric, molten and hasted elites.
- Added fourth ultimate abilities with automated resource reservation, three skill-modifying talents per class, attack-speed and cooldown-reduction affixes, burn and poison, and three shrine variants. Legacy talent IDs and saved characters remain supported.
- Added configurable rarity auto-salvage, bulk unfavorited salvage, item hover details and forge affix rerolls. Routine purchases and nonlegendary sales/salvage no longer require browser confirmations.
- Added pooled damage numbers and ranged projectiles, critical hit-stop, collision-aware knockback and reduced-motion-aware camera shake. Potions have a four-second cooldown; combined damage mitigation is capped at 80%.
- Added a procedural ambient drone that follows volume, mute and pause settings. Removed shared scenery material mutation and duplicate startup-error punctuation.

Validation for this update is recorded in `REPORT-IMPLEMENTATION.md`; the resource measurements below describe the earlier expansion build.

## Automated combat and audio update

- Automation casts ready class abilities when resource and target conditions allow, and attempts collision-aware escapes from mob and boss attack warnings. Dodging remains subject to its cooldown; overlapping hazards can still hit.
- Coin and item collection continues during Automation. Kill XP is awarded directly in both control modes.
- Added locally hosted CC0 hit, hurt, enemy-kill, player-death and pickup recordings, with source attribution in `AUDIO-CREDITS.md`. Playback retains volume/mute controls, a shared voice cap and synthesized fallback cues. Death audio can finish on the recovery screen; pause and hidden tabs silence it.

## Control and travel update

- Added a visible Automation / Manual control. Manual is the default and requires player input for movement, loot and basic attacks; right mouse holds a basic attack without chasing. Automation seeks enemies and collectible drops.
- Abilities use mouse aim. Manual chest and shrine interactions use E. Switching modes clears previous commands.
- Travel and expedition entry now wait three seconds with the character idle and gameplay input locked. Repeated requests cannot bypass or replace the pending trip. Initial character entry and death recovery remain immediate.
- XP remains a reward for defeating enemies in either mode.

## Added

- Three abilities per class, resource management and dodge invulnerability. Piercing Volley hits a corridor; Rapid Barrage delivers three timed pulses.
- Eighteen talent nodes, six equipment slots, six legendary properties, filtering, favorites and equipment comparisons.
- Merchant purchases, selling, salvage, five equipment upgrade ranks and a 48-item stash per class.
- Four enemy archetypes, collision-aware committed charger movement, attack warnings, three boss patterns and health-based boss phases.
- Chests, regeneration shrines, map markers, region minimum enemy levels and recoverable death with a bounded gold penalty.
- Six expedition modifiers, three bounty types and highest-tier progression.
- Separate local saves by class, backup recovery, validated JSON import/export, persistent settings and synthesized sound effects.

## Verification

Seventeen pure logic suites cover progression, combat and automation decisions. The browser acceptance suite now includes automatic skill use, evasion with and without dodge availability, loot priority, Manual input gates, the three-second travel lock and recorded audio playback. The browser suite includes all classes, save/load, economy, timed barrage damage, campaign completion, expeditions, death recovery, audio/settings and layout bounds at four viewport sizes. The complete campaign test uses accelerated damage and does not establish normal-speed difficulty or completion time.

The first resource-growth test observed a geometry count increase from 9 to 10. Geometry ID tracing identified the additional upload as the preallocated Bellwarden warning ring. The revised run warmed every boss-ring geometry first. Chromium 141.0.7390.37 at 1280×720 then held identical counts from 10 to 310 seconds: 12 geometries, 1 texture, 7 shader programs, 178 scene children and 32 loot labels, with zero page errors. This establishes bounded resource counts in the fixture, not a frame-rate benchmark.

Final review also found and fixed an import boundary issue: unknown hero fields in JSON could overwrite live render/position objects. Restoration now copies only durable character fields; the regression and browser Continue check pass.

## Known limits

Desktop mouse/keyboard controls only. Three.js still requires its pinned CDN. Manual movement uses collision sliding; Automation uses bounded route finding. Visual screenshot inspection and a full normal-speed campaign balance playtest remain unverified. The shipped source contains no mutable testing hooks; browser fixtures inject those only into their own test sessions.

This directory is the local release source. GitHub Pages is not updated merely by changing these files.
