export function activateShrine(hero,shrine){
 if(!hero.alive||shrine.used)return {ok:false,message:'This shrine is silent.'};
 shrine.used=true;hero.blessingTime=30;
 return {ok:true,message:'Ember blessing · Double resolve regeneration for 30 seconds.'};
}
