import * as THREE from 'three';
export class Input {
  constructor(canvas, camera, onPause) {
    this.canvas = canvas; this.camera = camera;
    this.held = false; this.pending = false;
    this.pointer = new THREE.Vector2(); this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.point = new THREE.Vector3();
    this.abort = new AbortController();
    const listen = (target, event, fn) => target.addEventListener(event, fn, { signal: this.abort.signal });
    const pointer = e => {
      const r = canvas.getBoundingClientRect();
      this.pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    };
    listen(canvas, 'pointerdown', e => {
      if (e.button !== 0) return;
      pointer(e); this.held = true; this.pending = true;
      canvas.setPointerCapture(e.pointerId);
    });
    listen(canvas, 'pointermove', pointer);
    listen(window, 'pointerup', () => { this.held = false; });
    listen(canvas, 'lostpointercapture', () => { this.held = false; });
    listen(window, 'blur', () => this.clear());
    listen(window, 'keydown', e => { if (e.code === 'Escape' && !e.repeat) { e.preventDefault(); this.clear(); onPause(); } });
    listen(canvas, 'contextmenu', e => e.preventDefault());
  }
  destination() {
    if (!this.held && !this.pending) return null;
    this.pending = false;
    this.ray.setFromCamera(this.pointer, this.camera);
    return this.ray.ray.intersectPlane(this.plane, this.point);
  }
  clear() { this.held = false; this.pending = false; }
  dispose() { this.abort.abort(); }
}
