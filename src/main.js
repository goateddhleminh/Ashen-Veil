import * as THREE from 'three';
import { Engine } from './engine.js';
import { FollowCamera } from './camera.js';
import { Input } from './input.js';
import { World } from './world.js';
import { createActor, resetHero, animateActor, face } from './entities.js';
import { updateAI } from './ai.js';
import { Combat } from './combat.js';
import { UI } from './ui.js';
import { WORLD, UNDEAD } from './data.js';
import { equipItem, unequipItem, usePotion } from './progression.js';
import { Loot } from './loot.js';

let engine, follow, input;
try {
  let state = 'ready', kills = 0, spawnTimer = 0, hudTimer = 0;
  const ui = new UI({ onStart: start, onRestart: start, onPause: togglePause, onPanel: togglePanel,
    onEquip: id => action(() => equipItem(hero, id)), onUnequip: slot => action(() => unequipItem(hero, slot)), onPotion: () => action(() => usePotion(hero)) });
  engine = new Engine(document.querySelector('#game'), update, render);
  follow = new FollowCamera(engine.renderer);
  const world = new World(engine.scene);
  const hero = createActor(engine.scene); resetHero(hero);
  // Pool enemies once. Restarting and spawning never allocate new models.
  const enemies = Array.from({ length: WORLD.enemyCap }, () => {
    const enemy = createActor(engine.scene, true); enemy.active = false; enemy.model.visible = false; return enemy;
  });
  const loot = new Loot(engine.scene, text => ui.announce(text));
  const combat = new Combat(engine.scene, enemy => {
    kills++; loot.spawn(enemy, hero); combat.grantXP(hero, enemy.xp);
  }, level => ui.announce(`Level ${level} · Life restored · Power increased`));
  const marker = new THREE.Mesh(new THREE.RingGeometry(.32, .4, 24), new THREE.MeshBasicMaterial({ color: 0xd5c397, transparent: true, opacity: .65, side: THREE.DoubleSide, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2; marker.visible = false; engine.scene.add(marker);
  input = new Input(engine.renderer.domElement, follow.camera, togglePause);
  const normalBar = enemies[0].fill.material;
  const championBar = new THREE.MeshStandardMaterial({ color: 0x6ba9df });
  const eliteBar = new THREE.MeshStandardMaterial({ color: 0xddb34b });
  function refresh() { ui.update(hero, kills, enemies.filter(e => e.active).length, state === 'paused'); }
  function action(fn) { if (state !== 'playing' && state !== 'inventory') return; ui.announce(fn()); refresh(); }
  function togglePanel() {
    if (state !== 'playing' && state !== 'inventory') return;
    state = state === 'inventory' ? 'playing' : 'inventory'; input.clear(); loot.selected = null; hero.target.copy(hero.position); marker.visible = false; ui.setState(state); refresh();
  }
  window.addEventListener('keydown', event => {
    if (event.repeat) return;
    if (event.code === 'KeyC' || event.code === 'KeyI') { event.preventDefault(); ui.selectTab(event.code === 'KeyC' ? 'character' : 'inventory'); togglePanel(); }
    if (event.code === 'KeyQ') { event.preventDefault(); action(() => usePotion(hero)); }
  });
  function spawn(initial = false) {
    const enemy = enemies.find(e => !e.active); if (!enemy) return;
    const angle = Math.random() * Math.PI * 2, radius = initial ? 8 + Math.random() * 9 : 14 + Math.random() * 5;
    enemy.position.set(hero.position.x + Math.cos(angle) * radius, 0, hero.position.z + Math.sin(angle) * radius);
    world.resolve(enemy.position, enemy.radius);
    if (enemy.position.distanceTo(hero.position) < 5) return;
    Object.assign(enemy, UNDEAD, { maxHp: UNDEAD.hp, alive: true, active: true, cooldown: .8, windup: 0, flash: 0, attackVisual: 0 });
    const roll = Math.random(); enemy.rank = roll < .08 ? 2 : roll < .28 ? 1 : 0;
    const scale = 1 + enemy.rank * .18; enemy.model.scale.setScalar(scale);
    enemy.maxHp = enemy.hp = UNDEAD.hp * (1 + (hero.level - 1) * .18 + enemy.rank * .65);
    enemy.damage *= 1 + (hero.level - 1) * .1 + enemy.rank * .3;
    enemy.xp *= 1 + enemy.rank; enemy.armor = enemy.rank * 10;
    enemy.fill.material = enemy.rank === 2 ? eliteBar : enemy.rank === 1 ? championBar : normalBar;
    enemy.model.visible = true;
  }
  function start(classId = 'warrior') {
    resetHero(hero, classId); loot.reset(); enemies.forEach(e => { e.active = false; e.model.visible = false; });
    combat.reset(); input.clear(); kills = 0; spawnTimer = 0; state = 'playing';
    marker.visible = false; follow.focus.copy(hero.position); follow.update(hero.position, 1);
    for (let i = 0; i < 9; i++) spawn(true);
    ui.setState(state); ui.announce('The Forgotten Graveyard · Hold your ground, or keep moving.');
    ui.update(hero, kills, enemies.filter(e => e.active).length, false);
  }
  function togglePause() {
    if (state === 'inventory') { togglePanel(); return; }
    if (state !== 'playing' && state !== 'paused') return;
    state = state === 'playing' ? 'paused' : 'playing'; input.clear(); ui.setState(state);
  }
  function update(dt) {
    if (state !== 'playing') return;
    const point = input.destination();
    if (point) {
      loot.selected = null;
      hero.target.copy(point); world.resolve(hero.target, hero.radius);
      marker.position.copy(hero.target); marker.position.y = .07; marker.visible = true;
    }
    loot.update(hero, dt);
    const distance = hero.position.distanceTo(hero.target);
    hero.moving = distance > .12;
    if (hero.moving) {
      face(hero, hero.target);
      const step = Math.min(distance, hero.speed * dt);
      world.move(hero, (hero.target.x - hero.position.x) / distance * step, (hero.target.z - hero.position.z) / distance * step);
    } else marker.visible = false;
    combat.update(hero, enemies, dt);
    updateAI(enemies, hero, world, dt, (target, amount) => combat.damage(target, amount));
    spawnTimer += dt;
    if (spawnTimer >= WORLD.spawnSeconds) { spawnTimer = 0; spawn(); }
    if (!hero.alive) { state = 'dead'; input.clear(); ui.setState(state); marker.visible = false; }
    hudTimer += dt;
    if (hudTimer > .08 || state === 'dead') {
      hudTimer = 0; ui.update(hero, kills, enemies.filter(e => e.active).length, false);
    }
  }
  function render(dt) {
    if (!follow) return;
    follow.update(hero.position, dt);
    const animationDt = state === 'playing' || state === 'ready' ? dt : 0;
    for (const actor of [hero, ...enemies]) {
      animateActor(actor, animationDt, follow.camera);
      // Convert the camera's world rotation to the bar's local rotation.
      actor.bar.quaternion.copy(actor.model.quaternion).invert().multiply(follow.camera.quaternion);
    }
    loot.render(follow.camera, state === 'playing');
    engine.renderer.render(engine.scene, follow.camera);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') togglePause(); });
  window.addEventListener('blur', () => { if (state === 'playing') togglePause(); });
  window.addEventListener('pagehide', event => {
    // A bfcache navigation preserves the live page; disposing it would break Back.
    if (event.persisted) { if (state === 'playing') togglePause(); return; }
    input.dispose(); follow.dispose(); engine.dispose();
  });
  ui.setState('ready'); ui.update(hero, 0, 0, false);
  document.querySelector('#loading').hidden = true;
  // Read-only diagnostic snapshots are useful for learning and automated checks.
  window.arpg = { snapshot: () => ({ state, classId: hero.classId, hp: hero.hp, maxHp: hero.maxHp, damage: hero.damage, armor: hero.armor, crit: hero.crit, range: hero.range, currencies: { ...hero.currencies }, potions: hero.potions, inventory: hero.inventory.map(i => ({ ...i, mods: { ...i.mods } })), equipment: JSON.parse(JSON.stringify(hero.equipment)), drops: loot.snapshot(), level: hero.level, xp: hero.xp, kills, position: hero.position.toArray(), enemies: enemies.filter(e => e.active).length, drawCalls: engine.renderer.info.render.calls, triangles: engine.renderer.info.render.triangles, geometries: engine.renderer.info.memory.geometries }) };
} catch (error) {
  engine?.dispose(); follow?.dispose(); input?.dispose();
  const loading = document.querySelector('#loading'); loading.hidden = false;
  loading.textContent = `Unable to start: ${error.message}. Use a current WebGL-capable desktop browser and a static HTTP host.`;
  console.error(error);
}
