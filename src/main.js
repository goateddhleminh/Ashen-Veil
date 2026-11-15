import * as THREE from 'three';
import { Engine } from './engine.js';
import { FollowCamera } from './camera.js';
import { Input } from './input.js';
import { chooseAutomationTarget, steerToward, clearAutomationRoute } from './automation.js';
import { World } from './world.js';
import { createActor, resetHero, animateActor, face } from './entities.js';
import { updateAI } from './ai.js';
import { Telegraphs } from './telegraphs.js';
import { applyDeathPenalty, recoverHero } from './recovery.js';
import { Combat } from './combat.js';
import { activateShrine } from './shrines.js';
import { drawRegionMap } from './region-map.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings } from './settings.js';
import { GameAudio } from './audio.js';
import { WORLD, UNDEAD } from './data.js';
import { equipItem, unequipItem, usePotion, allocateStat } from './progression.js';
import { Loot } from './loot.js';
import { REGIONS, BOSSES, createRegionState, enterRegion, spawnRegionEncounter, encounterLevel } from './regions.js';
import { QUESTS, advanceQuest, claimQuestReward } from './quests.js';
import { MODIFIERS, BOUNTIES, beginExpedition, advanceExpedition, claimBounty, claimExpedition } from './expeditions.js';
import { sellItem, salvageItem, craftItem, buyItem, stashItem, retrieveItem } from './economy.js';
import { allocateTalent, refundTalent } from './talents.js';
import { SKILLS, createSkillState, castSkill, updateSkills, tryDodge } from './skills.js';
import { saveClass, readClass, applySave, exportSave, importSave, loadSave } from './save.js';

let engine, follow, input;
try {
  let state = 'ready', kills = 0, spawnTimer = 0, hudTimer = 0, saveTimer = 0;
  let campaign = createRegionState(), chestOpened = false, bossSpawned = false, expedition = null;
  let mode = 'manual', teleportRemaining = 0, pendingTravel = null;
  function clearActions() {
    input.clear(); clearAutomationRoute(hero); loot.selected = null; hero.target.copy(hero.position);
    hero.moving = false; hero.dodgeTime = 0; hero.attackVisual = 0; hero.stride = 0; hero.body.position.y = 0; marker.visible = false; combat.reset();
  }
  function setMode(next) {
    if (state !== 'playing' || !['manual','automation'].includes(next) || mode === next) return;
    clearActions(); mode = next; ui.setMode(mode);
    engine.renderer.domElement.focus({preventScroll:true});
    ui.announce(mode === 'manual' ? 'Manual · Hold right mouse to attack. Click loot to collect.' : 'Automation · Pursuing enemies and collectible loot.');
  }
  function persist() {
    if (state === 'ready') return;
    const result = saveClass(hero, { ...campaign, kills });
    if (!result.ok) ui.announce(result.error);
  }
  function downloadSave(classId) {
    const result = exportSave(classId);
    if (!result.ok) { ui.announce(result.error); return; }
    const url = URL.createObjectURL(new Blob([result.text], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `ashen-veil-${classId}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function uploadSave(file, classId) {
    if (file.size > 1000000) { ui.announce('Save file is too large.'); return; }
    try {
      const text = await file.text(), checked = loadSave(text, classId);
      if (!checked.ok) { ui.announce(checked.error); return; }
      if (!window.confirm(`Replace the saved ${classId} with this imported character?`)) return;
      const result = importSave(text, classId); ui.announce(result.ok ? 'Character imported. Choose Continue.' : result.error);
    } catch { ui.announce('Could not read this save file.'); }
  }
  const ui = new UI({ onStart: start, onRestart: recover, onPause: togglePause, onPanel: togglePanel,
    onEquip: id => action(() => equipItem(hero, id)), onUnequip: slot => action(() => unequipItem(hero, slot)), onPotion: potion, onContinue: classId => start(classId, true), onSaveStatus: readClass, onExport: downloadSave, onImport: uploadSave, onEconomy: economyAction });
  engine = new Engine(document.querySelector('#game'), update, render);
  follow = new FollowCamera(engine.renderer);
  const world = new World(engine.scene);
  const settings=loadSettings();
  const audio=new GameAudio();
  document.addEventListener('pointerdown',()=>audio.unlock());document.addEventListener('keydown',()=>audio.unlock());
  const volumeControl=document.getElementById('volume-setting'),muteControl=document.getElementById('mute-setting');
  volumeControl.value=settings.volume;muteControl.checked=settings.muted;
  volumeControl.addEventListener('input',changeSettings);muteControl.addEventListener('change',changeSettings);
  function applySettings(){audio.configure(settings);engine.setQuality(settings.quality);document.body.classList.toggle('reduced-motion',settings.reducedMotion);}
  const qualityControl=document.getElementById('quality-setting'),motionControl=document.getElementById('motion-setting');
  qualityControl.value=settings.quality;motionControl.checked=settings.reducedMotion;
  function changeSettings(){settings.volume=Number(volumeControl.value);settings.muted=muteControl.checked;settings.quality=qualityControl.value;settings.reducedMotion=motionControl.checked;applySettings();const result=saveSettings(settings);document.getElementById('settings-status').textContent=result.ok?'Settings saved.':result.message;}
  qualityControl.addEventListener('change',changeSettings);motionControl.addEventListener('change',changeSettings);applySettings();
  const hero = createActor(engine.scene); resetHero(hero);
  // Pool enemies once. Restarting and spawning never allocate new models.
  const enemies = Array.from({ length: WORLD.enemyCap }, () => {
    const enemy = createActor(engine.scene, true); enemy.active = false; enemy.model.visible = false; return enemy;
  });
  const telegraphs=new Telegraphs(engine.scene,enemies);
  const loot = new Loot(engine.scene, text => ui.announce(text));
  loot.onCollect=()=>audio.play('loot');
  const combat = new Combat(engine.scene, enemy => {
    kills++; loot.spawn(enemy, hero); combat.grantXP(hero, enemy.xp);
    advanceQuest(campaign,{type:'kill',region:campaign.region});
    advanceExpedition(expedition,{type:'kill',elite:enemy.rank>0});
    if(enemy.bossId)advanceExpedition(expedition,{type:'boss'});
    if(enemy.bossId) { advanceQuest(campaign,{type:'boss',region:campaign.region,id:enemy.bossId}); ui.announce(`${BOSSES[enemy.bossId].name} defeated. Claim your quest reward.`); }
    persist();
  }, level => {audio.play('level');ui.announce(`Level ${level} · Life restored · Power increased`);});
  combat.onSound=kind=>audio.play(kind);
  const marker = new THREE.Mesh(new THREE.RingGeometry(.32, .4, 24), new THREE.MeshBasicMaterial({ color: 0xd5c397, transparent: true, opacity: .65, side: THREE.DoubleSide, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2; marker.visible = false; engine.scene.add(marker);
  input = new Input(engine.renderer.domElement, follow.camera, togglePause);
  document.getElementById('mode-toggle').onclick = () => setMode(mode === 'manual' ? 'automation' : 'manual');
  ui.setMode(mode);
  const shrine={used:false,mesh:world.mesh(world.cone,0x72dac7,-3,1.2,-3,.6,2.4,.6,true)};
  const chest=world.mesh(world.box,0xb99145,0,.45,-16,1.5,.9,1);
  const normalBar = enemies[0].fill.material;
  const championBar = new THREE.MeshStandardMaterial({ color: 0x6ba9df });
  const eliteBar = new THREE.MeshStandardMaterial({ color: 0xddb34b });
  function refresh() { renderJourney(); ui.update(hero, kills, enemies.filter(e => e.active).length, state === 'paused'); }
  function action(fn) { if (state !== 'playing' && state !== 'inventory') return; ui.announce(fn()); persist(); refresh(); }
  function economyAction(op,id) {
    if(state!=='inventory') return;
    if(['sell','salvage','upgrade','buy','stash','retrieve','refund'].includes(op)&&campaign.region!=='refuge'){ui.announce('Return to Ember Refuge for merchant, forge and stash services.');return;}
    action(()=>{
      if(op==='favorite') {const item=hero.inventory.find(i=>i.id===id);if(item)item.favorite=!item.favorite;return 'Favorite protection updated.';}
      if(op==='stat')return allocateStat(hero,id);
      const operations={sell:sellItem,salvage:salvageItem,buy:buyItem,stash:stashItem,retrieve:retrieveItem,learn:allocateTalent,refund:refundTalent,upgrade:(h,i)=>craftItem(h,'upgrade',i)};
      if(['sell','salvage','upgrade','refund','buy'].includes(op)&&!window.confirm(`Confirm ${op}? The listed cost or item will be consumed.`))return 'Cancelled.';
      return operations[op]?.(hero,id).message??'Unknown action.';
    });
  }
  function potion() { if (state === 'playing') action(() => usePotion(hero)); }
  function togglePanel() {
    if (state !== 'playing' && state !== 'inventory') return;
    state = state === 'inventory' ? 'playing' : 'inventory'; clearActions(); input.setEnabled(state === 'playing'); ui.setState(state); refresh();
  }
  function ability(index) {
    if(state!=='playing') return;
    combat.enemies=enemies;
    const result=castSkill(hero,SKILLS[hero.classId][index].id,input.aimPoint() ?? hero.position,combat);
    if(result.ok)audio.play('skill');
    ui.announce(result.message); refresh();
  }
  document.querySelectorAll('[data-skill]').forEach(button=>button.onclick=()=>ability(Number(button.dataset.skill)));
  function dodge() {
    if(state!=='playing') return;
    const aim=input.aimPoint() ?? hero.target;
    const result=tryDodge(hero,{x:aim.x-hero.position.x,z:aim.z-hero.position.z});
    if(!result.ok) ui.announce(result.message);
  }
  document.getElementById('dodge-button').onclick=dodge;
  window.addEventListener('keydown', event => {
    if (event.repeat) return;
    if(['Digit1','Digit2','Digit3'].includes(event.code)) { event.preventDefault(); ability(Number(event.code.at(-1))-1); }
    if(event.code==='Space') { event.preventDefault(); dodge(); }
    if (event.code === 'KeyC' || event.code === 'KeyI') { event.preventDefault(); ui.selectTab(event.code === 'KeyC' ? 'character' : 'inventory'); togglePanel(); }
    if (event.code === 'KeyQ') { event.preventDefault(); potion(); }
    if (event.code === 'KeyE' && state === 'playing') { event.preventDefault(); interact(); }
  });
  function renderJourney() {
    const root=document.getElementById('journey-list'); if(!root)return;
    const signature=JSON.stringify([campaign,expedition]);if(root.dataset.signature===signature)return;root.dataset.signature=signature;root.replaceChildren();
    for(const [id,region] of Object.entries(REGIONS)) {
      const b=document.createElement('button');b.textContent=`Travel: ${region.name} · Lv ${region.level}`;b.disabled=!campaign.unlocked.includes(id);b.onclick=()=>travel(id);root.append(b);
    }
    if(campaign.campaignComplete){
      const label=document.createElement('p');label.textContent='Expeditions · Defeat 20 enemies and the guardian. Leaving abandons this run. Claim rewards before leaving.';root.append(label);
      const tiers=document.createElement('select');tiers.id='expedition-tier';tiers.setAttribute('aria-label','Expedition tier');
      for(let tier=1;tier<=Math.min(100,campaign.highestTier+1);tier++){const option=document.createElement('option');option.value=tier;option.textContent=`Tier ${tier}`;tiers.append(option);}root.append(tiers);
      const launch=document.createElement('button');launch.textContent='Begin expedition';launch.onclick=()=>{if(!['playing','inventory'].includes(state))return;const result=beginExpedition(campaign,Number(tiers.value));if(!result.ok){ui.announce(result.message);return;}travel(result.run.region,result.run);};root.append(launch);
      if(expedition){
        const info=document.createElement('p');info.textContent=`Tier ${expedition.tier} · ${expedition.kills}/20 enemies · Guardian ${expedition.boss?'defeated':'alive'} · ${expedition.modifiers.map(id=>MODIFIERS.find(m=>m.id===id).description).join(' ')} Reward: ${expedition.reward.gold} gold, ${expedition.reward.gems} gems, ${expedition.reward.diamonds} diamonds.`;root.append(info);
        const claim=document.createElement('button');claim.textContent=expedition.claimed?'Expedition reward claimed':'Claim expedition reward';claim.disabled=expedition.claimed||!expedition.boss;claim.onclick=()=>rewardRun(claimExpedition(campaign,expedition));root.append(claim);
        for(const bounty of BOUNTIES){const b=document.createElement('button');b.textContent=`Bounty: ${bounty.name} · ${bounty.target} ${bounty.type} · ${100*expedition.tier} gold + ${2*expedition.tier} gems`;b.disabled=expedition.bounties.includes(bounty.id);b.onclick=()=>rewardRun(claimBounty(expedition,bounty.id));root.append(b);}
      }
    }
    for(const quest of QUESTS) {
      if(!campaign.unlocked.includes(quest.region))continue;
      const b=document.createElement('button');const claimed=campaign.claimedRewards.includes(quest.id);
      b.textContent=`${quest.name} · ${campaign.questProgress[quest.id]??0}/${quest.target} · ${claimed?'Claimed':`${quest.gold} gold + ${quest.xp} XP`}`;
      b.disabled=claimed||(campaign.questProgress[quest.id]??0)<quest.target;
      b.onclick=()=>{const result=claimQuestReward(campaign,quest.id);if(result.ok){hero.currencies.gold+=result.reward.gold;hero.currencies.gems+=result.reward.gems;combat.grantXP(hero,result.reward.xp);persist();}ui.announce(result.message);refresh();};root.append(b);
    }
  }
  function rewardRun(result){if(result.ok){for(const [key,value] of Object.entries(result.reward))hero.currencies[key]+=value;persist();}ui.announce(result.message);refresh();}
  function travel(id,run=null) {
    if(!['playing','inventory'].includes(state))return;
    const checked=enterRegion({...campaign},id);if(!checked.ok){ui.announce(checked.message);return;}
    clearActions(); input.setEnabled(false); pendingTravel={id,run}; teleportRemaining=3;
    state='teleporting'; ui.setState(state); ui.setTeleport(teleportRemaining,REGIONS[id].name); refresh();
  }
  function arrive(id,run=null) {
    const result=enterRegion(campaign,id);if(!result.ok){ui.announce(result.message);return;}
    clearActions();
    expedition=run;shrine.used=false;hero.blessingTime=0;hero.guardTime=0;hero.wardTime=0;
    loot.reset();combat.reset();input.clear();enemies.forEach(e=>{e.active=false;e.model.visible=false;});
    hero.position.set(0,0,4);hero.target.copy(hero.position);marker.visible=false;chestOpened=false;bossSpawned=false;
    if(id==='refuge'){hero.hp=hero.maxHp;hero.resource=hero.maxResource;}
    world.setRegion(id);
    world.mat(0x303c38).color.setHex(REGIONS[id].color);if(engine.scene.fog)engine.scene.fog.color.setHex(REGIONS[id].fog);
    document.querySelector('.zone h1').textContent=REGIONS[id].name;document.querySelector('.zone p').textContent=REGIONS[id].description;
    for(const spec of spawnRegionEncounter(id,Date.now())) spawn(true,spec);
    ui.announce(result.message);persist();refresh();
  }
  function spawn(initial = false, spec = null) {
    if(campaign.region==='refuge')return;
    const enemy = enemies.find(e => !e.active); if (!enemy) return;
    const angle = Math.random() * Math.PI * 2, radius = initial ? 8 + Math.random() * 9 : 14 + Math.random() * 5;
    enemy.position.set(spec?.x??hero.position.x + Math.cos(angle) * radius, 0, spec?.z??hero.position.z + Math.sin(angle) * radius);
    world.resolve(enemy.position, enemy.radius);
    if (!spec && enemy.position.distanceTo(hero.position) < 5) return;
    Object.assign(enemy, UNDEAD, { maxHp: UNDEAD.hp, alive: true, active: true, cooldown: .8, windup: 0, flash: 0, attackVisual: 0, slowTime: 0, stunTime: 0, bossId:null, attackPlan:null, charge:null, kind:['melee','ranged','charger','caster'][Math.floor(Math.random()*4)] });
    if(spec)enemy.kind=spec.kind;
    const roll = Math.random(); enemy.rank = spec?.rank??(roll < .08 ? 2 : roll < .28 ? 1 : 0);
    const scale = 1 + enemy.rank * .18; enemy.model.scale.setScalar(scale);
    const level=encounterLevel(campaign.region,hero.level);
    enemy.maxHp = enemy.hp = UNDEAD.hp * (1 + (level - 1) * .18 + enemy.rank * .65);
    enemy.damage *= 1 + (level - 1) * .1 + enemy.rank * .3;
    enemy.xp *= 1 + enemy.rank; enemy.armor = enemy.rank * 10;
    if(expedition){enemy.maxHp*=expedition.healthMultiplier;enemy.hp=enemy.maxHp;enemy.damage*=expedition.damageMultiplier;enemy.speed*=expedition.speedMultiplier;enemy.attackSeconds*=expedition.cooldownMultiplier;enemy.armor+=expedition.armor;}
    enemy.fill.material = enemy.rank === 2 ? eliteBar : enemy.rank === 1 ? championBar : normalBar;
    enemy.model.visible = true;
    return enemy;
  }
  function start(classId = 'warrior', continuing = false) {
    const saved = readClass(classId);
    if (continuing && !saved.ok) { ui.announce(saved.error); return; }
    if (!continuing && saved.ok && !window.confirm(`Start a new ${classId}? This replaces that class's saved progress.`)) return;
    resetHero(hero, classId); hero.deathPenaltyApplied=false; loot.reset(); enemies.forEach(e => { e.active = false; e.model.visible = false; });
    combat.reset(); input.clear(); kills = 0; spawnTimer = 0; state = 'playing';
    campaign=createRegionState();
    if (continuing) {
      campaign={...campaign,...saved.value.world,region:'refuge'};
      applySave(hero, saved.value); kills = saved.value.world.kills ?? 0;
      if (!hero.alive) { hero.hp = hero.maxHp; hero.alive = true; }
    }
    Object.assign(hero,createSkillState());
    saveTimer = 0; persist();
    marker.visible = false; follow.focus.copy(hero.position); follow.update(hero.position, 1);
    mode='manual';ui.setMode(mode);teleportRemaining=0;pendingTravel=null;
    arrive('refuge'); input.setEnabled(true);
    ui.setState(state); ui.announce('Ember Refuge · Open Character to choose your destination.');
    ui.update(hero, kills, enemies.filter(e => e.active).length, false);
  }
  function recover(){
    if(state!=='dead')return;
    recoverHero(hero);state='playing';arrive('refuge');input.setEnabled(true);ui.setState(state);persist();refresh();
  }
  function togglePause() {
    if (state === 'inventory') { togglePanel(); return; }
    if (state !== 'playing' && state !== 'paused') return;
    state = state === 'playing' ? 'paused' : 'playing'; clearActions(); input.setEnabled(state === 'playing'); ui.setState(state);
  }
  function interact() {
    if(state!=='playing'||campaign.region==='refuge')return;
    if(!shrine.used&&Math.hypot(hero.position.x+3,hero.position.z+3)<2)ui.announce(activateShrine(hero,shrine).message);
    if(!chestOpened&&Math.hypot(hero.position.x,hero.position.z+16)<2.5){chestOpened=true;hero.currencies.gold+=80*REGIONS[campaign.region].level;advanceQuest(campaign,{type:'chest',region:campaign.region});advanceExpedition(expedition,{type:'chest'});ui.announce('Reliquary opened · Gold recovered.');persist();}
  }
  function update(dt) {
    if (state === 'teleporting') {
      if(document.hidden)return;
      teleportRemaining=Math.max(0,teleportRemaining-dt);
      ui.setTeleport(teleportRemaining,REGIONS[pendingTravel.id].name);
      if(teleportRemaining<=.000001){
        const destination=pendingTravel;pendingTravel=null;teleportRemaining=0;
        arrive(destination.id,destination.run);clearActions();state='playing';input.setEnabled(true);ui.setState(state);refresh();
      }
      return;
    }
    if (state !== 'playing') return;
    updateSkills(hero,dt);
    if(hero.dodgeTime>0) {
      world.move(hero,hero.dodgeDirection.x*22*dt,hero.dodgeDirection.z*22*dt);
      hero.target.copy(hero.position);
    }
    const point = input.destination();
    if (mode === 'automation') {
      const target=chooseAutomationTarget(hero,enemies,loot);
      loot.selected=target?.drop??null;
      hero.target.copy(hero.position);
      if(target&&Math.hypot(target.position.x-hero.position.x,target.position.z-hero.position.z)>target.stop){hero.target.set(target.position.x,0,target.position.z);}
      marker.visible=false;
    } else if (point) {
      loot.selected = null;
      hero.target.copy(point); world.resolve(hero.target, hero.radius);
      marker.position.copy(hero.target); marker.position.y = .07; marker.visible = true;
    }
    // Explicit basic attacks stand still; right mouse never chases an opponent.
    if(mode==='manual'&&input.attackHeld){hero.target.copy(hero.position);loot.selected=null;}
    loot.update(hero, dt);
    const distance = hero.position.distanceTo(hero.target);
    hero.moving = distance > .12 && hero.dodgeTime<=0;
    if (hero.moving) {
      face(hero, hero.target);
      if(mode==='automation')steerToward(hero,hero.target,world,dt);
      else {
        const step = Math.min(distance, hero.speed * dt);
        world.move(hero, (hero.target.x - hero.position.x) / distance * step, (hero.target.z - hero.position.z) / distance * step);
      }
    } else marker.visible = false;
    if(mode==='automation')interact();
    combat.update(hero, enemies, dt, mode==='automation'||input.attackHeld);
    updateAI(enemies, hero, world, dt, (target, amount) => combat.damage(target, amount));
    if(campaign.region!=='refuge'&&!bossSpawned&&(expedition?expedition.kills>=expedition.target:(campaign.questProgress[`${campaign.region}-kill`]??0)>=12)){
      const enemy=spawn(true,{x:0,z:-8,kind:'melee',rank:2});
      if(enemy){const boss=BOSSES[REGIONS[campaign.region].boss];Object.assign(enemy,{bossId:REGIONS[campaign.region].boss,maxHp:boss.hp*(expedition?.healthMultiplier??1),hp:boss.hp*(expedition?.healthMultiplier??1),damage:boss.damage*(expedition?.damageMultiplier??1),rank:2,xp:400*REGIONS[campaign.region].level,active:true,alive:true});enemy.model.visible=true;enemy.model.scale.setScalar(2);enemy.position.set(0,0,-8);bossSpawned=true;ui.announce(`${boss.name} approaches.`);}
    }
    spawnTimer += dt;
    if (spawnTimer >= WORLD.spawnSeconds) { spawnTimer = 0; spawn(); }
    saveTimer += dt;
    if (saveTimer >= 10) { saveTimer = 0; persist(); }
    if (!hero.alive) { const lost=applyDeathPenalty(hero);persist(); state = 'dead'; clearActions(); input.setEnabled(false); ui.setState(state); ui.announce(`Lost ${lost} gold. Equipment and progress preserved.`);marker.visible = false; }
    hudTimer += dt;
    if (hudTimer > .08 || state === 'dead') {
      hudTimer = 0; ui.update(hero, kills, enemies.filter(e => e.active).length, false);
    }
  }
  function render(dt) {
    if (!follow) return;
    audio.setPaused(state!=='playing'||document.hidden);
    follow.update(hero.position, dt);
    const animationDt = state === 'playing' || state === 'ready' ? dt : 0;
    for (const actor of [hero, ...enemies]) {
      animateActor(actor, animationDt, follow.camera);
      if(settings.reducedMotion)actor.body.position.y=0;
      // Convert the camera's world rotation to the bar's local rotation.
      actor.bar.quaternion.copy(actor.model.quaternion).invert().multiply(follow.camera.quaternion);
    }
    drawRegionMap(document.getElementById('map-canvas'),hero,enemies,{region:campaign.region,chestOpened,shrineUsed:shrine.used});
    telegraphs.update();
    shrine.mesh.visible=campaign.region!=='refuge'&&!shrine.used;
    chest.visible=campaign.region!=='refuge'&&!chestOpened;
    loot.render(follow.camera, state === 'playing');
    engine.renderer.render(engine.scene, follow.camera);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') togglePause(); audio.setPaused(document.hidden || state !== 'playing'); });
  window.addEventListener('blur', () => { if (state === 'playing') togglePause(); });
  window.addEventListener('pagehide', event => {
    persist();
    // A bfcache navigation preserves the live page; disposing it would break Back.
    if (event.persisted) { if (state === 'playing') togglePause(); return; }
    audio.dispose(); input.dispose(); follow.dispose(); engine.dispose();
  });
  ui.setState('ready'); ui.update(hero, 0, 0, false);
  document.querySelector('#loading').hidden = true;
  // Read-only diagnostic snapshots are useful for learning and automated checks.
  window.arpg = { snapshot: () => ({ state, mode, teleportRemaining, region:campaign.region, campaign:JSON.parse(JSON.stringify(campaign)), expedition:expedition?JSON.parse(JSON.stringify(expedition)):null, resource:hero.resource, blessingTime:hero.blessingTime, shrineUsed:shrine.used, skillCooldowns:{...hero.skillCooldowns}, dodgeCooldown:hero.dodgeCooldown, invulnerable:hero.invulnerable, classId: hero.classId, hp: hero.hp, maxHp: hero.maxHp, damage: hero.damage, armor: hero.armor, crit: hero.crit, range: hero.range, currencies: { ...hero.currencies }, potions: hero.potions, inventory: hero.inventory.map(i => ({ ...i, mods: { ...i.mods } })), equipment: JSON.parse(JSON.stringify(hero.equipment)), drops: loot.snapshot(), level: hero.level, xp: hero.xp, kills, position: hero.position.toArray(), enemies: enemies.filter(e => e.active).length, drawCalls: engine.renderer.info.render.calls, triangles: engine.renderer.info.render.triangles, geometries: engine.renderer.info.memory.geometries }) };
} catch (error) {
  engine?.dispose(); follow?.dispose(); input?.dispose();
  const loading = document.querySelector('#loading'); loading.hidden = false;
  loading.textContent = `Unable to start: ${error.message}. Use a current WebGL-capable desktop browser and a static HTTP host.`;
  console.error(error);
}
