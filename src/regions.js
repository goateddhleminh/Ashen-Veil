export const DIFFICULTIES={
 normal:{id:'normal',name:'Normal',minLevel:1,maxLevel:12,health:1,damage:1,description:'The intended campaign path.'},
 nightmare:{id:'nightmare',name:'Nightmare',minLevel:13,maxLevel:22,health:1.35,damage:1.2,description:'Hardier foes and punishing strikes.'},
 hell:{id:'hell',name:'Hell',minLevel:23,maxLevel:30,health:1.75,damage:1.4,description:'The veil gives no quarter.'}
};
export function isDifficulty(value){return typeof value==='string'&&Object.hasOwn(DIFFICULTIES,value);}
export function difficultyMultiplier(value){const difficulty=isDifficulty(value)?DIFFICULTIES[value]:DIFFICULTIES.normal;return {health:difficulty.health,damage:difficulty.damage};}

export const REGIONS={
 refuge:{name:'Ember Refuge',level:1,color:0x333d38,fog:0x202a27,description:'A sanctuary for the last living.',boss:null},
 graveyard:{name:'The Forgotten Graveyard',level:1,color:0x303b32,fog:0x1b2523,description:'Break the bell that wakes the dead.',boss:'bellwarden'},
 marsh:{name:'The Cinder Marsh',level:6,color:0x463a29,fog:0x35281d,description:'Follow the embers beneath the mire.',boss:'mirequeen'},
 citadel:{name:'The Hollow Citadel',level:12,color:0x333043,fog:0x222034,description:'Extinguish the heart of the veil.',boss:'hollowking'}
};
export const REGION_STAGES={
  1:{name:'Outer Grounds',objective:'Defeat 8 enemies and activate the shrine.',portal:'North portal'},
  2:{name:'Inner Sanctum',objective:'Defeat 3 enemies including 2 champions, then open the reliquary.',portal:'North portal'},
  3:{name:'Guardian Arena',objective:'Defeat the regional guardian.',portal:null}
};
export const BOSSES={
 bellwarden:{name:'Mordren, Bellwarden',region:'graveyard',hp:900,damage:22,attack:'shockwave',color:0xc3a169},
 mirequeen:{name:'Vesra, Cinder Matron',region:'marsh',hp:2200,damage:34,attack:'eruption',color:0xe49346},
 hollowking:{name:'The Hollow King',region:'citadel',hp:4800,damage:48,attack:'nova',color:0x9b7ed3}
};
export function createRegionState(){return {region:'refuge',unlocked:['refuge','graveyard'],questProgress:{},claimedRewards:[],campaignComplete:false,highestTier:0,kills:0,difficulty:'normal'};}
export function setDifficulty(state,value){
  if(!isDifficulty(value))return {ok:false,message:'Unknown difficulty.'};
  state.difficulty=value;return {ok:true,message:`Difficulty: ${DIFFICULTIES[value].name}`};
}
export function enterRegion(state,id){
 if(!Object.hasOwn(REGIONS,id)||!state.unlocked.includes(id))return {ok:false,message:'Complete the previous region to unlock this destination.'};
 state.region=id;return {ok:true,message:REGIONS[id].name};
}
export function encounterLevel(regionId,heroLevel,difficulty='normal'){
  const base=Math.max(REGIONS[regionId]?.level??1,heroLevel);
  const tier=isDifficulty(difficulty)?DIFFICULTIES[difficulty]:DIFFICULTIES.normal;
  return Math.min(tier.maxLevel,Math.max(base,tier.minLevel));
}
export function bossPhase(hp,maxHp){return hp/maxHp<=.25?3:hp/maxHp<=.5?2:1;}
export function spawnRegionEncounter(id,seed){
 if(!REGIONS[id]||id==='refuge')return [];
 let value=seed>>>0;const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
 return Array.from({length:12},(_,index)=>{const angle=random()*Math.PI*2,radius=9+random()*12;return {kind:['melee','ranged','charger','caster'][index%4],x:Math.cos(angle)*radius,z:Math.sin(angle)*radius,rank:random()<.2?1:0,level:REGIONS[id].level};});
}
