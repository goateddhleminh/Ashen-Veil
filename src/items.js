export const AFFIXES={strength:'Mighty',intelligence:'Sage',dexterity:'Deft',vitality:'Stalwart',crit:'Keen',damage:'Savage',armor:'Warded',life:'Vigorous'};
export const LEGENDARIES={
 blood:'Bloodbound: restore 3 additional life on each basic hit.',
 echo:'Echoing: active skills deal 25% more damage.',
 frost:'Wintertouch: basic hits slow enemies for 2 seconds.',
 bastion:'Bastion: incoming damage reduced by 15%.',
 flow:'Wellspring: resolve regenerates 40% faster.',
 haste:'Stormstep: basic attacks are 15% faster.'
};
export function filterItems(items,filter='all',sort='rarity') {
 const rank={common:0,magic:1,rare:2,legendary:3};
 return items.filter(item=>filter==='all'||(filter==='favorite'?item.favorite:item.slot===filter))
 .sort((a,b)=>sort==='level'?b.level-a.level:sort==='name'?a.name.localeCompare(b.name):(rank[b.rarity]-rank[a.rarity]||b.level-a.level));
}
