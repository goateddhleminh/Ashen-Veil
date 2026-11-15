export function skillHits(id,origin,point,target,radius){
 if(id!=='volley')return Math.hypot(target.x-point.x,target.z-point.z)<=radius;
 const dx=point.x-origin.x,dz=point.z-origin.z,length=Math.hypot(dx,dz);
 if(length<.01)return Math.hypot(target.x-origin.x,target.z-origin.z)<=radius;
 const x=target.x-origin.x,z=target.z-origin.z,along=(x*dx+z*dz)/length;
 return along>=0&&along<=length&&Math.abs(x*dz-z*dx)/length<=radius*.5;
}
