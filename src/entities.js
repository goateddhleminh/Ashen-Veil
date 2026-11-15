import * as THREE from 'three';
import { WARRIOR, UNDEAD, xpForLevel } from './data.js';

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
  part(arm, box, enemy ? 0x878c7b : 0xc9dce1, 0, -.38, .65, .15, .08, .8);
  if (!enemy) part(body, box, 0x705c3e, .48, .85, .18, .12, .64, .49);
  // World-space bars billboard in the render pass.
  const bar = new THREE.Group(); bar.position.y = 2.05; model.add(bar);
  const back = new THREE.Mesh(box, material(0x161919)); back.scale.set(.95, .1, .04); bar.add(back);
  const fill = new THREE.Mesh(box, material(enemy ? 0xb95042 : 0xc6ac72)); fill.scale.set(.9, .055, .05); fill.position.z = .03; bar.add(fill);
  bar.visible = enemy;
  scene.add(model);
  return { ...data, maxHp: data.hp, enemy, position: new THREE.Vector3(), target: new THREE.Vector3(), model, body, legs, arm, bar, fill,
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
  actor.body.scale.setScalar(actor.flash > 0 ? 1.08 : 1);
  actor.bar.quaternion.copy(camera.quaternion);
  const fraction = Math.max(0, actor.hp / actor.maxHp);
  actor.fill.scale.x = .9 * fraction; actor.fill.position.x = -.45 * (1 - fraction);
}
export function face(actor, target) {
  actor.model.rotation.y = Math.atan2(target.x - actor.position.x, target.z - actor.position.z);
  // The health bar cancels its parent's yaw before applying camera orientation.
}
export function resetHero(hero) {
  Object.assign(hero, WARRIOR, { maxHp: WARRIOR.hp, level: 1, xp: 0, xpNeeded: xpForLevel(1), cooldown: 0, windup: 0, alive: true, active: true });
  hero.position.set(0, 0, 4); hero.target.copy(hero.position);
}
