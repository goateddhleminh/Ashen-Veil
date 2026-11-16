import { createItem, inventoryCapacity, inventoryExpansionCost, INVENTORY_MAX_CAPACITY } from './progression.js';
const result=(ok,message)=>({ok,message});
const find=(hero,id)=>hero.inventory.findIndex(item=>item.id===id);
export const saleValue=item=>Math.max(1,item.level*({common:8,magic:15,rare:30,legendary:65}[item.rarity]??8));
export const SALE_CURRENCY_DIVISORS=Object.freeze({gold:1,gems:50,diamonds:200});
export const WALLET_MAX=1e9;
export const AUTO_SELL_RARITIES=Object.freeze(['common','magic','rare','legendary']);
export const AUTO_SELL_TYPES=Object.freeze(['sword','staff','bow','armor','helm','gloves','boots','ring']);
export function itemSaleType(item) {
 return item?.slot==='weapon'?({warrior:'sword',mage:'staff',archer:'bow'}[item.classId]??null):AUTO_SELL_TYPES.includes(item?.slot)?item.slot:null;
}
export function saleValueForCurrency(item,currency='gold') {
 if(!item || !Object.hasOwn(SALE_CURRENCY_DIVISORS,currency))return 0;
 const gold=saleValue(item);
 return Number.isFinite(gold)?(currency==='gold'?gold:Math.max(1,Math.floor(gold/SALE_CURRENCY_DIVISORS[currency]))):0;
}
export function validAutoSellConfig(config) {
 return Boolean(config&&typeof config.enabled==='boolean'&&Array.isArray(config.rarities)&&config.rarities.every(r=>AUTO_SELL_RARITIES.includes(r))&&Array.isArray(config.types)&&config.types.every(t=>AUTO_SELL_TYPES.includes(t))&&Object.hasOwn(SALE_CURRENCY_DIVISORS,config.currency));
}
export function shouldAutoSell(item,config) {
 return Boolean(item&&!item.favorite&&validAutoSellConfig(config)&&config.enabled&&config.rarities.includes(item.rarity)&&config.types.includes(itemSaleType(item)));
}
export function canCreditSale(hero,item,currency='gold') {
 const value=saleValueForCurrency(item,currency),balance=hero.currencies?.[currency];
 return value>0&&Number.isFinite(balance)&&balance>=0&&balance+value<=WALLET_MAX;
}
export function sellItem(hero,id,currency='gold') {
 const i=find(hero,id),item=hero.inventory[i];
 if(!item || item.favorite) return result(false,'Item missing or protected by Favorite.');
 if(!Object.hasOwn(SALE_CURRENCY_DIVISORS,currency))return result(false,'Unknown sale currency.');
 if(!canCreditSale(hero,item,currency))return result(false,`Cannot sell: ${currency} wallet limit reached or invalid balance.`);
 const value=saleValueForCurrency(item,currency);hero.inventory.splice(i,1);hero.currencies[currency]+=value;
 return result(true,`Sold ${item.name} for ${value} ${currency}.`);
}
export function deleteItem(hero,id) {
 const i=find(hero,id),item=hero.inventory[i];
 if(!item || item.favorite)return result(false,'Item missing or protected by Favorite.');
 hero.inventory.splice(i,1);return result(true,`Deleted ${item.name}.`);
}
export function autoSellInventory(hero,config) {
 let count=0,total=0;
 for(const item of [...hero.inventory])if(shouldAutoSell(item,config)) {
  const value=saleValueForCurrency(item,config.currency);
  if(sellItem(hero,item.id,config.currency).ok){count++;total+=value;}
 }
 return {ok:count>0,count,message:count?`Auto-sold ${count} items for ${total} ${config.currency}.`:'No matching items could be auto-sold.'};
}
export const salvageValue=item=>({common:1,magic:2,rare:4,legendary:8}[item.rarity]??0);
export function shouldAutoSalvage(item,threshold='none') {
 const rank={common:0,magic:1,rare:2};
 return Boolean(item&&!item.favorite&&Object.hasOwn(rank,item.rarity)&&Object.hasOwn(rank,threshold)&&rank[item.rarity]<=rank[threshold]);
}
export function shouldAutoSalvageExact(item,rarity='none') {
  return Boolean(item&&!item.favorite&&rarity !== 'none'&&rarity !== 'legendary'&&item.rarity === rarity);
}
export function buyInventoryCapacity(hero) {
  const capacity=inventoryCapacity(hero);
  if(capacity>=INVENTORY_MAX_CAPACITY)return result(false,'Inventory capacity is already at maximum (500).');
  const cost=inventoryExpansionCost(hero);
  if((hero.currencies?.gold??0)<cost)return result(false,`Requires ${cost} gold.`);
  hero.currencies.gold-=cost; hero.inventoryCapacity=Math.min(INVENTORY_MAX_CAPACITY,capacity+4);
  return result(true,`Inventory capacity expanded to ${hero.inventoryCapacity}.`);
}
// Bulk actions deliberately preserve legendary equipment as well as favorites.
export function salvageUnfavorited(hero) {
 const items=hero.inventory.filter(item=>shouldAutoSalvage(item,'rare'));
 if(!items.length)return result(false,'No unprotected Common, Magic or Rare items to salvage.');
 const gems=items.reduce((sum,item)=>sum+salvageValue(item),0);
 hero.inventory=hero.inventory.filter(item=>!shouldAutoSalvage(item,'rare'));hero.currencies.gems+=gems;
 return result(true,`Salvaged ${items.length} items for ${gems} gems. Favorites and Legendary gear kept.`);
}
export function salvageItem(hero,id) {
 const i=find(hero,id),item=hero.inventory[i];
 if(!item || item.favorite) return result(false,'Item missing or protected by Favorite.');
 const gems=salvageValue(item);
 hero.inventory.splice(i,1);hero.currencies.gems+=gems;
 return result(true,`Salvaged ${item.name} for ${gems} gems.`);
}
export function stashItem(hero,id) {
 const i=find(hero,id); hero.stash??=[];
 if(i<0 || hero.stash.length>=48) return result(false,'Item missing or stash full (48).');
 hero.stash.push(hero.inventory.splice(i,1)[0]);return result(true,'Item stored.');
}
export function retrieveItem(hero,id) {
 const i=(hero.stash??[]).findIndex(item=>item.id===id);
 if(i<0 || hero.inventory.length>=inventoryCapacity(hero)) return result(false,`Item missing or inventory full (${inventoryCapacity(hero)}).`);
 hero.inventory.push(hero.stash.splice(i,1)[0]);return result(true,'Item retrieved.');
}
export function craftCost(item) {const rank=item.upgrades??0;return {gold:100*(rank+1)*item.level,gems:3*(rank+1),diamonds:rank>=2?1:0};}
export const rerollCost=item=>({gold:50*item.level,gems:2,diamonds:0});
export function craftItem(hero,recipe,id,random=Math.random) {
 const item=hero.inventory[find(hero,id)];
 if(recipe==='reroll'){
  if(!item)return result(false,'Choose an inventory item to reroll.');
  const keys=Object.keys(item.mods).filter(key=>!['damage','armor','life'].includes(key)&&item.mods[key]>0);
  if(!keys.length)return result(false,'This item has no bonus affix to reroll.');
  const cost=rerollCost(item);
  if(Object.entries(cost).some(([key,value])=>hero.currencies[key]<value))return result(false,'Not enough gold or gems.');
  const key=keys[Math.min(keys.length-1,Math.floor(random()*keys.length))];
  const scale=item.level*({common:1,magic:1.35,rare:1.8,legendary:2.5}[item.rarity]??1);
  const factor=key==='crit'?.8:['attackSpeed','cooldownReduction'].includes(key)?.08:.65;
  let value=Math.max(1,Math.round(scale*factor*(.85+random()*.3)));
  for(let i=0;i<(item.upgrades??0);i++)value+=Math.max(1,Math.ceil(value*.12));
  for(const [currency,amount]of Object.entries(cost))hero.currencies[currency]-=amount;
  const before=item.mods[key];item.mods[key]=value;
  return result(true,`${item.name}: ${key} rerolled ${before} → ${value}.`);
 }
 if(!item || recipe!=='upgrade') return result(false,'Choose an inventory item to upgrade.');
 if((item.upgrades??0)>=5) return result(false,'Maximum upgrade rank reached (5).');
 const cost=craftCost(item);
 if(Object.entries(cost).some(([key,value])=>hero.currencies[key]<value)) return result(false,'Not enough gold, gems or diamonds.');
 for(const [key,value] of Object.entries(cost))hero.currencies[key]-=value;
 for(const key of Object.keys(item.mods))if(item.mods[key]>0)item.mods[key]+=Math.max(1,Math.ceil(item.mods[key]*.12));
 item.upgrades=(item.upgrades??0)+1;
 return result(true,`${item.name} upgraded to +${item.upgrades}.`);
}
export function buyItem(hero,shopId) {
 if(!['potion','weapon','armor','helm','gloves','boots','ring'].includes(shopId))return result(false,'Unknown merchant offer.');
 const cost=shopId==='potion'?35:120*hero.level;
 if(hero.currencies.gold<cost)return result(false,`Requires ${cost} gold.`);
 if(shopId!=='potion' && hero.inventory.length>=inventoryCapacity(hero))return result(false,`Inventory full (${inventoryCapacity(hero)}).`);
 if(shopId==='potion' && hero.potions>=9999)return result(false,'Potion capacity reached.');
 const item=shopId==='potion'?null:createItem(hero.classId,hero.level,'magic',shopId);
 hero.currencies.gold-=cost;
 if(item)hero.inventory.push(item);else hero.potions++;
 return result(true,item?`Purchased ${item.name}.`:'Purchased a healing potion.');
}
