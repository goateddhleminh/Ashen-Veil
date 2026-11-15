export function advanceBursts(queue,dt,hit){
 for(let i=queue.length-1;i>=0;i--){
  const burst=queue[i];burst.until-=Math.max(0,dt);
  while(burst.remaining>0&&burst.until<=0){hit(burst);burst.remaining--;burst.until+=burst.interval;}
  if(burst.remaining===0)queue.splice(i,1);
 }
}
