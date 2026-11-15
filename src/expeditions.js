export const MODIFIERS=[
 {id:'fortified',name:'Fortified',description:'Enemies have 30% more life.',health:1.3},
 {id:'wrath',name:'Wrath',description:'Enemies deal 20% more damage.',damage:1.2},
 {id:'haste',name:'Restless',description:'Enemies move 25% faster.',speed:1.25},
 {id:'armored',name:'Ironbound',description:'Enemies gain 25 armor.',armor:25},
 {id:'relentless',name:'Relentless',description:'Enemy recovery is 20% shorter.',cooldown:.8},
 {id:'treasure',name:'Gilded',description:'Completion gold is doubled.',gold:2}
];
export const BOUNTIES=[{id:'hunt',name:'Cull the Host',type:'kill',target:20},{id:'elites',name:'Break the Champions',type:'elite',target:3},{id:'relic',name:'Recover the Relic',type:'chest',target:1}];
export function beginExpedition(world,tier){
 if(!world.campaignComplete)return {ok:false,message:'Complete the campaign to unlock expeditions.'};
 if(!Number.isInteger(tier)||tier<1||tier>Math.min(100,(world.highestTier??0)+1))return {ok:false,message:'Clear the previous tier first.'};
 const modifiers=[MODIFIERS[(tier-1)%6],MODIFIERS[(tier+1)%6]];
 const product=key=>modifiers.reduce((value,m)=>value*(m[key]??1),1);
 return {ok:true,run:{tier,region:['graveyard','marsh','citadel'][(tier-1)%3],modifiers:modifiers.map(m=>m.id),kills:0,elites:0,chests:0,boss:false,claimed:false,bounties:[],target:20,
 baseHealthMultiplier:1+tier*.25,healthMultiplier:(1+tier*.25)*product('health'),damageMultiplier:(1+tier*.12)*product('damage'),speedMultiplier:product('speed'),cooldownMultiplier:product('cooldown'),armor:modifiers.reduce((v,m)=>v+(m.armor??0),0),reward:{gold:500*tier*product('gold'),gems:8*tier,diamonds:1+Math.floor(tier/3)}}};
}
export function advanceExpedition(run,event){
 if(!run||run.claimed)return;
 if(event.type==='kill'){run.kills=Math.min(run.target,run.kills+1);if(event.elite)run.elites=Math.min(3,run.elites+1);}
 if(event.type==='chest')run.chests=1;
 if(event.type==='boss'&&run.kills>=run.target)run.boss=true;
}
export function claimBounty(run,id){
 const bounty=BOUNTIES.find(b=>b.id===id),counts={kill:run?.kills,elite:run?.elites,chest:run?.chests};
 if(!run||!bounty||run.bounties.includes(id)||counts[bounty.type]<bounty.target)return {ok:false,message:'Bounty incomplete or already claimed.'};
 run.bounties.push(id);return {ok:true,message:`${bounty.name} completed.`,reward:{gold:100*run.tier,gems:2*run.tier,diamonds:0}};
}
export function claimExpedition(world,run){
 if(!run||run.claimed||run.kills<run.target||!run.boss)return {ok:false,message:'Defeat the expedition host and its guardian first.'};
 run.claimed=true;world.highestTier=Math.max(world.highestTier??0,run.tier);
 return {ok:true,message:`Tier ${run.tier} cleared.`,reward:{...run.reward}};
}
