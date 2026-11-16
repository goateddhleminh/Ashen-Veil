import * as THREE from 'three';
export class FollowCamera {
  constructor(renderer) {
    this.renderer = renderer; this.shakeTime=0;this.shakeIntensity=0;this.shakePhase=0;this.reducedMotion=false;
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
  shake(intensity = .35, duration = .15) {
    if(this.reducedMotion)return;
    this.shakeIntensity=Math.min(.65,Math.max(this.shakeIntensity,intensity));this.shakeTime=Math.max(this.shakeTime,Math.min(.15,duration));
  }
  update(position, dt) {
    this.focus.lerp(position, 1 - Math.exp(-8 * dt));
    this.camera.position.copy(this.focus).add(this.offset);
    this.camera.lookAt(this.focus);
    this.shakeTime=this.reducedMotion?0:Math.max(0,this.shakeTime-dt);
    if(this.shakeTime>0){
      this.shakePhase+=dt*40;const amount=this.shakeIntensity*(this.shakeTime/.15)**2;
      this.camera.position.x+=Math.sin(this.shakePhase*1.7)*amount;this.camera.position.z+=Math.sin(this.shakePhase*2.3)*amount;
    }else this.shakeIntensity=0;
    this.camera.updateMatrixWorld();
  }
  dispose() { window.removeEventListener('resize', this.resize); }
}
