export function drawRegionMap(canvas,hero,enemies,{region,chestOpened,shrineUsed}){
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const size=canvas.width,scale=(size-16)/54,point=(x,z)=>[size/2+x*scale,size/2+z*scale];
 ctx.clearRect(0,0,size,size);ctx.fillStyle='#101a19';ctx.fillRect(0,0,size,size);ctx.strokeStyle='#64736a';ctx.strokeRect(8,8,size-16,size-16);
 ctx.fillStyle='#283c35';ctx.fillRect(size/2-5,8,10,size-16);
 const mark=(x,z,text,color)=>{const [px,py]=point(x,z);ctx.fillStyle=color;ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText(text,px,py+4);};
 if(region!=='refuge'){
  if(!chestOpened)mark(0,-16,'C','#f1c86e');
  if(!shrineUsed)mark(-3,-3,'S','#72dac7');
  mark(0,-8,'B','#ea978a');
  for(const enemy of enemies)if(enemy.active){const [x,z]=point(enemy.position.x,enemy.position.z);ctx.fillStyle='#ee715b';ctx.fillRect(x-1.5,z-1.5,3,3);}
 }
 mark(hero.position.x,hero.position.z,'◆','#ffffff');
}
