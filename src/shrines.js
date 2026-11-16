export const SHRINE_VARIANTS=Object.freeze({
 ember:{name:'Ember',description:'Double resolve regeneration for 30 seconds.'},
 renewal:{name:'Renewal',description:'Restores 50% of maximum health.'},
 ward:{name:'Ward',description:'Grants 10 seconds of guarded damage reduction.'}
});
export function activateShrine(hero,shrine){
 if(!hero.alive||shrine.used)return {ok:false,message:'This shrine is silent.'};
 const type=Object.hasOwn(SHRINE_VARIANTS,shrine.type)?shrine.type:'ember';shrine.used=true;
 if(type==='ember'){hero.blessingTime=30;return {ok:true,message:'Ember blessing · Double resolve regeneration for 30 seconds.'};}
 if(type==='renewal'){const healed=Math.min(hero.maxHp-hero.hp,hero.maxHp*.5);hero.hp+=healed;return {ok:true,message:`Renewal blessing · Restored ${Math.round(healed)} health.`};}
 hero.guardTime=Math.max(hero.guardTime??0,10);return {ok:true,message:'Ward blessing · Guarded for 10 seconds.'};
}
