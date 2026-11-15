import * as THREE from 'three';
import { face } from './entities.js';
import { xpForLevel, LEVEL_CAP } from './data.js';
import { recomputeStats } from './progression.js';
import { skillHits } from './skill-shapes.js';
import { advanceBursts } from './skill-bursts.js';

export class Combat {
  constructor(scene, onKill, onLevel) {
    this.onKill = onKill; this.onLevel = onLevel; this.cursor = 0; this.bursts=[];
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
  applySkill(hero, skill, point) {
    if(skill.id==='barrage'){
      if(this.bursts.length<4)this.bursts.push({hero,skill:{...skill,id:'barrage-pulse',multiplier:skill.multiplier/3},point:{...point},remaining:3,until:0,interval:.18});
      return;
    }
    this.effect(point, skill.color, skill.radius, .65);
    if(skill.id==='volley')for(let i=1;i<=5;i++)this.effect({x:hero.position.x+(point.x-hero.position.x)*i/5,y:0,z:hero.position.z+(point.z-hero.position.z)*i/5},skill.color,skill.radius*.5,.35);
    hero.attackVisual = .28;
    for (const enemy of this.enemies || []) {
      if (!enemy.active || !skillHits(skill.id,hero.position,point,enemy.position,skill.radius)) continue;
      this.damage(enemy, hero.damage * skill.multiplier * (hero.legendaryEffects?.includes('echo')?1.25:1));
      if(skill.effect==='slow') enemy.slowTime=4;
      if(skill.effect==='stun') { enemy.stunTime=1.2; enemy.windup=0; }
    }
  }
  damage(target, amount) {
    if (!target.alive || target.invulnerable > 0) return;
    if(target.legendaryEffects?.includes('bastion')) amount*=.85;
    if(target.guardTime>0) amount*=.5;
    if(target.wardTime>0) amount*=.3;
    const mitigated = amount * 100 / (100 + (target.armor || 0));
    target.hp = Math.max(0, target.hp - mitigated); target.flash = .12;
    this.onSound?.(target.enemy?'hit':'hurt');
    this.effect(target.position, target.enemy ? 0xe9ba70 : 0xd24935, .7);
    if (!target.hp) {
      target.alive = false;
      if (target.enemy) { target.active = false; target.model.visible = false; this.onKill(target); }
    }
  }
  update(hero, enemies, dt) {
    this.enemies = enemies;
    if(hero.alive)advanceBursts(this.bursts,dt,b=>this.applySkill(b.hero,b.skill,b.point));
    else this.bursts.length=0;
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
        if(hero.legendaryEffects?.includes('frost')) nearest.slowTime=2;
        let hits = 1;
        const amount = hero.damage * (Math.random() * 100 < hero.crit ? 1.75 : 1);
        if (hero.classId === 'warrior') {
          this.effect(hero.position, 0xe9d1a0, 1.8);
          // Sweeping blade catches a second nearby undead for half damage.
          const secondary = enemies.find(e => e !== nearest && e.active && hero.position.distanceTo(e.position) < hero.range);
          this.damage(nearest, amount); if (secondary) { this.damage(secondary, amount * .5); hits++; }
        } else {
          const color = hero.classId === 'mage' ? 0xa49aff : 0x92d9ad;
          // Bounded rings trace the instantaneous bolt/arrow from weapon to target.
          const impact = nearest.position.clone();
          for (let i = 1; i <= 5; i++) this.effect(hero.position.clone().lerp(impact, i / 5), color, hero.classId === 'mage' ? .45 : .16, .22);
          this.damage(nearest, amount);
          if (hero.classId === 'mage') {
            this.effect(impact, color, 1.7, .4);
            for (const e of enemies) if (e !== nearest && e.active && e.position.distanceTo(impact) < 1.8) { this.damage(e, amount * .4); hits++; }
          }
        }
        hero.hp = Math.min(hero.maxHp, hero.hp + (hero.lifeOnHit || 0) * hits);
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
    while (hero.level < LEVEL_CAP && hero.xp >= hero.xpNeeded) {
      hero.xp -= hero.xpNeeded; hero.level++; hero.xpNeeded = xpForLevel(hero.level);
      hero.talentPoints = (hero.talentPoints || 0) + 1;
      hero.statPoints = (hero.statPoints || 0) + 2;
      hero.baseStats.vitality += 2;
      hero.baseStats[hero.classId === 'mage' ? 'intelligence' : hero.classId === 'archer' ? 'dexterity' : 'strength'] += 2;
      recomputeStats(hero); hero.hp = hero.maxHp;
      this.effect(hero.position, 0xffd57c, 3.5, 1); this.onLevel(hero.level);
    }
    if(hero.level >= LEVEL_CAP)hero.xp=0;
  }
  reset() { this.bursts.length=0; this.effects.forEach(e => { e.life = 0; e.mesh.visible = false; }); }
}
