import { createItem } from './progression.js';
const result=(ok,message)=>({ok,message});
const find=(hero,id)=>hero.inventory.findIndex(item=>item.id===id);
export const saleValue=item=>Math.max(1,item.level*({common:8,magic:15,rare:30,legendary:65}[item.rarity]??8));
export function sellItem(hero,id) {
 const i=find(hero,id),item=hero.inventory[i];
 if(!item || item.favorite) return result(false,'Item missing or protected by Favorite.');
 const value=saleValue(item);hero.inventory.splice(i,1);hero.currencies.gold+=value;
 return result(true,`Sold ${item.name} for ${value} gold.`);
}
export function salvageItem(hero,id) {
 const i=find(hero,id),item=hero.inventory[i];
 if(!item || item.favorite) return result(false,'Item missing or protected by Favorite.');
 const gems={common:1,magic:2,rare:4,legendary:8}[item.rarity];
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
 if(i<0 || hero.inventory.length>=24) return result(false,'Item missing or inventory full (24).');
 hero.inventory.push(hero.stash.splice(i,1)[0]);return result(true,'Item retrieved.');
}
export function craftCost(item) {const rank=item.upgrades??0;return {gold:100*(rank+1)*item.level,gems:3*(rank+1),diamonds:rank>=2?1:0};}
export function craftItem(hero,recipe,id) {
 const item=hero.inventory[find(hero,id)];
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
 if(shopId!=='potion' && hero.inventory.length>=24)return result(false,'Inventory full (24).');
 if(shopId==='potion' && hero.potions>=9999)return result(false,'Potion capacity reached.');
 const item=shopId==='potion'?null:createItem(hero.classId,hero.level,'magic',shopId);
 hero.currencies.gold-=cost;
 if(item)hero.inventory.push(item);else hero.potions++;
 return result(true,item?`Purchased ${item.name}.`:'Purchased a healing potion.');
}
