import * as THREE from 'three';

export class Engine {
  constructor(canvas, update, render) {
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch {
      this.renderer = new THREE.WebGLRenderer({ canvas });
    }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x121c20);
    this.scene.fog = new THREE.FogExp2(0x121c20, .025);
    // Fixed 60 Hz simulation makes attack timing independent of the display refresh rate.
    let previous = performance.now(), hiddenPrevious = previous, accumulator = 0;
    this.backgroundSimulation = false;
    const step = elapsed => {
      // A hidden tab may be timer-throttled for seconds; cap catch-up to avoid a
      // burst while still advancing wall-clock time when callbacks resume.
      accumulator = Math.min(accumulator + Math.max(0, elapsed), 5);
      while (accumulator >= 1 / 60) { update(1 / 60); accumulator -= 1 / 60; }
    };
    this.backgroundTimer = window.setInterval(() => {
      if (!document.hidden || !this.backgroundSimulation) return;
      const now = performance.now();
      step(Math.min(Math.max((now - hiddenPrevious) / 1000, 0), 5));
      hiddenPrevious = now;
    }, 100);
    this.renderer.setAnimationLoop(now => {
      const dt = Math.min(Math.max((now - previous) / 1000, 0), .25);
      previous = now;
      if (!document.hidden) {
        hiddenPrevious = now;
        step(dt);
      } else if (!this.backgroundSimulation) accumulator = 0;
      render(dt);
    });
  }
  setQuality(quality) {
    this.renderer.setPixelRatio(quality==='low'?1:Math.min(devicePixelRatio,1.5));
    const enabled=quality!=='low';
    if(this.renderer.shadowMap.enabled!==enabled){
      this.renderer.shadowMap.enabled=enabled;
      this.scene.traverse(object=>{if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>material.needsUpdate=true);});
    }
  }
  dispose() {
    this.renderer.setAnimationLoop(null);
    if (this.backgroundTimer) { window.clearInterval(this.backgroundTimer); this.backgroundTimer = null; }
    const geometries = new Set(), materials = new Set();
    this.scene.traverse(o => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m));
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    this.renderer.dispose();
  }
}
