// Move through collision resolution in short steps; never damage through an obstacle.
export function advanceCharge(enemy,hero,world,dt,damage){
 const charge=enemy.charge;if(!charge)return;
 let remaining=Math.min(Math.max(0,dt),charge.time);charge.time-=remaining;
 while(remaining>1e-8){
  const step=Math.min(remaining,.01),dx=charge.x-enemy.position.x,dz=charge.z-enemy.position.z,distance=Math.hypot(dx,dz);
  if(distance<.05)break;
  const travel=Math.min(distance,22*step);world.move(enemy,dx/distance*travel,dz/distance*travel);enemy.moving=true;
  if(!charge.hit&&hero.alive&&Math.hypot(hero.position.x-enemy.position.x,hero.position.z-enemy.position.z)<=.9){charge.hit=true;damage(hero,enemy.damage);}
  remaining-=step;
 }
 if(charge.time<=0||Math.hypot(charge.x-enemy.position.x,charge.z-enemy.position.z)<.05)enemy.charge=null;
}
