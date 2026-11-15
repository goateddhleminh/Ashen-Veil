import * as THREE from 'three';
import { face } from './entities.js';
import { xpForLevel } from './data.js';

export class Combat {
  constructor(scene, onKill, onLevel) {
    this.onKill = onKill; this.onLevel = onLevel; this.cursor = 0;
    const geometry = new THREE.RingGeometry(.65, .85, 24, 1, 0, Math.PI * 1.4);
    // Reuse a bounded effect pool; no geometry allocation on hit or level-up.
    this.effects = Array.from({ length: 20 }, () => {
      const material = new THREE.MeshBasicMaterial({ color: 0xe5bf76, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
      const mesh = new THREE.Mesh(geometry, material); mesh.rotation.x = -Math.PI / 2; mesh.visible = false; scene.add(mesh);
      return { mesh, life: 0, duration: .3, size: 1 };
    });
  }
  effect(position, color = 0xe5bf76, size = 1, duration = .3) {
    const e = this.effects[this.cursor++ % this.effects.length];
    e.life = duration; e.duration = duration; e.size = size;
    e.mesh.position.copy(position); e.mesh.position.y = .15;
    e.mesh.material.color.setHex(color); e.mesh.visible = true;
  }
  damage(target, amount) {
    if (!target.alive) return;
    target.hp = Math.max(0, target.hp - amount); target.flash = .12;
    this.effect(target.position, target.enemy ? 0xe9ba70 : 0xd24935, .7);
    if (!target.hp) {
      target.alive = false;
      if (target.enemy) { target.active = false; target.model.visible = false; this.onKill(target); }
    }
  }
  update(hero, enemies, dt) {
    hero.cooldown = Math.max(0, hero.cooldown - dt);
    if (hero.alive && hero.cooldown <= 0) {
      let nearest = null, distance = hero.range;
      for (const enemy of enemies) {
        if (!enemy.active) continue;
        const d = hero.position.distanceTo(enemy.position);
        if (d < distance) { distance = d; nearest = enemy; }
      }
      if (nearest) {
        face(hero, nearest.position); hero.cooldown = hero.attackSeconds; hero.attackVisual = .28;
        this.effect(hero.position, 0xe9d1a0, 1.8); this.damage(nearest, hero.damage);
      }
    }
    for (const e of this.effects) {
      e.life = Math.max(0, e.life - dt); e.mesh.visible = e.life > 0;
      if (!e.life) continue;
      const progress = 1 - e.life / e.duration;
      e.mesh.scale.setScalar(e.size * (.65 + progress * .65));
      e.mesh.material.opacity = (1 - progress) * .8;
    }
  }
  grantXP(hero, xp) {
    hero.xp += xp;
    while (hero.xp >= hero.xpNeeded) {
      hero.xp -= hero.xpNeeded; hero.level++; hero.xpNeeded = xpForLevel(hero.level);
      hero.maxHp += 18; hero.hp = hero.maxHp; hero.damage += 4;
      this.effect(hero.position, 0xffd57c, 3.5, 1); this.onLevel(hero.level);
    }
  }
  reset() { this.effects.forEach(e => { e.life = 0; e.mesh.visible = false; }); }
}
