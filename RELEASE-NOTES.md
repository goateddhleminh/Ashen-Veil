# The Last Embers — expansion notes

This release expands the original arena into a single-player campaign with Ember Refuge, the Forgotten Graveyard, Cinder Marsh and Hollow Citadel. Nine quests and three guardians lead to repeatable tiered expeditions.

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
