export const STAGE_DEFINITIONS={
  1:{name:'Outer Grounds',objective:'Defeat 8 enemies and activate the shrine.'},
  2:{name:'Inner Sanctum',objective:'Defeat 3 enemies including 2 champions, then open the reliquary.'},
  3:{name:'Guardian Arena',objective:'Defeat the regional guardian.'}
};
export function createStageState(){return {stage:1,stageKills:0,kills:0,champions:0,shrine:false,chest:false,guardian:false};}
export function currentStage(run){return Math.max(1,Math.min(3,Number(run?.stage)||1));}
export function canAdvanceStage(run){
  if(!run)return false;
  if(currentStage(run)===1)return run.kills>=8&&run.shrine===true;
  if(currentStage(run)===2)return run.stageKills>=3&&run.champions>=2&&run.chest===true;
  return false;
}
export function advanceStage(run,event){
  if(!run||!event)return false;
  if(event.type==='kill'){run.stageKills=(run.stageKills??0)+1;run.kills=Math.min(8,run.kills+1);if(event.elite&&currentStage(run)===2)run.champions=Math.min(2,run.champions+1);}
  if(event.type==='shrine'&&currentStage(run)===1)run.shrine=true;
  if(event.type==='chest'&&currentStage(run)===2)run.chest=true;
  if(event.type==='portal'&&canAdvanceStage(run)){run.stage=Math.min(3,currentStage(run)+1);run.stageKills=0;return true;}
  if(event.type==='guardian'&&currentStage(run)===3)run.guardian=true;
  return false;
}
export function isStageComplete(run){return currentStage(run)===3&&run?.guardian===true;}
