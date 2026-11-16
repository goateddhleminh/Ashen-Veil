import { CLASSES, RARITIES, recomputeStats, INVENTORY_BASE_CAPACITY, INVENTORY_MAX_CAPACITY } from './progression.js';
import { xpForLevel } from './data.js';
import { TALENTS } from './talents.js';
import { LEGENDARIES } from './items.js';
import { REGIONS, isDifficulty } from './regions.js';
import { QUESTS } from './quests.js';
import { validateEventsState, normalizeEventsState } from './events.js';

const VERSION = 2;
const PREVIOUS_VERSION = 1;
const slots = ['weapon', 'armor', 'helm', 'gloves', 'boots', 'ring'];
const attributes = ['strength', 'intelligence', 'dexterity', 'vitality'];
const modifiers = [...attributes, 'damage', 'armor', 'life', 'crit', 'lifeOnHit', 'attackSpeed', 'cooldownReduction'];
const clone = value => JSON.parse(JSON.stringify(value));
const integer = (value, max = 1e9) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const number = (value, max = 1e6) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const key = classId => `ashenv:save:${classId}`;
const fail = error => ({ ok: false, error });
function storageOrDefault(storage) { return storage ?? globalThis.localStorage; }

// Only durable plain data crosses this boundary; models and encounter timers never do.
export function createSave(hero, worldState = {}) {
  const fields = ['classId', 'level', 'xp', 'hp', 'baseStats', 'equipment', 'inventory', 'currencies', 'potions', 'statPoints', 'inventoryCapacity', 'manaPotions', 'portalScrolls', 'resetTokens', 'dust', 'shards', 'reaperFragments', 'socketGems', 'eventRewards', 'eventAppearance'];
  const durable = Object.fromEntries(fields.map(field => [field, hero[field]]));
  durable.stash = hero.stash ?? [];
  durable.talents = hero.talents ?? {};
  durable.talentPoints = hero.talentPoints ?? 0;
  return clone({ version: VERSION, hero: durable, world: worldState });
}

export function loadSave(raw, classId) {
  try {
    if (typeof raw !== 'string' || raw.length > 1000000) return fail('Save is missing or too large.');
    const data = JSON.parse(raw), h = data?.hero;
    if (!record(data) || ![PREVIOUS_VERSION, VERSION].includes(data.version)) return fail('Unsupported save version.');
     if (data.version === PREVIOUS_VERSION) { data.version = VERSION; data.hero.inventoryCapacity = INVENTORY_BASE_CAPACITY; }
    if (!record(h) || !Object.hasOwn(CLASSES, h.classId) || h.classId !== classId) return fail('Save belongs to a different class.');
    if ((h.inventoryCapacity ?? INVENTORY_BASE_CAPACITY) < INVENTORY_BASE_CAPACITY || !integer(h.inventoryCapacity ?? INVENTORY_BASE_CAPACITY, INVENTORY_MAX_CAPACITY) || !['manaPotions','portalScrolls','resetTokens','dust','shards','reaperFragments'].every(k=>h[k]===undefined||integer(h[k],1e9)) || (h.socketGems!==undefined&&(!record(h.socketGems)||!Object.entries(h.socketGems).every(([k,v])=>['ruby','sapphire','emerald'].includes(k)&&integer(v,1e9)))) || (h.eventRewards!==undefined&&(!Array.isArray(h.eventRewards)||!h.eventRewards.every(r=>record(r)&&['title','cosmetic','weaponSkin'].includes(r.type)&&typeof r.id==='string'&&r.id.length<=100))) || (h.eventAppearance!==undefined&&(!record(h.eventAppearance)||!['title','cosmetic','weaponSkin'].every(k=>h.eventAppearance[k]===undefined||typeof h.eventAppearance[k]==='string'))) || !integer(h.level, 100) || h.level < 1 || !integer(h.xp) || !number(h.hp) || !integer(h.potions, 9999) || !integer(h.statPoints, 10000) || !integer(h.talentPoints, 10000)) return fail('Invalid character values.');
    if (!record(h.baseStats) || !attributes.every(a => integer(h.baseStats[a], 10000))) return fail('Invalid attributes.');
    if (!record(h.currencies) || !['gold', 'gems', 'diamonds'].every(c => integer(h.currencies[c]))) return fail('Invalid currency.');
    if (!Array.isArray(h.inventory) || h.inventory.length > (h.inventoryCapacity ?? INVENTORY_BASE_CAPACITY) || !Array.isArray(h.stash) || h.stash.length > 48 || !record(h.equipment)) return fail('Invalid inventory.');
    if (!Object.keys(h.equipment).every(s => slots.includes(s))) return fail('Unknown equipment slot.');
    const ids = new Set();
    const validItem = item => {
      if (!record(item) || typeof item.id !== 'string' || !item.id.length || item.id.length > 100 || ids.has(item.id)) return false;
      ids.add(item.id);
      return (item.legendary == null || (item.rarity === 'legendary' && Object.hasOwn(LEGENDARIES,item.legendary))) && (item.favorite === undefined || typeof item.favorite === 'boolean') && (item.upgrades === undefined || integer(item.upgrades, 5)) && typeof item.name === 'string' && item.name.length <= 160 && slots.includes(item.slot) && Object.hasOwn(RARITIES, item.rarity) && integer(item.level, 100) && item.level > 0 && (item.classId === null || Object.hasOwn(CLASSES, item.classId)) && record(item.mods) && Object.entries(item.mods).every(([m, v]) => modifiers.includes(m) && number(v, 10000));
    };
    for (const [slot, item] of Object.entries(h.equipment)) {
      if (item !== null && (!validItem(item) || item.slot !== slot || (item.classId && item.classId !== classId))) return fail('Invalid equipped item.');
    }
    if (![...h.inventory, ...h.stash].every(validItem)) return fail('Invalid or duplicate item.');
    if (!record(h.talents) || !Object.entries(h.talents).every(([id, rank]) => TALENTS[classId].some(node => node.id === id) && integer(rank, 3))) return fail('Invalid talents.');
    if (!record(data.world)) return fail('Invalid world progress.');
    // Bound all future durable quest/world fields and reject duplicate reward claims.
    const validWorld = (value, depth = 0) => {
      if (depth > 8) return false;
      if (value === null || typeof value === 'boolean') return true;
      if (typeof value === 'number') return number(value, 1e9);
      if (typeof value === 'string') return value.length <= 200;
      if (Array.isArray(value)) return value.length <= 200 && value.every(v => validWorld(v, depth + 1));
      return record(value) && Object.keys(value).length <= 100 && Object.entries(value).every(([k, v]) => !['__proto__', 'constructor', 'prototype'].includes(k) && validWorld(v, depth + 1));
    };
    const { events, ...ordinaryWorld } = data.world;
    if (!validWorld(ordinaryWorld) || !validateEventsState(events)) return fail('Invalid world progress.');
    if (events !== undefined) data.world.events = normalizeEventsState(events);
    const world=data.world;
    if(world.difficulty!==undefined&&!isDifficulty(world.difficulty))return fail('Invalid difficulty.');
    if(world.highestTier!==undefined&&!integer(world.highestTier,100))return fail('Invalid expedition tier.');
    if(world.region!==undefined&&!Object.hasOwn(REGIONS,world.region))return fail('Unknown region.');
    if(world.unlocked!==undefined&&(!Array.isArray(world.unlocked)||!world.unlocked.every(id=>Object.hasOwn(REGIONS,id))||new Set(world.unlocked).size!==world.unlocked.length))return fail('Invalid region unlocks.');
    if(world.campaignComplete!==undefined&&typeof world.campaignComplete!=='boolean')return fail('Invalid campaign completion.');
    if(world.questProgress!==undefined&&(!record(world.questProgress)||!Object.entries(world.questProgress).every(([id,count])=>{const quest=QUESTS.find(q=>q.id===id);return quest&&integer(count,quest.target);})))return fail('Invalid quest progress.');
    const claims = data.world.claimedRewards;
    if (claims !== undefined && (!Array.isArray(claims) || !claims.every(c => typeof c === 'string') || new Set(claims).size !== claims.length)) return fail('Duplicate or invalid reward claims.');
    if(world.unlocked && !['refuge','graveyard'].every(id=>world.unlocked.includes(id)))return fail('Missing initial destinations.');
    if(claims?.some(id=>!QUESTS.some(q=>q.id===id)))return fail('Unknown reward claim.');
    for(const [region,next] of [['graveyard','marsh'],['marsh','citadel'],['citadel',null]]){
      if(!claims?.includes(`${region}-boss`))continue;
      if(!['kill','chest'].every(type=>claims.includes(`${region}-${type}`)) || (next&&!world.unlocked?.includes(next)) || (!next&&!world.campaignComplete))return fail('Inconsistent campaign rewards.');
    }
    return { ok: true, value: data };
  } catch { return fail('Save file is not valid JSON.'); }
}

export function applySave(hero, data) {
  const checked = loadSave(JSON.stringify(data), hero.classId);
  if (!checked.ok) return checked;
  Object.assign(hero, createSave(checked.value.hero).hero);
  recomputeStats(hero);
  hero.xpNeeded = xpForLevel(hero.level);
  hero.alive = hero.hp > 0;
  return { ok: true, world: clone(checked.value.world) };
}

function writeValidated(data, storage) {
  const checked = loadSave(JSON.stringify(data), data.hero.classId);
  if (!checked.ok) return checked;
  try {
    const store = storageOrDefault(storage), name = key(data.hero.classId);
    const previous = store.getItem(name);
    if (loadSave(previous, data.hero.classId).ok) store.setItem(`${name}:backup`, previous);
    store.setItem(name, JSON.stringify(data));
    return { ok: true, value: data };
  } catch { return fail('Could not save progress. Browser storage may be full or disabled.'); }
}
export function saveClass(hero, worldState = {}, storage) { return writeValidated(createSave(hero, worldState), storage); }
export function readClass(classId, storage) {
  if (!Object.hasOwn(CLASSES, classId)) return fail('Unknown class.');
  try {
    const store = storageOrDefault(storage), primary = loadSave(store.getItem(key(classId)), classId);
    if (primary.ok) return primary;
    const backup = loadSave(store.getItem(`${key(classId)}:backup`), classId);
    return backup.ok ? { ...backup, recovered: true } : primary;
  } catch { return fail('Browser storage is unavailable.'); }
}
export function importSave(text, classId, storage) {
  const checked = loadSave(text, classId);
  return checked.ok ? writeValidated(checked.value, storage) : checked;
}
export function exportSave(classId, storage) {
  const result = readClass(classId, storage);
  return result.ok ? { ok: true, text: JSON.stringify(result.value, null, 2) } : result;
}
export function deleteClassSave(classId, storage) {
  if (!Object.hasOwn(CLASSES, classId)) return fail('Unknown class.');
  try {
    const store = storageOrDefault(storage);
    store.removeItem(key(classId)); store.removeItem(`${key(classId)}:backup`);
    return { ok: true };
  } catch { return fail('Could not delete save.'); }
}
