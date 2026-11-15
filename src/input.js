import * as THREE from 'three';
export class Input {
  constructor(canvas, camera, onPause) {
    this.canvas = canvas; this.camera = camera; this.enabled = false;
    this.held = false; this.pending = false; this.attackHeld = false; this.hasPointer = false;
    this.pointer = new THREE.Vector2(); this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.point = new THREE.Vector3();
    this.abort = new AbortController();
    const listen = (target, event, fn) => target.addEventListener(event, fn, { signal: this.abort.signal });
    const pointer = e => {
      if (!this.enabled) return;
      const r = canvas.getBoundingClientRect();
      this.pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      this.hasPointer = true;
    };
    listen(canvas, 'pointerdown', e => {
      if (!this.enabled || ![0, 2].includes(e.button)) return;
      e.preventDefault(); pointer(e);
      if (e.button === 0) { this.held = true; this.pending = true; }
      if (e.button === 2) this.attackHeld = true;
      canvas.setPointerCapture(e.pointerId);
    });
    listen(canvas, 'pointermove', pointer);
    window.addEventListener('pointerup', e => { if (e.button === 0) this.held = false; if (e.button === 2) this.attackHeld = false; }, {capture:true, signal:this.abort.signal});
    listen(canvas, 'lostpointercapture', () => { this.held = false; this.attackHeld = false; });
    listen(window, 'pointercancel', () => this.clear());
    listen(window, 'blur', () => this.clear());
    listen(window, 'keydown', e => { if (e.code === 'Escape' && !e.repeat) { e.preventDefault(); this.clear(); onPause(); } });
    listen(canvas, 'contextmenu', e => e.preventDefault());
  }
  aimPoint() {
    if (!this.enabled || !this.hasPointer) return null;
    this.ray.setFromCamera(this.pointer, this.camera);
    return this.ray.ray.intersectPlane(this.plane, this.point);
  }
  destination() {
    if (!this.enabled || (!this.held && !this.pending)) return null;
    this.pending = false;
    return this.aimPoint();
  }
  setEnabled(enabled) { this.enabled = enabled; if (!enabled) this.clear(); }
  clear() { this.held = false; this.pending = false; this.attackHeld = false; this.hasPointer = false; }
  dispose() { this.abort.abort(); }
}
