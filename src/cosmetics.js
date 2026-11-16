// Rendering adapter: callers apply after equip/load, never from the animation loop.
// Materials and crown meshes are prepared once by createActor; only references change.
function owns(hero, type, id) {
  if (typeof id !== 'string' || !Array.isArray(hero.eventRewards)) return false;
  for (let i = 0; i < hero.eventRewards.length; i++) {
    const reward = hero.eventRewards[i];
    if (reward?.type === type && reward.id === id) return true;
  }
  return false;
}

export function applyHeroCosmetics(hero) {
  const parts = hero?.cosmeticParts;
  if (!parts || hero.enemy) return hero;
  const appearance = hero.eventAppearance;
  const cosmetic = appearance?.cosmetic;
  let cape = parts.defaults.cape;
  if (owns(hero, 'cosmetic', cosmetic)) {
    if (cosmetic === 'veteran-cape') cape = parts.materials.veteran;
    else if (cosmetic === 'blood-moon-cape') cape = parts.materials.bloodMoon;
    else if (cosmetic === 'graveyard-gold-cape') cape = parts.materials.graveyard;
    else if (cosmetic === 'marsh-gold-cape') cape = parts.materials.marsh;
    else if (cosmetic === 'citadel-gold-cape') cape = parts.materials.citadel;
    else if (cosmetic === 'conqueror-cape' || (cosmetic.endsWith('-cape') && cosmetic.includes('gold'))) cape = parts.materials.gold;
  }
  parts.cape.material = cape;
  const crowned = cosmetic === 'graveyard-crown' && owns(hero, 'cosmetic', cosmetic);
  parts.crown.visible = crowned;
  parts.helm.material = crowned ? parts.materials.gold : parts.defaults.helm;
  parts.plume.visible = !crowned;
  const infernal = appearance?.weaponSkin === 'infernal' && owns(hero, 'weaponSkin', 'infernal');
  for (let i = 0; i < parts.weapons.length; i++) {
    parts.weapons[i].material = infernal ? parts.materials.infernal : parts.defaults.weapons[i];
  }
  return hero;
}
