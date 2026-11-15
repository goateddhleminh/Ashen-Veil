// Presentation only: callbacks leave simulation and state ownership in main.js.
export class UI {
  constructor({ onStart, onRestart, onPause }) {
    this.callbacks = { onStart, onRestart, onPause };
    this.state = null;
    this.announcementTimer = null;
    this.nodes = Object.fromEntries([
      'hud', 'modal', 'modal-title', 'modal-eyebrow', 'modal-description',
      'modal-action', 'modal-hint', 'pause-button', 'health-globe',
      'health-current', 'health-max', 'level', 'kills', 'enemy-count',
      'xp-text', 'xp-fill', 'xp-meter', 'announcement',
    ].map(id => [id, document.getElementById(id)]));

    // Swallow control input before it reaches document-level world listeners.
    // Do not prevent pointer defaults: native button focus and click stay intact.
    for (const root of [this.nodes.modal, this.nodes['pause-button']]) {
      for (const type of ['pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'dblclick', 'contextmenu']) {
        root.addEventListener(type, event => event.stopPropagation());
      }
      root.addEventListener('keydown', event => {
        if (event.key === 'Tab' && this.state !== 'playing') {
          event.preventDefault();
          this.nodes['modal-action'].focus();
        }
        // Escape remains available to the game's pause shortcut.
        if (event.key !== 'Escape') event.stopPropagation();
      });
      root.addEventListener('keyup', event => event.stopPropagation());
    }
    this.nodes.modal.addEventListener('click', event => event.stopPropagation());
    this.nodes['pause-button'].addEventListener('click', event => {
      event.stopPropagation();
      this.callbacks.onPause?.();
    });
    this.nodes['modal-action'].addEventListener('click', event => {
      event.stopPropagation();
      if (this.state === 'ready') this.callbacks.onStart?.();
      else if (this.state === 'dead') this.callbacks.onRestart?.();
      else if (this.state === 'paused') this.callbacks.onPause?.();
    });
    this.setState('ready');
  }

  update(hero, kills, enemyCount, paused) {
    if (!hero) return;
    const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
    const maxHp = Math.max(1, finite(hero.maxHp, 100));
    const hp = Math.max(0, Math.min(maxHp, finite(hero.hp)));
    const xpNeeded = Math.max(1, finite(hero.xpNeeded, 100));
    const xp = Math.max(0, finite(hero.xp));
    const healthPercent = `${(hp / maxHp) * 100}%`;
    const xpPercent = `${Math.min(1, xp / xpNeeded) * 100}%`;
    // Cache DOM values: main can call update every frame without rewriting the HUD.
    this.text('health-current', Math.ceil(hp));
    this.text('health-max', `/ ${Math.ceil(maxHp)}`);
    this.text('level', Math.max(1, Math.floor(finite(hero.level, 1))));
    this.text('kills', Math.max(0, Math.floor(finite(kills))));
    this.text('enemy-count', Math.max(0, Math.floor(finite(enemyCount))));
    this.text('xp-text', `${Math.floor(xp)} / ${Math.floor(xpNeeded)}`);
    const globe = this.nodes['health-globe'];
    if (globe.style.getPropertyValue('--health') !== healthPercent) globe.style.setProperty('--health', healthPercent);
    if (this.nodes['xp-fill'].style.width !== xpPercent) this.nodes['xp-fill'].style.width = xpPercent;
    this.attr('health-globe', 'aria-valuenow', Math.ceil(hp));
    this.attr('health-globe', 'aria-valuemax', Math.ceil(maxHp));
    this.attr('xp-meter', 'aria-valuenow', Math.min(xp, xpNeeded));
    this.attr('xp-meter', 'aria-valuemax', xpNeeded);
    // Respect explicit ready/dead states; only sync pause during an active run.
    if (this.state === 'playing' && paused) this.setState('paused');
    else if (this.state === 'paused' && paused === false) this.setState('playing');
  }

  setState(state) {
    if (!['ready', 'playing', 'paused', 'dead'].includes(state) || state === this.state) return;
    this.state = state;
    document.body.dataset.state = state;
    const playing = state === 'playing';
    this.nodes.modal.hidden = playing;
    this.nodes['pause-button'].disabled = !playing;
    this.nodes.hud.inert = !playing;
    if (playing) {
      document.getElementById('game').focus({ preventScroll: true });
      return;
    }
    const copy = {
      ready: ['A light where none remains', 'ASHEN VEIL', 'Beyond the iron gates, the graveyard stirs.\nThe nameless dead rise beneath an ashen sky.\nCarry your steel into the dark. Let them rest.', 'Enter the graveyard', 'Click to move. Your blade knows the rest.'],
      paused: ['A moment between shadows', 'THE VEIL WAITS', 'Rest your blade, wanderer.\nThe graveyard will be here when you return.', 'Resume journey', 'Your journey is paused.'],
      dead: ['Even embers fall to ash', 'YOU HAVE FALLEN', 'The graveyard claims another name.\nRise once more. The darkness is not yet done.', 'Rise again', 'A new journey begins beyond the gates.'],
    }[state];
    this.text('modal-eyebrow', copy[0]);
    this.text('modal-title', copy[1]);
    this.text('modal-description', copy[2]);
    this.nodes['modal-description'].style.whiteSpace = 'pre-line';
    this.text('modal-action', copy[3]);
    this.text('modal-hint', copy[4]);
    this.nodes['modal-action'].focus({ preventScroll: true });
  }

  announce(text) {
    clearTimeout(this.announcementTimer);
    this.text('announcement', text);
    this.nodes.announcement.classList.toggle('visible', Boolean(text));
    if (text) this.announcementTimer = setTimeout(() => this.nodes.announcement.classList.remove('visible'), 2800);
  }

  text(id, value) {
    const text = String(value);
    if (this.nodes[id].textContent !== text) this.nodes[id].textContent = text;
  }

  attr(id, name, value) {
    const text = String(value);
    if (this.nodes[id].getAttribute(name) !== text) this.nodes[id].setAttribute(name, text);
  }
}
