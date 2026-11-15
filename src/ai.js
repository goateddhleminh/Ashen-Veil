import { advanceCharge } from './charge.js';
import { face } from './entities.js';
import { UNDEAD } from './data.js';
import { planAttack, attackHits } from './enemy-attacks.js';
export function updateAI(enemies, hero, world, dt, damage) {
  for (const enemy of enemies) {
    if (!enemy.active || !enemy.alive) continue;
    enemy.cooldown = Math.max(0, enemy.cooldown - dt); enemy.moving = false;
    enemy.slowTime = Math.max(0,(enemy.slowTime||0)-dt);
    enemy.stunTime = Math.max(0,(enemy.stunTime||0)-dt);
    if(enemy.stunTime>0) continue;
    const stepDt = enemy.slowTime>0 ? dt*.35 : dt;
    if(enemy.charge){advanceCharge(enemy,hero,world,stepDt,damage);continue;}
    const distance = enemy.position.distanceTo(hero.position);
    if (enemy.windup > 0) {
      enemy.windup -= dt;
      // Damage is checked at impact: the hero can evade a committed swing.
      if (enemy.windup <= 0) {
        enemy.attackVisual = .28;
        if(enemy.kind==='charger'&&!enemy.bossId&&enemy.attackPlan){enemy.charge={x:enemy.attackPlan.x,z:enemy.attackPlan.z,time:.45,hit:false};}
        else if (enemy.attackPlan && attackHits(enemy.attackPlan,hero.position) && hero.alive) damage(hero, enemy.damage*(1+(enemy.attackPlan.phase-1)*.15));
        enemy.attackPlan=null;
      }
      continue;
    }
    if (distance > UNDEAD.aggro || !hero.alive) continue;
    face(enemy, hero.position);
    const range=enemy.bossId?9:['caster','ranged','charger'].includes(enemy.kind)?8:enemy.range;
    if (distance <= range && enemy.cooldown <= 0) {
      enemy.attackPlan=planAttack(enemy,hero);enemy.windup=enemy.attackPlan.windup;enemy.cooldown=enemy.attackSeconds+enemy.windup;
    } else if (distance > range && distance > 0) {
      world.move(enemy, (hero.position.x - enemy.position.x) / distance * enemy.speed * stepDt, (hero.position.z - enemy.position.z) / distance * enemy.speed * stepDt);
      enemy.moving = true;
    }
  }
  // Bounded population makes pair separation inexpensive (at most 120 pairs).
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j]; if (!a.active || !b.active) continue;
    const dx = a.position.x - b.position.x, dz = a.position.z - b.position.z, d = Math.hypot(dx, dz);
    if (d > .001 && d < .84) {
      const push = (.84 - d) * .5;
      world.move(a, dx / d * push, dz / d * push); world.move(b, -dx / d * push, -dz / d * push);
    }
  }
}
