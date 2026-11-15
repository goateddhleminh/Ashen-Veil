import { CLASSES, RARITIES } from './progression.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const labels = { strength: 'Strength', intelligence: 'Intelligence', dexterity: 'Dexterity', vitality: 'Vitality', damage: 'Damage', armor: 'Armor', life: 'Maximum life', maxHp: 'Maximum life', crit: 'Critical chance', speed: 'Movement speed', range: 'Attack range', attackSeconds: 'Attack interval' };
const number = value => Number(finite(value).toFixed(2)).toLocaleString();
const valueText = (key, value) => `${number(value)}${key === 'crit' ? '%' : key === 'attackSeconds' ? 's' : ''}`;
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

// Presentation only: simulation and pause ownership remain in main.js.
export class UI {
  constructor({ onStart, onRestart, onPause, onPanel, onEquip, onUnequip, onPotion }) {
    this.callbacks = { onStart, onRestart, onPause, onPanel, onEquip, onUnequip, onPotion };
    this.state = null;
    this.selectedClass = 'warrior';
    this.activeTab = 'character';
    this.hero = null;
    this.inventoryFingerprint = '';
    this.announcementTimer = null;
    this.nodes = Object.fromEntries([
      'hud', 'modal', 'modal-title', 'modal-eyebrow', 'modal-description', 'modal-action', 'modal-hint',
      'pause-button', 'health-globe', 'health-current', 'health-max', 'level', 'kills', 'enemy-count',
      'xp-text', 'xp-fill', 'xp-meter', 'announcement', 'class-selection', 'class-options',
      'character-button', 'inventory-button', 'potion-button', 'potions', 'gold', 'gems', 'diamonds',
      'inventory-overlay', 'panel-title', 'panel-close', 'character-tab', 'inventory-tab',
      'character-panel', 'inventory-panel', 'hero-stats', 'equipment-list', 'inventory-list', 'inventory-count',
    ].map(id => [id, document.getElementById(id)]));
    this.buildClasses();
    for (const root of [this.nodes.modal, this.nodes['inventory-overlay'], this.nodes['pause-button'], document.querySelector('.hero-controls')]) {
      for (const type of ['pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'dblclick', 'contextmenu', 'click']) {
        root.addEventListener(type, event => event.stopPropagation());
      }
      root.addEventListener('keydown', event => {
        // Main owns all game shortcuts, including panel dismissal.
        if (event.key === 'Tab' && ['ready', 'paused', 'dead', 'inventory'].includes(this.state)) this.trapFocus(event);
        if (!['escape', 'c', 'i', 'q'].includes(event.key.toLowerCase())) event.stopPropagation();
      });
      root.addEventListener('keyup', event => event.stopPropagation());
    }
    this.nodes['pause-button'].addEventListener('click', () => this.callbacks.onPause?.());
    this.nodes['modal-action'].addEventListener('click', () => {
      if (this.state === 'ready') this.callbacks.onStart?.(this.selectedClass);
      else if (this.state === 'dead') this.callbacks.onRestart?.(this.selectedClass);
      else if (this.state === 'paused') this.callbacks.onPause?.();
    });
    for (const tab of ['character', 'inventory']) {
      this.nodes[`${tab}-button`].addEventListener('click', () => { this.selectTab(tab); this.callbacks.onPanel?.(); });
      this.nodes[`${tab}-tab`].addEventListener('click', () => this.selectTab(tab));
      this.nodes[`${tab}-tab`].addEventListener('keydown', event => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const next = event.key === 'Home' ? 'character' : event.key === 'End' ? 'inventory' : tab === 'character' ? 'inventory' : 'character';
          this.selectTab(next); this.nodes[`${next}-tab`].focus();
        }
      });
    }
    this.nodes['potion-button'].addEventListener('click', () => this.callbacks.onPotion?.());
    this.nodes['panel-close'].addEventListener('click', () => this.callbacks.onPanel?.());
    this.nodes['inventory-overlay'].addEventListener('click', event => { if (event.target === this.nodes['inventory-overlay']) this.callbacks.onPanel?.(); });
    this.setState('ready');
  }

  buildClasses() {
    for (const id of ['warrior', 'mage', 'archer']) {
      const cls = CLASSES[id];
      const label = element('label', 'class-choice');
      label.style.setProperty('--class-color', cls.color);
      const input = element('input'); input.type = 'radio'; input.name = 'hero-class'; input.value = id; input.checked = id === this.selectedClass;
      input.addEventListener('change', () => { if (input.checked) this.selectedClass = id; });
      const copy = element('span', 'class-copy');
      copy.append(element('strong', '', cls.name), element('span', '', cls.description), element('small', '', `${labels[cls.primary]} · ${cls.range > 3 ? 'Ranged' : 'Melee'}`));
      label.append(input, copy); this.nodes['class-options'].append(label);
    }
  }

  trapFocus(event) {
    const root = this.state === 'inventory' ? this.nodes['inventory-overlay'] : this.nodes.modal;
    const controls = [...root.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')]
      .filter(node => node.tabIndex >= 0 && !node.closest('[hidden]') && (node.type !== 'radio' || node.checked));
    const first = controls[0], last = controls.at(-1);
    if (!first) return;
    if (!root.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    }
  }

  selectTab(tab) {
    if (!['character', 'inventory'].includes(tab)) return;
    this.activeTab = tab;
    for (const id of ['character', 'inventory']) {
      this.nodes[`${id}-panel`].hidden = tab !== id;
      this.nodes[`${id}-tab`].setAttribute('aria-selected', String(tab === id));
      this.nodes[`${id}-tab`].tabIndex = tab === id ? 0 : -1;
    }
  }

  update(hero, kills, enemyCount, paused) {
    if (!hero) return;
    this.hero = hero;
    const maxHp = Math.max(1, finite(hero.maxHp, 100)), hp = Math.max(0, Math.min(maxHp, finite(hero.hp)));
    const xpNeeded = Math.max(1, finite(hero.xpNeeded, 100)), xp = Math.max(0, finite(hero.xp));
    const healthPercent = `${hp / maxHp * 100}%`, xpPercent = `${Math.min(1, xp / xpNeeded) * 100}%`;
    this.text('health-current', Math.ceil(hp)); this.text('health-max', `/ ${Math.ceil(maxHp)}`);
    this.text('level', Math.max(1, Math.floor(finite(hero.level, 1)))); this.text('kills', Math.max(0, Math.floor(finite(kills))));
    this.text('enemy-count', Math.max(0, Math.floor(finite(enemyCount)))); this.text('xp-text', `${Math.floor(xp)} / ${Math.floor(xpNeeded)}`);
    for (const key of ['gold', 'gems', 'diamonds']) this.text(key, number(hero.currencies?.[key]));
    this.text('potions', finite(hero.potions));
    this.nodes['potion-button'].disabled = this.state !== 'playing' || !hero.potions || hp >= maxHp || hp <= 0;
    const globe = this.nodes['health-globe'];
    if (globe.style.getPropertyValue('--health') !== healthPercent) globe.style.setProperty('--health', healthPercent);
    if (this.nodes['xp-fill'].style.width !== xpPercent) this.nodes['xp-fill'].style.width = xpPercent;
    this.attr('health-globe', 'aria-valuenow', Math.ceil(hp)); this.attr('health-globe', 'aria-valuemax', Math.ceil(maxHp));
    this.attr('xp-meter', 'aria-valuenow', Math.min(xp, xpNeeded)); this.attr('xp-meter', 'aria-valuemax', xpNeeded);
    if (this.state === 'inventory') this.renderPanel();
    // Inventory is an explicit state; a paused flag must never replace it.
    if (this.state === 'playing' && paused) this.setState('paused');
    else if (this.state === 'paused' && paused === false) this.setState('playing');
  }

  renderPanel() {
    const hero = this.hero; if (!hero) return;
    const fingerprint = JSON.stringify([hero.classId, hero.level, hero.stats, hero.damage, hero.maxHp, hero.armor, hero.crit, hero.speed, hero.range, hero.attackSeconds, hero.equipment, hero.inventory]);
    if (fingerprint === this.inventoryFingerprint) return;
    this.inventoryFingerprint = fingerprint;
    const focused = document.activeElement?.dataset.actionKey;
    this.text('panel-title', `${CLASSES[hero.classId]?.name || 'Wanderer'} · Level ${hero.level || 1}`);
    this.text('inventory-count', `${hero.inventory?.length || 0} / 24`);
    const stats = this.nodes['hero-stats']; stats.replaceChildren();
    for (const [key, value] of Object.entries({ ...hero.stats, damage: hero.damage, maxHp: hero.maxHp, armor: hero.armor, crit: hero.crit, speed: hero.speed, range: hero.range, attackSeconds: hero.attackSeconds })) {
      const pair = element('div'); pair.append(element('dt', '', labels[key] || key), element('dd', '', valueText(key, value))); stats.append(pair);
    }
    this.nodes['equipment-list'].replaceChildren();
    for (const slot of ['weapon', 'armor']) {
      const item = hero.equipment?.[slot];
      if (item) this.nodes['equipment-list'].append(this.itemCard(item, true));
      else { const card = element('article', 'item-card empty-slot'); card.append(element('h4', '', `No ${slot} equipped`), element('p', '', 'Equip a find from your inventory.')); this.nodes['equipment-list'].append(card); }
    }
    this.nodes['inventory-list'].replaceChildren();
    for (const item of (hero.inventory || []).slice(0, 24)) this.nodes['inventory-list'].append(this.itemCard(item, false));
    if (!hero.inventory?.length) this.nodes['inventory-list'].append(element('p', 'empty-inventory', 'Your pack is empty. Fallen enemies may leave equipment behind.'));
    if (focused) {
      const replacement = [...this.nodes['inventory-overlay'].querySelectorAll('[data-action-key]')].find(node => node.dataset.actionKey === focused && !node.disabled);
      (replacement || this.nodes[`${this.activeTab}-tab`]).focus({ preventScroll: true });
    }
  }

  itemCard(item, equipped) {
    const rarity = RARITIES[item.rarity] || { name: item.rarity || 'Common', color: '#a7adb4' };
    const card = element('article', 'item-card'); card.style.setProperty('--rarity-color', rarity.color);
    card.append(element('p', 'item-meta', `${rarity.name} · ${item.slot} · Level ${item.level || 1}${item.classId ? ` · ${CLASSES[item.classId]?.name || item.classId}` : ''}`), element('h4', '', item.name));
    const modifiers = element('dl', 'item-modifiers');
    const current = this.hero.equipment?.[item.slot];
    const keys = new Set([...Object.keys(item.mods || {}), ...(!equipped ? Object.keys(current?.mods || {}) : [])]);
    for (const key of keys) {
      const value = finite(item.mods?.[key]), old = finite(current?.mods?.[key]);
      if (!value && (equipped || !old)) continue;
      const row = element('div'); row.append(element('dt', '', labels[key] || key), element('dd', '', `${value >= 0 ? '+' : ''}${valueText(key, value)}`));
      if (!equipped) {
        const delta = value - old;
        row.append(element('dd', `item-delta ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : ''}`, `${delta > 0 ? '+' : ''}${valueText(key, delta)} vs equipped`));
      }
      modifiers.append(row);
    }
    card.append(modifiers);
    const button = element('button', 'item-action', equipped ? 'Unequip' : 'Equip'); button.type = 'button';
    button.dataset.actionKey = equipped ? `unequip-${item.slot}` : `equip-${item.id}`;
    button.disabled = equipped && (this.hero.inventory?.length || 0) >= 24;
    if (button.disabled) button.title = 'Inventory full — equip a different item to swap.';
    button.addEventListener('click', () => equipped ? this.callbacks.onUnequip?.(item.slot) : this.callbacks.onEquip?.(item.id));
    card.append(button); return card;
  }

  setState(state) {
    if (!['ready', 'playing', 'paused', 'dead', 'inventory'].includes(state) || state === this.state) return;
    this.state = state; document.body.dataset.state = state;
    const playing = state === 'playing', inventory = state === 'inventory';
    this.nodes.modal.hidden = playing || inventory; this.nodes['inventory-overlay'].hidden = !inventory;
    this.nodes['pause-button'].disabled = !playing; this.nodes.hud.inert = !playing;
    document.getElementById('game').inert = !playing;
    if (playing) { document.getElementById('game').focus({ preventScroll: true }); return; }
    if (inventory) { this.renderPanel(); this.nodes[`${this.activeTab}-tab`].focus({ preventScroll: true }); return; }
    this.nodes['class-selection'].hidden = state === 'paused';
    const copy = {
      ready: ['A light where none remains', 'ASHEN VEIL', 'Beyond the iron gates, the graveyard stirs.\nChoose your calling. Carry a light into the dark.', 'Enter the graveyard', 'Click to move · C Character · I Inventory · Q Potion'],
      paused: ['A moment between shadows', 'THE VEIL WAITS', 'Rest your weapon, wanderer.\nThe graveyard will be here when you return.', 'Resume journey', 'Your journey is paused.'],
      dead: ['Even embers fall to ash', 'YOU HAVE FALLEN', 'The graveyard claims another name.\nChoose your calling and rise once more.', 'Rise again', 'A new journey begins beyond the gates.'],
    }[state];
    for (const [index, id] of ['modal-eyebrow', 'modal-title', 'modal-description', 'modal-action', 'modal-hint'].entries()) this.text(id, copy[index]);
    this.nodes['modal-description'].style.whiteSpace = 'pre-line'; this.nodes['modal-action'].focus({ preventScroll: true });
  }

  announce(text) {
    clearTimeout(this.announcementTimer); this.text('announcement', text);
    this.nodes.announcement.classList.toggle('visible', Boolean(text));
    if (text) this.announcementTimer = setTimeout(() => this.nodes.announcement.classList.remove('visible'), 2800);
  }
  text(id, value) { const text = String(value); if (this.nodes[id].textContent !== text) this.nodes[id].textContent = text; }
  attr(id, name, value) { const text = String(value); if (this.nodes[id].getAttribute(name) !== text) this.nodes[id].setAttribute(name, text); }
}
