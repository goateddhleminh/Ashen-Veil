import { createSkillState } from './skills.js';
export function applyDeathPenalty(hero){
 if(hero.alive||hero.deathPenaltyApplied)return 0;
 const loss=Math.min(500,Math.floor(hero.currencies.gold*.1));
 hero.currencies.gold-=loss;hero.deathPenaltyApplied=true;return loss;
}
export function recoverHero(hero){
 hero.alive=true;hero.hp=hero.maxHp;hero.cooldown=0;hero.deathPenaltyApplied=false;
 Object.assign(hero,createSkillState());
}
