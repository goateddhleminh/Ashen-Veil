import * as THREE from 'three';
import { createItem, RARITIES } from './progression.js';

const COLORS = { gold: '#e7bf61', gems: '#64cbbd', diamonds: '#b3d9ff', potion: '#ef7474' };
export class Loot {
  constructor(scene, onNotice) {
    this.onNotice = onNotice; this.selected = null; this.time = 0;
    this.root = document.createElement('div'); this.root.id = 'loot-labels';
    this.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2;overflow:hidden';
    document.body.append(this.root);
    const geometry = new THREE.OctahedronGeometry(.22);
    const beamGeometry = new THREE.CylinderGeometry(.035, .12, 1.6, 5);
    this.pool = Array.from({ length: 32 }, () => {
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const mesh = new THREE.Mesh(geometry, material);
      const beam = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .22, depthWrite: false }));
      scene.add(mesh, beam); mesh.visible = beam.visible = false;
      const label = document.createElement('button'); label.type = 'button'; label.hidden = true;
      label.style.cssText = 'position:absolute;pointer-events:auto;transform:translate(-50%,-100%);background:#101714e8;border:1px solid currentColor;border-radius:3px;padding:4px 7px;font:11px Georgia,serif;white-space:nowrap;cursor:pointer;max-width:210px;overflow:hidden;text-overflow:ellipsis';
      const drop = { mesh, beam, label, active: false, position: new THREE.Vector3() };
      label.addEventListener('pointerdown', e => e.stopPropagation());
      label.addEventListener('click', e => { e.stopPropagation(); this.selected = drop; });
      this.root.append(label); return drop;
    });
    this.projected = new THREE.Vector3();
  }
  spawn(enemy, hero) {
    // One weighted drop per kill. Veteran enemies favor rarer equipment.
    const r = Math.random(), rank = enemy.rank || 0;
    let kind = r < .42 ? 'gold' : r < .54 ? 'gems' : r < .58 ? 'diamonds' : r < .72 ? 'potion' : 'gear';
    if (rank && r > .45) kind = 'gear';
    const drop = this.pool.find(d => !d.active);
    if (!drop) { hero.currencies.gold += 5 + hero.level; this.onNotice('Ground loot full · excess drop converted to gold'); return; }
    drop.kind = kind; drop.amount = kind === 'gold' ? 6 + Math.floor(Math.random() * 9) + hero.level * 2 + rank * 8 : 1;
    const roll = Math.random();
    const rarity = roll < .015 + rank * .035 ? 'legendary' : roll < .12 + rank * .14 ? 'rare' : roll < .42 + rank * .15 ? 'magic' : 'common';
    drop.item = kind === 'gear' ? createItem(hero.classId, hero.level, rarity) : null;
    const color = drop.item ? RARITIES[drop.item.rarity].color : COLORS[kind];
    drop.position.copy(enemy.position); drop.position.y = .35;
    drop.mesh.position.copy(drop.position); drop.beam.position.copy(drop.position); drop.beam.position.y = 1;
    drop.mesh.material.color.set(color); drop.beam.material.color.set(color);
    drop.label.style.color = typeof color === 'number' ? `#${color.toString(16).padStart(6,'0')}` : color;
    drop.label.textContent = drop.item ? drop.item.name : `${drop.amount} ${kind === 'potion' ? 'Healing potion' : kind}`;
    drop.active = true; drop.mesh.visible = drop.beam.visible = true;
  }
  update(hero, dt) {
    this.time += dt;
    const drop = this.selected;
    if (!drop?.active) { this.selected = null; return; }
    hero.target.set(drop.position.x, 0, drop.position.z);
    if (hero.position.distanceTo(hero.target) > 1.6) return;
    if (drop.kind === 'gear') {
      if (hero.inventory.length >= 24) { this.onNotice('Inventory full · equip an item or leave this drop'); this.selected = null; return; }
      hero.inventory.push(drop.item);
    } else if (drop.kind === 'potion') {
      if(hero.potions+drop.amount>9999){this.onNotice('Potion storage full · leave this drop until you have room.');this.selected=null;return;}
      hero.potions += drop.amount;
    }
    else hero.currencies[drop.kind] += drop.amount;
    this.onCollect?.();
    this.onNotice(`Collected ${drop.label.textContent}`); this.remove(drop);
  }
  render(camera, playing) {
    this.root.hidden = !playing;
    for (const d of this.pool) {
      if (!d.active) continue;
      d.mesh.rotation.y = this.time; d.mesh.position.y = .35 + Math.sin(this.time * 2) * .08;
      this.projected.copy(d.position); this.projected.y += 1; this.projected.project(camera);
      d.label.hidden = !playing || Math.abs(this.projected.x) > 1 || Math.abs(this.projected.y) > 1 || this.projected.z > 1;
      d.label.style.left = `${(this.projected.x * .5 + .5) * innerWidth}px`;
      d.label.style.top = `${(-this.projected.y * .5 + .5) * innerHeight}px`;
    }
  }
  remove(drop) { drop.active = false; drop.mesh.visible = drop.beam.visible = false; drop.label.hidden = true; if (this.selected === drop) this.selected = null; }
  reset() { this.pool.forEach(d => this.remove(d)); this.time = 0; }
  snapshot() { return this.pool.filter(d => d.active).map(d => ({ kind: d.kind, name: d.label.textContent, position: d.position.toArray(), item: d.item ? { ...d.item, mods: { ...d.item.mods } } : null })); }
}
