// Balance lives here, separate from rendering and simulation.
export const WORLD = { halfSize: 24, enemyCap: 16, spawnSeconds: 3.4 };
export const WARRIOR = { hp: 150, speed: 6, radius: .42, damage: 25, range: 2.15, attackSeconds: .68 };
export const UNDEAD = { hp: 58, speed: 2.25, radius: .42, damage: 9, range: 1.2, aggro: 14, attackSeconds: 1.35, windup: .42, xp: 24 };
export const xpForLevel = level => 70 + (level - 1) * 45;
