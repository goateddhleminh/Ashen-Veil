import * as THREE from 'three';
import { WARRIOR, UNDEAD, xpForLevel } from './data.js';
import { initializeProgression } from './progression.js';

// Model parts share geometry and materials; actors contain only mutable gameplay state.
const box = new THREE.BoxGeometry(1, 1, 1);
const head = new THREE.IcosahedronGeometry(.3, 0);
const palettes = new Map();
function material(color) {
  if (!palettes.has(color)) palettes.set(color, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: .7 }));
  return palettes.get(color);
}
function part(parent, geometry, color, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geometry, material(color));
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m;
}
const ENEMY_STYLES = Object.freeze({
 melee: { armor:0x667565, cloth:0x433f35, skin:0xb9bba1, silhouette:[1,1,1] },
 ranged: { armor:0x385c72, cloth:0x223349, skin:0x9ebbd0, silhouette:[.82,1.12,1] },
 charger: { armor:0x7b3f3f, cloth:0x4b2428, skin:0xc87858, silhouette:[1.2,.82,1.2] },
 caster: { armor:0x59427d, cloth:0x281d4b, skin:0xc7a7db, silhouette:[.9,1.18,.9] },
 boss: { armor:0xb27b32, cloth:0x542d1f, skin:0xf1c47d, silhouette:[1.5,1.4,1.5] }
});
export function configureEnemyAppearance(actor, kind = actor.kind, boss = Boolean(actor.bossId)) {
 if (!actor?.enemy) return actor;
 const style = ENEMY_STYLES[boss ? 'boss' : kind] ?? ENEMY_STYLES.melee;
 actor.visualScale=style.silhouette;
 actor.body.scale.set(...style.silhouette);
 actor.weapon.visible=boss||kind==='melee'||kind==='charger';
 actor.bow.visible=!boss&&kind==='ranged';actor.crystal.visible=!boss&&kind==='caster';
 actor.weapon.scale.set(kind==='charger'?.42:.15,.08,boss?1.3:.8);
 if(actor.crest){actor.crest.visible=boss||kind==='charger';actor.crest.scale.set(boss?1.1:.8,boss?1.2:.65,.5);}
 if(actor.robe)actor.robe.visible=boss||kind==='caster';
 const meshes=[]; actor.body.traverse(child=>{if(child.isMesh)meshes.push(child);});
 if(meshes.length >= 2){ meshes[0].material = material(style.armor); meshes[1].material = material(style.skin); }
 // Cloth/limb meshes receive a second palette colour while shared geometry stays pooled.
 for(let i=2;i<meshes.length;i++) if(i%3===0) meshes[i].material=material(style.cloth);
 actor.fill.material = material(boss ? 0xe49346 : style.skin);
 return actor;
}
export function createActor(scene, enemy = false) {
  const data = enemy ? UNDEAD : WARRIOR;
  const model = new THREE.Group(), body = new THREE.Group(); model.add(body);
  const armor = enemy ? 0x667565 : 0x87939b, cloth = enemy ? 0x433f35 : 0x7e252a;
  part(body, box, armor, 0, .95, 0, .62, .65, .37);
  part(body, head, enemy ? 0xb9bba1 : 0xc1b49b, 0, 1.53, 0);
  if (!enemy) {
    part(body, box, 0x606e79, 0, 1.68, 0, .49, .18, .43);
    part(body, box, cloth, 0, 1.85, -.04, .1, .26, .3);
    part(body, box, cloth, 0, .88, -.25, .63, .95, .08);
  }
  for (const side of [-1, 1]) {
    part(body, box, armor, side * .43, 1.18, 0, .28, .29, .44);
    part(body, box, enemy ? 0xe5a55b : 0x1c2528, side * .11, 1.56, .256, .09, .06, .045);
  }
  const legs = [-1, 1].map(side => {
    const pivot = new THREE.Group(); pivot.position.set(side * .18, .65, 0); body.add(pivot);
    part(pivot, box, cloth, 0, -.23, 0, .23, .46, .26);
    part(pivot, box, 0x323a3c, 0, -.5, .07, .26, .17, .4); return pivot;
  });
  const arm = new THREE.Group(); arm.position.set(-.47, 1.1, 0); body.add(arm);
  part(arm, box, armor, 0, -.22, 0, .18, .48, .2);
  part(arm, box, 0x635241, 0, -.43, .2, .12, .12, .4);
  const weapon = part(arm, box, enemy ? 0x878c7b : 0xc9dce1, 0, -.38, .65, .15, .08, .8);
  const crystal = part(arm, head, 0x8c83ed, 0, -.38, 1.15, .55, .55, .55); crystal.visible = false;
  const bow = new THREE.Group(); arm.add(bow); bow.visible = false;
  for (const side of [-1, 1]) { const limb = part(bow, box, 0xc09e63, 0, -.38 + side * .35, .7, .08, .55, .09); limb.rotation.x = side * -.45; }
  if (!enemy) part(body, box, 0x705c3e, .48, .85, .18, .12, .64, .49);
  // World-space bars billboard in the render pass.
  const bar = new THREE.Group(); bar.position.y = 2.05; model.add(bar);
  const back = new THREE.Mesh(box, material(0x161919)); back.scale.set(.95, .1, .04); bar.add(back);
  const fill = new THREE.Mesh(box, material(enemy ? 0xb95042 : 0xc6ac72)); fill.scale.set(.9, .055, .05); fill.position.z = .03; bar.add(fill);
  bar.visible = enemy;
  scene.add(model);
  return { ...data, maxHp: data.hp, enemy, position: new THREE.Vector3(), target: new THREE.Vector3(), model, body, legs, arm, bar, fill, weapon, crystal, bow,
    level: 1, xp: 0, xpNeeded: xpForLevel(1), cooldown: 0, windup: 0, attackVisual: 0, flash: 0, stride: 0, moving: false, alive: true, active: true };
}
export function animateActor(actor, dt, camera) {
  actor.model.visible = actor.active;
  if (!actor.active) return;
  actor.model.position.copy(actor.position);
  actor.stride += dt * (actor.moving ? 10 : 2);
  actor.body.position.y = actor.moving ? Math.abs(Math.sin(actor.stride)) * .07 : Math.sin(actor.stride) * .018;
  actor.legs.forEach((leg, i) => { leg.rotation.x = actor.moving ? Math.sin(actor.stride + i * Math.PI) * .55 : 0; });
  actor.attackVisual = Math.max(0, actor.attackVisual - dt);
  actor.arm.rotation.x = actor.windup > 0 ? -1.8 : -Math.sin(actor.attackVisual / .28 * Math.PI) * 1.7;
  actor.flash = Math.max(0, actor.flash - dt);
  const flashScale=actor.flash > 0 ? 1.08 : 1;
  if(actor.visualScale)actor.body.scale.set(...actor.visualScale).multiplyScalar(flashScale);
  else actor.body.scale.setScalar(flashScale);
  actor.bar.quaternion.copy(camera.quaternion);
  const fraction = Math.max(0, actor.hp / actor.maxHp);
  actor.fill.scale.x = .9 * fraction; actor.fill.position.x = -.45 * (1 - fraction);
}
export function face(actor, target) {
  actor.model.rotation.y = Math.atan2(target.x - actor.position.x, target.z - actor.position.z);
  // The health bar cancels its parent's yaw before applying camera orientation.
}
export function resetHero(hero, classId = 'warrior') {
  Object.assign(hero, WARRIOR, { maxHp: WARRIOR.hp, level: 1, xp: 0, xpNeeded: xpForLevel(1), cooldown: 0, windup: 0, flash: 0, attackVisual: 0, alive: true, active: true });
  initializeProgression(hero, classId);
  hero.weapon.visible = hero.classId !== 'archer'; hero.bow.visible = hero.classId === 'archer'; hero.crystal.visible = hero.classId === 'mage';
  hero.weapon.scale.set(hero.classId === 'mage' ? .09 : .15, .08, hero.classId === 'mage' ? 1.2 : .8);
  hero.position.set(0, 0, 4); hero.target.copy(hero.position);
}
