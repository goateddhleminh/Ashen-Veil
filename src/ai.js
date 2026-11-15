import { face } from './entities.js';
import { UNDEAD } from './data.js';
export function updateAI(enemies, hero, world, dt, damage) {
  for (const enemy of enemies) {
    if (!enemy.active || !enemy.alive) continue;
    enemy.cooldown = Math.max(0, enemy.cooldown - dt); enemy.moving = false;
    const distance = enemy.position.distanceTo(hero.position);
    if (enemy.windup > 0) {
      enemy.windup -= dt;
      // Damage is checked at impact: the hero can evade a committed swing.
      if (enemy.windup <= 0) {
        enemy.attackVisual = .28;
        if (distance <= enemy.range + .3 && hero.alive) damage(hero, enemy.damage);
      }
      continue;
    }
    if (distance > UNDEAD.aggro || !hero.alive) continue;
    face(enemy, hero.position);
    if (distance <= enemy.range && enemy.cooldown <= 0) {
      enemy.windup = UNDEAD.windup; enemy.cooldown = enemy.attackSeconds;
    } else if (distance > enemy.range && distance > 0) {
      world.move(enemy, (hero.position.x - enemy.position.x) / distance * enemy.speed * dt, (hero.position.z - enemy.position.z) / distance * enemy.speed * dt);
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
