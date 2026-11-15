import * as THREE from 'three';
// One reusable marker group per enemy; geometry is shared for every encounter.
export class Telegraphs {
 constructor(scene,enemies){
  this.circle=new THREE.CircleGeometry(1,48);this.rings=new Map([5,6,7].map(r=>[r,new THREE.RingGeometry(r-2,r,48)]));this.ring=this.rings.get(5);this.box=new THREE.PlaneGeometry(1,1);
  this.entries=enemies.map(enemy=>{
   const material=new THREE.MeshBasicMaterial({color:0xff5036,transparent:true,opacity:.3,depthWrite:false,side:THREE.DoubleSide});
   const meshes=[this.circle,this.ring,this.box,this.box].map(geometry=>{const mesh=new THREE.Mesh(geometry,material);mesh.rotation.x=-Math.PI/2;mesh.visible=false;scene.add(mesh);return mesh;});
   return {enemy,material,meshes};
  });
 }
 update(){
  for(const {enemy,material,meshes} of this.entries){
   meshes.forEach(m=>m.visible=false);const a=enemy.attackPlan;
   if(!enemy.active||!enemy.alive||enemy.windup<=0||!a)continue;
   material.opacity=.18+.35*(1-enemy.windup/a.windup);
   const place=(m,x,z,sx,sz)=>{m.visible=true;m.position.set(x,.08,z);m.scale.set(sx,sz,1);m.rotation.set(-Math.PI/2,0,0);};
   if(a.shape==='line'){
    const dx=a.x-a.originX,dz=a.z-a.originZ;
    place(meshes[2],(a.x+a.originX)/2,(a.z+a.originZ)/2,Math.hypot(dx,dz),a.radius*2);meshes[2].rotation.z=-Math.atan2(dz,dx);
   }else if(a.shape==='cross'){
    place(meshes[2],a.x,a.z,a.radius*2,2.2);place(meshes[3],a.x,a.z,2.2,a.radius*2);
   }else if(a.shape==='ring'){
    meshes[1].geometry=this.rings.get(a.radius);place(meshes[1],a.x,a.z,1,1);
   }else place(meshes[0],a.x,a.z,a.radius,a.radius);
  }
 }
}
