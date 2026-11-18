import { CLASSES, RARITIES, slots, inventoryCapacity, inventoryExpansionCost } from './progression.js';
import { SKILLS } from './skills.js';
import { TALENTS, talentCost } from './talents.js';
import { saleValue, craftCost, rerollCost } from './economy.js';
import { LEGENDARIES, filterItems } from './items.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const labels = {
  strength: 'Strength', intelligence: 'Intelligence', dexterity: 'Dexterity', vitality: 'Vitality',
  damage: 'Damage', armor: 'Armor', life: 'Maximum life', maxHp: 'Maximum life',
  crit: 'Critical chance', speed: 'Movement speed', range: 'Attack range', attackSeconds: 'Attack interval'
};
const number = value => Number(finite(value).toFixed(2)).toLocaleString();
const valueText = (key, value) => `${number(value)}${key === 'crit' ? '%' : key === 'attackSeconds' ? 's' : ''}`;
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

// Skill icon asset mappings
const SKILL_ICONS = {
  warrior: ['warrior-sweep', 'warrior-slam', 'warrior-shout', 'warrior-cataclysm'],
  mage: ['mage-ember', 'mage-frost', 'mage-ward', 'mage-starfall'],
  archer: ['archer-volley', 'archer-snare', 'archer-barrage', 'archer-arrowstorm']
};

export class UI {
  constructor({ onStart, onRestart, onPause, onPanel, onBackgroundToggle, onEquip, onUnequip, onPotion, onContinue, onExport, onImport, onSaveStatus, onEconomy, onAutoSellChange }) {
    this.callbacks = { onStart, onRestart, onPause, onPanel, onBackgroundToggle, onEquip, onUnequip, onPotion, onContinue, onExport, onImport, onSaveStatus, onEconomy, onAutoSellChange };
    
    // Title screen actions
    document.getElementById('continue-game').onclick = () => onContinue?.(this.selectedClass);
    document.getElementById('export-save').onclick = () => onExport?.(this.selectedClass);
    document.getElementById('import-save').onclick = () => document.getElementById('save-file').click();
    document.getElementById('save-file').onchange = async event => {
      const file = event.target.files[0]; event.target.value = '';
      if (file) { await onImport?.(file, this.selectedClass); this.refreshSaves(); }
    };

    this.state = null;
    this.selectedClass = 'warrior';
    this.activeTab = 'character';
    this.hero = null;
    this.inventoryFingerprint = '';
    this.announcementTimer = null;
    this.shopAvailable = false;
    this.autoSell = { enabled: false, rarities: [], types: [], currency: 'gold' };

    // Cache core nodes
    this.nodes = Object.fromEntries([
      'hud', 'modal', 'modal-title', 'modal-eyebrow', 'modal-description', 'modal-action', 'modal-hint',
      'pause-button', 'background-toggle', 'health-globe', 'health-current', 'health-max', 'level', 'kills', 'enemy-count',
      'xp-text', 'xp-fill', 'xp-meter', 'announcement', 'class-selection', 'class-options',
      'character-button', 'inventory-button', 'shops-button', 'shops-tab', 'shops-panel', 'potion-button', 'potions', 'gold', 'gems', 'diamonds', 'dust', 'shards',
      'panel-status', 'panel-gold', 'panel-gems', 'panel-diamonds', 'panel-dust', 'panel-shards',
      'inventory-overlay', 'panel-title', 'panel-close', 'character-tab', 'inventory-tab',
      'events-button', 'events-tab', 'events-panel', 'journey-tab', 'journey-panel', 'character-panel', 'inventory-panel', 'hero-stats', 'equipment-list', 'inventory-list', 'inventory-count',
    ].map(id => [id, document.getElementById(id)]));

    for (const id of ['item-filter', 'item-sort']) {
      const el = document.getElementById(id);
      if (el) el.onchange = () => { this.inventoryFingerprint = ''; this.renderPanel(); };
    }

    this.buildClasses();
    this.buildAutoSell();
    this.initSettingsModal();
    this.initEmbers();

    // Prevent game canvas mouse events when clicking UI
    const interactiveRoots = [
      this.nodes.modal, this.nodes['inventory-overlay'], this.nodes['pause-button'],
      document.querySelector('.hero-controls'), document.querySelector('.combat-hud'),
      document.getElementById('settings-modal'), document.getElementById('hud-settings-btn')
    ].filter(Boolean);

    for (const root of interactiveRoots) {
      for (const type of ['pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'dblclick', 'contextmenu', 'click']) {
        root.addEventListener(type, event => event.stopPropagation());
      }
      root.addEventListener('keydown', event => {
        if (event.key === 'Tab' && ['ready', 'paused', 'dead', 'inventory'].includes(this.state)) this.trapFocus(event);
        const gameplayKey = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Space', 'KeyE'].includes(event.code);
        if (this.state === 'playing' && gameplayKey) { event.preventDefault(); return; }
        if ((event.key !== 'Escape' && event.target.matches('input, select, textarea')) || !['escape', 'c', 'i', 'b', 'j', 'q'].includes(event.key.toLowerCase())) event.stopPropagation();
      });
      root.addEventListener('keyup', event => event.stopPropagation());
    }

    this.nodes['pause-button']?.addEventListener('click', () => this.callbacks.onPause?.());
    this.nodes['background-toggle']?.addEventListener('click', () => this.callbacks.onBackgroundToggle?.());
    this.nodes['modal-action']?.addEventListener('click', () => {
      if (this.state === 'ready') this.callbacks.onStart?.(this.selectedClass);
      else if (this.state === 'dead') this.callbacks.onRestart?.(this.selectedClass);
      else if (this.state === 'paused') this.callbacks.onPause?.();
    });

    // Tab buttons
    for (const tab of ['character', 'inventory', 'shops', 'events', 'journey']) {
      const navBtn = this.nodes[`${tab}-button`];
      const tabEl = this.nodes[`${tab}-tab`];
      if (navBtn) navBtn.addEventListener('click', () => { this.selectTab(tab); this.callbacks.onPanel?.(); });
      if (tabEl) {
        tabEl.addEventListener('click', () => this.selectTab(tab));
        tabEl.addEventListener('keydown', event => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const tabs = ['character', 'inventory', 'shops', 'events', 'journey'].filter(t => this.nodes[`${t}-tab`]);
            const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : tabs[(tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
            this.selectTab(next); this.nodes[`${next}-tab`].focus();
          }
        });
      }
    }

    this.nodes['potion-button']?.addEventListener('click', () => this.callbacks.onPotion?.());
    this.nodes['panel-close']?.addEventListener('click', () => this.callbacks.onPanel?.());
    this.nodes['inventory-overlay']?.addEventListener('click', event => { if (event.target === this.nodes['inventory-overlay']) this.callbacks.onPanel?.(); });

    this.setState('ready');
  }

  initEmbers() {
    const canvas = document.getElementById('ember-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const particles = Array.from({ length: 35 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 1,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: -Math.random() * 0.7 - 0.3,
      alpha: Math.random() * 0.7 + 0.3,
      fade: Math.random() * 0.01 + 0.005
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.x += p.speedX;
        p.y += p.speedY;
        p.alpha -= p.fade;
        if (p.alpha <= 0 || p.y < -10) {
          p.x = Math.random() * width;
          p.y = height + 10;
          p.alpha = Math.random() * 0.7 + 0.3;
        }
        ctx.fillStyle = `rgba(255, 140, 50, ${p.alpha})`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#ff7a2f';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(render);
    };
    render();
  }

  initSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('settings-close');
    const panel = document.getElementById('settings-panel');
    const openBtns = [document.getElementById('modal-settings-btn'), document.getElementById('hud-settings-btn')].filter(Boolean);

    openBtns.forEach(btn => btn.addEventListener('click', (e) => {
      e.preventDefault();
      modal?.classList.remove('hidden');
      if (panel) panel.open = true;
    }));

    closeBtn?.addEventListener('click', () => {
      modal?.classList.add('hidden');
      if (panel) panel.open = false;
    });

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        if (panel) panel.open = false;
      }
    });

    if (panel) {
      panel.addEventListener('toggle', () => {
        if (panel.open) modal?.classList.remove('hidden');
        else modal?.classList.add('hidden');
      });

      let isOpen = panel.hasAttribute('open');
      Object.defineProperty(panel, 'open', {
        get() { return this.hasAttribute('open'); },
        set(val) {
          isOpen = Boolean(val);
          if (isOpen) {
            this.setAttribute('open', '');
            modal?.classList.remove('hidden');
          } else {
            this.removeAttribute('open');
            modal?.classList.add('hidden');
          }
        },
        configurable: true
      });
    }

    // UI Scale setting
    const scaleSlider = document.getElementById('ui-scale-setting');
    if (scaleSlider) {
      scaleSlider.addEventListener('input', (e) => {
        document.documentElement.style.setProperty('--ui-scale', e.target.value);
      });
    }
  }

  buildClasses() {
    const root = this.nodes['class-options'];
    if (!root) return;
    root.replaceChildren();

    const statProfiles = {
      warrior: { power: 85, defense: 95, speed: 45, attr: 'STRENGTH' },
      mage: { power: 95, defense: 50, speed: 65, attr: 'INTELLIGENCE' },
      archer: { power: 75, defense: 60, speed: 90, attr: 'DEXTERITY' }
    };

    for (const id of ['warrior', 'mage', 'archer']) {
      const cls = CLASSES[id];
      const stats = statProfiles[id];
      const card = element('label', `class-card ${id === this.selectedClass ? 'selected' : ''}`);
      card.dataset.class = id;

      const input = element('input');
      input.type = 'radio';
      input.name = 'hero-class';
      input.value = id;
      input.checked = id === this.selectedClass;

      input.addEventListener('change', () => {
        if (input.checked) {
          this.selectedClass = id;
          document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          this.refreshSaves();
        }
      });

      card.addEventListener('click', () => {
        input.checked = true;
        input.dispatchEvent(new Event('change'));
      });

      // Portrait Image
      const portraitWrap = element('div', 'class-portrait-wrap');
      const img = element('img', 'class-portrait');
      img.src = `./assets/classes/${id}-portrait.png`;
      img.alt = cls.name;
      portraitWrap.append(img);

      // Name & Description
      const name = element('h3', 'class-card-name font-serif', cls.name);
      const desc = element('p', 'class-card-desc', cls.description);

      // Primary Attribute Chip
      const chip = element('span', `class-attribute-chip attr-${cls.primary}`, `${stats.attr} · ${cls.range > 3 ? 'RANGED' : 'MELEE'}`);

      // Stat Bars
      const statBars = element('div', 'class-stat-bars');
      for (const [sLabel, sVal] of [['PWR', stats.power], ['DEF', stats.defense], ['SPD', stats.speed]]) {
        const row = element('div', 'stat-bar-row');
        row.append(element('span', 'stat-bar-label', sLabel));
        const track = element('div', 'stat-track');
        const fill = element('div', `stat-fill fill-${id}`);
        fill.style.width = `${sVal}%`;
        track.append(fill);
        row.append(track);
        statBars.append(row);
      }

      card.append(input, portraitWrap, name, desc, chip, statBars);
      root.append(card);
    }
  }

  buildAutoSell() {
    for (const [group, values] of Object.entries({ rarities: ['common', 'magic', 'rare', 'legendary'], types: ['sword', 'staff', 'bow', 'armor', 'helm', 'gloves', 'boots', 'ring'] })) {
      const root = document.getElementById(`auto-sell-${group}`);
      if (!root) continue;
      for (const value of values) {
        const label = element('label'), input = element('input');
        input.type = 'checkbox'; input.value = value; input.name = `auto-sell-${group}`;
        label.append(input, document.createTextNode(` ${value[0].toUpperCase()}${value.slice(1)}`)); root.append(label);
      }
    }
    document.getElementById('auto-sell-controls')?.addEventListener('change', () => {
      const selected = group => [...document.querySelectorAll(`input[name="auto-sell-${group}"]:checked`)].map(input => input.value);
      const config = { enabled: document.getElementById('auto-sell-enabled')?.checked, rarities: selected('rarities'), types: selected('types'), currency: document.getElementById('auto-sell-currency')?.value };
      this.setAutoSell(config);
      this.callbacks.onAutoSellChange?.({ ...config, rarities: [...config.rarities], types: [...config.types] });
    });
    this.setAutoSell(this.autoSell);
  }

  setAutoSell(config = {}) {
    this.autoSell = { enabled: Boolean(config.enabled), rarities: Array.isArray(config.rarities) ? [...config.rarities] : [], types: Array.isArray(config.types) ? [...config.types] : [], currency: ['gold', 'gems', 'diamonds'].includes(config.currency) ? config.currency : 'gold' };
    const enabledInput = document.getElementById('auto-sell-enabled');
    if (enabledInput) enabledInput.checked = this.autoSell.enabled;
    for (const group of ['rarities', 'types']) {
      for (const input of document.querySelectorAll(`input[name="auto-sell-${group}"]`)) input.checked = this.autoSell[group].includes(input.value);
    }
    const currEl = document.getElementById('auto-sell-currency');
    if (currEl) currEl.value = this.autoSell.currency;
    const sumEl = document.getElementById('auto-sell-summary');
    if (sumEl) sumEl.textContent = this.autoSell.enabled ? 'On · Automation only' : 'Off';
  }

  setShopAvailable(available) {
    const next = Boolean(available);
    const shopAvail = document.getElementById('shop-availability');
    if (shopAvail) {
      shopAvail.textContent = next ? 'Ember Refuge services are open. Buy supplies, forge gear and manage your stash.' : 'Services unavailable here. Return to Ember Refuge using Journey to buy, forge, sell, salvage or use your stash.';
    }
    if (this.shopAvailable === next) return;
    this.shopAvailable = next;
    this.inventoryFingerprint = '';
    this.renderPanel();
  }

  refreshSaves() {
    const saved = this.callbacks.onSaveStatus?.(this.selectedClass);
    const saveCard = document.getElementById('save-card-preview');
    const continueBtn = document.getElementById('continue-game');
    const exportBtn = document.getElementById('export-save');
    const saveStatus = document.getElementById('save-status');

    if (continueBtn) continueBtn.disabled = !saved?.ok;
    if (exportBtn) exportBtn.disabled = !saved?.ok;

    if (saved?.ok) {
      if (saveCard) saveCard.hidden = false;
      this.text('save-card-class', CLASSES[this.selectedClass]?.name || 'Wanderer');
      this.text('save-card-level', saved.value.hero.level);
      if (saveStatus) saveStatus.textContent = saved.recovered ? 'Backup recovered' : 'Saved character ready';
    } else {
      if (saveCard) saveCard.hidden = true;
      if (saveStatus) saveStatus.textContent = 'No saved character for this calling.';
    }
  }

  trapFocus(event) {
    const root = this.state === 'inventory' ? this.nodes['inventory-overlay'] : this.nodes.modal;
    if (!root) return;
    const controls = [...root.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]')]
      .filter(node => node.tabIndex >= 0 && !node.closest('[hidden]') && (node.type !== 'radio' || node.checked));
    const first = controls[0], last = controls.at(-1);
    if (!first) return;
    if (!root.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    }
  }

  selectTab(tab) {
    const validTabs = ['character', 'inventory', 'shops', 'events', 'journey'];
    if (!validTabs.includes(tab)) return;
    this.activeTab = tab;

    for (const id of validTabs) {
      const panel = this.nodes[`${id}-panel`];
      const tabBtn = this.nodes[`${id}-tab`];
      if (panel) panel.hidden = tab !== id;
      if (tabBtn) {
        tabBtn.setAttribute('aria-selected', String(tab === id));
        tabBtn.tabIndex = tab === id ? 0 : -1;
      }
    }
  }

  update(hero, kills, enemyCount, paused) {
    if (!hero) return;
    this.hero = hero;

    // Resource Orb
    const maxResource = Math.max(1, finite(hero.maxResource, 100));
    const currentResource = Math.max(0, Math.min(maxResource, finite(hero.resource, 100)));
    const resPercent = `${(currentResource / maxResource) * 100}%`;
    const resLiquid = document.getElementById('resource-liquid');
    if (resLiquid) {
      resLiquid.style.height = resPercent;
      // Per-class resource color
      if (hero.classId === 'mage') resLiquid.style.background = 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 50%, #4c1d95 100%)';
      else if (hero.classId === 'archer') resLiquid.style.background = 'linear-gradient(180deg, #6ee7b7 0%, #059669 50%, #064e3b 100%)';
      else resLiquid.style.background = 'linear-gradient(180deg, #fdba74 0%, #ea580c 50%, #7c2d12 100%)';
    }
    this.text('resource', Math.floor(currentResource));

    // Update Skill Icons & Cooldown Sweeps
    const skillList = SKILLS[hero.classId] || [];
    const iconNames = SKILL_ICONS[hero.classId] || SKILL_ICONS.warrior;

    document.querySelectorAll('[data-skill]').forEach((button, index) => {
      const s = skillList[index];
      if (!s) return;
      const remaining = hero.skillCooldowns?.[s.id] ?? 0;
      const iconImg = button.querySelector('img');
      if (iconImg && iconNames[index]) {
        const targetSrc = `./assets/icons/skills/${iconNames[index]}.png`;
        if (!iconImg.src.endsWith(targetSrc)) iconImg.src = targetSrc;
      }

      button.title = `${s.name} (${s.cost} Resolve · ${s.cooldown}s CD)\n${s.telegraph}`;
      button.disabled = this.state !== 'playing' || remaining > 0 || currentResource < s.cost;

      const sweep = button.querySelector('.cooldown-sweep');
      const secLabel = button.querySelector('.cooldown-seconds');
      if (remaining > 0) {
        if (sweep) sweep.hidden = false;
        if (secLabel) { secLabel.hidden = false; secLabel.textContent = remaining.toFixed(1); }
      } else {
        if (sweep) sweep.hidden = true;
        if (secLabel) secLabel.hidden = true;
      }
    });

    // Dodge Button Cooldown
    const dodgeBtn = document.getElementById('dodge-button');
    if (dodgeBtn) {
      const dodgeSweep = dodgeBtn.querySelector('.cooldown-sweep');
      const dodgeSec = dodgeBtn.querySelector('.cooldown-seconds');
      if (hero.dodgeCooldown > 0) {
        if (dodgeSweep) dodgeSweep.hidden = false;
        if (dodgeSec) { dodgeSec.hidden = false; dodgeSec.textContent = hero.dodgeCooldown.toFixed(1); }
      } else {
        if (dodgeSweep) dodgeSweep.hidden = true;
        if (dodgeSec) dodgeSec.hidden = true;
      }
    }

    // Health Globe
    const maxHp = Math.max(1, finite(hero.maxHp, 100));
    const hp = Math.max(0, Math.min(maxHp, finite(hero.hp)));
    const xpNeeded = Math.max(1, finite(hero.xpNeeded, 100));
    const xp = Math.max(0, finite(hero.xp));
    const healthPercent = `${(hp / maxHp) * 100}%`;
    const xpPercent = `${Math.min(1, xp / xpNeeded) * 100}%`;

    this.text('health-current', Math.ceil(hp));
    this.text('health-max', `/ ${Math.ceil(maxHp)}`);
    this.text('level', Math.max(1, Math.floor(finite(hero.level, 1))));
    this.text('kills', Math.max(0, Math.floor(finite(kills))));
    this.text('enemy-count', Math.max(0, Math.floor(finite(enemyCount))));
    this.text('xp-text', `${Math.floor(xp)} / ${Math.floor(xpNeeded)} XP (${Math.round((xp / xpNeeded) * 100)}%)`);

    const globe = this.nodes['health-globe'];
    if (globe) {
      globe.style.setProperty('--health', healthPercent);
      globe.classList.toggle('low-health', (hp / maxHp) < 0.25);
    }
    if (this.nodes['xp-fill']) this.nodes['xp-fill'].style.width = xpPercent;

    // Currencies
    for (const key of ['gold', 'gems', 'diamonds', 'dust', 'shards']) {
      const val = number(['dust', 'shards'].includes(key) ? hero[key] : hero.currencies?.[key]);
      this.text(key, val);
      this.text(`panel-${key}`, val);
    }

    // Potion Button
    this.text('potions', finite(hero.potions));
    if (this.nodes['potion-button']) {
      this.nodes['potion-button'].disabled = this.state !== 'playing' || !hero.potions || hp >= maxHp || hp <= 0 || hero.potionCooldown > 0;
    }

    // Hero title
    this.text('hero-class-label', CLASSES[hero.classId]?.name || 'Warrior');

    if (this.state === 'inventory') this.renderPanel();
    if (this.state === 'playing' && paused) this.setState('paused');
    else if (this.state === 'paused' && paused === false) this.setState('playing');
  }

  renderPanel() {
    const hero = this.hero;
    if (!hero) return;

    const fingerprint = JSON.stringify([hero.classId, hero.level, hero.stats, hero.damage, hero.maxHp, hero.armor, hero.crit, hero.speed, hero.range, hero.attackSeconds, hero.equipment, hero.inventory, hero.stash, hero.talents, hero.talentPoints, hero.statPoints, hero.currencies, hero.inventoryCapacity]);
    if (fingerprint === this.inventoryFingerprint) return;
    this.inventoryFingerprint = fingerprint;

    const focused = document.activeElement?.dataset.actionKey;
    this.text('panel-title', `${CLASSES[hero.classId]?.name || 'Wanderer'} · Level ${hero.level || 1}`);
    this.text('inventory-count', `${hero.inventory?.length || 0} / ${inventoryCapacity(hero)}`);

    // 1. Primary Attributes
    this.text('attr-strength-val', hero.stats?.strength ?? 10);
    this.text('attr-intelligence-val', hero.stats?.intelligence ?? 10);
    this.text('attr-dexterity-val', hero.stats?.dexterity ?? 10);
    this.text('attr-vitality-val', hero.stats?.vitality ?? 10);

    // 2. Combat Stats
    const stats = this.nodes['hero-stats'];
    if (stats) {
      stats.replaceChildren();
      for (const [key, value] of Object.entries({ damage: hero.damage, armor: hero.armor, maxHp: hero.maxHp, crit: hero.crit, speed: hero.speed, range: hero.range, attackSeconds: hero.attackSeconds })) {
        const pair = element('div', 'combat-stat-row');
        pair.append(element('dt', '', labels[key] || key), element('dd', 'tabular', valueText(key, value)));
        stats.append(pair);
      }
    }

    // 3. Visual Talent Tree
    const talentRoot = document.getElementById('talent-list');
    if (talentRoot) {
      talentRoot.replaceChildren();
      this.text('talent-points-chip', `${hero.talentPoints ?? 0} Points Available`);

      const classTalents = TALENTS[hero.classId] || [];
      classTalents.forEach(node => {
        const rank = hero.talents?.[node.id] ?? 0;
        const card = element('div', `talent-card ${rank > 0 ? 'learned' : ''}`);

        const info = element('div', 'talent-card-info');
        const title = element('h5', '', `${node.name} ${rank}/${node.maxRank}`);
        const desc = element('p', 'talent-desc', node.description || `+${node.value} ${node.stat} per rank`);
        info.append(title, desc);

        const actions = element('div', 'talent-actions');
        const canLearn = rank < node.maxRank && (hero.talentPoints ?? 0) > 0;
        const learnBtn = element('button', 'btn-primary talent-btn', `Learn · ${talentCost(hero, node.id)} pts`);
        learnBtn.type = 'button';
        learnBtn.disabled = !canLearn;
        learnBtn.onclick = () => this.callbacks.onEconomy?.('learn', node.id);
        actions.append(learnBtn);

        if (this.shopAvailable && rank > 0) {
          const refundBtn = element('button', 'btn-secondary talent-btn', 'Refund');
          refundBtn.type = 'button';
          refundBtn.onclick = () => this.callbacks.onEconomy?.('refund', node.id);
          actions.append(refundBtn);
        }

        card.append(info, actions);
        talentRoot.append(card);
      });
    }

    // 4. Paperdoll Equipment Slots Update
    for (const slot of slots) {
      const slotEl = document.querySelector(`.equip-slot[data-slot="${slot}"]`);
      if (slotEl) {
        const item = hero.equipment?.[slot];
        if (item) {
          const rarity = RARITIES[item.rarity] || { color: '#a7adb4', name: 'Common' };
          slotEl.style.setProperty('--rarity-color', rarity.color);
          slotEl.title = `${item.name} (${rarity.name} ${slot})\nClick to Unequip`;
          slotEl.onclick = () => this.callbacks.onUnequip?.(slot);
        } else {
          slotEl.style.removeProperty('--rarity-color');
          slotEl.title = `No ${slot} equipped`;
          slotEl.onclick = null;
        }
      }
    }

    // 5. Merchant & Forge Shop
    const shop = document.getElementById('merchant-list');
    if (shop) {
      shop.replaceChildren();
      const command = (root, label, op, id) => {
        const b = element('button', 'btn-secondary', label);
        b.type = 'button';
        b.dataset.actionKey = `${op}-${id ?? 'all'}`;
        b.onclick = () => this.callbacks.onEconomy?.(op, id);
        if (['buy', 'retrieve', 'refund', 'salvageAll'].includes(op) && !this.shopAvailable) {
          b.disabled = true;
          b.title = 'Return to Ember Refuge to use this service.';
        }
        root.append(b);
      };

      command(shop, inventoryCapacity(hero) >= 500 ? 'Pack Maximum · 500 Slots' : `Expand Pack +${Math.min(4, 500 - inventoryCapacity(hero))} Slots · ${inventoryExpansionCost(hero)} Gold`, 'expandInventory');
      shop.lastElementChild.id = 'expand-inventory';
      shop.lastElementChild.disabled = inventoryCapacity(hero) >= 500 || hero.currencies.gold < inventoryExpansionCost(hero);

      command(shop, 'Salvage Unfavorited Gear', 'salvageAll');
      shop.lastElementChild.id = 'salvage-unfavorited';
      shop.lastElementChild.disabled = !this.shopAvailable || !hero.inventory.some(item => !item.favorite && item.rarity !== 'legendary');

      for (const slot of ['potion', ...slots]) {
        command(shop, `Buy ${slot[0].toUpperCase() + slot.slice(1)} · ${slot === 'potion' ? 35 : 120 * hero.level} Gold`, 'buy', slot);
      }
    }

    // 6. Stash List
    const stash = document.getElementById('stash-list');
    if (stash) {
      stash.replaceChildren();
      for (const item of hero.stash ?? []) {
        const b = element('button', 'btn-secondary', `Retrieve ${item.name}`);
        b.onclick = () => this.callbacks.onEconomy?.('retrieve', item.id);
        stash.append(b);
      }
      if (!hero.stash?.length) {
        stash.append(element('p', 'panel-help', 'Stash is empty. Store items from your Inventory.'));
      }
    }

    // 7. Inventory List
    const invList = this.nodes['inventory-list'];
    if (invList) {
      invList.replaceChildren();
      const filterVal = document.getElementById('item-filter')?.value || 'all';
      const sortVal = document.getElementById('item-sort')?.value || 'rarity';
      const filtered = filterItems(hero.inventory || [], filterVal, sortVal).slice(0, inventoryCapacity(hero));

      for (const item of filtered) {
        invList.append(this.itemCard(item, false));
      }
      if (!hero.inventory?.length) {
        invList.append(element('p', 'empty-inventory', 'Your pack is empty. Fallen foes may leave equipment behind.'));
      }
    }

    // Restore active focus if present
    if (focused) {
      const replacement = [...this.nodes['inventory-overlay'].querySelectorAll('[data-action-key]')].find(node => node.dataset.actionKey === focused && !node.disabled);
      (replacement || this.nodes[`${this.activeTab}-tab`])?.focus({ preventScroll: true });
    }
  }

  itemCard(item, equipped) {
    const rarity = RARITIES[item.rarity] || { name: item.rarity || 'Common', color: '#9aa3a6' };
    const card = element('article', 'item-card');
    card.style.setProperty('--rarity-color', rarity.color);

    const meta = element('p', 'item-meta', `${rarity.name} · ${item.slot} · Level ${item.level || 1}`);
    const title = element('h4', 'item-title', item.name);
    card.append(meta, title);

    const modifiers = element('dl', 'item-modifiers');
    const current = this.hero.equipment?.[item.slot];
    const keys = new Set([...Object.keys(item.mods || {}), ...(!equipped ? Object.keys(current?.mods || {}) : [])]);

    for (const key of keys) {
      const value = finite(item.mods?.[key]), old = finite(current?.mods?.[key]);
      if (!value && (equipped || !old)) continue;
      const row = element('div', 'item-mod-row');
      row.append(element('dt', '', labels[key] || key), element('dd', '', `${value >= 0 ? '+' : ''}${valueText(key, value)}`));
      if (!equipped) {
        const delta = value - old;
        row.append(element('dd', `item-delta ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : ''}`, `${delta > 0 ? '+' : ''}${valueText(key, delta)}`));
      }
      modifiers.append(row);
    }
    card.append(modifiers);

    if (item.legendary) card.append(element('p', 'legendary-property', LEGENDARIES[item.legendary]));
    if (item.upgrades) card.append(element('p', 'eyebrow', `Forged +${item.upgrades}`));

    const actionsRow = element('div', 'item-actions-row');
    const equipBtn = element('button', 'btn-secondary', equipped ? 'Unequip' : 'Equip');
    equipBtn.type = 'button';
    equipBtn.dataset.actionKey = equipped ? `unequip-${item.slot}` : `equip-${item.id}`;
    equipBtn.disabled = equipped && (this.hero.inventory?.length || 0) >= inventoryCapacity(this.hero);
    equipBtn.onclick = () => equipped ? this.callbacks.onUnequip?.(item.slot) : this.callbacks.onEquip?.(item.id);
    actionsRow.append(equipBtn);

    if (!equipped) {
      const cost = craftCost(item);
      for (const [op, label] of [
        ['favorite', item.favorite ? 'Unfavorite' : 'Favorite'],
        ['stash', 'Store'],
        ['sell', `Sell · ${saleValue(item)}g`],
        ['salvage', 'Salvage'],
        ['upgrade', `Upgrade +${(item.upgrades ?? 0) + 1}`],
        ['reroll', `Reroll · ${rerollCost(item).gold}g`],
        ['delete', 'Delete permanently']
      ]) {
        const action = element('button', `btn-secondary ${op === 'delete' ? 'delete-action' : ''}`, label);
        action.type = 'button';
        action.dataset.actionKey = `${op}-${item.id}`;
        action.onclick = () => this.callbacks.onEconomy?.(op, item.id);
        if (['stash', 'sell', 'salvage', 'upgrade', 'reroll'].includes(op) && !this.shopAvailable) {
          action.disabled = true;
          action.title = 'Return to Ember Refuge to use this service.';
        }
        if (item.favorite && ['sell', 'salvage', 'delete'].includes(op)) {
          action.disabled = true;
          action.title = 'Unfavorite this item first.';
        }
        actionsRow.append(action);
      }
    }

    card.append(actionsRow);
    return card;
  }

  setBackgroundAutomation(enabled) {
    const button = this.nodes['background-toggle'];
    if (!button) return;
    button.setAttribute('aria-pressed', String(Boolean(enabled)));
    button.textContent = enabled ? 'Running in background' : 'Run in background';
  }

  setMode(mode) {
    const automatic = mode === 'automation';
    const button = document.getElementById('mode-toggle');
    if (button) {
      button.setAttribute('aria-pressed', String(automatic));
      const span = button.querySelector('span:last-child');
      if (span) span.textContent = automatic ? 'MANUAL PLAY' : 'AUTO-PLAY';
    }
    const eyebrow = document.getElementById('mode-instruction-eyebrow');
    if (eyebrow) {
      eyebrow.textContent = automatic ? 'Automation pursues foes and loot' : 'Steel answers the darkness';
    }
  }

  setTeleport(remaining, destination) {
    const node = document.getElementById('teleport-status');
    if (!node) return;
    node.textContent = `Traveling to ${destination} · ${Math.ceil(remaining)}s`;
  }

  setState(state) {
    if (!['ready', 'playing', 'paused', 'dead', 'inventory', 'teleporting'].includes(state) || state === this.state) return;
    this.state = state;
    document.body.dataset.state = state;
    this.refreshSaves();

    const playing = state === 'playing', inventory = state === 'inventory';
    if (this.nodes.modal) this.nodes.modal.hidden = playing || inventory || state === 'teleporting';
    if (this.nodes['inventory-overlay']) this.nodes['inventory-overlay'].hidden = !inventory;
    const teleport = document.getElementById('teleport-status');
    if (teleport) teleport.hidden = state !== 'teleporting';

    const modeToggle = document.getElementById('mode-toggle');
    if (modeToggle) modeToggle.disabled = !playing;
    if (this.nodes['pause-button']) this.nodes['pause-button'].disabled = !playing;
    if (this.nodes['background-toggle']) this.nodes['background-toggle'].disabled = !playing;
    if (this.nodes.hud) this.nodes.hud.inert = !playing;
    const gameCanvas = document.getElementById('game');
    if (gameCanvas) gameCanvas.inert = !playing;

    if (state === 'teleporting') { document.activeElement?.blur(); return; }
    if (playing) { gameCanvas?.focus({ preventScroll: true }); return; }
    if (inventory) { this.renderPanel(); this.nodes[`${this.activeTab}-tab`]?.focus({ preventScroll: true }); return; }

    if (this.nodes['class-selection']) this.nodes['class-selection'].hidden = state !== 'ready';

    const copy = {
      ready: ['A light where none remains', 'ASHEN VEIL', 'Choose your calling and begin in Ember Refuge.\nOpen Character to travel, track quests and claim rewards. Defeat three guardians to unlock expeditions.', 'Begin journey', 'Manual: left click to move · Hold right mouse to attack · E Interact · 1/2/3/4 Skills · Space Dodge · C Character · I Inventory · B Shops · Q Potion'],
      paused: ['A moment between shadows', 'THE VEIL WAITS', 'Rest your weapon, wanderer.\nThe world will be here when you return.', 'Resume journey', 'Your journey is paused.'],
      dead: ['Even embers fall to ash', 'YOU HAVE FALLEN', 'Return to Ember Refuge with your equipment and progress intact.\nDeath costs 10% of carried gold, up to 500 gold.', 'Return to refuge', 'Active encounters and expedition progress reset.'],
    }[state];

    if (copy) {
      for (const [index, id] of ['modal-eyebrow', 'modal-title', 'modal-description', 'modal-action', 'modal-hint'].entries()) {
        this.text(id, copy[index]);
      }
    }

    if (this.nodes['modal-action']) this.nodes['modal-action'].focus({ preventScroll: true });
  }

  announce(text) {
    clearTimeout(this.announcementTimer);
    this.text('announcement', text);
    this.text('panel-status', text);
    if (this.nodes['panel-status']) this.nodes['panel-status'].hidden = !text;
    if (this.nodes.announcement) {
      this.nodes.announcement.classList.toggle('visible', Boolean(text));
      if (text) this.announcementTimer = setTimeout(() => this.nodes.announcement.classList.remove('visible'), 2800);
    }
  }

  text(id, value) {
    const el = document.getElementById(id);
    const text = String(value);
    if (el && el.textContent !== text) el.textContent = text;
  }

  attr(id, name, value) {
    const el = document.getElementById(id);
    const text = String(value);
    if (el && el.getAttribute(name) !== text) el.setAttribute(name, text);
  }
}
