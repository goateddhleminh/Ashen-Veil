import { bossPhase } from './regions.js';
export function planAttack(enemy,hero){
 const phase=enemy.bossId?bossPhase(enemy.hp,enemy.maxHp):1;
 const attack={x:hero.position.x,z:hero.position.z,originX:enemy.position.x,originZ:enemy.position.z,shape:'circle',radius:1,windup:.65,phase};
 if(enemy.bossId==='bellwarden')Object.assign(attack,{x:enemy.position.x,z:enemy.position.z,shape:'ring',radius:4+phase,windup:1.2});
 else if(enemy.bossId==='mirequeen')Object.assign(attack,{radius:2+phase*.6,windup:1.3});
 else if(enemy.bossId==='hollowking')Object.assign(attack,{x:enemy.position.x,z:enemy.position.z,shape:'cross',radius:6+phase,windup:1.1});
 else if(enemy.kind==='caster')Object.assign(attack,{radius:2,windup:1.1});
 else if(enemy.kind==='charger')Object.assign(attack,{shape:'line',radius:.9,windup:.9});
 else if(enemy.kind==='ranged')Object.assign(attack,{radius:.85,windup:.8});
 else Object.assign(attack,{x:enemy.position.x,z:enemy.position.z,radius:enemy.range+.3,windup:.45});
 return attack;
}
export function attackHits(attack,position){
 const dx=position.x-attack.x,dz=position.z-attack.z,d=Math.hypot(dx,dz);
 if(attack.shape==='ring')return d<=attack.radius&&d>=attack.radius-2;
 if(attack.shape==='cross')return (Math.abs(dx)<1.1||Math.abs(dz)<1.1)&&d<=attack.radius;
 if(attack.shape==='line'){
  const vx=attack.x-attack.originX,vz=attack.z-attack.originZ,length=vx*vx+vz*vz;
  const t=length?Math.max(0,Math.min(1,((position.x-attack.originX)*vx+(position.z-attack.originZ)*vz)/length)):0;
  return Math.hypot(position.x-attack.originX-vx*t,position.z-attack.originZ-vz*t)<=attack.radius;
 }
 return d<=attack.radius;
}
