import { recomputeStats } from './progression.js';
const names={warrior:['Tempered Steel','Iron Constitution','Bulwark','Executioner','Blood Oath','Fleet Charge'],mage:['Kindled Mind','Astral Vessel','Stone Skin','Spell Precision','Ember Feast','Windweaver'],archer:['Keen Aim','Wild Heart','Barkskin','Hawk Eye','Predator','Trailrunner']};
const keys=['damage','life','armor','crit','lifeOnHit','speed'];
const values=[4,15,5,2,1,.12];
export const TALENTS=Object.fromEntries(Object.entries(names).map(([cls,list])=>[cls,list.map((name,i)=>({id:`${cls}-${keys[i].toLowerCase()}`,name,stat:keys[i],value:values[i],maxRank:3}))]));
// Additive nodes preserve the IDs and effects of every existing saved allocation.
const specializations={
 warrior:[['wide-sweep','Reaping Arc','sweep','Iron Sweep gains 1m radius per rank.',{radius:1}],['fracture','Deep Fracture','slam','Earthbreaker gains 35% weapon damage per rank.',{multiplier:.35}],['unyielding','Unyielding Voice','shout','Defiant Shout lasts 1 second longer per rank.',{duration:1}]],
 mage:[['wildfire','Wildfire','ember','Ember Burst gains 0.7m radius per rank.',{radius:.7}],['permafrost','Permafrost','frost','Frost Nova gains 30% weapon damage per rank.',{multiplier:.3}],['lasting-ward','Lasting Ward','ward','Arcane Ward lasts 1 second longer per rank.',{duration:1}]],
 archer:[['broadhead','Broadhead Fan','volley','Piercing Volley gains 1m width per rank.',{radius:1}],['efficient-snare','Patient Hunter','snare','Snare Field costs 5 less resolve per rank.',{cost:-5}],['rapid-cycle','Relentless Barrage','barrage','Rapid Barrage cooldown falls by 1 second per rank.',{cooldown:-1}]]
};
for(const [classId,nodes] of Object.entries(specializations)) for(const [id,name,skillId,description,modifiers] of nodes)
 TALENTS[classId].push({id:`${classId}-${id}`,name,skillId,description,modifiers,stat:'damage',value:0,maxRank:3});
export function modifySkill(hero,definition){
 const result={...definition};
 for(const node of TALENTS[hero.classId]??[]){
  if(node.skillId!==definition.id)continue;
  const value=hero.talents?.[node.id];
  const rank=Number.isInteger(value)?Math.max(0,Math.min(node.maxRank,value)):0;
  for(const [key,amount] of Object.entries(node.modifiers??{}))result[key]=(result[key]??0)+amount*rank;
 }
 return result;
}
export function talentCost(hero){return 50*Math.max(1,hero.level);}
export function allocateTalent(hero,id){
 const node=TALENTS[hero.classId]?.find(n=>n.id===id);
 if(!node)return {ok:false,message:'Unknown talent.'};
 if(!(hero.talentPoints>0))return {ok:false,message:'No talent points available.'};
 hero.talents??={};
 if((hero.talents[id]??0)>=node.maxRank)return {ok:false,message:'Talent is at maximum rank.'};
 hero.talents[id]=(hero.talents[id]??0)+1;hero.talentPoints--;recomputeStats(hero);
 return {ok:true,message:`Learned ${node.name}.`};
}
export function refundTalent(hero,id){
 const node=TALENTS[hero.classId]?.find(n=>n.id===id),cost=talentCost(hero);
 if(!node||!(hero.talents?.[id]>0))return {ok:false,message:'No rank to refund.'};
 if(hero.currencies.gold<cost)return {ok:false,message:`Refund requires ${cost} gold.`};
 hero.currencies.gold-=cost;hero.talents[id]--;hero.talentPoints++;recomputeStats(hero);
 return {ok:true,message:`Refunded one rank of ${node.name}.`};
}
