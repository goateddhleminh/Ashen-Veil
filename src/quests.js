const regions=['graveyard','marsh','citadel'];
const names=[['Silence the Restless','A Light Remembered','The Broken Bell'],['Ash in the Water','The Lost Caravan','Crown of Cinders'],['The Empty Watch','The Last Reliquary','A Dawn Beyond the Veil']];
export const QUESTS=regions.flatMap((region,index)=>['kill','chest','boss'].map((type,i)=>({id:`${region}-${type}`,region,type,name:names[index][i],target:type==='kill'?12:1,gold:(index+1)*(i+1)*120,gems:(index+1)*(i+1)*2,xp:(index+1)*(i+1)*90})));
export function advanceQuest(state,event){
 for(const quest of QUESTS){
  if(quest.region!==event.region||quest.type!==event.type||!state.unlocked.includes(quest.region))continue;
  if(quest.type==='boss' && event.id!==({graveyard:'bellwarden',marsh:'mirequeen',citadel:'hollowking'}[quest.region]))continue;
  state.questProgress[quest.id]=Math.min(quest.target,(state.questProgress[quest.id]??0)+1);
 }
}
export function claimQuestReward(state,id){
 const quest=QUESTS.find(q=>q.id===id);
 if(!quest||state.claimedRewards.includes(id)||(state.questProgress[id]??0)<quest.target)return {ok:false,message:'Quest incomplete or reward already claimed.'};
 if(quest.type==='boss'&&!QUESTS.filter(q=>q.region===quest.region&&q.type!=='boss').every(q=>state.claimedRewards.includes(q.id)))return {ok:false,message:'Claim the other regional quests first.'};
 state.claimedRewards.push(id);
 if(quest.type==='boss'){
  const next=regions[regions.indexOf(quest.region)+1];
  if(next&&!state.unlocked.includes(next))state.unlocked.push(next);
  if(!next)state.campaignComplete=true;
 }
 return {ok:true,message:`Completed ${quest.name}.`,reward:{gold:quest.gold,gems:quest.gems,xp:quest.xp}};
}
