import { WORLD } from './data.js';
import { SKILLS, castSkill, tryDodge } from './skills.js';
import { attackHits } from './enemy-attacks.js';
import { modifySkill } from './talents.js';

// Skill readiness stays authoritative in castSkill; movement/loot targets never set aim.
export function castAutomationSkills(hero, enemies, combat) {
  const cast = [];
  combat.enemies = enemies;
  const skills = SKILLS[hero.classId] ?? [];
  const ultimate = skills.at(-1);
  const nearestLiving = () => {
    let nearest = null, distance = Infinity;
    for (const enemy of enemies) {
      if (!enemy.active || !enemy.alive) continue;
      const d = Math.hypot(enemy.position.x - hero.position.x, enemy.position.z - hero.position.z);
      if (d < distance) { nearest = enemy; distance = d; }
    }
    return { nearest, distance };
  };
  const canReach = (skill, distance) => {
    const modified = modifySkill(hero, skill);
    return distance <= (skill.id === 'volley' ? modified.range : modified.range + modified.radius);
  };
  const { nearest, distance } = nearestLiving();
  const ultimateModified = ultimate && modifySkill(hero, ultimate);
  const ultimateReady = ultimate && (hero.skillCooldowns[ultimate.id] ?? 0) <= 0 && nearest && canReach(ultimate, distance);
  // Fire the ultimate first whenever it is ready and has a valid target.
  if (ultimateReady && castSkill(hero, ultimate.id, nearest.position, combat).ok) cast.push(ultimate.id);
  const reserve = ultimateReady && (hero.skillCooldowns[ultimate.id] ?? 0) <= 0 && hero.resource < ultimateModified.cost;
  for (const skill of skills) {
    if (skill === ultimate) continue;
    const modified = modifySkill(hero, skill);
    const selfBuff = ['guard', 'ward'].includes(skill.effect);
    const { nearest, distance } = nearestLiving();
    if (!selfBuff && (!nearest || !canReach(skill, distance))) continue;
    // Once an in-range ultimate is ready, basics must leave its full cost available.
    if (reserve && hero.resource - modified.cost < ultimateModified.cost) continue;
    if (castSkill(hero, skill.id, nearest?.position ?? hero.position, combat).ok) cast.push(skill.id);
  }
  return cast;
}

// Sample short, collision-clear escape rays against the committed damage geometry.
// A dodge travels 22 * .22 metres; validate that whole corridor before using it.
export function evadeAutomationHazards(hero, enemies, world, dt) {
  const plans = [];
  for (const enemy of enemies) {
    if (!enemy.active || !enemy.alive) continue;
    if (enemy.windup > 0 && enemy.attackPlan) plans.push(enemy.attackPlan);
    if (enemy.charge && !enemy.charge.hit && enemy.charge.time > 0) plans.push({
      shape:'line', originX:enemy.position.x, originZ:enemy.position.z,
      x:enemy.charge.x, z:enemy.charge.z, radius:.9
    });
  }
  if (!plans.length || !hero.alive || hero.dodgeTime > 0) return false;
  const hits = point => plans.some(plan => attackHits(plan, point));
  const dx = hero.target.x - hero.position.x, dz = hero.target.z - hero.position.z;
  const distance = Math.hypot(dx, dz), step = Math.min(distance, hero.speed * dt + .2);
  const next = distance ? {x:hero.position.x + dx / distance * step, z:hero.position.z + dz / distance * step} : hero.position;
  if (!hits(hero.position) && !hits(next)) return false;
  let escape = null, direction = null;
  for (let radius = .25; radius <= 12 && !escape; radius += .25) {
    for (let i = 0; i < 32; i++) {
      const angle = i * Math.PI / 16, x = Math.cos(angle), z = Math.sin(angle);
      const point = {x:hero.position.x + x * radius, z:hero.position.z + z * radius};
      if (hits(point) || !clearSegment(hero.position, point, world, hero.radius)) continue;
      escape = point; direction = {x,z}; break;
    }
  }
  clearAutomationRoute(hero);
  if (!escape) { hero.target.copy(hero.position); return true; }
  hero.target.set(escape.x, 0, escape.z);
  const landing = {x:hero.position.x + direction.x * 4.84, z:hero.position.z + direction.z * 4.84};
  if (hits(hero.position) && !hits(landing) && clearSegment(hero.position, landing, world, hero.radius)) tryDodge(hero, direction);
  return true;
}

// Routes use the same obstacle resolver as movement, with a bounded search.
const routes = new WeakMap();
export function clearAutomationRoute(hero) { routes.delete(hero); }
export function chooseAutomationTarget(hero, enemies, loot) {
  let best = null, distance = Infinity;
  for (const drop of loot.pool) {
    if (!loot.canCollect(hero, drop)) continue;
    const d = Math.hypot(drop.position.x - hero.position.x, drop.position.z - hero.position.z);
    if (d < distance) { best = { drop, position: drop.position, stop: 1.3 }; distance = d; }
  }
  for (const enemy of enemies) {
    if (!enemy.active || !enemy.alive) continue;
    const d = hero.position.distanceTo(enemy.position);
    // Nearby loot takes priority; otherwise close to the next opponent.
    if (d < distance) { best = { enemy, position: enemy.position, stop: hero.range * .85 }; distance = d; }
  }
  return best;
}

function clearSegment(a, b, world, radius) {
  const distance=Math.hypot(b.x-a.x,b.z-a.z), steps=Math.max(1,Math.ceil(distance/.2));
  for(let i=1;i<=steps;i++) {
    const x=a.x+(b.x-a.x)*i/steps,z=a.z+(b.z-a.z)*i/steps,point={x,z};
    world.resolve(point,radius+.06);
    if(Math.hypot(point.x-x,point.z-z)>.001)return false;
  }
  return true;
}
function findRoute(start, target, world, radius) {
  target={x:target.x,z:target.z};world.resolve(target,radius+.08);
  const edge=Math.floor(WORLD.halfSize-radius-1), key=(x,z)=>`${x},${z}`;
  const first={x:Math.round(start.x),z:Math.round(start.z),g:0,parent:null};
  // The rounded starting cell may be inside an obstacle: connect to a nearby clear cell.
  let seed=null;
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
    const p={x:first.x+dx,z:first.z+dz};
    if(clearSegment(start,p,world,radius)&&(!seed||Math.hypot(p.x-start.x,p.z-start.z)<seed.g))seed={...p,g:Math.hypot(p.x-start.x,p.z-start.z),parent:null};
  }
  if(!seed)return [];
  const open=[seed],costs=new Map([[key(seed.x,seed.z),seed.g]]),closed=new Set();
  const heuristic=p=>Math.hypot(target.x-p.x,target.z-p.z);
  for(let visited=0;open.length&&visited<2401;visited++) {
    let index=0;for(let i=1;i<open.length;i++)if(open[i].g+heuristic(open[i])<open[index].g+heuristic(open[index]))index=i;
    const current=open.splice(index,1)[0],id=key(current.x,current.z);
    if(closed.has(id))continue;closed.add(id);
    if(heuristic(current)<1.3 || (heuristic(current)<1.5&&clearSegment(current,target,world,radius))){
      const path=clearSegment(current,target,world,radius)?[{x:target.x,z:target.z}]:[];for(let p=current;p;p=p.parent)path.push({x:p.x,z:p.z});return path.reverse();
    }
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
      if(!dx&&!dz)continue;
      const next={x:current.x+dx,z:current.z+dz,g:current.g+Math.hypot(dx,dz),parent:current};
      const nextId=key(next.x,next.z);
      if(Math.abs(next.x)>edge||Math.abs(next.z)>edge||closed.has(nextId)||next.g>=(costs.get(nextId)??Infinity)||!clearSegment(current,next,world,radius))continue;
      costs.set(nextId,next.g);open.push(next);
    }
  }
  return [];
}
export function steerToward(hero, target, world, dt) {
  let route=routes.get(hero);
  if(route)route.age+=dt;
  const direct=clearSegment(hero.position,target,world,hero.radius);
  let waypoint=target;
  if(!direct){
    if(!route||route.hash!==world.hash||Math.hypot(route.x-target.x,route.z-target.z)>1||route.age>1.2){
      route={x:target.x,z:target.z,hash:world.hash,age:0,path:findRoute(hero.position,target,world,hero.radius)};routes.set(hero,route);
    }
    while(route.path.length&&Math.hypot(route.path[0].x-hero.position.x,route.path[0].z-hero.position.z)<.16)route.path.shift();
    if(!route.path.length)return;
    waypoint=route.path[0];
  }else routes.delete(hero);
  const dx=waypoint.x-hero.position.x,dz=waypoint.z-hero.position.z,distance=Math.hypot(dx,dz);
  if(distance<=.001)return;
  const step=Math.min(distance,hero.speed*dt);world.move(hero,dx/distance*step,dz/distance*step);
}
