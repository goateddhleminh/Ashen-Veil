# Improvement report implementation tracker

Source: Ashen_Veil_Improvement_Report.pdf, all 11 pages read, auditing commit 6a3c00d. Work in progress; nothing in this document is a completion claim.

## Stability and economy
- BUG-01: renderer fallback; graceful failure still required where WebGL is unavailable.
- BUG-02: encounter/expedition item levels through 100 and level-scaled XP.
- BUG-03: unique shuffled affixes and ±15% rolls.
- BUG-04: current-run guardian prerequisites, independent of persistent quest completion.
- BUG-05: infer import class after validating supplied data.
- BUG-06: remove routine buy/sell/salvage browser confirmations; preserve favorites.
- BUG-07: stop mutating shared graveyard material on travel.
- BUG-08: sanitize startup error punctuation.
- Rarity auto-salvage, bulk unfavorited salvage, ground item details.
- Cooldown reduction and attack-speed affixes; forge affix reroll.

## Combat and presentation
- Damage numbers, critical feedback/hit-stop, reduced-motion-aware shake, collision-aware knockback.
- Four-second potion cooldown and 80% total mitigation ceiling.
- Distinct enemy/boss silhouettes and archetype stats.
- Ambient procedural audio respecting existing settings and pause.
- Ranged projectile travel and distinct effects.
- Elite traits (vampiric, molten, hasted); burn/poison status damage.

## Progression and world
- Fourth skill per class with UI/keyboard/automation coverage.
- Three skill-modifying passive nodes per class, preserving existing talent IDs and saves.
- Normal/Nightmare/Hell difficulty brackets.
- Three-stage regional progression, current-run objectives and portal transitions.
- HUD objective tracker, varied regional objective coordinates and shrine variants.
- Review HP/DPS/XP progression with measured balance outputs, not audit estimates alone.

## Scope and verification
Keep gems/diamonds as currencies; no socket system or elemental resistance table, as recommended. Hardcore is mentioned as absent, but the report does not recommend adding it. Existing fixed-step engine, pooled rendering and static hosting remain.

Verification will cover pure logic, browser controls/persistence/combat/campaign/expeditions/settings, software-renderer startup, sampled audio, layout and bounded rendering resources. Audit performance and campaign-duration statements are hypotheses until measured. Packaging and publication follow integration checks.

## Verification evidence (2026-11-16)

- All 25 existing pure logic suites and source syntax checks passed after integration.
- All 22 browser acceptance checks have passing results. The combined runner passed its first 18 checks before encountering a stale two-kill stage-two fixture. The corrected five-case bug regression suite passed separately; class-depth, quick-wins and projectile-pause checks also passed separately.
- Campaign completion exercises the minimum 12-kill route through each region and all nine quest rewards. These accelerated fixtures do not establish normal-speed completion time.
- Sustained resource test: Chromium 141.0.7390.37, 1280x720, 310.1 seconds, 1,266 stress cycles and 15 measured region transitions after warmup. Baseline and final counts match: 13 geometries, 1 texture, 7 programs, 195 scene children, 32 loot labels, 32 damage labels, 16 enemies, 16 projectiles and 20 effects. Zero page errors. This is allocation stability, not an FPS benchmark.
- Ambient tests verify volume is applied once and ambient audio stays silent during the death-sound tail.
- Final follow-up verified: campaign encounter caps are Normal 1–12, Nightmare 13–22 and Hell 23–30; Automation reserves resource for in-range ultimates and sustained 600-second simulation cast Warrior Cataclysm 24 times, Mage Starfall 20 times and Archer Arrowstorm 24 times; campaign enemy health uses a bounded measured curve (level 1 TTK 1.14s, level 12 1.37s, level 22 1.33s, level 30 1.25s) while expedition scaling remains independent.
