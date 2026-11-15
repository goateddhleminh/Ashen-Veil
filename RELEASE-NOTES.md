# The Last Embers — expansion notes

This release expands the original arena into a single-player campaign with Ember Refuge, the Forgotten Graveyard, Cinder Marsh and Hollow Citadel. Nine quests and three guardians lead to repeatable tiered expeditions.

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

Sixteen pure logic suites and sixteen current browser acceptance scripts have passed, including manual/automation controls and the three-second travel lock. The browser suite includes all classes, save/load, economy, timed barrage damage, campaign completion, expeditions, death recovery, audio/settings and layout bounds at four viewport sizes. The complete campaign test uses accelerated damage and does not establish normal-speed difficulty or completion time.

The first resource-growth test observed a geometry count increase from 9 to 10. Geometry ID tracing identified the additional upload as the preallocated Bellwarden warning ring. The revised run warmed every boss-ring geometry first. Chromium 141.0.7390.37 at 1280×720 then held identical counts from 10 to 310 seconds: 12 geometries, 1 texture, 7 shader programs, 178 scene children and 32 loot labels, with zero page errors. This establishes bounded resource counts in the fixture, not a frame-rate benchmark.

Final review also found and fixed an import boundary issue: unknown hero fields in JSON could overwrite live render/position objects. Restoration now copies only durable character fields; the regression and browser Continue check pass.

## Known limits

Desktop mouse/keyboard controls only. Three.js still requires its pinned CDN. Manual movement uses collision sliding; Automation uses bounded route finding. Visual screenshot inspection and a full normal-speed campaign balance playtest remain unverified. The shipped source contains no mutable testing hooks; browser fixtures inject those only into their own test sessions.

This directory is the local release source. GitHub Pages is not updated merely by changing these files.
