import { recomputeStats } from './progression.js';
const names={warrior:['Tempered Steel','Iron Constitution','Bulwark','Executioner','Blood Oath','Fleet Charge'],mage:['Kindled Mind','Astral Vessel','Stone Skin','Spell Precision','Ember Feast','Windweaver'],archer:['Keen Aim','Wild Heart','Barkskin','Hawk Eye','Predator','Trailrunner']};
const keys=['damage','life','armor','crit','lifeOnHit','speed'];
const values=[4,15,5,2,1,.12];
export const TALENTS=Object.fromEntries(Object.entries(names).map(([cls,list])=>[cls,list.map((name,i)=>({id:`${cls}-${keys[i].toLowerCase()}`,name,stat:keys[i],value:values[i],maxRank:3}))]));
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
