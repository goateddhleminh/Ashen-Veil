// Transient effects are refreshed, never accumulated into unbounded stacks.
export function applyStatusEffect(actor,type,damage,duration=3) {
  if(!actor.alive || !['burn','poison'].includes(type) || !Number.isFinite(damage) || damage<=0 || !Number.isFinite(duration) || duration<=0)return;
  actor.statusEffects ??= [];
  const prior=actor.statusEffects.find(effect=>effect.type===type);
  if(prior){prior.remaining=Math.max(prior.remaining,duration);prior.damage=Math.max(prior.damage,damage);}
  else actor.statusEffects.push({type,remaining:duration,tick:1,damage});
}
export function tickStatusEffects(actor,dt,damage) {
  if(!actor.alive || !actor.statusEffects || dt<=0)return;
  for(const effect of actor.statusEffects){
    const active=Math.min(dt,effect.remaining);
    effect.remaining=Math.max(0,effect.remaining-dt);effect.tick-=active;
    while(effect.tick<=1e-9 && actor.alive){damage(actor,effect.damage);effect.tick+=1;}
  }
  actor.statusEffects=actor.statusEffects.filter(effect=>effect.remaining>0);
}
