// Arena sizes stay within the existing sixteen-actor pool.
export function towerEncounter(floor) {
  if (!Number.isSafeInteger(floor) || floor < 1) throw new RangeError('Invalid tower floor');
  const boss = floor % 10 === 0, miniBoss = !boss && floor % 5 === 0;
  return { floor, boss, miniBoss, count: boss ? 9 : miniBoss ? 11 : 12,
    healthMultiplier: 1 + (floor - 1) * .12, damageMultiplier: 1 + (floor - 1) * .065 };
}
export function moonEnemyModifiers(active) {
  return active ? {health:1.5,damage:1.5,goldMultiplier:2,rareBoost:.2} : {health:1,damage:1,goldMultiplier:1,rareBoost:0};
}
