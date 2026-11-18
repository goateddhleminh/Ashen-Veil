import * as THREE from 'three';
import { Engine } from './engine.js';
import { FollowCamera } from './camera.js';
import { Input } from './input.js';
import { chooseAutomationTarget, steerToward, clearAutomationRoute, castAutomationSkills, evadeAutomationHazards, autoEquipStrongest } from './automation.js';
import { World } from './world.js';
import { createActor, resetHero, animateActor, face, configureEnemyAppearance } from './entities.js';
import { updateAI } from './ai.js';
import { Telegraphs } from './telegraphs.js';
import { applyDeathPenalty, recoverHero } from './recovery.js';
import { Combat } from './combat.js';
import { activateShrine } from './shrines.js';
import { tickStatusEffects } from './status-effects.js';
import { drawRegionMap } from './region-map.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings } from './settings.js';
import { campaignEnemyHealth } from './balance.js';
import { GameAudio } from './audio.js';
import { WORLD, UNDEAD } from './data.js';
import { equipItem, unequipItem, usePotion, allocateStat, tickPotionCooldown, recomputeStats } from './progression.js';
import { Loot } from './loot.js';
import { REGIONS, BOSSES, DIFFICULTIES, REGION_STAGES, createRegionState, enterRegion, spawnRegionEncounter, encounterLevel, difficultyMultiplier, setDifficulty } from './regions.js';
import { createStageState, currentStage, canAdvanceStage, advanceStage, isStageComplete } from './stages.js';
import { QUESTS, advanceQuest, claimQuestReward } from './quests.js';
import { MODIFIERS, BOUNTIES, beginExpedition, advanceExpedition, claimBounty, claimExpedition } from './expeditions.js';
import { sellItem, deleteItem, autoSellInventory, validAutoSellConfig, salvageItem, salvageUnfavorited, craftItem, buyItem, stashItem, retrieveItem } from './economy.js';
import { allocateTalent, refundTalent } from './talents.js';
import { SKILLS, createSkillState, castSkill, updateSkills, tryDodge } from './skills.js';
import { saveClass, readClass, applySave, exportSave, importSave, loadSave } from './save.js';
import { migrateEventsState, recordEvent, tickEvents, startTower, advanceTower, endTower, useTowerPotion, claimEventReward, applyEventReward, selectEventCosmetic } from './events.js';
import { EventsUI } from './event-ui.js';
import { towerEncounter, moonEnemyModifiers } from './event-encounters.js';
import { applyHeroCosmetics } from './cosmetics.js';
import { buyInventoryCapacity } from './economy.js';

let engine, follow, input;
try {
  let state = 'ready', kills = 0, runKills = 0, spawnTimer = 0, hudTimer = 0, saveTimer = 0;
  let campaign = createRegionState(), chestOpened = false, bossSpawned = false, expedition = null, stageRun = createStageState();
  let eliteSequence=0, towerArena=null, moonApplied=false, farmingDelay=0;
  campaign.events=migrateEventsState(campaign.events);
  function track(event) { campaign.events=recordEvent(campaign.events,event,{now:Date.now(),region:campaign.region,difficulty:campaign.difficulty,towerActive:!!towerArena}); }
  function eventContext() { return {now:Date.now(),region:campaign.region,difficulty:campaign.difficulty,level:hero.level,towerActive:!!towerArena}; }
  let mode = 'manual', teleportRemaining = 0, pendingTravel = null, backgroundAutomation = false;
  function clearActions(preserveCombat=false) {
    input.clear(); clearAutomationRoute(hero); loot.selected = null; hero.target.copy(hero.position);
    hero.moving = false; hero.dodgeTime = 0; hero.attackVisual = 0; hero.stride = 0; hero.body.position.y = 0; marker.visible = false; if(!preserveCombat)combat.reset();
  }
  function setMode(next) {
    if (state !== 'playing' || !['manual','automation'].includes(next) || mode === next) return;
    clearActions(); mode = next; loot.automation=mode==='automation'; ui.setMode(mode);
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
  async function uploadSave(file) {
    if (file.size > 1000000) { ui.announce('Save file is too large.'); return; }
    try {
      const text = await file.text(), classId = JSON.parse(text)?.hero?.classId;
      const checked = loadSave(text, classId);
      if (!checked.ok) { ui.announce(checked.error); return; }
      if (!window.confirm(`Replace the saved ${classId} with this imported character?`)) return;
      const result = importSave(text, classId);
      if (result.ok) {
        ui.selectedClass = classId;
        document.querySelectorAll('input[name="hero-class"]').forEach(radio => { radio.checked = radio.value === classId; });
      }
      ui.announce(result.ok ? 'Character imported. Choose Continue.' : result.error);
    } catch { ui.announce('Could not read this save file.'); }
  }
  const ui = new UI({ onStart: start, onRestart: recover, onPause: togglePause, onPanel: togglePanel, onBackgroundToggle: toggleBackgroundAutomation,
    onEquip: id => action(() => {const item=hero.inventory.find(i=>i.id===id),message=equipItem(hero,id);if(item&&hero.equipment[item.slot]?.id===id)track({type:'equip',slot:item.slot});return message;}), onUnequip: slot => action(() => unequipItem(hero, slot)), onPotion: potion, onContinue: classId => start(classId, true), onSaveStatus: readClass, onExport: downloadSave, onImport: uploadSave, onEconomy: economyAction, onAutoSellChange: config => { if(!validAutoSellConfig(config))return; settings.autoSell=config; const saved=saveSettings(settings); ui.announce(saved.ok?'Auto-sell settings saved. Applies while Automation is running.':saved.message); } });
  const eventsUI=new EventsUI({onClaim:claimEvent,onStartTower:beginTower,onNextFloor:nextTowerFloor,onLeaveTower:leaveTower,onSummonReaper:()=>{updateEvents(0);refresh();},onUseConsumable:useEventConsumable,onSelectCosmetic:(type,id)=>{const result=selectEventCosmetic(hero,type,id);if(result.ok){applyHeroCosmetics(hero);persist();}ui.announce(result.message??'Appearance updated.');refresh();}});
  engine = new Engine(document.querySelector('#game'), update, render);
  follow = new FollowCamera(engine.renderer);
  const world = new World(engine.scene);
  const settings=loadSettings();
  ui.setAutoSell(settings.autoSell);
  const audio=new GameAudio();
  document.addEventListener('pointerdown',()=>audio.unlock());document.addEventListener('keydown',()=>audio.unlock());
  const volumeControl=document.getElementById('volume-setting'),muteControl=document.getElementById('mute-setting');
  volumeControl.value=settings.volume;muteControl.checked=settings.muted;
  volumeControl.addEventListener('input',changeSettings);muteControl.addEventListener('change',changeSettings);
  function applySettings(){audio.configure(settings);engine.setQuality(settings.quality);document.body.classList.toggle('reduced-motion',settings.reducedMotion);}
  const qualityControl=document.getElementById('quality-setting'),motionControl=document.getElementById('motion-setting');
  const salvageControl=document.getElementById('auto-salvage-setting');salvageControl.value=settings.autoSalvage;salvageControl.addEventListener('change',changeSettings);
  qualityControl.value=settings.quality;motionControl.checked=settings.reducedMotion;
  const autoEquipControl=document.getElementById('auto-equip-setting'),exactSalvageControl=document.getElementById('auto-salvage-exact-setting');
  if(autoEquipControl){autoEquipControl.checked=settings.autoEquip;autoEquipControl.addEventListener('change',changeSettings);}
  if(exactSalvageControl){exactSalvageControl.value=settings.autoSalvageExact;exactSalvageControl.addEventListener('change',changeSettings);}
  function changeSettings(){if(autoEquipControl)settings.autoEquip=autoEquipControl.checked;if(exactSalvageControl)settings.autoSalvageExact=exactSalvageControl.value;settings.autoSalvage=salvageControl.value;settings.volume=Number(volumeControl.value);settings.muted=muteControl.checked;settings.quality=qualityControl.value;settings.reducedMotion=motionControl.checked;applySettings();const result=saveSettings(settings);document.getElementById('settings-status').textContent=result.ok?'Settings saved.':result.message;}
  qualityControl.addEventListener('change',changeSettings);motionControl.addEventListener('change',changeSettings);applySettings();
  const hero = createActor(engine.scene); resetHero(hero);
  // Pool enemies once. Restarting and spawning never allocate new models.
  const enemies = Array.from({ length: WORLD.enemyCap }, () => {
    const enemy = createActor(engine.scene, true); enemy.active = false; enemy.model.visible = false; return enemy;
  });
  const telegraphs=new Telegraphs(engine.scene,enemies);
  const loot = new Loot(engine.scene, text => ui.announce(text), settings);
  loot.onEquip=item=>track({type:'equip',slot:item.slot});
  loot.onSell=()=>track({type:'sell'});
  loot.onCollect=drop=>{audio.play('loot');if(drop?.item)track({type:'pickup',item:drop.item,rarity:drop.item.rarity});};
  const combat = new Combat(engine.scene, enemy => {
    kills++; runKills++;
    track({type:'kill',region:campaign.region,elite:enemy.rank>0,boss:!!enemy.bossId,eventBoss:enemy.eventBoss,tower:!!towerArena,packId:enemy.packId,packCleared:!!enemy.packId&&!enemies.some(e=>e!==enemy&&e.active&&e.alive&&e.packId===enemy.packId)});
    if(!towerArena&&!enemy.eventBoss){
      if(!expedition){advanceStage(stageRun,{type:'kill',elite:enemy.rank>0});if(enemy.bossId){advanceStage(stageRun,{type:'guardian'});track({type:'stage-clear',region:campaign.region});}}
      advanceQuest(campaign,{type:'kill',region:campaign.region});advanceExpedition(expedition,{type:'kill',elite:enemy.rank>0});
      if(enemy.bossId){advanceExpedition(expedition,{type:'boss'});advanceQuest(campaign,{type:'boss',region:campaign.region,id:enemy.bossId});ui.announce(`${BOSSES[enemy.bossId].name} defeated. Claim your quest reward.`);}
    }
    const dropLevel = expedition ? Math.min(100, hero.level + expedition.tier) : encounterLevel(campaign.region, hero.level, campaign.difficulty);
    loot.spawn(enemy, hero, dropLevel,moonEnemyModifiers(campaign.events.bloodMoon.active&&!towerArena)); combat.grantXP(hero, enemy.xp);
    if(towerArena&&--towerArena.remaining<=0){const result=advanceTower(campaign.events,towerArena.floor,eventContext());if(result.ok)campaign.events=result.state;towerArena.ready=true;ui.announce(`Tower floor ${towerArena.floor} cleared. Open Events for next floor or leave.`);}
    persist();
  }, level => {track({type:'level',level,amount:level});audio.play('level');ui.announce(`Level ${level} · Life restored · Power increased`);});
  combat.onSound=kind=>audio.play(kind);
  combat.world=world;combat.hero=hero;combat.onImpact=(critical,isEnemy)=>{if(critical||!isEnemy)follow.shake(critical?.35:.15);};
  const marker = new THREE.Mesh(new THREE.RingGeometry(.32, .4, 24), new THREE.MeshBasicMaterial({ color: 0xd5c397, transparent: true, opacity: .65, side: THREE.DoubleSide, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2; marker.visible = false; engine.scene.add(marker);
  input = new Input(engine.renderer.domElement, follow.camera, togglePause);
  document.getElementById('mode-toggle').onclick = () => setMode(mode === 'manual' ? 'automation' : 'manual');
  ui.setMode(mode);
  const shrine={used:false,mesh:world.mesh(world.cone,0x72dac7,-3,1.2,-3,.6,2.4,.6,true)};
  const chest=world.mesh(world.box,0xb99145,0,.45,-16,1.5,.9,1);
  const portal=world.mesh(world.cone,0x9e81e5,0,1,-19,1.4,2,1.4,true);
  function layoutStage(){
    const offset=campaign.region==='marsh'?5:campaign.region==='citadel'?-5:0;
    shrine.mesh.position.set(-3+offset,1.2,-3);chest.position.set(offset,.45,-14);portal.position.set(offset,1,-19);
    world.resolve(shrine.mesh.position,1);world.resolve(chest.position,1);world.resolve(portal.position,1);
    updateObjective();
  }
  function useEventConsumable(id){
    if(!['playing','inventory'].includes(state)||!(hero[id]>0))return;
    if(id==='manaPotions'){if(hero.resource>=hero.maxResource){ui.announce('Resource is already full.');return;}hero.resource=hero.maxResource;}
    else if(id==='portalScrolls'){if(campaign.region==='refuge'&&!towerArena){ui.announce('Already in Ember Refuge.');return;}travel('refuge');}
    else if(id==='resetTokens'){hero.talentPoints+=Object.values(hero.talents??{}).reduce((sum,rank)=>sum+rank,0);hero.talents={};recomputeStats(hero);}
    else return;
    hero[id]--;persist();refresh();
  }
  function claimEvent(eventId,rewardId,choice){
    if(!['playing','inventory'].includes(state))return;
    const result=claimEventReward(campaign.events,eventId,rewardId,{...eventContext(),choice});
    if(!result.ok){ui.announce(result.message);return;}
    const applied=applyEventReward(hero,result.reward);
    if(applied.ok){campaign.events=result.state;applyHeroCosmetics(hero);persist();}
    ui.announce(applied.message??(applied.ok?'Event reward claimed.':'Reward could not be claimed.'));refresh();
  }
  function beginTower(){
    if(!['playing','inventory'].includes(state)||towerArena)return;
    const result=startTower(campaign.events,Date.now());if(!result.ok){ui.announce(result.message);return;}
    campaign.events=result.state;towerArena={floor:result.state.tower.run.floor,remaining:0,ready:true};
    expedition=null;clearActions();world.setRegion('citadel');document.querySelector('.zone h1').textContent='Infernal Tower';nextTowerFloor();
  }
  function nextTowerFloor(){
    if(!towerArena?.ready||!['playing','inventory'].includes(state))return;
    clearActions();loot.reset();enemies.forEach(e=>{e.active=false;e.model.visible=false;});
    towerArena={floor:campaign.events.tower.run.floor+1,remaining:0,ready:false};
    const encounter=towerEncounter(towerArena.floor);
    hero.position.set(0,0,4);hero.target.copy(hero.position);
    for(let i=0;i<encounter.count;i++){
      const enemy=spawn(true,{kind:['melee','ranged','charger','caster'][i%4],rank:i===0&&(encounter.boss||encounter.miniBoss)?2:0});if(!enemy)continue;
      enemy.eventBoss=encounter.boss&&i===0?'tower-boss':encounter.miniBoss&&i===0?'tower-mini':null;
      enemy.maxHp*=encounter.healthMultiplier*(enemy.eventBoss?encounter.boss?5:3:1);enemy.hp=enemy.maxHp;enemy.damage*=encounter.damageMultiplier;
      if(enemy.eventBoss){enemy.bossId='hollowking';enemy.eliteTrait=null;configureEnemyAppearance(enemy,enemy.kind,true);enemy.model.scale.setScalar(encounter.boss?2:1.6);}
      towerArena.remaining++;
    }
    state='playing';ui.setState(state);input.setEnabled(true);updateMoonVisual();persist();refresh();
  }
  function finishTower(){if(!towerArena)return;const result=endTower(campaign.events,eventContext());if(result.ok)campaign.events=result.state;towerArena=null;}
  function leaveTower(){if(!towerArena||!['playing','inventory'].includes(state))return;finishTower();travel('refuge');}
  function setMoonEnemy(enemy,active){
    if(!enemy.active||enemy.moonBoosted===active)return;
    const ratio=active?1.5:1/1.5;enemy.maxHp*=ratio;enemy.hp=active?enemy.hp*ratio:Math.min(enemy.hp,enemy.maxHp);enemy.damage*=ratio;enemy.moonBoosted=active;
  }
  function updateMoonVisual(){
    const active=campaign.events.bloodMoon.active&&!towerArena&&campaign.region!=='refuge';
    enemies.forEach(enemy=>setMoonEnemy(enemy,active));moonApplied=active;
    engine.scene.fog?.color.setHex(active?0x581b25:REGIONS[towerArena?'citadel':campaign.region].fog);
    engine.scene.background?.setHex(active?0x260b15:REGIONS[towerArena?'citadel':campaign.region].fog);
    document.body.classList.toggle('blood-moon-active',active);
  }
  function updateEvents(dt){
    const wasActive=campaign.events.bloodMoon.active;
    campaign.events=tickEvents(campaign.events,dt,eventContext());
    if(wasActive!==campaign.events.bloodMoon.active){updateMoonVisual();ui.announce(campaign.events.bloodMoon.active?'Blood Moon rises · Enemies empowered for five minutes.':'Blood Moon fades · Rewards remain available in Events.');}
    const moon=campaign.events.bloodMoon;
    if(moon.active&&!towerArena&&campaign.region!=='refuge'&&(moon.progress.fragments??0)>=100&&!moon.reaperSpawned&&!(moon.progress.reaper>0)){
      const enemy=spawn(true,{kind:'melee',rank:2,x:0,z:-8});
      if(enemy){const difficulty=difficultyMultiplier(campaign.difficulty);Object.assign(enemy,{eventBoss:'reaper',bossId:'hollowking',eliteTrait:null,maxHp:BOSSES.hollowking.hp*difficulty.health*1.5,hp:BOSSES.hollowking.hp*difficulty.health*1.5,damage:BOSSES.hollowking.damage*difficulty.damage*1.5,xp:Math.round(1000*difficulty.health),moonBoosted:true});configureEnemyAppearance(enemy,'melee',true);enemy.model.scale.setScalar(2.3);track({type:'reaper-spawn'});ui.announce('100 fragments · The Blood Reaper has arrived!');persist();}
    }
  }
  function updateObjective(){
    if(towerArena){const text=document.querySelector('.zone p');if(text)text.textContent=`Floor ${towerArena.floor} · ${towerArena.remaining} enemies · ${campaign.events.tower.run?.potionsUsed??0}/5 potions used${towerArena.ready?' · J: next floor or leave':''}`;return;}
    const text=document.querySelector('.zone p');if(!text)return;
    if(campaign.region==='refuge'){text.textContent=`${DIFFICULTIES[campaign.difficulty]?.name??'Normal'} · Choose a destination in Character.`;return;}
    if(expedition){text.textContent=`Expedition · ${expedition.kills}/20 enemies · Defeat the guardian`;return;}
    const n=currentStage(stageRun), progress=n===1?`${stageRun.kills}/8 enemies · Shrine ${stageRun.shrine?'lit':'unlit'}`:n===2?`${Math.min(3,stageRun.stageKills)}/3 enemies · ${stageRun.champions}/2 champions · Reliquary ${stageRun.chest?'opened':'sealed'}`:isStageComplete(stageRun)?'Guardian defeated · Claim your quest reward.':'Defeat the regional guardian.';
    text.textContent=`${DIFFICULTIES[campaign.difficulty]?.name??'Normal'} · ${n}/3 ${REGION_STAGES[n].name} · ${progress}${canAdvanceStage(stageRun)?' · E at the violet north portal':''}`;
  }
  function enterNextStage(){
    if(currentStage(stageRun)===2&&enemies.some(e=>e.active&&e.alive&&!e.eventBoss)){ui.announce('Defeat the remaining elite packs before advancing.');return;}
    if(!advanceStage(stageRun,{type:'portal'}))return;
    track({type:'stage-clear',region:campaign.region});
    clearActions();loot.reset();enemies.forEach(e=>{if(e.eventBoss!=='reaper'){e.active=false;e.model.visible=false;}});spawnTimer=0;
    hero.position.set(0,0,4);hero.target.copy(hero.position);layoutStage();
    if(currentStage(stageRun)===2)for(let i=0;i<6;i++)spawn(true,{kind:['melee','ranged','caster'][i%3],rank:1,packId:`${campaign.region}-pack-${Math.floor(i/2)}`});
    ui.announce(`${REGION_STAGES[currentStage(stageRun)].name} · ${REGION_STAGES[currentStage(stageRun)].objective}`);refresh();
  }
  const normalBar = enemies[0].fill.material;
  const championBar = new THREE.MeshStandardMaterial({ color: 0x6ba9df });
  const eliteBar = new THREE.MeshStandardMaterial({ color: 0xddb34b });
  function refresh() { ui.setShopAvailable(campaign.region==='refuge'&&!towerArena); renderJourney(); eventsUI.render(campaign.events,hero,{...eventContext(),towerReady:!!towerArena?.ready});eventsUI.updateHud(campaign.events); ui.update(hero, kills, enemies.filter(e => e.active).length, state === 'paused'); }
  function action(fn) { if (state !== 'playing' && state !== 'inventory') return; ui.announce(fn()); persist(); refresh(); }
  function economyAction(op,id) {
    if(state!=='inventory') return;
    if(['sell','salvage','salvageAll','upgrade','reroll','buy','stash','retrieve','refund'].includes(op)&&(campaign.region!=='refuge'||towerArena)){ui.announce('Return to Ember Refuge for merchant, forge and stash services.');return;}
    action(()=>{
      if(op==='favorite') {const item=hero.inventory.find(i=>i.id===id);if(item)item.favorite=!item.favorite;return 'Favorite protection updated.';}
      if(op==='stat')return allocateStat(hero,id);
      const operations={sell:sellItem,delete:deleteItem,salvage:salvageItem,salvageAll:salvageUnfavorited,buy:buyItem,stash:stashItem,retrieve:retrieveItem,learn:allocateTalent,refund:refundTalent,upgrade:(h,i)=>craftItem(h,'upgrade',i),reroll:(h,i)=>craftItem(h,'reroll',i)};
      if((['upgrade','reroll','refund'].includes(op)||(['sell','salvage'].includes(op)&&hero.inventory.find(i=>i.id===id)?.rarity==='legendary'))&&!window.confirm(`Confirm ${op}? The listed cost or item will be consumed.`))return 'Cancelled.';
      const result=op==='expandInventory'?buyInventoryCapacity(hero):operations[op]?.(hero,id);if(result?.ok&&op==='sell')track({type:'sell'});return result?.message??'Unknown action.';
    });
  }
  function potion() { if(state!=='playing')return;action(()=>{const gate=towerArena?useTowerPotion(campaign.events):null;if(gate&&!gate.ok)return gate.message;const before=hero.potions,message=usePotion(hero);if(hero.potions<before){if(gate)campaign.events=gate.state;track({type:'potion'});}return message;}); }
  function togglePanel() {
    if (state !== 'playing' && state !== 'inventory') return;
    state = state === 'inventory' ? 'playing' : 'inventory'; clearActions(true); input.setEnabled(state === 'playing'); ui.setState(state); refresh();
  }
  function ability(index) {
    if(state!=='playing') return;
    combat.enemies=enemies;
    const result=castSkill(hero,SKILLS[hero.classId][index].id,input.aimPoint() ?? hero.position,combat);
    if(result.ok){audio.play('skill');track({type:'cast-skill',skillId:SKILLS[hero.classId][index].id});}
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
    if(['Digit1','Digit2','Digit3','Digit4'].includes(event.code)) { event.preventDefault(); ability(Number(event.code.at(-1))-1); }
    if(event.code==='Space') { event.preventDefault(); dodge(); }
    if (event.code === 'KeyC' || event.code === 'KeyI') { event.preventDefault(); ui.selectTab(event.code === 'KeyC' ? 'character' : 'inventory'); togglePanel(); }
    if(event.code==='KeyJ'){event.preventDefault();ui.selectTab('events');togglePanel();}
    if(event.code==='KeyB'){event.preventDefault();ui.selectTab('shops');togglePanel();}
    if(event.code==='KeyM'){event.preventDefault();ui.selectTab('journey');togglePanel();}
    if (event.code === 'KeyQ') { event.preventDefault(); potion(); }
    if (event.code === 'KeyE' && state === 'playing') { event.preventDefault(); interact(); }
  });
  function renderJourney() {
    const root=document.getElementById('journey-list'); if(!root)return;
    const signature=JSON.stringify([campaign,expedition,stageRun,!!towerArena]);if(root.dataset.signature===signature)return;root.dataset.signature=signature;root.replaceChildren();
    const difficultySelect=document.createElement('select');difficultySelect.id='difficulty-select';difficultySelect.setAttribute('aria-label','Campaign difficulty');difficultySelect.disabled=campaign.region!=='refuge'||!!towerArena;
    for(const [id,config] of Object.entries(DIFFICULTIES)){const option=document.createElement('option');option.value=id;option.textContent=`${config.name} · Lv ${config.minLevel}–${config.maxLevel}`;difficultySelect.append(option);}difficultySelect.value=campaign.difficulty;
    difficultySelect.onchange=()=>{if(campaign.region!=='refuge'||towerArena)return;ui.announce(setDifficulty(campaign,difficultySelect.value).message);persist();refresh();};root.append(difficultySelect);
    const hint=document.createElement('p');hint.textContent='Difficulty changes in Ember Refuge. Higher modes raise enemy level, health and damage.';root.append(hint);
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
    if(towerArena)finishTower();
    const checked=enterRegion({...campaign},id);if(!checked.ok){ui.announce(checked.message);return;}
    clearActions(); input.setEnabled(false); pendingTravel={id,run}; teleportRemaining=3;
    state='teleporting'; ui.setState(state); ui.setTeleport(teleportRemaining,REGIONS[id].name); refresh();
  }
  function arrive(id,run=null) {
    const from=campaign.region;const result=enterRegion(campaign,id);if(!result.ok){ui.announce(result.message);return;}
    track({type:'travel',from,to:id,region:id});
    clearActions();
    expedition=run;stageRun=createStageState();hero.statusEffects=[];shrine.used=false;shrine.type={graveyard:'ember',marsh:'renewal',citadel:'ward'}[id]??'ember';hero.blessingTime=0;hero.guardTime=0;hero.wardTime=0;
    loot.reset();combat.reset();input.clear();enemies.forEach(e=>{e.active=false;e.model.visible=false;});
    hero.position.set(0,0,4);hero.target.copy(hero.position);marker.visible=false;chestOpened=false;bossSpawned=false;runKills=0;
    layoutStage();
    if(id==='refuge'){hero.hp=hero.maxHp;hero.resource=hero.maxResource;}
    world.setRegion(id);
    if(engine.scene.fog)engine.scene.fog.color.setHex(REGIONS[id].fog);
    document.querySelector('.zone h1').textContent=REGIONS[id].name;updateObjective();
    if(id!=='refuge'&&!run&&!campaign.events.zone.progress[`${id}:${campaign.difficulty}`]?.enemies)track({type:'encounter',region:id,enemyCount:15,elitePackIds:[0,1,2].map(i=>`${id}-pack-${i}`)});
    for(const spec of spawnRegionEncounter(id,Date.now()).slice(0,run?12:8)) spawn(true,spec);
    campaign.events.bloodMoon.reaperSpawned=false;updateMoonVisual();
    ui.announce(result.message);persist();refresh();
  }
  function spawn(initial = false, spec = null) {
    if(campaign.region==='refuge'&&!towerArena)return;
    const enemy = enemies.find(e => !e.active); if (!enemy) return;
    enemy.spawnGeneration=(enemy.spawnGeneration??0)+1;
    const angle = Math.random() * Math.PI * 2, radius = initial ? 8 + Math.random() * 9 : 14 + Math.random() * 5;
    enemy.position.set(spec?.x??hero.position.x + Math.cos(angle) * radius, 0, spec?.z??hero.position.z + Math.sin(angle) * radius);
    world.resolve(enemy.position, enemy.radius);
    if (!spec && enemy.position.distanceTo(hero.position) < 5) return;
    Object.assign(enemy, UNDEAD, { maxHp: UNDEAD.hp, alive: true, active: true, cooldown: .8, windup: 0, flash: 0, attackVisual: 0, slowTime: 0, stunTime: 0, bossId:null, eventBoss:null, moonBoosted:false, packId:spec?.packId??null, statusEffects:[], eliteTrait:null, attackPlan:null, charge:null, kind:['melee','ranged','charger','caster'][Math.floor(Math.random()*4)] });
    if(spec)enemy.kind=spec.kind;
    configureEnemyAppearance(enemy,enemy.kind,false);
    const roll = Math.random(); enemy.rank = spec?.rank??(roll < .08 ? 2 : roll < .28 ? 1 : 0);
    if(enemy.rank>0){enemy.eliteTrait=['vampiric','molten','hasted'][eliteSequence++%3];if(enemy.eliteTrait==='hasted'){enemy.speed*=1.25;enemy.attackSeconds*=.8;}}
    const scale = 1 + enemy.rank * .18; enemy.model.scale.setScalar(scale);
    const level=expedition?Math.max(REGIONS[campaign.region]?.level??1,hero.level):encounterLevel(campaign.region,hero.level,campaign.difficulty), difficulty=difficultyMultiplier(expedition?'normal':campaign.difficulty);
    enemy.maxHp = enemy.hp = expedition ? UNDEAD.hp * (1 + (level - 1) * .18 + enemy.rank * .65) : campaignEnemyHealth(UNDEAD.hp, level, enemy.rank);
    enemy.maxHp*=difficulty.health;enemy.hp=enemy.maxHp;
    enemy.damage *= (1 + (level - 1) * .1 + enemy.rank * .3)*difficulty.damage;
    const rewardLevel = expedition ? Math.min(100, hero.level + expedition.tier) : level;
    enemy.xp = Math.round(enemy.xp * (1 + enemy.rank) * (1 + (rewardLevel - 1) * .18)); enemy.armor = enemy.rank * 10;
    if(expedition){enemy.maxHp*=expedition.healthMultiplier;enemy.hp=enemy.maxHp;enemy.damage*=expedition.damageMultiplier;enemy.speed*=expedition.speedMultiplier;enemy.attackSeconds*=expedition.cooldownMultiplier;enemy.armor+=expedition.armor;}
    const archetype={ranged:[.82,.9,1.15,.9],charger:[1.2,1.2,1.1,1.25],caster:[.9,1.25,.85,1.15]}[enemy.kind]??[1,1,1,1];
    enemy.maxHp*=archetype[0];enemy.hp=enemy.maxHp;enemy.damage*=archetype[1];enemy.speed*=archetype[2];enemy.attackSeconds*=archetype[3];
    enemy.fill.material = enemy.rank === 2 ? eliteBar : enemy.rank === 1 ? championBar : normalBar;
    enemy.model.visible = true;
    setMoonEnemy(enemy,campaign.events.bloodMoon.active&&!towerArena&&campaign.region!=='refuge');
    return enemy;
  }
  function start(classId = 'warrior', continuing = false) {
    const saved = readClass(classId);
    if (continuing && !saved.ok) { ui.announce(saved.error); return; }
    if (!continuing && saved.ok && !window.confirm(`Start a new ${classId}? This replaces that class's saved progress.`)) return;
    for(const key of ['manaPotions','portalScrolls','resetTokens','dust','shards','reaperFragments'])hero[key]=0;
    hero.socketGems={};hero.eventRewards=[];hero.eventAppearance={};
    resetHero(hero, classId); hero.deathPenaltyApplied=false; loot.reset(); enemies.forEach(e => { e.active = false; e.model.visible = false; });
    combat.reset(); input.clear(); kills = 0; spawnTimer = 0; state = 'playing';
    campaign=createRegionState();
    if (continuing) {
      campaign={...campaign,...saved.value.world,region:'refuge'};
      applySave(hero, saved.value); kills = saved.value.world.kills ?? 0;
      if (!hero.alive) { hero.hp = hero.maxHp; hero.alive = true; }
    }
    campaign.events=migrateEventsState(campaign.events);towerArena=null;
    if(campaign.events.tower.run){const ended=endTower(campaign.events,{now:Date.now()});campaign.events=ended.state;}
    track({type:continuing?'login':'create-character'});track({type:'level',level:hero.level,amount:hero.level});applyHeroCosmetics(hero);
    Object.assign(hero,createSkillState());
    saveTimer = 0; persist();
    marker.visible = false; follow.focus.copy(hero.position); follow.update(hero.position, 1);
    mode='manual'; backgroundAutomation=false; engine.backgroundSimulation=false; ui.setMode(mode); ui.setBackgroundAutomation(false); teleportRemaining=0; pendingTravel=null;
    arrive('refuge'); input.setEnabled(true);
    ui.setState(state); ui.announce('Ember Refuge · Open Character to choose your destination.');
    ui.update(hero, kills, enemies.filter(e => e.active).length, false);
  }
  function recover(){
    if(state!=='dead')return;
    recoverHero(hero);state='playing';arrive('refuge');input.setEnabled(true);ui.setState(state);persist();refresh();
  }
  function toggleBackgroundAutomation() {
    if (state !== 'playing') return;
    backgroundAutomation = !backgroundAutomation;
    engine.backgroundSimulation = backgroundAutomation;
    ui.setBackgroundAutomation(backgroundAutomation);
    ui.announce(backgroundAutomation ? 'Hidden automation enabled. Keep Automation mode active.' : 'Hidden automation disabled.');
  }
  function togglePause() {
    if (state === 'inventory') { togglePanel(); return; }
    if (state !== 'playing' && state !== 'paused') return;
    state = state === 'playing' ? 'paused' : 'playing'; clearActions(true); input.setEnabled(state === 'playing'); ui.setState(state);
  }
  function interact() {
    if(state!=='playing'||campaign.region==='refuge'||towerArena)return;
    if((expedition||currentStage(stageRun)===1)&&!shrine.used&&hero.position.distanceTo(shrine.mesh.position)<3){ui.announce(activateShrine(hero,shrine).message);if(!expedition)advanceStage(stageRun,{type:'shrine'});}
    if((expedition||currentStage(stageRun)===2)&&!chestOpened&&hero.position.distanceTo(chest.position)<2.5){chestOpened=true;track({type:'chest',region:campaign.region,hidden:true});hero.currencies.gold+=80*REGIONS[campaign.region].level;advanceQuest(campaign,{type:'chest',region:campaign.region});advanceExpedition(expedition,{type:'chest'});if(!expedition)advanceStage(stageRun,{type:'chest'});ui.announce('Reliquary opened · Gold recovered.');persist();}
    if(!expedition&&canAdvanceStage(stageRun)&&hero.position.distanceTo(portal.position)<3)enterNextStage();
  }
  function update(dt) {
    if (state === 'teleporting') {
      if(document.hidden&&!(backgroundAutomation&&mode==='automation'))return;
      teleportRemaining=Math.max(0,teleportRemaining-dt);
      ui.setTeleport(teleportRemaining,REGIONS[pendingTravel.id].name);
      if(teleportRemaining<=.000001){
        const destination=pendingTravel;pendingTravel=null;teleportRemaining=0;
        arrive(destination.id,destination.run);clearActions();state='playing';input.setEnabled(true);ui.setState(state);refresh();
      }
      return;
    }
    if (state !== 'playing') return;
    dt=combat.advanceFeedback(dt);
    if(dt<=0)return;
    updateEvents(dt);
    tickPotionCooldown(hero,dt);
    tickStatusEffects(hero,dt,(target,amount)=>combat.damage(target,amount));
    if (!hero.alive) { finishTower();const lost=applyDeathPenalty(hero);persist(); state = 'dead'; clearActions(); input.setEnabled(false); ui.setState(state); ui.announce(`Lost ${lost} gold. Equipment and progress preserved.`);marker.visible = false;  refresh();return; }
    updateSkills(hero,dt);
    if(hero.dodgeTime>0) {
      world.move(hero,hero.dodgeDirection.x*22*dt,hero.dodgeDirection.z*22*dt);
      hero.target.copy(hero.position);
    }
    loot.automation=mode==='automation';
    const point = input.destination();
    if (mode === 'automation') {
      if(settings.autoEquip)for(const item of autoEquipStrongest(hero))track({type:'equip',slot:item.slot});
      const sold=autoSellInventory(hero,settings.autoSell);
      if(sold.count){for(let i=0;i<sold.count;i++)track({type:'sell'});ui.announce(sold.message);persist();}
      let target=chooseAutomationTarget(hero,enemies,loot);
      if(!towerArena&&!expedition&&campaign.region!=='refuge'){
        const objective=canAdvanceStage(stageRun)&&!enemies.some(e=>e.active&&e.alive&&!e.eventBoss)?portal:currentStage(stageRun)===1&&!stageRun.shrine&&stageRun.kills>=8?shrine.mesh:currentStage(stageRun)===2&&!stageRun.chest&&stageRun.champions>=2?chest:null;
        if(objective)target={position:objective.position,stop:1.2};
      }
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
    if (mode === 'automation') {
      evadeAutomationHazards(hero, enemies, world, dt);
      const casts=castAutomationSkills(hero,enemies,combat);if(casts.length)audio.play('skill');for(const skillId of casts)track({type:'cast-skill',skillId});
    }
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
    if(!towerArena&&campaign.region!=='refuge'&&!bossSpawned&&(expedition?expedition.kills>=expedition.target:currentStage(stageRun)===3)){
      const enemy=spawn(true,{x:0,z:-8,kind:'melee',rank:2});
      if(enemy){const boss=BOSSES[REGIONS[campaign.region].boss];Object.assign(enemy,{bossId:REGIONS[campaign.region].boss,eliteTrait:null,statusEffects:[],speed:UNDEAD.speed*(expedition?.speedMultiplier??1),attackSeconds:UNDEAD.attackSeconds*(expedition?.cooldownMultiplier??1),maxHp:boss.hp*(expedition?.healthMultiplier??difficultyMultiplier(campaign.difficulty).health),hp:boss.hp*(expedition?.healthMultiplier??difficultyMultiplier(campaign.difficulty).health),damage:boss.damage*(expedition?.damageMultiplier??difficultyMultiplier(campaign.difficulty).damage),rank:2,xp:400*REGIONS[campaign.region].level,active:true,alive:true});configureEnemyAppearance(enemy,enemy.kind,true);enemy.model.visible=true;enemy.model.scale.setScalar(2);enemy.position.set(0,0,-8);bossSpawned=true;enemy.moonBoosted=false;setMoonEnemy(enemy,campaign.events.bloodMoon.active);ui.announce(`${boss.name} approaches.`);}
    }
    spawnTimer += dt;
    if (spawnTimer >= WORLD.spawnSeconds) { spawnTimer = 0; if(!towerArena&&(expedition||currentStage(stageRun)===1&&stageRun.kills+enemies.filter(e=>e.active&&e.alive&&!e.eventBoss).length<8))spawn(); }
    if(mode==='automation'&&!towerArena&&!expedition&&isStageComplete(stageRun)&&!enemies.some(e=>e.active&&e.alive)&&!loot.pool.some(d=>loot.canCollect(hero,d))){farmingDelay+=dt;if(farmingDelay>=3){farmingDelay=0;travel(campaign.region);return;}}else farmingDelay=0;
    saveTimer += dt;
    if (saveTimer >= 10) { saveTimer = 0; persist(); }
    if (!hero.alive) { finishTower();const lost=applyDeathPenalty(hero);persist(); state = 'dead'; clearActions(); input.setEnabled(false); ui.setState(state); ui.announce(`Lost ${lost} gold. Equipment and progress preserved.`);marker.visible = false; }
    hudTimer += dt;
    if (hudTimer > .08 || state === 'dead') {
      hudTimer = 0; updateObjective();eventsUI.updateHud(campaign.events); ui.update(hero, kills, enemies.filter(e => e.active).length, false);
    }
  }
  function render(dt) {
    if (!follow) return;
    audio.setPaused(state!=='playing'||document.hidden, {allowDeathTail:state==='dead'&&!document.hidden});
    follow.reducedMotion=combat.reducedMotion=settings.reducedMotion;
    follow.update(hero.position, dt);
    combat.render(follow.camera,state==='playing',state==='playing'?dt:0);
    const animationDt = (state === 'playing' || state === 'ready') && combat.hitStopRemaining<=0 ? dt : 0;
    for (const actor of [hero, ...enemies]) {
      animateActor(actor, animationDt, follow.camera);
      if(settings.reducedMotion)actor.body.position.y=0;
      // Convert the camera's world rotation to the bar's local rotation.
      actor.bar.quaternion.copy(actor.model.quaternion).invert().multiply(follow.camera.quaternion);
    }
    drawRegionMap(document.getElementById('map-canvas'),hero,enemies,{region:campaign.region,chestOpened,shrineUsed:shrine.used,stage:expedition?null:currentStage(stageRun),shrine:shrine.mesh.position,chest:chest.position,portal:!expedition&&canAdvanceStage(stageRun)?portal.position:null});
    telegraphs.update();
    shrine.mesh.visible=!towerArena&&campaign.region!=='refuge'&&!shrine.used&&(!!expedition||currentStage(stageRun)===1);
    chest.visible=!towerArena&&campaign.region!=='refuge'&&!chestOpened&&(!!expedition||currentStage(stageRun)===2);
    portal.visible=!towerArena&&campaign.region!=='refuge'&&!expedition&&canAdvanceStage(stageRun);
    loot.render(follow.camera, state === 'playing');
    engine.renderer.render(engine.scene, follow.camera);
  }
  document.addEventListener('visibilitychange', () => {
    const canRunHidden = document.hidden && backgroundAutomation && mode === 'automation' && ['playing','teleporting'].includes(state);
    if (document.hidden && state === 'playing' && !canRunHidden) togglePause();
    audio.setPaused(document.hidden || state !== 'playing', {allowDeathTail:state==='dead'&&!document.hidden});
  });
  window.addEventListener('blur', () => { if (state === 'playing' && !(backgroundAutomation && mode === 'automation')) togglePause(); });
  window.addEventListener('pagehide', event => {
    persist();
    // A bfcache navigation preserves the live page; disposing it would break Back.
    if (event.persisted) { if (state === 'playing') togglePause(); return; }
    audio.dispose(); input.dispose(); follow.dispose(); engine.dispose();
  });
  ui.setBackgroundAutomation(false);
  ui.setState('ready'); ui.update(hero, 0, 0, false);
  document.querySelector('#loading').hidden = true;
  // Read-only diagnostic snapshots are useful for learning and automated checks.
  window.arpg = { snapshot: () => ({ state, mode, teleportRemaining,tower:towerArena?{...towerArena}:null,events:JSON.parse(JSON.stringify(campaign.events)),moonApplied, region:campaign.region, stage:{...stageRun}, difficulty:campaign.difficulty, objectives:{shrine:shrine.mesh.position.toArray(),chest:chest.position.toArray(),portal:portal.position.toArray()}, campaign:JSON.parse(JSON.stringify(campaign)), expedition:expedition?JSON.parse(JSON.stringify(expedition)):null, resource:hero.resource, blessingTime:hero.blessingTime, shrineUsed:shrine.used, skillCooldowns:{...hero.skillCooldowns}, dodgeCooldown:hero.dodgeCooldown, invulnerable:hero.invulnerable, classId: hero.classId, hp: hero.hp, maxHp: hero.maxHp, damage: hero.damage, armor: hero.armor, crit: hero.crit, range: hero.range, currencies: { ...hero.currencies }, potions: hero.potions, inventory: hero.inventory.map(i => ({ ...i, mods: { ...i.mods } })), equipment: JSON.parse(JSON.stringify(hero.equipment)), drops: loot.snapshot(), level: hero.level, xp: hero.xp, kills, position: hero.position.toArray(), enemies: enemies.filter(e => e.active).length, enemyDetails:enemies.filter(e=>e.active).map(e=>({hp:e.hp,maxHp:e.maxHp,damage:e.damage,bossId:e.bossId,eventBoss:e.eventBoss,moonBoosted:e.moonBoosted,packId:e.packId})), drawCalls: engine.renderer.info.render.calls, triangles: engine.renderer.info.render.triangles, geometries: engine.renderer.info.memory.geometries }) };
} catch (error) {
  engine?.dispose(); follow?.dispose(); input?.dispose();
  const loading = document.querySelector('#loading'); loading.hidden = false;
  loading.textContent = `Unable to start: ${error.message.replace(/\.$/,'')}. Use a current WebGL-capable desktop browser and a static HTTP host.`;
  console.error(error);
}
