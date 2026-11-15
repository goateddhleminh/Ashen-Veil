/**
 * Engine-independent progression, item and equipment helpers.
 *
 * A hero stores baseStats and equipment; derived combat values are rebuilt by
 * recomputeStats. Equipment changes preserve current HP (clamped to maxHp).
 * API: createItem(classId, level=1, rarity?, slot?) returns an item (level 1..100).
 * initializeProgression(hero,classId) resets progression and fills HP; returns hero.
 * recomputeStats(hero) returns hero; never heals or revives. Mutable hero required.
 * equipItem(hero,id), unequipItem(hero,slot), allocateStat(hero,key), usePotion(hero)
 * mutate the supplied hero on success and return readable UI messages.
 * Slots: weapon/armor; inventory capacity: 24; weapon class restrictions enforced.
 * crit is percent (0..100); lifeOnHit is flat healing for combat to apply per hit.
 * Potions heal exactly 45% maxHP, capped by missing HP; no consumption at full/dead.
 * Currency counters are collectible only. No spending/vendor API in this phase.
 * Loot uses Math.random (60% common, 27% magic, 11% rare, 2% legendary).
 * No rendering imports, DOM, storage or engine effects; caller owns hero state.
 */

import { TALENTS } from './talents.js';
import { AFFIXES, LEGENDARIES } from './items.js';

export const CLASSES = Object.freeze({
  warrior: { name: 'Warrior', description: 'A durable melee fighter.', color: '#c45b4f', stats: { strength: 12, intelligence: 5, dexterity: 7, vitality: 12 }, speed: 6, range: 2.15, attackSeconds: .68, primary: 'strength' },
  mage: { name: 'Mage', description: 'A spellcaster with potent intellect.', color: '#6f7ed8', stats: { strength: 5, intelligence: 14, dexterity: 7, vitality: 8 }, speed: 5.2, range: 8, attackSeconds: .9, primary: 'intelligence' },
  archer: { name: 'Archer', description: 'A swift ranged hunter.', color: '#62a56f', stats: { strength: 7, intelligence: 6, dexterity: 14, vitality: 9 }, speed: 7, range: 7, attackSeconds: .58, primary: 'dexterity' }
});

export const RARITIES = Object.freeze({
  common: { name: 'Common', color: '#a7adb4' }, magic: { name: 'Magic', color: '#4e9fe6' },
  rare: { name: 'Rare', color: '#d7b448' }, legendary: { name: 'Legendary', color: '#e27b35' }
});

export const slots = ['weapon', 'armor', 'helm', 'gloves', 'boots', 'ring'];
let nextItemId = 1;
// A page-specific namespace keeps newly dropped items distinct from loaded gear.
const itemNamespace = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const n = (v, fallback = 0) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const validClass = id => Object.hasOwn(CLASSES, id ?? '') ? id : 'warrior';
const validSlot = slot => slots.includes(slot) ? slot : 'weapon';

export function createItem(classId, level = 1, rarity, slot) {
  const classKey = Object.hasOwn(CLASSES, classId ?? '') ? classId : null;
  const itemLevel = Math.min(100, Math.max(1, Math.floor(n(level, 1))));
  const roll = Math.random();
  const chosenRarity = Object.hasOwn(RARITIES, rarity ?? '') ? rarity : (roll < .6 ? 'common' : roll < .87 ? 'magic' : roll < .98 ? 'rare' : 'legendary');
  const itemSlot = validSlot(slot || slots[Math.floor(Math.random() * slots.length)]);
  const scale = itemLevel * ({ common: 1, magic: 1.35, rare: 1.8, legendary: 2.5 }[chosenRarity]);
  const mods = { damage: 0, armor: 0, life: 0, strength: 0, intelligence: 0, dexterity: 0, vitality: 0, crit: 0 };
  if (itemSlot === 'weapon') mods.damage = Math.max(1, Math.round(scale * 2.2));
  else { mods.armor = Math.max(1, Math.round(scale * 2.4)); mods.life = Math.round(scale * 3); }
  const affixCount = { common: 0, magic: 1, rare: 2, legendary: 3 }[chosenRarity];
  const affixes = Object.keys(AFFIXES);
  for (let i = 0; i < affixCount; i++) {
    const key = affixes[(Math.floor(Math.random() * affixes.length) + i) % affixes.length];
    mods[key] += key === 'crit' ? Math.max(1, Math.round(scale * 0.8)) : Math.max(1, Math.round(scale * .65));
  }
  if (chosenRarity === 'legendary') mods.lifeOnHit = Math.max(2, Math.round(scale * .6));
  const label = itemSlot === 'weapon' ? ({ warrior: 'Blade', mage: 'Staff', archer: 'Bow' }[classKey] || 'Blade') : ({armor:'Mail',helm:'Crown',gloves:'Grips',boots:'Treads',ring:'Signet'}[itemSlot]);
  return { id: `item-${itemNamespace}-${nextItemId++}`, name: `${RARITIES[chosenRarity].name} ${label}`, slot: itemSlot, rarity: chosenRarity, level: itemLevel, mods, legendary: chosenRarity === 'legendary' ? Object.keys(LEGENDARIES)[Math.floor(Math.random()*6)] : null, classId: itemSlot !== 'weapon' ? null : classKey };
}

export function recomputeStats(hero) {
  if (!hero || typeof hero !== 'object') return hero;
  const base = hero.baseStats || { strength: 0, intelligence: 0, dexterity: 0, vitality: 0 };
  const stats = { strength: n(base.strength), intelligence: n(base.intelligence), dexterity: n(base.dexterity), vitality: n(base.vitality) };
  let damage = 0, armor = 0, life = 0, crit = 0, lifeOnHit = 0;
  for (const item of Object.values(hero.equipment || {})) {
    if (!item?.mods) continue;
    damage += n(item.mods.damage); armor += n(item.mods.armor); life += n(item.mods.life); crit += n(item.mods.crit); lifeOnHit += n(item.mods.lifeOnHit);
    for (const key of Object.keys(stats)) stats[key] += n(item.mods[key]);
  }
  const bonuses={damage:0,life:0,armor:0,crit:0,lifeOnHit:0,speed:0};
  for(const node of TALENTS[validClass(hero.classId)]) bonuses[node.stat]+=Math.min(node.maxRank,Math.max(0,n(hero.talents?.[node.id])))*node.value;
  damage+=bonuses.damage;life+=bonuses.life;armor+=bonuses.armor;crit+=bonuses.crit;lifeOnHit+=bonuses.lifeOnHit;
  const cls = CLASSES[validClass(hero.classId)];
  hero.legendaryEffects = [...new Set(Object.values(hero.equipment||{}).map(item=>item?.legendary).filter(id=>Object.hasOwn(LEGENDARIES,id??'')))];
  hero.stats = stats;
  hero.damage = Math.max(1, Math.round(damage + stats[cls.primary] * 2));
  hero.lifeOnHit = Math.max(0, lifeOnHit) + (hero.legendaryEffects.includes('blood')?3:0);
  hero.maxHp = Math.max(1, Math.round(50 + stats.vitality * 10 + life));
  hero.armor = Math.max(0, Math.round(armor + stats.vitality * .5));
  hero.crit = Math.min(100, Math.max(0, 5 + stats.dexterity * .5 + crit));
  hero.speed = Math.max(0, cls.speed + stats.dexterity * .03 + bonuses.speed);
  hero.range = cls.range;
  hero.attackSeconds = cls.attackSeconds * (hero.legendaryEffects.includes('haste')?.85:1);
  hero.hp = Math.max(0, Math.min(n(hero.hp), hero.maxHp));
  return hero;
}

export function initializeProgression(hero, classId) {
  if (!hero || typeof hero !== 'object') return hero;
  hero.classId = validClass(classId); hero.baseStats = { ...CLASSES[hero.classId].stats };
  hero.equipment = { weapon: createItem(hero.classId, 1, 'common', 'weapon'), armor: createItem(hero.classId, 1, 'common', 'armor') };
  hero.stash = []; hero.talents = {}; hero.talentPoints = 0;
  for(const slot of slots) hero.equipment[slot] ??= null;
  hero.inventory = []; hero.currencies = { gold: 0, gems: 0, diamonds: 0 }; hero.potions = 3; hero.statPoints = 0;
  hero.hp = 1; recomputeStats(hero); hero.hp = hero.maxHp; hero.alive = true; return hero;
}

export function equipItem(hero, id) {
  if (!Array.isArray(hero?.inventory) || !hero.equipment) return 'Cannot equip item: hero is not initialized.';
  const index = hero.inventory.findIndex(item => item?.id === id); if (index < 0) return 'Item not found in inventory.';
  const item = hero.inventory[index]; if (!slots.includes(item.slot)) return 'Item has an invalid slot.';
  if (item.classId && item.classId !== hero.classId) return 'This item belongs to another class.';
  const old = hero.equipment[item.slot]; hero.equipment[item.slot] = item; hero.inventory.splice(index, 1); if (old) hero.inventory.push(old);
  recomputeStats(hero); return `Equipped ${item.name}.`;
}

export function unequipItem(hero, slot) {
  if (!hero?.equipment || !Array.isArray(hero.inventory) || !slots.includes(slot)) return 'Cannot unequip: invalid slot or inventory.';
  if ((hero.inventory || []).length >= 24) return 'Inventory is full (24 items).';
  const item = hero.equipment[slot]; if (!item) return `No ${slot} equipped.`;
  hero.inventory ||= []; hero.inventory.push(item); hero.equipment[slot] = null; recomputeStats(hero); return `Unequipped ${item.name}.`;
}

export function allocateStat(hero, key) {
  if (!hero?.baseStats || !['strength', 'intelligence', 'dexterity', 'vitality'].includes(key)) return 'Invalid stat.';
  if (n(hero.statPoints) < 1) return 'No stat points available.';
  hero.baseStats[key] = n(hero.baseStats[key]) + 1; hero.statPoints--; recomputeStats(hero); return `Increased ${key}.`;
}

export function usePotion(hero) {
  if (!hero || hero.alive === false || n(hero.hp) <= 0 || n(hero.hp) >= n(hero.maxHp) || n(hero.potions) < 1) return 'Potion could not be used.';
  const healed = Math.min(hero.maxHp - hero.hp, hero.maxHp * .45); hero.hp += healed; hero.potions--; return `Restored ${Math.round(healed)} health.`;
}

