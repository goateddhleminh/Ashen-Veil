// Engine-independent Events. Every transition returns a new, serializable world.events.
import { createItem } from './progression.js';
export const EVENTS_VERSION=2;
export const EVENT_IDS=Object.freeze({FIRST_STEPS:'first-steps',ROOKIE:'rookie-trial',ZONE:'zone-conquest',TOWER:'infernal-tower',BLOOD_MOON:'blood-moon'});
const DAY=86400000, clone=x=>JSON.parse(JSON.stringify(x)), obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x), count=(x,max=1e9)=>Number.isFinite(x)&&x>=0?Math.min(max,Math.floor(x)):0;
const strings=x=>Array.isArray(x)?[...new Set(x.filter(y=>typeof y==='string'&&y.length<100))].slice(0,180):[];
const mission=(id,goal,target,reward)=>({id,goal,target,reward});
const zones=['graveyard','marsh','citadel'];
export const EVENT_DEFINITIONS={
 'first-steps':{id:'first-steps',title:'First Steps',kind:'missions',missions:[
 mission('create-character','Create your character',1,{gold:200}),mission('kill-20','Kill 20 enemies',20,{potions:3}),mission('cast-skills','Cast each of your four skills once',4,{skillPoints:1}),mission('pickup-5-gear','Pick up 5 gear items',5,{item:{rarity:'magic',slot:'weapon'}}),mission('equip-weapon-armor','Equip a weapon and armor',2,{gold:500}),mission('sell-3','Sell 3 items',3,{manaPotions:3}),mission('chest-1','Open a chest',1,{dust:10}),mission('level-5','Reach level 5',5,{item:{rarity:'rare',slot:'armor'}}),mission('return-to-town','Travel Refuge → Graveyard → Refuge',1,{portalScrolls:3})],final:{id:'first-steps-complete',goal:'Claim all nine missions',target:9,reward:{title:'rookie',choice:['rare-weapon-warrior','rare-weapon-mage','rare-weapon-archer']}}},
 'rookie-trial':{id:'rookie-trial',title:'Rookie 7-Day Trial',kind:'daily',days:[
 {day:1,goal:'Clear a graveyard room',target:1,reward:{gold:1000}},{day:2,goal:'Find 3 Magic or better items',target:3,reward:{potions:5}},{day:3,goal:'Reach level 10',target:10,reward:{dust:20}},{day:4,goal:'Kill 5 elites',target:5,reward:{resetTokens:1}},{day:5,goal:'Open 3 chests or break 10 barrels',target:1,reward:{choice:['ruby','sapphire','emerald']}},{day:6,goal:'Defeat your first guardian',target:1,reward:{item:{rarity:'rare',slot:'armor'}}},{day:7,goal:'Visit on day 7 and complete any mission',target:1,reward:{item:{rarity:'legendary',slot:'armor'},cosmetic:'veteran-cape'}}]},
 'zone-conquest':{id:'zone-conquest',title:'Zone Conquest',kind:'medals',zones,requirements:{enemyRate:.8,elitePacks:3,hiddenChest:1,boss:1},rewards:{graveyard:{stage:{gold:1500,potions:5,item:{rarity:'magic'}},boss:{item:{rarity:'rare'},cosmetic:'graveyard-crown'}},marsh:{stage:{gold:3000,dust:10,gem:'ruby'},boss:{item:{rarity:'rare'},shards:5}},citadel:{stage:{gold:6000,dust:15,gems:2},boss:{item:{rarity:'legendary'},shards:15}}},medals:{silver:{reward:{title:'conqueror-silver'}},gold:{reward:{cosmetic:'conqueror-cape'}},allGold:{reward:{setPieces:5}}}},
 'infernal-tower':{id:'infernal-tower',title:'Infernal Tower',kind:'tower',checkpointEvery:5,potionLimit:5,rewards:{5:{gold:2000,dust:10},10:{item:{rarity:'rare'},shards:5},15:{gem:'ruby',dust:15},20:{item:{rarity:'rare',extraAffix:true}},30:{item:{rarity:'legendary'}},50:{weaponSkin:'infernal',title:'tower-master'}}},
 'blood-moon':{id:'blood-moon',title:'Blood Moon',kind:'timed',chancePlaySeconds:1800,durationSeconds:300,chance:.35,modifiers:{enemyHp:1.5,enemyDamage:1.5,gold:2,rareRate:1.5},goals:{kill:50,elite:5,fragments:100,reaper:1},rewards:{kill:{item:{rarity:'rare'}},elite:{shards:10},reaper:{item:{rarity:'legendary'},cosmetic:'blood-moon-cape'}}}
};
const bucketKey={'first-steps':'firstSteps','rookie-trial':'rookie','zone-conquest':'zone','infernal-tower':'tower','blood-moon':'bloodMoon'};
export function createEventsState(now=Date.now()){
 return{version:EVENTS_VERSION,firstSteps:{progress:{'create-character':1},skillCasts:{},equipped:[],travel:0,claimed:[]},rookie:{createdAt:now,lastSeenAt:now,progress:{},magic:0,chests:0,barrels:0,day7Login:false,claimed:[]},zone:{progress:{},claimed:[]},tower:{run:null,weekly:{},claimed:[],pending:{},checkpoint:0},bloodMoon:{active:false,startedAt:null,elapsed:0,playSeconds:0,cycle:0,progress:{},claimed:[],reaperSpawned:false}};
}
function numericMap(raw,allowed,max=1e9){const out={};if(obj(raw))for(const k of allowed)if(Number.isFinite(raw[k]))out[k]=count(raw[k],max);return out;}
function normalizeZone(raw){return{enemies:count(raw?.enemies),kills:count(raw?.kills),packs:strings(raw?.packs),defeatedPacks:strings(raw?.defeatedPacks),hiddenChest:raw?.hiddenChest===true,boss:raw?.boss===true};}
// Timestamps are milliseconds. Saves validate them specifically rather than applying currency bounds.
export function migrateEventsState(raw,now=Date.now()){
 const s=createEventsState(now);if(!obj(raw))return s;
 const f=obj(raw.firstSteps)?raw.firstSteps:{};s.firstSteps.progress={...s.firstSteps.progress,...numericMap(f.progress,EVENT_DEFINITIONS['first-steps'].missions.map(m=>m.id),100)};s.firstSteps.skillCasts=numericMap(f.skillCasts,Object.keys(obj(f.skillCasts)?f.skillCasts:{}).filter(k=>k.length<60).slice(0,4),100);s.firstSteps.equipped=strings(f.equipped).filter(k=>['weapon','armor'].includes(k));s.firstSteps.travel=count(f.travel,2);s.firstSteps.claimed=strings(f.claimed);
 const r=obj(raw.rookie)?raw.rookie:{};s.rookie.createdAt=Number.isFinite(r.createdAt)&&r.createdAt>=0?r.createdAt:now;s.rookie.lastSeenAt=Math.max(s.rookie.createdAt,Number.isFinite(r.lastSeenAt)?r.lastSeenAt:now);s.rookie.progress=numericMap(r.progress,['1','2','3','4','5','6','7'],100);for(const k of ['magic','chests','barrels'])s.rookie[k]=count(r[k],100);s.rookie.day7Login=r.day7Login===true;s.rookie.claimed=strings(r.claimed);
 const z=obj(raw.zone)?raw.zone:{};s.zone.claimed=strings(z.claimed);for(const region of zones)for(const difficulty of ['normal','nightmare','hell']){const key=`${region}:${difficulty}`;if(obj(z.progress?.[key]))s.zone.progress[key]=normalizeZone(z.progress[key]);}
 const t=obj(raw.tower)?raw.tower:{};s.tower.claimed=strings(t.claimed);s.tower.pending=numericMap(t.pending,['5','10','15','20','30','50'],10000);s.tower.checkpoint=count(t.checkpoint,100000);if(obj(t.run))s.tower.run={floor:count(t.run.floor,100000),checkpoint:count(t.run.checkpoint,100000),startedAt:Number.isFinite(t.run.startedAt)?t.run.startedAt:now,elapsed:Math.max(0,Number(t.run.elapsed)||0),potionsUsed:count(t.run.potionsUsed,5),potionLimit:5,claimed:strings(t.run.claimed)};if(obj(t.weekly))for(const key of Object.keys(t.weekly).filter(k=>/^\d{4}-W\d{2}$/.test(k)).sort().slice(-12)){const v=t.weekly[key];s.tower.weekly[key]={floor:count(obj(v)?v.floor:v,100000),time:Math.max(0,Number(v?.time)||0)};}
 const b=obj(raw.bloodMoon)?raw.bloodMoon:{};s.bloodMoon.active=b.active===true;s.bloodMoon.startedAt=Number.isFinite(b.startedAt)?b.startedAt:null;for(const k of ['elapsed','playSeconds'])s.bloodMoon[k]=Math.max(0,Math.min(1e9,Number(b[k])||0));s.bloodMoon.cycle=count(b.cycle);s.bloodMoon.progress=numericMap(b.progress,['kill','elite','fragments','reaper']);s.bloodMoon.claimed=strings(b.claimed);s.bloodMoon.reaperSpawned=b.reaperSpawned===true;return s;
}
export const normalizeEventsState=migrateEventsState;
export function validateEventsState(raw){if(raw===undefined)return true;if(!obj(raw)||!Number.isInteger(raw.version)||raw.version<1||raw.version>EVENTS_VERSION)return false;try{return JSON.stringify(raw).length<60000&&['firstSteps','rookie','zone','tower','bloodMoon'].every(k=>obj(raw[k]));}catch{return false;}}
export function rookieDay(state,now=Date.now()){return Math.max(1,Math.min(7,Math.floor((Math.max(now,state.rookie.lastSeenAt)-state.rookie.createdAt)/DAY)+1));}
const difficultyOf=x=>['normal','nightmare','hell'].includes(x)?x:'normal';
export function zoneMedal(state,region){for(const [difficulty,medal] of [['hell','gold'],['nightmare','silver'],['normal','bronze']]){const p=state.zone.progress[`${region}:${difficulty}`];if(p&&p.enemies>0&&p.kills>=Math.ceil(p.enemies*.8)&&p.defeatedPacks.length>=3&&p.hiddenChest&&p.boss)return medal;}return null;}
function completeFirst(s,id){const m=EVENT_DEFINITIONS['first-steps'].missions.find(m=>m.id===id);return !!m&&(s.firstSteps.progress[id]??0)>=m.target;}
function completedMissionCount(s){return EVENT_DEFINITIONS['first-steps'].missions.filter(m=>completeFirst(s,m.id)).length+Object.values(s.rookie.progress).filter(v=>v>0).length;}
export function recordEvent(state,event={},context={}){
 const now=context.now??Date.now(),s=migrateEventsState(state,now),a=Math.max(1,count(event.amount||1,100)),p=s.firstSteps.progress,r=s.rookie,b=s.bloodMoon;
 const before=completedMissionCount(s);r.lastSeenAt=Math.max(r.lastSeenAt,now);if(rookieDay(s,now)>=7)r.day7Login=true;
 const region=event.region??context.region,difficulty=difficultyOf(event.difficulty??context.difficulty),key=`${region}:${difficulty}`;
 const campaign=zones.includes(region)&&!event.tower&&!event.eventBoss&&!context.towerActive;
 if(campaign&&!s.zone.progress[key])s.zone.progress[key]=normalizeZone({});const z=campaign?s.zone.progress[key]:null;
 switch(event.type){
 case'create-character':case'login':p['create-character']=1;break;
 case'kill':p['kill-20']=Math.min(20,(p['kill-20']??0)+a);if(event.elite)r.progress[4]=Math.min(5,(r.progress[4]??0)+a);if(event.boss&&!event.eventBoss&&region==='graveyard'&&!event.tower&&!context.towerActive)r.progress[6]=1;if(z){z.kills=Math.min(z.enemies||1e9,z.kills+a);if(event.boss)z.boss=true;if(event.packId&&event.packCleared&&!z.defeatedPacks.includes(String(event.packId)))z.defeatedPacks.push(String(event.packId));}if(b.active&&!context.towerActive){b.progress.kill=(b.progress.kill??0)+a;b.progress.fragments=Math.min(100,(b.progress.fragments??0)+a);if(event.elite)b.progress.elite=(b.progress.elite??0)+a;if(event.eventBoss==='reaper'||event.reaper)b.progress.reaper=1;}break;
 case'cast-skill':case'skill':if(event.skillId&&Object.keys(s.firstSteps.skillCasts).length<4||Object.hasOwn(s.firstSteps.skillCasts,event.skillId)){s.firstSteps.skillCasts[event.skillId]=1;p['cast-skills']=Object.keys(s.firstSteps.skillCasts).length;}break;
 case'pickup':if(event.item||event.rarity||event.gear){p['pickup-5-gear']=Math.min(5,(p['pickup-5-gear']??0)+a);if(['magic','rare','legendary'].includes(event.rarity??event.item?.rarity)){r.magic=Math.min(3,r.magic+a);r.progress[2]=r.magic;}}break;
 case'equip':if(['weapon','armor'].includes(event.slot)&&!s.firstSteps.equipped.includes(event.slot))s.firstSteps.equipped.push(event.slot);p['equip-weapon-armor']=s.firstSteps.equipped.length;break;
 case'sell':p['sell-3']=Math.min(3,(p['sell-3']??0)+a);break;
 case'chest':p['chest-1']=1;r.chests=Math.min(3,r.chests+a);if(z&&event.hidden)z.hiddenChest=true;break;
 case'barrel':r.barrels=Math.min(10,r.barrels+a);break;
 case'level':p['level-5']=Math.max(p['level-5']??0,count(event.level??event.amount));r.progress[3]=Math.max(r.progress[3]??0,count(event.level??event.amount));break;
 case'travel':if(['refuge','town'].includes(event.from)&&event.to==='graveyard')s.firstSteps.travel=1;if(s.firstSteps.travel===1&&event.from==='graveyard'&&['refuge','town'].includes(event.to)){s.firstSteps.travel=2;p['return-to-town']=1;}break;
 case'stage-clear':if(region==='graveyard')r.progress[1]=1;break;
 case'encounter':if(z){z.enemies=Math.max(z.enemies,count(event.enemyCount));for(const id of strings(event.elitePackIds))if(!z.packs.includes(id))z.packs.push(id);}break;
 case'pack-clear':if(z&&event.packId&&!z.defeatedPacks.includes(String(event.packId)))z.defeatedPacks.push(String(event.packId));break;
 case'blood-moon':if(b.active&&Object.hasOwn(EVENT_DEFINITIONS['blood-moon'].goals,event.goal))b.progress[event.goal]=(b.progress[event.goal]??0)+a;break;
 case'reaper-spawn':if(b.active&&(b.progress.fragments??0)>=100&&!b.reaperSpawned){b.reaperSpawned=true;}break;
 }
 if(r.chests>=3||r.barrels>=10)r.progress[5]=1;
 if(r.day7Login&&(completedMissionCount(s)>before||event.type==='mission-complete'||event.type==='stage-clear'))r.progress[7]=1;
 return s;
}
export function tickEvents(state,dt,context={}){
 const s=migrateEventsState(state,context.now),seconds=Math.max(0,Math.min(3600,Number(dt)||0)),b=s.bloodMoon;
 if(s.tower.run&&context.towerActive)s.tower.run.elapsed+=seconds;
 if(b.active){b.elapsed+=seconds;if(b.elapsed>=300){b.active=false;b.elapsed=300;b.progress.fragments=0;b.reaperSpawned=false;}}
 else{b.playSeconds+=seconds;if(b.playSeconds>=1800){b.playSeconds%=1800;if(!context.towerActive&&(context.random??Math.random)()<.35)return startBloodMoon(s,context.now??Date.now());}}
 return s;
}
export function startBloodMoon(state,now=Date.now()){const s=migrateEventsState(state,now);if(s.bloodMoon.active)return s;s.bloodMoon={active:true,startedAt:now,elapsed:0,playSeconds:0,cycle:s.bloodMoon.cycle+1,progress:{},claimed:[],reaperSpawned:false};return s;}
export function startTower(state,now=Date.now()){const s=migrateEventsState(state,now);if(s.tower.run)return{ok:false,state:s,message:'Tower run already active.'};s.tower.run={floor:0,checkpoint:0,startedAt:now,elapsed:0,potionsUsed:0,potionLimit:5,claimed:[]};return{ok:true,state:s,run:s.tower.run};}
export function advanceTower(state,floor,context={}){const s=migrateEventsState(state,context.now),r=s.tower.run;if(!r||!Number.isInteger(floor)||floor!==r.floor+1||floor>100000)return{ok:false,state:s,message:'Clear each floor in sequence.'};r.floor=floor;if(floor%5===0){r.checkpoint=floor;s.tower.checkpoint=Math.max(s.tower.checkpoint,floor);}if(EVENT_DEFINITIONS['infernal-tower'].rewards[floor])s.tower.pending[floor]=(s.tower.pending[floor]??0)+1;return{ok:true,state:s,run:r};}
export function useTowerPotion(state){const s=migrateEventsState(state),r=s.tower.run;if(!r||r.potionsUsed>=r.potionLimit)return{ok:false,state:s,message:'Tower potion limit reached (5 per run).'};r.potionsUsed++;return{ok:true,state:s};}
export function weekKey(now=Date.now()){const d=new Date(now);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const y=d.getUTCFullYear();return`${y}-W${String(Math.ceil((((d-Date.UTC(y,0,1))/DAY)+1)/7)).padStart(2,'0')}`;}
export function endTower(state,context={}){const s=migrateEventsState(state,context.now),r=s.tower.run;if(!r)return{ok:false,state:s,message:'No Tower run.'};const key=weekKey(context.now),best=s.tower.weekly[key];if(!best||r.floor>best.floor||r.floor===best.floor&&r.elapsed<best.time)s.tower.weekly[key]={floor:r.floor,time:r.elapsed};s.tower.run=null;return{ok:true,state:s,floor:r.floor,weeklyBest:s.tower.weekly[key]};}
export const startTowerRun=startTower,towerCheckpoint=advanceTower,finishTowerRun=endTower;
function rewardDescriptor(s,eventId,id,now){const d=EVENT_DEFINITIONS[eventId];if(!d)return null;
 if(eventId==='first-steps'){if(id===d.final.id)return{...d.final,progress:s.firstSteps.claimed.filter(x=>d.missions.some(m=>m.id===x)).length};const m=d.missions.find(m=>m.id===id);return m?{...m,progress:s.firstSteps.progress[id]??0}:null;}
 if(eventId==='rookie-trial'){const m=d.days.find(m=>String(m.day)===id);return m?{...m,id,progress:s.rookie.progress[id]??0,locked:m.day>rookieDay(s,now)}:null;}
 if(eventId==='infernal-tower'){const floor=Number(id);return d.rewards[floor]?{id,goal:`Floor ${floor} checkpoint`,target:floor,progress:(s.tower.pending[floor]??0)>0?floor:0,locked:false,reward:d.rewards[floor]}:null;}
 if(eventId==='blood-moon'){return d.rewards[id]?{id,goal:({kill:'Kill 50 enemies',elite:'Kill 5 elites',reaper:'Defeat the Reaper'})[id],target:d.goals[id],progress:s.bloodMoon.progress[id]??0,reward:d.rewards[id]}:null;}
 if(eventId==='zone-conquest'){
  if(id==='medal-all-gold')return{id,goal:'Earn Gold in all three zones',target:3,progress:zones.filter(z=>zoneMedal(s,z)==='gold').length,reward:d.medals.allGold.reward};
  const match=/^(graveyard|marsh|citadel):(normal|nightmare|hell):(stage|boss|medal)$/.exec(id);if(!match)return null;const[,region,difficulty,kind]=match,p=s.zone.progress[`${region}:${difficulty}`]??normalizeZone({}),mult={normal:1,nightmare:2,hell:3}[difficulty];
  const complete=p.enemies>0&&p.kills>=Math.ceil(p.enemies*.8)&&p.defeatedPacks.length>=3&&p.hiddenChest;
  let reward=clone(d.rewards[region][kind==='stage'?'stage':'boss']);for(const k of ['gold','dust','shards','potions','gems'])if(reward[k])reward[k]*=mult;if(reward.item)reward.itemCount=mult;if(reward.gem)reward.gemCount=mult;
  if(kind==='medal')reward=difficulty==='nightmare'?{title:'conqueror-silver'}:difficulty==='hell'?{cosmetic:`${region}-gold-cape`}:{gold:100};
  return{id,goal:`${{graveyard:'Forgotten Graveyard',marsh:'Ashen Marsh',citadel:'Hollow Citadel'}[region]} · ${{normal:'Bronze',nightmare:'Silver',hell:'Gold'}[difficulty]} · ${{stage:'Clear the zone',boss:'Defeat the guardian',medal:'Earn medal'}[kind]}`,target:1,progress:kind==='stage'?Number(complete):kind==='boss'?Number(p.boss):Number(complete&&p.boss),reward};
 }
 return null;
}
export function getClaimStatus(state,eventId,rewardId,context={}){const now=typeof context==='number'?context:context.now??Date.now(),s=migrateEventsState(state,now),id=String(rewardId),d=rewardDescriptor(s,eventId,id,now),bucket=s[bucketKey[eventId]],claims=eventId==='infernal-tower'?[]:bucket?.claimed??[];const claimed=eventId==='infernal-tower'?(s.tower.pending[id]??0)===0&&s.tower.claimed.includes(id):claims.includes(id);return{eligible:!!d&&!d.locked&&!claimed&&d.progress>=d.target,claimed,locked:!!d?.locked,progress:d?.progress??0,target:d?.target??1,goal:d?.goal??id,reward:d?.reward??null};}
export function claimEventReward(state,eventId,rewardId,context={}){const s=migrateEventsState(state,context.now),id=String(rewardId),status=getClaimStatus(s,eventId,id,context);if(!status.eligible)return{ok:false,state:s,message:'Complete the goal first, or reward already claimed.'};let reward=clone(status.reward);if(reward.choice){if(!reward.choice.includes(context.choice))return{ok:false,state:s,message:'Choose a reward first.',choices:reward.choice};const choice=context.choice;delete reward.choice;if(choice.startsWith('rare-weapon-'))reward.item={rarity:'rare',slot:'weapon',classId:choice.slice(12)};else reward.gem=choice;}
 if(eventId==='infernal-tower'){s.tower.pending[id]--;if(!s.tower.claimed.includes(id))s.tower.claimed.push(id);}else s[bucketKey[eventId]].claimed.push(id);
 if(eventId==='blood-moon'){const mult={normal:1,nightmare:2,hell:3}[context.difficulty]??1;for(const k of ['gold','gems','shards','dust'])if(reward[k])reward[k]*=mult;if(reward.item)reward.item.level=Math.min(100,(context.level??1)+mult-1);}
 if(rookieDay(s,context.now??Date.now())>=7&&s.rookie.day7Login&&eventId!=='rookie-trial')s.rookie.progress[7]=1;
 return{ok:true,state:s,reward,message:'Event reward claimed.'};}
export function applyEventReward(hero,payload,itemFactory=createItem){
 if(!hero||!obj(payload))return{ok:false,message:'Hero unavailable.'};if(payload.choice)return{ok:false,message:'Choose a reward first.'};
 const itemCount=payload.item?Math.max(1,Math.min(3,count(payload.itemCount)||1)):0;
 const needed=(payload.setPieces===5?5:0)+itemCount,capacity=hero.inventoryCapacity??24;
 if(needed&&(!Array.isArray(hero.inventory)||hero.inventory.length+needed>capacity))return{ok:false,message:'Inventory full; reward remains unclaimed.'};
 // Construct all gear before touching wallet/claims, so factory failures cannot partially grant.
 const items=[];try{if(payload.setPieces===5)for(const slot of ['armor','helm','gloves','boots','ring']){const piece=itemFactory(hero.classId,hero.level||1,'legendary',slot);piece.name=`Conqueror ${piece.name}`;items.push(piece);}for(let i=0;i<itemCount;i++){const x=itemFactory(payload.item.classId??hero.classId,payload.item.level??hero.level??1,payload.item.rarity,payload.item.slot);if(payload.item.extraAffix){const affix=['strength','intelligence','dexterity','vitality','crit','attackSpeed','cooldownReduction'].find(k=>!x.mods[k]);if(affix)x.mods[affix]=Math.max(2,Math.floor((hero.level||1)/2));}items.push(x);}}catch{return{ok:false,message:'Could not create reward gear.'};}
 hero.currencies??={gold:0,gems:0,diamonds:0};for(const k of ['gold','gems','diamonds'])hero.currencies[k]=Math.min(1e9,count(hero.currencies[k])+count(payload[k]));
 for(const k of ['potions','manaPotions','portalScrolls','resetTokens','dust','shards','reaperFragments'])hero[k]=Math.min(k==='potions'?9999:1e9,count(hero[k])+count(payload[k]));
 // Existing talent points are the game's spendable skill points.
 if(payload.skillPoints)hero.talentPoints=Math.min(10000,count(hero.talentPoints)+count(payload.skillPoints));
 if(payload.gem){hero.socketGems??={};hero.socketGems[payload.gem]=Math.min(1e9,count(hero.socketGems[payload.gem])+Math.max(1,Math.min(3,count(payload.gemCount)||1)));}
 hero.eventRewards??=[];for(const type of ['title','cosmetic','weaponSkin'])if(payload[type]&&!hero.eventRewards.some(x=>x.type===type&&x.id===payload[type]))hero.eventRewards.push({type,id:payload[type]});if(items.length)hero.inventory.push(...items);return{ok:true,reward:payload};
}
export function claimAndApplyEventReward(state,hero,eventId,rewardId,context={}){const result=claimEventReward(state,eventId,rewardId,context);if(!result.ok)return result;const applied=applyEventReward(hero,result.reward,context.itemFactory);return applied.ok?result:{...applied,state};}
export function selectEventCosmetic(hero,type,id){if(!['title','cosmetic','weaponSkin'].includes(type)||!hero?.eventRewards?.some(x=>x.type===type&&x.id===id))return{ok:false,message:'Cosmetic is not unlocked.'};hero.eventAppearance??={};hero.eventAppearance[type]=id;return{ok:true,appearance:hero.eventAppearance};}
export function listEventCosmetics(hero){const out={title:[],cosmetic:[],weaponSkin:[]};for(const x of hero?.eventRewards||[])if(out[x.type]&&typeof x.id==='string')out[x.type].push(x.id);return out;}
export function getEventSummary(state,now=Date.now()){const s=migrateEventsState(state,now);return Object.values(EVENT_DEFINITIONS).map(d=>{let ids=d.missions?.map(m=>m.id)??d.days?.map(m=>String(m.day))??Object.keys(d.rewards??{});if(d.id==='first-steps')ids.push(d.final.id);if(d.id==='zone-conquest')ids=[...zones.flatMap(z=>['normal','nightmare','hell'].flatMap(diff=>['stage','boss','medal'].map(k=>`${z}:${diff}:${k}`))),'medal-all-gold'];return{id:d.id,title:d.title,kind:d.kind,active:d.id!=='blood-moon'||s.bloodMoon.active,progress:d.id==='infernal-tower'?s.tower.run?.floor??0:s[bucketKey[d.id]].progress,rows:ids.map(id=>({id,...getClaimStatus(s,d.id,id,{now})})),day:d.id==='rookie-trial'?rookieDay(s,now):null};});}
