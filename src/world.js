import * as THREE from 'three';
import { WORLD } from './data.js';

// A small spatial hash limits collision checks to nearby props.
export class SpatialHash {
  constructor(size = 4) { this.size = size; this.cells = new Map(); }
  key(x, z) { return `${Math.floor(x / this.size)},${Math.floor(z / this.size)}`; }
  add(obstacle) {
    const key = this.key(obstacle.x, obstacle.z);
    if (!this.cells.has(key)) this.cells.set(key, []);
    this.cells.get(key).push(obstacle);
  }
  nearby(x, z) {
    const results = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const list = this.cells.get(this.key(x + dx * this.size, z + dz * this.size));
      if (list) results.push(...list);
    }
    return results;
  }
}
export class World {
  constructor(scene) {
    this.scene = scene; this.hash = new SpatialHash();
    this.materials = new Map(); this.box = new THREE.BoxGeometry(1, 1, 1);
    this.cone = new THREE.ConeGeometry(1, 1, 5);
    const originalChildren=new Set(scene.children);
    let seed = 713;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    this.mesh(this.box, 0x303c38, 0, -.3, 0, 54, .5, 54);
    // Shared geometry/materials and instancing keep the path cheap to render.
    const stones = new THREE.InstancedMesh(this.box, this.mat(0x59605a), 175);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 175; i++) {
      const along = Math.floor(i / 5) * 1.36 - 23;
      dummy.position.set((i % 5 - 2) * .9 + (random() - .5) * .17, -.015 + random() * .03, along);
      dummy.rotation.y = (random() - .5) * .15;
      dummy.scale.set(.8, .12, 1.22); dummy.updateMatrix(); stones.setMatrixAt(i, dummy.matrix);
    }
    stones.receiveShadow = true; scene.add(stones);
    for (let i = 0; i < 62; i++) {
      const x = (random() < .5 ? -1 : 1) * (4 + random() * 19), z = random() * 46 - 23;
      if (Math.hypot(x, z) < 5) continue;
      const height = .65 + random() * .65;
      const grave = this.mesh(this.box, 0x64706b, x, height / 2, z, .8, height, .28);
      grave.rotation.z = (random() - .5) * .2;
      this.mesh(this.box, 0x3f4b44, x, .02, z + .7, 1.05, .12, 1.65);
      this.mesh(this.box, 0x929489, x, height * .73, z - .16, .37, .08, .035);
      this.mesh(this.box, 0x929489, x, height * .73, z - .16, .08, .33, .04);
      this.hash.add({ x, z, radius: .62 });
    }
    for (let i = 0; i < 22; i++) {
      const angle = i / 22 * Math.PI * 2, r = 22 + random() * 3;
      const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
      this.mesh(this.cone, 0x282e2c, x, 1.8, z, .7, 3.6, .7);
      for (let j = 0; j < 3; j++) {
        const branch = this.mesh(this.box, 0x343a35, x + (j - 1) * .4, 2 + j * .4, z, .18, 1.8, .18);
        branch.rotation.z = (j - 1.2) * .8;
      }
      this.hash.add({ x, z, radius: .7 });
    }
    // Ruined boundary pillars leave the central aisle visually open.
    for (let i = -24; i <= 24; i += 4) for (const side of [-1, 1]) {
      this.mesh(this.box, 0x444b47, side * 25, .65, i, 1.3, 1.3, 1.3);
      this.mesh(this.box, 0x444b47, i, .65, side * 25, 1.3, 1.3, 1.3);
    }
    for (const x of [-3, 3]) for (const z of [-7, 7]) {
      this.mesh(this.box, 0x55594f, x, .6, z, .55, 1.2, .55);
      this.mesh(this.cone, 0xffac48, x, 1.4, z, .25, .55, .25, true);
      const light = new THREE.PointLight(0xff9d42, 14, 7, 2); light.position.set(x, 1.8, z); scene.add(light);
      this.hash.add({ x, z, radius: .4 });
    }
    const ambient = new THREE.HemisphereLight(0xabcbd2, 0x424033, 2); scene.add(ambient);
    const moon = new THREE.DirectionalLight(0xc0d6e5, 2.5); moon.position.set(-12, 24, -8);
    moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
    Object.assign(moon.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 80 });
    moon.shadow.bias = -.0006; moon.shadow.normalBias = .04; scene.add(moon);
    this.buildRegions(originalChildren);
  }
  buildRegions(originalChildren) {
    const scene=this.scene;
    this.regionGroups={};this.regionHashes={graveyard:this.hash};
    const graveyard=new THREE.Group();
    for(const child of [...scene.children])if(!originalChildren.has(child)&&!child.isLight)graveyard.add(child);
    scene.add(graveyard);this.regionGroups.graveyard=graveyard;
    for(const id of ['refuge','marsh','citadel']){
      const group=new THREE.Group();this.regionGroups[id]=group;scene.add(group);
      const hash=new SpatialHash();this.regionHashes[id]=hash;
      const add=(geo,color,x,y,z,sx,sy,sz,solid=0)=>{const mesh=this.mesh(geo,color,x,y,z,sx,sy,sz);group.add(mesh);if(solid)hash.add({x,z,radius:solid});return mesh;};
      add(this.box,id==='marsh'?0x483d29:id==='citadel'?0x302d40:0x3d493e,0,-.3,0,54,.5,54);
      for(let z=-22;z<=22;z+=2)add(this.box,id==='citadel'?0x605d72:0x665e4d,0,0,z,3,.12,1.8);
      if(id==='refuge'){
        for(const x of [-12,12])for(const z of [-14,0,14]){
          add(this.box,0x66543d,x,1.5,z,5,3,4,3);
          add(this.cone,0x7c4736,x,4,z,6,2.5,5);
          add(this.box,0xd7a455,x,1.6,z+2.05,1,.8,.08);
        }
        for(const x of [-5,5]){add(this.box,0x8d7651,x,.7,4,2,1.4,1,1);add(this.box,0xb19e73,x,1.6,4,2.4,.25,1.4);}
      }else if(id==='marsh'){
        for(let i=0;i<28;i++){
          const x=(i%2?1:-1)*(6+(i*7%16)),z=(i*11%44)-22;
          add(this.cone,0x32281f,x,1.3,z,.65,2.6,.65,.5);
          add(this.box,0x78623a,x,.04,z+1,3,.08,2);
          const reed=add(this.box,0xba863b,x+.7,.6,z,.12,1.2,.12);reed.rotation.z=.25;
        }
      }else{
        for(const x of [-8,8,-18,18])for(const z of [-18,-9,0,9,18]){
          add(this.box,0x5b566b,x,1.8,z,1.5,3.6,1.5,1);
          add(this.box,0x898095,x,3.7,z,2.1,.4,2.1);
          add(this.box,0x443d58,x,.2,z,2.3,.4,2.3);
        }
        for(const z of [-18,18])add(this.box,0x71677c,0,5,z,17,.7,1.3);
      }
    }
    this.setRegion('graveyard');
  }
  setRegion(id) {
    if(!this.regionGroups[id])return;
    for(const [key,group] of Object.entries(this.regionGroups))group.visible=key===id;
    this.hash=this.regionHashes[id];
  }
  mat(color, glow = false) {
    const key = `${color}-${glow}`;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .95, flatShading: true, emissive: glow ? color : 0, emissiveIntensity: glow ? 2 : 0 }));
    return this.materials.get(key);
  }
  mesh(geo, color, x, y, z, sx, sy, sz, glow = false) {
    const m = new THREE.Mesh(geo, this.mat(color, glow)); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = !glow; m.receiveShadow = true; this.scene.add(m); return m;
  }
  resolve(position, radius) {
    const edge = WORLD.halfSize - radius;
    position.x = THREE.MathUtils.clamp(position.x, -edge, edge);
    position.z = THREE.MathUtils.clamp(position.z, -edge, edge);
    for (const o of this.hash.nearby(position.x, position.z)) {
      let dx = position.x - o.x, dz = position.z - o.z, d = Math.hypot(dx, dz);
      if (d < radius + o.radius) {
        if (d < .0001) { dx = 1; dz = 0; d = 1; }
        const push = radius + o.radius + .01;
        position.x = o.x + dx / d * push; position.z = o.z + dz / d * push;
      }
    }
  }
  // Axis-separated movement slides along headstones instead of stopping dead.
  move(actor, dx, dz) {
    actor.position.x += dx; this.resolve(actor.position, actor.radius);
    actor.position.z += dz; this.resolve(actor.position, actor.radius);
  }
}
