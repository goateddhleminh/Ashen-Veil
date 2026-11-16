import * as THREE from 'three';
import { face } from './entities.js';
import { xpForLevel, LEVEL_CAP } from './data.js';
import { recomputeStats } from './progression.js';
import { skillHits } from './skill-shapes.js';
import { advanceBursts } from './skill-bursts.js';
import { applyStatusEffect } from './status-effects.js';

export class Combat {
  constructor(scene, onKill, onLevel) {
    this.hitStopRemaining = 0; this.numberCursor = 0; this.reducedMotion = false;
    this.onKill = onKill; this.onLevel = onLevel; this.cursor = 0; this.bursts=[];
    this.numberRoot=document.createElement('div');this.numberRoot.id='damage-numbers';this.numberRoot.setAttribute('aria-hidden','true');
    this.numberRoot.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:3;overflow:hidden';document.body.append(this.numberRoot);
    this.numberProjected=new THREE.Vector3();
    this.numbers=Array.from({length:32},()=>{
      const label=document.createElement('span');label.hidden=true;label.style.cssText='position:absolute;pointer-events:none;font:bold 18px Georgia,serif;text-shadow:0 2px 3px #000,1px 0 #000;white-space:nowrap';
      this.numberRoot.append(label);return {label,position:new THREE.Vector3(),life:0,duration:.7};
    });
    const geometry = new THREE.RingGeometry(.65, .85, 24, 1, 0, Math.PI * 1.4);
    // Reuse a bounded effect pool; no geometry allocation on hit or level-up.
    this.effects = Array.from({ length: 20 }, () => {
      const material = new THREE.MeshBasicMaterial({ color: 0xe5bf76, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
      const mesh = new THREE.Mesh(geometry, material); mesh.rotation.x = -Math.PI / 2; mesh.visible = false; scene.add(mesh);
      return { mesh, life: 0, duration: .3, size: 1 };
    });
    this.projectiles=Array.from({length:16},()=>{
      const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}));
      mesh.rotation.x=-Math.PI/2;mesh.visible=false;scene.add(mesh);
      return {mesh,active:false,start:new THREE.Vector3(),end:new THREE.Vector3(),life:0,duration:0};
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
      if(skill.id==='ember')applyStatusEffect(enemy,'burn',hero.damage*.2);
      if(skill.id==='snare')applyStatusEffect(enemy,'poison',hero.damage*.15);
      if(skill.effect==='slow') enemy.slowTime=4;
      if(skill.effect==='stun') { enemy.stunTime=1.2; enemy.windup=0; }
    }
  }
  launchProjectile(hero,target,amount,critical) {
    const p=this.projectiles.find(p=>!p.active);if(!p)return;
    p.active=true;p.hero=hero;p.target=target;p.generation=target.spawnGeneration;p.amount=amount;p.critical=critical;
    p.start.copy(hero.position);p.end.copy(target.position);p.duration=Math.max(.05,p.start.distanceTo(p.end)/24);p.life=p.duration;
    p.mage=hero.classId==='mage';p.mesh.material.color.setHex(p.mage?0xa49aff:0x92d9ad);p.mesh.scale.setScalar(p.mage?.35:.16);p.mesh.position.copy(p.start);p.mesh.position.y=.8;p.mesh.visible=true;
  }
  updateProjectiles(dt) {
    for(const p of this.projectiles){
      if(!p.active)continue;
      if(!p.hero.alive||!p.target.active||!p.target.alive||p.generation!==p.target.spawnGeneration){p.active=false;p.mesh.visible=false;continue;}
      p.life=Math.max(0,p.life-dt);p.mesh.position.copy(p.start).lerp(p.end,1-p.life/p.duration);p.mesh.position.y=.8;
      if(p.life>0)continue;
      p.active=false;p.mesh.visible=false;let hits=1;
      if(p.hero.legendaryEffects?.includes('frost'))p.target.slowTime=2;
      this.damage(p.target,p.amount,p.critical);
      if(p.mage){
        this.effect(p.end,0xa49aff,1.7,.4);
        for(const e of this.enemies)if(e!==p.target&&e.active&&e.position.distanceTo(p.end)<1.8){this.damage(e,p.amount*.4,p.critical);hits++;}
      }
      p.hero.hp=Math.min(p.hero.maxHp,p.hero.hp+(p.hero.lifeOnHit||0)*hits);
    }
  }
  advanceFeedback(dt) {
    const elapsed=Math.max(0,dt), frozen=Math.min(elapsed,this.hitStopRemaining);
    this.hitStopRemaining=Math.max(0,this.hitStopRemaining-elapsed);
    return this.reducedMotion ? elapsed : elapsed-frozen;
  }
  render(camera, playing, dt) {
    this.numberRoot.hidden=!playing;
    for(const n of this.numbers){
      n.life=Math.max(0,n.life-dt);n.label.hidden=!playing||n.life<=0;if(n.label.hidden)continue;
      const progress=1-n.life/n.duration;
      this.numberProjected.copy(n.position);this.numberProjected.y+=1.8+(this.reducedMotion?0:progress*.8);this.numberProjected.project(camera);
      n.label.hidden=Math.abs(this.numberProjected.x)>1||Math.abs(this.numberProjected.y)>1||Math.abs(this.numberProjected.z)>1;
      n.label.style.transform=`translate(${(this.numberProjected.x*.5+.5)*innerWidth}px,${(-this.numberProjected.y*.5+.5)*innerHeight}px) translate(-50%,-100%)`;
      n.label.style.opacity=String(Math.min(1,n.life/.2));
    }
  }
  damage(target, amount, critical = false) {
    if (!target.alive || target.invulnerable > 0) return;
    if(!Number.isFinite(amount)||amount<=0)return;
    let multiplier=100/(100+Math.max(0,target.armor||0));
    if(target.legendaryEffects?.includes('bastion')) multiplier*=.85;
    if(target.guardTime>0) multiplier*=.5;
    if(target.wardTime>0) multiplier*=.3;
    const mitigated = amount * Math.max(.2,multiplier);
    const n=this.numbers[this.numberCursor++%this.numbers.length];n.position.copy(target.position);n.life=n.duration;
    n.label.textContent=`${Math.round(mitigated)}${critical?'!':''}`;n.label.style.color=target.enemy?(critical?'#ffe094':'#fff4d6'):'#ff9c8f';n.label.style.fontSize=critical?'24px':'18px';
    if(critical&&!this.reducedMotion&&this.hitStopRemaining<=0)this.hitStopRemaining=.06;
    this.onImpact?.(critical,target.enemy);
    if(target.enemy&&this.hero&&this.world){
      const dx=target.position.x-this.hero.position.x,dz=target.position.z-this.hero.position.z,d=Math.hypot(dx,dz);
      if(d>0)this.world.move(target,dx/d*.25,dz/d*.25);
    }
    target.hp = Math.max(0, target.hp - mitigated); target.flash = .12;
    this.onSound?.(target.hp === 0 ? (target.enemy ? 'kill' : 'die') : (target.enemy ? 'hit' : 'hurt'));
    this.effect(target.position, target.enemy ? 0xe9ba70 : 0xd24935, .7);
    if (!target.hp) {
      target.alive = false;
      if (target.enemy) { target.active = false; target.model.visible = false; this.onKill(target); }
    }
  }
  update(hero, enemies, dt, attackRequested = false) {
    this.enemies = enemies; this.hero = hero;
    this.updateProjectiles(dt);
    if(hero.alive)advanceBursts(this.bursts,dt,b=>this.applySkill(b.hero,b.skill,b.point));
    else this.bursts.length=0;
    hero.cooldown = Math.max(0, hero.cooldown - dt);
    if (attackRequested && hero.alive && hero.cooldown <= 0) {
      let nearest = null, distance = hero.range;
      for (const enemy of enemies) {
        if (!enemy.active) continue;
        const d = hero.position.distanceTo(enemy.position);
        if (d < distance) { distance = d; nearest = enemy; }
      }
      if (nearest) {
        face(hero, nearest.position); hero.cooldown = hero.attackSeconds; hero.attackVisual = .28;
        if(hero.classId==='warrior'&&hero.legendaryEffects?.includes('frost')) nearest.slowTime=2;
        let hits = 1;
        const critical=Math.random()*100<hero.crit;
        const amount = hero.damage * (critical ? 1.75 : 1);
        if (hero.classId === 'warrior') {
          this.effect(hero.position, 0xe9d1a0, 1.8);
          // Sweeping blade catches a second nearby undead for half damage.
          const secondary = enemies.find(e => e !== nearest && e.active && hero.position.distanceTo(e.position) < hero.range);
          this.damage(nearest, amount, critical); if (secondary) { this.damage(secondary, amount * .5, critical); hits++; }
        } else {
          this.launchProjectile(hero,nearest,amount,critical);hits=0;
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
  reset() { this.projectiles.forEach(p=>{p.active=false;p.mesh.visible=false;}); this.hitStopRemaining=0; this.numbers.forEach(n=>{n.life=0;n.label.hidden=true;}); this.bursts.length=0; this.effects.forEach(e => { e.life = 0; e.mesh.visible = false; }); }
}
