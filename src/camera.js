import * as THREE from 'three';
export class FollowCamera {
  constructor(renderer) {
    this.renderer = renderer;
    this.camera = new THREE.OrthographicCamera(-16, 16, 10, -10, .1, 160);
    this.focus = new THREE.Vector3();
    // Elevation atan(26 / sqrt(12² + 12²)) = 56.9 degrees.
    this.offset = new THREE.Vector3(12, 26, 12);
    this.resize = () => {
      const aspect = innerWidth / innerHeight, height = 23;
      Object.assign(this.camera, { left: -height * aspect / 2, right: height * aspect / 2, top: height / 2, bottom: -height / 2 });
      this.camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    };
    window.addEventListener('resize', this.resize); this.resize(); this.update(this.focus, 1);
  }
  update(position, dt) {
    this.focus.lerp(position, 1 - Math.exp(-8 * dt));
    this.camera.position.copy(this.focus).add(this.offset);
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld();
  }
  dispose() { window.removeEventListener('resize', this.resize); }
}
