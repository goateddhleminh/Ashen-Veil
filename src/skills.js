import { modifySkill } from './talents.js';
const skill = (id, name, cost, cooldown, range, radius, multiplier, effect, color) => ({ id, name, cost, cooldown, range, radius, multiplier, effect, color, telegraph: `${radius}m ${effect}` });
export const SKILLS = {
 warrior: [skill('sweep','Iron Sweep',20,4,0,4,1.8,'burst',0xf0c080),skill('slam','Earthbreaker',35,8,7,3,2.8,'stun',0xe8a35f),skill('shout','Defiant Shout',25,12,0,5,.7,'guard',0xffdc90),skill('cataclysm','Cataclysm',70,24,0,7,5,'stun',0xffcc66)],
 mage: [skill('ember','Ember Burst',25,4,10,3,2.2,'burst',0xff773d),skill('frost','Frost Nova',30,7,0,5,1.2,'slow',0x84dcff),skill('ward','Arcane Ward',30,12,0,3,.5,'ward',0xbca0ff),skill('starfall','Starfall',75,26,12,6,5.5,'slow',0xc3a0ff)],
 archer: [skill('volley','Piercing Volley',20,4,11,2.5,2.1,'burst',0xa0e9a7),skill('snare','Snare Field',30,8,9,4,1,'slow',0x68cc8b),skill('barrage','Rapid Barrage',40,10,10,4,3,'burst',0xe1ef93),skill('arrowstorm','Arrowstorm',65,22,12,6,4.8,'burst',0xd8ff91)]
};
export function createSkillState() { return { resource:100,maxResource:100,skillCooldowns:{},dodgeCooldown:0,dodgeTime:0,invulnerable:0,guardTime:0,wardTime:0,blessingTime:0,dodgeDirection:{x:0,z:0} }; }
export function canCast(hero,id) {
 const definition=SKILLS[hero.classId]?.find(s=>s.id===id);
 if (!definition) return {ok:false,message:'Unknown skill for this calling.'};
 if (!hero.alive) return {ok:false,message:'You have fallen.'};
 const modified=modifySkill(hero,definition);
 if ((hero.skillCooldowns[id]??0)>0) return {ok:false,message:'Skill is cooling down.'};
 if (hero.resource<modified.cost) return {ok:false,message:'Not enough resolve.'};
 return {ok:true,definition:modified};
}
export function castSkill(hero,id,target,combat) {
 const check=canCast(hero,id); if (!check.ok) return check;
 const s=check.definition, origin=hero.position;
 let dx=(target?.x??origin.x)-origin.x,dz=(target?.z??origin.z)-origin.z;
 const distance=Math.hypot(dx,dz), scale=distance>0?Math.min(distance,s.range)/distance:0;
 const point={x:origin.x+dx*scale,y:0,z:origin.z+dz*scale};
 hero.resource-=s.cost; hero.skillCooldowns[id]=s.cooldown*Math.max(.5,1-(hero.cooldownReduction??0)/100);
 if(s.effect==='guard') hero.guardTime=5+(s.duration??0);
 if(s.effect==='ward') hero.wardTime=4+(s.duration??0);
 combat.applySkill(hero,s,point);
 return {ok:true,message:s.name};
}
export function updateSkills(hero,dt) {
 dt=Math.max(0,dt);
 hero.resource=Math.min(hero.maxResource,hero.resource+(dt+Math.min(dt,hero.blessingTime??0))*12*(hero.legendaryEffects?.includes('flow')?1.4:1));
 for(const id of Object.keys(hero.skillCooldowns)) hero.skillCooldowns[id]=Math.max(0,hero.skillCooldowns[id]-dt);
 hero.blessingTime=Math.max(0,(hero.blessingTime??0)-dt);
 for(const key of ['dodgeCooldown','dodgeTime','invulnerable','guardTime','wardTime']) hero[key]=Math.max(0,hero[key]-dt);
}
export function tryDodge(hero,direction) {
 if(!hero.alive || hero.dodgeCooldown>0) return {ok:false,message:'Dodge is not ready.'};
 const length=Math.hypot(direction.x,direction.z);
 hero.dodgeDirection=length>.01?{x:direction.x/length,z:direction.z/length}:{x:0,z:1};
 hero.dodgeCooldown=3;hero.dodgeTime=.22;hero.invulnerable=.25;
 return {ok:true,message:'Dodge'};
}
