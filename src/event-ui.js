import { getEventSummary, getClaimStatus, listEventCosmetics } from './events.js';
import { QUESTS } from './quests.js';
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const rewardText=r=>Object.entries(r??{}).filter(([k])=>!['itemCount','gemCount'].includes(k)).map(([k,v])=>k==='item'?`${r.itemCount??1} × ${v.rarity} ${v.slot??'gear'}`:k==='gem'?`${r.gemCount??1} × ${v}`:k==='choice'?'Choose a reward':k==='setPieces'?'5-piece Legendary set':typeof v==='number'?`${v} ${k}`:String(v)).join(' · ');

export class EventsUI {
  constructor(callbacks={}){
    this.callbacks=callbacks;
    this.list=document.getElementById('events-list');
  }

  render(state,hero,context={}){
    if(!this.list) return;
    this.hero=hero;
    const focus=document.activeElement?.dataset.eventAction;
    this.list.replaceChildren();
    const summaries=getEventSummary(state,context.now??Date.now());

    // Optional Quick Claim All banner inside events panel if multiple rewards are eligible
    const allEligible=summaries.flatMap(s=>s.rows.filter(r=>r.eligible).map(r=>({...r,eventId:s.id})));
    if(allEligible.length>1){
      const banner=node('div',undefined,'events-claim-all-banner');
      const allBtn=node('button',`⚡ Claim All Ready Rewards (${allEligible.length})`,'event-btn event-btn-claim');
      allBtn.type='button';
      allBtn.onclick=()=>{
        for(const item of allEligible){
          let choice=undefined;
          if(item.reward?.choice){
            choice=item.reward.choice.find(c=>c.startsWith('rare-weapon-')&&c.includes(hero?.classId||'warrior'))||item.reward.choice[0];
          }
          this.callbacks.onClaim?.(item.eventId,item.id,choice);
        }
      };
      banner.append(allBtn);
      this.list.append(banner);
    }

    for(const summary of summaries){
      const card=node('article',undefined,'event-card');
      const header=node('div',undefined,'event-card-header');
      header.append(node('h3',summary.title));
      if(summary.day) header.append(node('p',`Day ${summary.day} of 7 unlocked · Missed rewards remain available`,'event-card-meta'));
      card.append(header);

      if(summary.id==='infernal-tower'){
        const run=state.tower.run;
        card.append(node('p',run?`Floor ${run.floor} cleared · Checkpoint ${run.checkpoint} · Potions ${run.potionsUsed}/5`:'Climb without a floor cap. Leave between floors to bank your run.','event-card-desc'));
        const btnRow=node('div',undefined,'event-card-actions');
        for(const [label,callback,disabled] of [['Enter Tower','onStartTower',!!run],['Next floor','onNextFloor',!run||context.towerReady===false],['Leave Tower','onLeaveTower',!run]]){
          btnRow.append(this.button(label,callback,[],disabled,disabled?'btn-ghost':'btn-primary'));
        }
        card.append(btnRow);
        const bestRow=node('div',undefined,'event-tower-history');
        for(const [week,best] of Object.entries(state.tower.weekly)){
          bestRow.append(node('small',`${week}: floor ${best.floor} · ${Math.round(best.time)}s · Local best`,'event-tower-badge'));
        }
        if(bestRow.children.length) card.append(bestRow);
      }

      if(summary.id==='blood-moon'){
        card.append(node('p',summary.active?`Blood Moon active · ${Math.max(0,Math.ceil(300-state.bloodMoon.elapsed))}s remaining`:'A Blood Moon may rise after 30 minutes of play.','event-card-desc'));
        card.append(node('p',`Reaper fragments ${Math.min(100,state.bloodMoon.progress.fragments??0)}/100`,'event-card-meta'));
        if(summary.active){
          const act=node('div',undefined,'event-card-actions');
          act.append(this.button('Summon the Reaper','onSummonReaper',[],(state.bloodMoon.progress.fragments??0)<100||state.bloodMoon.reaperSpawned,'btn-primary'));
          card.append(act);
        }
      }

      const missionList=node('div',undefined,'event-missions-list');
      for(const row of summary.rows){
        const item=node('div',undefined,'event-mission');
        
        // Col 1: Goal and Reward
        const main=node('div',undefined,'event-mission-main');
        main.append(node('span',row.goal,'event-mission-goal'));
        const rewWrap=node('div',undefined,'event-reward-wrap');
        const rewBadge=node('span',`🎁 ${rewardText(row.reward)}`,'event-mission-reward');
        rewWrap.append(rewBadge);
        main.append(rewWrap);

        // Col 2: Progress bar and numerical counter
        const prog=node('div',undefined,'event-mission-progress');
        const bar=node('progress',undefined,'event-progress-bar');
        bar.max=row.target;
        bar.value=Math.min(row.target,row.progress);
        bar.setAttribute('aria-label',`${row.goal}: ${row.progress} of ${row.target}`);
        const counter=node('span',`${Math.min(row.target,row.progress)} / ${row.target}`,'event-mission-counter');
        prog.append(bar,counter);

        // Col 3: Actions
        const act=node('div',undefined,'event-mission-actions');
        let choice=null;
        if(row.reward?.choice){
          choice=node('select',undefined,'event-choice-select');
          choice.setAttribute('aria-label',`${row.goal} reward choice`);
          for(const id of row.reward.choice){
            const o=node('option',id);
            o.value=id;
            choice.append(o);
          }
          act.append(choice);
        }

        const statusCls=row.claimed?'event-btn-claimed':row.locked?'event-btn-locked':row.eligible?'event-btn-claim':'event-btn-progress';
        const labelText=row.claimed?'Claimed':row.locked?'Day locked':row.eligible?'Claim':'In progress';
        const button=node('button',labelText,`event-btn ${statusCls}`);
        button.type='button';
        button.disabled=!row.eligible;
        button.dataset.eventAction=`${summary.id}/${row.id}`;
        button.onclick=()=>this.callbacks.onClaim?.(summary.id,row.id,choice?.value);
        act.append(button);

        item.append(main,prog,act);
        missionList.append(item);
      }
      card.append(missionList);
      this.list.append(card);
    }

    if(hero){
      const wallet=node('section',undefined,'event-card event-wallet');
      const wHeader=node('div',undefined,'event-card-header');
      wHeader.append(node('h3','Supplies & appearance'));
      wallet.append(wHeader);

      const curRow=node('div',undefined,'event-supplies-chips');
      for(const [name,val,icon] of [
        ['Dust',hero.dust??0,'✨'],
        ['Shards',hero.shards??0,'💎'],
        ['Ruby',hero.socketGems?.ruby??0,'🔴'],
        ['Sapphire',hero.socketGems?.sapphire??0,'🔵'],
        ['Emerald',hero.socketGems?.emerald??0,'🟢']
      ]){
        const chip=node('div',undefined,'event-supply-chip');
        chip.append(node('span',icon,'supply-icon'),node('span',`${name}: ${val}`,'supply-label'));
        curRow.append(chip);
      }
      wallet.append(curRow);

      const consSec=node('div',undefined,'event-wallet-section');
      consSec.append(node('span','CONSUMABLES','eyebrow'));
      const consGrid=node('div',undefined,'event-wallet-grid');
      for(const [id,label] of [['manaPotions','Mana potion'],['portalScrolls','Portal scroll'],['resetTokens','Talent reset']]){
        consGrid.append(this.button(`${label} (${hero[id]??0})`,'onUseConsumable',[id],!(hero[id]>0),'btn-secondary'));
      }
      consSec.append(consGrid);
      wallet.append(consSec);

      const cosmSec=node('div',undefined,'event-wallet-section');
      cosmSec.append(node('span','COSMETICS & APPAREL','eyebrow'));
      const cosmGrid=node('div',undefined,'event-wallet-grid');
      for(const [type,ids] of Object.entries(listEventCosmetics(hero))){
        for(const id of ids){
          const isEquipped=hero.eventAppearance?.[type]===id;
          const b=this.button(`${isEquipped?'Equipped':'Equip'}: ${id}`,'onSelectCosmetic',[type,id],isEquipped,isEquipped?'btn-primary':'btn-secondary');
          cosmGrid.append(b);
        }
      }
      if(cosmGrid.children.length){
        cosmSec.append(cosmGrid);
        wallet.append(cosmSec);
      }

      this.list.append(wallet);
    }

    if(focus){
      const replacement=[...this.list.querySelectorAll('[data-event-action]')].find(e=>e.dataset.eventAction===focus);
      replacement?.focus({preventScroll:true});
    }
    this.updateHud(state,context.now);
  }

  button(label,callback,args=[],disabled=false,cls='btn-secondary'){
    const b=node('button',label,cls);
    b.type='button';
    b.disabled=disabled;
    b.onclick=()=>this.callbacks[callback]?.(...args);
    return b;
  }

  updateHud(state,now=Date.now(),campaign=null,onClaimRegionalQuest=null){
    const summaries=getEventSummary(state,now),first=summaries[0],moon=state.bloodMoon;
    const tracker=document.getElementById('first-steps-tracker');
    if(tracker){
      tracker.hidden=first.rows.every(r=>r.claimed)||document.body.dataset.state==='ready';
      const next=first.rows.find(r=>!r.claimed);
      tracker.textContent=next?`First Steps · ${next.goal} (${Math.min(next.progress,next.target)}/${next.target})`:'First Steps complete · Rookie';
    }
    const dot=document.getElementById('events-ready-dot');
    if(dot) dot.hidden=!summaries.some(s=>s.rows.some(r=>r.eligible));
    const panelDot=document.getElementById('panel-events-dot');
    if(panelDot) panelDot.hidden=!summaries.some(s=>s.rows.some(r=>r.eligible));
    const banner=document.getElementById('blood-moon-banner');
    if(banner){
      banner.hidden=!moon.active;
      banner.textContent=`BLOOD MOON · ${Math.max(0,Math.ceil(300-moon.elapsed))}s · 2× gold`;
    }

    // Collect all claimable event missions and regional quests
    const claimable=[];
    for(const s of summaries){
      for(const r of s.rows){
        if(r.eligible){
          claimable.push({type:'event',eventId:s.id,missionId:r.id,goal:r.goal,reward:r.reward,summaryTitle:s.title});
        }
      }
    }
    if(campaign&&onClaimRegionalQuest&&campaign.unlocked){
      for(const q of QUESTS){
        if(campaign.unlocked.includes(q.region)&&!campaign.claimedRewards.includes(q.id)&&(campaign.questProgress[q.id]??0)>=q.target){
          claimable.push({type:'quest',questId:q.id,goal:q.name,reward:{gold:q.gold,gems:q.gems,xp:q.xp}});
        }
      }
    }

    const badge=document.getElementById('hud-quest-badge');
    if(badge){
      badge.hidden=claimable.length===0||document.body.dataset.state==='ready';
      badge.textContent=`${claimable.length} READY`;
    }

    const claimContainer=document.getElementById('hud-quick-claim-container');
    if(claimContainer){
      claimContainer.hidden=claimable.length===0||document.body.dataset.state==='ready';
      claimContainer.replaceChildren();

      if(claimable.length>0&&document.body.dataset.state!=='ready'){
        const firstReady=claimable[0];
        const btn=node('button',undefined,'hud-quick-claim-btn');
        btn.id='hud-quick-claim-btn';
        btn.type='button';
        btn.dataset.action='quick-claim';

        const textRow=node('span',undefined,'hud-claim-text');
        textRow.append(node('span','⚡','hud-claim-spark'));
        textRow.append(node('span',claimable.length===1?`CLAIM: ${firstReady.goal}`:`QUICK CLAIM ALL (${claimable.length})`));
        const rew=node('span',`🎁 ${rewardText(firstReady.reward)}`,'hud-claim-reward-chip');
        btn.append(textRow,rew);

        btn.onclick=(e)=>{
          e.stopPropagation();
          for(const item of claimable){
            if(item.type==='event'){
              let choice=undefined;
              if(item.reward?.choice){
                choice=item.reward.choice.find(c=>c.startsWith('rare-weapon-')&&c.includes(this.hero?.classId||'warrior'))||item.reward.choice[0];
              }
              this.callbacks.onClaim?.(item.eventId,item.missionId,choice);
            } else if(item.type==='quest'){
              onClaimRegionalQuest(item.questId);
            }
          }
        };
        claimContainer.append(btn);
      }
    }
  }

  getClaimStatus(state,eventId,rewardId,now=Date.now()){
    return getClaimStatus(state,eventId,rewardId,{now});
  }
}
